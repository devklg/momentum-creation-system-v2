/**
 * Knowledge Evolution — canonical Mongo persistence primitives (Lane A).
 *
 * Thin, typed wrappers over the app's DIRECT persistence dispatch
 * (`services/persistence/dispatch.ts`). MongoDB is canonical truth (spec §27);
 * every read/write here lands on the dedicated governed stack via the same
 * `persistenceCall` surface the rest of the server uses. There is no Universal
 * Gateway path and no route handler ever calls these directly — repositories
 * (which validate through the model layer) are the only callers.
 *
 * Deliberately NARROW: insert / findOne / find / exists / patch only. There is
 * NO delete and NO `$unset` helper — Knowledge Evolution never erases prior
 * versions or audit history (spec §16, §29), so the primitive that would let a
 * caller do so simply does not exist here.
 */

import { persistenceCall } from '../../../services/persistence/dispatch.js';

/** The dedicated MCS app database (Mongo :30000). Matches services/tieredWrite.ts. */
export const KNOWLEDGE_EVOLUTION_MONGO_DB = 'momentum';

export interface RepoFindOptions {
  sort?: Record<string, 1 | -1>;
  limit?: number;
}

interface MongoQueryResult<T> {
  documents?: T[];
  count?: number;
}

interface MongoInsertResult {
  insertedCount?: number;
}

interface MongoUpdateResult {
  matchedCount?: number;
  modifiedCount?: number;
}

/**
 * Insert one canonical document. `_id` MUST already be set to the record's
 * canonical id so re-inserting the same logical record is a duplicate-key error
 * rather than a silent second copy. Idempotency is layered on top of this in
 * the repositories (`ensure*`), which check existence first.
 */
export async function repoInsertOne(
  collection: string,
  doc: Record<string, unknown>,
): Promise<void> {
  await persistenceCall<MongoInsertResult>('mongodb', 'insert', {
    database: KNOWLEDGE_EVOLUTION_MONGO_DB,
    collection,
    documents: [doc],
  });
}

/** Find a single document by filter (first match), or null. */
export async function repoFindOne<T>(
  collection: string,
  filter: Record<string, unknown>,
): Promise<T | null> {
  const res = await persistenceCall<MongoQueryResult<T>>('mongodb', 'query', {
    database: KNOWLEDGE_EVOLUTION_MONGO_DB,
    collection,
    filter,
    limit: 1,
  });
  return res.documents?.[0] ?? null;
}

/** Find documents by filter with optional sort/limit. */
export async function repoFind<T>(
  collection: string,
  filter: Record<string, unknown>,
  options: RepoFindOptions = {},
): Promise<T[]> {
  const params: Record<string, unknown> = {
    database: KNOWLEDGE_EVOLUTION_MONGO_DB,
    collection,
    filter,
  };
  if (options.sort) params.sort = options.sort;
  if (typeof options.limit === 'number') params.limit = options.limit;
  const res = await persistenceCall<MongoQueryResult<T>>('mongodb', 'query', params);
  return res.documents ?? [];
}

/** True iff at least one document matches the filter. */
export async function repoExists(
  collection: string,
  filter: Record<string, unknown>,
): Promise<boolean> {
  const res = await persistenceCall<MongoQueryResult<unknown>>('mongodb', 'query', {
    database: KNOWLEDGE_EVOLUTION_MONGO_DB,
    collection,
    filter,
    limit: 1,
  });
  return (res.documents?.length ?? res.count ?? 0) > 0;
}

/**
 * `$set`-only patch. There is no `$unset` path: a patch can advance state
 * (status, coordination flags, timestamps) but can never remove a field, so it
 * cannot erase audit lineage. Returns the modified-document count.
 *
 * Callers must additionally guard which fields are settable via
 * `assertNoProtectedFields` in the model layer — this primitive enforces the
 * store-level invariant (no removal); the repository enforces the domain-level
 * invariant (no rewriting of immutable identity/lineage fields).
 */
export async function repoPatch(
  collection: string,
  filter: Record<string, unknown>,
  set: Record<string, unknown>,
): Promise<number> {
  const res = await persistenceCall<MongoUpdateResult>('mongodb', 'update', {
    database: KNOWLEDGE_EVOLUTION_MONGO_DB,
    collection,
    filter,
    update: { $set: set },
  });
  return res.modifiedCount ?? 0;
}
