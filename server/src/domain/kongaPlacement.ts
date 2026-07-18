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
const CLAIM_HEARTBEAT_INTERVAL_MS = 100;
const CLAIM_ACQUIRE_BASE_DELAY_MS = 20;
const CLAIM_ACQUIRE_MAX_DELAY_MS = 200;
const CLAIM_ACQUIRE_MAX_RETRIES = 12;
const CLAIM_CLEANUP_ATTEMPTS = 4;
const CLAIM_CLEANUP_BACKOFF_MS = 25;
const CLAIM_IDENTITY_SEPARATOR = '|';

type Persistence = typeof persistenceCall;
type Publish = typeof publishPlacement;
type FindBa = typeof findBAByTmagId;
type Increment = typeof incrementPoolCounter;

type ProjectionIdentityPlacement = {
  placementId?: string;
  placementAttemptId?: string;
  ownerAttempt?: unknown;
  fence?: unknown;
  projectionEventId?: unknown;
  _id?: unknown;
  sponsorTmagId?: unknown;
  prospectId?: unknown;
  positionNumber?: unknown;
  placedAt?: unknown;
};

interface KongaPlacementClaim {
  _id: string;
  claimEventId: string;
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

function buildClaimEventId(claimId: string, ownerAttempt: string, fence: number): string {
  return `${claimId}${CLAIM_IDENTITY_SEPARATOR}${ownerAttempt}${CLAIM_IDENTITY_SEPARATOR}${fence}`;
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

function parseKnownFence(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return Math.trunc(parsed);
  }
  return null;
}

const PLACEMENT_PROJECTION_EVENT_SEPARATOR = '|';

function buildPlacementProjectionEventId(
  placementId: string,
  ownerAttempt: string,
  fence: number,
): string {
  return `${placementId}${PLACEMENT_PROJECTION_EVENT_SEPARATOR}${ownerAttempt}${PLACEMENT_PROJECTION_EVENT_SEPARATOR}${fence}`;
}

function inferPlacementProjectionEventId(
  placement: ProjectionIdentityPlacement,
  ownerHint?: { ownerAttempt: string; fence: number },
): string | undefined {
  const placementId =
    typeof placement.placementId === 'string' && placement.placementId
      ? placement.placementId
      : typeof placement._id === 'string' && placement._id.trim()
        ? placement._id
        : undefined;
  const ownerAttempt =
    ownerHint?.ownerAttempt ??
    (typeof placement.ownerAttempt === 'string' && placement.ownerAttempt
      ? placement.ownerAttempt
      : undefined);
  const fence = ownerHint?.fence ?? parseKnownFence(placement.fence);
  if (ownerHint && ownerAttempt && fence !== null && placementId) {
    const hasMatchingCurrentOwner =
      typeof placement.ownerAttempt === 'string' &&
      placement.ownerAttempt === ownerHint.ownerAttempt &&
      parseKnownFence(placement.fence) === ownerHint.fence;
    if (hasMatchingCurrentOwner) {
      const explicit = placement.projectionEventId;
      if (typeof explicit === 'string' && explicit.trim()) {
        return explicit;
      }
    }
    return buildPlacementProjectionEventId(placementId, ownerAttempt, fence);
  }

  const explicit = placement.projectionEventId;
  if (typeof explicit === 'string' && explicit.trim()) {
    return explicit;
  }

  if (typeof ownerAttempt === 'string' && ownerAttempt && fence !== null) {
    return placementId
      ? buildPlacementProjectionEventId(placementId, ownerAttempt, fence)
      : undefined;
  }
  if (placementId) {
    return placementId;
  }
  return undefined;
}

function placementChromaReadbackId(
  placement: ProjectionIdentityPlacement,
  ownerHint?: { ownerAttempt: string; fence: number },
): string | undefined {
  return inferPlacementProjectionEventId(placement, ownerHint);
}

function ownershipFromPlacement(
  placement: McsKongaPoolPlacement & { ownerAttempt?: unknown; fence?: unknown },
): { ownerAttempt: string; fence: number } | null {
  if (typeof placement.ownerAttempt !== 'string' || !placement.ownerAttempt) return null;
  const fence = parseKnownFence(placement.fence);
  if (fence === null) return null;
  return { ownerAttempt: placement.ownerAttempt, fence };
}

function isExpired(claim: KongaPlacementClaim, now: Date): boolean {
  const expiresMs = Date.parse(claim.expiresAt);
  return Number.isFinite(expiresMs) && expiresMs <= now.getTime();
}

function normalizeClaim(candidate: Record<string, unknown>): KongaPlacementClaim {
  return {
    _id: String(candidate._id),
    claimEventId: String(candidate.claimEventId),
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
    claimEventId: claim.claimEventId,
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
  const claimId = claimDocumentId(prospectId);
  return {
    _id: claimId,
    claimEventId: buildClaimEventId(claimId, ownerAttempt, fence),
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
        'MATCH (c:TmagKongaPlacementClaim {claimEventId:$claimEventId, prospectId:$prospectId}) ' +
        'WHERE c.ownerAttempt = $ownerAttempt AND c.fence = $fence RETURN count(c) AS n, c.fence AS fence, c.ownerAttempt AS ownerAttempt',
      params: {
        claimEventId: claim.claimEventId,
        prospectId: claim.prospectId,
        ownerAttempt: claim.ownerAttempt,
        fence: claim.fence,
      },
    }),
    persistence<ChromaClaimRecord>('chromadb', 'get', {
      collection: KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION,
      ids: [claim.claimEventId],
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
  if (!(chromaResult.ids ?? []).includes(claim.claimEventId)) {
    throw new Error(`konga_placement_claim_chroma_missing:${claim.claimEventId}`);
  }
  const firstMetadata = chromaResult.metadatas?.[0];
  if (!firstMetadata) {
    throw new Error(`konga_placement_claim_chroma_missing_metadata:${claim._id}`);
  }
  assertMetadataValue(firstMetadata.claimId, claim._id);
  assertMetadataValue(firstMetadata.claimEventId, claim.claimEventId);
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
      claimEventId: claim.claimEventId,
      placementAttemptId: claim.placementAttemptId,
    },
    update: {
      $set: {
        claimEventId: claim.claimEventId,
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
  for (let attempt = 0; attempt < CLAIM_CLEANUP_ATTEMPTS; attempt += 1) {
    const mongoFilter = {
      _id: claim._id,
      ownerAttempt: claim.ownerAttempt,
      fence: claim.fence,
      claimEventId: claim.claimEventId,
    };
    const neoParams = {
      claimEventId: claim.claimEventId,
      prospectId: claim.prospectId,
      ownerAttempt: claim.ownerAttempt,
      fence: claim.fence,
    };
    const chromaId = claim.claimEventId;

    const deleteErrors: string[] = [];
    try {
      await persistence('mongodb', 'delete', {
        database: MONGO_DB,
        collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
        filter: mongoFilter,
      });
    } catch (error) {
      deleteErrors.push(`mongo:${String(error instanceof Error ? error.message : error)}`);
    }
    try {
      await persistence('neo4j', 'cypher', {
        query:
          'MATCH (c:TmagKongaPlacementClaim {claimEventId:$claimEventId, prospectId:$prospectId}) ' +
          'WHERE c.ownerAttempt = $ownerAttempt AND c.fence = $fence ' +
          'DETACH DELETE c',
        params: neoParams,
      });
    } catch (error) {
      deleteErrors.push(`neo4j:${String(error instanceof Error ? error.message : error)}`);
    }
    try {
      await persistence('chromadb', 'delete', {
        collection: KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION,
        ids: [chromaId],
      });
    } catch (error) {
      deleteErrors.push(`chroma:${String(error instanceof Error ? error.message : error)}`);
    }

    let mongoResult: { documents?: Array<Record<string, unknown>> };
    let neoResult: { records?: Array<Record<string, unknown>> };
    let chromaResult: { ids?: string[] };
    try {
      mongoResult = await persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
        database: MONGO_DB,
        collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
        filter: mongoFilter,
        limit: 1,
      });
    } catch (error) {
      deleteErrors.push(`mongo-read:${String(error instanceof Error ? error.message : error)}`);
      mongoResult = { documents: [{}] };
    }
    try {
      neoResult = await persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
        query:
          'MATCH (c:TmagKongaPlacementClaim {claimEventId:$claimEventId, prospectId:$prospectId}) ' +
          'WHERE c.ownerAttempt = $ownerAttempt AND c.fence = $fence ' +
          'RETURN count(c) AS n',
        params: neoParams,
      });
    } catch (error) {
      deleteErrors.push(`neo4j-read:${String(error instanceof Error ? error.message : error)}`);
      neoResult = { records: [{ n: 1 }] };
    }
    try {
      chromaResult = await persistence<{ ids?: string[] }>('chromadb', 'get', {
        collection: KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION,
        ids: [chromaId],
      });
    } catch (error) {
      deleteErrors.push(`chroma-read:${String(error instanceof Error ? error.message : error)}`);
      chromaResult = { ids: [chromaId] };
    }

    const mongoClear = !mongoResult.documents?.[0];
    const neoClear = Number(neoResult.records?.[0]?.n ?? 0) === 0;
    const chromaClear = !(chromaResult.ids ?? []).includes(chromaId);
    if (mongoClear && neoClear && chromaClear) {
      return;
    }

    if (attempt + 1 < CLAIM_CLEANUP_ATTEMPTS) {
      await new Promise((resolve) => {
        setTimeout(resolve, CLAIM_CLEANUP_BACKOFF_MS * (attempt + 1));
      });
    }
  }

  throw new Error(`konga_placement_claim_projection_cleanup_failed:${claim._id}`);
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
          'MERGE (c:TmagKongaPlacementClaim {claimEventId:$claimEventId, prospectId:$prospectId}) ' +
          'SET c += $properties',
        params: {
          claimEventId: claim.claimEventId,
          prospectId: claim.prospectId,
          properties: {
            ...claimToMetadata(claim),
          },
        },
      }),
      persistence('chromadb', 'add', {
        collection: KONGA_PLACEMENT_CLAIM_CHROMA_COLLECTION,
        ids: [claim.claimEventId],
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
        claimEventId: claim.claimEventId,
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

function claimAcquireDelayMs(attempt: number): number {
  return Math.min(CLAIM_ACQUIRE_MAX_DELAY_MS, CLAIM_ACQUIRE_BASE_DELAY_MS * 2 ** attempt);
}

async function waitMs(deps: PlacementDeps, ms: number): Promise<void> {
  if (ms <= 0) return;
  if (deps.claimHeartbeatSleep) {
    await deps.claimHeartbeatSleep(ms);
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function verifyLegacyPlacementProjectionReadback(
  placement: McsKongaPoolPlacement & { _id?: unknown },
  persistence: Persistence,
): Promise<boolean> {
  const legacyPlacementId = String(placement._id ?? '');
  if (!legacyPlacementId) return false;
  const legacyProjectionId = placementChromaReadbackId(placement) ?? legacyPlacementId;
  let mongoResult: Awaited<ReturnType<typeof persistence<{ documents?: Array<Record<string, unknown>> }>>>;
  let neoResult: Awaited<ReturnType<typeof persistence<{ records?: Array<Record<string, unknown>> }>>>;
  let chromaResult: Awaited<
    ReturnType<typeof persistence<{ ids?: string[]; metadatas?: Array<Record<string, unknown> | null> }>>
  >;
  try {
    [mongoResult, neoResult, chromaResult] = await Promise.all([
      persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
        database: MONGO_DB,
        collection: PLACEMENTS_COLLECTION,
        filter: { _id: legacyPlacementId },
        limit: 1,
      }),
      persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
        query:
          'MATCH (p:TmagProspect {prospectId:$prospectId})-[r:IN_HOLDING_TANK]->(:TmagPool {id:$poolId}) ' +
          'WHERE r.position = $positionNumber AND r.sponsorTmagId = $sponsorTmagId AND r.placedAt = $placedAt ' +
          'RETURN count(r) AS n',
        params: {
          prospectId: placement.prospectId,
          poolId: TEAM_POOL_ID,
          positionNumber: placement.positionNumber,
          sponsorTmagId: placement.sponsorTmagId,
          placedAt: placement.placedAt,
        },
      }),
      persistence<{ ids?: string[]; metadatas?: Array<Record<string, unknown> | null> }>('chromadb', 'get', {
        collection: CHROMA_COLLECTION,
        ids: [legacyProjectionId],
      }),
    ]);
  } catch {
    return false;
  }
  if (!mongoResult.documents?.[0]) return false;
  if (Number(neoResult.records?.[0]?.n ?? 0) !== 1) return false;
  const chromaMetadata = chromaResult.metadatas?.[0];
  if (!chromaMetadata) return false;
  if (String(chromaMetadata.placementId ?? '') !== String(legacyPlacementId)) return false;
  if (String(chromaMetadata.prospectId ?? '') !== String(placement.prospectId)) return false;
  if (String(chromaMetadata.sponsorTmagId ?? '') !== String(placement.sponsorTmagId)) return false;
  if (Number(chromaMetadata.positionNumber) !== placement.positionNumber) return false;
  if (String(chromaMetadata.placedAt ?? '') !== String(placement.placedAt)) return false;
  return true;
}

async function loadVerifiedAttemptPlacement(
  persistence: Persistence,
  identity: { placementAttemptId: string },
  strictVerify: typeof verifyKongaThreeLegs,
  ownerFence?: { ownerAttempt: string; fence: number },
): Promise<McsKongaPoolPlacement | null> {
  const placement = await readPlacementByAttempt(persistence, identity);
  if (!placement) return null;
  const fencedPlacement = placement as McsKongaPoolPlacement & {
    ownerAttempt?: string;
    fence?: unknown;
    projectionEventId?: unknown;
    _id?: unknown;
  };
  const legacyLiveWithoutIdentity =
    !fencedPlacement.placementId && !fencedPlacement.placementAttemptId;
  if (legacyLiveWithoutIdentity) {
    if (!(await verifyLegacyPlacementProjectionReadback(fencedPlacement, persistence))) {
      return null;
    }
    return placement;
  }

  if (
    ownerFence &&
    (fencedPlacement.ownerAttempt !== ownerFence.ownerAttempt ||
      parseFence(fencedPlacement.fence) !== ownerFence.fence)
  ) {
    return null;
  }

  try {
    await strictVerify(
      {
        id: placement.placementId,
        mongoCollection: PLACEMENTS_COLLECTION,
        neo4jVerify: {
          cypher:
            'MATCH (:TmagProspect {prospectId:$prospectId})-[r:IN_HOLDING_TANK {placementId:$id}]->' +
            '(:TmagPool {id:$poolId}) RETURN count(r) AS n',
          params: {
            poolId: TEAM_POOL_ID,
            prospectId: placement.prospectId,
            id: placement.placementId,
          },
        },
        chromaCollection: CHROMA_COLLECTION,
        chromaId: placementChromaReadbackId(placement),
      },
      persistence,
    );
    const placementOwner = ownershipFromPlacement(fencedPlacement);
    if (placementOwner) {
      const claim = await readClaim(persistence, claimDocumentId(placement.prospectId));
      if (claim) {
        return null;
      }
      const prospectResult = await persistence<{ documents?: Array<Record<string, unknown>> }>(
        'mongodb',
        'query',
        {
          database: MONGO_DB,
          collection: PROSPECTS_COLLECTION,
          filter: {
            prospectId: placement.prospectId,
            sponsorTmagId: placement.sponsorTmagId,
            state: 'video_complete',
            positionNumber: placement.positionNumber,
            placedAt: placement.placedAt,
          },
          limit: 1,
        },
      );
      if (!prospectResult.documents?.[0]) {
        return null;
      }
    }
    return placement;
  } catch {
    return null;
  }
}

async function acquirePlacementClaim(
  persistence: Persistence,
  prospectId: string,
  identity: { placementAttemptId: string; placementId: string },
  deps: PlacementDeps,
): Promise<PlacementClaimAcquireResult> {
  const maxAttempts = Math.max(4, deps.claimAcquireMaxAttempts ?? CLAIM_ACQUIRE_MAX_RETRIES);
  const maxDelayAttempt = Math.max(1, maxAttempts - 2);
  const claimId = claimDocumentId(prospectId);
  const ownerAttempt = `konga_owner_${randomUUID()}`;
  const nowClock = deps.clock ?? (() => new Date());

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const duplicate = await loadVerifiedAttemptPlacement(
      persistence,
      identity,
      deps.strictVerify ?? verifyKongaThreeLegs,
    );
    if (duplicate) {
      return { kind: 'same-attempt-seen', placement: duplicate };
    }

    const current = await readClaim(persistence, claimId);
    if (!current) {
      const now = nowClock();
      const claim = buildClaimInput(prospectId, identity, ownerAttempt, 1, now);
      try {
        await writeClaimProjection(persistence, claim, 'create');
        return { kind: 'acquired', lease: claim };
      } catch (error) {
        if (isDuplicateError(error)) {
          const raced = await loadVerifiedAttemptPlacement(
            persistence,
            identity,
            deps.strictVerify ?? verifyKongaThreeLegs,
          );
          if (raced) {
            return { kind: 'same-attempt-seen', placement: raced };
          }
          if (attempt + 1 < maxAttempts) {
            const delay = claimAcquireDelayMs(Math.min(attempt + 1, maxDelayAttempt));
            if (deps.claimAcquireYield) {
              await deps.claimAcquireYield(delay);
            } else {
              await waitMs(deps, delay);
            }
          }
          continue;
        }
        throw error;
      }
    }

    if (current.placementAttemptId === identity.placementAttemptId) {
      const now = nowClock();
      if (isExpired(current, now)) {
        const reclaimed = await reclaimPlacementClaim(persistence, current, identity, now);
        if (reclaimed) {
          return { kind: 'acquired', lease: reclaimed };
        }
      }
      if (attempt + 1 < maxAttempts) {
        const delay = claimAcquireDelayMs(Math.min(attempt + 1, maxDelayAttempt));
        if (deps.claimAcquireYield) {
          await deps.claimAcquireYield(delay);
        } else {
          await waitMs(deps, delay);
        }
      }
      continue;
    }

    const now = nowClock();
    if (isExpired(current, now)) {
      const reclaimed = await reclaimPlacementClaim(persistence, current, identity, now);
      if (reclaimed) return { kind: 'acquired', lease: reclaimed };
    }

    if (attempt + 1 < maxAttempts) {
      const delay = claimAcquireDelayMs(Math.min(attempt + 1, maxDelayAttempt));
      if (deps.claimAcquireYield) {
        await deps.claimAcquireYield(delay);
      } else {
        await waitMs(deps, delay);
      }
    }
  }

  const resolved = await loadVerifiedAttemptPlacement(
    persistence,
    identity,
    deps.strictVerify ?? verifyKongaThreeLegs,
  );
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
  const chromaId = placementChromaReadbackId(placement);
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
    chromaId,
  };
  await strictVerify(placementInput, persistence);
}

async function repairPlacementProjection(
  persistence: Persistence,
  placement: McsKongaPoolPlacement,
  claim?: { ownerAttempt: string; fence: number },
): Promise<void> {
  const placementProfile = placement as {
    firstName?: string;
    lastInitial?: string;
    city?: string;
    stateOrRegion?: string;
  };

  const projectionEventId = placementChromaReadbackId(placement, claim);
  const neo4jRelationshipProps = {
    placementAttemptId: placement.placementAttemptId,
    position: placement.positionNumber,
    placedAt: placement.placedAt,
    sponsorTmagId: placement.sponsorTmagId,
    addedByFirstName: placement.addedBy?.firstName ?? '',
    addedByLastInitial: placement.addedBy?.lastInitial ?? '',
    ...(claim ? { ownerAttempt: claim.ownerAttempt, fence: claim.fence } : {}),
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
      update: {
        $set: {
          ...placement,
          ...(projectionEventId ? { projectionEventId } : {}),
          ...(claim ? { ownerAttempt: claim.ownerAttempt, fence: claim.fence } : {}),
        },
      },
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
      ids: [projectionEventId ?? placement.placementId],
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
          projectionEventId,
          ...(claim ? { ownerAttempt: claim.ownerAttempt, fence: claim.fence } : {}),
        },
      ],
    }),
  ]);

  const verifyInput = {
    id: placement.placementId,
    chromaId: projectionEventId ?? placement.placementId,
    mongoCollection: PLACEMENTS_COLLECTION,
    neo4jVerify: {
      cypher:
        'MATCH (:TmagProspect {prospectId:$prospectId})-[r:IN_HOLDING_TANK {placementId:$placementId}]->' +
        '(:TmagPool {id:$poolId}) RETURN count(r) AS n',
      params: { poolId: TEAM_POOL_ID, prospectId: placement.prospectId, placementId: placement.placementId },
    },
    chromaCollection: CHROMA_COLLECTION,
  };
  const verify = await verifyKongaThreeLegs(verifyInput, persistence);
  if (verify.chromaId !== (projectionEventId ?? placement.placementId)) {
    throw new Error(`konga_konga_placement_repair_readback_missing:${placement.placementId}`);
  }
}

async function cleanupPlacementAttempt(
  persistence: Persistence,
  placement: McsKongaPoolPlacement,
  ownership?: { ownerAttempt: string; fence: number },
): Promise<void> {
  const ownershipToUse = ownership ?? ownershipFromPlacement(placement as McsKongaPoolPlacement);
  if (!ownershipToUse) {
    throw new Error(`konga_placement_projection_cleanup_missing_owner:${placement.placementId}`);
  }
  const deleteFilter: Record<string, unknown> = {
    placementId: placement.placementId,
    placementAttemptId: placement.placementAttemptId,
    prospectId: placement.prospectId,
    ownerAttempt: ownershipToUse.ownerAttempt,
    fence: ownershipToUse.fence,
  };
  const neoFilter = {
    prospectId: placement.prospectId,
    placementId: placement.placementId,
    placementAttemptId: placement.placementAttemptId,
    ownerAttempt: ownershipToUse.ownerAttempt,
    fence: ownershipToUse.fence,
  };
  const projectionEventId = placementChromaReadbackId(placement, ownershipToUse) ?? placement.placementId;

  for (let attempt = 0; attempt < CLAIM_CLEANUP_ATTEMPTS; attempt += 1) {
    const deleteErrors: string[] = [];
    try {
      await persistence('mongodb', 'delete', {
        database: MONGO_DB,
        collection: PLACEMENTS_COLLECTION,
        filter: deleteFilter,
      });
    } catch (error) {
      deleteErrors.push(`mongo:${String(error instanceof Error ? error.message : error)}`);
    }
    try {
      await persistence('neo4j', 'cypher', {
        query:
          'MATCH (p:TmagProspect {prospectId:$prospectId})-[r:IN_HOLDING_TANK {placementId:$placementId}]->(:TmagPool) ' +
          'WHERE r.ownerAttempt = $ownerAttempt AND r.fence = $fence AND r.placementAttemptId = $placementAttemptId ' +
          'DELETE r',
        params: neoFilter,
      });
    } catch (error) {
      deleteErrors.push(`neo4j:${String(error instanceof Error ? error.message : error)}`);
    }

    let mongoResult: { documents?: Array<Record<string, unknown>> };
    let neoResult: { records?: Array<Record<string, unknown>> };
    let chromaResult: { ids?: string[]; metadatas?: Array<Record<string, unknown> | null> };
    try {
      mongoResult = await persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
        database: MONGO_DB,
        collection: PLACEMENTS_COLLECTION,
        filter: deleteFilter,
        limit: 1,
      });
    } catch (error) {
      deleteErrors.push(`mongo-read:${String(error instanceof Error ? error.message : error)}`);
      mongoResult = { documents: [{}] };
    }
    try {
      neoResult = await persistence<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
        query:
          'MATCH (:TmagProspect {prospectId:$prospectId})-[r:IN_HOLDING_TANK {placementId:$placementId}]->(:TmagPool) ' +
          'WHERE r.ownerAttempt = $ownerAttempt AND r.fence = $fence AND r.placementAttemptId = $placementAttemptId RETURN count(r) AS n',
        params: neoFilter,
      });
    } catch (error) {
      deleteErrors.push(`neo4j-read:${String(error instanceof Error ? error.message : error)}`);
      neoResult = { records: [{ n: 1 }] };
    }
    try {
      chromaResult = await persistence<{ ids?: string[]; metadatas?: Array<Record<string, unknown> | null> }>(
        'chromadb',
        'get',
        {
          collection: CHROMA_COLLECTION,
          ids: [projectionEventId],
        },
      );
    } catch (error) {
      deleteErrors.push(`chroma-read:${String(error instanceof Error ? error.message : error)}`);
      chromaResult = {
        ids: [placement.placementId],
        metadatas: [null],
      };
    }

    const mongoClear = !mongoResult.documents?.[0];
    const neoClear = Number(neoResult.records?.[0]?.n ?? 0) === 0;
    let chromaClear = !((chromaResult.ids ?? []).includes(projectionEventId));
    if (chromaResult.ids?.includes(projectionEventId)) {
      try {
        await persistence('chromadb', 'delete', {
          collection: CHROMA_COLLECTION,
          ids: [projectionEventId],
        });
      } catch (error) {
        deleteErrors.push(`chroma-delete:${String(error instanceof Error ? error.message : error)}`);
      }
      try {
        const afterChromaDelete = await persistence<{ ids?: string[] }>('chromadb', 'get', {
          collection: CHROMA_COLLECTION,
          ids: [projectionEventId],
        });
        chromaClear = !(afterChromaDelete.ids ?? []).includes(projectionEventId);
      } catch (error) {
        deleteErrors.push(`chroma-read-after-delete:${String(error instanceof Error ? error.message : error)}`);
        chromaClear = false;
      }
    }

    if (mongoClear && neoClear && chromaClear) {
      return;
    }

    if (attempt + 1 < CLAIM_CLEANUP_ATTEMPTS) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, CLAIM_CLEANUP_BACKOFF_MS * (attempt + 1));
      });
      continue;
    }

    if (deleteErrors.length > 0) {
      throw new Error(`konga_placement_projection_cleanup_failed:${placement.placementId}`);
    }
  }

  throw new Error(`konga_placement_projection_cleanup_failed:${placement.placementId}`);
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
  claimAcquireYield?: (ms: number) => Promise<void>;
  clock?: () => Date;
  claimHeartbeatSleep?: (ms: number) => Promise<void>;
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
  const nowClock = deps.clock ?? (() => new Date());
  const identity = deriveKongaPlacementIdentity(input);
  const sameAttemptPlacementVerification = async (
    identityToMatch: { placementAttemptId: string },
    ownerFilter?: { ownerAttempt: string; fence: number },
  ) =>
    loadVerifiedAttemptPlacement(
      persistence,
      identityToMatch,
      strictVerify,
      ownerFilter,
    );
  const sameAttemptPlacementRaw = async (
    identityToMatch: { placementAttemptId: string },
  ): Promise<McsKongaPoolPlacement | null> => readPlacementByAttempt(persistence, identityToMatch);

  const sameAttempt = await sameAttemptPlacementRaw(identity);
  if (sameAttempt) {
    if (sameAttempt.prospectId !== input.prospectId || sameAttempt.sponsorTmagId !== input.sponsorTmagId) {
      throw new Error('konga_attempt_identity_conflict');
    }
    const verifiedSameAttempt = await sameAttemptPlacementVerification(identity);
    if (verifiedSameAttempt) {
      await ensurePlacementReadback(verifiedSameAttempt, strictVerify, persistence);
      return resultOf(verifiedSameAttempt, true);
    }
  }

  const live = await persistence<{ documents?: Array<McsKongaPoolPlacement & { _id?: string }> }>(
    'mongodb',
    'query',
    {
    database: MONGO_DB,
    collection: PLACEMENTS_COLLECTION,
    filter: { prospectId: input.prospectId, flushedAt: null },
    sort: { placedAt: -1, placementId: -1, _id: -1 },
    limit: 1,
  });
  const livePlacement = live.documents?.[0];
  if (livePlacement) {
    if (
      !livePlacement.placementId &&
      !livePlacement.placementAttemptId &&
      !!livePlacement._id &&
      !(await verifyLegacyPlacementProjectionReadback(livePlacement, persistence))
    ) {
      throw new Error('konga_live_placement_verification_failed');
    }
    if (!livePlacement.placementId && !livePlacement.placementAttemptId && !!livePlacement._id) {
      return resultOf(livePlacement as unknown as McsKongaPoolPlacement, true);
    }
    const liveOwnership = ownershipFromPlacement(livePlacement);
    if (!liveOwnership) {
      throw new Error('konga_live_placement_exists');
    }
  }

  const ba = await (deps.findBa ?? findBAByTmagId)(input.sponsorTmagId);
  const addedBy = publicAddedBy(ba);
  const positionNumber = await (deps.increment ?? incrementPoolCounter)();
  const now = input.now ?? nowClock();
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

  const acquireResult = await acquirePlacementClaim(persistence, input.prospectId, identity, deps);
  if (acquireResult.kind === 'same-attempt-seen' && acquireResult.placement) {
    await ensurePlacementReadback(acquireResult.placement, strictVerify, persistence);
    return resultOf(acquireResult.placement, true);
  }

  const lease = acquireResult.lease;
  if (!lease) {
    throw new Error(`konga_placement_claim_conflict:${input.prospectId}`);
  }

  let activeLease: KongaPlacementClaim = lease;
  let heartbeatStopped = false;
  let activeResult: McsKongaPlaceProspectResult | McsPlaceProspectResult | null = null;
  let caughtError: unknown = null;
  let heartbeatTask = Promise.resolve();
  const isCurrentLeaseOwner = async (): Promise<boolean> => {
    const rows = await persistence<{ documents?: Array<Record<string, unknown>> }>(
      'mongodb',
      'query',
      {
        database: MONGO_DB,
        collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
        filter: { _id: activeLease._id },
        limit: 1,
      },
    );
    const claimRow = rows.documents?.[0];
    if (!claimRow) return false;
    const current = normalizeClaim(claimRow);
    return (
      current.ownerAttempt === activeLease.ownerAttempt &&
      current.fence === activeLease.fence &&
      current.placementAttemptId === activeLease.placementAttemptId &&
      current.placementId === activeLease.placementId
    );
  };

  try {
    heartbeatTask = (async () => {
      while (!heartbeatStopped) {
        await waitMs(deps, CLAIM_HEARTBEAT_INTERVAL_MS);
        if (heartbeatStopped) break;
        try {
          activeLease = await heartbeatPlacementClaim(persistence, activeLease, nowClock());
        } catch (error) {
          heartbeatStopped = true;
        }
      }
    })();

    const livePlacementCheck = await persistence<{ documents?: Array<McsKongaPoolPlacement> }>(
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
    const livePlacement = livePlacementCheck.documents?.[0];
    if (livePlacement) {
      const sameAttempt = livePlacement.placementAttemptId === identity.placementAttemptId;
      if (!sameAttempt) {
      const liveOwnership = ownershipFromPlacement(livePlacement as McsKongaPoolPlacement);
        if (!liveOwnership) {
          throw new Error(`konga_placement_claim_not_owner:${input.prospectId}`);
        }

        const claimRows = await persistence<{ documents?: Array<Record<string, unknown>> }>(
          'mongodb',
          'query',
          {
            database: MONGO_DB,
            collection: KONGA_PLACEMENT_CLAIM_COLLECTION,
            filter: { _id: claimDocumentId(input.prospectId) },
            limit: 1,
          },
        );
        const claimRow = claimRows.documents?.[0];
        if (claimRow) {
          const claimOwner = normalizeClaim(claimRow);
          if (
            claimOwner.ownerAttempt === liveOwnership.ownerAttempt &&
            claimOwner.fence === liveOwnership.fence &&
            !isExpired(claimOwner, nowClock())
          ) {
            throw new Error(`konga_placement_claim_conflict:${input.prospectId}`);
          }
        }

        const prospectComplete = await persistence<{ documents?: Array<Record<string, unknown>> }>(
          'mongodb',
          'query',
          {
            database: MONGO_DB,
            collection: PROSPECTS_COLLECTION,
            filter: {
              prospectId: input.prospectId,
              state: 'video_complete',
            },
            limit: 1,
          },
        );
        if (prospectComplete.documents?.[0]) {
          throw new Error(`konga_placement_claim_conflict:${input.prospectId}`);
        }

      }
    }

    await assertLeaseOwner(persistence, activeLease, nowClock());
    const projectionEventId = buildPlacementProjectionEventId(
      identity.placementId,
      activeLease.ownerAttempt,
      activeLease.fence,
    );

    await strictWrite(
      {
        id: identity.placementId,
        mongoCollection: PLACEMENTS_COLLECTION,
        mongoDoc: {
          ...placement,
          ownerAttempt: activeLease.ownerAttempt,
          fence: activeLease.fence,
          projectionEventId,
        },
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
              ownerAttempt: activeLease.ownerAttempt,
              fence: activeLease.fence,
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
            ownerAttempt: activeLease.ownerAttempt,
            fence: activeLease.fence,
            projectionEventId,
          },
        },
        chromaId: projectionEventId,
        neo4jVerify: placementVerify(identity.placementId).neo4jVerify,
      },
      persistence,
    );
    await assertLeaseOwner(persistence, activeLease, nowClock());

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
    activeResult = resultOf(placement, false);
  } catch (error) {
    caughtError = error;
    const sameAttemptPlacement = await sameAttemptPlacementRaw(identity);
    const fencedSameAttemptPlacement = sameAttemptPlacement as
      | (McsKongaPoolPlacement & { ownerAttempt?: string; fence?: unknown })
      | null;
    const isOwnOwnerAttempt =
      fencedSameAttemptPlacement?.ownerAttempt === activeLease.ownerAttempt &&
      parseFence(fencedSameAttemptPlacement?.fence) === activeLease.fence;
    const currentLeaseOwner = await isCurrentLeaseOwner();
    const isCurrentWinner = isOwnOwnerAttempt && currentLeaseOwner;
    if (isCurrentWinner && sameAttemptPlacement) {
      try {
        await repairPlacementProjection(
          persistence,
          sameAttemptPlacement,
          { ownerAttempt: activeLease.ownerAttempt, fence: activeLease.fence },
        );
        await ensurePlacementReadback(sameAttemptPlacement, strictVerify, persistence);
        const repaired = await sameAttemptPlacementVerification(identity, {
          ownerAttempt: activeLease.ownerAttempt,
          fence: activeLease.fence,
        });
        if (repaired) {
          activeResult = resultOf(repaired, true);
          caughtError = null;
        } else if (currentLeaseOwner) {
          activeResult = resultOf(sameAttemptPlacement, true);
          caughtError = null;
        }
      } catch (repairError) {
        caughtError = repairError;
        try {
          await cleanupPlacementAttempt(persistence, sameAttemptPlacement, {
            ownerAttempt: activeLease.ownerAttempt,
            fence: activeLease.fence,
          });
        } catch (cleanupError) {
          caughtError = cleanupError;
        }
      }
    }

    const sameAttemptOwnership = fencedSameAttemptPlacement
      ? ownershipFromPlacement(fencedSameAttemptPlacement as McsKongaPoolPlacement)
      : null;
    if (!isCurrentWinner && sameAttemptPlacement) {
      const staleOwnership = {
        ownerAttempt: activeLease.ownerAttempt,
        fence: activeLease.fence,
      };
      const cleanupOwnership =
        sameAttemptOwnership &&
        sameAttemptOwnership.ownerAttempt === activeLease.ownerAttempt &&
        sameAttemptOwnership.fence === activeLease.fence
          ? sameAttemptOwnership
          : staleOwnership;
      try {
        await cleanupPlacementAttempt(persistence, sameAttemptPlacement, cleanupOwnership);
      } catch (cleanupError) {
        caughtError = cleanupError;
      }
    }
    const sameAttemptPlacementVerified = await sameAttemptPlacementVerification(identity, {
      ownerAttempt: activeLease.ownerAttempt,
      fence: activeLease.fence,
    });
    if (!activeResult && sameAttemptPlacementVerified && isCurrentWinner) {
      activeResult = resultOf(sameAttemptPlacementVerified, true);
      caughtError = null;
    }
  } finally {
    heartbeatStopped = true;
    await heartbeatTask.catch(() => {
      /* intentional: heartbeat stop is enforced by boolean signal */
    });
    try {
      await releasePlacementClaim(persistence, lease);
    } catch (error) {
      if (!caughtError) {
        caughtError = error;
      } else if (error instanceof Error && caughtError instanceof Error && caughtError.message !== error.message) {
        caughtError = new Error(
          `${caughtError.message}; release-failed:${error.message}`,
          { cause: error },
        );
      }
    }
  }

  if (activeResult) {
    return activeResult;
  }
  throw caughtError;
}

export function projectLegacyPlacementAddedBy(
  placement: McsPoolPlacement,
): McsKongaAddedBy | null {
  const candidate = placement as McsPoolPlacement & { addedBy?: McsKongaAddedBy };
  return candidate.addedBy ?? null;
}
