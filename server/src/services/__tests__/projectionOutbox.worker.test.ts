import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  startProjectionOutboxWorker,
  stopProjectionOutboxWorker,
  type DrainSummary,
} from '../projectionOutbox.js';

const here = dirname(fileURLToPath(import.meta.url));

function emptySummary(): DrainSummary {
  return { scanned: 0, landed: 0, reEnqueued: 0, deadLettered: 0 };
}

describe('projection-outbox drain worker (Phase 10 audit H1 regression)', () => {
  afterEach(() => {
    stopProjectionOutboxWorker();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('drains once at boot and then on every interval tick', async () => {
    vi.useFakeTimers();
    const drain = vi.fn(async () => emptySummary());

    startProjectionOutboxWorker({ intervalMs: 1000, drainLimit: 7, drain });

    // Boot drain fires synchronously-ish; flush the microtask queue.
    await vi.advanceTimersByTimeAsync(0);
    expect(drain).toHaveBeenCalledTimes(1);
    expect(drain).toHaveBeenCalledWith({ limit: 7 });

    await vi.advanceTimersByTimeAsync(1000);
    expect(drain).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(3000);
    expect(drain).toHaveBeenCalledTimes(5);
  });

  it('is idempotent — a second start does not schedule a second loop', async () => {
    vi.useFakeTimers();
    const drain = vi.fn(async () => emptySummary());

    startProjectionOutboxWorker({ intervalMs: 1000, drain });
    startProjectionOutboxWorker({ intervalMs: 1000, drain });
    await vi.advanceTimersByTimeAsync(0);

    // Only one boot drain, not two.
    expect(drain).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    // One tick, not two overlapping loops.
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it('stop() halts the loop so no further drains occur', async () => {
    vi.useFakeTimers();
    const drain = vi.fn(async () => emptySummary());

    startProjectionOutboxWorker({ intervalMs: 1000, drain });
    await vi.advanceTimersByTimeAsync(0);
    expect(drain).toHaveBeenCalledTimes(1);

    stopProjectionOutboxWorker();
    await vi.advanceTimersByTimeAsync(5000);
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('keeps running when a drain tick throws (failure is swallowed)', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const drain = vi
      .fn<() => Promise<DrainSummary>>()
      .mockRejectedValueOnce(new Error('PERSISTENCE down'))
      .mockResolvedValue(emptySummary());

    startProjectionOutboxWorker({ intervalMs: 1000, drain });
    await vi.advanceTimersByTimeAsync(0);
    expect(drain).toHaveBeenCalledTimes(1);

    // A thrown tick must not kill the interval.
    await vi.advanceTimersByTimeAsync(1000);
    expect(drain).toHaveBeenCalledTimes(2);
  });

  it('is wired into server boot (the H1 bug was: defined but never called)', () => {
    const indexSrc = readFileSync(resolve(here, '../../index.ts'), 'utf8');
    expect(indexSrc).toMatch(/import\s*\{\s*startProjectionOutboxWorker\s*\}\s*from\s*['"]\.\/services\/projectionOutbox\.js['"]/);
    // A bare call at boot, alongside the other start*Worker() calls.
    expect(indexSrc).toMatch(/startProjectionOutboxWorker\s*\(/);
  });
});
