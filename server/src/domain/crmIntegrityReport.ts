import type {
  McsAdminCrmIntegrityFinding,
  McsAdminCrmIntegrityReportResponse,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { runCrmCleanup } from './crmCleanup.js';

const MONGO_DB = 'momentum';
const CRM_COLLECTION = 'tmag_prospect_crm_records';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const DEFAULT_LIMIT = 500;
const DEFAULT_STUCK_DAYS = 30;

type Persistence = typeof persistenceCall;
type Row = Record<string, unknown>;

export interface CrmIntegrityReportOptions {
  limit?: number;
  stuckDays?: number;
  now?: () => Date;
  persistence?: Persistence;
}

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function pair(row: Row): string | null {
  const prospectId = text(row, 'prospectId');
  const sponsorTmagId = text(row, 'sponsorTmagId');
  return prospectId && sponsorTmagId ? `${prospectId}\u0000${sponsorTmagId}` : null;
}

function finding(
  category: McsAdminCrmIntegrityFinding['category'],
  code: string,
  row: Row,
  detail: string,
  evidence: Row = {},
): McsAdminCrmIntegrityFinding {
  return {
    category,
    code,
    crmRecordId: text(row, 'crmRecordId'),
    prospectId: text(row, 'prospectId'),
    sponsorTmagId: text(row, 'sponsorTmagId'),
    detail,
    evidence,
    repairPolicy: 'report_only',
  };
}

function group(rows: Row[], keyOf: (row: Row) => string | null): Map<string, Row[]> {
  const result = new Map<string, Row[]>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const values = result.get(key) ?? [];
    values.push(row);
    result.set(key, values);
  }
  return result;
}

/**
 * Read-only CRM integrity scan. Elapsed time can surface a stuck candidate but
 * can never close a CRM record or clear a reminder. Every finding is report-only.
 */
export async function buildCrmIntegrityReport(
  options: CrmIntegrityReportOptions = {},
): Promise<McsAdminCrmIntegrityReportResponse> {
  const persistence = options.persistence ?? persistenceCall;
  const limit = Math.min(1000, Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT)));
  const stuckDays = Math.min(365, Math.max(1, Math.floor(options.stuckDays ?? DEFAULT_STUCK_DAYS)));
  const now = options.now?.() ?? new Date();
  const cutoff = now.getTime() - stuckDays * 86_400_000;

  const [crmResult, followUpResult, prospectResult, cleanupPreview] = await Promise.all([
    persistence<{ documents?: Row[] }>('mongodb', 'query', {
      database: MONGO_DB, collection: CRM_COLLECTION, filter: {}, sort: { updatedAt: 1 }, limit,
    }),
    persistence<{ documents?: Row[] }>('mongodb', 'query', {
      database: MONGO_DB, collection: FOLLOWUPS_COLLECTION, filter: {}, sort: { updatedAt: 1 }, limit,
    }),
    persistence<{ documents?: Row[] }>('mongodb', 'query', {
      database: MONGO_DB, collection: PROSPECTS_COLLECTION, filter: {}, sort: { updatedAt: 1 }, limit,
    }),
    runCrmCleanup({ dryRun: true, limit, now: () => now, persistence }),
  ]);

  const crmRows = crmResult.documents ?? [];
  const followUps = followUpResult.documents ?? [];
  const prospects = prospectResult.documents ?? [];
  const findings: McsAdminCrmIntegrityFinding[] = [];
  const prospectById = new Map(prospects.flatMap((row) => {
    const id = text(row, 'prospectId');
    return id ? [[id, row] as const] : [];
  }));
  const crmByPair = group(crmRows, pair);
  const activeFollowUps = followUps.filter((row) => row.clearedAt == null);
  const activeByPair = group(activeFollowUps, pair);

  for (const row of [...crmRows, ...followUps]) {
    if (!text(row, 'prospectId') || !text(row, 'sponsorTmagId')) {
      findings.push(finding('ambiguous', 'missing_identity', row,
        'Record lacks a prospect or sponsor identifier, so ownership cannot be proven.'));
    }
  }

  for (const [prospectId, rows] of group(crmRows, (row) => text(row, 'prospectId'))) {
    if (rows.length > 1) findings.push(finding('duplicate', 'duplicate_crm_for_prospect', rows[0]!,
      `Prospect has ${rows.length} CRM records.`, { prospectId, recordIds: rows.map((row) => text(row, 'crmRecordId')) }));
  }
  for (const [key, rows] of activeByPair) {
    if (rows.length > 1) findings.push(finding('duplicate', 'duplicate_active_followup', rows[0]!,
      `Prospect/sponsor pair has ${rows.length} active follow-ups.`, { pair: key, followUpIds: rows.map((row) => text(row, 'followUpId')) }));
  }

  for (const crm of crmRows) {
    const prospectId = text(crm, 'prospectId');
    const prospect = prospectId ? prospectById.get(prospectId) : undefined;
    if (prospectId && !prospect) findings.push(finding('orphan', 'crm_without_prospect', crm,
      'CRM record references no current prospect record.'));
    const owner = text(crm, 'ownerTmagId');
    const sponsor = text(crm, 'sponsorTmagId');
    if (owner && sponsor && owner !== sponsor) findings.push(finding('inconsistent', 'crm_owner_sponsor_mismatch', crm,
      'CRM owner and immutable sponsor do not match.', { ownerTmagId: owner, sponsorTmagId: sponsor }));
    const status = text(crm, 'status');
    const prospectState = prospect ? text(prospect, 'state') : null;
    if (prospectState && ['enrolled', 'expired'].includes(prospectState) && status !== 'closed') {
      findings.push(finding('inconsistent', 'terminal_prospect_open_crm', crm,
        'Terminal prospect retains a non-closed CRM record.', { prospectState, crmStatus: status }));
    }
    const updatedAt = text(crm, 'updatedAt') ?? text(crm, 'createdAt');
    const updatedMs = updatedAt ? Date.parse(updatedAt) : NaN;
    if (status !== 'closed' && Number.isFinite(updatedMs) && updatedMs <= cutoff) {
      findings.push(finding('stuck', 'open_crm_without_recent_change', crm,
        `Open CRM record has not changed for at least ${stuckDays} days; elapsed time is not repair authority.`,
        { status, updatedAt, stuckDays }));
    }
    const active = pair(crm) ? activeByPair.get(pair(crm)!) ?? [] : [];
    const projectedDueAt = text(crm, 'followUpDueAt');
    const activeDueAt = active.length === 1 ? text(active[0]!, 'dueAt') : null;
    if (status === 'closed' && active.length > 0) findings.push(finding('inconsistent', 'closed_crm_active_followup', crm,
      'Closed CRM record retains an active follow-up.', { activeFollowUps: active.length }));
    if (active.length <= 1 && projectedDueAt !== activeDueAt) findings.push(finding('inconsistent', 'followup_projection_mismatch', crm,
      'CRM follow-up projection does not match the active reminder.', { followUpDueAt: projectedDueAt, activeDueAt }));
  }

  for (const followUp of activeFollowUps) {
    const key = pair(followUp);
    const prospectId = text(followUp, 'prospectId');
    if (prospectId && !prospectById.has(prospectId)) findings.push(finding('orphan', 'followup_without_prospect', followUp,
      'Active follow-up references no current prospect record.'));
    if (key && !crmByPair.has(key)) findings.push(finding('orphan', 'followup_without_crm', followUp,
      'Active follow-up has no CRM record for the same prospect/sponsor pair.'));
  }

  const totals = { stuck: 0, duplicate: 0, orphan: 0, inconsistent: 0, ambiguous: 0 };
  for (const item of findings) totals[item.category] += 1;
  return {
    ok: true,
    generatedAt: now.toISOString(),
    policy: 'report_only',
    stuckDays,
    scanned: { crmRecords: crmRows.length, followUps: followUps.length, prospects: prospects.length },
    totals: { ...totals, findings: findings.length, cleanupCandidates: cleanupPreview.planned },
    cleanupPreview: {
      dryRun: true,
      planned: cleanupPreview.planned,
      actions: cleanupPreview.actions.map(({ kind, prospectId, sponsorTmagId, reason }) => ({ kind, prospectId, sponsorTmagId, reason })),
      errors: cleanupPreview.errors.map(({ prospectId, kind, message }) => ({ prospectId, kind, message })),
    },
    findings,
  };
}
