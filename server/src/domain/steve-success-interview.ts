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
 * COMPLIANCE (locked-spec 3.10 / 3.12, same frame as Michael): no earnings,
 * commissions, cycle math, or placement/queue promises. Layer 1 only.
 *
 * Persistence: the existing tripleStackWrite pattern — MongoDB (operational
 * source of truth) + Neo4j (relationships) + ChromaDB (semantic memory) in one
 * logical write, with a Mongo read-back to confirm the row landed.
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
  McsSteveSuccessProfile,
  McsSteveTranscriptChunk,
} from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { tripleStackWrite } from '../services/tripleStack.js';

/** Provenance literal stamped on Steve artifacts. */
export const STEVE_SIGNED_BY = 'Steve Success · New BA Discovery & Success Interview';

const DISCOVERIES_COLLECTION = 'tmag_steve_success_interview';
const CHROMA_DISCOVERIES = 'mcs_steve_success_interview';

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
    callSid: doc.callSid,
    startedAt: doc.startedAt,
    completedAt: doc.completedAt,
    transcript: doc.transcript,
    answers: doc.answers,
    successProfile: doc.successProfile,
    audioUrl: doc.audioUrl,
  };
}

function derivePhase(artifact: PersistedDiscovery | null): McsSteveDiscoveryPhase {
  return artifact ? 'complete' : 'awaiting_call';
}

/** Build the BA's own discovery view (self-read). */
export async function buildDiscoveryView(tmagId: string): Promise<McsSteveDiscoveryView> {
  const artifact = await getDiscoveryByTmagId(tmagId);
  return {
    tmagId,
    phase: derivePhase(artifact),
    transcript: artifact ? artifact.transcript : [],
    artifact: artifact ? stripPersisted(artifact) : null,
  };
}

export async function isSteveDiscoveryComplete(tmagId: string): Promise<boolean> {
  const artifact = await getDiscoveryByTmagId(tmagId);
  return derivePhase(artifact) === 'complete';
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

function discoveryCypher(a: PersistedDiscovery): { cypher: string; params: Record<string, unknown> } {
  // Keep Steve's graph independent from retired Michael interview data while
  // preserving the shared BA and sponsor visibility shape.
  return {
    cypher:
      'MERGE (b:TeamMagnificentMember {tmagId: $tmagId}) ' +
      'MERGE (d:TmagSteveDiscovery {discoveryId: $id}) ' +
      'SET d.completedAt = $completedAt, d.callSid = $callSid, d.audioUrl = $audioUrl, ' +
      '    d.signedBy = $signedBy ' +
      'MERGE (b)-[:HAD_STEVE_DISCOVERY]->(d) ' +
      'WITH d, $sponsorTmagId AS sponsorId ' +
      'WHERE sponsorId IS NOT NULL ' +
      'MERGE (s:TeamMagnificentMember {tmagId: sponsorId}) ' +
      'MERGE (d)-[:VISIBLE_TO_SPONSOR]->(s)',
    params: {
      id: a._id,
      tmagId: a.tmagId,
      sponsorTmagId: a.sponsorTmagId,
      completedAt: a.completedAt,
      callSid: a.callSid,
      audioUrl: a.audioUrl,
      signedBy: a.successProfile.signedBy,
    },
  };
}

function chromaDocForDiscovery(a: PersistedDiscovery): string {
  const sp = a.successProfile;
  const learn = sp.learningStyle.modalities.join(', ');
  const channels = sp.communicationPreferences.preferredChannels.join(', ');
  return [
    `Steve discovery completed for BA ${a.tmagId}.`,
    `Primary why: ${sp.primaryWhy.statement}.`,
    `Success vision: ${sp.successVision.statement}.`,
    `Learns by: ${learn}. Prefers contact via: ${channels}.`,
    `Support areas: ${sp.supportNeeds.areas.join(', ')}.`,
  ]
    .join(' ')
    .slice(0, 500);
}

function artifactToUpdate(a: PersistedDiscovery): Partial<PersistedDiscovery> {
  return {
    sponsorTmagId: a.sponsorTmagId,
    callSid: a.callSid,
    startedAt: a.startedAt,
    completedAt: a.completedAt,
    transcript: a.transcript,
    answers: a.answers,
    successProfile: a.successProfile,
    audioUrl: a.audioUrl,
  };
}

/**
 * Persist a completed discovery. Triple-stacked (Mongo + Neo4j + Chroma) and
 * idempotent on tmagId — a re-ingest replaces the prior artifact. sponsorTmagId is
 * stamped from team_magnificent_members and is NEVER taken from the payload
 * (locked-spec 3.5). Reads the Mongo row back before returning to confirm the
 * write landed.
 */
export async function ingestDiscoveryArtifact(
  payload: McsSteveDiscoveryIngestPayload,
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
    callSid: payload.callSid,
    startedAt: payload.startedAt,
    completedAt: payload.completedAt,
    transcript,
    answers: payload.answers.map((ans) => ({
      ...ans,
      answerText: ans.answerText.slice(0, 5000),
    })),
    successProfile,
    audioUrl: payload.audioUrl,
  };

  const cy = discoveryCypher(artifact);

  // Chroma add() upserts (it maps to the Chroma upsert endpoint), so re-writing
  // the same id REFRESHES the semantic doc rather than duplicating it.
  const upsertChromaDoc = async (): Promise<void> => {
    await ensureDiscoveriesCollection();
    await persistenceCall('chromadb', 'add', {
      collection: CHROMA_DISCOVERIES,
      ids: [id],
      documents: [chromaDocForDiscovery(artifact)],
      metadatas: [
        {
          discoveryId: id,
          tmagId: artifact.tmagId,
          sponsorTmagId: artifact.sponsorTmagId ?? '',
          callSid: artifact.callSid ?? '',
          completedAt: artifact.completedAt ?? '',
          kind: 'steve_discovery',
        },
      ],
    });
  };

  // Update path (existing row, or a TOCTOU-raced insert): refresh ALL THREE
  // stores. The prior code updated Mongo + Neo4j only, leaving the Chroma
  // semantic doc pinned to the FIRST version on every re-ingest.
  const updateAllStores = async (): Promise<void> => {
    await persistenceCall('mongodb', 'update', {
      database: 'momentum',
      collection: DISCOVERIES_COLLECTION,
      filter: { _id: id },
      update: { $set: artifactToUpdate(artifact) },
    });
    await persistenceCall('neo4j', 'cypher', { query: cy.cypher, params: cy.params });
    await upsertChromaDoc();
  };

  // Upsert: branch on existence (mongodb.update does not honor upsert per
  // tripleStack.ts gotchas).
  const existing = await getDiscoveryByTmagId(payload.tmagId);
  if (existing) {
    await updateAllStores();
  } else {
    try {
      await ensureDiscoveriesCollection();
      await tripleStackWrite({
        id,
        mongoCollection: DISCOVERIES_COLLECTION,
        mongoDoc: { ...artifact },
        neo4j: { cypher: cy.cypher, params: cy.params },
        chroma: {
          collection: CHROMA_DISCOVERIES,
          document: chromaDocForDiscovery(artifact),
          metadata: {
            discoveryId: id,
            tmagId: artifact.tmagId,
            sponsorTmagId: artifact.sponsorTmagId ?? '',
            callSid: artifact.callSid ?? '',
            completedAt: artifact.completedAt ?? '',
            kind: 'steve_discovery',
          },
        },
      });
    } catch (err) {
      // TOCTOU: a concurrent ingest for the same tmagId may have inserted the row
      // between the existence check above and this insert, so the insert fails
      // on a duplicate _id. Re-check and fall back to the update path so a
      // logically idempotent re-ingest converges instead of 500-ing.
      const raced = await getDiscoveryByTmagId(payload.tmagId);
      if (!raced) throw err;
      await updateAllStores();
    }
  }

  // Read-back verification (VERIFY BEFORE DONE): confirm the Mongo row landed
  // AND that this write's content actually applied. Checking existence alone
  // would pass even when an update silently modified nothing (0 matched/modified
  // without throwing), so also assert completedAt reflects THIS artifact.
  const readback = await getDiscoveryByTmagId(payload.tmagId);
  if (!readback || readback._id !== id || readback.completedAt !== artifact.completedAt) {
    throw new DiscoveryIngestError(
      'READBACK_FAILED',
      `Discovery for tmagId=${payload.tmagId} did not read back after write.`,
    );
  }

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

/** Sponsor-only fetch of a downline's Steve profile card. Authoritative check
 *  is server-side: requestingTmagId must equal the downline's sponsorTmagId. */
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

  const artifact = await getDiscoveryByTmagId(args.downlineTmagId);
  if (!artifact) {
    throw new SponsorAccessError('NO_ARTIFACT', 'Discovery is not complete yet for this BA.');
  }
  if (!artifact.completedAt) {
    throw new SponsorAccessError('NO_COMPLETED_AT', 'Discovery artifact has no completedAt timestamp.');
  }

  return {
    downlineTmagId: args.downlineTmagId,
    downlineFirstName: downlineInfo.firstName,
    completedAt: artifact.completedAt,
    answers: artifact.answers,
    successProfile: artifact.successProfile,
    audioUrl: artifact.audioUrl,
    signedBy: artifact.successProfile.signedBy,
  };
}
