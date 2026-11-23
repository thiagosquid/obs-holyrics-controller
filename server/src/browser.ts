import { spawn } from 'child_process';
import { logger } from './logger';

/**
 * Abre uma URL no navegador padrão do usuário, sem bloquear o processo.
 * Funciona em Windows (cmd start), macOS (open) e Linux (xdg-open).
 */
export function openBrowser(url: string) {
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
