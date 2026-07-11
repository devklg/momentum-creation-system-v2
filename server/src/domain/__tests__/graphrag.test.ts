import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { McsGraphRagInput, McsGraphRagQuery } from '@momentum/shared';

/** Phase 7 · R3 — GraphRAG writer + retrieval tests (P7.6). */

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  writeKnowledge: vi.fn(),
}));

vi.mock('../../services/persistence/dispatch.js', () => ({ persistenceCall: mocks.persistenceCall }));
vi.mock('../../services/tieredWrite.js', () => ({ writeKnowledge: mocks.writeKnowledge }));

type AnyRec = Record<string, unknown>;

const ORIGINAL_FLAG = process.env.GRAPHRAG_PERSISTENCE_ENABLED;

async function load(enabled: boolean) {
  process.env.GRAPHRAG_PERSISTENCE_ENABLED = enabled ? 'true' : 'false';
  vi.resetModules();
  return import('../graphrag.js');
}

function writeInput(overrides: Partial<McsGraphRagInput> = {}): McsGraphRagInput {
  return {
    knowledgeObjectId: 'kobj_1',
    version: 3,
    tenantId: 'team_magnificent',
    domain: 'performance',
    language: 'en',
    summary: 'Orientation within 48h correlates with faster launch.',
    modelVersion: 'minilm-2026-06',
    retrievalReady: true,
    ...overrides,
  };
}

function retrievalQuery(overrides: Partial<McsGraphRagQuery> = {}): McsGraphRagQuery {
  return {
    tenantId: 'team_magnificent',
    domain: 'performance',
    language: 'en',
    queryText: 'how fast do BAs launch after orientation',
    ...overrides,
  };
}

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.writeKnowledge.mockReset();
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.GRAPHRAG_PERSISTENCE_ENABLED;
  else process.env.GRAPHRAG_PERSISTENCE_ENABLED = ORIGINAL_FLAG;
});

describe('Phase 7 R3 — canary gate', () => {
  it('write + retrieval are no-ops when the flag is OFF (default)', async () => {
    const m = await load(false);
    expect(m.graphRagPersistenceEnabled()).toBe(false);
    expect(await m.appendGraphRagRecord(writeInput())).toBeNull();
    expect(await m.retrieveGraphRag(retrievalQuery())).toEqual([]);
    expect(mocks.writeKnowledge).not.toHaveBeenCalled();
    expect(mocks.persistenceCall).not.toHaveBeenCalled();
  });
});

describe('Phase 7 R3 — active-collection routing + isolation', () => {
  it('routes to the per-domain-per-language ACTIVE collection, never the review-only one', async () => {
    const m = await load(true);
    expect(m.activeKnowledgeCollection('performance', 'en')).toBe('mcs_performance_knowledge_en');
    expect(m.activeKnowledgeCollection('success', 'es')).toBe('mcs_success_knowledge_es');
    expect(m.activeKnowledgeCollection('organizational', 'en')).not.toContain('review');
  });

  it('writes to the active collection + mcs_graphrag_records with model provenance', async () => {
    const m = await load(true);
    const record = (await m.appendGraphRagRecord(writeInput()))!;

    expect(record.model).toBe('all-MiniLM-L6-v2');
    expect(record.modelVersion).toBe('minilm-2026-06');
    const call = mocks.writeKnowledge.mock.calls[0]![0] as AnyRec;
    expect(call.mongoCollection).toBe('mcs_graphrag_records');
    expect((call.chroma as AnyRec).collection).toBe('mcs_performance_knowledge_en');
    expect(((call.chroma as AnyRec).metadata as AnyRec).retrievalReady).toBe(true);
  });

  it('stamps the app-memory envelope with no PERSISTENCE-only fields', async () => {
    const m = await load(true);
    const record = (await m.appendGraphRagRecord(writeInput()))!;
    expect(record.namespace).toBe('momentum');
    expect(record.originKind).toBe('system');
    expect(record.teamKey).toBe('team_magnificent');
    expect(record).not.toHaveProperty('chat_number');
    expect(record).not.toHaveProperty('chat_registry_id');
  });

  it('rejects a record missing knowledgeObjectId / tenant / summary', async () => {
    const m = await load(true);
    await expect(m.appendGraphRagRecord(writeInput({ knowledgeObjectId: '' }))).rejects.toBeInstanceOf(m.GraphRagValidationError);
    await expect(m.appendGraphRagRecord(writeInput({ tenantId: '' }))).rejects.toBeInstanceOf(m.GraphRagValidationError);
    await expect(m.appendGraphRagRecord(writeInput({ summary: '   ' }))).rejects.toBeInstanceOf(m.GraphRagValidationError);
  });
});

describe('Phase 7 R3 — retrieval-ready gate', () => {
  it('applies a hard retrievalReady:true + tenant filter on the active collection', async () => {
    mocks.persistenceCall.mockResolvedValue({
      results: {
        ids: ['mcsgraph_kobj_1_v3_en'],
        documents: ['Orientation within 48h correlates with faster launch.'],
        distances: [0.12],
        metadatas: [{ knowledgeObjectId: 'kobj_1', version: 3 }],
      },
    });
    const m = await load(true);

    const hits = await m.retrieveGraphRag(retrievalQuery());

    const call = mocks.persistenceCall.mock.calls[0]!;
    expect(call[0]).toBe('chromadb');
    expect(call[1]).toBe('query_with_filter');
    const params = call[2] as AnyRec;
    expect(params.collection).toBe('mcs_performance_knowledge_en');
    expect(params.query).toBe('how fast do BAs launch after orientation');
    expect(params.n_results).toBe(5);
    expect(params.where).toEqual({ retrievalReady: true, tenantId: 'team_magnificent' });

    expect(hits).toHaveLength(1);
    expect(hits[0]!.knowledgeObjectId).toBe('kobj_1');
    expect(hits[0]!.distance).toBe(0.12);
  });

  it('returns [] cleanly when the active collection has no ready matches', async () => {
    mocks.persistenceCall.mockResolvedValue({ results: { ids: [], documents: [], distances: [], metadatas: [] } });
    const m = await load(true);
    expect(await m.retrieveGraphRag(retrievalQuery())).toEqual([]);
  });

  it('is fixed at 384-dim (embedding parity)', async () => {
    const m = await load(true);
    expect(m.graphRagEmbeddingDim()).toBe(384);
  });
});
