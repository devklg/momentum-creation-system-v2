import { describe, expect, it } from 'vitest';
import {
  parseVmProviderRetryAfterMs,
  VmProviderRateLimitError,
} from '../types.js';

describe('VM provider rate-limit metadata', () => {
  const now = Date.parse('2026-07-16T12:00:00.000Z');

  it('parses delta seconds and HTTP dates with a bounded maximum', () => {
    expect(parseVmProviderRetryAfterMs('30', now)).toBe(30_000);
    expect(
      parseVmProviderRetryAfterMs('Thu, 16 Jul 2026 12:02:00 GMT', now),
    ).toBe(120_000);
    expect(parseVmProviderRetryAfterMs('3600', now)).toBe(15 * 60_000);
  });

  it('rejects missing, malformed, zero, and past values', () => {
    expect(parseVmProviderRetryAfterMs(null, now)).toBeNull();
    expect(parseVmProviderRetryAfterMs('not-a-date', now)).toBeNull();
    expect(parseVmProviderRetryAfterMs('0', now)).toBeNull();
    expect(
      parseVmProviderRetryAfterMs('Thu, 16 Jul 2026 11:59:00 GMT', now),
    ).toBeNull();
  });

  it('keeps the provider exception content-free', () => {
    const error = new VmProviderRateLimitError(
      'telnyx_call_control',
      30_000,
    );
    expect(error.message).toBe('provider_rate_limited');
    expect(error).not.toHaveProperty('upstreamBody');
  });
});
