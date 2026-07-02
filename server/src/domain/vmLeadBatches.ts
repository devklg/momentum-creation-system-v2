/**
 * VM lead batch domain.
 *
 * A batch is an acquisition container owned by exactly one BA. It creates no
 * public momentum and never places anyone in the holding tank.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type { McsLeadBatchRecord, McsVmLeadBatchSource, McsVmLeadType } from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'tmag_vm_lead_batches';
const CHROMA_COLLECTION = 'mcs_vm_lead_batches';

export class LeadBatchError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'LeadBatchError';
  }
}

export interface CreateLeadBatchInput {
  ownerTmagId: string;
  sponsorTmagId: string;
  name: string;
  source: string;
  country: string;
  leadType: string;
  quantityImported: number;
}

export async function createLeadBatch(input: CreateLeadBatchInput): Promise<McsLeadBatchRecord> {
  const now = new Date().toISOString();
  const batch: McsLeadBatchRecord = {
    leadBatchId: `batch_${randomUUID()}`,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    name: input.name,
    source: input.source as McsVmLeadBatchSource,
    sourceLabel: input.source,
    country: input.country,
    leadType: input.leadType as McsVmLeadType,
    quantityExpected: input.quantityImported,
    quantityImported: input.quantityImported,
    quantitySuppressed: 0,
    quantityInvalid: 0,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  await tripleStackWrite({
    id: batch.leadBatchId,
    mongoCollection: COLLECTION,
    mongoDoc: { ...batch },
    neo4j: {
      cypher:
        'MERGE (b:BA {tmagId: $ownerTmagId}) ' +
        'CREATE (lb:LeadBatch {leadBatchId: $id, name: $name, source: $source, ' +
        '  country: $country, leadType: $leadType, ownerTmagId: $ownerTmagId, ' +
        '  sponsorTmagId: $sponsorTmagId, status: $status, createdAt: $createdAt}) ' +
        'CREATE (b)-[:OWNS_LEAD_BATCH]->(lb)',
      params: {
        ownerTmagId: batch.ownerTmagId,
        sponsorTmagId: batch.sponsorTmagId,
        name: batch.name,
        source: batch.source,
        country: batch.country,
        leadType: batch.leadType,
        status: batch.status,
        createdAt: now,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `Lead batch ${batch.name} from ${batch.source}; owner ${batch.ownerTmagId}; ` +
        `${batch.quantityImported} ${batch.leadType} leads in ${batch.country}.`,
      metadata: {
        kind: 'lead_batch_created',
        leadBatchId: batch.leadBatchId,
        ownerTmagId: batch.ownerTmagId,
        source: batch.source,
        country: batch.country,
        createdAt: now,
      },
    },
  });

  return batch;
}

export async function findLeadBatchForOwner(
  leadBatchId: string,
  ownerTmagId: string,
): Promise<McsLeadBatchRecord> {
  const result = await gatewayCall<{ documents: McsLeadBatchRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { leadBatchId, ownerTmagId },
    limit: 1,
  });
  const batch = result.documents?.[0];
  if (!batch) throw new LeadBatchError('lead_batch_not_found');
  return batch;
}

export async function listLeadBatchesForOwner(ownerTmagId: string): Promise<McsLeadBatchRecord[]> {
  const result = await gatewayCall<{ documents: McsLeadBatchRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { ownerTmagId },
    sort: { createdAt: -1 },
    limit: 500,
  });
  return result.documents ?? [];
}

export async function markLeadBatchImported(
  leadBatchId: string,
  ownerTmagId: string,
  importedCount: number,
): Promise<McsLeadBatchRecord> {
  const batch = await findLeadBatchForOwner(leadBatchId, ownerTmagId);
  const now = new Date().toISOString();
  const quantityImported = batch.quantityImported + importedCount;
  const patch = {
    quantityImported,
    status: 'imported' as const,
    updatedAt: now,
    completedAt: now,
  };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { leadBatchId, ownerTmagId },
    update: { $set: patch },
  });
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (lb:LeadBatch {leadBatchId: $leadBatchId, ownerTmagId: $ownerTmagId}) ' +
      'SET lb.quantityImported = $quantityImported, lb.status = $status, ' +
      '    lb.updatedAt = $updatedAt, lb.completedAt = $completedAt',
    params: {
      leadBatchId,
      ownerTmagId,
      quantityImported,
      status: patch.status,
      updatedAt: now,
      completedAt: now,
    },
  });

  return { ...batch, ...patch };
}
