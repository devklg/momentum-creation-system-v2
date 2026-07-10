/**
 * Active-knowledge collection router (Knowledge Evolution Runtime · Lane C).
 *
 * Pure routing logic that decides, for a piece of evolving knowledge, WHICH Chroma
 * collection (if any) it belongs in for ACTIVE semantic retrieval — and, critically,
 * when it must be kept OUT of active retrieval entirely.
 *
 * Ratified authority: `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` §19.1–19.2 (reindexing
 * requirements + collection set) and §21.1–21.2 (retrieval-eligible domains).
 *
 * Hard constraints enforced here (Lane C brief):
 *   - Chroma is NOT canonical truth; this file computes routing only, it performs no I/O.
 *   - Candidate / review-only knowledge must NEVER be routed into an active collection —
 *     an indexing mistake must not turn an unapproved candidate into active retrieval.
 *   - Superseded / archived knowledge is EXCLUDED from active retrieval (it is removed
 *     from active collections, never added).
 *   - The `personal` domain is not retrieval-eligible (§21.2) and is never active-indexed.
 *
 * Physical collection names carry the app-wide `mcs_` prefix so they line up with the
 * collections the Context Manager / GraphRAG retrieval path already reads
 * (`server/src/domain/graphrag.ts`, `server/src/services/chromaCollections.ts`). The
 * unprefixed logical names in the ratified §19.2 list are used to VALIDATE the pairing.
 */

import {
  KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS,
} from '@momentum/shared/runtime';
import type {
  KnowledgeEvolutionDomain,
  KnowledgeEvolutionLanguage,
  KnowledgeRetrievalDomain,
} from '@momentum/shared/runtime';

/** App-wide physical prefix for Chroma collections (parity with `mcs_*` registry). */
export const ACTIVE_KNOWLEDGE_COLLECTION_PREFIX = 'mcs_' as const;

/**
 * The SINGLE review-only candidate collection. Review-only candidate knowledge lives here
 * and is structurally disjoint from every active collection (spec §19.2). Lane C never
 * writes candidates into active collections; the candidate/review split is preserved.
 */
export const REVIEW_ONLY_CANDIDATE_COLLECTION = 'mcs_learning_candidates_review' as const;

/**
 * Domains eligible for active retrieval rollout (spec §21.2). `personal` is deliberately
 * absent — personal-domain knowledge is never activated into agent-facing retrieval.
 */
export const ACTIVE_RETRIEVAL_DOMAINS = [
  'success',
  'training',
  'relationship',
  'performance',
  'organizational',
  'governance',
  'system',
] as const satisfies readonly KnowledgeRetrievalDomain[];

const ACTIVE_RETRIEVAL_DOMAIN_SET: ReadonlySet<string> = new Set(ACTIVE_RETRIEVAL_DOMAINS);

/** Logical (spec §19.2) active collection names, used to validate domain/language pairs. */
const LOGICAL_ACTIVE_COLLECTION_SET: ReadonlySet<string> = new Set(
  KNOWLEDGE_EVOLUTION_ACTIVE_COLLECTIONS,
);

/**
 * Lifecycle position of the knowledge being routed. Drawn from the knowledge object's
 * lifecycle state — NOT from a raw candidate. `candidate` / `review_only` are included so
 * the router can prove an unapproved item is refused before any I/O is attempted.
 */
export type ActiveKnowledgeLifecycle =
  | 'active'
  | 'superseded'
  | 'archived'
  | 'candidate'
  | 'review_only';

export type ActiveCollectionRouteAction =
  /** Add / upsert this knowledge into its active collection. */
  | 'index_active'
  /** Remove this knowledge from its active collection (superseded / archived). */
  | 'remove_from_active'
  /** Never touch active collections for this item (candidate / review-only / ineligible). */
  | 'keep_out_of_active';

export interface ActiveCollectionRouteInput {
  domain: KnowledgeEvolutionDomain;
  language: KnowledgeEvolutionLanguage;
  lifecycle: ActiveKnowledgeLifecycle;
  /** Whether an approval reference exists. Unapproved knowledge is never active-indexed. */
  approved: boolean;
}

export interface ActiveCollectionRoute {
  action: ActiveCollectionRouteAction;
  /** The physical active collection to add-to / remove-from; null when never active. */
  activeCollection: string | null;
  /** The separate review-only candidate collection (always reported, never conflated). */
  reviewOnlyCollection: typeof REVIEW_ONLY_CANDIDATE_COLLECTION;
  /** Human-readable justification for the decision (surfaced in reindex results/logs). */
  reason: string;
}

/** True when `domain` is eligible for active agent-facing retrieval (spec §21.2). */
export function isActiveRetrievalDomain(
  domain: KnowledgeEvolutionDomain,
): domain is KnowledgeRetrievalDomain {
  return ACTIVE_RETRIEVAL_DOMAIN_SET.has(domain);
}

/** The unprefixed logical collection name for a domain/language (spec §19.2 shape). */
export function logicalActiveCollection(
  domain: KnowledgeRetrievalDomain,
  language: KnowledgeEvolutionLanguage,
): string {
  return `${domain}_knowledge_${language}`;
}

/**
 * The physical `mcs_`-prefixed active collection for a retrieval-eligible domain/language.
 * Throws when the pair is not a ratified active collection (§19.2) — e.g. `personal`.
 */
export function activeKnowledgeCollection(
  domain: KnowledgeRetrievalDomain,
  language: KnowledgeEvolutionLanguage,
): string {
  const logical = logicalActiveCollection(domain, language);
  if (!LOGICAL_ACTIVE_COLLECTION_SET.has(logical)) {
    throw new Error(
      `[knowledge-evolution] no active collection for domain='${domain}' language='${language}' ` +
        `(not in ratified §19.2 active collection set)`,
    );
  }
  return `${ACTIVE_KNOWLEDGE_COLLECTION_PREFIX}${logical}`;
}

/**
 * Decide how a piece of evolving knowledge maps onto active-retrieval collections.
 *
 * Order is load-bearing — the candidate/approval gate is checked FIRST so that no
 * unapproved or review-only item can ever be routed to `index_active`, regardless of
 * domain or lifecycle.
 */
export function routeActiveKnowledgeCollection(
  input: ActiveCollectionRouteInput,
): ActiveCollectionRoute {
  const base = {
    reviewOnlyCollection: REVIEW_ONLY_CANDIDATE_COLLECTION,
  } as const;

  // 1. Hard gate: candidate / review-only / unapproved knowledge is NEVER active.
  if (input.lifecycle === 'candidate' || input.lifecycle === 'review_only') {
    return {
      ...base,
      action: 'keep_out_of_active',
      activeCollection: null,
      reason:
        `${input.lifecycle} knowledge stays in the review-only collection ` +
        `(${REVIEW_ONLY_CANDIDATE_COLLECTION}); it is never indexed into active retrieval`,
    };
  }
  if (!input.approved) {
    return {
      ...base,
      action: 'keep_out_of_active',
      activeCollection: null,
      reason: 'unapproved knowledge is never indexed into active retrieval',
    };
  }

  // 2. Domain eligibility gate (spec §21.2 — `personal` excluded).
  if (!isActiveRetrievalDomain(input.domain)) {
    return {
      ...base,
      action: 'keep_out_of_active',
      activeCollection: null,
      reason: `domain '${input.domain}' is not eligible for active retrieval`,
    };
  }

  const collection = activeKnowledgeCollection(input.domain, input.language);

  // 3. Superseded / archived knowledge is excluded from active retrieval (removed).
  if (input.lifecycle === 'superseded' || input.lifecycle === 'archived') {
    return {
      ...base,
      action: 'remove_from_active',
      activeCollection: collection,
      reason: `${input.lifecycle} knowledge is excluded from active retrieval`,
    };
  }

  // 4. Active + approved + eligible → index into the domain/language active collection.
  return {
    ...base,
    action: 'index_active',
    activeCollection: collection,
    reason: `active approved ${input.domain}/${input.language} knowledge routed to ${collection}`,
  };
}
