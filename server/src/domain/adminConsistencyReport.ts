import type {
  McsAdminConsistencyHalfWriteRow,
  McsAdminConsistencyOrphanCategory,
  McsAdminConsistencyOrphanRecord,
  McsAdminConsistencyOverall,
  McsAdminConsistencyProjectionRow,
  McsAdminConsistencyReconciliationIssue,
  McsAdminConsistencyReportResponse,
} from '@momentum/shared';
import {
  runCrossStoreReconciliation,
  type CrossStoreReconciliationReport,
  type ReconciliationRowResult,
} from './crossStoreReconciliation.js';
import { persistenceCall } from '../services/persistence/dispatch.js';

const MONGO_DB = 'momentum';
const OUTBOX_COLLECTION = 'tmag_projection_outbox';
const DEFAULT_LIMIT_PER_SPEC = 25;
const DEFAULT_ORPHAN_LIMIT = 25;
const DEFAULT_STALE_PROJECTION_MINUTES = 15;

const GRAPH_CRITICAL_SPEC_KEYS = new Set([
  'members',
  'prospects',
  'invite_tokens',
  'pool_placements',
]);

type Persistence = typeof persistenceCall;

interface OutboxDoc {
  outboxId?: string;
  tier?: string;
  target?: string;
  status?: string;
  entityId?: string;
  mongoCollection?: string;
  attempts?: number;
  maxAttempts?: number;
  nextAttemptAt?: string | null;
  updatedAt?: string | null;
  createdAt?: string | null;
  lastError?: string | null;
}

interface OrphanSpec {
  key: string;
  label: string;
  query: string;
  idField: string;
}

export interface AdminConsistencyReportOptions {
  limitPerSpec?: number;
  orphanLimit?: number;
  staleProjectionMinutes?: number;
  now?: () => Date;
  persistence?: Persistence;
}

const ORPHAN_SPECS: readonly OrphanSpec[] = [
  {
    key: 'prospects_without_inviter',
    label: 'Prospects without inviter edge',
    query:
      'MATCH (p:TmagProspect) ' +
      'WHERE NOT EXISTS { MATCH (:TeamMagnificentMember)-[:INVITED]->(p) } ' +
      'RETURN p.prospectId AS id LIMIT $limit',
    idField: 'id',
  },
  {
    key: 'invite_tokens_without_target',
    label: 'Invite tokens without prospect or VM-lead target',
    query:
      'MATCH (t:TmagInviteToken) ' +
      'WHERE NOT EXISTS { MATCH (t)-[:FOR_PROSPECT]->(:TmagProspect) } ' +
      'AND NOT EXISTS { MATCH (t)-[:FOR_VM_LEAD]->(:TmagVmBulkLead) } ' +
      'RETURN t.token AS id LIMIT $limit',
    idField: 'id',
  },
  {
    key: 'steve_discoveries_without_ba',
    label: 'Steve discoveries without BA owner',
    query:
      'MATCH (d:TmagSteveDiscovery) ' +
      'WHERE NOT EXISTS { MATCH (:TeamMagnificentMember)-[:HAD_STEVE_DISCOVERY]->(d) } ' +
      'RETURN d.discoveryId AS id LIMIT $limit',
    idField: 'id',
  },
  {
    key: 'crm_records_without_owner',
    label: 'CRM records without BA owner',
    query:
      'MATCH (c:TmagProspectCrmRecord) ' +
      'WHERE NOT EXISTS { MATCH (:TeamMagnificentMember)-[:OWNS_CRM_RECORD]->(c) } ' +
      'RETURN c.crmRecordId AS id LIMIT $limit',
    idField: 'id',
  },
] as const;

function ageMinutes(nowMs: number, at: string | null | undefined): number {
  if (!at) return 0;
  const then = Date.parse(at);
  if (!Number.isFinite(then)) return 0;
  return Math.max(0, Math.floor((nowMs - then) / 60_000));
}

async function readProjectionOutbox(persistence: Persistence): Promise<OutboxDoc[]> {
  const result = await persistence<{ documents?: OutboxDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: OUTBOX_COLLECTION,
    filter: { status: { $in: ['pending', 'failed'] } },
    sort: { updatedAt: -1 },
    limit: 250,
  });
  return result.documents ?? [];
}

function projectionRows(
  outbox: OutboxDoc[],
  now: Date,
  staleMinutes: number,
): McsAdminConsistencyProjectionRow[] {
  const nowMs = now.getTime();
  const cutoffMs = nowMs - staleMinutes * 60_000;
  return outbox
    .map((row) => {
      const updatedAt = row.updatedAt ?? row.createdAt ?? null;
      const nextAttemptAt = row.nextAttemptAt ?? null;
      const nextAttemptMs = nextAttemptAt ? Date.parse(nextAttemptAt) : NaN;
      const updatedMs = updatedAt ? Date.parse(updatedAt) : NaN;
      const status = row.status ?? 'unknown';
      const stale =
        status === 'failed' ||
        (status === 'pending' &&
          Number.isFinite(updatedMs) &&
          updatedMs <= cutoffMs &&
          (!Number.isFinite(nextAttemptMs) || nextAttemptMs <= nowMs));

      return {
        outboxId: row.outboxId ?? 'unknown',
        tier: row.tier ?? 'unknown',
        target: row.target ?? 'unknown',
        status,
        entityId: row.entityId ?? 'unknown',
        mongoCollection: row.mongoCollection ?? 'unknown',
        attempts: typeof row.attempts === 'number' ? row.attempts : 0,
        maxAttempts: typeof row.maxAttempts === 'number' ? row.maxAttempts : 0,
        nextAttemptAt,
        updatedAt,
        ageMinutes: ageMinutes(nowMs, updatedAt),
        stale,
        lastError: row.lastError ?? null,
      };
    })
    .filter((row) => row.stale || row.status === 'failed')
    .slice(0, 100);
}

function halfWriteRows(report: CrossStoreReconciliationReport): McsAdminConsistencyHalfWriteRow[] {
  const rows: McsAdminConsistencyHalfWriteRow[] = [];
  for (const spec of report.specs) {
    if (!GRAPH_CRITICAL_SPEC_KEYS.has(spec.key)) continue;
    for (const row of spec.rows) {
      if (row.neo4j.status !== 'missing' && row.neo4j.status !== 'error') continue;
      rows.push({
        specKey: spec.key,
        id: row.id,
        mongoCollection: row.mongoCollection,
        neo4jStatus: row.neo4j.status,
        detail: row.neo4j.detail,
      });
    }
  }
  return rows;
}

function reconciliationIssues(
  report: CrossStoreReconciliationReport,
): McsAdminConsistencyReconciliationIssue[] {
  return report.specs
    .flatMap((spec) =>
      spec.rows
        .filter((row) => row.issues.length > 0)
        .map((row: ReconciliationRowResult) => ({
          specKey: spec.key,
          id: row.id,
          mongoCollection: row.mongoCollection,
          issues: row.issues,
          neo4jStatus: row.neo4j.status,
          chromaStatus: row.chroma.status,
          detail: [row.neo4j.detail, row.chroma.detail].join(' | '),
        })),
    )
    .slice(0, 100);
}

async function orphanCategory(
  spec: OrphanSpec,
  limit: number,
  persistence: Persistence,
): Promise<McsAdminConsistencyOrphanCategory> {
  try {
    const result = await persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: spec.query,
      params: { limit },
    });
    const records: McsAdminConsistencyOrphanRecord[] = (result.records ?? [])
      .map((record) => record[spec.idField])
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      .map((id) => ({ id, detail: spec.label }));
    return { key: spec.key, label: spec.label, records, error: null };
  } catch (err) {
    return {
      key: spec.key,
      label: spec.label,
      records: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function overall(args: {
  halfWrites: number;
  failedProjections: number;
  orphanRecords: number;
  staleProjections: number;
  warnings: number;
}): McsAdminConsistencyOverall {
  if (args.halfWrites > 0 || args.failedProjections > 0 || args.orphanRecords > 0) return 'red';
  if (args.staleProjections > 0 || args.warnings > 0) return 'yellow';
  return 'green';
}

export async function buildAdminConsistencyReport(
  options: AdminConsistencyReportOptions = {},
): Promise<McsAdminConsistencyReportResponse> {
  const now = options.now?.() ?? new Date();
  const persistence = options.persistence ?? persistenceCall;
  const limitPerSpec = Math.max(1, Math.floor(options.limitPerSpec ?? DEFAULT_LIMIT_PER_SPEC));
  const orphanLimit = Math.max(1, Math.floor(options.orphanLimit ?? DEFAULT_ORPHAN_LIMIT));
  const staleProjectionMinutes = Math.max(
    1,
    Math.floor(options.staleProjectionMinutes ?? DEFAULT_STALE_PROJECTION_MINUTES),
  );

  const warnings: string[] = [];
  const [reconciliation, outboxResult, orphanCategories] = await Promise.all([
    runCrossStoreReconciliation({
      limitPerSpec,
      persistence,
      now: () => now,
    }),
    readProjectionOutbox(persistence).catch((err) => {
      warnings.push(
        `Projection outbox unavailable: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [] as OutboxDoc[];
    }),
    Promise.all(ORPHAN_SPECS.map((spec) => orphanCategory(spec, orphanLimit, persistence))),
  ]);

  for (const spec of reconciliation.specs) warnings.push(...spec.warnings);
  for (const category of orphanCategories) {
    if (category.error) warnings.push(`${category.label}: ${category.error}`);
  }

  const halfWrites = halfWriteRows(reconciliation);
  const staleProjections = projectionRows(outboxResult, now, staleProjectionMinutes);
  const failedProjections = staleProjections.filter((row) => row.status === 'failed').length;
  const orphanRecords = orphanCategories.reduce((sum, category) => sum + category.records.length, 0);
  const issues = reconciliationIssues(reconciliation);

  const totals = {
    halfWrites: halfWrites.length,
    staleProjections: staleProjections.length,
    failedProjections,
    orphanRecords,
    reconciliationIssues: issues.length,
    warnings: warnings.length,
  };

  return {
    ok: true,
    generatedAt: now.toISOString(),
    overall: overall({
      halfWrites: totals.halfWrites,
      failedProjections: totals.failedProjections,
      orphanRecords: totals.orphanRecords,
      staleProjections: totals.staleProjections,
      warnings: totals.warnings,
    }),
    totals,
    staleProjectionMinutes,
    reconciliation: {
      limitPerSpec: reconciliation.limitPerSpec,
      specs: reconciliation.specs.map((spec) => ({
        key: spec.key,
        label: spec.label,
        scanned: spec.scanned,
        issueCount: spec.issueCount,
      })),
      issues,
    },
    halfWrites,
    staleProjections,
    orphanCategories,
    warnings,
  };
}
