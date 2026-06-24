/**
 * wf_0008 — Michael Training Agent + Daily Success Coach artifact consumer.
 *
 * Receives:
 *   - Live transcript chunks during the call (one row per chunk in
 *     `michael_transcripts`, fan-out via michaelEvents).
 *   - Final coaching artifact after the call (one row per BA in
 *     `michael_interviews`, triple-stacked, sponsor-stamped server-side).
 *
 * Produces:
 *   - The BA's own interview view (self-read at /api/michael/interview/state).
 *   - The upline cockpit card (sponsor-only read at
 *     /api/michael/interview/cockpit/:downlineBaId).
 *
 * Compliance posture (locked-spec 3.10):
 *   - No income claims, no placement promises, no comp-plan figures rendered
 *     by this module. Worker tags are descriptive support notes, never
 *     rankings, score bands, dollar amounts, or rank language. The transcript
 *     is captured as spoken — the script-time enforcement guarantees Michael
 *     never offers those claims, so the transcript is clean by construction.
 *
 * Sponsor immutability (locked-spec 3.5):
 *   - sponsorBaId on the persisted artifact is read from brand_ambassadors
 *     for the subject BA. The ingest payload's caller cannot influence it.
 */

import type {
  MichaelCategoryScores,
  MichaelClassification,
  MichaelCockpitCardClassified,
  MichaelInterviewArtifact,
  MichaelInterviewPhase,
  MichaelInterviewView,
  MichaelScoringIngestPayload,
  MichaelSuccessProfile,
  MichaelTranscriptChunk,
} from '@momentum/shared';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import { publishChunk, publishPhase } from '../services/michaelEvents.js';
import {
  getMichaelSchedule,
  type MichaelSchedule,
} from './michael-schedule.js';

const INTERVIEWS_COLLECTION = 'michael_interviews';
const TRANSCRIPTS_COLLECTION = 'michael_transcripts';
const CHROMA_INTERVIEWS = 'mcs_michael_interviews';

/** Lazy, idempotent bootstrap of the interviews Chroma collection (TASK-147
 *  hard rule: ensure the mcs_ collection exists before add()). Existence-first:
 *  the gateway's HTTP path reports a duplicate create as a generic 500, so we
 *  check via list_collections rather than matching an error string. */
let interviewsCollectionBootstrap: Promise<void> | null = null;
async function ensureInterviewsCollection(): Promise<void> {
  if (interviewsCollectionBootstrap) return interviewsCollectionBootstrap;
  interviewsCollectionBootstrap = (async () => {
    const existing = await gatewayCall<{ collections?: Array<{ name: string }> }>(
      'chromadb', 'list_collections', {},
    );
    const present = (existing?.collections ?? []).some((c) => c.name === CHROMA_INTERVIEWS);
    if (present) return;
    await gatewayCall('chromadb', 'create_collection', {
      name: CHROMA_INTERVIEWS,
      metadata: { branch: 'feat/mcs-michael', wireframe_leaf: '3.2', purpose: 'Michael interviews' },
    });
  })();
  return interviewsCollectionBootstrap;
}

/** A transcript chunk as persisted. Mirrors MichaelTranscriptChunk plus the
 *  call/BA binding. _id = `${callSid}:${sequence}` so re-delivery is idempotent. */
interface PersistedTranscriptChunk extends MichaelTranscriptChunk {
  _id: string;
  callSid: string;
  baId: string;
}

interface PersistedInterview extends MichaelInterviewArtifact {
  _id: string;
  /** Legacy nullable fields retained for backward-compatible reads only.
   *  Current architecture: Steve discovers context without scoring; Michael
   *  uses that Success Profile as Training Agent + Daily Success Coach. New Michael ingests
   *  always persist these as null and never classify a BA. */
  classification?: MichaelClassification | null;
  successProfile?: MichaelSuccessProfile | null;
}

// ──────────────────────────────────────────────────────────────────────────
// Reads
// ──────────────────────────────────────────────────────────────────────────

async function getBaSponsor(baId: string): Promise<{
  sponsorBaId: string | null;
  firstName: string;
} | null> {
  const result = await gatewayCall<{
    documents: { baId: string; sponsorBaId?: string | null; firstName?: string }[];
  }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'brand_ambassadors',
    filter: { baId },
    limit: 1,
  });
  const doc = result.documents[0];
  if (!doc) return null;
  return {
    sponsorBaId: doc.sponsorBaId ?? null,
    firstName: doc.firstName ?? '',
  };
}

async function getInterviewByBaId(baId: string): Promise<PersistedInterview | null> {
  const result = await gatewayCall<{ documents: PersistedInterview[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: INTERVIEWS_COLLECTION,
      filter: { baId },
      limit: 1,
    },
  );
  return result.documents[0] ?? null;
}

/** Fetch all persisted chunks for a call, ordered by sequence. */
export async function getTranscriptChunks(
  callSid: string,
): Promise<MichaelTranscriptChunk[]> {
  const result = await gatewayCall<{ documents: PersistedTranscriptChunk[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: TRANSCRIPTS_COLLECTION,
      filter: { callSid },
      sort: { sequence: 1 },
      limit: 5000,
    },
  );
  return result.documents.map(stripPersistedChunkFields);
}

function stripPersistedChunkFields(doc: PersistedTranscriptChunk): MichaelTranscriptChunk {
  return {
    sequence: doc.sequence,
    speaker: doc.speaker,
    text: doc.text,
    occurredAt: doc.occurredAt,
  };
}

/** Compute the UI phase from the schedule + persisted artifact + flags. */
function derivePhase(
  schedule: MichaelSchedule,
  artifact: PersistedInterview | null,
  hasSttFailure: boolean,
): MichaelInterviewPhase {
  if (artifact) return 'complete';
  if (hasSttFailure) return 'stt_failed';
  switch (schedule.status) {
    case 'in_progress':
      return 'call_in_progress';
    case 'missed':
      return 'no_answer';
    case 'scheduled':
    case 'awaiting_schedule':
    case 'completed': // completed-without-artifact = upstream is still ingesting
    default:
      return 'awaiting_call';
  }
}

interface WrongNumberFlag {
  wrongNumberFlaggedAt?: string | null;
  sttFailedAt?: string | null;
}

async function getScheduleFlags(baId: string): Promise<WrongNumberFlag> {
  const result = await gatewayCall<{
    documents: WrongNumberFlag[];
  }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { baId },
    projection: { wrongNumberFlaggedAt: 1, sttFailedAt: 1 },
    limit: 1,
  });
  return result.documents[0] ?? {};
}

/** Build the InterviewView the /api/michael/interview/state endpoint returns. */
export async function buildInterviewView(baId: string): Promise<MichaelInterviewView | null> {
  const schedule = await getMichaelSchedule(baId);
  if (!schedule) return null;

  const [artifact, flags] = await Promise.all([
    getInterviewByBaId(baId),
    getScheduleFlags(baId),
  ]);

  const transcript = schedule.callSid
    ? await getTranscriptChunks(schedule.callSid)
    : [];
  const hasSttFailure = !!flags.sttFailedAt;
  const phase = derivePhase(schedule, artifact, hasSttFailure);

  return {
    baId,
    phase,
    scheduledFor: schedule.slotStartUtc,
    timezone: schedule.timezone,
    call: { startedAt: schedule.startedAt, sid: schedule.callSid },
    transcript,
    artifact: artifact ? stripPersistedArtifactFields(artifact) : null,
    wrongNumberFlaggedAt: flags.wrongNumberFlaggedAt ?? null,
  };
}

function stripPersistedArtifactFields(doc: PersistedInterview): MichaelInterviewArtifact {
  return {
    baId: doc.baId,
    sponsorBaId: doc.sponsorBaId,
    callSid: doc.callSid,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    transcript: doc.transcript,
    answers: doc.answers,
    scoring: doc.scoring,
    audioUrl: doc.audioUrl,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Writes — transcript chunk ingest (during call)
// ──────────────────────────────────────────────────────────────────────────

export interface ChunkIngestResult {
  kind: 'persisted' | 'duplicate';
  sequence: number;
}

/** Append a transcript chunk. Sequence is assigned server-side as 1 + max
 *  existing sequence for this call. Persists to Mongo only (chunks are
 *  high-frequency and the final artifact is what fans to Neo4j + Chroma).
 *  Publishes to the live event bus on success. */
export async function appendTranscriptChunk(args: {
  callSid: string;
  baId: string;
  chunk: Omit<MichaelTranscriptChunk, 'sequence'>;
}): Promise<ChunkIngestResult> {
  const existing = await gatewayCall<{ documents: { sequence: number }[] }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: TRANSCRIPTS_COLLECTION,
      filter: { callSid: args.callSid },
      projection: { sequence: 1 },
      sort: { sequence: -1 },
      limit: 1,
    },
  );
  const nextSeq = (existing.documents[0]?.sequence ?? 0) + 1;
  const persisted: PersistedTranscriptChunk = {
    _id: `${args.callSid}:${nextSeq}`,
    callSid: args.callSid,
    baId: args.baId,
    sequence: nextSeq,
    speaker: args.chunk.speaker,
    text: args.chunk.text.slice(0, 5000),
    occurredAt: args.chunk.occurredAt,
  };
  await gatewayCall('mongodb', 'insert', {
    database: 'momentum',
    collection: TRANSCRIPTS_COLLECTION,
    documents: [persisted],
  });
  publishChunk({
    callSid: args.callSid,
    chunk: stripPersistedChunkFields(persisted),
  });
  return { kind: 'persisted', sequence: nextSeq };
}

// ──────────────────────────────────────────────────────────────────────────
// Writes — final scoring artifact (after call)
// ──────────────────────────────────────────────────────────────────────────

export class ScoringIngestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ScoringIngestError';
  }
}

/** Persist the completed-interview artifact. Triple-stacked. Idempotent on
 *  baId — re-ingest replaces the prior artifact (the scoring worker may
 *  re-score a recording). sponsorBaId is stamped from brand_ambassadors and
 *  is NEVER taken from the payload (locked-spec 3.5). */
export async function ingestInterviewArtifact(
  payload: MichaelScoringIngestPayload,
  _categoryScores?: MichaelCategoryScores,
): Promise<MichaelInterviewArtifact> {
  const baInfo = await getBaSponsor(payload.baId);
  if (!baInfo) {
    throw new ScoringIngestError(
      'NO_BA',
      `No BA record for baId=${payload.baId}; cannot ingest scoring.`,
    );
  }

  // Architecture update: Michael no longer predicts, scores, or classifies.
  // The optional categoryScores input is accepted only for worker backward
  // compatibility and is intentionally ignored. Steve owns discovery and the
  // Success Profile; Michael owns training support and daily success coaching.
  const classification = null;
  const successProfile = null;

  // Truncate transcript chunks defensively — every other write to the gateway
  // applies the 5000-char per-content cap.
  const transcript = payload.transcript.map((c) => ({
    ...c,
    text: c.text.slice(0, 5000),
  }));

  const id = `MI-${payload.baId}`;
  const artifact: PersistedInterview = {
    _id: id,
    baId: payload.baId,
    sponsorBaId: baInfo.sponsorBaId, // server-stamped
    callSid: payload.callSid,
    startedAt: payload.startedAt,
    completedAt: payload.completedAt,
    transcript,
    answers: payload.answers.map((a) => ({
      ...a,
      answerText: a.answerText.slice(0, 5000),
    })),
    scoring: payload.scoring,
    audioUrl: payload.audioUrl,
    classification,
    successProfile,
  };

  // Upsert: branch on existence (mongodb.update does not honor upsert per
  // tripleStack.ts gotchas).
  const existing = await getInterviewByBaId(payload.baId);
  if (existing) {
    await gatewayCall('mongodb', 'update', {
      database: 'momentum',
      collection: INTERVIEWS_COLLECTION,
      filter: { _id: id },
      update: { $set: artifactToUpdate(artifact) },
    });
    await mirrorArtifactToGraphAndChroma(artifact);
  } else {
    await ensureInterviewsCollection();
    await tripleStackWrite({
      id,
      mongoCollection: INTERVIEWS_COLLECTION,
      mongoDoc: { ...artifact },
      neo4j: artifactCypher(artifact),
      chroma: {
        collection: CHROMA_INTERVIEWS,
        document: chromaDocForArtifact(artifact),
        metadata: {
          interviewId: id,
          baId: artifact.baId,
          sponsorBaId: artifact.sponsorBaId ?? '',
          callSid: artifact.callSid ?? '',
          completedAt: artifact.completedAt ?? '',
          overallTone: artifact.scoring.overallTone ?? 'unknown',
          michaelRole: 'training_agent_daily_success_coach',
          classificationStatus: 'retired',
          kind: 'michael_interview',
        },
      },
    });
  }

  // Notify the live surface that we just landed phase=complete.
  publishPhase({
    callSid: artifact.callSid ?? '',
    baId: artifact.baId,
    phase: 'complete',
  });

  return stripPersistedArtifactFields(artifact);
}

function artifactToUpdate(a: PersistedInterview): Partial<PersistedInterview> {
  return {
    sponsorBaId: a.sponsorBaId,
    callSid: a.callSid,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    transcript: a.transcript,
    answers: a.answers,
    scoring: a.scoring,
    audioUrl: a.audioUrl,
    classification: a.classification ?? null,
    successProfile: a.successProfile ?? null,
  };
}

function artifactCypher(a: PersistedInterview): { cypher: string; params: Record<string, unknown> } {
  return {
    cypher:
      'MERGE (b:BA {baId: $baId}) ' +
      'MERGE (i:MichaelInterview {interviewId: $id}) ' +
      'SET i.completedAt = $completedAt, i.overallTone = $overallTone, ' +
      '    i.callSid = $callSid, i.audioUrl = $audioUrl, ' +
      '    i.role = "training_agent_daily_success_coach", i.classificationStatus = "retired" ' +
      'MERGE (b)-[:HAD_MICHAEL_INTERVIEW]->(i) ' +
      'WITH i, $sponsorBaId AS sponsorId ' +
      'WHERE sponsorId IS NOT NULL ' +
      'MERGE (s:BA {baId: sponsorId}) ' +
      'MERGE (i)-[:VISIBLE_TO_SPONSOR]->(s)',
    params: {
      id: a._id,
      baId: a.baId,
      sponsorBaId: a.sponsorBaId,
      completedAt: a.completedAt,
      overallTone: a.scoring.overallTone ?? 'unknown',
      callSid: a.callSid,
      audioUrl: a.audioUrl,
    },
  };
}

async function mirrorArtifactToGraphAndChroma(a: PersistedInterview): Promise<void> {
  const cy = artifactCypher(a);
  await gatewayCall('neo4j', 'cypher', { query: cy.cypher, params: cy.params });
  // Chroma collection writes happen on initial ingest only — on re-score we
  // skip Chroma to avoid duplicate documents (the artifact id is stable; an
  // upsert there would need a delete-then-add which is overkill for re-scores).
}

function chromaDocForArtifact(a: PersistedInterview): string {
  const tagSummary = a.scoring.highlightTags.join(', ');
  const tonePart = a.scoring.overallTone ?? 'unknown';
  const answerSummary = a.answers
    .map((ans) => `${ans.prompt} -> ${ans.answerText.slice(0, 200)}`)
    .join(' | ');
  return [
    `Michael Training Agent + Daily Success Coach conversation completed for BA ${a.baId}.`,
    `Tone: ${tonePart}.`,
    `Highlights: ${tagSummary}.`,
    `Answers: ${answerSummary.slice(0, 500)}`,
  ].join(' ').slice(0, 500);
}

// ──────────────────────────────────────────────────────────────────────────
// Sponsor-only cockpit read (wf_0042)
// ──────────────────────────────────────────────────────────────────────────

export class SponsorAccessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'SponsorAccessError';
  }
}

/** Sponsor-only fetch of a downline's interview card. Authoritative check
 *  is server-side: requestingBaId must equal the downline's sponsorBaId on
 *  brand_ambassadors. Founders override is intentionally NOT applied here
 *  — Michael interviews are a sponsorship-bound view; founders can see
 *  aggregates via /admin, not the per-BA cards. */
export async function getCockpitCardForSponsor(args: {
  requestingBaId: string;
  downlineBaId: string;
}): Promise<MichaelCockpitCardClassified> {
  const downlineInfo = await getBaSponsor(args.downlineBaId);
  if (!downlineInfo) {
    throw new SponsorAccessError(
      'NO_DOWNLINE',
      `No BA record for downlineBaId=${args.downlineBaId}.`,
    );
  }
  if (
    !downlineInfo.sponsorBaId ||
    downlineInfo.sponsorBaId !== args.requestingBaId
  ) {
    throw new SponsorAccessError(
      'NOT_SPONSOR',
      'Only the direct sponsor can read this card.',
    );
  }

  const artifact = await getInterviewByBaId(args.downlineBaId);
  if (!artifact) {
    throw new SponsorAccessError(
      'NO_ARTIFACT',
      'Interview is not complete yet for this BA.',
    );
  }
  if (!artifact.completedAt) {
    throw new SponsorAccessError(
      'NO_COMPLETED_AT',
      'Interview artifact has no completedAt timestamp.',
    );
  }

  return {
    downlineBaId: args.downlineBaId,
    downlineFirstName: downlineInfo.firstName,
    completedAt: artifact.completedAt,
    answers: artifact.answers,
    scoring: artifact.scoring,
    audioUrl: artifact.audioUrl,
    signedBy: artifact.scoring.signedBy,
    // Current architecture: Steve owns Success Profile; Michael does not
    // classify. Legacy stored fields are intentionally not surfaced.
    classification: null,
    successProfile: null,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Schedule-side flag writes (wrong-number from wf_0038, STT fail from wf_0041)
// ──────────────────────────────────────────────────────────────────────────

export async function flagWrongNumber(args: {
  baId: string;
  occurredAt: string;
}): Promise<void> {
  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { baId: args.baId },
    update: { $set: { wrongNumberFlaggedAt: args.occurredAt } },
  });
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (m:MichaelSchedule) WHERE m.scheduleId ENDS WITH $baId ' +
      'SET m.wrongNumberFlaggedAt = $at',
    params: { baId: args.baId, at: args.occurredAt },
  });
}

export async function flagSttFailure(args: {
  baId: string;
  occurredAt: string;
  reason: string;
}): Promise<void> {
  await gatewayCall('mongodb', 'update', {
    database: 'momentum',
    collection: 'michael_schedules',
    filter: { baId: args.baId },
    update: {
      $set: { sttFailedAt: args.occurredAt, sttFailedReason: args.reason },
    },
  });
}
