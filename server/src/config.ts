import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import type { AppSettings } from './types';
import { getDataRoot } from './paths';

const DATA_ROOT = getDataRoot();
export const CONFIG_DIR = path.join(DATA_ROOT, 'config');
export const LOGS_DIR = path.join(DATA_ROOT, 'logs');
export const DATA_DIR = path.join(DATA_ROOT, 'data');
export const SETTINGS_PATH = path.join(CONFIG_DIR, 'settings.json');

function ensureDirs() {
  [CONFIG_DIR, LOGS_DIR, DATA_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function createDefaultSettings(): AppSettings {
  return {
    server: {
      host: '0.0.0.0',
      port: 8585,
      openBrowser: true,
    },
    holyrics: {
      host: 'localhost',
      port: 8091,
      token: '',
      pollIntervalMs: 750,
      previewIntervalMs: 2000,
      requestTimeoutMs: 5000,
      stageViewEnabled: true,
      stageViewPort: 8081,
      stageViewIntervalMs: 500,
    },
    admin: {
      passwordHash: bcrypt.hashSync('ohc@2026', 10),
    },
    security: {
      commandRateLimitMs: 300,
    },
  };
}

export function loadSettings(): AppSettings {
  ensureDirs();
  if (!fs.existsSync(SETTINGS_PATH)) {
    const defaults = createDefaultSettings();
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(defaults, null, 2));
    return defaults;
  }
  const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as AppSettings;
  // Merge with defaults to ensure all keys exist
  const defaults = createDefaultSettings();
  return {
    ...defaults,
    ...parsed,
    server: { ...defaults.server, ...parsed.server },
    holyrics: { ...defaults.holyrics, ...parsed.holyrics },
    admin: { ...defaults.admin, ...parsed.admin },
    security: { ...defaults.security, ...parsed.security },
  };
}

export function saveSettings(settings: AppSettings): void {
  ensureDirs();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}
