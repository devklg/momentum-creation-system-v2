/**
 * Ivory Prospect Momentum Agent (feature/ivory-momentum-agent).
 *
 * The post-mint companion to the pre-mint Ivory Invitation Agent (domain/ivory.ts).
 * Once a BA mints a `source: 'ivory'` invitation, this module is what surfaces
 * the prospect's lifecycle, prioritizes follow-up moments, and (on demand) drafts
 * one short "what to say next" suggestion the BA can adapt and send manually.
 *
 * Single-source-of-truth composition:
 *   getProspectMomentumViewer(baId)  →  canonical PMV rows + nextAction model
 *     +
 *   listIvoryNamesForBA(baId)        →  warm-market context (categories, angle,
 *                                       memory note) keyed by lastProspectId
 *     =
 *   IvoryMomentumViewResponse        →  cohort-filtered, context-enriched rows
 *
 * The Momentum agent NEVER:
 *   - recomputes lifecycle or nextAction (the PMV projection is authoritative);
 *   - auto-sends a follow-up (the BA copies, adapts, sends from their own phone);
 *   - scores or ranks the prospect as a person (compliance — locked-spec 3.10);
 *   - speaks income, comp, placement, cycles, medical claims (3.10/3.11).
 *
 * Ownership: every read filters on req.session.baId. The PMV projection is
 * already sponsorBaId-scoped; the Ivory roster query is baId-scoped; the
 * single-prospect suggest path validates that the prospect's sponsorBaId
 * matches the session BA before any LLM call.
 *
 * Dormant-aware: when ANTHROPIC_API_KEY is unset OR the API errors, the
 * suggest path returns a deterministic, compliance-safe fallback string with
 * degraded=true (mirrors ivoryCoach / scriptmaker behavior).
 */

import { gatewayCall } from '../services/gateway.js';
import { getProspectMomentumViewer } from './cockpit.js';
import { listIvoryNamesForBA } from './ivory.js';
import { ANGLE_LABEL } from './ivoryAngle.js';
import {
  complete,
  AnthropicConfigError,
  AnthropicError,
} from '../services/anthropic.js';
import type {
  IvoryMomentumCohortCounts,
  IvoryMomentumContext,
  IvoryMomentumPriorityReason,
  IvoryMomentumRow,
  IvoryMomentumSuggestionPayload,
  IvoryMomentumSuggestionResponse,
  IvoryMomentumViewResponse,
  IvoryName,
  ProspectLifecycleStage,
  ProspectMomentumRow,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'prospects';

// ───────────────────────────────────────────────────────────────────────
// Errors
// ───────────────────────────────────────────────────────────────────────

export class IvoryMomentumNotFoundError extends Error {
  constructor(public readonly prospectId: string) {
    super(`ivory_momentum_not_found: ${prospectId}`);
    this.name = 'IvoryMomentumNotFoundError';
  }
}

export class IvoryMomentumOwnershipError extends Error {
  constructor(public readonly prospectId: string) {
    super(`ivory_momentum_ownership_mismatch: ${prospectId}`);
    this.name = 'IvoryMomentumOwnershipError';
  }
}

export class IvoryMomentumValidationError extends Error {
  constructor(public readonly code: string) {
    super(`ivory_momentum_validation: ${code}`);
    this.name = 'IvoryMomentumValidationError';
  }
}

// ───────────────────────────────────────────────────────────────────────
// Cohort assembly
// ───────────────────────────────────────────────────────────────────────

const TWO_DAY_MS = 2 * 24 * 60 * 60 * 1000;
const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Derive the relational priority reason for an Ivory-sourced prospect. This is
 * the "why this row is in the focus queue" phrase the UI shows — independent
 * from the generic PMV `nextAction.reason` so the Ivory page reads relationally
 * ("Jordan watched") rather than operationally ("call now"). Returns null when
 * the row is in a terminal state and should not appear in the queue.
 */
function derivePriorityReason(
  pmv: ProspectMomentumRow,
  nowMs: number,
): IvoryMomentumPriorityReason | null {
  if (
    pmv.lifecycle === 'enrolled' ||
    pmv.lifecycle === 'customer' ||
    pmv.lifecycle === 'archived'
  ) {
    return null;
  }
  if (pmv.lifecycle === 'callback_requested') return 'callback_raised';
  if (pmv.lifecycle === 'watched') return 'video_watched';
  if (pmv.crm.followUpIsDue) return 'follow_up_due';
  if (
    pmv.lifecycle === 'video_started' ||
    pmv.lifecycle === 'video_25' ||
    pmv.lifecycle === 'video_50' ||
    pmv.lifecycle === 'video_75'
  ) {
    return 'video_partial';
  }
  if (pmv.lifecycle === 'clicked') return 'clicked_no_watch';
  if (pmv.lifecycle === 'expired') return 'expired_consider_reinvite';

  if (pmv.lifecycle === 'sent_unopened') {
    if (pmv.sentAt && nowMs - new Date(pmv.sentAt).getTime() >= TWO_DAY_MS) {
      return 'sent_no_open';
    }
    return null;
  }

  if (pmv.lifecycle === 'draft') return 'draft_unsent';

  // Anything still active but with no momentum signal: if it's within the
  // expiring horizon, surface that fact so the BA doesn't lose the window.
  if (pmv.expiresAt && new Date(pmv.expiresAt).getTime() - nowMs <= EXPIRING_WINDOW_MS) {
    return 'expiring_soon';
  }

  return null;
}

const PRIORITY_RANK: Record<IvoryMomentumPriorityReason, number> = {
  callback_raised: 6,
  video_watched: 5,
  follow_up_due: 5,
  video_partial: 4,
  clicked_no_watch: 3,
  sent_no_open: 3,
  expiring_soon: 2,
  draft_unsent: 2,
  expired_consider_reinvite: 1,
};

/**
 * Build the per-row IvoryMomentumContext from the IvoryName whose lastProspectId
 * points at this prospect. Returns a null-context row when no IvoryName link
 * exists (legacy Ivory mints from before the link existed, or admin overrides) —
 * the cohort still shows the prospect because source='ivory' is on the spine.
 * relationshipReason is read off the PMV row's optional field (Chat #131+).
 */
function buildContext(
  pmv: ProspectMomentumRow,
  byLastProspectId: Map<string, IvoryName>,
): IvoryMomentumContext {
  const link = byLastProspectId.get(pmv.prospectId) ?? null;
  return {
    ivoryId: link?.ivoryId ?? null,
    categories: link?.categories ?? [],
    preferredAngle: link?.preferredAngle ?? null,
    memoryNote: link?.notes && link.notes.trim() ? link.notes : null,
    relationshipReason: pmv.relationshipReason ?? null,
  };
}

function buildCohortCounts(rows: IvoryMomentumRow[]): IvoryMomentumCohortCounts {
  const counts: IvoryMomentumCohortCounts = {
    total: rows.length,
    draft: 0,
    sentUnopened: 0,
    clicked: 0,
    videoInProgress: 0,
    watched: 0,
    callbackRaised: 0,
    enrolled: 0,
    customer: 0,
    expired: 0,
    archived: 0,
  };
  for (const row of rows) {
    switch (row.pmv.lifecycle) {
      case 'draft':
        counts.draft += 1;
        break;
      case 'sent_unopened':
        counts.sentUnopened += 1;
        break;
      case 'clicked':
        counts.clicked += 1;
        break;
      case 'video_started':
      case 'video_25':
      case 'video_50':
      case 'video_75':
        counts.videoInProgress += 1;
        break;
      case 'watched':
        counts.watched += 1;
        break;
      case 'callback_requested':
        counts.callbackRaised += 1;
        break;
      case 'enrolled':
        counts.enrolled += 1;
        break;
      case 'customer':
        counts.customer += 1;
        break;
      case 'expired':
        counts.expired += 1;
        break;
      case 'archived':
        counts.archived += 1;
        break;
    }
  }
  return counts;
}

/**
 * GET /api/ivory/momentum read model.
 *
 * Composes the canonical PMV projection (single source of truth for lifecycle
 * + nextAction) with the BA's Ivory roster to attach warm-market context to
 * every Ivory-sourced row. Cohort filter is `pmv.source === 'ivory'`.
 */
export async function getIvoryMomentumView(
  baId: string,
): Promise<IvoryMomentumViewResponse> {
  const [pmv, ivoryNames] = await Promise.all([
    getProspectMomentumViewer(baId),
    listIvoryNamesForBA(baId),
  ]);

  const byLastProspectId = new Map<string, IvoryName>();
  for (const name of ivoryNames) {
    if (name.lastProspectId) byLastProspectId.set(name.lastProspectId, name);
  }

  const nowMs = Date.now();
  const ivoryRows: IvoryMomentumRow[] = pmv.rows
    .filter((row) => row.source === 'ivory')
    .map((row) => ({
      prospectId: row.prospectId,
      pmv: row,
      ivory: buildContext(row, byLastProspectId),
      priorityReason: derivePriorityReason(row, nowMs),
    }));

  const focusQueue = ivoryRows
    .filter((row) => row.priorityReason !== null)
    .sort((a, b) => {
      const ra = PRIORITY_RANK[a.priorityReason!];
      const rb = PRIORITY_RANK[b.priorityReason!];
      if (ra !== rb) return rb - ra;
      // Same reason — newer signal wins so a fresh hand-raise leads.
      const ats = a.pmv.lastSignal.at;
      const bts = b.pmv.lastSignal.at;
      if (ats !== bts) return ats < bts ? 1 : -1;
      if (a.pmv.createdAt !== b.pmv.createdAt) {
        return a.pmv.createdAt < b.pmv.createdAt ? 1 : -1;
      }
      // Fully equal — return 0 so the comparator is antisymmetric (a stable,
      // deterministic order for tied rows instead of implementation-defined).
      return 0;
    })
    .slice(0, 12);

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    counts: buildCohortCounts(ivoryRows),
    focusQueue,
    rows: ivoryRows,
  };
}

// ───────────────────────────────────────────────────────────────────────
// Single-prospect suggest
// ───────────────────────────────────────────────────────────────────────

interface ProspectOwnershipDoc {
  prospectId: string;
  sponsorBaId: string;
}

/**
 * Confirm the prospect belongs to the authed BA. The PMV projection is already
 * sponsorBaId-scoped, but the suggest path lets the route accept a prospectId
 * from the URL — defense-in-depth is cheap and locked-spec 3.5 demands it.
 */
async function assertProspectOwnership(
  prospectId: string,
  baId: string,
): Promise<void> {
  const res = await gatewayCall<{ documents: ProspectOwnershipDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { prospectId },
      limit: 1,
    },
  );
  const doc = res.documents?.[0];
  if (!doc) throw new IvoryMomentumNotFoundError(prospectId);
  if (doc.sponsorBaId !== baId) {
    throw new IvoryMomentumOwnershipError(prospectId);
  }
}

const LIFECYCLE_DESCRIPTION: Record<ProspectLifecycleStage, string> = {
  draft: 'You have a minted invitation that has not been marked sent yet.',
  sent_unopened: 'The invitation was sent but the link has not been opened.',
  clicked: 'They opened the link but have not started the video.',
  video_started: 'They started the video but have barely begun it.',
  video_25: 'They are about a quarter of the way through the video.',
  video_50: 'They are about half-way through the video.',
  video_75: 'They are about three-quarters of the way through the video.',
  watched: 'They watched the full video and have NOT raised a callback yet.',
  callback_requested: 'They raised a hand and asked you to follow up.',
  customer: 'They are already a customer — this row is terminal.',
  enrolled: 'They are already enrolled — this row is terminal.',
  expired: 'Their consideration window has expired.',
  archived: 'This prospect has been archived.',
};

/**
 * Stable, code-owned system prefix for the Ivory Momentum Agent. Mirrors the
 * pattern in domain/ivory.ts COACH_SYSTEM_PREFIX — the parts the parser and
 * the compliance posture depend on stay immovable; the LLM is given the
 * freedom to vary tone within those guardrails. Cacheable by design (Chat
 * #118 prompt-cache lock).
 */
const SUGGEST_SYSTEM_PREFIX = [
  'You are IVORY, a private follow-up companion for Team Magnificent Brand',
  'Ambassadors. A Brand Ambassador (BA) already sent an invitation to ONE',
  'warm-market person. Your job is to suggest one short, warm follow-up',
  'message the BA can adapt and send manually to keep the conversation alive.',
  '',
  'WHAT GOOD FOLLOW-UP LOOKS LIKE:',
  '- One short message (1–3 sentences). The BA edits before sending.',
  '- References the SPECIFIC prospect lifecycle signal you are told (they',
  '  watched the video / they opened but did not play it / they asked for a',
  '  callback / they have not replied since send).',
  '- Tone is warm and low-pressure — the way you would text a friend, not the',
  '  way you would pitch a stranger.',
  '- Acknowledges the relationship context the BA captured (the "why" they',
  '  came to mind) WITHOUT quoting it verbatim back at them.',
  '',
  'HARD COMPLIANCE RULES — NEVER violate these:',
  '- NEVER state, imply, or hint at income, earnings, money outcomes,',
  '  commissions, cycles, ranks, bonuses, queue position, placement,',
  '  spillover, or any business/financial promise.',
  '- NEVER make medical, weight-loss, or treatment claims or guarantees.',
  '- NEVER use scarcity, urgency, fear-of-missing-out, or guilt tactics.',
  '- NEVER score, rank, or rate the prospect.',
  '- NEVER promise to send, call, or follow up on the BA\'s behalf — the BA',
  '  sends the message themselves.',
  '- NEVER write more than three sentences in the suggestion field.',
  '',
  'OUTPUT FORMAT (very important):',
  'Return ONLY a JSON object with exactly two keys:',
  '  {"coaching": "<1-2 sentence frame to the BA>", "suggestion": "<message text>"}',
  'No preamble, no markdown, no code fences, no commentary outside the JSON.',
].join('\n');

function buildSuggestUserTurn(input: {
  prospect: ProspectMomentumRow;
  context: IvoryMomentumContext;
  ask: string | null;
}): string {
  const { prospect, context, ask } = input;
  const lines: string[] = [
    `Prospect first name: ${prospect.firstName}`,
    `Current lifecycle: ${prospect.lifecycle} — ${LIFECYCLE_DESCRIPTION[prospect.lifecycle]}`,
    `Last signal: ${prospect.lastSignal.label} (${prospect.lastSignal.at})`,
  ];
  if (context.preferredAngle) {
    lines.push(`BA's chosen angle for this person: ${ANGLE_LABEL[context.preferredAngle]}.`);
  }
  if (context.categories.length > 0) {
    lines.push(`Relationship categories: ${context.categories.join(', ')}.`);
  }
  if (context.relationshipReason) {
    lines.push(`Why this person came to mind: ${context.relationshipReason}`);
  } else if (context.memoryNote) {
    lines.push(`BA's memory note on this person: ${context.memoryNote}`);
  }
  if (ask) {
    lines.push(`BA added context: "${ask}"`);
  }
  lines.push('', 'Return the JSON object now.');
  return lines.join('\n');
}

interface SuggestJsonShape {
  coaching?: unknown;
  suggestion?: unknown;
}

function parseSuggestJson(
  raw: string,
): { coaching: string; suggestion: string } | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: SuggestJsonShape;
  try {
    parsed = JSON.parse(stripped) as SuggestJsonShape;
  } catch {
    return null;
  }
  if (typeof parsed.coaching !== 'string') return null;
  if (typeof parsed.suggestion !== 'string') return null;
  const coaching = parsed.coaching.trim();
  const suggestion = parsed.suggestion.trim();
  if (!coaching || !suggestion) return null;
  return { coaching, suggestion: suggestion.slice(0, 600) };
}

/**
 * Deterministic, compliance-safe fallback. Used when ANTHROPIC_API_KEY is
 * unset, the API errors, or the LLM returns non-JSON. The text names no
 * outcomes, makes no claims, and reads as a real human note. Same posture as
 * neutralCoach() in domain/ivory.ts.
 */
function neutralSuggestion(
  prospect: ProspectMomentumRow,
): IvoryMomentumSuggestionResponse {
  const first = prospect.firstName;
  const stage = prospect.lifecycle;

  let coaching = '';
  let suggestion = '';

  switch (stage) {
    case 'callback_requested':
      coaching = `${first} asked for a follow-up. Lead with the conversation, not the link.`;
      suggestion =
        `Hey ${first}, thanks for raising your hand. When's a good 10-minute window today or tomorrow to talk it through? Want to make sure I answer your real questions, not the generic ones.`;
      break;
    case 'watched':
      coaching = `${first} watched the whole video. Open a real conversation about what landed.`;
      suggestion =
        `Hey ${first}, saw you got through the whole thing — appreciate you taking the time. What stood out, and what's still a question for you? Happy to jump on a quick call if it's easier.`;
      break;
    case 'video_started':
    case 'video_25':
    case 'video_50':
    case 'video_75':
      coaching = `${first} started but didn't finish. Don't pressure — just open a door.`;
      suggestion =
        `Hey ${first}, no rush — wanted to check in once you've had a chance to finish. Even a one-line reaction helps me know if I should keep you in the loop or not.`;
      break;
    case 'clicked':
      coaching = `${first} opened the link but hasn't played the video. Make it easy to say yes.`;
      suggestion =
        `Hey ${first}, just making sure my link worked on your end. The video is only about 15 minutes — let me know what you think when you get a chance.`;
      break;
    case 'sent_unopened':
      coaching = `Your message landed but hasn't been opened. Re-surface gently.`;
      suggestion =
        `Hey ${first}, no pressure — just want to make sure my last message didn't get buried. Let me know if right now isn't the time and I'll circle back.`;
      break;
    case 'draft':
      coaching = `You haven't marked this one sent yet. Once you send it from your own phone, come back and mark it sent.`;
      suggestion =
        `Hey ${first}, the message draft is ready in Ivory — send it from your own phone, then mark it sent so the timeline starts.`;
      break;
    case 'expired':
      coaching = `${first}'s window has expired. A re-invite is only worth it if you have something new to say.`;
      suggestion =
        `Hey ${first}, totally understand you didn't get to it last time — life happens. If anything's changed and you want a fresh look, let me know and I'll send a new link.`;
      break;
    case 'customer':
    case 'enrolled':
    case 'archived':
      coaching = `${first} is in a terminal state — no follow-up needed here.`;
      suggestion = `No follow-up needed for ${first}.`;
      break;
  }

  return {
    ok: true,
    prospectId: prospect.prospectId,
    lifecycle: stage,
    coaching,
    suggestion,
    degraded: true,
  };
}

const ASK_MAX = 600;

/**
 * POST /api/ivory/momentum/:prospectId/suggest.
 *
 * Asks the Ivory Momentum Agent for one warm, compliance-safe follow-up the BA
 * can adapt and send manually. Reads the prospect's current lifecycle off the
 * canonical PMV projection so it can never disagree with what the cockpit
 * shows. Degrades to a deterministic suggestion when the LLM is unavailable.
 */
export async function suggestIvoryMomentumFollowUp(
  baId: string,
  prospectId: string,
  input: IvoryMomentumSuggestionPayload,
): Promise<IvoryMomentumSuggestionResponse> {
  if (!prospectId) {
    throw new IvoryMomentumValidationError('invalid_prospect_id');
  }
  const ask = typeof input.ask === 'string' ? input.ask.trim() : '';
  if (ask.length > ASK_MAX) {
    throw new IvoryMomentumValidationError('ask_too_long');
  }

  await assertProspectOwnership(prospectId, baId);

  // Reuse the canonical PMV projection so the suggest path NEVER disagrees
  // with the cockpit's lifecycle/lastSignal. Same call the cohort view makes.
  const pmv = await getProspectMomentumViewer(baId);
  const row = pmv.rows.find((r) => r.prospectId === prospectId);
  if (!row) throw new IvoryMomentumNotFoundError(prospectId);
  if (row.source !== 'ivory') {
    throw new IvoryMomentumValidationError('not_ivory_sourced');
  }

  // Re-pull the Ivory link so we have the full memory note + categories +
  // angle. The cohort view already does this, but the suggest path may be
  // called directly without the cohort having been computed in the same tick.
  const ivoryNames = await listIvoryNamesForBA(baId);
  const byLastProspectId = new Map<string, IvoryName>();
  for (const name of ivoryNames) {
    if (name.lastProspectId) byLastProspectId.set(name.lastProspectId, name);
  }
  const context = buildContext(row, byLastProspectId);

  try {
    const { text } = await complete({
      system: SUGGEST_SYSTEM_PREFIX,
      messages: [
        {
          role: 'user',
          content: buildSuggestUserTurn({
            prospect: row,
            context,
            ask: ask || null,
          }),
        },
      ],
      maxTokens: 360,
    });
    const parsed = parseSuggestJson(text);
    if (!parsed) {
      // eslint-disable-next-line no-console
      console.warn('[ivory.momentum.suggest] non-JSON response, using fallback');
      return neutralSuggestion(row);
    }
    return {
      ok: true,
      prospectId: row.prospectId,
      lifecycle: row.lifecycle,
      coaching: parsed.coaching,
      suggestion: parsed.suggestion,
      degraded: false,
    };
  } catch (err) {
    if (err instanceof AnthropicConfigError || err instanceof AnthropicError) {
      // eslint-disable-next-line no-console
      console.warn(
        '[ivory.momentum.suggest] LLM unavailable, using fallback:',
        err.message,
      );
      return neutralSuggestion(row);
    }
    throw err;
  }
}
