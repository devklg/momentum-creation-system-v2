/**
 * P10 H3 — production JWT_SECRET boot assertion tests.
 *
 * env.ts parses + asserts at import, so each case resets the module registry
 * and re-imports with a fresh stubbed environment. A placeholder or short
 * secret must FAIL BOOT in production; a strong secret must succeed; dev is
 * never affected.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadEnv(overrides: Record<string, string>) {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('NODE_ENV', overrides.NODE_ENV ?? 'test');
  vi.stubEnv('JWT_SECRET', overrides.JWT_SECRET ?? 'x'.repeat(48));
  for (const [k, v] of Object.entries(overrides)) {
    if (k !== 'NODE_ENV' && k !== 'JWT_SECRET') vi.stubEnv(k, v);
  }
  return import('../env.js');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('P10 H3 — production JWT_SECRET assertion', () => {
  it('throws in production for the known placeholder secret', async () => {
    await expect(
      loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'replace-me-with-a-long-random-string' }),
    ).rejects.toThrow(/JWT_SECRET/);
  });

  it('throws in production for a non-placeholder secret that is too short (<32)', async () => {
    await expect(
      loadEnv({ NODE_ENV: 'production', JWT_SECRET: 'abcdefghij0123456789' }), // 20 chars: passes Zod min(16), fails <32
    ).rejects.toThrow(/JWT_SECRET/);
  });

  it('succeeds in production with a strong secret', async () => {
    const mod = await loadEnv({
      NODE_ENV: 'production',
      JWT_SECRET: 'S3cure-random-secret-value-that-is-well-over-32-chars',
      TELNYX_PUBLIC_KEY: 'not-empty',
    });
    expect(mod.env.NODE_ENV).toBe('production');
  });

  it('does not throw in development even with the placeholder secret', async () => {
    const mod = await loadEnv({
      NODE_ENV: 'development',
      JWT_SECRET: 'replace-me-with-a-long-random-string',
    });
    expect(mod.env.NODE_ENV).toBe('development');
  });
});
