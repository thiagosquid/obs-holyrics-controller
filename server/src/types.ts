export interface ServerSettings {
  host: string;
  port: number;
  openBrowser: boolean;
}

export interface HolyricsSettings {
  host: string;
  port: number;
  token: string;
  pollIntervalMs: number;
  previewIntervalMs: number;
  requestTimeoutMs: number;
  stageViewEnabled: boolean;
  stageViewPort: number;
  stageViewIntervalMs: number;
}

export interface AdminSettings {
  passwordHash: string;
}

export interface SecuritySettings {
  commandRateLimitMs: number;
}

export interface AppSettings {
  server: ServerSettings;
  holyrics: HolyricsSettings;
  admin: AdminSettings;
  security: SecuritySettings;
}

export interface SlideInfo {
  number: number;
  text: string;
  styled_text?: string;
  translations?: unknown;
  theme_id?: string;
  reference?: string;
  preview?: string | null;
}

export interface PresentationState {
  connected: boolean;
  connectionError?: string;
  apiVersion?: string;
  lastUpdate?: string;
  data: {
    id: string;
    type: 'song' | 'verse' | 'text' | 'audio' | 'image' | 'announcement' | 'automatic_presentation' | 'quick_presentation' | string;
    name: string;
    slide_number: number;
    total_slides: number;
    slide_type: string;
    slides: SlideInfo[];
  } | null;
}

export interface ApiResponse<T = unknown> {
  status: 'ok' | 'error';
  data?: T;
  error?: string | { message?: string; unauthorized_actions?: string; [key: string]: unknown };
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

export interface QueuedCommand {
  id: string;
  sessionId: string;
  type: CommandType;
  params?: Record<string, unknown>;
  timestamp: number;
  result?: 'pending' | 'success' | 'error';
  error?: string;
}

export type PresenterPermission = 'view' | 'next' | 'previous' | 'goto' | 'expanded';

export interface PresenterSession {
  id: string;
  token: string;
  name: string;
  permissions: PresenterPermission[];
  createdAt: string;
  revoked: boolean;
  blocked: boolean;
}

export interface ClientInfo {
  socketId: string;
  sessionId?: string;
  isAdmin: boolean;
  isDock?: boolean;
  connectedAt: string;
  ip?: string;
}
