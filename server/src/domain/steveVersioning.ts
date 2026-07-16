import { randomUUID } from 'node:crypto';
import type {
  McsSteveDiscoveryAnswer,
  McsStevePrivacyState,
  McsSteveSuccessProfile,
  McsSteveTranscriptChunk,
} from '@momentum/shared';
import { MCS_STEVE_SPONSOR_CONSENT_FIELDS } from '@momentum/shared';
import { appendAuditEntry } from './auditLog.js';
import { assertChromaCollectionExists } from '../services/chromaCollections.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';

const MONGO_DB = 'momentum';
const DISCOVERIES_COLLECTION = 'tmag_steve_success_interview';
const VERSIONS_COLLECTION = 'tmag_steve_success_interview_versions';
const CHROMA_DISCOVERIES = 'mcs_steve_success_interview';

export const STEVE_VERSIONING_POLICY_VERSION = 'acr-0032.v1' as const;

export interface SteveRetakeSession {
  sessionId: string;
  status: 'in_progress';
  startedAt: string;
  baseProfileVersion: number;
  policyVersion: typeof STEVE_VERSIONING_POLICY_VERSION;
}

export interface VersionableSteveDiscovery {
  _id: string;
  tmagId: string;
  sponsorTmagId: string | null;
  callSid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  transcript: McsSteveTranscriptChunk[];
  answers: McsSteveDiscoveryAnswer[];
  successProfile: McsSteveSuccessProfile;
  audioUrl: string | null;
  privacy: McsStevePrivacyState;
  profileVersion?: number;
  correctionRevision?: number;
  lastCorrectedAt?: string | null;
  retakeSession?: SteveRetakeSession | null;
  eventBodyCompaction?: {
    eligible?: boolean;
    policyVersion?: string;
  };
}

interface ChromaGetResult {
  ids?: string[];
  metadatas?: Array<Record<string, unknown>>;
}

export class SteveVersioningError extends Error {
  constructor(
    public readonly code:
      | 'NO_PROFILE'
      | 'RETAKE_IN_PROGRESS'
      | 'WRITE_FAILED'
      | 'READBACK_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'SteveVersioningError';
  }
}

export function profileVersionOf(discovery: Pick<VersionableSteveDiscovery, 'profileVersion'>): number {
  return Number.isInteger(discovery.profileVersion) && (discovery.profileVersion ?? 0) > 0
    ? discovery.profileVersion!
    : 1;
}

export function correctionRevisionOf(
  discovery: Pick<VersionableSteveDiscovery, 'correctionRevision'>,
): number {
  return Number.isInteger(discovery.correctionRevision) &&
    (discovery.correctionRevision ?? -1) >= 0
    ? discovery.correctionRevision!
    : 0;
}

export function activeRetakeSession(
  discovery: Pick<VersionableSteveDiscovery, 'retakeSession'> | null,
): SteveRetakeSession | null {
  const value = discovery?.retakeSession;
  return value?.status === 'in_progress' && typeof value.sessionId === 'string'
    ? value
    : null;
}

export async function getVersionableSteveDiscovery(
  tmagId: string,
): Promise<VersionableSteveDiscovery | null> {
  const result = await persistenceCall<{ documents: VersionableSteveDiscovery[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: DISCOVERIES_COLLECTION,
      filter: { tmagId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

function versionIdFor(discovery: VersionableSteveDiscovery): string {
  return `${discovery._id}-v${profileVersionOf(discovery)}-r${correctionRevisionOf(discovery)}`;
}

async function verifyVersionProjection(args: {
  versionId: string;
  tmagId: string;
  profileVersion: number;
  correctionRevision: number;
}): Promise<void> {
  const [mongo, graph, chroma] = await Promise.all([
    persistenceCall<{ documents: Array<Record<string, unknown>> }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: VERSIONS_COLLECTION,
      filter: { _id: args.versionId, tmagId: args.tmagId },
      projection: { _id: 1, profileVersion: 1, correctionRevision: 1 },
      limit: 1,
    }),
    persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query:
        'MATCH (v:TmagSteveDiscoveryVersion {versionId: $versionId}) ' +
        'RETURN v.ownerTmagId AS ownerTmagId, v.profileVersion AS profileVersion, ' +
        'v.correctionRevision AS correctionRevision',
      params: { versionId: args.versionId },
    }),
    persistenceCall<ChromaGetResult>('chromadb', 'get', {
      collection: CHROMA_DISCOVERIES,
      ids: [args.versionId],
      include_documents: false,
    }),
  ]);

  const mongoRow = mongo.documents[0];
  const graphRow = graph.records?.[0];
  const chromaIndex = chroma.ids?.indexOf(args.versionId) ?? -1;
  const chromaRow = chromaIndex >= 0 ? chroma.metadatas?.[chromaIndex] : undefined;
  if (
    !mongoRow ||
    Number(mongoRow.profileVersion) !== args.profileVersion ||
    Number(mongoRow.correctionRevision) !== args.correctionRevision ||
    graphRow?.ownerTmagId !== args.tmagId ||
    Number(graphRow.profileVersion) !== args.profileVersion ||
    Number(graphRow.correctionRevision) !== args.correctionRevision ||
    chromaRow?.ownerTmagId !== args.tmagId ||
    Number(chromaRow.profileVersion) !== args.profileVersion ||
    Number(chromaRow.correctionRevision) !== args.correctionRevision
  ) {
    throw new SteveVersioningError(
      'READBACK_FAILED',
      'The Steve interview version did not read back from every store.',
    );
  }
}

/**
 * Preserve one confirmed interview revision before it is replaced.
 * Mongo owns the full private snapshot. Neo4j carries version lineage, while
 * Chroma carries a content-free, retrieval-ineligible version marker. This is
 * a triple-stack record without copying the unrestricted transcript into the
 * graph or vector store.
 */
export async function archiveSteveDiscoveryVersion(args: {
  discovery: VersionableSteveDiscovery;
  reason: 'correction' | 'retake';
  supersededAt: string;
}): Promise<{ versionId: string; alreadyArchived: boolean }> {
  const profileVersion = profileVersionOf(args.discovery);
  const correctionRevision = correctionRevisionOf(args.discovery);
  const versionId = versionIdFor(args.discovery);
  const existing = await persistenceCall<{ documents: Array<{ _id: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: VERSIONS_COLLECTION,
      filter: { _id: versionId },
      projection: { _id: 1 },
      limit: 1,
    },
  );
  const alreadyArchived = existing.documents.length === 1;
  const mongoDoc = {
    versionId,
    discoveryId: args.discovery._id,
    tmagId: args.discovery.tmagId,
    sponsorTmagId: args.discovery.sponsorTmagId,
    profileVersion,
    correctionRevision,
    status: 'superseded',
    supersededReason: args.reason,
    supersededAt: args.supersededAt,
    startedAt: args.discovery.startedAt,
    completedAt: args.discovery.completedAt,
    transcript: args.discovery.transcript,
    answers: args.discovery.answers,
    successProfile: args.discovery.successProfile,
    privacy: args.discovery.privacy,
    policyVersion: STEVE_VERSIONING_POLICY_VERSION,
  };
  const neo4j = {
    cypher:
      'MERGE (d:TmagSteveDiscovery {discoveryId: $discoveryId}) ' +
      'MERGE (v:TmagSteveDiscoveryVersion {versionId: $versionId}) ' +
      'SET v.ownerTmagId = $ownerTmagId, v.profileVersion = $profileVersion, ' +
      'v.correctionRevision = $correctionRevision, v.status = $status, ' +
      'v.supersededReason = $supersededReason, v.supersededAt = $supersededAt, ' +
      'v.completedAt = $completedAt, v.policyVersion = $policyVersion ' +
      'MERGE (d)-[:HAS_VERSION]->(v)',
    params: {
      discoveryId: args.discovery._id,
      versionId,
      ownerTmagId: args.discovery.tmagId,
      profileVersion,
      correctionRevision,
      status: 'superseded',
      supersededReason: args.reason,
      supersededAt: args.supersededAt,
      completedAt: args.discovery.completedAt,
      policyVersion: STEVE_VERSIONING_POLICY_VERSION,
    },
  };
  const chroma = {
    collection: CHROMA_DISCOVERIES,
    document:
      'Private Steve discovery version marker. Full interview content is canonical in MongoDB.',
    metadata: {
      kind: 'steve_discovery_version',
      versionId,
      discoveryId: args.discovery._id,
      ownerTmagId: args.discovery.tmagId,
      profileVersion,
      correctionRevision,
      status: 'superseded',
      supersededReason: args.reason,
      supersededAt: args.supersededAt,
      retrievalEligible: false,
      policyVersion: STEVE_VERSIONING_POLICY_VERSION,
    },
  };

  if (!alreadyArchived) {
    await tripleStackWrite({
      id: versionId,
      mongoCollection: VERSIONS_COLLECTION,
      mongoDoc,
      neo4j,
      chroma,
    });
  } else {
    // Idempotent repair path: the canonical Mongo snapshot already exists, so
    // re-project its content-free lineage without attempting a duplicate insert.
    await assertChromaCollectionExists(CHROMA_DISCOVERIES);
    await persistenceCall('neo4j', 'cypher', {
      query: neo4j.cypher,
      params: neo4j.params,
    });
    await persistenceCall('chromadb', 'add', {
      collection: chroma.collection,
      ids: [versionId],
      documents: [chroma.document],
      metadatas: [chroma.metadata],
    });
  }

  await verifyVersionProjection({
    versionId,
    tmagId: args.discovery.tmagId,
    profileVersion,
    correctionRevision,
  });
  return { versionId, alreadyArchived };
}

async function projectRetakeState(args: {
  discovery: VersionableSteveDiscovery;
  retakeSession: SteveRetakeSession | null;
}): Promise<void> {
  const profileVersion = profileVersionOf(args.discovery);
  const correctionRevision = correctionRevisionOf(args.discovery);
  const retakeStatus = args.retakeSession?.status ?? 'not_in_progress';
  const retakeSessionId = args.retakeSession?.sessionId ?? '';
  const retakeStartedAt = args.retakeSession?.startedAt ?? '';
  const consentedFieldCount = MCS_STEVE_SPONSOR_CONSENT_FIELDS.filter(
    (field) => args.discovery.privacy.sponsorConsent[field].granted,
  ).length;
  await assertChromaCollectionExists(CHROMA_DISCOVERIES);
  await persistenceCall('neo4j', 'cypher', {
    query:
      'MERGE (d:TmagSteveDiscovery {discoveryId: $discoveryId}) ' +
      'SET d.profileVersion = $profileVersion, d.retakeStatus = $retakeStatus, ' +
      'd.retakeSessionId = $retakeSessionId, d.retakeStartedAt = $retakeStartedAt, ' +
      'd.correctionRevision = $correctionRevision, d.privacyStatus = $privacyStatus, ' +
      'd.privacyPolicyVersion = $privacyPolicyVersion, ' +
      'd.consentedFieldCount = $consentedFieldCount',
    params: {
      discoveryId: args.discovery._id,
      profileVersion,
      correctionRevision,
      retakeStatus,
      retakeSessionId,
      retakeStartedAt,
      privacyStatus: args.discovery.privacy.status,
      privacyPolicyVersion: args.discovery.privacy.policyVersion,
      consentedFieldCount,
    },
  });
  await persistenceCall('chromadb', 'add', {
    collection: CHROMA_DISCOVERIES,
    ids: [args.discovery._id],
    documents: [
      'Private Steve discovery completion marker. Profile content is canonical in MongoDB.',
    ],
    metadatas: [
      {
        discoveryId: args.discovery._id,
        ownerTmagId: args.discovery.tmagId,
        completedAt: args.discovery.completedAt ?? '',
        kind: 'steve_discovery',
        retrievalEligible: false,
        privacyStatus: args.discovery.privacy.status,
        privacyPolicyVersion: args.discovery.privacy.policyVersion,
        consentedFieldCount,
        profileVersion,
        correctionRevision,
        retakeStatus,
        retakeSessionId,
        retakeStartedAt,
        versioningPolicyVersion: STEVE_VERSIONING_POLICY_VERSION,
        eventBodiesCompactionEligible:
          args.discovery.eventBodyCompaction?.eligible === true,
        eventBodyCompactionPolicyVersion:
          args.discovery.eventBodyCompaction?.policyVersion ?? '',
      },
    ],
  });

  const [graph, chroma] = await Promise.all([
    persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query:
        'MATCH (d:TmagSteveDiscovery {discoveryId: $discoveryId}) ' +
        'RETURN d.profileVersion AS profileVersion, d.retakeStatus AS retakeStatus, ' +
        'd.retakeSessionId AS retakeSessionId',
      params: { discoveryId: args.discovery._id },
    }),
    persistenceCall<ChromaGetResult>('chromadb', 'get', {
      collection: CHROMA_DISCOVERIES,
      ids: [args.discovery._id],
      include_documents: false,
    }),
  ]);
  const graphRow = graph.records?.[0];
  const chromaIndex = chroma.ids?.indexOf(args.discovery._id) ?? -1;
  const chromaRow = chromaIndex >= 0 ? chroma.metadatas?.[chromaIndex] : undefined;
  if (
    Number(graphRow?.profileVersion) !== profileVersion ||
    graphRow?.retakeStatus !== retakeStatus ||
    (graphRow?.retakeSessionId ?? '') !== retakeSessionId ||
    Number(chromaRow?.profileVersion) !== profileVersion ||
    chromaRow?.retakeStatus !== retakeStatus ||
    (chromaRow?.retakeSessionId ?? '') !== retakeSessionId
  ) {
    throw new SteveVersioningError(
      'READBACK_FAILED',
      'The Steve retake state did not read back from every store.',
    );
  }
}

export async function startSteveRetake(tmagId: string): Promise<{
  retakeSession: SteveRetakeSession;
  profileVersion: number;
  auditEntryId: string;
}> {
  const discovery = await getVersionableSteveDiscovery(tmagId);
  if (!discovery) {
    throw new SteveVersioningError('NO_PROFILE', 'No completed Steve profile.');
  }
  const existing = activeRetakeSession(discovery);
  if (existing) {
    return {
      retakeSession: existing,
      profileVersion: profileVersionOf(discovery),
      auditEntryId: '',
    };
  }

  const profileVersion = profileVersionOf(discovery);
  const retakeSession: SteveRetakeSession = {
    sessionId: `steve_retake_${randomUUID()}`,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    baseProfileVersion: profileVersion,
    policyVersion: STEVE_VERSIONING_POLICY_VERSION,
  };
  const update = await persistenceCall<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: DISCOVERIES_COLLECTION,
    filter: {
      _id: discovery._id,
      tmagId,
      $or: [
        { retakeSession: null },
        { retakeSession: { $exists: false } },
      ],
    },
    update: { $set: { profileVersion, retakeSession } },
  });
  if (update.matchedCount !== 1) {
    const raced = await getVersionableSteveDiscovery(tmagId);
    const racedSession = activeRetakeSession(raced);
    if (racedSession) {
      return { retakeSession: racedSession, profileVersion, auditEntryId: '' };
    }
    throw new SteveVersioningError('WRITE_FAILED', 'Steve retake did not start.');
  }

  try {
    await projectRetakeState({
      discovery: { ...discovery, profileVersion, retakeSession },
      retakeSession,
    });
    const readback = await getVersionableSteveDiscovery(tmagId);
    if (activeRetakeSession(readback)?.sessionId !== retakeSession.sessionId) {
      throw new SteveVersioningError('READBACK_FAILED', 'Steve retake did not read back.');
    }
    const audit = await appendAuditEntry({
      actor: { kind: 'ba', tmagId, displayName: tmagId },
      action: 'ba.steve_profile.retake_started',
      entity: {
        kind: 'brand_ambassador',
        id: tmagId,
        displayLabel: 'Steve Success Profile',
      },
      severity: 'info',
      before: { profileVersion, retakeStatus: 'not_started' },
      after: {
        profileVersion,
        retakeStatus: 'in_progress',
        policyVersion: STEVE_VERSIONING_POLICY_VERSION,
      },
    });
    return { retakeSession, profileVersion, auditEntryId: audit.entryId };
  } catch (error) {
    await persistenceCall('mongodb', 'update', {
      database: MONGO_DB,
      collection: DISCOVERIES_COLLECTION,
      filter: { _id: discovery._id, 'retakeSession.sessionId': retakeSession.sessionId },
      update: { $set: { retakeSession: null } },
    });
    try {
      await projectRetakeState({
        discovery: { ...discovery, profileVersion, retakeSession: null },
        retakeSession: null,
      });
    } catch {
      // Preserve the original failure. The consistency report can surface a
      // projection rollback failure without exposing private interview text.
    }
    if (error instanceof SteveVersioningError) throw error;
    throw new SteveVersioningError('WRITE_FAILED', 'Steve retake did not start.');
  }
}
