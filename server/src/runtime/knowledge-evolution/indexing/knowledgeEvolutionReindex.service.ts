/**
 * Chroma reindex coordination service (Knowledge Evolution Runtime · Lane C).
 *
 * Coordinates semantic reindexing of evolved knowledge through the app's direct Chroma
 * adapter (`services/persistence`). It does NOT own canonical truth (Mongo does) and it
 * does NOT approve, create candidates, or assemble context — it only reflects an already
 * approved knowledge-lifecycle state into active-retrieval collections.
 *
 * Ratified authority: `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` §8.6, §19.
 *
 * Responsibilities (Lane C brief):
 *   - Route active knowledge to the correct domain/language ACTIVE collection.
 *   - Keep candidate / review-only collections SEPARATE (candidates are never active-indexed).
 *   - EXCLUDE superseded / archived knowledge from active retrieval (remove embeddings).
 *   - Preserve tenant / team / language / source metadata on every active record.
 *   - Mark indexing status pending → completed / failed.
 *   - Make reindex jobs RETRYABLE and idempotent (deterministic id + upsert / filtered delete).
 *
 * Persistence is injected via {@link ChromaIndexPort} so this service unit-tests against a
 * mocked Chroma adapter without reimplementing Lane A repositories. The default port routes
 * through `persistenceCall('chromadb', …)` — the same direct, governed stack the rest of the
 * app uses (ACR-0007/0009). No Universal Gateway, no external MCP tool path.
 */

import { persistenceCall } from '../../../services/persistence/dispatch.js';
import type {
  KnowledgeEvolutionCoordinationStatus,
  KnowledgeEvolutionDomain,
  KnowledgeEvolutionLanguage,
  KnowledgeEvolutionTeamKey,
  KnowledgeEvolutionTeamName,
  KnowledgeReindexStatus,
} from '@momentum/shared/runtime';
import {
  routeActiveKnowledgeCollection,
  type ActiveCollectionRoute,
  type ActiveCollectionRouteAction,
  type ActiveKnowledgeLifecycle,
} from './activeKnowledgeCollectionRouter.js';

// ---------------------------------------------------------------------------
// Injectable Chroma port
// ---------------------------------------------------------------------------

/** The minimal Chroma surface the reindex service needs — nothing more, nothing app-canonical. */
export interface ChromaIndexPort {
  /** Idempotently ensure a collection exists before writing to it (CK-04 lesson). */
  ensureCollection(collection: string): Promise<void>;
  /** Upsert one active-knowledge document + metadata (embedding handled by the adapter). */
  upsert(input: {
    collection: string;
    id: string;
    document: string;
    metadata: Record<string, unknown>;
  }): Promise<void>;
  /** Remove active-knowledge records matching a metadata filter (supersede / archive). */
  deleteByFilter(input: { collection: string; where: Record<string, unknown> }): Promise<void>;
}

/** Default port — direct governed Chroma stack via `persistenceCall` (no external tooling). */
export const defaultChromaIndexPort: ChromaIndexPort = {
  async ensureCollection(collection) {
    await persistenceCall('chromadb', 'create_collection', {
      name: collection,
      metadata: {
        project: 'momentum_creation_system_v2',
        purpose: 'knowledge-evolution active retrieval collection',
      },
    });
  },
  async upsert({ collection, id, document, metadata }) {
    await persistenceCall('chromadb', 'add', {
      collection,
      ids: [id],
      documents: [document],
      metadatas: [metadata],
    });
  },
  async deleteByFilter({ collection, where }) {
    await persistenceCall('chromadb', 'delete', { collection, where });
  },
};

// ---------------------------------------------------------------------------
// Request / result contracts
// ---------------------------------------------------------------------------

export interface KnowledgeReindexRequest {
  evolutionId: string;
  knowledgeObjectId: string;
  version: number;

  tenantId: string;
  teamId?: string;
  teamKey?: KnowledgeEvolutionTeamKey;
  teamName?: KnowledgeEvolutionTeamName;

  domain: KnowledgeEvolutionDomain;
  language: KnowledgeEvolutionLanguage;

  /** Lifecycle state of the knowledge object driving the reindex decision. */
  lifecycle: ActiveKnowledgeLifecycle;
  /** Whether an approval reference exists (candidates without one are never active). */
  approved: boolean;

  /** Governance status carried onto the active record for auditability (spec §19.1). */
  governanceStatus?: string;
  /** Retrieval-ready gate value written onto the record (the active retrieval filter). */
  retrievalReady?: boolean;

  /** The summary text to embed. Required for `index_active`; ignored for removals. */
  document?: string;

  /** Source traceability preserved on the active record (spec §19.1). */
  sourceCandidateIds?: string[];
  sourceKnowledgeObjectIds?: string[];
  sourceLearningSignalIds?: string[];
  sourceOutcomeIds?: string[];

  /** Extra metadata merged last (never overrides reserved scope/source keys). */
  metadata?: Record<string, unknown>;
}

export interface KnowledgeReindexResult {
  evolutionId: string;
  knowledgeObjectId: string;
  action: ActiveCollectionRouteAction;
  collection: string | null;
  documentId: string | null;
  status: KnowledgeReindexStatus;
  indexingStatus: KnowledgeEvolutionCoordinationStatus;
  attempts: number;
  retryable: boolean;
  reason: string;
  error?: string;
}

export interface ReindexServiceDeps {
  chroma?: ChromaIndexPort;
  /** Persist the coordination status transition (Lane A/D wire the real sink). */
  markStatus?: (
    evolutionId: string,
    status: KnowledgeEvolutionCoordinationStatus,
  ) => void | Promise<void>;
  /** Deterministic active-record id builder (default aligns with GraphRAG record ids). */
  documentId?: (
    knowledgeObjectId: string,
    version: number,
    language: KnowledgeEvolutionLanguage,
  ) => string;
  /** Max reindex attempts before giving up (default 3). Idempotent, so retry is safe. */
  maxAttempts?: number;
  now?: () => Date;
}

/** Deterministic id for an active-knowledge embedding — stable across retries (idempotent upsert). */
export function activeKnowledgeDocumentId(
  knowledgeObjectId: string,
  version: number,
  language: KnowledgeEvolutionLanguage,
): string {
  return `keknow_${knowledgeObjectId}_v${version}_${language}`;
}

async function runWithRetry(
  fn: () => Promise<void>,
  maxAttempts: number,
): Promise<{ ok: boolean; attempts: number; error?: string }> {
  let attempts = 0;
  let lastError = '';
  while (attempts < maxAttempts) {
    attempts += 1;
    try {
      await fn();
      return { ok: true, attempts };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { ok: false, attempts, error: lastError };
}

function buildActiveMetadata(
  request: KnowledgeReindexRequest,
  route: ActiveCollectionRoute,
  now: Date,
): Record<string, unknown> {
  // Chroma metadata values must be scalar — arrays are pipe-joined (adapter convention).
  const meta: Record<string, unknown> = {
    evolutionId: request.evolutionId,
    knowledgeObjectId: request.knowledgeObjectId,
    version: request.version,
    domain: request.domain,
    language: request.language,
    lifecycleStatus: request.lifecycle,
    governanceStatus: request.governanceStatus ?? 'approved',
    retrievalReady: request.retrievalReady ?? false,
    tenantId: request.tenantId,
    reindexReason: route.reason,
    indexedAt: now.toISOString(),
  };
  if (request.teamId) meta.teamId = request.teamId;
  if (request.teamKey) meta.teamKey = request.teamKey;
  if (request.teamName) meta.teamName = request.teamName;
  if (request.sourceCandidateIds?.length) {
    meta.sourceCandidateIds = request.sourceCandidateIds.join('|');
  }
  if (request.sourceKnowledgeObjectIds?.length) {
    meta.sourceKnowledgeObjectIds = request.sourceKnowledgeObjectIds.join('|');
  }
  if (request.sourceLearningSignalIds?.length) {
    meta.sourceLearningSignalIds = request.sourceLearningSignalIds.join('|');
  }
  if (request.sourceOutcomeIds?.length) {
    meta.sourceOutcomeIds = request.sourceOutcomeIds.join('|');
  }
  meta.sourceTraceable =
    Boolean(request.sourceCandidateIds?.length) ||
    Boolean(request.sourceKnowledgeObjectIds?.length) ||
    Boolean(request.sourceLearningSignalIds?.length) ||
    Boolean(request.sourceOutcomeIds?.length);
  if (request.metadata) {
    for (const [k, v] of Object.entries(request.metadata)) {
      if (!(k in meta)) meta[k] = v;
    }
  }
  return meta;
}

/**
 * Coordinate a single Chroma reindex for one evolution. Idempotent and retryable.
 *
 * The routing decision is computed first (pure, no I/O), so a candidate / review-only /
 * unapproved / ineligible item short-circuits to `not_required` WITHOUT any Chroma call —
 * an indexing mistake can never promote it into active retrieval.
 */
export async function reindexKnowledgeEvolution(
  request: KnowledgeReindexRequest,
  deps: ReindexServiceDeps = {},
): Promise<KnowledgeReindexResult> {
  const chroma = deps.chroma ?? defaultChromaIndexPort;
  const maxAttempts = Math.max(1, deps.maxAttempts ?? 3);
  const buildId = deps.documentId ?? activeKnowledgeDocumentId;
  const now = deps.now ? deps.now() : new Date();

  const route = routeActiveKnowledgeCollection({
    domain: request.domain,
    language: request.language,
    lifecycle: request.lifecycle,
    approved: request.approved,
  });

  const baseResult = {
    evolutionId: request.evolutionId,
    knowledgeObjectId: request.knowledgeObjectId,
    action: route.action,
    collection: route.activeCollection,
    reason: route.reason,
  } as const;

  // Nothing to do to active retrieval — do not even touch Chroma.
  if (route.action === 'keep_out_of_active') {
    await deps.markStatus?.(request.evolutionId, 'not_required');
    return {
      ...baseResult,
      documentId: null,
      status: 'not_required',
      indexingStatus: 'not_required',
      attempts: 0,
      retryable: false,
    };
  }

  await deps.markStatus?.(request.evolutionId, 'pending');

  const collection = route.activeCollection as string;
  const documentId = buildId(request.knowledgeObjectId, request.version, request.language);

  if (route.action === 'index_active') {
    const document = (request.document ?? '').trim();
    if (!document) {
      // Bad input — no text to embed. Not transient; do not mark retryable.
      await deps.markStatus?.(request.evolutionId, 'failed');
      return {
        ...baseResult,
        documentId,
        status: 'failed',
        indexingStatus: 'failed',
        attempts: 0,
        retryable: false,
        error: 'index_active requires a non-empty document to embed',
      };
    }
    const metadata = buildActiveMetadata(request, route, now);
    const outcome = await runWithRetry(async () => {
      await chroma.ensureCollection(collection);
      await chroma.upsert({ collection, id: documentId, document, metadata });
    }, maxAttempts);

    const status: KnowledgeEvolutionCoordinationStatus = outcome.ok ? 'completed' : 'failed';
    await deps.markStatus?.(request.evolutionId, status);
    return {
      ...baseResult,
      documentId,
      status: outcome.ok ? 'completed' : 'failed',
      indexingStatus: status,
      attempts: outcome.attempts,
      retryable: !outcome.ok,
      ...(outcome.error ? { error: outcome.error } : {}),
    };
  }

  // remove_from_active — excise every embedding for this knowledge object from active.
  const outcome = await runWithRetry(async () => {
    await chroma.deleteByFilter({
      collection,
      where: { knowledgeObjectId: request.knowledgeObjectId },
    });
  }, maxAttempts);

  const status: KnowledgeEvolutionCoordinationStatus = outcome.ok ? 'completed' : 'failed';
  await deps.markStatus?.(request.evolutionId, status);
  return {
    ...baseResult,
    documentId,
    status: outcome.ok ? 'completed' : 'failed',
    indexingStatus: status,
    attempts: outcome.attempts,
    retryable: !outcome.ok,
    ...(outcome.error ? { error: outcome.error } : {}),
  };
}
