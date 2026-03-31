import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * electron-vite configuration for the Cufflinks monorepo.
 *
 * Three build targets:
 * - main:    Electron main process (TypeScript, CommonJS output)
 * - preload: Preload scripts for both windows (contextBridge APIs)
 * - renderer: Settings/onboarding UI (React + Vite)
 *
 * The widget window uses its own Vite config (packages/widget/vite.config.ts)
 * and is served separately in dev mode on port 5174.
 */
export default defineConfig({
  main: {
    build: {
      lib: {
        entry: resolve('packages/main/src/index.ts'),
      },
      rollupOptions: {
        // Electron and Node built-ins must be external
        external: [
          'electron',
          'better-sqlite3',
          'keytar',
          /^node:.*/,
        ],
      },
    },
    resolve: {
      alias: {
        '@cufflinks/shared': resolve('packages/shared/src/index.ts'),
      },
    },
  },

  preload: {
    build: {
      rollupOptions: {
        input: {
          settings: resolve('packages/main/src/preload-settings.ts'),
          widget: resolve('packages/main/src/preload-widget.ts'),
        },
        external: ['electron'],
      },
    },
    resolve: {
      alias: {
        '@cufflinks/shared': resolve('packages/shared/src/index.ts'),
      },
    },
  },

  renderer: {
    root: 'packages/renderer',
    build: {
      rollupOptions: {
        input: resolve('packages/renderer/index.html'),
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@cufflinks/shared': resolve('packages/shared/src/index.ts'),
      },
    },
  },
});
