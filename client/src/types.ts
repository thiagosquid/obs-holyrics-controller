export interface SlideInfo {
  number: number;
  text: string;
  styled_text?: string;
  translations?: unknown;
  theme_id?: string;
  reference?: string;
  preview?: string | null;
}

export interface PresentationData {
  id: string;
  type: string;
  name: string;
  slide_number: number;
  total_slides: number;
  slide_type: string;
  slides: SlideInfo[];
}

export interface PresentationState {
  connected: boolean;
  connectionError?: string;
  apiVersion?: string;
  lastUpdate?: string;
  data: PresentationData | null;
}

export interface PresenterSessionInfo {
  name: string;
  permissions: string[];
}

export interface PresenterSession {
  id: string;
  token: string;
  name: string;
  permissions: string[];
  createdAt: string;
  revoked: boolean;
  blocked: boolean;
}

export interface AppSettings {
  server: {
    host: string;
    port: number;
    openBrowser: boolean;
  };
  holyrics: {
    host: string;
    port: number;
    token: string;
    pollIntervalMs: number;
    previewIntervalMs: number;
    requestTimeoutMs: number;
    stageViewEnabled: boolean;
    stageViewPort: number;
    stageViewIntervalMs: number;
  };
  security: {
    commandRateLimitMs: number;
  };
}

export interface ConnectedClient {
  socketId: string;
  type: 'admin' | 'dock' | 'presenter';
  name: string;
  ip?: string;
  connectedAt: string;
}

export interface ServerInfo {
  lanIp: string;
  port: number;
}

export type CompatibilityStatus = 'available' | 'unavailable' | 'unverified';

export interface CompatibilityFeature {
  key: string;
  name: string;
  minVersion: string;
  verified: boolean;
  implemented: boolean;
  note?: string;
  status: CompatibilityStatus;
}

export interface ServerStatus {
  status: string;
  server: { online: boolean };
  holyrics: { connected: boolean; error?: string; version?: string };
  presentation: {
    type: string;
    name: string;
    slide_number: number;
    total_slides: number;
    slide_type: string;
  } | null;
  lastUpdate?: string;
}

export type CommandType =
  | 'next'
  | 'previous'
  | 'gotoIndex'
  | 'gotoDescription'
  | 'close'
  | 'toggleF9'
  | 'toggleF10'
  | 'showLyrics'
  | 'showMedia';

export interface LyricsPlaylistItem {
  id: string;
  title: string;
  artist?: string;
  author?: string;
}

export interface MediaPlaylistItem {
  id: string;
  type: string;
  name: string;
}

export interface BibleVersion {
  key: string;
  version: string;
  title: string;
  language?: { id?: string; iso?: string; name?: string; alt_name?: string };
}

export interface BibleBook {
  id: number;
  name: string;
  abbrev: string;
}
