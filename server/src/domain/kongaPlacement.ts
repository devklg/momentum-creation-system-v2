import { createHash } from 'node:crypto';
import type {
  McsKongaAddedBy,
  McsInviteTokenRecord,
  McsKongaPlaceProspectResult,
  McsKongaPlacementEvent,
  McsKongaPoolPlacement,
  McsPlaceProspectResult,
  McsPoolPlacement,
} from '@momentum/shared';
import { MCS_KONGA_CONTRACT_VERSION } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { publishPlacement } from '../services/poolEvents.js';
import { findBAByTmagId } from './ba.js';
import { incrementPoolCounter, TEAM_POOL_ID } from './holdingTank.js';
import { tripleStackWriteWithReadback, verifyKongaThreeLegs } from './kongaPersistence.js';

const PLACEMENTS_COLLECTION = 'tmag_prospect_htank_placements';
const CHROMA_COLLECTION = 'mcs_prospect_htank_events';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const LEGACY_INVITATION_ID_PREFIX = 'legacy_invitation_';

type Persistence = typeof persistenceCall;
type Publish = typeof publishPlacement;
type FindBa = typeof findBAByTmagId;
type Increment = typeof incrementPoolCounter;

type LegacyIdInput = Pick<
  McsInviteTokenRecord,
  'invitationRecordId' | 'prospectId' | 'sponsorTmagId' | 'createdAt'
> & { _id?: unknown };

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeDbId(raw: unknown): string | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const rawObj = raw as { toString?: () => string; $oid?: unknown };
  if (typeof rawObj.$oid === 'string' && rawObj.$oid.trim()) {
    return rawObj.$oid.trim();
  }
  const rendered = rawObj.toString?.() ?? '';
  if (typeof rendered === 'string' && rendered && rendered !== '[object Object]') {
    return rendered;
  }
  return null;
}

export function resolveInvitationRecordId(tokenRecord: LegacyIdInput): string {
  const explicit = tokenRecord.invitationRecordId?.trim();
  if (explicit) return explicit;

  const dbId = normalizeDbId(tokenRecord._id);
  if (dbId) return `${LEGACY_INVITATION_ID_PREFIX}${dbId}`;

  return `${LEGACY_INVITATION_ID_PREFIX}${tokenRecord.prospectId}|${tokenRecord.sponsorTmagId}|${tokenRecord.createdAt}`;
}

export function resolvePlacementIdentityFromTokenRecord(
  tokenRecord: LegacyIdInput,
): { placementId: string; placementAttemptId: string } {
  return deriveKongaPlacementIdentity({
    prospectId: tokenRecord.prospectId,
    invitationRecordId: resolveInvitationRecordId(tokenRecord),
  });
}

export function deriveKongaPlacementIdentity(input: {
  prospectId: string;
  invitationRecordId: string;
}): { placementId: string; placementAttemptId: string } {
  const placementAttemptId = `konga_attempt_${digest(input.invitationRecordId)}`;
  return {
    placementAttemptId,
    placementId: `konga_placement_${digest(`${input.prospectId}|${placementAttemptId}`)}`,
  };
}

export interface PlaceKongaProspectInput {
  prospectId: string;
  sponsorTmagId: string;
  invitationRecordId: string;
  prospectExpiresAt: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  now?: Date;
}

interface PlacementDeps {
  persistence?: Persistence;
  publish?: Publish;
  findBa?: FindBa;
  increment?: Increment;
  strictWrite?: typeof tripleStackWriteWithReadback;
  strictVerify?: typeof verifyKongaThreeLegs;
}

function publicAddedBy(ba: Awaited<ReturnType<FindBa>>): McsKongaAddedBy {
  if (!ba) throw new Error('konga_sponsor_missing');
  return {
    firstName: ba.firstName,
    lastInitial: ba.lastName.trim().charAt(0).toUpperCase(),
  };
}

const placementVerify = (id: string) => ({
  id,
  mongoCollection: PLACEMENTS_COLLECTION,
  neo4jVerify: {
    cypher:
      'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->' +
      '(:TmagPool {id:$poolId}) RETURN count(r) AS n',
    params: { poolId: TEAM_POOL_ID },
  },
  chromaCollection: CHROMA_COLLECTION,
});

function resultOf(placement: McsKongaPoolPlacement, alreadyPlaced: boolean): McsKongaPlaceProspectResult {
  return {
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    prospectId: placement.prospectId,
    placementId: placement.placementId,
    placementAttemptId: placement.placementAttemptId,
    positionNumber: placement.positionNumber,
    placedAt: placement.placedAt,
    alreadyPlaced,
  };
}

/**
 * New Konga placement path. One immutable invitation record produces one
 * attempt identity. A later invitation may create a new monotonic position
 * only after the prior placement has a real flush stamp.
 */
export async function placeKongaProspect(
  input: PlaceKongaProspectInput,
  deps: PlacementDeps = {},
): Promise<McsKongaPlaceProspectResult | McsPlaceProspectResult> {
  const persistence = deps.persistence ?? persistenceCall;
  const strictWrite = deps.strictWrite ?? tripleStackWriteWithReadback;
  const strictVerify = deps.strictVerify ?? verifyKongaThreeLegs;
  const identity = deriveKongaPlacementIdentity(input);

  const sameAttempt = await persistence<{ documents?: McsKongaPoolPlacement[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: PLACEMENTS_COLLECTION,
    filter: { placementAttemptId: identity.placementAttemptId },
    limit: 1,
  });
  const same = sameAttempt.documents?.[0];
  if (same) {
    if (same.prospectId !== input.prospectId || same.sponsorTmagId !== input.sponsorTmagId) {
      throw new Error('konga_attempt_identity_conflict');
    }
    await strictVerify(placementVerify(same.placementId), persistence);
    return resultOf(same, true);
  }

  const live = await persistence<{ documents?: McsPoolPlacement[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: PLACEMENTS_COLLECTION,
    filter: { prospectId: input.prospectId, flushedAt: null },
    sort: { placedAt: -1 },
    limit: 1,
  });
  const livePlacement = live.documents?.[0];
  if (livePlacement) {
    const kongaLive = livePlacement as McsPoolPlacement & {
      placementId?: string;
      placementAttemptId?: string;
    };
    if (!kongaLive.placementId && !kongaLive.placementAttemptId) {
      return {
        prospectId: livePlacement.prospectId,
        positionNumber: livePlacement.positionNumber,
        placedAt: livePlacement.placedAt,
        alreadyPlaced: true,
      };
    }
    throw new Error('konga_live_placement_exists');
  }

  const ba = await (deps.findBa ?? findBAByTmagId)(input.sponsorTmagId);
  const addedBy = publicAddedBy(ba);
  const positionNumber = await (deps.increment ?? incrementPoolCounter)();
  const placedAt = (input.now ?? new Date()).toISOString();
  const placement: McsKongaPoolPlacement & {
    firstName: string;
    lastInitial: string;
    city: string;
    stateOrRegion: string;
  } = {
    ...identity,
    firstName: input.firstName,
    lastInitial: input.lastInitial,
    city: input.city,
    stateOrRegion: input.stateOrRegion,
    prospectId: input.prospectId,
    sponsorTmagId: input.sponsorTmagId,
    positionNumber,
    placedAt,
    expiresAt: input.prospectExpiresAt,
    flushedAt: null,
    flushReason: null,
    addedBy,
  };

  try {
    await strictWrite(
      {
        id: identity.placementId,
        mongoCollection: PLACEMENTS_COLLECTION,
        mongoDoc: { ...placement },
        neo4j: {
          cypher:
            'MERGE (pool:TmagPool {id:$poolId}) ' +
            'MATCH (p:TmagProspect {prospectId:$prospectId}) ' +
            'MERGE (p)-[r:IN_HOLDING_TANK {placementId:$id}]->(pool) ' +
            'SET r += $relationshipProps',
          params: {
            poolId: TEAM_POOL_ID,
            prospectId: input.prospectId,
            relationshipProps: {
              placementAttemptId: identity.placementAttemptId,
              position: positionNumber,
              placedAt,
              sponsorTmagId: input.sponsorTmagId,
              addedByFirstName: addedBy.firstName,
              addedByLastInitial: addedBy.lastInitial,
            },
          },
        },
        chroma: {
          collection: CHROMA_COLLECTION,
          document:
            `Holding-tank placement #${positionNumber} for ${input.firstName} ${input.lastInitial}. ` +
            `in ${input.city}, ${input.stateOrRegion} at ${placedAt}.`,
          metadata: {
            kind: 'konga_placement',
            placementId: identity.placementId,
            placementAttemptId: identity.placementAttemptId,
            prospectId: input.prospectId,
            sponsorTmagId: input.sponsorTmagId,
            positionNumber,
            placedAt,
            addedByFirstName: addedBy.firstName,
            addedByLastInitial: addedBy.lastInitial,
          },
        },
        neo4jVerify: placementVerify(identity.placementId).neo4jVerify,
      },
      persistence,
    );
  } catch (error) {
    const winner = await persistence<{ documents?: McsKongaPoolPlacement[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: PLACEMENTS_COLLECTION,
      filter: { placementAttemptId: identity.placementAttemptId },
      limit: 1,
    });
    const stored = winner.documents?.[0];
    if (!stored) throw error;
    await strictVerify(placementVerify(stored.placementId), persistence);
    return resultOf(stored, true);
  }

  await persistence('mongodb', 'update', {
    database: 'momentum',
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId: input.prospectId, sponsorTmagId: input.sponsorTmagId },
    update: { $set: { positionNumber, placedAt, state: 'video_complete', updatedAt: placedAt } },
  });
  const prospectReadback = await persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
    database: 'momentum',
    collection: PROSPECTS_COLLECTION,
    filter: { prospectId: input.prospectId, sponsorTmagId: input.sponsorTmagId, positionNumber, placedAt },
    limit: 1,
  });
  if (!prospectReadback.documents?.[0]) throw new Error('konga_prospect_placement_readback_missing');

  const event: McsKongaPlacementEvent = {
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    eventId: identity.placementId,
    positionNumber,
    firstName: input.firstName,
    lastInitial: input.lastInitial,
    city: input.city,
    stateOrRegion: input.stateOrRegion,
    placedAt,
    addedBy,
  };
  (deps.publish ?? publishPlacement)(event);
  return resultOf(placement, false);
}

export function projectLegacyPlacementAddedBy(
  placement: McsPoolPlacement,
): McsKongaAddedBy | null {
  const candidate = placement as McsPoolPlacement & { addedBy?: McsKongaAddedBy };
  return candidate.addedBy ?? null;
}
