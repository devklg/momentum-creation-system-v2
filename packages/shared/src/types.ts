/**
 * Shared domain types used across server and clients.
 * Kept thin in Phase 0 â€” expand as Phase 1+ surfaces ship.
 */

export type IsoTimestamp = string;

/** Token lifecycle states per COM Design Section E.1.
 *
 * This is the pure funnel rail â€” how far through the .com experience the
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
 * the video â€” they have not yet seen the team forming around them, so
 * "ready to join" would be premature (Chat #109 lock).
 *
 *   - interested_tell_me_more  â†’ "I'm interested â€” tell me more"
 *   - have_questions           â†’ "I have questions"
 *   - ready_to_join            â†’ "I'm ready to join Team Magnificent"
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
 * The BA already has the prospect's contact info â€” no phone field is
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
 * requests over time (Chat #105 spec amendment) â€” these are independent
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
 * position is preserved as a vacant slot â€” #348 does not become #347.
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
 * Replaying any kind is idempotent â€” the server only transitions forward,
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
 * Both prospect and BA are always present â€” the .com surface is never
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
 * cockpit. The client renders the E.2 brief-acknowledgment view â€” no CTA,
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
 * state is already 'expired'. The resolver applies the lazy-flush rule â€”
 * non-terminal tokens whose expiresAt is in the past are transitioned to
 * 'expired' inline (triple-stack write) BEFORE returning 410. Self-healing
 * read path; the cron-based flush scheduler is deferred.
 *
 * The 410 payload carries the inviting BA's contact so the prospect can
 * ask for a fresh link. The F.2 client view renders this as a tap-to-text
 * helper â€” phoneE164 powers a `tel:` link on mobile and a copy-pre-filled-
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * SSE â€” Live placement stream (Chat #114 dashboard port)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Recovered architecture (Chat #84 + #94 prior specification):
 *   GET /api/p/:token/stream
 *     - Returns text/event-stream. Connection held open per viewer.
 *     - On connect, server emits a `snapshot` event carrying the
 *       current global max position + the most recent N placements
 *       (city/state/lastInitial â€” never names that could PII-leak).
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
 * SSE `snapshot` event payload â€” sent once at connection open.
 * Carries the current global max position so the client can compute
 * its own beneath-you count, plus the most recent N placements to
 * seed the position-stack ticker without a separate fetch.
 */
export interface HoldingTankSnapshot {
  globalMaxPosition: number;
  recent: PlacementTickerEntry[];
}

/**
 * SSE `placement` event payload â€” sent every time any prospect on
 * the team completes the video. Every viewer increments their own
 * beneath-you counter by 1 if positionNumber > their own position.
 * The entry is prepended to the position-stack ticker.
 */
export interface PlacementEvent extends PlacementTickerEntry {
  /** Globally-unique id, used as the SSE `id:` field for resumability. */
  eventId: string;
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Webinar events + reservations (Chat #114 dashboard port)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
 * and the BA receives an SMS alert (locked-spec 3.13 â€” Telnyx is the
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Team stats (Chat #115 â€” dashboard Section 5 live activity grid)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Replaces the four seeded constants (47/213/89/+38%) in Section 5 of
 * the prospect dashboard with real, live counts queried server-side at
 * /api/p/:token/team-stats. Refresh policy is client-driven â€” the
 * dashboard polls or re-fetches when the prospect returns; the server
 * computes on each request (no caching at v1 scale).
 *
 * Compliance (locked-spec 3.10):
 *   These four numbers describe TEAM ACTIVITY â€” they make no income
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Invitation spine (Chat #119 â€” the WRITE-side of /p)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * When a BA mints an invitation on .team, the spine creates a prospect
 * record + an invite-token record atomically (triple-stack), mirroring
 * holdingTank.ts placeProspect. The /p READ-side already existed; this is
 * its missing counterpart.
 *
 * "Sent" is tracked as a FIELD (sentAt on the prospect record) + an
 * activity-timeline entry â€” NOT a new token lifecycle state (Chat #119
 * decision). The token rail describes what the PROSPECT did; "sent" is a
 * BA-side fact and lives parallel to the rail so the two never collide.
 *
 * Sponsor immutability (locked-spec 3.5): sponsorBaId is stamped from the
 * authed session BA at the route layer, never from the request body.
 */

/**
 * Who composed the invitation message (Chat #120 lock). The plain
 * /invitations form fills 'self'; Ivory and ScriptMaker fill their own
 * markers when they ship â€” same field, same seam, no schema change later.
 * This is what makes "compare hand-written vs agent-drafted invites"
 * answerable down the road.
 *
 *   - self        â†’ the BA wrote the message by hand in the form
 *   - ivory        â†’ Ivory (who-do-you-know agent) drafted it
 *   - scriptmaker  â†’ ScriptMaker drafted it from a product video
 */
export type InvitationSource = 'self' | 'ivory' | 'scriptmaker';

/**
 * BA-submitted invitation form (Chat #119 field lock, extended Chat #120).
 * first/last name, email, phone, city, state â€” all flow onto the prospect
 * record so the CRM export carries them and city/state render on the
 * dashboard ticker. sponsorBaId is NOT in this payload; the route derives
 * it from the session.
 *
 * `message` (Chat #120) is the invitation text the BA will send. It is
 * STORED for reuse and history â€” storing is NOT sending; the BA still
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
 *   - invitation_sent     â†’ BA confirmed the link was sent (or logged a
 *                           standalone external invite, G.5).
 *   - video_completed      â†’ prospect finished Dr. Dan's video (placement).
 *   - callback_requested   â†’ prospect submitted a callback CTA.
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Cockpit read-side (Chat #121 â€” the My Invites loop)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
 * message. It still makes no income/placement claims â€” status is funnel
 * progress ("watched the video", "asked for a callback"), never earnings.
 */

/**
 * A prospect's status as the cockpit displays it. This is a DISPLAY
 * projection, not a stored field â€” it is computed server-side from the
 * token lifecycle state + the sentAt field + customer flag, collapsing
 * the rail into the handful of states a BA actually acts on.
 *
 *   - draft           â†’ minted, link not yet marked sent by the BA
 *   - sent             â†’ BA tapped "I sent this" (sentAt set), no click yet
 *   - opened           â†’ prospect clicked / started the video (in progress)
 *   - watched          â†’ prospect completed the video (placed in the pool)
 *   - callback         â†’ prospect raised a hand (callback requested)
 *   - enrolled         â†’ walked into THREE off-app, BA marked enrolled
 *   - expired          â†’ 8-week window elapsed (locked-spec 3.7)
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
 * a prospect the BA invited â€” the cockpit's primary unit.
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * ScriptMaker (Chat #122 â€” the product-video front door)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * ScriptMaker lives in the .team VIDEO LIBRARY, anchored to the specific
 * product video the BA just watched (Chat #118 lock â€” it is NOT a comp-plan
 * translator; that framing was drift). It fires two ways: a per-card
 * "who can use this?" button and an auto-prompt when the BA finishes a
 * product video. It produces a DRAFT invitation message anchored to that
 * product, then hands the draft into the existing /invitations form via
 * the seed + source='scriptmaker' seam (Chat #120). It does NOT mint the
 * token, create the prospect, or send anything â€” those stay in the spine.
 *
 * Prospect-surfacing ("who do you know") is IVORY's job (its own surface,
 * next session). This session ScriptMaker drafts only; the BA names the
 * prospect, ScriptMaker writes the product-anchored message. When Ivory
 * ships it routes a surfaced name into this same draft step. One engine,
 * multiple front doors (Chat #118).
 *
 * Compliance (locked-spec 3.11 script-time enforcement + 3.10):
 *   The draft is BA-composed outbound word-of-mouth, but the compliance
 *   frame still binds what the LLM may write â€” NO income claims, NO
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
 * completion signal â€” the legacy page linked OUT to YouTube with no
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
  /** 'glp_three' | 'product_line' | 'back_office' | 'app' â€” library section. */
  category: string;
  /** mm:ss display string from the source catalog. */
  duration: string;
  /** 'full' | 'short' | 'deep_dive' â€” drives the card badge. */
  kind: 'full' | 'short' | 'deep_dive';
  featured: boolean;
}

/**
 * Request body for POST /api/scriptmaker/draft.
 *
 * The BA names the prospect (firstName + optional context the BA knows)
 * and identifies the product video that just played. ScriptMaker writes a
 * personalized, compliance-clean invitation draft anchored to that product.
 * sponsorBaId is NOT in the payload â€” the route derives it from the session
 * (locked-spec 3.5), same as the spine.
 */
export interface ScriptMakerDraftPayload {
  /** The product the draft is anchored to (e.g. 'GLP-THREE'). */
  productName: string;
  /** The video that played, for context the model can reference. */
  videoTitle: string;
  /** Prospect's first name â€” personalizes the draft. */
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
 * before it ever reaches the spine â€” ScriptMaker proposes, the BA disposes.
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Prospect re-entry â€” temporary prospect account (locked-spec 3.17)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Closes Chat #125's prospect-re-entry open question. Layer 2 is the
 * account row; Layer 3 is the /p/login SMS magic-link surface on .com.
 *
 * Sponsor immutability (3.5) is the load-bearing invariant: every
 * record below stamps sponsorBaId from the inviting token and is
 * not writable thereafter â€” re-entry resolves to the ORIGINAL token
 * and ORIGINAL inviting BA, never a different one. A phone may be
 * tied to multiple active tokens (rare but legal); a /p/login/start
 * fans out one SMS per matched token so the prospect picks which
 * dashboard to re-enter. Auto-picking would silently bind a sponsor
 * the system chose, which 3.5 forbids.
 */

/**
 * Temporary prospect account. Created at video_complete in the
 * placement path. Expires at the 8-week flush boundary of the token
 * (3.7). Phone is null until the prospect submits a callback_request
 * or webinar_reserve â€” those affirmative actions are the consent
 * signal to copy prospects.phone into the account row.
 */
export interface ProspectAccountRecord {
  accountId: string;
  prospectId: string;
  /** The original invite token. Re-entry resolves to this token only. */
  tokenId: string;
  /** Stamped from the token at creation; immutable thereafter (3.5). */
  sponsorBaId: string;
  /** E.164 â€” null until callback/webinar consent signal fires. */
  phone: string | null;
  createdAt: IsoTimestamp;
  /** Aligned with the token's expiresAt (3.7 â€” the 8-week flush). */
  expiresAt: IsoTimestamp;
  lastLoginAt: IsoTimestamp | null;
}

/**
 * Magic-link row. One per /p/login/start hit per matched account.
 * The linkToken is the credential â€” knowledge of it grants a session.
 * 15-minute TTL, single-use (redeemedAt stamped on redeem).
 */
export interface ProspectMagicLinkRecord {
  linkToken: string;
  accountId: string;
  /** Carried for fast redirect after redeem. */
  tokenId: string;
  issuedAt: IsoTimestamp;
  /** issuedAt + 15min. */
  expiresAt: IsoTimestamp;
  redeemedAt: IsoTimestamp | null;
  /** SHA-256 of the requesting phone â€” supports rate-limit audit without storing raw phones twice. */
  requestPhoneHash: string;
}

/**
 * Request body for POST /api/p/login/start.
 * Phone is required and is the only field.
 */
export interface ProspectLoginStartPayload {
  /** Caller-supplied phone. Server normalizes to E.164 before lookup. */
  phone: string;
}

/**
 * Response from POST /api/p/login/start.
 *
 * Opaque-by-design â€” the response never reveals whether the phone
 * matched any account. Same payload returned for "no match" and
 * "N matches, N SMSes sent". The page copy is identical in both
 * cases: "If that phone is on file, you'll receive a text shortly."
 * This prevents anyone holding a phone book from probing the system
 * for prospect presence.
 */
export interface ProspectLoginStartResponse {
  ok: true;
}

/**
 * Request body for POST /api/p/login/redeem.
 */
export interface ProspectLoginRedeemPayload {
  linkToken: string;
}

/**
 * Response from POST /api/p/login/redeem on success. The client
 * redirects to /p/{tokenId} after this lands. The server sets the
 * mcs_prospect_session cookie (scoped to .teammagnificent.com) in
 * the same response â€” the body just confirms the target.
 */
export interface ProspectLoginRedeemResponse {
  ok: true;
  tokenId: string;
}

/**
 * Failure response from /redeem. The client renders one view for
 * both error shapes â€” "this link has expired or already been used"
 * â€” to avoid leaking which case occurred.
 */
export interface ProspectLoginRedeemError {
  ok: false;
  error: 'invalid_link' | 'expired_link' | 'already_used';
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * Admin audit-log substrate (locked-spec 4.J Â· project-wireframe 4.J)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * The substrate every other /admin surface writes against. Core
 * Dashboard, BA Oversight, Prospect Oversight, Queue Oversight, and
 * Live Ops all WRITE here â€” none of them can be built correctly
 * until the entry schema is locked.
 *
 * Append-only â€” like the decision ledger and pool positions (3.2).
 * No update, no delete, ever. Monotonic by `(timestamp, entryId)`.
 *
 * Triple-stacked per 3.14: MongoDB (`audit_log`) is the canonical
 * store; Neo4j stamps `(:AuditEntry)-[:ACTED_BY]->(:Actor)` and
 * `(:AuditEntry)-[:ACTED_ON]->(:Entity)` for traversal; Chroma
 * indexes the action+reason+entity blob so Kevin can semantic-search
 * the log ("find every sponsor override Q1").
 *
 * Michael interview transcripts link FROM audit entries via the
 * optional `linkedTranscriptId` (Chat #89 â€” no separate tab).
 */

/**
 * Top-level role of whoever performed the action. Denormalized off
 * the `actor` discriminator below so filtering by role doesn't need
 * a nested predicate on every read.
 */
export type AuditActorRole = 'admin' | 'ba' | 'system' | 'prospect' | 'anonymous';

/**
 * Discriminated actor. The kind aligns with `AuditActorRole`. For
 * 'system' the label names the cron / boot routine (e.g. 'lazy-flush',
 * 'webinar-seeder'). For 'anonymous' the actor is unidentifiable â€”
 * used for /admin-gate denials and unauthenticated probes.
 */
export type AuditActor =
  | { kind: 'admin'; baId: string; displayName: string }
  | { kind: 'ba'; baId: string; displayName: string }
  | { kind: 'system'; label: string }
  | { kind: 'prospect'; prospectId: string; displayName: string }
  | { kind: 'anonymous'; ip: string | null };

/**
 * The thing acted on. `kind` is the entity family; `id` is the
 * stable identifier in that family. `displayLabel` is an optional
 * human string the admin view shows in the row ("Jane S. Â· TOK-...")
 * so cell formatting doesn't need a per-kind lookup.
 *
 * 'none' is the legal value when the action is system-level and
 * doesn't act on a discrete record (e.g. boot, config reload).
 */
export type AuditEntityKind =
  | 'brand_ambassador'
  | 'invite_token'
  | 'prospect'
  | 'access_code'
  | 'callback_request'
  | 'webinar_reservation'
  | 'pool_placement'
  | 'admin_session'
  | 'master_content'
  | 'queue_rule'
  | 'compliance_rule'
  | 'michael_session'
  | 'audit_entry'
  | 'none';

export interface AuditEntity {
  kind: AuditEntityKind;
  id: string;
  displayLabel: string | null;
}

/**
 * Severity drives row treatment in the admin view and feeds the
 * Core Dashboard's "needs Kevin" widget. 'critical' is reserved for
 * sponsor overrides, compliance violations, and admin-gate breaches.
 */
export type AuditSeverity = 'info' | 'warn' | 'critical';

/**
 * Optional request-trace context. Captured for every /admin request
 * and every API mutation; omitted for system-internal events that
 * have no HTTP envelope (cron jobs, boot routines).
 */
export interface AuditContext {
  ip: string | null;
  userAgent: string | null;
  route: string | null;
  method: string | null;
  requestId: string | null;
}

/**
 * One audit log entry. The substrate every other /admin surface
 * writes against. Every triple-stack write, every /admin request,
 * every mutation produces one of these.
 *
 * Fields:
 *   - entryId          monotonic-friendly ID: `audit_<ISO>_<rand>`
 *   - timestamp        when the event happened (event time, not write time)
 *   - createdAt        when the row was persisted (write time)
 *   - role             denormalized actor.kind â†’ AuditActorRole
 *   - actor            discriminated; carries the real id + display name
 *   - action           namespaced verb: `domain.entity.action`
 *                      (e.g. `admin.sponsor.override`, `ba.invitation.create`,
 *                      `prospect.video.complete`, `system.token.flush`)
 *   - entity           what was acted on (kind+id+optional label)
 *   - severity         info | warn | critical
 *   - before           pre-state snapshot (mutations / overrides only)
 *   - after            post-state snapshot (mutations / overrides only)
 *   - reason           human reason â€” REQUIRED on critical overrides (locked-spec 2.4)
 *   - context          request-trace metadata (optional for system actions)
 *   - linkedTranscriptId Michael interview transcript ID (Chat #89)
 *
 * Append-only invariant: writers MUST NOT update or delete entries.
 * The store has no exported mutator helper â€” only `appendAuditEntry`.
 */
export interface AuditLogEntry {
  entryId: string;
  timestamp: IsoTimestamp;
  createdAt: IsoTimestamp;
  role: AuditActorRole;
  actor: AuditActor;
  action: string;
  entity: AuditEntity;
  severity: AuditSeverity;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  context: AuditContext | null;
  linkedTranscriptId: string | null;
}

/**
 * Input shape for `appendAuditEntry`. The domain layer stamps
 * `entryId` and `createdAt`; everything else comes from the caller.
 * `timestamp` defaults to now on the server if the caller omits it.
 */
export interface AppendAuditEntryInput {
  timestamp?: IsoTimestamp;
  actor: AuditActor;
  action: string;
  entity: AuditEntity;
  severity?: AuditSeverity;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  context?: AuditContext | null;
  linkedTranscriptId?: string | null;
}

/**
 * Query params for GET /api/admin/audit. All filters are optional
 * and AND together. Cursor pagination is descending by `(timestamp,
 * entryId)` â€” newest first â€” because the most useful read is "what
 * just happened?". Cursor is the last entry's `entryId` from the
 * previous page; pass it back as `before` to fetch the next page.
 */
export interface AuditQueryFilters {
  actorBaId?: string;
  role?: AuditActorRole;
  action?: string;
  actionPrefix?: string;
  entityKind?: AuditEntityKind;
  entityId?: string;
  severity?: AuditSeverity;
  /** ISO timestamp â€” inclusive lower bound on entry.timestamp. */
  from?: IsoTimestamp;
  /** ISO timestamp â€” exclusive upper bound on entry.timestamp. */
  to?: IsoTimestamp;
  /** Pagination cursor: entryId from the previous page. */
  before?: string;
  /** Page size, clamped server-side. */
  limit?: number;
}

/**
 * Response from GET /api/admin/audit. Reverse-chronological. Cursor
 * is null when the page is the last page.
 */
export interface AuditListResponse {
  ok: true;
  entries: AuditLogEntry[];
  nextCursor: string | null;
  appliedFilters: AuditQueryFilters;
}

/**
 * Response from GET /api/admin/audit/:entryId. 404 if not found.
 */
export interface AuditEntryResponse {
  ok: true;
  entry: AuditLogEntry;
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// IVORY + GENERATOR (Chat #131 â€” wireframe Â§3.4)
//
// Ivory is the BA-private warm-market roster + an LLM coach that surfaces
// "who do you know?" reflection prompts (it never names specific people).
// Generator is the per-product, per-angle workflow that reads the roster
// and converges each selected name onto ONE action: mint that product's
// /p/{token} invite via the existing spine (source='ivory').
//
// Compliance (locked-spec 3.10, 3.11):
//   - Ivory's coach is BA-facing only. Never calls, texts, or scores a
//     prospect. Never speaks comp/income/medical (script-time prefix
//     enforces this exactly like ScriptMaker).
//   - Ivory does not import the CV table or any compensation figures.
//     The "product gallery" here means the product VIDEO/share set;
//     pricing/CV/comp math belong to training surfaces only.
//   - All Ivory writes are scoped to the authed BA. There is no
//     cross-BA visibility on warm-market names.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Domains a BA tags an Ivory name with (the WDYK memory hooks). Multi-tag.
 * Mirrors the standard warm-market category set BAs actually use; keep this
 * small and stable â€” the coach prompts reference these categories by name.
 */
export type IvoryCategory =
  | 'family'
  | 'close_friend'
  | 'work'
  | 'church'
  | 'school'
  | 'neighbor'
  | 'gym'
  | 'social'
  | 'past_colleague'
  | 'other';

/**
 * Disposition the BA marks on an Ivory name. ALL transitions are BA-driven
 * (manual). The system never auto-changes status â€” Ivory is a coach, not a
 * scorer. The one programmatic transition is newâ†’invited, which fires when
 * Generator mints an invite for the name (still a BA action, just relayed).
 */
export type IvoryStatus =
  | 'new'
  | 'invited'
  | 'customer'
  | 'ba'
  | 'not_interested'
  | 'follow_up';

/**
 * The share angle the BA most likely uses for this person (Generator hint
 * + coach context). 'unspecified' is the default for newly-added names.
 */
export type IvoryAngle =
  | 'do_the_business'
  | 'make_money'
  | 'lose_fat'
  | 'unspecified';

/**
 * The Ivory roster record. One per (baId, person). BA-private â€” never
 * surfaced cross-BA. lastInitial is derived from lastName at write time so
 * a partial display ("Marcus L.") is cheap; full lastName stays on the
 * record for the BA's own reference.
 */
export interface IvoryName {
  ivoryId: string;
  baId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  notes: string;
  categories: IvoryCategory[];
  preferredAngle: IvoryAngle;
  status: IvoryStatus;
  /** prospectId of the most recent invite for this name, if any. */
  lastProspectId: string | null;
  /** ISO timestamp of any status/edit change â€” sort key for the roster view. */
  lastTouchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/ivory request body. */
export interface CreateIvoryNamePayload {
  firstName: string;
  lastName: string;
  notes?: string;
  categories?: IvoryCategory[];
  preferredAngle?: IvoryAngle;
}

/** PATCH /api/ivory/:ivoryId request body. */
export interface UpdateIvoryNamePayload {
  firstName?: string;
  lastName?: string;
  notes?: string;
  categories?: IvoryCategory[];
  preferredAngle?: IvoryAngle;
}

/** PATCH /api/ivory/:ivoryId/status request body. */
export interface UpdateIvoryStatusPayload {
  status: IvoryStatus;
}

/** GET /api/ivory 200 response. */
export interface ListIvoryNamesResponse {
  ok: true;
  names: IvoryName[];
}

/** Single-record success response shared by POST/PATCH/DELETE. */
export interface IvoryNameResponse {
  ok: true;
  name: IvoryName;
}

/**
 * POST /api/ivory/coach request body. The coach surfaces WDYK PROMPTS the
 * BA reflects on to recall names from their own memory. It never names
 * specific people, never scores anyone, never speaks comp/income/medical.
 */
export interface IvoryCoachPayload {
  angle: IvoryAngle;
  /** Anchor the coaching on a specific product video, if one is in context. */
  productName?: string | null;
  /** Current roster size â€” coach uses it to tune tone (e.g. encourage adds). */
  rosterSize: number;
  /** BA's own free-form prompt â€” e.g. "I keep forgetting people from church." */
  ask: string;
}

/**
 * POST /api/ivory/coach 200 response. Returns a short paragraph framing the
 * brainstorm plus a list of open-ended WDYK questions. degraded=true when
 * the LLM was unavailable and an evergreen deterministic fallback was used
 * (mirrors ScriptMaker's pattern â€” the surface works before the key lands).
 */
export interface IvoryCoachResponse {
  ok: true;
  coaching: string;
  prompts: string[];
  degraded: boolean;
}

/**
 * A Generator run: one BA picks a product + angle, surfaces names from
 * the Ivory roster, and converts each selected name into a /p/{token}
 * invitation via the existing spine. The run record is the audit trail â€”
 * "on Tuesday I worked Visage / lose-fat across these 6 names, minted 6
 * tokens." The run never owns identity; the spine does.
 */
export interface GeneratorRun {
  runId: string;
  baId: string;
  productKey: string;
  productName: string;
  angle: IvoryAngle;
  selectedIvoryIds: string[];
  invitations: Array<{
    ivoryId: string;
    prospectId: string;
    token: string;
    inviteUrl: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/ivory/generator/run request body. */
export interface CreateGeneratorRunPayload {
  productKey: string;
  angle: IvoryAngle;
  /** Optional pre-selection â€” the BA can multi-select before pressing Start. */
  selectedIvoryIds?: string[];
}

/** POST /api/ivory/generator/run 200 response. */
export interface CreateGeneratorRunResponse {
  ok: true;
  run: GeneratorRun;
}

/** GET /api/ivory/generator/run/:runId 200 response. */
export interface GeneratorRunResponse {
  ok: true;
  run: GeneratorRun;
}

/**
 * POST /api/ivory/generator/run/:runId/invite request body.
 *
 * One name at a time. The server mints a fresh /p/{token} via the existing
 * createInvitation, marks the Ivory name as status='invited', and appends
 * to the run's invitations[]. The BA copies the link and texts it from
 * their own phone â€” the spine never auto-sends (locked-spec 1.13 / 3.6).
 */
export interface GeneratorInvitePayload {
  ivoryId: string;
  /** Optional invitation message (mirrors /api/invitations message field). */
  message?: string | null;
  /** City / state default to 'â€”' if the BA has not captured them on the name. */
  city?: string;
  stateOrRegion?: string;
  /** Optional phone â€” falls through to the spine; not required for mint. */
  phone?: string | null;
  email?: string | null;
}

/** POST /api/ivory/generator/run/:runId/invite 200 response. */
export interface GeneratorInviteResponse {
  ok: true;
  run: GeneratorRun;
  /** The single invitation just minted, surfaced for immediate copy. */
  invitation: {
    ivoryId: string;
    prospectId: string;
    token: string;
    inviteUrl: string;
    createdAt: string;
    expiresAt: string;
  };
}
/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 * BA CRM write-side (Chat #132 â€” wireframe 3.3 CRM leaves)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * The WRITE-side companion to the Chat #121 cockpit READ-side. The cockpit
 * lets a BA SEE every prospect they invited; this module lets the BA ACT on
 * them â€” notes, follow-up reminders, dispositions, re-invite â€” without
 * touching the read pipeline.
 *
 * Five fixed disposition tags (Kevin lock):
 *   new-ba | new-customer | interested | not-interested | later
 * Dispositions are BA-set state, distinct from the funnel rail (which the
 * PROSPECT drives). A prospect can be on any token state and carry any
 * disposition independently.
 *
 * Re-invite cooldown: 7 days from the most recent sentAt. A draft (sentAt
 * null) has no cooldown â€” that path is just the existing "I sent this".
 *
 * Sponsor immutability (locked-spec 3.5): every CRM record carries the
 * authed session BA's baId and every read/write filters on it. A note,
 * follow-up, or disposition belongs to ONE (prospect, BA) pair â€” if two
 * BAs ever shared a prospect (today they can't), each would have their own
 * private CRM.
 *
 * Compliance (locked-spec 3.10): BA-facing surface only. Notes and tags are
 * never rendered on .com. Today's Actions list is operational ("Sarah asked
 * for a callback") and carries no income/placement language.
 */

export type CrmDisposition =
  | 'new-ba'
  | 'new-customer'
  | 'interested'
  | 'not-interested'
  | 'later';

/** All five dispositions in BA-action-priority order (for UI rendering). */
export const CRM_DISPOSITIONS: readonly CrmDisposition[] = [
  'new-ba',
  'new-customer',
  'interested',
  'later',
  'not-interested',
] as const;

/**
 * A BA-private timestamped note about a prospect. Append-only â€” notes are
 * never edited or deleted, so the cockpit can show the BA their evolving
 * thinking. One prospect can carry many notes; the cockpit renders them
 * newest-first.
 */
export interface CrmNoteRecord {
  noteId: string;
  prospectId: string;
  sponsorBaId: string;
  text: string;
  createdAt: IsoTimestamp;
}

/**
 * One follow-up reminder per (prospect, BA). Setting a new follow-up
 * replaces the previous one (latest wins). Clearing sets clearedAt â€” the
 * record stays for audit, but Today's Actions filters it out.
 */
export interface CrmFollowUpRecord {
  prospectId: string;
  sponsorBaId: string;
  dueAt: IsoTimestamp;
  createdAt: IsoTimestamp;
  clearedAt: IsoTimestamp | null;
}

/**
 * Current disposition tag for a (prospect, BA). Only the latest value
 * matters; the cockpit shows one pill. Stored as its own record so a future
 * surface can audit the change history without us editing the prospect doc.
 */
export interface CrmDispositionRecord {
  prospectId: string;
  sponsorBaId: string;
  disposition: CrmDisposition;
  updatedAt: IsoTimestamp;
}

/** POST /api/crm/:prospectId/notes â€” append a note. */
export interface CreateNotePayload {
  text: string;
}

export interface CreateNoteResponse {
  ok: true;
  note: CrmNoteRecord;
}

/** POST /api/crm/:prospectId/followup â€” set or replace the active follow-up. */
export interface SetFollowUpPayload {
  /** ISO timestamp. Must be in the future. */
  dueAt: IsoTimestamp;
}

export interface SetFollowUpResponse {
  ok: true;
  followUp: CrmFollowUpRecord;
}

/** DELETE /api/crm/:prospectId/followup â€” clear the active follow-up. */
export interface ClearFollowUpResponse {
  ok: true;
}

/**
 * POST /api/crm/:prospectId/disposition â€” set or clear the disposition.
 * `null` clears the tag (prospect has no current disposition).
 */
export interface SetDispositionPayload {
  disposition: CrmDisposition | null;
}

export interface SetDispositionResponse {
  ok: true;
  disposition: CrmDisposition | null;
}

/**
 * Per-prospect CRM bundle returned by GET /api/crm/:prospectId. Loaded
 * lazily when the BA expands an invite row â€” keeps the initial cockpit
 * fetch fast.
 *
 * `reinviteAvailableAt` is null when the BA can re-invite right now. When
 * non-null, the cockpit disables the button and renders "available {at}".
 */
export interface ProspectCrmBundle {
  prospectId: string;
  notes: CrmNoteRecord[];
  followUp: CrmFollowUpRecord | null;
  disposition: CrmDisposition | null;
  reinviteAvailableAt: IsoTimestamp | null;
}

export interface CrmBundleResponse {
  ok: true;
  bundle: ProspectCrmBundle;
}

/**
 * One item on the Today's Actions card. Three sources:
 *   - 'callback'  â†’ prospect raised a hand (latest unhandled intent)
 *   - 'followup'  â†’ BA-set reminder whose dueAt has elapsed
 *   - 'draft'     â†’ prospect minted but never marked sent
 *
 * `at` is the timestamp the action surfaced (callback time / follow-up
 * dueAt / mint time). The cockpit sorts by it (newest-first).
 */
export type TodayActionKind = 'callback' | 'followup' | 'draft';

export interface TodayActionItem {
  kind: TodayActionKind;
  prospectId: string;
  firstName: string;
  lastInitial: string;
  at: IsoTimestamp;
  /** Set when kind = 'callback'; null otherwise. */
  intent: CallbackIntent | null;
  /** Set when kind = 'followup'; null otherwise. */
  followUpDueAt: IsoTimestamp | null;
}

export interface TodaysActionsResponse {
  ok: true;
  actions: TodayActionItem[];
}

/**
 * POST /api/crm/:prospectId/reinvite â€” bump sentAt and append an activity
 * entry. If the existing token has expired, the spine also mints a fresh
 * one â€” `fresh: true` distinguishes the two cases for the cockpit toast.
 *
 * Cooldown: 7 days from the prospect's current sentAt. If the BA has not
 * yet marked the original sent (sentAt null), reinvite is forbidden â€” the
 * BA should use the existing "I sent this" path.
 */
export interface ReinviteResponse {
  ok: true;
  prospectId: string;
  token: string;
  inviteUrl: string;
  sentAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  /** True when a fresh token was minted (the previous one had expired). */
  fresh: boolean;
}

export interface ReinviteCooldownError {
  ok: false;
  error: 'cooldown';
  /** Timestamp the BA can next re-invite this prospect. */
  availableAt: IsoTimestamp;
}

export interface ReinviteUnsentError {
  ok: false;
  /** The prospect has never been marked sent â€” use "I sent this" instead. */
  error: 'not_yet_sent';
}

export interface ReinviteTerminalError {
  ok: false;
  /** Cannot re-invite an enrolled prospect. */
  error: 'enrolled';
}
/*
 * Fast Start Training â€” the self-paced first-7-days curriculum
 * (feat/fast-start-training Â· wireframe 3.5)
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *
 * Five modules, sequential (not hard-gated) in the UI. Source content
 * for Modules 2-3 is ported from Team Magnificent's published Power in
 * Numbers training (devklg.github.io/team-magnificent-training); Module
 * 1 is built from the THREE GLP-THREE fact sheet + product line; Module
 * 4 links out to /ivory; Module 5 teaches the names-list + numbers
 * mindset that turns the binary into real activity.
 *
 * Compliance scope: .team only. CV/dollar figures inside these modules
 * are legitimate inside the regulated training environment and never
 * bleed to .com (locked-spec 3.10/3.11). The mantra is People Â· Momentum
 * Â· Volume Â· Checks (PMV+C) â€” same voice as /training/10-steps.
 *
 * Michael gate: Module 1 is whitelisted (a new BA can build belief in
 * the product before Michael's interview); Modules 2-5 are gated. See
 * MICHAEL_GATE_WHITELIST in server/src/domain/michael-schedule.ts.
 *
 * Sponsor immutability (locked-spec 3.5): progress records are stamped
 * with the authed session baId; nothing in a request body can write to
 * a different BA's progress.
 *
 * Completion: all 5 modules `completed` AND >= 1 invitation sent
 * (cross-checked against the spine's sentAt field at read time â€”
 * progress doesn't store its own invitation count).
 */

/** Module identifier â€” a stable integer 1..5 per locked TASK ordering. */
export type FastStartModuleId = 1 | 2 | 3 | 4 | 5;

/** Per-module lifecycle. Sequential in the UI, not hard-gated. */
export type FastStartModuleState =
  | 'not_started'
  | 'in_progress'
  | 'completed';

/**
 * Stored progress record. One row per (baId, moduleId). The triple-stack
 * write inserts on first touch and updates state thereafter â€” domain
 * branches on existence per the gateway upsert quirk.
 */
export interface FastStartProgressRecord {
  /** Composite id `${baId}__${moduleId}` for idempotent triple-stack writes. */
  _id: string;
  baId: string;
  moduleId: FastStartModuleId;
  state: FastStartModuleState;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
  /** Updated on every state transition. */
  updatedAt: IsoTimestamp;
  createdAt: IsoTimestamp;
}

/**
 * One module's status as the hub displays it. The eyebrow/title/slug
 * are *not* stored â€” they're constants attached client-side and on the
 * server from FAST_START_MODULES below. Only the lifecycle fields come
 * from persistence.
 */
export interface FastStartModuleStatus {
  moduleId: FastStartModuleId;
  state: FastStartModuleState;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
}

/**
 * GET /api/training/fast-start/progress response. The full per-BA Fast
 * Start state. `complete` is the canonical "is the BA done" boolean
 * the welcome flow + cockpit + admin metrics read.
 *
 * Completion rule (TASK.md, this branch):
 *   complete = (all 5 modules `completed`) AND (invitationsSent >= 1)
 *
 * `invitationsSent` is cross-checked from the Chat #119 invitation
 * spine (prospects.sentAt) at read time â€” Fast Start does not duplicate
 * the count.
 */
export interface FastStartProgressResponse {
  ok: true;
  modules: FastStartModuleStatus[];
  invitationsSent: number;
  complete: boolean;
}

/**
 * POST /api/training/fast-start/modules/:id/state request body.
 * Transitions are forward-only (not_started â†’ in_progress â†’ completed);
 * the server rejects backward writes idempotently with the current state.
 */
export interface FastStartMarkStatePayload {
  state: Exclude<FastStartModuleState, 'not_started'>;
}

/** POST response â€” echoes the resulting status the hub re-renders against. */
export interface FastStartMarkStateResponse {
  ok: true;
  moduleId: FastStartModuleId;
  state: FastStartModuleState;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
}

/**
 * Static module metadata. Lives in @momentum/shared so both server
 * (validation, the route's :id parser) and client (hub render) read
 * one source. Slug drives the client URL: /training/fast-start/{slug}.
 * Order is fixed and load-bearing â€” never reorder; append-only if a
 * Module 6 ever ships (the wireframe currently stops at 5).
 */
export const FAST_START_MODULES: readonly {
  id: FastStartModuleId;
  slug: 'product' | 'comp-layer-1' | 'binary' | 'prospect-list' | 'team';
  eyebrow: string;
  title: string;
  /** Short one-liner on the hub card. */
  blurb: string;
}[] = [
  {
    id: 1,
    slug: 'product',
    eyebrow: 'MODULE 01 Â· PRODUCT',
    title: 'The Product',
    blurb: 'GLP-THREE and the six-pillar product story. What you take, what you share, why people stay.',
  },
  {
    id: 2,
    slug: 'comp-layer-1',
    eyebrow: 'MODULE 02 Â· COMPENSATION',
    title: 'Comp Plan, Layer 1',
    blurb: 'How the money actually works. Active, Qualified, and the 300 + 600 = 900 CV cycle.',
  },
  {
    id: 3,
    slug: 'binary',
    eyebrow: 'MODULE 03 Â· STRUCTURE',
    title: 'The Binary as Two Legs',
    blurb: 'Power Leg and Pay Leg, no breakage, and why first-mover position is structural math.',
  },
  {
    id: 4,
    slug: 'prospect-list',
    eyebrow: 'MODULE 04 Â· PROSPECTS',
    title: 'Build Your Prospect List',
    blurb: 'Names list, mindset, and where Ivory comes in. The system you write FROM, not into.',
  },
  {
    id: 5,
    slug: 'team',
    eyebrow: 'MODULE 05 Â· TEAM',
    title: 'Build Your Team',
    blurb: 'NOT "find two and stop." Your first two activate you. A team is the business.',
  },
] as const;

/* ─── #134 BA profile / settings (wireframe 3.8) ─── */

/**
 * Per-topic × per-channel notification preferences. Topics are the events
 * that actually generate alerts in MCS today; J.12 (which channels default
 * on per topic) is OPEN — the conservative defaults below are flagged in
 * the chat heartbeat for Kevin to confirm or amend.
 */
export interface BANotifChannelMix {
  sms: boolean;
  email: boolean;
  inApp: boolean;
}

export interface BANotifPrefs {
  callbackRequested: BANotifChannelMix;
  webinarReserved: BANotifChannelMix;
  newSponsoredBA: BANotifChannelMix;
  michaelComplete: BANotifChannelMix;
  poolMovement: BANotifChannelMix;
}

/**
 * J.12 conservative defaults. Reasoning surfaced in the Chat #134 heartbeat:
 *   - Live person-asks-for-callback signals (callback, webinar) default
 *     SMS=on — callback already SMS-alerts the BA per Chat #105.
 *   - Lower-frequency stream signals default in-app only.
 *   - Email defaults off everywhere until Resend's domain is verified
 *     (locked-spec Part 5, Resend dormant until Namecheap DNS lands).
 */
export const BA_NOTIF_DEFAULTS: BANotifPrefs = {
  callbackRequested: { sms: true, email: false, inApp: true },
  webinarReserved: { sms: true, email: false, inApp: true },
  newSponsoredBA: { sms: false, email: false, inApp: true },
  michaelComplete: { sms: false, email: false, inApp: true },
  poolMovement: { sms: false, email: false, inApp: true },
};

/**
 * GET /api/profile response — the authed BA's full profile shape.
 *
 * Sponsor + threeBaId + tmBaId + accessCodeHeld are READ-ONLY (locked-spec
 * 3.5 / 2.3) and the PATCH surface intentionally omits them. The read shape
 * carries them so the page can render the read-only card without a second
 * fetch.
 */
export interface BAProfile {
  // Editable (wf_0071)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  photoUrl: string | null;
  notifPrefs: BANotifPrefs;

  // Read-only (wf_0072)
  tmBaId: string;
  threeBaId: string;
  /** The BA's own TM-XXXX code (one per BA for life — 2.3). null if Kevin hasn't issued one yet. */
  accessCodeHeld: string | null;
  sponsor: {
    baId: string;
    threeBaId: string;
    fullName: string;
  };

  /** Pending change targets — surface "verify your new email/phone" prompts. */
  pendingEmail: string | null;
  pendingPhone: string | null;
}

/**
 * PATCH /api/profile body — partial updates of directly-editable fields.
 * Email and phone changes go through /api/profile/email/* and
 * /api/profile/phone/* (challenge + verify). Password change goes through
 * /api/profile/password. None of {sponsor, tmBaId, threeBaId,
 * accessCodeHeld} appear here by design.
 */
export interface BAProfilePatch {
  firstName?: string;
  lastName?: string;
  timezone?: string;
  photoUrl?: string | null;
  notifPrefs?: Partial<BANotifPrefs>;
}

/** GET /api/profile envelope. */
export interface ProfileGetResponse {
  ok: true;
  profile: BAProfile;
}

/** Generic mutation envelope used by every /profile mutation route. */
export type ProfileMutationResponse =
  | { ok: true }
  | { ok: false; error: string };

/** POST /api/profile/password body — argon2id rehash on success. */
export interface ProfilePasswordBody {
  currentPassword: string;
  newPassword: string;
}

/**
 * Email re-verify (start) — body is the *new* address. The server mints a
 * 6-digit code, persists a challenge row, and dispatches the code to the
 * NEW address via Resend. If EMAIL_API_KEY is unset, the challenge still
 * persists (emailDeliveryStatus='skipped') so dev can complete the flow
 * by reading the code off the challenge row.
 */
export interface ProfileEmailStartBody {
  newEmail: string;
}
export interface ProfileEmailVerifyBody {
  code: string;
}

/**
 * Phone re-verify (start) — J.8 conservative default: SMS code mirroring
 * email re-verify (flagged in Chat #134 heartbeat; Kevin may prefer
 * immediate effect). The server sends a 6-digit code to the NEW number
 * via Telnyx SMS. Pending phone is not written to the BA record until
 * /verify succeeds.
 */
export interface ProfilePhoneStartBody {
  newPhone: string;
}
export interface ProfilePhoneVerifyBody {
  code: string;
}

/**
 * Persisted challenge row shape — one collection per channel
 * (`email_change_challenges`, `phone_change_challenges`). 6-digit numeric
 * code, 15-minute TTL, single-use.
 */
export interface ProfileChangeChallengeRecord {
  challengeId: string;
  baId: string;
  channel: 'email' | 'phone';
  /** Target address/number the code was dispatched to. */
  target: string;
  /** SHA-256 of the code — never store the raw code. */
  codeHash: string;
  issuedAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  redeemedAt: IsoTimestamp | null;
  /** Channel dispatch outcome — mirrors the prospect magic-link convention. */
  deliveryStatus: 'queued' | 'sent' | 'failed' | 'skipped';
  deliveryError: string | null;
}

/* ─── #134 Michael interview surface ─── */
//
// Locked-spec 3.12: Michael is an outbound Telnyx voice agent that calls every
// new BA shortly after signup, conducts a short structured interview, and feeds
// transcript + scoring back to the BA record and the upline cockpit. BA-facing
// only — never prospect-facing, never on .com. No objections, no pitch, no
// qualify. Teaches Layer 1 only and captures context for the sponsor.
//
// These types describe the post-scheduling surface (the call itself + the
// completed-call artifact). The schedule shape lives in
// server/src/domain/michael-schedule.ts.

/** UI phase of the interview surface (distinct from the schedule status). */
export type MichaelInterviewPhase =
  | 'awaiting_call'      // wf_0038 — scheduled, before/at slot, gold pill
  | 'call_in_progress'   // wf_0039 — call.answered fired, teal pill, live transcript
  | 'complete'           // wf_0040 — call.hangup after answered, gold check
  | 'no_answer'          // wf_0041 — missed: no-answer / busy / declined
  | 'invalid_number'     // wf_0041 — Telnyx flagged invalid destination
  | 'stt_failed';        // wf_0041 — call completed but transcript ingest failed

/** One speaker turn (or partial turn) in the live transcript. Append-only. */
export interface MichaelTranscriptChunk {
  /** Monotonic order within the call. Stamped server-side at ingest. */
  sequence: number;
  /** Which side of the line. 'ba' = the new Brand Ambassador on the phone. */
  speaker: 'michael' | 'ba';
  /** Plain-text utterance for this chunk. Punctuation per STT. */
  text: string;
  /** ISO-8601 UTC of the chunk boundary (STT segment end). */
  occurredAt: string;
}

/** One of Michael's 5 structured interview questions + the BA's answer.
 *  The 5 specific prompts are open per wireframe §3.2 DEP — the artifact
 *  carries whatever the scoring worker submits. UI renders all answers
 *  generically without hardcoding question text. */
export interface MichaelInterviewAnswer {
  /** Stable id for the question (e.g. "q1_why_now"). */
  questionId: string;
  /** The prompt Michael read aloud, captured for sponsor readback. */
  prompt: string;
  /** The BA's answer text, derived from the transcript by the scoring worker. */
  answerText: string;
  /** Tags the scoring worker attached to the answer (e.g. "high-intent",
   *  "product-curious", "time-constrained"). No income/placement language. */
  scoringTags: string[];
}

/** Aggregate scoring summary across the interview. Surfaced on the sponsor's
 *  upline cockpit card so the sponsor can lead with the BA's actual context. */
export interface MichaelScoringSummary {
  /** Coarse overall read. null = not enough signal. */
  overallTone: 'positive' | 'neutral' | 'guarded' | null;
  /** Highlight tags the sponsor should know first (3–5 entries typical). */
  highlightTags: string[];
  /** Provenance string surfaced on the card. Pinned literal to keep audit clean. */
  signedBy: string;
}

/** Authoritative completed-interview record. Triple-stacked at ingest.
 *  sponsorBaId is stamped server-side from the BA record — NEVER from the
 *  scoring worker payload (locked-spec 3.5). */
export interface MichaelInterviewArtifact {
  baId: string;
  /** Stamped server-side from brand_ambassadors.sponsorBaId at ingest. Immutable. */
  sponsorBaId: string | null;
  callSid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  transcript: MichaelTranscriptChunk[];
  answers: MichaelInterviewAnswer[];
  scoring: MichaelScoringSummary;
  /** Optional pointer to call recording (Telnyx storage URL). */
  audioUrl: string | null;
}

/** GET /api/michael/interview/state response — what the interview surface
 *  renders. Pre-call: phase=awaiting_call + scheduledFor. During call:
 *  phase=call_in_progress + transcript snapshot for SSE hydration. After:
 *  phase=complete + artifact. */
export interface MichaelInterviewView {
  baId: string;
  phase: MichaelInterviewPhase;
  /** ISO slot start, BA's local TZ for rendering applied client-side. */
  scheduledFor: string | null;
  timezone: string | null;
  call: {
    startedAt: string | null;
    sid: string | null;
  };
  /** Hydration snapshot for SSE — chunks already received. The stream pushes
   *  only NEW chunks after the connection opens. */
  transcript: MichaelTranscriptChunk[];
  /** Present only when phase === 'complete'. */
  artifact: MichaelInterviewArtifact | null;
  /** Whether the BA flagged "wrong number — this isn't me" from wf_0038.
   *  Server records the flag and Kevin's admin surface picks it up; the BA
   *  just sees a "we've been notified" confirmation. */
  wrongNumberFlaggedAt: string | null;
}

/** SSE event envelope on /api/michael/interview/transcript/stream.
 *  - `snapshot` fires once on connect with the chunks already persisted.
 *  - `chunk` fires for each new chunk as the STT worker pushes them.
 *  - `phase` fires when the BA's interview phase advances (e.g. complete).
 *  - `heartbeat` keeps the connection warm; client ignores. */
export type MichaelInterviewSseEvent =
  | { type: 'snapshot'; chunks: MichaelTranscriptChunk[]; phase: MichaelInterviewPhase }
  | { type: 'chunk'; chunk: MichaelTranscriptChunk }
  | { type: 'phase'; phase: MichaelInterviewPhase }
  | { type: 'heartbeat' };

/** Sponsor-only data the upline cockpit's MichaelEventCard renders.
 *  Access is enforced server-side: the requesting BA's session.baId must
 *  match the downline's sponsorBaId, else 403. Not client-hidden. */
export interface MichaelCockpitCardData {
  /** The downline BA the card is about. */
  downlineBaId: string;
  /** First name only — keeps the card scannable and consistent with locked-spec
   *  3.6 (BA-to-BA off-app norms). */
  downlineFirstName: string;
  /** ISO completion time, sponsor's timezone applied client-side. */
  completedAt: string;
  /** All five (or however many) answers, rendered as a sponsor-readable list. */
  answers: MichaelInterviewAnswer[];
  /** Aggregate read for the sponsor's lead-with-context move. */
  scoring: MichaelScoringSummary;
  /** Optional audio link (Telnyx recording URL or short-lived signed URL). */
  audioUrl: string | null;
  /** Provenance literal — kept verbatim from the artifact. */
  signedBy: string;
}

/** Worker → server payload on POST /api/michael/interview/scoring.
 *  Carries the transcript + the parsed answers + the scoring summary; the
 *  server stamps sponsorBaId and persists the artifact. Sender authenticates
 *  with the MICHAEL_WORKER_SECRET header (process.env.MICHAEL_WORKER_SECRET).
 *  sponsorBaId is intentionally omitted from this shape (server-stamped). */
export interface MichaelScoringIngestPayload {
  baId: string;
  callSid: string;
  startedAt: string;
  completedAt: string;
  transcript: MichaelTranscriptChunk[];
  answers: MichaelInterviewAnswer[];
  scoring: MichaelScoringSummary;
  audioUrl: string | null;
}

/** Worker → server payload on POST /api/michael/interview/transcript/chunk.
 *  Streamed during the live call as STT segments finalize. */
export interface MichaelTranscriptChunkIngestPayload {
  callSid: string;
  chunk: Omit<MichaelTranscriptChunk, 'sequence'>;
}
