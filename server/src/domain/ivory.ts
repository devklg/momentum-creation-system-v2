/**
 * Ivory domain (Chat #131) — the BA-private warm-market roster + LLM coach.
 *
 * Two responsibilities, one module:
 *
 *   1. ROSTER. CRUD over IvoryName records — the persistent list of people
 *      a BA knows and might invite. Triple-stacked (Mongo + Neo4j + Chroma)
 *      exactly like the invitation spine. BA-private — every read is scoped
 *      to the authed BA by baId. The record carries categories, notes,
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
 *   - Mongo collection: `ivory_names` (team-wide, every doc has `baId`
 *     and every query filters on it — same pattern as `prospects`).
 *   - Neo4j: (:BA {baId})-[:KNOWS]->(:IvoryName {ivoryId, ...}). A later
 *     conversion to a /p/{token} adds (:IvoryName)-[:INVITED_AS]->(:Prospect).
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
import { lastInitialOf } from './prospects.js';
import type {
  CreateIvoryNamePayload,
  IvoryAngle,
  IvoryCategory,
  IvoryCoachPayload,
  IvoryCoachResponse,
  IvoryName,
  IvoryStatus,
  UpdateIvoryNamePayload,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const IVORY_COLLECTION = 'ivory_names';
const CHROMA_COLLECTION = 'mcs_ivory';

const ALLOWED_CATEGORIES: ReadonlySet<IvoryCategory> = new Set([
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

const ALLOWED_ANGLES: ReadonlySet<IvoryAngle> = new Set([
  'do_the_business',
  'make_money',
  'lose_fat',
  'unspecified',
]);

const ALLOWED_STATUSES: ReadonlySet<IvoryStatus> = new Set([
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

function sanitizeCategories(input: IvoryCategory[] | undefined): IvoryCategory[] {
  if (!input) return [];
  const seen = new Set<IvoryCategory>();
  for (const c of input) {
    if (ALLOWED_CATEGORIES.has(c)) seen.add(c);
  }
  return Array.from(seen);
}

function sanitizeAngle(input: IvoryAngle | undefined): IvoryAngle {
  if (input && ALLOWED_ANGLES.has(input)) return input;
  return 'unspecified';
}

function sanitizeStatus(input: IvoryStatus): IvoryStatus {
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
export async function createIvoryName(
  baId: string,
  input: CreateIvoryNamePayload,
): Promise<IvoryName> {
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

  const record: IvoryName = {
    ivoryId,
    baId,
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

  await tripleStackWrite({
    id: ivoryId,
    mongoCollection: IVORY_COLLECTION,
    mongoDoc: { ...record },
    neo4j: {
      cypher:
        'MERGE (b:BA {baId: $baId}) ' +
        'MERGE (n:IvoryName {ivoryId: $id}) ' +
        'SET n.baId = $baId, ' +
        '    n.firstName = $firstName, ' +
        '    n.lastInitial = $lastInitial, ' +
        '    n.status = $status, ' +
        '    n.preferredAngle = $preferredAngle, ' +
        '    n.createdAt = $createdAt ' +
        'MERGE (b)-[r:KNOWS]->(n) ' +
        'SET r.since = $createdAt',
      params: {
        baId,
        firstName,
        lastInitial,
        status: 'new',
        preferredAngle,
        createdAt: now,
      },
    },
    chroma: {
      collection: CHROMA_COLLECTION,
      document:
        `${firstName} ${lastInitial}. — warm-market name for BA ${baId}. ` +
        `Categories: ${categories.join(', ') || 'unspecified'}. ` +
        `Preferred angle: ${preferredAngle}. ` +
        (notes ? `Notes: ${notes}.` : 'No notes yet.'),
      metadata: {
        kind: 'ivory_name_created',
        ivoryId,
        baId,
        preferredAngle,
        createdAt: now,
      },
    },
  });

  return record;
}

/**
 * List the authed BA's Ivory roster, newest-touched first. No pagination —
 * roster sizes are expected to fit comfortably in one fetch (<500 names per
 * BA). If that assumption breaks, add a server-side limit/offset.
 */
export async function listIvoryNamesForBA(baId: string): Promise<IvoryName[]> {
  const res = await gatewayCall<{
    count: number;
    documents: Array<IvoryName & { _id?: unknown }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { baId },
    sort: { lastTouchedAt: -1 },
    limit: 1000,
  });

  return res.documents.map((d) => stripMongoMeta(d));
}

/** Fetch one Ivory record by id, enforcing BA ownership. */
export async function getIvoryName(
  ivoryId: string,
  baId: string,
): Promise<IvoryName> {
  const res = await gatewayCall<{
    count: number;
    documents: Array<IvoryName & { _id?: unknown }>;
  }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
    limit: 1,
  });

  const doc = res.documents[0];
  if (!doc) throw new IvoryNotFoundError(ivoryId);
  if (doc.baId !== baId) throw new IvoryOwnershipError(ivoryId);
  return stripMongoMeta(doc);
}

/**
 * Edit name/notes/categories/preferredAngle on an existing record. Status
 * goes through updateIvoryStatus so the audit trail can stay clean.
 */
export async function updateIvoryName(
  ivoryId: string,
  baId: string,
  patch: UpdateIvoryNamePayload,
): Promise<IvoryName> {
  const existing = await getIvoryName(ivoryId, baId);
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

  const next: IvoryName = {
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

  await gatewayCall('mongodb', 'update', {
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

  // Mirror display fields onto the graph node so cypher walks return current
  // names without a Mongo round-trip.
  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (n:IvoryName {ivoryId: $ivoryId}) ' +
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
  baId: string,
  status: IvoryStatus,
): Promise<IvoryName> {
  const validated = sanitizeStatus(status);
  const existing = await getIvoryName(ivoryId, baId);
  const now = new Date().toISOString();
  const next: IvoryName = {
    ...existing,
    status: validated,
    lastTouchedAt: now,
    updatedAt: now,
  };

  await gatewayCall('mongodb', 'update', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
    update: { $set: { status: validated, lastTouchedAt: now, updatedAt: now } },
  });

  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (n:IvoryName {ivoryId: $ivoryId}) ' +
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
  baId: string,
  prospectId: string,
): Promise<IvoryName> {
  const existing = await getIvoryName(ivoryId, baId);
  const now = new Date().toISOString();
  const next: IvoryName = {
    ...existing,
    status: 'invited',
    lastProspectId: prospectId,
    lastTouchedAt: now,
    updatedAt: now,
  };

  await gatewayCall('mongodb', 'update', {
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

  await gatewayCall('neo4j', 'cypher', {
    query:
      'MATCH (n:IvoryName {ivoryId: $ivoryId}) ' +
      'MATCH (p:Prospect {prospectId: $prospectId}) ' +
      'SET n.status = $status, n.lastProspectId = $prospectId, n.updatedAt = $updatedAt ' +
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
  baId: string,
): Promise<void> {
  // Ownership check (also throws IvoryNotFoundError if missing).
  await getIvoryName(ivoryId, baId);

  await gatewayCall('mongodb', 'delete', {
    database: MONGO_DB,
    collection: IVORY_COLLECTION,
    filter: { ivoryId },
  });

  await gatewayCall('neo4j', 'cypher', {
    query: 'MATCH (n:IvoryName {ivoryId: $ivoryId}) DETACH DELETE n',
    params: { ivoryId },
  });
}

function stripMongoMeta<T extends { _id?: unknown }>(doc: T): IvoryName {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _id, ...rest } = doc;
  return rest as unknown as IvoryName;
}

// ───────────────────────────────────────────────────────────────────────
// COACH
// ───────────────────────────────────────────────────────────────────────

/**
 * Stable cacheable system prefix for the Ivory coach. Encodes the role,
 * the WDYK posture, and the compliance rules. KEEP STABLE so prompt
 * caching hits across calls — only the per-call user turn varies.
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

const ANGLE_LABEL: Record<IvoryAngle, string> = {
  do_the_business: 'do the business with you',
  make_money: 'are open to a real way to make money',
  lose_fat: 'have mentioned wanting to lose fat or feel better',
  unspecified: 'fit no particular angle yet',
};

function buildCoachUserTurn(input: IvoryCoachPayload): string {
  const lines = [
    `BA angle: people who might ${ANGLE_LABEL[input.angle]}.`,
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
function neutralCoach(input: IvoryCoachPayload): IvoryCoachResponse {
  const angle = ANGLE_LABEL[input.angle];
  const productLine = input.productName
    ? `When you think about ${input.productName}, `
    : 'When you think about who might be ready for a change, ';
  return {
    ok: true,
    coaching:
      `${productLine}let your memory wander a little wider than usual. ` +
      `You're looking for people who ${angle} — and almost always there are ` +
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

export async function ivoryCoach(
  input: IvoryCoachPayload,
): Promise<IvoryCoachResponse> {
  try {
    const { text } = await complete({
      system: COACH_SYSTEM_PREFIX,
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
