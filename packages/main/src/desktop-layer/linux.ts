import type { BrowserWindow } from 'electron';
import { execSync } from 'child_process';

/**
 * @summary Positions the widget window at the desktop level on Linux.
 *
 * @remarks
 * Strategy selection is based on the active display server:
 * - X11: Set `_NET_WM_WINDOW_TYPE_DESKTOP` via `xprop` after the window is mapped.
 * - Wayland (wlroots): Use `wlr-layer-shell` protocol, `LAYER_BACKGROUND` layer.
 * - GNOME Shell Wayland: Not fully supported; the window type is not honored.
 *   A GNOME Shell extension companion is the recommended workaround.
 *
 * @param win - The widget BrowserWindow to reposition.
 */
export async function setupLinuxDesktopLayer(win: BrowserWindow): Promise<void> {
  const sessionType = process.env['XDG_SESSION_TYPE'] ?? '';
  const isWayland = Boolean(process.env['WAYLAND_DISPLAY']) || sessionType === 'wayland';

  if (isWayland) {
    // TODO(impl): Use electron-layer-shell or wlr-layer-shell native addon
    console.warn('[desktop-layer/linux] Wayland layer-shell not yet implemented');
    return;
  }

  // X11 path: set _NET_WM_WINDOW_TYPE_DESKTOP using xprop
  const winId = win.getNativeWindowHandle().readBigUInt64LE(0).toString(16);
  try {
    execSync(
      `xprop -id 0x${winId} -f _NET_WM_WINDOW_TYPE 32a -set _NET_WM_WINDOW_TYPE _NET_WM_WINDOW_TYPE_DESKTOP`,
      { stdio: 'ignore' },
    );
  } catch {
    console.warn('[desktop-layer/linux] Failed to set _NET_WM_WINDOW_TYPE_DESKTOP via xprop');
  }
}
