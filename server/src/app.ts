import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import type { AppSettings } from './types';
import { logger } from './logger';
import { DATA_DIR } from './config';
import { getPublicDir } from './paths';
import { getLocalIp } from './network';
import { HolyricsApiService } from './holyricsApiService';
import { StateManager } from './stateManager';
import { CommandQueue } from './commandQueue';
import { SessionManager } from './sessionManager';
import { StageViewService } from './stageViewService';
import { createApiRouter } from './routes/api';
import { createWebSocket } from './websocket';

export interface OHCStartInfo {
  host: string;
  port: number;
  displayHost: string;
}

export interface OHCHandle {
  settings: AppSettings;
  apiService: HolyricsApiService;
  stateManager: StateManager;
  stageViewService: StageViewService;
  start(): Promise<OHCStartInfo>;
  stop(): Promise<void>;
}

/**
 * Cria o servidor local do OHC sem iniciá-lo.
 * Permite que uma entrada de linha de comando, um launcher com ícone na
 * bandeja ou um futuro empacotador controlem o ciclo de vida do servidor.
 */
export function createOHCServer(settings: AppSettings): OHCHandle {
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '5mb' }));

  const apiService = new HolyricsApiService(settings);
  const stateManager = new StateManager(apiService, settings);
  const commandQueue = new CommandQueue(
    apiService,
    stateManager,
    settings.security.commandRateLimitMs
  );
  const sessionManager = new SessionManager();
  const stageViewService = new StageViewService(settings);

  const { io, disconnectSession, getClients } = createWebSocket(
    server,
    settings,
    stateManager,
    commandQueue,
    sessionManager
  );

  app.use(
    '/api',
    createApiRouter(settings, apiService, stateManager, sessionManager, {
      onSessionRevoked: disconnectSession,
      getClients,
      stageViewService,
    })
  );

  const publicDir = getPublicDir();
  const indexHtml = path.join(publicDir, 'index.html');
  app.use(express.static(publicDir));

  // Redirecionamentos amigáveis
  for (const route of ['/admin', '/lyrics', '/bible', '/slides', '/presenter']) {
    app.get(route, (_req, res) => res.sendFile(indexHtml));
  }

  const pidFile = path.join(DATA_DIR, 'server.pid');
  const displayHost =
    settings.server.host === '0.0.0.0' ? getLocalIp() : settings.server.host;

  return {
    settings,
    apiService,
    stateManager,
    stageViewService,
    start() {
      return new Promise<OHCStartInfo>((resolve, reject) => {
        server.once('error', (err) => reject(err));

        server.listen(settings.server.port, settings.server.host, () => {
          stateManager.start();
          stageViewService.start();

          try {
            fs.writeFileSync(pidFile, String(process.pid));
          } catch (err) {
            logger.warn('Não foi possível gravar o arquivo de PID:', err);
          }

          logger.info(`Servidor rodando em http://${displayHost}:${settings.server.port}`);

          apiService
            .testConnection()
            .then((info) => {
              if (info.ok) {
                logger.info(`Holyrics conectado. Versão: ${info.version}`);
              } else {
                logger.warn(`Holyrics não conectado: ${info.error}`);
              }
            })
            .catch((err) => logger.error('Erro ao testar Holyrics:', err));

          resolve({
            host: settings.server.host,
            port: settings.server.port,
            displayHost,
          });
        });
      });
    },
    async stop() {
      logger.info('Encerrando servidor...');
      stateManager.stop();
      stageViewService.stop();

      try {
        fs.unlinkSync(pidFile);
      } catch {
        // ignore
      }

      // Fecha o Socket.IO e os clientes conectados
      io.close();

      await new Promise<void>((resolve) => {
        server.close(() => {
          logger.info('Servidor encerrado.');
          resolve();
        });

        // Encerra conexões HTTP ociosas/abertas que ainda seguram o server.close
        if (typeof server.closeIdleConnections === 'function') {
          server.closeIdleConnections();
        }
        const forceIdle = setTimeout(() => {
          if (typeof server.closeAllConnections === 'function') {
            server.closeAllConnections();
          }
        }, 300);
        const forceTimeout = setTimeout(resolve, 5000);
        forceIdle.unref();
        forceTimeout.unref();
      });
    },
  };
}
