/**
 * Dedicated prospect CRM record foundation for PMV/RVM tokens.
 *
 * Existing cockpit CRM behavior lives on the prospect row plus notes,
 * followups, and dispositions. This module adds the explicit
 * ProspectCRMRecord layer required by the VM lead campaign architecture
 * without replacing those existing reads.
 *
 * Ownership contract:
 *   - ownerTmBaId and sponsorTmBaId are stamped server-side only.
 *   - BA reads/writes filter by ownerTmBaId from the session.
 *   - client payloads never carry owner/sponsor authority.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { appendAuditEntry } from './auditLog.js';
import type {
  AuditActor,
  BulkLeadStatus,
  ProspectCRMRecord,
  ProspectCrmSource,
  ProspectCrmStatus,
  ProspectTimelineEventRecord,
  ProspectTimelineKind,
} from '@momentum/shared';

type ProspectCRMDocument = ProspectCRMRecord & { token: string | null };

const MONGO_DB = 'momentum';
const CRM_COLLECTION = 'prospect_crm_records';
const TIMELINE_COLLECTION = 'prospect_timeline_events';
const PROSPECTS_COLLECTION = 'prospects';
const TOKENS_COLLECTION = 'invite_tokens';
const BULK_LEADS_COLLECTION = 'vm_bulk_leads';
const CRM_CHROMA_COLLECTION = 'mcs_prospect_crm';
const TIMELINE_CHROMA_COLLECTION = 'mcs_prospect_timeline';

export class ProspectCrmError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ProspectCrmError';
  }
}

interface CreateOrUpdateCrmInput {
  prospectId: string;
  token: string;
  ownerTmBaId: string;
  sponsorTmBaId: string;
  source: ProspectCrmSource;
  leadId?: string | null;
  leadBatchId?: string | null;
  vmCampaignId?: string | null;
  createdAt?: string;
}

interface TimelineInput {
  prospectId: string;
  crmRecordId?: string | null;
  ownerTmBaId: string;
  sponsorTmBaId: string;
  kind: ProspectTimelineKind;
  note: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

function timelinePayload(input: Record<string, unknown> = {}): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(input)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      out[key] = value;
    } else if (value !== undefined) {
      out[key] = JSON.stringify(value);
    }
  }
  return out;
}

function crmIdForProspect(prospectId: string): string {
  return `crm_${prospectId}`;
}

function bulkLeadStatusFor(kind: ProspectTimelineKind): BulkLeadStatus | null {
  switch (kind) {
    case 'link_clicked':
      return 'link_clicked';
    case 'activated':
      return 'activated';
    case 'info_requested':
      return 'info_requested';
    case 'callback_requested':
      return 'callback_requested';
    case 'presentation_started':
      return 'presentation_started';
    case 'presentation_25':
      return 'presentation_25';
    case 'presentation_50':
      return 'presentation_50';
    case 'presentation_75':
      return 'presentation_75';
    case 'presentation_completed':
      return 'presentation_completed';
    case 'holding_tank':
      return 'holding_tank';
    case 'closed_new_ba':
      return 'closed_new_ba';
    default:
      return null;
  }
}

function crmStatusFor(kind: ProspectTimelineKind): ProspectCrmStatus | null {
  switch (kind) {
    case 'link_clicked':
    case 'activated':
      return 'active';
    case 'info_requested':
    case 'callback_requested':
      return 'needs_follow_up';
    case 'presentation_started':
    case 'presentation_25':
    case 'presentation_50':
    case 'presentation_75':
      return 'watching';
    case 'presentation_completed':
      return 'presentation_completed';
    case 'holding_tank':
      return 'holding_tank';
    case 'closed_new_ba':
      return 'closed';
    default:
      return null;
  }
}

export async function findCrmRecordByProspectId(
  prospectId: string,
): Promise<ProspectCRMDocument | null> {
  const result = await gatewayCall<{ documents: ProspectCRMDocument[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

export async function findCrmRecordByToken(token: string): Promise<ProspectCRMDocument | null> {
  const result = await gatewayCall<{ documents: ProspectCRMDocument[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { token },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

export async function listCrmRecordsForOwner(
  ownerTmBaId: string,
  includeClosed = false,
): Promise<ProspectCRMRecord[]> {
  const filter: Record<string, unknown> = { ownerTmBaId };
  if (!includeClosed) filter.status = { $ne: 'closed' };
  const result = await gatewayCall<{ documents: ProspectCRMRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter,
    sort: { updatedAt: -1 },
    limit: 1000,
  });
  return result.documents ?? [];
}

export async function listTimelineForProspect(
  prospectId: string,
  ownerTmBaId: string,
): Promise<ProspectTimelineEventRecord[]> {
  const result = await gatewayCall<{ documents: ProspectTimelineEventRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: TIMELINE_COLLECTION,
      filter: { prospectId, ownerTmBaId },
      sort: { occurredAt: 1 },
      limit: 500,
    },
  );
  return result.documents ?? [];
}

export async function appendProspectTimelineEvent(
  input: TimelineInput,
): Promise<ProspectTimelineEventRecord> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const eventId = `ptl_${randomUUID()}`;
  const record: ProspectTimelineEventRecord = {
    eventId,
    prospectId: input.prospectId,
    crmRecordId: input.crmRecordId ?? null,
    leadId: null,
    leadBatchId: null,
    vmCampaignId: null,
    ownerTmBaId: input.ownerTmBaId,
    sponsorTmBaId: input.sponsorTmBaId,
    kind: input.kind,
    title: input.note,
    occurredAt: createdAt,
    payload: timelinePayload(input.metadata),
  };

  await tripleStackWrite({
    id: eventId,
    mongoCollection: TIMELINE_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (p:Prospect {prospectId: $prospectId}) ' +
        'CREATE (e:ProspectTimelineEvent {' +
        '  eventId: $id, kind: $kind, title: $title, occurredAt: $occurredAt, ' +
        '  ownerTmBaId: $ownerTmBaId, sponsorTmBaId: $sponsorTmBaId' +
        '}) ' +
        'CREATE (p)-[:HAS_TIMELINE_EVENT]->(e)',
      params: {
        prospectId: record.prospectId,
        kind: record.kind,
        title: record.title,
        occurredAt: record.occurredAt,
        ownerTmBaId: record.ownerTmBaId,
        sponsorTmBaId: record.sponsorTmBaId,
      },
    },
    chroma: {
      collection: TIMELINE_CHROMA_COLLECTION,
      document:
        `${record.kind}: ${record.title} ` +
        `(prospect ${record.prospectId}, owner ${record.ownerTmBaId}) at ${createdAt}`,
      metadata: {
        kind: record.kind,
        prospectId: record.prospectId,
        ownerTmBaId: record.ownerTmBaId,
        sponsorTmBaId: record.sponsorTmBaId,
        createdAt,
      },
    },
  });

  return record;
}

export async function createOrUpdateCrmRecordForToken(
  input: CreateOrUpdateCrmInput,
): Promise<ProspectCRMDocument> {
  const existing = await findCrmRecordByProspectId(input.prospectId);
  const now = input.createdAt ?? new Date().toISOString();

  if (existing) {
    const patch: Partial<ProspectCRMDocument> = {
      token: input.token,
      leadId: input.leadId ?? existing.leadId,
      leadBatchId: input.leadBatchId ?? existing.leadBatchId,
      vmCampaignId: input.vmCampaignId ?? existing.vmCampaignId,
      source: input.source,
      updatedAt: now,
    };
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: CRM_COLLECTION,
      filter: { crmRecordId: existing.crmRecordId },
      update: { $set: patch },
    });
    await gatewayCall('neo4j', 'cypher', {
      query:
        'MATCH (c:ProspectCRMRecord {crmRecordId: $crmRecordId}) ' +
        'SET c.token = $token, c.source = $source, c.updatedAt = $updatedAt',
      params: {
        crmRecordId: existing.crmRecordId,
        token: input.token,
        source: input.source,
        updatedAt: now,
      },
    });
    return { ...existing, ...patch };
  }

  const record: ProspectCRMDocument = {
    crmRecordId: crmIdForProspect(input.prospectId),
    prospectId: input.prospectId,
    leadId: input.leadId ?? null,
    leadBatchId: input.leadBatchId ?? null,
    vmCampaignId: input.vmCampaignId ?? null,
    token: input.token,
    ownerTmBaId: input.ownerTmBaId,
    sponsorTmBaId: input.sponsorTmBaId,
    source: input.source,
    status: 'inactive_pre_engagement',
    disposition: null,
    followUpDueAt: null,
    closedAt: null,
    closedReason: null,
    createdAt: now,
    updatedAt: now,
  };

  await tripleStackWrite({
    id: record.crmRecordId,
    mongoCollection: CRM_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (b:BA {baId: $ownerTmBaId}) ' +
        'MERGE (p:Prospect {prospectId: $prospectId}) ' +
        'MERGE (c:ProspectCRMRecord {crmRecordId: $id}) ' +
        'SET c += {' +
        '  prospectId: $prospectId, token: $token, source: $source, ' +
        '  status: $status, ownerTmBaId: $ownerTmBaId, ' +
        '  sponsorTmBaId: $sponsorTmBaId, createdAt: $createdAt, updatedAt: $updatedAt' +
        '} ' +
        'MERGE (b)-[:OWNS_CRM_RECORD]->(c) ' +
        'MERGE (c)-[:FOR_PROSPECT]->(p)',
      params: {
        prospectId: record.prospectId,
        token: record.token,
        source: record.source,
        status: record.status,
        ownerTmBaId: record.ownerTmBaId,
        sponsorTmBaId: record.sponsorTmBaId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    },
    chroma: {
      collection: CRM_CHROMA_COLLECTION,
      document:
        `CRM record created for prospect ${record.prospectId} from ${record.source}; ` +
        `owner ${record.ownerTmBaId}, sponsor ${record.sponsorTmBaId}, token ${record.token}.`,
      metadata: {
        kind: 'crm_record_created',
        prospectId: record.prospectId,
        token: record.token,
        ownerTmBaId: record.ownerTmBaId,
        sponsorTmBaId: record.sponsorTmBaId,
        source: record.source,
        createdAt: now,
      },
    },
  });

  await appendProspectTimelineEvent({
    prospectId: record.prospectId,
    crmRecordId: record.crmRecordId,
    ownerTmBaId: record.ownerTmBaId,
    sponsorTmBaId: record.sponsorTmBaId,
    kind: 'crm_created',
    note: `CRM record created from ${record.source} token creation.`,
    metadata: { token: record.token, source: record.source },
    createdAt: now,
  });

  return record;
}

export async function applyCrmLifecycleEvent(
  prospectId: string,
  kind: ProspectTimelineKind,
  note: string,
  metadata: Record<string, unknown> = {},
): Promise<ProspectCRMDocument> {
  const record = await findCrmRecordByProspectId(prospectId);
  if (!record) throw new ProspectCrmError('crm_record_not_found');
  if (record.status === 'closed') return record;

  const now = new Date().toISOString();
  const nextStatus = crmStatusFor(kind);
  const patch: Partial<ProspectCRMRecord> = { updatedAt: now };
  if (nextStatus) patch.status = nextStatus;

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { crmRecordId: record.crmRecordId },
    update: { $set: patch },
  });
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (c:ProspectCRMRecord {crmRecordId: $crmRecordId}) ' +
      'SET c.status = $status, c.updatedAt = $updatedAt',
    params: {
      crmRecordId: record.crmRecordId,
      status: patch.status ?? record.status,
      updatedAt: now,
    },
  });

  const bulkStatus = bulkLeadStatusFor(kind);
  if (record.leadId && bulkStatus) {
    const set: Record<string, unknown> = { status: bulkStatus, updatedAt: now };
    if (kind === 'activated') set.activatedAt = now;
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: BULK_LEADS_COLLECTION,
      filter: { leadId: record.leadId },
      update: { $set: set },
    });
  }

  await appendProspectTimelineEvent({
    prospectId,
    crmRecordId: record.crmRecordId,
    ownerTmBaId: record.ownerTmBaId,
    sponsorTmBaId: record.sponsorTmBaId,
    kind,
    note,
    metadata,
    createdAt: now,
  });

  return { ...record, ...patch };
}

export async function getOwnerScopedCrmRecord(
  prospectId: string,
  ownerTmBaId: string,
): Promise<ProspectCRMDocument> {
  const record = await findCrmRecordByProspectId(prospectId);
  if (!record) throw new ProspectCrmError('crm_record_not_found');
  if (record.ownerTmBaId !== ownerTmBaId) throw new ProspectCrmError('owner_mismatch');
  return record;
}

export async function closeCrmAsNewBa(input: {
  prospectId: string;
  ownerTmBaId: string;
  actor: AuditActor;
  reason: string;
}): Promise<ProspectCRMRecord> {
  const record = await getOwnerScopedCrmRecord(input.prospectId, input.ownerTmBaId);
  if (record.status === 'closed' && record.disposition === 'new_ba') return record;

  const closedAt = new Date().toISOString();
  const patch: Partial<ProspectCRMDocument> = {
    status: 'closed',
    disposition: 'new_ba',
    closedReason: 'enrolled_as_ba',
    closedAt,
    updatedAt: closedAt,
  };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { crmRecordId: record.crmRecordId },
    update: { $set: patch },
  });
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId: record.prospectId },
    update: { $set: { state: 'enrolled', updatedAt: closedAt } },
  });
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: TOKENS_COLLECTION,
    filter: { token: record.token },
    update: { $set: { state: 'enrolled', updatedAt: closedAt } },
  });
  if (record.leadId) {
    await gatewayCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: BULK_LEADS_COLLECTION,
      filter: { leadId: record.leadId },
      update: { $set: { status: 'closed_new_ba', updatedAt: closedAt } },
    });
  }
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (c:ProspectCRMRecord {crmRecordId: $crmRecordId}) ' +
      'SET c.status = $status, c.disposition = $disposition, ' +
      '    c.closedReason = $closedReason, c.closedAt = $closedAt, c.updatedAt = $closedAt ' +
      'WITH c ' +
      'MATCH (p:Prospect {prospectId: $prospectId}) ' +
      'SET p.state = $state, p.updatedAt = $closedAt',
    params: {
      crmRecordId: record.crmRecordId,
      prospectId: record.prospectId,
      status: 'closed',
      disposition: 'new_ba',
      closedReason: 'enrolled_as_ba',
      closedAt,
      state: 'enrolled',
    },
  });

  await appendProspectTimelineEvent({
    prospectId: record.prospectId,
    crmRecordId: record.crmRecordId,
    ownerTmBaId: record.ownerTmBaId,
    sponsorTmBaId: record.sponsorTmBaId,
    kind: 'closed_new_ba',
    note: 'CRM record closed because the prospect enrolled as a Brand Ambassador.',
    metadata: { reason: input.reason },
    createdAt: closedAt,
  });

  await appendAuditEntry({
    actor: input.actor,
    action: `${input.actor.kind}.crm.close_as_new_ba`,
    entity: {
      kind: 'prospect',
      id: record.prospectId,
      displayLabel: record.prospectId,
    },
    severity: 'info',
    before: {
      status: record.status,
      disposition: record.disposition,
      tokenState: 'active',
    },
    after: {
      status: 'closed',
      disposition: 'new_ba',
      closedReason: 'enrolled_as_ba',
      tokenState: 'enrolled',
    },
    reason: input.reason,
  });

  return { ...record, ...patch };
}

export async function recordOwnershipCorrectionAudit(input: {
  prospectId: string;
  oldOwnerTmBaId: string;
  newOwnerTmBaId: string;
  oldSponsorTmBaId: string;
  newSponsorTmBaId: string;
  reason: string;
  actor: AuditActor;
}): Promise<void> {
  await appendAuditEntry({
    actor: input.actor,
    action: 'admin.prospect.ownership_correction',
    entity: {
      kind: 'prospect',
      id: input.prospectId,
      displayLabel: input.prospectId,
    },
    severity: 'critical',
    before: {
      ownerTmBaId: input.oldOwnerTmBaId,
      sponsorTmBaId: input.oldSponsorTmBaId,
    },
    after: {
      ownerTmBaId: input.newOwnerTmBaId,
      sponsorTmBaId: input.newSponsorTmBaId,
    },
    reason: input.reason,
  });

  await appendProspectTimelineEvent({
    prospectId: input.prospectId,
    crmRecordId: crmIdForProspect(input.prospectId),
    ownerTmBaId: input.newOwnerTmBaId,
    sponsorTmBaId: input.newSponsorTmBaId,
    kind: 'ownership_corrected',
    note: 'Admin ownership correction was audited.',
    metadata: {
      oldOwnerTmBaId: input.oldOwnerTmBaId,
      newOwnerTmBaId: input.newOwnerTmBaId,
      oldSponsorTmBaId: input.oldSponsorTmBaId,
      newSponsorTmBaId: input.newSponsorTmBaId,
    },
  });
}
