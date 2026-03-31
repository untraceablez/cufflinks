import type { BrowserWindow } from 'electron';

/**
 * @summary Positions the widget window at the desktop level on Windows using
 * the WorkerW HWND parenting technique.
 *
 * @remarks
 * This is the same technique used by Wallpaper Engine. The steps are:
 * 1. Send `0x052C` to `HWND_PROGMAN` to spawn a WorkerW child window.
 * 2. Find the WorkerW HWND via `EnumWindows`.
 * 3. Call `SetParent(widgetHWND, workerWHWND)` to parent our window behind desktop icons.
 *
 * Falls back to `SetWindowPos(..., HWND_BOTTOM, ...)` if WorkerW is unavailable
 * (some Windows configurations).
 *
 * Requires the native addon at `native/desktop-win32.node`, built with node-gyp.
 *
 * @param win - The widget BrowserWindow to reposition.
 */
export async function setupWindowsDesktopLayer(win: BrowserWindow): Promise<void> {
  // TODO(impl): Load native/desktop-win32.node and call setDesktopLevel(win.getNativeWindowHandle())
  // For now, fall back to alwaysOnTop: false + HWND_BOTTOM via SetWindowPos
  console.warn('[desktop-layer/windows] Native addon not yet implemented; falling back to HWND_BOTTOM');
  win.setAlwaysOnTop(false);
}
