/**
 * Steve conversation runtime — the in-server discovery interviewer.
 *
 * Chat #131-era architecture had Steve's interview conducted by an EXTERNAL
 * worker (system-prompt pull + artifact push over the STEVE_WORKER_SECRET
 * M2M endpoints — those remain untouched and valid). Production needs the
 * interview to happen without that worker, and the amended locked spec (S1.6)
 * rules the agent surface BROWSER-BASED: "the dashboard carries conversations."
 *
 * This runtime IS that browser surface's engine:
 *   • POST /api/steve/discovery/converse — one BA turn in, one Steve turn out.
 *   • The LIVE transcript is event-sourced into tmag_agent_steve_events
 *     (kind='discovery_chat_message', Mongo leg — operational chat state; the
 *     FINAL artifact triple-stacks through ingestDiscoveryArtifact exactly as
 *     the worker path does, transcript included, so the knowledge object obeys
 *     full triple-stack canon).
 *   • Completion: the runtime appends a RUNTIME CONTRACT to the signed system
 *     prompt — Steve ends his final close with [[DISCOVERY_COMPLETE]]. On that
 *     marker the runtime runs a structured-extraction pass over the transcript
 *     and feeds ingestDiscoveryArtifact — playing exactly the worker's role.
 *
 * Compliance posture is inherited wholesale from buildSteveSystemPrompt:
 * Steve never makes income/placement claims, while the BA's own stated goals
 * are captured faithfully as descriptive support context.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type {
  McsSteveDiscoveryIngestPayload,
  McsSteveTranscriptChunk,
} from '@momentum/shared';
import type { McsContextPacketV1, TmagId } from '@momentum/shared/runtime';
import { complete } from '../services/anthropic.js';
import { persistenceCall } from '../services/persistence/dispatch.js';
import {
  requestSteveRuntimeContextPacket,
  steveContextManagerLiveEnabled,
} from '../runtime/context/steveRuntimeContextFoundation.js';
import {
  STEVE_DISCOVERY_QUESTIONS,
  buildSteveSystemPrompt,
  ingestDiscoveryArtifact,
} from './steve-success-interview.js';
import {
  activeRetakeSession,
  getVersionableSteveDiscovery,
} from './steveVersioning.js';

const MONGO_DB = 'momentum';
const EVENTS_COLLECTION = 'tmag_agent_steve_events';
const CHAT_KIND = 'discovery_chat_message';
const COMPLETION_MARKER = '[[DISCOVERY_COMPLETE]]';
const MESSAGE_CAP = 4000;

export interface SteveChatTurn {
  seq: number;
  role: 'ba' | 'steve';
  text: string;
  at: string;
}

export interface ConverseResult {
  reply: string;
  done: boolean;
  /** True when the close landed but profile extraction needs another nudge. */
  extractionPending: boolean;
  turns: SteveChatTurn[];
}

const RUNTIME_CONTRACT = [
  '',
  'RUNTIME CONTRACT (system — the BA never sees this):',
  '- This conversation happens over chat in the Team Magnificent dashboard,',
  '  not a phone call. Keep each turn short and warm — one or two questions',
  '  at a time, never a wall of text.',
  `- When the discovery is fully covered and you have closed warmly, end your`,
  `  FINAL message with the exact marker ${COMPLETION_MARKER} on its own line.`,
  '- Never emit that marker before the backbone is genuinely covered.',
].join('\n');

// ─── Event-sourced live transcript ──────────────────────────────────

export async function loadConversation(
  tmagId: string,
  requestedSessionId?: string | null,
): Promise<SteveChatTurn[]> {
  const discovery =
    requestedSessionId === undefined
      ? await getVersionableSteveDiscovery(tmagId)
      : null;
  const sessionId =
    requestedSessionId === undefined
      ? activeRetakeSession(discovery)?.sessionId ?? null
      : requestedSessionId;
  const sessionFilter = sessionId
    ? { 'payload.sessionId': sessionId }
    : {
        $or: [
          { 'payload.sessionId': 'initial' },
          { 'payload.sessionId': { $exists: false } },
        ],
      };
  const res = await persistenceCall<{ documents: Array<Record<string, unknown>> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: EVENTS_COLLECTION,
      filter: { tmagId, agentId: 'steve', kind: CHAT_KIND, ...sessionFilter },
    },
  );
  const docs = res.documents ?? [];
  const turns: SteveChatTurn[] = docs.map((d) => {
    const p = (d.payload ?? {}) as Record<string, unknown>;
    return {
      seq: Number(p.seq ?? 0),
      role: p.role === 'steve' ? 'steve' : 'ba',
      text: String(p.text ?? ''),
      at: String(d.createdAt ?? new Date().toISOString()),
    };
  });
  turns.sort((a, b) => a.seq - b.seq);
  return turns;
}

async function appendTurn(
  tmagId: string,
  role: 'ba' | 'steve',
  text: string,
  seq: number,
  sessionId: string | null,
): Promise<SteveChatTurn> {
  const at = new Date().toISOString();
  const eventId = `sce_${randomUUID()}`;
  await persistenceCall('mongodb', 'insert', {
    database: MONGO_DB,
    collection: EVENTS_COLLECTION,
    documents: [
      {
        _id: eventId,
        eventId,
        tmagId,
        agentId: 'steve',
        kind: CHAT_KIND,
        createdAt: at,
        payload: { role, text, seq, sessionId: sessionId ?? 'initial' },
      },
    ],
  });
  return { seq, role, text, at };
}

async function getFirstName(tmagId: string): Promise<string> {
  const res = await persistenceCall<{ documents: Array<{ firstName?: string }> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: 'team_magnificent_members',
      filter: { tmagId },
      projection: { firstName: 1 },
      limit: 1,
    },
  );
  return res.documents?.[0]?.firstName ?? 'there';
}

/** Anthropic requires alternating roles starting with user; the stored
 *  transcript starts with Steve's greeting. Reconstruct deterministically:
 *  synthetic join line first, then merge any consecutive same-role turns. */
function toAnthropicMessages(
  turns: SteveChatTurn[],
  pendingUserText: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant'; content: string }> = [
    { role: 'user', content: '(The BA has just joined the conversation. Greet them by name and begin the discovery.)' },
  ];
  for (const t of turns) {
    const role = t.role === 'ba' ? 'user' : 'assistant';
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n${t.text}`;
    else out.push({ role, content: t.text });
  }
  if (pendingUserText) {
    const last = out[out.length - 1];
    if (last && last.role === 'user') last.content += `\n${pendingUserText}`;
    else out.push({ role: 'user', content: pendingUserText });
  }
  return out;
}

// ─── Completion extraction ────────────────────────────────────────

const MODALITIES = ['watching', 'doing', 'step_by_step', 'reading', 'discussing', 'mixed'] as const;
const CHANNELS = ['text', 'call', 'email', 'in_app', 'video', 'in_person'] as const;
const CADENCES = ['daily', 'few_times_week', 'weekly', 'as_needed'] as const;

const RecommendationSchema = z.object({
  text: z.string().min(1).max(500),
  href: z.string().nullable().optional().default(null),
});

export const ExtractionSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.string(),
        answerText: z.string().max(5000),
      }),
    )
    .default([]),
  profile: z.object({
    primaryWhy: z.object({
      statement: z.string().max(5000),
      who: z.string().max(5000).default(''),
      whyNow: z.string().max(5000).default(''),
    }),
    successVision: z.object({
      statement: z.string().max(5000),
      oneBigChange: z.string().max(5000).default(''),
    }),
    learningStyle: z.object({
      modalities: z.array(z.enum(MODALITIES)).default([]),
      feedbackPreference: z.string().max(5000).default(''),
      notes: z.string().max(5000).default(''),
    }),
    communicationPreferences: z.object({
      preferredChannels: z.array(z.enum(CHANNELS)).default([]),
      cadence: z.enum(CADENCES).nullable().default(null),
      bestTimes: z.string().max(5000).default(''),
      notes: z.string().max(5000).default(''),
    }),
    supportNeeds: z.object({
      areas: z.array(z.string().max(300)).default([]),
      potentialObstacles: z.array(z.string().max(300)).default([]),
      helpStyle: z.string().max(5000).default(''),
      notes: z.string().max(5000).default(''),
    }),
    launchRecommendations: z.array(RecommendationSchema).max(6).default([]),
    trainingRecommendations: z.array(RecommendationSchema).max(6).default([]),
    michaelHandoffSummary: z.string().max(5000).default(''),
  }),
});

export type ExtractionResult = z.infer<typeof ExtractionSchema>;

/** Strip ```json fences and parse. Exported for unit tests. */
export function parseExtractionJson(raw: string): unknown {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

/** Detect + strip the completion marker. Exported for unit tests. */
export function splitCompletionMarker(reply: string): { text: string; done: boolean } {
  const done = reply.includes(COMPLETION_MARKER);
  const text = reply.split(COMPLETION_MARKER).join('').trim();
  return { text, done };
}

/** Build the extraction instruction. Exported for unit tests. */
export function extractionSystem(): string {
  const questionList = STEVE_DISCOVERY_QUESTIONS.map(
    (q) => `  ${q.id} (#${q.number}): ${q.prompt}`,
  ).join('\n');
  return [
    'You extract structured discovery data from a completed Team Magnificent',
    'onboarding interview transcript. You NEVER judge, score, rank, or evaluate',
    'the person — you faithfully reflect their own words into structure.',
    '',
    'Output ONLY a single JSON object. No prose, no markdown fences.',
    'Shape:',
    '{',
    '  "answers": [{ "questionId": "<id from the list below>", "answerText": "<their answer, in their words>" }],',
    '  "profile": {',
    '    "primaryWhy": { "statement": str, "who": str, "whyNow": str },',
    '    "successVision": { "statement": str, "oneBigChange": str },',
    `    "learningStyle": { "modalities": [${MODALITIES.map((m) => `"${m}"`).join('|')}], "feedbackPreference": str, "notes": str },`,
    `    "communicationPreferences": { "preferredChannels": [${CHANNELS.map((c) => `"${c}"`).join('|')}], "cadence": ${CADENCES.map((c) => `"${c}"`).join('|')}|null, "bestTimes": str, "notes": str },`,
    '    "supportNeeds": { "areas": [str], "potentialObstacles": [str], "helpStyle": str, "notes": str },',
    '    "launchRecommendations": [{ "text": str, "href": null }],',
    '    "trainingRecommendations": [{ "text": str, "href": null }],',
    '    "michaelHandoffSummary": str',
    '  }',
    '}',
    '',
    'Rules: recommendations are supportive preparation only — launchRecommendations,',
    'trainingRecommendations, and michaelHandoffSummary must not contain income,',
    'placement, or earnings claims. primaryWhy and successVision MUST faithfully',
    'reflect the BA\'s own words, including any member-stated dollar goals or',
    'income targets, without reframing them as promises, projections, typical',
    'results, or Team Magnificent claims. Skip questions the transcript never',
    'covered. Question ids:',
    questionList,
  ].join('\n');
}

export function renderSteveContextPromptSupplement(packet: McsContextPacketV1 | null): string {
  if (!packet || packet.approvedKnowledge.length === 0) return '';

  const approvedKnowledge = packet.approvedKnowledge.slice(0, 6).map((item, index) => {
    const title = cleanPromptLine(item.title || `Approved knowledge ${index + 1}`);
    const summary = cleanPromptLine(item.summary);
    return `${index + 1}. ${title}: ${summary}`;
  });

  return [
    '',
    'APPROVED CONTEXT PACKET (system — the BA never sees this heading):',
    '- Use the approved knowledge below only as background guidance for Steve\'s tone, support, and safe next-step framing.',
    '- Do not quote the Context Packet, retrieval audit, source ids, or internal knowledge ids to the BA.',
    '- Do not treat missing knowledge as permission to invent app facts.',
    '- Candidate or review-only knowledge is excluded and must not be inferred.',
    `- Packet status: ${packet.packetStatus}. Included approved knowledge items: ${packet.approvedKnowledge.length}.`,
    '',
    'Approved knowledge:',
    ...approvedKnowledge,
  ].join('\n');
}

async function buildSteveContextPromptSupplement(input: {
  tmagId: string;
  turnContent: string;
  createdAt: string;
}): Promise<string> {
  if (!steveContextManagerLiveEnabled()) return '';

  try {
    const packet = await requestSteveRuntimeContextPacket({
      tmagId: input.tmagId as TmagId,
      mode: 'browser_text',
      createdAt: input.createdAt,
      turnContent: input.turnContent,
    });
    return renderSteveContextPromptSupplement(packet);
  } catch (err) {
    console.warn(
      '[steve-runtime] context packet unavailable; continuing with base Steve prompt:',
      err instanceof Error ? err.message : err,
    );
    return '';
  }
}

function cleanPromptLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 700);
}

async function runExtraction(transcriptText: string): Promise<ExtractionResult> {
  const system = extractionSystem();
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const ask =
      attempt === 0
        ? `TRANSCRIPT:\n${transcriptText}`
        : `TRANSCRIPT:\n${transcriptText}\n\nYour previous output failed validation: ${lastError}\nOutput corrected JSON only.`;
    const res = await complete({
      system,
      messages: [{ role: 'user', content: ask }],
      maxTokens: 3500,
    });
    try {
      const parsed = ExtractionSchema.safeParse(parseExtractionJson(res.text));
      if (parsed.success) return parsed.data;
      lastError = parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'JSON parse failed';
    }
  }
  throw new Error(`Steve profile extraction failed after retry: ${lastError}`);
}

// ─── The conversation loop ─────────────────────────────────────────

export class SteveAlreadyCompleteError extends Error {}

/**
 * One turn of the discovery. Empty/blank message = the BA just opened the
 * page: Steve greets and begins (no BA turn is persisted for the open).
 * On [[DISCOVERY_COMPLETE]]: extraction → ingestDiscoveryArtifact (the full
 * triple-stack) → done=true. If extraction fails, the close is persisted
 * WITHOUT the marker and the BA's next message re-triggers the close — the
 * transcript is never lost.
 */
export async function converseWithSteve(
  tmagId: string,
  rawMessage: string,
): Promise<ConverseResult> {
  const currentDiscovery = await getVersionableSteveDiscovery(tmagId);
  const retakeSession = activeRetakeSession(currentDiscovery);
  if (currentDiscovery && !retakeSession) {
    throw new SteveAlreadyCompleteError('Discovery already complete.');
  }

  const message = rawMessage.trim().slice(0, MESSAGE_CAP);
  const sessionId = retakeSession?.sessionId ?? null;
  const turns = await loadConversation(tmagId, sessionId);
  const firstName = await getFirstName(tmagId);
  const createdAt = new Date().toISOString();
  const contextSupplement = await buildSteveContextPromptSupplement({
    tmagId,
    turnContent: message || turns.slice(-4).map((turn) => turn.text).join(' '),
    createdAt,
  });
  const system = [
    buildSteveSystemPrompt({ baFirstName: firstName }),
    contextSupplement,
    RUNTIME_CONTRACT,
  ].filter(Boolean).join('\n');

  let seq = turns.length;
  if (message) {
    turns.push(await appendTurn(tmagId, 'ba', message, seq, sessionId));
    seq += 1;
  } else if (turns.length > 0) {
    // Re-opening the page mid-interview: return state, no LLM call.
    return { reply: '', done: false, extractionPending: false, turns };
  }

  const res = await complete({
    system,
    messages: toAnthropicMessages(message ? turns.slice(0, -1) : turns, message),
    maxTokens: 1024,
  });

  const { text: reply, done: markerSeen } = splitCompletionMarker(res.text);
  const steveTurn = await appendTurn(tmagId, 'steve', reply, seq, sessionId);
  turns.push(steveTurn);

  if (!markerSeen) {
    return { reply, done: false, extractionPending: false, turns };
  }

  // Completion: play the worker's role — extract + ingest (triple-stack).
  const transcriptText = turns
    .map((t) => `${t.role === 'ba' ? firstName.toUpperCase() : 'STEVE'}: ${t.text}`)
    .join('\n');
  try {
    const extraction = await runExtraction(transcriptText);
    const questionById = new Map(STEVE_DISCOVERY_QUESTIONS.map((q) => [q.id, q]));
    const answers = extraction.answers
      .filter((a) => questionById.has(a.questionId) && a.answerText.trim().length > 0)
      .map((a) => ({
        questionId: a.questionId,
        prompt: questionById.get(a.questionId)!.prompt,
        answerText: a.answerText,
      }));
    const transcript: McsSteveTranscriptChunk[] = turns.map((t) => ({
      sequence: t.seq,
      speaker: t.role,
      text: t.text,
      occurredAt: t.at,
    }));
    const payload: McsSteveDiscoveryIngestPayload = {
      tmagId,
      callSid: null,
      startedAt: turns[0]?.at ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      transcript,
      answers,
      audioUrl: null,
      profile: extraction.profile,
    };
    await ingestDiscoveryArtifact(payload, {
      retakeSessionId: retakeSession?.sessionId ?? null,
    });
    return { reply, done: true, extractionPending: false, turns };
  } catch (err) {
    console.error('[steve-runtime] extraction/ingest failed:', err instanceof Error ? err.message : err);
    return { reply, done: false, extractionPending: true, turns };
  }
}
