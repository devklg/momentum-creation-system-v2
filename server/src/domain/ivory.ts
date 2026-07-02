/**
 * Ivory domain (Chat #131) — the BA-private warm-market roster + LLM coach.
 *
 * Two responsibilities, one module:
 *
 *   1. ROSTER. CRUD over IvoryName records — the persistent list of people
 *      a BA knows and might invite. Triple-stacked (Mongo + Neo4j + Chroma)
 *      exactly like the invitation spine. BA-private — every read is scoped
 *      to the authed BA by tmagId. The record carries categories, notes,
 *      preferred angle, status, and a back-ref to the last prospect token
 *      minted for the name (Generator updates this).
 *
 *   2. COACH. ivoryCoach() returns WDYK reflection PROMPTS — open-ended
 *      questions a BA reads to surface names from their own memory. It
 *      NEVER suggests specific people, never scores, never speaks comp /
 *      income / medical claims (locked-spec 3.10/3.11). The prefix mirrors
 *      ScriptMaker's stable cacheable-prefix pattern; the per-call user
 *      turn carries angle + roster size + BA's ask.
 *
 * Persistence:
 *   - Mongo collection: `ivory_names` (team-wide, every doc has `tmagId`
 *     and every query filters on it — same pattern as `prospects`).
 *   - Neo4j: (:TeamMagnificentMember {tmagId})-[:KNOWS]->(:TmagIvoryName {ivoryId, ...}). A later
 *     conversion to a /p/{token} adds (:TmagIvoryName)-[:INVITED_AS]->(:TmagProspect).
 *   - Chroma collection: `mcs_ivory`. Bootstrap once via
 *     `pnpm --filter @momentum/server bootstrap:ivory` (CK-04 pattern). The
 *     coach is the only call path that does NOT triple-stack — coaching
 *     prompts are throwaway output, not a persistent record.
 *
 * Gateway gotchas respected:
 *   - mongodb.insert takes documents:[] (already wrapped by tripleStackWrite).
 *   - mongodb.query uses filter:, returns {count, documents}.
 *   - mongodb.update does not honor upsert — we branch on existence.
 *   - neo4j.cypher uses {query, params}.
 *   - chromadb.add requires the collection to already exist.
 *
 * Dormant-aware:
 *   - If ANTHROPIC_API_KEY is unset, the coach throws AnthropicConfigError;
 *     ivoryCoach() catches and returns a deterministic evergreen prompt set
 *     with degraded=true. The surface works before the key lands.
 */

import { randomUUID } from 'node:crypto';
import { gatewayCall } from '../services/gateway.js';
import { tripleStackWrite } from '../services/tripleStack.js';
import {
  complete,
  AnthropicConfigError,
  AnthropicError,
} from '../services/anthropic.js';
import {
  readMasterContent,
  interpolateMasterContent,
} from '../services/masterContent.js';
import { lastInitialOf } from './prospects.js';
import type {
  McsCreateIvoryNamePayload,
  McsIvoryInvitationDraftPayload,
  McsIvoryInvitationDraftResponse,
  McsIvoryInvitationMintPayload,
  McsIvoryInvitationMintResponse,
  McsIvoryAngle,
  McsIvoryCategory,
  McsIvoryCoachPayload,
  McsIvoryCoachResponse,
  McsIvoryName,
  McsIvoryStatus,
  McsUpdateIvoryNamePayload,
} from '@momentum/shared';
import { createInvitation } from './invitations.js';
import { ANGLE_LABEL } from './ivoryAngle.js';
import { normalizePhone } from './prospectAccount.js';

const MONGO_DB = 'momentum';
const IVORY_COLLECTION = 'tmag_ivory_prospect_names';
const CHROMA_COLLECTION = 'tmag_ivory_prospect_names';

const ALLOWED_CATEGORIES: ReadonlySet<McsIvoryCategory> = new Set([
  'family',
  'close_friend',
  'work',
  'church',
  'school',
  'neighbor',
  'gym',
  'social',
  'past_colleague',
  'other',
]);

const ALLOWED_ANGLES: ReadonlySet<McsIvoryAngle> = new Set([
  'do_the_business',
  'make_money',
  'lose_fat',
  'unspecified',
]);

const ALLOWED_STATUSES: ReadonlySet<McsIvoryStatus> = new Set([
  'new',
  'invited',
  'customer',
  'ba',
  'not_interested',
  'follow_up',
]);

export class IvoryNotFoundError extends Error {
  constructor(public readonly ivoryId: string) {
    super(`ivory_not_found: ${ivoryId}`);
    this.name = 'IvoryNotFoundError';
  }
}

export class IvoryOwnershipError extends Error {
  constructor(public readonly ivoryId: string) {
    super(`ivory_ownership_mismatch: ${ivoryId}`);
    this.name = 'IvoryOwnershipError';
  }
}

export class IvoryValidationError extends Error {
  constructor(public readonly code: string) {
    super(`ivory_validation: ${code}`);
    this.name = 'IvoryValidationError';
  }
}

function sanitizeCategories(input: McsIvoryCategory[] | undefined): McsIvoryCategory[] {
  if (!input) return [];
  const seen = new Set<McsIvoryCategory>();
  for (const c of input) {
    if (ALLOWED_CATEGORIES.has(c)) seen.add(c);
  }
  return Array.from(seen);
}

function sanitizeAngle(input: McsIvoryAngle | undefined): McsIvoryAngle {
  if (input && ALLOWED_ANGLES.has(input)) return input;
  return 'unspecified';
}

function sanitizeStatus(input: McsIvoryStatus): McsIvoryStatus {
  if (!ALLOWED_STATUSES.has(input)) {
    throw new IvoryValidationError('invalid_status');
  }
  return input;
}

// ───────────────────────────────────────────────────────────────────────
// CRUD
// ───────────────────────────────────────────────────────────────────────

/**
 * Create a new Ivory name for the authed BA. Triple-stacks the record so
 * the roster view, the graph, and semantic search all see it immediately.
 * Status defaults to 'new'; the BA bumps it as they take action.
 */
/**
 * The Chroma semantic doc for an Ivory name. Shared by create and update so the
 * embedding text can never drift between the two write paths.
 */
function ivoryChromaDoc(r: {
  firstName: string;
  lastInitial: string;
  tmagId: string;
  categories: readonly string[];
  preferredAngle: string;
  notes: string;
}): string {
  return (
    `${r.firstName} ${r.lastInitial}. — warm-market name for BA ${r.tmagId}. ` +
    `Categories: ${r.categories.join(', ') || 'unspecified'}. ` +
    `Preferred angle: ${r.preferredAngle}. ` +
    (r.notes ? `Notes: ${r.notes}.` : 'No notes yet.')
  );
}

export async function createIvoryName(
  tmagId: string,
  input: McsCreateIvoryNamePayload,
): Promise<McsIvoryName> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName) throw new IvoryValidationError('invalid_first_name');
  if (!lastName) throw new IvoryValidationError('invalid_last_name');

  const ivoryId = `ivory_${randomUUID()}`;
  const now = new Date().toISOString();
  const lastInitial = lastInitialOf(lastName);
  const categories = sanitizeCategories(input.categories);
  const preferredAngle = sanitizeAngle(input.preferredAngle);
  const notes = (input.notes ?? '').trim();

  const record: McsIvoryName = {
    ivoryId,
    tmagId,
    firstName,
    lastName,
    lastInitial,
    notes,
    categories,
    preferredAngle,
    status: 'new',
    lastProspectId: null,
    lastTouchedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await tripleStackWrite({
      id: ivoryId,
      mongoCollection: IVORY_COLLECTION,
      mongoDoc: { ...record },
      neo4j: {
        cypher:
          'MERGE (b:TeamMagnificentMember {tmagId: $tmagId}) ' +
          'MERGE (n:TmagIvoryName {ivoryId: $id}) ' +
          'SET n.tmagId = $tmagId, ' +
          '    n.firstName = $firstName, ' +
          '    n.lastInitial = $lastInitial, ' +
          '    n.status = $status, ' +
          '    n.preferredAngle = $preferredAngle, ' +
          '    n.createdAt = $createdAt ' +
          'MERGE (b)-[r:KNOWS]->(n) ' +
          'SET r.since = $createdAt',
        params: {
          tmagId,
          firstName,
          lastInitial,
          status: 'new',
          preferredAngle,
          createdAt: now,
        },
      },
      chroma: {
        collection: CHROMA_COLLECTION,
        document: ivoryChromaDoc(record),
        metadata: {
          kind: 'ivory_name_created',
          ivoryId,
          tmagId,
          preferredAngle,
          createdAt: now,
        },
      },
    });
  } catch (err) {
    // Compensation: tripleStackWrite has no rollback. If the Mongo insert
    // committed but a later leg (Neo4j/Chroma) threw, best-effort delete the
    // orphaned row so a client retry (which mints a fresh ivoryId) does not
    // accumulate half-written duplicates.
    try {
      await gatewayCall('mongodb', 'delete', {
        database: MONGO_DB,
        collection: IVORY_COLLECTION,
        filter: { ivoryId },
      });
      await gatewayCall('neo4j', 'cypher', {
        query: 'MATCH (n:TmagIvoryName {ivoryId: $ivoryId}) DETACH DELETE n',
        params: { ivoryId },
      });
    } catch {
      // Swallow cleanup failure; surface the original write error below.
    }
    throw err;
  }

  return record;
}

/**
 * List the authed BA's Ivory roster, newest-touched first. No pagination —
 * roster sizes are expected to fit comfortably in one fetch (<500 names per
 * BA). If that assumption breaks, add a server-side limit/offset.
 */
export async function listIvoryNamesForBA(tmagId: string): Promise<McsIvoryName[]> {
  const res = await gatewayCall<{
    count: number;
    documents: Array<McsIvoryName & { _id?: unknown }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { tmagId },
    sort: { lastTouchedAt: -1 },
    limit: 1000,
  });

  return res.documents.map((d) => stripMongoMeta(d));
}

/** Fetch one Ivory record by id, enforcing BA ownership. */
export async function getIvoryName(
  ivoryId: string,
  tmagId: string,
): Promise<McsIvoryName> {
  const res = await gatewayCall<{
    count: number;
    documents: Array<McsIvoryName & { _id?: unknown }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
    limit: 1,
  });

  const doc = res.documents[0];
  if (!doc) throw new IvoryNotFoundError(ivoryId);
  if (doc.tmagId !== tmagId) throw new IvoryOwnershipError(ivoryId);
  return stripMongoMeta(doc);
}

/**
 * Edit name/notes/categories/preferredAngle on an existing record. Status
 * goes through updateIvoryStatus so the audit trail can stay clean.
 */
export async function updateIvoryName(
  ivoryId: string,
  tmagId: string,
  patch: McsUpdateIvoryNamePayload,
): Promise<McsIvoryName> {
  const existing = await getIvoryName(ivoryId, tmagId);
  const now = new Date().toISOString();

  const firstName =
    patch.firstName !== undefined ? patch.firstName.trim() : existing.firstName;
  const lastName =
    patch.lastName !== undefined ? patch.lastName.trim() : existing.lastName;
  if (!firstName) throw new IvoryValidationError('invalid_first_name');
  if (!lastName) throw new IvoryValidationError('invalid_last_name');

  const lastInitial = lastInitialOf(lastName);
  const notes = patch.notes !== undefined ? patch.notes.trim() : existing.notes;
  const categories =
    patch.categories !== undefined
      ? sanitizeCategories(patch.categories)
      : existing.categories;
  const preferredAngle =
    patch.preferredAngle !== undefined
      ? sanitizeAngle(patch.preferredAngle)
      : existing.preferredAngle;

  const next: McsIvoryName = {
    ...existing,
    firstName,
    lastName,
    lastInitial,
    notes,
    categories,
    preferredAngle,
    lastTouchedAt: now,
    updatedAt: now,
  };

  const updateRes = await gatewayCall<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
    update: {
      $set: {
        firstName,
        lastName,
        lastInitial,
        notes,
        categories,
        preferredAngle,
        lastTouchedAt: now,
        updatedAt: now,
      },
    },
  });
  if ((updateRes.matchedCount ?? 0) === 0) {
    // Deleted between the ownership check and this write.
    throw new IvoryNotFoundError(ivoryId);
  }

  // Mirror display fields onto the graph node so cypher walks return current
  // names without a Mongo round-trip.
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (n:TmagIvoryName {ivoryId: $ivoryId}) ' +
      'SET n.firstName = $firstName, ' +
      '    n.lastInitial = $lastInitial, ' +
      '    n.preferredAngle = $preferredAngle, ' +
      '    n.updatedAt = $updatedAt',
    params: {
      ivoryId,
      firstName,
      lastInitial,
      preferredAngle,
      updatedAt: now,
    },
  });

  // Refresh the Chroma semantic doc so search reflects the edited fields (add
  // upserts on the stable ivoryId). Mongo + Neo4j alone left mcs_ivory pinned to
  // the create-time firstName/categories/angle/notes. Status-only transitions
  // do not touch these fields, so only the name-edit path needs this refresh.
  await gatewayCall('chromadb', 'add', {
    collection: CHROMA_COLLECTION,
    ids: [ivoryId],
    documents: [ivoryChromaDoc(next)],
    metadatas: [
      {
        kind: 'ivory_name_created',
        ivoryId,
        tmagId,
        preferredAngle,
        createdAt: existing.createdAt,
      },
    ],
  });

  return next;
}

/**
 * Change disposition. Separate from updateIvoryName so the cockpit / admin
 * can correlate status transitions independently from name edits later.
 *
 * Note: Generator calls this with status='invited' (and lastProspectId set
 * via markIvoryInvited below) when it mints a token. All other transitions
 * are BA-driven.
 */
export async function updateIvoryStatus(
  ivoryId: string,
  tmagId: string,
  status: McsIvoryStatus,
): Promise<McsIvoryName> {
  const validated = sanitizeStatus(status);
  if (validated === 'invited') {
    // 'invited' carries an invariant (lastProspectId + the INVITED_AS edge) that
    // only minting establishes via markIvoryInvited. Setting it directly here
    // would create an 'invited' record with no linked prospect — which the
    // momentum/cockpit projections assume cannot happen. Route it through mint.
    throw new IvoryValidationError('status_invited_requires_mint');
  }
  const existing = await getIvoryName(ivoryId, tmagId);
  const now = new Date().toISOString();
  const next: McsIvoryName = {
    ...existing,
    status: validated,
    lastTouchedAt: now,
    updatedAt: now,
  };

  const updateRes = await gatewayCall<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
    update: { $set: { status: validated, lastTouchedAt: now, updatedAt: now } },
  });
  if ((updateRes.matchedCount ?? 0) === 0) {
    // Deleted between the ownership check and this write — do not report a
    // phantom success or advance the graph.
    throw new IvoryNotFoundError(ivoryId);
  }

  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (n:TmagIvoryName {ivoryId: $ivoryId}) ' +
      'SET n.status = $status, n.updatedAt = $updatedAt',
    params: { ivoryId, status: validated, updatedAt: now },
  });

  return next;
}

/**
 * Generator-side helper: stamp a fresh prospect/token onto an Ivory record
 * AND advance status to 'invited' in a single write pair. Centralized here
 * so domain/generator.ts does not duplicate the Mongo/Neo4j discipline.
 */
export async function markIvoryInvited(
  ivoryId: string,
  tmagId: string,
  prospectId: string,
): Promise<McsIvoryName> {
  const existing = await getIvoryName(ivoryId, tmagId);
  const now = new Date().toISOString();
  const next: McsIvoryName = {
    ...existing,
    status: 'invited',
    lastProspectId: prospectId,
    lastTouchedAt: now,
    updatedAt: now,
  };

  const updateRes = await gatewayCall<{ matchedCount?: number }>('mongodb', 'update', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
    update: {
      $set: {
        status: 'invited',
        lastProspectId: prospectId,
        lastTouchedAt: now,
        updatedAt: now,
      },
    },
  });
  if ((updateRes.matchedCount ?? 0) === 0) {
    // Deleted between the ownership check and this write.
    throw new IvoryNotFoundError(ivoryId);
  }

  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (n:TmagIvoryName {ivoryId: $ivoryId}) ' +
      'SET n.status = $status, n.lastProspectId = $prospectId, n.updatedAt = $updatedAt ' +
      // MERGE (not MATCH) the prospect: a missing/lagging Prospect node must not
      // silently no-op the whole statement, which previously left the graph node
      // stale ('new', no edge) while Mongo had already committed 'invited'.
      'MERGE (p:TmagProspect {prospectId: $prospectId}) ' +
      'MERGE (n)-[r:INVITED_AS]->(p) ' +
      'SET r.at = $updatedAt',
    params: {
      ivoryId,
      prospectId,
      status: 'invited',
      updatedAt: now,
    },
  });

  return next;
}

/**
 * Remove an Ivory record. The graph node is detached and deleted; Mongo
 * doc is removed. Chroma history is left in place — the record's prior
 * presence in semantic search is a fact about the past, not the present.
 */
export async function deleteIvoryName(
  ivoryId: string,
  tmagId: string,
): Promise<void> {
  // Ownership check (also throws IvoryNotFoundError if missing).
  await getIvoryName(ivoryId, tmagId);

  await gatewayCall('mongodb', 'delete', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
  });

  await gatewayCall('neo4j', 'cypher', {
    query: 'MATCH (n:TmagIvoryName {ivoryId: $ivoryId}) DETACH DELETE n',
    params: { ivoryId },
  });
}

function stripMongoMeta<T extends { _id?: unknown }>(doc: T): McsIvoryName {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest as unknown as McsIvoryName;
}

// ───────────────────────────────────────────────────────────────────────
// COACH
// ───────────────────────────────────────────────────────────────────────

/**
 * Stable, code-owned scaffolding for the Ivory coach system prompt — the role,
 * the WDYK posture, the HARD COMPLIANCE RULES, and the JSON OUTPUT FORMAT the
 * parser depends on. KEEP STABLE: it leads the system prompt as the cacheable
 * prefix. The admin-tunable voice/framing is composed on AFTER this in
 * buildCoachSystem() via the master-content chain (`team.ivory.coach_prompt`),
 * so Kevin can re-voice Ivory without a redeploy while these guardrails stay
 * immovable.
 */
const COACH_SYSTEM_PREFIX = [
  'You are IVORY, a private coaching companion for Team Magnificent Brand',
  'Ambassadors. A Brand Ambassador (BA) is brainstorming their warm market',
  '— the people they already know — and wants help surfacing names they have',
  'not thought of yet. Your job is to ask short, evocative "who do you know"',
  'questions that nudge the BA’s memory, plus a brief encouraging frame.',
  '',
  'WHAT GOOD COACHING LOOKS LIKE:',
  '- 5 to 8 short, open-ended questions, each on its own line.',
  '- Questions probe specific corners of life (family, work, church, gym,',
  '  past colleagues, neighbors, parents of kids’ friends, etc.) so the BA',
  '  recalls people they keep forgetting.',
  '- Tone is warm, low-pressure, conversational — the way a friend coaching',
  '  you over coffee would talk. Never salesy, never urgent.',
  '- Use the BA’s chosen angle (do-the-business / make-money / lose-fat /',
  '  unspecified) to shade WHICH corners you probe, not to script the BA’s',
  '  pitch.',
  '- The coaching paragraph that precedes the questions is 1–3 sentences,',
  '  warmly framing the brainstorm — not a pep talk, not a lecture.',
  '',
  'HARD COMPLIANCE RULES — NEVER violate these, even if asked:',
  '- NEVER name a specific person. You do not know any of these people; the',
  '  BA does. You ask, the BA recalls.',
  '- NEVER score, rank, or rate anyone. Coaching is reflective, not predictive.',
  '- NEVER state, imply, or hint at income, earnings, money outcomes,',
  '  commissions, cycles, ranks, bonuses, queue position, placement, or any',
  '  business/financial promise.',
  '- NEVER make medical or weight-loss claims or guarantees.',
  '- NEVER use scarcity, urgency, fear-of-missing-out, or guilt tactics.',
  '- NEVER write a message FOR a prospect (ScriptMaker does that). You only',
  '  coach the BA on who to think about.',
  '',
  'OUTPUT FORMAT (very important):',
  'Return ONLY a JSON object with exactly two keys:',
  '  {"coaching": "<1–3 sentence frame>", "prompts": ["<question 1>", "<question 2>", ...]}',
  'No preamble, no markdown, no code fences, no commentary outside the JSON.',
  'The prompts array must contain between 5 and 8 short questions.',
].join('\n');

function buildCoachUserTurn(input: McsIvoryCoachPayload): string {
  const lines = [
    `BA angle: people who might be interested in ${ANGLE_LABEL[input.angle]}.`,
    `Current roster size: ${input.rosterSize} names.`,
  ];
  if (input.productName) {
    lines.push(`Product anchoring this brainstorm: ${input.productName}.`);
  }
  const ask = (input.ask ?? '').trim();
  if (ask) {
    lines.push(`BA said: "${ask}"`);
  } else {
    lines.push('BA has not added a specific ask — give general WDYK prompts.');
  }
  lines.push('', 'Return the JSON object now.');
  return lines.join('\n');
}

/**
 * Deterministic fallback used when the LLM is unavailable (key unset) OR
 * a generation error occurs. Compliance-safe by construction — generic
 * WDYK prompts that name no one, score no one, sell nothing.
 */
function neutralCoach(input: McsIvoryCoachPayload): McsIvoryCoachResponse {
  const angle = ANGLE_LABEL[input.angle];
  const productLine = input.productName
    ? `When you think about ${input.productName}, `
    : 'When you think about who might be ready for a change, ';
  return {
    ok: true,
    coaching:
      `${productLine}let your memory wander a little wider than usual. ` +
      `You're looking for people interested in ${angle} — and almost always there are ` +
      'a few you keep forgetting.',
    prompts: [
      'Who are the two people in your family you haven’t talked to about this yet?',
      'Who at work has mentioned wanting more — more time, more income, more energy?',
      'Who do you see at the gym, church, or school that you trust?',
      'Who in your phone contacts have you not texted in a few months?',
      'Who do you know from a past job, a past city, a past chapter?',
      'Who recently asked you a question about health, money, or what you’re up to?',
      'Who do you owe a follow-up to from a conversation you started months ago?',
    ],
    degraded: true,
  };
}

interface CoachJsonShape {
  coaching?: unknown;
  prompts?: unknown;
}

function parseCoachJson(raw: string): { coaching: string; prompts: string[] } | null {
  const trimmed = raw.trim();
  // Tolerate fenced code blocks even though the prefix forbids them.
  const stripped = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: CoachJsonShape;
  try {
    parsed = JSON.parse(stripped) as CoachJsonShape;
  } catch {
    return null;
  }
  if (typeof parsed.coaching !== 'string') return null;
  if (!Array.isArray(parsed.prompts)) return null;
  const prompts = parsed.prompts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim());
  if (prompts.length < 3) return null;
  return { coaching: parsed.coaching.trim(), prompts: prompts.slice(0, 8) };
}

/**
 * Build the coach system prompt by composing the FIXED, code-owned scaffolding
 * (role + HARD COMPLIANCE RULES + JSON OUTPUT FORMAT — the guardrails the parser
 * and compliance posture depend on) with the admin-tunable voice/framing block
 * resolved through the master-content inheritance chain (TASK-147 F.5):
 *
 *   code default  →  master override (`team.ivory.coach_prompt`)
 *
 * The override lets Kevin re-voice Ivory from /admin WITHOUT a redeploy, while
 * the scaffolding stays immovable so a voice edit can never break the JSON
 * contract or the compliance rules. `readMasterContent()` already falls back to
 * the code default on any gateway/Mongo failure (never throws), so the system
 * prompt is never empty or partial — the code default is the guaranteed
 * baseline. The scaffolding leads so it remains the stable cacheable prefix.
 *
 * Tokens are interpolated with the values Ivory has in scope. Unknown tokens are
 * left intact by `interpolateMasterContent` (it never blanks), and the wrapper
 * note tells the model any leftover `{{placeholder}}` is a stylistic cue, not
 * literal output.
 */
async function buildCoachSystem(input: McsIvoryCoachPayload): Promise<string> {
  const voiceTemplate = await readMasterContent('team.ivory.coach_prompt');
  const voice = interpolateMasterContent(voiceTemplate, {
    productName: input.productName ?? undefined,
    angle: ANGLE_LABEL[input.angle],
    rosterSize: input.rosterSize,
  });
  return [
    COACH_SYSTEM_PREFIX,
    '',
    'ADMIN VOICE & FRAMING (tunable; adopt this tone and intent, but the HARD',
    'COMPLIANCE RULES and OUTPUT FORMAT above ALWAYS win — any {{placeholder}}',
    'left in the text is a stylistic cue, never literal output):',
    voice,
  ].join('\n');
}

export async function ivoryCoach(
  input: McsIvoryCoachPayload,
): Promise<McsIvoryCoachResponse> {
  try {
    const { text } = await complete({
      system: await buildCoachSystem(input),
      messages: [{ role: 'user', content: buildCoachUserTurn(input) }],
      maxTokens: 700,
    });
    const parsed = parseCoachJson(text);
    if (!parsed) {
      // Model returned non-JSON despite the prefix — fall back rather than
      // surface a broken UX. Logs so it's visible if it becomes frequent.
      // eslint-disable-next-line no-console
      console.warn('[ivory.coach] non-JSON response, using neutral fallback');
      return neutralCoach(input);
    }
    return {
      ok: true,
      coaching: parsed.coaching,
      prompts: parsed.prompts,
      degraded: false,
    };
  } catch (err) {
    if (err instanceof AnthropicConfigError || err instanceof AnthropicError) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ivory.coach] LLM unavailable, using neutral fallback:',
        err.message,
      );
      return neutralCoach(input);
    }
    throw err;
  }
}

// ───────────────────────────────────────────────────────────────────────
// INVITATION AGENT
// ───────────────────────────────────────────────────────────────────────

const RELATIONSHIP_REASON_MAX = 600;
const INVITATION_MESSAGE_MAX = 1200;

function cleanRelationshipReason(raw: string): string {
  const reason = raw.trim();
  if (!reason) throw new IvoryValidationError('missing_relationship_reason');
  if (reason.length > RELATIONSHIP_REASON_MAX) {
    throw new IvoryValidationError('relationship_reason_too_long');
  }
  return reason;
}

function neutralInvitationDraft(input: {
  firstName: string;
  relationshipReason: string;
  productName?: string | null;
}): string {
  const productLine = input.productName
    ? `I saw something around ${input.productName} and it made me think of you.`
    : 'I saw something and it made me think of you.';
  return [
    `Hey ${input.firstName}, ${productLine}`,
    `The reason you came to mind is ${input.relationshipReason}.`,
    'No pressure at all, but would you watch this short video and tell me what you think?',
  ].join(' ');
}

const INVITATION_DRAFT_SYSTEM = [
  'You are IVORY, a private Team Magnificent invitation companion for a Brand',
  'Ambassador. The BA has already chosen exactly one person and written why',
  'that person came to mind. Your only job is to draft one warm invitation',
  'message the BA can edit and send manually.',
  '',
  'HARD RULES:',
  '- Never score, rank, rate, qualify, or compare the person.',
  '- Never choose a prospect or suggest a new person.',
  '- Never mention income, earnings, compensation, cycles, ranks, placement,',
  '  spillover, guarantees, medical outcomes, scarcity, urgency, or guilt.',
  '- Never say the system will send, call, or follow up for the BA.',
  '- Keep the message personal, short, and conversational.',
  '- Return ONLY the message text. No preamble, no markdown.',
].join('\n');

function buildInvitationDraftUserTurn(input: {
  name: McsIvoryName;
  relationshipReason: string;
  productName?: string | null;
}): string {
  return [
    `Prospect first name: ${input.name.firstName}`,
    `Relationship context from BA: ${input.relationshipReason}`,
    input.productName ? `Optional product context: ${input.productName}` : 'Optional product context: none',
    '',
    'Draft one editable invitation message now.',
  ].join('\n');
}

export async function draftIvoryInvitation(
  tmagId: string,
  input: McsIvoryInvitationDraftPayload,
): Promise<McsIvoryInvitationDraftResponse> {
  const name = await getIvoryName(input.ivoryId, tmagId);
  const relationshipReason = cleanRelationshipReason(input.relationshipReason);
  const productName =
    typeof input.productName === 'string' && input.productName.trim()
      ? input.productName.trim()
      : null;

  try {
    const { text } = await complete({
      system: INVITATION_DRAFT_SYSTEM,
      messages: [
        {
          role: 'user',
          content: buildInvitationDraftUserTurn({
            name,
            relationshipReason,
            productName,
          }),
        },
      ],
      maxTokens: 260,
    });
    const draft = text.trim().replace(/^"|"$/g, '').trim();
    if (!draft) {
      return {
        ok: true,
        draft: neutralInvitationDraft({
          firstName: name.firstName,
          relationshipReason,
          productName,
        }),
        degraded: true,
      };
    }
    return { ok: true, draft: draft.slice(0, INVITATION_MESSAGE_MAX), degraded: false };
  } catch (err) {
    if (err instanceof AnthropicConfigError || err instanceof AnthropicError) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ivory.invitation-agent.draft] LLM unavailable, using neutral fallback:',
        err.message,
      );
      return {
        ok: true,
        draft: neutralInvitationDraft({
          firstName: name.firstName,
          relationshipReason,
          productName,
        }),
        degraded: true,
      };
    }
    throw err;
  }
}

export async function mintIvoryInvitation(
  tmagId: string,
  input: McsIvoryInvitationMintPayload,
): Promise<McsIvoryInvitationMintResponse> {
  const name = await getIvoryName(input.ivoryId, tmagId);
  const relationshipReason = cleanRelationshipReason(input.relationshipReason);
  const message = input.message.trim();
  const city = input.city.trim();
  const stateOrRegion = input.stateOrRegion.trim();
  const phone = input.phone.trim();
  const email =
    typeof input.email === 'string' && input.email.trim()
      ? input.email.trim()
      : null;

  if (!message) throw new IvoryValidationError('missing_message');
  if (message.length > INVITATION_MESSAGE_MAX) {
    throw new IvoryValidationError('message_too_long');
  }
  if (!city || city.length > 120) throw new IvoryValidationError('invalid_city');
  if (!stateOrRegion || stateOrRegion.length > 120) {
    throw new IvoryValidationError('invalid_state');
  }
  if (!phone) throw new IvoryValidationError('phone_required');
  if (!normalizePhone(phone)) throw new IvoryValidationError('phone_invalid');

  const created = await createInvitation({
    sponsorTmagId: tmagId,
    firstName: name.firstName,
    lastName: name.lastName,
    email,
    phone,
    city,
    stateOrRegion,
    country: 'US',
    message,
    source: 'ivory',
    relationshipReason,
  });

  // The invitation is already minted and LIVE at this point. Do NOT let a
  // failure to stamp the Ivory roster linkage fail the whole mint — that would
  // make the BA retry and mint a SECOND live token for the same person. Record
  // the linkage best-effort; a failure is logged for later reconciliation.
  try {
    await markIvoryInvited(input.ivoryId, tmagId, created.prospectId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      `[ivory.mint] invite minted (prospectId=${created.prospectId}) but Ivory ` +
        `linkage failed for ivoryId=${input.ivoryId}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
    );
  }

  return {
    ok: true,
    ivoryId: input.ivoryId,
    prospectId: created.prospectId,
    token: created.token,
    inviteUrl: created.inviteUrl,
    createdAt: created.createdAt,
    expiresAt: created.expiresAt,
    message: created.message,
    source: 'ivory',
    relationshipReason,
  };
}
