import { app, BrowserWindow } from 'electron';
import path from 'path';
import { initThemeDirectory } from './theme-dir.js';
import { registerIpcHandlers } from './ipc/handlers.js';
import { setupDesktopLayer } from './desktop-layer/index.js';

/**
 * @summary Application entry point. Bootstraps all main-process subsystems.
 *
 * @remarks
 * Initialization order matters:
 * 1. `app.whenReady()` — Electron APIs available
 * 2. `initThemeDirectory()` — Ensure ~/Cufflinks/themes/ exists before any theme reads
 * 3. Create widget + settings windows
 * 4. `setupDesktopLayer()` — Must run after windows are shown
 * 5. `registerIpcHandlers()` — Must run before renderer loads
 *
 * electron-vite output structure (relative to this file at out/main/index.js):
 *   ../preload/settings.js   — settings window contextBridge
 *   ../preload/widget.js     — widget window contextBridge
 *   ../renderer/index.html   — settings UI
 *   ../renderer/widget/      — widget UI
 */

let widgetWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;

/**
 * @summary Resolves a path relative to `out/main/` at runtime.
 *
 * @remarks
 * `__dirname` in the packaged app points to the `out/main/` directory.
 * Use this helper whenever referencing sibling output directories (preload, renderer).
 *
 * @param segments - Path segments relative to `out/main/`.
 * @returns Absolute filesystem path.
 */
function outPath(...segments: string[]): string {
  return path.join(__dirname, ...segments);
}

/**
 * @summary Creates the transparent, frameless widget window.
 *
 * @remarks
 * This window is positioned at the desktop level by `setupDesktopLayer()`.
 * It renders the active theme via a sandboxed `<webview>` in the widget renderer.
 *
 * @returns The created BrowserWindow instance.
 */
function createWidgetWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 400,
    height: 120,
    transparent: true,
    frame: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      // Required for theme sandboxing via <webview> tag
      webviewTag: true,
      preload: outPath('../preload/widget.js'),
    },
  });

  if (!app.isPackaged) {
    void win.loadURL('http://localhost:5174');
  } else {
    void win.loadFile(outPath('../renderer/widget/index.html'));
  }

  return win;
}

/**
 * @summary Creates the settings/onboarding window.
 *
 * @remarks
 * Hidden by default; shown when the user opens settings from the system tray.
 * electron-vite HMR runs on port 5173 in development.
 *
 * @returns The created BrowserWindow instance.
 */
function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: outPath('../preload/settings.js'),
    },
  });

  if (!app.isPackaged) {
    void win.loadURL('http://localhost:5173');
  } else {
    void win.loadFile(outPath('../renderer/index.html'));
  }

  return win;
}

app.whenReady().then(async () => {
  await initThemeDirectory();

  widgetWindow = createWidgetWindow();
  settingsWindow = createSettingsWindow();

  widgetWindow.once('ready-to-show', () => {
    widgetWindow?.show();
    if (widgetWindow) {
      setupDesktopLayer(widgetWindow);
    }
  });

  registerIpcHandlers({ widgetWindow, settingsWindow });
}).catch((err: unknown) => {
  console.error('[main] Failed to initialize:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
