import type { Configuration } from 'electron-builder';

/**
 * electron-builder configuration.
 *
 * Build output structure (from electron-vite + widget Vite build):
 *   out/main/index.js          — Electron main process entry
 *   out/preload/settings.js    — contextBridge for settings window
 *   out/preload/widget.js      — contextBridge for widget window
 *   out/renderer/index.html    — settings UI (React)
 *   out/renderer/widget/       — widget UI (React + ThemeHost)
 *
 * Icons:
 *   resources/icon.png is used for all platforms.
 *   electron-builder converts to .ico on Windows runners and .icns on macOS runners.
 *   For production releases, provide pre-converted resources/icon.ico and
 *   resources/icon.icns for higher-fidelity results.
 *
 * Code signing:
 *   macOS: set CSC_LINK / CSC_KEY_PASSWORD / APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD
 *          / APPLE_TEAM_ID env vars (see .github/workflows/release.yml).
 *   Windows: set CSC_LINK / CSC_KEY_PASSWORD for an Authenticode certificate.
 *   Linux:   no signing required.
 */
const config: Configuration = {
  appId: 'com.cufflinks.app',
  productName: 'Cufflinks',

  // electron-vite compiles everything to out/; widget Vite build also targets out/
  files: ['out/**'],

  // Bundled themes are copied to the app's resources directory at install time
  extraResources: [
    { from: 'themes', to: 'themes' },
  ],

  directories: {
    output: 'dist',
    buildResources: 'resources',
  },

  // GitHub Releases — used by `pnpm release` and the CI workflow
  publish: [
    {
      provider: 'github',
      releaseType: 'release',
    },
  ],

  win: {
    // electron-builder converts resources/icon.png to .ico on Windows runners
    icon: 'resources/icon.png',
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    // Authenticode signing — set CSC_LINK / CSC_KEY_PASSWORD in CI secrets
    // certificateSubjectName is optional; leave unset unless you have a named cert
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Cufflinks',
  },

  mac: {
    // electron-builder converts resources/icon.png to .icns on macOS runners
    icon: 'resources/icon.png',
    category: 'public.app-category.music',
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
    ],
    // Notarization — set APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID in CI
    notarize: false, // Set to true once code signing certs are configured
  },

  linux: {
    icon: 'resources/icon.png',
    category: 'Audio',
    target: ['AppImage', 'deb'],
    maintainer: 'Cufflinks Contributors',
  },

  protocols: [
    {
      // OAuth callback URL: cufflinks://callback
      name: 'Cufflinks',
      schemes: ['cufflinks'],
      role: 'Viewer',
    },
  ],
};

export default config;
