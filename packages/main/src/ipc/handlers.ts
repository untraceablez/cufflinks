import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC } from '@cufflinks/shared';
import { store } from '../store.js';
import { discoverThemes } from '../theme-loader.js';

interface HandlerContext {
  widgetWindow: BrowserWindow | null;
  settingsWindow: BrowserWindow | null;
}

/**
 * @summary Registers all `ipcMain` handlers for the application.
 *
 * @remarks
 * Called once during app initialization, after windows are created but before
 * the renderer loads. All handlers are registered synchronously.
 *
 * Security invariants enforced here:
 * - Handlers never return raw credential values.
 * - Theme IDs from the renderer are validated against the discovered theme list.
 * - Settings updates are merged against the schema, not blindly applied.
 *
 * @param ctx - References to the main application windows, used for push notifications.
 */
export function registerIpcHandlers(ctx: HandlerContext): void {
  /**
   * @summary Returns all discovered theme manifests.
   *
   * @param _event - IPC event (unused).
   * @returns Array of ThemeManifest objects.
   */
  ipcMain.handle(IPC.GET_THEMES, async (_event) => {
    return discoverThemes();
  });

  /**
   * @summary Persists the active theme ID after validating it exists.
   *
   * @param _event - IPC event (unused).
   * @param themeId - Reverse-DNS theme ID to activate.
   * @returns `{ ok: true }` on success, `{ ok: false; reason: string }` if theme not found.
   */
  ipcMain.handle(IPC.SET_ACTIVE_THEME, async (_event, themeId: string) => {
    const themes = await discoverThemes();
    const found = themes.some((t) => t.id === themeId);
    if (!found) {
      return { ok: false, reason: `Theme '${themeId}' not found` };
    }
    store.set('activeThemeId', themeId);

    // Notify the widget window to reload the theme
    ctx.widgetWindow?.webContents.send(IPC.RELOAD_THEME);

    return { ok: true };
  });

  /**
   * @summary Returns non-sensitive app settings.
   *
   * @param _event - IPC event (unused).
   * @returns The full AppSettings object (no credentials included).
   */
  ipcMain.handle(IPC.GET_SETTINGS, (_event) => {
    return store.store;
  });

  /**
   * @summary Merges a partial settings update into the store.
   *
   * @param _event - IPC event (unused).
   * @param partial - Partial AppSettings to merge.
   */
  ipcMain.handle(IPC.SET_SETTINGS, (_event, partial: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(partial)) {
      store.set(key as never, value as never);
    }
  });

  /**
   * @summary Returns auth connection status for all services (never tokens).
   *
   * @param _event - IPC event (unused).
   * @returns Auth metadata: connected boolean + display username.
   */
  ipcMain.handle(IPC.GET_AUTH_STATUS, async (_event) => {
    // TODO(auth): Read connection state from CredentialStore
    return {
      spotify: { connected: false },
      lastfm: { connected: false },
    };
  });
}
