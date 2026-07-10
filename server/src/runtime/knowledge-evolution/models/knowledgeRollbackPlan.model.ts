/**
 * Canonical model — `knowledge_rollback_plans` (spec §14).
 *
 * A rollback plan is REQUIRED for any retrieval-affecting evolution (spec §14,
 * §21). It records how to reverse the change while preserving audit history —
 * rollback restores prior versions, it never deletes them.
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import type { KnowledgeRollbackPlan } from '@momentum/shared/runtime';
import {
  optionalString,
  requireDate,
  requireEnum,
  requireString,
  requireStringArray,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_ROLLBACK_PLAN_COLLECTION = KNOWLEDGE_EVOLUTION_COLLECTIONS.rollbackPlans;

const ROLLBACK_TYPES = [
  'restore_previous_version',
  'mark_not_retrieval_ready',
  'archive_new_version',
  'restore_superseded_knowledge',
  'remove_active_embedding',
  'restore_graph_relationships',
] as const;

export function validateKnowledgeRollbackPlan(
  doc: Partial<KnowledgeRollbackPlan>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.rollbackPlanId, 'rollbackPlanId');
  requireString(errors, doc.evolutionId, 'evolutionId');
  requireEnum(errors, doc.rollbackType, 'rollbackType', ROLLBACK_TYPES);

  requireStringArray(errors, doc.previousKnowledgeObjectIds, 'previousKnowledgeObjectIds');
  if (!Array.isArray(doc.previousVersionNumbers)) {
    errors.push('previousVersionNumbers must be an array of numbers');
  } else if (
    !doc.previousVersionNumbers.every(
      (value) => typeof value === 'number' && Number.isFinite(value),
    )
  ) {
    errors.push('previousVersionNumbers must contain only finite numbers');
  }

  optionalString(errors, doc.rollbackReason, 'rollbackReason');
  requireDate(errors, doc.createdAt, 'createdAt');

  return result(errors);
}
