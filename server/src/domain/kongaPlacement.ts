import { createHash, randomUUID } from 'node:crypto';
import type {
  McsKongaAddedBy,
  McsKongaPlaceProspectResult,
  McsKongaPlacementEvent,
  McsKongaPoolPlacement,
  McsPlaceProspectResult,
  McsPoolPlacement,
} from '@momentum/shared';
import { MCS_KONGA_CONTRACT_VERSION } from '@momentum/shared';
import { assertChromaCollectionExists } from '../services/chromaCollections.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { publishPlacement } from '../services/poolEvents.js';
import { findBAByTmagId } from './ba.js';
import { incrementPoolCounter, TEAM_POOL_ID } from './holdingTank.js';
import { tripleStackWriteWithReadback, verifyKongaThreeLegs } from './kongaPersistence.js';

const MONGO_DB = 'momentum';
const PLACEMENTS_COLLECTION = 'tmag_prospect_htank_placements';
const CHROMA_COLLECTION = 'mcs_prospect_htank_events';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const KONGA_PLACEMENT_CLAIM_COLLECTION = 'tmag_konga_placement_claims';
const KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION = 'mcs_konga_placement_claims';
const KONGA_PLACEMENT_CLAIM_TTL_MS = 120_000;

type Persistence = typeof persistenceCall;
type Publish = typeof publishPlacement;
type FindBa = typeof findBAByTmagId;
type Increment = typeof incrementPoolCounter;

interface KongaPlacementClaim {
  _id: string;
  prospectId: string;
  placementAttemptId: string;
  placementId: string;
  ownerAttempt: string;
  fence: number;
  expiresAt: string;
  createdAt: string;
  heartbeatAt: string;
}

interface PlacementClaimAcquireResult {
  kind: 'acquired' | 'same-attempt-seen';
  lease?: KongaPlacementClaim;
  placement?: McsKongaPoolPlacement;
}

type ChromaClaimRecord = {
  ids?: string[];
  metadatas?: Array<Record<string, unknown> | null>;
};

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function claimDocumentId(prospectId: string): string {
  return `konga_claim_${prospectId}`;
}

function claimExpiresAt(at: Date): string {
  return new Date(at.getTime() + KONGA_PLACEMENT_CLAIM_TTL_MS).toISOString();
}

function claimNow(at: Date): string {
  return at.toISOString();
}

function parseFence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return 0;
}

function isExpired(claim: KongaPlacementClaim, now: Date): boolean {
  const expiresMs = Date.parse(claim.expiresAt);
  return Number.isFinite(expiresMs) && expiresMs <= now.getTime();
}

function normalizeClaim(candidate: Record<string, unknown>): KongaPlacementClaim {
  return {
    _id: String(candidate._id),
    prospectId: String(candidate.prospectId),
    placementAttemptId: String(candidate.placementAttemptId),
    placementId: String(candidate.placementId),
    ownerAttempt: String(candidate.ownerAttempt),
    fence: parseFence(candidate.fence),
    expiresAt: String(candidate.expiresAt),
    createdAt: String(candidate.createdAt),
    heartbeatAt: String(candidate.heartbeatAt),
  };
}

function assertMetadataValue(a: unknown, b: unknown): void {
  if (a !== b) throw new Error(`konga_placement_claim_projection_mismatch:${String(a)}:${String(b)}`);
}

function claimToMetadata(claim: KongaPlacementClaim) {
  return {
    kind: 'konga_placement_claim',
    claimId: claim._id,
    prospectId: claim.prospectId,
    placementAttemptId: claim.placementAttemptId,
    placementId: claim.placementId,
    ownerAttempt: claim.ownerAttempt,
    fence: claim.fence,
    expiresAt: claim.expiresAt,
    createdAt: claim.createdAt,
    heartbeatAt: claim.heartbeatAt,
  };
}

function buildClaimInput(
  prospectId: string,
  identity: { placementAttemptId: string; placementId: string },
  ownerAttempt: string,
  fence: number,
  at: Date,
): KongaPlacementClaim {
  const nowIso = claimNow(at);
  return {
    _id: claimDocumentId(prospectId),
    prospectId,
    placementAttemptId: identity.placementAttemptId,
    placementId: identity.placementId,
    ownerAttempt,
    fence,
    createdAt: nowIso,
    heartbeatAt: nowIso,
    expiresAt: claimExpiresAt(at),
  };
}

function isDuplicateError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /duplicate/i.test(message) || /E11000/i.test(message) || /conflict/i.test(message);
}

async function verifyClaimProjection(
  claim: KongaPlacementClaim,
  persistence: Persistence,
): Promise<void> {
  const [mongoResult, neoResult, chromaResult] = await Promise.all([
    persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
      filter: {
        _id: claim._id,
        prospectId: claim.prospectId,
        placementAttemptId: claim.placementAttemptId,
        placementId: claim.placementId,
        ownerAttempt: claim.ownerAttempt,
        fence: claim.fence,
      },
      limit: 1,
    }),
    persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query:
        'MATCH (c:TmagKongaPlacementClaim {claimId:$id, prospectId:$prospectId}) ' +
        'WHERE c.ownerAttempt = $ownerAttempt AND c.fence = $fence RETURN count(c) AS n, c.fence AS fence, c.ownerAttempt AS ownerAttempt',
      params: {
        id: claim._id,
        prospectId: claim.prospectId,
        ownerAttempt: claim.ownerAttempt,
        fence: claim.fence,
      },
    }),
    persistence<ChromaClaimRecord>('chromadb', 'get', {
      collection: KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION,
      ids: [claim._id],
    }),
  ]);

  const mongo = mongoResult.documents?.[0];
  if (!mongo) throw new Error(`konga_placement_claim_readback_missing:${claim._id}`);
  const normalized = normalizeClaim(mongo);
  assertMetadataValue(normalized.ownerAttempt, claim.ownerAttempt);
  assertMetadataValue(normalized.fence, claim.fence);
  assertMetadataValue(normalized.placementAttemptId, claim.placementAttemptId);
  assertMetadataValue(normalized.placementId, claim.placementId);
  const neo = neoResult.records?.[0];
  if (Number(neo?.n ?? 0) !== 1) {
    throw new Error(`konga_placement_claim_neo4j_readback_not_exact:${claim._id}:${neo?.n ?? 0}`);
  }
  assertMetadataValue(neo?.fence, claim.fence);
  assertMetadataValue(neo?.ownerAttempt, claim.ownerAttempt);
  if (!(chromaResult.ids ?? []).includes(claim._id)) {
    throw new Error(`konga_placement_claim_chroma_missing:${claim._id}`);
  }
  const firstMetadata = chromaResult.metadatas?.[0];
  if (!firstMetadata) {
    throw new Error(`konga_placement_claim_chroma_missing_metadata:${claim._id}`);
  }
  assertMetadataValue(firstMetadata.claimId, claim._id);
  assertMetadataValue(firstMetadata.ownerAttempt, claim.ownerAttempt);
  assertMetadataValue(firstMetadata.fence, claim.fence);
  assertMetadataValue(firstMetadata.placementAttemptId, claim.placementAttemptId);
  assertMetadataValue(firstMetadata.placementId, claim.placementId);
}

async function writeClaimMongo(
  persistence: Persistence,
  claim: KongaPlacementClaim,
  mode: 'insert' | 'replace',
  ownerAttemptFilter?: string,
): Promise<void> {
  if (mode === 'insert') {
    await persistence('mongodb', 'insert', {
      database: MONGO_DB,
      collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
      documents: [{ ...claim }],
    });
    return;
  }

  if (!ownerAttemptFilter) {
    throw new Error('konga_placement_claim_replace_requires_owner_attempt_filter');
  }

  const result = await persistence<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
    filter: {
      _id: claim._id,
      prospectId: claim.prospectId,
      ownerAttempt: ownerAttemptFilter,
      fence: claim.fence,
      placementAttemptId: claim.placementAttemptId,
    },
    update: {
      $set: {
        placementAttemptId: claim.placementAttemptId,
        placementId: claim.placementId,
        ownerAttempt: claim.ownerAttempt,
        fence: claim.fence,
        expiresAt: claim.expiresAt,
        heartbeatAt: claim.heartbeatAt,
        createdAt: claim.createdAt,
      },
    },
  });
  if ((result.matchedCount ?? 0) !== 1) {
    throw new Error(`konga_placement_claim_not_owner:${claim._id}`);
  }
}

async function cleanupClaimProjection(
  persistence: Persistence,
  claim: KongaPlacementClaim,
): Promise<void> {
  await Promise.allSettled([
    persistence('mongodb', 'delete', {
      database: MONGO_DB,
      collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
      filter: {
        _id: claim._id,
        ownerAttempt: claim.ownerAttempt,
        fence: claim.fence,
      },
    }),
    persistence('neo4j', 'cypher', {
      query:
        'MATCH (c:TmagKongaPlacementClaim {claimId:$id, prospectId:$prospectId}) ' +
        'WHERE c.ownerAttempt = $ownerAttempt AND c.fence = $fence ' +
        'DETACH DELETE c',
      params: {
        id: claim._id,
        prospectId: claim.prospectId,
        ownerAttempt: claim.ownerAttempt,
        fence: claim.fence,
      },
    }),
    persistence('chromadb', 'delete', {
      collection: KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION,
      ids: [claim._id],
    }),
  ]);
}

async function writeClaimProjection(
  persistence: Persistence,
  claim: KongaPlacementClaim,
  action: 'create' | 'renew' | 'reclaim',
  ownerAttemptFilter?: string,
): Promise<void> {
  await assertChromaCollectionExists(KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION);

  const mode = action === 'create' ? 'insert' : 'replace';
  await writeClaimMongo(persistence, claim, mode, ownerAttemptFilter);

  try {
    await Promise.all([
      persistence('neo4j', 'cypher', {
        query:
          'MERGE (c:TmagKongaPlacementClaim {claimId:$id, prospectId:$prospectId}) ' +
          'SET c += $properties',
        params: {
          id: claim._id,
          prospectId: claim.prospectId,
          properties: {
            ...claimToMetadata(claim),
          },
        },
      }),
      persistence('chromadb', 'add', {
        collection: KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION,
        ids: [claim._id],
        documents: [
          `Konga placement claim ${claim.prospectId} ${claim.ownerAttempt} attempt ` +
          `${claim.placementAttemptId} fence ${claim.fence}`,
        ],
        metadatas: [claimToMetadata(claim)],
      }),
    ]);
    await verifyClaimProjection(claim, persistence);
  } catch (error) {
    await cleanupClaimProjection(persistence, claim);
    if (isDuplicateError(error) && action === 'create') {
      throw new Error(`konga_placement_claim_insert_conflict:${claim.prospectId}`);
    }
    throw error;
  }
}

async function readClaim(
  persistence: Persistence,
  claimId: string,
): Promise<KongaPlacementClaim | null> {
  const result = await persistence<{ documents?: Array<Record<string, unknown>> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
      filter: { _id: claimId },
      limit: 1,
    },
  );
  const row = result.documents?.[0];
  if (!row) return null;
  const claim = normalizeClaim(row);
  try {
    await verifyClaimProjection(claim, persistence);
    return claim;
  } catch {
    await cleanupClaimProjection(persistence, claim);
    return null;
  }
}

async function heartbeatPlacementClaim(
  persistence: Persistence,
  current: KongaPlacementClaim,
  now: Date,
): Promise<KongaPlacementClaim> {
  const renewed = {
    ...current,
    heartbeatAt: claimNow(now),
    expiresAt: claimExpiresAt(now),
  };
  await writeClaimProjection(persistence, renewed, 'renew', current.ownerAttempt);
  return renewed;
}

async function reclaimPlacementClaim(
  persistence: Persistence,
  current: KongaPlacementClaim,
  identity: { placementAttemptId: string; placementId: string },
  now: Date,
): Promise<KongaPlacementClaim | null> {
  if (!isExpired(current, now)) return null;
  const ownerAttempt = `konga_owner_${randomUUID()}`;
  const claim = buildClaimInput(current.prospectId, identity, ownerAttempt, current.fence + 1, now);

  const updated = await persistence<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
    filter: {
      _id: current._id,
      prospectId: current.prospectId,
      ownerAttempt: current.ownerAttempt,
      fence: current.fence,
      expiresAt: { $lt: claimNow(now) },
    },
    update: {
      $set: {
        ownerAttempt: claim.ownerAttempt,
        fence: claim.fence,
        placementAttemptId: claim.placementAttemptId,
        placementId: claim.placementId,
        expiresAt: claim.expiresAt,
        heartbeatAt: claim.heartbeatAt,
        createdAt: claim.createdAt,
      },
    },
  });
  if ((updated.matchedCount ?? 0) !== 1) return null;

  await writeClaimProjection(persistence, claim, 'reclaim', claim.ownerAttempt);
  return claim;
}

async function acquirePlacementClaim(
  persistence: Persistence,
  prospectId: string,
  identity: { placementAttemptId: string; placementId: string },
  now: Date,
  deps: PlacementDeps,
): Promise<PlacementClaimAcquireResult> {
  const maxAttempts = Math.max(4, deps.claimAcquireMaxAttempts ?? 12);
  const wait = deps.claimAcquireYield ?? (() => Promise.resolve());
  const claimId = claimDocumentId(prospectId);
  const ownerAttempt = `konga_owner_${randomUUID()}`;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const duplicate = await loadSameAttemptPlacement(persistence, identity);
    if (duplicate) {
      return { kind: 'same-attempt-seen', placement: duplicate };
    }

    const current = await readClaim(persistence, claimId);
    if (!current) {
      const claim = buildClaimInput(prospectId, identity, ownerAttempt, 1, now);
      try {
        await writeClaimProjection(persistence, claim, 'create');
        return { kind: 'acquired', lease: claim };
      } catch (error) {
        if (isDuplicateError(error)) {
          const raced = await loadSameAttemptPlacement(persistence, identity);
          if (raced) {
            return { kind: 'same-attempt-seen', placement: raced };
          }
          await wait();
          continue;
        }
        throw error;
      }
    }

    if (current.placementAttemptId === identity.placementAttemptId) {
      if (isExpired(current, now)) {
        const reclaimed = await reclaimPlacementClaim(persistence, current, identity, now);
        if (reclaimed) {
          return { kind: 'acquired', lease: reclaimed };
        }
      }
      if (attempt + 1 < maxAttempts) {
        await wait();
      }
      continue;
    }

    if (isExpired(current, now)) {
      const reclaimed = await reclaimPlacementClaim(persistence, current, identity, now);
      if (reclaimed) return { kind: 'acquired', lease: reclaimed };
    }

    if (attempt + 1 < maxAttempts) {
      await wait();
    }
  }

  const resolved = await loadSameAttemptPlacement(persistence, identity);
  if (resolved) return { kind: 'same-attempt-seen', placement: resolved };
  throw new Error(`konga_placement_claim_conflict:${prospectId}`);
}

async function assertLeaseOwner(
  persistence: Persistence,
  lease: KongaPlacementClaim,
  now: Date,
): Promise<void> {
  const live = await readClaim(persistence, lease._id);
  if (!live) {
    throw new Error(`konga_placement_claim_not_owner:${lease.prospectId}`);
  }
  if (
    live.ownerAttempt !== lease.ownerAttempt ||
    live.fence !== lease.fence ||
    live.placementAttemptId !== lease.placementAttemptId ||
    live.placementId !== lease.placementId
  ) {
    throw new Error(`konga_placement_claim_not_owner:${lease.prospectId}`);
  }
  if (isExpired(live, now)) {
    throw new Error(`konga_placement_claim_expired:${lease.prospectId}`);
  }
}

async function releasePlacementClaim(
  persistence: Persistence,
  lease: KongaPlacementClaim,
): Promise<void> {
  await cleanupClaimProjection(persistence, lease);
}

async function readPlacementByAttempt(
  persistence: Persistence,
  attempt: { placementAttemptId: string },
): Promise<McsKongaPoolPlacement | null> {
  const result = await persistence<{ documents?: Array<McsKongaPoolPlacement> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      filter: { placementAttemptId: attempt.placementAttemptId },
      limit: 1,
    },
  );
  return result.documents?.[0] ?? null;
}

async function ensurePlacementReadback(
  placement: McsKongaPoolPlacement,
  strictVerify: typeof verifyKongaThreeLegs,
  persistence: Persistence,
): Promise<void> {
  const placementInput = {
    id: placement.placementId,
    mongoCollection: PLACEMENTS_COLLECTION,
    neo4jVerify: {
      cypher:
        'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->' +
        '(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      params: { poolId: TEAM_POOL_ID },
    },
    chromaCollection: CHROMA_COLLECTION,
  };
  await strictVerify(placementInput, persistence);
}

async function repairPlacementProjection(
  persistence: Persistence,
  placement: McsKongaPoolPlacement,
): Promise<void> {
  const placementProfile = placement as {
    firstName?: string;
    lastInitial?: string;
    city?: string;
    stateOrRegion?: string;
  };

  const neo4jRelationshipProps = {
    placementAttemptId: placement.placementAttemptId,
    position: placement.positionNumber,
    placedAt: placement.placedAt,
    sponsorTmagId: placement.sponsorTmagId,
    addedByFirstName: placement.addedBy?.firstName ?? '',
    addedByLastInitial: placement.addedBy?.lastInitial ?? '',
  };

  await Promise.all([
    persistence('mongodb', 'update', {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      filter: {
        placementId: placement.placementId,
        placementAttemptId: placement.placementAttemptId,
        prospectId: placement.prospectId,
      },
      update: { $set: { ...placement } },
    }),
    persistence('neo4j', 'cypher', {
      query:
        'MATCH (pool:TmagPool {id:$poolId}) ' +
        'MATCH (p:TmagProspect {prospectId:$prospectId}) ' +
        'MERGE (p)-[r:IN_HOLDING_TANK {placementId:$placementId}]->(pool) ' +
        'SET r += $relationshipProps',
      params: {
        poolId: TEAM_POOL_ID,
        prospectId: placement.prospectId,
        placementId: placement.placementId,
        relationshipProps: neo4jRelationshipProps,
      },
    }),
    persistence('chromadb', 'add', {
      collection: CHROMA_COLLECTION,
      ids: [placement.placementId],
      documents: [
        `Holding-tank placement #${placement.positionNumber} for ${placementProfile.firstName ?? ''} ` +
        `${placementProfile.lastInitial ?? ''} in ${placementProfile.city ?? ''}, ` +
        `${placementProfile.stateOrRegion ?? ''} at ${placement.placedAt}.`,
      ],
      metadatas: [
        {
          kind: 'konga_placement',
          placementId: placement.placementId,
          placementAttemptId: placement.placementAttemptId,
          prospectId: placement.prospectId,
          sponsorTmagId: placement.sponsorTmagId,
          positionNumber: placement.positionNumber,
          placedAt: placement.placedAt,
          addedByFirstName: placement.addedBy?.firstName,
          addedByLastInitial: placement.addedBy?.lastInitial,
        },
      ],
    }),
  ]);

  const verifyInput = {
    id: placement.placementId,
    mongoCollection: PLACEMENTS_COLLECTION,
    neo4jVerify: {
      cypher:
        'MATCH (:TmagProspect {prospectId:$id})-[r:IN_HOLDING_TANK {placementId:$id}]->' +
        '(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      params: { poolId: TEAM_POOL_ID },
    },
    chromaCollection: CHROMA_COLLECTION,
  };
  const verify = await verifyKongaThreeLegs(verifyInput, persistence);
  if (verify.chromaId !== placement.placementId) {
    throw new Error(`konga_konga_placement_repair_readback_missing:${placement.placementId}`);
  }
}

async function cleanupPlacementAttempt(
  persistence: Persistence,
  placement: McsKongaPoolPlacement,
): Promise<void> {
  await Promise.allSettled([
    persistence('mongodb', 'delete', {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      filter: {
        placementId: placement.placementId,
        placementAttemptId: placement.placementAttemptId,
        prospectId: placement.prospectId,
      },
    }),
    persistence('neo4j', 'cypher', {
      query:
        'MATCH (p:TmagProspect {prospectId:$prospectId})-[r:IN_HOLDING_TANK {placementId:$placementId}]->(:TmagPool) ' +
        'DELETE r',
      params: {
        prospectId: placement.prospectId,
        placementId: placement.placementId,
      },
    }),
    persistence('chromadb', 'delete', {
      collection: CHROMA_COLLECTION,
      ids: [placement.placementId],
    }),
  ]);
}

async function loadSameAttemptPlacement(
  persistence: Persistence,
  identity: { placementAttemptId: string },
): Promise<McsKongaPoolPlacement | null> {
  return readPlacementByAttempt(persistence, identity);
}

function placementVerify(inputId: string) {
  return {
    id: inputId,
    mongoCollection: PLACEMENTS_COLLECTION,
    neo4jVerify: {
      cypher:
        'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {placementId:$id}]->' +
        '(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      params: { poolId: TEAM_POOL_ID },
    },
    chromaCollection: CHROMA_COLLECTION,
  };
}

function resultOf(
  placement: McsKongaPoolPlacement,
  alreadyPlaced: boolean,
): McsKongaPlaceProspectResult {
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
  claimAcquireMaxAttempts?: number;
  claimAcquireYield?: () => Promise<void>;
}

function publicAddedBy(ba: Awaited<ReturnType<FindBa>>): McsKongaAddedBy {
  if (!ba) throw new Error('konga_sponsor_missing');
  return {
    firstName: ba.firstName,
    lastInitial: ba.lastName.trim().charAt(0).toUpperCase(),
  };
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

export async function placeKongaProspect(
  input: PlaceKongaProspectInput,
  deps: PlacementDeps = {},
): Promise<McsKongaPlaceProspectResult | McsPlaceProspectResult> {
  const persistence = deps.persistence ?? persistenceCall;
  const strictWrite = deps.strictWrite ?? tripleStackWriteWithReadback;
  const strictVerify = deps.strictVerify ?? verifyKongaThreeLegs;
  const identity = deriveKongaPlacementIdentity(input);

  const sameAttempt = await loadSameAttemptPlacement(persistence, identity);
  if (sameAttempt) {
    if (sameAttempt.prospectId !== input.prospectId || sameAttempt.sponsorTmagId !== input.sponsorTmagId) {
      throw new Error('konga_attempt_identity_conflict');
    }
    try {
      await ensurePlacementReadback(sameAttempt, strictVerify, persistence);
      return resultOf(sameAttempt, true);
    } catch {
      await repairPlacementProjection(persistence, sameAttempt);
      await ensurePlacementReadback(sameAttempt, strictVerify, persistence);
      return resultOf(sameAttempt, true);
    }
  }

  const live = await persistence<{ documents?: Array<McsPoolPlacement> }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: PLACEMENTS_COLLECTION,
    filter: { prospectId: input.prospectId, flushedAt: null },
    sort: { placedAt: -1, placementId: -1, _id: -1 },
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
  const now = input.now ?? new Date();
  const placedAt = now.toISOString();
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

  const acquireResult = await acquirePlacementClaim(persistence, input.prospectId, identity, now, deps);
  if (acquireResult.kind === 'same-attempt-seen' && acquireResult.placement) {
    await ensurePlacementReadback(acquireResult.placement, strictVerify, persistence);
    return resultOf(acquireResult.placement, true);
  }

  const lease = acquireResult.lease;
  if (!lease) {
    throw new Error(`konga_placement_claim_conflict:${input.prospectId}`);
  }

  const concurrentPlacementCheck = await persistence<{ documents?: Array<McsPoolPlacement> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PLACEMENTS_COLLECTION,
      filter: { prospectId: input.prospectId, flushedAt: null },
      sort: { placedAt: -1, placementId: -1, _id: -1 },
      limit: 1,
    },
  );
  if (concurrentPlacementCheck.documents?.[0]) {
    throw new Error(`konga_placement_claim_conflict:${input.prospectId}`);
  }

  try {
    await assertLeaseOwner(persistence, lease, now);
    const leased = await heartbeatPlacementClaim(persistence, lease, now);
    await assertLeaseOwner(persistence, leased, now);

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

    await assertLeaseOwner(persistence, leased, now);
    const prospectUpdate = await persistence<{ matchedCount?: number; modifiedCount?: number }>(
      'mongodb',
      'update',
      {
        database: MONGO_DB,
        collection: PROSPECTS_COLLECTION,
        filter: {
          prospectId: input.prospectId,
          sponsorTmagId: input.sponsorTmagId,
        },
        update: {
          $set: {
            positionNumber,
            placedAt,
            state: 'video_complete',
            updatedAt: placedAt,
          },
        },
      },
    );
    if ((prospectUpdate.matchedCount ?? 0) === 0) {
      throw new Error(`konga_prospect_position_projection_stale:${input.prospectId}`);
    }
    const prospectReadback = await persistence<{ documents?: Array<Record<string, unknown>> }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: PROSPECTS_COLLECTION,
        filter: {
          prospectId: input.prospectId,
          sponsorTmagId: input.sponsorTmagId,
          positionNumber,
          placedAt,
        },
        limit: 1,
      },
    );
    if (!prospectReadback.documents?.[0]) {
      throw new Error('konga_prospect_placement_readback_missing');
    }

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
  } catch (error) {
    const sameAttemptPlacement = await loadSameAttemptPlacement(persistence, identity);
    if (sameAttemptPlacement) {
      try {
        await repairPlacementProjection(persistence, sameAttemptPlacement);
        await ensurePlacementReadback(sameAttemptPlacement, strictVerify, persistence);
        return resultOf(sameAttemptPlacement, true);
      } catch (repairError) {
        await cleanupPlacementAttempt(persistence, sameAttemptPlacement);
        throw repairError;
      }
    }
    throw error;
  } finally {
    await releasePlacementClaim(persistence, lease).catch(() => {
      // Non-throwing release keeps prior outcomes authoritative.
    });
  }
}

export function projectLegacyPlacementAddedBy(
  placement: McsPoolPlacement,
): McsKongaAddedBy | null {
  const candidate = placement as McsPoolPlacement & { addedBy?: McsKongaAddedBy };
  return candidate.addedBy ?? null;
}
