import type { CommandType, QueuedCommand } from './types';
import { HolyricsApiService } from './holyricsApiService';
import { StateManager } from './stateManager';
import { logger } from './logger';

export class CommandQueue {
  private api: HolyricsApiService;
  private stateManager: StateManager;
  private queue: QueuedCommand[] = [];
  private processing = false;
  private lastCommandTime = 0;
  private rateLimitMs: number;

  constructor(api: HolyricsApiService, stateManager: StateManager, rateLimitMs: number) {
    this.api = api;
    this.stateManager = stateManager;
    this.rateLimitMs = rateLimitMs;
  }

  enqueue(command: Omit<QueuedCommand, 'id' | 'timestamp' | 'result'>): Promise<QueuedCommand> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const full: QueuedCommand = {
      ...command,
      id,
      timestamp: Date.now(),
      result: 'pending',
    };
    return new Promise((resolve) => {
      (full as any)._resolve = resolve;
      this.queue.push(full);
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const cmd = this.queue.shift()!;

    // Rate limit entre comandos de navegação
    const now = Date.now();
    const wait = this.rateLimitMs - (now - this.lastCommandTime);
    if (wait > 0) await this.sleep(wait);

    try {
      await this.execute(cmd);
      cmd.result = 'success';
      // Aguarda confirmação via estado atualizado
      await this.waitForStateUpdate(cmd);
    } catch (err) {
      cmd.result = 'error';
      cmd.error = err instanceof Error ? err.message : String(err);
      logger.error(`Comando ${cmd.type} falhou:`, cmd.error);
    }

    this.lastCommandTime = Date.now();
    const resolve = (cmd as any)._resolve as (c: QueuedCommand) => void;
    if (resolve) resolve(cmd);
    this.processing = false;
    this.process();
  }

  private async execute(cmd: QueuedCommand) {
    logger.info(`Executando comando ${cmd.type} da sessão ${cmd.sessionId}`);
    switch (cmd.type) {
      case 'next':
        await this.api.actionNext();
        break;
      case 'previous':
        await this.api.actionPrevious();
        break;
      case 'gotoIndex':
        if (typeof cmd.params?.index === 'number') {
          await this.api.actionGoToIndex(cmd.params.index);
        }
        break;
      case 'gotoDescription':
        if (typeof cmd.params?.name === 'string') {
          await this.api.actionGoToSlideDescription(cmd.params.name);
        }
        break;
      case 'close':
        await this.api.closeCurrentPresentation();
        break;
      case 'toggleF9':
        await this.api.toggleF9();
        break;
      case 'toggleF10':
        await this.api.toggleF10();
        break;
      case 'showLyrics':
        if (typeof cmd.params?.id === 'string') {
          await this.api.showLyrics(cmd.params.id);
        }
        break;
      case 'showMedia':
        if (typeof cmd.params?.id === 'string') {
          await this.api.mediaPlaylistAction(cmd.params.id);
        }
        break;
      default:
        throw new Error(`Tipo de comando desconhecido: ${cmd.type}`);
    }
  }

  private async waitForStateUpdate(cmd: QueuedCommand, timeoutMs = 3000): Promise<void> {
    const initialState = JSON.stringify(this.stateManager.getState().data);
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      await this.sleep(150);
      const current = JSON.stringify(this.stateManager.getState().data);
      if (current !== initialState) return;
    }
    // Timeout suave: não falha o comando, apenas loga
    logger.warn(`Confirmação de estado não recebida para comando ${cmd.type}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
