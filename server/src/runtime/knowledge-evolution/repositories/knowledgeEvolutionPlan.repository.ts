/**
 * Repository — `knowledge_evolution_plans` (spec §13).
 *
 * A plan is created before Knowledge Core state changes. Idempotent on `planId`.
 * Step-status advancement is a guarded patch; plan identity is immutable.
 */

import type {
  KnowledgeEvolutionPlan,
  KnowledgeEvolutionStep,
} from '@momentum/shared/runtime';
import {
  assertNoProtectedFields,
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_EVOLUTION_PLAN_COLLECTION,
  KNOWLEDGE_EVOLUTION_PLAN_PROTECTED_FIELDS,
  validateKnowledgeEvolutionPlan,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  repoPatch,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_EVOLUTION_PLAN_COLLECTION;

function toDoc(plan: KnowledgeEvolutionPlan): Record<string, unknown> {
  return { _id: plan.planId, ...plan };
}

export async function createEvolutionPlan(
  plan: KnowledgeEvolutionPlan,
): Promise<KnowledgeEvolutionPlan> {
  const { ok, errors } = validateKnowledgeEvolutionPlan(plan);
  if (!ok) throw new KnowledgeEvolutionValidationError('plan', errors);

  if (await repoExists(COLLECTION, { _id: plan.planId })) {
    throw new KnowledgeEvolutionValidationError('plan', [
      `evolution plan ${plan.planId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(plan));
  return plan;
}

export async function ensureEvolutionPlan(
  plan: KnowledgeEvolutionPlan,
): Promise<KnowledgeEvolutionPlan> {
  const existing = await getEvolutionPlanById(plan.planId);
  if (existing) return existing;
  return createEvolutionPlan(plan);
}

export function getEvolutionPlanById(
  planId: string,
): Promise<KnowledgeEvolutionPlan | null> {
  return repoFindOne<KnowledgeEvolutionPlan>(COLLECTION, { _id: planId });
}

export function getEvolutionPlanByEvolutionId(
  evolutionId: string,
): Promise<KnowledgeEvolutionPlan | null> {
  return repoFindOne<KnowledgeEvolutionPlan>(COLLECTION, { evolutionId });
}

export function listEvolutionPlans(
  filter: Record<string, unknown>,
  options: RepoFindOptions = {},
): Promise<KnowledgeEvolutionPlan[]> {
  return repoFind<KnowledgeEvolutionPlan>(COLLECTION, filter, options);
}

/** Guarded `$set` patch; plan identity is immutable. */
export async function patchEvolutionPlan(
  planId: string,
  set: Record<string, unknown>,
): Promise<number> {
  assertNoProtectedFields('plan', set, KNOWLEDGE_EVOLUTION_PLAN_PROTECTED_FIELDS);
  return repoPatch(COLLECTION, { _id: planId }, set);
}

/** Replace the required-steps array (e.g. after a step advances). */
export function updatePlanSteps(
  planId: string,
  requiredSteps: KnowledgeEvolutionStep[],
): Promise<number> {
  return patchEvolutionPlan(planId, { requiredSteps });
}
