/**
 * Knowledge Retrieval Observability (Phase 4 — P4.8).
 *
 * A pure assembler that turns the facts a retrieval already computed into a content-free
 * `RetrievalObservabilityRecord`. It reads no clock and performs no I/O — `observedAt` is passed
 * in by the adapter (from its injected clock) so the builder is deterministic.
 *
 * Compliance: the record carries identifiers, domains, objective, counts, exclusion reasons, and
 * the honest language marking — NEVER knowledge body/summary text and none of the five
 * `.com`-prohibited items. Observability is BA/admin-facing and is never wired to `apps/com`.
 */

import type {
  ApprovedKnowledgeQueryDegradeReason,
  ApprovedKnowledgeQueryRequest,
  ApprovedKnowledgeQueryResult,
  KnowledgeDomain,
  KnowledgeId,
  RuntimeLanguage,
  RuntimeLanguageMetadata,
  RuntimeRequestScope,
  SourceId,
} from '@momentum/shared/runtime';
import type { FreshnessExclusionVerdict } from './freshnessGuard.js';

export const KNOWLEDGE_RETRIEVAL_OBSERVABILITY_SCHEMA_VERSION =
  'knowledge_retrieval_observability.v1' as const;

/** Identity-only projection of the request scope (no content). */
export interface RetrievalObservabilityScope {
  tenantId: string;
  teamId?: string;
  baId?: string;
  requestId?: string;
  sessionId?: string;
}

/** The retrieval funnel: how many references survived each filter stage. */
export interface RetrievalStageCounts {
  raw: number;
  candidateExcluded: number;
  statusDomainKept: number;
  freshKept: number;
  selected: number;
}

export interface RetrievalObservabilityRecord {
  schemaVersion: typeof KNOWLEDGE_RETRIEVAL_OBSERVABILITY_SCHEMA_VERSION;
  observedAt?: string;
  scope: RetrievalObservabilityScope;
  /**
   * The request's intent tag (e.g. `training_support`), copied verbatim. It is the only
   * free-text field; it is sourced from the request, never from knowledge content. Callers must
   * keep it a short intent tag — never route prospect/user free text through it.
   */
  objective: string;
  domains: readonly KnowledgeDomain[];
  requestedLanguage: RuntimeLanguage;
  allowLanguageFallback: boolean;
  outcome: 'ok' | 'degraded';
  degradeReasons?: readonly ApprovedKnowledgeQueryDegradeReason[];
  stageCounts: RetrievalStageCounts;
  freshnessExclusions: Partial<Record<FreshnessExclusionVerdict, number>>;
  language: RuntimeLanguageMetadata;
  fallbackUsed: boolean;
  machineTranslationUsed: boolean;
  selectedKnowledgeIds: readonly KnowledgeId[];
  candidateExcludedSourceIds: readonly SourceId[];
}

export interface RetrievalObservabilityInput {
  request: ApprovedKnowledgeQueryRequest;
  result: ApprovedKnowledgeQueryResult;
  rawCount: number;
  statusDomainKeptCount: number;
  freshKeptCount: number;
  freshnessExclusions: Partial<Record<FreshnessExclusionVerdict, number>>;
  candidateExcludedSourceIds: readonly SourceId[];
  observedAt?: string;
}

function scopeProjection(scope: RuntimeRequestScope): RetrievalObservabilityScope {
  const record = scope as {
    tenantId: string;
    teamId?: string;
    baId?: string;
    requestId?: string;
    sessionId?: string;
  };
  const projection: RetrievalObservabilityScope = { tenantId: record.tenantId };
  if (record.teamId !== undefined) projection.teamId = record.teamId;
  if (record.baId !== undefined) projection.baId = record.baId;
  if (record.requestId !== undefined) projection.requestId = record.requestId;
  if (record.sessionId !== undefined) projection.sessionId = record.sessionId;
  return projection;
}

/**
 * Assemble the observability record from facts the adapter already computed. Pure and
 * content-free.
 */
export function buildRetrievalObservabilityRecord(
  input: RetrievalObservabilityInput,
): RetrievalObservabilityRecord {
  const { request, result } = input;
  const languageMetadata = result.metadata.language;
  const selectedKnowledgeIds = result.references.map((reference) => reference.knowledgeId);

  // Defensive copies: the record must never alias the caller's `request` or the just-returned
  // `result`, so a mutating sink can never reach either. (scope + selectedKnowledgeIds are
  // already fresh objects/arrays.)
  const record: RetrievalObservabilityRecord = {
    schemaVersion: KNOWLEDGE_RETRIEVAL_OBSERVABILITY_SCHEMA_VERSION,
    scope: scopeProjection(request.scope),
    objective: request.objective,
    domains: [...request.domains],
    requestedLanguage: request.language,
    allowLanguageFallback: request.allowLanguageFallback === true,
    outcome: result.status,
    stageCounts: {
      raw: input.rawCount,
      candidateExcluded: input.candidateExcludedSourceIds.length,
      statusDomainKept: input.statusDomainKeptCount,
      freshKept: input.freshKeptCount,
      selected: result.references.length,
    },
    freshnessExclusions: { ...input.freshnessExclusions },
    language: { ...languageMetadata },
    fallbackUsed: languageMetadata.fallbackLanguage !== undefined,
    machineTranslationUsed: languageMetadata.machineTranslationUsed,
    selectedKnowledgeIds,
    candidateExcludedSourceIds: [...input.candidateExcludedSourceIds],
  };

  if (input.observedAt !== undefined) record.observedAt = input.observedAt;
  if (result.metadata.degradeReasons !== undefined) record.degradeReasons = [...result.metadata.degradeReasons];

  return record;
}
