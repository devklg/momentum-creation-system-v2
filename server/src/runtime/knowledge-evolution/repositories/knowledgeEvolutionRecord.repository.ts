/**
 * Repository — `knowledge_evolution_records` (spec §11).
 *
 * Idempotent create + guarded lifecycle patches. The canonical id (`evolutionId`)
 * is used as Mongo `_id`, so re-processing the same approved input is naturally
 * de-duplicated. Patches are `$set`-only and refuse to touch immutable identity/
 * lineage fields, so no lifecycle transition can erase audit history (spec §29).
 */

import type {
  KnowledgeEvolutionCoordinationStatus,
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionRetrievalStatus,
  KnowledgeEvolutionStatus,
} from '@momentum/shared/runtime';
import {
  assertNoProtectedFields,
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_EVOLUTION_RECORD_COLLECTION,
  KNOWLEDGE_EVOLUTION_RECORD_PROTECTED_FIELDS,
  validateKnowledgeEvolutionRecord,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  repoPatch,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_EVOLUTION_RECORD_COLLECTION;

function toDoc(record: KnowledgeEvolutionRecord): Record<string, unknown> {
  return { _id: record.evolutionId, ...record };
}

/** Create a new evolution record. Throws on invalid doc or duplicate evolutionId. */
export async function createEvolutionRecord(
  record: KnowledgeEvolutionRecord,
): Promise<KnowledgeEvolutionRecord> {
  const { ok, errors } = validateKnowledgeEvolutionRecord(record);
  if (!ok) throw new KnowledgeEvolutionValidationError('record', errors);

  if (await repoExists(COLLECTION, { _id: record.evolutionId })) {
    throw new KnowledgeEvolutionValidationError('record', [
      `evolution record ${record.evolutionId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(record));
  return record;
}

/**
 * Idempotent create: if a record with this evolutionId already exists, return it
 * unchanged; otherwise create and return the new record. Safe under event replay.
 */
export async function ensureEvolutionRecord(
  record: KnowledgeEvolutionRecord,
): Promise<KnowledgeEvolutionRecord> {
  const existing = await getEvolutionRecordById(record.evolutionId);
  if (existing) return existing;
  return createEvolutionRecord(record);
}

export function getEvolutionRecordById(
  evolutionId: string,
): Promise<KnowledgeEvolutionRecord | null> {
  return repoFindOne<KnowledgeEvolutionRecord>(COLLECTION, { _id: evolutionId });
}

/** Find the record for a given approved input, for event-replay de-duplication. */
export function findEvolutionRecordByInput(
  tenantId: string,
  inputType: KnowledgeEvolutionRecord['inputType'],
  inputId: string,
): Promise<KnowledgeEvolutionRecord | null> {
  return repoFindOne<KnowledgeEvolutionRecord>(COLLECTION, { tenantId, inputType, inputId });
}

export function listEvolutionRecords(
  filter: Record<string, unknown>,
  options: RepoFindOptions = {},
): Promise<KnowledgeEvolutionRecord[]> {
  return repoFind<KnowledgeEvolutionRecord>(COLLECTION, filter, options);
}

/**
 * Guarded `$set` patch. Immutable identity/lineage fields are rejected; every
 * patch stamps `updatedAt`. Returns the modified-document count (0 if no match).
 */
export async function patchEvolutionRecord(
  evolutionId: string,
  set: Record<string, unknown>,
  updatedAt: Date = new Date(),
): Promise<number> {
  assertNoProtectedFields('record', set, KNOWLEDGE_EVOLUTION_RECORD_PROTECTED_FIELDS);
  return repoPatch(COLLECTION, { _id: evolutionId }, { ...set, updatedAt });
}

export function updateEvolutionStatus(
  evolutionId: string,
  status: KnowledgeEvolutionStatus,
  updatedAt: Date = new Date(),
): Promise<number> {
  return patchEvolutionRecord(evolutionId, { status }, updatedAt);
}

export function setCoordinationStatus(
  evolutionId: string,
  patch: {
    indexingStatus?: KnowledgeEvolutionCoordinationStatus;
    graphStatus?: KnowledgeEvolutionCoordinationStatus;
    retrievalStatus?: KnowledgeEvolutionRetrievalStatus;
  },
  updatedAt: Date = new Date(),
): Promise<number> {
  return patchEvolutionRecord(evolutionId, { ...patch }, updatedAt);
}

export function markEvolutionCompleted(
  evolutionId: string,
  completedAt: Date = new Date(),
): Promise<number> {
  return patchEvolutionRecord(
    evolutionId,
    { status: 'completed', completedAt },
    completedAt,
  );
}

export function markEvolutionFailed(
  evolutionId: string,
  failureReason: string,
  failedAt: Date = new Date(),
): Promise<number> {
  return patchEvolutionRecord(
    evolutionId,
    { status: 'failed', failedAt, failureReason },
    failedAt,
  );
}

export function markEvolutionRolledBack(
  evolutionId: string,
  updatedAt: Date = new Date(),
): Promise<number> {
  return patchEvolutionRecord(
    evolutionId,
    { status: 'rolled_back', retrievalStatus: 'rolled_back' },
    updatedAt,
  );
}
