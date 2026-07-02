/**
 * Cockpit Today's Actions — DERIVED card (Chat #134, wireframe 3.3, locked-
 * spec 1.8/1.9, 3.7, 3.10).
 *
 * A derived projection over existing collections — NOT a new entity, no new
 * state on the prospect doc. Three sources, merged into one urgency-ordered
 * list with an explicit bias prompt for the empty case:
 *
 *   1. callback_requests   — a raised hand (locked-spec 1.8 priority #1).
 *                            Latest unhandled intent per prospect, last 14d.
 *   2. crm_followups        — BA-set reminders whose dueAt has elapsed.
 *   3. prospects.expiresAt  — non-terminal windows closing within 7 days
 *                            (8-week consideration window, locked-spec 3.7).
 *
 * When all three buckets are empty, the card still renders — with the
 * locked-spec 1.9 bias prompt ("Who are you sharing with today?"). The
 * card's job is to keep the BA pointed at the next share even when their
 * pipeline is quiet.
 *
 * Sponsor immutability (locked-spec 3.5): the BA id is the authed session
 * tmagId — every query filters on it; nothing in a request body can widen
 * the result set to another BA's pipeline.
 *
 * Compliance (locked-spec 3.10): BA-facing surface only. Action labels are
 * funnel progress, never earnings — "asked for a callback", "follow-up due",
 * "window closes soon".
 *
 * Mirrors domain/crm.ts → getTodaysActions for the callback + follow-up
 * fan-out; that one is the Chat #132 inline predecessor and still serves
 * /api/crm/today. This module's third bucket is the #134 spec change:
 * expiring (not draft).
 *
 * Gateway quirks (per tripleStack.ts header):
 *   - mongodb.query filter param is `filter`, returns {count, documents}
 */

import { gatewayCall } from '../services/gateway.js';
import type {
  McsCallbackIntent,
  McsCockpitActionItem,
  McsCockpitTodaysActionsResponse,
  McsCrmFollowUpRecord,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'tmag_prospects';
const CALLBACK_COLLECTION = 'tmag_prospect_callback_requests';
const FOLLOWUPS_COLLECTION = 'tmag_prospect_crm_followups';

/** 7 days — how far ahead an expiring window counts as "today's concern". */
const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** 14 days — how far back a callback still counts as a raised hand. */
const CALLBACK_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

/** Locked-spec 1.9. Centralized so client and server never drift. */
export const BIAS_PROMPT = 'Who are you sharing with today?';

interface CallbackDoc {
  prospectId: string;
  intent: McsCallbackIntent;
  createdAt: string;
}

interface ProspectDoc {
  prospectId: string;
  firstName: string;
  lastName?: string;
  lastInitial?: string;
  state: string;
  sentAt?: string | null;
  expiresAt: string;
  createdAt: string;
}

/**
 * Build the cockpit's Today's Actions payload for a BA.
 *
 * Sort order (load-bearing):
 *   - tier order is callback > followup > expiring (urgency)
 *   - within callback: newest createdAt first (a hand just raised wins)
 *   - within followup: oldest dueAt first (most overdue wins)
 *   - within expiring: nearest expiresAt first (closest to closing wins)
 */
export async function getCockpitTodaysActions(
  sponsorTmagId: string,
): Promise<McsCockpitTodaysActionsResponse> {
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const callbackLookbackIso = new Date(now - CALLBACK_LOOKBACK_MS).toISOString();
  const expiringHorizonIso = new Date(now + EXPIRING_WINDOW_MS).toISOString();

  const [callbacksRes, followupsRes, prospectsRes] = await Promise.all([
    gatewayCall<{ documents: CallbackDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: CALLBACK_COLLECTION,
      filter: { sponsorTmagId, createdAt: { $gte: callbackLookbackIso } },
      sort: { createdAt: -1 },
      limit: 200,
    }),
    gatewayCall<{ documents: McsCrmFollowUpRecord[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { sponsorTmagId, clearedAt: null, dueAt: { $lte: nowIso } },
      sort: { dueAt: 1 },
      limit: 200,
    }),
    gatewayCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { sponsorTmagId },
      sort: { expiresAt: 1 },
      limit: 1000,
    }),
  ]);

  // prospectId → display info, single source of truth so the three buckets
  // never disagree on a name.
  const prospectInfo = new Map<
    string,
    {
      firstName: string;
      lastInitial: string;
      state: string;
      expiresAt: string;
    }
  >();
  for (const p of prospectsRes.documents ?? []) {
    prospectInfo.set(p.prospectId, {
      firstName: p.firstName,
      lastInitial:
        p.lastInitial ??
        (p.lastName ? p.lastName.trim().charAt(0).toUpperCase() : ''),
      state: p.state,
      expiresAt: p.expiresAt,
    });
  }

  // 1. Callbacks — collapse to latest per prospect.
  const callbackItems: McsCockpitActionItem[] = [];
  const seenCallback = new Set<string>();
  for (const cb of callbacksRes.documents ?? []) {
    if (seenCallback.has(cb.prospectId)) continue;
    seenCallback.add(cb.prospectId);
    const info = prospectInfo.get(cb.prospectId);
    if (!info) continue;
    callbackItems.push({
      kind: 'callback',
      prospectId: cb.prospectId,
      firstName: info.firstName,
      lastInitial: info.lastInitial,
      at: cb.createdAt,
      intent: cb.intent,
    });
  }

  // 2. Follow-ups due — already filtered server-side by dueAt <= now and
  // clearedAt null. Suppress the row when the same prospect is already on
  // the callback list (a raised hand subsumes the follow-up nudge).
  const followupItems: McsCockpitActionItem[] = [];
  for (const f of followupsRes.documents ?? []) {
    if (seenCallback.has(f.prospectId)) continue;
    const info = prospectInfo.get(f.prospectId);
    if (!info) continue;
    followupItems.push({
      kind: 'followup',
      prospectId: f.prospectId,
      firstName: info.firstName,
      lastInitial: info.lastInitial,
      at: f.dueAt,
      followUpDueAt: f.dueAt,
    });
  }

  // 3. Expiring — non-terminal prospects whose 8-week window closes within
  // the horizon. Skip if already surfaced as callback or followup so the
  // same person doesn't show twice on one card.
  const followupSet = new Set(followupItems.map((i) => i.prospectId));
  const expiringItems: McsCockpitActionItem[] = [];
  for (const p of prospectsRes.documents ?? []) {
    if (p.state === 'enrolled' || p.state === 'expired') continue;
    if (!p.expiresAt) continue;
    if (p.expiresAt > expiringHorizonIso) continue;
    if (p.expiresAt <= nowIso) continue;
    if (seenCallback.has(p.prospectId)) continue;
    if (followupSet.has(p.prospectId)) continue;
    const info = prospectInfo.get(p.prospectId);
    if (!info) continue;
    expiringItems.push({
      kind: 'expiring',
      prospectId: p.prospectId,
      firstName: info.firstName,
      lastInitial: info.lastInitial,
      at: p.expiresAt,
      expiresAt: p.expiresAt,
    });
  }

  return {
    ok: true,
    actions: [...callbackItems, ...followupItems, ...expiringItems],
    biasPrompt: BIAS_PROMPT,
  };
}
