import type { AppSettings } from './types';
import { logger } from './logger';

export interface StageViewFrame {
  buffer: Buffer;
  etag: string;
  updatedAt: string;
}

export interface StageViewStatus {
  enabled: boolean;
  available: boolean;
  error?: string;
  lastUpdate?: string;
}

export class StageViewService {
  private settings: AppSettings;
  private frame: StageViewFrame | null = null;
  private version = 0;
  private lastId = '';
  private timer: NodeJS.Timeout | null = null;
  private stopped = true;
  private error: string | undefined;
  private lastLoggedError: string | undefined;

  constructor(settings: AppSettings) {
    this.settings = settings;
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
    this.stop();
    if (settings.holyrics.stageViewEnabled) this.start();
  }

  start() {
    if (!this.settings.holyrics.stageViewEnabled) return;
    this.stopped = false;
    this.schedule(0);
    logger.info(
      `Stage view ativado: http://${this.settings.holyrics.host}:${this.settings.holyrics.stageViewPort}/view/widescreen`
    );
  }

  stop() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  getFrame(): StageViewFrame | null {
    return this.frame;
  }

  getStatus(): StageViewStatus {
    return {
      enabled: this.settings.holyrics.stageViewEnabled,
      available: this.frame !== null,
      error: this.error,
      lastUpdate: this.frame?.updatedAt,
    };
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => this.poll(), ms);
  }

  private async poll() {
    if (this.stopped) return;
    const { host, stageViewPort, stageViewIntervalMs } = this.settings.holyrics;
    const url = `http://${host}:${stageViewPort}/stage-view/widescreen.jpg?id=${encodeURIComponent(
      this.lastId
    )}&json=1`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as {
        img64?: string;
        id?: string;
        delay?: number | string;
      };

      if (data.id) this.lastId = String(data.id);
      if (data.img64 && data.img64 !== 'equals') {
        this.version += 1;
        this.frame = {
          buffer: Buffer.from(data.img64, 'base64'),
          etag: `"${this.lastId}-${this.version}"`,
          updatedAt: new Date().toISOString(),
        };
      }

      this.error = undefined;
      this.lastLoggedError = undefined;

      const delay = Number(data.delay);
      const serverDelay = Number.isFinite(delay) && delay > 0 ? delay : 0;
      const next = Math.max(
        200,
        Math.min(5000, Math.max(stageViewIntervalMs, serverDelay))
      );
      this.schedule(next);
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : String(err);
      this.error = message;
      if (this.lastLoggedError !== message) {
        logger.warn(
          `Stage view indisponível (${url}): ${message}. Verifique se o plugin "Servidor Web" do Holyrics está ativo nesta porta.`
        );
        this.lastLoggedError = message;
      }
      this.schedule(2000);
    }
  }
}
