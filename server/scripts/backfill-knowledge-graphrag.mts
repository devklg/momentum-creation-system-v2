/**
 * Backfill canonical Knowledge Base + GraphRAG records from the surviving
 * production Chroma `mcs_knowledge_chunks` collection (LANE 0).
 *
 * Context (verified 2026-07-22): Chroma Cloud `mcs_knowledge_chunks` holds the
 * full 3,395-chunk / 209-source Kevin-approved KB, but Mongo
 * `mcs_knowledge_sources` / `mcs_knowledge_chunks` and `mcs_graphrag_records`
 * are EMPTY and the Neo4j knowledge nodes are missing. The resource-catalog leg
 * already ran (`mcs_resource_catalog` has 209 `knowledge:<sourceId>:v1` entries),
 * so this backfill MUST preserve original ids — it never mints new ones.
 *
 * What it does:
 *   1. Reads every chunk (ids + documents + metadatas) from Chroma, paginated.
 *   2. Reconstructs one canonical source record per `sourceId` and one canonical
 *      chunk record per chunk, mirroring `createKevinApprovedKnowledgeSource`'s
 *      shapes exactly (see lib/knowledge-graphrag-transform.ts).
 *   3. Upserts source + chunk records into Mongo by `_id` via the repo's
 *      persistence dispatch (never a raw Mongo client). Idempotent.
 *   4. For every active + retrieval-eligible + active-authority chunk, invokes
 *      the repo's real `projectApprovedChunkToGraphRag`, which writes the
 *      canonical GraphRAG record (Mongo + per-domain/language Chroma + Neo4j)
 *      with the repo's own envelope/digest. Skipped when a record already exists.
 *
 * Modes:
 *   (default)  dry-run — NO writes. Prints the full report + sample shapes.
 *   --live     performs the upserts + GraphRAG projections.
 *   --limit N  process only the first N sources (deterministic, id-sorted) —
 *              for canary runs on the VPS.
 *
 * Env is loaded exactly like the other server scripts (via the src modules it
 * imports, which walk up to the pnpm-workspace.yaml root for `.env`). Never runs
 * against prod from here — the orchestrator executes it on the VPS.
 *
 * Usage:
 *   tsx server/scripts/backfill-knowledge-graphrag.mts            # dry-run
 *   tsx server/scripts/backfill-knowledge-graphrag.mts --limit 1  # canary dry-run
 *   tsx server/scripts/backfill-knowledge-graphrag.mts --live     # write everything
 */

import { persistenceCall } from '../src/services/persistence/dispatch.js';
import { closeMongo, connectMongo } from '../src/services/persistence/mongo/connection.js';
import {
  KNOWLEDGE_CHUNK_COLLECTION,
  KNOWLEDGE_SOURCE_COLLECTION,
  projectApprovedChunkToGraphRag,
} from '../src/services/knowledge/approvedKnowledgeStore.js';
import { graphRagPersistenceEnabled } from '../src/domain/graphrag.js';
import type {
  McsKnowledgeBaseChunkRecord,
  McsKnowledgeBaseSourceRecord,
} from '@momentum/shared/runtime';
import {
  chromaRowToChunkRecord,
  graphRagDomainFor,
  reconstructSourceRecord,
  type ChromaKnowledgeRow,
  type ChunkEntry,
} from './lib/knowledge-graphrag-transform.js';

const CHUNK_CHROMA_COLLECTION = 'mcs_knowledge_chunks';
const GRAPHRAG_MONGO_COLLECTION = 'mcs_graphrag_records';
const MONGO_DB = 'momentum';
const CHROMA_LIST_PAGE = 100; // adapter caps list_records at 100
const CHROMA_GET_BATCH = 200; // ≤200/page — larger get batches have 500'd on Cloud

const LIVE = process.argv.includes('--live');
const LIMIT = readLimit();

function readLimit(): number | undefined {
  const idx = process.argv.indexOf('--limit');
  if (idx === -1) return undefined;
  const raw = process.argv[idx + 1];
  const n = raw ? Number(raw) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

type UpsertOutcome = 'inserted' | 'updated' | 'unchanged';

interface MongoQueryResult<T> {
  documents?: T[];
  count?: number;
}

// ── Chroma read ──────────────────────────────────────────────────────────────

/** Paginate list_records to collect EVERY chunk id in the collection. */
async function readAllChunkIds(): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;
  for (;;) {
    const page = await persistenceCall<{ ids?: string[]; count?: number }>(
      'chromadb',
      'list_records',
      { collection: CHUNK_CHROMA_COLLECTION, limit: CHROMA_LIST_PAGE, offset },
    );
    const pageIds = page.ids ?? [];
    ids.push(...pageIds);
    if (pageIds.length < CHROMA_LIST_PAGE) break;
    offset += pageIds.length;
  }
  return ids;
}

/** Fetch documents + metadata for a batch of ids via the `get` action. */
async function fetchRows(batch: string[]): Promise<ChromaKnowledgeRow[]> {
  const body = await persistenceCall<{
    ids?: string[];
    documents?: Array<string | null>;
    metadatas?: Array<Record<string, unknown> | null>;
  }>('chromadb', 'get', { collection: CHUNK_CHROMA_COLLECTION, ids: batch });
  const rows: ChromaKnowledgeRow[] = [];
  const gotIds = body.ids ?? [];
  for (let i = 0; i < gotIds.length; i += 1) {
    rows.push({
      id: gotIds[i]!,
      document: body.documents?.[i] ?? '',
      metadata: body.metadatas?.[i] ?? {},
    });
  }
  return rows;
}

async function readAllChunkRows(): Promise<ChromaKnowledgeRow[]> {
  const ids = await readAllChunkIds();
  const rows: ChromaKnowledgeRow[] = [];
  for (let i = 0; i < ids.length; i += CHROMA_GET_BATCH) {
    rows.push(...(await fetchRows(ids.slice(i, i + CHROMA_GET_BATCH))));
  }
  return rows;
}

// ── Mongo upsert (idempotent, by _id, through persistenceCall) ───────────────

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (val as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return val;
  });
}

/**
 * Upsert `desired` at `_id=id`. Insert when absent; when present, preserve any
 * volatile fields carried by `preserve` (source createdAt/authorityAt) and only
 * update when content actually differs — so a second run reports 0 changes.
 */
async function upsertById(
  collection: string,
  id: string,
  desired: Record<string, unknown>,
  preserve: (existing: Record<string, unknown>) => Record<string, unknown>,
): Promise<UpsertOutcome> {
  const existingResult = await persistenceCall<MongoQueryResult<Record<string, unknown>>>(
    'mongodb',
    'query',
    { database: MONGO_DB, collection, filter: { _id: id }, limit: 1 },
  );
  const existing = existingResult.documents?.[0];
  if (!existing) {
    await persistenceCall('mongodb', 'insert', {
      database: MONGO_DB,
      collection,
      documents: [{ _id: id, ...desired }],
    });
    return 'inserted';
  }

  const reconciled = { ...desired, ...preserve(existing) };
  const { _id: _existingId, ...existingBody } = existing;
  if (stableStringify(existingBody) === stableStringify(reconciled)) {
    return 'unchanged';
  }
  await persistenceCall('mongodb', 'update', {
    database: MONGO_DB,
    collection,
    filter: { _id: id },
    update: { $set: reconciled },
  });
  return 'updated';
}

/** Sources carry a clock; preserve the first-write createdAt/authorityAt. */
function preserveSourceTimestamps(existing: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof existing.createdAt === 'string') out.createdAt = existing.createdAt;
  const authority = existing.authority;
  if (authority && typeof authority === 'object') {
    out.authority = authority;
  }
  return out;
}

// ── GraphRAG projection (repo's own path, idempotent by existence check) ─────

async function graphRagRecordExists(chunk: McsKnowledgeBaseChunkRecord): Promise<boolean> {
  const result = await persistenceCall<MongoQueryResult<Record<string, unknown>>>('mongodb', 'query', {
    database: MONGO_DB,
    collection: GRAPHRAG_MONGO_COLLECTION,
    filter: {
      knowledgeObjectId: String(chunk.knowledgeId),
      version: chunk.sourceVersion,
      language: chunk.language,
    },
    limit: 1,
  });
  return (result.documents?.length ?? result.count ?? 0) > 0;
}

function graphRagEligible(chunk: McsKnowledgeBaseChunkRecord): boolean {
  return (
    chunk.status === 'active' &&
    chunk.retrievalEligible === true &&
    chunk.authorityStatus === 'active_authority'
  );
}

// ── main ─────────────────────────────────────────────────────────────────────

interface SkipEntry {
  chunkId: string;
  reason: string;
}

async function main(): Promise<void> {
  await connectMongo();

  const rows = await readAllChunkRows();

  // Transform + group by original sourceId.
  const entriesBySource = new Map<string, ChunkEntry[]>();
  const domainDefaultedChunks: string[] = [];
  for (const row of rows) {
    const { record, domainDefaulted } = chromaRowToChunkRecord(row);
    if (domainDefaulted) domainDefaultedChunks.push(record.chunkId);
    const key = String(record.sourceId);
    const list = entriesBySource.get(key) ?? [];
    list.push({ record, metadata: row.metadata ?? {} });
    entriesBySource.set(key, list);
  }

  // Deterministic order; --limit takes the first N sources.
  let sourceIds = [...entriesBySource.keys()].sort();
  if (LIMIT !== undefined) sourceIds = sourceIds.slice(0, LIMIT);

  const createdAt = new Date().toISOString();
  const sources: Array<{ source: McsKnowledgeBaseSourceRecord; entries: ChunkEntry[] }> = [];
  const sourcesUnsetPrimaryCategory: string[] = [];
  for (const sourceId of sourceIds) {
    const entries = entriesBySource.get(sourceId)!;
    const { record, unsetPrimaryCategory } = reconstructSourceRecord(sourceId, entries, { createdAt });
    if (unsetPrimaryCategory) sourcesUnsetPrimaryCategory.push(sourceId);
    sources.push({ source: record, entries });
  }

  const allChunks = sources.flatMap((s) => s.entries.map((e) => e.record));
  const eligibleChunks = allChunks.filter(graphRagEligible);
  const skipped: SkipEntry[] = allChunks
    .filter((chunk) => !graphRagEligible(chunk))
    .map((chunk) => ({
      chunkId: chunk.chunkId,
      reason:
        chunk.status !== 'active'
          ? `status=${chunk.status}`
          : chunk.retrievalEligible !== true
            ? 'retrievalEligible=false'
            : `authorityStatus=${String(chunk.authorityStatus)}`,
    }));

  const projectionByDomainLanguage: Record<string, number> = {};
  for (const chunk of eligibleChunks) {
    const key = `${graphRagDomainFor(chunk.domain)}/${chunk.language}`;
    projectionByDomainLanguage[key] = (projectionByDomainLanguage[key] ?? 0) + 1;
  }

  const sampleRecords = [
    ...(sources[0] ? [{ kind: 'source', record: sources[0].source }] : []),
    ...allChunks.slice(0, 4).map((record) => ({ kind: 'chunk', record })),
  ];

  const baseReport = {
    mode: LIVE ? 'live' : 'dry-run',
    graphRagPersistenceEnabled: graphRagPersistenceEnabled(),
    chunksRead: rows.length,
    sourcesFound: entriesBySource.size,
    sourcesProcessed: sources.length,
    chunksProcessed: allChunks.length,
    graphRagEligibleChunks: eligibleChunks.length,
    projectionByDomainLanguage,
    chunksSkippedForGraphRag: skipped.length,
    skippedSample: skipped.slice(0, 20),
    sourcesWithUnsetPrimaryCategory: sourcesUnsetPrimaryCategory,
    chunksWithDefaultedDomain: domainDefaultedChunks,
    limit: LIMIT ?? null,
  };

  if (!LIVE) {
    console.log(
      JSON.stringify(
        {
          ...baseReport,
          note:
            'DRY-RUN — no writes performed. Chroma `mcs_knowledge_sources` backfill (LANE brief step 5) ' +
            'is intentionally NOT performed: the intake path (createKevinApprovedKnowledgeSource) does not ' +
            'write a Chroma collection literally named `mcs_knowledge_sources`; it writes source docs to ' +
            'per-domain `mcs_<domain>_knowledge_<lang>` collections (populated here by the GraphRAG leg) and ' +
            'chunk docs to `mcs_knowledge_chunks`. Inventing a shape for `mcs_knowledge_sources` would violate ' +
            'the "use the repo\'s own shapes" constraint — see PR body.',
          sampleRecords,
        },
        null,
        2,
      ),
    );
    await closeMongo();
    return;
  }

  // ── LIVE writes ───────────────────────────────────────────────────────────
  const sourceOutcomes: Record<UpsertOutcome, number> = { inserted: 0, updated: 0, unchanged: 0 };
  const chunkOutcomes: Record<UpsertOutcome, number> = { inserted: 0, updated: 0, unchanged: 0 };
  const writeFailures: Array<{ id: string; error: string }> = [];

  for (const { source, entries } of sources) {
    try {
      const outcome = await upsertById(
        KNOWLEDGE_SOURCE_COLLECTION,
        String(source.sourceId),
        { ...source },
        preserveSourceTimestamps,
      );
      sourceOutcomes[outcome] += 1;
    } catch (error) {
      writeFailures.push({ id: String(source.sourceId), error: errMsg(error) });
    }

    for (const { record } of entries) {
      try {
        const outcome = await upsertById(
          KNOWLEDGE_CHUNK_COLLECTION,
          record.chunkId,
          { ...record },
          () => ({}),
        );
        chunkOutcomes[outcome] += 1;
      } catch (error) {
        writeFailures.push({ id: record.chunkId, error: errMsg(error) });
      }
    }
  }

  const graphRag = { projected: 0, alreadyPresent: 0, disabled: 0, failed: 0 };
  const graphRagFailures: Array<{ chunkId: string; error: string }> = [];
  for (const chunk of eligibleChunks) {
    try {
      if (await graphRagRecordExists(chunk)) {
        graphRag.alreadyPresent += 1;
        continue;
      }
      const projected = await projectApprovedChunkToGraphRag(chunk);
      if (projected) graphRag.projected += 1;
      else graphRag.disabled += 1; // appendGraphRagRecord no-op ⇒ canary flag OFF
    } catch (error) {
      graphRag.failed += 1;
      graphRagFailures.push({ chunkId: chunk.chunkId, error: errMsg(error) });
    }
  }

  console.log(
    JSON.stringify(
      {
        ...baseReport,
        sourceOutcomes,
        chunkOutcomes,
        graphRag,
        graphRagFailuresSample: graphRagFailures.slice(0, 20),
        writeFailuresSample: writeFailures.slice(0, 20),
        sampleRecords,
      },
      null,
      2,
    ),
  );

  await closeMongo();
  if (writeFailures.length > 0 || graphRag.failed > 0) process.exitCode = 1;
}

function errMsg(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

main().catch(async (error) => {
  console.error('[backfill-knowledge-graphrag] failed:', error);
  try {
    await closeMongo();
  } catch {
    // ignore close error on the failure path
  }
  process.exit(1);
});
