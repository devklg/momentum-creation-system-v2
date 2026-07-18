import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { tripleStackWriteWithReadback } from '../kongaPersistence.js';
import {
  observeKongaPageVisit,
  readKongaPageVisit,
} from '../kongaVisits.js';

type Persistence = <T = unknown>(tool: string, action: string, params: Record<string, unknown>) => Promise<T>;
type StrictWrite = typeof tripleStackWriteWithReadback;

type MarkerState = 'pending' | 'committed' | 'aborted';
type AnyRec = Record<string, unknown>;

interface VisitRow {
  _id: string;
  pageVisitId: string;
  tokenHash: string;
  visitRecordId: string;
  observedGlobalPosition: number;
  previousGlobalPosition: number | null;
  sinceLastVisit: number | null;
  observedAt: string;
}

interface MarkerRow {
  _id: string;
  markerId: string;
  tokenHash: string;
  version: number;
  state: MarkerState;
  previousGlobalPosition: number | null;
  previousVisitRecordId: string | null;
  observedGlobalPosition: number | null;
  pageVisitRecordId: string | null;
  observedAt: string;
}

interface SeedMarkerRow extends MarkerRow {
  neo4jReady: boolean;
  chromaReady: boolean;
}

interface KongaFixture {
  persistence: Persistence;
  strictWrite: StrictWrite;
  state: {
    visitRows: Map<string, VisitRow>;
    markerRows: Map<string, MarkerRow>;
    neo4jVisits: Set<string>;
    neo4jMarkers: Set<string>;
    chromaCollections: Map<string, Set<string>>;
    markerQueryGate: {
      wait: () => Promise<void>;
    };
  };
}

async function writeDirectToStores(
  input: Parameters<StrictWrite>[0],
  persistence: KongaFixture['persistence'],
): Promise<unknown> {
  const persistenceWithDb = input.mongoDatabase ?? 'momentum';
  await persistence('mongodb', 'insert', {
    database: persistenceWithDb,
    collection: String(input.mongoCollection),
    documents: [{ _id: input.id, ...(input.mongoDoc as AnyRec) }],
  });

  let neo4jCounters: Record<string, number> | undefined;
  if (input.neo4j) {
    await persistence('neo4j', 'cypher', {
      query: String((input.neo4j as AnyRec).cypher),
      params: { id: input.id, ...((input.neo4j as AnyRec).params as Record<string, unknown>) },
    });
    neo4jCounters = {};
  }

  let chroma = false;
  if (input.chroma) {
    await persistence('chromadb', 'add', {
      collection: String((input.chroma as AnyRec).collection),
      ids: [String(input.id)],
      documents: [String((input.chroma as AnyRec).document)],
      metadatas: [((input.chroma as AnyRec).metadata as Record<string, unknown>) ?? {}],
    });
    chroma = true;
  }

  return {
    mongo: { ok: true, insertedCount: 1 },
    neo4j: { ok: !!input.neo4j, counters: neo4jCounters },
    chroma: { ok: chroma, verified: chroma },
  };
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function tokenHash(token: string): string {
  return sha(token);
}

function visitRecordId(token: string, pageVisitId: string): string {
  return `konga_visit_${sha(`${tokenHash(token)}|${pageVisitId}`)}`;
}

function markerCollectionKey(hash: string): string {
  return `konga_visit_marker_${hash}`;
}

function markerEventId(markerKey: string, version: number, state: MarkerState): string {
  return `${markerKey}:v${version}:${state}`;
}

function makeDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeReadBarrier(requiredReads: number) {
  let pending = requiredReads;
  const waiters: Array<() => void> = [];

  return {
    wait: async () => {
      if (pending <= 0) return;
      pending -= 1;
      if (pending <= 0) {
        while (waiters.length > 0) waiters.shift()?.();
        return;
      }
      await new Promise<void>((resolve) => waiters.push(resolve));
    },
  };
}

function matchesFilter(document: AnyRec, filter: AnyRec = {}): boolean {
  for (const [field, expected] of Object.entries(filter)) {
    if (typeof expected === 'object' && expected !== null && !Array.isArray(expected) && '$lte' in expected) {
      const limit = (expected as { $lte: number }).$lte;
      const value = Number(document[field]);
      if (!Number.isFinite(value) || value > Number(limit)) return false;
      continue;
    }
    if (document[field] !== expected) return false;
  }
  return true;
}

function createFixture({
  seedVisits = [],
  seedMarkers = [],
  markerReadBarrier = 0,
  strictWrite,
}: {
  seedVisits?: VisitRow[];
  seedMarkers?: SeedMarkerRow[];
  markerReadBarrier?: number;
  strictWrite?: StrictWrite;
} = {}): KongaFixture {
  const visitRows = new Map<string, VisitRow>();
  const markerRows = new Map<string, MarkerRow>();
  const neo4jVisits = new Set<string>();
  const neo4jMarkers = new Set<string>();
  const chromaCollections = new Map<string, Set<string>>();
  const markerQueryGate = makeReadBarrier(markerReadBarrier);
  const defaultCollections = ['mcs_konga_page_visits', 'mcs_konga_visit_markers'] as const;

  for (const visit of seedVisits) visitRows.set(visit._id, visit);
  for (const marker of seedMarkers) {
    markerRows.set(marker._id, marker);
    if (marker.neo4jReady) neo4jMarkers.add(marker._id);
    if (marker.chromaReady) {
      const set = chromaCollections.get('mcs_konga_visit_markers') ?? new Set<string>();
      set.add(marker._id);
      chromaCollections.set('mcs_konga_visit_markers', set);
    }
  }
  for (const collection of defaultCollections) {
    chromaCollections.set(collection, chromaCollections.get(collection) ?? new Set<string>());
  }

  const persistence = vi.fn(async <T>(
    tool: string,
    action: string,
    params: Record<string, unknown>,
  ): Promise<T> => {
    const anyParams = params as AnyRec;
    if (tool === 'mongodb' && action === 'query') {
      const collection = String(anyParams.collection);
      const filter = anyParams.filter as AnyRec | undefined;
      const sort = anyParams.sort as Record<string, number> | undefined;
      const limit = typeof anyParams.limit === 'number' ? anyParams.limit : undefined;

      if (collection === 'tmag_konga_page_visits') {
        let documents = Array.from(visitRows.values()).filter((row) => matchesFilter(row, filter));
        if (sort?.observedAt === -1) {
          documents = documents.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
        }
        if (typeof limit === 'number') documents = documents.slice(0, limit);
        return { documents } as T;
      }

      if (collection === 'tmag_konga_visit_markers') {
        await markerQueryGate.wait();
        let documents = Array.from(markerRows.values())
          .filter((row) => matchesFilter(row, filter))
          .sort((a, b) => b.version - a.version || b.observedAt.localeCompare(a.observedAt));
        if (typeof limit === 'number') documents = documents.slice(0, limit);
        return { documents } as T;
      }

      return { documents: [] } as T;
    }

    if (tool === 'mongodb' && action === 'insert') {
      const collection = String(anyParams.collection);
      const documents = (anyParams.documents as AnyRec[]) ?? [];
      for (const doc of documents) {
        const id = String((doc as AnyRec)._id);
        if (collection === 'tmag_konga_page_visits') {
          if (visitRows.has(id)) throw new Error('E11000 duplicate key');
          visitRows.set(id, doc as unknown as VisitRow);
        } else if (collection === 'tmag_konga_visit_markers') {
          if (markerRows.has(id)) throw new Error('E11000 duplicate key');
          markerRows.set(id, doc as unknown as MarkerRow);
        }
      }
      return {
        insertedCount: documents.length,
        insertedIds: Object.fromEntries(documents.map((_, index) => [index, String((documents[index] as AnyRec)._id)])),
      } as T;
    }

    if (tool === 'neo4j' && action === 'cypher') {
      const query = String(anyParams.query ?? '');
      const id = String((anyParams.params as AnyRec | undefined)?.id ?? anyParams.id ?? '');
      if (query.includes('TmagKongaPageVisitMarker')) {
        if (query.includes('MERGE')) neo4jMarkers.add(id);
        return { records: [{ n: neo4jMarkers.has(id) ? 1 : 0 }] } as T;
      }
      if (query.includes('TmagKongaPageVisit')) {
        if (query.includes('MERGE')) neo4jVisits.add(id);
        return { records: [{ n: neo4jVisits.has(id) ? 1 : 0 }] } as T;
      }
      return { records: [{ n: 0 }] } as T;
    }

    if (tool === 'chromadb' && action === 'add') {
      const collection = String(anyParams.collection);
      const ids = (anyParams.ids as string[]) ?? [];
      const set = chromaCollections.get(collection) ?? new Set<string>();
      for (const id of ids) set.add(id);
      chromaCollections.set(collection, set);
      return { ids } as T;
    }

    if (tool === 'chromadb' && action === 'get') {
      const collection = String(anyParams.collection);
      const ids = (anyParams.ids as string[]) ?? [];
      const set = chromaCollections.get(collection) ?? new Set<string>();
      return { ids: ids.filter((id) => set.has(id)) } as T;
    }

    if (tool === 'chromadb' && action === 'list_collections') {
      return {
        collections: Array.from(chromaCollections.keys()).map((name) => ({ name })),
      } as T;
    }

    return {} as T;
  });

  const defaultStrictWrite: StrictWrite = async (input, nextPersistence = persistence, writer) => {
    const write: Parameters<StrictWrite>[2] = (writerInput: Parameters<StrictWrite>[0]) =>
      writeDirectToStores(writerInput, nextPersistence) as ReturnType<Parameters<StrictWrite>[2]>;
    return tripleStackWriteWithReadback(
      input as Parameters<StrictWrite>[0],
      nextPersistence as Parameters<StrictWrite>[1],
      (writer ?? write) as Parameters<StrictWrite>[2],
    ) as ReturnType<StrictWrite>;
  };

  return {
    persistence,
    strictWrite: strictWrite ?? defaultStrictWrite,
    state: {
      visitRows,
      markerRows,
      neo4jVisits,
      neo4jMarkers,
      chromaCollections,
      markerQueryGate,
    },
  };
}

function latestMarkerForToken(token: string, markerRows: Map<string, MarkerRow>): MarkerRow | null {
  const hash = tokenHash(token);
  const statePriority: Record<MarkerState, number> = {
    committed: 3,
    aborted: 2,
    pending: 1,
  };
  return (
    Array.from(markerRows.values())
      .filter((marker) => marker.tokenHash === hash)
      .sort(
        (a, b) =>
          b.version - a.version ||
          statePriority[b.state] - statePriority[a.state] ||
          b.observedAt.localeCompare(a.observedAt),
      )[0] ?? null
  );
}

function markerEvent(hash: string, version: number, state: MarkerState, options: {
  previousGlobalPosition: number | null;
  observedGlobalPosition: number | null;
  previousVisitRecordId?: string | null;
  pageVisitRecordId?: string | null;
  observedAt: string;
  neo4jReady?: boolean;
  chromaReady?: boolean;
}): SeedMarkerRow {
  const key = markerCollectionKey(hash);
  return {
    _id: markerEventId(key, version, state),
    markerId: key,
    tokenHash: hash,
    version,
    state,
    previousGlobalPosition: options.previousGlobalPosition,
    previousVisitRecordId: options.previousVisitRecordId ?? null,
    observedGlobalPosition: options.observedGlobalPosition,
    pageVisitRecordId: options.pageVisitRecordId ?? null,
    observedAt: options.observedAt,
    neo4jReady: options.neo4jReady ?? true,
    chromaReady: options.chromaReady ?? true,
  };
}

describe('Konga reconnect-safe page visits', () => {
  it('returns null for first visit, advances once for a later visit, and keeps reconnect read-only', async () => {
    const fixture = createFixture();
    const first = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '11111111-1111-4111-8111-111111111111',
        globalMaxPosition: 25,
        now: new Date('2026-07-17T10:00:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );
    expect(first.sinceLastVisit).toBeNull();

    const retry = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '11111111-1111-4111-8111-111111111111',
        globalMaxPosition: 99,
        now: new Date('2026-07-17T10:01:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );
    expect(retry.observedGlobalPosition).toBe(25);

    const later = await observeKongaPageVisit(
      {
        token: 'TOKEN-ONE',
        pageVisitId: '22222222-2222-4222-8222-222222222222',
        globalMaxPosition: 31,
        now: new Date('2026-07-18T10:00:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );
    expect(later.sinceLastVisit).toBe(6);

    const reconnect = await readKongaPageVisit('TOKEN-ONE', later.pageVisitId, fixture.persistence);
    expect(reconnect?.sinceLastVisit).toBe(6);
  });

  it('binds the same UUID independently to each token', async () => {
    const fixture = createFixture();
    const pageVisitId = '33333333-3333-4333-8333-333333333333';
    await observeKongaPageVisit(
      { token: 'TOKEN-A', pageVisitId, globalMaxPosition: 1 },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );
    await observeKongaPageVisit(
      { token: 'TOKEN-B', pageVisitId, globalMaxPosition: 1 },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );
    expect(fixture.state.visitRows.size).toBe(2);
  });

  it('deduplicates concurrent same pageVisitId attempts with deterministic barrier', async () => {
    const token = 'TOKEN-CONCURRENT-SAME';
    const hash = tokenHash(token);
    const fixture = createFixture({
      markerReadBarrier: 2,
      seedMarkers: [
        markerEvent(hash, 1, 'committed', {
          previousGlobalPosition: null,
          observedGlobalPosition: 4,
          pageVisitRecordId: null,
          observedAt: '2026-07-10T10:00:00.000Z',
        }),
      ],
    });

    const pageVisitId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const [first, second] = await Promise.all([
      observeKongaPageVisit(
        {
          token,
          pageVisitId,
          globalMaxPosition: 19,
          now: new Date('2026-07-17T10:02:00.000Z'),
        },
        { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
      ),
      observeKongaPageVisit(
        {
          token,
          pageVisitId,
          globalMaxPosition: 19,
          now: new Date('2026-07-17T10:03:00.000Z'),
        },
        { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
      ),
    ]);

    expect(first.previousGlobalPosition).toBe(4);
    expect(second.previousGlobalPosition).toBe(4);
    expect(fixture.state.visitRows.size).toBe(1);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.version).toBe(2);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.state).toBe('committed');
    expect(first.observedGlobalPosition).toBe(19);
  });

  it('serializes two concurrent distinct pageVisitIds into monotonic claim order', async () => {
    const token = 'TOKEN-CONCURRENT-DISTINCT';
    const hash = tokenHash(token);
    const fixture = createFixture({
      markerReadBarrier: 2,
      seedMarkers: [
        markerEvent(hash, 1, 'committed', {
          previousGlobalPosition: 4,
          observedGlobalPosition: 4,
          pageVisitRecordId: null,
          observedAt: '2026-07-10T10:00:00.000Z',
        }),
      ],
    });

    const [first, second] = await Promise.all([
      observeKongaPageVisit(
        {
          token,
          pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          globalMaxPosition: 19,
          now: new Date('2026-07-17T10:02:00.000Z'),
        },
        { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
      ),
      observeKongaPageVisit(
        {
          token,
          pageVisitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          globalMaxPosition: 19,
          now: new Date('2026-07-17T10:03:00.000Z'),
        },
        { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
      ),
    ]);

    const previous = [first.previousGlobalPosition, second.previousGlobalPosition].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(previous).toEqual([4, 19]);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.version).toBe(3);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.state).toBe('committed');
  });

  it('does not count a visit when visit write fails after Mongo before Neo/Chroma', async () => {
    const token = 'TOKEN-ROLLBACK';
    const hash = tokenHash(token);
    const failVisit = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const failVisitId = visitRecordId(token, failVisit);
    const baselineVisitId = visitRecordId(token, 'baseline-page');
    const baseline: VisitRow = {
      _id: baselineVisitId,
      pageVisitId: 'baseline-page',
      tokenHash: hash,
      visitRecordId: baselineVisitId,
      observedGlobalPosition: 10,
      previousGlobalPosition: null,
      sinceLastVisit: null,
      observedAt: '2026-07-10T09:00:00.000Z',
    };

    const fixture = createFixture({
      seedVisits: [baseline],
      seedMarkers: [
        markerEvent(hash, 1, 'committed', {
          previousGlobalPosition: null,
          observedGlobalPosition: 10,
          previousVisitRecordId: null,
          pageVisitRecordId: baselineVisitId,
          observedAt: '2026-07-10T09:00:00.000Z',
        }),
      ],
    });

    const strictWrite: StrictWrite = async (input, strictPersistence = fixture.persistence) => {
      const nextInput = input as { id: string; mongoDoc: AnyRec };
      if (nextInput.id === failVisitId) {
        await fixture.persistence('mongodb', 'insert', {
          database: 'momentum',
          collection: 'tmag_konga_page_visits',
          documents: [{ _id: nextInput.id, ...(nextInput.mongoDoc as AnyRec) }],
        });
        throw new Error('konga_neo4j_readback_not_exact');
      }
      return writeDirectToStores(input, strictPersistence);
    };

    await expect(
      observeKongaPageVisit(
        {
          token,
          pageVisitId: failVisit,
          globalMaxPosition: 21,
          now: new Date('2026-07-17T10:04:00.000Z'),
        },
        { persistence: fixture.persistence, strictWrite },
      ),
    ).rejects.toThrow('konga_neo4j_readback_not_exact');

    const next = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        globalMaxPosition: 24,
        now: new Date('2026-07-17T10:05:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite },
    );
    expect(next.previousGlobalPosition).toBe(10);
    expect(next.observedGlobalPosition).toBe(24);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.state).toBe('committed');
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.observedGlobalPosition).toBe(24);
  });

  it('keeps a later distinct visit from advancing from a pending/failing first attempt', async () => {
    const token = 'TOKEN-INTERLEAVE';
    const hash = tokenHash(token);
    const baseVisitId = visitRecordId(token, 'baseline-page');
    const baseVisit: VisitRow = {
      _id: baseVisitId,
      pageVisitId: 'baseline-page',
      tokenHash: hash,
      visitRecordId: baseVisitId,
      observedGlobalPosition: 10,
      previousGlobalPosition: null,
      sinceLastVisit: null,
      observedAt: '2026-07-10T09:00:00.000Z',
    };

    const failPageVisitId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const failVisitId = visitRecordId(token, failPageVisitId);
    const gate = makeDeferred();
    const release = makeDeferred();
    let entered = false;

    const fixture = createFixture({
      seedVisits: [baseVisit],
      seedMarkers: [
        markerEvent(hash, 1, 'committed', {
          previousGlobalPosition: null,
          observedGlobalPosition: 10,
          previousVisitRecordId: null,
          pageVisitRecordId: baseVisitId,
          observedAt: '2026-07-10T09:00:00.000Z',
        }),
      ],
    });

    const strictWrite: StrictWrite = async (input, strictPersistence = fixture.persistence) => {
      const nextInput = input as { id: string; mongoDoc: AnyRec };
      if (nextInput.id === failVisitId) {
        entered = true;
        gate.resolve();
        await release.promise;
        await fixture.persistence('mongodb', 'insert', {
          database: 'momentum',
          collection: 'tmag_konga_page_visits',
          documents: [{ _id: nextInput.id, ...(nextInput.mongoDoc as AnyRec) }],
        });
        throw new Error('konga_neo4j_readback_not_exact');
      }
      return writeDirectToStores(input, strictPersistence);
    };

    const failing = observeKongaPageVisit(
      {
        token,
        pageVisitId: failPageVisitId,
        globalMaxPosition: 25,
        now: new Date('2026-07-17T10:06:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite },
    );
    const failingResult = failing.then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error }),
    );
    await gate.promise;
    const winner = observeKongaPageVisit(
      {
        token,
        pageVisitId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        globalMaxPosition: 30,
        now: new Date('2026-07-17T10:07:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite },
    );
    release.resolve();

    const winnerResult = await winner;
    const failingFinal = await failingResult;
    expect(failingFinal.ok).toBe(false);
    expect(String((failingFinal as { ok: false; error: unknown }).error)).toContain('konga_neo4j_readback_not_exact');

    expect(winnerResult.previousGlobalPosition).toBe(10);
    expect(winnerResult.observedGlobalPosition).toBe(30);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.state).toBe('committed');
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.observedGlobalPosition).toBe(30);
    expect(winnerResult.pageVisitId).toBe('ffffffff-ffff-4fff-8fff-ffffffffffff');
    expect(entered).toBe(true);
  });

  it('recovers from stale partial marker state without using it as baseline', async () => {
    const token = 'TOKEN-PARTIAL-RECOVERY';
    const hash = tokenHash(token);
    const staleVisitId = visitRecordId(token, 'stale-page');
    const fixture = createFixture({
      seedVisits: [
        {
          _id: staleVisitId,
          pageVisitId: 'stale-page',
          tokenHash: hash,
          visitRecordId: staleVisitId,
          observedGlobalPosition: 40,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        },
      ],
      seedMarkers: [
        markerEvent(hash, 1, 'committed', {
          previousGlobalPosition: null,
          observedGlobalPosition: 40,
          pageVisitRecordId: staleVisitId,
          observedAt: '2026-07-10T09:00:00.000Z',
        }),
        {
          _id: markerEventId(markerCollectionKey(hash), 2, 'pending'),
          markerId: markerCollectionKey(hash),
          tokenHash: hash,
          version: 2,
          state: 'pending',
          previousGlobalPosition: 40,
          previousVisitRecordId: staleVisitId,
          observedGlobalPosition: 55,
          pageVisitRecordId: visitRecordId(token, 'inflight-page'),
          observedAt: '2026-07-10T09:05:00.000Z',
          neo4jReady: false,
          chromaReady: false,
        },
      ],
    });

    const next = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        globalMaxPosition: 65,
        now: new Date('2026-07-17T10:08:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    expect(next.previousGlobalPosition).toBe(40);
    expect(next.sinceLastVisit).toBe(25);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.version).toBe(3);
  });

  it('ignores marker state that fails three-store readback and falls back to visit baseline', async () => {
    const token = 'TOKEN-READBACK';
    const hash = tokenHash(token);
    const baseVisitId = visitRecordId(token, 'base-page');
    const fixture = createFixture({
      seedVisits: [
        {
          _id: baseVisitId,
          pageVisitId: 'base-page',
          tokenHash: hash,
          visitRecordId: baseVisitId,
          observedGlobalPosition: 60,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        },
      ],
      seedMarkers: [
        markerEvent(hash, 1, 'committed', {
          previousGlobalPosition: 99,
          observedGlobalPosition: 99,
          pageVisitRecordId: baseVisitId,
          observedAt: '2026-07-10T09:00:00.000Z',
          neo4jReady: false,
          chromaReady: false,
        }),
      ],
    });

    const next = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        globalMaxPosition: 100,
        now: new Date('2026-07-17T10:09:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    expect(next.previousGlobalPosition).toBe(60);
    expect(next.sinceLastVisit).toBe(40);
  });
});
