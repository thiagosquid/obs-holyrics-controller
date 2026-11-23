import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import type { AppSettings, ClientInfo } from '../types';
import { saveSettings, LOGS_DIR } from '../config';
import { HolyricsApiService } from '../holyricsApiService';
import { StateManager } from '../stateManager';
import { SessionManager } from '../sessionManager';
import { StageViewService } from '../stageViewService';
import { getLocalIp } from '../network';
import { buildCompatibility } from '../compatibility';
import { logger } from '../logger';
import { APP_VERSION } from '../version';

interface RouterDeps {
  onSessionRevoked: (sessionToken: string) => void;
  getClients: () => ClientInfo[];
  stageViewService: StageViewService;
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function createApiRouter(
  settings: AppSettings,
  api: HolyricsApiService,
  stateManager: StateManager,
  sessionManager: SessionManager,
  deps: RouterDeps
): Router {
  const router = Router();

  function requireAdmin(req: Request, res: Response, next: () => void) {
    const password = req.headers['x-admin-password'] as string | undefined;
    if (password && bcrypt.compareSync(password, settings.admin.passwordHash)) {
      return next();
    }
    res.status(401).json({ status: 'error', error: 'Não autorizado' });
  }

  function requireDockOrAdmin(req: Request, res: Response, next: () => void) {
    const password = req.headers['x-admin-password'] as string | undefined;
    if (password && bcrypt.compareSync(password, settings.admin.passwordHash)) {
      return next();
    }
    const referer = String(req.headers.referer || '');
    if (
      referer.includes('/lyrics') ||
      referer.includes('/slides') ||
      referer.includes('/bible')
    ) {
      return next();
    }
    res.status(401).json({ status: 'error', error: 'Não autorizado' });
  }

  function canAccessStageView(req: Request): boolean {
    const password = req.headers['x-admin-password'] as string | undefined;
    if (password && bcrypt.compareSync(password, settings.admin.passwordHash)) return true;
    const token = String(req.query.token || '');
    if (token && sessionManager.getSession(token)) return true;
    const referer = String(req.headers.referer || '');
    return (
      referer.includes('/lyrics') ||
      referer.includes('/slides') ||
      referer.includes('/bible')
    );
  }

  router.get('/stage-view/frame', (req, res) => {
    if (!canAccessStageView(req)) {
      return res.status(401).json({ status: 'error', error: 'Não autorizado' });
    }
    const frame = deps.stageViewService.getFrame();
    if (!frame) {
      // Sem frame: não é erro de rede. O cliente tenta novamente com backoff.
      return res.status(204).end();
    }
    if (req.headers['if-none-match'] === frame.etag) {
      return res.status(304).end();
    }
    res.setHeader('ETag', frame.etag);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Content-Type', 'image/jpeg');
    res.send(frame.buffer);
  });

  router.get('/admin/stage-view/status', requireAdmin, (req, res) => {
    res.json({ status: 'ok', ...deps.stageViewService.getStatus() });
  });

  router.get('/playlists/lyrics', requireDockOrAdmin, async (req, res) => {
    try {
      const items = await api.getLyricsPlaylist();
      res.json({ status: 'ok', items });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/playlists/media', requireDockOrAdmin, async (req, res) => {
    try {
      const items = await api.getMediaPlaylist();
      res.json({ status: 'ok', items });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/admin/bible/versions', requireAdmin, async (req, res) => {
    try {
      const [versions, bibleSettings] = await Promise.all([
        api.getBibleVersions(),
        api.getBibleSettings(),
      ]);
      const defaultVersion =
        (typeof bibleSettings.tab_version_1 === 'string' && bibleSettings.tab_version_1) ||
        versions[0]?.key ||
        '';
      res.json({ status: 'ok', versions, defaultVersion });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/admin/bible/books', requireAdmin, async (req, res) => {
    const language = String(req.query.language || '').trim();
    if (!language) return res.status(400).json({ status: 'error', error: 'Idioma ausente' });
    try {
      const books = await api.getBibleBooks(language);
      res.json({ status: 'ok', books });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/bible/versions', requireDockOrAdmin, async (req, res) => {
    try {
      const [versions, bibleSettings] = await Promise.all([
        api.getBibleVersions(),
        api.getBibleSettings(),
      ]);
      const defaultVersion =
        (typeof bibleSettings.tab_version_1 === 'string' && bibleSettings.tab_version_1) ||
        versions[0]?.key ||
        '';
      res.json({ status: 'ok', versions, defaultVersion });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/bible/books', requireDockOrAdmin, async (req, res) => {
    const language = String(req.query.language || '').trim();
    if (!language) return res.status(400).json({ status: 'error', error: 'Idioma ausente' });
    try {
      const books = await api.getBibleBooks(language);
      res.json({ status: 'ok', books });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/bible/show', requireDockOrAdmin, async (req, res) => {
    const references = String(req.body?.references || '').trim();
    const version = req.body?.version ? String(req.body.version) : undefined;
    const quick = req.body?.quick !== false;
    if (!references) {
      return res.status(400).json({ status: 'error', error: 'Referência ausente' });
    }
    try {
      await api.showVerse(references, version, quick);
      logger.info(`Versículo ${quick ? 'rápido ' : ''}iniciado pelo dock: ${references}`);
      res.json({ status: 'ok', quick });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/bible/next', requireDockOrAdmin, async (req, res) => {
    try {
      await api.actionNextQuickPresentation();
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/bible/previous', requireDockOrAdmin, async (req, res) => {
    try {
      await api.actionPreviousQuickPresentation();
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/bible/quick/close', requireDockOrAdmin, async (req, res) => {
    try {
      await api.closeCurrentQuickPresentation();
      logger.info('Apresentação rápida fechada pelo dock de versículos');
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/server-info', (req, res) => {
    res.json({
      status: 'ok',
      lanIp: getLocalIp(),
      port: settings.server.port,
      version: APP_VERSION,
    });
  });

  router.get('/status', (req, res) => {
    const state = stateManager.getState();
    res.json({
      status: 'ok',
      server: { online: true, version: APP_VERSION },
      holyrics: {
        connected: state.connected,
        error: state.connectionError,
        version: state.apiVersion,
      },
      presentation: state.data
        ? {
            type: state.data.type,
            name: state.data.name,
            slide_number: state.data.slide_number,
            total_slides: state.data.total_slides,
            slide_type: state.data.slide_type,
          }
        : null,
      lastUpdate: state.lastUpdate,
    });
  });

  router.post('/admin/login', (req, res) => {
    const { password } = req.body || {};
    if (password && bcrypt.compareSync(password, settings.admin.passwordHash)) {
      res.json({ status: 'ok', admin: true });
    } else {
      res.status(401).json({ status: 'error', error: 'Senha inválida' });
    }
  });

  router.get('/admin/settings', requireAdmin, (req, res) => {
    const safe = {
      server: { ...settings.server },
      holyrics: {
        ...settings.holyrics,
        token: settings.holyrics.token ? '***' : '',
      },
      security: { ...settings.security },
    };
    res.json({ status: 'ok', settings: safe });
  });

  router.post('/admin/settings', requireAdmin, (req, res) => {
    const body = (req.body || {}) as Partial<AppSettings>;

    const next: AppSettings = {
      server: { ...settings.server, ...(body.server || {}) },
      holyrics: { ...settings.holyrics, ...(body.holyrics || {}) },
      admin: { ...settings.admin },
      security: { ...settings.security, ...(body.security || {}) },
    };

    if (!body.holyrics?.token || body.holyrics.token === '***') {
      next.holyrics.token = settings.holyrics.token;
    }

    next.server.port = clampInt(next.server.port, settings.server.port, 1, 65535);
    next.holyrics.port = clampInt(next.holyrics.port, settings.holyrics.port, 1, 65535);
    next.holyrics.pollIntervalMs = clampInt(next.holyrics.pollIntervalMs, 750, 250, 10000);
    next.holyrics.previewIntervalMs = clampInt(next.holyrics.previewIntervalMs, 2000, 500, 30000);
    next.holyrics.requestTimeoutMs = clampInt(next.holyrics.requestTimeoutMs, 5000, 500, 30000);
    next.holyrics.stageViewPort = clampInt(next.holyrics.stageViewPort, 8081, 1, 65535);
    next.holyrics.stageViewIntervalMs = clampInt(
      next.holyrics.stageViewIntervalMs,
      500,
      200,
      5000
    );
    next.holyrics.stageViewEnabled = Boolean(next.holyrics.stageViewEnabled);
    next.security.commandRateLimitMs = clampInt(next.security.commandRateLimitMs, 300, 0, 5000);

    Object.assign(settings, next);
    saveSettings(settings);
    api.updateSettings(settings);
    stateManager.updateSettings(settings);
    deps.stageViewService.updateSettings(settings);
    logger.info('Configurações administrativas atualizadas');
    res.json({ status: 'ok', restartRequired: body.server?.port !== undefined });
  });

  router.post('/admin/test-connection', requireAdmin, async (req, res) => {
    try {
      const info = await api.testConnection();
      if (info.ok && info.version) stateManager.setApiVersion(info.version);
      res.json({ status: 'ok', ...info });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/admin/compatibility', requireAdmin, (req, res) => {
    const version = stateManager.getState().apiVersion;
    res.json({
      status: 'ok',
      version: version || null,
      features: buildCompatibility(version),
    });
  });

  router.get('/admin/clients', requireAdmin, (req, res) => {
    const clients = deps.getClients().map((c) => {
      if (c.isAdmin) {
        return {
          socketId: c.socketId,
          type: 'admin',
          name: 'Administrador',
          ip: c.ip,
          connectedAt: c.connectedAt,
        };
      }
      if (c.isDock) {
        return {
          socketId: c.socketId,
          type: 'dock',
          name: 'Dock OBS',
          ip: c.ip,
          connectedAt: c.connectedAt,
        };
      }
      const session = c.sessionId ? sessionManager.getSession(c.sessionId) : undefined;
      return {
        socketId: c.socketId,
        type: 'presenter',
        name: session?.name || 'Palestrante',
        ip: c.ip,
        connectedAt: c.connectedAt,
      };
    });
    res.json({ status: 'ok', clients });
  });

  router.get('/admin/sessions', requireAdmin, (req, res) => {
    res.json({ status: 'ok', sessions: sessionManager.listSessions() });
  });

  router.post('/admin/sessions', requireAdmin, (req, res) => {
    const { name, permissions } = req.body || {};
    const session = sessionManager.createSession(
      name || 'Palestrante',
      Array.isArray(permissions) ? permissions : ['view', 'next', 'previous']
    );
    res.json({ status: 'ok', session });
  });

  router.post('/admin/sessions/:id/revoke', requireAdmin, (req, res) => {
    const session = sessionManager.listSessions().find((s) => s.id === req.params.id);
    const ok = sessionManager.revokeSession(req.params.id);
    if (ok && session) {
      deps.onSessionRevoked(session.token);
      logger.info(`Sessão revogada: ${session.name}`);
    }
    res.json({ status: ok ? 'ok' : 'error' });
  });

  router.post('/admin/sessions/:id/block', requireAdmin, (req, res) => {
    const ok = sessionManager.blockSession(req.params.id, true);
    res.json({ status: ok ? 'ok' : 'error' });
  });

  router.post('/admin/sessions/:id/unblock', requireAdmin, (req, res) => {
    const ok = sessionManager.blockSession(req.params.id, false);
    res.json({ status: ok ? 'ok' : 'error' });
  });

  router.post('/admin/sessions/:id/permissions', requireAdmin, (req, res) => {
    const { permissions } = req.body || {};
    const ok = sessionManager.setPermissions(
      req.params.id,
      Array.isArray(permissions) ? permissions : []
    );
    res.json({ status: ok ? 'ok' : 'error' });
  });

  router.get('/admin/library/songs', requireAdmin, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ status: 'ok', items: [] });
    try {
      const items = await api.searchSongs(q);
      res.json({ status: 'ok', items });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/admin/library/texts', requireAdmin, async (req, res) => {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) return res.json({ status: 'ok', items: [] });
    try {
      const items = await api.searchTexts(q);
      res.json({ status: 'ok', items });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/admin/show/lyrics', requireAdmin, async (req, res) => {
    const id = String(req.body?.id || '');
    if (!id) return res.status(400).json({ status: 'error', error: 'ID ausente' });
    try {
      await api.showLyrics(id);
      logger.info(`Música iniciada pelo admin: ${id}`);
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/admin/show/verse', requireAdmin, async (req, res) => {
    const references = String(req.body?.references || '').trim();
    const version = req.body?.version ? String(req.body.version) : undefined;
    const quick = req.body?.quick !== false;
    if (!references) return res.status(400).json({ status: 'error', error: 'Referência ausente' });
    try {
      await api.showVerse(references, version, quick);
      logger.info(`Versículo ${quick ? 'rápido ' : ''}iniciado pelo admin: ${references}`);
      res.json({ status: 'ok', quick });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/admin/quick/close', requireAdmin, async (req, res) => {
    try {
      await api.closeCurrentQuickPresentation();
      logger.info('Apresentação rápida fechada pelo admin');
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post('/admin/show/text', requireAdmin, async (req, res) => {
    const id = String(req.body?.id || '');
    if (!id) return res.status(400).json({ status: 'error', error: 'ID ausente' });
    try {
      await api.showText(id);
      logger.info(`Texto iniciado pelo admin: ${id}`);
      res.json({ status: 'ok' });
    } catch (err) {
      res.status(502).json({
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.get('/admin/logs', requireAdmin, (req, res) => {
    const logPath = path.join(LOGS_DIR, 'server.log');
    if (!fs.existsSync(logPath)) {
      return res.json({ status: 'ok', logs: [] });
    }
    const lines = 200;
    const data = fs.readFileSync(logPath, 'utf-8');
    const logLines = data.split('\n').filter(Boolean).slice(-lines);
    res.json({ status: 'ok', logs: logLines });
  });

  router.get('/admin/logs/export/:type', requireAdmin, (req, res) => {
    const type = req.params.type;
    if (type !== 'server' && type !== 'error') {
      return res.status(400).json({ status: 'error', error: 'Tipo de log inválido' });
    }
    const fileName = type === 'error' ? 'error.log' : 'server.log';
    const filePath = path.join(LOGS_DIR, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ status: 'error', error: 'Arquivo de log não encontrado' });
    }
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    fs.createReadStream(filePath).pipe(res);
  });

  router.get('/presenter/session', (req, res) => {
    const token = req.query.token as string;
    const session = token ? sessionManager.getSession(token) : undefined;
    if (!session) {
      return res.status(403).json({ status: 'error', error: 'Sessão inválida ou revogada' });
    }
    res.json({
      status: 'ok',
      session: {
        name: session.name,
        permissions: session.permissions,
      },
    });
  });

  return router;
}
