/**
 * Repository — `knowledge_evolution_versions` (spec §16).
 *
 * APPEND-ONLY. There is no patch and no delete: once written, a version record
 * is immutable audit history. `appendVersion` refuses to write a
 * `(knowledgeObjectId, version)` pair that already exists, so a prior version
 * can never be silently overwritten (the unique index enforces this at the
 * store level too).
 */

import type { KnowledgeEvolutionVersion } from '@momentum/shared/runtime';
import {
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_EVOLUTION_VERSION_COLLECTION,
  validateKnowledgeEvolutionVersion,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_EVOLUTION_VERSION_COLLECTION;

function toDoc(version: KnowledgeEvolutionVersion): Record<string, unknown> {
  return { _id: version.versionRecordId, ...version };
}

/**
 * Append an immutable version record. Throws if the versionRecordId already
 * exists OR if the (knowledgeObjectId, version) pair is already recorded —
 * either would mean overwriting audit history.
 */
export async function appendVersion(
  version: KnowledgeEvolutionVersion,
): Promise<KnowledgeEvolutionVersion> {
  const { ok, errors } = validateKnowledgeEvolutionVersion(version);
  if (!ok) throw new KnowledgeEvolutionValidationError('version', errors);

  if (await repoExists(COLLECTION, { _id: version.versionRecordId })) {
    throw new KnowledgeEvolutionValidationError('version', [
      `version record ${version.versionRecordId} already exists`,
    ]);
  }
  if (
    await repoExists(COLLECTION, {
      knowledgeObjectId: version.knowledgeObjectId,
      version: version.version,
    })
  ) {
    throw new KnowledgeEvolutionValidationError('version', [
      `version ${version.version} of knowledge object ${version.knowledgeObjectId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(version));
  return version;
}

export function getVersionById(
  versionRecordId: string,
): Promise<KnowledgeEvolutionVersion | null> {
  return repoFindOne<KnowledgeEvolutionVersion>(COLLECTION, { _id: versionRecordId });
}

/** Full version history for a Knowledge Object, newest first by version. */
export function listVersionsForKnowledgeObject(
  knowledgeObjectId: string,
  options: RepoFindOptions = { sort: { version: -1 } },
): Promise<KnowledgeEvolutionVersion[]> {
  return repoFind<KnowledgeEvolutionVersion>(COLLECTION, { knowledgeObjectId }, options);
}

export function listVersionsForEvolution(
  evolutionId: string,
  options: RepoFindOptions = { sort: { version: -1 } },
): Promise<KnowledgeEvolutionVersion[]> {
  return repoFind<KnowledgeEvolutionVersion>(COLLECTION, { evolutionId }, options);
}

/** The highest recorded version for a Knowledge Object, or null if none. */
export async function getLatestVersion(
  knowledgeObjectId: string,
): Promise<KnowledgeEvolutionVersion | null> {
  const [latest] = await repoFind<KnowledgeEvolutionVersion>(
    COLLECTION,
    { knowledgeObjectId },
    { sort: { version: -1 }, limit: 1 },
  );
  return latest ?? null;
}
