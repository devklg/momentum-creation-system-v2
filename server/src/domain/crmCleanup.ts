import { randomUUID } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { appendAuditEntry } from './auditLog.js';

const MONGO_DB = 'momentum';
const CRM_COLLECTION = 'tmag_prospect_crm_records';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

type Persistence = typeof persistenceCall;

interface CrmCleanupRecord {
  crmRecordId: string;
  prospectId: string;
  ownerTmagId: string;
  sponsorTmagId: string;
  status: string;
  followUpDueAt: string | null;
}

interface FollowUpCleanupRecord {
  followUpId?: string;
  prospectId: string;
  sponsorTmagId: string;
  dueAt: string;
  createdAt: string;
  clearedAt: string | null;
}

interface ProspectCleanupRecord {
  prospectId: string;
  state?: string;
  deleted?: boolean;
}

export type CrmCleanupActionKind = 'clear_terminal_followup' | 'sync_crm_followup_due_at';

export interface CrmCleanupAction {
  actionId: string;
  kind: CrmCleanupActionKind;
  prospectId: string;
  sponsorTmagId: string;
  reason: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  applied: boolean;
}

export interface CrmCleanupError {
  prospectId: string;
  kind: CrmCleanupActionKind | 'scan';
  message: string;
}

export interface CrmCleanupResult {
  dryRun: boolean;
  scannedCrmRecords: number;
  scannedFollowUps: number;
  planned: number;
  applied: number;
  actions: CrmCleanupAction[];
  errors: CrmCleanupError[];
}

export interface CrmCleanupOptions {
  /** Cleanup is intentionally preview-only unless the caller explicitly applies it. */
  dryRun?: boolean;
  limit?: number;
  nowMs?: number;
  now?: () => Date;
  persistence?: Persistence;
}

function boundedLimit(value: number | undefined): number {
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value ?? DEFAULT_LIMIT)));
}

function terminalReason(
  crm: CrmCleanupRecord | undefined,
  prospect: ProspectCleanupRecord | undefined,
): string | null {
  if (crm?.status === 'closed') return 'crm_closed';
  if (!prospect) return null;
  if (prospect.deleted === true) return 'prospect_deleted';
  if (prospect.state === 'enrolled') return 'prospect_enrolled';
  if (prospect.state === 'expired') return 'prospect_expired';
  return null;
}

function sameNullable(a: string | null | undefined, b: string | null): boolean {
  return (a ?? null) === b;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function verifiedConditionalUpdate(args: {
  persistence: Persistence;
  collection: string;
  filter: Record<string, unknown>;
  update: Record<string, unknown>;
  verifyFilter: Record<string, unknown>;
}): Promise<boolean> {
  await args.persistence('mongodb', 'update', {
    database: MONGO_DB,
    collection: args.collection,
    filter: args.filter,
    update: args.update,
  });
  const verification = await args.persistence<{ documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: args.collection,
    filter: args.verifyFilter,
    limit: 1,
  });
  return (verification.documents?.length ?? 0) === 1;
}

/**
 * Bounded CRM cleanup. It repairs only mechanically provable follow-up state:
 * terminal prospects cannot retain active reminders, and the CRM's denormalized
 * due date mirrors the active reminder. Age is never a cleanup condition.
 */
export async function runCrmCleanup(options: CrmCleanupOptions = {}): Promise<CrmCleanupResult> {
  const dryRun = options.dryRun ?? true;
  const limit = boundedLimit(options.limit);
  const now = options.now?.() ?? new Date(options.nowMs ?? Date.now());
  const persistence = options.persistence ?? persistenceCall;
  const actions: CrmCleanupAction[] = [];
  const errors: CrmCleanupError[] = [];

  let crmRecords: CrmCleanupRecord[] = [];
  let followUps: FollowUpCleanupRecord[] = [];
  try {
    const [crmResult, followUpResult] = await Promise.all([
      persistence<{ documents?: CrmCleanupRecord[] }>('mongodb', 'query', {
        database: MONGO_DB,
        collection: CRM_COLLECTION,
        filter: {},
        sort: { updatedAt: 1 },
        limit,
      }),
      persistence<{ documents?: FollowUpCleanupRecord[] }>('mongodb', 'query', {
        database: MONGO_DB,
        collection: FOLLOWUPS_COLLECTION,
        filter: { clearedAt: null },
        sort: { dueAt: 1 },
        limit,
      }),
    ]);
    crmRecords = crmResult.documents ?? [];
    followUps = followUpResult.documents ?? [];
  } catch (err) {
    errors.push({ prospectId: '*', kind: 'scan', message: messageOf(err) });
    return {
      dryRun,
      scannedCrmRecords: 0,
      scannedFollowUps: 0,
      planned: 0,
      applied: 0,
      actions,
      errors,
    };
  }

  const prospectIds = [...new Set([
    ...crmRecords.map((record) => record.prospectId),
    ...followUps.map((record) => record.prospectId),
  ])];
  const prospectResult = prospectIds.length === 0
    ? { documents: [] as ProspectCleanupRecord[] }
    : await persistence<{ documents?: ProspectCleanupRecord[] }>('mongodb', 'query', {
        database: MONGO_DB,
        collection: PROSPECTS_COLLECTION,
        filter: { prospectId: { $in: prospectIds } },
        limit: Math.min(MAX_LIMIT * 2, prospectIds.length),
      }).catch((err) => {
        errors.push({ prospectId: '*', kind: 'scan', message: messageOf(err) });
        return { documents: [] as ProspectCleanupRecord[] };
      });
  if (errors.some((error) => error.kind === 'scan')) {
    return {
      dryRun,
      scannedCrmRecords: crmRecords.length,
      scannedFollowUps: followUps.length,
      planned: 0,
      applied: 0,
      actions,
      errors,
    };
  }

  const prospects = new Map((prospectResult.documents ?? []).map((row) => [row.prospectId, row]));
  const crmByPair = new Map(crmRecords.map((row) => [`${row.prospectId}\u0000${row.sponsorTmagId}`, row]));
  const activeByPair = new Map(followUps.map((row) => [`${row.prospectId}\u0000${row.sponsorTmagId}`, row]));
  const clearedPairs = new Set<string>();

  for (const followUp of followUps) {
    const key = `${followUp.prospectId}\u0000${followUp.sponsorTmagId}`;
    const crm = crmByPair.get(key);
    const reason = terminalReason(crm, prospects.get(followUp.prospectId));
    if (!reason) continue;
    const clearedAt = now.toISOString();
    const action: CrmCleanupAction = {
      actionId: `cleanup_${randomUUID()}`,
      kind: 'clear_terminal_followup',
      prospectId: followUp.prospectId,
      sponsorTmagId: followUp.sponsorTmagId,
      reason,
      before: { dueAt: followUp.dueAt, clearedAt: null },
      after: { dueAt: followUp.dueAt, clearedAt },
      applied: false,
    };
    actions.push(action);
    clearedPairs.add(key);
    if (dryRun) continue;
    try {
      const identity = followUp.followUpId
        ? { followUpId: followUp.followUpId }
        : { prospectId: followUp.prospectId, sponsorTmagId: followUp.sponsorTmagId };
      const verified = await verifiedConditionalUpdate({
        persistence,
        collection: FOLLOWUPS_COLLECTION,
        filter: { ...identity, dueAt: followUp.dueAt, clearedAt: null },
        update: { $set: { clearedAt, updatedAt: clearedAt } },
        verifyFilter: { ...identity, clearedAt },
      });
      if (!verified) throw new Error('conditional follow-up clear was not verified');
      await persistence('neo4j', 'cypher', {
        query:
          'MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})-[r:HAS_FOLLOWUP]->' +
          '(p:TmagProspect {prospectId: $prospectId}) DELETE r',
        params: {
          sponsorTmagId: followUp.sponsorTmagId,
          prospectId: followUp.prospectId,
        },
      });
      await appendAuditEntry({
        actor: { kind: 'system', label: 'crm_cleanup' },
        action: 'system.crm.follow_up.cleared_terminal',
        entity: { kind: 'prospect', id: followUp.prospectId, displayLabel: followUp.prospectId },
        severity: 'info',
        before: action.before,
        after: action.after,
        reason,
      });
      action.applied = true;
    } catch (err) {
      errors.push({ prospectId: followUp.prospectId, kind: action.kind, message: messageOf(err) });
    }
  }

  for (const crm of crmRecords) {
    const key = `${crm.prospectId}\u0000${crm.sponsorTmagId}`;
    const active = activeByPair.get(key);
    const desiredDueAt = clearedPairs.has(key) ? null : (active?.dueAt ?? null);
    if (sameNullable(crm.followUpDueAt, desiredDueAt)) continue;
    const action: CrmCleanupAction = {
      actionId: `cleanup_${randomUUID()}`,
      kind: 'sync_crm_followup_due_at',
      prospectId: crm.prospectId,
      sponsorTmagId: crm.sponsorTmagId,
      reason: desiredDueAt === null ? 'no_active_followup' : 'active_followup_due_at',
      before: { followUpDueAt: crm.followUpDueAt ?? null },
      after: { followUpDueAt: desiredDueAt },
      applied: false,
    };
    actions.push(action);
    if (dryRun) continue;
    try {
      const changedAt = now.toISOString();
      const verified = await verifiedConditionalUpdate({
        persistence,
        collection: CRM_COLLECTION,
        filter: { crmRecordId: crm.crmRecordId, followUpDueAt: crm.followUpDueAt ?? null },
        update: { $set: { followUpDueAt: desiredDueAt, updatedAt: changedAt } },
        verifyFilter: { crmRecordId: crm.crmRecordId, followUpDueAt: desiredDueAt },
      });
      if (!verified) throw new Error('conditional CRM follow-up reconciliation was not verified');
      await appendAuditEntry({
        actor: { kind: 'system', label: 'crm_cleanup' },
        action: 'system.crm.follow_up_due_at.reconciled',
        entity: { kind: 'prospect', id: crm.prospectId, displayLabel: crm.prospectId },
        severity: 'info',
        before: action.before,
        after: action.after,
        reason: action.reason,
      });
      action.applied = true;
    } catch (err) {
      errors.push({ prospectId: crm.prospectId, kind: action.kind, message: messageOf(err) });
    }
  }

  return {
    dryRun,
    scannedCrmRecords: crmRecords.length,
    scannedFollowUps: followUps.length,
    planned: actions.length,
    applied: actions.filter((action) => action.applied).length,
    actions,
    errors,
  };
}
