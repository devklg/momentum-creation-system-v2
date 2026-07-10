/**
 * Repository — `knowledge_rollback_plans` (spec §14).
 *
 * Persists rollback plans. Append-oriented and idempotent on `rollbackPlanId`;
 * a rollback plan is a record of how to reverse an evolution while preserving
 * prior versions — this layer stores it, execution is Lane B/D.
 */

import type { KnowledgeRollbackPlan } from '@momentum/shared/runtime';
import {
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_ROLLBACK_PLAN_COLLECTION,
  validateKnowledgeRollbackPlan,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_ROLLBACK_PLAN_COLLECTION;

function toDoc(plan: KnowledgeRollbackPlan): Record<string, unknown> {
  return { _id: plan.rollbackPlanId, ...plan };
}

export async function createRollbackPlan(
  plan: KnowledgeRollbackPlan,
): Promise<KnowledgeRollbackPlan> {
  const { ok, errors } = validateKnowledgeRollbackPlan(plan);
  if (!ok) throw new KnowledgeEvolutionValidationError('rollbackPlan', errors);

  if (await repoExists(COLLECTION, { _id: plan.rollbackPlanId })) {
    throw new KnowledgeEvolutionValidationError('rollbackPlan', [
      `rollback plan ${plan.rollbackPlanId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(plan));
  return plan;
}

export async function ensureRollbackPlan(
  plan: KnowledgeRollbackPlan,
): Promise<KnowledgeRollbackPlan> {
  const existing = await getRollbackPlanById(plan.rollbackPlanId);
  if (existing) return existing;
  return createRollbackPlan(plan);
}

export function getRollbackPlanById(
  rollbackPlanId: string,
): Promise<KnowledgeRollbackPlan | null> {
  return repoFindOne<KnowledgeRollbackPlan>(COLLECTION, { _id: rollbackPlanId });
}

export function getRollbackPlanByEvolutionId(
  evolutionId: string,
): Promise<KnowledgeRollbackPlan | null> {
  return repoFindOne<KnowledgeRollbackPlan>(COLLECTION, { evolutionId });
}

export function listRollbackPlans(
  filter: Record<string, unknown>,
  options: RepoFindOptions = {},
): Promise<KnowledgeRollbackPlan[]> {
  return repoFind<KnowledgeRollbackPlan>(COLLECTION, filter, options);
}
