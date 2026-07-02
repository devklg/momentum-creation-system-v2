/**
 * VM lead owner domain.
 *
 * A lead-owner record is an acquisition container owned by exactly one member. It creates no
 * public momentum and never places anyone in the holding tank.
 */

import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type { McsLeadOwnerRecord, McsVmLeadOwnerSource, McsVmLeadType } from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'tmag_vm_lead_owners';
const CHROMA_COLLECTION = 'mcs_vm_lead_owners';

export class LeadOwnerError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'LeadOwnerError';
  }
}

export interface CreateLeadOwnerInput {
  ownerTmagId: string;
  sponsorTmagId: string;
  name: string;
  source: string;
  country: string;
  leadType: string;
  quantityImported: number;
}

export async function createLeadOwner(input: CreateLeadOwnerInput): Promise<McsLeadOwnerRecord> {
  const now = new Date().toISOString();
  const leadOwner: McsLeadOwnerRecord = {
    leadOwnerId: `leadowner_${randomUUID()}`,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    name: input.name,
    source: input.source as McsVmLeadOwnerSource,
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
    id: leadOwner.leadOwnerId,
    mongoCollection: COLLECTION,
    mongoDoc: { ...leadOwner },
    neo4j: {
      cypher:
        'MERGE (b:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'CREATE (lb:TmagVmLeadOwner {leadOwnerId: $id, name: $name, source: $source, ' +
        '  country: $country, leadType: $leadType, ownerTmagId: $ownerTmagId, ' +
        '  sponsorTmagId: $sponsorTmagId, status: $status, createdAt: $createdAt}) ' +
        'CREATE (b)-[:OWNS_VM_LEAD_OWNER]->(lb)',
      params: {
        ownerTmagId: leadOwner.ownerTmagId,
        sponsorTmagId: leadOwner.sponsorTmagId,
        name: leadOwner.name,
        source: leadOwner.source,
        country: leadOwner.country,
        leadType: leadOwner.leadType,
        status: leadOwner.status,
        createdAt: now,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `Lead owner ${leadOwner.name} from ${leadOwner.source}; owner ${leadOwner.ownerTmagId}; ` +
        `${leadOwner.quantityImported} ${leadOwner.leadType} leads in ${leadOwner.country}.`,
      metadata: {
        kind: 'lead_owner_created',
        leadOwnerId: leadOwner.leadOwnerId,
        ownerTmagId: leadOwner.ownerTmagId,
        source: leadOwner.source,
        country: leadOwner.country,
        createdAt: now,
      },
    },
  });

  return leadOwner;
}

export async function findLeadOwnerForOwner(
  leadOwnerId: string,
  ownerTmagId: string,
): Promise<McsLeadOwnerRecord> {
  const result = await persistenceCall<{ documents: McsLeadOwnerRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { leadOwnerId, ownerTmagId },
    limit: 1,
  });
  const leadOwner = result.documents?.[0];
  if (!leadOwner) throw new LeadOwnerError('lead_owner_not_found');
  return leadOwner;
}

export async function listLeadOwnersForOwner(ownerTmagId: string): Promise<McsLeadOwnerRecord[]> {
  const result = await persistenceCall<{ documents: McsLeadOwnerRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { ownerTmagId },
    sort: { createdAt: -1 },
    limit: 500,
  });
  return result.documents ?? [];
}

export async function markLeadOwnerImported(
  leadOwnerId: string,
  ownerTmagId: string,
  importedCount: number,
): Promise<McsLeadOwnerRecord> {
  const leadOwner = await findLeadOwnerForOwner(leadOwnerId, ownerTmagId);
  const now = new Date().toISOString();
  const quantityImported = leadOwner.quantityImported + importedCount;
  const patch = {
    quantityImported,
    status: 'imported' as const,
    updatedAt: now,
    completedAt: now,
  };

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { leadOwnerId, ownerTmagId },
    update: { $set: patch },
  });
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (lb:TmagVmLeadOwner {leadOwnerId: $leadOwnerId, ownerTmagId: $ownerTmagId}) ' +
      'SET lb.quantityImported = $quantityImported, lb.status = $status, ' +
      '    lb.updatedAt = $updatedAt, lb.completedAt = $completedAt',
    params: {
      leadOwnerId,
      ownerTmagId,
      quantityImported,
      status: patch.status,
      updatedAt: now,
      completedAt: now,
    },
  });

  return { ...leadOwner, ...patch };
}
