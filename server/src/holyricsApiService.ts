import type { AppSettings, ApiResponse, PresentationState } from './types';
import { logger, sanitizeForLog } from './logger';

export interface HolyricsConnectionInfo {
  ok: boolean;
  version?: string;
  permissions?: string[];
  error?: string;
}

export class HolyricsApiService {
  private settings: AppSettings;
  private baseUrl: string;
  private token: string;

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.token = settings.holyrics.token;
    this.baseUrl = `http://${settings.holyrics.host}:${settings.holyrics.port}`;
  }

  updateSettings(settings: AppSettings) {
    this.settings = settings;
    this.token = settings.holyrics.token;
    this.baseUrl = `http://${settings.holyrics.host}:${settings.holyrics.port}`;
  }

  private buildUrl(action: string): string {
    const url = new URL(`/api/${action}`, this.baseUrl);
    url.searchParams.set('token', this.token);
    return url.toString();
  }

  async request<T = unknown>(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(action);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.settings.holyrics.requestTimeoutMs
    );

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const text = await response.text();
      let json: ApiResponse<T>;
      try {
        json = JSON.parse(text) as ApiResponse<T>;
      } catch {
        throw new Error(`Resposta inválida da API: ${text.slice(0, 200)}`);
      }

      if (json.status === 'error') {
        const errMsg =
          typeof json.error === 'string'
            ? json.error
            : json.error?.message || JSON.stringify(json.error);
        throw new Error(`${action}: ${errMsg}`);
      }
      return json;
    } catch (err) {
      clearTimeout(timeout);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error(`Timeout ao chamar ${action}`);
      }
      throw err;
    }
  }

  async testConnection(): Promise<HolyricsConnectionInfo> {
    try {
      const versionRes = await this.request<{ version: string }>('GetVersion', {});
      const version = versionRes.data?.version;

      let permissions: string[] | undefined;
      try {
        const tokenInfo = await this.request<{ version: string; permissions: string }>(
          'GetTokenInfo',
          {}
        );
        permissions = tokenInfo.data?.permissions
          ? tokenInfo.data.permissions.split(',').map((p) => p.trim())
          : [];
      } catch (e) {
        logger.warn('GetTokenInfo indisponível para esta versão', sanitizeForLog(e));
      }

      return { ok: true, version, permissions };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Falha ao testar conexão com Holyrics:', message);
      return { ok: false, error: message };
    }
  }

  async getVersion(): Promise<string | undefined> {
    const res = await this.request<{ version: string }>('GetVersion', {});
    return res.data?.version;
  }

  async checkPermissions(actions: string[]): Promise<{ ok: boolean; unauthorized?: string[] }> {
    try {
      const res = await this.request<{ unauthorized_actions?: string }>('CheckPermissions', {
        actions: actions.join(','),
      });
      return { ok: res.status === 'ok', unauthorized: [] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('unauthorized')) {
        return { ok: false, unauthorized: actions };
      }
      // Se a ação não existir na API (ex.: GetTokenInfo), retorna erro
      throw err;
    }
  }

  async getCurrentPresentation(): Promise<PresentationState['data']> {
    const payload: Record<string, unknown> = {
      include_slides: true,
      include_slide_comment: false,
      include_slide_preview: false,
    };

    const res = await this.request<NonNullable<PresentationState['data']>>(
      'GetCurrentPresentation',
      payload
    );
    return res.data ?? null;
  }

  async getCurrentPresentationWithPreviews(size: string): Promise<PresentationState['data']> {
    const res = await this.request<NonNullable<PresentationState['data']>>('GetCurrentPresentation', {
      include_slides: true,
      include_slide_comment: false,
      include_slide_preview: true,
      slide_preview_size: size,
    });
    return res.data ?? null;
  }

  async actionNext(): Promise<void> {
    await this.request('ActionNext', {});
  }

  async actionPrevious(): Promise<void> {
    await this.request('ActionPrevious', {});
  }

  async actionGoToIndex(index: number): Promise<void> {
    await this.request('ActionGoToIndex', { index });
  }

  async actionGoToSlideDescription(name: string): Promise<void> {
    await this.request('ActionGoToSlideDescription', { name });
  }

  async closeCurrentPresentation(): Promise<void> {
    await this.request('CloseCurrentPresentation', {});
  }

  async searchSongs(text: string): Promise<Array<{ id: string; title: string; artist?: string; author?: string }>> {
    const res = await this.request<Array<{ id: string; title: string; artist?: string; author?: string }>>(
      'SearchLyrics',
      { text }
    );
    return res.data ?? [];
  }

  async showLyrics(id: string, initialIndex = 0): Promise<void> {
    await this.request('ShowLyrics', { id, initial_index: initialIndex });
  }

  async showVerse(references: string, version?: string, quickPresentation = false): Promise<void> {
    const payload: Record<string, unknown> = { references };
    if (version) payload.version = version;
    if (quickPresentation) payload.quick_presentation = true;
    await this.request('ShowVerse', payload);
  }

  async closeCurrentQuickPresentation(): Promise<void> {
    await this.request('CloseCurrentQuickPresentation', {});
  }

  async actionNextQuickPresentation(): Promise<void> {
    await this.request('ActionNextQuickPresentation', {});
  }

  async actionPreviousQuickPresentation(): Promise<void> {
    await this.request('ActionPreviousQuickPresentation', {});
  }

  async searchTexts(text: string): Promise<Array<{ id: string; title: string; folder?: string }>> {
    const res = await this.request<Array<{ id: string; title: string; folder?: string }>>(
      'SearchText',
      { text }
    );
    return res.data ?? [];
  }

  async showText(id: string, initialIndex = 0): Promise<void> {
    await this.request('ShowText', { id, initial_index: initialIndex });
  }

  async toggleF9(): Promise<void> {
    await this.request('ToggleF9', {});
  }

  async toggleF10(): Promise<void> {
    await this.request('ToggleF10', {});
  }

  async getLyricsPlaylist(): Promise<
    Array<{ id: string; title: string; artist?: string; author?: string }>
  > {
    const res = await this.request<Array<{ id: string; title: string; artist?: string; author?: string }>>(
      'GetLyricsPlaylist',
      {}
    );
    return res.data ?? [];
  }

  async getMediaPlaylist(): Promise<Array<{ id: string; type: string; name: string }>> {
    const res = await this.request<Array<{ id: string; type: string; name: string }>>(
      'GetMediaPlaylist',
      {}
    );
    return res.data ?? [];
  }

  async mediaPlaylistAction(id: string): Promise<void> {
    await this.request('MediaPlaylistAction', { id });
  }

  async getBibleVersions(): Promise<
    Array<{
      key: string;
      version: string;
      title: string;
      language?: { id?: string; iso?: string; name?: string; alt_name?: string };
    }>
  > {
    const res = await this.request<
      Array<{
        key: string;
        version: string;
        title: string;
        language?: { id?: string; iso?: string; name?: string; alt_name?: string };
      }>
    >('GetBibleVersionsV2', {});
    return res.data ?? [];
  }

  async getBibleSettings(): Promise<Record<string, unknown>> {
    const res = await this.request<Record<string, unknown>>('GetBibleSettings', {});
    return res.data ?? {};
  }

  async getBibleBooks(
    languageId: string
  ): Promise<Array<{ id: number; name: string; abbrev: string; usfx_code?: string }>> {
    const res = await this.request<
      Array<{ id: number; name: string; abbrev: string; usfx_code?: string }>
    >('GetBibleBooks', { language_id: languageId });
    return res.data ?? [];
  }
}
