/**
 * GraphRAG domain (Phase 7 · R3 — P7.6 GraphRAG Architecture).
 *
 * Derived-memory WRITES + RETRIEVAL over the app's OWN dedicated stores,
 * app-direct. A GraphRAG record indexes an ACTIVE, approved Knowledge Object for
 * semantic recall (Chroma) stitched to lineage (Neo4j) by a shared id. NO
 * Universal Gateway, no `quadstack.write`, no `universal_gateway` (ACR-0007).
 *
 * Invariants (P7.6 §6):
 *   - App-direct only; app-memory envelope; shared id across all three stores.
 *   - Active / review separation: records live in per-domain-per-language ACTIVE
 *     collections, DISJOINT from the R2 review-only candidate collection.
 *   - Retrieval-ready gate: only `retrievalReady:true` records are served;
 *     superseded/archived/review-only are excluded.
 *   - 384-dim all-MiniLM-L6-v2 with model + modelVersion provenance.
 *   - Context Manager is the SOLE caller — agents never read/write directly.
 *   - Canary-gated by GRAPHRAG_PERSISTENCE_ENABLED (default OFF → no-op).
 *
 * Wired-dormant: no route mounts these; live Context-Manager wiring is a later
 * approved step, gated behind R0/R1/R2 being proven.
 */

import { env } from '../env.js';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  McsGraphRagInput,
  McsGraphRagHit,
  McsGraphRagQuery,
  McsEmbeddingModel,
  McsGraphRagRecord,
  McsLearningDomain,
} from '@momentum/shared';

const MONGO_COLLECTION = 'mcs_graphrag_records';
const SERVICE_NAME = 'mcs_graphrag';
const TENANT_NAMESPACE = 'momentum';
const SCHEMA_VERSION = 1;
const EMBEDDING_MODEL: McsEmbeddingModel = 'all-MiniLM-L6-v2';
const EMBEDDING_DIM = 384;
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 25;

export class GraphRagValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphRagValidationError';
  }
}

/** True iff the R3 GraphRAG canary is enabled (P7.1 §6 kill-switch). */
export function graphRagPersistenceEnabled(): boolean {
  return env.GRAPHRAG_PERSISTENCE_ENABLED;
}

/**
 * Route a domain+language to its ACTIVE-knowledge Chroma collection (P7.6 §3.1).
 * These are disjoint from `mcs_learning_candidates_review` — a candidate can
 * never land in an active collection.
 */
export function activeKnowledgeCollection(
  domain: McsLearningDomain,
  language: 'en' | 'es',
): string {
  return `mcs_${domain}_knowledge_${language}`;
}

function deterministicRecordId(input: {
  knowledgeObjectId: string;
  version: number;
  language: string;
}): string {
  return `mcsgraph_${input.knowledgeObjectId}_v${input.version}_${input.language}`;
}

/**
 * Persist a derived GraphRAG record for an active knowledge object. Returns the
 * record, or `null` when the canary is off.
 */
export async function appendGraphRagRecord(
  input: McsGraphRagInput,
): Promise<McsGraphRagRecord | null> {
  if (!graphRagPersistenceEnabled()) return null;

  if (!input.knowledgeObjectId) {
    throw new GraphRagValidationError('A GraphRAG record requires a knowledgeObjectId.');
  }
  if (!input.tenantId) {
    throw new GraphRagValidationError('A GraphRAG record requires a tenant scope.');
  }
  const summary = (input.summary ?? '').trim();
  if (!summary) {
    throw new GraphRagValidationError('A GraphRAG record requires a summary (never a source dump).');
  }

  const now = new Date().toISOString();
  const id = deterministicRecordId({
    knowledgeObjectId: input.knowledgeObjectId,
    version: input.version,
    language: input.language,
  });
  const collection = activeKnowledgeCollection(input.domain, input.language);

  const record: McsGraphRagRecord = {
    id,
    type: input.type ?? 'graphrag_record',
    schemaVersion: SCHEMA_VERSION,
    namespace: TENANT_NAMESPACE,
    source: SERVICE_NAME,
    createdAt: now,
    title: input.title ?? `graphrag ${input.domain}/${input.language} · ${input.knowledgeObjectId}`,
    originKind: 'system',
    serviceName: SERVICE_NAME,
    tenantId: input.tenantId,
    teamKey: 'team_magnificent',
    derivedFrom: input.derivedFrom ?? [],
    knowledgeObjectId: input.knowledgeObjectId,
    version: input.version,
    domain: input.domain,
    language: input.language,
    summary,
    model: EMBEDDING_MODEL,
    modelVersion: input.modelVersion,
    retrievalReady: input.retrievalReady ?? false,
  };

  await tripleStackWrite({
    id,
    mongoCollection: MONGO_COLLECTION,
    mongoDoc: { ...record, _id: undefined } as Record<string, unknown>,
    neo4j: buildGraphRagCypher(record),
    chroma: {
      collection,
      document: summary,
      metadata: {
        kind: record.type,
        knowledgeObjectId: record.knowledgeObjectId,
        version: record.version,
        domain: record.domain,
        language: record.language,
        tenantId: record.tenantId,
        retrievalReady: record.retrievalReady,
        model: record.model,
        modelVersion: record.modelVersion,
        createdAt: record.createdAt,
      },
    },
  });

  return record;
}

/**
 * Retrieve active, retrieval-ready knowledge for the Context Manager. Queries the
 * domain+language ACTIVE collection with a hard `retrievalReady:true` + tenant
 * filter — superseded/archived/review-only records are structurally excluded.
 * Returns `[]` when the canary is off.
 */
export async function retrieveGraphRag(
  query: McsGraphRagQuery,
): Promise<McsGraphRagHit[]> {
  if (!graphRagPersistenceEnabled()) return [];

  if (!query.tenantId) {
    throw new GraphRagValidationError('Retrieval requires a tenant scope.');
  }
  const topK = Math.max(1, Math.min(query.topK ?? DEFAULT_TOP_K, MAX_TOP_K));
  const collection = activeKnowledgeCollection(query.domain, query.language);

  const result = await gatewayCall<{
    ids?: string[][];
    documents?: string[][];
    distances?: number[][];
    metadatas?: Array<Array<Record<string, unknown>>>;
  }>('chromadb', 'query', {
    collection,
    queryTexts: [query.queryText],
    nResults: topK,
    // Retrieval-ready gate + tenant scope — the structural exclusion of
    // superseded/archived/review-only knowledge from active retrieval.
    where: { retrievalReady: true, tenantId: query.tenantId },
  });

  const ids = result.ids?.[0] ?? [];
  const docs = result.documents?.[0] ?? [];
  const dists = result.distances?.[0] ?? [];
  const metas = result.metadatas?.[0] ?? [];

  return ids.map((id, i) => {
    const meta = metas[i] ?? {};
    return {
      id,
      knowledgeObjectId: String(meta.knowledgeObjectId ?? ''),
      version: typeof meta.version === 'number' ? meta.version : Number(meta.version ?? 0),
      summary: docs[i] ?? '',
      distance: typeof dists[i] === 'number' ? (dists[i] as number) : null,
    } satisfies McsGraphRagHit;
  });
}

/** Embedding dimension the app is fixed at (P10 §7.3). Exposed for parity checks. */
export function graphRagEmbeddingDim(): number {
  return EMBEDDING_DIM;
}

/**
 * Neo4j leg: MERGE the Knowledge node keyed on the shared id; carry the active
 * version + retrieval-ready flag + scope. Specific verbs only.
 */
function buildGraphRagCypher(
  record: McsGraphRagRecord,
): { cypher: string; params?: Record<string, unknown> } {
  return {
    cypher: `
      MERGE (k:Knowledge {id: $id})
      SET k += {
        id: $id, knowledgeObjectId: $knowledgeObjectId, version: $version,
        domain: $domain, language: $language, tenantId: $tenantId,
        retrievalReady: $retrievalReady, createdAt: datetime($createdAt)
      }
      MERGE (t:TeamMagnificent {teamKey: 'team_magnificent'})
      MERGE (k)-[:SCOPED_TO]->(t)
      RETURN k.id AS id
    `,
    params: {
      id: record.id,
      knowledgeObjectId: record.knowledgeObjectId,
      version: record.version,
      domain: record.domain,
      language: record.language,
      tenantId: record.tenantId,
      retrievalReady: record.retrievalReady,
      createdAt: record.createdAt,
    },
  };
}
