import Store from 'electron-store';
import type { SourceId } from '@cufflinks/shared';

/**
 * @summary Persistent, non-sensitive application settings stored via electron-store.
 *
 * @remarks
 * This store is backed by a plain JSON file in `userData`. It must NEVER contain
 * OAuth tokens, session keys, or any other credentials — those live exclusively in
 * the OS keychain via `CredentialStore`.
 */
export interface AppSettings {
  // --- Display ---

  /** @summary ID of the currently active theme. */
  activeThemeId: string;
  widgetPosition: { x: number; y: number };
  widgetSize: { width: number; height: number };
  /** @summary Index of the monitor the widget is pinned to. */
  display: number;
  /** @summary Widget opacity from 0.0 (invisible) to 1.0 (fully opaque). */
  opacity: number;
  /** @summary Accent color as a hex string, e.g. `"#1db954"`. */
  accentColor: string;

  // --- Sources ---

  /** @summary Ordered list of source IDs; first active source wins. */
  sourcePriority: SourceId[];
  spotify: {
    enabled: boolean;
    /** @summary Prefer the local Spotify WebSocket API over the Web API when true. */
    useLocalApi: boolean;
  };
  tidal: {
    enabled: boolean;
  };
  appleMusic: {
    enabled: boolean;
  };

  // --- Scrobbling ---

  lastfm: {
    enabled: boolean;
    /** @summary Display username only — the session key lives in CredentialStore. */
    username?: string;
    /** @summary Fraction of track duration that must play before scrobbling (0.5–1.0). */
    scrobbleThreshold: number;
    /** @summary Minimum seconds a track must play before scrobbling. */
    scrobbleMinSeconds: number;
  };

  // --- System ---

  launchOnLogin: boolean;
  /** @summary macOS only: whether the app appears in the Dock. */
  showInDock: boolean;
  checkForUpdates: boolean;
}

const defaults: AppSettings = {
  activeThemeId: 'com.cufflinks.minimal',
  widgetPosition: { x: 20, y: 20 },
  widgetSize: { width: 400, height: 120 },
  display: 0,
  opacity: 1.0,
  accentColor: '#1db954',
  sourcePriority: ['spotify', 'tidal', 'apple-music'],
  spotify: { enabled: true, useLocalApi: true },
  tidal: { enabled: true },
  appleMusic: { enabled: true },
  lastfm: {
    enabled: false,
    scrobbleThreshold: 0.5,
    scrobbleMinSeconds: 30,
  },
  launchOnLogin: false,
  showInDock: false,
  checkForUpdates: true,
};

/** @summary Singleton electron-store instance for all non-sensitive app settings. */
export const store = new Store<AppSettings>({
  name: 'settings',
  defaults,
});
