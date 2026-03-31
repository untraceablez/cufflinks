import { contextBridge, ipcRenderer } from 'electron';
import type { TrackMetadata, ThemeManifest } from '@cufflinks/shared';
import { IPC } from '@cufflinks/shared';

/**
 * @summary Auth status returned to the settings renderer.
 *
 * @remarks
 * Never includes raw token values — only derived connection state and display metadata.
 */
export interface AuthStatus {
  spotify: { connected: boolean; username?: string; expiresAt?: number };
  lastfm: { connected: boolean; username?: string };
}

/**
 * @summary Result shape for theme-mutating operations.
 */
export interface ThemeOpResult {
  ok: boolean;
  reason?: string;
}

/**
 * @summary The `window.cufflinks` API exposed to the settings renderer via contextBridge.
 *
 * @remarks
 * All IPC calls are mediated here — the renderer never calls `ipcRenderer` directly.
 * This file is compiled as a preload script and runs in a privileged context with
 * `contextIsolation: true`, so the renderer only sees what is explicitly exposed below.
 *
 * Security rules:
 * - Never expose `ipcRenderer` itself.
 * - Never forward raw credential values to the renderer.
 * - Validate/coerce inputs before forwarding to main.
 */
contextBridge.exposeInMainWorld('cufflinks', {
  // -------------------------------------------------------------------------
  // Now-playing
  // -------------------------------------------------------------------------

  /**
   * @summary Fetches the current now-playing track from the main process.
   * @returns The active TrackMetadata, or null if nothing is playing.
   */
  getNowPlaying: (): Promise<TrackMetadata | null> =>
    ipcRenderer.invoke(IPC.GET_NOW_PLAYING),

  /**
   * @summary Registers a listener for now-playing change push events.
   * @param callback - Called whenever the active track changes.
   * @returns A cleanup function to unregister the listener.
   */
  onNowPlayingChanged: (callback: (track: TrackMetadata | null) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, track: TrackMetadata | null): void => {
      callback(track);
    };
    ipcRenderer.on(IPC.NOW_PLAYING_CHANGED, handler);
    return () => ipcRenderer.off(IPC.NOW_PLAYING_CHANGED, handler);
  },

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  /**
   * @summary Returns connection status for Spotify and Last.fm (never tokens).
   */
  getAuthStatus: (): Promise<AuthStatus> =>
    ipcRenderer.invoke(IPC.GET_AUTH_STATUS),

  /** @summary Opens the Spotify OAuth flow in a dedicated BrowserWindow. */
  openSpotifyAuth: (): Promise<void> =>
    ipcRenderer.invoke(IPC.OPEN_SPOTIFY_AUTH),

  /** @summary Opens the Last.fm web auth flow in a dedicated BrowserWindow. */
  openLastfmAuth: (): Promise<void> =>
    ipcRenderer.invoke(IPC.OPEN_LASTFM_AUTH),

  /** @summary Revokes Spotify credentials from the OS keychain. */
  revokeSpotify: (): Promise<void> =>
    ipcRenderer.invoke(IPC.REVOKE_SPOTIFY),

  /** @summary Revokes the Last.fm session key from the OS keychain. */
  revokeLastfm: (): Promise<void> =>
    ipcRenderer.invoke(IPC.REVOKE_LASTFM),

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  /** @summary Fetches all persistent app settings. */
  getSettings: (): Promise<unknown> =>
    ipcRenderer.invoke(IPC.GET_SETTINGS),

  /**
   * @summary Persists a partial settings update.
   * @param partial - The settings keys+values to update.
   */
  setSettings: (partial: Record<string, unknown>): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_SETTINGS, partial),

  // -------------------------------------------------------------------------
  // Themes
  // -------------------------------------------------------------------------

  /** @summary Fetches all discovered theme manifests. */
  getThemes: (): Promise<ThemeManifest[]> =>
    ipcRenderer.invoke(IPC.GET_THEMES),

  /**
   * @summary Activates a theme by ID.
   * @param themeId - Reverse-DNS theme ID to activate.
   */
  setActiveTheme: (themeId: string): Promise<ThemeOpResult> =>
    ipcRenderer.invoke(IPC.SET_ACTIVE_THEME, themeId),

  /**
   * @summary Imports a theme from a local zip or folder path.
   * @param fsPath - Absolute filesystem path to the zip or directory.
   */
  importTheme: (fsPath: string): Promise<ThemeOpResult> =>
    ipcRenderer.invoke(IPC.IMPORT_THEME, fsPath),

  /**
   * @summary Deletes a theme by ID.
   * @param themeId - The theme to remove.
   */
  deleteTheme: (themeId: string): Promise<ThemeOpResult> =>
    ipcRenderer.invoke(IPC.DELETE_THEME, themeId),

  // -------------------------------------------------------------------------
  // Source priority
  // -------------------------------------------------------------------------

  /**
   * @summary Updates the source priority order.
   * @param priority - Array of source IDs, highest priority first.
   */
  setSourcePriority: (priority: string[]): Promise<void> =>
    ipcRenderer.invoke(IPC.SET_SOURCE_PRIORITY, priority),

  /**
   * @summary Registers a listener for source status change push events.
   * @param callback - Called with a map of sourceId → status when any source changes.
   * @returns A cleanup function to unregister the listener.
   */
  onSourceStatusChanged: (
    callback: (statuses: Record<string, string>) => void,
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      statuses: Record<string, string>,
    ): void => {
      callback(statuses);
    };
    ipcRenderer.on(IPC.SOURCE_STATUS_CHANGED, handler);
    return () => ipcRenderer.off(IPC.SOURCE_STATUS_CHANGED, handler);
  },
});
