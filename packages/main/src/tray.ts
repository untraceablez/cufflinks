import { Tray, Menu, app, shell } from 'electron';
import path from 'path';
import { THEMES_DIR } from './theme-dir.js';

let _tray: Tray | null = null;

/**
 * @summary Creates the system tray icon and context menu.
 *
 * @remarks
 * The tray provides quick access to:
 * - Open the Settings window
 * - Open the Themes folder in the native file manager
 * - Quit the application
 *
 * The tray icon is resolved from `resources/icon.png` in the packaged app.
 * In development, falls back to a generic icon path.
 *
 * @param onOpenSettings - Callback invoked when the user clicks "Settings".
 * @returns The created Tray instance.
 */
export function createTray(onOpenSettings: () => void): Tray {
  const iconPath = path.join(process.resourcesPath, 'icon.png');
  _tray = new Tray(iconPath);
  _tray.setToolTip('Cufflinks');

  const menu = Menu.buildFromTemplate([
    { label: 'Settings', click: onOpenSettings },
    {
      label: 'Open Themes Folder',
      click: () => { void shell.openPath(THEMES_DIR); },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  _tray.setContextMenu(menu);
  return _tray;
}
