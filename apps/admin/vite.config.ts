import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // Serve repo-wide assets/ as the public root so /logos/*.png resolves to the canonical files.
  publicDir: path.resolve(__dirname, '../../assets'),
  server: {
    port: 7703,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:7700',
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@momentum/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
