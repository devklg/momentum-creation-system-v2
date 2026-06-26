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
  /** Optional BA-authored context, used by Ivory relationship-first invites. */
  relationshipReason?: string | null;
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
  relationshipReason: string | null;
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
  /** Optional relationship context captured by Ivory before drafting. */
  relationshipReason?: string | null;
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

/* ─────────────────────────────────────────────────────────────────────────
 * PMV backend projection (Task 4)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Prospect Momentum Viewer rows are BA-scoped server projections. They expose
 * explicit lifecycle, CRM summary, last signal, and deterministic next action
 * without scoring, qualifying, ranking, auto-sending, or widening ownership.
 */

export type ProspectLifecycleStage =
  | 'draft'
  | 'sent_unopened'
  | 'clicked'
  | 'video_started'
  | 'video_25'
  | 'video_50'
  | 'video_75'
  | 'watched'
  | 'callback_requested'
  | 'customer'
  | 'enrolled'
  | 'expired'
  | 'archived';

export type ProspectNextActionKind =
  | 'send_invite'
  | 'call_now'
  | 'reply_to_callback'
  | 'follow_up_due'
  | 'send_soft_nudge'
  | 'ask_if_video_played'
  | 'reinvite'
  | 'schedule_followup'
  | 'wait'
  | 'none';

export type ProspectNextActionScriptKind =
  | 'initial_send'
  | 'callback_reply'
  | 'clicked_no_watch'
  | 'partial_watch'
  | 'watched_no_callback'
  | 'reinvite'
  | 'later_reconnect';

export interface ProspectNextAction {
  kind: ProspectNextActionKind;
  label: string;
  reason: string;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: IsoTimestamp | null;
  scriptKind: ProspectNextActionScriptKind | null;
}

export type ProspectLastSignalKind =
  | 'created'
  | 'sent'
  | 'opened'
  | 'video_started'
  | 'video_25'
  | 'video_50'
  | 'video_75'
  | 'watched'
  | 'callback_requested'
  | 'customer'
  | 'enrolled'
  | 'expired'
  | 'archived';

export interface ProspectLastSignal {
  kind: ProspectLastSignalKind;
  label: string;
  at: IsoTimestamp;
}

export interface ProspectMomentumCrmSummary {
  disposition: CrmDisposition | null;
  followUpDueAt: IsoTimestamp | null;
  followUpIsDue: boolean;
  noteCount: number;
  latestNoteAt: IsoTimestamp | null;
}

export interface ProspectMomentumRow {
  prospectId: string;
  token: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  source: InvitationSource;
  /** Optional relationship context captured by Ivory before drafting. */
  relationshipReason?: string | null;
  lifecycle: ProspectLifecycleStage;
  tokenState: TokenState;
  videoProgressPct: 0 | 25 | 50 | 75 | 100 | null;
  clickedAt: IsoTimestamp | null;
  sentAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp;
  positionNumber: number | null;
  placedAt: IsoTimestamp | null;
  latestCallbackIntent: CallbackIntent | null;
  crm: ProspectMomentumCrmSummary;
  lastSignal: ProspectLastSignal;
  nextAction: ProspectNextAction;
}

export interface ProspectFocusQueueItem {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  lifecycle: ProspectLifecycleStage;
  source: InvitationSource;
  lastSignal: ProspectLastSignal;
  nextAction: ProspectNextAction;
}

export interface ProspectMomentumViewerResponse {
  ok: true;
  generatedAt: IsoTimestamp;
  focusQueue: ProspectFocusQueueItem[];
  rows: ProspectMomentumRow[];
  lifecycleGaps: string[];
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
  /** App-generated re-entry credential (#148): 6-char, unambiguous alphabet.
   *  Set at invite mint so a prospect can return via phone + code even before
   *  any consent signal. */
  reentryCode: string;
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
 * Legacy Michael interview transcripts may link FROM historical audit entries
 * via the optional `linkedTranscriptId` (Chat #89 - no separate tab).
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
 *   - linkedTranscriptId legacy Michael interview transcript ID (Chat #89)
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
 * POST /api/ivory/invitation-agent/draft request body.
 *
 * The BA has already selected or created exactly one Ivory name and written
 * why that person came to mind. Ivory drafts copy only; it never scores,
 * qualifies, sends, or chooses people autonomously.
 */
export interface IvoryInvitationDraftPayload {
  ivoryId: string;
  relationshipReason: string;
  productName?: string | null;
}

export interface IvoryInvitationDraftResponse {
  ok: true;
  draft: string;
  degraded: boolean;
}

/**
 * POST /api/ivory/invitation-agent/mint request body.
 *
 * The BA-edited message and real CRM fields mint through the existing
 * invitation spine with source='ivory'. No placeholder CRM facts are allowed.
 */
export interface IvoryInvitationMintPayload {
  ivoryId: string;
  relationshipReason: string;
  message: string;
  city: string;
  stateOrRegion: string;
  phone: string;
  email?: string | null;
}

export interface IvoryInvitationMintResponse {
  ok: true;
  ivoryId: string;
  prospectId: string;
  token: string;
  inviteUrl: string;
  createdAt: string;
  expiresAt: string;
  message: string | null;
  source: 'ivory';
  relationshipReason: string;
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
  /** Real CRM fields required before mint; placeholders are not stored. */
  city?: string;
  stateOrRegion?: string;
  /** Phone is required before mint because the BA sends manually by SMS. */
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
  /** Current editable identity fields (Chat #141), so the cockpit edit form
   *  prefills from the same fetch the row already does on expand. The list
   *  display shows first name + last initial only (privacy-minimal); the
   *  full lastName / phone / email live on the record and are surfaced here
   *  for the owning BA's edit form. Sponsor is intentionally absent — not
   *  editable from the cockpit (locked-spec 3.5). */
  editable: {
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
    city: string;
    stateOrRegion: string;
    country: string;
  };
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
 * Steve gate: Module 1 is whitelisted (a new BA can build belief in
 * the product before Steve discovery); Modules 2-5 are gated. See
 * requireSteveComplete.ts.
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
  steveDiscoveryComplete: BANotifChannelMix;
  poolMovement: BANotifChannelMix;
}

/**
 * J.12 defaults (RESOLVED Chat #147, seq 22, dec_profile_verification_and_notifications):
 * OPERATIONAL signals ON by default; PROMOTIONAL / DIGEST signals OFF until the
 * BA opts in. All tunable in settings.
 *
 * Reasoning (carried from the Chat #134 heartbeat, finalized #147):
 *   - Operational signals — a prospect asked for a callback, reserved a webinar
 *     seat, a new BA registered under you, Steve discovery completed — are
 *     things a BA needs to act on, so they default ON (in-app always; SMS on for
 *     the live person-asks signals, which already SMS-alert per Chat #105).
 *   - poolMovement is a DIGEST (the daily roll-up), not an operational signal,
 *     so it defaults fully OFF until the BA opts in (J.12).
 *   - Email defaults off everywhere until Resend's domain is verified
 *     (locked-spec Part 5, Resend dormant until Namecheap DNS lands).
 */
export const BA_NOTIF_DEFAULTS: BANotifPrefs = {
  callbackRequested: { sms: true, email: false, inApp: true },
  webinarReserved: { sms: true, email: false, inApp: true },
  newSponsoredBA: { sms: false, email: false, inApp: true },
  steveDiscoveryComplete: { sms: false, email: false, inApp: true },
  // Digest — OFF until opt-in (J.12).
  poolMovement: { sms: false, email: false, inApp: false },
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

/* ─── LEGACY #134 Michael interview surface (retired) ─── */
//
// Michael no longer schedules or conducts BA interviews. He remains only as a
// BA-facing training-support suggestion surface. These legacy types stay
// temporarily so old persisted artifacts and historical admin exports can still
// be read without reintroducing any live route.

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

/** LEGACY — retired Michael interview view.
 *  Michael no longer schedules or interviews; no active route serves this. */
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

/** LEGACY — retired Michael transcript SSE event envelope. */
export type MichaelInterviewSseEvent =
  | { type: 'snapshot'; chunks: MichaelTranscriptChunk[]; phase: MichaelInterviewPhase }
  | { type: 'chunk'; chunk: MichaelTranscriptChunk }
  | { type: 'phase'; phase: MichaelInterviewPhase }
  | { type: 'heartbeat' };

/** LEGACY — retired sponsor-only Michael interview card data. */
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

/** LEGACY — retired Michael worker scoring payload. */
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

/** LEGACY — retired Michael transcript chunk ingest payload. */
export interface MichaelTranscriptChunkIngestPayload {
  callSid: string;
  chunk: Omit<MichaelTranscriptChunk, 'sequence'>;
}

/* ─── #134 Admin core dashboard ─── */
/**
 * Admin Core Dashboard — Section B (wireframe 4.B, leaves wf_0077–wf_0080).
 *
 * Operational metrics + filterable drilldown + live event stream for the
 * Kevin-only /admin surface. Reads aggregate; every view writes one audit
 * entry through the 4.J substrate. Compliance: regulated surface, CV/cycle
 * math is permitted but this dashboard scope is operational (activity,
 * funnel, queue) only — no earnings.
 *
 * Leader detection (locked-spec Part 5):
 *   leader = (binary-qualified) AND (>= 5 personally enrolled)
 *
 * Personally-enrolled is computable here (count of BAs in brand_ambassadors
 * with sponsorBaId = candidate.baId). Binary qualification lives upstream
 * in THREE and is not mirrored locally yet. Until it is, the system-detected
 * leader set is empty — the dashboard surfaces this honestly via
 * `leaderDetectionNote`. A Kevin-curated set will arrive with wireframe
 * 4.C's leader-tag toggle.
 */

/** Top-row tile identifier. Drives drilldown routing and SSE highlighting. */
export type AdminDashboardTile =
  | 'active_bas'
  | 'prospects_in_flow'
  | 'queue_movement'
  | 'enrollments'
  | 'training';

/**
 * Server-applied filter for both metrics and drilldown queries. Filter is
 * narrowing only — empty / null means "all". `leaderGroup` is enforced
 * server-side against the locked rule above; the client cannot widen by
 * passing leader status in the body.
 */
export interface AdminDashboardFilter {
  /** Restrict to one BA's slice (their prospects, their training, etc.). */
  baId: string | null;
  /**
   * 'all'           — no leader-status restriction.
   * 'leaders_only'  — system-detected ∪ Kevin-curated.
   * 'non_leaders'   — explicit complement (rest of the team).
   */
  leaderGroup: 'all' | 'leaders_only' | 'non_leaders';
}

/**
 * Master metrics row — the five tiles at the top of the dashboard
 * (wf_0077). Each field corresponds to one tile.
 */
export interface AdminDashboardMetrics {
  /** count(brand_ambassadors WHERE lastLoginAt >= now-24h), filter-scoped. */
  activeBaCount: number;
  /** count(brand_ambassadors), filter-scoped. The denominator for activity. */
  totalBaCount: number;
  /**
   * count(pool_placements WHERE flushedAt IS NULL), filter-scoped by
   * sponsorBaId when the filter narrows to a BA / leader group.
   */
  prospectsInFlow: number;
  /** Net queue movement in the last 24h: placements minus flushes. */
  queueMovement24h: {
    placements: number;
    flushes: number;
    /** placements - flushes. Signed. */
    net: number;
  };
  /**
   * count(pool_placements WHERE flushedAt >= now-24h AND flushReason='enrolled'),
   * filter-scoped. Enrollment lives in THREE; this counts the operational
   * mirror event our pool records when the BA marks enrolled.
   */
  enrollments24h: number;
  /**
   * Percent (0..100, integer-rounded) of filter-scoped BAs whose Fast Start
   * is complete (all five modules in `completed` state). Null when the
   * filter-scoped BA count is 0 (no denominator).
   */
  trainingCompletionPct: number | null;
  /** ISO timestamp when this snapshot was computed (server-side). */
  computedAt: IsoTimestamp;
}

/** GET /api/admin/dashboard/metrics?baId=&leaderGroup= response. */
export interface AdminDashboardMetricsResponse {
  ok: true;
  metrics: AdminDashboardMetrics;
  appliedFilter: AdminDashboardFilter;
  /**
   * Honest note about the leader detection gap (binary qualification not
   * mirrored locally). Rendered in the filter bar so Kevin always knows
   * what 'leaders_only' currently means.
   */
  leaderDetectionNote: string;
}

/** One BA, for the filter-bar dropdown. */
export interface AdminBaFilterOption {
  baId: string;
  fullName: string;
  /** True if this BA is in the current leader set (curated ∪ system). */
  isLeader: boolean;
}

/** One leader-group option with its current count. */
export interface AdminLeaderGroupOption {
  value: AdminDashboardFilter['leaderGroup'];
  label: string;
  count: number;
}

/** GET /api/admin/dashboard/filters response — populates the filter bar. */
export interface AdminDashboardFiltersResponse {
  ok: true;
  bas: AdminBaFilterOption[];
  leaderGroups: AdminLeaderGroupOption[];
  /** Same honest note as on metrics — duplicated so the filter bar can render it standalone. */
  leaderDetectionNote: string;
}

/* Drilldown rows — one shape per tile (wf_0078). */

export interface AdminActiveBaRow {
  baId: string;
  fullName: string;
  lastLoginAt: IsoTimestamp;
  prospectsInFlow: number;
}

export interface AdminProspectInFlowRow {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  state: TokenState;
  positionNumber: number | null;
  sponsorBaId: string;
  sponsorName: string;
  placedAt: IsoTimestamp | null;
  expiresAt: IsoTimestamp;
}

export interface AdminQueueMovementRow {
  kind: 'placement' | 'flush';
  prospectId: string;
  firstName: string;
  lastInitial: string;
  positionNumber: number;
  sponsorBaId: string;
  sponsorName: string;
  at: IsoTimestamp;
  /** 'enrolled' | 'expired' | 'archived' on flush; null on placement. */
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}

export interface AdminEnrollmentRow {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  positionNumber: number;
  sponsorBaId: string;
  sponsorName: string;
  enrolledAt: IsoTimestamp;
}

export interface AdminTrainingRow {
  baId: string;
  fullName: string;
  /** Count of modules in `completed` state, 0..5. */
  modulesCompleted: number;
  /** Whether (modulesCompleted === 5). */
  fastStartComplete: boolean;
  /** Most recent touch across any Fast Start module; null if untouched. */
  lastTouchedAt: IsoTimestamp | null;
}

export type AdminDrilldownPayload =
  | { tile: 'active_bas'; rows: AdminActiveBaRow[] }
  | { tile: 'prospects_in_flow'; rows: AdminProspectInFlowRow[] }
  | { tile: 'queue_movement'; rows: AdminQueueMovementRow[] }
  | { tile: 'enrollments'; rows: AdminEnrollmentRow[] }
  | { tile: 'training'; rows: AdminTrainingRow[] };

/** GET /api/admin/dashboard/drilldown?tile=&baId=&leaderGroup= response. */
export interface AdminDrilldownResponse {
  ok: true;
  payload: AdminDrilldownPayload;
  appliedFilter: AdminDashboardFilter;
  computedAt: IsoTimestamp;
}

/* Live event stream (wf_0080). */

/** Common event metadata across live-stream events. */
export interface AdminLiveEventBase {
  /** Globally-unique id used as the SSE `id:` field for resumability. */
  eventId: string;
  /** ISO timestamp the event was emitted. */
  at: IsoTimestamp;
}

/** Live placement event — fans out from poolEvents.subscribePlacements. */
export interface AdminLivePlacementEvent extends AdminLiveEventBase {
  kind: 'placement';
  positionNumber: number;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
}

/** Live audit-log entry — surfaced from poll-based tail of audit_log. */
export interface AdminLiveAuditEvent extends AdminLiveEventBase {
  kind: 'audit_entry';
  action: string;
  role: AuditActorRole;
  actorLabel: string;
  entityLabel: string;
  severity: AuditSeverity;
}

export type AdminLiveEvent = AdminLivePlacementEvent | AdminLiveAuditEvent;

/**
 * Initial SSE snapshot — sent once on connect with the most-recent events
 * so the stream renders populated immediately rather than waiting for the
 * next live event.
 */
export interface AdminLiveSnapshot {
  events: AdminLiveEvent[];
}

/* ─── #134 Cockpit Today's Actions ─────────────────────────────────────────
 * The DERIVED card at the top of the cockpit (wireframe 3.3, locked-spec
 * 1.8/1.9). Reads the BA's existing pipeline (callbacks + CRM follow-ups +
 * prospects' expiresAt) and surfaces what needs action TODAY, ordered by
 * urgency: a raised hand > a follow-up due > a window about to close.
 *
 * No new persistence — every field is derived from collections already on
 * disk (callback_requests, crm_followups, prospects). The cockpit's existing
 * inline Today's Actions (Chat #132, kinds callback/followup/draft) is the
 * predecessor; this block supersedes it with the #134 spec — 'draft' drops
 * out (not urgent) and 'expiring' enters (8-week window closing, 3.7), with
 * an explicit bias prompt for the empty state ("Who are you sharing with
 * today?", 1.9).
 *
 * Distinct names from the #132 block (TodayActionKind / TodaysActionsResponse
 * already exported) to keep the append-only rule on this file — we don't
 * widen or edit the existing union, we ship a new one alongside.
 *
 * Compliance (locked-spec 3.10): BA-facing only. No income/placement/comp
 * language; action labels are funnel progress ("asked for a callback",
 * "follow-up due", "window closes soon").
 */

/** The three kinds of action the cockpit surfaces, in urgency order. */
export type CockpitActionKind = 'callback' | 'followup' | 'expiring';

/**
 * One item on the cockpit's Today's Actions card. Discriminated by `kind`
 * so each branch carries only the fields it actually has — a callback
 * has an intent; a followup has a dueAt; an expiring window has an
 * expiresAt. `at` is the timestamp the cockpit sorts on inside a tier
 * (callback.createdAt, followup.dueAt, prospect.expiresAt).
 */
export type CockpitActionItem =
  | {
      kind: 'callback';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: IsoTimestamp;
      intent: CallbackIntent | null;
    }
  | {
      kind: 'followup';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: IsoTimestamp;
      followUpDueAt: IsoTimestamp;
    }
  | {
      kind: 'expiring';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: IsoTimestamp;
      expiresAt: IsoTimestamp;
    };

/**
 * Response from GET /api/cockpit/todays-actions. `actions` is the urgency-
 * ordered list (callbacks first, then due follow-ups, then expiring
 * windows). `biasPrompt` is the copy the empty state renders — server-
 * supplied so locked-spec 1.9 wording lives in one place.
 */
export interface CockpitTodaysActionsResponse {
  ok: true;
  actions: CockpitActionItem[];
  /** Empty-state bias copy (locked-spec 1.9). Always present. */
  biasPrompt: string;
}

/* ─────────────────────────────────────────────────────────────────
 * #134 Replicated .com preview (wireframe 3.7)
 * ─────────────────────────────────────────────────────────────────
 *
 * The /preview surface inside .team lets an authenticated BA see
 * their own replicated .com landing page personalized to themselves
 * as the inviting BA, with a sample prospect. It is a SANDBOX —
 * the response shares the shape of a real ResolvedTokenPayload so
 * the same components can render it, but every downstream write is
 * short-circuited:
 *
 *   - No holding-tank placement (positions are monotonic + real —
 *     a preview must never consume a position; locked-spec 3.2)
 *   - No SSE placement/alert event emission
 *   - No behind-you counter increment
 *   - No prospect or invite-token record
 *   - No BA alert SMS
 *
 * Mechanism: the synthesized token field carries a sentinel string
 * `PREVIEW-<baId>` that no real invite token will ever match (real
 * tokens are 12 chars from a 31-char alphabet excluding 0/1/I/O/L;
 * this sentinel is upper+digit+dash, prefixed `PREVIEW-`, and longer
 * than 12). Any downstream /api/p/<sentinel>/* call from the .com
 * components 404s silently — which is the design: a preview must
 * consume zero real state. The `preview: true` flag lets the
 * preview shell or any consumer that needs to distinguish do so
 * without parsing the token format.
 */
export interface PreviewResolvedTokenPayload extends ResolvedTokenPayload {
  preview: true;
}

/* ─────────────────────────────────────────────────────────────────
 * #135 Admin BA Oversight — wireframe 4.C, locked-spec 4.C (Sec C)
 * ─────────────────────────────────────────────────────────────────
 *
 * The Kevin-only Brand Ambassador directory + per-BA profile drawer +
 * sponsor override flow. Server reads aggregate from brand_ambassadors +
 * access_codes + ba_commitments + invite_tokens + crm_followups +
 * fast_start_progress + steve_discoveries; writes (override / leader
 * tag / notes) each append a 4.J audit entry.
 *
 * Compliance discipline (Chat #89):
 *   - No algorithmic flagging. Every directory column is a raw count or
 *     a raw timestamp; the UI never compares them to a threshold and
 *     emits a judgment. Kevin reads the numbers.
 *   - THREE International is the upstream authority. The sponsor override
 *     mirrors the BA's request — it does NOT push to THREE.
 *   - System-detected leader is a hard rule (binary-qualified ∧ ≥5
 *     personally enrolled). Binary qualification is not mirrored locally
 *     yet (same gap the Core Dashboard surfaces in `leaderDetectionNote`),
 *     so the badge is currently always false; the field is here so it
 *     wires up the moment THREE's qualification feed lands.
 *   - Curated leader is Kevin-toggled; both badges are display, never
 *     ranking.
 */

/** One row in the admin BA directory (Section C.1) — the 15 columns the table renders. */
export interface AdminBaDirectoryRow {
  baId: string;
  threeBaId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** TM-XXXX code this BA owns (one per BA for life, 2.3). Null if Kevin hasn't issued one. */
  accessCodeOwned: string | null;
  /** Current sponsor (post-override if one was applied; otherwise the original). */
  sponsorBaId: string | null;
  sponsorName: string | null;
  /** Original sponsor at signup — present ONLY when a C.5 override changed it. */
  originalSponsorBaId: string | null;
  originalSponsorName: string | null;
  /** Signed-up timestamp. */
  joinedAt: IsoTimestamp;
  /** When the BA accepted the welcome commitment (J.3). Null = not yet. */
  welcomeAcceptedAt: IsoTimestamp | null;
  /** Most recent login. Null = never. */
  lastLoginAt: IsoTimestamp | null;
  /** Trailing 72h personal-invite count (C.2). */
  twoInSeventyTwoCount: number;
  /** Start of the rolling 72h window — for hover tooltip. */
  twoInSeventyTwoWindowStart: IsoTimestamp;
  /** 0..100 integer (C.3). Computed from filled profile fields. */
  profileCompletenessPct: number;
  /** Lifetime invite-token count for this BA. */
  personalInvitesCount: number;
  /** Oldest open (not-cleared) follow-up dueAt across this BA's prospects. Null = none open. */
  oldestOpenFollowUpDueAt: IsoTimestamp | null;
  /** Fast Start modules completed (0..5). */
  trainingModulesCompleted: number;
  /** True when all five modules done. */
  trainingComplete: boolean;
  /** Operational status. 'active'/'inactive' derive from lastLoginAt; 'suspended' is a future flag. */
  status: 'active' | 'inactive' | 'suspended';
  /** Max of lastLoginAt / welcomeAcceptedAt. */
  lastActivityAt: IsoTimestamp | null;
  /** System-detected leader badge (currently always false — see leaderDetectionNote). */
  systemDetectedLeader: boolean;
  /** Kevin-curated leader badge (admin toggle on row + profile drawer). */
  curatedLeader: boolean;
  /** Soft-delete lifecycle (Chat #138/#141), distinct from `status`
   *  'suspended'. True when removed from the roster (reversible). */
  deleted: boolean;
}

export interface AdminBaDirectoryResponse {
  ok: true;
  count: number;
  rows: AdminBaDirectoryRow[];
  /** Honest disclosure — binary qualification not mirrored locally yet. */
  leaderDetectionNote: string;
}

/** One sponsor-override entry on a BA's history. Append-only. */
export interface AdminSponsorOverrideEntry {
  overrideId: string;
  baId: string;
  previousSponsorBaId: string;
  newSponsorBaId: string;
  requestingBaId: string;
  reason: string;
  performedByBaId: string;
  performedAt: IsoTimestamp;
  /** entryId from the 4.J audit substrate this override wrote to. */
  auditEntryId: string;
}

/** Kevin-only note about a BA, append-only. */
export interface AdminBaNoteEntry {
  noteId: string;
  baId: string;
  text: string;
  authorBaId: string;
  createdAt: IsoTimestamp;
}

/** Full BA profile bundle for the slide-out drawer (C.4). */
export interface AdminBaProfileBundle {
  row: AdminBaDirectoryRow;
  sponsorOverrideHistory: AdminSponsorOverrideEntry[];
  notes: AdminBaNoteEntry[];
}

export interface AdminBaProfileResponse {
  ok: true;
  profile: AdminBaProfileBundle;
}

/** POST /api/admin/bas/:baId/sponsor-override body. */
export interface AdminSponsorOverridePayload {
  requestingBaId: string;
  newSponsorBaId: string;
  reason: string;
}

export interface AdminSponsorOverrideResponse {
  ok: true;
  override: AdminSponsorOverrideEntry;
  row: AdminBaDirectoryRow;
}

/** POST /api/admin/bas/:baId/leader-tag body — toggle curated badge. */
export interface AdminLeaderTagPayload {
  curated: boolean;
  /** Optional reason — surfaced in the audit entry. */
  reason?: string;
}

export interface AdminLeaderTagResponse {
  ok: true;
  baId: string;
  curated: boolean;
}

/** POST /api/admin/bas/:baId/notes body — append a Kevin-only note. */
export interface AdminBaNotePayload {
  text: string;
}

export interface AdminBaNoteResponse {
  ok: true;
  note: AdminBaNoteEntry;
}

/* ─────────────────────────────────────────────────────────────────
 * /admin Section D · Prospect Oversight (locked-spec 4.D · wireframe 4.D)
 * ─────────────────────────────────────────────────────────────────
 *
 * Kevin-only cross-team prospect directory + detail panel + four
 * BA-requested interventions. Mirrors THREE on enrollment state but
 * never overrides it — interventions are operational safety levers.
 *
 * Compliance spine (matches the brief verbatim):
 *   - NO prospect score, income-potential rank, qualification rating,
 *     or AI coaching anywhere in this surface (D.3 negation).
 *   - Every mutation appends one AuditLogEntry with before/after,
 *     requestingBaId, reason, timestamp.
 *   - Monotonic queue is sacred: flush vacates a slot; move keeps
 *     the same positionNumber, only sponsorBaId changes.
 *   - Reuses AdminDashboardFilter (B.2) verbatim — narrowing only.
 */

/**
 * D.1 column 10 — registration handoff state with THREE. Derived from
 * the pool placement row's flush state (no separate handoff column
 * exists on prospects today):
 *   - placement still active (flushedAt=null)             → 'pending'
 *   - flushReason='enrolled'                              → 'enrolled'
 *   - flushReason='expired'                               → 'no_show'
 *   - flushReason='archived' (admin-flushed early)        → 'withdrew'
 * The mapping is documented in claude-notes-admin-d.md so the integrator
 * sees the assumption explicitly.
 */
export type AdminProspectRegistrationHandoffState =
  | 'pending'
  | 'enrolled'
  | 'no_show'
  | 'withdrew';

/**
 * One row in the D.1 directory. The 10 columns the brief enumerates,
 * plus the prospectId for row-click → ?prospectId=<id> deep-link
 * navigation to D.2.
 *
 * Column ordering matches the brief; UI may reorder visually but the
 * server payload is canonical.
 */
export interface AdminProspectDirectoryRow {
  prospectId: string;
  /** Column 1: first + last (full name for admin, not first+initial). */
  firstName: string;
  lastName: string;
  /** Column 2: inviting BA — current sponsorBaId on the prospect record. */
  sponsorBaId: string;
  sponsorName: string;
  /** Column 3: lifecycle state. 'video_25'/'video_50'/'video_75' map to
   *  TokenState 'video_quarter'/'video_half'/'video_three_quarter'. The
   *  client translates for display; the wire shape stays TokenState +
   *  any non-token signal layered on top. */
  presentationStatus: AdminProspectPresentationStatus;
  /** Column 4: monotonic pool position; null pre-placement. */
  positionNumber: number | null;
  /** Column 5: the sponsor-routed URL Kevin can sandbox-preview. */
  prospectUrl: string;
  /** The opaque token the URL resolves; surfaced so the client can
   *  build an admin-preview href without re-parsing the URL. */
  token: string;
  /** Column 6: token mint date. */
  firstContactAt: IsoTimestamp;
  /** Column 7: most recent activity (date + event-kind label). */
  mostRecentActivity: {
    at: IsoTimestamp;
    eventKind: AdminProspectActivityEventKind;
    label: string;
  };
  /** Column 8: days in holding tank since video_complete; null pre-placement. */
  daysInHoldingTank: number | null;
  /** Column 9: surfaced as the date by which follow-up is needed, NEVER
   *  as a boolean system flag. Computed from activity-recency threshold:
   *  most-recent-activity + locked threshold (currently 7 days). Null
   *  when not applicable (enrolled, expired, or no activity yet). */
  followUpNeededBy: IsoTimestamp | null;
  /** Column 10: registration handoff state with THREE (derived; see type). */
  registrationHandoffState: AdminProspectRegistrationHandoffState;
  /** Soft-delete lifecycle (Chat #138/#141). True when removed from the
   *  directory (reversible). The table may dim / tag deleted rows; the
   *  holding-tank position is untouched by delete. */
  deleted: boolean;
}

/**
 * Presentation status — superset of TokenState with two non-token
 * signals layered on top so the directory row can show "reading dossier"
 * (callback-request submitted) and "webinar reserved" without forcing
 * those into the lifecycle token state machine.
 *
 *   - All TokenState values pass through unchanged.
 *   - 'callback_requested' surfaces when prospect submitted a callback
 *     intent and state is still video_complete.
 *   - 'webinar_reserved' surfaces when a webinar reservation exists and
 *     state is still video_complete.
 */
export type AdminProspectPresentationStatus =
  | TokenState
  | 'callback_requested'
  | 'webinar_reserved';

/**
 * Server response — GET /api/admin/prospects.
 * Filter is reused verbatim from B.2; the client passes baId + leaderGroup
 * in the query string. Rows are unsorted at wire level; the client sorts
 * per column-click.
 */
export interface AdminProspectDirectoryResponse {
  ok: true;
  rows: AdminProspectDirectoryRow[];
  appliedFilter: AdminDashboardFilter;
  computedAt: IsoTimestamp;
  /** Same honest note from B.2 — duplicated so the directory can render
   *  it standalone if the user lands here before visiting /dashboard. */
  leaderDetectionNote: string;
}

/**
 * The activity-timeline event kinds for D.2. Each kind has a uniform
 * envelope plus a kind-specific `details` payload.
 *
 * 'admin_*' kinds are written into the timeline as a projection of audit
 * entries (the four interventions + the kevin-note add) — the audit log
 * remains the source of truth; the timeline is a per-prospect derived
 * view.
 */
export type AdminProspectActivityEventKind =
  | 'token_minted'
  | 'link_clicked'
  | 'video_started'
  | 'video_quarter'
  | 'video_half'
  | 'video_three_quarter'
  | 'video_complete'
  | 'placement'
  | 'callback_requested'
  | 'webinar_reserved'
  | 'enrollment_marked'
  | 'flush'
  | 'admin_move'
  | 'admin_reassign_sponsor'
  | 'admin_manual_flush'
  | 'admin_force_enroll'
  | 'admin_kevin_note';

export interface AdminProspectActivityEvent {
  eventId: string;
  /** When the event happened (wall-clock). */
  at: IsoTimestamp;
  kind: AdminProspectActivityEventKind;
  /** Free-form label for the row: "Clicked link", "Manual flush by Kevin". */
  label: string;
  /** Source IP for link-click events (duplicate-tab detection); null otherwise. */
  ip: string | null;
  /** Referrer for link-click events; null otherwise. */
  referrer: string | null;
  /** Kind-specific payload (intent, eventId, before/after, reason, etc.). */
  details: Record<string, unknown> | null;
}

/**
 * Kevin's append-only private note on a prospect. Separate from the BA's
 * own notes on the prospect (those live in the cockpit, NOT in this
 * payload). Append-only — no edit, no delete.
 */
export interface AdminProspectKevinNote {
  noteId: string;
  prospectId: string;
  body: string;
  createdAt: IsoTimestamp;
  /** The admin who wrote the note (today: Kevin; tomorrow: any /admin BA). */
  createdByBaId: string;
  createdByDisplayName: string;
}

/**
 * D.2 detail payload — everything the prospect detail panel renders.
 * Identity + activity timeline + token + sponsor drift + (optional)
 * callback/webinar/enrollment details + Kevin notes.
 *
 * Sponsor-drift detector: `sponsorBaIdAtMint` is the sponsorBaId stamped
 * on the original invite token at mint time (locked-spec 3.5). It MUST
 * equal `sponsorBaIdNow` on every prospect unless an admin reassign-
 * sponsor intervention has been applied. When they differ, the detail
 * panel surfaces the discrepancy as a warning row — the drift detector
 * the brief explicitly names.
 */
export interface AdminProspectDetail {
  prospectId: string;
  firstName: string;
  lastName: string;
  /** Soft-delete lifecycle (Chat #138/#141). True when removed from the
   *  directory (reversible). The holding-tank position is untouched by
   *  delete; only the flush vacates it. */
  deleted: boolean;
  phone: string | null;
  email: string | null;
  location: ProspectLocation;
  sponsorBaIdAtMint: string;
  sponsorBaIdNow: string;
  sponsorNameNow: string;
  positionNumber: number | null;
  placedAt: IsoTimestamp | null;
  state: TokenState;
  presentationStatus: AdminProspectPresentationStatus;
  registrationHandoffState: AdminProspectRegistrationHandoffState;
  /** Token details. `tokenTruncated` is the head of the token for display
   *  (full token never shown — the prospect URL is the sandbox surface). */
  token: {
    tokenTruncated: string;
    prospectUrl: string;
    mintedAt: IsoTimestamp;
    expiresAt: IsoTimestamp;
    currentState: TokenState;
  };
  callback: {
    callbackRequestId: string;
    intent: CallbackIntent;
    submittedAt: IsoTimestamp;
  } | null;
  webinar: {
    reservationId: string;
    eventId: string;
    scheduledFor: IsoTimestamp;
    reservedAt: IsoTimestamp;
  } | null;
  enrollment: {
    markedAt: IsoTimestamp;
    markedByBaId: string;
    forceEnrolledByAdmin: boolean;
  } | null;
  activity: AdminProspectActivityEvent[];
  kevinNotes: AdminProspectKevinNote[];
}

export interface AdminProspectDetailResponse {
  ok: true;
  detail: AdminProspectDetail;
}

/**
 * Add-note request — POST /api/admin/prospects/:prospectId/notes.
 * Body fields are append-only: there is no edit / delete surface.
 */
export interface AdminProspectAddNoteRequest {
  body: string;
}
export interface AdminProspectAddNoteResponse {
  ok: true;
  note: AdminProspectKevinNote;
}

/* ─── D.4 interventions ─────────────────────────────────────────── */

export type AdminProspectInterventionKind =
  | 'move'
  | 'reassign_sponsor'
  | 'manual_flush'
  | 'force_enroll';

/**
 * Shared base for every intervention request. The intervention router
 * branches on the URL path, so `kind` is not in the body — but the
 * common base IS the `requestingBaId` + `reason` pair. Both required;
 * locked-spec 2.4 calls for `reason` on every critical override.
 */
export interface AdminProspectInterventionBase {
  /** The BA who requested the emergency intervention from Kevin. */
  requestingBaId: string;
  /** Free-text reason in Kevin's words; required, min 8 chars. */
  reason: string;
}

export interface AdminProspectMoveRequest extends AdminProspectInterventionBase {
  /** The BA the prospect is moved TO (the new inviting BA). */
  toBaId: string;
}

export interface AdminProspectReassignSponsorRequest extends AdminProspectInterventionBase {
  /** The BA who becomes the sponsor of record on the prospect. */
  newSponsorBaId: string;
}

export type AdminProspectManualFlushRequest = AdminProspectInterventionBase;
export type AdminProspectForceEnrollRequest = AdminProspectInterventionBase;

/**
 * Every intervention returns the same envelope: the audit entry that
 * was written (so the client can echo it in a toast / confirmation) and
 * the refreshed directory row for this prospect (so the client can
 * patch the table in place without a full directory refetch).
 */
export interface AdminProspectInterventionResponse {
  ok: true;
  kind: AdminProspectInterventionKind;
  prospectId: string;
  auditEntryId: string;
  refreshedRow: AdminProspectDirectoryRow;
}

/* ─────────────────────────────────────────────────────────────────
 * Section E — Queue / Recruitment Leg Oversight  (ADMIN Design E,
 *   project-wireframe 4.E)
 *
 * Kevin-only surface. Mirrors the holding-tank state without ever
 * overriding it (monotonic positions never reshuffle — locked-spec
 * Part 3.2). The /admin ticker (E.5) mirrors the .com ticker event
 * source (services/poolEvents.ts) but shows REAL names; the .com
 * source remains anonymized at firstName + lastInitial.
 * ───────────────────────────────────────────────────────────────── */

/** The Kevin-settable .com position-stack window (E.3). Default 10. */
export type QueueVisibleWindow = 5 | 10 | 20;

/** Today's queue movement (E.1). All counts UTC-day-bounded. */
export interface QueueDepthMovement {
  /** Total prospects currently in the holding tank (placed and not flushed). */
  currentDepth: number;
  /** Placements minted today (UTC). */
  todaysPlacements: number;
  /** Flushes due to TTL expiration today (UTC). Counted separately from manual. */
  todaysExpirations: number;
  /** Flushes performed manually (admin/BA) today (UTC). */
  todaysManualFlushes: number;
  /** Enrollments today (UTC) — placements that exited via enrollment. */
  todaysEnrollments: number;
  /** placements − expirations − manualFlushes − enrollments. */
  netMovement: number;
  computedAt: IsoTimestamp;
}

/** Monotonic position numbers (E.2). */
export interface QueueNumbers {
  /** Max positionNumber minted today (UTC). 0 if no placements yet today. */
  highestToday: number;
  /** Lifetime highest position ever minted (== pool_counters.current). */
  highestEver: number;
  /** Count of flushed placements (their slots are vacant in the visible line). */
  vacantSlots: number;
  computedAt: IsoTimestamp;
}

/**
 * Single day in the growth sparkline (E.4). `date` is YYYY-MM-DD UTC.
 * `count` is new placements that day.
 */
export interface QueueGrowthBucket {
  date: string;
  count: number;
}

/** E.4 — TM overall growth movement (no comp math, no binary detail). */
export interface QueueGrowthSparkline {
  rolling7: number;
  rolling30: number;
  /** Lifetime placements (== pool_counters.current). */
  lifetime: number;
  /** 30 daily buckets oldest→newest. Empty days are zero-filled. */
  daily30: QueueGrowthBucket[];
}

/**
 * E.2 position-lookup result. When `found:true`, a prospect record is
 * attached. When `found:false`, the position has been minted (≤ highestEver)
 * but the slot is vacant (flushed) OR the number has not been minted yet.
 */
export interface QueueLookupResult {
  position: number;
  found: boolean;
  /** True when the slot was once filled and is now vacant (flushed). */
  vacant: boolean;
  prospect: QueueLookupProspect | null;
}

export interface QueueLookupProspect {
  prospectId: string;
  firstName: string;
  lastName: string;
  state: TokenState;
  placedAt: IsoTimestamp;
  sponsorBaId: string;
  city: string;
  stateOrRegion: string;
  flushedAt: IsoTimestamp | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
  /** Cross-section deep-link locked with Agent D: /prospects?prospectId=<id>. */
  deepLink: string;
}

/**
 * E.5 — admin ticker entry. Real names (not initials/anonymized
 * city). Same event source as the .com ticker; the difference is the
 * projection. `deepLink` points to Agent D's D.2 detail panel.
 */
export interface AdminTickerEntry {
  positionNumber: number;
  prospectId: string;
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  placedAt: IsoTimestamp;
  sponsorBaId: string;
  deepLink: string;
}

/**
 * E.6 — a managed queue rule. Surface for the resolved 8-week flush
 * window and any other queue knobs Kevin can change. Every change
 * append-only audited (action='admin.queue.rule.changed').
 */
export interface QueueRule {
  key: string;
  label: string;
  description: string;
  /** Current value; type depends on the rule (number for flush weeks). */
  currentValue: number | string | boolean;
  defaultValue: number | string | boolean;
  unit: string | null;
  /** Last audited change; null if untouched (still at default). */
  lastChangedAt: IsoTimestamp | null;
  lastChangedBy: string | null;
}

/** E.1 + E.2 + E.4 in a single fetch (admin queue page bootstrap). */
export interface QueueOversightSummary {
  depthMovement: QueueDepthMovement;
  numbers: QueueNumbers;
  growth: QueueGrowthSparkline;
  visibleWindow: QueueVisibleWindow;
  computedAt: IsoTimestamp;
}

/* HTTP response envelopes — match the {ok:true, …} shape used by /admin. */

export interface QueueOversightSummaryResponse {
  ok: true;
  summary: QueueOversightSummary;
}

export interface QueueLookupResponse {
  ok: true;
  result: QueueLookupResult;
}

export interface QueueVisibleWindowResponse {
  ok: true;
  value: QueueVisibleWindow;
  defaultValue: QueueVisibleWindow;
  lastChangedAt: IsoTimestamp | null;
  lastChangedBy: string | null;
}

export interface QueueAdminTickerResponse {
  ok: true;
  entries: AdminTickerEntry[];
  globalMaxPosition: number;
}

export interface QueueRulesResponse {
  ok: true;
  rules: QueueRule[];
}

/**
 * SSE wire event for the /api/admin/queue/ticker/stream channel.
 * Mirrors AdminLivePlacementEvent but un-anonymized (carries
 * lastName + prospectId for click-through to D.2).
 */
export interface AdminQueueTickerSseEvent {
  kind: 'admin_queue_placement';
  eventId: string;
  at: IsoTimestamp;
  positionNumber: number;
  prospectId: string;
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  sponsorBaId: string;
  deepLink: string;
}

/** Snapshot payload sent at SSE connection open for the admin ticker. */
export interface AdminQueueTickerSnapshot {
  globalMaxPosition: number;
  recent: AdminTickerEntry[];
}

/* ──────────────────────────────────────────────────────────────────────
 * ADMIN CRUD — manual BA + prospect lifecycle (Chat #138)
 *
 * The manual complement to the automated paths (access-code signup,
 * silent video_complete placement). Same authority class as the C.5
 * sponsor override and the D.4 interventions: friction-heavy, reason
 * required, every mutation audited with before/after (locked-spec 4.J).
 *
 * Boundary (ADMIN-Design standing rule, line 31): these write TM-side
 * mirror records ONLY. They never enrol anyone in THREE, never fabricate
 * THREE genealogy/comp. THREE remains the final authority.
 *
 * Delete is SOFT (Chat #138 lock): a `deleted` lifecycle state distinct
 * from `suspended`, a required reason for the paper trail, fully
 * reversible via restore. A deleted BA/prospect vacates nothing it didn't
 * already hold and never reshuffles monotonic queue positions.
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Lifecycle flag carried on a BA record once an admin soft-deletes it.
 * Absent/null on every normally-registered BA. Distinct from the
 * `suspended` flag deriveStatus() already understands: suspended = benched
 * but present; deleted = pulled from the active roster, restorable.
 */
export interface AdminSoftDeleteState {
  deleted: boolean;
  deletedAt: IsoTimestamp | null;
  deletedReason: string | null;
  deletedByBaId: string | null;
  /** Stamped on restore so the audit pair is legible on the record too. */
  restoredAt: IsoTimestamp | null;
  restoredByBaId: string | null;
}

/* ── BA create ──────────────────────────────────────────────────────── */

/**
 * Admin-create a BA. sponsorBaId is REQUIRED (Chat #138) and is stamped as
 * the original/immutable sponsor from birth — there is no signup
 * transaction to derive it from. No password is set here: an admin-created
 * BA is a roster mirror entry, not a login. (If the person later signs up
 * through the normal access-code flow, that path owns credential creation.)
 */
export interface AdminCreateBaPayload {
  firstName: string;
  lastName: string;
  threeBaId: string;
  threeUsername: string;
  sponsorBaId: string;
  email?: string | null;
  phone?: string | null;
  timezone?: string | null;
  marketRegion?: string | null;
  /** Required paper-trail note (min 8 chars), mirrors override/intervention reason. */
  reason: string;
}

export interface AdminCreateBaResponse {
  ok: true;
  baId: string;
  row: AdminBaDirectoryRow;
}

/* ── BA edit ────────────────────────────────────────────────────────── */

/**
 * Admin-edit a BA's ordinary fields. The sponsor field is intentionally
 * NOT here — sponsor changes have exactly one mutation path, the C.5
 * override flow (see AdminSponsorOverrideResponse). The edit form routes a
 * sponsor change through that endpoint; this payload covers everything
 * else. Every supplied field overwrites; omitted fields are untouched.
 * `reason` is required for the paper trail (Chat #138).
 */
export interface AdminEditBaPayload {
  firstName?: string;
  lastName?: string;
  threeBaId?: string;
  threeUsername?: string;
  email?: string | null;
  phone?: string | null;
  timezone?: string | null;
  marketRegion?: string | null;
  reason: string;
}

export interface AdminEditBaResponse {
  ok: true;
  baId: string;
  row: AdminBaDirectoryRow;
}

/* ── BA / prospect soft-delete + restore (shared shapes) ────────────── */

export interface AdminSoftDeletePayload {
  /** Required paper-trail reason (min 8 chars). */
  reason: string;
}

export interface AdminRestorePayload {
  reason: string;
}

export interface AdminBaDeleteResponse {
  ok: true;
  baId: string;
  deletedAt: IsoTimestamp;
}

export interface AdminBaRestoreResponse {
  ok: true;
  baId: string;
  restoredAt: IsoTimestamp;
  row: AdminBaDirectoryRow;
}

/* ── prospect create ────────────────────────────────────────────────── */

/**
 * Admin-create a prospect. Mirrors the BA invitation-spine mint exactly:
 * a real /p/{token} is minted with sponsor locked at mint, then the
 * prospect is placed in the team-wide holding tank at the NEXT monotonic
 * position (Chat #138 — no position picking, no delay; placement follows
 * the same path a real video_complete uses). sponsorBaId is required.
 */
export interface AdminCreateProspectPayload {
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  country?: string;
  sponsorBaId: string;
  phone?: string | null;
  email?: string | null;
  reason: string;
}

export interface AdminCreateProspectResponse {
  ok: true;
  prospectId: string;
  token: string;
  inviteUrl: string;
  /**
   * Null at create. An admin-created prospect goes through the SAME process
   * as a regular prospect (Chat #140 supersedes #138): mint-only at create,
   * placed in the holding tank with a real position only at video_complete
   * via the normal /api/p/:token/video-event path. The position arrives when
   * they earn it, exactly like every other prospect.
   */
  positionNumber: number | null;
  placedAt: IsoTimestamp | null;
  row: AdminProspectDirectoryRow;
}

/* ── prospect edit ──────────────────────────────────────────────────── */

/**
 * Admin-edit a prospect's ordinary fields. Sponsor is NOT here — a
 * prospect's sponsor changes only through the D.4 reassign-sponsor
 * intervention (already built). `reason` required for the paper trail.
 */
export interface AdminEditProspectPayload {
  firstName?: string;
  lastName?: string;
  city?: string;
  stateOrRegion?: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  reason: string;
}

export interface AdminEditProspectResponse {
  ok: true;
  prospectId: string;
  row: AdminProspectDirectoryRow;
}

export interface AdminProspectDeleteResponse {
  ok: true;
  prospectId: string;
  deletedAt: IsoTimestamp;
}

export interface AdminProspectRestoreResponse {
  ok: true;
  prospectId: string;
  restoredAt: IsoTimestamp;
  row: AdminProspectDirectoryRow;
}

/* ─────────────────────────────────────────────────────────────────────────
 * LEGACY — retired Michael interview classification + founder handoff.
 *
 * Reconciled 2026-06-26: Steve owns Discovery + Success Profile with no
 * scoring, ranking, or prediction. Michael no longer schedules or interviews;
 * he only uses Steve context for training-support suggestions.
 *
 * These exports remain so historical records and older compiled clients can be
 * read safely. They are not the current product contract.
 *
 * Append-only block — do not remove without a migration.
 * ───────────────────────────────────────────────────────────────────────── */

/** The six weighted rubric categories. */
export type MichaelRubricCategory =
  | 'vision'
  | 'commitment'
  | 'coachability'
  | 'available_time'
  | 'network'
  | 'experience';

/** Max points each category contributes to the 100-point total (the weights). */
export const MICHAEL_RUBRIC_MAX: Readonly<Record<MichaelRubricCategory, number>> = {
  vision: 20,
  commitment: 20,
  coachability: 20,
  available_time: 15,
  network: 15,
  experience: 10,
} as const;

/** Raw per-category points the scoring worker assigns from the transcript.
 *  Each value is 0..MICHAEL_RUBRIC_MAX[category]; the server clamps and sums. */
export interface MichaelCategoryScores {
  vision: number;
  commitment: number;
  coachability: number;
  availableTime: number;
  network: number;
  experience: number;
}

/** Legacy classification tiers. Do not produce for new Michael artifacts. */
export type MichaelClassificationTier =
  | 'builder'
  | 'emerging_leader'
  | 'part_time_producer'
  | 'casual_participant';

/** Legacy computed classification. Historical-read only. */
export interface MichaelClassification {
  categoryScores: MichaelCategoryScores;
  /** 0..100, sum of clamped per-category points. */
  weightedTotal: number;
  tier: MichaelClassificationTier;
  /** Human label, e.g. "Builder". */
  tierLabel: string;
  /** Score band for the tier, e.g. "85–100". */
  band: string;
  /** Provenance literal surfaced on cards. */
  signedBy: string;
}

/** Legacy band edges for old records. */
export const MICHAEL_CLASSIFICATION_BANDS: ReadonlyArray<{
  tier: MichaelClassificationTier;
  label: string;
  min: number;
  max: number;
}> = [
  { tier: 'builder', label: 'Builder', min: 85, max: 100 },
  { tier: 'emerging_leader', label: 'Emerging Leader', min: 70, max: 84 },
  { tier: 'part_time_producer', label: 'Part-Time Producer', min: 50, max: 69 },
  { tier: 'casual_participant', label: 'Casual Participant', min: 0, max: 49 },
] as const;

/** Legacy Michael-generated profile. Current Success Profile is Steve-owned. */
export interface MichaelSuccessProfile {
  baId: string;
  classification: MichaelClassification;
  /** One-line read the sponsor leads with, e.g. "Vision-led, time-rich, ready to be coached." */
  headline: string;
  /** What this BA brings — the strongest 1–3 categories rendered as plain reads. */
  strengths: string[];
  /** Where the sponsor should focus support — the lightest 1–3 categories. */
  sponsorFocus: string[];
  generatedAt: IsoTimestamp;
  signedBy: string;
}

/** Legacy founder-handoff record. New Michael ingests do not create this. */
export interface MichaelFounderHandoff {
  handoffId: string;
  baId: string;
  baFirstName: string;
  sponsorBaId: string | null;
  /** Lightweight classification summary (full profile on the linked artifact). */
  tier: MichaelClassificationTier;
  tierLabel: string;
  weightedTotal: number;
  successProfile: MichaelSuccessProfile;
  completedAt: IsoTimestamp;
  firedAt: IsoTimestamp;
  /** Founder BA-IDs the handoff was addressed to (from ADMIN_BA_IDS). */
  founderBaIds: string[];
  /** Whether the new BA's Fast Start gate is open (interview complete). Always
   *  true at handoff time — recorded for the founder's at-a-glance readiness. */
  fastStartReady: boolean;
  /** Per-channel delivery status. 'skipped' when the provider key is dormant. */
  dispatch: {
    sms: 'sent' | 'skipped' | 'failed';
    email: 'sent' | 'skipped' | 'failed';
  };
}

/** Legacy worker addendum from the retired Michael interview ingest. */
export interface MichaelScoringCategoryInput {
  categoryScores: MichaelCategoryScores;
}

/** Sponsor cockpit card shape retains nullable legacy fields for compatibility.
 *  Current server returns null for both; Steve-derived training support is the
 *  active Success Profile read. */
export interface MichaelCockpitCardClassified extends MichaelCockpitCardData {
  classification: MichaelClassification | null;
  successProfile: MichaelSuccessProfile | null;
}

/** LEGACY — retired founder-handoff response. */
export interface MichaelFounderHandoffListResponse {
  ok: true;
  handoffs: MichaelFounderHandoff[];
}

/** LEGACY — one question in Michael's retired interview backbone. */
export interface MichaelInterviewScriptQuestion {
  id: string;
  /** 1-based question number across the whole interview (1..29). */
  number: number;
  /** The section this question belongs to. */
  sectionId: string;
  /** The prompt Michael leads with (backbone; the LLM expands naturally). */
  prompt: string;
  /** Which rubric category this question primarily informs (null = rapport/none). */
  category: MichaelRubricCategory | null;
}

/** One of the 9 sections of the New Associate Success Interview. */
export interface MichaelInterviewScriptSection {
  id: string;
  title: string;
  /** What Michael is listening for in this section. */
  intent: string;
  questions: MichaelInterviewScriptQuestion[];
}

/** LEGACY — retired Michael interview script response. */
export interface MichaelInterviewScriptResponse {
  ok: true;
  sections: MichaelInterviewScriptSection[];
  rubric: Array<{ category: MichaelRubricCategory; max: number; label: string }>;
  bands: typeof MICHAEL_CLASSIFICATION_BANDS;
}
/* ────────────────────────────────────────────────────────────────────────
 * Group orientation scheduler (Chat #147 — wireframe §3.6,
 * dec_orientation_scheduling seq 21)
 * ────────────────────────────────────────────────────────────────────────
 *
 * New-member orientation runs as scheduled GROUP sessions of up to 10 BAs
 * each, hosted by founders (Kevin + Paul today; the host field is ASSIGNABLE
 * so trained leaders can host later — never hardcoded). This REUSES the
 * webinar Event + reservation architecture (§2.6): a session is an event with
 * a hard capacity cap; a BA reserves a seat.
 *
 * Flow: Michael completion → new BA sees available sessions in the .team
 * cockpit scheduling card → books a seat (cap 10) → founders see the
 * per-session roster in /admin. Founders add more sessions as the team grows
 * (seed more events — no rebuild). Google Calendar sync is DEFERRED.
 *
 * Distinction from the webinar:
 *   - Webinar reservations are PROSPECT-facing (via /api/p/:token), capacity
 *     is unbounded, and the reserving party is a prospect.
 *   - Orientation reservations are BA-facing (the new BA reserves their own
 *     seat from the authed .team session), capacity is capped at 10, and the
 *     reserving party is the BA. baId is read from the session, never the body.
 */

/** Default seat cap per orientation session (Chat #147). */
export const ORIENTATION_SESSION_CAPACITY = 10;

/**
 * A scheduled group orientation session a BA can reserve a seat in. Models
 * WebinarEvent but adds a `capacity` cap and keeps `hosts` assignable (the
 * seeder/admin sets them; founders today, leaders later).
 */
export interface OrientationSession {
  sessionId: string;
  scheduledFor: IsoTimestamp;
  /** Assignable host display names. Defaults to founders; never hardcoded downstream. */
  hosts: string[];
  /** Hard seat cap. Defaults to ORIENTATION_SESSION_CAPACITY (10). */
  capacity: number;
  durationMinutes: number;
  /** Optional join link (Zoom etc.); null until set by the host. */
  joinUrl: string | null;
  status: 'upcoming' | 'past' | 'cancelled';
  createdAt: IsoTimestamp;
}

/**
 * A BA's reservation of a seat in an orientation session. One active
 * reservation per BA per session; cancellation flips status to 'cancelled'
 * (the row is retained for the audit/roster history, not deleted).
 */
export interface OrientationReservationRecord {
  reservationId: string;
  sessionId: string;
  /** The reserving BA — read from the authed session, never the request body. */
  baId: string;
  /** Snapshot of the BA's display name at reservation time (for the roster). */
  baName: string;
  scheduledFor: IsoTimestamp;
  status: 'reserved' | 'cancelled';
  createdAt: IsoTimestamp;
  cancelledAt: IsoTimestamp | null;
  smsDeliveryStatus: 'queued' | 'sent' | 'failed' | 'skipped';
  smsDeliveryError: string | null;
}

/**
 * One available session as the cockpit scheduling card renders it: the
 * session plus its live seat math and whether THIS BA already holds a seat.
 */
export interface OrientationSessionAvailability {
  sessionId: string;
  scheduledFor: IsoTimestamp;
  hosts: string[];
  capacity: number;
  seatsTaken: number;
  seatsRemaining: number;
  durationMinutes: number;
  /** True when the authed BA already holds an active seat in this session. */
  reservedByMe: boolean;
}

/** GET /api/orientation/sessions — the cockpit scheduling card payload. */
export interface OrientationSessionsResponse {
  ok: true;
  sessions: OrientationSessionAvailability[];
  /** The session id this BA currently holds a seat in, or null. */
  myReservationSessionId: string | null;
}

/** POST /api/orientation/sessions/:sessionId/reserve response. */
export interface OrientationReserveResponse {
  ok: true;
  reservationId: string;
  sessionId: string;
  scheduledFor: IsoTimestamp;
  seatsRemaining: number;
  createdAt: IsoTimestamp;
}

/** DELETE /api/orientation/sessions/:sessionId/reserve response. */
export interface OrientationCancelResponse {
  ok: true;
  sessionId: string;
  cancelledAt: IsoTimestamp;
}

/** One BA on a session roster (the founder-facing /admin view). */
export interface OrientationRosterSeat {
  reservationId: string;
  baId: string;
  baName: string;
  reservedAt: IsoTimestamp;
}

/** A session plus its full roster, for the founder /admin roster view. */
export interface OrientationSessionWithRoster {
  sessionId: string;
  scheduledFor: IsoTimestamp;
  hosts: string[];
  capacity: number;
  durationMinutes: number;
  joinUrl: string | null;
  status: 'upcoming' | 'past' | 'cancelled';
  seatsTaken: number;
  seatsRemaining: number;
  roster: OrientationRosterSeat[];
}

/** GET /api/admin/orientation/sessions — founder roster view. */
export interface AdminOrientationSessionsResponse {
  ok: true;
  sessions: OrientationSessionWithRoster[];
}

/** POST /api/admin/orientation/sessions — founders seed a new session. */
export interface AdminCreateOrientationSessionPayload {
  scheduledFor: IsoTimestamp;
  /** Assignable hosts. Omit/empty → server defaults to the founders. */
  hosts?: string[];
  /** Seat cap. Omit → ORIENTATION_SESSION_CAPACITY (10). */
  capacity?: number;
  durationMinutes?: number;
  joinUrl?: string | null;
}

export interface AdminCreateOrientationSessionResponse {
  ok: true;
  session: OrientationSessionWithRoster;
}
/* ───────────────────────────────────────────────
 * Chat #147 — cockpit + profile edges (seq 22 + seq 23)
 * Appended per the append-only rule on this file.
 * ─────────────────────────────────────────────── */

/**
 * POST /api/crm/:prospectId/reinvite-script (Chat #147, seq 23,
 * dec_cockpit_sponsor_and_reinvite). Surfaces a ready-to-send, compliance-clean
 * re-invite message the BA can copy. This does NOT gate or mint — it only
 * generates copy. The BA decides when (and whether) to actually re-invite.
 */
export interface ReinviteScriptResponse {
  ok: true;
  prospectId: string;
  /** A warm, personal follow-up message. Compliance-safe by construction. */
  script: string;
}

/**
 * Founder contact surfaced as the support fallback when a BA's immutable
 * sponsor is inactive (Chat #147, seq 23). Placement and the immutable
 * sponsor relationship are unchanged — this is only a contact path.
 */
export interface SponsorFallbackFounder {
  fullName: string;
  firstName: string;
  phone: string | null;
}

/**
 * Founder-fallback block on the cockpit summary (Chat #147, seq 23). Present
 * (sponsorInactive true) only when the immutable sponsor is suspended,
 * admin-deleted, or dormant 120+ days. The My Sponsor card ALWAYS still shows
 * the original sponsor; this points the BA to Kevin + Paul for support.
 */
export interface CockpitSponsorFallback {
  sponsorInactive: boolean;
  founders: SponsorFallbackFounder[];
}

/* ───────────────────────────────────────────────────────────────────────────
 * ScriptMaker master-content seed selection (Chat #147 — inherit-scriptmaker)
 * ───────────────────────────────────────────────────────────────────────────
 *
 * F.5 inheritance wave-2: ScriptMaker no longer hardcodes its draft seed
 * language — it resolves one of four master-content invitation seeds through
 * readMasterContent() (server/src/services/masterContent.ts). These selectors
 * are appended (not merged into ScriptMakerDraftPayload) to honor the
 * append-only shared-types rule; the /api/scriptmaker/draft route reads them
 * alongside the base payload.
 */

/**
 * Which master-content invitation seed drives a ScriptMaker draft. Maps 1:1 to
 * the `team.invitation.*` template keys in domain/adminTenantArchitecture.ts.
 * Defaults to 'product_anchored' (the product-video front door) when omitted.
 */
export type ScriptMakerScriptKind =
  | 'default_script'
  | 'product_anchored'
  | 'reconnect'
  | 'event_invite';

/**
 * Optional draft selectors accepted by POST /api/scriptmaker/draft in addition
 * to ScriptMakerDraftPayload. `scriptKind` picks the seed; `eventDay`/
 * `eventTime` fill the event_invite seed's {{eventDay}}/{{eventTime}} tokens.
 */
export interface ScriptMakerDraftSelectors {
  scriptKind?: ScriptMakerScriptKind;
  eventDay?: string | null;
  eventTime?: string | null;
}
/**
 * Resolved master-content copy for the .com prospect surfaces (TASK-147
 * Wave-2 inherit-com). The server resolves each `com.*` master-content key
 * through the inheritance chain (code default → master override) and
 * interpolates the token-bound prospect/BA values SERVER-SIDE (the read
 * helper is server-only), then carries the finished strings to the client
 * on the GET /api/p/:token payload. The .com renderers consume these in
 * place of their hardcoded copy constants so a Kevin-saved override in
 * master_content_versions actually changes what the prospect sees.
 *
 * Resilience: every field is already a code-default-backed string
 * (readMasterContent never throws). The one nullable field is
 * `heroBaVoiceCopy` — it is non-null ONLY when the inviting-BA hero
 * (`com.presentation.hero`) carries an actual master override; with no
 * override the prop is absent and the generic hero sub-line carries the
 * page (locked-spec F.2 / 3.9 "inviting BA voice copy").
 */
export interface ComProspectCopy {
  /** com.presentation.hero — null unless a master override exists. */
  heroBaVoiceCopy: string | null;
  /** com.dashboard.arrival — Section 1 lead. */
  dashboardArrival: string;
  /** com.dashboard.opportunity — Section 2 lead. */
  dashboardOpportunity: string;
  /** com.dashboard.mechanic — Section 3 lead. */
  dashboardMechanic: string;
  /** com.dashboard.live_place — Section 4 lead. */
  dashboardLivePlace: string;
  /** com.dashboard.advantage — Section 5 lead. */
  dashboardAdvantage: string;
  /** com.dashboard.callback_cta — Section 6 lead. */
  dashboardCallbackCta: string;
}

/* ───────────────────────────────────────────────────────────────────────────
 * Task 7 — Team Magnificent Launch Center
 * ───────────────────────────────────────────────────────────────────────────
 *
 * /api/cockpit/launch is a read-only projection that gives a new BA one
 * dominant next action before the cockpit matures into the operational PMV.
 * It reads existing onboarding truth: welcome commitment, Steve discovery,
 * Fast Start progress, Ivory roster, invitation spine, and questionnaire.
 */

export type LaunchStepId =
  | 'welcome_accepted'
  | 'steve_discovery_completed'
  | 'day_1_started'
  | 'day_1_completed'
  | 'who_do_you_know_started'
  | 'first_invitation_drafted'
  | 'first_invitation_minted'
  | 'first_invitation_sent'
  | 'questionnaire_submitted'
  | 'sponsor_connection_confirmed';

export type LaunchStepState =
  | 'complete'
  | 'current'
  | 'available'
  | 'locked'
  | 'optional';

export interface LaunchStep {
  id: LaunchStepId;
  label: string;
  state: LaunchStepState;
  source: string;
  href: string | null;
  completedAt: IsoTimestamp | null;
  detail: string;
}

export interface LaunchNextAction {
  stepId: LaunchStepId | null;
  label: string;
  href: string | null;
  reason: string;
}

export interface LaunchSteveState {
  phase: SteveDiscoveryPhase;
  completedAt: IsoTimestamp | null;
}

export interface LaunchFirstInvitationState {
  ivoryNames: number;
  draftedCount: number;
  mintedCount: number;
  sentCount: number;
}

export interface LaunchFastStartState {
  day1State: FastStartModuleState;
  day1StartedAt: IsoTimestamp | null;
  day1CompletedAt: IsoTimestamp | null;
  complete: boolean;
}

export interface TeamLaunchCenterResponse {
  ok: true;
  generatedAt: IsoTimestamp;
  baFirstName: string;
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  nextAction: LaunchNextAction;
  steps: LaunchStep[];
  steve: LaunchSteveState;
  firstInvitation: LaunchFirstInvitationState;
  fastStart: LaunchFastStartState;
  questionnaireSubmitted: boolean;
  launchComplete: boolean;
}

// -----------------------------------------------------------------------------
// Agent Orchestration Layer
// -----------------------------------------------------------------------------

export type AgentId = 'michael' | 'ivory' | 'steve' | 'system';

export type AgentRecommendationPriority = 1 | 2 | 3 | 4 | 5;

export type AgentRecommendationKind =
  | 'complete_steve'
  | 'review_steve_profile'
  | 'follow_up_prospect'
  | 'invite_from_ivory'
  | 'open_daily_actions'
  | 'keep_sharing';

export type AgentSubjectType =
  | 'ba'
  | 'prospect'
  | 'ivory_name'
  | 'steve_discovery'
  | 'daily_actions'
  | 'system';

export interface AgentRecommendation {
  recommendationId: string;
  agentId: AgentId;
  kind: AgentRecommendationKind;
  priority: AgentRecommendationPriority;
  title: string;
  summary: string;
  reason: string;
  ctaLabel: string;
  route: string;
  subjectType: AgentSubjectType;
  subjectId: string | null;
  createdAt: IsoTimestamp;
  expiresAt: IsoTimestamp | null;
}

export interface AgentRecommendationsResponse {
  ok: true;
  generatedAt: IsoTimestamp;
  recommendations: AgentRecommendation[];
}

export type AgentEventKind =
  | 'recommendation_viewed'
  | 'recommendation_actioned'
  | 'recommendation_dismissed'
  | 'agent_opened'
  | 'handoff_started'
  | 'handoff_completed';

export type AgentEventMetadataValue = string | number | boolean | null;

export interface AgentEvent {
  eventId: string;
  baId: string;
  agentId: AgentId;
  kind: AgentEventKind;
  recommendationId: string | null;
  subjectType: AgentSubjectType;
  subjectId: string | null;
  metadata: Record<string, AgentEventMetadataValue>;
  createdAt: IsoTimestamp;
}

export interface CreateAgentEventPayload {
  agentId: AgentId;
  kind: AgentEventKind;
  recommendationId?: string | null;
  subjectType?: AgentSubjectType;
  subjectId?: string | null;
  metadata?: Record<string, AgentEventMetadataValue>;
}

export interface AgentEventResponse {
  ok: true;
  event: AgentEvent;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Steve — New BA Discovery & Success Interview (SEPARATE agent)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Steve is a second, independent BA-facing agent. He runs a warm DISCOVERY
 * conversation with a brand-new Brand Ambassador and produces a Success
 * Profile that helps the sponsor and the team UNDERSTAND, PERSONALIZE,
 * SUPPORT, and PREPARE for that BA.
 *
 * RELATIONSHIP TO MICHAEL: Steve does NOT replace Michael and does NOT touch
 * Michael graph data. Michael no longer schedules or interviews; the only link
 * is a one-way `michaelHandoffSummary` string Steve writes onto its OWN artifact
 * for training-support context.
 *
 * HARD RULE — Steve does NOT classify, rank, score, or judge. There is no
 * rubric, no tier, no weighted total, no "tone" read anywhere in Steve's
 * output. Every field below is a descriptive reflection of the BA's OWN words.
 * Steve exists to understand, personalize, support, and prepare — never to
 * evaluate.
 *
 * COMPLIANCE (locked-spec 3.10 / 3.12, same frame as Michael): no earnings,
 * commissions, cycle math, or placement/queue promises anywhere in Steve's
 * output. Layer 1 only.
 * ───────────────────────────────────────────────────────────────────────── */

/** UI phase of the Steve discovery surface. Steve has no scheduler of its own
 *  (Michael owns scheduling); the phase is derived purely from whether the
 *  discovery artifact exists yet. */
export type SteveDiscoveryPhase =
  | 'awaiting_call'
  | 'call_in_progress'
  | 'complete'
  | 'no_answer'
  | 'invalid_number'
  | 'stt_failed';

/** One speaker turn in Steve's discovery transcript. 'ba' = the new BA. */
export interface SteveTranscriptChunk {
  sequence: number;
  speaker: 'steve' | 'ba';
  text: string;
  occurredAt: IsoTimestamp;
}

/** One discovery question + the BA's answer. NOTE: no scoringTags — Steve
 *  records understanding, never tags or scores. */
export interface SteveDiscoveryAnswer {
  questionId: string;
  /** The prompt Steve led with (captured for sponsor readback). */
  prompt: string;
  /** The BA's answer text, derived from the transcript by the worker. */
  answerText: string;
}

/** What a discovery question is gently surfacing. Descriptive grouping only —
 *  it is NOT a rubric category and carries no weight or score. */
export type SteveDiscoveryFocus =
  | 'primary_why'
  | 'success_vision'
  | 'learning_style'
  | 'communication'
  | 'support_needs';

/** How the BA prefers to take in something new. Descriptive, not ranked. */
export type SteveLearningModality =
  | 'watching'
  | 'doing'
  | 'step_by_step'
  | 'reading'
  | 'discussing'
  | 'mixed';

/** The BA's learning style — their own preferences, reflected back. */
export interface SteveLearningStyle {
  /** Preferred way(s) to learn, mapped from the BA's own words. */
  modalities: SteveLearningModality[];
  /** How the BA likes feedback when doing something a little wrong. */
  feedbackPreference: string;
  /** Free-text reflection of what helps this person learn best. */
  notes: string;
}

/** Channels the BA likes to be reached on. */
export type SteveContactChannel =
  | 'text'
  | 'call'
  | 'email'
  | 'in_app'
  | 'video'
  | 'in_person';

/** How often the BA wants to hear from their sponsor/team. */
export type SteveContactCadence =
  | 'daily'
  | 'few_times_week'
  | 'weekly'
  | 'as_needed';

/** The BA's communication preferences — their own stated preferences. */
export interface SteveCommunicationPreferences {
  preferredChannels: SteveContactChannel[];
  cadence: SteveContactCadence | null;
  /** When the BA is reachable, in their own words. */
  bestTimes: string;
  notes: string;
}

/** Where the BA wants support early. Reflective, never a judgment of capacity. */
export interface SteveSupportNeeds {
  /** Areas the BA wants a hand with, mapped to short reads. */
  areas: string[];
  /** Obstacles the BA themselves named. Recorded, not scored. */
  potentialObstacles: string[];
  /** How they like to be supported when stuck (ask early vs push through, etc.). */
  helpStyle: string;
  notes: string;
}

/** The BA's deeper, emotional reason for being here — in their own words. */
export interface StevePrimaryWhy {
  /** The why beneath the surface answer. */
  statement: string;
  /** Who they're doing this for, if named. */
  who: string;
  /** Why now — the timing pull they described. */
  whyNow: string;
}

/** The BA's picture of success — in their own words. */
export interface SteveSuccessVision {
  /** Life a year out, as the BA painted it. */
  statement: string;
  /** The one change that would make the biggest difference. */
  oneBigChange: string;
}

/** One personalized recommendation — supportive preparation, not evaluation. */
export interface SteveRecommendation {
  /** Short, actionable, supportive — how to meet this BA where they are. */
  text: string;
  /** Optional pointer to a surface/resource (e.g. '/training/fast-start/product'). */
  href?: string | null;
}

/** The generated Success Profile — Steve's synthesis of the discovery. Every
 *  field reflects the BA's own words; nothing here ranks or scores the BA. */
export interface SteveSuccessProfile {
  baId: string;
  primaryWhy: StevePrimaryWhy;
  successVision: SteveSuccessVision;
  learningStyle: SteveLearningStyle;
  communicationPreferences: SteveCommunicationPreferences;
  supportNeeds: SteveSupportNeeds;
  /** How to launch this BA well — personalized first steps. */
  launchRecommendations: SteveRecommendation[];
  /** What training to point them at first, given how they learn. */
  trainingRecommendations: SteveRecommendation[];
  /** Short context summary Steve hands to Michael for training suggestions.
   *  CONTEXT ONLY — Michael does not schedule or interview. */
  michaelHandoffSummary: string;
  generatedAt: IsoTimestamp;
  signedBy: string;
}

/** Authoritative completed-discovery record. Triple-stacked at ingest.
 *  sponsorBaId is stamped server-side from brand_ambassadors — NEVER from the
 *  worker payload (locked-spec 3.5). */
export interface SteveDiscoveryArtifact {
  baId: string;
  sponsorBaId: string | null;
  callSid: string | null;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
  transcript: SteveTranscriptChunk[];
  /** The raw discovery interview (questions + the BA's answers). */
  answers: SteveDiscoveryAnswer[];
  /** The synthesized Success Profile. */
  successProfile: SteveSuccessProfile;
  audioUrl: string | null;
}

/** GET /api/steve/discovery/state response — the BA's own discovery view.
 *  Pre-discovery: phase=awaiting_call, artifact=null. After: phase=complete
 *  + artifact. */
export interface SteveDiscoveryView {
  baId: string;
  phase: SteveDiscoveryPhase;
  transcript: SteveTranscriptChunk[];
  artifact: SteveDiscoveryArtifact | null;
}

/** Sponsor-only card: a downline's Steve Success Profile. Access enforced
 *  server-side (requesting BA must be the downline's sponsor). */
export interface SteveProfileCard {
  downlineBaId: string;
  downlineFirstName: string;
  completedAt: IsoTimestamp;
  answers: SteveDiscoveryAnswer[];
  successProfile: SteveSuccessProfile;
  audioUrl: string | null;
  signedBy: string;
}

/** Worker → server payload on POST /api/steve/discovery/ingest. The worker
 *  conducts the conversation and supplies the discovery + the understanding it
 *  produced; the server stamps baId/sponsorBaId/generatedAt/signedBy and
 *  assembles the SteveSuccessProfile, then triple-stacks it. sponsorBaId is
 *  intentionally omitted from this shape (server-stamped). */
export interface SteveDiscoveryIngestPayload {
  baId: string;
  callSid: string | null;
  startedAt: IsoTimestamp;
  completedAt: IsoTimestamp;
  transcript: SteveTranscriptChunk[];
  answers: SteveDiscoveryAnswer[];
  audioUrl: string | null;
  /** The understanding Steve produced. The server assembles these into the
   *  SteveSuccessProfile (stamping baId, generatedAt, signedBy). */
  profile: {
    primaryWhy: StevePrimaryWhy;
    successVision: SteveSuccessVision;
    learningStyle: SteveLearningStyle;
    communicationPreferences: SteveCommunicationPreferences;
    supportNeeds: SteveSupportNeeds;
    launchRecommendations: SteveRecommendation[];
    trainingRecommendations: SteveRecommendation[];
    michaelHandoffSummary: string;
  };
}

/** One question in Steve's discovery backbone, surfaced read-only via
 *  GET /api/steve/discovery/script. */
export interface SteveDiscoveryScriptQuestion {
  id: string;
  /** 1-based question number across the whole discovery. */
  number: number;
  sectionId: string;
  /** The prompt Steve leads with (backbone; the LLM expands naturally). */
  prompt: string;
  /** What this question gently surfaces (understanding only; never scored). */
  focus: SteveDiscoveryFocus | null;
}

/** One section of Steve's discovery conversation. */
export interface SteveDiscoveryScriptSection {
  id: string;
  title: string;
  /** What Steve is listening for in this section. */
  intent: string;
  questions: SteveDiscoveryScriptQuestion[];
}

/** GET /api/steve/discovery/script response. */
export interface SteveDiscoveryScriptResponse {
  ok: true;
  sections: SteveDiscoveryScriptSection[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Ivory Prospect Momentum Agent (feature/ivory-momentum-agent)
//
// The post-mint companion to the Ivory Invitation Agent. After a BA mints a
// `source: 'ivory'` invitation, the Momentum Agent tracks that prospect's
// lifecycle through the existing PMV substrate and surfaces:
//
//   1. A cohort-scoped view of every Ivory-sourced prospect for the BA.
//   2. A small focus queue prioritized by the existing PMV `nextAction` model.
//   3. Per-prospect relationship context from the originating IvoryName record
//      (categories, preferredAngle, the BA's saved memory note) so the BA can
//      remember WHY they invited this person without leaving the page.
//   4. An on-demand, LLM-coached "what to say next" suggestion (NOT auto-sent;
//      never a placement/income claim) with a neutral fallback when
//      ANTHROPIC_API_KEY is unset.
//
// Everything is BA-scoped (sponsorBaId = session baId, ownership enforced on
// the IvoryName side). The agent NEVER auto-sends, never scores prospects, and
// never speaks comp/income/medical (locked-spec 3.10/3.11) — it's a reflection
// surface for manual follow-up, modeled on Ivory's coach posture.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why a prospect appears in the Momentum focus queue — surfaced alongside the
 * existing PMV `nextAction.reason` so the BA sees one Ivory-flavored phrase
 * ("because Jordan watched the video") not just the generic call-now reason.
 */
export type IvoryMomentumPriorityReason =
  | 'callback_raised'
  | 'video_watched'
  | 'follow_up_due'
  | 'video_partial'
  | 'clicked_no_watch'
  | 'sent_no_open'
  | 'draft_unsent'
  | 'expiring_soon'
  | 'expired_consider_reinvite';

/**
 * Ivory-side context on a prospect row — the slice of the IvoryName record the
 * Momentum view needs to remind the BA WHY this person came to mind. Every
 * field can be null because a prospect minted before the IvoryName link
 * existed (legacy data, manual ivoryId-less mint) still appears in the cohort
 * via the source='ivory' filter — we just don't have the warm-market memory.
 */
export interface IvoryMomentumContext {
  ivoryId: string | null;
  categories: IvoryCategory[];
  preferredAngle: IvoryAngle | null;
  /** The BA's saved memory note on the IvoryName record (NOT the invite message). */
  memoryNote: string | null;
  /** The relationshipReason the BA captured at mint time (lives on the prospect). */
  relationshipReason: string | null;
}

/**
 * One row in the Momentum cohort. Composes the canonical PMV row (the source
 * of truth for lifecycle/lastSignal/nextAction) with Ivory-side context and a
 * single derived priority reason. The PMV row is embedded whole — the UI
 * should never recompute lifecycle/nextAction from raw fields, only read it.
 */
export interface IvoryMomentumRow {
  prospectId: string;
  /** The full PMV row — single source of truth for lifecycle + next action. */
  pmv: ProspectMomentumRow;
  /** Ivory-specific relationship context for the BA. */
  ivory: IvoryMomentumContext;
  /**
   * Derived priority reason used to rank the row in the cohort focus queue.
   * Independent from `pmv.nextAction.kind` because the Ivory queue prioritizes
   * relational moments ("Jordan watched") even when PMV would also surface
   * a generic 'call_now'.
   */
  priorityReason: IvoryMomentumPriorityReason | null;
}

/** Cohort-level counts surfaced in the Momentum page header. */
export interface IvoryMomentumCohortCounts {
  total: number;
  draft: number;
  sentUnopened: number;
  clicked: number;
  videoInProgress: number;
  watched: number;
  callbackRaised: number;
  enrolled: number;
  customer: number;
  expired: number;
  archived: number;
}

/** GET /api/ivory/momentum 200 response. BA-scoped. */
export interface IvoryMomentumViewResponse {
  ok: true;
  generatedAt: IsoTimestamp;
  counts: IvoryMomentumCohortCounts;
  focusQueue: IvoryMomentumRow[];
  rows: IvoryMomentumRow[];
}

/**
 * POST /api/ivory/momentum/:prospectId/suggest request body. The Ivory
 * Momentum Agent reads the prospect's current lifecycle/lastSignal and the
 * BA's saved relationship context, then asks the LLM for one short, warm
 * follow-up suggestion the BA can adapt and send manually. Optional `ask`
 * lets the BA bias the suggestion ("they said they'd watch this weekend").
 */
export interface IvoryMomentumSuggestionPayload {
  /** Optional free-form BA prompt to bias the suggestion. */
  ask?: string;
}

/** POST /api/ivory/momentum/:prospectId/suggest 200 response. */
export interface IvoryMomentumSuggestionResponse {
  ok: true;
  prospectId: string;
  lifecycle: ProspectLifecycleStage;
  /** 1–2 sentence framing the BA reads before the suggestion text. */
  coaching: string;
  /** The suggested follow-up text. BA edits before sending — never auto-sent. */
  suggestion: string;
  /** True when the LLM is unavailable and a deterministic fallback was returned. */
  degraded: boolean;
}

// ─── feature/michael-training-support ────────────────────────────────────────
// Sponsor-facing "how to support this downline's training" card. PROJECTION of
// Steve's already-persisted SuccessProfile (steve_discoveries) — read-only on
// each request, no new collection. Steve owns capture; this surface owns
// presentation of the support guidance to the direct sponsor.
//
// Compliance: BA-language read-back only. No income, no comp math, no placement
// promises. The sponsor uses this to meet the BA where they are during training.

export interface MichaelTrainingSupportGuidanceSection {
  /** Section label, e.g. "How they learn". */
  label: string;
  /** Distilled guidance lines pulled from the BA's own discovery answers. */
  bullets: string[];
}

export interface MichaelTrainingSupportCard {
  downlineBaId: string;
  downlineFirstName: string;
  /** Timestamp from Steve's SuccessProfile (generatedAt). */
  derivedFromSteveAt: string;
  /** Pass-through of the BA's own primary-why statement. */
  primaryWhy: string;
  /** Pass-through of the BA's own success-vision statement. */
  successVision: string;
  learningStyle: MichaelTrainingSupportGuidanceSection;
  communication: MichaelTrainingSupportGuidanceSection;
  supportFocus: MichaelTrainingSupportGuidanceSection;
  /** Pass-through of Steve's training recommendations (verbatim, may be empty). */
  trainingRecommendations: string[];
  /** Pass-through of Steve's one-way handoff summary for Michael / humans. */
  michaelHandoffSummary: string;
  /** Provenance: who signed this card. */
  signedBy: string;
}

/* --------------------------------------------------------------------------
 * VM Lead Campaign + Prospect CRM Hub foundation (Agent 1 schema pass)
 * --------------------------------------------------------------------------
 *
 * These are additive contracts for the VM/RVM acquisition module. They do not
 * alter the existing /p/:token PMV spine: imported/tokenized leads are CRM
 * visible immediately, but Holding Tank visibility still requires the existing
 * video_complete placement rule.
 *
 * Ownership invariant: every lead/prospect record carries ownerTmBaId and
 * sponsorTmBaId. VM leads also carry leadBatchId and vmCampaignId. Client
 * payloads must not provide or override those ownership fields; routes stamp
 * them from the authenticated BA, token, or audited admin correction.
 */

export type TmBaId = string;

export interface OwnedProspectIdentity {
  ownerTmBaId: TmBaId;
  sponsorTmBaId: TmBaId;
}

export interface VmLeadIdentity extends OwnedProspectIdentity {
  leadBatchId: string;
  vmCampaignId: string;
}

export type ProspectAcquisitionSource =
  | 'pmv'
  | 'rvm'
  | 'qr'
  | 'manual'
  | 'referral'
  | 'social'
  | 'personal'
  | 'callback'
  | 'info_request'
  | 'ivory'
  | 'scriptmaker';

export type VmLeadBatchSource =
  | 'apache_leads'
  | 'uploaded_csv'
  | 'manual_import'
  | 'provider_import'
  | 'admin_seed'
  | 'other';

export type VmLeadType =
  | 'mobile_vm'
  | 'mobile_sms'
  | 'email'
  | 'mixed'
  | 'unknown';

export type LeadBatchStatus =
  | 'draft'
  | 'processing'
  | 'imported'
  | 'validated'
  | 'partially_failed'
  | 'completed'
  | 'archived';

export type VmCampaignProvider =
  | 'leadsrain_style_adapter'
  | 'slybroadcast_style_adapter'
  | 'manual_csv'
  | 'future_telecom_adapter'
  | 'none';

export type VmCampaignStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'dry_run'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type VmDeliveryChannel = 'voicemail' | 'sms' | 'email' | 'manual_export';

export type VmDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'skipped'
  | 'opted_out'
  | 'suppressed'
  | 'unknown';

export type ProspectCrmStatus =
  | 'inactive_pre_engagement'
  | 'active'
  | 'needs_follow_up'
  | 'watching'
  | 'presentation_completed'
  | 'holding_tank'
  | 'closed';

export type ProspectCrmDisposition =
  | 'new_ba'
  | 'new_customer'
  | 'interested'
  | 'not_interested'
  | 'later'
  | 'no_response'
  | 'wrong_number'
  | 'do_not_contact';

export type ProspectCrmClosedReason =
  | 'enrolled_as_ba'
  | 'became_customer'
  | 'not_interested'
  | 'do_not_contact'
  | 'expired'
  | 'duplicate'
  | 'invalid_contact'
  | 'admin_closed';

export type ProspectTimelineEventKind =
  | 'crm_created'
  | 'token_created'
  | 'voicemail_sent'
  | 'sms_sent'
  | 'email_sent'
  | 'link_clicked'
  | 'activated'
  | 'info_requested'
  | 'callback_requested'
  | 'presentation_started'
  | 'presentation_25'
  | 'presentation_50'
  | 'presentation_75'
  | 'presentation_completed'
  | 'dashboard_entered'
  | 'holding_tank'
  | 'note_added'
  | 'follow_up_set'
  | 'follow_up_cleared'
  | 'disposition_changed'
  | 'closed_new_ba'
  | 'closed_new_customer'
  | 'closed_not_interested'
  | 'closed_later'
  | 'expired'
  | 'archived'
  | 'ownership_corrected';

export type VmLeadLifecycleStatus =
  | 'imported'
  | 'validated'
  | 'suppressed'
  | 'crm_created'
  | 'token_created'
  | 'queued'
  | 'voicemail_sent'
  | 'sms_sent'
  | 'email_sent'
  | 'link_clicked'
  | 'activated'
  | 'info_requested'
  | 'callback_requested'
  | 'presentation_started'
  | 'presentation_25'
  | 'presentation_50'
  | 'presentation_75'
  | 'presentation_completed'
  | 'dashboard_entered'
  | 'holding_tank'
  | 'closed_new_ba'
  | 'closed_new_customer'
  | 'closed_not_interested'
  | 'closed_later'
  | 'expired'
  | 'archived';

export const VM_LEAD_LIFECYCLE_STATUSES: readonly VmLeadLifecycleStatus[] = [
  'imported',
  'validated',
  'suppressed',
  'crm_created',
  'token_created',
  'queued',
  'voicemail_sent',
  'sms_sent',
  'email_sent',
  'link_clicked',
  'activated',
  'info_requested',
  'callback_requested',
  'presentation_started',
  'presentation_25',
  'presentation_50',
  'presentation_75',
  'presentation_completed',
  'dashboard_entered',
  'holding_tank',
  'closed_new_ba',
  'closed_new_customer',
  'closed_not_interested',
  'closed_later',
  'expired',
  'archived',
] as const;

export interface LeadBatchRecord extends OwnedProspectIdentity {
  leadBatchId: string;
  name: string;
  source: VmLeadBatchSource;
  sourceLabel: string | null;
  country: string;
  leadType: VmLeadType;
  quantityExpected: number;
  quantityImported: number;
  quantitySuppressed: number;
  quantityInvalid: number;
  status: LeadBatchStatus;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  completedAt: IsoTimestamp | null;
}

export interface BulkLeadRecord extends VmLeadIdentity {
  leadId: string;
  prospectId: string | null;
  token: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  stateOrRegion: string | null;
  country: string | null;
  source: VmLeadBatchSource;
  status: VmLeadLifecycleStatus;
  activatedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface VMCampaignRecord extends OwnedProspectIdentity {
  vmCampaignId: string;
  leadBatchId: string;
  name: string;
  provider: VmCampaignProvider;
  status: VmCampaignStatus;
  voicemailAudioId: string | null;
  smsTemplateId: string | null;
  emailTemplateId: string | null;
  scheduledAt: IsoTimestamp | null;
  startedAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface VMDeliveryEventRecord extends VmLeadIdentity {
  deliveryEventId: string;
  leadId: string;
  prospectId: string | null;
  channel: VmDeliveryChannel;
  provider: VmCampaignProvider;
  providerMessageId: string | null;
  status: VmDeliveryStatus;
  occurredAt: IsoTimestamp;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, string | number | boolean | null>;
}

export interface ProspectCRMRecord extends OwnedProspectIdentity {
  crmRecordId: string;
  prospectId: string;
  leadId: string | null;
  leadBatchId: string | null;
  vmCampaignId: string | null;
  source: ProspectAcquisitionSource;
  status: ProspectCrmStatus;
  disposition: ProspectCrmDisposition | null;
  followUpDueAt: IsoTimestamp | null;
  closedAt: IsoTimestamp | null;
  closedReason: ProspectCrmClosedReason | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ProspectTimelineEventRecord extends OwnedProspectIdentity {
  eventId: string;
  prospectId: string;
  crmRecordId: string | null;
  leadId: string | null;
  leadBatchId: string | null;
  vmCampaignId: string | null;
  kind: ProspectTimelineEventKind;
  title: string;
  occurredAt: IsoTimestamp;
  payload: Record<string, string | number | boolean | null>;
}

export interface OwnershipCorrectionAuditRecord {
  auditId: string;
  prospectId: string;
  leadId: string | null;
  oldOwnerTmBaId: TmBaId;
  newOwnerTmBaId: TmBaId;
  oldSponsorTmBaId: TmBaId;
  newSponsorTmBaId: TmBaId;
  reason: string;
  adminUserId: string;
  changedAt: IsoTimestamp;
}

export interface ProspectCrmHubFilter {
  source?: ProspectAcquisitionSource | 'all';
  status?: ProspectCrmStatus | 'all';
  disposition?: ProspectCrmDisposition | 'all';
  campaignId?: string | null;
  leadBatchId?: string | null;
  followUp?: 'due' | 'upcoming' | 'none' | 'all';
  closed?: 'include' | 'exclude' | 'only';
}

export interface ProspectCrmHubRow extends OwnedProspectIdentity {
  crmRecordId: string;
  prospectId: string;
  leadId: string | null;
  firstName: string;
  lastInitial: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  stateOrRegion: string | null;
  country: string | null;
  source: ProspectAcquisitionSource;
  status: ProspectCrmStatus;
  disposition: ProspectCrmDisposition | null;
  followUpDueAt: IsoTimestamp | null;
  lastSignal: ProspectTimelineEventKind | null;
  lastSignalAt: IsoTimestamp | null;
  leadBatchId: string | null;
  vmCampaignId: string | null;
}

export interface ProspectCrmHubListResponse {
  ok: true;
  generatedAt: IsoTimestamp;
  filters: ProspectCrmHubFilter;
  rows: ProspectCrmHubRow[];
}

export interface ProspectCrmHubDetailResponse {
  ok: true;
  record: ProspectCRMRecord;
  timeline: ProspectTimelineEventRecord[];
}

export type BulkLeadStatus = VmLeadLifecycleStatus;
export type ProspectCrmSource = ProspectAcquisitionSource;
export type ProspectTimelineKind = ProspectTimelineEventKind;
export type VMCampaignProviderMode = VmCampaignProvider;

export interface CreateLeadBatchPayload {
  name: string;
  source: string;
  country?: string;
  leadType: string;
  quantityImported?: number;
}

export interface CreateVMCampaignPayload {
  leadBatchId: string;
  name: string;
  provider?: VMCampaignProviderMode;
  voicemailAudioId?: string | null;
  smsTemplateId?: string | null;
  emailTemplateId?: string | null;
  scheduledAt?: IsoTimestamp | null;
}

export interface ImportBulkLeadPayload {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  city: string;
  stateOrRegion: string;
  country?: string;
}

export interface ImportBulkLeadsPayload {
  vmCampaignId: string;
  leads: ImportBulkLeadPayload[];
}

export interface LeadBatchResponse {
  ok: true;
  batch: LeadBatchRecord;
}

export interface LeadBatchListResponse {
  ok: true;
  batches: LeadBatchRecord[];
}

export interface VMCampaignResponse {
  ok: true;
  campaign: VMCampaignRecord;
}

export interface VMCampaignListResponse {
  ok: true;
  campaigns: VMCampaignRecord[];
}

export interface ImportBulkLeadsResponse {
  ok: true;
  batch: LeadBatchRecord;
  campaign: VMCampaignRecord;
  leads: BulkLeadRecord[];
}

export interface ProspectCrmListResponse {
  ok: true;
  records: ProspectCRMRecord[];
}

export interface ProspectCrmRecordResponse {
  ok: true;
  record: ProspectCRMRecord;
  timeline: ProspectTimelineEventRecord[];
}

export interface CloseAsNewBaResponse {
  ok: true;
  record: ProspectCRMRecord;
  closedAt: IsoTimestamp;
}

export interface RvmResolvedTokenPayload extends ResolvedTokenPayload {
  source: 'rvm';
  lead: {
    leadId: string;
    leadBatchId: string;
    vmCampaignId: string;
    status: BulkLeadStatus;
  };
  crm: {
    crmRecordId: string;
    crmStatus: ProspectCrmStatus;
    disposition: ProspectCrmDisposition | null;
  };
}

export interface RvmInfoRequestPayload {
  note?: string;
}

export interface RvmInfoRequestResponse {
  ok: true;
  prospectId: string;
  createdAt: IsoTimestamp;
}

export type AdminVmMetricTone = 'neutral' | 'good' | 'watch' | 'risk';

export interface AdminVmMetricCard {
  key: string;
  label: string;
  value: number | string;
  detail: string;
  tone: AdminVmMetricTone;
}

export interface AdminVmBaPerformanceRow {
  tmBaId: string;
  baName: string;
  campaignCount: number;
  batchCount: number;
  leadsImported: number;
  leadsContacted: number;
  activated: number;
  activationRate: number | null;
  videoStarts: number;
  videoCompletions: number;
  completionRate: number | null;
  callbacks: number;
  infoRequests: number;
  holdingTankEntries: number;
  closedNewBa: number;
  lastActivityAt: IsoTimestamp | null;
}

export interface AdminVmBatchHealthRow {
  leadBatchId: string;
  ownerTmBaId: string;
  ownerName: string;
  source: string;
  status: string;
  quantityImported: number;
  validated: number;
  suppressed: number;
  tokenized: number;
  crmCreated: number;
  activated: number;
  createdAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
}

export interface AdminVmCampaignRow {
  vmCampaignId: string;
  ownerTmBaId: string;
  ownerName: string;
  leadBatchId: string | null;
  name: string;
  provider: string;
  status: string;
  scheduledAt: IsoTimestamp | null;
  leadsQueued: number;
  delivered: number;
  deliveryFailed: number;
  activated: number;
  videoCompletions: number;
  callbacks: number;
  closedNewBa: number;
  createdAt: IsoTimestamp | null;
}

export interface AdminVmComplianceSummary {
  suppressedLeads: number;
  optOuts: number;
  dncFlags: number;
  invalidPhones: number;
  invalidEmails: number;
  complianceHolds: number;
  liveSendEnabled: boolean;
  note: string;
}

export interface AdminVmProviderHealth {
  provider: string;
  mode: 'stub' | 'manual' | 'dry_run' | 'live';
  status: 'not_configured' | 'healthy' | 'warning' | 'error';
  lastWebhookAt: IsoTimestamp | null;
  delivered24h: number;
  failed24h: number;
  note: string;
}

export type AdminVmHookStatus = 'stubbed' | 'wired' | 'disabled';

export interface AdminVmNotificationHook {
  hookId: string;
  trigger:
    | 'vm_lead_activated'
    | 'prospect_clicked_token'
    | 'presentation_started'
    | 'presentation_completed'
    | 'callback_requested'
    | 'info_requested'
    | 'follow_up_due'
    | 'campaign_completed'
    | 'import_completed'
    | 'event_starting_soon';
  audience: 'owning_ba' | 'admin' | 'team';
  channel: 'in_app' | 'sms' | 'email' | 'team_news';
  status: AdminVmHookStatus;
  privacyBoundary: string;
}

export interface AdminVmTeamNewsHook {
  hookId: string;
  source:
    | 'campaign_milestone'
    | 'training_update'
    | 'event_update'
    | 'success_story'
    | 'team_momentum';
  status: AdminVmHookStatus;
  reviewRequired: boolean;
  note: string;
}

export interface AdminVmOverviewResponse {
  ok: true;
  generatedAt: IsoTimestamp;
  cards: AdminVmMetricCard[];
  baPerformance: AdminVmBaPerformanceRow[];
  batches: AdminVmBatchHealthRow[];
  campaigns: AdminVmCampaignRow[];
  compliance: AdminVmComplianceSummary;
  providerHealth: AdminVmProviderHealth[];
  notificationHooks: AdminVmNotificationHook[];
  teamNewsHooks: AdminVmTeamNewsHook[];
  warnings: string[];
}

export interface AdminVmOwnershipCorrectionPayload {
  leadId?: string | null;
  prospectId?: string | null;
  leadBatchId?: string | null;
  vmCampaignId?: string | null;
  oldOwnerTmBaId: string;
  newOwnerTmBaId: string;
  oldSponsorTmBaId: string;
  newSponsorTmBaId: string;
  reason: string;
}

export interface AdminVmOwnershipCorrectionResponse {
  ok: true;
  applied: false;
  auditEntryId: string;
  note: string;
}

export interface AdminSuccessProfileSummary {
  baId: string;
  baName: string;
  sponsorBaId: string | null;
  generatedAt: IsoTimestamp | null;
  primaryWhy: string | null;
  learningStyle: string[];
  supportAreas: string[];
  signedBy: string | null;
}

export interface AdminAgentMemoryStatus {
  collection: string;
  purpose: string;
  status: 'present' | 'missing' | 'unknown';
  recordCount: number | null;
  note: string;
}

export interface AdminAgentInteractionSummary {
  agentId: AgentId;
  events7d: number;
  lastEventAt: IsoTimestamp | null;
}

export interface AdminSuccessProfileMemoryBridgeDraft {
  baId: string;
  ready: boolean;
  base: {
    id: string;
    type: 'document';
    schema_version: 1;
    namespace: 'momentum';
    source: 'momentum_admin_agent_memory_bridge';
    created_at: IsoTimestamp;
    title: string;
    origin_kind: 'system';
    service_name: 'admin_agent_memory_bridge';
  };
  semanticDocument: string;
  requiredWritePath: 'quadstack.write';
  options: { require: ['mongo', 'neo4j', 'chroma']; enforce_schema: true };
  note: string;
}

export interface AdminAgentOversightResponse {
  ok: true;
  generatedAt: IsoTimestamp;
  successProfiles: AdminSuccessProfileSummary[];
  memoryStatus: AdminAgentMemoryStatus[];
  interactionSummary: AdminAgentInteractionSummary[];
  bridgeDrafts: AdminSuccessProfileMemoryBridgeDraft[];
  warnings: string[];
}

export type SupportAgentKind = 'ivory' | 'michael' | 'steve_success';

export type SupportAgentInteractionKind =
  | 'invitation_draft'
  | 'followup_draft'
  | 'discovery_interview'
  | 'success_profile_generated'
  | 'training_recommendation'
  | 'daily_action_plan'
  | 'vm_campaign_recommendation'
  | 'crm_next_action';

export interface AgentInteractionRecord {
  interactionId: string;
  agent: SupportAgentKind;
  tmBaId: TmBaId;
  relatedProspectId: string | null;
  relatedCampaignId: string | null;
  kind: SupportAgentInteractionKind;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: IsoTimestamp;
}

export type DailyActionPrimaryFocus =
  | 'invite'
  | 'follow_up'
  | 'training'
  | 'vm_campaign'
  | 'event'
  | 'launch';

export interface DailyActionPlanItem {
  actionId: string;
  label: string;
  reason: string;
  priority: AgentRecommendationPriority;
  relatedProspectId: string | null;
  relatedCampaignId: string | null;
  suggestedAgent: SupportAgentKind | null;
  dueAt: IsoTimestamp | null;
  completedAt: IsoTimestamp | null;
}

export interface DailyActionPlan {
  planId: string;
  tmBaId: TmBaId;
  generatedAt: IsoTimestamp;
  primaryFocus: DailyActionPrimaryFocus;
  actions: DailyActionPlanItem[];
}

export interface SuccessProfileAgentContext {
  tmBaId: TmBaId;
  primaryWhy: string | null;
  successVision: string | null;
  learningStyle: {
    watching: number;
    reading: number;
    listening: number;
    doing: number;
  };
  communicationPreferences: string[];
  supportNeeds: string[];
  recommendedOrientationPath: string | null;
  recommendedLaunchPath: string | null;
  recommendedCoachingFocus: string | null;
  updatedAt: IsoTimestamp;
}
