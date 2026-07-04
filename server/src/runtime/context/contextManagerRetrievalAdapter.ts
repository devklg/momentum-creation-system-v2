/**
 * Context Manager Retrieval Adapter (Phase 4 — P4.4).
 *
 * The one sanctioned runtime edge that lets the Context Manager OBTAIN approved knowledge
 * for packet assembly. It calls the injected Knowledge Core boundary
 * (`listApprovedKnowledge`) — the only approved-knowledge access surface (see P4.3 audit) —
 * filters defensively to approved/active + scope/domain/language, and produces a validated
 * `approved_knowledge_query.v1` result plus a mapping to the `ContextReference` shape that
 * `buildContextPacket()` already accepts.
 *
 * Hard invariants (Phase 4 charter §5/§11):
 *  - Depends ONLY on an injected provider; constructs no store/PERSISTENCE/retrieval client and
 *    imports none. Persists nothing.
 *  - Calls ONLY `listApprovedKnowledge`. It cannot see `listCandidateKnowledgeForReview` —
 *    the provider type is narrowed so candidate/review-only knowledge is unreachable here.
 *  - Returns ONLY approved/active references; any non-approved item is recorded as an
 *    exclusion and never returned.
 *  - Fail-closed: a provider error, timeout, empty corpus, or language miss yields a
 *    `degraded`, empty-approved-knowledge result — never an error leak, never a candidate
 *    substitution, never a store fallback.
 *  - It does NOT assemble a packet. It feeds the assembler; the Context Manager
 *    (`buildContextPacket`) remains the sole `context_packet.v1` assembler.
 */

import type {
  McsApprovedKnowledgeExcludedItem,
  McsApprovedKnowledgeQueryDegradeReason,
  McsApprovedKnowledgeQueryRequest,
  McsApprovedKnowledgeQueryResult,
  McsKnowledgeId,
  McsKnowledgeReference,
  McsRuntimeLanguageMetadata,
} from '@momentum/shared/runtime';
import type { KnowledgeCoreBoundaryPort } from '../knowledge/knowledgeCore.js';
import type { ContextReference } from './contextManager.js';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  APPROVED_REFERENCE_STATUSES,
  ApprovedKnowledgeQueryValidationError,
  assertApprovedKnowledgeQueryResult,
  validateApprovedKnowledgeQueryRequest,
} from './approvedKnowledgeQueryContract.js';
import { resolveLanguageSelection } from './languageAwareRetrieval.js';
import { classifyFreshness } from './freshnessGuard.js';
import {
  buildRetrievalObservabilityRecord,
  type RetrievalObservabilityInput,
  type RetrievalObservabilityRecord,
} from './retrievalObservability.js';

/**
 * Narrowed approved-knowledge provider. Intentionally `Pick<…, 'listApprovedKnowledge'>` so
 * the adapter has NO access to `listCandidateKnowledgeForReview`: candidate/review-only
 * knowledge is structurally unreachable from the retrieval path.
 */
export type ApprovedKnowledgeProvider = Pick<KnowledgeCoreBoundaryPort, 'listApprovedKnowledge'>;

/** P4.8 — retrieval observability sink. Receives one content-free record per retrieval call. */
export type RetrievalObservabilitySink = (record: RetrievalObservabilityRecord) => void;

/**
 * Optional adapter options.
 * - `now` (P4.7) injects the clock for the freshness guard so expiry/staleness evaluation is
 *   deterministic in tests; it defaults to the system clock. The request's `freshness.asOf`,
 *   when a valid timestamp, overrides this per call.
 * - `onRetrievalObservability` (P4.8) receives a content-free observability record on every
 *   outcome. Absent ⇒ nothing is built or emitted (zero overhead, behavior identical to
 *   pre-P4.8). A throwing sink never corrupts the returned result.
 */
export interface ContextManagerRetrievalAdapterOptions {
  now?: () => Date;
  onRetrievalObservability?: RetrievalObservabilitySink;
}

export interface ContextManagerRetrievalAdapter {
  /**
   * Retrieve approved knowledge for the request through the Knowledge Core boundary.
   * Always resolves to a validated `approved_knowledge_query.v1` result; never rejects for a
   * provider failure (it degrades). Rejects only for a malformed REQUEST (caller bug).
   */
  retrieveApprovedKnowledge(
    request: McsApprovedKnowledgeQueryRequest,
  ): Promise<McsApprovedKnowledgeQueryResult>;
}

/**
 * Build the adapter over an injected approved-knowledge provider (the Knowledge Core
 * boundary). The provider is the only dependency; the adapter constructs nothing.
 */
export function createContextManagerRetrievalAdapter(
  provider: ApprovedKnowledgeProvider,
  options: ContextManagerRetrievalAdapterOptions = {},
): ContextManagerRetrievalAdapter {
  const clock = options.now ?? (() => new Date());
  const sink = options.onRetrievalObservability;
  return {
    async retrieveApprovedKnowledge(request) {
      const validation = validateApprovedKnowledgeQueryRequest(request);
      if (!validation.ok) {
        // A malformed request is a programming error in the caller, not a retrieval
        // failure — surface it rather than silently degrading.
        throw new ApprovedKnowledgeQueryValidationError(
          'Invalid approved_knowledge_query.v1 request supplied to retrieval adapter.',
          validation.errors,
        );
      }

      let raw: readonly McsKnowledgeReference[];
      try {
        raw = await provider.listApprovedKnowledge(request.scope);
      } catch {
        // Fail-closed: any boundary failure/timeout degrades to empty approved knowledge.
        const result = degradedResult(request, ['knowledge_unavailable'], []);
        emitObservability(sink, {
          request,
          result,
          rawCount: 0,
          statusDomainKeptCount: 0,
          freshKeptCount: 0,
          freshnessExclusions: {},
          candidateExcludedSourceIds: [],
          observedAt: sink ? clock().toISOString() : undefined,
        });
        return result;
      }

      const excluded: McsApprovedKnowledgeExcludedItem[] = [];
      const statusDomainKept: McsKnowledgeReference[] = [];

      for (const reference of raw) {
        if (!APPROVED_REFERENCE_STATUSES.includes(reference.status as (typeof APPROVED_REFERENCE_STATUSES)[number])) {
          // Defensive: the boundary should only return approved/active, but if anything
          // else appears it is excluded, never returned.
          excluded.push({ sourceId: reference.sourceId, reason: 'candidate_not_approved' });
          continue;
        }
        if (request.domains.length > 0 && !request.domains.includes(reference.domain)) {
          continue; // out of requested domain — a non-match, not an exclusion
        }
        statusDomainKept.push(reference);
      }

      // Sample the freshness clock AFTER the provider await (pre-P4.8 timing), and derive
      // observedAt from the same instant. Both are only needed from here on.
      const now = clock();
      const observedAt = sink ? now.toISOString() : undefined;

      // P4.7 — freshness/deprecation guard. Runs before language selection (freshness is
      // language-independent). A stale/deprecated/superseded/expired/not-yet-effective reference
      // is a non-match (dropped like out-of-domain); a reference without freshness metadata is
      // always current. The guard resolves `freshness.asOf` (when valid) over the injected clock.
      // P4.8 — classify (not just filter) so the freshness-exclusion tally is available for the
      // observability record in the same pass.
      const { fresh: freshKept, excluded: freshnessExclusions } = classifyFreshness(
        statusDomainKept,
        request.freshness,
        now,
      );

      const candidateExcludedSourceIds = excluded.map((item) => item.sourceId);
      const emit = (result: McsApprovedKnowledgeQueryResult): void => {
        emitObservability(sink, {
          request,
          result,
          rawCount: raw.length,
          statusDomainKeptCount: statusDomainKept.length,
          freshKeptCount: freshKept.length,
          freshnessExclusions,
          candidateExcludedSourceIds,
          observedAt,
        });
      };

      // P4.6 — language-aware selection over the status/domain/freshness-filtered references. The
      // resolver honors `allowLanguageFallback`, applies the priority ladder (same-language →
      // human/native fallback → MARKED machine translation → language-neutral), and marks the
      // batch honestly.
      const selection = resolveLanguageSelection(freshKept, request);

      if (selection.status === 'degraded') {
        const reason: McsApprovedKnowledgeQueryDegradeReason =
          freshKept.length > 0 ? (selection.degradeReason ?? 'language_unavailable') : 'no_approved_match';
        const result = degradedResult(request, [reason], excluded);
        emit(result);
        return result;
      }

      const limited =
        request.maxResults !== undefined ? selection.references.slice(0, request.maxResults) : selection.references;

      const result: McsApprovedKnowledgeQueryResult = {
        schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
        status: 'ok',
        scope: request.scope,
        references: limited,
        excluded,
        metadata: {
          approvedCount: limited.length,
          candidateExcludedCount: excluded.length,
          candidateExcluded: true,
          language: selection.language,
        },
      };

      assertApprovedKnowledgeQueryResult(result);
      emit(result);
      return result;
    },
  };
}

/** Build and emit the observability record, isolating any sink exception from retrieval. */
function emitObservability(
  sink: RetrievalObservabilitySink | undefined,
  input: RetrievalObservabilityInput,
): void {
  if (!sink) return;
  let record: RetrievalObservabilityRecord;
  try {
    record = buildRetrievalObservabilityRecord(input);
  } catch {
    return; // never let observability construction corrupt retrieval
  }
  try {
    sink(record);
  } catch {
    // A throwing sink must not change the returned result.
  }
}

/**
 * Map a validated approved-knowledge query result into the `ContextReference[]` that
 * `buildContextPacket()` accepts as `knowledgeReferences`. Every produced reference is
 * `kind: 'approved_knowledge'`, `status: 'approved'`. A degraded result maps to `[]`
 * (empty approved knowledge), preserving fail-closed assembly.
 *
 * The `summary` is a deterministic structural descriptor derived from the reference
 * identity/domain — body enrichment (real knowledge text) is a downstream slice (P4.5+);
 * the corpus is not wired yet (P4.3 audit §8).
 *
 * P4.6: each reference carries its OWN real `language` and `translationStatus` — never the
 * batch value — so a machine translation (even one already in the primary language) can never
 * be assembled into the packet as native (`same_language`). The resolver guarantees a single
 * homogeneous quality tier, so per-item marking and the batch metadata agree; per-item is used
 * here as defense-in-depth against ever laundering a marking.
 */
export function toContextReferences(result: McsApprovedKnowledgeQueryResult): ContextReference[] {
  if (result.status === 'degraded') return [];
  return result.references.map((reference) => ({
    sourceId: reference.sourceId,
    kind: 'approved_knowledge',
    status: 'approved',
    knowledgeId: reference.knowledgeId,
    title: reference.title,
    summary: reference.summary ?? structuralSummary(reference.domain, reference.knowledgeId),
    language: reference.language,
    translationStatus: reference.translationStatus,
  }));
}

function degradedResult(
  request: McsApprovedKnowledgeQueryRequest,
  degradeReasons: readonly McsApprovedKnowledgeQueryDegradeReason[],
  excluded: McsApprovedKnowledgeExcludedItem[],
): McsApprovedKnowledgeQueryResult {
  const result: McsApprovedKnowledgeQueryResult = {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    status: 'degraded',
    scope: request.scope,
    references: [],
    excluded,
    metadata: {
      approvedCount: 0,
      candidateExcludedCount: excluded.length,
      candidateExcluded: true,
      language: sameLanguageMetadata(request),
      degradeReasons,
    },
  };
  assertApprovedKnowledgeQueryResult(result);
  return result;
}

function sameLanguageMetadata(request: McsApprovedKnowledgeQueryRequest): McsRuntimeLanguageMetadata {
  return {
    language: request.language,
    translationStatus: 'same_language',
    machineTranslationUsed: false,
    humanReviewed: true,
  };
}

function structuralSummary(domain: string, knowledgeId: McsKnowledgeId): string {
  return `Approved ${domain} knowledge reference ${String(knowledgeId)}`;
}
