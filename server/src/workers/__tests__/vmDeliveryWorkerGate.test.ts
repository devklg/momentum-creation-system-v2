import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsVMCampaignRecord } from '@momentum/shared';
import type { VmQueueJob } from '../../domain/vmProviderQueue.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  tripleStackWrite: vi.fn(),
  writeOperational: vi.fn(),
  sendDrop: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
}));

vi.mock('../../services/tripleStack.js', () => ({
  tripleStackWrite: mocks.tripleStackWrite,
}));

vi.mock('../../services/tieredWrite.js', () => ({
  writeOperational: mocks.writeOperational,
}));

vi.mock('../../services/vmProviders/index.js', () => ({
  getVmProvider: () => ({
    key: 'telnyx_call_control',
    sendDrop: mocks.sendDrop,
  }),
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
  createdAt: '2026-07-09T00:00:00.000Z',
  updatedAt: '2026-07-09T00:00:00.000Z',
};

function campaign(status: McsVMCampaignRecord['status'], scheduledAt: string | null = null) {
  return {
    vmCampaignId: 'vm_1',
    ownerTmagId: 'TMBA-1',
    sponsorTmagId: 'TMBA-1',
    leadOwnerId: 'lo_1',
    name: 'VM Test',
    provider: 'telnyx_call_control',
    status,
    voicemailAudioId: null,
    audioUrl: 'https://example.com/audio.mp3',
    smsTemplateId: null,
    emailTemplateId: null,
    scheduledAt,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
  };
}

function job(): VmQueueJob<{ leadId: string; vmCampaignId: string }> {
  return {
    jobId: 'job_1',
    kind: 'delivery',
    status: 'processing',
    attempts: 1,
    maxAttempts: 3,
    availableAt: '2026-07-09T00:00:00.000Z',
    lockedAt: '2026-07-09T00:00:00.000Z',
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload: { leadId: 'lead_1', vmCampaignId: 'vm_1' },
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
  };
}

function arrange(currentCampaign: ReturnType<typeof campaign>) {
  mocks.persistenceCall.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
    if (tool === 'mongodb' && action === 'query') {
      if (params.collection === 'tmag_vm_bulk_leads') return { documents: [lead], count: 1 };
      if (params.collection === 'tmag_vm_campaigns') return { documents: [currentCampaign], count: 1 };
    }
    if (tool === 'mongodb' && action === 'aggregate') return { results: [], count: 0 };
    return { documents: [], results: [], count: 0 };
  });
}

function mongoUpdates() {
  return mocks.persistenceCall.mock.calls.filter(
    ([tool, action]) => tool === 'mongodb' && action === 'update',
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-09T12:00:00.000Z'));
  mocks.persistenceCall.mockReset();
  mocks.tripleStackWrite.mockReset();
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
});

describe('VM delivery worker campaign gate', () => {
  it.each(['draft', 'paused'] as const)('requeues %s campaigns without burning an attempt', async (status) => {
    arrange(campaign(status));
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).not.toHaveBeenCalled();
    expect(mongoUpdates()).toContainEqual([
      'mongodb',
      'update',
      expect.objectContaining({
        collection: 'tmag_vm_queue_jobs',
        update: expect.objectContaining({
          $set: expect.objectContaining({
            status: 'queued',
            availableAt: '2026-07-09T12:05:00.000Z',
          }),
          $inc: { attempts: -1 },
        }),
      }),
    ]);
  });

  it('requeues scheduled-future campaigns to scheduledAt', async () => {
    arrange(campaign('scheduled', '2026-07-09T13:00:00.000Z'));
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).not.toHaveBeenCalled();
    expect(mongoUpdates()).toContainEqual([
      'mongodb',
      'update',
      expect.objectContaining({
        collection: 'tmag_vm_queue_jobs',
        update: expect.objectContaining({
          $set: expect.objectContaining({
            status: 'queued',
            availableAt: '2026-07-09T13:00:00.000Z',
          }),
          $inc: { attempts: -1 },
        }),
      }),
    ]);
  });

  it('skips cancelled campaigns', async () => {
    arrange(campaign('cancelled'));
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).not.toHaveBeenCalled();
    expect(mongoUpdates()).toContainEqual([
      'mongodb',
      'update',
      expect.objectContaining({
        collection: 'tmag_vm_queue_jobs',
        update: expect.objectContaining({
          $set: expect.objectContaining({ status: 'skipped' }),
        }),
      }),
    ]);
  });

  it('dispatches running campaigns with the existing dry-run gate intact', async () => {
    arrange(campaign('running'));
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        adminApprovedForLiveDelivery: false,
      }),
    );
    expect(mongoUpdates()).toContainEqual([
      'mongodb',
      'update',
      expect.objectContaining({
        collection: 'tmag_vm_queue_jobs',
        update: expect.objectContaining({
          $set: expect.objectContaining({ status: 'complete' }),
        }),
      }),
    ]);
  });
});
