import { persistenceCall } from '../services/persistence/dispatch.js';

const MONGO_DB = 'momentum';
const DEFAULT_LIMIT_PER_SPEC = 25;

export type ReconciliationLegStatus = 'present' | 'missing' | 'error' | 'not_applicable';

export interface ReconciliationLegResult {
  status: ReconciliationLegStatus;
  detail: string;
}

export interface ReconciliationRowResult {
  specKey: string;
  id: string;
  mongoCollection: string;
  neo4j: ReconciliationLegResult;
  chroma: ReconciliationLegResult;
  issues: string[];
}

export interface ReconciliationSpecSummary {
  key: string;
  label: string;
  mongoCollection: string;
  scanned: number;
  issueCount: number;
  rows: ReconciliationRowResult[];
  warnings: string[];
}

export interface CrossStoreReconciliationReport {
  ok: boolean;
  generatedAt: string;
  limitPerSpec: number;
  totals: {
    specs: number;
    scanned: number;
    issues: number;
    warnings: number;
  };
  specs: ReconciliationSpecSummary[];
}

type Persistence = typeof persistenceCall;
type MongoDoc = Record<string, unknown>;

interface Neo4jCheck {
  query: string;
  params?: Record<string, unknown>;
}

interface ChromaCheck {
  collection: string;
  query: string;
  where: Record<string, unknown>;
  metadataIdField: string;
}

interface ReconciliationSpec {
  key: string;
  label: string;
  mongoCollection: string;
  idField: string;
  sort?: Record<string, 1 | -1>;
  neo4j?: (doc: MongoDoc, id: string) => Neo4jCheck | null;
  chroma?: (doc: MongoDoc, id: string) => ChromaCheck | null;
}

export interface CrossStoreReconciliationOptions {
  limitPerSpec?: number;
  specKeys?: string[];
  now?: () => Date;
  persistence?: Persistence;
}

function stringField(doc: MongoDoc, field: string): string | null {
  const value = doc[field];
  return typeof value === 'string' && value.trim() ? value : null;
}

function prospectInviteGraph(doc: MongoDoc, _id: string): Neo4jCheck | null {
  const sponsorTmagId = stringField(doc, 'sponsorTmagId');
  const token = stringField(doc, 'token');
  if (!sponsorTmagId || !token) return null;
  return {
    query:
      'MATCH (b:TeamMagnificentMember {tmagId: $sponsorTmagId})-' +
      '[:INVITED {token: $token}]->(p:TmagProspect {prospectId: $id}) ' +
      'RETURN count(p) AS n',
    params: { sponsorTmagId, token },
  };
}

function inviteTokenGraph(doc: MongoDoc, _id: string): Neo4jCheck | null {
  const prospectId = stringField(doc, 'prospectId');
  const leadId = stringField(doc, 'leadId');
  if (leadId) {
    return {
      query:
        'MATCH (t:TmagInviteToken {token: $id})-[:FOR_VM_LEAD]->' +
        '(l:TmagVmBulkLead {leadId: $leadId}) RETURN count(t) AS n',
      params: { leadId },
    };
  }
  if (prospectId) {
    return {
      query:
        'MATCH (t:TmagInviteToken {token: $id})-[:FOR_PROSPECT]->' +
        '(p:TmagProspect {prospectId: $prospectId}) RETURN count(t) AS n',
      params: { prospectId },
    };
  }
  return null;
}

function metadataCheck(
  collection: string,
  metadataIdField: string,
): (doc: MongoDoc, id: string) => ChromaCheck {
  return (_doc, id) => ({
    collection,
    query: `${metadataIdField} ${id}`,
    where: { [metadataIdField]: id },
    metadataIdField,
  });
}

export const CROSS_STORE_RECONCILIATION_SPECS: readonly ReconciliationSpec[] = [
  {
    key: 'members',
    label: 'Team Magnificent member identity',
    mongoCollection: 'team_magnificent_members',
    idField: 'tmagId',
    sort: { createdAt: -1 },
    neo4j: (_doc, _id) => ({
      query: 'MATCH (n:TeamMagnificentMember {tmagId: $id}) RETURN count(n) AS n',
    }),
  },
  {
    key: 'prospects',
    label: 'Prospect invitation ownership',
    mongoCollection: 'tmag_prospects',
    idField: 'prospectId',
    sort: { createdAt: -1 },
    neo4j: prospectInviteGraph,
    chroma: metadataCheck('mcs_prospect_invitation_activity', 'prospectId'),
  },
  {
    key: 'invite_tokens',
    label: 'Invite token graph links',
    mongoCollection: 'tmag_prospect_invite_tokens',
    idField: 'token',
    sort: { createdAt: -1 },
    neo4j: inviteTokenGraph,
  },
  {
    key: 'pool_placements',
    label: 'Holding-tank placement edges',
    mongoCollection: 'tmag_prospect_htank_placements',
    idField: 'prospectId',
    sort: { placedAt: -1 },
    neo4j: (_doc, _id) => ({
      query:
        'MATCH (p:TmagProspect {prospectId: $id})-[r:IN_HOLDING_TANK]->(:TmagPool) ' +
        'RETURN count(r) AS n',
    }),
    chroma: metadataCheck('mcs_prospect_htank_events', 'prospectId'),
  },
  {
    key: 'steve_discoveries',
    label: 'Steve discovery knowledge artifacts',
    mongoCollection: 'tmag_steve_success_interview',
    idField: '_id',
    sort: { completedAt: -1 },
    neo4j: (doc, _id) => {
      const tmagId = stringField(doc, 'tmagId');
      if (!tmagId) return null;
      return {
        query:
          'MATCH (:TeamMagnificentMember {tmagId: $tmagId})-[:HAD_STEVE_DISCOVERY]->' +
          '(d:TmagSteveDiscovery {discoveryId: $id}) RETURN count(d) AS n',
        params: { tmagId },
      };
    },
    chroma: metadataCheck('mcs_steve_success_interview', 'discoveryId'),
  },
  {
    key: 'content_videos',
    label: 'Admin content video knowledge',
    mongoCollection: 'tmag_content_videos',
    idField: 'contentVideoId',
    sort: { updatedAt: -1 },
    neo4j: (_doc, _id) => ({
      query: 'MATCH (v:TmagContentVideo {contentVideoId: $id}) RETURN count(v) AS n',
    }),
    chroma: metadataCheck('mcs_content_videos', 'contentVideoId'),
  },
] as const;

async function readMongoSample(
  spec: ReconciliationSpec,
  limit: number,
  persistence: Persistence,
): Promise<MongoDoc[]> {
  const result = await persistence<{ documents?: MongoDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: spec.mongoCollection,
    filter: {},
    ...(spec.sort ? { sort: spec.sort } : {}),
    limit,
  });
  return result.documents ?? [];
}

function extractCount(data: { records?: Array<Record<string, unknown>> }): number {
  const row = data.records?.[0];
  if (!row) return 0;
  const value = typeof row.n === 'number' ? row.n : Object.values(row).find((v) => typeof v === 'number');
  return typeof value === 'number' ? value : 0;
}

async function checkNeo4j(
  check: Neo4jCheck | null | undefined,
  id: string,
  persistence: Persistence,
): Promise<ReconciliationLegResult> {
  if (!check) return { status: 'not_applicable', detail: 'no graph check configured' };
  try {
    const result = await persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query: check.query,
      params: { id, ...(check.params ?? {}) },
    });
    const count = extractCount(result);
    return count > 0
      ? { status: 'present', detail: `matched ${count}` }
      : { status: 'missing', detail: 'graph read-back returned 0' };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

function chromaResultHasId(
  result: {
    results?: { ids?: string[]; metadatas?: Array<Record<string, unknown> | null> };
  },
  id: string,
  metadataIdField: string,
): boolean {
  if ((result.results?.ids ?? []).includes(id)) return true;
  return (result.results?.metadatas ?? []).some((meta) => meta?.[metadataIdField] === id);
}

async function checkChroma(
  check: ChromaCheck | null | undefined,
  id: string,
  persistence: Persistence,
): Promise<ReconciliationLegResult> {
  if (!check) return { status: 'not_applicable', detail: 'no Chroma check configured' };
  try {
    const result = await persistence<{
      results?: { ids?: string[]; metadatas?: Array<Record<string, unknown> | null> };
    }>('chromadb', 'query_with_filter', {
      collection: check.collection,
      query: check.query,
      n_results: 1,
      where: check.where,
    });
    return chromaResultHasId(result, id, check.metadataIdField)
      ? { status: 'present', detail: 'metadata read-back matched' }
      : { status: 'missing', detail: 'Chroma metadata read-back returned 0' };
  } catch (err) {
    return { status: 'error', detail: err instanceof Error ? err.message : String(err) };
  }
}

function rowIssues(row: Pick<ReconciliationRowResult, 'neo4j' | 'chroma'>): string[] {
  const issues: string[] = [];
  if (row.neo4j.status === 'missing') issues.push('neo4j_missing');
  if (row.neo4j.status === 'error') issues.push('neo4j_error');
  if (row.chroma.status === 'missing') issues.push('chroma_missing');
  if (row.chroma.status === 'error') issues.push('chroma_error');
  return issues;
}

async function reconcileSpec(
  spec: ReconciliationSpec,
  limit: number,
  persistence: Persistence,
): Promise<ReconciliationSpecSummary> {
  const warnings: string[] = [];
  let docs: MongoDoc[] = [];
  try {
    docs = await readMongoSample(spec, limit, persistence);
  } catch (err) {
    warnings.push(
      `Mongo sample unavailable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const rows: ReconciliationRowResult[] = [];
  for (const doc of docs) {
    const id = stringField(doc, spec.idField);
    if (!id) {
      warnings.push(`Skipped row missing string ${spec.idField}.`);
      continue;
    }
    const [neo4j, chroma] = await Promise.all([
      checkNeo4j(spec.neo4j?.(doc, id), id, persistence),
      checkChroma(spec.chroma?.(doc, id), id, persistence),
    ]);
    const issues = rowIssues({ neo4j, chroma });
    rows.push({
      specKey: spec.key,
      id,
      mongoCollection: spec.mongoCollection,
      neo4j,
      chroma,
      issues,
    });
  }

  return {
    key: spec.key,
    label: spec.label,
    mongoCollection: spec.mongoCollection,
    scanned: rows.length,
    issueCount: rows.reduce((sum, row) => sum + row.issues.length, 0),
    rows,
    warnings,
  };
}

export async function runCrossStoreReconciliation(
  options: CrossStoreReconciliationOptions = {},
): Promise<CrossStoreReconciliationReport> {
  const limitPerSpec = Math.max(1, Math.floor(options.limitPerSpec ?? DEFAULT_LIMIT_PER_SPEC));
  const selected = new Set(options.specKeys ?? CROSS_STORE_RECONCILIATION_SPECS.map((s) => s.key));
  const specs = CROSS_STORE_RECONCILIATION_SPECS.filter((spec) => selected.has(spec.key));
  const persistence = options.persistence ?? persistenceCall;

  const summaries: ReconciliationSpecSummary[] = [];
  for (const spec of specs) {
    summaries.push(await reconcileSpec(spec, limitPerSpec, persistence));
  }

  const totals = summaries.reduce(
    (acc, spec) => {
      acc.scanned += spec.scanned;
      acc.issues += spec.issueCount;
      acc.warnings += spec.warnings.length;
      return acc;
    },
    { specs: summaries.length, scanned: 0, issues: 0, warnings: 0 },
  );

  return {
    ok: totals.issues === 0 && totals.warnings === 0,
    generatedAt: (options.now?.() ?? new Date()).toISOString(),
    limitPerSpec,
    totals,
    specs: summaries,
  };
}
