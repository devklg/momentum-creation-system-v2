/**
 * Shared domain types used across server and clients.
 * Kept thin in Phase 0 — expand as Phase 1+ surfaces ship.
 */

export type IsoTimestamp = string;

/** Token lifecycle states per COM Design Section E.1.
 *
 * This is the pure funnel rail — how far through the .com experience the
 * prospect has progressed. Callback requests and webinar reservations are
 * NOT lifecycle states; they are independent intent records a prospect can
 * create after video_complete. Both can exist for the same prospect
 * simultaneously (Chat #105 spec amendment).
 */
export type TokenState =
  | 'minted'
  | 'clicked'
  | 'video_started'
  | 'video_quarter'
  | 'video_half'
  | 'video_three_quarter'
  | 'video_complete'
  | 'enrolled'
  | 'expired';

/**
 * Prospect intent radio choice on the .com callback CTA.
 *
 * Section 10 of tm-video-presentation (the presentation page) carries the
 * two soft-CTA options below. The harder "I'm ready to join" option is
 * intentionally reserved for the post-video tm-prospect-dashboard
 * Section 6, since on the presentation page the prospect has only seen
 * the video — they have not yet seen the team forming around them, so
 * "ready to join" would be premature (Chat #109 lock).
 *
 *   - interested_tell_me_more  → "I'm interested — tell me more"
 *   - have_questions           → "I have questions"
 *   - ready_to_join            → "I'm ready to join Team Magnificent"
 *
 * The 'ready_to_join' intent is rendered ONLY on the post-video
 * tm-prospect-dashboard Section 6, not on the pre-video presentation
 * Section 10. Chat #113 expanded the union when the dashboard six-section
 * port shipped. Server, client, and SMS templating all branch on this
 * discriminator.
 */
export type CallbackIntent =
  | 'interested_tell_me_more'
  | 'have_questions'
  | 'ready_to_join';

/**
 * Request body for POST /api/p/:token/callback-request.
 * The BA already has the prospect's contact info — no phone field is
 * collected here (Chat #109 lock). The token resolves the prospect and
 * the inviting BA server-side; sponsor immutability (locked-spec 3.5)
 * means the request body cannot influence which BA gets notified.
 */
export interface CallbackRequestPayload {
  intent: CallbackIntent;
}

/**
 * Response from POST /api/p/:token/callback-request. The page transitions
 * to a soft confirmation state using `baFirstName`. `createdAt` is echoed
 * back so the client can show "submitted at HH:MM" if Kevin ever wants
 * it; for now the UI just confirms the submission landed.
 */
export interface CallbackRequestResponse {
  ok: true;
  intent: CallbackIntent;
  baFirstName: string;
  createdAt: IsoTimestamp;
}

/**
 * Stored callback-request record. One prospect can submit multiple
 * requests over time (Chat #105 spec amendment) — these are independent
 * intent records, not lifecycle states. The most recent record per
 * prospect is what the BA cockpit surfaces; older records remain on the
 * activity timeline.
 */
export interface CallbackRequestRecord {
  callbackRequestId: string;
  token: string;
  prospectId: string;
  sponsorBaId: string;
  intent: CallbackIntent;
  createdAt: IsoTimestamp;
  smsDeliveryStatus: 'queued' | 'sent' | 'failed' | 'skipped';
  smsDeliveryError: string | null;
}

/** Three-stack write result returned by the gateway. */
export interface TripleStackWriteResult {
  mongo: { ok: boolean; insertedCount?: number };
  neo4j: { ok: boolean; counters?: Record<string, number> };
  chroma: { ok: boolean; verified?: boolean };
}

/**
 * Geographic location of a prospect.
 * Country is captured from day one for international rollout per
 * locked-spec Part 4.4. Use ISO 3166-1 alpha-2 codes ('US', 'CA', 'GB').
 */
export interface ProspectLocation {
  city: string;
  stateOrRegion: string;
  country: string;
}

/**
 * Prospect record. The person a BA invited via /p/{token}.
 * Per locked-spec Part 1.17, prospects are one of the two kinds of people
 * the system tracks (BAs are the other). became_customer fields enable
 * the customer-conversion metric without expanding scope into customer
 * tracking; the actual customer relationship lives in THREE International.
 */
export interface ProspectRecord {
  prospectId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  location: ProspectLocation;
  phone: string | null;
  email: string | null;
  sponsorBaId: string;
  state: TokenState;
  positionNumber: number | null;
  placedAt: IsoTimestamp | null;
  becameCustomer: boolean;
  becameCustomerAt: IsoTimestamp | null;
  customerNote: string | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
}

/**
 * Invite token. Opaque 12-character string from the access-code alphabet
 * (31 chars, no 0/1/I/O/L). One prospect can have multiple tokens over time
 * if a BA re-invites them (cooldown rule locked-spec Part 5, still open).
 */
export interface InviteTokenRecord {
  token: string;
  prospectId: string;
  sponsorBaId: string;
  state: TokenState;
  createdAt: IsoTimestamp;
  clickedAt: IsoTimestamp | null;
  expiresAt: IsoTimestamp;
}

/**
 * Discrete video milestones the .com client reports as the prospect
 * progresses through Dr. Dan's 17-minute video. Only 'complete' triggers
 * holding-tank placement (locked-spec Part 4.5).
 */
export type VideoEventKind =
  | 'started'
  | 'quarter'
  | 'half'
  | 'three_quarter'
  | 'complete';

/**
 * Pool placement record. A prospect's spot in the team-wide holding tank.
 * One pool, every BA's prospects feed it (Chat #84 keystone). Positions
 * are monotonic and never reshuffle (locked-spec Part 3.2). Flushed at the
 * 8-week consideration window (locked-spec Part 3.7) but the assigned
 * position is preserved as a vacant slot — #348 does not become #347.
 */
export interface PoolPlacement {
  prospectId: string;
  sponsorBaId: string;
  positionNumber: number;
  placedAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  flushedAt: IsoTimestamp | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}

/**
 * Result of placeProspect. Returned to the route layer so it can respond
 * to the .com client with the assigned position; the client transitions
 * the render from presentation page to dashboard.
 */
export interface PlaceProspectResult {
  prospectId: string;
  positionNumber: number;
  placedAt: IsoTimestamp;
  alreadyPlaced: boolean;
}

/**
 * Request body for POST /api/p/:token/video-event.
 * Replaying any kind is idempotent — the server only transitions forward,
 * never backward, in the token lifecycle.
 */
export interface VideoEventPayload {
  kind: VideoEventKind;
}

/**
 * Response from POST /api/p/:token/video-event. positionNumber is non-null
 * only when this event resulted in (or already resulted in) placement.
 */
export interface VideoEventResponse {
  token: string;
  state: TokenState;
  positionNumber: number | null;
  placedAt: IsoTimestamp | null;
}

/**
 * Resolved /p/{token} payload returned by GET /api/p/:token.
 * Both prospect and BA are always present — the .com surface is never
 * anonymous per locked-spec Part 3.9.
 */
export interface ResolvedTokenPayload {
  token: string;
  state: TokenState;
  prospect: {
    firstName: string;
    lastInitial: string;
    city: string;
    stateOrRegion: string;
    country: string;
    positionNumber: number | null;
    placedAt: IsoTimestamp | null;
    expiresAt: IsoTimestamp;
  };
  ba: {
    baId: string;
    firstName: string;
    lastName: string;
    lastInitial: string;
    fullName: string;
  };
  videoUrl: string;
  webinar: { dayOfWeek: string; timeOfDay: string; timezone: string };
  /**
   * Next upcoming webinar event, or null if no event is currently
   * seeded. When non-null, the dashboard Section 6 renders a live
   * ticking countdown to `scheduledFor` and pre-attributes the
   * reservation to this event. When null, the Countdown component
   * renders a static "check back soon" surface and the reservation
   * route returns 404 no_upcoming_event. Resolved server-side from
   * webinar_events at /api/p/:token render. Chat #115.
   */
  nextEvent: {
    eventId: string;
    scheduledFor: IsoTimestamp;
    hosts: string[];
  } | null;
}

/**
 * 409 enrolled response from GET /api/p/:token, POST /api/p/:token/video-event,
 * and POST /api/p/:token/callback-request.
 *
 * Per locked-spec Part 4.9 Branch 4: the prospect was already walked into
 * THREE off-app (locked-spec 3.6) and the BA marked them enrolled in their
 * cockpit. The client renders the E.2 brief-acknowledgment view — no CTA,
 * no register link, no programmatic path. Access to .team comes through a
 * separately-issued access code from Kevin per locked-spec 2.3, not through
 * /p/{token}.
 *
 * No phone field: the prospect already has the BA's number from the
 * original invitation. Carrying it again here would be noise.
 */
export interface EnrolledResponse {
  error: 'enrolled';
  ba: {
    firstName: string;
    lastName: string;
    fullName: string;
  };
}

/**
 * 410 expired response from GET /api/p/:token, POST /api/p/:token/video-event,
 * and POST /api/p/:token/callback-request.
 *
 * Per locked-spec Part 4.9 Branch 3: the token's expiresAt has elapsed OR
 * state is already 'expired'. The resolver applies the lazy-flush rule —
 * non-terminal tokens whose expiresAt is in the past are transitioned to
 * 'expired' inline (triple-stack write) BEFORE returning 410. Self-healing
 * read path; the cron-based flush scheduler is deferred.
 *
 * The 410 payload carries the inviting BA's contact so the prospect can
 * ask for a fresh link. The F.2 client view renders this as a tap-to-text
 * helper — phoneE164 powers a `tel:` link on mobile and a copy-pre-filled-
 * SMS button. The system never sends on the prospect's behalf; channel
 * protection (locked-spec 1.13) and BA-to-BA off-app handoff (3.6) both
 * hold. No auto-renew: the BA mints a fresh token from their cockpit when
 * ready, honoring locked-spec 1.4 (share, respect, move on).
 *
 * Phone is E.164 raw (e.g. '+13235551234'), no formatting. The client
 * formats for display and uses the same string in `tel:` links and SMS
 * draft helpers. Null only if the BA has no phone on record.
 */
export interface ExpiredResponse {
  error: 'expired';
  expiredAt: IsoTimestamp;
  ba: {
    firstName: string;
    lastInitial: string;
    phoneE164: string | null;
  };
}

/* ──────────────────────────────────────────────────────────────────
 * SSE — Live placement stream (Chat #114 dashboard port)
 * ──────────────────────────────────────────────────────────────────
 *
 * Recovered architecture (Chat #84 + #94 prior specification):
 *   GET /api/p/:token/stream
 *     - Returns text/event-stream. Connection held open per viewer.
 *     - On connect, server emits a `snapshot` event carrying the
 *       current global max position + the most recent N placements
 *       (city/state/lastInitial — never names that could PII-leak).
 *     - On every team-wide placement (POST /api/p/:token/video-event
 *       kind=complete from ANY prospect on the whole team), server
 *       emits a `placement` event with the new position number.
 *     - Heartbeat `ping` event every 30s so proxies don't close idle
 *       connections (and so the client can detect a dead pipe).
 *
 * Client math (locked-spec 3.4):
 *   beneath_you = max(0, current_global_max - my_position)
 *
 * Compliance (locked-spec 3.10 + COM Design C.4):
 *   - No names. First name + last initial only.
 *   - City + state for human texture; no street, no email, no phone.
 *   - No income claims, no placement promises.
 *   - The position stream is "team momentum" not "your downline."
 */

/**
 * One placement entry as the dashboard ticker renders it.
 * Used both inside `HoldingTankSnapshot.recent` and as the payload
 * of `PlacementEvent`. Same shape both places so the React ticker
 * renders snapshot entries and live entries through one code path.
 */
export interface PlacementTickerEntry {
  positionNumber: number;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  placedAt: IsoTimestamp;
}

/**
 * SSE `snapshot` event payload — sent once at connection open.
 * Carries the current global max position so the client can compute
 * its own beneath-you count, plus the most recent N placements to
 * seed the position-stack ticker without a separate fetch.
 */
export interface HoldingTankSnapshot {
  globalMaxPosition: number;
  recent: PlacementTickerEntry[];
}

/**
 * SSE `placement` event payload — sent every time any prospect on
 * the team completes the video. Every viewer increments their own
 * beneath-you counter by 1 if positionNumber > their own position.
 * The entry is prepended to the position-stack ticker.
 */
export interface PlacementEvent extends PlacementTickerEntry {
  /** Globally-unique id, used as the SSE `id:` field for resumability. */
  eventId: string;
}

/* ──────────────────────────────────────────────────────────────────
 * Webinar events + reservations (Chat #114 dashboard port)
 * ──────────────────────────────────────────────────────────────────
 *
 * Per locked-spec Part 5, the webinar cadence (weekly Tuesday 7pm PT
 * vs every 72 hours) is still open. The reservation flow is built
 * cadence-agnostic: there is always a "next upcoming event"; this
 * dashboard reads it and lets the prospect reserve. Seeding the
 * event records is operationally separate (manual /admin action for
 * now; cron when cadence is decided).
 *
 * Email delivery to the prospect is gated on the open Part 5 email
 * provider decision. Until then the reservation captures successfully
 * and the BA receives an SMS alert (locked-spec 3.13 — Telnyx is the
 * proven channel). The prospect is told "your BA will follow up with
 * the Zoom link."
 */

/**
 * A scheduled Team Magnificent live event a prospect can reserve a
 * seat for. Hosts default to Kevin + Paul (locked-spec 1.14).
 * Status is upgraded by the seeding job/admin tool, not by reservation.
 */
export interface WebinarEvent {
  eventId: string;
  scheduledFor: IsoTimestamp;
  hosts: string[];
  zoomUrl: string | null;
  durationMinutes: number;
  status: 'upcoming' | 'past' | 'cancelled';
  createdAt: IsoTimestamp;
}

/**
 * Request body for POST /api/p/:token/webinar-reserve.
 * Name + email are the only fields the prospect provides; everything
 * else (eventId, prospectId, sponsorBaId) is resolved server-side
 * from the token. Sponsor immutability (locked-spec 3.5) holds.
 */
export interface WebinarReservationPayload {
  name: string;
  email: string;
}

/**
 * Response from POST /api/p/:token/webinar-reserve. The dashboard
 * transitions Section 6's webinar tile to a "reserved" confirmation
 * card using `scheduledFor` + `baFirstName` so the prospect knows
 * who's following up with the Zoom link.
 */
export interface WebinarReservationResponse {
  ok: true;
  reservationId: string;
  eventId: string;
  scheduledFor: IsoTimestamp;
  baFirstName: string;
  emailSent: boolean;
  createdAt: IsoTimestamp;
}

/**
 * Stored webinar reservation record. The BA cockpit surfaces these
 * alongside callback requests so a BA seeing both knows the prospect
 * is engaged through two distinct channels.
 *
 * `emailDeliveryStatus` carries 'skipped' (email provider not yet
 * configured per locked-spec Part 5) until the provider is wired.
 * 'queued'/'sent'/'failed' come online when the provider lands.
 */
export interface WebinarReservationRecord {
  reservationId: string;
  eventId: string;
  token: string;
  prospectId: string;
  sponsorBaId: string;
  name: string;
  email: string;
  createdAt: IsoTimestamp;
  emailDeliveryStatus: 'queued' | 'sent' | 'failed' | 'skipped';
  emailDeliveryError: string | null;
  smsDeliveryStatus: 'queued' | 'sent' | 'failed' | 'skipped';
  smsDeliveryError: string | null;
}

/* ───────────────────────────────────────────────────────────────
 * Team stats (Chat #115 — dashboard Section 5 live activity grid)
 * ───────────────────────────────────────────────────────────────
 *
 * Replaces the four seeded constants (47/213/89/+38%) in Section 5 of
 * the prospect dashboard with real, live counts queried server-side at
 * /api/p/:token/team-stats. Refresh policy is client-driven — the
 * dashboard polls or re-fetches when the prospect returns; the server
 * computes on each request (no caching at v1 scale).
 *
 * Compliance (locked-spec 3.10):
 *   These four numbers describe TEAM ACTIVITY — they make no income
 *   claim, no rank claim, no placement promise. They demonstrate real
 *   recruiting activity in real time and are safe for .com surfaces.
 */
export interface TeamStatsResponse {
  basActive24h: number;
  invitationsSentToday: number;
  newPlacements24h: number;
  recruitmentVelocityPct: number;
  computedAt: IsoTimestamp;
}

/* ───────────────────────────────────────────────────────────────
 * Invitation spine (Chat #119 — the WRITE-side of /p)
 * ───────────────────────────────────────────────────────────────
 *
 * When a BA mints an invitation on .team, the spine creates a prospect
 * record + an invite-token record atomically (triple-stack), mirroring
 * holdingTank.ts placeProspect. The /p READ-side already existed; this is
 * its missing counterpart.
 *
 * "Sent" is tracked as a FIELD (sentAt on the prospect record) + an
 * activity-timeline entry — NOT a new token lifecycle state (Chat #119
 * decision). The token rail describes what the PROSPECT did; "sent" is a
 * BA-side fact and lives parallel to the rail so the two never collide.
 *
 * Sponsor immutability (locked-spec 3.5): sponsorBaId is stamped from the
 * authed session BA at the route layer, never from the request body.
 */

/**
 * Who composed the invitation message (Chat #120 lock). The plain
 * /invitations form fills 'self'; Ivory and ScriptMaker fill their own
 * markers when they ship — same field, same seam, no schema change later.
 * This is what makes "compare hand-written vs agent-drafted invites"
 * answerable down the road.
 *
 *   - self        → the BA wrote the message by hand in the form
 *   - ivory        → Ivory (who-do-you-know agent) drafted it
 *   - scriptmaker  → ScriptMaker drafted it from a product video
 */
export type InvitationSource = 'self' | 'ivory' | 'scriptmaker';

/**
 * BA-submitted invitation form (Chat #119 field lock, extended Chat #120).
 * first/last name, email, phone, city, state — all flow onto the prospect
 * record so the CRM export carries them and city/state render on the
 * dashboard ticker. sponsorBaId is NOT in this payload; the route derives
 * it from the session.
 *
 * `message` (Chat #120) is the invitation text the BA will send. It is
 * STORED for reuse and history — storing is NOT sending; the BA still
 * copies the link + message and sends from their own phone (locked-spec
 * 1.13 channel protection, 3.6 BA-to-BA off-app). `source` records who
 * composed it. Both are optional at the type level so the spine stays
 * backward-compatible with the standalone /log path, but the plain form
 * always sends them.
 */
export interface CreateInvitationPayload {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  city: string;
  stateOrRegion: string;
  /** ISO 3166-1 alpha-2; route defaults to 'US' when omitted. */
  country?: string;
  /** The invitation text the BA will send. Stored, never auto-sent. */
  message?: string | null;
  /** Who composed `message`. Route defaults to 'self' when omitted. */
  source?: InvitationSource;
}

/**
 * Response from POST /api/invitations. Carries the fully-substituted
 * prospect link the BA shares (https://teammagnificent.com/p/{token}).
 */
export interface CreateInvitationResponse {
  ok: true;
  prospectId: string;
  token: string;
  inviteUrl: string;
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  /** Echo of the stored message + source (Chat #120), so the page can
   *  show the BA exactly what was saved alongside the link. */
  message: string | null;
  source: InvitationSource;
}

/**
 * Response from POST /api/invitations/:prospectId/sent ("I sent this").
 * alreadySent is true on idempotent replays.
 */
export interface MarkInvitationSentResponse {
  ok: true;
  prospectId: string;
  sentAt: IsoTimestamp;
  alreadySent: boolean;
}

/**
 * One entry on a prospect's invitation activity timeline. Distinct from
 * the token lifecycle rail: these are BA-side and system-side events the
 * cockpit renders chronologically. `kind` is the discriminator.
 *
 *   - invitation_sent     → BA confirmed the link was sent (or logged a
 *                           standalone external invite, G.5).
 *   - video_completed      → prospect finished Dr. Dan's video (placement).
 *   - callback_requested   → prospect submitted a callback CTA.
 */
export type InvitationActivityKind =
  | 'invitation_sent'
  | 'video_completed'
  | 'callback_requested';

export interface InvitationActivityEntry {
  activityId: string;
  prospectId: string;
  sponsorBaId: string;
  kind: InvitationActivityKind;
  note: string;
  at: IsoTimestamp;
}

/* ───────────────────────────────────────────────────────────────
 * Cockpit read-side (Chat #121 — the My Invites loop)
 * ───────────────────────────────────────────────────────────────
 *
 * The WRITE-side spine (Chat #119/#120) mints prospects, stamps sentAt,
 * and appends the invitation_activity timeline. Nothing read it back until
 * now. The cockpit closes the loop: a BA sees every prospect they've
 * invited, that prospect's current status, and the per-prospect activity.
 *
 * Sponsor immutability (locked-spec 3.5): the cockpit reads ONLY the
 * authed session BA's own prospects (filter sponsorBaId = session baId).
 * No request input can widen the set to another BA's prospects.
 *
 * Compliance (locked-spec 3.10): this is a BA-FACING surface inside .team,
 * not .com. It may show the prospect's own contact + status + the saved
 * message. It still makes no income/placement claims — status is funnel
 * progress ("watched the video", "asked for a callback"), never earnings.
 */

/**
 * A prospect's status as the cockpit displays it. This is a DISPLAY
 * projection, not a stored field — it is computed server-side from the
 * token lifecycle state + the sentAt field + customer flag, collapsing
 * the rail into the handful of states a BA actually acts on.
 *
 *   - draft           → minted, link not yet marked sent by the BA
 *   - sent             → BA tapped "I sent this" (sentAt set), no click yet
 *   - opened           → prospect clicked / started the video (in progress)
 *   - watched          → prospect completed the video (placed in the pool)
 *   - callback         → prospect raised a hand (callback requested)
 *   - enrolled         → walked into THREE off-app, BA marked enrolled
 *   - expired          → 8-week window elapsed (locked-spec 3.7)
 *
 * 'callback' outranks 'watched' in the display because a raised hand is
 * the action a BA most needs to see; 'enrolled' and 'expired' are terminal
 * and outrank everything.
 */
export type InviteDisplayStatus =
  | 'draft'
  | 'sent'
  | 'opened'
  | 'watched'
  | 'callback'
  | 'enrolled'
  | 'expired';

/**
 * One row in the BA's My Invites list. A flattened, display-ready view of
 * a prospect the BA invited — the cockpit's primary unit.
 */
export interface InviteSummary {
  prospectId: string;
  token: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  /** Token lifecycle rail state (raw). */
  tokenState: TokenState;
  /** Computed display status the cockpit badges on the row. */
  status: InviteDisplayStatus;
  /** Pool position once placed; null before video_complete. */
  positionNumber: number | null;
  /** Most recent callback intent, if the prospect raised a hand. */
  latestCallbackIntent: CallbackIntent | null;
  /** The stored invitation message + who composed it (Chat #120). */
  message: string | null;
  source: InvitationSource;
  /** Whether the BA has confirmed they sent the link. */
  sentAt: IsoTimestamp | null;
  becameCustomer: boolean;
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
}

/**
 * Response from GET /api/cockpit/invites. The BA's own prospects, newest
 * first, plus the per-prospect activity timeline keyed by prospectId so
 * the cockpit can expand a row without a second round trip.
 */
export interface MyInvitesResponse {
  ok: true;
  invites: InviteSummary[];
  /** activityByProspect[prospectId] = chronological activity for that prospect. */
  activityByProspect: Record<string, InvitationActivityEntry[]>;
}

/**
 * Response from GET /api/cockpit/summary. The headline counts the cockpit
 * shows above My Invites, plus the My Sponsor card data. Counts are the
 * BA's own funnel only (sponsorBaId = session baId).
 */
export interface CockpitSummaryResponse {
  ok: true;
  baFirstName: string;
  /** My Sponsor card. Null for founders (no upline) per locked-spec 1.2. */
  sponsor: {
    fullName: string;
    firstName: string;
    lastInitial: string;
    phone: string | null;
  } | null;
  counts: {
    total: number;
    sent: number;
    watched: number;
    callbacks: number;
    enrolled: number;
  };
}

/* ──────────────────────────────────────
 * ScriptMaker (Chat #122 — the product-video front door)
 * ──────────────────────────────────────
 *
 * ScriptMaker lives in the .team VIDEO LIBRARY, anchored to the specific
 * product video the BA just watched (Chat #118 lock — it is NOT a comp-plan
 * translator; that framing was drift). It fires two ways: a per-card
 * "who can use this?" button and an auto-prompt when the BA finishes a
 * product video. It produces a DRAFT invitation message anchored to that
 * product, then hands the draft into the existing /invitations form via
 * the seed + source='scriptmaker' seam (Chat #120). It does NOT mint the
 * token, create the prospect, or send anything — those stay in the spine.
 *
 * Prospect-surfacing ("who do you know") is IVORY's job (its own surface,
 * next session). This session ScriptMaker drafts only; the BA names the
 * prospect, ScriptMaker writes the product-anchored message. When Ivory
 * ships it routes a surfaced name into this same draft step. One engine,
 * multiple front doors (Chat #118).
 *
 * Compliance (locked-spec 3.11 script-time enforcement + 3.10):
 *   The draft is BA-composed outbound word-of-mouth, but the compliance
 *   frame still binds what the LLM may write — NO income claims, NO
 *   earnings projections, NO placement/queue promises, NO comp/cycle/rank
 *   math, NO medical or weight-loss guarantees. The system prefix in
 *   domain/scriptmaker.ts encodes these as hard rules; the model is
 *   instructed to refuse and fall back to a neutral product mention rather
 *   than produce a violating draft. The four G.7 invitation locks (real
 *   human contact precedes the link, no automated send, no mass send, no
 *   income content in a prospect-facing draft) attach at the send step in
 *   the spine, not here.
 */

/**
 * A product video in the .team library that ScriptMaker can anchor a draft
 * to. Ported from team-magnificent-training/video-library.html (Chat #122).
 * `youtubeId` powers the embedded player (needed for the fire-on-finish
 * completion signal — the legacy page linked OUT to YouTube with no
 * completion event, the real build item per Chat #118). `productName` is
 * the anchor ScriptMaker drafts around.
 */
export interface LibraryVideo {
  videoId: string;
  youtubeId: string;
  title: string;
  productName: string;
  /** Short human blurb shown on the card. */
  blurb: string;
  /** 'glp_three' | 'product_line' | 'back_office' | 'app' — library section. */
  category: string;
  /** mm:ss display string from the source catalog. */
  duration: string;
  /** 'full' | 'short' | 'deep_dive' — drives the card badge. */
  kind: 'full' | 'short' | 'deep_dive';
  featured: boolean;
}

/**
 * Request body for POST /api/scriptmaker/draft.
 *
 * The BA names the prospect (firstName + optional context the BA knows)
 * and identifies the product video that just played. ScriptMaker writes a
 * personalized, compliance-clean invitation draft anchored to that product.
 * sponsorBaId is NOT in the payload — the route derives it from the session
 * (locked-spec 3.5), same as the spine.
 */
export interface ScriptMakerDraftPayload {
  /** The product the draft is anchored to (e.g. 'GLP-THREE'). */
  productName: string;
  /** The video that played, for context the model can reference. */
  videoTitle: string;
  /** Prospect's first name — personalizes the draft. */
  prospectFirstName: string;
  /**
   * Optional free-text the BA knows about the prospect ("struggles with
   * late-night snacking", "asked me about Ozempic"). Helps the model
   * tailor the angle. Never required; the draft works without it.
   */
  prospectContext?: string | null;
}

/**
 * Response from POST /api/scriptmaker/draft.
 *
 * `draft` is the suggested invitation message. The BA reviews and edits it
 * before it ever reaches the spine — ScriptMaker proposes, the BA disposes.
 * `degraded` is true when the LLM was unavailable (key not yet wired) and
 * the server returned a neutral fallback so the surface still works.
 */
export interface ScriptMakerDraftResponse {
  ok: true;
  draft: string;
  productName: string;
  prospectFirstName: string;
  /** True when the Anthropic key is unset and a neutral fallback was used. */
  degraded: boolean;
}
