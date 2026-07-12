/**
 * VM provider/import queue foundation.
 *
 * Agent 5 owns the scale substrate only: import chunking, validation,
 * dedupe/suppression placeholders, token/CRM/delivery queue rows, provider
 * webhook ingestion, retries, rate limits, and audit events. UI/RVM rendering
 * and final campaign APIs belong to adjacent agents.
 *
 * Imported VM leads are acquisition records. They do not enter the public
 * momentum leg or Holding Tank here; later RVM/video-complete flows must do
 * that through the existing placement rule.
 */

import { createHash, randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeOperational } from '../services/tieredWrite.js';
import { env } from '../env.js';
import {
  gatherSingleDigit,
  hangupCall,
  playbackStart,
  sendSms,
  TelnyxConfigError,
  TelnyxError,
} from '../services/telnyx.js';
import { mintUniqueToken, TOKEN_TTL_MS } from './tokens.js';
import {
  isInboundTelnyxCallPayload,
  processInboundTelnyxCall,
} from './vmInboundCallback.js';
import { writeCrmOwnershipGraphCritical } from './crmOwnershipPersistence.js';
import { writeVmLeadTokenGraphCritical } from './tokenLifecyclePersistence.js';

const MONGO_DB = 'momentum';
const CHROMA_COLLECTION = 'mcs_vm_campaigns';

const LEADS_COLLECTION = 'tmag_vm_bulk_leads';
const QUEUE_COLLECTION = 'tmag_vm_queue_jobs';
const DELIVERY_EVENTS_COLLECTION = 'tmag_vm_delivery_events';
const WEBHOOK_EVENTS_COLLECTION = 'tmag_vm_provider_webhook_events';
const AUDIT_COLLECTION = 'tmag_vm_audit_events';
const SUPPRESSION_COLLECTION = 'tmag_vm_suppression_list';

const DEFAULT_MAX_ATTEMPTS = 3;
const IMPORT_CHUNK_SIZE = 500;

export type VmProviderKey = 'manual_csv' | 'acquisition_provider_placeholder' | 'telnyx_call_control';

export type VmQueueJobKind =
  | 'import_validate'
  | 'suppression_check'
  | 'token_generate'
  | 'crm_create'
  | 'delivery'
  | 'webhook_event';

export type VmQueueJobStatus =
  | 'queued'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'dead_lettered'
  | 'skipped';

export type VmLeadStatus =
  | 'imported'
  | 'validated'
  | 'invalid'
  | 'duplicate'
  | 'suppressed'
  | 'token_created'
  | 'crm_created'
  | 'queued'
  | 'delivery_dry_run'
  | 'manual_exported'
  | 'voicemail_drop_queued'
  | 'voicemail_drop_delivered'
  | 'voicemail_drop_failed'
  | 'opted_out'
  // Canonical raised-hand status (CRM_VM_LEAD_STATUSES / McsVmLeadLifecycleStatus)
  // — set when an inbound callback is matched to this lead.
  | 'callback_requested';

export interface VmImportLeadRow {
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  city?: string | null;
  stateOrRegion?: string | null;
  country?: string | null;
  sourceLeadId?: string | null;
  consentStatus?: 'unknown' | 'provided' | 'not_provided' | 'do_not_contact';
  /**
   * Lead classification. `interviewed` = a human already spoke with this
   * person; a robotic voicemail would regress the relationship, so it
   * implies doNotDrop.
   */
  leadType?: string | null;
  /**
   * Hard delivery block: a doNotDrop lead can NEVER receive a VM delivery
   * job, regardless of campaign. Enforced fail-closed in the delivery
   * worker gate.
   */
  doNotDrop?: boolean | null;
  raw?: Record<string, unknown>;
}

export interface VmQueueJob<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  jobId: string;
  kind: VmQueueJobKind;
  status: VmQueueJobStatus;
  attempts: number;
  maxAttempts: number;
  availableAt: string;
  lockedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  payload: TPayload;
  createdAt: string;
  updatedAt: string;
}

export interface VmBulkLeadRecord {
  leadId: string;
  importJobId: string;
  leadOwnerId: string;
  vmCampaignId: string;
  ownerTmagId: string;
  sponsorTmagId: string;
  sourceLabel: string;
  sourceLeadId: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  email: string | null;
  normalizedEmail: string | null;
  city: string | null;
  stateOrRegion: string | null;
  country: string;
  consentStatus: 'unknown' | 'provided' | 'not_provided' | 'do_not_contact';
  /** See VmImportLeadRow.leadType. Optional — legacy docs predate the field. */
  leadType?: string | null;
  /** See VmImportLeadRow.doNotDrop. Optional — legacy docs predate the field. */
  doNotDrop?: boolean | null;
  dedupeKey: string;
  status: VmLeadStatus;
  token: string | null;
  crmRecordId: string | null;
  validationIssues: string[];
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VmDeliveryEventRecord {
  eventId: string;
  provider: VmProviderKey;
  leadId: string;
  vmCampaignId: string;
  ownerTmagId: string;
  status: string;
  providerMessageId: string | null;
  providerStatus: string | null;
  dryRun: boolean;
  attempt: number;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface CreateImportJobInput {
  leadOwnerId: string;
  vmCampaignId: string;
  ownerTmagId: string;
  sponsorTmagId: string;
  sourceLabel: string;
  rows: VmImportLeadRow[];
  createdBy: string;
}

interface ImportChunkPayload extends Record<string, unknown> {
  importJobId: string;
  leadOwnerId: string;
  vmCampaignId: string;
  ownerTmagId: string;
  sponsorTmagId: string;
  sourceLabel: string;
  chunkIndex: number;
  rows: VmImportLeadRow[];
}

interface LeadPayload extends Record<string, unknown> {
  leadId: string;
}

export function normalizeVmPhone(input: string | null | undefined): string | null {
  const raw = input?.trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const e164 = `+${raw.slice(1).replace(/\D/g, '')}`;
    return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export function normalizeVmEmail(input: string | null | undefined): string | null {
  const value = input?.trim().toLowerCase();
  if (!value) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

/**
 * Fail-closed do-not-drop check: an explicit doNotDrop flag OR the
 * `interviewed` lead type (a human already spoke to them) blocks VM
 * delivery entirely.
 */
export function isDoNotDropLead(
  lead: Pick<VmBulkLeadRecord, 'doNotDrop' | 'leadType'>,
): boolean {
  return lead.doNotDrop === true || lead.leadType === 'interviewed';
}

function hashDedupe(parts: string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
}

function leadDedupeKey(ownerTmagId: string, phone: string | null, email: string | null): string {
  return hashDedupe([ownerTmagId, phone ?? '', email ?? '']);
}

function assertOwnership(input: {
  ownerTmagId?: string | null;
  sponsorTmagId?: string | null;
  leadOwnerId?: string | null;
  vmCampaignId?: string | null;
}): void {
  if (!input.ownerTmagId) throw new Error('ownerTmagId_required');
  if (!input.sponsorTmagId) throw new Error('sponsorTmagId_required');
  if (!input.leadOwnerId) throw new Error('leadOwnerId_required');
  if (!input.vmCampaignId) throw new Error('vmCampaignId_required');
}

export async function vmAudit(input: {
  action: string;
  entityId: string;
  ownerTmagId: string | null;
  summary: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const at = new Date().toISOString();
  const id = `vmaudit_${randomUUID()}`;
  await writeOperational({
    id,
    mongoCollection: AUDIT_COLLECTION,
    mongoDoc: {
      auditId: id,
      action: input.action,
      entityId: input.entityId,
      ownerTmagId: input.ownerTmagId,
      summary: input.summary,
      payload: input.payload ?? {},
      createdAt: at,
    },
    neo4j: {
      cypher:
        'MERGE (e:TmagVmAuditEvent {auditId: $id}) ' +
        'SET e.action = $action, e.entityId = $entityId, e.ownerTmagId = $ownerTmagId, e.createdAt = datetime($createdAt) ' +
        'WITH e ' +
        'OPTIONAL MATCH (ba:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'FOREACH (_ IN CASE WHEN ba IS NULL THEN [] ELSE [1] END | MERGE (ba)-[:HAS_VM_AUDIT]->(e))',
      params: {
        action: input.action,
        entityId: input.entityId,
        ownerTmagId: input.ownerTmagId,
        createdAt: at,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `${input.action}: ${input.summary}`,
      metadata: {
        kind: 'vm_audit',
        action: input.action,
        entityId: input.entityId,
        ownerTmagId: input.ownerTmagId,
        createdAt: at,
      },
    },
  });
}

export async function enqueueVmJob<TPayload extends Record<string, unknown>>(
  kind: VmQueueJobKind,
  payload: TPayload,
  options?: { maxAttempts?: number; availableAt?: string; jobId?: string },
): Promise<VmQueueJob<TPayload>> {
  const now = new Date().toISOString();
  const job: VmQueueJob<TPayload> = {
    jobId: options?.jobId ?? `vmjob_${randomUUID()}`,
    kind,
    status: 'queued',
    attempts: 0,
    maxAttempts: options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    availableAt: options?.availableAt ?? now,
    lockedAt: null,
    completedAt: null,
    failedAt: null,
    failureReason: null,
    payload,
    createdAt: now,
    updatedAt: now,
  };

  await writeOperational({
    id: job.jobId,
    mongoCollection: QUEUE_COLLECTION,
    mongoDoc: job as unknown as Record<string, unknown>,
    neo4j: {
      cypher:
        'MERGE (j:TmagVmQueueJob {jobId: $id}) ' +
        'SET j.kind = $kind, j.status = $status, j.availableAt = datetime($availableAt), j.createdAt = datetime($createdAt)',
      params: {
        kind: job.kind,
        status: job.status,
        availableAt: job.availableAt,
        createdAt: job.createdAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `VM queue job ${job.kind} queued at ${job.createdAt}`,
      metadata: {
        kind: 'vm_queue_job',
        jobKind: job.kind,
        status: job.status,
        createdAt: job.createdAt,
      },
    },
  });
  return job;
}

export async function claimVmJobs(
  kinds: VmQueueJobKind[],
  limit: number,
): Promise<VmQueueJob[]> {
  const now = new Date().toISOString();
  const result = await persistenceCall<{ documents: VmQueueJob[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: QUEUE_COLLECTION,
    filter: { kind: { $in: kinds }, status: 'queued', availableAt: { $lte: now } },
    sort: { availableAt: 1, createdAt: 1 },
    limit,
  });

  const claimed: VmQueueJob[] = [];
  for (const job of result.documents ?? []) {
    const lockedAt = new Date().toISOString();
    const claim = await persistenceCall<{ matchedCount?: number; modifiedCount?: number }>('mongodb', 'update', {
      database: MONGO_DB,
      collection: QUEUE_COLLECTION,
      filter: { jobId: job.jobId, status: 'queued' },
      update: {
        $set: {
          status: 'processing',
          lockedAt,
          updatedAt: lockedAt,
          attempts: job.attempts + 1,
        },
      },
    });
    if ((claim.modifiedCount ?? claim.matchedCount ?? 0) !== 1) continue;
    await vmAudit({
      action: 'vm.queue.claimed',
      entityId: job.jobId,
      ownerTmagId: ownerFromPayload(job.payload),
      summary: `Claimed ${job.kind} job ${job.jobId}.`,
      payload: { kind: job.kind, attempt: job.attempts + 1 },
    });
    claimed.push({ ...job, status: 'processing', lockedAt, attempts: job.attempts + 1 });
  }
  return claimed;
}

function ownerFromPayload(payload: Record<string, unknown>): string | null {
  const owner = payload.ownerTmagId;
  return typeof owner === 'string' ? owner : null;
}

export async function completeVmJob(jobId: string, note: string): Promise<void> {
  const at = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: QUEUE_COLLECTION,
    filter: { jobId, status: 'processing' },
    update: {
      $set: {
        status: 'complete',
        completedAt: at,
        lockedAt: null,
        updatedAt: at,
        failureReason: null,
      },
    },
  });
  await vmAudit({
    action: 'vm.queue.completed',
    entityId: jobId,
    ownerTmagId: null,
    summary: note,
  });
}

export async function skipVmJob(jobId: string, note: string): Promise<void> {
  const at = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: QUEUE_COLLECTION,
    filter: { jobId, status: 'processing' },
    update: {
      $set: {
        status: 'skipped',
        completedAt: at,
        lockedAt: null,
        updatedAt: at,
        failureReason: note,
      },
    },
  });
  await vmAudit({
    action: 'vm.queue.skipped',
    entityId: jobId,
    ownerTmagId: null,
    summary: note,
  });
}

export async function requeueVmJobWithoutBurningAttempt(
  job: VmQueueJob,
  availableAt: string,
  note: string,
): Promise<void> {
  const at = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: QUEUE_COLLECTION,
    filter: { jobId: job.jobId, status: 'processing', lockedAt: job.lockedAt },
    update: {
      $set: {
        status: 'queued',
        lockedAt: null,
        availableAt,
        updatedAt: at,
        failureReason: null,
      },
      $inc: { attempts: -1 },
    },
  });
  await vmAudit({
    action: 'vm.queue.requeued_without_attempt',
    entityId: job.jobId,
    ownerTmagId: ownerFromPayload(job.payload),
    summary: note,
    payload: { kind: job.kind, availableAt },
  });
}

export async function failVmJob(job: VmQueueJob, reason: string): Promise<void> {
  const at = new Date().toISOString();
  const terminal = job.attempts >= job.maxAttempts;
  const delayMs = Math.min(15 * 60_000, 2 ** Math.max(0, job.attempts - 1) * 30_000);
  const status: VmQueueJobStatus = terminal ? 'dead_lettered' : 'queued';
  const availableAt = terminal ? job.availableAt : new Date(Date.now() + delayMs).toISOString();

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: QUEUE_COLLECTION,
    filter: { jobId: job.jobId, status: 'processing', lockedAt: job.lockedAt },
    update: {
      $set: {
        status,
        failedAt: at,
        failureReason: reason.slice(0, 500),
        lockedAt: null,
        availableAt,
        updatedAt: at,
      },
    },
  });
  await vmAudit({
    action: terminal ? 'vm.queue.dead_lettered' : 'vm.queue.retry_scheduled',
    entityId: job.jobId,
    ownerTmagId: ownerFromPayload(job.payload),
    summary: `${job.kind} job ${terminal ? 'dead-lettered' : 'scheduled for retry'}: ${reason}`,
    payload: { kind: job.kind, attempts: job.attempts, maxAttempts: job.maxAttempts },
  });
}

export async function createManualImportJobs(input: CreateImportJobInput): Promise<{
  importJobId: string;
  chunksQueued: number;
  rowsAccepted: number;
}> {
  assertOwnership(input);
  const importJobId = `vmimport_${randomUUID()}`;
  const rows = input.rows;

  for (let i = 0; i < rows.length; i += IMPORT_CHUNK_SIZE) {
    const chunk = rows.slice(i, i + IMPORT_CHUNK_SIZE);
    await enqueueVmJob<ImportChunkPayload>('import_validate', {
      importJobId,
      leadOwnerId: input.leadOwnerId,
      vmCampaignId: input.vmCampaignId,
      ownerTmagId: input.ownerTmagId,
      sponsorTmagId: input.sponsorTmagId,
      sourceLabel: input.sourceLabel,
      chunkIndex: Math.floor(i / IMPORT_CHUNK_SIZE),
      rows: chunk,
    });
  }

  await vmAudit({
    action: 'vm.import.queued',
    entityId: importJobId,
    ownerTmagId: input.ownerTmagId,
    summary: `Queued VM manual import ${importJobId} with ${rows.length} rows.`,
    payload: {
      leadOwnerId: input.leadOwnerId,
      vmCampaignId: input.vmCampaignId,
      sourceLabel: input.sourceLabel,
      chunksQueued: Math.ceil(rows.length / IMPORT_CHUNK_SIZE),
      createdBy: input.createdBy,
    },
  });

  return {
    importJobId,
    chunksQueued: Math.ceil(rows.length / IMPORT_CHUNK_SIZE),
    rowsAccepted: rows.length,
  };
}

export async function processImportChunk(job: VmQueueJob<ImportChunkPayload>): Promise<void> {
  const payload = job.payload;
  assertOwnership(payload);

  let imported = 0;
  let skipped = 0;
  for (const row of payload.rows) {
    const result = await upsertImportedLead(payload, row);
    if (result.created) {
      imported += 1;
      await enqueueVmJob<LeadPayload>('suppression_check', { leadId: result.lead.leadId });
    } else {
      skipped += 1;
    }
  }
  await completeVmJob(job.jobId, `Imported ${imported} lead rows; skipped ${skipped}.`);
}

async function upsertImportedLead(
  payload: ImportChunkPayload,
  row: VmImportLeadRow,
): Promise<{ lead: VmBulkLeadRecord; created: boolean }> {
  const normalizedPhone = normalizeVmPhone(row.phone);
  const normalizedEmail = normalizeVmEmail(row.email);
  const validationIssues: string[] = [];
  if (row.phone && !normalizedPhone) validationIssues.push('invalid_phone');
  if (row.email && !normalizedEmail) validationIssues.push('invalid_email');
  if (!normalizedPhone && !normalizedEmail) validationIssues.push('missing_contact_channel');

  const dedupeKey = leadDedupeKey(payload.ownerTmagId, normalizedPhone, normalizedEmail);
  const existing = await persistenceCall<{ documents: VmBulkLeadRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { ownerTmagId: payload.ownerTmagId, dedupeKey },
    limit: 1,
  });

  if (existing.documents?.[0]) {
    await vmAudit({
      action: 'vm.lead.duplicate_skipped',
      entityId: existing.documents[0].leadId,
      ownerTmagId: payload.ownerTmagId,
      summary: `Skipped duplicate VM lead for lead owner ${payload.leadOwnerId}.`,
      payload: { importJobId: payload.importJobId, dedupeKey },
    });
    return { lead: existing.documents[0], created: false };
  }

  const now = new Date().toISOString();
  const leadId = `lead_${randomUUID()}`;
  const status: VmLeadStatus = validationIssues.length > 0 ? 'invalid' : 'imported';
  const lead: VmBulkLeadRecord = {
    leadId,
    importJobId: payload.importJobId,
    leadOwnerId: payload.leadOwnerId,
    vmCampaignId: payload.vmCampaignId,
    ownerTmagId: payload.ownerTmagId,
    sponsorTmagId: payload.sponsorTmagId,
    sourceLabel: payload.sourceLabel,
    sourceLeadId: row.sourceLeadId?.trim() || null,
    firstName: row.firstName?.trim() || null,
    lastName: row.lastName?.trim() || null,
    phone: row.phone?.trim() || null,
    normalizedPhone,
    email: row.email?.trim() || null,
    normalizedEmail,
    city: row.city?.trim() || null,
    stateOrRegion: row.stateOrRegion?.trim() || null,
    country: row.country?.trim() || 'US',
    consentStatus: row.consentStatus ?? 'unknown',
    leadType: row.leadType?.trim() || null,
    doNotDrop: row.doNotDrop === true || row.leadType?.trim() === 'interviewed',
    dedupeKey,
    status,
    token: null,
    crmRecordId: null,
    validationIssues,
    activatedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await writeOperational({
    id: leadId,
    mongoCollection: LEADS_COLLECTION,
    mongoDoc: lead as unknown as Record<string, unknown>,
    neo4j: {
      cypher:
        'MERGE (l:TmagVmBulkLead {leadId: $id}) ' +
        'SET l.ownerTmagId = $ownerTmagId, l.sponsorTmagId = $sponsorTmagId, l.status = $status, l.createdAt = datetime($createdAt) ' +
        'WITH l ' +
        'OPTIONAL MATCH (ba:TeamMagnificentMember {tmagId: $ownerTmagId}) ' +
        'FOREACH (_ IN CASE WHEN ba IS NULL THEN [] ELSE [1] END | MERGE (ba)-[:OWNS_VM_LEAD]->(l))',
      params: {
        ownerTmagId: lead.ownerTmagId,
        sponsorTmagId: lead.sponsorTmagId,
        status: lead.status,
        createdAt: lead.createdAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `VM lead ${lead.firstName ?? ''} ${lead.lastName ?? ''} ` +
        `from ${lead.city ?? 'unknown city'} imported for ${lead.ownerTmagId}.`,
      metadata: {
        kind: 'vm_lead_imported',
        leadId,
        ownerTmagId: lead.ownerTmagId,
        vmCampaignId: lead.vmCampaignId,
        status: lead.status,
        createdAt: lead.createdAt,
      },
    },
  });
  return { lead, created: true };
}

export async function processSuppressionCheck(job: VmQueueJob<LeadPayload>): Promise<void> {
  const lead = await findLead(job.payload.leadId);
  if (!lead) throw new Error('lead_not_found');

  if (lead.status === 'invalid') {
    await completeVmJob(job.jobId, `Lead ${lead.leadId} invalid; not queued.`);
    return;
  }

  const suppressed = await isLeadSuppressed(lead);
  const nextStatus: VmLeadStatus =
    suppressed || lead.consentStatus === 'do_not_contact' ? 'suppressed' : 'validated';

  await updateLeadStatus(lead.leadId, nextStatus, {
    suppressionCheckedAt: new Date().toISOString(),
  });
  if (nextStatus === 'validated') {
    await enqueueVmJob<LeadPayload>('token_generate', { leadId: lead.leadId });
  }
  await completeVmJob(job.jobId, `Suppression check completed for ${lead.leadId}: ${nextStatus}.`);
}

async function isLeadSuppressed(lead: VmBulkLeadRecord): Promise<boolean> {
  const clauses: Record<string, unknown>[] = [];
  if (lead.normalizedPhone) clauses.push({ normalizedPhone: lead.normalizedPhone });
  if (lead.normalizedEmail) clauses.push({ normalizedEmail: lead.normalizedEmail });
  if (clauses.length === 0) return true;
  const result = await persistenceCall<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: SUPPRESSION_COLLECTION,
    filter: { ownerTmagId: { $in: [lead.ownerTmagId, 'global'] }, $or: clauses },
    limit: 1,
  });
  return (result.count ?? result.documents?.length ?? 0) > 0;
}

export async function processTokenGeneration(job: VmQueueJob<LeadPayload>): Promise<void> {
  const lead = await findLead(job.payload.leadId);
  if (!lead) throw new Error('lead_not_found');
  if (lead.token) {
    await completeVmJob(job.jobId, `Lead ${lead.leadId} already had token.`);
    return;
  }
  if (lead.status !== 'validated') {
    await completeVmJob(job.jobId, `Lead ${lead.leadId} status ${lead.status}; token skipped.`);
    return;
  }

  const token = await mintUniqueToken();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await writeVmLeadTokenGraphCritical({
    token,
    leadId: lead.leadId,
    ownerTmagId: lead.ownerTmagId,
    sponsorTmagId: lead.sponsorTmagId,
    mongoDoc: {
      token,
      tokenKind: 'rvm',
      prospectId: null,
      leadId: lead.leadId,
      sponsorTmagId: lead.sponsorTmagId,
      ownerTmagId: lead.ownerTmagId,
      leadOwnerId: lead.leadOwnerId,
      vmCampaignId: lead.vmCampaignId,
      state: 'minted',
      createdAt: now,
      clickedAt: null,
      expiresAt,
    },
    tokenProps: {
      tokenKind: 'rvm',
      state: 'minted',
      createdAt: now,
      expiresAt,
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `RVM token minted for VM lead ${lead.leadId} owned by ${lead.ownerTmagId}.`,
      metadata: {
        kind: 'rvm_token_created',
        leadId: lead.leadId,
        token,
        ownerTmagId: lead.ownerTmagId,
        createdAt: now,
      },
    },
  });

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { leadId: lead.leadId },
    update: { $set: { token, status: 'token_created', updatedAt: now } },
  });
  await enqueueVmJob<LeadPayload>('crm_create', { leadId: lead.leadId });
  await completeVmJob(job.jobId, `Token created for VM lead ${lead.leadId}.`);
}

export async function processCrmCreation(job: VmQueueJob<LeadPayload>): Promise<void> {
  const lead = await findLead(job.payload.leadId);
  if (!lead) throw new Error('lead_not_found');
  if (!lead.token) {
    await completeVmJob(job.jobId, `Lead ${lead.leadId} has no token; CRM skipped.`);
    return;
  }
  if (lead.crmRecordId) {
    await completeVmJob(job.jobId, `Lead ${lead.leadId} already had CRM record.`);
    return;
  }

  const now = new Date().toISOString();
  const crmRecordId = `crm_${randomUUID()}`;
  await writeCrmOwnershipGraphCritical({
    id: crmRecordId,
    mongoDoc: {
      crmRecordId,
      prospectId: null,
      leadId: lead.leadId,
      ownerTmagId: lead.ownerTmagId,
      sponsorTmagId: lead.sponsorTmagId,
      source: 'rvm',
      sourceLabel: lead.sourceLabel,
      leadOwnerId: lead.leadOwnerId,
      vmCampaignId: lead.vmCampaignId,
      token: lead.token,
      status: 'inactive_pre_engagement',
      disposition: null,
      followUpDueAt: null,
      closedAt: null,
      closedReason: null,
      createdAt: now,
      updatedAt: now,
    },
    ownerTmagId: lead.ownerTmagId,
    target: { kind: 'vm_lead', leadId: lead.leadId },
    crmProps: {
      leadId: lead.leadId,
      sponsorTmagId: lead.sponsorTmagId,
      source: 'rvm',
      sourceLabel: lead.sourceLabel,
      leadOwnerId: lead.leadOwnerId,
      vmCampaignId: lead.vmCampaignId,
      token: lead.token,
      status: 'inactive_pre_engagement',
      createdAt: now,
      updatedAt: now,
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `CRM record ${crmRecordId} created for inactive VM lead ${lead.leadId}.`,
      metadata: {
        kind: 'vm_crm_created',
        leadId: lead.leadId,
        crmRecordId,
        ownerTmagId: lead.ownerTmagId,
        createdAt: now,
      },
    },
  });

  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { leadId: lead.leadId },
    update: { $set: { crmRecordId, status: 'crm_created', updatedAt: now } },
  });
  if (isDoNotDropLead(lead)) {
    await vmAudit({
      action: 'vm.lead.do_not_drop_delivery_blocked',
      entityId: lead.leadId,
      ownerTmagId: lead.ownerTmagId,
      summary: `VM lead ${lead.leadId} is doNotDrop; no delivery job enqueued.`,
      payload: { leadType: lead.leadType ?? null, doNotDrop: lead.doNotDrop === true },
    });
    await completeVmJob(
      job.jobId,
      `CRM record created for VM lead ${lead.leadId}; delivery blocked (doNotDrop).`,
    );
    return;
  }
  await enqueueVmJob<LeadPayload>('delivery', { leadId: lead.leadId, vmCampaignId: lead.vmCampaignId });
  await completeVmJob(job.jobId, `CRM record created for VM lead ${lead.leadId}.`);
}

export async function findLead(leadId: string): Promise<VmBulkLeadRecord | null> {
  const result = await persistenceCall<{ documents: VmBulkLeadRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { leadId },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

export async function updateLeadStatus(
  leadId: string,
  status: VmLeadStatus,
  extra: Record<string, unknown> = {},
): Promise<void> {
  const at = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter: { leadId },
    update: { $set: { status, updatedAt: at, ...extra } },
  });
  await vmAudit({
    action: 'vm.lead.status_changed',
    entityId: leadId,
    ownerTmagId: typeof extra.ownerTmagId === 'string' ? extra.ownerTmagId : null,
    summary: `VM lead ${leadId} changed to ${status}.`,
    payload: { status, ...extra },
  });
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

function digestKey(...parts: unknown[]): string {
  return createHash('sha256').update(JSON.stringify(stableValue(parts))).digest('hex');
}

function stringAt(value: unknown, path: string[]): string | null {
  let current = value;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' && current.trim() ? current.trim() : null;
}

export function deriveVmWebhookIdempotencyKey(input: {
  provider: VmProviderKey;
  payload: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const headerValue = (name: string): string | null => {
    const value = input.headers[name] ?? input.headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] ?? null : typeof value === 'string' && value.trim() ? value.trim() : null;
  };
  const externalId =
    headerValue('x-idempotency-key') ??
    headerValue('x-event-id') ??
    stringAt(input.payload, ['data', 'event', 'id']) ??
    stringAt(input.payload, ['data', 'id']) ??
    stringAt(input.payload, ['event_id']) ??
    stringAt(input.payload, ['eventId']) ??
    stringAt(input.payload, ['id']);
  return `vmhook_${digestKey(input.provider, externalId ? ['external', externalId] : ['payload', input.payload])}`;
}

async function findById<T>(collection: string, id: string): Promise<T | null> {
  const result = await persistenceCall<{ documents?: T[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection,
    filter: { _id: id },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}

function duplicateKeyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate key|e11000/i.test(message);
}

async function ensureWebhookJob(webhookEventId: string, provider: VmProviderKey, jobId: string): Promise<void> {
  if (await findById<VmQueueJob>(QUEUE_COLLECTION, jobId)) return;
  try {
    await enqueueVmJob('webhook_event', { webhookEventId, provider }, { jobId });
  } catch (error) {
    if (!duplicateKeyError(error)) throw error;
  }
}

export async function recordDeliveryEvent(input: Omit<VmDeliveryEventRecord, 'eventId' | 'createdAt'>): Promise<VmDeliveryEventRecord> {
  const createdAt = new Date().toISOString();
  const idempotencyKey = input.providerMessageId
    ? `vmdeliv_${digestKey(input.provider, input.providerMessageId, input.providerStatus, input.status, input.leadId)}`
    : null;
  if (idempotencyKey) {
    const existing = await findById<VmDeliveryEventRecord>(DELIVERY_EVENTS_COLLECTION, idempotencyKey);
    if (existing) return existing;
  }
  const event: VmDeliveryEventRecord = {
    ...input,
    eventId: idempotencyKey ?? `vmdeliv_${randomUUID()}`,
    createdAt,
  };
  try {
    await writeOperational({
    id: event.eventId,
    mongoCollection: DELIVERY_EVENTS_COLLECTION,
    mongoDoc: event as unknown as Record<string, unknown>,
    neo4j: {
      cypher:
        'MERGE (e:TmagVmDeliveryEvent {eventId: $id}) ' +
        'SET e.provider = $provider, e.status = $status, e.leadId = $leadId, e.createdAt = datetime($createdAt) ' +
        'WITH e MATCH (l:TmagVmBulkLead {leadId: $leadId}) MERGE (l)-[:HAS_VM_DELIVERY_EVENT]->(e)',
      params: {
        provider: event.provider,
        status: event.status,
        leadId: event.leadId,
        createdAt,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `VM delivery event ${event.status} for lead ${event.leadId} via ${event.provider}.`,
      metadata: {
        kind: 'vm_delivery_event',
        provider: event.provider,
        status: event.status,
        leadId: event.leadId,
        createdAt,
      },
    },
    });
  } catch (error) {
    if (!idempotencyKey || !duplicateKeyError(error)) throw error;
    const existing = await findById<VmDeliveryEventRecord>(DELIVERY_EVENTS_COLLECTION, idempotencyKey);
    if (existing) return existing;
    throw error;
  }
  return event;
}

export async function recordProviderWebhook(input: {
  provider: VmProviderKey;
  payload: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
}): Promise<{ webhookEventId: string; jobId: string; duplicate: boolean }> {
  const now = new Date().toISOString();
  const webhookEventId = deriveVmWebhookIdempotencyKey(input);
  const jobId = `vmjob_${digestKey('webhook_event', webhookEventId)}`;
  const existing = await findById<{ webhookEventId: string; jobId?: string }>(WEBHOOK_EVENTS_COLLECTION, webhookEventId);
  if (existing) {
    await ensureWebhookJob(webhookEventId, input.provider, existing.jobId ?? jobId);
    return { webhookEventId, jobId: existing.jobId ?? jobId, duplicate: true };
  }
  try {
    await writeOperational({
    id: webhookEventId,
    mongoCollection: WEBHOOK_EVENTS_COLLECTION,
    mongoDoc: {
      webhookEventId,
      provider: input.provider,
      payload: input.payload,
      headers: input.headers,
      status: 'received',
      idempotencyKey: webhookEventId,
      jobId,
      createdAt: now,
      processedAt: null,
    },
    neo4j: {
      cypher:
        'MERGE (w:TmagVmProviderWebhook {webhookEventId: $id}) ' +
        'SET w.provider = $provider, w.status = "received", w.createdAt = datetime($createdAt)',
      params: { provider: input.provider, createdAt: now },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document: `VM provider webhook received from ${input.provider} at ${now}.`,
      metadata: {
        kind: 'vm_provider_webhook',
        provider: input.provider,
        createdAt: now,
      },
    },
    });
  } catch (error) {
    if (!duplicateKeyError(error)) throw error;
    await ensureWebhookJob(webhookEventId, input.provider, jobId);
    return { webhookEventId, jobId, duplicate: true };
  }
  await ensureWebhookJob(webhookEventId, input.provider, jobId);
  return { webhookEventId, jobId, duplicate: false };
}

export async function processWebhookEvent(job: VmQueueJob<{ webhookEventId: string; provider: VmProviderKey }>): Promise<void> {
  const result = await persistenceCall<{ documents: Array<{ payload: Record<string, unknown>; provider: VmProviderKey }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: WEBHOOK_EVENTS_COLLECTION,
      filter: { webhookEventId: job.payload.webhookEventId },
      limit: 1,
    },
  );
  const event = result.documents?.[0];
  if (!event) throw new Error('webhook_event_not_found');

  if (event.provider === 'telnyx_call_control') {
    await processTelnyxCallControlWebhook(event.payload, job.attempts);
    const at = new Date().toISOString();
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: WEBHOOK_EVENTS_COLLECTION,
      filter: { webhookEventId: job.payload.webhookEventId },
      update: { $set: { status: 'processed', processedAt: at } },
    });
    await completeVmJob(job.jobId, `Telnyx webhook ${job.payload.webhookEventId} processed.`);
    return;
  }

  const leadId = typeof event.payload.leadId === 'string' ? event.payload.leadId : null;
  if (leadId) {
    const lead = await findLead(leadId);
    if (lead) {
      const providerStatus = typeof event.payload.status === 'string' ? event.payload.status : 'webhook_received';
      await recordDeliveryEvent({
        provider: event.provider,
        leadId,
        vmCampaignId: lead.vmCampaignId,
        ownerTmagId: lead.ownerTmagId,
        status: 'provider_webhook',
        providerMessageId: typeof event.payload.providerMessageId === 'string' ? event.payload.providerMessageId : null,
        providerStatus,
        dryRun: false,
        attempt: job.attempts,
        details: event.payload,
      });
    }
  }

  const at = new Date().toISOString();
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: WEBHOOK_EVENTS_COLLECTION,
    filter: { webhookEventId: job.payload.webhookEventId },
    update: { $set: { status: 'processed', processedAt: at } },
  });
  await completeVmJob(job.jobId, `Webhook ${job.payload.webhookEventId} processed.`);
}

export function decodeTelnyxClientState(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string' || !value.trim()) return {};
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    try {
      return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function amdResult(payload: Record<string, unknown>): string {
  const candidates = [
    payload.result,
    payload.status,
    payload.answering_machine_detection_result,
    payload.answering_machine_detection,
    payload.machine_detection_result,
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase();
  }
  return '';
}

function digitFromPayload(payload: Record<string, unknown>): string | null {
  const candidates = [payload.digits, payload.digit, payload.dtmf_digit, payload.received_digit];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) return value.trim()[0] ?? null;
  }
  return null;
}

async function processTelnyxCallControlWebhook(payload: Record<string, unknown>, attempt: number): Promise<void> {
  // Inbound calls (the prospect calling BACK after a voicemail drop) carry no
  // client_state — we did not originate them. They MUST be handled before the
  // leadId early-return below or every callback is silently dropped.
  if (isInboundTelnyxCallPayload(payload)) {
    await processInboundTelnyxCall(payload, attempt);
    return;
  }

  const clientState = decodeTelnyxClientState(payload.client_state);
  const leadId = asString(payload.leadId) ?? asString(clientState.leadId);
  if (!leadId) return;
  const resolvedLeadId = leadId;
  const lead = await findLead(leadId);
  if (!lead) return;
  const leadRecord = lead;

  const eventType = asString(payload.eventType) ?? 'call.webhook';
  const callControlId = asString(payload.call_control_id) ?? asString(payload.callControlId);
  const audioUrl = asString(payload.audioUrl) ?? asString(clientState.audioUrl);
  const tokenUrl =
    asString(payload.tokenUrl) ??
    asString(clientState.tokenUrl) ??
    (lead.token ? `${env.PROSPECT_BASE_URL.replace(/\/$/, '')}/rvm/${lead.token}` : null);

  async function record(status: string, details: Record<string, unknown> = {}): Promise<void> {
    await recordDeliveryEvent({
      provider: 'telnyx_call_control',
      leadId: resolvedLeadId,
      vmCampaignId: leadRecord.vmCampaignId,
      ownerTmagId: leadRecord.ownerTmagId,
      status,
      providerMessageId: callControlId,
      providerStatus: eventType,
      dryRun: false,
      attempt,
      details: { ...payload, clientState, ...details },
    });
  }

  if (eventType === 'call.machine.premium.greeting.ended') {
    if (callControlId && audioUrl) await playbackStart(callControlId, audioUrl);
    await record('machine_beep_playback_started');
    return;
  }

  if (eventType === 'call.playback.ended') {
    if (callControlId) await hangupCall(callControlId);
    await updateLeadStatus(leadId, 'voicemail_drop_delivered', { ownerTmagId: lead.ownerTmagId });
    await record('voicemail_drop_delivered');
    return;
  }

  if (eventType === 'call.dtmf.received' || eventType === 'call.gather.ended') {
    const digit = digitFromPayload(payload);
    if (digit === '1') {
      await record('interest_signal', { digit });
      if (lead.normalizedPhone && tokenUrl) {
        try {
          const sms = await sendSms({
            to: lead.normalizedPhone,
            text: `Here's your Team Magnificent link: ${tokenUrl}`,
          });
          await record('token_link_sms_enqueued', { smsMessageId: sms.messageId });
        } catch (err) {
          const transportError =
            err instanceof TelnyxConfigError || err instanceof TelnyxError
              ? err.message
              : err instanceof Error
                ? err.message
                : String(err);
          await record('token_link_sms_failed', { error: transportError });
        }
      }
      await updateLeadStatus(leadId, 'voicemail_drop_delivered', { ownerTmagId: lead.ownerTmagId, interestSignal: true });
    } else {
      await record('human_no_interest', { digit: digit ?? null });
    }
    if (callControlId) await hangupCall(callControlId);
    return;
  }

  const result = amdResult(payload);
  if (eventType === 'call.machine.premium.detection.ended' || result) {
    if (['human', 'human_residence', 'human_business', 'live'].includes(result)) {
      if (callControlId && audioUrl) await gatherSingleDigit({ callControlId, audioUrl, timeoutMs: 8000 });
      await record('human_answered_gather_started', { amdResult: result });
      return;
    }
    if (['machine', 'machine_start', 'machine_end_beep', 'voicemail', 'answering_machine'].includes(result)) {
      if (result === 'machine_end_beep' && callControlId && audioUrl) {
        await playbackStart(callControlId, audioUrl);
        await record('machine_beep_playback_started', { amdResult: result });
      } else {
        await record('machine_detected_waiting_for_beep', { amdResult: result });
      }
      return;
    }
    if (['not_sure', 'silence', 'fax'].includes(result)) {
      if (callControlId) await hangupCall(callControlId);
      await updateLeadStatus(leadId, 'voicemail_drop_failed', { ownerTmagId: lead.ownerTmagId, reason: result });
      await record('undeliverable', { amdResult: result });
      return;
    }
    if (['no_answer', 'busy'].includes(result)) {
      await updateLeadStatus(leadId, 'queued', { ownerTmagId: lead.ownerTmagId, retryReason: result });
      await enqueueVmJob('delivery', { leadId, provider: 'telnyx_call_control' }, { availableAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
      await record('provider_retry_scheduled', { amdResult: result });
      return;
    }
  }

  if (eventType === 'call.hangup') {
    const cause = asString(payload.hangup_cause)?.toLowerCase() ?? '';
    if (cause.includes('busy') || cause.includes('no_answer')) {
      await updateLeadStatus(leadId, 'queued', { ownerTmagId: lead.ownerTmagId, retryReason: cause });
      await enqueueVmJob('delivery', { leadId, provider: 'telnyx_call_control' }, { availableAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
      await record('provider_retry_scheduled', { hangupCause: cause });
      return;
    }
  }

  await record('provider_webhook');
}

export async function listDeliveryRowsForManualExport(
  campaignId: string,
  ownerTmagId?: string,
): Promise<VmBulkLeadRecord[]> {
  const filter: Record<string, unknown> = {
    vmCampaignId: campaignId,
    status: { $in: ['crm_created', 'queued', 'manual_exported', 'delivery_dry_run'] },
    normalizedPhone: { $ne: null },
    // Manual export is a delivery path too — doNotDrop leads never appear.
    doNotDrop: { $ne: true },
    leadType: { $ne: 'interviewed' },
  };
  if (ownerTmagId) filter.ownerTmagId = ownerTmagId;
  const result = await persistenceCall<{ documents: VmBulkLeadRecord[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: LEADS_COLLECTION,
    filter,
    sort: { createdAt: 1 },
    limit: 10_000,
  });
  return result.documents ?? [];
}
