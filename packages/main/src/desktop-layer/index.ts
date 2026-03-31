import type { BrowserWindow } from 'electron';

/**
 * @summary Dispatches to the platform-specific desktop-layer implementation.
 *
 * @remarks
 * Each platform uses a different technique to render the widget below all
 * application windows but above the desktop wallpaper:
 * - Windows: WorkerW HWND parenting trick (same technique as Wallpaper Engine)
 * - macOS: NSWindow level set to kCGDesktopWindowLevel - 1
 * - Linux: `_NET_WM_WINDOW_TYPE_DESKTOP` hint (X11) or wlr-layer-shell (Wayland)
 *
 * @param win - The widget BrowserWindow to position at the desktop layer.
 */
export async function setupDesktopLayer(win: BrowserWindow): Promise<void> {
  switch (process.platform) {
    case 'win32': {
      const { setupWindowsDesktopLayer } = await import('./windows.js');
      await setupWindowsDesktopLayer(win);
      break;
    }
    case 'darwin': {
      const { setupMacOSDesktopLayer } = await import('./macos.js');
      await setupMacOSDesktopLayer(win);
      break;
    }
    case 'linux': {
      const { setupLinuxDesktopLayer } = await import('./linux.js');
      await setupLinuxDesktopLayer(win);
      break;
    }
    default:
      console.warn(`[desktop-layer] Unsupported platform: ${process.platform}`);
  }
}
