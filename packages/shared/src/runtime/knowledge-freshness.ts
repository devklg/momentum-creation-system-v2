/**
 * Knowledge freshness / deprecation model (Phase 4 — P4.7).
 *
 * Store-agnostic TYPE contracts for keeping stale/deprecated/superseded/expired approved
 * knowledge out of the Context Manager retrieval path. Types only — no persistence, no clock,
 * no logic. The pure guard that evaluates these lives in the server context layer
 * (`freshnessGuard.ts`) and receives an injected `now` for determinism.
 *
 * Absence of a `freshness` descriptor on a reference means CURRENT — so adding this model never
 * empties a pre-P4.7 corpus. Only present-and-bad metadata is guarded (fail-closed on presence).
 */

import type { McsKnowledgeId } from './ids.js';

/** Explicit lifecycle signal, distinct from the approved/active retrieval status. */
export type McsKnowledgeFreshnessLifecycle = 'current' | 'deprecated' | 'superseded';

/** Optional freshness descriptor carried on a `KnowledgeReference`. */
export interface McsKnowledgeFreshness {
  lifecycle?: McsKnowledgeFreshnessLifecycle;
  /** ISO-8601. Not yet effective when `now < effectiveAt`. */
  effectiveAt?: string;
  /** ISO-8601. Used with a policy `maxAgeDays` to decide staleness. */
  updatedAt?: string;
  /** ISO-8601. Expired when `now > expiresAt`. */
  expiresAt?: string;
  /** The replacement item when this one is superseded (provenance). */
  supersededBy?: McsKnowledgeId;
}

/**
 * Retrieval-time freshness policy carried on an `ApprovedKnowledgeQueryRequest`. All exclusion
 * flags default to `true` at the guard; `maxAgeDays` is off unless set.
 */
export interface McsKnowledgeFreshnessPolicy {
  /** Evaluation instant (ISO-8601); defaults to the adapter clock when absent. */
  asOf?: string;
  excludeDeprecated?: boolean;
  excludeSuperseded?: boolean;
  excludeExpired?: boolean;
  excludeNotYetEffective?: boolean;
  /**
   * Drop when `updatedAt` is older than this many days. Off when absent, and inert when not a
   * positive finite number (a typo can never empty the corpus). Note: a reference that omits
   * `updatedAt` is treated as current — `maxAgeDays` requires proof-of-recency to act, it is not
   * a fail-closed proof-of-recency gate.
   */
  maxAgeDays?: number;
}

/** Why a reference failed the freshness guard (or `fresh` when it passed). */
export type McsKnowledgeFreshnessVerdict =
  | 'fresh'
  | 'deprecated'
  | 'superseded'
  | 'expired'
  | 'not_yet_effective'
  | 'stale';
