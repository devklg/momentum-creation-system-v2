/**
 * do_not_drop delivery gate — fail closed.
 *
 * Interviewed leads (a human already spoke to them) and explicitly flagged
 * doNotDrop leads can NEVER receive a VM delivery dispatch, regardless of
 * campaign state or live approval.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VmQueueJob } from '../../domain/vmProviderQueue.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeOperational: vi.fn(),
  sendDrop: vi.fn(),
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

function lead(overrides: Record<string, unknown> = {}) {
  return {
    leadId: 'lead_dnd_1',
    importJobId: 'import_1',
    leadOwnerId: 'lo_1',
    vmCampaignId: 'vm_1',
    ownerTmagId: 'TMBA-1',
    sponsorTmagId: 'TMBA-1',
    sourceLabel: 'manual_csv',
    sourceLeadId: null,
    firstName: 'Ida',
    lastName: 'Interviewed',
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
    ...overrides,
  };
}

const runningCampaign = {
  vmCampaignId: 'vm_1',
  provider: 'telnyx_call_control',
  adminApprovedForLiveDelivery: true,
  audioUrl: 'https://example.com/audio.mp3',
  status: 'running',
  scheduledAt: null,
  startedAt: '2026-07-09T00:00:00.000Z',
  completedAt: null,
};

function job(): VmQueueJob<{ leadId: string; vmCampaignId: string }> {
  return {
    jobId: 'job_dnd_1',
    kind: 'delivery',
    status: 'processing',
    attempts: 1,
    maxAttempts: 3,
    availableAt: '2026-07-09T00:00:00.000Z',
    lockedAt: '2026-07-09T00:00:00.000Z',
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload: { leadId: 'lead_dnd_1', vmCampaignId: 'vm_1' },
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
  };
}

function arrange(currentLead: Record<string, unknown>) {
  mocks.persistenceCall.mockImplementation(async (tool: string, action: string, params: Record<string, unknown>) => {
    if (tool === 'mongodb' && action === 'query') {
      if (params.collection === 'tmag_vm_bulk_leads') return { documents: [currentLead], count: 1 };
      if (params.collection === 'tmag_vm_campaigns') return { documents: [runningCampaign], count: 1 };
    }
    if (tool === 'mongodb' && action === 'aggregate') return { results: [], count: 0 };
    return { documents: [], results: [], count: 0 };
  });
}

function queueJobUpdates() {
  return mocks.persistenceCall.mock.calls
    .filter(
      ([tool, action, params]) =>
        tool === 'mongodb' &&
        action === 'update' &&
        (params as Record<string, unknown>).collection === 'tmag_vm_queue_jobs',
    )
    .map(([, , params]) => params as { update: { $set: Record<string, unknown> } });
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.writeOperational.mockReset();
  mocks.writeOperational.mockResolvedValue({
    tier: 'operational',
    id: 'x',
    mongo: { ok: true, verified: true },
  });
  mocks.sendDrop.mockReset();
});

describe('vm delivery worker do_not_drop gate', () => {
  it.each([
    ['explicit doNotDrop flag', lead({ doNotDrop: true })],
    ["leadType 'interviewed'", lead({ leadType: 'interviewed' })],
  ])('refuses dispatch for %s — provider is never called', async (_label, flaggedLead) => {
    arrange(flaggedLead);
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    // Fail closed: provider send never happens, even for a running,
    // live-approved campaign.
    expect(mocks.sendDrop).not.toHaveBeenCalled();

    // Job is terminally skipped, not requeued for a later retry.
    const skips = queueJobUpdates().filter((u) => u.update.$set.status === 'skipped');
    expect(skips).toHaveLength(1);

    // The refusal is visible: a skipped delivery event was recorded.
    const deliveryEventWrites = mocks.writeOperational.mock.calls.filter(
      ([input]) => (input as { mongoCollection?: string }).mongoCollection === 'tmag_vm_delivery_events',
    );
    expect(deliveryEventWrites).toHaveLength(1);
    expect((deliveryEventWrites[0]![0] as { mongoDoc: Record<string, unknown> }).mongoDoc).toMatchObject({
      status: 'skipped',
      providerStatus: 'do_not_drop',
      leadId: 'lead_dnd_1',
    });
  });

  it('still dispatches unflagged leads (regression)', async () => {
    arrange(lead());
    mocks.sendDrop.mockResolvedValue({
      provider: 'telnyx_call_control',
      status: 'voicemail_drop_queued',
      providerMessageId: 'msg_1',
      dryRun: false,
      details: {},
    });
    const { dispatchVmDeliveryJobForTest } = await import('../vmDeliveryWorker.js');

    await dispatchVmDeliveryJobForTest(job());

    expect(mocks.sendDrop).toHaveBeenCalledTimes(1);
  });
});
