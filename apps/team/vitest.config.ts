import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

/**
 * apps/team behavioral test runner (Phase 3 / P3.14).
 *
 * The `.team` app had no test runner before this slice. This config stands up a
 * jsdom + React Testing Library environment so the Michael runtime support card
 * (and future cockpit surfaces) can be exercised behaviorally — rendering states
 * and asserting what a Brand Ambassador actually sees — without a browser.
 *
 * Aliases mirror vite.config.ts so component imports resolve identically under
 * test. The runner is jsdom (browser-like DOM) with globals OFF — test files
 * import { describe, it, expect, vi } explicitly, matching the server suite's
 * style. jest-dom matchers are registered in src/test/setup.ts.
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
