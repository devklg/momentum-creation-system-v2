import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  observeKongaPageVisit,
  readKongaPageVisit,
} from '../kongaVisits.js';

interface VisitRow {
  _id: string;
  pageVisitId: string;
  tokenHash: string;
  observedGlobalPosition: number;
  previousGlobalPosition: number | null;
  sinceLastVisit: number | null;
  observedAt: string;
}

interface MarkerRow {
  _id: string;
  tokenHash: string;
  version: number;
  observedGlobalPosition: number | null;
  lastVisitRecordId: string | null;
  observedAt: string;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function markerId(hash: string): string {
  return `konga_visit_marker_${hash}`;
}

function matchesFilter(document: Record<string, unknown>, filter?: Record<string, unknown>): boolean {
  if (!filter) return true;
  for (const [field, value] of Object.entries(filter)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value) && '$lte' in value) {
      if (typeof (document as Record<string, unknown>)[field] !== 'number') return false;
      if (typeof value.$lte !== 'number') return false;
      if (Number((document as Record<string, unknown>)[field]) > Number(value.$lte)) return false;
      continue;
    }

    if ((document as Record<string, unknown>)[field] !== value) return false;
  }
  return true;
}

function applySet(document: MarkerRow, set: Record<string, unknown>): MarkerRow {
  const cloned = { ...document } as MarkerRow;
  for (const [field, value] of Object.entries(set)) {
    (cloned as Record<string, unknown>)[field] = value;
  }
  return cloned;
}

function markerBarrier(requiredReads: number): {
  wait: () => Promise<void>;
  clear: () => void;
} {
  if (requiredReads <= 0) {
    return {
      wait: async () => {},
      clear: () => {},
    };
  }

  let count = 0;
  let resolve: (() => void) | null = null;
  let promise: Promise<void> | null = null;
  promise = new Promise((r) => {
    resolve = r;
  });

  return {
    wait: async () => {
      count += 1;
      if (count >= requiredReads && resolve) {
        const done = resolve;
        resolve = null;
        done();
      }
      if (count < requiredReads && promise) {
        await promise;
      }
      return;
    },
    clear: () => {
      if (resolve) {
        resolve();
      }
      resolve = null;
      promise = null;
    },
  };
}

function createKongaVisitPersistence({
  marker,
  markerReadBarrier = 0,
}: {
  marker?: MarkerRow;
  markerReadBarrier?: number;
} = {}) {
  const visitCollection = new Map<string, VisitRow>();
  const barrier = markerBarrier(markerReadBarrier);
  let markerState = marker ?? null;

  const persistence = vi.fn(async (_tool: string, action: string, params: Record<string, unknown>) => {
    const collection = params.collection as string;

    if (collection === 'tmag_konga_visit_markers') {
      if (action === 'query') {
        await barrier.wait();
        const filter = params.filter as Record<string, unknown> | undefined;
        if (!filter) return { documents: markerState ? [markerState] : [] };
        if (filter._id) {
          return { documents: markerState && matchesFilter(markerState as never, filter) ? [markerState] : [] };
        }
        return { documents: markerState && matchesFilter(markerState as never, filter) ? [markerState] : [] };
      }

      if (action === 'insert') {
        const documents = (params.documents as MarkerRow[]) ?? [];
        const incoming = documents[0];
        if (!incoming) return { insertedCount: 0, insertedIds: {} };
        if (markerState && markerState._id === incoming._id) {
          throw new Error('duplicate_key');
        }
        markerState = incoming;
        return { insertedCount: 1, insertedIds: { 0: incoming._id } };
      }

      if (action === 'update') {
        const filter = params.filter as Record<string, unknown> | undefined;
        const update = params.update as { $set?: Record<string, unknown> } | undefined;
        if (!markerState || !filter || !matchesFilter(markerState as never, filter)) {
          return { matchedCount: 0, modifiedCount: 0 };
        }
        if (update?.$set) {
          markerState = applySet(markerState, update.$set);
        }
        return { matchedCount: 1, modifiedCount: 1 };
      }

      if (action === 'delete') {
        const filter = params.filter as Record<string, unknown> | undefined;
        if (!markerState || !filter || !matchesFilter(markerState as never, filter)) {
          return { deletedCount: 0 };
        }
        markerState = null;
        return { deletedCount: 1 };
      }
    }

    if (collection === 'tmag_konga_page_visits') {
      const filter = params.filter as Record<string, unknown> | undefined;
      const limit = params.limit as number | undefined;
      if (action === 'query') {
        if (typeof filter?._id === 'string') {
          const visit = visitCollection.get(filter._id);
          return { documents: visit ? [visit] : [] };
        }

        const latest = [...visitCollection.values()]
          .filter((row) => row.tokenHash === filter?.tokenHash)
          .sort((a, b) => b.observedAt.localeCompare(a.observedAt));

        return { documents: latest.slice(0, limit ?? latest.length) };
      }

      if (action === 'insert') {
        const documents = params.documents as VisitRow[];
        const document = documents[0];
        if (document) {
          visitCollection.set(document._id, document);
        }
        return { insertedCount: documents?.length ? documents.length : 0, insertedIds: { 0: document?._id } as Record<number, unknown> };
      }
    }

    if (action === 'update') {
      return { matchedCount: 1, modifiedCount: 1 };
    }

    return {};
  });

  const strictWrite = vi.fn(async (input: { id: string; mongoDoc: Record<string, unknown> }) => {
    visitCollection.set(input.id, input.mongoDoc as VisitRow);
    return { mongo: input.mongoDoc, neo4jCount: 1, chromaId: input.id };
  });

  return {
    persistence,
    strictWrite,
    markerState: () => markerState,
  };
}

describe('Konga reconnect-safe page visits', () => {
  it('returns null for first visit, advances once for a later visit, and keeps reconnect read-only', async () => {
    const fixture = createKongaVisitPersistence();
    const strictVerify = vi.fn(async () => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' }));

    const first = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '11111111-1111-4111-8111-111111111111',
        globalMaxPosition: 25,
        now: new Date('2026-07-17T10:00:00.000Z'),
      },
      {
        persistence: fixture.persistence as never,
        strictWrite: fixture.strictWrite as never,
        strictVerify,
      },
    );
    expect(first.sinceLastVisit).toBeNull();

    const retry = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '11111111-1111-4111-8111-111111111111',
        globalMaxPosition: 99,
        now: new Date('2026-07-17T10:01:00.000Z'),
      },
      {
        persistence: fixture.persistence as never,
        strictWrite: fixture.strictWrite as never,
        strictVerify,
      },
    );
    expect(retry.observedGlobalPosition).toBe(25);

    const later = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '22222222-2222-4222-8222-222222222222',
        globalMaxPosition: 31,
        now: new Date('2026-07-18T10:00:00.000Z'),
      },
      {
        persistence: fixture.persistence as never,
        strictWrite: fixture.strictWrite as never,
        strictVerify,
      },
    );
    expect(later.sinceLastVisit).toBe(6);

    const reconnect = await readKongaPageVisit(
      'TOKEN-ONE',
      later.pageVisitId,
      fixture.persistence as never,
    );
    expect(reconnect?.sinceLastVisit).toBe(6);
  });

  it('binds the same UUID independently to each token', async () => {
    const fixture = createKongaVisitPersistence();
    const strictWrite = vi.fn(async (input: { id: string }) => {
      return { mongo: {}, neo4jCount: 1, chromaId: input.id };
    });
    const pageVisitId = '33333333-3333-4333-8333-333333333333';
    await observeKongaPageVisit(
      { token: 'TOKEN-A', pageVisitId, globalMaxPosition: 1 },
      { persistence: fixture.persistence as never, strictWrite: strictWrite as never },
    );
    await observeKongaPageVisit(
      { token: 'TOKEN-B', pageVisitId, globalMaxPosition: 1 },
      { persistence: fixture.persistence as never, strictWrite: strictWrite as never },
    );

    expect(strictWrite.mock.calls[0][0].id).not.toBe(strictWrite.mock.calls[1][0].id);
  });

  it('uses marker CAS retries so concurrent distinct visit IDs do not share a stale baseline', async () => {
    const token = 'TOKEN-CONCURRENT';
    const hash = tokenHash(token);
    const existingMarker: MarkerRow = {
      _id: markerId(hash),
      tokenHash: hash,
      version: 1,
      observedGlobalPosition: 4,
      lastVisitRecordId: 'legacy-visit',
      observedAt: '2026-07-10T10:00:00.000Z',
    };
    const fixture = createKongaVisitPersistence({ marker: existingMarker, markerReadBarrier: 2 });

    const strictVerify = vi.fn(async () => ({ mongo: {}, neo4jCount: 1, chromaId: 'x' }));

    const [first, second] = await Promise.all([
      observeKongaPageVisit(
        {
          token,
          pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          globalMaxPosition: 19,
          now: new Date('2026-07-17T10:02:00.000Z'),
        },
        {
          persistence: fixture.persistence as never,
          strictWrite: fixture.strictWrite as never,
          strictVerify,
        },
      ),
      observeKongaPageVisit(
        {
          token,
          pageVisitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          globalMaxPosition: 19,
          now: new Date('2026-07-17T10:03:00.000Z'),
        },
        {
          persistence: fixture.persistence as never,
          strictWrite: fixture.strictWrite as never,
          strictVerify,
        },
      ),
    ]);

    const previousValues = [first.previousGlobalPosition, second.previousGlobalPosition].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(previousValues).toEqual([4, 19]);

    const finals = fixture.markerState();
    expect(finals?.observedGlobalPosition).toBe(19);
    expect(finals?.version).toBe(3);
  });

  it('does not count a visit when the governed visit write fails', async () => {
    const token = 'TOKEN-ROLLBACK';
    const hash = tokenHash(token);
    const existingMarker: MarkerRow = {
      _id: markerId(hash),
      tokenHash: hash,
      version: 1,
      observedGlobalPosition: 10,
      lastVisitRecordId: 'seed-visit',
      observedAt: '2026-07-10T10:00:00.000Z',
    };
    const fixture = createKongaVisitPersistence({ marker: existingMarker });

    const strictWrite = vi.fn(async () => {
      throw new Error('konga_neo4j_readback_not_exact');
    });

    await expect(
      observeKongaPageVisit(
        {
          token,
          pageVisitId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
          globalMaxPosition: 21,
          now: new Date('2026-07-17T10:04:00.000Z'),
        },
        { persistence: fixture.persistence as never, strictWrite: strictWrite as never },
      ),
    ).rejects.toThrow('konga_neo4j_readback_not_exact');

    const after = fixture.markerState();
    expect(after).toEqual(existingMarker);
  });
});
