import type { TrackMetadata, ThemeManifest } from '@cufflinks/shared';

/**
 * @summary Result shape for theme-mutating IPC operations.
 */
interface ThemeOpResult {
  ok: boolean;
  reason?: string;
}

/**
 * @summary Auth status returned by the main process.
 * Never includes raw token values.
 */
interface AuthStatus {
  spotify: { connected: boolean; username?: string; expiresAt?: number };
  lastfm: { connected: boolean; username?: string };
}

/**
 * @summary The `window.cufflinks` bridge exposed by the settings preload script.
 *
 * @remarks
 * All methods correspond 1:1 to IPC channels defined in `shared/src/ipc-channels.ts`.
 * The renderer must not import `ipcRenderer` directly.
 */
interface CufflinksSettingsBridge {
  // Now-playing
  getNowPlaying(): Promise<TrackMetadata | null>;
  onNowPlayingChanged(callback: (track: TrackMetadata | null) => void): () => void;

  // Auth
  getAuthStatus(): Promise<AuthStatus>;
  openSpotifyAuth(): Promise<void>;
  openLastfmAuth(): Promise<void>;
  revokeSpotify(): Promise<void>;
  revokeLastfm(): Promise<void>;

  // Settings
  getSettings(): Promise<unknown>;
  setSettings(partial: Record<string, unknown>): Promise<void>;

  // Themes
  getThemes(): Promise<ThemeManifest[]>;
  setActiveTheme(themeId: string): Promise<ThemeOpResult>;
  importTheme(fsPath: string): Promise<ThemeOpResult>;
  deleteTheme(themeId: string): Promise<ThemeOpResult>;

  // Sources
  setSourcePriority(priority: string[]): Promise<void>;
  onSourceStatusChanged(callback: (statuses: Record<string, string>) => void): () => void;
}

declare global {
  interface Window {
    cufflinks: CufflinksSettingsBridge;
  }
}
