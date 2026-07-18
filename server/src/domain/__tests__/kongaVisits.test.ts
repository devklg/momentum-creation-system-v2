import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { tripleStackWriteWithReadback } from '../kongaPersistence.js';
import { tripleStackWrite } from '../../services/tripleStack.js';
import {
  observeKongaPageVisit,
  readKongaPageVisit,
} from '../kongaVisits.js';

type Persistence = <T = unknown>(tool: string, action: string, params: Record<string, unknown>) => Promise<T>;
type StrictWriter = NonNullable<Parameters<typeof tripleStackWriteWithReadback>[2]>;
type StrictWrite = (
  input: Parameters<typeof tripleStackWriteWithReadback>[0],
  persistence?: Parameters<typeof tripleStackWriteWithReadback>[1],
  writer?: StrictWriter,
) => ReturnType<typeof tripleStackWriteWithReadback>;

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
  markerKey: string;
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
    neo4jMarkers: Map<string, AnyRec>;
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

function matchesFilter(
  document: Record<string, unknown>,
  filter: Record<string, unknown> = {},
): boolean {
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
  const neo4jMarkers = new Map<string, AnyRec>();
  const chromaCollections = new Map<string, Set<string>>();
  const markerQueryGate = makeReadBarrier(markerReadBarrier);
  const defaultCollections = ['mcs_konga_page_visits', 'mcs_konga_visit_markers'] as const;

  for (const visit of seedVisits) visitRows.set(visit._id, visit);
  for (const marker of seedMarkers) {
    markerRows.set(marker._id, marker);
    if (marker.neo4jReady) {
      neo4jMarkers.set(marker._id, { ...marker, markerId: marker.markerId, eventId: marker._id } as AnyRec);
    }
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
        let documents = Array.from(visitRows.values()).filter((row) =>
          matchesFilter(row as unknown as Record<string, unknown>, filter),
        );
        if (sort?.observedAt === -1) {
          documents = documents.sort((a, b) => b.observedAt.localeCompare(a.observedAt));
        }
        if (typeof limit === 'number') documents = documents.slice(0, limit);
        return { documents } as T;
      }

      if (collection === 'tmag_konga_visit_markers') {
        await markerQueryGate.wait();
        let documents = Array.from(markerRows.values())
          .filter((row) => matchesFilter(row as unknown as Record<string, unknown>, filter))
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
      const queryParams = (anyParams.params as AnyRec | undefined) ?? {};
      const id = String(queryParams.id ?? anyParams.id ?? '');
      if (query.includes('TmagKongaPageVisitMarker')) {
        if (query.includes('MERGE')) {
          const props = (queryParams.props as AnyRec) ?? {};
          const mergeField = query.includes('eventId:$id')
            ? 'eventId'
            : query.includes('markerId:$id')
              ? 'markerId'
              : 'visitRecordId';
          neo4jMarkers.set(id, { ...neo4jMarkers.get(id), [mergeField]: id, ...props } as AnyRec);
          return { summary: { counters: {} } } as T;
        }

        const markerMatchField = query.includes('eventId:$id')
          ? 'eventId'
          : query.includes('markerId:$id')
            ? 'markerId'
            : 'visitRecordId';
        const markerNode = neo4jMarkers.get(id);
        const match = markerNode?.[markerMatchField] === id ? 1 : 0;
        return { records: [{ n: match }] } as T;
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
  }) as unknown as Persistence;

  const defaultStrictWrite: StrictWrite = async (input, nextPersistence = persistence, writer) => {
    const localWriter = ((writerInput: Parameters<typeof writeDirectToStores>[0]) => {
      const writeInput = writerInput as Parameters<typeof writeDirectToStores>[0];
      return writeDirectToStores(writeInput, nextPersistence) as ReturnType<typeof tripleStackWrite>;
    }) as StrictWriter;
    const selectedWriter: StrictWriter = (writer ?? localWriter) as StrictWriter;
    return tripleStackWriteWithReadback(
      input as Parameters<StrictWrite>[0],
      nextPersistence as Parameters<StrictWrite>[1],
      selectedWriter,
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
    markerId: markerEventId(key, version, state),
    markerKey: key,
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

    let pendingSeen = false;
    const pendingBarrier = makeDeferred();
    const releaseBarrier = makeDeferred();
    const originalStrictWrite: StrictWrite = fixture.strictWrite;
    fixture.strictWrite = async (input, strictPersistence = fixture.persistence, writer) => {
      const nextInput = input as { id: string };
      if (nextInput.id.endsWith(':pending')) {
        if (!pendingSeen) {
          pendingSeen = true;
          pendingBarrier.resolve();
        }
        const result = await originalStrictWrite(input, strictPersistence, writer);
        await releaseBarrier.promise;
        return result;
      }
      return originalStrictWrite(input, strictPersistence, writer);
    };

    const pageVisitId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const firstResult = observeKongaPageVisit(
      {
        token,
        pageVisitId,
        globalMaxPosition: 19,
        now: new Date('2026-07-17T10:02:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );
    const secondResult = observeKongaPageVisit(
      {
        token,
        pageVisitId,
        globalMaxPosition: 19,
        now: new Date('2026-07-17T10:03:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );
    await pendingBarrier.promise;
    releaseBarrier.resolve();
    const [first, second] = await Promise.all([firstResult, secondResult]);
    expect(pendingSeen).toBe(true);

    expect(first.previousGlobalPosition).toBe(4);
    expect(second.previousGlobalPosition).toBe(4);
    expect(fixture.state.visitRows.size).toBe(1);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.version).toBe(2);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.state).toBe('committed');
    expect(first.observedGlobalPosition).toBe(19);
    expect(first).toEqual(second);
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
      return writeDirectToStores(input, strictPersistence) as ReturnType<StrictWrite>;
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

  it('repairs a failed committed marker on same-id retry before returning', async () => {
    const token = 'TOKEN-COMMIT-MARKER-RETRY';
    const hash = tokenHash(token);
    const pageVisitId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const pageVisitRecordId = visitRecordId(token, pageVisitId);
    const fixture = createFixture({
      seedMarkers: [
        markerEvent(hash, 1, 'committed', {
          previousGlobalPosition: null,
          observedGlobalPosition: 11,
          previousVisitRecordId: null,
          pageVisitRecordId: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        }),
      ],
    });

    let failCommitted = true;
    const strictWrite: StrictWrite = async (input, strictPersistence = fixture.persistence) => {
      const nextInput = input as { id: string };
      if (nextInput.id.endsWith(':committed') && failCommitted) {
        failCommitted = false;
        throw new Error('konga_neo4j_readback_not_exact');
      }
      return writeDirectToStores(input, strictPersistence) as ReturnType<StrictWrite>;
    };

    await expect(
      observeKongaPageVisit(
        {
          token,
          pageVisitId,
          globalMaxPosition: 28,
          now: new Date('2026-07-17T10:25:00.000Z'),
        },
        { persistence: fixture.persistence, strictWrite },
      ),
    ).rejects.toThrow('konga_neo4j_readback_not_exact');

    const replay = await observeKongaPageVisit(
      {
        token,
        pageVisitId,
        globalMaxPosition: 28,
        now: new Date('2026-07-17T10:26:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite },
    );

    expect(replay.observedGlobalPosition).toBe(28);
    expect(replay.observedAt).toBe('2026-07-17T10:25:00.000Z');
    expect(replay.previousGlobalPosition).toBe(11);
    expect(replay.sinceLastVisit).toBe(17);

    const marker = latestMarkerForToken(token, fixture.state.markerRows);
    expect(marker).not.toBeNull();
    expect(marker?.state).toBe('committed');
    expect(marker?.pageVisitRecordId).toBe(pageVisitRecordId);
    expect(marker?.version).toBe(2);
  });

  it('keeps a historical committed visit replay from changing baseline (A commit, B commit, retry A, C visit)', async () => {
    const token = 'TOKEN-HISTORICAL-REPLAY';
    const bVisitId = visitRecordId(token, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    const fixture = createFixture();

    const visitA = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        globalMaxPosition: 10,
        now: new Date('2026-07-17T10:10:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    const visitB = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        globalMaxPosition: 20,
        now: new Date('2026-07-17T10:11:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    const replayA = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        globalMaxPosition: 10,
        now: new Date('2026-07-17T10:12:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    expect(replayA).toMatchObject(visitA);
    expect(visitB.previousGlobalPosition).toBe(10);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.version).toBe(2);
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.state).toBe('committed');
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.pageVisitRecordId).toBe(bVisitId);

    const visitC = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        globalMaxPosition: 30,
        now: new Date('2026-07-17T10:13:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    expect(visitC.previousGlobalPosition).toBe(20);
    expect(visitC.sinceLastVisit).toBe(10);
    expect(visitC.pageVisitId).toBe('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.pageVisitRecordId).toBe(
      visitRecordId(token, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'),
    );
    expect(latestMarkerForToken(token, fixture.state.markerRows)?.version).toBe(3);

    const replayAAfterC = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        globalMaxPosition: 10,
        now: new Date('2026-07-17T10:14:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    expect(replayAAfterC).toMatchObject(visitA);
    expect(replayAAfterC).toMatchObject(replayA);
  });

  it('fails historical replay when latest committed head is later and historical marker is missing', async () => {
    const token = 'TOKEN-HISTORICAL-MISSING-HEAD';
    const hash = tokenHash(token);
    const baselinePageId = '11111111-1111-4111-8111-111111111111';
    const headPageId = '22222222-2222-4222-8222-222222222222';
    const baselineVisitId = visitRecordId(token, baselinePageId);
    const headVisitId = visitRecordId(token, headPageId);
    const fixture = createFixture();

    await writeDirectToStores(
      {
        id: baselineVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: baselinePageId,
          tokenHash: hash,
          visitRecordId: baselineVisitId,
          observedGlobalPosition: 10,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: baselinePageId,
              observedGlobalPosition: 10,
              previousGlobalPosition: null,
              sinceLastVisit: null,
              observedAt: '2026-07-10T09:00:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'seeded baseline visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: baselinePageId,
            observedGlobalPosition: 10,
            observedAt: '2026-07-10T09:00:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

    await writeDirectToStores(
      {
        id: headVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: headPageId,
          tokenHash: hash,
          visitRecordId: headVisitId,
          observedGlobalPosition: 20,
          previousGlobalPosition: 10,
          sinceLastVisit: 10,
          observedAt: '2026-07-10T09:05:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: headPageId,
              observedGlobalPosition: 20,
              previousGlobalPosition: 10,
              sinceLastVisit: 10,
              observedAt: '2026-07-10T09:05:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'seeded head visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: headPageId,
            observedGlobalPosition: 20,
            observedAt: '2026-07-10T09:05:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

    const headMarker = markerEvent(hash, 1, 'committed', {
      previousGlobalPosition: 10,
      observedGlobalPosition: 20,
      previousVisitRecordId: baselineVisitId,
      pageVisitRecordId: headVisitId,
      observedAt: '2026-07-10T09:05:00.000Z',
    });
    const headMarkerRow: MarkerRow = { ...headMarker };

    await writeDirectToStores(
      {
        id: headMarker._id,
        mongoCollection: 'tmag_konga_visit_markers',
        mongoDoc: { ...headMarkerRow } as Record<string, unknown>,
        neo4j: {
          cypher: 'MERGE (m:TmagKongaPageVisitMarker {eventId:$id}) SET m += $props',
          params: {
            props: {
              ...headMarker,
              markerVersion: headMarker.version,
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_visit_markers',
          document: `Konga page visit marker committed version ${headMarker.version}.`,
          metadata: {
            kind: 'konga_page_visit_marker',
            tokenHash: hash,
            markerVersion: headMarker.version,
            markerId: headMarker._id,
            markerKey: headMarker.markerKey,
            markerState: headMarker.state,
            observedAt: headMarker.observedAt,
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (m:TmagKongaPageVisitMarker {eventId:$id}) RETURN count(m) AS n',
        },
      },
      fixture.persistence,
    );

    const observation = observeKongaPageVisit(
      {
        token,
        pageVisitId: baselinePageId,
        globalMaxPosition: 10,
        now: new Date('2026-07-17T10:30:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    await expect(observation).rejects.toThrow('konga_visit_marker_replay_reject_non_exact');

    const head = latestMarkerForToken(token, fixture.state.markerRows);
    expect(head?.version).toBe(1);
    expect(head?.pageVisitRecordId).toBe(headVisitId);
    expect(fixture.state.markerRows.size).toBe(1);
  });

  it('fails historical replay when committed marker fields are non-exact', async () => {
    const token = 'TOKEN-HISTORICAL-MISMATCH';
    const hash = tokenHash(token);
    const historicalPageId = '33333333-3333-4333-8333-333333333333';
    const headPageId = '44444444-4444-4444-8444-444444444444';
    const historicalVisitId = visitRecordId(token, historicalPageId);
    const headVisitId = visitRecordId(token, headPageId);
    const fixture = createFixture();

    await writeDirectToStores(
      {
        id: historicalVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: historicalPageId,
          tokenHash: hash,
          visitRecordId: historicalVisitId,
          observedGlobalPosition: 10,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: historicalPageId,
              observedGlobalPosition: 10,
              previousGlobalPosition: null,
              sinceLastVisit: null,
              observedAt: '2026-07-10T09:00:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'seeded historical visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: historicalPageId,
            observedGlobalPosition: 10,
            observedAt: '2026-07-10T09:00:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

    await writeDirectToStores(
      {
        id: headVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: headPageId,
          tokenHash: hash,
          visitRecordId: headVisitId,
          observedGlobalPosition: 20,
          previousGlobalPosition: 10,
          sinceLastVisit: 10,
          observedAt: '2026-07-10T09:06:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: headPageId,
              observedGlobalPosition: 20,
              previousGlobalPosition: 10,
              sinceLastVisit: 10,
              observedAt: '2026-07-10T09:06:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'seeded head visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: headPageId,
            observedGlobalPosition: 20,
            observedAt: '2026-07-10T09:06:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

    const historicalMarker = markerEvent(hash, 1, 'committed', {
      previousGlobalPosition: 99,
      observedGlobalPosition: 10,
      previousVisitRecordId: null,
      pageVisitRecordId: historicalVisitId,
      observedAt: '2026-07-10T09:00:00.000Z',
    });
    const headMarker = markerEvent(hash, 2, 'committed', {
      previousGlobalPosition: 10,
      observedGlobalPosition: 20,
      previousVisitRecordId: historicalVisitId,
      pageVisitRecordId: headVisitId,
      observedAt: '2026-07-10T09:06:00.000Z',
    });
    const historicalMarkerRow: MarkerRow = { ...historicalMarker };
    const headMarkerRow: MarkerRow = { ...headMarker };

    await writeDirectToStores(
      {
        id: historicalMarker._id,
        mongoCollection: 'tmag_konga_visit_markers',
        mongoDoc: { ...historicalMarkerRow } as Record<string, unknown>,
        neo4j: {
          cypher: 'MERGE (m:TmagKongaPageVisitMarker {eventId:$id}) SET m += $props',
          params: {
            props: {
              ...historicalMarker,
              markerVersion: historicalMarker.version,
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_visit_markers',
          document: `Konga page visit marker committed version ${historicalMarker.version}.`,
          metadata: {
            kind: 'konga_page_visit_marker',
            tokenHash: hash,
            markerVersion: historicalMarker.version,
            markerId: historicalMarker._id,
            markerKey: historicalMarker.markerKey,
            markerState: historicalMarker.state,
            observedAt: historicalMarker.observedAt,
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (m:TmagKongaPageVisitMarker {eventId:$id}) RETURN count(m) AS n',
        },
      },
      fixture.persistence,
    );

    await writeDirectToStores(
      {
        id: headMarker._id,
        mongoCollection: 'tmag_konga_visit_markers',
        mongoDoc: { ...headMarkerRow } as Record<string, unknown>,
        neo4j: {
          cypher: 'MERGE (m:TmagKongaPageVisitMarker {eventId:$id}) SET m += $props',
          params: {
            props: {
              ...headMarker,
              markerVersion: headMarker.version,
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_visit_markers',
          document: `Konga page visit marker committed version ${headMarker.version}.`,
          metadata: {
            kind: 'konga_page_visit_marker',
            tokenHash: hash,
            markerVersion: headMarker.version,
            markerId: headMarker._id,
            markerKey: headMarker.markerKey,
            markerState: headMarker.state,
            observedAt: headMarker.observedAt,
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (m:TmagKongaPageVisitMarker {eventId:$id}) RETURN count(m) AS n',
        },
      },
      fixture.persistence,
    );

    const observation = observeKongaPageVisit(
      {
        token,
        pageVisitId: historicalPageId,
        globalMaxPosition: 10,
        now: new Date('2026-07-17T10:31:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    await expect(observation).rejects.toThrow('konga_visit_marker_replay_reject_non_exact');

    const head = latestMarkerForToken(token, fixture.state.markerRows);
    expect(head?.version).toBe(2);
    expect(head?.pageVisitRecordId).toBe(headVisitId);
    expect(fixture.state.markerRows.size).toBe(2);
  });

  it('rejects replay when same-version pending conflicts with later committed head payload', async () => {
    const token = 'TOKEN-HISTORICAL-DUP-HEAD';
    const hash = tokenHash(token);
    const historicalPageId = '55555555-5555-4555-8555-555555555555';
    const headPageId = '66666666-6666-4666-8666-666666666666';
    const historicalVisitId = visitRecordId(token, historicalPageId);
    const headVisitId = visitRecordId(token, headPageId);
    const fixture = createFixture();

    await writeDirectToStores(
      {
        id: historicalVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: historicalPageId,
          tokenHash: hash,
          visitRecordId: historicalVisitId,
          observedGlobalPosition: 10,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: historicalPageId,
              observedGlobalPosition: 10,
              previousGlobalPosition: null,
              sinceLastVisit: null,
              observedAt: '2026-07-10T09:00:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'seeded historical visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: historicalPageId,
            observedGlobalPosition: 10,
            observedAt: '2026-07-10T09:00:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

    await writeDirectToStores(
      {
        id: headVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: headPageId,
          tokenHash: hash,
          visitRecordId: headVisitId,
          observedGlobalPosition: 20,
          previousGlobalPosition: 10,
          sinceLastVisit: 10,
          observedAt: '2026-07-10T09:05:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: headPageId,
              observedGlobalPosition: 20,
              previousGlobalPosition: 10,
              sinceLastVisit: 10,
              observedAt: '2026-07-10T09:05:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'seeded head visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: headPageId,
            observedGlobalPosition: 20,
            observedAt: '2026-07-10T09:05:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

    const headMarker = markerEvent(hash, 2, 'committed', {
      previousGlobalPosition: 10,
      observedGlobalPosition: 20,
      previousVisitRecordId: historicalVisitId,
      pageVisitRecordId: headVisitId,
      observedAt: '2026-07-10T09:05:00.000Z',
    });
    await writeDirectToStores(
      {
        id: headMarker._id,
        mongoCollection: 'tmag_konga_visit_markers',
        mongoDoc: { ...headMarker },
        neo4j: {
          cypher: 'MERGE (m:TmagKongaPageVisitMarker {eventId:$id}) SET m += $props',
          params: {
            props: {
              ...headMarker,
              markerVersion: headMarker.version,
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_visit_markers',
          document: `Konga page visit marker committed version ${headMarker.version}.`,
          metadata: {
            kind: 'konga_page_visit_marker',
            tokenHash: hash,
            markerVersion: headMarker.version,
            markerId: headMarker._id,
            markerKey: headMarker.markerKey,
            markerState: headMarker.state,
            observedAt: headMarker.observedAt,
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (m:TmagKongaPageVisitMarker {eventId:$id}) RETURN count(m) AS n',
        },
      },
      fixture.persistence,
    );

    const headBefore = latestMarkerForToken(token, fixture.state.markerRows);
    expect(headBefore?.version).toBe(2);
    expect(headBefore?.pageVisitRecordId).toBe(headVisitId);
    const markerRowsBeforeAdversarialSeed = fixture.state.markerRows.size;

    const adversarialPendingSeed = markerEvent(hash, 2, 'pending', {
      previousGlobalPosition: 10,
      observedGlobalPosition: 10,
      previousVisitRecordId: null,
      pageVisitRecordId: historicalVisitId,
      observedAt: '2026-07-10T09:06:00.000Z',
    });
    const uniqueSuffix = `${adversarialPendingSeed._id}:adversarial`;
    const adversarialPending = {
      ...adversarialPendingSeed,
      _id: uniqueSuffix,
      markerId: uniqueSuffix,
    };

    await writeDirectToStores(
      {
        id: adversarialPending._id,
        mongoCollection: 'tmag_konga_visit_markers',
        mongoDoc: { ...adversarialPending },
        neo4j: {
          cypher: 'MERGE (m:TmagKongaPageVisitMarker {eventId:$id}) SET m += $props',
          params: {
            props: {
              ...adversarialPending,
              markerVersion: adversarialPending.version,
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_visit_markers',
          document: `Konga page visit marker pending version ${adversarialPending.version}.`,
          metadata: {
            kind: 'konga_page_visit_marker',
            tokenHash: hash,
            markerVersion: adversarialPending.version,
            markerId: adversarialPending._id,
            markerKey: adversarialPending.markerKey,
            markerState: adversarialPending.state,
            observedAt: adversarialPending.observedAt,
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (m:TmagKongaPageVisitMarker {eventId:$id}) RETURN count(m) AS n',
        },
      },
      fixture.persistence,
    );

    const observation = observeKongaPageVisit(
      {
        token,
        pageVisitId: historicalPageId,
        globalMaxPosition: 10,
        now: new Date('2026-07-17T10:37:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    await expect(observation).rejects.toThrow('konga_visit_marker_replay_reject_non_exact');

    const headAfter = latestMarkerForToken(token, fixture.state.markerRows);
    expect(headAfter?.version).toBe(2);
    expect(headAfter?.pageVisitRecordId).toBe(headVisitId);
    expect(fixture.state.markerRows.size).toBe(markerRowsBeforeAdversarialSeed + 1);
  });

  it('accepts an exact historical committed marker and returns byte-identical replay observation', async () => {
    const token = 'TOKEN-HISTORICAL-EXACT';
    const fixture = createFixture();
    const headVisitId = visitRecordId(token, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

    const historical = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        globalMaxPosition: 10,
        now: new Date('2026-07-17T10:32:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        globalMaxPosition: 20,
        now: new Date('2026-07-17T10:33:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    const headBefore = latestMarkerForToken(token, fixture.state.markerRows);
    expect(headBefore?.pageVisitRecordId).toBe(headVisitId);
    expect(headBefore?.version).toBe(2);

    const replayed = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        globalMaxPosition: 99,
        now: new Date('2026-07-17T10:34:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    expect({
      pageVisitId: replayed.pageVisitId,
      observedGlobalPosition: replayed.observedGlobalPosition,
      previousGlobalPosition: replayed.previousGlobalPosition,
      sinceLastVisit: replayed.sinceLastVisit,
      observedAt: replayed.observedAt,
    }).toEqual({
      pageVisitId: historical.pageVisitId,
      observedGlobalPosition: historical.observedGlobalPosition,
      previousGlobalPosition: historical.previousGlobalPosition,
      sinceLastVisit: historical.sinceLastVisit,
      observedAt: historical.observedAt,
    });
    expect(replayed.observedAt).toBe('2026-07-17T10:32:00.000Z');
    expect(fixture.state.markerRows.size).toBe(4);
    const headAfter = latestMarkerForToken(token, fixture.state.markerRows);
    expect(headAfter?._id).toBe(headBefore?._id);
    expect(headAfter?.pageVisitRecordId).toBe(headVisitId);
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
    let pendingObserved = false;
    const pendingBarrier = makeDeferred();
    let bObservedPending = false;
    let markerQueryCount = 0;
    const bQuerySeen = makeDeferred();

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

    const markerQueryBarrier: KongaFixture['persistence'] = fixture.persistence;
    fixture.persistence = (async function <T>(tool: string, action: string, params: Record<string, unknown>): Promise<T> {
      const result = await markerQueryBarrier(tool, action, params);
      if (tool === 'mongodb' && action === 'query') {
        const anyParams = params as Record<string, unknown>;
        if (String(anyParams.collection) === 'tmag_konga_visit_markers' && !bObservedPending) {
          const queryResult = result as { documents?: MarkerRow[] };
          markerQueryCount += 1;
          const sawPending = queryResult.documents?.some((row) => row.state === 'pending');
          if (sawPending && markerQueryCount > 1) {
            bObservedPending = true;
            bQuerySeen.resolve();
          }
        }
      }
      return result as T;
    }) as KongaFixture['persistence'];

    const strictWrite: StrictWrite = async (input, strictPersistence = fixture.persistence) => {
      const nextInput = input as { id: string; mongoDoc: AnyRec };
      if (nextInput.id.endsWith(':pending') && !pendingObserved) {
        pendingObserved = true;
        pendingBarrier.resolve();
      }
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
      return writeDirectToStores(input, strictPersistence) as ReturnType<StrictWrite>;
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
    await pendingBarrier.promise;
    const winner = observeKongaPageVisit(
      {
        token,
        pageVisitId: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
        globalMaxPosition: 30,
        now: new Date('2026-07-17T10:07:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite },
    );
    await bQuerySeen.promise;
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
    expect(bObservedPending).toBe(true);
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
          markerId: markerEventId(markerCollectionKey(hash), 2, 'pending'),
          markerKey: markerCollectionKey(hash),
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
    await writeDirectToStores(
      {
        id: baseVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: 'base-page',
          tokenHash: hash,
          visitRecordId: baseVisitId,
          observedGlobalPosition: 60,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: 'base-page',
              observedGlobalPosition: 60,
              previousGlobalPosition: null,
              sinceLastVisit: null,
              observedAt: '2026-07-10T09:00:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'verified seed visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: 'base-page',
            observedGlobalPosition: 60,
            observedAt: '2026-07-10T09:00:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

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

  it('does not reuse Mongo-only orphan visits as marker baseline', async () => {
    const token = 'TOKEN-ORPHAN-BASELINE';
    const hash = tokenHash(token);
    const fixture = createFixture();
    const verifiedVisitId = visitRecordId(token, 'verified-page');
    const orphanVisitId = visitRecordId(token, 'orphan-page');

    await writeDirectToStores(
      {
        id: verifiedVisitId,
        mongoCollection: 'tmag_konga_page_visits',
        mongoDoc: {
          pageVisitId: 'verified-page',
          tokenHash: hash,
          visitRecordId: verifiedVisitId,
          observedGlobalPosition: 15,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:00:00.000Z',
        },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: hash,
              pageVisitId: 'verified-page',
              observedGlobalPosition: 15,
              previousGlobalPosition: null,
              sinceLastVisit: null,
              observedAt: '2026-07-10T09:00:00.000Z',
            },
          },
        },
        chroma: {
          collection: 'mcs_konga_page_visits',
          document: 'verified seed visit',
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: hash,
            pageVisitId: 'verified-page',
            observedGlobalPosition: 15,
            observedAt: '2026-07-10T09:00:00.000Z',
          },
        },
        neo4jVerify: {
          cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
        },
      },
      fixture.persistence,
    );

    await fixture.persistence('mongodb', 'insert', {
      database: 'momentum',
      collection: 'tmag_konga_page_visits',
      documents: [
        {
          _id: orphanVisitId,
          pageVisitId: 'orphan-page',
          tokenHash: hash,
          visitRecordId: orphanVisitId,
          observedGlobalPosition: 25,
          previousGlobalPosition: 15,
          sinceLastVisit: 10,
          observedAt: '2026-07-10T09:30:00.000Z',
        },
      ],
    });

    const next = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        globalMaxPosition: 35,
        now: new Date('2026-07-17T10:20:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    expect(next.previousGlobalPosition).toBe(15);
    expect(next.sinceLastVisit).toBe(20);
  });

  it('verifies marker readback against immutable eventId not overwritten marker identity', async () => {
    const token = 'TOKEN-MARKER-EVENT-ID';
    const hash = tokenHash(token);
    const fixture = createFixture();

    const recorded = await observeKongaPageVisit(
      {
        token,
        pageVisitId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        globalMaxPosition: 12,
        now: new Date('2026-07-17T10:21:00.000Z'),
      },
      { persistence: fixture.persistence, strictWrite: fixture.strictWrite },
    );

    const marker = latestMarkerForToken(token, fixture.state.markerRows);
    expect(marker).not.toBeNull();
    const markerNode = fixture.state.neo4jMarkers.get(marker?._id ?? '');
    expect(markerNode).toBeDefined();
    expect(markerNode?.eventId).toBe(marker?._id);
    expect(markerNode?.markerId).toBe(marker?._id);
    expect(markerNode?.markerKey).toBe(markerCollectionKey(hash));
    expect(marker?.state).toBe('committed');
    expect(recorded.observedAt).toBe('2026-07-17T10:21:00.000Z');
  });

  it('readKongaPageVisit requires exact three-legs readback', async () => {
    const token = 'TOKEN-READBACK-STRICT';
    const pageVisitId = '11111111-1111-4111-8111-111111111111';
    const orphanVisitId = visitRecordId(token, pageVisitId);
    const fixture = createFixture({
      seedVisits: [],
    });

    await fixture.persistence('mongodb', 'insert', {
      database: 'momentum',
      collection: 'tmag_konga_page_visits',
      documents: [
        {
          _id: orphanVisitId,
          pageVisitId,
          tokenHash: tokenHash(token),
          visitRecordId: orphanVisitId,
          observedGlobalPosition: 80,
          previousGlobalPosition: null,
          sinceLastVisit: null,
          observedAt: '2026-07-10T09:45:00.000Z',
        },
      ],
    });

    const missing = readKongaPageVisit(
      token,
      pageVisitId,
      fixture.persistence,
    );
    await expect(missing).rejects.toThrow('konga_neo4j_readback_not_exact');
  });
});
