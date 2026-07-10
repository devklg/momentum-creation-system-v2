/**
 * Repository — `knowledge_evolution_errors` (spec §30).
 *
 * APPEND-ONLY failure log. No patch, no delete. Idempotent on `errorId`.
 */

import type {
  KnowledgeEvolutionError,
  KnowledgeEvolutionErrorType,
} from '@momentum/shared/runtime';
import {
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_EVOLUTION_ERROR_COLLECTION,
  validateKnowledgeEvolutionError,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_EVOLUTION_ERROR_COLLECTION;

function toDoc(error: KnowledgeEvolutionError): Record<string, unknown> {
  return { _id: error.errorId, ...error };
}

export async function recordEvolutionError(
  error: KnowledgeEvolutionError,
): Promise<KnowledgeEvolutionError> {
  const { ok, errors } = validateKnowledgeEvolutionError(error);
  if (!ok) throw new KnowledgeEvolutionValidationError('error', errors);

  if (await repoExists(COLLECTION, { _id: error.errorId })) {
    throw new KnowledgeEvolutionValidationError('error', [
      `evolution error ${error.errorId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(error));
  return error;
}

/** Idempotent append: returns the existing error if already recorded. */
export async function ensureEvolutionError(
  error: KnowledgeEvolutionError,
): Promise<KnowledgeEvolutionError> {
  const existing = await getEvolutionErrorById(error.errorId);
  if (existing) return existing;
  return recordEvolutionError(error);
}

export function getEvolutionErrorById(
  errorId: string,
): Promise<KnowledgeEvolutionError | null> {
  return repoFindOne<KnowledgeEvolutionError>(COLLECTION, { _id: errorId });
}

export function listEvolutionErrorsForEvolution(
  evolutionId: string,
  options: RepoFindOptions = { sort: { occurredAt: -1 } },
): Promise<KnowledgeEvolutionError[]> {
  return repoFind<KnowledgeEvolutionError>(COLLECTION, { evolutionId }, options);
}

export function listEvolutionErrorsByType(
  errorType: KnowledgeEvolutionErrorType,
  options: RepoFindOptions = { sort: { occurredAt: -1 } },
): Promise<KnowledgeEvolutionError[]> {
  return repoFind<KnowledgeEvolutionError>(COLLECTION, { errorType }, options);
}
