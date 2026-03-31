import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite config for the settings/onboarding renderer window.
 *
 * Served on port 5173 in dev mode. In production, built to `dist/` and loaded
 * via file:// by the main process.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@cufflinks/shared': resolve('../shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
