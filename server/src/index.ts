import { spawn } from 'child_process';
import { loadSettings } from './config';
import { logger } from './logger';
import { createOHCServer } from './app';

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
  logger.info('Iniciando OHC — OBS Holyrics Controller...');

  const settings = loadSettings();
  const handle = createOHCServer(settings);

  const { port, displayHost } = await handle.start();

  console.log('\n================================================');
  console.log(' OHC — OBS Holyrics Controller');
  console.log('================================================');
  console.log(` Painel administrativo:  http://${displayHost}:${port}/admin`);
  console.log(` Dock de letras:         http://localhost:${port}/lyrics`);
  console.log(` Dock de versículos:     http://localhost:${port}/bible`);
  console.log(` Dock de slides:         http://localhost:${port}/slides`);
  console.log(` Interface palestrante:  http://${displayHost}:${port}/presenter`);
  console.log('================================================\n');

  if (settings.server.openBrowser) {
    openBrowser(`http://${displayHost}:${port}/admin`);
  }

  async function shutdown(signal: string) {
    logger.info(`Encerrando (${signal})...`);
    await handle.stop();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Erro fatal:', err);
  process.exit(1);
});
