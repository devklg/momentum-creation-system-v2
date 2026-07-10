/**
 * Knowledge Evolution — model validation primitives (Lane A).
 *
 * Pure, dependency-free field validators used by every canonical model. They
 * accumulate human-readable errors into an `errors: string[]` rather than
 * throwing per-field, so a model can report ALL problems with a document at
 * once. Enum membership is checked against the Lane-0 shared constant arrays so
 * there is a single source of truth (spec §§10–11, §22, §5).
 *
 * These validators enforce the domain contract; they never touch persistence.
 */

import {
  KNOWLEDGE_EVOLUTION_SUPPORTED_LANGUAGES,
  KNOWLEDGE_EVOLUTION_TEAM_KEY,
  KNOWLEDGE_EVOLUTION_TEAM_NAME,
} from '@momentum/shared/runtime';
import type { KnowledgeApprovalReference } from '@momentum/shared/runtime';

/** Raised when a repository is asked to persist a document that fails validation. */
export class KnowledgeEvolutionValidationError extends Error {
  constructor(
    public readonly entity: string,
    public readonly errors: string[],
  ) {
    super(`[knowledge-evolution:${entity}] invalid document: ${errors.join('; ')}`);
    this.name = 'KnowledgeEvolutionValidationError';
  }
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function requireString(
  errors: string[],
  value: unknown,
  field: string,
): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string`);
  }
}

export function optionalString(
  errors: string[],
  value: unknown,
  field: string,
): void {
  if (value === undefined) return;
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${field}, when present, must be a non-empty string`);
  }
}

export function requireEnum<T extends string>(
  errors: string[],
  value: unknown,
  field: string,
  allowed: readonly T[],
): void {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    errors.push(`${field} must be one of: ${allowed.join(', ')}`);
  }
}

export function optionalEnum<T extends string>(
  errors: string[],
  value: unknown,
  field: string,
  allowed: readonly T[],
): void {
  if (value === undefined) return;
  requireEnum(errors, value, field, allowed);
}

/** Dates persisted through the app stack are `Date` instances (spec §11 uses Date). */
export function requireDate(errors: string[], value: unknown, field: string): void {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    errors.push(`${field} must be a valid Date`);
  }
}

export function optionalDate(errors: string[], value: unknown, field: string): void {
  if (value === undefined) return;
  requireDate(errors, value, field);
}

export function requireNumber(errors: string[], value: unknown, field: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${field} must be a finite number`);
  }
}

export function optionalNumber(errors: string[], value: unknown, field: string): void {
  if (value === undefined) return;
  requireNumber(errors, value, field);
}

export function requireBoolean(errors: string[], value: unknown, field: string): void {
  if (typeof value !== 'boolean') {
    errors.push(`${field} must be a boolean`);
  }
}

/** A present array of non-empty strings (may be empty unless `nonEmpty`). */
export function requireStringArray(
  errors: string[],
  value: unknown,
  field: string,
  opts: { nonEmpty?: boolean } = {},
): void {
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array of strings`);
    return;
  }
  if (opts.nonEmpty && value.length === 0) {
    errors.push(`${field} must contain at least one entry`);
  }
  if (!value.every((item) => typeof item === 'string' && item.trim().length > 0)) {
    errors.push(`${field} must contain only non-empty strings`);
  }
}

/** Language must be one of the supported runtime languages (spec §22). */
export function requireLanguage(errors: string[], value: unknown, field = 'language'): void {
  requireEnum(errors, value, field, KNOWLEDGE_EVOLUTION_SUPPORTED_LANGUAGES);
}

export function optionalLanguage(errors: string[], value: unknown, field = 'language'): void {
  if (value === undefined) return;
  requireLanguage(errors, value, field);
}

/**
 * Team Magnificent scope guard (spec §5). This runtime mirrors ONLY the Team
 * Magnificent slice: `teamKey` and `teamName` are pinned literals and must be
 * present verbatim. `teamId` must be a non-empty string.
 */
export function requireTeamMagnificentScope(
  errors: string[],
  doc: { teamId?: unknown; teamKey?: unknown; teamName?: unknown },
): void {
  requireString(errors, doc.teamId, 'teamId');
  if (doc.teamKey !== KNOWLEDGE_EVOLUTION_TEAM_KEY) {
    errors.push(`teamKey must be '${KNOWLEDGE_EVOLUTION_TEAM_KEY}'`);
  }
  if (doc.teamName !== KNOWLEDGE_EVOLUTION_TEAM_NAME) {
    errors.push(`teamName must be '${KNOWLEDGE_EVOLUTION_TEAM_NAME}'`);
  }
}

/** Optional Team Magnificent scope (rollout/language/error records where team is optional). */
export function optionalTeamMagnificentScope(
  errors: string[],
  doc: { teamId?: unknown; teamKey?: unknown; teamName?: unknown },
): void {
  if (doc.teamId === undefined && doc.teamKey === undefined && doc.teamName === undefined) {
    return;
  }
  requireTeamMagnificentScope(errors, doc);
}

/**
 * Approval reference guard (spec §12). Every material evolution requires a valid
 * approval reference — Knowledge Evolution NEVER approves knowledge, it only
 * acts on an approval already granted upstream.
 */
export function requireApprovalReference(
  errors: string[],
  value: unknown,
  field = 'approvalReference',
): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be an approval reference object`);
    return;
  }
  const ref = value as Partial<KnowledgeApprovalReference>;
  requireString(errors, ref.approvalId, `${field}.approvalId`);
  requireString(errors, ref.approvedBy, `${field}.approvedBy`);
  requireEnum(errors, ref.approvalType, `${field}.approvalType`, [
    'review_workflow',
    'knowledge_session',
    'governance_decision',
    'admin_decision',
  ] as const);
  requireDate(errors, ref.approvedAt, `${field}.approvedAt`);
}

export function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors };
}

/**
 * Guard against rewriting immutable identity/lineage fields on a `$set` patch.
 * Keeps `repoPatch` (which structurally can only add, never remove) from
 * *overwriting* audit-critical fields — the domain-level half of the
 * "never erase prior versions" invariant (spec §16, §29).
 */
export function assertNoProtectedFields(
  entity: string,
  set: Record<string, unknown>,
  protectedFields: readonly string[],
): void {
  const violations = protectedFields.filter((field) => field in set);
  if (violations.length > 0) {
    throw new KnowledgeEvolutionValidationError(entity, [
      `patch may not modify immutable field(s): ${violations.join(', ')}`,
    ]);
  }
}
