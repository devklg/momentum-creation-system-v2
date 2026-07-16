import type {
  McsRecruitingCycleRecord,
  McsSteveCorrectionPayload,
  McsSteveCorrectionTarget,
  McsSteveDiscoveryAnswer,
  McsSteveDiscoveryArtifact,
  McsStevePrivacyState,
  McsSteveSuccessProfile,
  McsSteveTranscriptChunk,
} from '@momentum/shared';
import {
  MCS_STEVE_PRIVACY_POLICY_VERSION,
  MCS_STEVE_SPONSOR_CONSENT_FIELDS,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { appendAuditEntry } from './auditLog.js';
import { normalizeStevePrivacyState } from './stevePrivacy.js';
import {
  activeRetakeSession,
  archiveSteveDiscoveryVersion,
  profileVersionOf,
  STEVE_VERSIONING_POLICY_VERSION,
  type SteveRetakeSession,
  type VersionableSteveDiscovery,
} from './steveVersioning.js';

const MONGO_DB = 'momentum';
const DISCOVERIES_COLLECTION = 'tmag_steve_success_interview';
const DISCOVERIES_CHROMA = 'mcs_steve_success_interview';
const RECRUITING_CYCLES_COLLECTION = 'tmag_recruiting_cycles';
const RECRUITING_CYCLES_CHROMA = 'mcs_recruiting_cycles';
const MAX_TEXT_LENGTH = 4_000;
const MAX_LIST_ITEMS = 20;
const MAX_LIST_ITEM_LENGTH = 200;

const LEARNING_MODALITIES = new Set([
  'watching',
  'doing',
  'step_by_step',
  'reading',
  'discussing',
  'mixed',
]);
const CONTACT_CHANNELS = new Set([
  'text',
  'call',
  'email',
  'in_app',
  'video',
  'in_person',
]);
const CONTACT_CADENCES = new Set([
  'daily',
  'few_times_week',
  'weekly',
  'as_needed',
]);

interface PersistedCorrectionDiscovery extends McsSteveDiscoveryArtifact {
  _id: string;
  privacy?: unknown;
  correctionRevision?: number;
  profileVersion?: number;
  lastCorrectedAt?: string | null;
  retakeSession?: SteveRetakeSession | null;
  eventBodyCompaction?: {
    eligible?: boolean;
    policyVersion?: string;
  };
}

interface ChromaGetResult {
  ids?: string[];
  documents?: Array<string | null>;
  metadatas?: Array<Record<string, unknown> | null>;
}

export class SteveCorrectionError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SteveCorrectionError';
  }
}

function revisionOf(discovery: PersistedCorrectionDiscovery): number {
  return Number.isInteger(discovery.correctionRevision) &&
    (discovery.correctionRevision ?? -1) >= 0
    ? discovery.correctionRevision!
    : 0;
}

function artifactForSelf(
  discovery: PersistedCorrectionDiscovery,
): McsSteveDiscoveryArtifact {
  return {
    tmagId: discovery.tmagId,
    sponsorTmagId: discovery.sponsorTmagId,
    callSid: null,
    startedAt: discovery.startedAt,
    completedAt: discovery.completedAt,
    transcript: discovery.transcript,
    answers: discovery.answers,
    successProfile: discovery.successProfile,
    audioUrl: null,
    correctionRevision: revisionOf(discovery),
    lastCorrectedAt: discovery.lastCorrectedAt ?? null,
    profileVersion: profileVersionOf(discovery),
  };
}

async function getDiscovery(
  tmagId: string,
): Promise<PersistedCorrectionDiscovery> {
  const result = await persistenceCall<{
    documents: PersistedCorrectionDiscovery[];
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: DISCOVERIES_COLLECTION,
    filter: { tmagId },
    limit: 1,
  });
  const discovery = result.documents[0];
  if (!discovery) {
    throw new SteveCorrectionError('NO_PROFILE', 'No completed Steve profile.');
  }
  return discovery;
}

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') {
    throw new SteveCorrectionError(
      'INVALID_REPLACEMENT',
      'The replacement must be text.',
    );
  }
  const normalized = value.trim();
  if (normalized.length > MAX_TEXT_LENGTH) {
    throw new SteveCorrectionError(
      'INVALID_REPLACEMENT',
      'The replacement is too long.',
    );
  }
  return normalized;
}

function normalizeList(
  value: unknown,
  allowed?: ReadonlySet<string>,
): string[] {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw new SteveCorrectionError(
      'INVALID_REPLACEMENT',
      'The replacement must be a bounded list.',
    );
  }
  const normalized = [
    ...new Set(
      value.map((item) => {
        if (typeof item !== 'string') {
          throw new SteveCorrectionError(
            'INVALID_REPLACEMENT',
            'Every replacement list item must be text.',
          );
        }
        const text = item.trim();
        if (!text || text.length > MAX_LIST_ITEM_LENGTH) {
          throw new SteveCorrectionError(
            'INVALID_REPLACEMENT',
            'A replacement list item is invalid.',
          );
        }
        if (allowed && !allowed.has(text)) {
          throw new SteveCorrectionError(
            'INVALID_REPLACEMENT',
            'A replacement list item is not allowed.',
          );
        }
        return text;
      }),
    ),
  ];
  return normalized;
}

function changedFieldPath(target: McsSteveCorrectionTarget): string {
  switch (target.kind) {
    case 'transcript_text':
      return `transcript[sequence=${target.sequence}].text`;
    case 'answer_text':
      return `answers[questionId=${target.questionId}].answerText`;
    case 'profile_text':
    case 'profile_list':
      return `successProfile.${target.path}`;
    case 'recommendation_text':
      return `successProfile.${target.list}Recommendations[${target.index}].text`;
  }
}

function setProfileText(
  profile: McsSteveSuccessProfile,
  path: Extract<McsSteveCorrectionTarget, { kind: 'profile_text' }>['path'],
  replacement: string,
): void {
  switch (path) {
    case 'primaryWhy.statement':
      profile.primaryWhy.statement = replacement;
      return;
    case 'primaryWhy.who':
      profile.primaryWhy.who = replacement;
      return;
    case 'primaryWhy.whyNow':
      profile.primaryWhy.whyNow = replacement;
      return;
    case 'successVision.statement':
      profile.successVision.statement = replacement;
      return;
    case 'successVision.oneBigChange':
      profile.successVision.oneBigChange = replacement;
      return;
    case 'learningStyle.feedbackPreference':
      profile.learningStyle.feedbackPreference = replacement;
      return;
    case 'learningStyle.notes':
      profile.learningStyle.notes = replacement;
      return;
    case 'communicationPreferences.bestTimes':
      profile.communicationPreferences.bestTimes = replacement;
      return;
    case 'communicationPreferences.cadence':
      if (replacement && !CONTACT_CADENCES.has(replacement)) {
        throw new SteveCorrectionError(
          'INVALID_REPLACEMENT',
          'The replacement contact cadence is not allowed.',
        );
      }
      profile.communicationPreferences.cadence =
        replacement === ''
          ? null
          : (replacement as McsSteveSuccessProfile['communicationPreferences']['cadence']);
      return;
    case 'communicationPreferences.notes':
      profile.communicationPreferences.notes = replacement;
      return;
    case 'supportNeeds.helpStyle':
      profile.supportNeeds.helpStyle = replacement;
      return;
    case 'supportNeeds.notes':
      profile.supportNeeds.notes = replacement;
      return;
    case 'michaelHandoffSummary':
      profile.michaelHandoffSummary = replacement;
      return;
  }
}

function setProfileList(
  profile: McsSteveSuccessProfile,
  target: Extract<McsSteveCorrectionTarget, { kind: 'profile_list' }>,
  replacement: unknown,
): void {
  switch (target.path) {
    case 'learningStyle.modalities':
      profile.learningStyle.modalities = normalizeList(
        replacement,
        LEARNING_MODALITIES,
      ) as McsSteveSuccessProfile['learningStyle']['modalities'];
      return;
    case 'communicationPreferences.preferredChannels':
      profile.communicationPreferences.preferredChannels = normalizeList(
        replacement,
        CONTACT_CHANNELS,
      ) as McsSteveSuccessProfile['communicationPreferences']['preferredChannels'];
      return;
    case 'supportNeeds.areas':
      profile.supportNeeds.areas = normalizeList(replacement);
      return;
    case 'supportNeeds.potentialObstacles':
      profile.supportNeeds.potentialObstacles = normalizeList(replacement);
      return;
  }
}

function correctedPrivateFields(
  discovery: PersistedCorrectionDiscovery,
  payload: McsSteveCorrectionPayload,
): {
  transcript: McsSteveTranscriptChunk[];
  answers: McsSteveDiscoveryAnswer[];
  successProfile: McsSteveSuccessProfile;
  changedFieldPaths: string[];
  whyChanged: boolean;
} {
  const transcript = structuredClone(discovery.transcript);
  const answers = structuredClone(discovery.answers);
  const successProfile = structuredClone(discovery.successProfile);
  const target = payload.target;

  switch (target.kind) {
    case 'transcript_text': {
      const matches = transcript.filter((turn) => turn.sequence === target.sequence);
      if (matches.length !== 1) {
        throw new SteveCorrectionError(
          'INVALID_TARGET',
          'The selected transcript turn is unavailable.',
        );
      }
      matches[0]!.text = normalizeText(payload.replacement);
      break;
    }
    case 'answer_text': {
      const matches = answers.filter((answer) => answer.questionId === target.questionId);
      if (matches.length !== 1) {
        throw new SteveCorrectionError(
          'INVALID_TARGET',
          'The selected answer is unavailable.',
        );
      }
      matches[0]!.answerText = normalizeText(payload.replacement);
      break;
    }
    case 'profile_text':
      setProfileText(successProfile, target.path, normalizeText(payload.replacement));
      break;
    case 'profile_list':
      setProfileList(successProfile, target, payload.replacement);
      break;
    case 'recommendation_text': {
      const recommendations =
        target.list === 'launch'
          ? successProfile.launchRecommendations
          : successProfile.trainingRecommendations;
      const recommendation = recommendations[target.index];
      if (!recommendation) {
        throw new SteveCorrectionError(
          'INVALID_TARGET',
          'The selected recommendation is unavailable.',
        );
      }
      recommendation.text = normalizeText(payload.replacement);
      break;
    }
  }

  return {
    transcript,
    answers,
    successProfile,
    changedFieldPaths: [changedFieldPath(target)],
    whyChanged:
      target.kind === 'profile_text' && target.path === 'primaryWhy.statement',
  };
}

function mongoRevisionFilter(expectedRevision: number): Record<string, unknown> {
  return expectedRevision === 0
    ? {
        $or: [
          { correctionRevision: 0 },
          { correctionRevision: { $exists: false } },
        ],
      }
    : { correctionRevision: expectedRevision };
}

async function writeArtifactProjection(args: {
  discovery: PersistedCorrectionDiscovery;
  revision: number;
  correctedAt: string | null;
}): Promise<void> {
  const privacy: McsStevePrivacyState = normalizeStevePrivacyState(
    args.discovery.privacy,
  );
  const consentedFieldCount = MCS_STEVE_SPONSOR_CONSENT_FIELDS.filter(
    (field) => privacy.sponsorConsent[field].granted,
  ).length;
  const profileVersion = profileVersionOf(args.discovery);

  await persistenceCall('neo4j', 'cypher', {
    query:
      'MATCH (d:TmagSteveDiscovery {discoveryId: $discoveryId}) ' +
      'SET d.correctionRevision = $correctionRevision, ' +
      'd.profileVersion = $profileVersion, ' +
      'd.lastCorrectedAt = $lastCorrectedAt, ' +
      'd.privacyStatus = $privacyStatus, ' +
      'd.privacyPolicyVersion = $privacyPolicyVersion, ' +
      'd.consentedFieldCount = $consentedFieldCount',
    params: {
      discoveryId: args.discovery._id,
      correctionRevision: args.revision,
      profileVersion,
      lastCorrectedAt: args.correctedAt,
      privacyStatus: privacy.status,
      privacyPolicyVersion: privacy.policyVersion,
      consentedFieldCount,
    },
  });
  await persistenceCall('chromadb', 'add', {
    collection: DISCOVERIES_CHROMA,
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
        privacyStatus: privacy.status,
        privacyPolicyVersion: privacy.policyVersion,
        consentedFieldCount,
        correctionRevision: args.revision,
        profileVersion,
        lastCorrectedAt: args.correctedAt ?? '',
        eventBodiesCompactionEligible:
          args.discovery.eventBodyCompaction?.eligible === true,
        eventBodyCompactionPolicyVersion:
          args.discovery.eventBodyCompaction?.policyVersion ??
          MCS_STEVE_PRIVACY_POLICY_VERSION,
        versioningPolicyVersion: STEVE_VERSIONING_POLICY_VERSION,
      },
    ],
  });

  const [graphReadback, chromaReadback] = await Promise.all([
    persistenceCall<{ records?: Array<Record<string, unknown>> }>(
      'neo4j',
      'cypher',
      {
        query:
          'MATCH (d:TmagSteveDiscovery {discoveryId: $discoveryId}) ' +
          'RETURN d.correctionRevision AS correctionRevision, ' +
          'd.lastCorrectedAt AS lastCorrectedAt, ' +
          'd.profileVersion AS profileVersion',
        params: { discoveryId: args.discovery._id },
      },
    ),
    persistenceCall<ChromaGetResult>('chromadb', 'get', {
      collection: DISCOVERIES_CHROMA,
      ids: [args.discovery._id],
      include_documents: true,
    }),
  ]);

  const graph = graphReadback.records?.[0];
  const chromaIndex = chromaReadback.ids?.indexOf(args.discovery._id) ?? -1;
  const chromaMetadata =
    chromaIndex >= 0 ? chromaReadback.metadatas?.[chromaIndex] : undefined;
  if (
    Number(graph?.correctionRevision) !== args.revision ||
    Number(graph?.profileVersion) !== profileVersion ||
    (graph?.lastCorrectedAt ?? null) !== args.correctedAt ||
    Number(chromaMetadata?.correctionRevision) !== args.revision ||
    Number(chromaMetadata?.profileVersion) !== profileVersion ||
    (chromaMetadata?.lastCorrectedAt || null) !== args.correctedAt
  ) {
    throw new SteveCorrectionError(
      'PROJECTION_FAILED',
      'Steve correction projection did not read back.',
    );
  }
}

async function writeWhyProjection(args: {
  tmagId: string;
  why: string;
  privacyStatus: McsStevePrivacyState['status'];
  correctedAt: string | null;
}): Promise<boolean> {
  const cycleResult = await persistenceCall<{
    documents: McsRecruitingCycleRecord[];
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: RECRUITING_CYCLES_COLLECTION,
    filter: { tmagId: args.tmagId },
    projection: { tmagId: 1, enrolledAt: 1 },
    limit: 1,
  });
  const cycle = cycleResult.documents[0];
  if (!cycle) return false;

  const id = `rc_${args.tmagId}`;
  const why = args.why.slice(0, 1_000);
  const document = why
    ? `Recruiting cycle for BA ${args.tmagId}. Why: ${why}`
    : `Recruiting cycle for BA ${args.tmagId}. Why not yet captured.`;
  await persistenceCall('chromadb', 'add', {
    collection: RECRUITING_CYCLES_CHROMA,
    ids: [id],
    documents: [document],
    metadatas: [
      {
        kind: 'recruiting_cycle_created',
        cycleId: id,
        tmagId: args.tmagId,
        enrolledAt: cycle.enrolledAt,
        whyStatement: why.slice(0, 500),
        retrievalEligible: args.privacyStatus === 'active',
        privacyStatus: args.privacyStatus,
        correctedAt: args.correctedAt ?? '',
      },
    ],
  });
  const readback = await persistenceCall<ChromaGetResult>('chromadb', 'get', {
    collection: RECRUITING_CYCLES_CHROMA,
    ids: [id],
    include_documents: true,
  });
  const index = readback.ids?.indexOf(id) ?? -1;
  if (index < 0 || readback.documents?.[index] !== document) {
    throw new SteveCorrectionError(
      'PROJECTION_FAILED',
      'Steve why correction did not read back.',
    );
  }
  return true;
}

async function rollbackCorrection(args: {
  previous: PersistedCorrectionDiscovery;
  expectedCurrentRevision: number;
  restoreWhy: boolean;
}): Promise<void> {
  const previousRevision = revisionOf(args.previous);
  const update = await persistenceCall<{ matchedCount?: number }>(
    'mongodb',
    'update',
    {
      database: MONGO_DB,
      collection: DISCOVERIES_COLLECTION,
      filter: {
        _id: args.previous._id,
        tmagId: args.previous.tmagId,
        correctionRevision: args.expectedCurrentRevision,
      },
      update: {
        $set: {
          transcript: args.previous.transcript,
          answers: args.previous.answers,
          successProfile: args.previous.successProfile,
          correctionRevision: previousRevision,
          lastCorrectedAt: args.previous.lastCorrectedAt ?? null,
        },
      },
    },
  );
  if (update.matchedCount !== 1) {
    throw new SteveCorrectionError(
      'ROLLBACK_FAILED',
      'Steve correction rollback did not match the canonical record.',
    );
  }

  const restored = {
    ...args.previous,
    correctionRevision: previousRevision,
    lastCorrectedAt: args.previous.lastCorrectedAt ?? null,
  };
  await writeArtifactProjection({
    discovery: restored,
    revision: previousRevision,
    correctedAt: restored.lastCorrectedAt,
  });
  if (args.restoreWhy) {
    await writeWhyProjection({
      tmagId: restored.tmagId,
      why: restored.successProfile.primaryWhy.statement,
      privacyStatus: normalizeStevePrivacyState(restored.privacy).status,
      correctedAt: restored.lastCorrectedAt,
    });
  }

  const readback = await getDiscovery(restored.tmagId);
  if (
    revisionOf(readback) !== previousRevision ||
    JSON.stringify(readback.transcript) !== JSON.stringify(restored.transcript) ||
    JSON.stringify(readback.answers) !== JSON.stringify(restored.answers) ||
    JSON.stringify(readback.successProfile) !==
      JSON.stringify(restored.successProfile)
  ) {
    throw new SteveCorrectionError(
      'ROLLBACK_FAILED',
      'Steve correction rollback did not read back.',
    );
  }
}

export async function correctStevePrivateRecord(args: {
  tmagId: string;
  payload: McsSteveCorrectionPayload;
}): Promise<{
  artifact: McsSteveDiscoveryArtifact;
  correctionRevision: number;
  correctedAt: string;
  changedFieldPaths: string[];
  auditEntryId: string;
}> {
  const previous = await getDiscovery(args.tmagId);
  const previousRevision = revisionOf(previous);
  if (activeRetakeSession(previous)) {
    throw new SteveCorrectionError(
      'RETAKE_IN_PROGRESS',
      'Finish the active Steve retake before editing the current profile.',
    );
  }
  if (args.payload.expectedRevision !== previousRevision) {
    throw new SteveCorrectionError(
      'STALE_REVISION',
      'The Steve correction view is stale.',
    );
  }

  const corrected = correctedPrivateFields(previous, args.payload);
  if (
    JSON.stringify(corrected.transcript) === JSON.stringify(previous.transcript) &&
    JSON.stringify(corrected.answers) === JSON.stringify(previous.answers) &&
    JSON.stringify(corrected.successProfile) ===
      JSON.stringify(previous.successProfile)
  ) {
    throw new SteveCorrectionError(
      'INVALID_REPLACEMENT',
      'The replacement matches the current private value.',
    );
  }
  const correctedAt = new Date().toISOString();
  const nextRevision = previousRevision + 1;
  try {
    await archiveSteveDiscoveryVersion({
      discovery: {
        ...previous,
        privacy: normalizeStevePrivacyState(previous.privacy),
      } as VersionableSteveDiscovery,
      reason: 'correction',
      supersededAt: correctedAt,
    });
  } catch {
    throw new SteveCorrectionError(
      'ARCHIVE_FAILED',
      'The current Steve profile could not be preserved before correction.',
    );
  }
  const update = await persistenceCall<{ matchedCount?: number }>(
    'mongodb',
    'update',
    {
      database: MONGO_DB,
      collection: DISCOVERIES_COLLECTION,
      filter: {
        _id: previous._id,
        tmagId: previous.tmagId,
        ...mongoRevisionFilter(previousRevision),
      },
      update: {
        $set: {
          transcript: corrected.transcript,
          answers: corrected.answers,
          successProfile: corrected.successProfile,
          correctionRevision: nextRevision,
          lastCorrectedAt: correctedAt,
        },
      },
    },
  );
  if (update.matchedCount !== 1) {
    throw new SteveCorrectionError(
      'STALE_REVISION',
      'The Steve correction view changed before confirmation.',
    );
  }

  const next: PersistedCorrectionDiscovery = {
    ...previous,
    transcript: corrected.transcript,
    answers: corrected.answers,
    successProfile: corrected.successProfile,
    correctionRevision: nextRevision,
    lastCorrectedAt: correctedAt,
  };

  try {
    await writeArtifactProjection({
      discovery: next,
      revision: nextRevision,
      correctedAt,
    });
    if (corrected.whyChanged) {
      await writeWhyProjection({
        tmagId: next.tmagId,
        why: next.successProfile.primaryWhy.statement,
        privacyStatus: normalizeStevePrivacyState(next.privacy).status,
        correctedAt,
      });
    }

    const readback = await getDiscovery(next.tmagId);
    if (
      revisionOf(readback) !== nextRevision ||
      readback.lastCorrectedAt !== correctedAt ||
      JSON.stringify(readback.transcript) !== JSON.stringify(next.transcript) ||
      JSON.stringify(readback.answers) !== JSON.stringify(next.answers) ||
      JSON.stringify(readback.successProfile) !== JSON.stringify(next.successProfile)
    ) {
      throw new SteveCorrectionError(
        'READBACK_FAILED',
        'Steve correction did not read back.',
      );
    }

    const audit = await appendAuditEntry({
      actor: {
        kind: 'ba',
        tmagId: args.tmagId,
        displayName: args.tmagId,
      },
      action: 'ba.steve_profile.corrected',
      entity: {
        kind: 'brand_ambassador',
        id: args.tmagId,
        displayLabel: 'Steve private record',
      },
      severity: 'info',
      before: {
        artifactId: previous._id,
        policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
        correctionRevision: previousRevision,
        profileVersion: profileVersionOf(previous),
      },
      after: {
        artifactId: previous._id,
        policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
        correctionRevision: nextRevision,
        profileVersion: profileVersionOf(previous),
        versioningPolicyVersion: STEVE_VERSIONING_POLICY_VERSION,
        changedFieldPaths: corrected.changedFieldPaths,
      },
    });

    return {
      artifact: artifactForSelf(readback),
      correctionRevision: nextRevision,
      correctedAt,
      changedFieldPaths: corrected.changedFieldPaths,
      auditEntryId: audit.entryId,
    };
  } catch (error) {
    try {
      await rollbackCorrection({
        previous,
        expectedCurrentRevision: nextRevision,
        restoreWhy: corrected.whyChanged,
      });
    } catch {
      // The caller-visible failure remains content-free. Store consistency
      // tooling can surface any rollback failure without retaining either
      // private value in logs or audit snapshots.
    }
    if (error instanceof SteveCorrectionError) throw error;
    throw new SteveCorrectionError(
      'CORRECTION_FAILED',
      'Steve correction did not complete.',
    );
  }
}
