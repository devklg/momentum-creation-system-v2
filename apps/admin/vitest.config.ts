import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * apps/admin behavioral test runner (Phase 3 / P3.16).
 *
 * The Kevin-only `admin` app had no test runner before this slice. This config
 * stands up a jsdom + React Testing Library environment so the Michael runtime
 * observability panel (and future admin surfaces) can be exercised behaviorally
 * without a browser. Mirrors apps/team's P3.14 setup: jsdom env, globals OFF
 * (explicit imports), jest-dom matchers registered in src/test/setup.ts, aliases
 * mirrored from vite.config.ts.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@momentum/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
});
