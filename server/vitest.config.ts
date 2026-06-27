import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./src/services/persistence/__tests__/setupEnv.ts'],
    restoreMocks: true,
  },
});
