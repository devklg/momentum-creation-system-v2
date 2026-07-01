/**
 * Vitest setup for the apps/admin behavioral test runner (P3.16).
 *
 * Registers @testing-library/jest-dom matchers on Vitest's `expect` and
 * unmounts/cleans the DOM between tests so renders never leak across cases.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
