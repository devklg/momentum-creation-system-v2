import { createHash } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWriteWithReadback, verifyKongaThreeLegs } from './kongaPersistence.js';

const COLLECTION = 'tmag_konga_page_visits';
const CHROMA_COLLECTION = 'mcs_konga_page_visits';
const MARKER_COLLECTION = 'tmag_konga_visit_markers';
const MAX_MARKER_ATTEMPTS = 8;

const MARKER_KEY_PREFIX = 'konga_visit_marker_';

interface KongaPageVisitMarker {
  _id: string;
  tokenHash: string;
  version: number;
  observedGlobalPosition: number | null;
  lastVisitRecordId: string | null;
  observedAt: string;
}

interface MarkerClaim {
  mode: 'inserted' | 'advanced';
  markerId: string;
  tokenHash: string;
  previousGlobalPosition: number | null;
  claimedVersion: number;
  previousMarker: KongaPageVisitMarker;
}

export interface KongaPageVisitObservation {
  pageVisitId: string;
  observedGlobalPosition: number;
  previousGlobalPosition: number | null;
  sinceLastVisit: number | null;
  observedAt: string;
}

type Persistence = typeof persistenceCall;

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

function markerId(tokenHash: string): string {
  return `${MARKER_KEY_PREFIX}${tokenHash}`;
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

async function readTokenVisitLatestGlobalPosition(
  tokenHash: string,
  persistence: Persistence,
): Promise<{ observedGlobalPosition: number | null; visitRecordId: string | null; observedAt: string | null }> {
  const result = await persistence<{
    documents?: Array<{ observedGlobalPosition: number; visitRecordId: string; observedAt: string }>;
  }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { tokenHash },
    sort: { observedAt: -1 },
    limit: 1,
  });
  const latest = result.documents?.[0];
  if (!latest) return { observedGlobalPosition: null, visitRecordId: null, observedAt: null };
  return {
    observedGlobalPosition: latest.observedGlobalPosition,
    visitRecordId: latest.visitRecordId,
    observedAt: latest.observedAt,
  };
}

async function rollbackMarkerClaim(
  claim: MarkerClaim,
  pageVisitId: string,
  persistence: Persistence,
): Promise<void> {
  if (claim.mode === 'inserted') {
    await persistence<{ deletedCount: number }>('mongodb', 'delete', {
      database: 'momentum',
      collection: MARKER_COLLECTION,
      filter: {
        _id: claim.markerId,
        tokenHash: claim.tokenHash,
        lastVisitRecordId: pageVisitId,
        version: claim.claimedVersion,
      },
    });
    return;
  }

  const rollback = await persistence<{ matchedCount: number }>('mongodb', 'update', {
    database: 'momentum',
    collection: MARKER_COLLECTION,
    filter: {
      _id: claim.markerId,
      tokenHash: claim.tokenHash,
      version: claim.claimedVersion,
      lastVisitRecordId: pageVisitId,
    },
    update: {
      $set: {
        version: claim.previousMarker.version,
        observedGlobalPosition: claim.previousMarker.observedGlobalPosition,
        lastVisitRecordId: claim.previousMarker.lastVisitRecordId,
        observedAt: claim.previousMarker.observedAt,
      },
    },
  });
  if (rollback.matchedCount !== 1) {
    throw new Error('konga_visit_marker_rollback_failed');
  }
}

async function claimVisitMarker(
  params: {
    tokenHash: string;
    pageVisitId: string;
    globalMaxPosition: number;
    observedAt: string;
  },
  persistence: Persistence,
): Promise<MarkerClaim> {
  const markerDocId = markerId(params.tokenHash);

  for (let attempt = 0; attempt < MAX_MARKER_ATTEMPTS; attempt += 1) {
    const markerResult = await persistence<{ documents?: KongaPageVisitMarker[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: MARKER_COLLECTION,
      filter: { _id: markerDocId, tokenHash: params.tokenHash },
      limit: 1,
    });
    const existingMarker = markerResult.documents?.[0];
    if (!existingMarker) {
      const prior = await readTokenVisitLatestGlobalPosition(params.tokenHash, persistence);
      const insertedMarker: KongaPageVisitMarker = {
        _id: markerDocId,
        tokenHash: params.tokenHash,
        version: 1,
        observedGlobalPosition: params.globalMaxPosition,
        lastVisitRecordId: params.pageVisitId,
        observedAt: params.observedAt,
      };
      try {
        await persistence<{ insertedCount: number; insertedIds: Record<number, unknown> }>('mongodb', 'insert', {
          database: 'momentum',
          collection: MARKER_COLLECTION,
          documents: [insertedMarker],
        });
        return {
          mode: 'inserted',
          markerId: markerDocId,
          tokenHash: params.tokenHash,
          previousGlobalPosition: prior.observedGlobalPosition,
          claimedVersion: insertedMarker.version,
          previousMarker: {
            _id: markerDocId,
            tokenHash: params.tokenHash,
            version: 0,
            observedGlobalPosition: prior.observedGlobalPosition,
            lastVisitRecordId: prior.visitRecordId,
            observedAt: prior.observedAt ?? params.observedAt,
          },
        };
      } catch {
        continue;
      }
    }

    const update = await persistence<{ matchedCount: number }>('mongodb', 'update', {
      database: 'momentum',
      collection: MARKER_COLLECTION,
      filter: {
        _id: existingMarker._id,
        tokenHash: existingMarker.tokenHash,
        version: existingMarker.version,
      },
      update: {
        $set: {
          version: existingMarker.version + 1,
          observedGlobalPosition: params.globalMaxPosition,
          lastVisitRecordId: params.pageVisitId,
          observedAt: params.observedAt,
        },
      },
    });

    if ((update.matchedCount ?? 0) === 1) {
      return {
        mode: 'advanced',
        markerId: markerDocId,
        tokenHash: params.tokenHash,
        previousGlobalPosition: existingMarker.observedGlobalPosition,
        claimedVersion: existingMarker.version + 1,
        previousMarker: existingMarker,
      };
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
  const ids = identity(input.token, input.pageVisitId);

  const exact = await persistence<{ documents?: KongaPageVisitObservation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { _id: ids.id, tokenHash: ids.tokenHash },
    limit: 1,
  });
  const existing = exact.documents?.[0];
  if (existing) {
    await (deps.strictVerify ?? verifyKongaThreeLegs)(verify(ids.id), persistence);
    return existing;
  }

  const observedAt = (input.now ?? new Date()).toISOString();
  const marker = await claimVisitMarker(
    {
      tokenHash: ids.tokenHash,
      pageVisitId: ids.id,
      globalMaxPosition: input.globalMaxPosition,
      observedAt,
    },
    persistence,
  );

  const observation: KongaPageVisitObservation & { tokenHash: string; visitRecordId: string } = {
    visitRecordId: ids.id,
    tokenHash: ids.tokenHash,
    pageVisitId: input.pageVisitId,
    observedGlobalPosition: input.globalMaxPosition,
    previousGlobalPosition: marker.previousGlobalPosition,
    sinceLastVisit:
      marker.previousGlobalPosition === null
        ? null
        : Math.max(0, input.globalMaxPosition - marker.previousGlobalPosition),
    observedAt,
  };

  try {
    await (deps.strictWrite ?? tripleStackWriteWithReadback)(
      {
        id: ids.id,
        mongoCollection: COLLECTION,
        mongoDoc: { ...observation },
        neo4j: {
          cypher:
            'MERGE (v:TmagKongaPageVisit {visitRecordId:$id}) ' +
            'SET v += $props',
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
          document:
            `Konga page visit observed at global position ${input.globalMaxPosition} on ${observedAt}.`,
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
    const winner = await persistence<{ documents?: KongaPageVisitObservation[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: COLLECTION,
      filter: { _id: ids.id, tokenHash: ids.tokenHash },
      limit: 1,
    });
    const stored = winner.documents?.[0];
    if (!stored) {
      await rollbackMarkerClaim(marker, ids.id, persistence);
      throw error;
    }
    await (deps.strictVerify ?? verifyKongaThreeLegs)(verify(ids.id), persistence);
    return stored;
  }

  return observation;
}

/** SSE reconnect path. It never writes or advances a visit marker. */
export async function readKongaPageVisit(
  token: string,
  pageVisitId: string,
  persistence: Persistence = persistenceCall,
): Promise<KongaPageVisitObservation | null> {
  if (!isPageVisitUuid(pageVisitId)) return null;
  const ids = identity(token, pageVisitId);
  const result = await persistence<{ documents?: KongaPageVisitObservation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { _id: ids.id, tokenHash: ids.tokenHash },
    limit: 1,
  });
  return result.documents?.[0] ?? null;
}
