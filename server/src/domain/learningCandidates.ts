/**
 * Learning candidate pipeline domain (Phase 7 · R2 — P7.5).
 *
 * A learning candidate is a PROPOSED, not-yet-approved unit of organizational
 * learning derived from runtime signals / R1 outcomes. It is persisted
 * REVIEW-ONLY through the app-direct seam into the app's own dedicated stores
 * (Mongo `momentum` mcs_learning_candidates / Neo4j `(:LearningCandidate)` /
 * Chroma `mcs_learning_candidates_review`) — a collection DISJOINT from active
 * knowledge, so the Context Manager never retrieves a candidate as guidance.
 * No Universal Gateway, no `quadstack.write` (ACR-0007).
 *
 * THE HARD INVARIANT (P7.5 §5.1): NO AGENT MAY APPROVE KNOWLEDGE.
 *   - `appendLearningCandidate` ALWAYS produces a `detected` candidate. It has
 *     no status parameter — a pipeline/agent cannot mint an approved candidate.
 *   - `reviewLearningCandidate` is the ONLY path to approved/rejected, and it
 *     requires a human `reviewedByBaId`. There is no auto-promotion.
 *   - Reviews are written once; a changed decision supersedes with a new
 *     candidate (append-only). Rejected candidates are retained for audit.
 *
 * Canary-gated by LEARNING_CANDIDATE_PERSISTENCE_ENABLED (default OFF → no-op).
 * Wired-dormant: no route mounts these in this slice; live review UI wiring is a
 * later approved activation step, gated behind R0/R1 being proven.
 */

import { createHash } from 'node:crypto';
import { env } from '../env.js';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import type {
  AppendLearningCandidateInput,
  McsCandidateReview,
  McsLearningCandidateRecord,
  ReviewLearningCandidateInput,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const COLLECTION = 'mcs_learning_candidates';
// REVIEW-ONLY Chroma collection — DISJOINT from any active-knowledge collection.
const CHROMA_COLLECTION = 'mcs_learning_candidates_review';
const SERVICE_NAME = 'mcs_learning_pipeline';
const TENANT_NAMESPACE = 'momentum';
const SCHEMA_VERSION = 1;
const MAX_SUMMARY_CHARS = 2000;
const MAX_REASON_CHARS = 1000;

export class LearningCandidateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LearningCandidateValidationError';
  }
}

export class LearningCandidateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LearningCandidateNotFoundError';
  }
}

/** True iff the R2 learning-candidate canary is enabled (P7.1 §6 kill-switch). */
export function learningCandidatePersistenceEnabled(): boolean {
  return env.LEARNING_CANDIDATE_PERSISTENCE_ENABLED;
}

function shortHash(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

/** Deterministic id from the sorted evidence set + domain — same evidence, one candidate. */
export function deterministicCandidateId(input: {
  domain: string;
  sourceOutcomeIds: string[];
  sourceSignalIds: string[];
}): string {
  const evidence = [...input.sourceOutcomeIds, ...input.sourceSignalIds].sort().join(',');
  return `mcslearn_${shortHash(`${input.domain}:${evidence}`)}`;
}

export async function findLearningCandidate(
  id: string,
): Promise<McsLearningCandidateRecord | null> {
  const result = await gatewayCall<{ documents: McsLearningCandidateRecord[] }>(
    'mongodb',
    'query',
    { database: MONGO_DB, collection: COLLECTION, filter: { id }, limit: 1 },
  );
  return result.documents?.[0] ?? null;
}

function candidateSemanticDocument(record: McsLearningCandidateRecord): string {
  return [
    `learning_candidate status=${record.status}`,
    `domain=${record.domain}`,
    `lang=${record.language}`,
    `tenant=${record.tenantId}`,
    `summary=${record.proposedSummary}`,
  ].join(' | ');
}

/**
 * Create a learning candidate. ALWAYS `detected` — there is no status parameter,
 * so no caller (agent or pipeline) can mint an approved candidate. Returns the
 * persisted record, the existing record on a dedup hit, or `null` when the
 * canary is off.
 */
export async function appendLearningCandidate(
  input: AppendLearningCandidateInput,
): Promise<McsLearningCandidateRecord | null> {
  if (!learningCandidatePersistenceEnabled()) return null;

  if (!input.tenantId) {
    throw new LearningCandidateValidationError('A learning candidate requires a tenant scope.');
  }
  const proposedSummary = (input.proposedSummary ?? '').trim();
  if (!proposedSummary) {
    throw new LearningCandidateValidationError('A learning candidate requires a proposed summary.');
  }
  const sourceOutcomeIds = input.sourceOutcomeIds ?? [];
  const sourceSignalIds = input.sourceSignalIds ?? [];
  if (sourceOutcomeIds.length === 0 && sourceSignalIds.length === 0) {
    throw new LearningCandidateValidationError(
      'A learning candidate requires provenance: at least one source outcome or signal.',
    );
  }

  const now = new Date().toISOString();
  const id = deterministicCandidateId({ domain: input.domain, sourceOutcomeIds, sourceSignalIds });

  if (!input.supersedesCandidateId) {
    const existing = await findLearningCandidate(id);
    if (existing) return existing;
  }

  const record: McsLearningCandidateRecord = {
    id,
    type: 'learning_candidate',
    schemaVersion: SCHEMA_VERSION,
    namespace: TENANT_NAMESPACE,
    source: SERVICE_NAME,
    createdAt: now,
    title: `learning candidate · ${input.domain} · ${proposedSummary.slice(0, 60)}`,
    originKind: 'system',
    serviceName: SERVICE_NAME,
    tenantId: input.tenantId,
    baId: input.baId,
    derivedFrom: [...sourceOutcomeIds, ...sourceSignalIds],
    status: 'detected', // ALWAYS — no agent-set approval
    domain: input.domain,
    language: input.language,
    proposedSummary: proposedSummary.slice(0, MAX_SUMMARY_CHARS),
    sourceOutcomeIds,
    sourceSignalIds,
    teamKey: 'team_magnificent',
    review: null,
    supersedesCandidateId: input.supersedesCandidateId ?? null,
  };

  await tripleStackWrite({
    id,
    mongoCollection: COLLECTION,
    mongoDoc: { ...record, _id: undefined } as Record<string, unknown>,
    neo4j: buildCandidateCypher(record),
    chroma: {
      collection: CHROMA_COLLECTION,
      document: candidateSemanticDocument(record),
      metadata: {
        kind: 'learning_candidate',
        status: record.status,
        domain: record.domain,
        language: record.language,
        tenantId: record.tenantId,
        createdAt: record.createdAt,
      },
    },
  });

  return record;
}

/**
 * Record a HUMAN review decision (approved/rejected). This is the ONLY path to a
 * non-`detected` status. Enforces:
 *   - the canary is on (else no-op → null);
 *   - a non-empty human `reviewedByBaId` (no agent approval);
 *   - the candidate exists and has not already been reviewed (a changed decision
 *     must supersede with a new candidate — reviews are written once).
 */
export async function reviewLearningCandidate(
  input: ReviewLearningCandidateInput,
): Promise<McsLearningCandidateRecord | null> {
  if (!learningCandidatePersistenceEnabled()) return null;

  if (!input.reviewedByBaId || !input.reviewedByBaId.trim()) {
    throw new LearningCandidateValidationError(
      'A review requires a human reviewer id — no agent may approve knowledge.',
    );
  }
  if (input.decision !== 'approved' && input.decision !== 'rejected') {
    throw new LearningCandidateValidationError('A review decision must be approved or rejected.');
  }

  const candidate = await findLearningCandidate(input.candidateId);
  if (!candidate) {
    throw new LearningCandidateNotFoundError(`Learning candidate ${input.candidateId} not found.`);
  }
  if (candidate.review) {
    throw new LearningCandidateValidationError(
      'This candidate was already reviewed; a changed decision must supersede with a new candidate.',
    );
  }

  const now = new Date().toISOString();
  const review: McsCandidateReview = {
    decision: input.decision,
    reviewedByBaId: input.reviewedByBaId,
    reviewedAt: now,
    reason: input.reason ? input.reason.slice(0, MAX_REASON_CHARS) : null,
    approvalReferenceId: input.approvalReferenceId ?? null,
  };
  const status = input.decision === 'approved' ? 'approved' : 'rejected';

  // Mongo: set the review block + status (branch-on-existence already done above).
  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: COLLECTION,
    filter: { id: input.candidateId },
    update: { $set: { status, review, updatedAt: now } },
  });

  // Neo4j: reflect the terminal status + reviewer on the candidate node.
  await gatewayCall('neo4j', 'cypher', {
    query: `
      MERGE (c:LearningCandidate {id: $id})
      SET c.status = $status, c.reviewDecision = $decision,
          c.reviewedByBaId = $reviewedByBaId, c.reviewedAt = datetime($reviewedAt)
      RETURN c.id AS id
    `,
    params: {
      id: input.candidateId,
      status,
      decision: input.decision,
      reviewedByBaId: input.reviewedByBaId,
      reviewedAt: now,
    },
  });

  return { ...candidate, status, review };
}

/**
 * Neo4j leg for a new candidate: MERGE the node, scope it to Team Magnificent,
 * and link its provenance to the source outcomes. Specific verbs only.
 */
function buildCandidateCypher(
  record: McsLearningCandidateRecord,
): { cypher: string; params?: Record<string, unknown> } {
  return {
    cypher: `
      MERGE (c:LearningCandidate {id: $id})
      SET c += {
        id: $id, status: $status, domain: $domain, language: $language,
        tenantId: $tenantId, createdAt: datetime($createdAt)
      }
      MERGE (t:TeamMagnificent {teamKey: 'team_magnificent'})
      MERGE (c)-[:SCOPED_TO]->(t)
      WITH c
      UNWIND $sourceOutcomeIds AS outcomeId
      OPTIONAL MATCH (o:Outcome {id: outcomeId})
      FOREACH (_ IN CASE WHEN o IS NULL THEN [] ELSE [1] END |
        MERGE (c)-[:DERIVED_FROM]->(o)
      )
      RETURN c.id AS id
    `,
    params: {
      id: record.id,
      status: record.status,
      domain: record.domain,
      language: record.language,
      tenantId: record.tenantId,
      createdAt: record.createdAt,
      sourceOutcomeIds: record.sourceOutcomeIds,
    },
  };
}
