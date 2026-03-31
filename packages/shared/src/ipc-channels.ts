/**
 * @summary Strongly-typed IPC channel name constants shared between main and renderer.
 *
 * @remarks
 * All channel strings follow the `domain:action` kebab-case convention.
 * Import this object in both `ipcMain.handle` registrations and `ipcRenderer.invoke`
 * calls to guarantee consistency.
 */
export const IPC = {
  // -------------------------------------------------------------------------
  // Main → Renderer (push events via webContents.send)
  // -------------------------------------------------------------------------

  /** @summary Emitted whenever the active track or playback state changes. Payload: `TrackMetadata | null`. */
  NOW_PLAYING_CHANGED: 'now-playing:changed',

  /** @summary Emitted when a source's status changes (e.g. auth required, player closed). Payload: `Record<SourceId, SourceStatus>`. */
  SOURCE_STATUS_CHANGED: 'source:status-changed',

  /** @summary Emitted after a scrobble attempt completes (success or failure). Payload: `ScrobbleStatus`. */
  SCROBBLE_STATUS: 'scrobble:status',

  // -------------------------------------------------------------------------
  // Renderer → Main (invoke/handle round-trips)
  // -------------------------------------------------------------------------

  /** @summary Request the current now-playing track. Returns `TrackMetadata | null`. */
  GET_NOW_PLAYING: 'now-playing:get',

  /** @summary Update the source priority order. Payload: `SourceId[]`. */
  SET_SOURCE_PRIORITY: 'source:set-priority',

  /** @summary Request combined auth status for all services. Returns auth metadata (never tokens). */
  GET_AUTH_STATUS: 'auth:status',

  /** @summary Instruct main to open the Spotify OAuth BrowserWindow. */
  OPEN_SPOTIFY_AUTH: 'auth:spotify:open',

  /** @summary Instruct main to open the Last.fm web auth BrowserWindow. */
  OPEN_LASTFM_AUTH: 'auth:lastfm:open',

  /** @summary Revoke Spotify credentials from the OS keychain. */
  REVOKE_SPOTIFY: 'auth:spotify:revoke',

  /** @summary Revoke Last.fm session key from the OS keychain. */
  REVOKE_LASTFM: 'auth:lastfm:revoke',

  /** @summary Fetch all persistent app settings. Returns `AppSettings`. */
  GET_SETTINGS: 'settings:get',

  /** @summary Persist a partial settings update. Payload: `Partial<AppSettings>`. */
  SET_SETTINGS: 'settings:set',

  /** @summary Fetch the list of discovered themes. Returns `ThemeManifest[]`. */
  GET_THEMES: 'themes:get',

  /** @summary Switch the active theme. Payload: theme ID string. Returns `{ ok: boolean; reason?: string }`. */
  SET_ACTIVE_THEME: 'themes:set-active',

  /** @summary Import a theme from a filesystem path (zip or folder). Payload: absolute path string. */
  IMPORT_THEME: 'themes:import',

  /** @summary Delete a theme by ID. Payload: theme ID string. */
  DELETE_THEME: 'themes:delete',

  /** @summary Force-reload the active theme webview. Used during theme development. */
  RELOAD_THEME: 'themes:reload',
} as const;

/** @summary Union of all valid IPC channel name strings. */
export type IpcChannel = (typeof IPC)[keyof typeof IPC];
