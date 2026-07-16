import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VmQueueJob } from '../../domain/vmProviderQueue.js';
import { VmProviderRateLimitError } from '../../services/vmProviders/types.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  sendDrop: vi.fn(),
  writeOperational: vi.fn(),
}));

vi.mock('../../env.js', () => ({
  env: {
    VM_DELIVERY_RATE_PER_MINUTE: 60,
    VM_PROVIDER_MODE: 'telnyx_call_control',
    VM_LIVE_DELIVERY_ENABLED: true,
    PROSPECT_BASE_URL: 'https://example.test',
  },
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeOperational: mocks.writeOperational,
  writeKnowledge: vi.fn(),
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: vi.fn(),
}));

vi.mock('../../services/vmProviders/index.js', () => ({
  getVmProvider: () => ({
    key: 'telnyx_call_control',
    supportsLiveSend: true,
    sendDrop: mocks.sendDrop,
  }),
}));

function job(jobId: string): VmQueueJob<{ leadId: string }> {
  return {
    jobId,
    kind: 'delivery',
    status: 'processing',
    attempts: 1,
    maxAttempts: 3,
    availableAt: '2026-07-16T12:00:00.000Z',
    lockedAt: `lock_${jobId}`,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload: { leadId: 'lead_1' },
    createdAt: '2026-07-16T12:00:00.000Z',
    updatedAt: '2026-07-16T12:00:00.000Z',
  };
}

const lead = {
  leadId: 'lead_1',
  vmCampaignId: 'campaign_1',
  ownerTmagId: 'TMBA-1',
  sponsorTmagId: 'TMBA-1',
  leadOwnerId: 'owner_1',
  importJobId: 'import_1',
  sourceLabel: 'manual_csv',
  sourceLeadId: null,
  firstName: 'Pat',
  lastName: 'Lead',
  phone: '+13235550100',
  normalizedPhone: '+13235550100',
  email: null,
  normalizedEmail: null,
  city: null,
  stateOrRegion: null,
  country: 'US',
  consentStatus: 'unknown',
  dedupeKey: 'dedupe_1',
  status: 'crm_created',
  token: 'token_1',
  crmRecordId: 'crm_1',
  validationIssues: [],
  activatedAt: null,
  createdAt: '2026-07-16T12:00:00.000Z',
  updatedAt: '2026-07-16T12:00:00.000Z',
};

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-16T12:00:00.000Z'));
  mocks.persistenceCall.mockReset();
  mocks.sendDrop.mockReset();
  mocks.writeOperational.mockReset();
  mocks.writeOperational.mockResolvedValue({
    tier: 'operational',
    id: 'audit_1',
    mongo: { ok: true, verified: true },
  });
  mocks.persistenceCall.mockImplementation(
    async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && action === 'query') {
        if (params.collection === 'tmag_vm_bulk_leads') {
          return { documents: [lead], count: 1 };
        }
        if (params.collection === 'tmag_vm_campaigns') {
          return {
            documents: [
              {
                vmCampaignId: 'campaign_1',
                provider: 'telnyx_call_control',
                status: 'running',
                audioUrl: 'https://example.test/audio.mp3',
                adminApprovedForLiveDelivery: true,
              },
            ],
            count: 1,
          };
        }
      }
      if (tool === 'mongodb' && action === 'aggregate') {
        return { results: [], count: 0 };
      }
      return { documents: [], results: [], count: 0 };
    },
  );
  const worker = await import('../vmDeliveryWorker.js');
  worker.resetVmDeliveryThrottleForTest();
});

describe('VM delivery provider throttling', () => {
  it('applies bounded cooldown on a mocked 429 and requeues without burning attempts', async () => {
    mocks.sendDrop.mockRejectedValueOnce(
      new VmProviderRateLimitError('telnyx_call_control', 120_000),
    );
    const { dispatchVmDeliveryJobForTest } = await import(
      '../vmDeliveryWorker.js'
    );

    await dispatchVmDeliveryJobForTest(job('job_1'));
    await dispatchVmDeliveryJobForTest(job('job_2'));

    expect(mocks.sendDrop).toHaveBeenCalledTimes(1);
    const queueUpdates = mocks.persistenceCall.mock.calls.filter(
      ([tool, action, params]) =>
        tool === 'mongodb' &&
        action === 'update' &&
        (params as { collection?: string }).collection === 'tmag_vm_queue_jobs',
    );
    expect(queueUpdates).toHaveLength(2);
    for (const update of queueUpdates) {
      expect(update[2]).toEqual(
        expect.objectContaining({
          update: expect.objectContaining({
            $set: expect.objectContaining({
              status: 'queued',
              availableAt: '2026-07-16T12:02:00.000Z',
              failureReason: null,
            }),
            $inc: { attempts: -1 },
          }),
        }),
      );
    }
  });
});
