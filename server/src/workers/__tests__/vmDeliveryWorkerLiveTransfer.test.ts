/**
 * Dial-time availability gate — FAIL CLOSED.
 *
 *   - live_transfer + owner unavailable → the lead is NOT dialed at all
 *     (requeued without burning an attempt; never dead air).
 *   - both + owner unavailable → the dial proceeds (voicemail still works).
 *   - live_transfer + owner available → the dial proceeds.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VmQueueJob } from '../../domain/vmProviderQueue.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeOperational: vi.fn(),
  sendDrop: vi.fn(),
  getTransferAvailability: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeOperational: mocks.writeOperational,
  writeKnowledge: vi.fn(),
}));

vi.mock('../../services/vmProviders/index.js', () => ({
  getVmProvider: () => ({
    key: 'telnyx_call_control',
    sendDrop: mocks.sendDrop,
  }),
}));

vi.mock('../../domain/vmLiveTransfer.js', () => ({
  getTransferAvailability: mocks.getTransferAvailability,
  setTransferAvailability: vi.fn(),
  VmLiveTransferError: class VmLiveTransferError extends Error {},
}));

const lead = {
  leadId: 'lead_1',
  importJobId: 'import_1',
  leadOwnerId: 'lo_1',
  vmCampaignId: 'vm_1',
  ownerTmagId: 'TMBA-1',
  sponsorTmagId: 'TMBA-1',
  sourceLabel: 'manual_csv',
  sourceLeadId: null,
  firstName: 'Pat',
  lastName: 'Lead',
  phone: '+13235550100',
  normalizedPhone: '+13235550100',
  email: null,
  normalizedEmail: null,
  city: 'Los Angeles',
  stateOrRegion: 'CA',
  country: 'US',
  consentStatus: 'unknown',
  dedupeKey: 'dedupe',
  status: 'crm_created',
  token: 'tok_1',
  crmRecordId: 'crm_1',
  validationIssues: [],
  activatedAt: null,
  createdAt: '2026-07-11T00:00:00.000Z',
  updatedAt: '2026-07-11T00:00:00.000Z',
};

function campaign(dialMode: string) {
  return {
    vmCampaignId: 'vm_1',
    ownerTmagId: 'TMBA-1',
    leadOwnerId: 'lo_1',
    name: 'VM Test',
    provider: 'telnyx_call_control',
    status: 'running',
    dialMode,
    audioUrl: 'https://example.com/audio.mp3',
    scheduledAt: null,
    startedAt: '2026-07-11T00:00:00.000Z',
    completedAt: null,
  };
}

function job(): VmQueueJob<{ leadId: string; vmCampaignId: string }> {
  return {
    jobId: 'job_1',
    kind: 'delivery',
    status: 'processing',
    attempts: 1,
    maxAttempts: 3,
    availableAt: '2026-07-11T00:00:00.000Z',
    lockedAt: '2026-07-11T00:00:00.000Z',
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload: { leadId: 'lead_1', vmCampaignId: 'vm_1' },
    createdAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:00.000Z',
  };
}

function arrange(currentCampaign: ReturnType<typeof campaign>) {
  mocks.persistenceCall.mockImplementation(
    async (tool: string, action: string, params: Record<string, unknown>) => {
      if (tool === 'mongodb' && action === 'query') {
        if (params.collection === 'tmag_vm_bulk_leads') return { documents: [lead], count: 1 };
        if (params.collection === 'tmag_vm_campaigns') return { documents: [currentCampaign], count: 1 };
      }
      if (tool === 'mongodb' && action === 'aggregate') return { results: [], count: 0 };
      return { documents: [], results: [], count: 0 };
    },
  );
}

function mongoUpdates() {
  return mocks.persistenceCall.mock.calls.filter(
    ([tool, action]) => tool === 'mongodb' && action === 'update',
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-11T12:00:00.000Z'));
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset();
  mocks.writeOperational.mockResolvedValue({
    tier: 'operational',
    id: 'vm_test',
    mongo: { ok: true, verified: true },
  });
  mocks.sendDrop.mockReset();
  mocks.sendDrop.mockResolvedValue({
    provider: 'telnyx_call_control',
    status: 'dry_run',
    providerMessageId: null,
    dryRun: true,
    details: {},
  });
  mocks.getTransferAvailability.mockReset();
});

describe('VM delivery worker live-transfer availability gate', () => {
  it('live_transfer + owner unavailable → does not dial at all, requeues without burning attempt', async () => {
    mocks.getTransferAvailability.mockResolvedValue({
      ownerTmagId: 'TMBA-1',
      available: false,
      transferToNumber: null,
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    arrange(campaign('live_transfer'));
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).not.toHaveBeenCalled();
    expect(mongoUpdates()).toContainEqual([
      'mongodb',
      'update',
      expect.objectContaining({
        collection: 'tmag_vm_queue_jobs',
        update: expect.objectContaining({
          $set: expect.objectContaining({ status: 'queued' }),
          $inc: { attempts: -1 },
        }),
      }),
    ]);
    const skippedEvent = mocks.writeOperational.mock.calls.find(
      (call) => call[0]?.mongoDoc?.status === 'skipped',
    );
    expect(skippedEvent?.[0]?.mongoDoc?.providerStatus).toBe('owner_unavailable_live_transfer');
  });

  it('both + owner unavailable → still dials (voicemail branch works)', async () => {
    mocks.getTransferAvailability.mockResolvedValue({
      ownerTmagId: 'TMBA-1',
      available: false,
      transferToNumber: null,
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    arrange(campaign('both'));
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).toHaveBeenCalled();
  });

  it('live_transfer + owner available → dials', async () => {
    mocks.getTransferAvailability.mockResolvedValue({
      ownerTmagId: 'TMBA-1',
      available: true,
      transferToNumber: '+13235559999',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    arrange(campaign('live_transfer'));
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).toHaveBeenCalled();
  });

  it('doNotDrop lead is never dialed in any dial mode (fail closed)', async () => {
    mocks.getTransferAvailability.mockResolvedValue({
      ownerTmagId: 'TMBA-1',
      available: true,
      transferToNumber: '+13235559999',
      updatedAt: '2026-07-11T00:00:00.000Z',
    });
    for (const dialMode of ['vm_only', 'live_transfer', 'both']) {
      mocks.persistenceCall.mockImplementation(
        async (tool: string, action: string, params: Record<string, unknown>) => {
          if (tool === 'mongodb' && action === 'query') {
            if (params.collection === 'tmag_vm_bulk_leads') {
              return { documents: [{ ...lead, doNotDrop: true }], count: 1 };
            }
            if (params.collection === 'tmag_vm_campaigns') {
              return { documents: [campaign(dialMode)], count: 1 };
            }
          }
          if (tool === 'mongodb' && action === 'aggregate') return { results: [], count: 0 };
          return { documents: [], results: [], count: 0 };
        },
      );
      const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');
      await dispatchVmDeliveryJobForTest(job());
    }
    expect(mocks.sendDrop).not.toHaveBeenCalled();
  });
});
