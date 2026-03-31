import type { TrackMetadata } from '@cufflinks/shared';
import type React from 'react';

/**
 * @summary The `window.cufflinks` bridge exposed by the widget preload script.
 *
 * @remarks
 * Minimal surface area — the widget only needs now-playing data and reload events.
 * All other IPC is handled by the settings renderer.
 */
interface CufflinksWidgetBridge {
  getNowPlaying(): Promise<TrackMetadata | null>;
  onNowPlayingChanged(callback: (track: TrackMetadata | null) => void): () => void;
  onReloadTheme(callback: () => void): () => void;
}

/**
 * @summary Extended JSX attributes for Electron's `<webview>` element.
 *
 * @remarks
 * React's built-in `WebViewHTMLAttributes` does not include Electron-specific
 * attributes. This augmentation adds the subset used by Cufflinks so
 * ThemeHost.tsx typechecks cleanly.
 */
interface ElectronWebViewAttributes extends React.HTMLAttributes<HTMLElement> {
  src?: string;
  /** Restricts what the sandboxed webview is allowed to do. */
  sandbox?: string;
  /** Assigns a named session partition for the webview's storage. */
  partition?: string;
  /** Fires when the webview's DOM is ready. */
  onDomReady?: () => void;
  ref?: React.Ref<Electron.WebviewTag>;
}

declare global {
  interface Window {
    cufflinks: CufflinksWidgetBridge;
  }
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      webview: ElectronWebViewAttributes;
    }
  }
}
