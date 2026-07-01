/**
 * Approved Knowledge Query Contract (Phase 4 — P4.2).
 *
 * The store-agnostic request/response shape by which the Context Manager asks the
 * Knowledge Core boundary for APPROVED knowledge to enrich a `context_packet.v1`.
 *
 * Invariants enforced by this contract (and its validators in the context layer):
 *  - Only APPROVED/ACTIVE knowledge may be returned (`KnowledgeReference`); candidate
 *    and queued-for-review knowledge is NEVER carried in a result — it is excluded and
 *    only COUNTED in result metadata.
 *  - The query is scoped to a Team Magnificent tenant/team/BA `RuntimeRequestScope`.
 *  - No store/Gateway/adapter type leaks into this contract. It is the boundary between
 *    "what the Context Manager wants" and "what the Knowledge Core returns", nothing more.
 *  - It performs NO retrieval itself. It is a type contract; the P4.4 adapter consumes it.
 *
 * This contract feeds the existing assembler (`buildContextPacket`) — it does not assemble
 * packets and does not make the Context Manager any less the sole packet assembler.
 */

import type { McsRuntimeRequestScope } from './identity.js';
import type { McsRuntimeLanguage, McsRuntimeLanguageMetadata } from './language.js';
import type { McsKnowledgeDomain, McsKnowledgeReference } from './knowledge.js';
import type { McsKnowledgeFreshnessPolicy } from './knowledge-freshness.js';

/** Schema version for the approved-knowledge query contract. */
export type McsApprovedKnowledgeQuerySchemaVersion = 'approved_knowledge_query.v1';

/**
 * Why a query returned fewer (or no) approved references than the caller hoped. These are
 * descriptive result-metadata reasons — they never widen what is returned; an unavailable
 * or empty result is a fail-closed (degraded) signal, never a candidate substitution.
 */
export type McsApprovedKnowledgeQueryDegradeReason =
  | 'knowledge_unavailable'
  | 'no_approved_match'
  | 'language_unavailable'
  | 'scope_empty'
  | 'retrieval_timeout';

/** Why candidate/queued-for-review knowledge was excluded from a result (always recorded). */
export type McsApprovedKnowledgeExclusionReason =
  | 'candidate_not_approved'
  | 'queued_for_review'
  | 'not_review_workflow';

/**
 * A request from the Context Manager to the Knowledge Core boundary for approved knowledge.
 * Carries scope, the agent objective/domains it is enriching for, and the target language.
 * Never carries a store query, a candidate flag, or any directive to include candidates.
 */
export interface McsApprovedKnowledgeQueryRequest {
  schemaVersion: McsApprovedKnowledgeQuerySchemaVersion;
  /** Team Magnificent tenant/team/BA scope — the only scope a result may serve. */
  scope: McsRuntimeRequestScope;
  /** Free-text objective the packet is being assembled for (e.g. `training_support`). */
  objective: string;
  /** Knowledge domains relevant to this objective; empty means no domain filter. */
  domains: readonly McsKnowledgeDomain[];
  /** Target language for the assembled packet. */
  language: McsRuntimeLanguage;
  /**
   * Whether a same-language-unavailable approved item may be returned in the fallback
   * language. Defaults to false at the validator; never permits candidate inclusion.
   */
  allowLanguageFallback?: boolean;
  /** Optional soft cap on returned references; the boundary may return fewer. */
  maxResults?: number;
  /**
   * Optional P4.7 freshness/deprecation policy. Absent ⇒ safe defaults (exclude
   * deprecated/superseded/expired/not-yet-effective); a reference with no freshness metadata is
   * always treated as current, so the default policy changes nothing for a pre-P4.7 corpus.
   */
  freshness?: McsKnowledgeFreshnessPolicy;
}

/**
 * A single candidate/review-only item that was excluded from the result. Carries no body —
 * only the identity needed for the Context Manager to stamp a `ContextExclusion` honestly.
 */
export interface McsApprovedKnowledgeExcludedItem {
  sourceId: McsKnowledgeReference['sourceId'];
  reason: McsApprovedKnowledgeExclusionReason;
}

/** Result-level metadata: counts, language fallback, and degrade signals. */
export interface McsApprovedKnowledgeQueryResultMetadata {
  /** Number of approved/active references returned. */
  approvedCount: number;
  /** Number of candidate/queued items excluded (counted, never returned). */
  candidateExcludedCount: number;
  /** Always true — candidate exclusion is structural and recorded on every result. */
  candidateExcluded: true;
  /** Language metadata, including any fallback that was applied. */
  language: McsRuntimeLanguageMetadata;
  /** Present when the result is degraded (empty/unavailable); drives fail-closed assembly. */
  degradeReasons?: readonly McsApprovedKnowledgeQueryDegradeReason[];
}

/**
 * The Knowledge Core boundary's response to an `ApprovedKnowledgeQueryRequest`.
 *
 * `references` contains ONLY approved/active `KnowledgeReference`s. Candidate/review-only
 * items never appear here; they are summarized in `excluded` and counted in `metadata`.
 * `status: 'degraded'` signals the Context Manager to assemble an empty-approved-knowledge,
 * fail-closed packet rather than error.
 */
export interface McsApprovedKnowledgeQueryResult {
  schemaVersion: McsApprovedKnowledgeQuerySchemaVersion;
  status: 'ok' | 'degraded';
  scope: McsRuntimeRequestScope;
  references: readonly McsKnowledgeReference[];
  excluded: readonly McsApprovedKnowledgeExcludedItem[];
  metadata: McsApprovedKnowledgeQueryResultMetadata;
}
