/**
 * VM campaign domain.
 *
 * Campaigns are BA-owned acquisition records. They do not send live traffic
 * by themselves in Agent 2 scope; provider/queue work plugs into this later.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeOperational } from '../services/tieredWrite.js';
import { findLeadOwnerForOwner } from './vmLeadOwners.js';
import type {
  McsAdminVmLiveApprovalResponse,
  McsVmCampaignStatusAction,
  McsVMCampaignProviderMode,
  McsVMCampaignRecord,
  McsVmDialMode,
} from '@momentum/shared';
import { MCS_VM_DIAL_MODES } from '@momentum/shared';
import { vmAudit } from './vmProviderQueue.js';

const MONGO_DB = 'momentum';
const COLLECTION = 'tmag_vm_campaigns';
const CHROMA_COLLECTION = 'mcs_vm_campaigns';

export class VMCampaignError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VMCampaignError';
  }
}

export interface CreateVMCampaignInput {
  ownerTmagId: string;
  sponsorTmagId: string;
  leadOwnerId: string;
  name: string;
  provider: McsVMCampaignProviderMode;
  voicemailAudioId: string | null;
  audioUrl: string | null;
  smsTemplateId: string | null;
  emailTemplateId: string | null;
  scheduledAt: string | null;
  /** Default 'vm_only' — live transfer is opt-in per campaign. */
  dialMode?: McsVmDialMode;
}

export async function createVMCampaign(
  input: CreateVMCampaignInput,
): Promise<McsVMCampaignRecord> {
  await findLeadOwnerForOwner(input.leadOwnerId, input.ownerTmagId);

  const now = new Date().toISOString();
  const campaign: McsVMCampaignRecord & { dialMode: McsVmDialMode } = {
    vmCampaignId: `vm_${randomUUID()}`,
    dialMode: input.dialMode ?? 'vm_only',
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    leadOwnerId: input.leadOwnerId,
    name: input.name,
    provider: input.provider,
    status: input.scheduledAt ? 'scheduled' : 'draft',
    voicemailAudioId: input.voicemailAudioId,
    audioUrl: input.audioUrl,
    smsTemplateId: input.smsTemplateId,
    emailTemplateId: input.emailTemplateId,
    scheduledAt: input.scheduledAt,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await writeOperational({
    id: campaign.vmCampaignId,
    mongoCollection: COLLECTION,
    mongoDoc: { ...campaign },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'MERGE (lb:TmagVmLeadOwner {leadOwnerId: $leadOwnerId}) ' +
        'CREATE (vm:TmagVmCampaign {vmCampaignId: $id, name: $name, provider: $provider, ' +
        '  status: $status, ownerTmagId: $ownerTmagId, sponsorTmagId: $sponsorTmagId, ' +
        '  createdAt: $createdAt, updatedAt: $updatedAt}) ' +
        'CREATE (b)-[:OWNS_VM_CAMPAIGN]->(vm) ' +
        'CREATE (vm)-[:USES_VM_LEAD_OWNER]->(lb)',
      params: {
        ownerTmagId: campaign.ownerTmagId,
        sponsorTmagId: campaign.sponsorTmagId,
        leadOwnerId: campaign.leadOwnerId,
        name: campaign.name,
        provider: campaign.provider,
        status: campaign.status,
        createdAt: now,
        updatedAt: now,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `VM campaign ${campaign.name}; owner ${campaign.ownerTmagId}; ` +
        `lead owner ${campaign.leadOwnerId}; provider ${campaign.provider}; status ${campaign.status}.`,
      metadata: {
        kind: 'vm_campaign_created',
        vmCampaignId: campaign.vmCampaignId,
        leadOwnerId: campaign.leadOwnerId,
        ownerTmagId: campaign.ownerTmagId,
        provider: campaign.provider,
        createdAt: now,
      },
    },
  });

  return campaign;
}

export async function findVMCampaignForOwner(
  vmCampaignId: string,
  ownerTmagId: string,
): Promise<McsVMCampaignRecord> {
  const result = await persistenceCall<{ documents: McsVMCampaignRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { vmCampaignId, ownerTmagId },
    limit: 1,
  });
  const campaign = result.documents?.[0];
  if (!campaign) throw new VMCampaignError('vm_campaign_not_found');
  return campaign;
}

export async function findVMCampaignById(vmCampaignId: string): Promise<McsVMCampaignRecord> {
  const result = await persistenceCall<{ documents: McsVMCampaignRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { vmCampaignId },
    limit: 1,
  });
  const campaign = result.documents?.[0];
  if (!campaign) throw new VMCampaignError('vm_campaign_not_found');
  return campaign;
}

export async function listVMCampaignsForOwner(
  ownerTmagId: string,
): Promise<McsVMCampaignRecord[]> {
  const result = await persistenceCall<{ documents: McsVMCampaignRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { ownerTmagId },
    sort: { createdAt: -1 },
    limit: 500,
  });
  return result.documents ?? [];
}

type CampaignPatch = Partial<McsVMCampaignRecord> & Record<string, unknown>;

async function persistCampaignPatch(
  campaign: McsVMCampaignRecord,
  patch: CampaignPatch,
  action: string,
): Promise<McsVMCampaignRecord> {
  const updatedAt = new Date().toISOString();
  const next = { ...campaign, ...patch, updatedAt };

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { vmCampaignId: campaign.vmCampaignId },
    update: { $set: { ...patch, updatedAt } },
  });

  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (vm:TmagVmCampaign {vmCampaignId: $vmCampaignId}) ' +
      'SET vm += $props, vm.updatedAt = datetime($updatedAt)',
    params: {
      vmCampaignId: campaign.vmCampaignId,
      props: { ...patch, updatedAt },
      updatedAt,
    },
  });

  await persistenceCall('chromadb', 'add', {
    collection: CHROMA_COLLECTION,
    ids: [campaign.vmCampaignId],
    documents: [
      `VM campaign ${next.name}; owner ${next.ownerTmagId}; provider ${next.provider}; status ${next.status}; ${action}.`,
    ],
    metadatas: [
      {
        kind: 'vm_campaign_updated',
        vmCampaignId: campaign.vmCampaignId,
        ownerTmagId: campaign.ownerTmagId,
        status: next.status,
        action,
        updatedAt,
      },
    ],
  });

  return next;
}

function nextStatusForAction(
  current: McsVMCampaignRecord,
  action: McsVmCampaignStatusAction,
  scheduledAt?: string | null,
): CampaignPatch {
  const now = new Date().toISOString();
  switch (action) {
    case 'ready':
      if (current.status !== 'draft') throw new VMCampaignError('illegal_transition');
      return { status: 'ready', scheduledAt: null };
    case 'schedule':
      if (current.status !== 'ready') throw new VMCampaignError('illegal_transition');
      if (!scheduledAt) throw new VMCampaignError('scheduled_at_required');
      return { status: 'scheduled', scheduledAt, completedAt: null };
    case 'start':
      if (!['ready', 'scheduled', 'paused'].includes(current.status)) {
        throw new VMCampaignError('illegal_transition');
      }
      return {
        status: 'running',
        startedAt: current.startedAt ?? now,
        completedAt: null,
      };
    case 'pause':
      if (current.status !== 'running') throw new VMCampaignError('illegal_transition');
      return { status: 'paused' };
    case 'resume':
      if (current.status !== 'paused') throw new VMCampaignError('illegal_transition');
      return { status: 'running', startedAt: current.startedAt ?? now, completedAt: null };
    case 'cancel':
      if (!['scheduled', 'running', 'paused'].includes(current.status)) {
        throw new VMCampaignError('illegal_transition');
      }
      return { status: 'cancelled', completedAt: now };
  }
}

export async function patchVMCampaignStatusForOwner(input: {
  vmCampaignId: string;
  ownerTmagId: string;
  action: McsVmCampaignStatusAction;
  scheduledAt?: string | null;
}): Promise<McsVMCampaignRecord> {
  const current = await findVMCampaignForOwner(input.vmCampaignId, input.ownerTmagId);
  const beforeStatus = current.status;
  const patch = nextStatusForAction(current, input.action, input.scheduledAt);
  const updated = await persistCampaignPatch(current, patch, `status:${input.action}`);
  await vmAudit({
    action: 'vm.campaign.status_changed',
    entityId: current.vmCampaignId,
    ownerTmagId: current.ownerTmagId,
    summary: `VM campaign ${current.vmCampaignId} changed from ${beforeStatus} to ${updated.status}.`,
    payload: {
      beforeStatus,
      afterStatus: updated.status,
      statusAction: input.action,
      scheduledAt: updated.scheduledAt,
    },
  });
  return updated;
}

export async function startScheduledCampaignForWorker(
  campaign: McsVMCampaignRecord,
): Promise<McsVMCampaignRecord> {
  const updated = await persistCampaignPatch(
    campaign,
    { status: 'running', startedAt: campaign.startedAt ?? new Date().toISOString(), completedAt: null },
    'worker:start_scheduled',
  );
  await vmAudit({
    action: 'vm.campaign.worker_started',
    entityId: campaign.vmCampaignId,
    ownerTmagId: campaign.ownerTmagId,
    summary: `Scheduled VM campaign ${campaign.vmCampaignId} started by delivery worker.`,
    payload: { beforeStatus: campaign.status, afterStatus: updated.status },
  });
  return updated;
}

export async function completeRunningCampaignIfIdle(vmCampaignId: string): Promise<void> {
  const campaign = await findVMCampaignById(vmCampaignId);
  if (campaign.status !== 'running') return;
  const result = await persistenceCall<{ results: Array<{ count: number }> }>('mongodb', 'aggregate', {
    database: MONGO_DB,
    collection: 'tmag_vm_queue_jobs',
    pipeline: [
      {
        $match: {
          kind: 'delivery',
          status: { $in: ['queued', 'processing'] },
          'payload.vmCampaignId': vmCampaignId,
        },
      },
      { $count: 'count' },
    ],
  });
  const remaining = result.results?.[0]?.count ?? 0;
  if (remaining > 0) return;
  const completedAt = new Date().toISOString();
  const updated = await persistCampaignPatch(
    campaign,
    { status: 'completed', completedAt },
    'worker:complete_idle',
  );
  await vmAudit({
    action: 'vm.campaign.completed',
    entityId: campaign.vmCampaignId,
    ownerTmagId: campaign.ownerTmagId,
    summary: `VM campaign ${campaign.vmCampaignId} completed after all delivery jobs finished.`,
    payload: { beforeStatus: campaign.status, afterStatus: updated.status, completedAt },
  });
}

/**
 * Owner-scoped dialMode patch — lets Kevin flip an EXISTING campaign (the
 * four imported LeadPower cohorts) between vm_only / live_transfer / both
 * without recreating it. Audited.
 */
export async function setVMCampaignDialModeForOwner(input: {
  vmCampaignId: string;
  ownerTmagId: string;
  dialMode: McsVmDialMode;
}): Promise<McsVMCampaignRecord> {
  if (!MCS_VM_DIAL_MODES.includes(input.dialMode)) {
    throw new VMCampaignError('invalid_dial_mode');
  }
  const current = await findVMCampaignForOwner(input.vmCampaignId, input.ownerTmagId);
  const before = (current as { dialMode?: McsVmDialMode }).dialMode ?? 'vm_only';
  const updated = await persistCampaignPatch(
    current,
    { dialMode: input.dialMode },
    `dial_mode:${input.dialMode}`,
  );
  await vmAudit({
    action: 'vm.campaign.dial_mode_changed',
    entityId: current.vmCampaignId,
    ownerTmagId: current.ownerTmagId,
    summary: `VM campaign ${current.vmCampaignId} dialMode changed from ${before} to ${input.dialMode}.`,
    payload: { beforeDialMode: before, afterDialMode: input.dialMode },
  });
  return updated;
}

export async function setVMCampaignLiveApproval(input: {
  vmCampaignId: string;
  approved: boolean;
  adminTmagId: string;
}): Promise<McsAdminVmLiveApprovalResponse> {
  const campaign = await findVMCampaignById(input.vmCampaignId);
  const liveApprovalAt = new Date().toISOString();
  const updated = await persistCampaignPatch(
    campaign,
    {
      adminApprovedForLiveDelivery: input.approved,
      liveApprovalBy: input.adminTmagId,
      liveApprovalAt,
    },
    input.approved ? 'admin:live_approved' : 'admin:live_revoked',
  );
  return {
    ok: true,
    vmCampaignId: updated.vmCampaignId,
    adminApprovedForLiveDelivery: updated.adminApprovedForLiveDelivery === true,
  };
}
