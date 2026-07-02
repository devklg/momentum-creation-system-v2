/**
 * Approved Knowledge Query Contract — context-layer validators (Phase 4 — P4.2).
 *
 * Runtime guards for the store-agnostic `approved_knowledge_query.v1` contract defined in
 * `@momentum/shared/runtime` (`knowledge-query.ts`). These validators enforce the Phase 4
 * boundary invariants at runtime:
 *
 *  - A query is scoped to Team Magnificent (tenant/team/BA) and a supported language.
 *  - A RESULT may carry ONLY approved/active `KnowledgeReference`s. Any candidate,
 *    queued-for-review, rejected, superseded, or archived item in `references` is a
 *    contract violation — candidate/review-only knowledge is excluded by default and only
 *    COUNTED in result metadata, never returned.
 *  - `candidateExcluded` is structurally `true` on every result; the excluded count and
 *    approved count must reconcile with the arrays.
 *  - A `degraded` result must say why (`degradeReasons`) — it is the fail-closed signal the
 *    Context Manager uses to assemble an empty-approved-knowledge packet rather than error.
 *
 * This module performs NO retrieval and imports NO store/PERSISTENCE/adapter client. It is a
 * pure contract guard consumed by the P4.4 Context Manager Retrieval Adapter and its tests.
 */

import type {
  McsApprovedKnowledgeExcludedItem,
  McsApprovedKnowledgeExclusionReason,
  McsApprovedKnowledgeQueryDegradeReason,
  McsApprovedKnowledgeQueryRequest,
  McsApprovedKnowledgeQueryResult,
  McsKnowledgeDomain,
  McsKnowledgeReference,
  McsRuntimeLanguage,
} from '@momentum/shared/runtime';
import { TEAM_MAGNIFICENT_KEY, TEAM_MAGNIFICENT_NAME } from './validation.js';

export const APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION = 'approved_knowledge_query.v1' as const;

export const KNOWLEDGE_DOMAINS = [
  'success',
  'training',
  'relationship',
  'performance',
  'organizational',
  'system',
  'governance',
] as const satisfies readonly McsKnowledgeDomain[];

/** Reference statuses that may appear in a result — approved/active ONLY. */
export const APPROVED_REFERENCE_STATUSES = ['approved', 'active'] as const;

export const APPROVED_KNOWLEDGE_SUPPORTED_LANGUAGES = ['en', 'es'] as const satisfies readonly McsRuntimeLanguage[];

export const APPROVED_KNOWLEDGE_EXCLUSION_REASONS = [
  'candidate_not_approved',
  'queued_for_review',
  'not_review_workflow',
] as const satisfies readonly McsApprovedKnowledgeExclusionReason[];

export const APPROVED_KNOWLEDGE_DEGRADE_REASONS = [
  'knowledge_unavailable',
  'no_approved_match',
  'language_unavailable',
  'scope_empty',
  'retrieval_timeout',
] as const satisfies readonly McsApprovedKnowledgeQueryDegradeReason[];

export type ApprovedKnowledgeQueryValidationCode =
  | 'invalid_object'
  | 'schema_version_invalid'
  | 'scope_invalid'
  | 'team_scope_invalid'
  | 'objective_invalid'
  | 'domains_invalid'
  | 'language_invalid'
  | 'max_results_invalid'
  | 'status_invalid'
  | 'references_invalid'
  | 'candidate_in_result'
  | 'excluded_invalid'
  | 'metadata_invalid'
  | 'count_mismatch'
  | 'degrade_reason_required';

export interface ApprovedKnowledgeQueryValidationIssue {
  path: string;
  code: ApprovedKnowledgeQueryValidationCode;
  message: string;
}

export type ApprovedKnowledgeQueryRequestValidationResult =
  | { ok: true; request: McsApprovedKnowledgeQueryRequest; errors: [] }
  | { ok: false; errors: ApprovedKnowledgeQueryValidationIssue[] };

export type ApprovedKnowledgeQueryResultValidationResult =
  | { ok: true; result: McsApprovedKnowledgeQueryResult; errors: [] }
  | { ok: false; errors: ApprovedKnowledgeQueryValidationIssue[] };

export class ApprovedKnowledgeQueryValidationError extends Error {
  readonly errors: ApprovedKnowledgeQueryValidationIssue[];

  constructor(message: string, errors: ApprovedKnowledgeQueryValidationIssue[]) {
    super(message);
    this.name = 'ApprovedKnowledgeQueryValidationError';
    this.errors = errors;
  }
}

export function validateApprovedKnowledgeQueryRequest(
  candidate: unknown,
): ApprovedKnowledgeQueryRequestValidationResult {
  const errors: ApprovedKnowledgeQueryValidationIssue[] = [];

  if (!isRecord(candidate)) {
    return { ok: false, errors: [issue('$', 'invalid_object', 'Query request must be an object.')] };
  }

  if (candidate.schemaVersion !== APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION) {
    errors.push(issue('schemaVersion', 'schema_version_invalid', 'schemaVersion must be approved_knowledge_query.v1.'));
  }

  validateScope(candidate.scope, errors);

  if (typeof candidate.objective !== 'string' || candidate.objective.trim().length === 0) {
    errors.push(issue('objective', 'objective_invalid', 'objective is required.'));
  }

  validateDomains(candidate.domains, errors);

  if (!APPROVED_KNOWLEDGE_SUPPORTED_LANGUAGES.includes(candidate.language as McsRuntimeLanguage)) {
    errors.push(issue('language', 'language_invalid', 'language must be en or es.'));
  }

  if (candidate.allowLanguageFallback !== undefined && typeof candidate.allowLanguageFallback !== 'boolean') {
    errors.push(issue('allowLanguageFallback', 'invalid_object', 'allowLanguageFallback must be a boolean when present.'));
  }

  if (candidate.maxResults !== undefined && !isPositiveInteger(candidate.maxResults)) {
    errors.push(issue('maxResults', 'max_results_invalid', 'maxResults must be a positive integer when present.'));
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, request: candidate as unknown as McsApprovedKnowledgeQueryRequest, errors: [] };
}

export function validateApprovedKnowledgeQueryResult(
  candidate: unknown,
): ApprovedKnowledgeQueryResultValidationResult {
  const errors: ApprovedKnowledgeQueryValidationIssue[] = [];

  if (!isRecord(candidate)) {
    return { ok: false, errors: [issue('$', 'invalid_object', 'Query result must be an object.')] };
  }

  if (candidate.schemaVersion !== APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION) {
    errors.push(issue('schemaVersion', 'schema_version_invalid', 'schemaVersion must be approved_knowledge_query.v1.'));
  }

  if (candidate.status !== 'ok' && candidate.status !== 'degraded') {
    errors.push(issue('status', 'status_invalid', 'status must be ok or degraded.'));
  }

  validateScope(candidate.scope, errors);

  const references = validateResultReferences(candidate.references, errors);
  const excluded = validateExcluded(candidate.excluded, errors);
  validateResultMetadata(candidate.metadata, references, excluded, errors);
  validateDegradeConsistency(candidate, references, errors);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, result: candidate as unknown as McsApprovedKnowledgeQueryResult, errors: [] };
}

export function assertApprovedKnowledgeQueryResult(
  candidate: unknown,
): asserts candidate is McsApprovedKnowledgeQueryResult {
  const result = validateApprovedKnowledgeQueryResult(candidate);
  if (!result.ok) {
    throw new ApprovedKnowledgeQueryValidationError(
      `Invalid approved_knowledge_query.v1 result: ${formatIssues(result.errors)}`,
      result.errors,
    );
  }
}

function validateScope(value: unknown, errors: ApprovedKnowledgeQueryValidationIssue[]): void {
  if (!isRecord(value)) {
    errors.push(issue('scope', 'scope_invalid', 'scope is required.'));
    return;
  }

  if (typeof value.tenantId !== 'string' || value.tenantId.trim().length === 0) {
    errors.push(issue('scope.tenantId', 'scope_invalid', 'scope.tenantId is required.'));
  }

  // teamKey/teamName, when present, must be Team Magnificent. A tenant-only scope omits
  // them entirely (the discriminated RuntimeScope union); only reject WRONG values.
  if (value.teamKey !== undefined && value.teamKey !== TEAM_MAGNIFICENT_KEY) {
    errors.push(issue('scope.teamKey', 'team_scope_invalid', 'scope.teamKey must be team_magnificent.'));
  }
  if (value.teamName !== undefined && value.teamName !== TEAM_MAGNIFICENT_NAME) {
    errors.push(issue('scope.teamName', 'team_scope_invalid', 'scope.teamName must be Team Magnificent.'));
  }
}

function validateDomains(value: unknown, errors: ApprovedKnowledgeQueryValidationIssue[]): void {
  if (!Array.isArray(value)) {
    errors.push(issue('domains', 'domains_invalid', 'domains must be an array (may be empty).'));
    return;
  }
  value.forEach((domain, index) => {
    if (!KNOWLEDGE_DOMAINS.includes(domain as McsKnowledgeDomain)) {
      errors.push(issue(`domains.${index}`, 'domains_invalid', `domains.${index} is not a known knowledge domain.`));
    }
  });
}

function validateResultReferences(
  value: unknown,
  errors: ApprovedKnowledgeQueryValidationIssue[],
): McsKnowledgeReference[] {
  if (!Array.isArray(value)) {
    errors.push(issue('references', 'references_invalid', 'references must be an array.'));
    return [];
  }

  value.forEach((reference, index) => {
    if (!isRecord(reference)) {
      errors.push(issue(`references.${index}`, 'references_invalid', 'reference must be an object.'));
      return;
    }
    if (typeof reference.knowledgeId !== 'string' || reference.knowledgeId.trim().length === 0) {
      errors.push(issue(`references.${index}.knowledgeId`, 'references_invalid', 'knowledgeId is required.'));
    }
    if (typeof reference.sourceId !== 'string' || reference.sourceId.trim().length === 0) {
      errors.push(issue(`references.${index}.sourceId`, 'references_invalid', 'sourceId is required.'));
    }
    if (!KNOWLEDGE_DOMAINS.includes(reference.domain as McsKnowledgeDomain)) {
      errors.push(issue(`references.${index}.domain`, 'references_invalid', 'reference.domain must be a known knowledge domain.'));
    }
    // The load-bearing governance check: ONLY approved/active may be returned.
    if (!APPROVED_REFERENCE_STATUSES.includes(reference.status as (typeof APPROVED_REFERENCE_STATUSES)[number])) {
      errors.push(issue(
        `references.${index}.status`,
        'candidate_in_result',
        'Only approved/active knowledge may appear in a result; candidate/review-only knowledge must be excluded, never returned.',
      ));
    }
  });

  return value as McsKnowledgeReference[];
}

function validateExcluded(
  value: unknown,
  errors: ApprovedKnowledgeQueryValidationIssue[],
): McsApprovedKnowledgeExcludedItem[] {
  if (!Array.isArray(value)) {
    errors.push(issue('excluded', 'excluded_invalid', 'excluded must be an array (may be empty).'));
    return [];
  }

  value.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(issue(`excluded.${index}`, 'excluded_invalid', 'excluded item must be an object.'));
      return;
    }
    if (typeof item.sourceId !== 'string' || item.sourceId.trim().length === 0) {
      errors.push(issue(`excluded.${index}.sourceId`, 'excluded_invalid', 'excluded.sourceId is required.'));
    }
    if (!APPROVED_KNOWLEDGE_EXCLUSION_REASONS.includes(item.reason as McsApprovedKnowledgeExclusionReason)) {
      errors.push(issue(`excluded.${index}.reason`, 'excluded_invalid', 'excluded.reason must be a known exclusion reason.'));
    }
  });

  return value as McsApprovedKnowledgeExcludedItem[];
}

function validateResultMetadata(
  value: unknown,
  references: McsKnowledgeReference[],
  excluded: McsApprovedKnowledgeExcludedItem[],
  errors: ApprovedKnowledgeQueryValidationIssue[],
): void {
  if (!isRecord(value)) {
    errors.push(issue('metadata', 'metadata_invalid', 'metadata is required.'));
    return;
  }

  if (value.candidateExcluded !== true) {
    errors.push(issue('metadata.candidateExcluded', 'metadata_invalid', 'metadata.candidateExcluded must be true.'));
  }

  if (typeof value.approvedCount !== 'number' || value.approvedCount !== references.length) {
    errors.push(issue('metadata.approvedCount', 'count_mismatch', 'metadata.approvedCount must equal references.length.'));
  }

  if (typeof value.candidateExcludedCount !== 'number' || value.candidateExcludedCount !== excluded.length) {
    errors.push(issue('metadata.candidateExcludedCount', 'count_mismatch', 'metadata.candidateExcludedCount must equal excluded.length.'));
  }

  if (!isRecord(value.language) || !APPROVED_KNOWLEDGE_SUPPORTED_LANGUAGES.includes(value.language.language as McsRuntimeLanguage)) {
    errors.push(issue('metadata.language', 'metadata_invalid', 'metadata.language is required with a supported language.'));
  }

  if (value.degradeReasons !== undefined) {
    if (!Array.isArray(value.degradeReasons) || value.degradeReasons.length === 0) {
      errors.push(issue('metadata.degradeReasons', 'metadata_invalid', 'metadata.degradeReasons must be a non-empty array when present.'));
    } else {
      value.degradeReasons.forEach((reason, index) => {
        if (!APPROVED_KNOWLEDGE_DEGRADE_REASONS.includes(reason as McsApprovedKnowledgeQueryDegradeReason)) {
          errors.push(issue(`metadata.degradeReasons.${index}`, 'metadata_invalid', 'unknown degrade reason.'));
        }
      });
    }
  }
}

function validateDegradeConsistency(
  candidate: Record<string, unknown>,
  references: McsKnowledgeReference[],
  errors: ApprovedKnowledgeQueryValidationIssue[],
): void {
  const metadata = isRecord(candidate.metadata) ? candidate.metadata : undefined;
  const degradeReasons = Array.isArray(metadata?.degradeReasons) ? metadata?.degradeReasons : undefined;

  // A degraded result must explain itself; a degraded result must not carry approved
  // references (fail-closed means empty-approved-knowledge, not partial).
  if (candidate.status === 'degraded') {
    if (!degradeReasons || degradeReasons.length === 0) {
      errors.push(issue('metadata.degradeReasons', 'degrade_reason_required', 'A degraded result must record at least one degradeReason.'));
    }
    if (references.length > 0) {
      errors.push(issue('references', 'references_invalid', 'A degraded result must carry no approved references (fail-closed).'));
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function issue(
  path: string,
  code: ApprovedKnowledgeQueryValidationCode,
  message: string,
): ApprovedKnowledgeQueryValidationIssue {
  return { path, code, message };
}

function formatIssues(errors: ApprovedKnowledgeQueryValidationIssue[]): string {
  return errors.map((error) => `${error.path}: ${error.message}`).join('; ');
}
