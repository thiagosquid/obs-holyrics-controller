import { EventEmitter } from 'events';
import type { AppSettings, PresentationState, SlideInfo } from './types';
import { HolyricsApiService } from './holyricsApiService';
import { logger } from './logger';

type PresentationData = NonNullable<PresentationState['data']>;

const PREVIEW_SIZE = '640x360';
const PREVIEW_CACHE_LIMIT = 500;

export class StateManager extends EventEmitter {
  private api: HolyricsApiService;
  private settings: AppSettings;
  private state: PresentationState;
  private timer: NodeJS.Timeout | null = null;
  private previewCache = new Map<string, string>();
  private previewBusy = false;
  private running = false;

  constructor(api: HolyricsApiService, settings: AppSettings) {
    super();
    this.api = api;
    this.settings = settings;
    this.state = {
      connected: false,
      data: null,
    };
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
    if (this.running) {
      this.stop();
      this.start();
    }
  }

  getState(): PresentationState {
    return { ...this.state };
  }

  setApiVersion(version: string) {
    this.setState({ apiVersion: version });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.poll();
    this.fetchVersion();
    this.timer = setInterval(() => this.poll(), this.settings.holyrics.pollIntervalMs);
    logger.info('StateManager iniciado');
  }

  private async fetchVersion() {
    try {
      const version = await this.api.getVersion();
      if (version) this.setState({ apiVersion: version });
    } catch {
      // versão indisponível não impede o funcionamento
    }
  }

  stop() {
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('StateManager parado');
  }

  async forceUpdate() {
    await this.poll();
  }

  private slideKey(data: PresentationData, slide: SlideInfo): string {
    return `${data.type}|${data.id}|${slide.number}|${slide.text}`;
  }

  private mergePreviews(data: PresentationData | null): PresentationData | null {
    if (!data) return null;
    return {
      ...data,
      slides: (data.slides ?? []).map((slide) => ({
        ...slide,
        preview: slide.preview ?? this.previewCache.get(this.slideKey(data, slide)) ?? null,
      })),
    };
  }

  private needsPreview(data: PresentationData | null): boolean {
    if (!data || !data.slides?.length) return false;
    const current = data.slides.find((s) => s.number === data.slide_number);
    if (!current) return false;
    return !this.previewCache.has(this.slideKey(data, current));
  }

  private async poll() {
    try {
      const raw = await this.api.getCurrentPresentation();
      const data = this.mergePreviews(raw);
      this.setState({ connected: true, connectionError: undefined, data });
      if (this.needsPreview(raw)) {
        this.fetchPreviews();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ connected: false, connectionError: message });
      logger.error('Erro ao consultar GetCurrentPresentation:', message);
    }
  }

  private async fetchPreviews() {
    if (this.previewBusy) return;
    this.previewBusy = true;
    try {
      const raw = await this.api.getCurrentPresentationWithPreviews(PREVIEW_SIZE);
      if (raw?.slides) {
        if (this.previewCache.size > PREVIEW_CACHE_LIMIT) this.previewCache.clear();
        for (const slide of raw.slides) {
          if (slide.preview) this.previewCache.set(this.slideKey(raw, slide), slide.preview);
        }
      }
      if (this.state.data) {
        this.setState({ data: this.mergePreviews(this.state.data) });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Erro ao buscar previews:', message);
    } finally {
      this.previewBusy = false;
    }
  }

  private setState(newState: Partial<PresentationState>) {
    const next = { ...this.state, ...newState };
    const changed =
      JSON.stringify({ ...this.state, lastUpdate: undefined }) !==
      JSON.stringify({ ...next, lastUpdate: undefined });
    this.state = { ...next, lastUpdate: new Date().toISOString() };
    if (changed) this.emit('change', this.getState());
  }
}
