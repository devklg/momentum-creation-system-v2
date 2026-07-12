import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ persistenceCall: vi.fn(), writeOperational: vi.fn() }));
vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall: mocks.persistenceCall }));
vi.mock('../../services/tieredWrite.js', () => ({ writeOperational: mocks.writeOperational, writeKnowledge: vi.fn() }));
vi.mock('../../services/telnyx.js', () => ({
  TelnyxConfigError: class TelnyxConfigError extends Error {},
  TelnyxError: class TelnyxError extends Error {},
  gatherSingleDigit: vi.fn(), hangupCall: vi.fn(), playbackStart: vi.fn(), sendSms: vi.fn(),
}));

import { claimVmJobs, failVmJob, type VmQueueJob } from '../vmProviderQueue.js';

const queued: VmQueueJob = {
  jobId: 'job_1', kind: 'delivery', status: 'queued', attempts: 0, maxAttempts: 3,
  availableAt: '2026-07-12T11:00:00.000Z', lockedAt: null, completedAt: null,
  failedAt: null, failureReason: null, payload: { leadId: 'lead_1' },
  createdAt: '2026-07-12T10:00:00.000Z', updatedAt: '2026-07-12T10:00:00.000Z',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-12T12:00:00.000Z'));
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset().mockResolvedValue({});
});

afterEach(() => vi.useRealTimers());

describe('VM delivery queue controls', () => {
  it('returns a job only when the conditional queued-to-processing claim wins', async () => {
    mocks.persistenceCall
      .mockResolvedValueOnce({ documents: [queued] })
      .mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });
    expect(await claimVmJobs(['delivery'], 1)).toEqual([]);
    expect(mocks.writeOperational).not.toHaveBeenCalled();

    mocks.persistenceCall
      .mockResolvedValueOnce({ documents: [queued] })
      .mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
    const claimed = await claimVmJobs(['delivery'], 1);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]).toMatchObject({ jobId: 'job_1', status: 'processing', attempts: 1 });
  });

  it('schedules bounded exponential retries and guards the worker lease', async () => {
    mocks.persistenceCall.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const processing = { ...queued, status: 'processing' as const, attempts: 2, lockedAt: '2026-07-12T11:59:59.000Z' };
    await failVmJob(processing, 'provider timeout');
    const update = mocks.persistenceCall.mock.calls.find((call) => call[1] === 'update')?.[2];
    expect(update.filter).toEqual({ jobId: 'job_1', status: 'processing', lockedAt: processing.lockedAt });
    expect(update.update.$set).toMatchObject({ status: 'queued', availableAt: '2026-07-12T12:01:00.000Z', failureReason: 'provider timeout', lockedAt: null });
  });

  it('dead-letters the exhausted attempt without scheduling automatic recovery', async () => {
    mocks.persistenceCall.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    const exhausted = { ...queued, status: 'processing' as const, attempts: 3, lockedAt: '2026-07-12T11:59:59.000Z' };
    await failVmJob(exhausted, 'provider still unavailable');
    const update = mocks.persistenceCall.mock.calls.find((call) => call[1] === 'update')?.[2];
    expect(update.update.$set).toMatchObject({ status: 'dead_lettered', availableAt: exhausted.availableAt, lockedAt: null });
    expect(mocks.writeOperational).toHaveBeenCalledWith(expect.objectContaining({
      mongoDoc: expect.objectContaining({ action: 'vm.queue.dead_lettered' }),
    }));
  });
});
