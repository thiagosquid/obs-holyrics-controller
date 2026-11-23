import express from 'express';
import http from 'http';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { loadSettings, PROJECT_ROOT, DATA_DIR } from './config';
import { logger } from './logger';
import { HolyricsApiService } from './holyricsApiService';
import { StateManager } from './stateManager';
import { CommandQueue } from './commandQueue';
import { SessionManager } from './sessionManager';
import { StageViewService } from './stageViewService';
import { createApiRouter } from './routes/api';
import { createWebSocket } from './websocket';
import { getLocalIp } from './network';

function openBrowser(url: string) {
  const platform = process.platform;
  let command: string;
  let args: string[];

  if (platform === 'win32') {
    // "start" é um comando interno do cmd.exe, não um executável
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  try {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', (err) => {
      logger.warn(`Não foi possível abrir o navegador: ${err.message}`);
    });
    child.unref();
    logger.info(`Navegador aberto: ${url}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Não foi possível abrir o navegador: ${message}`);
  }
}

async function main() {
  logger.info('Iniciando Holyrics Web Controller...');

  const settings = loadSettings();
  const app = express();
  const server = http.createServer(app);

  app.use(express.json({ limit: '5mb' }));

  // API REST
  const apiService = new HolyricsApiService(settings);
  const stateManager = new StateManager(apiService, settings);
  const commandQueue = new CommandQueue(apiService, stateManager, settings.security.commandRateLimitMs);
  const sessionManager = new SessionManager();
  const stageViewService = new StageViewService(settings);

  // WebSocket
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

  // Páginas estáticas
  app.use(express.static(path.join(PROJECT_ROOT, 'server', 'public')));

  // Redirecionamentos amigáveis
  app.get('/admin', (req, res) => res.sendFile(path.join(PROJECT_ROOT, 'server', 'public', 'index.html')));
  app.get('/lyrics', (req, res) => res.sendFile(path.join(PROJECT_ROOT, 'server', 'public', 'index.html')));
  app.get('/bible', (req, res) => res.sendFile(path.join(PROJECT_ROOT, 'server', 'public', 'index.html')));
  app.get('/slides', (req, res) => res.sendFile(path.join(PROJECT_ROOT, 'server', 'public', 'index.html')));
  app.get('/presenter', (req, res) => res.sendFile(path.join(PROJECT_ROOT, 'server', 'public', 'index.html')));

  // Inicia polling do Holyrics
  stateManager.start();
  stageViewService.start();

  // Testa conexão com Holyrics na inicialização
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

  // PID file para encerramento controlado
  const pidFile = path.join(DATA_DIR, 'server.pid');
  fs.writeFileSync(pidFile, String(process.pid));

  const host = settings.server.host;
  const port = settings.server.port;
  const localIp = getLocalIp();
  const displayHost = host === '0.0.0.0' ? localIp : host;

  server.listen(port, host, () => {
    logger.info(`Servidor rodando em http://${displayHost}:${port}`);
    console.log('\n================================================');
    console.log(' Holyrics Web Controller iniciado');
    console.log('================================================');
    console.log(` Painel administrativo: http://${displayHost}:${port}/admin`);
    console.log(` Dock de letras:        http://localhost:${port}/lyrics`);
    console.log(` Dock de slides:        http://localhost:${port}/slides`);
    console.log(` Interface palestrante: http://${displayHost}:${port}/presenter`);
    console.log('================================================\n');

    if (settings.server.openBrowser) {
      openBrowser(`http://${displayHost}:${port}/admin`);
    }
  });

  // Graceful shutdown
  function shutdown() {
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

    server.close(() => {
      logger.info('Servidor encerrado.');
      process.exit(0);
    });

    // Encerra conexões HTTP ociosas/abertas que ainda seguram o server.close
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    setTimeout(() => {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
    }, 300);

    setTimeout(() => {
      logger.error('Forçando encerramento após timeout.');
      process.exit(1);
    }, 5000);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Erro fatal:', err);
  process.exit(1);
});
