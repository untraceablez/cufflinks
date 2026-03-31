import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

/**
 * Vite config for the widget renderer window.
 *
 * Served on port 5174 in dev mode to avoid colliding with the settings renderer
 * on port 5173 (handled by electron-vite).
 *
 * In production, built to `../../out/renderer/widget/` so the main process can
 * load it via `out/renderer/widget/index.html` — consistent with electron-vite's
 * output layout for the main renderer (`out/renderer/index.html`).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      '@cufflinks/shared': resolve('../shared/src/index.ts'),
    },
  },
  build: {
    // Output alongside the electron-vite renderer so electron-builder captures
    // both with the single `out/**` files glob
    outDir: resolve(__dirname, '../../out/renderer/widget'),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'index.html'),
    },
  },
});
