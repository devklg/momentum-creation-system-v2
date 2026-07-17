import { createHash } from 'node:crypto';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWriteWithReadback, verifyKongaThreeLegs } from './kongaPersistence.js';

const COLLECTION = 'tmag_konga_page_visits';
const CHROMA_COLLECTION = 'mcs_konga_page_visits';

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

  const previousResult = await persistence<{ documents?: KongaPageVisitObservation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: COLLECTION,
    filter: { tokenHash: ids.tokenHash },
    sort: { observedAt: -1 },
    limit: 1,
  });
  const previous = previousResult.documents?.[0] ?? null;
  const observedAt = (input.now ?? new Date()).toISOString();
  const observation: KongaPageVisitObservation & { tokenHash: string; visitRecordId: string } = {
    visitRecordId: ids.id,
    tokenHash: ids.tokenHash,
    pageVisitId: input.pageVisitId,
    observedGlobalPosition: input.globalMaxPosition,
    previousGlobalPosition: previous?.observedGlobalPosition ?? null,
    sinceLastVisit:
      previous === null
        ? null
        : Math.max(0, input.globalMaxPosition - previous.observedGlobalPosition),
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
    if (!stored) throw error;
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
