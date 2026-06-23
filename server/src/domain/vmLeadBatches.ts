/**
 * VM lead batch domain.
 *
 * A batch is an acquisition container owned by exactly one BA. It creates no
 * public momentum and never places anyone in the holding tank.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type { LeadBatchRecord, VmLeadBatchSource, VmLeadType } from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'vm_lead_batches';
const CHROMA_COLLECTION = 'mcs_vm_lead_batches';

export class LeadBatchError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'LeadBatchError';
  }
}

export interface CreateLeadBatchInput {
  ownerTmBaId: string;
  sponsorTmBaId: string;
  name: string;
  source: string;
  country: string;
  leadType: string;
  quantityImported: number;
}

export async function createLeadBatch(input: CreateLeadBatchInput): Promise<LeadBatchRecord> {
  const now = new Date().toISOString();
  const batch: LeadBatchRecord = {
    leadBatchId: `batch_${randomUUID()}`,
    ownerTmBaId: input.ownerTmBaId,
    sponsorTmBaId: input.sponsorTmBaId,
    name: input.name,
    source: input.source as VmLeadBatchSource,
    sourceLabel: input.source,
    country: input.country,
    leadType: input.leadType as VmLeadType,
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
        'MERGE (b:BA {baId: $ownerTmBaId}) ' +
        'CREATE (lb:LeadBatch {leadBatchId: $id, name: $name, source: $source, ' +
        '  country: $country, leadType: $leadType, ownerTmBaId: $ownerTmBaId, ' +
        '  sponsorTmBaId: $sponsorTmBaId, status: $status, createdAt: $createdAt}) ' +
        'CREATE (b)-[:OWNS_LEAD_BATCH]->(lb)',
      params: {
        ownerTmBaId: batch.ownerTmBaId,
        sponsorTmBaId: batch.sponsorTmBaId,
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
        `Lead batch ${batch.name} from ${batch.source}; owner ${batch.ownerTmBaId}; ` +
        `${batch.quantityImported} ${batch.leadType} leads in ${batch.country}.`,
      metadata: {
        kind: 'lead_batch_created',
        leadBatchId: batch.leadBatchId,
        ownerTmBaId: batch.ownerTmBaId,
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
  ownerTmBaId: string,
): Promise<LeadBatchRecord> {
  const result = await gatewayCall<{ documents: LeadBatchRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { leadBatchId, ownerTmBaId },
    limit: 1,
  });
  const batch = result.documents?.[0];
  if (!batch) throw new LeadBatchError('lead_batch_not_found');
  return batch;
}

export async function listLeadBatchesForOwner(ownerTmBaId: string): Promise<LeadBatchRecord[]> {
  const result = await gatewayCall<{ documents: LeadBatchRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { ownerTmBaId },
    sort: { createdAt: -1 },
    limit: 500,
  });
  return result.documents ?? [];
}

export async function markLeadBatchImported(
  leadBatchId: string,
  ownerTmBaId: string,
  importedCount: number,
): Promise<LeadBatchRecord> {
  const batch = await findLeadBatchForOwner(leadBatchId, ownerTmBaId);
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
    filter: { leadBatchId, ownerTmBaId },
    update: { $set: patch },
  });
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (lb:LeadBatch {leadBatchId: $leadBatchId, ownerTmBaId: $ownerTmBaId}) ' +
      'SET lb.quantityImported = $quantityImported, lb.status = $status, ' +
      '    lb.updatedAt = $updatedAt, lb.completedAt = $completedAt',
    params: {
      leadBatchId,
      ownerTmBaId,
      quantityImported,
      status: patch.status,
      updatedAt: now,
      completedAt: now,
    },
  });

  return { ...batch, ...patch };
}
