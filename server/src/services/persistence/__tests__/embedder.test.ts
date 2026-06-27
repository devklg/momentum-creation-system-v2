import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
}));

vi.mock('undici', () => ({
  fetch: mocks.fetch,
}));

describe('GPU embedder client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails loud when the local GPU embedder is unavailable and never falls back to CPU', async () => {
    const { embed } = await import('../chroma/embedder.js');
    mocks.fetch.mockRejectedValue(new Error('connection refused'));

    await expect(embed(['must embed on GPU'])).rejects.toThrow('no CPU fallback');
  });
});
