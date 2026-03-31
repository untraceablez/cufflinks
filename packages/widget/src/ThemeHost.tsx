import React, { useEffect, useRef, useState } from 'react';
import type { TrackMetadata } from '@cufflinks/shared';

/**
 * @summary Props for the ThemeHost component.
 */
interface ThemeHostProps {
  /** @summary Absolute `file://` URL to the active theme's `index.html`. */
  themeSrc?: string;
  width?: number;
  height?: number;
}

/**
 * @summary Hosts the active theme in a sandboxed `<webview>` and bridges track data.
 *
 * @remarks
 * The webview is configured with:
 * - `sandbox`: Disables Node.js, contextBridge, and all Electron APIs in the theme.
 * - `partition="persist:theme"`: Separate session with no access to main session cookies.
 * - `disablewebsecurity` is NOT set — web security remains on.
 * - `allowpopups` is NOT set — themes cannot open new windows.
 *
 * Track data is passed to the theme via `postMessage` after the webview signals
 * readiness. CSS variables (`--np-accent`, `--np-widget-width`, `--np-widget-height`)
 * are injected into the webview context automatically.
 */
export default function ThemeHost({
  themeSrc = '',
  width = 400,
  height = 120,
}: ThemeHostProps): React.JSX.Element {
  const webviewRef = useRef<Electron.WebviewTag>(null);
  const [isReady, setIsReady] = useState(false);
  const [track, setTrack] = useState<TrackMetadata | null>(null);

  // Subscribe to now-playing updates and theme reload requests from the main process
  useEffect(() => {
    // Fetch initial state immediately so the widget isn't blank on first paint
    void window.cufflinks.getNowPlaying().then(setTrack);

    const unsubTrack = window.cufflinks.onNowPlayingChanged(setTrack);
    const unsubReload = window.cufflinks.onReloadTheme(() => {
      // Force the webview to reload by temporarily clearing src then restoring it
      const webview = webviewRef.current;
      if (webview !== null) {
        const src = webview.src;
        webview.src = '';
        webview.src = src;
      }
    });

    return () => {
      unsubTrack();
      unsubReload();
    };
  }, []);

  // Once the webview is ready, inject CSS variables
  useEffect(() => {
    const webview = webviewRef.current;
    if (webview === null || !isReady) return;

    void webview.executeJavaScript(`
      document.documentElement.style.setProperty('--np-accent', '#1db954');
      document.documentElement.style.setProperty('--np-widget-width', '${width}px');
      document.documentElement.style.setProperty('--np-widget-height', '${height}px');
      window.__CUFFLINKS_READY = true;
    `);
  }, [isReady, width, height]);

  // Send track updates to the theme via postMessage
  useEffect(() => {
    const webview = webviewRef.current;
    if (webview === null || !isReady) return;

    void webview.executeJavaScript(`
      window.postMessage(${JSON.stringify({ type: 'track-update', payload: track })}, '*');
    `);
  }, [track, isReady]);

  // React's built-in webview types predate Electron's extended attribute set.
  // createElement bypasses the intrinsic element check while preserving runtime behavior.
  return React.createElement('webview', {
    ref: webviewRef,
    src: themeSrc,
    sandbox: 'allow-scripts allow-same-origin',
    partition: 'persist:theme',
    style: { width, height, display: 'block', border: 'none' },
    onDomReady: () => setIsReady(true),
  });
}
