import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  embed: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('undici', () => ({
  fetch: mocks.fetch,
}));

vi.mock('../chroma/embedder.js', () => ({
  embed: mocks.embed,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Chroma direct adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses GPU embeddings and upsert for Chroma add parity', async () => {
    const { chromaAdapter } = await import('../chroma/adapter.js');
    mocks.embed.mockResolvedValue([[0.1, 0.2, 0.3]]);
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ collections: [{ id: 'col-1', name: 'mcs_test' }] }))
      .mockResolvedValueOnce(jsonResponse({}));

    await expect(
      chromaAdapter('add', {
        collection: 'mcs_test',
        ids: ['id-1'],
        documents: ['hello'],
        metadatas: [{ kind: 'test' }],
      }),
    ).resolves.toEqual({ ok: true, count: 1 });

    expect(mocks.embed).toHaveBeenCalledWith(['hello']);
    expect(String(mocks.fetch.mock.calls[1]?.[0])).toContain('/collections/col-1/upsert');
    expect(JSON.parse(String(mocks.fetch.mock.calls[1]?.[1]?.body))).toEqual({
      ids: ['id-1'],
      documents: ['hello'],
      metadatas: [{ kind: 'test' }],
      embeddings: [[0.1, 0.2, 0.3]],
    });
  });

  it('normalizes direct search responses to the PERSISTENCE caller-facing shape', async () => {
    const { chromaAdapter } = await import('../chroma/adapter.js');
    mocks.embed.mockResolvedValue([[0.4, 0.5, 0.6]]);
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ collections: [{ id: 'col-1', name: 'mcs_test' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          ids: [['id-1', 'id-2']],
          documents: [['first', 'second']],
          metadatas: [[{ kind: 'one' }, { kind: 'two' }]],
          distances: [[0.1, 0.2]],
          include: ['documents', 'metadatas', 'distances'],
        }),
      );

    await expect(
      chromaAdapter('search', {
        collection: 'mcs_test',
        query: 'readiness',
        n_results: 2,
      }),
    ).resolves.toEqual({
      collection: 'mcs_test',
      query: 'readiness',
      n_results: 2,
      results: {
        ids: ['id-1', 'id-2'],
        documents: ['first', 'second'],
        metadatas: [{ kind: 'one' }, { kind: 'two' }],
        distances: [0.1, 0.2],
      },
    });

    expect(mocks.embed).toHaveBeenCalledWith(['readiness']);
    expect(String(mocks.fetch.mock.calls[1]?.[0])).toContain('/collections/col-1/query');
  });

  it('normalizes direct query_with_filter responses to the PERSISTENCE caller-facing shape', async () => {
    const { chromaAdapter } = await import('../chroma/adapter.js');
    mocks.embed.mockResolvedValue([[0.7, 0.8, 0.9]]);
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ collections: [{ id: 'col-1', name: 'mcs_test' }] }))
      .mockResolvedValueOnce(
        jsonResponse({
          ids: [['id-3']],
          documents: [['filtered']],
          metadatas: [[{ runId: 'phase3', source: 'direct' }]],
          distances: [[0.05]],
        }),
      );

    await expect(
      chromaAdapter('query_with_filter', {
        collection: 'mcs_test',
        query: 'filtered readiness',
        n_results: 3,
        filter: { runId: 'phase3' },
      }),
    ).resolves.toEqual({
      collection: 'mcs_test',
      n_results: 3,
      results: {
        ids: ['id-3'],
        documents: ['filtered'],
        metadatas: [{ runId: 'phase3', source: 'direct' }],
        distances: [0.05],
      },
    });

    expect(JSON.parse(String(mocks.fetch.mock.calls[1]?.[1]?.body))).toEqual({
      query_embeddings: [[0.7, 0.8, 0.9]],
      n_results: 3,
      where: { runId: 'phase3' },
    });
  });

  it('lists bounded metadata-only records without requesting documents or embeddings', async () => {
    const { chromaAdapter } = await import('../chroma/adapter.js');
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ collections: [{ id: 'col-1', name: 'mcs_test' }] }))
      .mockResolvedValueOnce(jsonResponse({ ids: ['id-1'], metadatas: [{ indexedAt: '2026-07-14' }] }));

    await expect(chromaAdapter('list_records', {
      collection: 'mcs_test',
      limit: 25,
      offset: 50,
      where: { domain: 'success', language: 'en' },
    })).resolves.toEqual({
      ids: ['id-1'],
      metadatas: [{ indexedAt: '2026-07-14' }],
      count: 1,
      limit: 25,
      offset: 50,
    });
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(JSON.parse(String(mocks.fetch.mock.calls[1]?.[1]?.body))).toEqual({
      limit: 25,
      offset: 50,
      include: ['metadatas'],
      where: { $and: [{ domain: 'success' }, { language: 'en' }] },
    });
  });

  it('supports metadata-only exact-id readback for maintenance verification', async () => {
    const { chromaAdapter } = await import('../chroma/adapter.js');
    mocks.fetch
      .mockResolvedValueOnce(jsonResponse({ collections: [{ id: 'col-1', name: 'mcs_test' }] }))
      .mockResolvedValueOnce(jsonResponse({ ids: ['id-1'], metadatas: [{ version: 1 }] }));

    await chromaAdapter('get', {
      collection: 'mcs_test',
      ids: ['id-1'],
      include_documents: false,
    });
    expect(JSON.parse(String(mocks.fetch.mock.calls[1]?.[1]?.body))).toEqual({
      ids: ['id-1'],
      include: ['metadatas'],
    });
  });
});
