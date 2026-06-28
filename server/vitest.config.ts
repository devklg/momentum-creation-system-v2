import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '**/dist/**'],
    setupFiles: ['./src/services/persistence/__tests__/setupEnv.ts'],
    restoreMocks: true,
  },
});
