import { describe, expect, it } from 'vitest';
import { VmProviderThrottle } from '../throttle.js';

describe('VM provider throttle', () => {
  it('preserves the global fixed-gap ceiling across provider buckets', async () => {
    let now = Date.parse('2026-07-16T12:00:00.000Z');
    const waits: number[] = [];
    const throttle = new VmProviderThrottle(
      () => 60,
      () => now,
      async (ms) => {
        waits.push(ms);
        now += ms;
      },
    );

    await throttle.run('telnyx_call_control', async () => 'first');
    await throttle.run('acquisition_provider_placeholder', async () => 'second');

    expect(waits).toEqual([1000]);
    expect(throttle.snapshot()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: 'telnyx_call_control',
          inFlight: 0,
        }),
        expect.objectContaining({
          provider: 'acquisition_provider_placeholder',
          inFlight: 0,
        }),
      ]),
    );
  });

  it('bounds provider cooldown and does not block another provider bucket', () => {
    const now = Date.parse('2026-07-16T12:00:00.000Z');
    const throttle = new VmProviderThrottle(() => 60, () => now);

    const availableAt = throttle.applyCooldown(
      'telnyx_call_control',
      60 * 60_000,
    );

    expect(availableAt).toBe('2026-07-16T12:15:00.000Z');
    expect(throttle.getAvailability('telnyx_call_control')).toMatchObject({
      allowed: false,
      waitMs: 15 * 60_000,
      reason: 'provider_cooldown',
    });
    expect(
      throttle.getAvailability('acquisition_provider_placeholder'),
    ).toMatchObject({ allowed: true, waitMs: 0, reason: null });
  });

  it('releases concurrency after an operation throws', async () => {
    const throttle = new VmProviderThrottle(() => 60);

    await expect(
      throttle.run('telnyx_call_control', async () => {
        throw new Error('mock_failure');
      }),
    ).rejects.toThrow('mock_failure');

    expect(throttle.snapshot()).toContainEqual(
      expect.objectContaining({
        provider: 'telnyx_call_control',
        inFlight: 0,
      }),
    );
  });
});
