/**
 * VM campaign domain.
 *
 * Campaigns are BA-owned acquisition records. They do not send live traffic
 * by themselves in Agent 2 scope; provider/queue work plugs into this later.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { findLeadBatchForOwner } from './vmLeadBatches.js';
import type {
  VMCampaignProviderMode,
  VMCampaignRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'vm_campaigns';
const CHROMA_COLLECTION = 'mcs_vm_campaigns';

export class VMCampaignError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'VMCampaignError';
  }
}

export interface CreateVMCampaignInput {
  ownerTmBaId: string;
  sponsorTmBaId: string;
  leadBatchId: string;
  name: string;
  provider: VMCampaignProviderMode;
  voicemailAudioId: string | null;
  smsTemplateId: string | null;
  emailTemplateId: string | null;
  scheduledAt: string | null;
}

export async function createVMCampaign(
  input: CreateVMCampaignInput,
): Promise<VMCampaignRecord> {
  await findLeadBatchForOwner(input.leadBatchId, input.ownerTmBaId);

  const now = new Date().toISOString();
  const campaign: VMCampaignRecord = {
    vmCampaignId: `vm_${randomUUID()}`,
    ownerTmBaId: input.ownerTmBaId,
    sponsorTmBaId: input.sponsorTmBaId,
    leadBatchId: input.leadBatchId,
    name: input.name,
    provider: input.provider,
    status: input.scheduledAt ? 'scheduled' : 'draft',
    voicemailAudioId: input.voicemailAudioId,
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
        'MERGE (b:BA {baId: $ownerTmBaId}) ' +
        'MERGE (lb:LeadBatch {leadBatchId: $leadBatchId}) ' +
        'CREATE (vm:VMCampaign {vmCampaignId: $id, name: $name, provider: $provider, ' +
        '  status: $status, ownerTmBaId: $ownerTmBaId, sponsorTmBaId: $sponsorTmBaId, ' +
        '  createdAt: $createdAt, updatedAt: $updatedAt}) ' +
        'CREATE (b)-[:OWNS_VM_CAMPAIGN]->(vm) ' +
        'CREATE (vm)-[:USES_LEAD_BATCH]->(lb)',
      params: {
        ownerTmBaId: campaign.ownerTmBaId,
        sponsorTmBaId: campaign.sponsorTmBaId,
        leadBatchId: campaign.leadBatchId,
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
        `VM campaign ${campaign.name}; owner ${campaign.ownerTmBaId}; ` +
        `batch ${campaign.leadBatchId}; provider ${campaign.provider}; status ${campaign.status}.`,
      metadata: {
        kind: 'vm_campaign_created',
        vmCampaignId: campaign.vmCampaignId,
        leadBatchId: campaign.leadBatchId,
        ownerTmBaId: campaign.ownerTmBaId,
        provider: campaign.provider,
        createdAt: now,
      },
    },
  });

  return campaign;
}

export async function findVMCampaignForOwner(
  vmCampaignId: string,
  ownerTmBaId: string,
): Promise<VMCampaignRecord> {
  const result = await gatewayCall<{ documents: VMCampaignRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { vmCampaignId, ownerTmBaId },
    limit: 1,
  });
  const campaign = result.documents?.[0];
  if (!campaign) throw new VMCampaignError('vm_campaign_not_found');
  return campaign;
}

export async function listVMCampaignsForOwner(
  ownerTmBaId: string,
): Promise<VMCampaignRecord[]> {
  const result = await gatewayCall<{ documents: VMCampaignRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { ownerTmBaId },
    sort: { createdAt: -1 },
    limit: 500,
  });
  return result.documents ?? [];
}
