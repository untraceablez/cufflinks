import { contextBridge, ipcRenderer } from 'electron';
import type { TrackMetadata } from '@cufflinks/shared';
import { IPC } from '@cufflinks/shared';

/**
 * @summary The `window.cufflinks` API exposed to the widget renderer via contextBridge.
 *
 * @remarks
 * The widget renderer is intentionally minimal — it only needs to receive now-playing
 * updates and forward them into the sandboxed theme `<webview>`. It does not need
 * access to settings, auth, or theme management.
 *
 * The theme `<webview>` itself is fully sandboxed (no Node.js, no contextBridge).
 * Data reaches it only via `postMessage` from ThemeHost.tsx.
 */
contextBridge.exposeInMainWorld('cufflinks', {
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

  /**
   * @summary Registers a listener for theme reload requests (dev hot-reload).
   * @param callback - Called when the main process requests a theme reload.
   * @returns A cleanup function to unregister the listener.
   */
  onReloadTheme: (callback: () => void): (() => void) => {
    const handler = (): void => callback();
    ipcRenderer.on(IPC.RELOAD_THEME, handler);
    return () => ipcRenderer.off(IPC.RELOAD_THEME, handler);
  },
});
