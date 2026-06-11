/**
 * Cockpit read-side domain (Chat #121).
 *
 * The READ counterpart to the Chat #119/#120 invitation spine. The spine
 * mints prospects, stamps sentAt, and appends the invitation_activity
 * timeline; this module reads it all back for the BA-facing cockpit.
 *
 * Sponsor immutability (locked-spec 3.5): every query here filters on the
 * authed session BA's baId. The route passes req.session.baId; nothing in a
 * request body can widen the result set to another BA's prospects.
 *
 * Compliance (locked-spec 3.10): this is a .team BA-facing surface, NOT .com.
 * It surfaces the prospect's own contact, funnel status, and the saved
 * message. It makes no income/placement claim — status is funnel progress,
 * never earnings.
 *
 * Read pattern mirrors domain/ba.ts: gatewayCall('mongodb','query',{filter,
 * sort,limit}); Mongo query param is `filter`, not `query` (gateway quirk).
 */

import { gatewayCall } from '../services/gateway.js';
import { findBAByBaId, type BARecord } from './ba.js';
import { lastInitialOf } from './prospects.js';
import { getMichaelSchedule } from './michael-schedule.js';
import { getFastStartProgress } from './training.js';
import { questionnaireExists } from './questionnaire.js';
import type {
  CallbackIntent,
  CockpitSponsorFallback,
  CockpitActionItem,
  CockpitSummaryResponse,
  CockpitTodaysActionsResponse,
  CrmDisposition,
  CrmFollowUpRecord,
  InvitationActivityEntry,
  InviteDisplayStatus,
  InviteTokenRecord,
  InviteSummary,
  MyInvitesResponse,
  ProspectFocusQueueItem,
  ProspectLastSignal,
  ProspectLifecycleStage,
  ProspectMomentumCrmSummary,
  ProspectMomentumRow,
  ProspectMomentumViewerResponse,
  ProspectNextAction,
  SponsorFallbackFounder,
  LaunchNextAction,
  LaunchStep,
  LaunchStepId,
  TeamLaunchCenterResponse,
  TokenState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'prospects';
const TOKENS_COLLECTION = 'invite_tokens';
const ACTIVITY_COLLECTION = 'invitation_activity';
const CALLBACK_COLLECTION = 'callback_requests';
const BA_COLLECTION = 'brand_ambassadors';
const FOLLOWUPS_COLLECTION = 'crm_followups';
const DISPOSITIONS_COLLECTION = 'crm_dispositions';
const NOTES_COLLECTION = 'crm_notes';
const COMMITMENTS_COLLECTION = 'ba_commitments';
const IVORY_COLLECTION = 'ivory_names';

/**
 * Sponsor-inactive dormancy window for the founder fallback (Chat #147, seq 23,
 * dec_cockpit_sponsor_and_reinvite). Kevin's lock: a sponsor counts as inactive
 * if Kevin has SUSPENDED or DELETED them from /admin, OR they've gone dormant —
 * no .team login in 120 days. This is intentionally MUCH longer than the
 * 24h admin "active now" presence window (adminBaOversight.ts) — that stat is
 * for real-time presence; this is "has my sponsor genuinely gone quiet?" and
 * must not fire on normal day-to-day gaps.
 */
const SPONSOR_DORMANT_MS = 120 * 24 * 60 * 60 * 1000;

/**
 * Lifecycle fields the founder-fallback check reads off a sponsor's BA record.
 * They aren't on the lean BARecord type (suspended/deleted are admin-set), so
 * we read them defensively off the raw doc.
 */
interface BaLifecycleExtras {
  role?: string;
  suspended?: boolean;
  deleted?: boolean;
}

/**
 * Is this sponsor inactive for the founder-fallback (Chat #147, seq 23)?
 * Founders are NEVER inactive here — they ARE the fallback, and a founder
 * pointing a BA back to founders is nonsensical. Otherwise: suspended OR
 * admin-deleted OR dormant 120+ days. A null lastLoginAt is NOT treated as
 * inactive (a brand-new sponsor or a founder may simply not have a login
 * stamp yet) — only a measured 120-day lapse counts.
 */
function isSponsorInactive(sp: BARecord): boolean {
  const extras = sp as BARecord & BaLifecycleExtras;
  if (extras.role === 'founder' || extras.role === 'co_leader') return false;
  if (extras.suspended === true) return true;
  if (extras.deleted === true) return true;
  if (sp.lastLoginAt) {
    const since = Date.now() - new Date(sp.lastLoginAt).getTime();
    if (Number.isFinite(since) && since > SPONSOR_DORMANT_MS) return true;
  }
  return false;
}

/**
 * The founders (Kevin + Paul) as the support/contact fallback. Sourced from
 * the brand_ambassadors records seeded by seed-founders.ts (role founder /
 * co_leader), so a leader added later (extensible host model, 3.3) is picked
 * up automatically. Founder role sorts before co_leader so Kevin leads.
 */
async function getFounderContacts(): Promise<SponsorFallbackFounder[]> {
  const res = await gatewayCall<{ documents: Array<BARecord & BaLifecycleExtras> }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: BA_COLLECTION,
      filter: { role: { $in: ['founder', 'co_leader'] }, deleted: { $ne: true } },
      limit: 10,
    },
  );
  const founders = res.documents ?? [];
  founders.sort((a, b) => {
    const rank = (r?: string) => (r === 'founder' ? 0 : 1);
    return rank(a.role) - rank(b.role);
  });
  return founders.map((f) => ({
    fullName: `${f.firstName} ${f.lastName}`.trim(),
    firstName: f.firstName,
    phone: f.phone && f.phone.trim() ? f.phone : null,
  }));
}

/**
 * Shape of the prospect Mongo doc as the spine actually persists it
 * (domain/invitations.ts createInvitation): the shared ProspectRecord plus
 * the spine-side fields sentAt/token/message/source. We read the superset.
 */
interface ProspectDoc {
  prospectId: string;
  firstName: string;
  lastName: string;
  lastInitial?: string;
  location?: { city?: string; stateOrRegion?: string; country?: string };
  sponsorBaId: string;
  state: TokenState;
  positionNumber: number | null;
  becameCustomer?: boolean;
  createdAt: string;
  expiresAt: string;
  // spine-side fields (not on the shared ProspectRecord funnel shape)
  sentAt?: string | null;
  token?: string;
  message?: string | null;
  source?: InviteSummary['source'];
  placedAt?: string | null;
  updatedAt?: string | null;
  deleted?: boolean;
  deletedAt?: string | null;
  becameCustomerAt?: string | null;
}

interface CallbackDoc {
  prospectId: string;
  intent: CallbackIntent;
  createdAt: string;
}

interface TokenProjectionDoc extends InviteTokenRecord {
  updatedAt?: string | null;
}

interface DispositionDoc {
  prospectId: string;
  sponsorBaId: string;
  disposition: CrmDisposition | null;
  updatedAt: string;
}

interface NoteDoc {
  prospectId: string;
  createdAt: string;
}

/**
 * Collapse the token lifecycle rail (+ sentAt, customer, terminal states)
 * into the handful of display states a BA acts on. Order of precedence is
 * deliberate: terminal states win, then a raised hand, then video progress,
 * then sent, then draft.
 */
function computeStatus(
  tokenState: TokenState,
  sentAt: string | null,
  hasCallback: boolean,
): InviteDisplayStatus {
  if (tokenState === 'enrolled') return 'enrolled';
  if (tokenState === 'expired') return 'expired';
  if (hasCallback) return 'callback';
  if (tokenState === 'video_complete') return 'watched';
  if (
    tokenState === 'clicked' ||
    tokenState === 'video_started' ||
    tokenState === 'video_quarter' ||
    tokenState === 'video_half' ||
    tokenState === 'video_three_quarter'
  ) {
    return 'opened';
  }
  // tokenState === 'minted'
  return sentAt ? 'sent' : 'draft';
}

const VIDEO_PROGRESS_BY_STATE: Record<TokenState, ProspectMomentumRow['videoProgressPct']> = {
  minted: null,
  clicked: null,
  video_started: 0,
  video_quarter: 25,
  video_half: 50,
  video_three_quarter: 75,
  video_complete: 100,
  enrolled: 100,
  expired: null,
};

const LAST_SIGNAL_LABEL: Record<ProspectLastSignal['kind'], string> = {
  created: 'Invitation created',
  sent: 'Invitation sent',
  opened: 'Link opened',
  video_started: 'Video started',
  video_25: 'Video 25%',
  video_50: 'Video 50%',
  video_75: 'Video 75%',
  watched: 'Video watched',
  callback_requested: 'Callback requested',
  customer: 'Marked customer',
  enrolled: 'Marked enrolled',
  expired: 'Invitation expired',
  archived: 'Archived',
};

const TWO_DAY_MS = 2 * 24 * 60 * 60 * 1000;
const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const CALLBACK_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const BIAS_PROMPT = 'Who are you sharing with today?';

function currentTokenForProspect(
  prospect: ProspectDoc,
  tokensByToken: Map<string, TokenProjectionDoc>,
  tokensByProspect: Map<string, TokenProjectionDoc[]>,
): TokenProjectionDoc | null {
  if (prospect.token) {
    const current = tokensByToken.get(prospect.token);
    if (current) return current;
  }
  const tokens = tokensByProspect.get(prospect.prospectId) ?? [];
  return tokens[0] ?? null;
}

function lifecycleFor(input: {
  prospect: ProspectDoc;
  token: TokenProjectionDoc | null;
  latestCallbackIntent: CallbackIntent | null;
  nowMs: number;
}): ProspectLifecycleStage {
  const { prospect, token, latestCallbackIntent, nowMs } = input;
  const tokenState = token?.state ?? prospect.state;
  const expiresAtMs = new Date(prospect.expiresAt).getTime();

  if (prospect.deleted === true) return 'archived';
  if (tokenState === 'enrolled' || prospect.state === 'enrolled') return 'enrolled';
  if (prospect.becameCustomer === true) return 'customer';
  if (
    tokenState === 'expired' ||
    prospect.state === 'expired' ||
    (Number.isFinite(expiresAtMs) && expiresAtMs <= nowMs)
  ) {
    return 'expired';
  }
  if (latestCallbackIntent !== null) return 'callback_requested';

  switch (tokenState) {
    case 'clicked':
      return 'clicked';
    case 'video_started':
      return 'video_started';
    case 'video_quarter':
      return 'video_25';
    case 'video_half':
      return 'video_50';
    case 'video_three_quarter':
      return 'video_75';
    case 'video_complete':
      return 'watched';
    case 'minted':
      return prospect.sentAt ? 'sent_unopened' : 'draft';
  }
}

function tokenSignalKind(state: TokenState): ProspectLastSignal['kind'] | null {
  switch (state) {
    case 'clicked':
      return 'opened';
    case 'video_started':
      return 'video_started';
    case 'video_quarter':
      return 'video_25';
    case 'video_half':
      return 'video_50';
    case 'video_three_quarter':
      return 'video_75';
    case 'video_complete':
      return 'watched';
    default:
      return null;
  }
}

function chooseLastSignal(candidates: Array<ProspectLastSignal | null>): ProspectLastSignal {
  const real = candidates.filter((c): c is ProspectLastSignal => c !== null);
  real.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return real[0] ?? {
    kind: 'created',
    label: LAST_SIGNAL_LABEL.created,
    at: new Date(0).toISOString(),
  };
}

function buildLastSignal(input: {
  prospect: ProspectDoc;
  token: TokenProjectionDoc | null;
  latestCallback: CallbackDoc | null;
  latestActivity: InvitationActivityEntry | null;
  lifecycle: ProspectLifecycleStage;
}): ProspectLastSignal {
  const { prospect, token, latestCallback, latestActivity, lifecycle } = input;
  const tokenKind = token ? tokenSignalKind(token.state) : null;
  const tokenAt =
    tokenKind === 'opened'
      ? token?.clickedAt ?? null
      : tokenKind
        ? token?.updatedAt ?? null
        : null;

  const activitySignal =
    latestActivity?.kind === 'video_completed'
      ? {
          kind: 'watched' as const,
          label: LAST_SIGNAL_LABEL.watched,
          at: latestActivity.at,
        }
      : latestActivity?.kind === 'invitation_sent'
        ? {
            kind: 'sent' as const,
            label: LAST_SIGNAL_LABEL.sent,
            at: latestActivity.at,
          }
        : latestActivity?.kind === 'callback_requested'
          ? {
              kind: 'callback_requested' as const,
              label: LAST_SIGNAL_LABEL.callback_requested,
              at: latestActivity.at,
            }
          : null;

  return chooseLastSignal([
    {
      kind: 'created',
      label: LAST_SIGNAL_LABEL.created,
      at: prospect.createdAt,
    },
    prospect.sentAt
      ? {
          kind: 'sent',
          label: LAST_SIGNAL_LABEL.sent,
          at: prospect.sentAt,
        }
      : null,
    tokenKind && tokenAt
      ? {
          kind: tokenKind,
          label: LAST_SIGNAL_LABEL[tokenKind],
          at: tokenAt,
        }
      : null,
    prospect.placedAt
      ? {
          kind: 'watched',
          label: LAST_SIGNAL_LABEL.watched,
          at: prospect.placedAt,
        }
      : null,
    latestActivity ? activitySignal : null,
    latestCallback
      ? {
          kind: 'callback_requested',
          label: LAST_SIGNAL_LABEL.callback_requested,
          at: latestCallback.createdAt,
        }
      : null,
    lifecycle === 'customer' && (prospect.becameCustomerAt ?? prospect.updatedAt)
      ? {
          kind: 'customer',
          label: LAST_SIGNAL_LABEL.customer,
          at: prospect.becameCustomerAt ?? prospect.updatedAt!,
        }
      : null,
    lifecycle === 'enrolled' && (prospect.updatedAt ?? token?.updatedAt)
      ? {
          kind: 'enrolled',
          label: LAST_SIGNAL_LABEL.enrolled,
          at: prospect.updatedAt ?? token!.updatedAt!,
        }
      : null,
    lifecycle === 'expired'
      ? {
          kind: 'expired',
          label: LAST_SIGNAL_LABEL.expired,
          at: prospect.expiresAt,
        }
      : null,
    lifecycle === 'archived' && (prospect.deletedAt ?? prospect.updatedAt)
      ? {
          kind: 'archived',
          label: LAST_SIGNAL_LABEL.archived,
          at: prospect.deletedAt ?? prospect.updatedAt!,
        }
      : null,
  ]);
}

function addMs(iso: string | null | undefined, ms: number): string | null {
  if (!iso) return null;
  const base = new Date(iso).getTime();
  if (!Number.isFinite(base)) return null;
  return new Date(base + ms).toISOString();
}

function isDue(iso: string | null | undefined, nowMs: number): boolean {
  if (!iso) return false;
  const dueMs = new Date(iso).getTime();
  return Number.isFinite(dueMs) && dueMs <= nowMs;
}

function nextActionFor(input: {
  lifecycle: ProspectLifecycleStage;
  prospect: ProspectDoc;
  crm: ProspectMomentumCrmSummary;
  lastSignal: ProspectLastSignal;
  nowMs: number;
}): ProspectNextAction {
  const { lifecycle, prospect, crm, lastSignal, nowMs } = input;
  const name = prospect.firstName;

  if (lifecycle === 'archived' || lifecycle === 'enrolled' || lifecycle === 'customer') {
    return {
      kind: 'none',
      label: 'No PMV action',
      reason: `${name} is in a terminal or archived state.`,
      priority: 0,
      dueAt: null,
      scriptKind: null,
    };
  }

  if (lifecycle === 'callback_requested') {
    return {
      kind: 'reply_to_callback',
      label: 'Reply to callback',
      reason: `${name} raised a hand and asked for follow-up.`,
      priority: 5,
      dueAt: lastSignal.at,
      scriptKind: 'callback_reply',
    };
  }

  if (crm.followUpIsDue && crm.followUpDueAt) {
    return {
      kind: 'follow_up_due',
      label: 'Follow-up due',
      reason: `A BA-set reminder for ${name} is due.`,
      priority: 4,
      dueAt: crm.followUpDueAt,
      scriptKind: 'later_reconnect',
    };
  }

  if (lifecycle === 'watched') {
    return {
      kind: 'call_now',
      label: 'Call now',
      reason: `${name} watched the video and has not raised a callback request yet.`,
      priority: 4,
      dueAt: lastSignal.at,
      scriptKind: 'watched_no_callback',
    };
  }

  if (lifecycle === 'draft') {
    return {
      kind: 'send_invite',
      label: 'Manually send invite',
      reason: `${name}'s invitation is minted but not marked sent.`,
      priority: 3,
      dueAt: null,
      scriptKind: 'initial_send',
    };
  }

  if (lifecycle === 'expired') {
    return {
      kind: 'reinvite',
      label: 'Consider re-invite',
      reason: `${name}'s consideration window has expired.`,
      priority: 2,
      dueAt: prospect.expiresAt,
      scriptKind: 'reinvite',
    };
  }

  if (lifecycle === 'clicked') {
    return {
      kind: 'ask_if_video_played',
      label: 'Ask if video played',
      reason: `${name} opened the link but has not started the video.`,
      priority: 2,
      dueAt: lastSignal.at,
      scriptKind: 'clicked_no_watch',
    };
  }

  if (lifecycle === 'video_started' || lifecycle === 'video_25' || lifecycle === 'video_50' || lifecycle === 'video_75') {
    return {
      kind: 'send_soft_nudge',
      label: 'Send soft nudge',
      reason: `${name} started the video and has not completed it yet.`,
      priority: 2,
      dueAt: lastSignal.at,
      scriptKind: 'partial_watch',
    };
  }

  if (lifecycle === 'sent_unopened') {
    const nudgeDueAt = addMs(prospect.sentAt, TWO_DAY_MS);
    if (isDue(nudgeDueAt, nowMs)) {
      return {
        kind: 'send_soft_nudge',
        label: 'Send soft nudge',
        reason: `${name}'s invitation was sent but has not been opened.`,
        priority: 2,
        dueAt: nudgeDueAt,
        scriptKind: 'later_reconnect',
      };
    }
    return {
      kind: 'wait',
      label: 'Wait',
      reason: `${name}'s invitation was sent recently.`,
      priority: 0,
      dueAt: nudgeDueAt,
      scriptKind: null,
    };
  }

  return {
    kind: 'none',
    label: 'No PMV action',
    reason: `${name} has no current PMV action.`,
    priority: 0,
    dueAt: null,
    scriptKind: null,
  };
}

function focusQueueFromRows(rows: ProspectMomentumRow[]): ProspectFocusQueueItem[] {
  return rows
    .filter((row) => row.nextAction.priority > 0)
    .sort((a, b) => {
      if (a.nextAction.priority !== b.nextAction.priority) {
        return b.nextAction.priority - a.nextAction.priority;
      }
      const aDue = a.nextAction.dueAt ?? a.lastSignal.at;
      const bDue = b.nextAction.dueAt ?? b.lastSignal.at;
      if (aDue !== bDue) return aDue < bDue ? -1 : 1;
      return a.createdAt < b.createdAt ? 1 : -1;
    })
    .slice(0, 12)
    .map((row) => ({
      prospectId: row.prospectId,
      firstName: row.firstName,
      lastInitial: row.lastInitial,
      lifecycle: row.lifecycle,
      source: row.source,
      lastSignal: row.lastSignal,
      nextAction: row.nextAction,
    }));
}

/**
 * The BA's My Invites list + the per-prospect activity timeline.
 *
 * Three reads, all scoped to the session BA:
 *   1. prospects where sponsorBaId = baId (newest first)
 *   2. callback_requests where sponsorBaId = baId (to mark raised hands +
 *      surface the latest intent per prospect)
 *   3. invitation_activity where sponsorBaId = baId (grouped per prospect)
 *
 * No genealogy traversal, no other BA's data. The activity timeline is
 * returned keyed by prospectId so the cockpit can expand a row inline.
 */
export async function listInvitesForBA(baId: string): Promise<{
  invites: InviteSummary[];
  activityByProspect: Record<string, InvitationActivityEntry[]>;
}> {
  // 1. The BA's prospects, newest first. Soft-deleted prospects (Chat #141)
  // are excluded — the BA has no restore (admin-only), so a removed prospect
  // drops out of the cockpit entirely. $ne:true matches both absent and
  // false, so legacy rows without the field still show.
  const prospectsRes = await gatewayCall<{ documents: ProspectDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { sponsorBaId: baId, deleted: { $ne: true } },
      sort: { createdAt: -1 },
      limit: 1000,
    },
  );
  const prospects = prospectsRes.documents ?? [];

  // 2. Callback requests for this BA. Build a per-prospect "latest intent"
  //    map: callbacks come back newest-first, so the first one we see per
  //    prospect is the latest.
  const callbackRes = await gatewayCall<{ documents: CallbackDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: CALLBACK_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { createdAt: -1 },
      limit: 2000,
    },
  );
  const latestIntentByProspect = new Map<string, CallbackIntent>();
  for (const cb of callbackRes.documents ?? []) {
    if (!latestIntentByProspect.has(cb.prospectId)) {
      latestIntentByProspect.set(cb.prospectId, cb.intent);
    }
  }

  // 3. Activity timeline for this BA, grouped per prospect, oldest-first so
  //    the cockpit renders it top-to-bottom chronologically.
  const activityRes = await gatewayCall<{ documents: InvitationActivityEntry[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: ACTIVITY_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { at: 1 },
      limit: 5000,
    },
  );
  const activityByProspect: Record<string, InvitationActivityEntry[]> = {};
  for (const a of activityRes.documents ?? []) {
    (activityByProspect[a.prospectId] ??= []).push(a);
  }

  // Flatten each prospect into a display-ready InviteSummary.
  const invites: InviteSummary[] = prospects.map((p) => {
    const sentAt = p.sentAt ?? null;
    const latestCallbackIntent = latestIntentByProspect.get(p.prospectId) ?? null;
    const status = computeStatus(p.state, sentAt, latestCallbackIntent !== null);
    return {
      prospectId: p.prospectId,
      token: p.token ?? '',
      firstName: p.firstName,
      lastInitial: p.lastInitial ?? lastInitialOf(p.lastName),
      city: p.location?.city ?? '',
      stateOrRegion: p.location?.stateOrRegion ?? '',
      tokenState: p.state,
      status,
      positionNumber: p.positionNumber ?? null,
      latestCallbackIntent,
      message: p.message ?? null,
      source: p.source ?? 'self',
      sentAt,
      becameCustomer: p.becameCustomer ?? false,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
    };
  });

  return { invites, activityByProspect };
}

/**
 * GET /api/cockpit/pmv read model.
 *
 * All reads are sponsorBaId-scoped to the authed BA. The projection joins the
 * canonical token rail with the prospect record because partial video states
 * live on invite_tokens until video_complete mirrors placement fields back to
 * prospects.
 */
export async function getProspectMomentumViewer(
  baId: string,
): Promise<ProspectMomentumViewerResponse> {
  const generatedAt = new Date().toISOString();
  const nowMs = Date.now();

  const [
    prospectsRes,
    tokensRes,
    callbackRes,
    activityRes,
    followUpsRes,
    dispositionRes,
    notesRes,
  ] = await Promise.all([
    gatewayCall<{ documents: ProspectDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { createdAt: -1 },
      limit: 1000,
    }),
    gatewayCall<{ documents: TokenProjectionDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: TOKENS_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { createdAt: -1 },
      limit: 2000,
    }),
    gatewayCall<{ documents: CallbackDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: CALLBACK_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { createdAt: -1 },
      limit: 2000,
    }),
    gatewayCall<{ documents: InvitationActivityEntry[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: ACTIVITY_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { at: -1 },
      limit: 5000,
    }),
    gatewayCall<{ documents: CrmFollowUpRecord[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: FOLLOWUPS_COLLECTION,
      filter: { sponsorBaId: baId, clearedAt: null },
      sort: { dueAt: 1 },
      limit: 1000,
    }),
    gatewayCall<{ documents: DispositionDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: DISPOSITIONS_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { updatedAt: -1 },
      limit: 1000,
    }),
    gatewayCall<{ documents: NoteDoc[] }>('mongodb', 'query', {
      database: MONGO_DB,
      collection: NOTES_COLLECTION,
      filter: { sponsorBaId: baId },
      sort: { createdAt: -1 },
      limit: 5000,
    }),
  ]);

  const tokensByToken = new Map<string, TokenProjectionDoc>();
  const tokensByProspect = new Map<string, TokenProjectionDoc[]>();
  for (const t of tokensRes.documents ?? []) {
    tokensByToken.set(t.token, t);
    (tokensByProspect.get(t.prospectId) ?? tokensByProspect.set(t.prospectId, []).get(t.prospectId)!).push(t);
  }

  const latestCallbackByProspect = new Map<string, CallbackDoc>();
  for (const cb of callbackRes.documents ?? []) {
    if (!latestCallbackByProspect.has(cb.prospectId)) {
      latestCallbackByProspect.set(cb.prospectId, cb);
    }
  }

  const latestActivityByProspect = new Map<string, InvitationActivityEntry>();
  for (const a of activityRes.documents ?? []) {
    if (!latestActivityByProspect.has(a.prospectId)) {
      latestActivityByProspect.set(a.prospectId, a);
    }
  }

  const followUpByProspect = new Map<string, CrmFollowUpRecord>();
  for (const f of followUpsRes.documents ?? []) {
    if (!followUpByProspect.has(f.prospectId)) {
      followUpByProspect.set(f.prospectId, f);
    }
  }

  const dispositionByProspect = new Map<string, CrmDisposition | null>();
  for (const d of dispositionRes.documents ?? []) {
    if (!dispositionByProspect.has(d.prospectId)) {
      dispositionByProspect.set(d.prospectId, d.disposition ?? null);
    }
  }

  const notesByProspect = new Map<string, { count: number; latestNoteAt: string | null }>();
  for (const n of notesRes.documents ?? []) {
    const current = notesByProspect.get(n.prospectId) ?? { count: 0, latestNoteAt: null };
    current.count += 1;
    if (!current.latestNoteAt || n.createdAt > current.latestNoteAt) {
      current.latestNoteAt = n.createdAt;
    }
    notesByProspect.set(n.prospectId, current);
  }

  const rows: ProspectMomentumRow[] = (prospectsRes.documents ?? []).map((p) => {
    const token = currentTokenForProspect(p, tokensByToken, tokensByProspect);
    const tokenState = token?.state ?? p.state;
    const latestCallback = latestCallbackByProspect.get(p.prospectId) ?? null;
    const followUp = followUpByProspect.get(p.prospectId) ?? null;
    const noteSummary = notesByProspect.get(p.prospectId) ?? {
      count: 0,
      latestNoteAt: null,
    };
    const crm: ProspectMomentumCrmSummary = {
      disposition: dispositionByProspect.get(p.prospectId) ?? null,
      followUpDueAt: followUp?.dueAt ?? null,
      followUpIsDue: isDue(followUp?.dueAt, nowMs),
      noteCount: noteSummary.count,
      latestNoteAt: noteSummary.latestNoteAt,
    };

    const lifecycle = lifecycleFor({
      prospect: p,
      token,
      latestCallbackIntent: latestCallback?.intent ?? null,
      nowMs,
    });
    const lastSignal = buildLastSignal({
      prospect: p,
      token,
      latestCallback,
      latestActivity: latestActivityByProspect.get(p.prospectId) ?? null,
      lifecycle,
    });
    const nextAction = nextActionFor({
      lifecycle,
      prospect: p,
      crm,
      lastSignal,
      nowMs,
    });

    return {
      prospectId: p.prospectId,
      token: token?.token ?? p.token ?? '',
      firstName: p.firstName,
      lastInitial: p.lastInitial ?? lastInitialOf(p.lastName),
      city: p.location?.city ?? '',
      stateOrRegion: p.location?.stateOrRegion ?? '',
      source: p.source ?? 'self',
      lifecycle,
      tokenState,
      videoProgressPct: VIDEO_PROGRESS_BY_STATE[tokenState] ?? null,
      clickedAt: token?.clickedAt ?? null,
      sentAt: p.sentAt ?? null,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      positionNumber: p.positionNumber ?? null,
      placedAt: p.placedAt ?? null,
      latestCallbackIntent: latestCallback?.intent ?? null,
      crm,
      lastSignal,
      nextAction,
    };
  });

  return {
    ok: true,
    generatedAt,
    focusQueue: focusQueueFromRows(rows),
    rows,
    lifecycleGaps: [
      'Partial video milestone timestamps are represented by invite_tokens.updatedAt for the current milestone; per-milestone historical timestamps are not stored yet.',
      'Archived prospects are returned only when the BA-owned prospect record carries deleted=true; the existing BA CRM surface still has no self-restore path.',
    ],
  };
}

interface CommitmentDoc {
  acceptedAt?: string | null;
}

interface BaWelcomeExtras {
  commitment_accepted?: boolean;
  commitment_accepted_at?: string | null;
}

async function getLatestCommitmentAcceptedAt(baId: string): Promise<string | null> {
  const result = await gatewayCall<{ documents?: CommitmentDoc[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection: COMMITMENTS_COLLECTION,
    filter: { baId },
    sort: { acceptedAt: -1 },
    limit: 1,
  });
  return result.documents?.[0]?.acceptedAt ?? null;
}

async function countCollection(collection: string, filter: Record<string, unknown>): Promise<number> {
  const result = await gatewayCall<{ count?: number; documents?: unknown[] }>('mongodb', 'query', {
    database: MONGO_DB,
    collection,
    filter,
    limit: 1,
  });
  if (typeof result.count === 'number') return result.count;
  return result.documents?.length ?? 0;
}

function buildLaunchStep(args: {
  id: LaunchStepId;
  label: string;
  complete: boolean;
  current?: boolean;
  available?: boolean;
  optional?: boolean;
  href: string | null;
  completedAt?: string | null;
  source: string;
  detail: string;
}): LaunchStep {
  const state: LaunchStep['state'] = args.complete
    ? 'complete'
    : args.optional
      ? 'optional'
      : args.current
        ? 'current'
        : args.available
          ? 'available'
          : 'locked';
  return {
    id: args.id,
    label: args.label,
    state,
    source: args.source,
    href: args.href,
    completedAt: args.complete ? args.completedAt ?? null : null,
    detail: args.detail,
  };
}

function nextActionFromSteps(steps: LaunchStep[], launchComplete: boolean): LaunchNextAction {
  const active = steps.find((step) => step.state === 'current')
    ?? steps.find((step) => step.state === 'available');
  if (active) {
    return {
      stepId: active.id,
      label: active.label,
      href: active.href,
      reason: active.detail,
    };
  }
  if (launchComplete) {
    return {
      stepId: null,
      label: 'Work the Prospect Momentum Viewer',
      href: '/cockpit#pmv',
      reason: 'Your launch steps are complete. Keep manual follow-up moving from the PMV.',
    };
  }
  return {
    stepId: null,
    label: 'Check in with your sponsor',
    href: '/cockpit#sponsor',
    reason: 'No unlocked launch action is available yet.',
  };
}

/**
 * Team Magnificent Launch Center: read-only onboarding projection for the
 * first cockpit viewport. This deliberately reads existing durable sources
 * instead of writing a parallel launch-state record.
 */
export async function getTeamLaunchCenter(baId: string): Promise<TeamLaunchCenterResponse> {
  const [ba, commitmentAcceptedAt, michael, fastStart, questionnaireSubmitted, ivoryNames] =
    await Promise.all([
      findBAByBaId(baId),
      getLatestCommitmentAcceptedAt(baId),
      getMichaelSchedule(baId),
      getFastStartProgress(baId),
      questionnaireExists(baId),
      countCollection(IVORY_COLLECTION, { baId }),
    ]);

  const { invites } = await listInvitesForBA(baId);
  const baExtras = ba as (BARecord & BaWelcomeExtras) | null;
  const welcomeAcceptedAt =
    commitmentAcceptedAt ??
    (baExtras?.commitment_accepted ? baExtras.commitment_accepted_at ?? ba?.createdAt ?? null : null);
  const welcomeComplete = Boolean(welcomeAcceptedAt);

  const michaelStatus = michael?.status ?? 'missing';
  const michaelScheduled =
    michaelStatus === 'scheduled' ||
    michaelStatus === 'in_progress' ||
    michaelStatus === 'completed';
  const michaelComplete = michaelStatus === 'completed';
  const day1 = fastStart.modules.find((m) => m.moduleId === 1);
  const day1State = day1?.state ?? 'not_started';
  const day1Started = day1State === 'in_progress' || day1State === 'completed';
  const day1Complete = day1State === 'completed';
  const mintedCount = invites.length;
  const sentCount = invites.filter((invite) => invite.sentAt !== null).length;
  const firstInviteDrafted = mintedCount > 0;
  const firstInviteSent = sentCount > 0;
  const ivoryStarted = ivoryNames > 0;

  const steps: LaunchStep[] = [
    buildLaunchStep({
      id: 'welcome_accepted',
      label: 'Accept the Team Magnificent welcome',
      complete: welcomeComplete,
      current: !welcomeComplete,
      href: '/welcome',
      completedAt: welcomeAcceptedAt,
      source: 'ba_commitments.acceptedAt',
      detail: welcomeComplete
        ? 'Welcome commitment accepted.'
        : 'Start by acknowledging the Team Magnificent operating agreement.',
    }),
    buildLaunchStep({
      id: 'michael_scheduled',
      label: 'Schedule Michael',
      complete: michaelScheduled,
      current: welcomeComplete && !michaelScheduled,
      href: '/michael/schedule',
      completedAt: michael?.scheduledAt ?? michael?.slotStartUtc ?? null,
      source: 'michael_schedules.status',
      detail: michaelScheduled
        ? 'Michael is on your calendar.'
        : 'Pick the 15-minute Michael call time that works for you.',
    }),
    buildLaunchStep({
      id: 'michael_completed',
      label: 'Complete the Michael call',
      complete: michaelComplete,
      current: michaelScheduled && !michaelComplete,
      href: '/michael/schedule',
      completedAt: michael?.completedAt ?? null,
      source: 'michael_schedules.completedAt',
      detail: michaelComplete
        ? 'Michael is complete.'
        : 'Finish the onboarding call so your cockpit unlocks.',
    }),
    buildLaunchStep({
      id: 'day_1_started',
      label: 'Start Day 1 training',
      complete: day1Started,
      current: michaelComplete && !day1Started,
      href: '/training/fast-start/product',
      completedAt: day1?.startedAt ?? day1?.completedAt ?? null,
      source: 'fast_start_progress.moduleId=1',
      detail: day1Started
        ? 'Day 1 training is underway.'
        : 'Open the first Fast Start module and begin the system.',
    }),
    buildLaunchStep({
      id: 'day_1_completed',
      label: 'Complete Day 1 training',
      complete: day1Complete,
      current: day1Started && !day1Complete,
      available: michaelComplete && !day1Complete,
      href: '/training/fast-start/product',
      completedAt: day1?.completedAt ?? null,
      source: 'fast_start_progress.moduleId=1',
      detail: day1Complete
        ? 'Day 1 training is complete.'
        : 'Finish the first module before you settle into daily PMV work.',
    }),
    buildLaunchStep({
      id: 'who_do_you_know_started',
      label: 'Start your Who Do You Know list',
      complete: ivoryStarted,
      current: michaelComplete && !ivoryStarted,
      href: '/ivory',
      completedAt: null,
      source: 'ivory_names count by baId',
      detail: ivoryStarted
        ? 'Your private warm-market list has names in it.'
        : 'Use Ivory to write down the people you already know. It does not prospect for you.',
    }),
    buildLaunchStep({
      id: 'first_invitation_drafted',
      label: 'Draft your first personal invitation',
      complete: firstInviteDrafted,
      current: ivoryStarted && !firstInviteDrafted,
      available: michaelComplete && !firstInviteDrafted,
      href: '/ivory',
      completedAt: invites[0]?.createdAt ?? null,
      source: 'prospects.createdAt via invitation spine',
      detail: firstInviteDrafted
        ? 'Your first invitation draft is in the spine.'
        : 'Prepare one manual invitation from a real relationship.',
    }),
    buildLaunchStep({
      id: 'first_invitation_minted',
      label: 'Mint the first invitation link',
      complete: mintedCount > 0,
      current: firstInviteDrafted && mintedCount === 0,
      available: ivoryStarted && mintedCount === 0,
      href: '/ivory',
      completedAt: invites[0]?.createdAt ?? null,
      source: 'prospects + invite_tokens via invitation spine',
      detail: mintedCount > 0
        ? 'The first trackable invitation link exists.'
        : 'Mint the link only after you choose the person and message.',
    }),
    buildLaunchStep({
      id: 'first_invitation_sent',
      label: 'Send your first invitation manually',
      complete: firstInviteSent,
      current: mintedCount > 0 && !firstInviteSent,
      href: '/cockpit#pmv',
      completedAt: invites.find((invite) => invite.sentAt !== null)?.sentAt ?? null,
      source: 'prospects.sentAt via manual BA confirmation',
      detail: firstInviteSent
        ? 'You confirmed that the first invitation was sent.'
        : 'After you personally send the message, mark it sent in the PMV.',
    }),
    buildLaunchStep({
      id: 'questionnaire_submitted',
      label: 'Submit your onboarding questionnaire',
      complete: questionnaireSubmitted,
      current: firstInviteSent && !questionnaireSubmitted,
      available: michaelComplete && !questionnaireSubmitted,
      href: '/onboarding/questionnaire',
      completedAt: null,
      source: 'ba_questionnaires existence by baId',
      detail: questionnaireSubmitted
        ? 'Your sponsor can review your questionnaire.'
        : 'Give your sponsor context for coaching and workbook follow-up.',
    }),
    buildLaunchStep({
      id: 'sponsor_connection_confirmed',
      label: 'Connect with your sponsor',
      complete: false,
      optional: true,
      href: '/cockpit#sponsor',
      completedAt: null,
      source: 'brand_ambassadors.sponsorBaId; confirmation not separately tracked',
      detail: 'Your immutable sponsor card stays visible; confirm connection directly with your sponsor.',
    }),
  ];

  const requiredSteps = steps.filter((step) => step.state !== 'optional');
  const completed = requiredSteps.filter((step) => step.state === 'complete').length;
  const total = requiredSteps.length;
  const launchComplete = completed === total;

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    baFirstName: ba?.firstName ?? '',
    progress: {
      completed,
      total,
      percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
    nextAction: nextActionFromSteps(steps, launchComplete),
    steps,
    michael: {
      status: michaelStatus,
      slotStartUtc: michael?.slotStartUtc ?? null,
      completedAt: michael?.completedAt ?? null,
    },
    firstInvitation: {
      ivoryNames,
      draftedCount: mintedCount,
      mintedCount,
      sentCount,
    },
    fastStart: {
      day1State,
      day1StartedAt: day1?.startedAt ?? null,
      day1CompletedAt: day1?.completedAt ?? null,
      complete: fastStart.complete,
    },
    questionnaireSubmitted,
    launchComplete,
  };
}

/**
 * Today's Actions now adapts the PMV projection, so the top cockpit card and
 * the PMV Focus Queue use the same deterministic priority model.
 */
export async function getCockpitTodaysActions(
  baId: string,
): Promise<CockpitTodaysActionsResponse> {
  const pmv = await getProspectMomentumViewer(baId);
  const nowMs = Date.now();
  const callbackLookbackIso = new Date(nowMs - CALLBACK_LOOKBACK_MS).toISOString();
  const expiringHorizonIso = new Date(nowMs + EXPIRING_WINDOW_MS).toISOString();

  const callbackItems: CockpitActionItem[] = pmv.rows
    .filter(
      (row) =>
        row.nextAction.kind === 'reply_to_callback' &&
        row.lastSignal.at >= callbackLookbackIso,
    )
    .sort((a, b) => (a.lastSignal.at < b.lastSignal.at ? 1 : -1))
    .map((row) => ({
      kind: 'callback',
      prospectId: row.prospectId,
      firstName: row.firstName,
      lastInitial: row.lastInitial,
      at: row.lastSignal.at,
      intent: row.latestCallbackIntent,
    }));

  const callbackSet = new Set(callbackItems.map((item) => item.prospectId));

  const followupItems: CockpitActionItem[] = pmv.rows
    .filter(
      (row) =>
        row.nextAction.kind === 'follow_up_due' &&
        row.crm.followUpDueAt !== null &&
        !callbackSet.has(row.prospectId),
    )
    .sort((a, b) => (a.crm.followUpDueAt! > b.crm.followUpDueAt! ? 1 : -1))
    .map((row) => ({
      kind: 'followup',
      prospectId: row.prospectId,
      firstName: row.firstName,
      lastInitial: row.lastInitial,
      at: row.crm.followUpDueAt!,
      followUpDueAt: row.crm.followUpDueAt!,
    }));

  const followupSet = new Set(followupItems.map((item) => item.prospectId));

  const expiringItems: CockpitActionItem[] = pmv.rows
    .filter((row) => {
      if (callbackSet.has(row.prospectId) || followupSet.has(row.prospectId)) {
        return false;
      }
      if (row.lifecycle === 'enrolled' || row.lifecycle === 'expired' || row.lifecycle === 'archived') {
        return false;
      }
      return row.expiresAt > new Date(nowMs).toISOString() && row.expiresAt <= expiringHorizonIso;
    })
    .sort((a, b) => (a.expiresAt > b.expiresAt ? 1 : -1))
    .map((row) => ({
      kind: 'expiring',
      prospectId: row.prospectId,
      firstName: row.firstName,
      lastInitial: row.lastInitial,
      at: row.expiresAt,
      expiresAt: row.expiresAt,
    }));

  return {
    ok: true,
    actions: [...callbackItems, ...followupItems, ...expiringItems],
    biasPrompt: BIAS_PROMPT,
  };
}

/** Convenience wrapper shaping the full GET /api/cockpit/invites response. */
export async function getMyInvites(baId: string): Promise<MyInvitesResponse> {
  const { invites, activityByProspect } = await listInvitesForBA(baId);
  return { ok: true, invites, activityByProspect };
}

/**
 * The cockpit summary: headline counts (the BA's own funnel) + the My
 * Sponsor card. Counts are derived from the same invite list so they never
 * disagree with what the BA sees in the rows below.
 */
export async function getCockpitSummary(
  baId: string,
): Promise<CockpitSummaryResponse & { sponsorFallback: CockpitSponsorFallback | null }> {
  const ba = await findBAByBaId(baId);
  const { invites } = await listInvitesForBA(baId);

  // My Sponsor card. Founders (TM-01/TM-02) have no upline (locked-spec 1.2)
  // — sponsor is null and the cockpit renders a founder treatment.
  //
  // sponsorFallback (Chat #147, seq 23): the card ALWAYS shows the original,
  // immutable sponsor. But if that sponsor is INACTIVE (suspended / deleted /
  // dormant 120d+), we also surface Kevin + Paul as the support/contact
  // fallback. Placement and the immutable sponsor relationship are untouched —
  // this is a contact path only.
  let sponsor: CockpitSummaryResponse['sponsor'] = null;
  let sponsorFallback: CockpitSponsorFallback | null = null;
  if (ba?.sponsorBaId) {
    const sp = await findBAByBaId(ba.sponsorBaId);
    if (sp) {
      sponsor = {
        fullName: `${sp.firstName} ${sp.lastName}`.trim(),
        firstName: sp.firstName,
        lastInitial: lastInitialOf(sp.lastName),
        phone: sp.phone ?? null,
      };
      if (isSponsorInactive(sp)) {
        sponsorFallback = {
          sponsorInactive: true,
          founders: await getFounderContacts(),
        };
      }
    }
  }

  const counts = {
    total: invites.length,
    sent: invites.filter((i) => i.sentAt !== null).length,
    watched: invites.filter(
      (i) => i.status === 'watched' || i.status === 'callback',
    ).length,
    callbacks: invites.filter((i) => i.status === 'callback').length,
    enrolled: invites.filter((i) => i.status === 'enrolled').length,
  };

  return {
    ok: true,
    baFirstName: ba?.firstName ?? '',
    sponsor,
    sponsorFallback,
    counts,
  };
}
