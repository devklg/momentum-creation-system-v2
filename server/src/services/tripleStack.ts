/**
 * Triple-stack write helper. Wraps three sequential DIRECT-adapter calls
 * (services/persistence — ACR-0007/ACR-0009; the external MCP tool server is dev
 * tooling only) so a single logical write lands in MongoDB + Neo4j + ChromaDB.
 * No DB is optional.
 *
 * Adapter API contract notes (inherited from the legacy PERSISTENCE era — the
 * direct adapters mirror the same action contract):
 *   - MongoDB `update` action does NOT honor `upsert:true` — branch on existence.
 *   - Neo4j BA constraint requires email uniqueness; write `null` for missing optional fields.
 *   - ChromaDB add() does not auto-create collections; ensure collection exists first.
 *   - MongoDB query action uses parameter name `filter`, not `query`.
 */

import { persistenceCall } from './persistence/dispatch.js';
import { assertChromaCollectionExists } from './chromaCollections.js';
import type { McsTripleStackWriteResult } from '@momentum/shared';

export interface TripleStackInput {
  /** Stable identifier shared across all three stores. */
  id: string;
  /** MongoDB collection name. */
  mongoCollection: string;
  /** MongoDB document body. */
  mongoDoc: Record<string, unknown>;
  /** Optional Neo4j cypher + params to also run. Skip for pure-document records. */
  neo4j?: { cypher: string; params?: Record<string, unknown> };
  /** ChromaDB collection name and embedding text. Skip if not semantically searchable. */
  chroma?: { collection: string; document: string; metadata?: Record<string, unknown> };
  /** Optional identity override for the Chroma record id. Defaults to `id`. */
  chromaId?: string;
  /** MongoDB database name. Defaults to 'momentum'. */
  mongoDatabase?: string;
}

const MONGO_DB = 'momentum';

export async function tripleStackWrite(input: TripleStackInput): Promise<McsTripleStackWriteResult> {
  const database = input.mongoDatabase ?? MONGO_DB;

  // 0. Chroma collection guard (#147). The Chroma leg runs LAST below, so a
  //    missing collection used to 500 only AFTER Mongo had committed —
  //    orphaning the Mongo row (the #145 / #140 failure class). Assert the
  //    collection exists up front so we fail loud BEFORE Mongo lands, never
  //    half-write. Cache-first: free after the boot-time ensure.
  if (input.chroma) {
    await assertChromaCollectionExists(input.chroma.collection);
  }

  // 1. Mongo insert. Use the shared `id` field as the document's _id-equivalent.
  const mongoData = await persistenceCall<{ insertedCount?: number }>('mongodb', 'insert', {
    database,
    collection: input.mongoCollection,
    documents: [{ _id: input.id, ...input.mongoDoc }],
  });

  // 2. Neo4j (optional). PERSISTENCE action: neo4j.cypher with { query, params }.
  // `ok` means "this leg executed successfully" — false when skipped (no input),
  // never a silent true. A real leg failure throws above and never reaches here.
  let neo4jOk = false;
  let neo4jCounters: Record<string, number> | undefined;
  if (input.neo4j) {
    const data = await persistenceCall<{ summary?: { counters?: Record<string, number> } }>('neo4j', 'cypher', {
      query: input.neo4j.cypher,
      params: { id: input.id, ...(input.neo4j.params ?? {}) },
    });
    neo4jOk = true;
    neo4jCounters = data.summary?.counters;
  }

  // 3. ChromaDB (optional). Collection must already exist; create at boot.
  let chromaOk = false;
  if (input.chroma) {
    await persistenceCall('chromadb', 'add', {
      collection: input.chroma.collection,
      ids: [input.chromaId ?? input.id],
      documents: [input.chroma.document],
      metadatas: [input.chroma.metadata ?? {}],
    });
    chromaOk = true;
  }

  return {
    mongo: { ok: true, insertedCount: mongoData.insertedCount },
    neo4j: { ok: neo4jOk, counters: neo4jCounters },
    chroma: { ok: chromaOk, verified: !!input.chroma },
  };
}
