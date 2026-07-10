/**
 * Repository — `knowledge_retrieval_rollouts` (spec §21).
 *
 * Persists rollout records. Lane A NEVER activates retrieval: a rollout is
 * created `retrievalReady:false`, and while `markRetrievalReady` /
 * `markRetrievalBlocked` write the flag, the readiness DECISION (all gate
 * checks) is the core service's job (Lane B). The repository only records the
 * outcome it is told.
 */

import type { KnowledgeRetrievalRollout } from '@momentum/shared/runtime';
import {
  assertNoProtectedFields,
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_RETRIEVAL_ROLLOUT_COLLECTION,
  KNOWLEDGE_RETRIEVAL_ROLLOUT_PROTECTED_FIELDS,
  validateKnowledgeRetrievalRollout,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  repoPatch,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_RETRIEVAL_ROLLOUT_COLLECTION;

function toDoc(rollout: KnowledgeRetrievalRollout): Record<string, unknown> {
  return { _id: rollout.rolloutId, ...rollout };
}

export async function createRetrievalRollout(
  rollout: KnowledgeRetrievalRollout,
): Promise<KnowledgeRetrievalRollout> {
  const { ok, errors } = validateKnowledgeRetrievalRollout(rollout);
  if (!ok) throw new KnowledgeEvolutionValidationError('retrievalRollout', errors);

  if (await repoExists(COLLECTION, { _id: rollout.rolloutId })) {
    throw new KnowledgeEvolutionValidationError('retrievalRollout', [
      `retrieval rollout ${rollout.rolloutId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(rollout));
  return rollout;
}

export async function ensureRetrievalRollout(
  rollout: KnowledgeRetrievalRollout,
): Promise<KnowledgeRetrievalRollout> {
  const existing = await getRetrievalRolloutById(rollout.rolloutId);
  if (existing) return existing;
  return createRetrievalRollout(rollout);
}

export function getRetrievalRolloutById(
  rolloutId: string,
): Promise<KnowledgeRetrievalRollout | null> {
  return repoFindOne<KnowledgeRetrievalRollout>(COLLECTION, { _id: rolloutId });
}

export function getRetrievalRolloutByEvolutionId(
  evolutionId: string,
): Promise<KnowledgeRetrievalRollout | null> {
  return repoFindOne<KnowledgeRetrievalRollout>(COLLECTION, { evolutionId });
}

export function listRetrievalRollouts(
  filter: Record<string, unknown>,
  options: RepoFindOptions = {},
): Promise<KnowledgeRetrievalRollout[]> {
  return repoFind<KnowledgeRetrievalRollout>(COLLECTION, filter, options);
}

async function patchRollout(
  rolloutId: string,
  set: Record<string, unknown>,
): Promise<number> {
  assertNoProtectedFields('retrievalRollout', set, KNOWLEDGE_RETRIEVAL_ROLLOUT_PROTECTED_FIELDS);
  return repoPatch(COLLECTION, { _id: rolloutId }, set);
}

/** Flip a rollout to retrieval-ready. The gate decision is made upstream (Lane B). */
export function markRetrievalReady(
  rolloutId: string,
  readyAt: Date = new Date(),
): Promise<number> {
  return patchRollout(rolloutId, { retrievalReady: true, readyAt });
}

/** Record that a rollout is blocked (retrieval stays off) with a reason. */
export function markRetrievalBlocked(
  rolloutId: string,
  blockedReason: string,
): Promise<number> {
  return patchRollout(rolloutId, { retrievalReady: false, blockedReason });
}
