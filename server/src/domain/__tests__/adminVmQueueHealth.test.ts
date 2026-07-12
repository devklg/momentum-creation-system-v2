import { describe, expect, it } from 'vitest';
import { buildVmQueueHealth, VM_QUEUE_STUCK_AFTER_MS } from '../adminVm.js';

const NOW = new Date('2026-07-12T12:00:00.000Z');

describe('admin VM provider queue health', () => {
  it('reports failure, dead-letter, retry-due, and stale processing findings without mutation', () => {
    const jobs = [
      { jobId: 'stuck', kind: 'delivery', status: 'processing', attempts: 1, maxAttempts: 3, lockedAt: '2026-07-12T11:30:00.000Z', payload: { vmCampaignId: 'vm_1', leadId: 'lead_1' } },
      { jobId: 'fresh', kind: 'delivery', status: 'processing', attempts: 1, maxAttempts: 3, lockedAt: '2026-07-12T11:55:00.000Z' },
      { jobId: 'retry', kind: 'delivery', status: 'queued', attempts: 2, maxAttempts: 3, availableAt: '2026-07-12T11:59:00.000Z', failedAt: '2026-07-12T11:50:00.000Z', failureReason: 'provider timeout' },
      { jobId: 'dead', kind: 'webhook_event', status: 'dead_lettered', attempts: 3, maxAttempts: 3, failedAt: '2026-07-12T11:00:00.000Z' },
      { jobId: 'failed', kind: 'delivery', status: 'failed', attempts: 1, maxAttempts: 3, failedAt: '2026-07-12T11:45:00.000Z' },
    ];
    const snapshot = structuredClone(jobs);

    const report = buildVmQueueHealth(jobs, NOW);

    expect(report.policy).toBe('report_only');
    expect(report.stuckAfterMs).toBe(VM_QUEUE_STUCK_AFTER_MS);
    expect(report.counts).toMatchObject({ total: 5, queued: 1, processing: 2, retryDue: 1, stuckProcessing: 1, failed: 1, deadLettered: 1 });
    expect(report.findings.map((row) => row.condition)).toEqual(['dead_lettered', 'failed', 'stuck_processing', 'retry_due']);
    expect(report.findings.find((row) => row.jobId === 'stuck')).toMatchObject({ vmCampaignId: 'vm_1', leadId: 'lead_1', ageMs: 1_800_000 });
    expect(jobs).toEqual(snapshot);
  });

  it('does not call an ordinary queued job a retry or treat elapsed time as a state change', () => {
    const report = buildVmQueueHealth([
      { jobId: 'new', kind: 'delivery', status: 'queued', attempts: 0, maxAttempts: 3, availableAt: '2026-07-12T11:00:00.000Z', createdAt: '2026-07-12T11:00:00.000Z' },
    ], NOW);

    expect(report.counts).toMatchObject({ queued: 1, retryDue: 0, stuckProcessing: 0 });
    expect(report.findings).toEqual([]);
  });
});

