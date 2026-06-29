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
 *  - Depends ONLY on an injected provider; constructs no store/Gateway/retrieval client and
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
  ApprovedKnowledgeExcludedItem,
  ApprovedKnowledgeQueryDegradeReason,
  ApprovedKnowledgeQueryRequest,
  ApprovedKnowledgeQueryResult,
  KnowledgeId,
  KnowledgeReference,
  RuntimeLanguageMetadata,
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

/**
 * Narrowed approved-knowledge provider. Intentionally `Pick<…, 'listApprovedKnowledge'>` so
 * the adapter has NO access to `listCandidateKnowledgeForReview`: candidate/review-only
 * knowledge is structurally unreachable from the retrieval path.
 */
export type ApprovedKnowledgeProvider = Pick<KnowledgeCoreBoundaryPort, 'listApprovedKnowledge'>;

export interface ContextManagerRetrievalAdapter {
  /**
   * Retrieve approved knowledge for the request through the Knowledge Core boundary.
   * Always resolves to a validated `approved_knowledge_query.v1` result; never rejects for a
   * provider failure (it degrades). Rejects only for a malformed REQUEST (caller bug).
   */
  retrieveApprovedKnowledge(
    request: ApprovedKnowledgeQueryRequest,
  ): Promise<ApprovedKnowledgeQueryResult>;
}

/**
 * Build the adapter over an injected approved-knowledge provider (the Knowledge Core
 * boundary). The provider is the only dependency; the adapter constructs nothing.
 */
export function createContextManagerRetrievalAdapter(
  provider: ApprovedKnowledgeProvider,
): ContextManagerRetrievalAdapter {
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

      let raw: readonly KnowledgeReference[];
      try {
        raw = await provider.listApprovedKnowledge(request.scope);
      } catch {
        // Fail-closed: any boundary failure/timeout degrades to empty approved knowledge.
        return degradedResult(request, ['knowledge_unavailable'], []);
      }

      const excluded: ApprovedKnowledgeExcludedItem[] = [];
      const statusDomainKept: KnowledgeReference[] = [];

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

      // P4.4 retrieves same-language only; language FALLBACK selection is deferred to P4.6.
      // The `allowLanguageFallback` flag is carried by the contract but not yet exercised.
      const languageKept = statusDomainKept.filter((reference) => reference.language === request.language);

      if (languageKept.length === 0) {
        const reason: ApprovedKnowledgeQueryDegradeReason =
          statusDomainKept.length > 0 ? 'language_unavailable' : 'no_approved_match';
        return degradedResult(request, [reason], excluded);
      }

      const limited =
        request.maxResults !== undefined ? languageKept.slice(0, request.maxResults) : languageKept;

      const result: ApprovedKnowledgeQueryResult = {
        schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
        status: 'ok',
        scope: request.scope,
        references: limited,
        excluded,
        metadata: {
          approvedCount: limited.length,
          candidateExcludedCount: excluded.length,
          candidateExcluded: true,
          language: sameLanguageMetadata(request),
        },
      };

      assertApprovedKnowledgeQueryResult(result);
      return result;
    },
  };
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
 */
export function toContextReferences(result: ApprovedKnowledgeQueryResult): ContextReference[] {
  if (result.status === 'degraded') return [];
  return result.references.map((reference) => ({
    sourceId: reference.sourceId,
    kind: 'approved_knowledge',
    status: 'approved',
    knowledgeId: reference.knowledgeId,
    summary: structuralSummary(reference.domain, reference.knowledgeId),
  }));
}

function degradedResult(
  request: ApprovedKnowledgeQueryRequest,
  degradeReasons: readonly ApprovedKnowledgeQueryDegradeReason[],
  excluded: ApprovedKnowledgeExcludedItem[],
): ApprovedKnowledgeQueryResult {
  const result: ApprovedKnowledgeQueryResult = {
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

function sameLanguageMetadata(request: ApprovedKnowledgeQueryRequest): RuntimeLanguageMetadata {
  return {
    language: request.language,
    translationStatus: 'same_language',
    machineTranslationUsed: false,
    humanReviewed: true,
  };
}

function structuralSummary(domain: string, knowledgeId: KnowledgeId): string {
  return `Approved ${domain} knowledge reference ${String(knowledgeId)}`;
}
