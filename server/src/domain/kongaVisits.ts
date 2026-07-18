import { createHash } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWriteWithReadback, verifyKongaThreeLegs } from './kongaPersistence.js';

const COLLECTION = 'tmag_konga_page_visits';
const CHROMA_COLLECTION = 'mcs_konga_page_visits';
const MARKER_COLLECTION = 'tmag_konga_visit_markers';
const MARKER_CHROMA_COLLECTION = 'mcs_konga_visit_markers';
const MAX_MARKER_ATTEMPTS = 8;

const MARKER_KEY_PREFIX = 'konga_visit_marker_';
const MARKER_VERIFY_CYPHER = 'MATCH (m:TmagKongaPageVisitMarker {eventId:$id}) RETURN count(m) AS n';

type MarkerState = 'pending' | 'committed' | 'aborted';
const MARKER_STATE_PRIORITY: Record<MarkerState, number> = {
  committed: 3,
  aborted: 2,
  pending: 1,
};
type Persistence = typeof persistenceCall;

interface KongaPageVisitMarker {
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

interface MarkerSnapshot {
  committedGlobalPosition: number | null;
  committedVisitRecordId: string | null;
  latestEventVersion: number;
  latestValidEvent: KongaPageVisitMarker | null;
}

interface MarkerClaim {
  mode: 'reuse' | 'claim';
  marker: KongaPageVisitMarker | null;
  previousGlobalPosition: number | null;
  previousVisitRecordId: string | null;
  observation?: KongaPageVisitObservation | null;
}

export interface KongaPageVisitObservation {
  pageVisitId: string;
  observedGlobalPosition: number;
  previousGlobalPosition: number | null;
  sinceLastVisit: number | null;
  observedAt: string;
}

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function isPageVisitUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function identity(token: string, pageVisitId: string): { id: string; tokenHash: string } {
  const tokenHash = sha(token);
  return { tokenHash, id: `konga_visit_${sha(`${tokenHash}|${pageVisitId}`)}` };
}

function markerKey(tokenHash: string): string {
  return `${MARKER_KEY_PREFIX}${tokenHash}`;
}

function markerEventId(markerKeyValue: string, version: number, state: MarkerState): string {
  return `${markerKeyValue}:v${version}:${state}`;
}

function verify(id: string) {
  return {
    id,
    mongoCollection: COLLECTION,
    neo4jVerify: {
      cypher: 'MATCH (v:TmagKongaPageVisit {visitRecordId:$id}) RETURN count(v) AS n',
    },
    chromaCollection: CHROMA_COLLECTION,
  };
}

function markerVerify(id: string) {
  return {
    id,
    mongoCollection: MARKER_COLLECTION,
    neo4jVerify: {
      cypher: MARKER_VERIFY_CYPHER,
    },
    chromaCollection: MARKER_CHROMA_COLLECTION,
  };
}

async function readTokenVisitLatestGlobalPosition(
  tokenHash: string,
  persistence: Persistence,
  strictVerify: typeof verifyKongaThreeLegs,
): Promise<{ observedGlobalPosition: number | null; visitRecordId: string | null; observedAt: string | null }> {
  const result = await persistence<{
    documents?: Array<{ _id: string; observedGlobalPosition: number; visitRecordId: string; observedAt: string }>;
  }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { tokenHash },
    sort: { observedAt: -1, _id: -1 },
    limit: 25,
  });

  for (const latest of result.documents ?? []) {
    try {
      await strictVerify(verify(latest._id), persistence);
      return {
        observedGlobalPosition: latest.observedGlobalPosition,
        visitRecordId: latest.visitRecordId,
        observedAt: latest.observedAt,
      };
    } catch {
      continue;
    }
  }

  return { observedGlobalPosition: null, visitRecordId: null, observedAt: null };
}

function makeMarkerEvent(
  markerKeyValue: string,
  version: number,
  state: MarkerState,
  tokenHash: string,
  observedAt: string,
  observedGlobalPosition: number | null,
  previousGlobalPosition: number | null,
  previousVisitRecordId: string | null,
  pageVisitRecordId: string | null,
): KongaPageVisitMarker {
  const markerId = markerEventId(markerKeyValue, version, state);
  return {
    _id: markerId,
    markerId,
    markerKey: markerKeyValue,
    tokenHash,
    version,
    state,
    previousGlobalPosition,
    previousVisitRecordId,
    observedGlobalPosition,
    pageVisitRecordId,
    observedAt,
  };
}

async function readVerifiedVisitByRecordId(
  tokenHash: string,
  recordId: string,
  persistence: Persistence,
  strictVerify: typeof verifyKongaThreeLegs,
): Promise<KongaPageVisitObservation | null> {
  const stored = await persistence<{ documents?: KongaPageVisitObservation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { _id: recordId, tokenHash },
    limit: 1,
  });
  const visit = stored.documents?.[0];
  if (!visit) return null;
  await strictVerify(verify(recordId), persistence);
  return visit;
}

async function isMarkerEventVerified(
  marker: KongaPageVisitMarker,
  persistence: Persistence,
): Promise<boolean> {
  try {
    await verifyKongaThreeLegs(markerVerify(marker._id), persistence);
    return true;
  } catch {
    return false;
  }
}

async function readMarkerSnapshot(
  tokenHash: string,
  persistence: Persistence,
  strictVerify: typeof verifyKongaThreeLegs,
): Promise<MarkerSnapshot> {
  const markerRows = await persistence<{ documents?: KongaPageVisitMarker[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: MARKER_COLLECTION,
    filter: { tokenHash },
    sort: { version: -1, observedAt: -1 },
    limit: 50,
  });

  const rows = (markerRows.documents ?? []).sort((a, b) =>
    b.version - a.version ||
    (MARKER_STATE_PRIORITY[b.state] - MARKER_STATE_PRIORITY[a.state]) ||
    b.observedAt.localeCompare(a.observedAt),
  );
  const latestEventVersion = rows[0]?.version ?? 0;
  const fallback = await readTokenVisitLatestGlobalPosition(tokenHash, persistence, strictVerify);

  let latestValidEvent: KongaPageVisitMarker | null = null;
  let latestCommitted: KongaPageVisitMarker | null = null;
  for (const row of rows) {
    const verified = await isMarkerEventVerified(row, persistence);
    if (!verified) continue;
    if (!latestValidEvent) latestValidEvent = row;
    if (!latestCommitted && row.state === 'committed') {
      latestCommitted = row;
    }
  }

  return {
    committedGlobalPosition: latestCommitted?.observedGlobalPosition ?? fallback.observedGlobalPosition,
    committedVisitRecordId: latestCommitted?.pageVisitRecordId ?? fallback.visitRecordId,
    latestEventVersion,
    latestValidEvent,
  };
}

function isDuplicateMarkerWriteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('duplicate_key') || message.includes('duplicate') || message.includes('E11000');
}

async function writeMarker(
  marker: KongaPageVisitMarker,
  persistence: Persistence,
  strictWrite: typeof tripleStackWriteWithReadback = tripleStackWriteWithReadback,
): Promise<void> {
  await strictWrite(
    {
      id: marker._id,
      mongoCollection: MARKER_COLLECTION,
      mongoDoc: { ...marker },
      neo4j: {
        cypher: 'MERGE (m:TmagKongaPageVisitMarker {eventId:$id}) SET m += $props',
        params: { props: { ...marker } },
      },
      chroma: {
        collection: MARKER_CHROMA_COLLECTION,
        document: `Konga page visit marker ${marker.state} version ${marker.version}.`,
        metadata: {
          kind: 'konga_page_visit_marker',
          markerId: marker._id,
          markerKey: marker.markerKey,
          markerState: marker.state,
          markerVersion: marker.version,
          tokenHash: marker.tokenHash,
          observedAt: marker.observedAt,
        },
      },
      neo4jVerify: markerVerify(marker._id).neo4jVerify,
    },
    persistence,
  );
}

async function markFailedAttempt(
  marker: KongaPageVisitMarker,
  persistence: Persistence,
  strictWrite: typeof tripleStackWriteWithReadback = tripleStackWriteWithReadback,
): Promise<void> {
  try {
    const aborted = {
      ...marker,
      _id: markerEventId(marker.markerKey, marker.version, 'aborted'),
      markerId: markerEventId(marker.markerKey, marker.version, 'aborted'),
      state: 'aborted' as const,
    };
    await writeMarker(aborted, persistence, strictWrite);
  } catch {
    // If another observer has already finalized this attempt, allow it to own recovery.
  }
}

async function commitMarker(
  marker: KongaPageVisitMarker,
  observation: KongaPageVisitObservation & { tokenHash: string; visitRecordId: string },
  persistence: Persistence,
  strictVerify: typeof verifyKongaThreeLegs,
  strictWrite: typeof tripleStackWriteWithReadback = tripleStackWriteWithReadback,
): Promise<void> {
  const committed = {
    ...marker,
    _id: markerEventId(marker.markerKey, marker.version, 'committed'),
    markerId: markerEventId(marker.markerKey, marker.version, 'committed'),
    state: 'committed' as const,
    observedGlobalPosition: observation.observedGlobalPosition,
    pageVisitRecordId: observation.visitRecordId,
    previousVisitRecordId: marker.previousVisitRecordId,
    observedAt: observation.observedAt,
  };

  try {
    await writeMarker(committed, persistence, strictWrite);
    return;
  } catch (error) {
    if (!isDuplicateMarkerWriteError(error)) {
      throw error;
    }
  }

  await strictVerify(markerVerify(committed._id), persistence);
}

async function claimVisitMarker(
  params: {
    tokenHash: string;
    pageVisitId: string;
    pageVisitRecordId: string;
    observedAt: string;
    globalMaxPosition: number;
  },
  strictVerify: typeof verifyKongaThreeLegs,
  persistence: Persistence,
  strictWrite: typeof tripleStackWriteWithReadback = tripleStackWriteWithReadback,
): Promise<MarkerClaim> {
  for (let attempt = 0; attempt < MAX_MARKER_ATTEMPTS; attempt += 1) {
    const snapshot = await readMarkerSnapshot(params.tokenHash, persistence, strictVerify);
    const marker = snapshot.latestValidEvent;
    if (marker && marker.state === 'pending') {
      const winner = marker.pageVisitRecordId
        ? await readVerifiedVisitByRecordId(params.tokenHash, marker.pageVisitRecordId, persistence, strictVerify).catch(() => null)
        : null;
      if (winner) {
        if (winner.pageVisitId === params.pageVisitId) {
          return {
            mode: 'reuse',
            marker,
            previousGlobalPosition: winner.previousGlobalPosition,
            previousVisitRecordId: marker.previousVisitRecordId,
            observation: winner,
          };
        }

        try {
          const committed = makeMarkerEvent(
            marker.markerKey,
            marker.version,
            'committed',
            params.tokenHash,
            winner.observedAt,
            winner.observedGlobalPosition,
            marker.previousGlobalPosition,
            marker.previousVisitRecordId,
            marker.pageVisitRecordId,
          );
          await writeMarker(committed, persistence, strictWrite);
        } catch {
          // If already finalized by another observer, continue.
        }
      } else if (marker.pageVisitRecordId === params.pageVisitRecordId) {
        // This invocation inserted the pending marker and is retrying after the insert;
        // continue through the same claim lane with the original baseline.
        return {
          mode: 'claim',
          marker,
          previousGlobalPosition: marker.previousGlobalPosition,
          previousVisitRecordId: marker.previousVisitRecordId,
        };
      }

      await Promise.resolve();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      continue;
    }

    const pending = makeMarkerEvent(
      markerKey(params.tokenHash),
      snapshot.latestEventVersion + 1,
      'pending',
      params.tokenHash,
      params.observedAt,
      params.globalMaxPosition,
      snapshot.committedGlobalPosition,
      snapshot.committedVisitRecordId,
      params.pageVisitRecordId,
    );

    try {
      await writeMarker(pending, persistence, strictWrite);
      return {
        mode: 'claim',
        marker: pending,
        previousGlobalPosition: pending.previousGlobalPosition,
        previousVisitRecordId: pending.previousVisitRecordId,
      };
    } catch (error) {
      if (!isDuplicateMarkerWriteError(error)) {
        throw error;
      }
    }
  }

  throw new Error('konga_visit_marker_claim_exhausted');
}

export async function observeKongaPageVisit(
  input: {
    token: string;
    pageVisitId: string;
    globalMaxPosition: number;
    now?: Date;
  },
  deps: {
    persistence?: Persistence;
    strictWrite?: typeof tripleStackWriteWithReadback;
    strictVerify?: typeof verifyKongaThreeLegs;
  } = {},
): Promise<KongaPageVisitObservation> {
  if (!isPageVisitUuid(input.pageVisitId)) throw new Error('invalid_page_visit_id');
  const persistence = deps.persistence ?? persistenceCall;
  const strictVerify = deps.strictVerify ?? verifyKongaThreeLegs;
  const strictWrite = deps.strictWrite ?? tripleStackWriteWithReadback;
  const ids = identity(input.token, input.pageVisitId);

  const exact = await persistence<{ documents?: KongaPageVisitObservation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { _id: ids.id, tokenHash: ids.tokenHash },
    limit: 1,
  });
  const existing = exact.documents?.[0];
  if (existing) {
    await strictVerify(verify(ids.id), persistence);
    return existing;
  }

  const observedAt = (input.now ?? new Date()).toISOString();
  const claim = await claimVisitMarker(
    {
      tokenHash: ids.tokenHash,
      pageVisitId: input.pageVisitId,
      pageVisitRecordId: ids.id,
      observedAt,
      globalMaxPosition: input.globalMaxPosition,
    },
    strictVerify,
    persistence,
    strictWrite,
  );

  if (claim.mode === 'reuse' && claim.observation) {
    return claim.observation;
  }

  const previousGlobalPosition = claim.previousGlobalPosition;
  const previousVisitRecordId = claim.previousVisitRecordId;
  const marker = claim.marker;
  const observation: KongaPageVisitObservation & { tokenHash: string; visitRecordId: string } = {
    visitRecordId: ids.id,
    tokenHash: ids.tokenHash,
    pageVisitId: input.pageVisitId,
    observedGlobalPosition: input.globalMaxPosition,
    previousGlobalPosition,
    sinceLastVisit: previousGlobalPosition === null ? null : Math.max(0, input.globalMaxPosition - previousGlobalPosition),
    observedAt,
  };

  try {
    await strictWrite(
      {
        id: ids.id,
        mongoCollection: COLLECTION,
        mongoDoc: { ...observation },
        neo4j: {
          cypher: 'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) SET v += $props',
          params: {
            props: {
              tokenHash: ids.tokenHash,
              pageVisitId: input.pageVisitId,
              observedGlobalPosition: input.globalMaxPosition,
              previousGlobalPosition: observation.previousGlobalPosition,
              sinceLastVisit: observation.sinceLastVisit,
              observedAt,
            },
          },
        },
        chroma: {
          collection: CHROMA_COLLECTION,
          document: `Konga page visit observed at global position ${input.globalMaxPosition} on ${observedAt}.`,
          metadata: {
            kind: 'konga_page_visit',
            tokenHash: ids.tokenHash,
            pageVisitId: input.pageVisitId,
            observedGlobalPosition: input.globalMaxPosition,
            observedAt,
          },
        },
        neo4jVerify: verify(ids.id).neo4jVerify,
      },
      persistence,
    );
  } catch (error) {
    const winner = await readVerifiedVisitByRecordId(ids.tokenHash, ids.id, persistence, strictVerify).catch(() => null);
    if (winner) {
      return winner;
    }

    if (marker) {
      await markFailedAttempt(marker, persistence, strictWrite);
    }
    throw error;
  }

  if (marker) {
    await commitMarker(marker, observation, persistence, strictVerify, strictWrite);
  }

  return {
    pageVisitId: observation.pageVisitId,
    observedGlobalPosition: observation.observedGlobalPosition,
    previousGlobalPosition: observation.previousGlobalPosition,
    sinceLastVisit: observation.sinceLastVisit,
    observedAt: observation.observedAt,
  };
}

/** SSE reconnect path. It never writes or advances a visit marker. */
export async function readKongaPageVisit(
  token: string,
  pageVisitId: string,
  persistence: Persistence = persistenceCall,
  strictVerify: typeof verifyKongaThreeLegs = verifyKongaThreeLegs,
): Promise<KongaPageVisitObservation | null> {
  if (!isPageVisitUuid(pageVisitId)) return null;
  const ids = identity(token, pageVisitId);
  const result = await persistence<{ documents?: KongaPageVisitObservation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { _id: ids.id, tokenHash: ids.tokenHash },
    limit: 1,
  });
  const visit = result.documents?.[0];
  if (!visit) return null;
  await strictVerify(verify(ids.id), persistence);
  return visit;
}
