/**
 * VM campaign domain.
 *
 * Campaigns are BA-owned acquisition records. They do not send live traffic
 * by themselves in Agent 2 scope; provider/queue work plugs into this later.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { findLeadOwnerForOwner } from './vmLeadOwners.js';
import type {
  McsVMCampaignProviderMode,
  McsVMCampaignRecord,
} from '@momentum/shared';

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
}

export async function createVMCampaign(
  input: CreateVMCampaignInput,
): Promise<McsVMCampaignRecord> {
  await findLeadOwnerForOwner(input.leadOwnerId, input.ownerTmagId);

  const now = new Date().toISOString();
  const campaign: McsVMCampaignRecord = {
    vmCampaignId: `vm_${randomUUID()}`,
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

  await tripleStackWrite({
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
