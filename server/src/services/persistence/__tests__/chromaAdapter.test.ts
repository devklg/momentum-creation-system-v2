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
});
