import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { logger } from './logger';
import { APP_VERSION } from './version';
import { isPackaged } from './paths';

/**
 * Atualização automática via GitHub Releases.
 *
 * Fluxo:
 *   checkForUpdate()  -> consulta o release mais recente e compara versões
 *   downloadLatest()  -> baixa o binário da plataforma atual
 *   applyUpdate()     -> substitui o executável (e reinicia, se pedido)
 *
 * Só atua quando empacotado (process.pkg); em desenvolvimento nunca mexe no
 * binário (process.execPath apontaria para o próprio node).
 */

const REPO_OWNER = 'thiagosquid';
const REPO_NAME = 'obs-holyrics-controller';
const LATEST_URL = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;

interface GitHubAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface GitHubRelease {
  tag_name: string;
  name?: string;
  body?: string;
  assets: GitHubAsset[];
}

export interface UpdateInfo {
  version: string;
  tag: string;
  notes: string;
  assetName: string;
  downloadUrl: string;
  size: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error';

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  latestVersion?: string;
  info?: UpdateInfo;
  downloadedPath?: string;
  error?: string;
}

let state: UpdateState = { status: 'idle', currentVersion: APP_VERSION };

export function getUpdateState(): UpdateState {
  return { ...state };
}

function assetNameForPlatform(): string {
  return process.platform === 'win32' ? 'OHC.exe' : 'ohc';
}

function parseVersion(tag: string): string {
  return tag.replace(/^v/i, '');
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da !== db) return da - db;
  }
  return 0;
}

async function fetchJson(url: string): Promise<GitHubRelease> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'OHC',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as GitHubRelease;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isPackaged()) {
    logger.warn('Atualização automática disponível apenas no executável empacotado.');
    return null;
  }
  if (state.status === 'available' || state.status === 'ready' || state.status === 'downloading') {
    return state.info ?? null;
  }

  state = { ...state, status: 'checking', error: undefined };
  try {
    const release = await fetchJson(LATEST_URL);
    const version = parseVersion(release.tag_name);
    const assetName = assetNameForPlatform();
    const asset = release.assets.find((a) => a.name === assetName);
    if (!asset) {
      throw new Error(`Ativo "${assetName}" não encontrado no release ${release.tag_name}`);
    }

    if (compareVersions(version, APP_VERSION) <= 0) {
      state = { ...state, status: 'up-to-date', currentVersion: APP_VERSION };
      return null;
    }

    const info: UpdateInfo = {
      version,
      tag: release.tag_name,
      notes: release.body ?? '',
      assetName,
      downloadUrl: asset.browser_download_url,
      size: asset.size,
    };
    state = { ...state, status: 'available', latestVersion: version, info };
    logger.info(`Nova versão disponível: v${version} (atual: v${APP_VERSION}).`);
    return info;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state = { ...state, status: 'error', error: message };
    logger.warn(`Falha ao verificar atualizações: ${message}`);
    return null;
  }
}

export async function downloadLatest(info?: UpdateInfo): Promise<string | null> {
  const target = info ?? state.info;
  if (!target) return null;

  state = { ...state, status: 'downloading' };
  try {
    const res = await fetch(target.downloadUrl, {
      headers: { Accept: 'application/octet-stream', 'User-Agent': 'OHC' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buf = Buffer.from(await res.arrayBuffer());
    if (target.size && buf.length !== target.size) {
      throw new Error(`Tamanho incorreto (recebido ${buf.length}, esperado ${target.size})`);
    }

    const dest = `${process.execPath}.new`;
    fs.writeFileSync(dest, buf);
    state = { ...state, status: 'ready', downloadedPath: dest };
    logger.info(`Atualização v${target.version} baixada e pronta.`);
    return dest;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    state = { ...state, status: 'error', error: message };
    logger.error(`Falha ao baixar atualização: ${message}`);
    return null;
  }
}

function execPath(): string {
  return process.execPath;
}

function writeWindowsUpdater(downloadedPath: string, target: string, restart: boolean): string {
  const batPath = path.join(path.dirname(target), '.ohc-update.bat');
  const lines = [
    '@echo off',
    ':loop',
    'ping 127.0.0.1 -n 2 > nul',
    `move /y "${downloadedPath}" "${target}" > nul 2>&1`,
    'if errorlevel 1 goto loop',
  ];
  if (restart) {
    lines.push(`start "" "${target}"`);
  }
  lines.push('del "%~f0" > nul 2>&1');
  fs.writeFileSync(batPath, lines.join('\r\n'));
  return batPath;
}

/**
 * Aplica a atualização já baixada.
 * @param restart reinicia o OHC após substituir o binário.
 */
export function applyUpdate(restart: boolean): boolean {
  if (!isPackaged()) return false;
  const downloadedPath = state.downloadedPath;
  if (!downloadedPath || !fs.existsSync(downloadedPath)) {
    return false;
  }

  const target = execPath();
  try {
    if (process.platform === 'win32') {
      const batPath = writeWindowsUpdater(downloadedPath, target, restart);
      const child = spawn('cmd', ['/c', batPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();
    } else {
      fs.chmodSync(downloadedPath, 0o755);
      fs.renameSync(downloadedPath, target);
      if (restart) {
        // Reinicia após 2s para o processo atual encerrar e liberar a porta.
        const child = spawn(
          'sh',
          ['-c', 'sleep 2; exec "$0" "$@"', target, ...process.argv.slice(1)],
          { detached: true, stdio: 'ignore' }
        );
        child.unref();
      }
    }
    state = { ...state, status: 'idle', downloadedPath: undefined };
    logger.info(restart ? 'Reiniciando com a nova versão...' : 'Atualização aplicada.');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`Falha ao aplicar atualização: ${message}`);
    return false;
  }
}

export function applyUpdateAndRestart(): boolean {
  return applyUpdate(true);
}

export function applyUpdateOnExit(): boolean {
  return applyUpdate(false);
}
