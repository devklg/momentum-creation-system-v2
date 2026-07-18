import { createHash } from 'node:crypto';
import type { McsKongaReplayCompletion, McsWebinarReplay } from '@momentum/shared';
import { MCS_KONGA_CONTRACT_VERSION } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWriteWithReadback, verifyKongaThreeLegs } from './kongaPersistence.js';
import { verifyResourcePublishingGate } from './resourcePublishingGate.js';
import { findEventById } from './webinarEvent.js';

const POINTER_COLLECTION = 'tmag_konga_replay_pointers';
const POINTER_CHROMA = 'mcs_konga_replay_pointers';
const COMPLETION_COLLECTION = 'tmag_konga_replay_completions';
const COMPLETION_CHROMA = 'mcs_konga_replay_completions';

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export interface RotateReplayInput {
  eventId: string;
  resourceVersionId: string;
  recordedAt: string;
  availableAt: string;
  displayDate: string;
  authorizedByTmagId: string;
  now?: Date;
}

function pointerVerify(id: string) {
  return {
    id,
    mongoCollection: POINTER_COLLECTION,
    neo4jVerify: {
      cypher: 'MATCH (r:TmagKongaReplayPointer {replayPointerId:$id}) RETURN count(r) AS n',
    },
    chromaCollection: POINTER_CHROMA,
  };
}

export async function rotateKongaReplay(
  input: RotateReplayInput,
  deps: {
    persistence?: typeof persistenceCall;
    gate?: typeof verifyResourcePublishingGate;
    eventFinder?: typeof findEventById;
    strictWrite?: typeof tripleStackWriteWithReadback;
  } = {},
): Promise<McsWebinarReplay> {
  const persistence = deps.persistence ?? persistenceCall;
  const now = input.now ?? new Date();
  const event = await (deps.eventFinder ?? findEventById)(input.eventId);
  if (!event || Date.parse(event.scheduledFor) >= now.getTime()) {
    throw new Error('konga_replay_requires_past_webinar');
  }
  const gate = await (deps.gate ?? verifyResourcePublishingGate)(
    input.resourceVersionId,
    'retrieve',
    persistence,
    now,
  );
  if (!gate.allowed || !gate.evidence) throw new Error('konga_replay_resource_not_authorized');

  const replay: McsWebinarReplay = {
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    eventId: input.eventId,
    resourceVersionId: input.resourceVersionId,
    recordedAt: input.recordedAt,
    availableAt: input.availableAt,
    displayDate: input.displayDate,
    publicationStatus: 'active',
  };
  const id = `konga_replay_${sha(`${input.eventId}|${input.resourceVersionId}|${input.availableAt}`)}`;
  const existing = await persistence<{ documents?: McsWebinarReplay[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: POINTER_COLLECTION,
    filter: { _id: id },
    limit: 1,
  });
  if (existing.documents?.[0]) return existing.documents[0];

  await (deps.strictWrite ?? tripleStackWriteWithReadback)(
    {
      id,
      mongoCollection: POINTER_COLLECTION,
      mongoDoc: {
        ...replay,
        replayPointerId: id,
        authorizedByTmagId: input.authorizedByTmagId,
        authorityEvidenceId: gate.evidence.evidenceId,
        createdAt: now.toISOString(),
      },
      neo4j: {
        cypher:
          'MATCH (v:TmagResourceVersion {resourceVersionId:$resourceVersionId}) ' +
          'MERGE (r:TmagKongaReplayPointer {replayPointerId:$id}) ' +
          'SET r += $props MERGE (r)-[:USES_AUTHORIZED_VERSION]->(v)',
        params: {
          resourceVersionId: input.resourceVersionId,
          props: {
            eventId: input.eventId,
            resourceVersionId: input.resourceVersionId,
            recordedAt: input.recordedAt,
            availableAt: input.availableAt,
            displayDate: input.displayDate,
            publicationStatus: 'active',
            authorizedByTmagId: input.authorizedByTmagId,
            authorityEvidenceId: gate.evidence.evidenceId,
            createdAt: now.toISOString(),
          },
        },
      },
      chroma: {
        collection: POINTER_CHROMA,
        document: `Authorized webinar replay for ${input.displayDate}, available ${input.availableAt}.`,
        metadata: {
          kind: 'konga_replay_pointer',
          eventId: input.eventId,
          resourceVersionId: input.resourceVersionId,
          availableAt: input.availableAt,
          publicationStatus: 'active',
        },
      },
      neo4jVerify: pointerVerify(id).neo4jVerify,
    },
    persistence,
  );
  return replay;
}

export async function readCurrentKongaReplay(
  now: Date = new Date(),
  deps: {
    persistence?: typeof persistenceCall;
    gate?: typeof verifyResourcePublishingGate;
  } = {},
): Promise<McsWebinarReplay | null> {
  const persistence = deps.persistence ?? persistenceCall;
  const result = await persistence<{ documents?: McsWebinarReplay[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: POINTER_COLLECTION,
    filter: { publicationStatus: 'active', availableAt: { $lte: now.toISOString() } },
    sort: { availableAt: -1, recordedAt: -1 },
    limit: 1,
  });
  const replay = result.documents?.[0] ?? null;
  if (!replay) return null;
  const gate = await (deps.gate ?? verifyResourcePublishingGate)(
    replay.resourceVersionId,
    'retrieve',
    persistence,
    now,
  );
  return gate.allowed ? replay : null;
}

function completionVerify(id: string) {
  return {
    id,
    mongoCollection: COMPLETION_COLLECTION,
    neo4jVerify: {
      cypher: 'MATCH (c:TmagKongaReplayCompletion {completionId:$id}) RETURN count(c) AS n',
    },
    chromaCollection: COMPLETION_CHROMA,
  };
}

/** Replay completion is isolated from presentation lifecycle and placement. */
export async function recordKongaReplayCompletion(
  input: {
    token: string;
    replayEventId: string;
    resourceVersionId: string;
    now?: Date;
  },
  deps: {
    persistence?: typeof persistenceCall;
    replayReader?: typeof readCurrentKongaReplay;
    strictWrite?: typeof tripleStackWriteWithReadback;
    strictVerify?: typeof verifyKongaThreeLegs;
  } = {},
): Promise<McsKongaReplayCompletion> {
  const persistence = deps.persistence ?? persistenceCall;
  const replay = await (deps.replayReader ?? readCurrentKongaReplay)(
    input.now ?? new Date(),
    { persistence },
  );
  if (
    !replay ||
    replay.eventId !== input.replayEventId ||
    replay.resourceVersionId !== input.resourceVersionId
  ) {
    throw new Error('konga_replay_binding_mismatch');
  }

  const tokenHash = sha(input.token);
  const id = `konga_replay_completion_${sha(
    `${tokenHash}|${input.replayEventId}|${input.resourceVersionId}`,
  )}`;
  const existing = await persistence<{ documents?: McsKongaReplayCompletion[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: COMPLETION_COLLECTION,
    filter: { _id: id, tokenHash },
    limit: 1,
  });
  if (existing.documents?.[0]) {
    await (deps.strictVerify ?? verifyKongaThreeLegs)(completionVerify(id), persistence);
    return existing.documents[0];
  }

  const completion: McsKongaReplayCompletion = {
    replayEventId: input.replayEventId,
    resourceVersionId: input.resourceVersionId,
    completedAt: (input.now ?? new Date()).toISOString(),
  };
  await (deps.strictWrite ?? tripleStackWriteWithReadback)(
    {
      id,
      mongoCollection: COMPLETION_COLLECTION,
      mongoDoc: { ...completion, completionId: id, tokenHash, callbackUnlocked: true },
      neo4j: {
        cypher:
          'MERGE (c:TmagKongaReplayCompletion {completionId:$id}) SET c += $props',
        params: {
          props: {
            tokenHash,
            replayEventId: input.replayEventId,
            resourceVersionId: input.resourceVersionId,
            completedAt: completion.completedAt,
            callbackUnlocked: true,
          },
        },
      },
      chroma: {
        collection: COMPLETION_CHROMA,
        document: `Webinar replay completed at ${completion.completedAt}; human callback path unlocked.`,
        metadata: {
          kind: 'konga_replay_complete',
          tokenHash,
          replayEventId: input.replayEventId,
          resourceVersionId: input.resourceVersionId,
          completedAt: completion.completedAt,
        },
      },
      neo4jVerify: completionVerify(id).neo4jVerify,
    },
    persistence,
  );
  return completion;
}
