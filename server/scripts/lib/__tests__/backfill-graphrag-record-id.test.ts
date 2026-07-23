/**
 * Regression guard for the LANE 1 defect (2026-07-23 production run): every one
 * of the 3,395 backfilled GraphRAG projections failed with
 *
 *   [persistence:mongodb.insert] Mcs_mcs_graphrag_records validation failed:
 *   _id: Path `_id` is required.
 *
 * Root cause: `appendGraphRagRecord` passed `mongoDoc: { ...record, _id: undefined }`,
 * and `tieredWrite` builds `documents: [{ _id: input.id, ...mongoDoc }]` — so the
 * trailing `_id: undefined` spread LAST and clobbered the canonical `_id`,
 * producing an insert with no `_id`. The GraphRAG canary is default-OFF, so this
 * shared write path was never exercised until the backfill turned it on.
 *
 * This test drives the SCRIPT'S OWN path end-to-end — Chroma-row → transform
 * (`chromaRowToChunkRecord`) → the repo's real `projectApprovedChunkToGraphRag`
 * → the real `tieredWrite` — mocking ONLY the persistence layer, and asserts the
 * `mongodb.insert` document carries a present, non-undefined `_id` that equals
 * the envelope `id` and the deterministic `mcsgraph_<knowledgeId>_v<v>_<lang>`
 * id. It fails against the pre-fix code and passes after.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chromaRowToChunkRecord, type ChromaKnowledgeRow } from '../knowledge-graphrag-transform.js';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  assertChromaCollectionExists: vi.fn(),
  enqueueProjection: vi.fn(),
}));

// Mock the lowest layer only — the REAL tieredWrite runs, so the _id mapping is
// exercised exactly as production does. Paths resolve to the same modules that
// tieredWrite / graphrag / approvedKnowledgeStore import.
vi.mock('../../../src/services/persistence/dispatch.js', () => ({
  persistenceCall: mocks.persistenceCall,
  PersistenceError: class PersistenceError extends Error {},
}));
vi.mock('../../../src/services/chromaCollections.js', () => ({
  assertChromaCollectionExists: mocks.assertChromaCollectionExists,
  ChromaCollectionMissingError: class ChromaCollectionMissingError extends Error {
    constructor(public readonly collection: string) {
      super(collection);
      this.name = 'ChromaCollectionMissingError';
    }
  },
}));
vi.mock('../../../src/services/projectionOutbox.js', () => ({
  enqueueProjection: mocks.enqueueProjection,
  extractCount: () => 1,
}));

const ORIGINAL_FLAG = process.env.GRAPHRAG_PERSISTENCE_ENABLED;

/** A live-shaped, GraphRAG-eligible chunk row (active + retrievalEligible + active_authority). */
function eligibleRow(overrides: Partial<Record<string, unknown>> = {}): ChromaKnowledgeRow {
  return {
    id: 'kchunk_abc12345',
    document: 'Daily method of operation: reach out to five sharers before noon.',
    metadata: {
      chunkId: 'kchunk_abc12345',
      sourceId: 'knowledge_source_e0951cff-eeb0-45d2-b6c4-e491342c05ac',
      sourceTitle: 'Fast Start Playbook',
      sourceVersion: 2,
      chunkIndex: 0,
      startOffset: 0,
      endOffset: 63,
      heading: 'Daily Method of Operation',
      domain: 'training',
      language: 'en',
      authority: 'kevin_approved',
      authorityStatus: 'active_authority',
      retrievalEligible: true,
      status: 'active',
      documentId: 'kdoc_deadbeef',
      ...overrides,
    },
  };
}

/** persistenceCall stub: succeed on insert, satisfy the Mongo read-back, no-op the rest. */
function stubPersistence(): void {
  mocks.persistenceCall.mockImplementation(async (tool: string, action: string) => {
    if (tool === 'mongodb' && action === 'insert') return { insertedCount: 1, insertedIds: {} };
    if (tool === 'mongodb' && action === 'query') return { count: 1, documents: [{ _id: 'present' }] };
    if (tool === 'neo4j' && action === 'cypher') return { records: [{ n: 1 }], summary: { counters: {} } };
    if (tool === 'chromadb' && action === 'add') return {};
    return {};
  });
}

function insertDoc(): Record<string, unknown> {
  const insertCall = mocks.persistenceCall.mock.calls.find(
    ([tool, action]) => tool === 'mongodb' && action === 'insert',
  );
  expect(insertCall, 'expected a mongodb.insert call to mcs_graphrag_records').toBeTruthy();
  const params = insertCall![2] as { collection?: string; documents?: Array<Record<string, unknown>> };
  expect(params.collection).toBe('mcs_graphrag_records');
  const doc = params.documents?.[0];
  expect(doc, 'expected exactly one graphrag document').toBeTruthy();
  return doc!;
}

async function loadProjector() {
  process.env.GRAPHRAG_PERSISTENCE_ENABLED = 'true';
  vi.resetModules();
  stubPersistence();
  return import('../../../src/services/knowledge/approvedKnowledgeStore.js');
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.assertChromaCollectionExists.mockReset();
  mocks.assertChromaCollectionExists.mockResolvedValue(undefined);
  mocks.enqueueProjection.mockReset();
  mocks.enqueueProjection.mockResolvedValue('obx_test');
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.GRAPHRAG_PERSISTENCE_ENABLED;
  else process.env.GRAPHRAG_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

describe('backfill GraphRAG projection — canonical _id (LANE 1 regression)', () => {
  it('inserts a graphrag record whose _id is present, non-undefined, and equals the envelope id', async () => {
    const { projectApprovedChunkToGraphRag } = await loadProjector();
    const { record: chunk } = chromaRowToChunkRecord(eligibleRow());

    const projected = await projectApprovedChunkToGraphRag(chunk);
    expect(projected).not.toBeNull();

    const doc = insertDoc();
    // The exact failure mode: a missing/undefined _id.
    expect(Object.prototype.hasOwnProperty.call(doc, '_id')).toBe(true);
    expect(doc._id).toBeDefined();
    expect(doc._id).not.toBeUndefined();
    expect(typeof doc._id).toBe('string');
    // Envelope id and Mongo _id are the same canonical shared id.
    expect(doc._id).toBe(doc.id);
  });

  it('derives the _id deterministically from the chunk (mcsgraph_<knowledgeId>_v<version>_<lang>)', async () => {
    const { projectApprovedChunkToGraphRag } = await loadProjector();
    const { record: chunk } = chromaRowToChunkRecord(eligibleRow());

    const expectedId = `mcsgraph_${String(chunk.knowledgeId)}_v${chunk.sourceVersion}_${chunk.language}`;
    const projected = await projectApprovedChunkToGraphRag(chunk);

    expect((projected as { id: string }).id).toBe(expectedId);
    const doc = insertDoc();
    expect(doc._id).toBe(expectedId);
    expect(doc.knowledgeObjectId).toBe(String(chunk.knowledgeId));
    expect(doc.version).toBe(chunk.sourceVersion);
    expect(doc.language).toBe(chunk.language);
  });

  it('is idempotent by id — rerunning the same chunk yields the same _id (no duplicate record ids)', async () => {
    const { projectApprovedChunkToGraphRag } = await loadProjector();
    const { record: chunk } = chromaRowToChunkRecord(eligibleRow());

    await projectApprovedChunkToGraphRag(chunk);
    const firstId = insertDoc()._id;

    mocks.persistenceCall.mockClear();
    await projectApprovedChunkToGraphRag(chunk);
    const secondId = insertDoc()._id;

    expect(secondId).toBe(firstId);
  });
});
