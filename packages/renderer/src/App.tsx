import React from 'react';

/**
 * @summary Root component for the Cufflinks settings/onboarding shell.
 *
 * @remarks
 * Routes between the main views: Settings, ThemeManager, and Auth flows.
 * Rendering is deferred until the IPC bridge confirms the main process is ready.
 */
export default function App(): React.JSX.Element {
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem' }}>
      <h1>Cufflinks</h1>
      <p>Settings UI — coming soon.</p>
    </div>
  );
}
