/**
 * Canonical model — `knowledge_evolution_errors` (spec §30).
 *
 * Append-only failure log. Every error carries both a raw `message` (internal)
 * and a `safeMessage` (privacy-guarded, safe to surface) plus a `retryable`
 * flag so operators/workers can decide replay behavior (spec §30).
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import type { KnowledgeEvolutionError } from '@momentum/shared/runtime';
import {
  optionalString,
  requireBoolean,
  requireDate,
  requireEnum,
  requireString,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_EVOLUTION_ERROR_COLLECTION = KNOWLEDGE_EVOLUTION_COLLECTIONS.errors;

const ERROR_TYPES = [
  'approval_missing',
  'candidate_not_approved',
  'source_missing',
  'invalid_team_scope',
  'invalid_ba_scope',
  'invalid_language',
  'knowledge_core_write_failed',
  'version_creation_failed',
  'supersession_failed',
  'archive_failed',
  'reindex_failed',
  'graph_sync_failed',
  'retrieval_rollout_failed',
  'rollback_failed',
  'permission_denied',
] as const;

export function validateKnowledgeEvolutionError(
  doc: Partial<KnowledgeEvolutionError>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.errorId, 'errorId');
  requireEnum(errors, doc.errorType, 'errorType', ERROR_TYPES);

  requireString(errors, doc.tenantId, 'tenantId');
  optionalString(errors, doc.teamId, 'teamId');

  optionalString(errors, doc.evolutionId, 'evolutionId');
  optionalString(errors, doc.knowledgeObjectId, 'knowledgeObjectId');
  optionalString(errors, doc.candidateId, 'candidateId');

  requireString(errors, doc.message, 'message');
  requireString(errors, doc.safeMessage, 'safeMessage');
  requireBoolean(errors, doc.retryable, 'retryable');
  requireDate(errors, doc.occurredAt, 'occurredAt');

  return result(errors);
}
