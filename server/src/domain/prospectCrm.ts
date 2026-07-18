/**
 * Dedicated prospect CRM record foundation for PMV/RVM tokens.
 *
 * Existing cockpit CRM behavior lives on the prospect row plus notes,
 * followups, and dispositions. This module adds the explicit
 * ProspectCRMRecord layer required by the VM lead campaign architecture
 * without replacing those existing reads.
 *
 * Ownership contract:
 *   - ownerTmagId and sponsorTmagId are stamped server-side only.
 *   - BA reads/writes filter by ownerTmagId from the session.
 *   - client payloads never carry owner/sponsor authority.
 */

import { createHash, randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeKnowledge } from '../services/tieredWrite.js';
import { appendAuditEntry } from './auditLog.js';
import { writeCrmOwnershipGraphCritical } from './crmOwnershipPersistence.js';
import { updateTokenLifecycleOperational } from './tokenLifecyclePersistence.js';
import type {
  McsAuditActor,
  McsVmLeadLifecycleStatus,
  McsProspectCRMRecord,
  McsProspectCrmSource,
  McsProspectCrmStatus,
  McsProspectTimelineEventRecord,
  McsProspectTimelineEventKind,
  McsFlowCorrelation,
} from '@momentum/shared';

type ProspectCRMDocument = McsProspectCRMRecord & {
  token: string | null;
  correlation?: McsFlowCorrelation;
  invitationRecordId?: string | null;
};

const MONGO_DB = 'momentum';
const CRM_COLLECTION = 'tmag_prospect_crm_records';
const TIMELINE_COLLECTION = 'tmag_prospect_timeline_events';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const BULK_LEADS_COLLECTION = 'tmag_vm_bulk_leads';
const CRM_CHROMA_COLLECTION = 'mcs_prospect_crm_records';
const TIMELINE_CHROMA_COLLECTION = 'mcs_prospect_timeline_events';

export class ProspectCrmError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ProspectCrmError';
  }
}

interface CreateOrUpdateCrmInput {
  prospectId: string;
  token: string;
  ownerTmagId: string;
  sponsorTmagId: string;
  source: McsProspectCrmSource;
  leadId?: string | null;
  leadOwnerId?: string | null;
  vmCampaignId?: string | null;
  createdAt?: string;
  correlation?: McsFlowCorrelation;
  invitationRecordId?: string;
}

interface TimelineInput {
  prospectId: string;
  crmRecordId?: string | null;
  ownerTmagId: string;
  sponsorTmagId: string;
  kind: McsProspectTimelineEventKind;
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

function sanitizeTimelineMetadata(input: Record<string, unknown>): Record<string, unknown> {
  if (typeof input.token !== 'string') return input;
  const tokenHash = createHash('sha256').update(input.token).digest('hex');
  const sanitized = { ...input };
  sanitized.tokenHash = tokenHash;
  delete sanitized.token;
  return sanitized;
}

function tokenHashFromToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function crmIdForProspect(prospectId: string): string {
  return `crm_${prospectId}`;
}

function bulkLeadStatusFor(kind: McsProspectTimelineEventKind): McsVmLeadLifecycleStatus | null {
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
    case 'closed_new_brand_ambassador':
      return 'closed_new_brand_ambassador';
    default:
      return null;
  }
}

function crmStatusFor(kind: McsProspectTimelineEventKind): McsProspectCrmStatus | null {
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
    case 'closed_new_brand_ambassador':
      return 'closed';
    default:
      return null;
  }
}

export async function findCrmRecordByProspectId(
  prospectId: string,
): Promise<ProspectCRMDocument | null> {
  const result = await persistenceCall<{ documents: ProspectCRMDocument[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { prospectId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

export async function findCrmRecordByToken(token: string): Promise<ProspectCRMDocument | null> {
  const result = await persistenceCall<{ documents: ProspectCRMDocument[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { token },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

export async function listCrmRecordsForOwner(
  ownerTmagId: string,
  includeClosed = false,
): Promise<McsProspectCRMRecord[]> {
  const filter: Record<string, unknown> = { ownerTmagId };
  if (!includeClosed) filter.status = { $ne: 'closed' };
  const result = await persistenceCall<{ documents: McsProspectCRMRecord[] }>('mongodb', 'query', {
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
  ownerTmagId: string,
): Promise<McsProspectTimelineEventRecord[]> {
  const result = await persistenceCall<{ documents: McsProspectTimelineEventRecord[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: TIMELINE_COLLECTION,
      filter: { prospectId, ownerTmagId },
      sort: { occurredAt: 1 },
      limit: 500,
    },
  );
  return result.documents ?? [];
}

export async function appendProspectTimelineEvent(
  input: TimelineInput,
): Promise<McsProspectTimelineEventRecord> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const eventId = `ptl_${randomUUID()}`;
  const sanitizedMetadata = sanitizeTimelineMetadata(input.metadata ?? {});
  const record: McsProspectTimelineEventRecord = {
    eventId,
    prospectId: input.prospectId,
    crmRecordId: input.crmRecordId ?? null,
    leadId: null,
    leadOwnerId: null,
    vmCampaignId: null,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    kind: input.kind,
    title: input.note,
    occurredAt: createdAt,
    payload: timelinePayload(sanitizedMetadata),
  };

  await writeKnowledge({
    id: eventId,
    mongoCollection: TIMELINE_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
        'CREATE (e:TmagProspectTimelineEvent {' +
        '  eventId: $id, kind: $kind, title: $title, occurredAt: $occurredAt, ' +
        '  ownerTmagId: $ownerTmagId, sponsorTmagId: $sponsorTmagId' +
        '}) ' +
        'CREATE (p)-[:HAS_TIMELINE_EVENT]->(e)',
      params: {
        prospectId: record.prospectId,
        kind: record.kind,
        title: record.title,
        occurredAt: record.occurredAt,
        ownerTmagId: record.ownerTmagId,
        sponsorTmagId: record.sponsorTmagId,
      },
    },
    chroma: {
      collection: TIMELINE_CHROMA_COLLECTION,
      document:
        `${record.kind}: ${record.title} ` +
        `(prospect ${record.prospectId}, owner ${record.ownerTmagId}) at ${createdAt}`,
      metadata: {
        kind: record.kind,
        prospectId: record.prospectId,
        ownerTmagId: record.ownerTmagId,
        sponsorTmagId: record.sponsorTmagId,
        ...timelinePayload(sanitizedMetadata),
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
  const tokenHash = tokenHashFromToken(input.token);
  const invitationRecordId = input.invitationRecordId ?? existing?.invitationRecordId;

  if (existing) {
    const patch: Partial<ProspectCRMDocument> = {
      token: input.token,
      leadId: input.leadId ?? existing.leadId,
      leadOwnerId: input.leadOwnerId ?? existing.leadOwnerId,
      vmCampaignId: input.vmCampaignId ?? existing.vmCampaignId,
      source: input.source,
      updatedAt: now,
      ...(input.correlation ? { correlation: input.correlation } : {}),
    };
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: CRM_COLLECTION,
      filter: { crmRecordId: existing.crmRecordId },
      update: { $set: patch },
    });
    await persistenceCall('neo4j', 'cypher', {
      query:
        'MATCH (c:TmagProspectCrmRecord {crmRecordId: $crmRecordId}) ' +
        'SET c.tokenHash = $tokenHash, c.source = $source, c.updatedAt = $updatedAt, ' +
        'c.correlationId = $correlationId, c.invitationRecordId = $invitationRecordId',
      params: {
        crmRecordId: existing.crmRecordId,
        source: input.source,
        updatedAt: now,
        invitationRecordId,
        tokenHash,
        correlationId: input.correlation?.correlationId ?? existing.correlation?.correlationId ?? null,
      },
    });
    return { ...existing, ...patch };
  }

  const record: ProspectCRMDocument = {
    crmRecordId: crmIdForProspect(input.prospectId),
    prospectId: input.prospectId,
    leadId: input.leadId ?? null,
    leadOwnerId: input.leadOwnerId ?? null,
    vmCampaignId: input.vmCampaignId ?? null,
    token: input.token,
    ownerTmagId: input.ownerTmagId,
    sponsorTmagId: input.sponsorTmagId,
    source: input.source,
    status: 'inactive_pre_engagement',
    disposition: null,
    followUpDueAt: null,
    closedAt: null,
    closedReason: null,
    createdAt: now,
    updatedAt: now,
    ...(input.correlation ? { correlation: input.correlation } : {}),
  };

  await writeCrmOwnershipGraphCritical({
    id: record.crmRecordId,
    mongoDoc: { ...record },
    ownerTmagId: record.ownerTmagId,
    target: { kind: 'prospect', prospectId: record.prospectId },
    crmProps: {
      prospectId: record.prospectId,
      tokenHash,
      invitationRecordId: input.invitationRecordId,
      source: record.source,
      status: record.status,
      sponsorTmagId: record.sponsorTmagId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      correlationId: input.correlation?.correlationId ?? null,
    },
    chroma: {
      collection: CRM_CHROMA_COLLECTION,
      document:
        `CRM record created for prospect ${record.prospectId} from ${record.source}; ` +
        `owner ${record.ownerTmagId}, sponsor ${record.sponsorTmagId}, token ${tokenHash}.`,
      metadata: {
        kind: 'crm_record_created',
        prospectId: record.prospectId,
        tokenHash,
        invitationRecordId: input.invitationRecordId,
        ownerTmagId: record.ownerTmagId,
        sponsorTmagId: record.sponsorTmagId,
        source: record.source,
        createdAt: now,
        correlationId: input.correlation?.correlationId ?? null,
      },
    },
  });

  await appendProspectTimelineEvent({
    prospectId: record.prospectId,
    crmRecordId: record.crmRecordId,
    ownerTmagId: record.ownerTmagId,
    sponsorTmagId: record.sponsorTmagId,
    kind: 'crm_created',
    note: `CRM record created from ${record.source} token creation.`,
    metadata: {
      source: record.source,
      tokenHash,
      invitationRecordId: input.invitationRecordId,
      correlationId: input.correlation?.correlationId ?? null,
    },
    createdAt: now,
  });

  return record;
}

export async function applyCrmLifecycleEvent(
  prospectId: string,
  kind: McsProspectTimelineEventKind,
  note: string,
  metadata: Record<string, unknown> = {},
): Promise<ProspectCRMDocument> {
  const record = await findCrmRecordByProspectId(prospectId);
  if (!record) throw new ProspectCrmError('crm_record_not_found');
  if (record.status === 'closed') return record;

  const now = new Date().toISOString();
  const nextStatus = crmStatusFor(kind);
  const patch: Partial<McsProspectCRMRecord> = { updatedAt: now };
  if (nextStatus) patch.status = nextStatus;

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { crmRecordId: record.crmRecordId },
    update: { $set: patch },
  });
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (c:TmagProspectCrmRecord {crmRecordId: $crmRecordId}) ' +
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
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: BULK_LEADS_COLLECTION,
      filter: { leadId: record.leadId },
      update: { $set: set },
    });
  }

  await appendProspectTimelineEvent({
    prospectId,
    crmRecordId: record.crmRecordId,
    ownerTmagId: record.ownerTmagId,
    sponsorTmagId: record.sponsorTmagId,
    kind,
    note,
    metadata,
    createdAt: now,
  });

  if (nextStatus && nextStatus !== record.status) {
    const tokenHash = record.token ? tokenHashFromToken(record.token) : null;
    await appendAuditEntry({
      actor: { kind: 'system', label: 'crm_lifecycle' },
      action: 'system.crm.status_changed',
      entity: {
        kind: 'prospect',
        id: record.prospectId,
        displayLabel: record.prospectId,
      },
      severity: 'info',
      before: { status: record.status },
      after: {
        status: nextStatus,
        timelineEventKind: kind,
        crmRecordId: record.crmRecordId,
        tokenHash,
        leadId: record.leadId,
      },
    });
  }

  return { ...record, ...patch };
}

export async function getOwnerScopedCrmRecord(
  prospectId: string,
  ownerTmagId: string,
): Promise<ProspectCRMDocument> {
  const record = await findCrmRecordByProspectId(prospectId);
  if (!record) throw new ProspectCrmError('crm_record_not_found');
  if (record.ownerTmagId !== ownerTmagId) throw new ProspectCrmError('owner_mismatch');
  return record;
}

export async function closeCrmAsNewBa(input: {
  prospectId: string;
  ownerTmagId: string;
  actor: McsAuditActor;
  reason: string;
}): Promise<McsProspectCRMRecord> {
  const record = await getOwnerScopedCrmRecord(input.prospectId, input.ownerTmagId);
  if (record.status === 'closed' && record.disposition === 'new_brand_ambassador') return record;

  const closedAt = new Date().toISOString();
  const patch: Partial<ProspectCRMDocument> = {
    status: 'closed',
    disposition: 'new_brand_ambassador',
    closedReason: 'enrolled_as_brand_ambassador',
    closedAt,
    updatedAt: closedAt,
  };

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: CRM_COLLECTION,
    filter: { crmRecordId: record.crmRecordId },
    update: { $set: patch },
  });
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId: record.prospectId },
    update: { $set: { state: 'enrolled', updatedAt: closedAt } },
  });
  if (record.token) {
    await updateTokenLifecycleOperational({
      token: record.token,
      patch: { state: 'enrolled', updatedAt: closedAt },
    });
  }
  if (record.leadId) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: BULK_LEADS_COLLECTION,
      filter: { leadId: record.leadId },
      update: { $set: { status: 'closed_new_brand_ambassador', updatedAt: closedAt } },
    });
  }
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (c:TmagProspectCrmRecord {crmRecordId: $crmRecordId}) ' +
      'SET c.status = $status, c.disposition = $disposition, ' +
      '    c.closedReason = $closedReason, c.closedAt = $closedAt, c.updatedAt = $closedAt ' +
      'WITH c ' +
      'MATCH (p:TmagProspect {prospectId: $prospectId}) ' +
      'SET p.state = $state, p.updatedAt = $closedAt',
    params: {
      crmRecordId: record.crmRecordId,
      prospectId: record.prospectId,
      status: 'closed',
      disposition: 'new_brand_ambassador',
      closedReason: 'enrolled_as_brand_ambassador',
      closedAt,
      state: 'enrolled',
    },
  });

  await appendProspectTimelineEvent({
    prospectId: record.prospectId,
    crmRecordId: record.crmRecordId,
    ownerTmagId: record.ownerTmagId,
    sponsorTmagId: record.sponsorTmagId,
    kind: 'closed_new_brand_ambassador',
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
      disposition: 'new_brand_ambassador',
      closedReason: 'enrolled_as_brand_ambassador',
      tokenState: 'enrolled',
    },
    reason: input.reason,
  });

  return { ...record, ...patch };
}

export async function recordOwnershipCorrectionAudit(input: {
  prospectId: string;
  oldOwnerTmagId: string;
  newOwnerTmagId: string;
  oldSponsorTmagId: string;
  newSponsorTmagId: string;
  reason: string;
  actor: McsAuditActor;
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
      ownerTmagId: input.oldOwnerTmagId,
      sponsorTmagId: input.oldSponsorTmagId,
    },
    after: {
      ownerTmagId: input.newOwnerTmagId,
      sponsorTmagId: input.newSponsorTmagId,
    },
    reason: input.reason,
  });

  await appendProspectTimelineEvent({
    prospectId: input.prospectId,
    crmRecordId: crmIdForProspect(input.prospectId),
    ownerTmagId: input.newOwnerTmagId,
    sponsorTmagId: input.newSponsorTmagId,
    kind: 'ownership_corrected',
    note: 'Admin ownership correction was audited.',
    metadata: {
      oldOwnerTmagId: input.oldOwnerTmagId,
      newOwnerTmagId: input.newOwnerTmagId,
      oldSponsorTmagId: input.oldSponsorTmagId,
      newSponsorTmagId: input.newSponsorTmagId,
    },
  });
}
