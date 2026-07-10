/**
 * Repository — `knowledge_language_evolution_records` (spec §22).
 *
 * Persists EN/ES variant lineage. Idempotent on `languageEvolutionId`.
 * `updateTranslationStatus` advances the review→approve→activate lifecycle; the
 * human-review gate for machine translation is enforced by the bilingual policy
 * (Lane B) before `active` is reached. Identity/lineage fields are immutable.
 */

import type {
  KnowledgeLanguageEvolutionRecord,
  KnowledgeLanguageTranslationStatus,
} from '@momentum/shared/runtime';
import {
  assertNoProtectedFields,
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_LANGUAGE_EVOLUTION_COLLECTION,
  KNOWLEDGE_LANGUAGE_EVOLUTION_PROTECTED_FIELDS,
  validateKnowledgeLanguageEvolutionRecord,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  repoPatch,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_LANGUAGE_EVOLUTION_COLLECTION;

function toDoc(record: KnowledgeLanguageEvolutionRecord): Record<string, unknown> {
  return { _id: record.languageEvolutionId, ...record };
}

export async function createLanguageEvolutionRecord(
  record: KnowledgeLanguageEvolutionRecord,
): Promise<KnowledgeLanguageEvolutionRecord> {
  const { ok, errors } = validateKnowledgeLanguageEvolutionRecord(record);
  if (!ok) throw new KnowledgeEvolutionValidationError('languageEvolution', errors);

  if (await repoExists(COLLECTION, { _id: record.languageEvolutionId })) {
    throw new KnowledgeEvolutionValidationError('languageEvolution', [
      `language evolution record ${record.languageEvolutionId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(record));
  return record;
}

export async function ensureLanguageEvolutionRecord(
  record: KnowledgeLanguageEvolutionRecord,
): Promise<KnowledgeLanguageEvolutionRecord> {
  const existing = await getLanguageEvolutionById(record.languageEvolutionId);
  if (existing) return existing;
  return createLanguageEvolutionRecord(record);
}

export function getLanguageEvolutionById(
  languageEvolutionId: string,
): Promise<KnowledgeLanguageEvolutionRecord | null> {
  return repoFindOne<KnowledgeLanguageEvolutionRecord>(COLLECTION, {
    _id: languageEvolutionId,
  });
}

export function listLanguageEvolutionForSource(
  sourceKnowledgeObjectId: string,
  options: RepoFindOptions = {},
): Promise<KnowledgeLanguageEvolutionRecord[]> {
  return repoFind<KnowledgeLanguageEvolutionRecord>(
    COLLECTION,
    { sourceKnowledgeObjectId },
    options,
  );
}

export function listLanguageEvolutionRecords(
  filter: Record<string, unknown>,
  options: RepoFindOptions = {},
): Promise<KnowledgeLanguageEvolutionRecord[]> {
  return repoFind<KnowledgeLanguageEvolutionRecord>(COLLECTION, filter, options);
}

async function patchLanguageEvolution(
  languageEvolutionId: string,
  set: Record<string, unknown>,
): Promise<number> {
  assertNoProtectedFields(
    'languageEvolution',
    set,
    KNOWLEDGE_LANGUAGE_EVOLUTION_PROTECTED_FIELDS,
  );
  return repoPatch(COLLECTION, { _id: languageEvolutionId }, set);
}

/**
 * Advance the translation lifecycle. Reaching `active` stamps `activatedAt` so
 * activation is auditable (the model rejects an `active` record without it).
 */
export function updateTranslationStatus(
  languageEvolutionId: string,
  translationStatus: KnowledgeLanguageTranslationStatus,
  activatedAt?: Date,
): Promise<number> {
  const set: Record<string, unknown> = { translationStatus };
  if (translationStatus === 'active') {
    set.activatedAt = activatedAt ?? new Date();
  }
  return patchLanguageEvolution(languageEvolutionId, set);
}
