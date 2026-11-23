import fs from 'fs';
import path from 'path';
import SysTray from 'systray2';
import type { MenuItem } from 'systray2';
import systrayPackageJson from 'systray2/package.json';
import { loadSettings } from './config';
import { logger } from './logger';
import { createOHCServer } from './app';
import { openBrowser } from './browser';
import { getDataRoot, isPackaged } from './paths';

/**
 * Launcher do OHC: inicia o servidor local e mantém um ícone na bandeja
 * (status, abrir painel, encerrar). É a entrada usada pelo executável
 * empacotado; a versão CLI continua disponível em `index.ts`.
 *
 * Flags:
 *   --no-tray   executa sem ícone na bandeja (modo headless)
 */

function trayBinName(): string {
  if (process.platform === 'win32') return 'tray_windows_release.exe';
  if (process.platform === 'darwin') return 'tray_darwin_release';
  return 'tray_linux_release';
}

function trayIconPath(): string {
  const ext = process.platform === 'win32' ? 'ico' : 'png';
  // Desenvolvimento: server/assets/tray; empacotado: snapshot do pkg (leitura ok)
  return path.resolve(__dirname, '..', 'assets', 'tray', `ohc.${ext}`);
}

/**
 * Prepara o binário do helper da bandeja em um local gravável e executável.
 *
 * Motivo: o chmod interno do systray2 usa o modo simbólico '+x', que o
 * fs.chmod do Node não aceita — o erro é engolido e o spawn falha com
 * EACCES. Aqui copiamos o helper para <data>/tray/<versão>/ com 0o755 e
 * informamos esse diretório como copyDir; o systray2 encontra o arquivo
 * já existente e o utiliza diretamente.
 *
 * Empacotado com pkg, o helper vive no snapshot (somente leitura), então
 * essa cópia externa é obrigatória.
 */
function prepareTrayBin(): string | boolean {
  const binName = trayBinName();
  const srcBin = path.join(__dirname, '..', 'node_modules', 'systray2', 'traybin', binName);

  try {
    const version = (systrayPackageJson as { version: string }).version;
    // O systray2 acrescenta <versão> ao copyDir: <dir>/<versão>/<bin>
    const dir = path.join(getDataRoot(), 'data', 'tray');
    const dst = path.join(dir, version, binName);
    if (!fs.existsSync(dst)) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(srcBin, dst);
    }
    fs.chmodSync(dst, 0o755);
    return dir;
  } catch {
    // Fallback: tenta executar direto da origem (funciona em desenvolvimento,
    // onde node_modules é gravável; no pkg o snapshot é somente leitura).
    try {
      fs.chmodSync(srcBin, 0o755);
    } catch {
      // ignore
    }
    return isPackaged();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout após ${ms}ms`)), ms);
    timer.unref();
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

interface TrayHandle {
  kill(): void;
}

async function createTray(opts: {
  port: number;
  onOpenPanel: () => void;
  onExit: () => void;
}): Promise<TrayHandle | null> {
  const statusItem: MenuItem = {
    title: `OHC — rodando (porta ${opts.port})`,
    tooltip: 'OHC — OBS Holyrics Controller',
    checked: false,
    enabled: false,
  };
  const openItem: MenuItem = {
    title: 'Abrir painel',
    tooltip: 'Abre o painel administrativo no navegador',
    checked: false,
    enabled: true,
  };
  const exitItem: MenuItem = {
    title: 'Encerrar OHC',
    tooltip: 'Para o servidor local e sai',
    checked: false,
    enabled: true,
  };

  const systray = new SysTray({
    menu: {
      icon: trayIconPath(),
      title: 'OHC',
      tooltip: 'OHC — OBS Holyrics Controller',
      items: [statusItem, SysTray.separator, openItem, exitItem],
    },
    debug: false,
    copyDir: prepareTrayBin(),
  });

  try {
    await withTimeout(systray.ready(), 15000);
    // onError/onClick dependem de _process/_rl, criados de forma assíncrona
    // durante o init: só podem ser registrados após o ready().
    systray.onError((err) => {
      logger.warn('Erro no ícone da bandeja:', err.message);
    });
    systray.onClick((action) => {
      if (action.item.title === openItem.title) {
        opts.onOpenPanel();
      } else if (action.item.title === exitItem.title) {
        opts.onExit();
      }
    });
    logger.info('Ícone na bandeja iniciado');
    return {
      kill() {
        try {
          systray.kill(false).catch(() => {});
        } catch {
          // ignore
        }
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Bandeja indisponível (${message}); continuando sem ícone.`);
    try {
      systray.kill(false).catch(() => {});
    } catch {
      // ignore
    }
    return null;
  }
}

async function main() {
  const noTray = process.argv.includes('--no-tray');

  logger.info('Iniciando OHC — OBS Holyrics Controller...');

  const settings = loadSettings();
  const handle = createOHCServer(settings);
  const { port, displayHost } = await handle.start();

  const adminUrl = `http://${displayHost}:${port}/admin`;
  logger.info(`OHC iniciado — painel: ${adminUrl}`);

  if (settings.server.openBrowser) {
    openBrowser(adminUrl);
  }

  let exiting = false;

  async function shutdown(signal: string) {
    if (exiting) return;
    exiting = true;
    logger.info(`Encerrando (${signal})...`);
    if (tray) tray.kill();
    await handle.stop();
    process.exit(0);
  }

  const tray = noTray ? null : await createTray({
    port,
    onOpenPanel: () => openBrowser(`http://localhost:${port}/admin`),
    onExit: () => shutdown('bandeja'),
  });

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error('Erro fatal:', err);
  process.exit(1);
});
