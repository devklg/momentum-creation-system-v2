import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  persistenceCall: vi.fn(),
  assertChromaCollectionExists: vi.fn(),
}));

vi.mock('../persistence/dispatch.js', () => ({ persistenceCall: mocks.persistenceCall }));
vi.mock('../chromaCollections.js', () => ({
  assertChromaCollectionExists: mocks.assertChromaCollectionExists,
}));

import { tripleStackWrite } from '../tripleStack.js';

beforeEach(() => {
  mocks.persistenceCall.mockReset();
  mocks.assertChromaCollectionExists.mockReset();
  mocks.persistenceCall.mockResolvedValue({ insertedCount: 1 });
  mocks.assertChromaCollectionExists.mockResolvedValue(undefined);
});

describe('tripleStackWrite per-store ok flags', () => {
  it('reports ok:false for legs that were skipped (mongo-only write)', async () => {
    const res = await tripleStackWrite({ id: 'X1', mongoCollection: 'c', mongoDoc: { a: 1 } });
    expect(res.mongo.ok).toBe(true);
    expect(res.neo4j.ok).toBe(false);
    expect(res.chroma.ok).toBe(false);
    expect(res.chroma.verified).toBe(false);
  });

  it('reports ok:true only for legs that actually executed', async () => {
    const res = await tripleStackWrite({
      id: 'X2',
      mongoCollection: 'c',
      mongoDoc: { a: 1 },
      neo4j: { cypher: 'RETURN 1' },
      chroma: { collection: 'k', document: 'd' },
    });
    expect(res.neo4j.ok).toBe(true);
    expect(res.chroma.ok).toBe(true);
    expect(res.chroma.verified).toBe(true);
  });
});
