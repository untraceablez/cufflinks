import type { BrowserWindow } from 'electron';

/**
 * @summary Positions the widget window at the desktop level on macOS using
 * NSWindow level manipulation.
 *
 * @remarks
 * Target window level: `kCGDesktopWindowLevel - 1` (below desktop icons).
 * Also sets `NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorStationary`
 * so the widget appears on all Spaces and does not animate during Mission Control.
 *
 * Implementation requires either:
 * - A small Swift helper invoked over a Unix domain socket, or
 * - The `@electron/native-helper` pattern for calling Objective-C APIs from Node.
 *
 * @param win - The widget BrowserWindow to reposition.
 */
export async function setupMacOSDesktopLayer(win: BrowserWindow): Promise<void> {
  // TODO(impl): Call Swift helper to set NSWindow level to kCGDesktopWindowLevel - 1
  // and apply NSWindowCollectionBehaviorCanJoinAllSpaces | NSWindowCollectionBehaviorStationary
  console.warn('[desktop-layer/macos] Swift helper not yet implemented; window may appear above desktop icons');
  win.setAlwaysOnTop(false);
}
