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
import { findBAByBaId } from './ba.js';
import { lastInitialOf } from './prospects.js';
import type {
  CallbackIntent,
  CockpitSummaryResponse,
  InvitationActivityEntry,
  InviteDisplayStatus,
  InviteSummary,
  MyInvitesResponse,
  TokenState,
} from '@momentum/shared';

const MONGO_DB = 'momentum';
const PROSPECTS_COLLECTION = 'prospects';
const ACTIVITY_COLLECTION = 'invitation_activity';
const CALLBACK_COLLECTION = 'callback_requests';

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
}

interface CallbackDoc {
  prospectId: string;
  intent: CallbackIntent;
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
  // 1. The BA's prospects, newest first.
  const prospectsRes = await gatewayCall<{ documents: ProspectDoc[] }>(
    'mongodb',
    'query',
    {
      database: MONGO_DB,
      collection: PROSPECTS_COLLECTION,
      filter: { sponsorBaId: baId },
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
): Promise<CockpitSummaryResponse> {
  const ba = await findBAByBaId(baId);
  const { invites } = await listInvitesForBA(baId);

  // My Sponsor card. Founders (TM-01/TM-02) have no upline (locked-spec 1.2)
  // — sponsor is null and the cockpit renders a founder treatment.
  let sponsor: CockpitSummaryResponse['sponsor'] = null;
  if (ba?.sponsorBaId) {
    const sp = await findBAByBaId(ba.sponsorBaId);
    if (sp) {
      sponsor = {
        fullName: `${sp.firstName} ${sp.lastName}`.trim(),
        firstName: sp.firstName,
        lastInitial: lastInitialOf(sp.lastName),
        phone: sp.phone ?? null,
      };
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
    counts,
  };
}
