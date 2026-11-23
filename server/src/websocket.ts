import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import bcrypt from 'bcryptjs';
import type { AppSettings, ClientInfo, PresenterPermission, PresentationState } from './types';
import { StateManager } from './stateManager';
import { CommandQueue } from './commandQueue';
import { SessionManager } from './sessionManager';
import { logger } from './logger';

export function createWebSocket(
  httpServer: HttpServer,
  settings: AppSettings,
  stateManager: StateManager,
  commandQueue: CommandQueue,
  sessionManager: SessionManager
) {
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
  });

  const clients = new Map<string, ClientInfo>();

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    const adminPassword = socket.handshake.auth?.adminPassword;
    const isAdmin = typeof adminPassword === 'string' && bcrypt.compareSync(adminPassword, settings.admin.passwordHash);

    if (isAdmin) {
      (socket as any).clientInfo = {
        socketId: socket.id,
        isAdmin: true,
        connectedAt: new Date().toISOString(),
        ip: socket.handshake.address,
      } as ClientInfo;
      return next();
    }

    if (typeof token === 'string') {
      const session = sessionManager.getSession(token);
      if (session) {
        (socket as any).clientInfo = {
          socketId: socket.id,
          sessionId: session.token,
          isAdmin: false,
          connectedAt: new Date().toISOString(),
          ip: socket.handshake.address,
        } as ClientInfo;
        return next();
      }
    }

    // Docks do OBS (acesso local/controle do operador) podem conectar sem autenticação
    const referer = String(socket.handshake.headers.referer || '');
    if (
      referer.includes('/lyrics') ||
      referer.includes('/slides') ||
      referer.includes('/bible')
    ) {
      (socket as any).clientInfo = {
        socketId: socket.id,
        isAdmin: false,
        isDock: true,
        connectedAt: new Date().toISOString(),
        ip: socket.handshake.address,
      } as ClientInfo;
      return next();
    }

    next(new Error('Autenticação necessária'));
  });

  io.on('connection', (socket: Socket) => {
    const info = (socket as any).clientInfo as ClientInfo;
    clients.set(socket.id, info);
    const clientLabel = info.isAdmin ? 'admin' : info.isDock ? 'dock' : info.sessionId || 'anon';
    logger.info(`Cliente conectado: ${clientLabel} (${info.ip})`);

    // Envia estado atual
    socket.emit('state', stateManager.getState());

    socket.on('command', async (payload: { type: string; params?: Record<string, unknown> }) => {
      const info = clients.get(socket.id);
      if (!info) return;

      const session = info.sessionId ? sessionManager.getSession(info.sessionId) : undefined;
      const permissionMap: Record<string, PresenterPermission> = {
        next: 'next',
        previous: 'previous',
        gotoIndex: 'goto',
        gotoDescription: 'goto',
        close: 'expanded',
        toggleF9: 'expanded',
        toggleF10: 'expanded',
        showLyrics: 'expanded',
        showMedia: 'expanded',
      };

      const canControl = info.isAdmin || info.isDock || (session && sessionManager.can(session, permissionMap[payload.type]));
      if (!canControl) {
        socket.emit('commandResult', { success: false, error: 'Permissão negada' });
        return;
      }

      try {
        const result = await commandQueue.enqueue({
          sessionId: info.isAdmin ? 'admin' : info.sessionId || 'unknown',
          type: payload.type as any,
          params: payload.params,
        });
        socket.emit('commandResult', {
          success: result.result === 'success',
          error: result.error,
          commandId: result.id,
        });
      } catch (err) {
        socket.emit('commandResult', {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });

    const onStateChange = (state: PresentationState) => socket.emit('state', state);
    stateManager.on('change', onStateChange);

    socket.on('disconnect', () => {
      stateManager.off('change', onStateChange);
      clients.delete(socket.id);
      logger.info(`Cliente desconectado: ${info.isAdmin ? 'admin' : info.isDock ? 'dock' : info.sessionId || 'anon'}`);
    });
  });

  function broadcast(event: string, data: unknown) {
    io.emit(event, data);
  }

  function getClients(): ClientInfo[] {
    return Array.from(clients.values());
  }

  function disconnectSession(sessionToken: string) {
    for (const socket of io.sockets.sockets.values()) {
      const info = clients.get(socket.id);
      if (info?.sessionId === sessionToken) {
        socket.disconnect(true);
      }
    }
  }

  return { io, broadcast, getClients, disconnectSession };
}
