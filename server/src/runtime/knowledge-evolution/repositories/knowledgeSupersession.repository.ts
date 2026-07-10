/**
 * Repository — `knowledge_supersession_records` (spec §17).
 *
 * APPEND-ONLY. Superseded knowledge remains stored and auditable; these link
 * records are never mutated or deleted. Idempotent on `supersessionId`.
 */

import type { KnowledgeSupersessionRecord } from '@momentum/shared/runtime';
import {
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_SUPERSESSION_COLLECTION,
  validateKnowledgeSupersessionRecord,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_SUPERSESSION_COLLECTION;

function toDoc(record: KnowledgeSupersessionRecord): Record<string, unknown> {
  return { _id: record.supersessionId, ...record };
}

export async function appendSupersessionRecord(
  record: KnowledgeSupersessionRecord,
): Promise<KnowledgeSupersessionRecord> {
  const { ok, errors } = validateKnowledgeSupersessionRecord(record);
  if (!ok) throw new KnowledgeEvolutionValidationError('supersession', errors);

  if (await repoExists(COLLECTION, { _id: record.supersessionId })) {
    throw new KnowledgeEvolutionValidationError('supersession', [
      `supersession record ${record.supersessionId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(record));
  return record;
}

/** Idempotent append: returns the existing record if already present. */
export async function ensureSupersessionRecord(
  record: KnowledgeSupersessionRecord,
): Promise<KnowledgeSupersessionRecord> {
  const existing = await getSupersessionById(record.supersessionId);
  if (existing) return existing;
  return appendSupersessionRecord(record);
}

export function getSupersessionById(
  supersessionId: string,
): Promise<KnowledgeSupersessionRecord | null> {
  return repoFindOne<KnowledgeSupersessionRecord>(COLLECTION, { _id: supersessionId });
}

export function findSupersessionByOldObject(
  oldKnowledgeObjectId: string,
): Promise<KnowledgeSupersessionRecord | null> {
  return repoFindOne<KnowledgeSupersessionRecord>(COLLECTION, { oldKnowledgeObjectId });
}

export function listSupersessionRecords(
  filter: Record<string, unknown>,
  options: RepoFindOptions = {},
): Promise<KnowledgeSupersessionRecord[]> {
  return repoFind<KnowledgeSupersessionRecord>(COLLECTION, filter, options);
}
