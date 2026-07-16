/**
 * Steve — New BA Discovery & Success Interview (SEPARATE agent).
 *
 * Steve is a second, independent BA-facing agent. He runs a warm DISCOVERY
 * conversation with a brand-new Brand Ambassador and produces a Success
 * Profile so the sponsor and the team can UNDERSTAND, PERSONALIZE, SUPPORT,
 * and PREPARE for that BA.
 *
 * RELATIONSHIP TO MICHAEL (load-bearing): Steve does NOT replace Michael and
 * does NOT read or write any michael_* collection or Michael graph data.
 * Michael no longer schedules or interviews; the only Steve→Michael link is a
 * one-way `michaelHandoffSummary` STRING carried on Steve's own artifact for
 * training-support context. It never mutates Michael.
 *
 * HARD RULE: Steve does NOT classify, rank, score, or judge. No rubric, no
 * tier, no weighted total, no tone. Every produced field reflects the BA's OWN
 * words. The server's job here is to RECORD understanding, never to evaluate.
 *
 * COMPLIANCE (locked-spec 3.10 / 3.12, same frame as Michael): Steve never
 * makes earnings claims, commissions projections, cycle math, or placement/
 * queue promises. The BA's own goals may be captured faithfully.
 *
 * Persistence: knowledge-tier write - MongoDB source of truth plus durable
 * Neo4j relationship and Chroma semantic-memory projections.
 */

import type {
  McsSteveDiscoveryArtifact,
  McsSteveDiscoveryIngestPayload,
  McsSteveDiscoveryPhase,
  McsSteveDiscoveryScriptQuestion,
  McsSteveDiscoveryScriptSection,
  McsSteveDiscoveryView,
  McsSteveDiscoveryFocus,
  McsSteveProfileCard,
  McsStevePrivacyState,
  McsSteveSuccessProfile,
  McsSteveTranscriptChunk,
} from '@momentum/shared';
import {
  MCS_STEVE_PRIVACY_POLICY_VERSION,
  MCS_STEVE_SPONSOR_CONSENT_FIELDS,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { writeKnowledge } from '../services/tieredWrite.js';
import { defaultStevePrivacyState } from './stevePrivacy.js';
import { appendAuditEntry } from './auditLog.js';
import {
  activeRetakeSession,
  archiveSteveDiscoveryVersion,
  correctionRevisionOf,
  profileVersionOf,
  STEVE_VERSIONING_POLICY_VERSION,
  type SteveRetakeSession,
} from './steveVersioning.js';

/** Provenance literal stamped on Steve artifacts. */
export const STEVE_SIGNED_BY = 'Steve Success · New BA Discovery & Success Interview';

const DISCOVERIES_COLLECTION = 'tmag_steve_success_interview';
const CHROMA_DISCOVERIES = 'mcs_steve_success_interview';
const STEVE_EVENTS_COLLECTION = 'tmag_agent_steve_events';
const STEVE_DISCOVERY_CHAT_KIND = 'discovery_chat_message';

interface SteveEventBodyCompactionEligibility {
  eligible: true;
  policyVersion: typeof MCS_STEVE_PRIVACY_POLICY_VERSION;
  eventKind: typeof STEVE_DISCOVERY_CHAT_KIND;
  boundaryCompletedAt: string;
  scope: 'new_record_only' | 'active_session';
  sessionId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Discovery script (the backbone Steve leads with)
// ─────────────────────────────────────────────────────────────────────────

interface RawSection {
  id: string;
  title: string;
  intent: string;
  questions: Array<{ id: string; prompt: string; focus: McsSteveDiscoveryFocus | null }>;
}

const RAW_SECTIONS: RawSection[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    intent:
      'Put the new BA at ease and set the tone — this is a friendly conversation to get to know them and how to support them best, not a test.',
    questions: [
      {
        id: 'q_welcome_intro',
        prompt:
          "Welcome aboard — I'm Steve. My whole job is to get to know you a little so the team can support you the way that actually works for YOU. Is now a good time for a few minutes?",
        focus: null,
      },
      {
        id: 'q_welcome_feeling',
        prompt: 'How are you feeling about getting started? What made you say yes to this?',
        focus: null,
      },
    ],
  },
  {
    id: 'primary_why',
    title: 'Your Primary Why',
    intent:
      "Understand the deeper, emotional reason the BA is here — the why that will still matter on a hard week. Reflect it back; never weigh or score it.",
    questions: [
      {
        id: 'q_why_deeper',
        prompt:
          "Tell me what's really pulling you toward this. Underneath the practical stuff — what's the deeper reason?",
        focus: 'primary_why',
      },
      {
        id: 'q_why_who',
        prompt: 'Who are you doing this for? Who is on your mind when you picture this working?',
        focus: 'primary_why',
      },
      {
        id: 'q_why_now',
        prompt: "Why now? What's going on in your life that makes this feel like the right moment?",
        focus: 'primary_why',
      },
    ],
  },
  {
    id: 'success_vision',
    title: 'Your Vision of Success',
    intent:
      'Understand the BA’s own picture of success a year out — the life, not the paycheck. Capture their words.',
    questions: [
      {
        id: 'q_vision_picture',
        prompt:
          'If this works the way you hope, what does your life look like a year from now? Paint me the picture.',
        focus: 'success_vision',
      },
      {
        id: 'q_vision_change',
        prompt:
          'What is the one thing you most want to change — the thing that, if it changed, would make the biggest difference?',
        focus: 'success_vision',
      },
    ],
  },
  {
    id: 'learning_style',
    title: 'How You Learn',
    intent:
      'Understand how the BA prefers to learn and receive feedback so training can be personalized. Descriptive only — there is no right answer.',
    questions: [
      {
        id: 'q_learn_modality',
        prompt:
          'When you pick up something brand new, what works best for you — watching it done, doing it hands-on, being walked through step by step, reading it, or talking it through with someone?',
        focus: 'learning_style',
      },
      {
        id: 'q_learn_feedback',
        prompt:
          'When you’re doing something a little wrong, how do you like to get feedback? Straight and direct, gentle, with examples?',
        focus: 'learning_style',
      },
      {
        id: 'q_learn_pace',
        prompt:
          'Do you like to take things one small step at a time, or get the big picture first and then fill in the details?',
        focus: 'learning_style',
      },
    ],
  },
  {
    id: 'communication',
    title: 'How You Like to Stay in Touch',
    intent:
      'Understand the BA’s preferred channels, cadence, and reachable times so the sponsor and team meet them where they are.',
    questions: [
      {
        id: 'q_comm_channel',
        prompt:
          'When your sponsor or the team reaches out, how do you most like to connect — text, a call, email, in the app, video?',
        focus: 'communication',
      },
      {
        id: 'q_comm_cadence',
        prompt:
          'How often feels right for checking in — a quick daily nudge, a few times a week, weekly, or just when you need it?',
        focus: 'communication',
      },
      {
        id: 'q_comm_times',
        prompt: 'When in your day or week are you easiest to reach — mornings, lunch, evenings, weekends?',
        focus: 'communication',
      },
    ],
  },
  {
    id: 'support_needs',
    title: 'How We Can Support You',
    intent:
      'Understand where the BA wants a hand early, what tends to get in their way, and how they like to be helped when stuck. Recorded, never judged.',
    questions: [
      {
        id: 'q_support_areas',
        prompt:
          'As you get going, where would a little extra support help most — the tech, talking to people, staying consistent, the product, something else?',
        focus: 'support_needs',
      },
      {
        id: 'q_support_obstacles',
        prompt:
          'What has tended to get in your way before when you set out to do something like this? No judgment — it just helps us have your back.',
        focus: 'support_needs',
      },
      {
        id: 'q_support_help_style',
        prompt:
          'When you get stuck, do you usually reach out for help quickly, or push through on your own for a while first?',
        focus: 'support_needs',
      },
    ],
  },
  {
    id: 'close',
    title: 'Close',
    intent: 'Thank the BA warmly and let them know how this gets used to support them. No pitch, no comp, no promises.',
    questions: [
      {
        id: 'q_close_anything',
        prompt:
          'Last thing — anything you want your sponsor and the team to know about how to support you best?',
        focus: null,
      },
    ],
  },
];

/** The discovery sections with sequential 1..N question numbers assigned. */
export const STEVE_DISCOVERY_SECTIONS: McsSteveDiscoveryScriptSection[] = (() => {
  let n = 0;
  return RAW_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    intent: s.intent,
    questions: s.questions.map<McsSteveDiscoveryScriptQuestion>((q) => ({
      id: q.id,
      number: ++n,
      sectionId: s.id,
      prompt: q.prompt,
      focus: q.focus,
    })),
  }));
})();

/** Flat list of all discovery questions in order. */
export const STEVE_DISCOVERY_QUESTIONS: McsSteveDiscoveryScriptQuestion[] =
  STEVE_DISCOVERY_SECTIONS.flatMap((s) => s.questions);

/**
 * Build the LLM system prompt that drives Steve's voice conversation. Unlike
 * Michael, Steve is fully self-contained (no master-content template-key
 * dependency) so it can never throw on a missing tenant template; Kevin can
 * wire master-content retuning later if desired. Returns a non-empty system
 * string for the external STT→LLM→TTS worker.
 */
export function buildSteveSystemPrompt(args: { baFirstName: string }): string {
  const name = args.baFirstName?.trim() || 'there';

  const backbone = STEVE_DISCOVERY_SECTIONS.map((s) => {
    const qs = s.questions.map((q) => `    ${q.number}. ${q.prompt}`).join('\n');
    return `  [${s.title}] — ${s.intent}\n${qs}`;
  }).join('\n\n');

  return [
    'You are Steve, a warm, curious onboarding guide for a brand-new Brand',
    'Ambassador on Team Magnificent. You are on a friendly phone call with them.',
    'You are BA-facing only — you never speak to prospects.',
    '',
    'YOUR JOB: run the New BA Discovery & Success Interview below as a NATURAL',
    'guided conversation to UNDERSTAND this person — their primary why, their',
    'vision of success, how they learn, how they like to communicate, and where',
    'they want support. The numbered prompts are your backbone — cover every',
    'one, in roughly this order — but speak like a real person, mirror their',
    'words, and follow the emotional thread when one opens up.',
    '',
    'WHAT YOU ARE FOR: understand, personalize, support, prepare. You exist to',
    'help the team meet this BA where they are.',
    '',
    'WHAT YOU NEVER DO: you do NOT judge, rate, rank, score, qualify, or',
    'classify this person. There is no test and no right answer. You are not',
    'deciding anything about them — you are getting to know them so they can be',
    'supported well. Never imply you are evaluating them.',
    '',
    'HARD COMPLIANCE RULES (never break these):',
    '- Never state, project, or imply earnings, income, commissions, cycle math,',
    '  or "how much you can make."',
    '- Never characterize a BA\'s stated income or dollar goal as achievable,',
    '  typical, realistic, likely, guaranteed, or supported by Team Magnificent.',
    '- If the BA states their own goal, including a dollar amount or income',
    '  target, receive it warmly and capture it faithfully as THEIR goal.',
    '  You may say, "That\'s a clear target — I\'ll make sure that\'s captured',
    '  for your sponsor." Do not deflect with "I can\'t talk about income with',
    '  you" when they are sharing their own why.',
    '- Never promise a queue or placement position.',
    '- No objection-handling, no pitching, no qualifying. This is not a sales call.',
    '- Keep it to Layer 1 framing only if the work comes up at all.',
    '',
    `Greet them by name (${name}) and keep it conversational.`,
    '',
    'THE DISCOVERY BACKBONE:',
    backbone,
    '',
    'When you have covered the backbone, thank them warmly and let them know',
    'their answers help their sponsor and the team support them in the way that',
    'works best for them. Then close warmly.',
  ].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────
// Profile assembly (structural only — NO judging)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Assemble the SteveSuccessProfile from the worker's understanding inputs.
 * Pure structural assembly — it stamps tmagId, generatedAt, and signedBy and
 * copies the BA's own reads through verbatim. It does NOT derive, weigh,
 * re-order by importance, or grade anything.
 */
/** Per-content cap (mirrors the transcript/answer truncation upstream). */
const PROFILE_FIELD_CAP = 5000;
const cap = (s: string): string => (s.length > PROFILE_FIELD_CAP ? s.slice(0, PROFILE_FIELD_CAP) : s);

export function assembleSuccessProfile(args: {
  tmagId: string;
  generatedAt: string;
  profile: McsSteveDiscoveryIngestPayload['profile'];
}): McsSteveSuccessProfile {
  const p = args.profile;
  // Defensively cap the free-text fields to the app per-content limit — the
  // transcript/answers are already capped upstream, but a rambling or
  // over-generated profile statement could otherwise 413 or be silently
  // truncated by persistence storage.
  return {
    tmagId: args.tmagId,
    primaryWhy: {
      statement: cap(p.primaryWhy.statement),
      who: cap(p.primaryWhy.who),
      whyNow: cap(p.primaryWhy.whyNow),
    },
    successVision: {
      statement: cap(p.successVision.statement),
      oneBigChange: cap(p.successVision.oneBigChange),
    },
    learningStyle: {
      ...p.learningStyle,
      feedbackPreference: cap(p.learningStyle.feedbackPreference),
      notes: cap(p.learningStyle.notes),
    },
    communicationPreferences: {
      ...p.communicationPreferences,
      bestTimes: cap(p.communicationPreferences.bestTimes),
      notes: cap(p.communicationPreferences.notes),
    },
    supportNeeds: {
      ...p.supportNeeds,
      areas: p.supportNeeds.areas.map(cap),
      potentialObstacles: p.supportNeeds.potentialObstacles.map(cap),
      helpStyle: cap(p.supportNeeds.helpStyle),
      notes: cap(p.supportNeeds.notes),
    },
    launchRecommendations: p.launchRecommendations.map((r) => ({ ...r, text: cap(r.text) })),
    trainingRecommendations: p.trainingRecommendations.map((r) => ({ ...r, text: cap(r.text) })),
    michaelHandoffSummary: cap(p.michaelHandoffSummary),
    generatedAt: args.generatedAt,
    signedBy: STEVE_SIGNED_BY,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Chroma collection bootstrap (existence-first)
// ─────────────────────────────────────────────────────────────────────────

let discoveriesCollectionBootstrap: Promise<void> | null = null;
async function ensureDiscoveriesCollection(): Promise<void> {
  if (discoveriesCollectionBootstrap) return discoveriesCollectionBootstrap;
  const bootstrap = (async () => {
    const existing = await persistenceCall<{ collections?: Array<{ name: string }> }>(
      'chromadb',
      'list_collections',
      {},
    );
    const present = (existing?.collections ?? []).some((c) => c.name === CHROMA_DISCOVERIES);
    if (present) return;
    await persistenceCall('chromadb', 'create_collection', {
      name: CHROMA_DISCOVERIES,
      metadata: { agent: 'steve', purpose: 'Steve new-BA discovery & success profiles' },
    });
  })();
  discoveriesCollectionBootstrap = bootstrap;
  try {
    await bootstrap;
  } catch (err) {
    // Do NOT cache a rejected promise: a single transient persistence/Chroma blip
    // would otherwise poison every future ingest until process restart. Clear
    // the cache so the next call retries and can self-heal.
    if (discoveriesCollectionBootstrap === bootstrap) {
      discoveriesCollectionBootstrap = null;
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

interface PersistedDiscovery extends McsSteveDiscoveryArtifact {
  _id: string;
  privacy: McsStevePrivacyState;
  eventBodyCompaction?: SteveEventBodyCompactionEligibility;
  correctionRevision?: number;
  lastCorrectedAt?: string | null;
  profileVersion?: number;
  retakeSession?: SteveRetakeSession | null;
}

async function getBaSponsor(tmagId: string): Promise<{
  sponsorTmagId: string | null;
  firstName: string;
} | null> {
  const result = await persistenceCall<{
    documents: { tmagId: string; sponsorTmagId?: string | null; firstName?: string }[];
  }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'team_magnificent_members',
    filter: { tmagId },
    projection: { tmagId: 1, sponsorTmagId: 1, firstName: 1 },
    limit: 1,
  });
  const doc = result.documents[0];
  if (!doc) return null;
  return { sponsorTmagId: doc.sponsorTmagId ?? null, firstName: doc.firstName ?? '' };
}

async function getDiscoveryByTmagId(tmagId: string): Promise<PersistedDiscovery | null> {
  const result = await persistenceCall<{ documents: PersistedDiscovery[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: DISCOVERIES_COLLECTION,
    filter: { tmagId },
    limit: 1,
  });
  return result.documents[0] ?? null;
}

function stripPersisted(doc: PersistedDiscovery): McsSteveDiscoveryArtifact {
  return {
    tmagId: doc.tmagId,
    sponsorTmagId: doc.sponsorTmagId,
    // ACR-0031: provider internals and audio pointers are not user-facing,
    // including on legacy records that may still contain those fields.
    callSid: null,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    transcript: doc.transcript,
    answers: doc.answers,
    successProfile: doc.successProfile,
    audioUrl: null,
    correctionRevision: doc.correctionRevision ?? 0,
    lastCorrectedAt: doc.lastCorrectedAt ?? null,
    profileVersion: profileVersionOf(doc),
  };
}

function derivePhase(artifact: PersistedDiscovery | null): McsSteveDiscoveryPhase {
  return artifact
    ? activeRetakeSession(artifact)
      ? 'call_in_progress'
      : 'complete'
    : 'awaiting_call';
}

/** Build the BA's own discovery view (self-read). */
export async function buildDiscoveryView(tmagId: string): Promise<McsSteveDiscoveryView> {
  const artifact = await getDiscoveryByTmagId(tmagId);
  return {
    tmagId,
    phase: derivePhase(artifact),
    transcript: artifact ? artifact.transcript : [],
    artifact: artifact ? stripPersisted(artifact) : null,
    retakeInProgress: activeRetakeSession(artifact) !== null,
  };
}

export async function isSteveDiscoveryComplete(tmagId: string): Promise<boolean> {
  const result = await persistenceCall<{ documents: Array<{ _id: string }> }>(
    'mongodb',
    'query',
    {
      database: 'momentum',
      collection: DISCOVERIES_COLLECTION,
      filter: { tmagId },
      projection: { _id: 1 },
      limit: 1,
    },
  );
  return result.documents.length > 0;
}

// ─────────────────────────────────────────────────────────────────────────
// Write — discovery artifact ingest
// ─────────────────────────────────────────────────────────────────────────

export class DiscoveryIngestError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DiscoveryIngestError';
  }
}

function isEventCompactionEligible(
  discovery: PersistedDiscovery,
): discovery is PersistedDiscovery & {
  eventBodyCompaction: SteveEventBodyCompactionEligibility;
} {
  const eligibility = discovery.eventBodyCompaction;
  return (
    eligibility?.eligible === true &&
    eligibility.policyVersion === MCS_STEVE_PRIVACY_POLICY_VERSION &&
    eligibility.eventKind === STEVE_DISCOVERY_CHAT_KIND &&
    (eligibility.scope === 'new_record_only' ||
      (eligibility.scope === 'active_session' && Boolean(eligibility.sessionId))) &&
    eligibility.boundaryCompletedAt === discovery.completedAt
  );
}

/**
 * ACR-0031 post-completion compaction for new records only.
 *
 * The canonical discovery must already exist and read back before this runs.
 * Event rows remain as content-free operational facts while their private
 * payload bodies are removed. Historical rows are excluded unless their
 * canonical discovery carries the explicit eligibility marker written by this
 * implementation.
 */
export async function compactSteveConversationEventBodies(args: {
  tmagId: string;
  discoveryId: string;
  boundaryCompletedAt: string;
  sessionId?: string | null;
}): Promise<{ matchedCount: number; modifiedCount: number; compactedAt: string }> {
  const compactedAt = new Date().toISOString();
  let update: { matchedCount?: number; modifiedCount?: number };
  const sessionFilter = args.sessionId
    ? { 'payload.sessionId': args.sessionId }
    : {};

  try {
    update = await persistenceCall<{ matchedCount?: number; modifiedCount?: number }>(
      'mongodb',
      'update',
      {
        database: 'momentum',
        collection: STEVE_EVENTS_COLLECTION,
        filter: {
          tmagId: args.tmagId,
          agentId: 'steve',
          kind: STEVE_DISCOVERY_CHAT_KIND,
          ...sessionFilter,
          $or: [
            { payload: { $exists: true } },
            { 'contentCompaction.state': { $ne: 'compacted' } },
            {
              'contentCompaction.policyVersion': {
                $ne: MCS_STEVE_PRIVACY_POLICY_VERSION,
              },
            },
            { 'contentCompaction.discoveryId': { $ne: args.discoveryId } },
            {
              'contentCompaction.boundaryCompletedAt': {
                $ne: args.boundaryCompletedAt,
              },
            },
          ],
        },
        update: {
          $unset: { payload: '' },
          $set: {
            contentCompaction: {
              state: 'compacted',
              policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
              discoveryId: args.discoveryId,
              boundaryCompletedAt: args.boundaryCompletedAt,
              sessionId: args.sessionId ?? null,
              compactedAt,
            },
          },
        },
      },
    );
  } catch {
    throw new DiscoveryIngestError(
      'EVENT_COMPACTION_FAILED',
      'Steve event body compaction did not complete.',
    );
  }

  let residual: { count?: number };
  try {
    const residualConditions = [
      { payload: { $exists: true } },
      { 'contentCompaction.state': { $ne: 'compacted' } },
      {
        'contentCompaction.policyVersion': {
          $ne: MCS_STEVE_PRIVACY_POLICY_VERSION,
        },
      },
      { 'contentCompaction.discoveryId': { $ne: args.discoveryId } },
      {
        'contentCompaction.boundaryCompletedAt': {
          $ne: args.boundaryCompletedAt,
        },
      },
    ];
    residual = await persistenceCall<{ count?: number }>('mongodb', 'query', {
      database: 'momentum',
      collection: STEVE_EVENTS_COLLECTION,
      filter: {
        tmagId: args.tmagId,
        agentId: 'steve',
        kind: STEVE_DISCOVERY_CHAT_KIND,
        ...(args.sessionId
          ? {
              $and: [
                {
                  $or: [
                    { 'payload.sessionId': args.sessionId },
                    { 'contentCompaction.sessionId': args.sessionId },
                  ],
                },
                { $or: residualConditions },
              ],
            }
          : { $or: residualConditions }),
      },
      projection: { _id: 1 },
      limit: 1,
    });
  } catch {
    throw new DiscoveryIngestError(
      'EVENT_COMPACTION_FAILED',
      'Steve event body compaction read-back did not complete.',
    );
  }

  if ((residual.count ?? 0) > 0) {
    throw new DiscoveryIngestError(
      'EVENT_COMPACTION_FAILED',
      'Steve event body compaction did not read back.',
    );
  }

  return {
    matchedCount: update.matchedCount ?? 0,
    modifiedCount: update.modifiedCount ?? 0,
    compactedAt,
  };
}

function discoveryCypher(a: PersistedDiscovery): { cypher: string; params: Record<string, unknown> } {
  // ACR-0031 keeps the graph relationship-only. Sponsor consent is enforced
  // from canonical Mongo at read time; an unconditional sponsor-visibility
  // edge is not consent evidence and is not created for new records.
  return {
    cypher:
      'MERGE (b:TeamMagnificentMember {tmagId: $tmagId}) ' +
      'MERGE (d:TmagSteveDiscovery {discoveryId: $id}) ' +
      'SET d.completedAt = $completedAt, d.signedBy = $signedBy, ' +
      'd.privacyStatus = $privacyStatus, d.privacyPolicyVersion = $privacyPolicyVersion, ' +
      'd.profileVersion = $profileVersion, d.correctionRevision = $correctionRevision, ' +
      'd.retakeStatus = $retakeStatus, d.retakeSessionId = $retakeSessionId, ' +
      'd.eventBodiesCompactionEligible = $eventBodiesCompactionEligible, ' +
      'd.eventBodyCompactionPolicyVersion = $eventBodyCompactionPolicyVersion ' +
      'MERGE (b)-[:HAD_STEVE_DISCOVERY]->(d)',
    params: {
      id: a._id,
      tmagId: a.tmagId,
      completedAt: a.completedAt,
      signedBy: a.successProfile.signedBy,
      privacyStatus: a.privacy?.status ?? 'active',
      privacyPolicyVersion: a.privacy?.policyVersion ?? 'acr-0031.v1',
      profileVersion: profileVersionOf(a),
      correctionRevision: correctionRevisionOf(a),
      retakeStatus: activeRetakeSession(a)?.status ?? 'not_in_progress',
      retakeSessionId: activeRetakeSession(a)?.sessionId ?? null,
      eventBodiesCompactionEligible: a.eventBodyCompaction?.eligible === true,
      eventBodyCompactionPolicyVersion:
        a.eventBodyCompaction?.policyVersion ?? MCS_STEVE_PRIVACY_POLICY_VERSION,
    },
  };
}

function chromaDocForDiscovery(_a: PersistedDiscovery): string {
  return 'Private Steve discovery completion marker. Profile content is canonical in MongoDB.';
}

interface DiscoveryChromaGetResult {
  ids?: string[];
  metadatas?: Array<Record<string, unknown>>;
}

async function writeCurrentDiscoveryProjection(artifact: PersistedDiscovery): Promise<void> {
  const cy = discoveryCypher(artifact);
  const retake = activeRetakeSession(artifact);
  const consentedFieldCount = MCS_STEVE_SPONSOR_CONSENT_FIELDS.filter(
    (field) => artifact.privacy.sponsorConsent[field].granted,
  ).length;
  await ensureDiscoveriesCollection();
  await persistenceCall('neo4j', 'cypher', {
    query: cy.cypher,
    params: cy.params,
  });
  await persistenceCall('chromadb', 'add', {
    collection: CHROMA_DISCOVERIES,
    ids: [artifact._id],
    documents: [chromaDocForDiscovery(artifact)],
    metadatas: [
      {
        discoveryId: artifact._id,
        ownerTmagId: artifact.tmagId,
        completedAt: artifact.completedAt ?? '',
        kind: 'steve_discovery',
        retrievalEligible: false,
        privacyStatus: artifact.privacy.status,
        privacyPolicyVersion: artifact.privacy.policyVersion,
        consentedFieldCount,
        profileVersion: profileVersionOf(artifact),
        correctionRevision: correctionRevisionOf(artifact),
        retakeStatus: retake?.status ?? 'not_in_progress',
        retakeSessionId: retake?.sessionId ?? '',
        versioningPolicyVersion: STEVE_VERSIONING_POLICY_VERSION,
        eventBodiesCompactionEligible:
          artifact.eventBodyCompaction?.eligible === true,
        eventBodyCompactionPolicyVersion:
          artifact.eventBodyCompaction?.policyVersion ??
          MCS_STEVE_PRIVACY_POLICY_VERSION,
      },
    ],
  });

  const [graph, chroma] = await Promise.all([
    persistenceCall<{ records?: Array<Record<string, unknown>> }>('neo4j', 'cypher', {
      query:
        'MATCH (d:TmagSteveDiscovery {discoveryId: $discoveryId}) ' +
        'RETURN d.profileVersion AS profileVersion, ' +
        'd.correctionRevision AS correctionRevision, d.retakeStatus AS retakeStatus',
      params: { discoveryId: artifact._id },
    }),
    persistenceCall<DiscoveryChromaGetResult>('chromadb', 'get', {
      collection: CHROMA_DISCOVERIES,
      ids: [artifact._id],
      include_documents: false,
    }),
  ]);
  const graphRow = graph.records?.[0];
  const chromaIndex = chroma.ids?.indexOf(artifact._id) ?? -1;
  const chromaRow = chromaIndex >= 0 ? chroma.metadatas?.[chromaIndex] : undefined;
  const expectedRetakeStatus = retake?.status ?? 'not_in_progress';
  if (
    Number(graphRow?.profileVersion) !== profileVersionOf(artifact) ||
    Number(graphRow?.correctionRevision) !== correctionRevisionOf(artifact) ||
    graphRow?.retakeStatus !== expectedRetakeStatus ||
    Number(chromaRow?.profileVersion) !== profileVersionOf(artifact) ||
    Number(chromaRow?.correctionRevision) !== correctionRevisionOf(artifact) ||
    chromaRow?.retakeStatus !== expectedRetakeStatus
  ) {
    throw new DiscoveryIngestError(
      'READBACK_FAILED',
      'Steve current profile projection did not read back.',
    );
  }
}

async function replaceDiscoveryFromRetake(args: {
  existing: PersistedDiscovery;
  replacement: PersistedDiscovery;
  retakeSessionId: string;
}): Promise<McsSteveDiscoveryArtifact> {
  const retake = activeRetakeSession(args.existing);
  if (!retake || retake.sessionId !== args.retakeSessionId) {
    throw new DiscoveryIngestError(
      'RETAKE_NOT_ACTIVE',
      'A matching Steve retake is not active.',
    );
  }
  const profileVersion = profileVersionOf(args.existing) + 1;
  const completedAt = args.replacement.completedAt ?? new Date().toISOString();
  const next: PersistedDiscovery = {
    ...args.replacement,
    _id: args.existing._id,
    sponsorTmagId: args.existing.sponsorTmagId,
    privacy: args.existing.privacy,
    profileVersion,
    correctionRevision: 0,
    lastCorrectedAt: null,
    completedAt,
    retakeSession: null,
    eventBodyCompaction: {
      eligible: true,
      policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
      eventKind: STEVE_DISCOVERY_CHAT_KIND,
      boundaryCompletedAt: completedAt,
      scope: 'active_session',
      sessionId: args.retakeSessionId,
    },
  };

  await archiveSteveDiscoveryVersion({
    discovery: args.existing,
    reason: 'retake',
    supersededAt: completedAt,
  });

  const update = await persistenceCall<{ matchedCount?: number }>('mongodb', 'update', {
    database: 'momentum',
    collection: DISCOVERIES_COLLECTION,
    filter: {
      _id: args.existing._id,
      tmagId: args.existing.tmagId,
      'retakeSession.sessionId': args.retakeSessionId,
    },
    update: {
      $set: {
        sponsorTmagId: next.sponsorTmagId,
        callSid: null,
        startedAt: next.startedAt,
        completedAt: next.completedAt,
        transcript: next.transcript,
        answers: next.answers,
        successProfile: next.successProfile,
        audioUrl: null,
        privacy: next.privacy,
        profileVersion,
        correctionRevision: 0,
        lastCorrectedAt: null,
        retakeSession: null,
        eventBodyCompaction: next.eventBodyCompaction,
      },
    },
  });
  if (update.matchedCount !== 1) {
    throw new DiscoveryIngestError('RETAKE_STALE', 'The Steve retake state changed.');
  }

  let canonicalPromoted = false;
  let completionAudited = false;
  try {
    await writeCurrentDiscoveryProjection(next);
    const readback = await getDiscoveryByTmagId(next.tmagId);
    if (
      !readback ||
      profileVersionOf(readback) !== profileVersion ||
      correctionRevisionOf(readback) !== 0 ||
      readback.completedAt !== next.completedAt ||
      activeRetakeSession(readback) !== null
    ) {
      throw new DiscoveryIngestError(
        'READBACK_FAILED',
        'The completed Steve retake did not read back.',
      );
    }
    canonicalPromoted = true;
    await appendAuditEntry({
      actor: {
        kind: 'ba',
        tmagId: next.tmagId,
        displayName: next.tmagId,
      },
      action: 'ba.steve_profile.retake_completed',
      entity: {
        kind: 'brand_ambassador',
        id: next.tmagId,
        displayLabel: 'Steve Success Profile',
      },
      severity: 'info',
      before: {
        profileVersion: profileVersionOf(args.existing),
        correctionRevision: correctionRevisionOf(args.existing),
      },
      after: {
        profileVersion,
        correctionRevision: 0,
        versioningPolicyVersion: STEVE_VERSIONING_POLICY_VERSION,
      },
    });
    completionAudited = true;
    await compactSteveConversationEventBodies({
      tmagId: next.tmagId,
      discoveryId: next._id,
      boundaryCompletedAt: completedAt,
      sessionId: args.retakeSessionId,
    });
    return stripPersisted(readback);
  } catch (error) {
    // Once the canonical replacement and its audit fact are durable, a
    // compaction failure must not resurrect the prior plan or discard the
    // completed retake. The explicit eligibility marker allows a safe retry.
    if (
      canonicalPromoted &&
      completionAudited &&
      error instanceof DiscoveryIngestError &&
      error.code === 'EVENT_COMPACTION_FAILED'
    ) {
      throw error;
    }
    const restoreFields: Record<string, unknown> = { ...args.existing };
    delete restoreFields._id;
    await persistenceCall('mongodb', 'update', {
      database: 'momentum',
      collection: DISCOVERIES_COLLECTION,
      filter: { _id: next._id, tmagId: next.tmagId, profileVersion },
      update: { $set: restoreFields },
    });
    await writeCurrentDiscoveryProjection(args.existing);
    if (error instanceof DiscoveryIngestError) throw error;
    throw new DiscoveryIngestError('RETAKE_FAILED', 'Steve retake did not complete.');
  }
}

/**
 * Persist a completed discovery. Triple-stacked (Mongo + Neo4j + Chroma) and
 * create-only on tmagId. ACR-0031 requires explicit BA confirmation for any
 * correction, so ordinary worker/runtime ingest cannot replace an existing
 * private artifact. sponsorTmagId is stamped from team_magnificent_members and
 * is NEVER taken from the payload (locked-spec 3.5). Reads the Mongo row back
 * before returning to confirm the write landed.
 */
export async function ingestDiscoveryArtifact(
  payload: McsSteveDiscoveryIngestPayload,
  options: { retakeSessionId?: string | null } = {},
): Promise<McsSteveDiscoveryArtifact> {
  const baInfo = await getBaSponsor(payload.tmagId);
  if (!baInfo) {
    throw new DiscoveryIngestError(
      'NO_BA',
      `No BA record for tmagId=${payload.tmagId}; cannot ingest discovery.`,
    );
  }

  const successProfile = assembleSuccessProfile({
    tmagId: payload.tmagId,
    generatedAt: payload.completedAt,
    profile: payload.profile,
  });

  // Defensive truncation — mirror the app's 5000-char per-content cap.
  const transcript: McsSteveTranscriptChunk[] = payload.transcript.map((c) => ({
    ...c,
    text: c.text.slice(0, 5000),
  }));

  const id = `SD-${payload.tmagId}`;
  const artifact: PersistedDiscovery = {
    _id: id,
    tmagId: payload.tmagId,
    sponsorTmagId: baInfo.sponsorTmagId, // server-stamped (3.5)
    // Internal Steve uses browser voice/text. ACR-0031 stores transcripts,
    // not provider call identifiers or raw-audio pointers.
    callSid: null,
    startedAt: payload.startedAt,
    completedAt: payload.completedAt,
    transcript,
    answers: payload.answers.map((ans) => ({
      ...ans,
      answerText: ans.answerText.slice(0, 5000),
    })),
    successProfile,
    audioUrl: null,
    privacy: defaultStevePrivacyState(),
    profileVersion: 1,
    correctionRevision: 0,
    lastCorrectedAt: null,
    retakeSession: null,
    eventBodyCompaction: {
      eligible: true,
      policyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
      eventKind: STEVE_DISCOVERY_CHAT_KIND,
      boundaryCompletedAt: payload.completedAt,
      scope: 'new_record_only',
    },
  };

  const cy = discoveryCypher(artifact);
  const existing = await getDiscoveryByTmagId(payload.tmagId);
  if (existing) {
    if (options.retakeSessionId) {
      return replaceDiscoveryFromRetake({
        existing,
        replacement: artifact,
        retakeSessionId: options.retakeSessionId,
      });
    }
    if (isEventCompactionEligible(existing)) {
      await compactSteveConversationEventBodies({
        tmagId: existing.tmagId,
        discoveryId: existing._id,
        boundaryCompletedAt: existing.eventBodyCompaction.boundaryCompletedAt,
        sessionId: existing.eventBodyCompaction.sessionId ?? null,
      });
      if (existing.completedAt === payload.completedAt) {
        return stripPersisted(existing);
      }
    }
    throw new DiscoveryIngestError(
      'ALREADY_EXISTS',
      `Discovery for tmagId=${payload.tmagId} already exists and requires BA-confirmed correction.`,
    );
  }

  try {
    await ensureDiscoveriesCollection();
    await writeKnowledge({
      id,
      mongoCollection: DISCOVERIES_COLLECTION,
      mongoDoc: { ...artifact },
      neo4j: { cypher: cy.cypher, params: cy.params },
      chroma: {
        collection: CHROMA_DISCOVERIES,
        document: chromaDocForDiscovery(artifact),
        metadata: {
          discoveryId: id,
          ownerTmagId: artifact.tmagId,
          completedAt: artifact.completedAt ?? '',
          kind: 'steve_discovery',
          retrievalEligible: false,
          privacyStatus: artifact.privacy.status,
          privacyPolicyVersion: artifact.privacy.policyVersion,
          consentedFieldCount: 0,
          profileVersion: 1,
          correctionRevision: 0,
          retakeStatus: 'not_in_progress',
          retakeSessionId: '',
          versioningPolicyVersion: STEVE_VERSIONING_POLICY_VERSION,
          eventBodiesCompactionEligible: true,
          eventBodyCompactionPolicyVersion: MCS_STEVE_PRIVACY_POLICY_VERSION,
        },
      },
    });
  } catch (err) {
    // A concurrent completion may have won the create race. Do not reinterpret
    // that as correction authority. A new-record eligibility marker may still
    // authorize content-free event-body compaction for the winning artifact.
    const raced = await getDiscoveryByTmagId(payload.tmagId);
    if (raced) {
      if (isEventCompactionEligible(raced)) {
        await compactSteveConversationEventBodies({
          tmagId: raced.tmagId,
          discoveryId: raced._id,
          boundaryCompletedAt: raced.eventBodyCompaction.boundaryCompletedAt,
          sessionId: raced.eventBodyCompaction.sessionId ?? null,
        });
        if (raced.completedAt === payload.completedAt) {
          return stripPersisted(raced);
        }
      }
      throw new DiscoveryIngestError(
        'ALREADY_EXISTS',
        `Discovery for tmagId=${payload.tmagId} already exists and requires BA-confirmed correction.`,
      );
    }
    throw err;
  }

  // Read-back verification (VERIFY BEFORE DONE): confirm the Mongo row landed
  // AND that this write's content actually applied. Checking existence alone
  // would pass even when an update silently modified nothing (0 matched/modified
  // without throwing), so also assert completedAt reflects THIS artifact.
  const readback = await getDiscoveryByTmagId(payload.tmagId);
  if (
    !readback ||
    readback._id !== id ||
    readback.completedAt !== artifact.completedAt ||
    !isEventCompactionEligible(readback)
  ) {
    throw new DiscoveryIngestError(
      'READBACK_FAILED',
      `Discovery for tmagId=${payload.tmagId} did not read back after write.`,
    );
  }

  await compactSteveConversationEventBodies({
    tmagId: readback.tmagId,
    discoveryId: readback._id,
    boundaryCompletedAt: readback.eventBodyCompaction.boundaryCompletedAt,
  });

  return stripPersisted(readback);
}

// ─────────────────────────────────────────────────────────────────────────
// Sponsor-only read
// ─────────────────────────────────────────────────────────────────────────

export class SponsorAccessError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'SponsorAccessError';
  }
}

/** Legacy raw sponsor-card boundary.
 *
 * ACR-0031 removed raw answers/full-profile/audio from the sponsor default.
 * The direct sponsor must use Michael's bounded training-support projection.
 * This route fails closed until a field-specific BA consent contract exists.
 */
export async function getProfileCardForSponsor(args: {
  requestingTmagId: string;
  downlineTmagId: string;
}): Promise<McsSteveProfileCard> {
  const downlineInfo = await getBaSponsor(args.downlineTmagId);
  if (!downlineInfo) {
    throw new SponsorAccessError('NO_DOWNLINE', `No BA record for downlineTmagId=${args.downlineTmagId}.`);
  }
  if (!downlineInfo.sponsorTmagId || downlineInfo.sponsorTmagId !== args.requestingTmagId) {
    throw new SponsorAccessError('NOT_SPONSOR', 'Only the direct sponsor can read this profile.');
  }

  throw new SponsorAccessError(
    'CONSENT_REQUIRED',
    'Raw Steve profile access is unavailable without field-specific BA consent.',
  );
}
