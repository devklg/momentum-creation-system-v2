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
} from '../approvedKnowledgeStore.js';
import {
  APPROVED_KNOWLEDGE_QUERY_SCHEMA_VERSION,
  createContextManagerRetrievalAdapter,
} from '../../../runtime/context/index.js';

const tripleStackMock = vi.hoisted(() => {
  const writes: Array<{
    mongoCollection: string;
    mongoDoc: Record<string, unknown>;
    chroma?: { collection: string; metadata?: Record<string, unknown> };
  }> = [];

  return {
    writes,
    write: vi.fn(async (input: {
      mongoCollection: string;
      mongoDoc: Record<string, unknown>;
      chroma?: { collection: string; metadata?: Record<string, unknown> };
    }) => {
      writes.push(input);
    }),
  };
});

const persistenceMock = vi.hoisted(() => ({
  call: vi.fn(),
}));

const documentIndexMock = vi.hoisted(() => ({
  update: vi.fn(async () => ({
    path: 'D:/momentum-creation-system-v2/knowledge/KB_DOCUMENT_INDEX.md',
    mode: 'refreshed',
    rowCount: 1,
    totalSources: 1,
  })),
}));

vi.mock('../../tripleStack.js', () => ({
  tripleStackWrite: tripleStackMock.write,
}));

vi.mock('../../persistence/dispatch.js', () => ({
  persistenceCall: persistenceMock.call,
}));

vi.mock('../documentIndex.js', () => ({
  updateKnowledgeDocumentIndex: documentIndexMock.update,
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
    tripleStackMock.write.mockClear();
    tripleStackMock.writes.length = 0;
    persistenceMock.call.mockReset();
    documentIndexMock.update.mockClear();
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

    const sourceWrite = tripleStackMock.writes[0];
    const firstChunkWrite = tripleStackMock.writes[1];
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
      taxonomy: expect.objectContaining({
        taxonomyVersion: 'kb_taxonomy.v1',
        primaryCategory: 'general-training',
      }),
      categoryTags: expect.arrayContaining(['general-training']),
      canonicalTopicTags: expect.arrayContaining(['training']),
    });
    expect(sourceWrite?.chroma?.metadata).toMatchObject({
      taxonomyVersion: 'kb_taxonomy.v1',
      taxonomyPrimaryCategory: 'general-training',
      'kb.category.general_training': true,
    });
    expect(
      tripleStackMock.writes
        .slice(1)
        .every((write) => write.mongoCollection === MCS_KNOWLEDGE_BASE_CHUNK_COLLECTION),
    ).toBe(true);
    expect(firstChunkWrite?.mongoDoc).toMatchObject({
      schemaVersion: MCS_KNOWLEDGE_BASE_SCHEMA_VERSION,
      sourceTitle: 'PDF Training Source',
      taxonomy: expect.objectContaining({
        taxonomyVersion: 'kb_taxonomy.v1',
        primaryCategory: 'general-training',
      }),
      categoryTags: expect.arrayContaining(['general-training']),
    });
    expect(firstChunkWrite?.chroma?.metadata).toMatchObject({
      taxonomyVersion: 'kb_taxonomy.v1',
      taxonomyPrimaryCategory: 'general-training',
      'kb.category.general_training': true,
    });
    expect(persistenceMock.call).toHaveBeenCalledWith('neo4j', 'cypher', expect.objectContaining({
      query: expect.stringContaining('KnowledgeCategory'),
    }));
    expect(persistenceMock.call).toHaveBeenCalledWith('neo4j', 'cypher', expect.objectContaining({
      query: expect.stringContaining('KnowledgeTopic'),
    }));
    expect(documentIndexMock.update).toHaveBeenCalledWith({ refreshAll: true });
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
        $and: [
          { status: 'active' },
          { retrievalEligible: true },
        ],
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

  it('semantic search applies taxonomy hints before broad fallback', async () => {
    persistenceMock.call.mockResolvedValueOnce({
      results: {
        ids: ['glp_chunk'],
        documents: ['GLP THREE supports healthy metabolism.'],
        metadatas: [{
          chunkId: 'glp_chunk',
          sourceId: 'source_glp',
          domain: 'training',
          language: 'en',
          status: 'active',
          retrievalEligible: true,
          authorityStatus: 'active_authority',
          title: 'GLP THREE',
        }],
      },
    });

    const refs = await createStoredApprovedKnowledgeProvider()
      .searchApprovedKnowledge(scope, 'GLP THREE metabolic support', 1);

    expect(persistenceMock.call).toHaveBeenCalledTimes(1);
    expect(persistenceMock.call.mock.calls[0]?.[2]).toMatchObject({
      n_results: 8,
      filter: {
        $and: [
          { status: 'active' },
          { retrievalEligible: true },
          {
            $or: expect.arrayContaining([
              { 'kb.product.glp_three': true },
              { 'kb.category.products': true },
            ]),
          },
        ],
      },
    });
    expect(refs).toHaveLength(1);
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
});
