import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
  MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
  MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
} from '@momentum/shared/runtime';
import type {
  McsApprovedKnowledgeQueryRequest,
  McsRequestId,
  McsRuntimeRequestScope,
  McsSessionId,
  McsTeamId,
  McsTenantId,
  TmagId,
} from '@momentum/shared/runtime';
import {
  createKevinApprovedKnowledgeSource,
  createStoredApprovedKnowledgeProvider,
  getApprovedKnowledgeRetrievalCacheDiagnostics,
  invalidateApprovedKnowledgeRetrievalCache,
  resetApprovedKnowledgeRetrievalCacheForTests,
} from '../approvedKnowledgeStore.js';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
} from '../../../runtime/context/index.js';

const knowledgeWriteMock = vi.hoisted(() => {
  const writes: Array<{
    mongoCollection: string;
    mongoDoc: Record<string, unknown>;
    chroma?: { collection: string };
  }> = [];

  return {
    writes,
    write: vi.fn(async (input: {
      mongoCollection: string;
      mongoDoc: Record<string, unknown>;
      chroma?: { collection: string };
    }) => {
      writes.push(input);
    }),
  };
});

const persistenceMock = vi.hoisted(() => ({
  call: vi.fn(),
}));

const graphRagMock = vi.hoisted(() => ({ append: vi.fn() }));

vi.mock('../../tieredWrite.js', () => ({
  writeKnowledge: knowledgeWriteMock.write,
}));

vi.mock('../../persistence/dispatch.js', () => ({
  persistenceCall: persistenceMock.call,
}));

vi.mock('../../../domain/graphrag.js', () => ({
  appendGraphRagRecord: graphRagMock.append,
  GRAPHRAG_EMBEDDING_MODEL_VERSION: 'all-MiniLM-L6-v2',
}));

const scope: McsRuntimeRequestScope = {
  tenantId: 'tenant_team_magnificent' as McsTenantId,
  teamId: 'team_magnificent' as McsTeamId,
  teamKey: 'team_magnificent',
  teamName: 'Team Magnificent',
  tmagId: 'TMAG-001' as TmagId,
  requestId: 'ctx_req_store' as McsRequestId,
  sessionId: 'session_store' as McsSessionId,
};

function query(overrides: Partial<McsApprovedKnowledgeQueryRequest> = {}): McsApprovedKnowledgeQueryRequest {
  return {
    schemaVersion: APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
    scope,
    objective: 'training_support',
    domains: ['training'],
    language: 'en',
    allowLanguageFallback: true,
    freshness: { asOf: '2026-07-05T00:00:00.000Z' },
    ...overrides,
  };
}

describe('approved knowledge store schema projection', () => {
  beforeEach(() => {
    knowledgeWriteMock.write.mockClear();
    knowledgeWriteMock.writes.length = 0;
    persistenceMock.call.mockReset();
    graphRagMock.append.mockReset().mockResolvedValue(null);
    resetApprovedKnowledgeRetrievalCacheForTests();
    vi.useRealTimers();
  });

  it('creates canonical Knowledge Base source and chunk records for uploaded files', async () => {
    const result = await createKevinApprovedKnowledgeSource({
      title: 'PDF Training Source',
      content: '# First Section\n\nUse curiosity and service.',
      createdBy: 'TMAG-01',
      domain: 'training',
      language: 'en',
      format: 'pdf',
      sourceRef: 'upload:training.pdf',
      upload: {
        filename: 'training.pdf',
        mimeType: 'application/pdf',
        originalBytes: 1024,
        extractedCharacters: 38,
        sourceRef: 'upload:training.pdf',
      },
      topicTags: ['training'],
      agentScopes: ['michael_magnificent'],
      createdAt: '2026-07-04T12:00:00.000Z',
    });

    expect(result.source).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      title: 'PDF Training Source',
      format: 'pdf',
      authorityDecision: 'active_authority',
      chunkCount: result.chunks.length,
      upload: {
        filename: 'training.pdf',
        mimeType: 'application/pdf',
      },
    });
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      sourceTitle: 'PDF Training Source',
      authorityKind: 'kevin_authored',
      authorityStatus: 'active_authority',
      domain: 'training',
      language: 'en',
      retrievalEligible: true,
    });

    const sourceWrite = knowledgeWriteMock.writes[0];
    const firstChunkWrite = knowledgeWriteMock.writes[1];
    expect(sourceWrite).toBeDefined();
    expect(firstChunkWrite).toBeDefined();
    expect(sourceWrite).toMatchObject({
      mongoCollection: MCS_KNOWLEDGE_BASE_SOURCE_COLLECTION,
      chroma: {
        collection: 'mcs_training_knowledge_en',
      },
    });
    expect(sourceWrite?.mongoDoc).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      format: 'pdf',
    });
    expect(
      knowledgeWriteMock.writes
        .slice(1)
        .every((write) => write.mongoCollection === MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION),
    ).toBe(true);
    expect(firstChunkWrite?.mongoDoc).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      sourceTitle: 'PDF Training Source',
    });
    expect(graphRagMock.append).toHaveBeenCalledTimes(result.chunks.length);
    expect(graphRagMock.append).toHaveBeenCalledWith(expect.objectContaining({
      knowledgeObjectId: result.chunks[0]?.knowledgeId,
      domain: 'training',
      language: 'en',
      retrievalReady: false,
      derivedFrom: [result.source.sourceId, result.chunks[0]?.chunkId],
    }));
    expect(getApprovedKnowledgeRetrievalCacheDiagnostics()).toMatchObject({
      size: 0,
      invalidations: 1 + result.chunks.length,
    });
  });

  it('normalizes governance knowledge and never projects ineligible chunks as GraphRAG', async () => {
    const result = await createKevinApprovedKnowledgeSource({
      title: 'Governance Source', content: 'Approved governance guidance for the team.',
      createdBy: 'TMAG-01', domain: 'governance', language: 'en',
    });
    expect(graphRagMock.append).toHaveBeenCalledWith(expect.objectContaining({
      domain: 'organizational', retrievalReady: false,
    }));
    const { projectApprovedChunkToGraphRag } = await import('../approvedKnowledgeStore.js');
    graphRagMock.append.mockClear();
    await expect(projectApprovedChunkToGraphRag({ ...result.chunks[0]!, retrievalEligible: false })).resolves.toBeNull();
    expect(graphRagMock.append).not.toHaveBeenCalled();
  });

  it('preserves approved knowledge when a derived GraphRAG record cannot be created', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    graphRagMock.append.mockRejectedValue(new Error('derived store unavailable'));
    const result = await createKevinApprovedKnowledgeSource({
      title: 'Approved Source', content: 'Approved training guidance remains authoritative.',
      createdBy: 'TMAG-01', domain: 'training', language: 'en',
    });
    expect(result.source.status).toBe('active');
    expect(result.graphRagRecordCount).toBe(0);
    expect(result.graphRagFailureCount).toBe(result.chunks.length);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('derived store unavailable'));
    errorSpy.mockRestore();
  });

  it('semantic search maps Chroma top-k hits into approved knowledge references', async () => {
    persistenceMock.call.mockResolvedValue({
      results: {
        ids: ['chunk_1'],
        documents: ['Two legs and daily sharing create the training rhythm.'],
        metadatas: [{
          chunkId: 'chunk_1',
          sourceId: 'source_1',
          domain: 'training',
          language: 'en',
          status: 'active',
          retrievalEligible: true,
          title: 'Training Rhythm',
          authority: 'kevin',
          'scope.tenantId': 'tenant_team_magnificent',
          'scope.teamId': 'team_magnificent',
          'scope.teamKey': 'team_magnificent',
          'scope.teamName': 'Team Magnificent',
        }],
        distances: [0.12],
      },
    });

    const provider = createStoredApprovedKnowledgeProvider();
    const refs = await provider.searchApprovedKnowledge(scope, 'What should I do today?', 2);

    expect(persistenceMock.call).toHaveBeenCalledWith('chromadb', 'query_with_filter', {
      collection: MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION,
      query: 'What should I do today?',
      n_results: 2,
      filter: {
        status: 'active',
        retrievalEligible: true,
      },
    });
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      sourceId: 'source_1',
      title: 'Training Rhythm',
      summary: 'Two legs and daily sharing create the training rhythm.',
      domain: 'training',
      status: 'active',
      language: 'en',
      translationStatus: 'same_language',
    });
  });

  it('semantic search excludes non-approved and retrieval-ineligible hits defensively', async () => {
    persistenceMock.call.mockResolvedValue({
      results: {
        ids: ['candidate_chunk', 'disabled_chunk', 'active_chunk'],
        documents: ['candidate', 'disabled', 'active'],
        metadatas: [
          {
            chunkId: 'candidate_chunk',
            sourceId: 'source_candidate',
            domain: 'training',
            language: 'en',
            status: 'candidate',
            retrievalEligible: true,
          },
          {
            chunkId: 'disabled_chunk',
            sourceId: 'source_disabled',
            domain: 'training',
            language: 'en',
            status: 'active',
            retrievalEligible: false,
          },
          {
            chunkId: 'active_chunk',
            sourceId: 'source_active',
            domain: 'training',
            language: 'en',
            status: 'active',
            retrievalEligible: true,
            authorityStatus: 'active_authority',
          },
        ],
      },
    });

    const refs = await createStoredApprovedKnowledgeProvider()
      .searchApprovedKnowledge(scope, 'training', 30);

    expect(persistenceMock.call.mock.calls[0]?.[2]).toMatchObject({ n_results: 12 });
    expect(refs.map((ref) => ref.sourceId)).toEqual(['source_active']);
  });

  it('semantic references pass through P4.7 freshness and P4.6 language selection', async () => {
    persistenceMock.call.mockResolvedValue({
      results: {
        ids: ['expired_en', 'fresh_es'],
        documents: ['expired english', 'orientacion en espanol'],
        metadatas: [
          {
            chunkId: 'expired_en',
            sourceId: 'source_expired',
            domain: 'training',
            language: 'en',
            status: 'active',
            retrievalEligible: true,
            authority: 'kevin',
            expiresAt: '2026-07-01T00:00:00.000Z',
          },
          {
            chunkId: 'fresh_es',
            sourceId: 'source_es',
            domain: 'training',
            language: 'es',
            status: 'active',
            retrievalEligible: true,
            authority: 'kevin',
            translationStatus: 'human_reviewed_translation',
          },
        ],
      },
    });

    const store = createStoredApprovedKnowledgeProvider();
    const adapter = createContextManagerRetrievalAdapter({
      async listApprovedKnowledge(receivedScope) {
        return store.searchApprovedKnowledge(receivedScope, 'orientation');
      },
    }, {
      now: () => new Date('2026-07-05T00:00:00.000Z'),
    });

    const result = await adapter.retrieveApprovedKnowledge(query());

    expect(result.status).toBe('ok');
    expect(result.references.map((ref) => ref.sourceId)).toEqual(['source_es']);
    expect(result.metadata.language).toMatchObject({
      language: 'en',
      fallbackLanguage: 'es',
      translationStatus: 'human_reviewed_translation',
    });
  });

  it('semantic search logs loudly and returns empty references on embedder or Chroma failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    persistenceMock.call.mockRejectedValue(new Error('[gpu-embedder] unavailable'));

    const refs = await createStoredApprovedKnowledgeProvider()
      .searchApprovedKnowledge(scope, 'training');

    expect(refs).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('embedder/Chroma'));
    errorSpy.mockRestore();
  });

  it('single-flights identical concurrent searches and returns isolated copies', async () => {
    let release!: (value: unknown) => void;
    persistenceMock.call.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const providerA = createStoredApprovedKnowledgeProvider();
    const providerB = createStoredApprovedKnowledgeProvider();

    const first = providerA.searchApprovedKnowledge(scope, '  Daily   Rhythm ', 4, 'en');
    const second = providerB.searchApprovedKnowledge(scope, 'Daily Rhythm', 4, 'en');
    expect(persistenceMock.call).toHaveBeenCalledTimes(1);
    release({
      results: {
        ids: ['chunk_single_flight'],
        documents: ['Approved daily rhythm.'],
        metadatas: [{
          chunkId: 'chunk_single_flight', sourceId: 'source_single_flight',
          domain: 'training', language: 'en', status: 'active', retrievalEligible: true,
        }],
      },
    });

    const [left, right] = await Promise.all([first, second]);
    expect(left).toEqual(right);
    expect(left).not.toBe(right);
    expect(getApprovedKnowledgeRetrievalCacheDiagnostics()).toMatchObject({
      misses: 1, coalesced: 1, size: 1, inFlight: 0,
    });

    (left[0] as { summary?: string }).summary = 'caller mutation';
    const cached = await providerA.searchApprovedKnowledge(scope, 'daily rhythm', 4, 'en');
    expect(cached[0]?.summary).toBe('Approved daily rhythm.');
    expect(getApprovedKnowledgeRetrievalCacheDiagnostics().hits).toBe(1);
  });

  it('keeps query limit language and tenant/team/BA scope isolated', async () => {
    persistenceMock.call.mockResolvedValue({
      results: {
        ids: ['chunk_scope'], documents: ['Approved scoped guidance.'],
        metadatas: [{
          chunkId: 'chunk_scope', sourceId: 'source_scope', domain: 'training',
          language: 'en', status: 'active', retrievalEligible: true,
        }],
      },
    });
    const provider = createStoredApprovedKnowledgeProvider();
    await provider.searchApprovedKnowledge(scope, 'scope', 4, 'en');
    await provider.searchApprovedKnowledge(scope, 'scope', 5, 'en');
    await provider.searchApprovedKnowledge(scope, 'scope', 4, 'es');
    await provider.searchApprovedKnowledge({ ...scope, tmagId: 'TMAG-002' as TmagId }, 'scope', 4, 'en');
    const anotherTeamScope = { ...scope, teamKey: 'another_team' } as unknown as McsRuntimeRequestScope;
    await provider.searchApprovedKnowledge(anotherTeamScope, 'scope', 4, 'en');
    expect(persistenceMock.call).toHaveBeenCalledTimes(5);
    expect(getApprovedKnowledgeRetrievalCacheDiagnostics()).toMatchObject({ misses: 5, hits: 0, size: 5 });
  });

  it('expires successful entries after five seconds and never caches empty or failed results', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-14T00:00:00.000Z'));
    const provider = createStoredApprovedKnowledgeProvider();
    persistenceMock.call
      .mockResolvedValueOnce({ results: { ids: [], documents: [], metadatas: [] } })
      .mockRejectedValueOnce(new Error('store unavailable'))
      .mockResolvedValue({
        results: {
          ids: ['chunk_ttl'], documents: ['Approved TTL guidance.'],
          metadatas: [{
            chunkId: 'chunk_ttl', sourceId: 'source_ttl', domain: 'training',
            language: 'en', status: 'active', retrievalEligible: true,
          }],
        },
      });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(provider.searchApprovedKnowledge(scope, 'ttl', 2, 'en')).resolves.toEqual([]);
    await expect(provider.searchApprovedKnowledge(scope, 'ttl', 2, 'en')).resolves.toEqual([]);
    await expect(provider.searchApprovedKnowledge(scope, 'ttl', 2, 'en')).resolves.toHaveLength(1);
    await expect(provider.searchApprovedKnowledge(scope, 'ttl', 2, 'en')).resolves.toHaveLength(1);
    expect(persistenceMock.call).toHaveBeenCalledTimes(3);

    vi.advanceTimersByTime(5_001);
    await expect(provider.searchApprovedKnowledge(scope, 'ttl', 2, 'en')).resolves.toHaveLength(1);
    expect(persistenceMock.call).toHaveBeenCalledTimes(4);
    errorSpy.mockRestore();
  });

  it('does not populate an invalidated in-flight generation', async () => {
    let release!: (value: unknown) => void;
    persistenceMock.call.mockImplementation(() => new Promise((resolve) => { release = resolve; }));
    const provider = createStoredApprovedKnowledgeProvider();
    const first = provider.searchApprovedKnowledge(scope, 'generation', 2, 'en');
    invalidateApprovedKnowledgeRetrievalCache();
    release({
      results: {
        ids: ['chunk_generation'], documents: ['Approved generation guidance.'],
        metadatas: [{
          chunkId: 'chunk_generation', sourceId: 'source_generation', domain: 'training',
          language: 'en', status: 'active', retrievalEligible: true,
        }],
      },
    });
    await expect(first).resolves.toHaveLength(1);
    expect(getApprovedKnowledgeRetrievalCacheDiagnostics()).toMatchObject({ size: 0, invalidations: 1 });
  });

  it('evicts the least-recently-used entry at the deterministic 128-entry bound', async () => {
    persistenceMock.call.mockImplementation(async (_tool, _action, params: { query: string }) => ({
      results: {
        ids: [`chunk_${params.query}`], documents: [`Approved ${params.query}.`],
        metadatas: [{
          chunkId: `chunk_${params.query}`, sourceId: `source_${params.query}`,
          domain: 'training', language: 'en', status: 'active', retrievalEligible: true,
        }],
      },
    }));
    const provider = createStoredApprovedKnowledgeProvider();
    for (let index = 0; index < 129; index += 1) {
      await provider.searchApprovedKnowledge(scope, `bounded-${index}`, 2, 'en');
    }
    expect(getApprovedKnowledgeRetrievalCacheDiagnostics()).toMatchObject({ size: 128, evictions: 1 });

    await provider.searchApprovedKnowledge(scope, 'bounded-0', 2, 'en');
    expect(persistenceMock.call).toHaveBeenCalledTimes(130);
    expect(getApprovedKnowledgeRetrievalCacheDiagnostics()).toMatchObject({ size: 128, evictions: 2 });
  });

  it('keeps performance diagnostics free of query, BA, packet, and knowledge content', async () => {
    persistenceMock.call.mockResolvedValue({
      results: {
        ids: ['DO_NOT_EXPOSE'], documents: ['DO_NOT_EXPOSE'],
        metadatas: [{
          chunkId: 'DO_NOT_EXPOSE', sourceId: 'DO_NOT_EXPOSE', domain: 'training',
          language: 'en', status: 'active', retrievalEligible: true,
        }],
      },
    });
    await createStoredApprovedKnowledgeProvider()
      .searchApprovedKnowledge(scope, 'DO_NOT_EXPOSE', 2, 'en');
    const json = JSON.stringify(getApprovedKnowledgeRetrievalCacheDiagnostics());
    expect(json).not.toContain('DO_NOT_EXPOSE');
    expect(json).not.toMatch(/query|tmagId|sessionId|packet|knowledgeId|summary|content/i);
  });
});
