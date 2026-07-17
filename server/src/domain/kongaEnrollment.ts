import { createHash } from 'node:crypto';
import type {
  McsJoinEvent,
  McsKongaAddedBy,
  McsKongaPoolPlacement,
  McsProspectRecord,
} from '@momentum/shared';
import { MCS_KONGA_CONTRACT_VERSION } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { publishJoin } from '../services/poolEvents.js';
import type { BARecord } from './ba.js';
import { tripleStackWriteWithReadback, verifyKongaThreeLegs } from './kongaPersistence.js';

const ATTESTATION_COLLECTION = 'tmag_konga_enrollment_attestations';
const ATTESTATION_CHROMA = 'mcs_konga_enrollment_attestations';
const PLACEMENTS_COLLECTION = 'tmag_prospect_htank_placements';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const TOKENS_COLLECTION = 'tmag_prospect_invite_tokens';
const MEMBERS_COLLECTION = 'team_magnificent_members';

function sha(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

interface TokenDoc {
  token: string;
  prospectId: string;
  sponsorTmagId: string;
  state: string;
  createdAt: string;
}

interface EnrollmentAttestation {
  attestationId: string;
  prospectId: string;
  placementId: string;
  placementAttemptId: string;
  sponsorTmagId: string;
  enrolleeTmagId: string;
  actorTmagId: string;
  actorKind: 'sponsor' | 'admin_override';
  legPlacement: 'left' | 'right' | 'core3';
  offAppEnrollmentComplete: true;
  legPlacementComplete: true;
  joinedAt: string;
  reason: string | null;
  humanAttested: true;
  status: 'completed';
}

export class KongaEnrollmentError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

export interface AttestKongaEnrollmentInput {
  prospectId: string;
  sponsorTmagId: string;
  enrolleeTmagId: string;
  actorTmagId: string;
  actorKind: 'sponsor' | 'admin_override';
  legPlacement: 'left' | 'right' | 'core3';
  offAppEnrollmentComplete: boolean;
  legPlacementComplete: boolean;
  reason?: string;
  now?: Date;
}

function attestationVerify(id: string) {
  return {
    id,
    mongoCollection: ATTESTATION_COLLECTION,
    neo4jVerify: {
      cypher:
        'MATCH (a:TmagKongaEnrollmentAttestation {attestationId:$id}) ' +
        'MATCH (:TeamMagnificentMember)-[:ENROLLED {attestationId:$id}]->' +
        '(:TeamMagnificentMember) ' +
        'MATCH (:TmagProspect)-[r:IN_HOLDING_TANK {attestationId:$id}]->(:TmagPool) ' +
        'WHERE r.flushReason="enrolled" AND r.flushedAt IS NOT NULL ' +
        'RETURN count(DISTINCT a) AS n',
    },
    chromaCollection: ATTESTATION_CHROMA,
  };
}

async function mongoReadback(
  persistence: typeof persistenceCall,
  collection: string,
  filter: Record<string, unknown>,
  code: string,
): Promise<Record<string, unknown>> {
  const result = await persistence<{ documents?: Array<Record<string, unknown>> }>('mongodb', 'query', {
    database: 'momentum',
    collection,
    filter,
    limit: 1,
  });
  const doc = result.documents?.[0];
  if (!doc) throw new Error(code);
  return doc;
}

function joinEvent(
  prospect: McsProspectRecord,
  placement: McsKongaPoolPlacement,
  joinedAt: string,
): McsJoinEvent {
  const addedBy: McsKongaAddedBy | null =
    'addedBy' in placement && placement.addedBy ? placement.addedBy : null;
  return {
    contractVersion: MCS_KONGA_CONTRACT_VERSION,
    eventId: `konga_join_${sha(`${placement.placementId}|${joinedAt}`)}`,
    positionNumber: placement.positionNumber,
    firstName: prospect.firstName,
    lastInitial: prospect.lastInitial || prospect.lastName.trim().charAt(0).toUpperCase(),
    city: prospect.location.city,
    stateOrRegion: prospect.location.stateOrRegion,
    addedBy,
    joinedAt,
  };
}

/**
 * Human attestation boundary for a truthful public join. CRM dispositions and
 * registration records do not call this function and therefore cannot emit.
 */
export async function attestKongaEnrollment(
  input: AttestKongaEnrollmentInput,
  deps: {
    persistence?: typeof persistenceCall;
    strictWrite?: typeof tripleStackWriteWithReadback;
    strictVerify?: typeof verifyKongaThreeLegs;
    publish?: typeof publishJoin;
  } = {},
): Promise<{ attestationId: string; event: McsJoinEvent; alreadyAttested: boolean }> {
  if (!input.offAppEnrollmentComplete || !input.legPlacementComplete) {
    throw new KongaEnrollmentError('human_attestation_required');
  }
  if (input.actorKind === 'sponsor' && input.actorTmagId !== input.sponsorTmagId) {
    throw new KongaEnrollmentError('authenticated_sponsor_required');
  }
  if (input.actorKind === 'admin_override' && (input.reason?.trim().length ?? 0) < 8) {
    throw new KongaEnrollmentError('audited_override_reason_required');
  }

  const persistence = deps.persistence ?? persistenceCall;
  const existingByLink = await persistence<{ documents?: EnrollmentAttestation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: ATTESTATION_COLLECTION,
    filter: {
      prospectId: input.prospectId,
      sponsorTmagId: input.sponsorTmagId,
      enrolleeTmagId: input.enrolleeTmagId,
      status: 'completed',
    },
    sort: { joinedAt: -1 },
    limit: 1,
  });
  const existingAttestation = existingByLink.documents?.[0];
  if (existingAttestation) {
    const [priorProspect, priorPlacement] = await Promise.all([
      persistence<{ documents?: McsProspectRecord[] }>('mongodb', 'query', {
        database: 'momentum', collection: PROSPECTS_COLLECTION,
        filter: { prospectId: input.prospectId, sponsorTmagId: input.sponsorTmagId, state: 'enrolled' }, limit: 1,
      }),
      persistence<{ documents?: McsKongaPoolPlacement[] }>('mongodb', 'query', {
        database: 'momentum', collection: PLACEMENTS_COLLECTION,
        filter: { placementId: existingAttestation.placementId, flushReason: 'enrolled' }, limit: 1,
      }),
    ]);
    const savedProspect = priorProspect.documents?.[0];
    const savedPlacement = priorPlacement.documents?.[0];
    if (!savedProspect || !savedPlacement) throw new KongaEnrollmentError('exact_live_linkage_required');
    await (deps.strictVerify ?? verifyKongaThreeLegs)(
      attestationVerify(existingAttestation.attestationId), persistence,
    );
    return {
      attestationId: existingAttestation.attestationId,
      event: joinEvent(savedProspect, savedPlacement, existingAttestation.joinedAt),
      alreadyAttested: true,
    };
  }

  const [prospectResult, placementResult, tokenResult, enrolleeResult] = await Promise.all([
    persistence<{ documents?: McsProspectRecord[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: PROSPECTS_COLLECTION,
      filter: { prospectId: input.prospectId, sponsorTmagId: input.sponsorTmagId },
      limit: 1,
    }),
    persistence<{ documents?: McsKongaPoolPlacement[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: PLACEMENTS_COLLECTION,
      filter: { prospectId: input.prospectId, sponsorTmagId: input.sponsorTmagId, flushedAt: null },
      sort: { placedAt: -1 },
      limit: 1,
    }),
    persistence<{ documents?: TokenDoc[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: TOKENS_COLLECTION,
      filter: {
        prospectId: input.prospectId,
        sponsorTmagId: input.sponsorTmagId,
        state: 'video_complete',
      },
      sort: { createdAt: -1 },
      limit: 1,
    }),
    persistence<{ documents?: BARecord[] }>('mongodb', 'query', {
      database: 'momentum',
      collection: MEMBERS_COLLECTION,
      filter: { tmagId: input.enrolleeTmagId, sponsorTmagId: input.sponsorTmagId },
      limit: 1,
    }),
  ]);

  const prospect = prospectResult.documents?.[0];
  const placement = placementResult.documents?.[0];
  const token = tokenResult.documents?.[0];
  const enrollee = enrolleeResult.documents?.[0];
  if (!prospect || !placement || !token || !enrollee) {
    throw new KongaEnrollmentError('exact_live_linkage_required');
  }
  if (!placement.placementId || !placement.placementAttemptId) {
    throw new KongaEnrollmentError('legacy_placement_requires_no_backfill');
  }

  const attestationId = `konga_enrollment_${sha(
    `${placement.placementId}|${input.enrolleeTmagId}`,
  )}`;
  const prior = await persistence<{ documents?: EnrollmentAttestation[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: ATTESTATION_COLLECTION,
    filter: { _id: attestationId },
    limit: 1,
  });
  const joinedAt = prior.documents?.[0]?.joinedAt ?? (input.now ?? new Date()).toISOString();
  const attestation: EnrollmentAttestation = {
    attestationId,
    prospectId: input.prospectId,
    placementId: placement.placementId,
    placementAttemptId: placement.placementAttemptId,
    sponsorTmagId: input.sponsorTmagId,
    enrolleeTmagId: input.enrolleeTmagId,
    actorTmagId: input.actorTmagId,
    actorKind: input.actorKind,
    legPlacement: input.legPlacement,
    offAppEnrollmentComplete: true,
    legPlacementComplete: true,
    joinedAt,
    reason: input.reason?.trim() || null,
    humanAttested: true,
    status: 'completed',
  };

  if (!prior.documents?.[0]) {
    await (deps.strictWrite ?? tripleStackWriteWithReadback)(
      {
        id: attestationId,
        mongoCollection: ATTESTATION_COLLECTION,
        mongoDoc: { ...attestation },
        neo4j: {
          cypher:
            'MATCH (s:TeamMagnificentMember {tmagId:$sponsorTmagId}) ' +
            'MATCH (e:TeamMagnificentMember {tmagId:$enrolleeTmagId, sponsorTmagId:$sponsorTmagId}) ' +
            'MATCH (p:TmagProspect {prospectId:$prospectId})-' +
            '[r:IN_HOLDING_TANK {placementId:$placementId}]->(:TmagPool) ' +
            'MATCH (t:TmagInviteToken {token:$token})-[:FOR_PROSPECT]->(p) ' +
            'MERGE (a:TmagKongaEnrollmentAttestation {attestationId:$id}) ' +
            'SET a += $props ' +
            'MERGE (s)-[en:ENROLLED {attestationId:$id}]->(e) ' +
            'SET en += $enrollmentProps ' +
            'SET r.flushedAt=$joinedAt, r.flushReason="enrolled", r.attestationId=$id, ' +
            'p.state="enrolled", t.state="enrolled"',
          params: {
            sponsorTmagId: input.sponsorTmagId,
            enrolleeTmagId: input.enrolleeTmagId,
            prospectId: input.prospectId,
            placementId: placement.placementId,
            token: token.token,
            joinedAt,
            props: attestation,
            enrollmentProps: {
              prospectId: input.prospectId,
              placementId: placement.placementId,
              legPlacement: input.legPlacement,
              joinedAt,
              humanAttested: true,
              actorKind: input.actorKind,
            },
          },
        },
        chroma: {
          collection: ATTESTATION_CHROMA,
          document:
            `Human-attested off-app enrollment and leg placement completed at ${joinedAt}.`,
          metadata: {
            kind: 'konga_enrollment_attestation',
            attestationId,
            prospectId: input.prospectId,
            placementId: placement.placementId,
            sponsorTmagId: input.sponsorTmagId,
            enrolleeTmagId: input.enrolleeTmagId,
            actorKind: input.actorKind,
            joinedAt,
            humanAttested: true,
          },
        },
        neo4jVerify: attestationVerify(attestationId).neo4jVerify,
      },
      persistence,
    );
  } else {
    await (deps.strictVerify ?? verifyKongaThreeLegs)(
      attestationVerify(attestationId),
      persistence,
    );
  }

  await Promise.all([
    persistence('mongodb', 'update', {
      database: 'momentum',
      collection: PLACEMENTS_COLLECTION,
      filter: { placementId: placement.placementId, flushedAt: null },
      update: { $set: { flushedAt: joinedAt, flushReason: 'enrolled', attestationId } },
    }),
    persistence('mongodb', 'update', {
      database: 'momentum',
      collection: PROSPECTS_COLLECTION,
      filter: { prospectId: input.prospectId, sponsorTmagId: input.sponsorTmagId },
      update: { $set: { state: 'enrolled', updatedAt: joinedAt } },
    }),
    persistence('mongodb', 'update', {
      database: 'momentum',
      collection: TOKENS_COLLECTION,
      filter: { token: token.token, prospectId: input.prospectId },
      update: { $set: { state: 'enrolled', updatedAt: joinedAt } },
    }),
  ]);

  await Promise.all([
    mongoReadback(
      persistence,
      PLACEMENTS_COLLECTION,
      { placementId: placement.placementId, flushedAt: joinedAt, flushReason: 'enrolled', attestationId },
      'konga_enrolled_placement_readback_missing',
    ),
    mongoReadback(
      persistence,
      PROSPECTS_COLLECTION,
      { prospectId: input.prospectId, sponsorTmagId: input.sponsorTmagId, state: 'enrolled' },
      'konga_enrolled_prospect_readback_missing',
    ),
    mongoReadback(
      persistence,
      TOKENS_COLLECTION,
      { token: token.token, prospectId: input.prospectId, state: 'enrolled' },
      'konga_enrolled_token_readback_missing',
    ),
    (deps.strictVerify ?? verifyKongaThreeLegs)(attestationVerify(attestationId), persistence),
  ]);

  const event = joinEvent(prospect, placement, joinedAt);
  if (!prior.documents?.[0]) (deps.publish ?? publishJoin)(event);
  return { attestationId, event, alreadyAttested: Boolean(prior.documents?.[0]) };
}
