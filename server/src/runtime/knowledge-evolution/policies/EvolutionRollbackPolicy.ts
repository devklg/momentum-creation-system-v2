/**
 * Rollback Policy (spec §14).
 *
 * Every evolution action that affects active retrieval must have a rollback plan, and a rollback
 * plan must preserve history (never delete original evidence or approval records). This policy
 * checks that a rollback plan is present when required and that its shape is coherent for its
 * rollback type. Pure function, no I/O.
 */

import type {
  KnowledgeRollbackPlan,
  KnowledgeRollbackType,
} from '@momentum/shared/runtime';
import { policyFail, policyOk, type PolicyResult } from '../errors.js';

const VALID_ROLLBACK_TYPES: readonly KnowledgeRollbackType[] = [
  'restore_previous_version',
  'mark_not_retrieval_ready',
  'archive_new_version',
  'restore_superseded_knowledge',
  'remove_active_embedding',
  'restore_graph_relationships',
];

/** Rollback types that must name the prior knowledge object(s)/version(s) they restore. */
const RESTORE_TYPES_REQUIRING_PRIOR: readonly KnowledgeRollbackType[] = [
  'restore_previous_version',
  'restore_superseded_knowledge',
];

export interface RollbackRequirementInput {
  affectsRetrieval: boolean;
  rollbackPlan?: KnowledgeRollbackPlan | null;
}

/** A retrieval-affecting evolution requires a rollback plan (spec §14). */
export function evaluateRollbackRequirement(input: RollbackRequirementInput): PolicyResult {
  if (!input.affectsRetrieval) {
    return policyOk;
  }
  if (!input.rollbackPlan) {
    return policyFail({
      errorType: 'rollback_failed',
      reason: 'Retrieval-affecting evolution requires a rollback plan, but none was provided.',
      safeMessage: 'Knowledge evolution rejected: a rollback plan is required for retrieval-affecting changes.',
    });
  }
  return validateRollbackPlanShape(input.rollbackPlan);
}

/** Validates a rollback plan's shape and history-preserving invariants (spec §14). */
export function validateRollbackPlanShape(plan: KnowledgeRollbackPlan): PolicyResult {
  if (
    typeof plan.rollbackPlanId !== 'string' ||
    plan.rollbackPlanId.trim().length === 0 ||
    typeof plan.evolutionId !== 'string' ||
    plan.evolutionId.trim().length === 0
  ) {
    return policyFail({
      errorType: 'rollback_failed',
      reason: 'Rollback plan is missing rollbackPlanId or evolutionId.',
      safeMessage: 'Knowledge evolution rejected: rollback plan is malformed.',
    });
  }

  if (!VALID_ROLLBACK_TYPES.includes(plan.rollbackType)) {
    return policyFail({
      errorType: 'rollback_failed',
      reason: `Unknown rollback type ${String(plan.rollbackType)}.`,
      safeMessage: 'Knowledge evolution rejected: rollback plan has an invalid rollback type.',
    });
  }

  if (
    RESTORE_TYPES_REQUIRING_PRIOR.includes(plan.rollbackType) &&
    plan.previousKnowledgeObjectIds.length === 0 &&
    plan.previousVersionNumbers.length === 0
  ) {
    return policyFail({
      errorType: 'rollback_failed',
      reason: `Rollback type ${plan.rollbackType} must name the prior knowledge object(s) or version(s) it restores.`,
      safeMessage: 'Knowledge evolution rejected: rollback plan cannot restore without prior version lineage.',
    });
  }

  return policyOk;
}

export function requiresRollbackPlan(affectsRetrieval: boolean): boolean {
  return affectsRetrieval;
}
