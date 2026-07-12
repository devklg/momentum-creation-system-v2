/**
 * Shared domain types used across server and clients.
 * Kept thin in Phase 0 â€” expand as Phase 1+ surfaces ship.
 */

export type McsIsoTimestamp = string;

/** Token lifecycle states per COM Design Section E.1.
 *
 * This is the pure funnel rail â€” how far through the .com experience the
 * prospect has progressed. Callback requests and webinar reservations are
 * NOT lifecycle states; they are independent intent records a prospect can
 * create after video_complete. Both can exist for the same prospect
 * simultaneously (Chat #105 spec amendment).
 */
export type McsTokenState =
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
export type McsCallbackIntent =
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
export interface McsCallbackRequestPayload {
  intent: McsCallbackIntent;
}

/**
 * Response from POST /api/p/:token/callback-request. The page transitions
 * to a soft confirmation state using `baFirstName`. `createdAt` is echoed
 * back so the client can show "submitted at HH:MM" if Kevin ever wants
 * it; for now the UI just confirms the submission landed.
 */
export interface McsCallbackRequestResponse {
  ok: true;
  intent: McsCallbackIntent;
  baFirstName: string;
  createdAt: McsIsoTimestamp;
}

/**
 * Stored callback-request record. One prospect can submit multiple
 * requests over time (Chat #105 spec amendment) â€” these are independent
 * intent records, not lifecycle states. The most recent record per
 * prospect is what the BA cockpit surfaces; older records remain on the
 * activity timeline.
 */
export interface McsCallbackRequestRecord {
  callbackRequestId: string;
  token: string;
  prospectId: string;
  sponsorTmagId: string;
  intent: McsCallbackIntent;
  createdAt: McsIsoTimestamp;
  smsDeliveryStatus: 'queued' | 'sent' | 'failed' | 'skipped';
  smsDeliveryError: string | null;
}

/** Three-stack write result returned by the PERSISTENCE. */
export interface McsTripleStackWriteResult {
  mongo: { ok: boolean; insertedCount?: number };
  neo4j: { ok: boolean; counters?: Record<string, number> };
  chroma: { ok: boolean; verified?: boolean };
}

/**
 * Geographic location of a prospect.
 * Country is captured from day one for international rollout per
 * locked-spec Part 4.4. Use ISO 3166-1 alpha-2 codes ('US', 'CA', 'GB').
 */
export interface McsProspectLocation {
  city: string;
  stateOrRegion: string;
  country: string;
}

/**
 * Prospect record. The person a BA invited via /p/{token}.
 * Per locked-spec Part 1.17, prospects are one of the two kinds of people
 * the system tracks (BAs are the other). became_customer fields enable
 * the customer-conversion metric without expanding scope into customer
 * tracking; the actual customer relationship lives with THREE, the product company.
 */
export interface McsProspectRecord {
  prospectId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  location: McsProspectLocation;
  phone: string | null;
  email: string | null;
  sponsorTmagId: string;
  state: McsTokenState;
  positionNumber: number | null;
  placedAt: McsIsoTimestamp | null;
  becameCustomer: boolean;
  becameCustomerAt: McsIsoTimestamp | null;
  customerNote: string | null;
  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp;
}

/**
 * Invite token. Opaque 12-character string from the access-code alphabet
 * (31 chars, no 0/1/I/O/L). One prospect can have multiple tokens over time
 * if a BA re-invites them (cooldown rule locked-spec Part 5, still open).
 */
export interface McsInviteTokenRecord {
  token: string;
  prospectId: string;
  sponsorTmagId: string;
  state: McsTokenState;
  createdAt: McsIsoTimestamp;
  clickedAt: McsIsoTimestamp | null;
  expiresAt: McsIsoTimestamp;
}

/**
 * Discrete video milestones the .com client reports as the prospect
 * progresses through Dr. Dan's 17-minute video. Only 'complete' triggers
 * holding-tank placement (locked-spec Part 4.5).
 */
export type McsVideoEventKind =
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
export interface McsPoolPlacement {
  prospectId: string;
  sponsorTmagId: string;
  positionNumber: number;
  placedAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp;
  flushedAt: McsIsoTimestamp | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}

/**
 * Result of placeProspect. Returned to the route layer so it can respond
 * to the .com client with the assigned position; the client transitions
 * the render from presentation page to dashboard.
 */
export interface McsPlaceProspectResult {
  prospectId: string;
  positionNumber: number;
  placedAt: McsIsoTimestamp;
  alreadyPlaced: boolean;
}

/**
 * Request body for POST /api/p/:token/video-event.
 * Replaying any kind is idempotent â€” the server only transitions forward,
 * never backward, in the token lifecycle.
 */
export interface McsVideoEventPayload {
  kind: McsVideoEventKind;
}

/**
 * Response from POST /api/p/:token/video-event. positionNumber is non-null
 * only when this event resulted in (or already resulted in) placement.
 */
export interface McsVideoEventResponse {
  token: string;
  state: McsTokenState;
  positionNumber: number | null;
  placedAt: McsIsoTimestamp | null;
}

/**
 * Resolved /p/{token} payload returned by GET /api/p/:token.
 * Both prospect and BA are always present â€” the .com surface is never
 * anonymous per locked-spec Part 3.9.
 */
export interface McsResolvedTokenPayload {
  token: string;
  state: McsTokenState;
  prospect: {
    firstName: string;
    lastInitial: string;
    city: string;
    stateOrRegion: string;
    country: string;
    positionNumber: number | null;
    placedAt: McsIsoTimestamp | null;
    expiresAt: McsIsoTimestamp;
  };
  ba: {
    tmagId: string;
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
    scheduledFor: McsIsoTimestamp;
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
export interface McsEnrolledResponse {
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
export interface McsExpiredResponse {
  error: 'expired';
  expiredAt: McsIsoTimestamp;
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
export interface McsPlacementTickerEntry {
  positionNumber: number;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  placedAt: McsIsoTimestamp;
}

/**
 * SSE `snapshot` event payload â€” sent once at connection open.
 * Carries the current global max position so the client can compute
 * its own beneath-you count, plus the most recent N placements to
 * seed the position-stack ticker without a separate fetch.
 */
export interface McsHoldingTankSnapshot {
  globalMaxPosition: number;
  recent: McsPlacementTickerEntry[];
}

/**
 * SSE `placement` event payload â€” sent every time any prospect on
 * the team completes the video. Every viewer increments their own
 * beneath-you counter by 1 if positionNumber > their own position.
 * The entry is prepended to the position-stack ticker.
 */
export interface McsPlacementEvent extends McsPlacementTickerEntry {
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
export interface McsWebinarEvent {
  eventId: string;
  scheduledFor: McsIsoTimestamp;
  hosts: string[];
  zoomUrl: string | null;
  durationMinutes: number;
  status: 'upcoming' | 'past' | 'cancelled';
  createdAt: McsIsoTimestamp;
}

/**
 * Request body for POST /api/p/:token/webinar-reserve.
 * Name + email are the only fields the prospect provides; everything
 * else (eventId, prospectId, sponsorTmagId) is resolved server-side
 * from the token. Sponsor immutability (locked-spec 3.5) holds.
 */
export interface McsWebinarReservationPayload {
  name: string;
  email: string;
}

/**
 * Response from POST /api/p/:token/webinar-reserve. The dashboard
 * transitions Section 6's webinar tile to a "reserved" confirmation
 * card using `scheduledFor` + `baFirstName` so the prospect knows
 * who's following up with the Zoom link.
 */
export interface McsWebinarReservationResponse {
  ok: true;
  reservationId: string;
  eventId: string;
  scheduledFor: McsIsoTimestamp;
  baFirstName: string;
  emailSent: boolean;
  createdAt: McsIsoTimestamp;
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
export interface McsWebinarReservationRecord {
  reservationId: string;
  eventId: string;
  token: string;
  prospectId: string;
  sponsorTmagId: string;
  name: string;
  email: string;
  createdAt: McsIsoTimestamp;
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
export interface McsTeamStatsResponse {
  basActive24h: number;
  invitationsSentToday: number;
  newPlacements24h: number;
  recruitmentVelocityPct: number;
  computedAt: McsIsoTimestamp;
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
 * Sponsor immutability (locked-spec 3.5): sponsorTmagId is stamped from the
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
export type McsInvitationSource = 'self' | 'ivory' | 'scriptmaker';

/**
 * BA-submitted invitation form (Chat #119 field lock, extended Chat #120).
 * first/last name, email, phone, city, state â€” all flow onto the prospect
 * record so the CRM export carries them and city/state render on the
 * dashboard ticker. sponsorTmagId is NOT in this payload; the route derives
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
export interface McsCreateInvitationPayload {
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
  source?: McsInvitationSource;
  /** Optional BA-authored context, used by Ivory relationship-first invites. */
  relationshipReason?: string | null;
}

/**
 * Response from POST /api/invitations. Carries the fully-substituted
 * prospect link the BA shares (https://teammagnificent.com/p/{token}).
 */
export interface McsCreateInvitationResponse {
  ok: true;
  prospectId: string;
  token: string;
  inviteUrl: string;
  createdAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp;
  /** Echo of the stored message + source (Chat #120), so the page can
   *  show the BA exactly what was saved alongside the link. */
  message: string | null;
  source: McsInvitationSource;
  relationshipReason: string | null;
}

/**
 * Response from POST /api/invitations/:prospectId/sent ("I sent this").
 * alreadySent is true on idempotent replays.
 */
export interface McsMarkInvitationSentResponse {
  ok: true;
  prospectId: string;
  sentAt: McsIsoTimestamp;
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
export type McsInvitationActivityKind =
  | 'invitation_sent'
  | 'video_completed'
  | 'callback_requested';

export interface McsInvitationActivityEntry {
  activityId: string;
  prospectId: string;
  sponsorTmagId: string;
  kind: McsInvitationActivityKind;
  note: string;
  at: McsIsoTimestamp;
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
 * authed session BA's own prospects (filter sponsorTmagId = session tmagId).
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
export type McsInviteDisplayStatus =
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
export interface McsInviteSummary {
  prospectId: string;
  token: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  /** Token lifecycle rail state (raw). */
  tokenState: McsTokenState;
  /** Computed display status the cockpit badges on the row. */
  status: McsInviteDisplayStatus;
  /** Pool position once placed; null before video_complete. */
  positionNumber: number | null;
  /** Most recent callback intent, if the prospect raised a hand. */
  latestCallbackIntent: McsCallbackIntent | null;
  /** The stored invitation message + who composed it (Chat #120). */
  message: string | null;
  source: McsInvitationSource;
  /** Optional relationship context captured by Ivory before drafting. */
  relationshipReason?: string | null;
  /** Whether the BA has confirmed they sent the link. */
  sentAt: McsIsoTimestamp | null;
  becameCustomer: boolean;
  createdAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp;
}

/**
 * Response from GET /api/cockpit/invites. The BA's own prospects, newest
 * first, plus the per-prospect activity timeline keyed by prospectId so
 * the cockpit can expand a row without a second round trip.
 */
export interface McsMyInvitesResponse {
  ok: true;
  invites: McsInviteSummary[];
  /** activityByProspect[prospectId] = chronological activity for that prospect. */
  activityByProspect: Record<string, McsInvitationActivityEntry[]>;
}

/* ─────────────────────────────────────────────────────────────────────────
 * PMV backend projection (Task 4)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Prospect Momentum Viewer rows are BA-scoped server projections. They expose
 * explicit lifecycle, CRM summary, last signal, and deterministic next action
 * without scoring, qualifying, ranking, auto-sending, or widening ownership.
 */

export type McsProspectLifecycleStage =
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

export type McsProspectNextActionKind =
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

export type McsProspectNextActionScriptKind =
  | 'initial_send'
  | 'callback_reply'
  | 'clicked_no_watch'
  | 'partial_watch'
  | 'watched_no_callback'
  | 'reinvite'
  | 'later_reconnect';

export interface McsProspectNextAction {
  kind: McsProspectNextActionKind;
  label: string;
  reason: string;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: McsIsoTimestamp | null;
  scriptKind: McsProspectNextActionScriptKind | null;
}

export type McsProspectLastSignalKind =
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

export interface McsProspectLastSignal {
  kind: McsProspectLastSignalKind;
  label: string;
  at: McsIsoTimestamp;
}

export interface McsProspectMomentumCrmSummary {
  disposition: McsCrmDisposition | null;
  followUpDueAt: McsIsoTimestamp | null;
  followUpIsDue: boolean;
  noteCount: number;
  latestNoteAt: McsIsoTimestamp | null;
}

export interface McsProspectMomentumRow {
  prospectId: string;
  token: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  source: McsInvitationSource;
  /** Optional relationship context captured by Ivory before drafting. */
  relationshipReason?: string | null;
  lifecycle: McsProspectLifecycleStage;
  tokenState: McsTokenState;
  videoProgressPct: 0 | 25 | 50 | 75 | 100 | null;
  clickedAt: McsIsoTimestamp | null;
  sentAt: McsIsoTimestamp | null;
  createdAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp;
  positionNumber: number | null;
  placedAt: McsIsoTimestamp | null;
  latestCallbackIntent: McsCallbackIntent | null;
  crm: McsProspectMomentumCrmSummary;
  lastSignal: McsProspectLastSignal;
  nextAction: McsProspectNextAction;
}

export interface McsProspectFocusQueueItem {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  lifecycle: McsProspectLifecycleStage;
  source: McsInvitationSource;
  lastSignal: McsProspectLastSignal;
  nextAction: McsProspectNextAction;
}

export interface McsProspectMomentumViewerResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  focusQueue: McsProspectFocusQueueItem[];
  rows: McsProspectMomentumRow[];
  lifecycleGaps: string[];
}

/**
 * Response from GET /api/cockpit/summary. The headline counts the cockpit
 * shows above My Invites, plus the My Sponsor card data. Counts are the
 * BA's own funnel only (sponsorTmagId = session tmagId).
 */
export interface McsCockpitSummaryResponse {
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
export interface McsLibraryVideo {
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
 * sponsorTmagId is NOT in the payload â€” the route derives it from the session
 * (locked-spec 3.5), same as the spine.
 */
export interface McsScriptMakerDraftPayload {
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
export interface McsScriptMakerDraftResponse {
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
 * record below stamps sponsorTmagId from the inviting token and is
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
export interface McsProspectAccountRecord {
  accountId: string;
  prospectId: string;
  /** The original invite token. Re-entry resolves to this token only. */
  tokenId: string;
  /** Stamped from the token at creation; immutable thereafter (3.5). */
  sponsorTmagId: string;
  /** E.164 â€” null until callback/webinar consent signal fires. */
  phone: string | null;
  /** App-generated re-entry credential (#148): 6-char, unambiguous alphabet.
   *  Set at invite mint so a prospect can return via phone + code even before
   *  any consent signal. */
  reentryCode: string;
  createdAt: McsIsoTimestamp;
  /** Aligned with the token's expiresAt (3.7 â€” the 8-week flush). */
  expiresAt: McsIsoTimestamp;
  lastLoginAt: McsIsoTimestamp | null;
}

/**
 * Magic-link row. One per /p/login/start hit per matched account.
 * The linkToken is the credential â€” knowledge of it grants a session.
 * 15-minute TTL, single-use (redeemedAt stamped on redeem).
 */
export interface McsProspectMagicLinkRecord {
  linkToken: string;
  accountId: string;
  /** Carried for fast redirect after redeem. */
  tokenId: string;
  issuedAt: McsIsoTimestamp;
  /** issuedAt + 15min. */
  expiresAt: McsIsoTimestamp;
  redeemedAt: McsIsoTimestamp | null;
  /** SHA-256 of the requesting phone â€” supports rate-limit audit without storing raw phones twice. */
  requestPhoneHash: string;
}

/**
 * Request body for POST /api/p/login/start.
 * Phone is required and is the only field.
 */
export interface McsProspectLoginStartPayload {
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
export interface McsProspectLoginStartResponse {
  ok: true;
}

/**
 * Request body for POST /api/p/login/redeem.
 */
export interface McsProspectLoginRedeemPayload {
  linkToken: string;
}

/**
 * Response from POST /api/p/login/redeem on success. The client
 * redirects to /p/{tokenId} after this lands. The server sets the
 * mcs_prospect_session cookie (scoped to .teammagnificent.com) in
 * the same response â€” the body just confirms the target.
 */
export interface McsProspectLoginRedeemResponse {
  ok: true;
  tokenId: string;
}

/**
 * Failure response from /redeem. The client renders one view for
 * both error shapes â€” "this link has expired or already been used"
 * â€” to avoid leaking which case occurred.
 */
export interface McsProspectLoginRedeemError {
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
export type McsAuditActorRole = 'admin' | 'ba' | 'system' | 'prospect' | 'anonymous';

/**
 * Discriminated actor. The kind aligns with `AuditActorRole`. For
 * 'system' the label names the cron / boot routine (e.g. 'lazy-flush',
 * 'webinar-seeder'). For 'anonymous' the actor is unidentifiable â€”
 * used for /admin-gate denials and unauthenticated probes.
 */
export type McsAuditActor =
  | { kind: 'admin'; tmagId: string; displayName: string }
  | { kind: 'ba'; tmagId: string; displayName: string }
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
export type McsAuditEntityKind =
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

export interface McsAuditEntity {
  kind: McsAuditEntityKind;
  id: string;
  displayLabel: string | null;
}

/**
 * Severity drives row treatment in the admin view and feeds the
 * Core Dashboard's "needs Kevin" widget. 'critical' is reserved for
 * sponsor overrides, compliance violations, and admin-gate breaches.
 */
export type McsAuditSeverity = 'info' | 'warn' | 'critical';

/**
 * Optional request-trace context. Captured for every /admin request
 * and every API mutation; omitted for system-internal events that
 * have no HTTP envelope (cron jobs, boot routines).
 */
export interface McsAuditContext {
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
export interface McsAuditLogEntry {
  entryId: string;
  timestamp: McsIsoTimestamp;
  createdAt: McsIsoTimestamp;
  role: McsAuditActorRole;
  actor: McsAuditActor;
  action: string;
  entity: McsAuditEntity;
  severity: McsAuditSeverity;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  reason: string | null;
  context: McsAuditContext | null;
  linkedTranscriptId: string | null;
}

/**
 * Input shape for `appendAuditEntry`. The domain layer stamps
 * `entryId` and `createdAt`; everything else comes from the caller.
 * `timestamp` defaults to now on the server if the caller omits it.
 */
export interface McsAppendAuditEntryInput {
  timestamp?: McsIsoTimestamp;
  actor: McsAuditActor;
  action: string;
  entity: McsAuditEntity;
  severity?: McsAuditSeverity;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  context?: McsAuditContext | null;
  linkedTranscriptId?: string | null;
}

/**
 * Query params for GET /api/admin/audit. All filters are optional
 * and AND together. Cursor pagination is descending by `(timestamp,
 * entryId)` â€” newest first â€” because the most useful read is "what
 * just happened?". Cursor is the last entry's `entryId` from the
 * previous page; pass it back as `before` to fetch the next page.
 */
export interface McsAuditQueryFilters {
  actorTmagId?: string;
  role?: McsAuditActorRole;
  action?: string;
  actionPrefix?: string;
  entityKind?: McsAuditEntityKind;
  entityId?: string;
  severity?: McsAuditSeverity;
  /** ISO timestamp â€” inclusive lower bound on entry.timestamp. */
  from?: McsIsoTimestamp;
  /** ISO timestamp â€” exclusive upper bound on entry.timestamp. */
  to?: McsIsoTimestamp;
  /** Pagination cursor: entryId from the previous page. */
  before?: string;
  /** Page size, clamped server-side. */
  limit?: number;
}

/**
 * Response from GET /api/admin/audit. Reverse-chronological. Cursor
 * is null when the page is the last page.
 */
export interface McsAuditListResponse {
  ok: true;
  entries: McsAuditLogEntry[];
  nextCursor: string | null;
  appliedFilters: McsAuditQueryFilters;
}

/**
 * Response from GET /api/admin/audit/:entryId. 404 if not found.
 */
export interface McsAuditEntryResponse {
  ok: true;
  entry: McsAuditLogEntry;
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
export type McsIvoryCategory =
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
export type McsIvoryStatus =
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
export type McsIvoryAngle =
  | 'do_the_business'
  | 'make_money'
  | 'lose_fat'
  | 'unspecified';

/**
 * The Ivory roster record. One per (tmagId, person). BA-private â€” never
 * surfaced cross-BA. lastInitial is derived from lastName at write time so
 * a partial display ("Marcus L.") is cheap; full lastName stays on the
 * record for the BA's own reference.
 */
export interface McsIvoryName {
  ivoryId: string;
  tmagId: string;
  firstName: string;
  lastName: string;
  lastInitial: string;
  notes: string;
  categories: McsIvoryCategory[];
  preferredAngle: McsIvoryAngle;
  status: McsIvoryStatus;
  /** prospectId of the most recent invite for this name, if any. */
  lastProspectId: string | null;
  /** ISO timestamp of any status/edit change â€” sort key for the roster view. */
  lastTouchedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** POST /api/ivory request body. */
export interface McsCreateIvoryNamePayload {
  firstName: string;
  lastName: string;
  notes?: string;
  categories?: McsIvoryCategory[];
  preferredAngle?: McsIvoryAngle;
}

/** PATCH /api/ivory/:ivoryId request body. */
export interface McsUpdateIvoryNamePayload {
  firstName?: string;
  lastName?: string;
  notes?: string;
  categories?: McsIvoryCategory[];
  preferredAngle?: McsIvoryAngle;
}

/** PATCH /api/ivory/:ivoryId/status request body. */
export interface McsUpdateIvoryStatusPayload {
  status: McsIvoryStatus;
}

/** GET /api/ivory 200 response. */
export interface McsListIvoryNamesResponse {
  ok: true;
  names: McsIvoryName[];
}

/** Single-record success response shared by POST/PATCH/DELETE. */
export interface McsIvoryNameResponse {
  ok: true;
  name: McsIvoryName;
}

/**
 * POST /api/ivory/coach request body. The coach surfaces WDYK PROMPTS the
 * BA reflects on to recall names from their own memory. It never names
 * specific people, never scores anyone, never speaks comp/income/medical.
 */
export interface McsIvoryCoachPayload {
  angle: McsIvoryAngle;
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
export interface McsIvoryCoachResponse {
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
export interface McsIvoryInvitationDraftPayload {
  ivoryId: string;
  relationshipReason: string;
  productName?: string | null;
}

export interface McsIvoryInvitationDraftResponse {
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
export interface McsIvoryInvitationMintPayload {
  ivoryId: string;
  relationshipReason: string;
  message: string;
  city: string;
  stateOrRegion: string;
  phone: string;
  email?: string | null;
}

export interface McsIvoryInvitationMintResponse {
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
export interface McsGeneratorRun {
  runId: string;
  tmagId: string;
  productKey: string;
  productName: string;
  angle: McsIvoryAngle;
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
export interface McsCreateGeneratorRunPayload {
  productKey: string;
  angle: McsIvoryAngle;
  /** Optional pre-selection â€” the BA can multi-select before pressing Start. */
  selectedIvoryIds?: string[];
}

/** POST /api/ivory/generator/run 200 response. */
export interface McsCreateGeneratorRunResponse {
  ok: true;
  run: McsGeneratorRun;
}

/** GET /api/ivory/generator/run/:runId 200 response. */
export interface McsGeneratorRunResponse {
  ok: true;
  run: McsGeneratorRun;
}

/**
 * POST /api/ivory/generator/run/:runId/invite request body.
 *
 * One name at a time. The server mints a fresh /p/{token} via the existing
 * createInvitation, marks the Ivory name as status='invited', and appends
 * to the run's invitations[]. The BA copies the link and texts it from
 * their own phone â€” the spine never auto-sends (locked-spec 1.13 / 3.6).
 */
export interface McsGeneratorInvitePayload {
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
export interface McsGeneratorInviteResponse {
  ok: true;
  run: McsGeneratorRun;
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
 * authed session BA's tmagId and every read/write filters on it. A note,
 * follow-up, or disposition belongs to ONE (prospect, BA) pair â€” if two
 * BAs ever shared a prospect (today they can't), each would have their own
 * private CRM.
 *
 * Compliance (locked-spec 3.10): BA-facing surface only. Notes and tags are
 * never rendered on .com. Today's Actions list is operational ("Sarah asked
 * for a callback") and carries no income/placement language.
 */

/** The ONE canonical prospect disposition (snake_case; unifies the former
 * CrmDisposition + CrmDisposition — F2/F3). */
export type McsCrmDisposition =
  | 'new_brand_ambassador'
  | 'new_customer'
  | 'interested'
  | 'not_interested'
  | 'later'
  | 'no_response'
  | 'wrong_number'
  | 'do_not_contact';

/** The core dispositions in BA-action-priority order (for UI rendering). */
export const MCS_CRM_DISPOSITIONS: readonly McsCrmDisposition[] = [
  'new_brand_ambassador',
  'new_customer',
  'interested',
  'later',
  'not_interested',
] as const;

/**
 * A BA-private timestamped note about a prospect. Append-only â€” notes are
 * never edited or deleted, so the cockpit can show the BA their evolving
 * thinking. One prospect can carry many notes; the cockpit renders them
 * newest-first.
 */
export interface McsCrmNoteRecord {
  noteId: string;
  prospectId: string;
  sponsorTmagId: string;
  text: string;
  createdAt: McsIsoTimestamp;
}

/**
 * One follow-up reminder per (prospect, BA). Setting a new follow-up
 * replaces the previous one (latest wins). Clearing sets clearedAt â€” the
 * record stays for audit, but Today's Actions filters it out.
 */
export interface McsCrmFollowUpRecord {
  prospectId: string;
  sponsorTmagId: string;
  dueAt: McsIsoTimestamp;
  createdAt: McsIsoTimestamp;
  clearedAt: McsIsoTimestamp | null;
}

/**
 * Current disposition tag for a (prospect, BA). Only the latest value
 * matters; the cockpit shows one pill. Stored as its own record so a future
 * surface can audit the change history without us editing the prospect doc.
 */
export interface McsCrmDispositionRecord {
  prospectId: string;
  sponsorTmagId: string;
  disposition: McsCrmDisposition;
  updatedAt: McsIsoTimestamp;
}

/** POST /api/crm/:prospectId/notes â€” append a note. */
export interface McsCreateNotePayload {
  text: string;
}

export interface McsCreateNoteResponse {
  ok: true;
  note: McsCrmNoteRecord;
}

/** POST /api/crm/:prospectId/followup â€” set or replace the active follow-up. */
export interface McsSetFollowUpPayload {
  /** ISO timestamp. Must be in the future. */
  dueAt: McsIsoTimestamp;
}

export interface McsSetFollowUpResponse {
  ok: true;
  followUp: McsCrmFollowUpRecord;
}

/** DELETE /api/crm/:prospectId/followup â€” clear the active follow-up. */
export interface McsClearFollowUpResponse {
  ok: true;
}

/**
 * POST /api/crm/:prospectId/disposition â€” set or clear the disposition.
 * `null` clears the tag (prospect has no current disposition).
 */
export interface McsSetDispositionPayload {
  disposition: McsCrmDisposition | null;
}

export interface McsSetDispositionResponse {
  ok: true;
  disposition: McsCrmDisposition | null;
}

/**
 * Per-prospect CRM bundle returned by GET /api/crm/:prospectId. Loaded
 * lazily when the BA expands an invite row â€” keeps the initial cockpit
 * fetch fast.
 *
 * `reinviteAvailableAt` is null when the BA can re-invite right now. When
 * non-null, the cockpit disables the button and renders "available {at}".
 */
export interface McsProspectCrmBundle {
  prospectId: string;
  notes: McsCrmNoteRecord[];
  followUp: McsCrmFollowUpRecord | null;
  disposition: McsCrmDisposition | null;
  reinviteAvailableAt: McsIsoTimestamp | null;
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

export interface McsCrmBundleResponse {
  ok: true;
  bundle: McsProspectCrmBundle;
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
export type McsTodayActionKind = 'callback' | 'followup' | 'draft';

export interface McsTodayActionItem {
  kind: McsTodayActionKind;
  prospectId: string;
  firstName: string;
  lastInitial: string;
  at: McsIsoTimestamp;
  /** Set when kind = 'callback'; null otherwise. */
  intent: McsCallbackIntent | null;
  /** Set when kind = 'followup'; null otherwise. */
  followUpDueAt: McsIsoTimestamp | null;
}

export interface McsTodaysActionsResponse {
  ok: true;
  actions: McsTodayActionItem[];
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
export interface McsReinviteResponse {
  ok: true;
  prospectId: string;
  token: string;
  inviteUrl: string;
  sentAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp;
  /** True when a fresh token was minted (the previous one had expired). */
  fresh: boolean;
}

export interface McsReinviteCooldownError {
  ok: false;
  error: 'cooldown';
  /** Timestamp the BA can next re-invite this prospect. */
  availableAt: McsIsoTimestamp;
}

export interface McsReinviteUnsentError {
  ok: false;
  /** The prospect has never been marked sent â€” use "I sent this" instead. */
  error: 'not_yet_sent';
}

export interface McsReinviteTerminalError {
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
 * with the authed session tmagId; nothing in a request body can write to
 * a different BA's progress.
 *
 * Completion: all 5 modules `completed` AND >= 1 invitation sent
 * (cross-checked against the spine's sentAt field at read time â€”
 * progress doesn't store its own invitation count).
 */

/** Module identifier â€” a stable integer 1..5 per locked TASK ordering. */
export type McsFastStartModuleId = 1 | 2 | 3 | 4 | 5;

/** Per-module lifecycle. Sequential in the UI, not hard-gated. */
export type McsFastStartModuleState =
  | 'not_started'
  | 'in_progress'
  | 'completed';

/**
 * Stored progress record. One row per (tmagId, moduleId). The triple-stack
 * write inserts on first touch and updates state thereafter â€” domain
 * branches on existence per the PERSISTENCE upsert quirk.
 */
export interface McsFastStartProgressRecord {
  /** Composite id `${tmagId}__${moduleId}` for idempotent triple-stack writes. */
  _id: string;
  tmagId: string;
  moduleId: McsFastStartModuleId;
  state: McsFastStartModuleState;
  startedAt: McsIsoTimestamp | null;
  completedAt: McsIsoTimestamp | null;
  /** Updated on every state transition. */
  updatedAt: McsIsoTimestamp;
  createdAt: McsIsoTimestamp;
}

/**
 * One module's status as the hub displays it. The eyebrow/title/slug
 * are *not* stored â€” they're constants attached client-side and on the
 * server from FAST_START_MODULES below. Only the lifecycle fields come
 * from persistence.
 */
export interface McsFastStartModuleStatus {
  moduleId: McsFastStartModuleId;
  state: McsFastStartModuleState;
  startedAt: McsIsoTimestamp | null;
  completedAt: McsIsoTimestamp | null;
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
export interface McsFastStartProgressResponse {
  ok: true;
  modules: McsFastStartModuleStatus[];
  invitationsSent: number;
  complete: boolean;
}

/**
 * POST /api/training/fast-start/modules/:id/state request body.
 * Transitions are forward-only (not_started â†’ in_progress â†’ completed);
 * the server rejects backward writes idempotently with the current state.
 */
export interface McsFastStartMarkStatePayload {
  state: Exclude<McsFastStartModuleState, 'not_started'>;
}

/** POST response â€” echoes the resulting status the hub re-renders against. */
export interface McsFastStartMarkStateResponse {
  ok: true;
  moduleId: McsFastStartModuleId;
  state: McsFastStartModuleState;
  startedAt: McsIsoTimestamp | null;
  completedAt: McsIsoTimestamp | null;
}

/**
 * Static module metadata. Lives in @momentum/shared so both server
 * (validation, the route's :id parser) and client (hub render) read
 * one source. Slug drives the client URL: /training/fast-start/{slug}.
 * Order is fixed and load-bearing â€” never reorder; append-only if a
 * Module 6 ever ships (the wireframe currently stops at 5).
 */
export const MCS_FAST_START_MODULES: readonly {
  id: McsFastStartModuleId;
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
export interface McsBANotifChannelMix {
  sms: boolean;
  email: boolean;
  inApp: boolean;
}

export interface McsBANotifPrefs {
  callbackRequested: McsBANotifChannelMix;
  webinarReserved: McsBANotifChannelMix;
  newSponsoredBA: McsBANotifChannelMix;
  steveDiscoveryComplete: McsBANotifChannelMix;
  poolMovement: McsBANotifChannelMix;
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
export const MCS_BA_NOTIF_DEFAULTS: McsBANotifPrefs = {
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
 * Sponsor + threeBaId + tmagId + accessCodeHeld are READ-ONLY (locked-spec
 * 3.5 / 2.3) and the PATCH surface intentionally omits them. The read shape
 * carries them so the page can render the read-only card without a second
 * fetch.
 */
export interface TmagProfile {
  // Editable (wf_0071)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  timezone: string;
  photoUrl: string | null;
  notifPrefs: McsBANotifPrefs;
  entitlements: string[];

  // Read-only (wf_0072)
  tmagId: string;
  threeBaId: string;
  /** The BA's own TMAG-XXXX code (one per BA for life — 2.3). null if Kevin hasn't issued one yet. */
  accessCodeHeld: string | null;
  sponsor: {
    tmagId: string;
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
 * /api/profile/password. None of {sponsor, tmagId, threeBaId,
 * accessCodeHeld} appear here by design.
 */
export interface TmagProfilePatch {
  firstName?: string;
  lastName?: string;
  timezone?: string;
  photoUrl?: string | null;
  notifPrefs?: Partial<McsBANotifPrefs>;
}

/** GET /api/profile envelope. */
export interface McsProfileGetResponse {
  ok: true;
  profile: TmagProfile;
}

/** Generic mutation envelope used by every /profile mutation route. */
export type McsProfileMutationResponse =
  | { ok: true }
  | { ok: false; error: string };

/** POST /api/profile/password body — argon2id rehash on success. */
export interface McsProfilePasswordBody {
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
export interface McsProfileEmailStartBody {
  newEmail: string;
}
export interface McsProfileEmailVerifyBody {
  code: string;
}

/**
 * Phone re-verify (start) — J.8 conservative default: SMS code mirroring
 * email re-verify (flagged in Chat #134 heartbeat; Kevin may prefer
 * immediate effect). The server sends a 6-digit code to the NEW number
 * via Telnyx SMS. Pending phone is not written to the BA record until
 * /verify succeeds.
 */
export interface McsProfilePhoneStartBody {
  newPhone: string;
}
export interface McsProfilePhoneVerifyBody {
  code: string;
}

/**
 * Persisted challenge row shape — one collection per channel
 * (`email_change_challenges`, `phone_change_challenges`). 6-digit numeric
 * code, 15-minute TTL, single-use.
 */
export interface McsProfileChangeChallengeRecord {
  challengeId: string;
  tmagId: string;
  channel: 'email' | 'phone';
  /** Target address/number the code was dispatched to. */
  target: string;
  /** SHA-256 of the code — never store the raw code. */
  codeHash: string;
  issuedAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp;
  redeemedAt: McsIsoTimestamp | null;
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
export type McsMichaelInterviewPhase =
  | 'awaiting_call'      // wf_0038 — scheduled, before/at slot, gold pill
  | 'call_in_progress'   // wf_0039 — call.answered fired, teal pill, live transcript
  | 'complete'           // wf_0040 — call.hangup after answered, gold check
  | 'no_answer'          // wf_0041 — missed: no-answer / busy / declined
  | 'invalid_number'     // wf_0041 — Telnyx flagged invalid destination
  | 'stt_failed';        // wf_0041 — call completed but transcript ingest failed

/** One speaker turn (or partial turn) in the live transcript. Append-only. */
export interface McsMichaelTranscriptChunk {
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
export interface McsMichaelInterviewAnswer {
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
export interface McsMichaelScoringSummary {
  /** Coarse overall read. null = not enough signal. */
  overallTone: 'positive' | 'neutral' | 'guarded' | null;
  /** Highlight tags the sponsor should know first (3–5 entries typical). */
  highlightTags: string[];
  /** Provenance string surfaced on the card. Pinned literal to keep audit clean. */
  signedBy: string;
}

/** Authoritative completed-interview record. Triple-stacked at ingest.
 *  sponsorTmagId is stamped server-side from the BA record — NEVER from the
 *  scoring worker payload (locked-spec 3.5). */
export interface McsMichaelInterviewArtifact {
  tmagId: string;
  /** Stamped server-side from team_magnificent_members.sponsorTmagId at ingest. Immutable. */
  sponsorTmagId: string | null;
  callSid: string | null;
  startedAt: string | null;
  completedAt: string | null;
  transcript: McsMichaelTranscriptChunk[];
  answers: McsMichaelInterviewAnswer[];
  scoring: McsMichaelScoringSummary;
  /** Optional pointer to call recording (Telnyx storage URL). */
  audioUrl: string | null;
}

/** LEGACY — retired Michael interview view.
 *  Michael no longer schedules or interviews; no active route serves this. */
export interface McsMichaelInterviewView {
  tmagId: string;
  phase: McsMichaelInterviewPhase;
  /** ISO slot start, BA's local TZ for rendering applied client-side. */
  scheduledFor: string | null;
  timezone: string | null;
  call: {
    startedAt: string | null;
    sid: string | null;
  };
  /** Hydration snapshot for SSE — chunks already received. The stream pushes
   *  only NEW chunks after the connection opens. */
  transcript: McsMichaelTranscriptChunk[];
  /** Present only when phase === 'complete'. */
  artifact: McsMichaelInterviewArtifact | null;
  /** Whether the BA flagged "wrong number — this isn't me" from wf_0038.
   *  Server records the flag and Kevin's admin surface picks it up; the BA
   *  just sees a "we've been notified" confirmation. */
  wrongNumberFlaggedAt: string | null;
}

/** LEGACY — retired Michael transcript SSE event envelope. */
export type McsMichaelInterviewSseEvent =
  | { type: 'snapshot'; chunks: McsMichaelTranscriptChunk[]; phase: McsMichaelInterviewPhase }
  | { type: 'chunk'; chunk: McsMichaelTranscriptChunk }
  | { type: 'phase'; phase: McsMichaelInterviewPhase }
  | { type: 'heartbeat' };

/** LEGACY — retired sponsor-only Michael interview card data. */
export interface McsMichaelCockpitCardData {
  /** The downline BA the card is about. */
  downlineTmagId: string;
  /** First name only — keeps the card scannable and consistent with locked-spec
   *  3.6 (BA-to-BA off-app norms). */
  downlineFirstName: string;
  /** ISO completion time, sponsor's timezone applied client-side. */
  completedAt: string;
  /** All five (or however many) answers, rendered as a sponsor-readable list. */
  answers: McsMichaelInterviewAnswer[];
  /** Aggregate read for the sponsor's lead-with-context move. */
  scoring: McsMichaelScoringSummary;
  /** Optional audio link (Telnyx recording URL or short-lived signed URL). */
  audioUrl: string | null;
  /** Provenance literal — kept verbatim from the artifact. */
  signedBy: string;
}

/** LEGACY — retired Michael worker scoring payload. */
export interface McsMichaelScoringIngestPayload {
  tmagId: string;
  callSid: string;
  startedAt: string;
  completedAt: string;
  transcript: McsMichaelTranscriptChunk[];
  answers: McsMichaelInterviewAnswer[];
  scoring: McsMichaelScoringSummary;
  audioUrl: string | null;
}

/** LEGACY — retired Michael transcript chunk ingest payload. */
export interface McsMichaelTranscriptChunkIngestPayload {
  callSid: string;
  chunk: Omit<McsMichaelTranscriptChunk, 'sequence'>;
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
 * Personally-enrolled is computable here (count of BAs in team_magnificent_members
 * with sponsorTmagId = candidate.tmagId). Binary qualification lives upstream
 * in THREE and is not mirrored locally yet. Until it is, the system-detected
 * leader set is empty — the dashboard surfaces this honestly via
 * `leaderDetectionNote`. A Kevin-curated set will arrive with wireframe
 * 4.C's leader-tag toggle.
 */

/** Top-row tile identifier. Drives drilldown routing and SSE highlighting. */
export type McsAdminDashboardTile =
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
export interface McsAdminDashboardFilter {
  /** Restrict to one BA's slice (their prospects, their training, etc.). */
  tmagId: string | null;
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
export interface McsAdminDashboardMetrics {
  /** count(team_magnificent_members WHERE lastLoginAt >= now-24h), filter-scoped. */
  activeBaCount: number;
  /** count(team_magnificent_members), filter-scoped. The denominator for activity. */
  totalBaCount: number;
  /**
   * count(pool_placements WHERE flushedAt IS NULL), filter-scoped by
   * sponsorTmagId when the filter narrows to a BA / leader group.
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
  computedAt: McsIsoTimestamp;
}

/** GET /api/admin/dashboard/metrics?tmagId=&leaderGroup= response. */
export interface McsAdminDashboardMetricsResponse {
  ok: true;
  metrics: McsAdminDashboardMetrics;
  appliedFilter: McsAdminDashboardFilter;
  /**
   * Honest note about the leader detection gap (binary qualification not
   * mirrored locally). Rendered in the filter bar so Kevin always knows
   * what 'leaders_only' currently means.
   */
  leaderDetectionNote: string;
}

/** One BA, for the filter-bar dropdown. */
export interface McsAdminBaFilterOption {
  tmagId: string;
  fullName: string;
  /** True if this BA is in the current leader set (curated ∪ system). */
  isLeader: boolean;
}

/** One leader-group option with its current count. */
export interface McsAdminLeaderGroupOption {
  value: McsAdminDashboardFilter['leaderGroup'];
  label: string;
  count: number;
}

/** GET /api/admin/dashboard/filters response — populates the filter bar. */
export interface McsAdminDashboardFiltersResponse {
  ok: true;
  bas: McsAdminBaFilterOption[];
  leaderGroups: McsAdminLeaderGroupOption[];
  /** Same honest note as on metrics — duplicated so the filter bar can render it standalone. */
  leaderDetectionNote: string;
}

/* Drilldown rows — one shape per tile (wf_0078). */

export interface McsAdminActiveBaRow {
  tmagId: string;
  fullName: string;
  lastLoginAt: McsIsoTimestamp;
  prospectsInFlow: number;
}

export interface McsAdminProspectInFlowRow {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  state: McsTokenState;
  positionNumber: number | null;
  sponsorTmagId: string;
  sponsorName: string;
  placedAt: McsIsoTimestamp | null;
  expiresAt: McsIsoTimestamp;
}

export interface McsAdminQueueMovementRow {
  kind: 'placement' | 'flush';
  prospectId: string;
  firstName: string;
  lastInitial: string;
  positionNumber: number;
  sponsorTmagId: string;
  sponsorName: string;
  at: McsIsoTimestamp;
  /** 'enrolled' | 'expired' | 'archived' on flush; null on placement. */
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
}

export interface McsAdminEnrollmentRow {
  prospectId: string;
  firstName: string;
  lastInitial: string;
  positionNumber: number;
  sponsorTmagId: string;
  sponsorName: string;
  enrolledAt: McsIsoTimestamp;
}

export interface McsAdminTrainingRow {
  tmagId: string;
  fullName: string;
  /** Count of modules in `completed` state, 0..5. */
  modulesCompleted: number;
  /** Whether (modulesCompleted === 5). */
  fastStartComplete: boolean;
  /** Most recent touch across any Fast Start module; null if untouched. */
  lastTouchedAt: McsIsoTimestamp | null;
}

export type McsAdminDrilldownPayload =
  | { tile: 'active_bas'; rows: McsAdminActiveBaRow[] }
  | { tile: 'prospects_in_flow'; rows: McsAdminProspectInFlowRow[] }
  | { tile: 'queue_movement'; rows: McsAdminQueueMovementRow[] }
  | { tile: 'enrollments'; rows: McsAdminEnrollmentRow[] }
  | { tile: 'training'; rows: McsAdminTrainingRow[] };

/** GET /api/admin/dashboard/drilldown?tile=&tmagId=&leaderGroup= response. */
export interface McsAdminDrilldownResponse {
  ok: true;
  payload: McsAdminDrilldownPayload;
  appliedFilter: McsAdminDashboardFilter;
  computedAt: McsIsoTimestamp;
}

/* Live event stream (wf_0080). */

/** Common event metadata across live-stream events. */
export interface McsAdminLiveEventBase {
  /** Globally-unique id used as the SSE `id:` field for resumability. */
  eventId: string;
  /** ISO timestamp the event was emitted. */
  at: McsIsoTimestamp;
}

/** Live placement event — fans out from poolEvents.subscribePlacements. */
export interface McsAdminLivePlacementEvent extends McsAdminLiveEventBase {
  kind: 'placement';
  positionNumber: number;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
}

/** Live audit-log entry — surfaced from poll-based tail of audit_log. */
export interface McsAdminLiveAuditEvent extends McsAdminLiveEventBase {
  kind: 'audit_entry';
  action: string;
  role: McsAuditActorRole;
  actorLabel: string;
  entityLabel: string;
  severity: McsAuditSeverity;
}

export type McsAdminLiveEvent = McsAdminLivePlacementEvent | McsAdminLiveAuditEvent;

/**
 * Initial SSE snapshot — sent once on connect with the most-recent events
 * so the stream renders populated immediately rather than waiting for the
 * next live event.
 */
export interface McsAdminLiveSnapshot {
  events: McsAdminLiveEvent[];
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
export type McsCockpitActionKind = 'callback' | 'followup' | 'expiring';

/**
 * One item on the cockpit's Today's Actions card. Discriminated by `kind`
 * so each branch carries only the fields it actually has — a callback
 * has an intent; a followup has a dueAt; an expiring window has an
 * expiresAt. `at` is the timestamp the cockpit sorts on inside a tier
 * (callback.createdAt, followup.dueAt, prospect.expiresAt).
 */
export type McsCockpitActionItem =
  | {
      kind: 'callback';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: McsIsoTimestamp;
      intent: McsCallbackIntent | null;
    }
  | {
      kind: 'followup';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: McsIsoTimestamp;
      followUpDueAt: McsIsoTimestamp;
    }
  | {
      kind: 'expiring';
      prospectId: string;
      firstName: string;
      lastInitial: string;
      at: McsIsoTimestamp;
      expiresAt: McsIsoTimestamp;
    };

/**
 * Response from GET /api/cockpit/todays-actions. `actions` is the urgency-
 * ordered list (callbacks first, then due follow-ups, then expiring
 * windows). `biasPrompt` is the copy the empty state renders — server-
 * supplied so locked-spec 1.9 wording lives in one place.
 */
export interface McsCockpitTodaysActionsResponse {
  ok: true;
  actions: McsCockpitActionItem[];
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
 * `PREVIEW-<tmagId>` that no real invite token will ever match (real
 * tokens are 12 chars from a 31-char alphabet excluding 0/1/I/O/L;
 * this sentinel is upper+digit+dash, prefixed `PREVIEW-`, and longer
 * than 12). Any downstream /api/p/<sentinel>/* call from the .com
 * components 404s silently — which is the design: a preview must
 * consume zero real state. The `preview: true` flag lets the
 * preview shell or any consumer that needs to distinguish do so
 * without parsing the token format.
 */
export interface McsPreviewResolvedTokenPayload extends McsResolvedTokenPayload {
  preview: true;
}

/* ─────────────────────────────────────────────────────────────────
 * #135 Admin BA Oversight — wireframe 4.C, locked-spec 4.C (Sec C)
 * ─────────────────────────────────────────────────────────────────
 *
 * The Kevin-only Brand Ambassador directory + per-BA profile drawer +
 * sponsor override flow. Server reads aggregate from team_magnificent_members +
 * tmag_access_codes + tmag_commitments + invite_tokens + crm_followups +
 * fast_start_progress + tmag_steve_success_interview; writes (override / leader
 * tag / notes) each append a 4.J audit entry.
 *
 * Compliance discipline (Chat #89):
 *   - No algorithmic flagging. Every directory column is a raw count or
 *     a raw timestamp; the UI never compares them to a threshold and
 *     emits a judgment. Kevin reads the numbers.
 *   - THREE is the upstream authority. The sponsor override
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
export interface McsAdminBaDirectoryRow {
  tmagId: string;
  threeBaId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  /** TMAG-XXXX code this BA owns (one per BA for life, 2.3). Null if Kevin hasn't issued one. */
  accessCodeOwned: string | null;
  /** Current sponsor (post-override if one was applied; otherwise the original). */
  sponsorTmagId: string | null;
  sponsorName: string | null;
  /** Original sponsor at signup — present ONLY when a C.5 override changed it. */
  originalSponsorTmagId: string | null;
  originalSponsorName: string | null;
  /** Signed-up timestamp. */
  joinedAt: McsIsoTimestamp;
  /** When the BA accepted the welcome commitment (J.3). Null = not yet. */
  welcomeAcceptedAt: McsIsoTimestamp | null;
  /** Most recent login. Null = never. */
  lastLoginAt: McsIsoTimestamp | null;
  /** Trailing 72h personal-invite count (C.2). */
  twoInSeventyTwoCount: number;
  /** Start of the rolling 72h window — for hover tooltip. */
  twoInSeventyTwoWindowStart: McsIsoTimestamp;
  /** 0..100 integer (C.3). Computed from filled profile fields. */
  profileCompletenessPct: number;
  /** Lifetime invite-token count for this BA. */
  personalInvitesCount: number;
  /** Oldest open (not-cleared) follow-up dueAt across this BA's prospects. Null = none open. */
  oldestOpenFollowUpDueAt: McsIsoTimestamp | null;
  /** Fast Start modules completed (0..5). */
  trainingModulesCompleted: number;
  /** True when all five modules done. */
  trainingComplete: boolean;
  /** Operational status. 'active'/'inactive' derive from lastLoginAt; 'suspended' is a future flag. */
  status: 'active' | 'inactive' | 'suspended';
  /** Max of lastLoginAt / welcomeAcceptedAt. */
  lastActivityAt: McsIsoTimestamp | null;
  /** System-detected leader badge (currently always false — see leaderDetectionNote). */
  systemDetectedLeader: boolean;
  /** Kevin-curated leader badge (admin toggle on row + profile drawer). */
  curatedLeader: boolean;
  /** Explicit feature entitlements granted by Kevin/admin. */
  entitlements: string[];
  /** Soft-delete lifecycle (Chat #138/#141), distinct from `status`
   *  'suspended'. True when removed from the roster (reversible). */
  deleted: boolean;
}

export interface McsAdminBaDirectoryResponse {
  ok: true;
  count: number;
  rows: McsAdminBaDirectoryRow[];
  /** Honest disclosure — binary qualification not mirrored locally yet. */
  leaderDetectionNote: string;
}

/** One sponsor-override entry on a BA's history. Append-only. */
export interface McsAdminSponsorOverrideEntry {
  overrideId: string;
  tmagId: string;
  previousSponsorTmagId: string;
  newSponsorTmagId: string;
  requestingTmagId: string;
  reason: string;
  performedByTmagId: string;
  performedAt: McsIsoTimestamp;
  /** entryId from the 4.J audit substrate this override wrote to. */
  auditEntryId: string;
}

/** Kevin-only note about a BA, append-only. */
export interface McsAdminBaNoteEntry {
  noteId: string;
  tmagId: string;
  text: string;
  authorTmagId: string;
  createdAt: McsIsoTimestamp;
}

/** Full BA profile bundle for the slide-out drawer (C.4). */
export interface McsAdminBaProfileBundle {
  row: McsAdminBaDirectoryRow;
  sponsorOverrideHistory: McsAdminSponsorOverrideEntry[];
  notes: McsAdminBaNoteEntry[];
}

export interface McsAdminBaProfileResponse {
  ok: true;
  profile: McsAdminBaProfileBundle;
}

/** POST /api/admin/bas/:tmagId/sponsor-override body. */
export interface McsAdminSponsorOverridePayload {
  requestingTmagId: string;
  newSponsorTmagId: string;
  reason: string;
}

export interface McsAdminSponsorOverrideResponse {
  ok: true;
  override: McsAdminSponsorOverrideEntry;
  row: McsAdminBaDirectoryRow;
}

/** POST /api/admin/bas/:tmagId/leader-tag body — toggle curated badge. */
export interface McsAdminLeaderTagPayload {
  curated: boolean;
  /** Optional reason — surfaced in the audit entry. */
  reason?: string;
}

export interface McsAdminLeaderTagResponse {
  ok: true;
  tmagId: string;
  curated: boolean;
}

export interface McsAdminBaEntitlementsPayload {
  action: 'grant' | 'revoke';
  entitlement: 'vm_dialer';
}

export interface McsAdminBaEntitlementsResponse {
  ok: true;
  tmagId: string;
  entitlements: string[];
  row: McsAdminBaDirectoryRow | null;
}

/** POST /api/admin/bas/:tmagId/notes body — append a Kevin-only note. */
export interface McsAdminBaNotePayload {
  text: string;
}

export interface McsAdminBaNoteResponse {
  ok: true;
  note: McsAdminBaNoteEntry;
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
 *     requestingTmagId, reason, timestamp.
 *   - Monotonic queue is sacred: flush vacates a slot; move keeps
 *     the same positionNumber, only sponsorTmagId changes.
 *   - Reuses AdminDashboardFilter (B.2) verbatim — narrowing only.
 */

/**
 * D.1 column 10 — the prospect's resolution status (a read-only MIRROR, not a
 * handoff the app manages; THREE owns enrollment). One concept shared with
 * `McsOutcomeKind` (P7.16 §1a). Derived from the pool placement's flush state:
 *   - placement still active (flushedAt=null)             → 'pending'
 *   - flushReason='enrolled'  (enrolled into III = member) → 'enrolled_iii'
 *   - flushReason='expired'                                → 'declined'
 *   - flushReason='archived' (admin-flushed early)         → 'declined'
 * `became_customer` is set from the prospect's `becameCustomer` flag, not the
 * placement.
 */
export type McsProspectStatus =
  | 'pending'
  | 'enrolled_iii'
  | 'became_customer'
  | 'declined';

/**
 * One row in the D.1 directory. The 10 columns the brief enumerates,
 * plus the prospectId for row-click → ?prospectId=<id> deep-link
 * navigation to D.2.
 *
 * Column ordering matches the brief; UI may reorder visually but the
 * server payload is canonical.
 */
export interface McsAdminProspectDirectoryRow {
  prospectId: string;
  /** Column 1: first + last (full name for admin, not first+initial). */
  firstName: string;
  lastName: string;
  /** Column 2: inviting BA — current sponsorTmagId on the prospect record. */
  sponsorTmagId: string;
  sponsorName: string;
  /** Column 3: lifecycle state. 'video_25'/'video_50'/'video_75' map to
   *  TokenState 'video_quarter'/'video_half'/'video_three_quarter'. The
   *  client translates for display; the wire shape stays TokenState +
   *  any non-token signal layered on top. */
  presentationStatus: McsAdminProspectPresentationStatus;
  /** Column 4: monotonic pool position; null pre-placement. */
  positionNumber: number | null;
  /** Column 5: the sponsor-routed URL Kevin can sandbox-preview. */
  prospectUrl: string;
  /** The opaque token the URL resolves; surfaced so the client can
   *  build an admin-preview href without re-parsing the URL. */
  token: string;
  /** Column 6: token mint date. */
  firstContactAt: McsIsoTimestamp;
  /** Column 7: most recent activity (date + event-kind label). */
  mostRecentActivity: {
    at: McsIsoTimestamp;
    eventKind: McsAdminProspectActivityEventKind;
    label: string;
  };
  /** Column 8: days in holding tank since video_complete; null pre-placement. */
  daysInHoldingTank: number | null;
  /** Column 9: surfaced as the date by which follow-up is needed, NEVER
   *  as a boolean system flag. Computed from activity-recency threshold:
   *  most-recent-activity + locked threshold (currently 7 days). Null
   *  when not applicable (enrolled, expired, or no activity yet). */
  followUpNeededBy: McsIsoTimestamp | null;
  /** Column 10: registration handoff state with THREE (derived; see type). */
  prospectStatus: McsProspectStatus;
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
export type McsAdminProspectPresentationStatus =
  | McsTokenState
  | 'callback_requested'
  | 'webinar_reserved';

/**
 * Server response — GET /api/admin/prospects.
 * Filter is reused verbatim from B.2; the client passes tmagId + leaderGroup
 * in the query string. Rows are unsorted at wire level; the client sorts
 * per column-click.
 */
export interface McsAdminProspectDirectoryResponse {
  ok: true;
  rows: McsAdminProspectDirectoryRow[];
  appliedFilter: McsAdminDashboardFilter;
  computedAt: McsIsoTimestamp;
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
export type McsAdminProspectActivityEventKind =
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

export interface McsAdminProspectActivityEvent {
  eventId: string;
  /** When the event happened (wall-clock). */
  at: McsIsoTimestamp;
  kind: McsAdminProspectActivityEventKind;
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
export interface McsAdminProspectKevinNote {
  noteId: string;
  prospectId: string;
  body: string;
  createdAt: McsIsoTimestamp;
  /** The admin who wrote the note (today: Kevin; tomorrow: any /admin BA). */
  createdByTmagId: string;
  createdByDisplayName: string;
}

/**
 * D.2 detail payload — everything the prospect detail panel renders.
 * Identity + activity timeline + token + sponsor drift + (optional)
 * callback/webinar/enrollment details + Kevin notes.
 *
 * Sponsor-drift detector: `sponsorTmagIdAtMint` is the sponsorTmagId stamped
 * on the original invite token at mint time (locked-spec 3.5). It MUST
 * equal `sponsorTmagIdNow` on every prospect unless an admin reassign-
 * sponsor intervention has been applied. When they differ, the detail
 * panel surfaces the discrepancy as a warning row — the drift detector
 * the brief explicitly names.
 */
export interface McsAdminProspectDetail {
  prospectId: string;
  firstName: string;
  lastName: string;
  /** Soft-delete lifecycle (Chat #138/#141). True when removed from the
   *  directory (reversible). The holding-tank position is untouched by
   *  delete; only the flush vacates it. */
  deleted: boolean;
  phone: string | null;
  email: string | null;
  location: McsProspectLocation;
  sponsorTmagIdAtMint: string;
  sponsorTmagIdNow: string;
  sponsorNameNow: string;
  positionNumber: number | null;
  placedAt: McsIsoTimestamp | null;
  state: McsTokenState;
  presentationStatus: McsAdminProspectPresentationStatus;
  prospectStatus: McsProspectStatus;
  /** Token details. `tokenTruncated` is the head of the token for display
   *  (full token never shown — the prospect URL is the sandbox surface). */
  token: {
    tokenTruncated: string;
    prospectUrl: string;
    mintedAt: McsIsoTimestamp;
    expiresAt: McsIsoTimestamp;
    currentState: McsTokenState;
  };
  callback: {
    callbackRequestId: string;
    intent: McsCallbackIntent;
    submittedAt: McsIsoTimestamp;
  } | null;
  webinar: {
    reservationId: string;
    eventId: string;
    scheduledFor: McsIsoTimestamp;
    reservedAt: McsIsoTimestamp;
  } | null;
  enrollment: {
    markedAt: McsIsoTimestamp;
    markedByTmagId: string;
    forceEnrolledByAdmin: boolean;
  } | null;
  activity: McsAdminProspectActivityEvent[];
  kevinNotes: McsAdminProspectKevinNote[];
}

export interface McsAdminProspectDetailResponse {
  ok: true;
  detail: McsAdminProspectDetail;
}

/**
 * Add-note request — POST /api/admin/prospects/:prospectId/notes.
 * Body fields are append-only: there is no edit / delete surface.
 */
export interface McsAdminProspectAddNoteRequest {
  body: string;
}
export interface McsAdminProspectAddNoteResponse {
  ok: true;
  note: McsAdminProspectKevinNote;
}

/* ─── D.4 interventions ─────────────────────────────────────────── */

export type McsAdminProspectInterventionKind =
  | 'move'
  | 'reassign_sponsor'
  | 'manual_flush'
  | 'force_enroll';

/**
 * Shared base for every intervention request. The intervention router
 * branches on the URL path, so `kind` is not in the body — but the
 * common base IS the `requestingTmagId` + `reason` pair. Both required;
 * locked-spec 2.4 calls for `reason` on every critical override.
 */
export interface McsAdminProspectInterventionBase {
  /** The BA who requested the emergency intervention from Kevin. */
  requestingTmagId: string;
  /** Free-text reason in Kevin's words; required, min 8 chars. */
  reason: string;
}

export interface McsAdminProspectMoveRequest extends McsAdminProspectInterventionBase {
  /** The BA the prospect is moved TO (the new inviting BA). */
  toTmagId: string;
}

export interface McsAdminProspectReassignSponsorRequest extends McsAdminProspectInterventionBase {
  /** The BA who becomes the sponsor of record on the prospect. */
  newSponsorTmagId: string;
}

export type McsAdminProspectManualFlushRequest = McsAdminProspectInterventionBase;
export type McsAdminProspectForceEnrollRequest = McsAdminProspectInterventionBase;

/**
 * Every intervention returns the same envelope: the audit entry that
 * was written (so the client can echo it in a toast / confirmation) and
 * the refreshed directory row for this prospect (so the client can
 * patch the table in place without a full directory refetch).
 */
export interface McsAdminProspectInterventionResponse {
  ok: true;
  kind: McsAdminProspectInterventionKind;
  prospectId: string;
  auditEntryId: string;
  refreshedRow: McsAdminProspectDirectoryRow;
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
export type McsQueueVisibleWindow = 5 | 10 | 20;

/** Today's queue movement (E.1). All counts UTC-day-bounded. */
export interface McsQueueDepthMovement {
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
  computedAt: McsIsoTimestamp;
}

/** Monotonic position numbers (E.2). */
export interface McsQueueNumbers {
  /** Max positionNumber minted today (UTC). 0 if no placements yet today. */
  highestToday: number;
  /** Lifetime highest position ever minted (== pool_counters.current). */
  highestEver: number;
  /** Count of flushed placements (their slots are vacant in the visible line). */
  vacantSlots: number;
  computedAt: McsIsoTimestamp;
}

/**
 * Single day in the growth sparkline (E.4). `date` is YYYY-MM-DD UTC.
 * `count` is new placements that day.
 */
export interface McsQueueGrowthBucket {
  date: string;
  count: number;
}

/** E.4 — TM overall growth movement (no comp math, no binary detail). */
export interface McsQueueGrowthSparkline {
  rolling7: number;
  rolling30: number;
  /** Lifetime placements (== pool_counters.current). */
  lifetime: number;
  /** 30 daily buckets oldest→newest. Empty days are zero-filled. */
  daily30: McsQueueGrowthBucket[];
}

/**
 * E.2 position-lookup result. When `found:true`, a prospect record is
 * attached. When `found:false`, the position has been minted (≤ highestEver)
 * but the slot is vacant (flushed) OR the number has not been minted yet.
 */
export interface McsQueueLookupResult {
  position: number;
  found: boolean;
  /** True when the slot was once filled and is now vacant (flushed). */
  vacant: boolean;
  prospect: McsQueueLookupProspect | null;
}

export interface McsQueueLookupProspect {
  prospectId: string;
  firstName: string;
  lastName: string;
  state: McsTokenState;
  placedAt: McsIsoTimestamp;
  sponsorTmagId: string;
  city: string;
  stateOrRegion: string;
  flushedAt: McsIsoTimestamp | null;
  flushReason: 'enrolled' | 'expired' | 'archived' | null;
  /** Cross-section deep-link locked with Agent D: /prospects?prospectId=<id>. */
  deepLink: string;
}

/**
 * E.5 — admin ticker entry. Real names (not initials/anonymized
 * city). Same event source as the .com ticker; the difference is the
 * projection. `deepLink` points to Agent D's D.2 detail panel.
 */
export interface McsAdminTickerEntry {
  positionNumber: number;
  prospectId: string;
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  placedAt: McsIsoTimestamp;
  sponsorTmagId: string;
  deepLink: string;
}

/**
 * E.6 — a managed queue rule. Surface for the resolved 8-week flush
 * window and any other queue knobs Kevin can change. Every change
 * append-only audited (action='admin.queue.rule.changed').
 */
export interface McsQueueRule {
  key: string;
  label: string;
  description: string;
  /** Current value; type depends on the rule (number for flush weeks). */
  currentValue: number | string | boolean;
  defaultValue: number | string | boolean;
  unit: string | null;
  /** Last audited change; null if untouched (still at default). */
  lastChangedAt: McsIsoTimestamp | null;
  lastChangedBy: string | null;
}

/** E.1 + E.2 + E.4 in a single fetch (admin queue page bootstrap). */
export interface McsQueueOversightSummary {
  depthMovement: McsQueueDepthMovement;
  numbers: McsQueueNumbers;
  growth: McsQueueGrowthSparkline;
  visibleWindow: McsQueueVisibleWindow;
  computedAt: McsIsoTimestamp;
}

/* HTTP response envelopes — match the {ok:true, …} shape used by /admin. */

export interface McsQueueOversightSummaryResponse {
  ok: true;
  summary: McsQueueOversightSummary;
}

export interface McsQueueLookupResponse {
  ok: true;
  result: McsQueueLookupResult;
}

export interface McsQueueVisibleWindowResponse {
  ok: true;
  value: McsQueueVisibleWindow;
  defaultValue: McsQueueVisibleWindow;
  lastChangedAt: McsIsoTimestamp | null;
  lastChangedBy: string | null;
}

export interface McsQueueAdminTickerResponse {
  ok: true;
  entries: McsAdminTickerEntry[];
  globalMaxPosition: number;
}

export interface McsQueueRulesResponse {
  ok: true;
  rules: McsQueueRule[];
}

/**
 * SSE wire event for the /api/admin/queue/ticker/stream channel.
 * Mirrors AdminLivePlacementEvent but un-anonymized (carries
 * lastName + prospectId for click-through to D.2).
 */
export interface McsAdminQueueTickerSseEvent {
  kind: 'admin_queue_placement';
  eventId: string;
  at: McsIsoTimestamp;
  positionNumber: number;
  prospectId: string;
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  sponsorTmagId: string;
  deepLink: string;
}

/** Snapshot payload sent at SSE connection open for the admin ticker. */
export interface McsAdminQueueTickerSnapshot {
  globalMaxPosition: number;
  recent: McsAdminTickerEntry[];
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
export interface McsAdminSoftDeleteState {
  deleted: boolean;
  deletedAt: McsIsoTimestamp | null;
  deletedReason: string | null;
  deletedByTmagId: string | null;
  /** Stamped on restore so the audit pair is legible on the record too. */
  restoredAt: McsIsoTimestamp | null;
  restoredByTmagId: string | null;
}

/* ── BA create ──────────────────────────────────────────────────────── */

/**
 * Admin-create a BA. sponsorTmagId is REQUIRED (Chat #138) and is stamped as
 * the original/immutable sponsor from birth — there is no signup
 * transaction to derive it from. No password is set here: an admin-created
 * BA is a roster mirror entry, not a login. (If the person later signs up
 * through the normal access-code flow, that path owns credential creation.)
 */
export interface McsAdminCreateBaPayload {
  firstName: string;
  lastName: string;
  threeBaId: string;
  threeUsername: string;
  sponsorTmagId: string;
  email?: string | null;
  phone?: string | null;
  timezone?: string | null;
  marketRegion?: string | null;
  /** Required paper-trail note (min 8 chars), mirrors override/intervention reason. */
  reason: string;
}

export interface McsAdminCreateBaResponse {
  ok: true;
  tmagId: string;
  row: McsAdminBaDirectoryRow;
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
export interface McsAdminEditBaPayload {
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

export interface McsAdminEditBaResponse {
  ok: true;
  tmagId: string;
  row: McsAdminBaDirectoryRow;
}

/* ── BA / prospect soft-delete + restore (shared shapes) ────────────── */

export interface McsAdminSoftDeletePayload {
  /** Required paper-trail reason (min 8 chars). */
  reason: string;
}

export interface McsAdminRestorePayload {
  reason: string;
}

export interface McsAdminBaDeleteResponse {
  ok: true;
  tmagId: string;
  deletedAt: McsIsoTimestamp;
}

export interface McsAdminBaRestoreResponse {
  ok: true;
  tmagId: string;
  restoredAt: McsIsoTimestamp;
  row: McsAdminBaDirectoryRow;
}

/* ── prospect create ────────────────────────────────────────────────── */

/**
 * Admin-create a prospect. Mirrors the BA invitation-spine mint exactly:
 * a real /p/{token} is minted with sponsor locked at mint, then the
 * prospect is placed in the team-wide holding tank at the NEXT monotonic
 * position (Chat #138 — no position picking, no delay; placement follows
 * the same path a real video_complete uses). sponsorTmagId is required.
 */
export interface McsAdminCreateProspectPayload {
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  country?: string;
  sponsorTmagId: string;
  phone?: string | null;
  email?: string | null;
  reason: string;
}

export interface McsAdminCreateProspectResponse {
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
  placedAt: McsIsoTimestamp | null;
  row: McsAdminProspectDirectoryRow;
}

/* ── prospect edit ──────────────────────────────────────────────────── */

/**
 * Admin-edit a prospect's ordinary fields. Sponsor is NOT here — a
 * prospect's sponsor changes only through the D.4 reassign-sponsor
 * intervention (already built). `reason` required for the paper trail.
 */
export interface McsAdminEditProspectPayload {
  firstName?: string;
  lastName?: string;
  city?: string;
  stateOrRegion?: string;
  country?: string;
  phone?: string | null;
  email?: string | null;
  reason: string;
}

export interface McsAdminEditProspectResponse {
  ok: true;
  prospectId: string;
  row: McsAdminProspectDirectoryRow;
}

export interface McsAdminProspectDeleteResponse {
  ok: true;
  prospectId: string;
  deletedAt: McsIsoTimestamp;
}

export interface McsAdminProspectRestoreResponse {
  ok: true;
  prospectId: string;
  restoredAt: McsIsoTimestamp;
  row: McsAdminProspectDirectoryRow;
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
export type McsMichaelRubricCategory =
  | 'vision'
  | 'commitment'
  | 'coachability'
  | 'available_time'
  | 'network'
  | 'experience';

/** Max points each category contributes to the 100-point total (the weights). */
export const MCS_MICHAEL_RUBRIC_MAX: Readonly<Record<McsMichaelRubricCategory, number>> = {
  vision: 20,
  commitment: 20,
  coachability: 20,
  available_time: 15,
  network: 15,
  experience: 10,
} as const;

/** Raw per-category points the scoring worker assigns from the transcript.
 *  Each value is 0..MICHAEL_RUBRIC_MAX[category]; the server clamps and sums. */
export interface McsMichaelCategoryScores {
  vision: number;
  commitment: number;
  coachability: number;
  availableTime: number;
  network: number;
  experience: number;
}

/** Legacy classification tiers. Do not produce for new Michael artifacts. */
export type McsMichaelClassificationTier =
  | 'builder'
  | 'emerging_leader'
  | 'part_time_producer'
  | 'casual_participant';

/** Legacy computed classification. Historical-read only. */
export interface McsMichaelClassification {
  categoryScores: McsMichaelCategoryScores;
  /** 0..100, sum of clamped per-category points. */
  weightedTotal: number;
  tier: McsMichaelClassificationTier;
  /** Human label, e.g. "Builder". */
  tierLabel: string;
  /** Score band for the tier, e.g. "85–100". */
  band: string;
  /** Provenance literal surfaced on cards. */
  signedBy: string;
}

/** Legacy band edges for old records. */
export const MCS_MICHAEL_CLASSIFICATION_BANDS: ReadonlyArray<{
  tier: McsMichaelClassificationTier;
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
export interface McsMichaelSuccessProfile {
  tmagId: string;
  classification: McsMichaelClassification;
  /** One-line read the sponsor leads with, e.g. "Vision-led, time-rich, ready to be coached." */
  headline: string;
  /** What this BA brings — the strongest 1–3 categories rendered as plain reads. */
  strengths: string[];
  /** Where the sponsor should focus support — the lightest 1–3 categories. */
  sponsorFocus: string[];
  generatedAt: McsIsoTimestamp;
  signedBy: string;
}

/** Legacy founder-handoff record. New Michael ingests do not create this. */
export interface McsMichaelFounderHandoff {
  handoffId: string;
  tmagId: string;
  baFirstName: string;
  sponsorTmagId: string | null;
  /** Lightweight classification summary (full profile on the linked artifact). */
  tier: McsMichaelClassificationTier;
  tierLabel: string;
  weightedTotal: number;
  successProfile: McsMichaelSuccessProfile;
  completedAt: McsIsoTimestamp;
  firedAt: McsIsoTimestamp;
  /** Founder BA-IDs the handoff was addressed to (from ADMIN_BA_IDS). */
  founderTmagIds: string[];
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
export interface McsMichaelScoringCategoryInput {
  categoryScores: McsMichaelCategoryScores;
}

/** Sponsor cockpit card shape retains nullable legacy fields for compatibility.
 *  Current server returns null for both; Steve-derived training support is the
 *  active Success Profile read. */
export interface McsMichaelCockpitCardClassified extends McsMichaelCockpitCardData {
  classification: McsMichaelClassification | null;
  successProfile: McsMichaelSuccessProfile | null;
}

/** LEGACY — retired founder-handoff response. */
export interface McsMichaelFounderHandoffListResponse {
  ok: true;
  handoffs: McsMichaelFounderHandoff[];
}

/** LEGACY — one question in Michael's retired interview backbone. */
export interface McsMichaelInterviewScriptQuestion {
  id: string;
  /** 1-based question number across the whole interview (1..29). */
  number: number;
  /** The section this question belongs to. */
  sectionId: string;
  /** The prompt Michael leads with (backbone; the LLM expands naturally). */
  prompt: string;
  /** Which rubric category this question primarily informs (null = rapport/none). */
  category: McsMichaelRubricCategory | null;
}

/** One of the 9 sections of the New Associate Success Interview. */
export interface McsMichaelInterviewScriptSection {
  id: string;
  title: string;
  /** What Michael is listening for in this section. */
  intent: string;
  questions: McsMichaelInterviewScriptQuestion[];
}

/** LEGACY — retired Michael interview script response. */
export interface McsMichaelInterviewScriptResponse {
  ok: true;
  sections: McsMichaelInterviewScriptSection[];
  rubric: Array<{ category: McsMichaelRubricCategory; max: number; label: string }>;
  bands: typeof MCS_MICHAEL_CLASSIFICATION_BANDS;
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
 *     reserving party is the BA. tmagId is read from the session, never the body.
 */

/** Default seat cap per orientation session (Chat #147). */
export const MCS_ORIENTATION_SESSION_CAPACITY = 10;

/**
 * A scheduled group orientation session a BA can reserve a seat in. Models
 * WebinarEvent but adds a `capacity` cap and keeps `hosts` assignable (the
 * seeder/admin sets them; founders today, leaders later).
 */
export interface McsOrientationSession {
  sessionId: string;
  scheduledFor: McsIsoTimestamp;
  /** Assignable host display names. Defaults to founders; never hardcoded downstream. */
  hosts: string[];
  /** Hard seat cap. Defaults to ORIENTATION_SESSION_CAPACITY (10). */
  capacity: number;
  durationMinutes: number;
  /** Optional join link (Zoom etc.); null until set by the host. */
  joinUrl: string | null;
  status: 'upcoming' | 'past' | 'cancelled';
  createdAt: McsIsoTimestamp;
}

/**
 * A BA's reservation of a seat in an orientation session. One active
 * reservation per BA per session; cancellation flips status to 'cancelled'
 * (the row is retained for the audit/roster history, not deleted).
 */
export interface McsOrientationReservationRecord {
  reservationId: string;
  sessionId: string;
  /** The reserving BA — read from the authed session, never the request body. */
  tmagId: string;
  /** Snapshot of the BA's display name at reservation time (for the roster). */
  baName: string;
  scheduledFor: McsIsoTimestamp;
  status: 'reserved' | 'cancelled';
  createdAt: McsIsoTimestamp;
  cancelledAt: McsIsoTimestamp | null;
  smsDeliveryStatus: 'queued' | 'sent' | 'failed' | 'skipped';
  smsDeliveryError: string | null;
}

/**
 * One available session as the cockpit scheduling card renders it: the
 * session plus its live seat math and whether THIS BA already holds a seat.
 */
export interface McsOrientationSessionAvailability {
  sessionId: string;
  scheduledFor: McsIsoTimestamp;
  hosts: string[];
  capacity: number;
  seatsTaken: number;
  seatsRemaining: number;
  durationMinutes: number;
  /** True when the authed BA already holds an active seat in this session. */
  reservedByMe: boolean;
}

/** GET /api/orientation/sessions — the cockpit scheduling card payload. */
export interface McsOrientationSessionsResponse {
  ok: true;
  sessions: McsOrientationSessionAvailability[];
  /** The session id this BA currently holds a seat in, or null. */
  myReservationSessionId: string | null;
}

/** POST /api/orientation/sessions/:sessionId/reserve response. */
export interface McsOrientationReserveResponse {
  ok: true;
  reservationId: string;
  sessionId: string;
  scheduledFor: McsIsoTimestamp;
  seatsRemaining: number;
  createdAt: McsIsoTimestamp;
}

/** DELETE /api/orientation/sessions/:sessionId/reserve response. */
export interface McsOrientationCancelResponse {
  ok: true;
  sessionId: string;
  cancelledAt: McsIsoTimestamp;
}

/** One BA on a session roster (the founder-facing /admin view). */
export interface McsOrientationRosterSeat {
  reservationId: string;
  tmagId: string;
  baName: string;
  reservedAt: McsIsoTimestamp;
}

/** A session plus its full roster, for the founder /admin roster view. */
export interface McsOrientationSessionWithRoster {
  sessionId: string;
  scheduledFor: McsIsoTimestamp;
  hosts: string[];
  capacity: number;
  durationMinutes: number;
  joinUrl: string | null;
  status: 'upcoming' | 'past' | 'cancelled';
  seatsTaken: number;
  seatsRemaining: number;
  roster: McsOrientationRosterSeat[];
}

/** GET /api/admin/orientation/sessions — founder roster view. */
export interface McsAdminOrientationSessionsResponse {
  ok: true;
  sessions: McsOrientationSessionWithRoster[];
}

/** POST /api/admin/orientation/sessions — founders seed a new session. */
export interface McsAdminCreateOrientationSessionPayload {
  scheduledFor: McsIsoTimestamp;
  /** Assignable hosts. Omit/empty → server defaults to the founders. */
  hosts?: string[];
  /** Seat cap. Omit → ORIENTATION_SESSION_CAPACITY (10). */
  capacity?: number;
  durationMinutes?: number;
  joinUrl?: string | null;
}

export interface McsAdminCreateOrientationSessionResponse {
  ok: true;
  session: McsOrientationSessionWithRoster;
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
export interface McsReinviteScriptResponse {
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
export interface McsSponsorFallbackFounder {
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
export interface McsCockpitSponsorFallback {
  sponsorInactive: boolean;
  founders: McsSponsorFallbackFounder[];
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
export type McsScriptMakerScriptKind =
  | 'default_script'
  | 'product_anchored'
  | 'reconnect'
  | 'event_invite';

/**
 * Optional draft selectors accepted by POST /api/scriptmaker/draft in addition
 * to ScriptMakerDraftPayload. `scriptKind` picks the seed; `eventDay`/
 * `eventTime` fill the event_invite seed's {{eventDay}}/{{eventTime}} tokens.
 */
export interface McsScriptMakerDraftSelectors {
  scriptKind?: McsScriptMakerScriptKind;
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
 * tmag_content_templates actually changes what the prospect sees.
 *
 * Resilience: every field is already a code-default-backed string
 * (readMasterContent never throws). The one nullable field is
 * `heroBaVoiceCopy` — it is non-null ONLY when the inviting-BA hero
 * (`com.presentation.hero`) carries an actual master override; with no
 * override the prop is absent and the generic hero sub-line carries the
 * page (locked-spec F.2 / 3.9 "inviting BA voice copy").
 */
export interface McsComProspectCopy {
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
 * Fast Start progress, Ivory roster, invitation spine, and the Michael
 * interview record (michael_interviews by tmagId; step surfaces only when
 * the Michael runtime is enabled or a record already exists).
 */

export type McsLaunchStepId =
  | 'welcome_accepted'
  | 'steve_discovery_completed'
  | 'michael_interview_completed'
  | 'day_1_started'
  | 'day_1_completed'
  | 'who_do_you_know_started'
  | 'first_invitation_drafted'
  | 'first_invitation_minted'
  | 'first_invitation_sent'
  | 'sponsor_connection_confirmed';

export type McsLaunchStepState =
  | 'complete'
  | 'current'
  | 'available'
  | 'locked'
  | 'optional';

export interface McsLaunchStep {
  id: McsLaunchStepId;
  label: string;
  state: McsLaunchStepState;
  source: string;
  href: string | null;
  completedAt: McsIsoTimestamp | null;
  detail: string;
}

export interface McsLaunchNextAction {
  stepId: McsLaunchStepId | null;
  label: string;
  href: string | null;
  reason: string;
}

export interface McsLaunchSteveState {
  phase: McsSteveDiscoveryPhase;
  completedAt: McsIsoTimestamp | null;
}

export interface McsLaunchFirstInvitationState {
  ivoryNames: number;
  draftedCount: number;
  mintedCount: number;
  sentCount: number;
}

export interface McsLaunchFastStartState {
  day1State: McsFastStartModuleState;
  day1StartedAt: McsIsoTimestamp | null;
  day1CompletedAt: McsIsoTimestamp | null;
  complete: boolean;
}

export interface McsLaunchMichaelState {
  /** Michael launch step is surfaced (runtime enabled or a record exists). */
  enabled: boolean;
  complete: boolean;
  completedAt: McsIsoTimestamp | null;
}

export interface McsTeamLaunchCenterResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  baFirstName: string;
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  nextAction: McsLaunchNextAction;
  steps: McsLaunchStep[];
  steve: McsLaunchSteveState;
  michael: McsLaunchMichaelState;
  firstInvitation: McsLaunchFirstInvitationState;
  fastStart: McsLaunchFastStartState;
  launchComplete: boolean;
}

// -----------------------------------------------------------------------------
// Agent Orchestration Layer
// -----------------------------------------------------------------------------

export type McsAgentId = 'michael' | 'ivory' | 'steve' | 'system';

export type McsAgentRecommendationPriority = 1 | 2 | 3 | 4 | 5;

export type McsAgentRecommendationKind =
  | 'complete_steve'
  | 'review_steve_profile'
  | 'follow_up_prospect'
  | 'invite_from_ivory'
  | 'open_daily_actions'
  | 'keep_sharing';

export type McsAgentSubjectType =
  | 'ba'
  | 'prospect'
  | 'ivory_name'
  | 'steve_discovery'
  | 'daily_actions'
  | 'system';

export interface McsAgentRecommendation {
  recommendationId: string;
  agentId: McsAgentId;
  kind: McsAgentRecommendationKind;
  priority: McsAgentRecommendationPriority;
  title: string;
  summary: string;
  reason: string;
  ctaLabel: string;
  route: string;
  subjectType: McsAgentSubjectType;
  subjectId: string | null;
  createdAt: McsIsoTimestamp;
  expiresAt: McsIsoTimestamp | null;
}

export interface McsAgentRecommendationsResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  recommendations: McsAgentRecommendation[];
}

export type McsAgentEventKind =
  | 'recommendation_viewed'
  | 'recommendation_actioned'
  | 'recommendation_dismissed'
  | 'agent_opened'
  | 'handoff_started'
  | 'handoff_completed';

export type McsAgentEventMetadataValue = string | number | boolean | null;

export interface McsAgentEvent {
  eventId: string;
  tmagId: string;
  agentId: McsAgentId;
  kind: McsAgentEventKind;
  recommendationId: string | null;
  subjectType: McsAgentSubjectType;
  subjectId: string | null;
  metadata: Record<string, McsAgentEventMetadataValue>;
  createdAt: McsIsoTimestamp;
}

export interface McsCreateAgentEventPayload {
  agentId: McsAgentId;
  kind: McsAgentEventKind;
  recommendationId?: string | null;
  subjectType?: McsAgentSubjectType;
  subjectId?: string | null;
  metadata?: Record<string, McsAgentEventMetadataValue>;
}

export interface McsAgentEventResponse {
  ok: true;
  event: McsAgentEvent;
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
export type McsSteveDiscoveryPhase =
  | 'awaiting_call'
  | 'call_in_progress'
  | 'complete'
  | 'no_answer'
  | 'invalid_number'
  | 'stt_failed';

/** One speaker turn in Steve's discovery transcript. 'ba' = the new BA. */
export interface McsSteveTranscriptChunk {
  sequence: number;
  speaker: 'steve' | 'ba';
  text: string;
  occurredAt: McsIsoTimestamp;
}

/** One discovery question + the BA's answer. NOTE: no scoringTags — Steve
 *  records understanding, never tags or scores. */
export interface McsSteveDiscoveryAnswer {
  questionId: string;
  /** The prompt Steve led with (captured for sponsor readback). */
  prompt: string;
  /** The BA's answer text, derived from the transcript by the worker. */
  answerText: string;
}

/** What a discovery question is gently surfacing. Descriptive grouping only —
 *  it is NOT a rubric category and carries no weight or score. */
export type McsSteveDiscoveryFocus =
  | 'primary_why'
  | 'success_vision'
  | 'learning_style'
  | 'communication'
  | 'support_needs';

/** How the BA prefers to take in something new. Descriptive, not ranked. */
export type McsSteveLearningModality =
  | 'watching'
  | 'doing'
  | 'step_by_step'
  | 'reading'
  | 'discussing'
  | 'mixed';

/** The BA's learning style — their own preferences, reflected back. */
export interface McsSteveLearningStyle {
  /** Preferred way(s) to learn, mapped from the BA's own words. */
  modalities: McsSteveLearningModality[];
  /** How the BA likes feedback when doing something a little wrong. */
  feedbackPreference: string;
  /** Free-text reflection of what helps this person learn best. */
  notes: string;
}

/** Channels the BA likes to be reached on. */
export type McsSteveContactChannel =
  | 'text'
  | 'call'
  | 'email'
  | 'in_app'
  | 'video'
  | 'in_person';

/** How often the BA wants to hear from their sponsor/team. */
export type McsSteveContactCadence =
  | 'daily'
  | 'few_times_week'
  | 'weekly'
  | 'as_needed';

/** The BA's communication preferences — their own stated preferences. */
export interface McsSteveCommunicationPreferences {
  preferredChannels: McsSteveContactChannel[];
  cadence: McsSteveContactCadence | null;
  /** When the BA is reachable, in their own words. */
  bestTimes: string;
  notes: string;
}

/** Where the BA wants support early. Reflective, never a judgment of capacity. */
export interface McsSteveSupportNeeds {
  /** Areas the BA wants a hand with, mapped to short reads. */
  areas: string[];
  /** Obstacles the BA themselves named. Recorded, not scored. */
  potentialObstacles: string[];
  /** How they like to be supported when stuck (ask early vs push through, etc.). */
  helpStyle: string;
  notes: string;
}

/** The BA's deeper, emotional reason for being here — in their own words. */
export interface McsStevePrimaryWhy {
  /** The why beneath the surface answer. */
  statement: string;
  /** Who they're doing this for, if named. */
  who: string;
  /** Why now — the timing pull they described. */
  whyNow: string;
}

/** The BA's picture of success — in their own words. */
export interface McsSteveSuccessVision {
  /** Life a year out, as the BA painted it. */
  statement: string;
  /** The one change that would make the biggest difference. */
  oneBigChange: string;
}

/** One personalized recommendation — supportive preparation, not evaluation. */
export interface McsSteveRecommendation {
  /** Short, actionable, supportive — how to meet this BA where they are. */
  text: string;
  /** Optional pointer to a surface/resource (e.g. '/training/fast-start/product'). */
  href?: string | null;
}

/** The generated Success Profile — Steve's synthesis of the discovery. Every
 *  field reflects the BA's own words; nothing here ranks or scores the BA. */
export interface McsSteveSuccessProfile {
  tmagId: string;
  primaryWhy: McsStevePrimaryWhy;
  successVision: McsSteveSuccessVision;
  learningStyle: McsSteveLearningStyle;
  communicationPreferences: McsSteveCommunicationPreferences;
  supportNeeds: McsSteveSupportNeeds;
  /** How to launch this BA well — personalized first steps. */
  launchRecommendations: McsSteveRecommendation[];
  /** What training to point them at first, given how they learn. */
  trainingRecommendations: McsSteveRecommendation[];
  /** Short context summary Steve hands to Michael for training suggestions.
   *  CONTEXT ONLY — Michael does not schedule or interview. */
  michaelHandoffSummary: string;
  generatedAt: McsIsoTimestamp;
  signedBy: string;
}

/** Authoritative completed-discovery record. Triple-stacked at ingest.
 *  sponsorTmagId is stamped server-side from team_magnificent_members — NEVER from the
 *  worker payload (locked-spec 3.5). */
export interface McsSteveDiscoveryArtifact {
  tmagId: string;
  sponsorTmagId: string | null;
  callSid: string | null;
  startedAt: McsIsoTimestamp | null;
  completedAt: McsIsoTimestamp | null;
  transcript: McsSteveTranscriptChunk[];
  /** The raw discovery interview (questions + the BA's answers). */
  answers: McsSteveDiscoveryAnswer[];
  /** The synthesized Success Profile. */
  successProfile: McsSteveSuccessProfile;
  audioUrl: string | null;
}

/** GET /api/steve/discovery/state response — the BA's own discovery view.
 *  Pre-discovery: phase=awaiting_call, artifact=null. After: phase=complete
 *  + artifact. */
export interface McsSteveDiscoveryView {
  tmagId: string;
  phase: McsSteveDiscoveryPhase;
  transcript: McsSteveTranscriptChunk[];
  artifact: McsSteveDiscoveryArtifact | null;
}

/** Sponsor-only card: a downline's Steve Success Profile. Access enforced
 *  server-side (requesting BA must be the downline's sponsor). */
export interface McsSteveProfileCard {
  downlineTmagId: string;
  downlineFirstName: string;
  completedAt: McsIsoTimestamp;
  answers: McsSteveDiscoveryAnswer[];
  successProfile: McsSteveSuccessProfile;
  audioUrl: string | null;
  signedBy: string;
}

/** Worker → server payload on POST /api/steve/discovery/ingest. The worker
 *  conducts the conversation and supplies the discovery + the understanding it
 *  produced; the server stamps tmagId/sponsorTmagId/generatedAt/signedBy and
 *  assembles the SteveSuccessProfile, then triple-stacks it. sponsorTmagId is
 *  intentionally omitted from this shape (server-stamped). */
export interface McsSteveDiscoveryIngestPayload {
  tmagId: string;
  callSid: string | null;
  startedAt: McsIsoTimestamp;
  completedAt: McsIsoTimestamp;
  transcript: McsSteveTranscriptChunk[];
  answers: McsSteveDiscoveryAnswer[];
  audioUrl: string | null;
  /** The understanding Steve produced. The server assembles these into the
   *  SteveSuccessProfile (stamping tmagId, generatedAt, signedBy). */
  profile: {
    primaryWhy: McsStevePrimaryWhy;
    successVision: McsSteveSuccessVision;
    learningStyle: McsSteveLearningStyle;
    communicationPreferences: McsSteveCommunicationPreferences;
    supportNeeds: McsSteveSupportNeeds;
    launchRecommendations: McsSteveRecommendation[];
    trainingRecommendations: McsSteveRecommendation[];
    michaelHandoffSummary: string;
  };
}

/** One question in Steve's discovery backbone, surfaced read-only via
 *  GET /api/steve/discovery/script. */
export interface McsSteveDiscoveryScriptQuestion {
  id: string;
  /** 1-based question number across the whole discovery. */
  number: number;
  sectionId: string;
  /** The prompt Steve leads with (backbone; the LLM expands naturally). */
  prompt: string;
  /** What this question gently surfaces (understanding only; never scored). */
  focus: McsSteveDiscoveryFocus | null;
}

/** One section of Steve's discovery conversation. */
export interface McsSteveDiscoveryScriptSection {
  id: string;
  title: string;
  /** What Steve is listening for in this section. */
  intent: string;
  questions: McsSteveDiscoveryScriptQuestion[];
}

/** GET /api/steve/discovery/script response. */
export interface McsSteveDiscoveryScriptResponse {
  ok: true;
  sections: McsSteveDiscoveryScriptSection[];
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
// Everything is BA-scoped (sponsorTmagId = session tmagId, ownership enforced on
// the IvoryName side). The agent NEVER auto-sends, never scores prospects, and
// never speaks comp/income/medical (locked-spec 3.10/3.11) — it's a reflection
// surface for manual follow-up, modeled on Ivory's coach posture.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Why a prospect appears in the Momentum focus queue — surfaced alongside the
 * existing PMV `nextAction.reason` so the BA sees one Ivory-flavored phrase
 * ("because Jordan watched the video") not just the generic call-now reason.
 */
export type McsIvoryMomentumPriorityReason =
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
export interface McsIvoryMomentumContext {
  ivoryId: string | null;
  categories: McsIvoryCategory[];
  preferredAngle: McsIvoryAngle | null;
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
export interface McsIvoryMomentumRow {
  prospectId: string;
  /** The full PMV row — single source of truth for lifecycle + next action. */
  pmv: McsProspectMomentumRow;
  /** Ivory-specific relationship context for the BA. */
  ivory: McsIvoryMomentumContext;
  /**
   * Derived priority reason used to rank the row in the cohort focus queue.
   * Independent from `pmv.nextAction.kind` because the Ivory queue prioritizes
   * relational moments ("Jordan watched") even when PMV would also surface
   * a generic 'call_now'.
   */
  priorityReason: McsIvoryMomentumPriorityReason | null;
}

/** Cohort-level counts surfaced in the Momentum page header. */
export interface McsIvoryMomentumCohortCounts {
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
export interface McsIvoryMomentumViewResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  counts: McsIvoryMomentumCohortCounts;
  focusQueue: McsIvoryMomentumRow[];
  rows: McsIvoryMomentumRow[];
}

/**
 * POST /api/ivory/momentum/:prospectId/suggest request body. The Ivory
 * Momentum Agent reads the prospect's current lifecycle/lastSignal and the
 * BA's saved relationship context, then asks the LLM for one short, warm
 * follow-up suggestion the BA can adapt and send manually. Optional `ask`
 * lets the BA bias the suggestion ("they said they'd watch this weekend").
 */
export interface McsIvoryMomentumSuggestionPayload {
  /** Optional free-form BA prompt to bias the suggestion. */
  ask?: string;
}

/** POST /api/ivory/momentum/:prospectId/suggest 200 response. */
export interface McsIvoryMomentumSuggestionResponse {
  ok: true;
  prospectId: string;
  lifecycle: McsProspectLifecycleStage;
  /** 1–2 sentence framing the BA reads before the suggestion text. */
  coaching: string;
  /** The suggested follow-up text. BA edits before sending — never auto-sent. */
  suggestion: string;
  /** True when the LLM is unavailable and a deterministic fallback was returned. */
  degraded: boolean;
}

// ─── feature/michael-training-support ────────────────────────────────────────
// Sponsor-facing "how to support this downline's training" card. PROJECTION of
// Steve's already-persisted SuccessProfile (tmag_steve_success_interview) — read-only on
// each request, no new collection. Steve owns capture; this surface owns
// presentation of the support guidance to the direct sponsor.
//
// Compliance: BA-language read-back only. No income, no comp math, no placement
// promises. The sponsor uses this to meet the BA where they are during training.

export interface McsMichaelTrainingSupportGuidanceSection {
  /** Section label, e.g. "How they learn". */
  label: string;
  /** Distilled guidance lines pulled from the BA's own discovery answers. */
  bullets: string[];
}

export interface McsMichaelTrainingSupportCard {
  downlineTmagId: string;
  downlineFirstName: string;
  /** Timestamp from Steve's SuccessProfile (generatedAt). */
  derivedFromSteveAt: string;
  /** Pass-through of the BA's own primary-why statement. */
  primaryWhy: string;
  /** Pass-through of the BA's own success-vision statement. */
  successVision: string;
  learningStyle: McsMichaelTrainingSupportGuidanceSection;
  communication: McsMichaelTrainingSupportGuidanceSection;
  supportFocus: McsMichaelTrainingSupportGuidanceSection;
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
 * Ownership invariant: every lead/prospect record carries ownerTmagId and
 * sponsorTmagId. VM leads also carry leadOwnerId and vmCampaignId. Client
 * payloads must not provide or override those ownership fields; routes stamp
 * them from the authenticated BA, token, or audited admin correction.
 */

export type TmagId = string;

export interface McsOwnedProspectIdentity {
  ownerTmagId: TmagId;
  sponsorTmagId: TmagId;
}

export interface McsVmLeadIdentity extends McsOwnedProspectIdentity {
  leadOwnerId: string;
  vmCampaignId: string;
}

export type McsProspectAcquisitionSource =
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

export type McsVmLeadOwnerSource =
  | 'apache_leads'
  | 'uploaded_csv'
  | 'manual_import'
  | 'provider_import'
  | 'admin_seed'
  | 'other';

export type McsVmLeadType =
  | 'mobile_vm'
  | 'mobile_sms'
  | 'email'
  | 'mixed'
  | 'unknown';

export type McsLeadOwnerStatus =
  | 'draft'
  | 'processing'
  | 'imported'
  | 'validated'
  | 'partially_failed'
  | 'completed'
  | 'archived';

export type McsVmCampaignProvider =
  | 'leadsrain_style_adapter'
  | 'slybroadcast_style_adapter'
  | 'manual_csv'
  | 'acquisition_provider_placeholder'
  | 'telnyx_call_control'
  | 'future_telecom_adapter'
  | 'none';

export type McsVmCampaignStatus =
  | 'draft'
  | 'ready'
  | 'scheduled'
  | 'dry_run'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'archived';

export type McsVmDeliveryChannel = 'voicemail' | 'sms' | 'email' | 'manual_export';

export type McsVmDeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'skipped'
  | 'opted_out'
  | 'suppressed'
  | 'unknown';

export type McsProspectCrmStatus =
  | 'inactive_pre_engagement'
  | 'active'
  | 'needs_follow_up'
  | 'watching'
  | 'presentation_completed'
  | 'holding_tank'
  | 'closed';

// CrmDisposition merged into the canonical CrmDisposition (F2/F3).

export type McsProspectCrmClosedReason =
  | 'enrolled_as_brand_ambassador'
  | 'became_customer'
  | 'not_interested'
  | 'do_not_contact'
  | 'expired'
  | 'duplicate'
  | 'invalid_contact'
  | 'admin_closed';

export type McsProspectTimelineEventKind =
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
  | 'closed_new_brand_ambassador'
  | 'closed_new_customer'
  | 'closed_not_interested'
  | 'closed_later'
  | 'expired'
  | 'archived'
  | 'ownership_corrected';

export type McsVmLeadLifecycleStatus =
  | 'imported'
  | 'validated'
  | 'invalid'
  | 'duplicate'
  | 'suppressed'
  | 'crm_created'
  | 'token_created'
  | 'queued'
  | 'delivery_dry_run'
  | 'manual_exported'
  | 'voicemail_drop_queued'
  | 'voicemail_drop_delivered'
  | 'voicemail_drop_failed'
  | 'opted_out'
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
  | 'closed_new_brand_ambassador'
  | 'closed_new_customer'
  | 'closed_not_interested'
  | 'closed_later'
  | 'expired'
  | 'archived';

export const MCS_VM_LEAD_LIFECYCLE_STATUSES: readonly McsVmLeadLifecycleStatus[] = [
  'imported',
  'validated',
  'invalid',
  'duplicate',
  'suppressed',
  'crm_created',
  'token_created',
  'queued',
  'delivery_dry_run',
  'manual_exported',
  'voicemail_drop_queued',
  'voicemail_drop_delivered',
  'voicemail_drop_failed',
  'opted_out',
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
  'closed_new_brand_ambassador',
  'closed_new_customer',
  'closed_not_interested',
  'closed_later',
  'expired',
  'archived',
] as const;

export interface McsLeadOwnerRecord extends McsOwnedProspectIdentity {
  leadOwnerId: string;
  name: string;
  source: McsVmLeadOwnerSource;
  sourceLabel: string | null;
  country: string;
  leadType: McsVmLeadType;
  quantityExpected: number;
  quantityImported: number;
  quantitySuppressed: number;
  quantityInvalid: number;
  status: McsLeadOwnerStatus;
  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
  completedAt: McsIsoTimestamp | null;
}

export interface McsBulkLeadRecord extends McsVmLeadIdentity {
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
  source: McsVmLeadOwnerSource;
  status: McsVmLeadLifecycleStatus;
  activatedAt: McsIsoTimestamp | null;
  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
}

export interface McsVMCampaignRecord extends McsOwnedProspectIdentity {
  vmCampaignId: string;
  leadOwnerId: string;
  name: string;
  provider: McsVmCampaignProvider;
  status: McsVmCampaignStatus;
  voicemailAudioId: string | null;
  audioUrl: string | null;
  smsTemplateId: string | null;
  emailTemplateId: string | null;
  scheduledAt: McsIsoTimestamp | null;
  startedAt: McsIsoTimestamp | null;
  completedAt: McsIsoTimestamp | null;
  adminApprovedForLiveDelivery?: boolean;
  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
}

export type McsVmCampaignStatusAction = 'ready' | 'schedule' | 'start' | 'pause' | 'resume' | 'cancel';

export interface McsVmCampaignStatusPatchPayload {
  action: McsVmCampaignStatusAction;
  scheduledAt?: McsIsoTimestamp | null;
}

export interface McsVmCampaignStatusPatchResponse {
  ok: true;
  campaign: McsVMCampaignRecord;
}

export type McsVmCampaignMetricStatus =
  | 'imported'
  | 'validated'
  | 'invalid'
  | 'duplicate'
  | 'suppressed'
  | 'token_created'
  | 'crm_created'
  | 'queued'
  | 'delivery_dry_run'
  | 'manual_exported'
  | 'voicemail_drop_queued'
  | 'voicemail_drop_delivered'
  | 'voicemail_drop_failed'
  | 'opted_out';

export type McsVmCampaignMetrics = Record<McsVmCampaignMetricStatus, number> & {
  total: number;
};

export interface McsVmCampaignMetricsResponse {
  ok: true;
  vmCampaignId: string;
  metrics: McsVmCampaignMetrics;
}

export interface McsVmCampaignLeadRow {
  leadId: string;
  firstName: string | null;
  lastName: string | null;
  city: string | null;
  stateOrRegion: string | null;
  country: string;
  normalizedPhone: string | null;
  normalizedEmail: string | null;
  status: McsVmCampaignMetricStatus;
  token: string | null;
  crmRecordId: string | null;
  validationIssues: string[];
  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
}

export interface McsVmCampaignLeadsResponse {
  ok: true;
  leads: McsVmCampaignLeadRow[];
  page: number;
  pageSize: number;
  total: number;
}

export interface McsVmImportQueuedResponse {
  ok: true;
  importJobId: string;
  chunksQueued: number;
  rowsAccepted: number;
}

export interface McsVmImportJobStatusResponse {
  ok: true;
  importJobId: string;
  counts: McsVmCampaignMetrics;
}

export interface McsAdminVmLiveApprovalPayload {
  vmCampaignId: string;
  approved: boolean;
}

export interface McsAdminVmLiveApprovalResponse {
  ok: true;
  vmCampaignId: string;
  adminApprovedForLiveDelivery: boolean;
}

export interface McsVMDeliveryEventRecord {
  eventId: string;
  provider: McsVmCampaignProvider;
  leadId: string;
  vmCampaignId: string;
  ownerTmagId: TmagId;
  status: string;
  providerMessageId: string | null;
  providerStatus: string | null;
  dryRun: boolean;
  attempt: number;
  details: Record<string, unknown>;
  createdAt: McsIsoTimestamp;
}

export interface McsProspectCRMRecord extends McsOwnedProspectIdentity {
  crmRecordId: string;
  prospectId: string;
  leadId: string | null;
  leadOwnerId: string | null;
  vmCampaignId: string | null;
  source: McsProspectAcquisitionSource;
  status: McsProspectCrmStatus;
  disposition: McsCrmDisposition | null;
  followUpDueAt: McsIsoTimestamp | null;
  closedAt: McsIsoTimestamp | null;
  closedReason: McsProspectCrmClosedReason | null;
  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
}

export interface McsProspectTimelineEventRecord extends McsOwnedProspectIdentity {
  eventId: string;
  prospectId: string;
  crmRecordId: string | null;
  leadId: string | null;
  leadOwnerId: string | null;
  vmCampaignId: string | null;
  kind: McsProspectTimelineEventKind;
  title: string;
  occurredAt: McsIsoTimestamp;
  payload: Record<string, string | number | boolean | null>;
}

export interface McsOwnershipCorrectionAuditRecord {
  auditId: string;
  prospectId: string;
  leadId: string | null;
  oldOwnerTmagId: TmagId;
  newOwnerTmagId: TmagId;
  oldSponsorTmagId: TmagId;
  newSponsorTmagId: TmagId;
  reason: string;
  adminUserId: string;
  changedAt: McsIsoTimestamp;
}

export interface McsProspectCrmHubFilter {
  source?: McsProspectAcquisitionSource | 'all';
  status?: McsProspectCrmStatus | 'all';
  disposition?: McsCrmDisposition | 'all';
  campaignId?: string | null;
  leadOwnerId?: string | null;
  followUp?: 'due' | 'upcoming' | 'none' | 'all';
  closed?: 'include' | 'exclude' | 'only';
}

export interface McsProspectCrmHubRow extends McsOwnedProspectIdentity {
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
  source: McsProspectAcquisitionSource;
  status: McsProspectCrmStatus;
  disposition: McsCrmDisposition | null;
  followUpDueAt: McsIsoTimestamp | null;
  lastSignal: McsProspectTimelineEventKind | null;
  lastSignalAt: McsIsoTimestamp | null;
  leadOwnerId: string | null;
  vmCampaignId: string | null;
}

export interface McsProspectCrmHubListResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  filters: McsProspectCrmHubFilter;
  rows: McsProspectCrmHubRow[];
}

export interface McsProspectCrmHubDetailResponse {
  ok: true;
  record: McsProspectCRMRecord;
  timeline: McsProspectTimelineEventRecord[];
}

// VmLeadLifecycleStatus alias removed (F4) — use VmLeadLifecycleStatus.
export type McsProspectCrmSource = McsProspectAcquisitionSource;
// ProspectTimelineEventKind alias removed (F4) — use ProspectTimelineEventKind.
export type McsVMCampaignProviderMode = McsVmCampaignProvider;

export interface McsCreateLeadOwnerPayload {
  name: string;
  source: string;
  country?: string;
  leadType: string;
  quantityImported?: number;
}

export interface McsCreateVMCampaignPayload {
  leadOwnerId: string;
  name: string;
  provider?: McsVMCampaignProviderMode;
  voicemailAudioId?: string | null;
  audioUrl?: string | null;
  smsTemplateId?: string | null;
  emailTemplateId?: string | null;
  scheduledAt?: McsIsoTimestamp | null;
}

export interface McsImportBulkLeadPayload {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  city: string;
  stateOrRegion: string;
  country?: string;
}

export interface McsImportBulkLeadsPayload {
  vmCampaignId: string;
  leads: McsImportBulkLeadPayload[];
}

export interface McsLeadOwnerResponse {
  ok: true;
  leadOwner: McsLeadOwnerRecord;
}

export interface McsLeadOwnerListResponse {
  ok: true;
  leadOwners: McsLeadOwnerRecord[];
}

export interface McsVMCampaignResponse {
  ok: true;
  campaign: McsVMCampaignRecord;
}

export interface McsVMCampaignListResponse {
  ok: true;
  campaigns: McsVMCampaignRecord[];
}

export interface McsImportBulkLeadsResponse {
  ok: true;
  leadOwner: McsLeadOwnerRecord;
  campaign: McsVMCampaignRecord;
  leads: McsBulkLeadRecord[];
}

export interface McsProspectCrmListResponse {
  ok: true;
  records: McsProspectCRMRecord[];
}

export interface McsProspectCrmRecordResponse {
  ok: true;
  record: McsProspectCRMRecord;
  timeline: McsProspectTimelineEventRecord[];
}

export interface McsCloseAsNewBaResponse {
  ok: true;
  record: McsProspectCRMRecord;
  closedAt: McsIsoTimestamp;
}

export interface McsRvmResolvedTokenPayload extends McsResolvedTokenPayload {
  source: 'rvm';
  lead: {
    leadId: string;
    leadOwnerId: string;
    vmCampaignId: string;
    status: McsVmLeadLifecycleStatus;
  };
  crm: {
    crmRecordId: string;
    crmStatus: McsProspectCrmStatus;
    disposition: McsCrmDisposition | null;
  };
}

export interface McsRvmInfoRequestPayload {
  note?: string;
}

export interface McsRvmInfoRequestResponse {
  ok: true;
  prospectId: string;
  createdAt: McsIsoTimestamp;
}

export type McsAdminVmMetricTone = 'neutral' | 'good' | 'watch' | 'risk';

export interface McsAdminVmMetricCard {
  key: string;
  label: string;
  value: number | string;
  detail: string;
  tone: McsAdminVmMetricTone;
}

export interface McsAdminVmBaPerformanceRow {
  tmagId: string;
  baName: string;
  campaignCount: number;
  leadOwnerCount: number;
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
  lastActivityAt: McsIsoTimestamp | null;
}

export interface McsAdminVmLeadOwnerHealthRow {
  leadOwnerId: string;
  ownerTmagId: string;
  ownerName: string;
  source: string;
  status: string;
  quantityImported: number;
  validated: number;
  suppressed: number;
  tokenized: number;
  crmCreated: number;
  activated: number;
  createdAt: McsIsoTimestamp | null;
  completedAt: McsIsoTimestamp | null;
}

export interface McsAdminVmCampaignRow {
  vmCampaignId: string;
  ownerTmagId: string;
  ownerName: string;
  leadOwnerId: string | null;
  name: string;
  provider: string;
  status: string;
  scheduledAt: McsIsoTimestamp | null;
  leadsQueued: number;
  delivered: number;
  deliveryFailed: number;
  activated: number;
  videoCompletions: number;
  callbacks: number;
  closedNewBa: number;
  createdAt: McsIsoTimestamp | null;
}

export interface McsAdminVmComplianceSummary {
  suppressedLeads: number;
  optOuts: number;
  dncFlags: number;
  invalidPhones: number;
  invalidEmails: number;
  complianceHolds: number;
  liveSendEnabled: boolean;
  note: string;
}

export interface McsAdminVmProviderHealth {
  provider: string;
  mode: 'stub' | 'manual' | 'dry_run' | 'live';
  status: 'not_configured' | 'healthy' | 'warning' | 'error';
  lastWebhookAt: McsIsoTimestamp | null;
  delivered24h: number;
  failed24h: number;
  note: string;
}

export type McsAdminVmHookStatus = 'stubbed' | 'wired' | 'disabled';

export interface McsAdminVmNotificationHook {
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
  status: McsAdminVmHookStatus;
  privacyBoundary: string;
}

export interface McsAdminVmTeamNewsHook {
  hookId: string;
  source:
    | 'campaign_milestone'
    | 'training_update'
    | 'event_update'
    | 'success_story'
    | 'team_momentum';
  status: McsAdminVmHookStatus;
  reviewRequired: boolean;
  note: string;
}

export interface McsAdminVmOverviewResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  cards: McsAdminVmMetricCard[];
  baPerformance: McsAdminVmBaPerformanceRow[];
  leadOwners: McsAdminVmLeadOwnerHealthRow[];
  campaigns: McsAdminVmCampaignRow[];
  compliance: McsAdminVmComplianceSummary;
  providerHealth: McsAdminVmProviderHealth[];
  notificationHooks: McsAdminVmNotificationHook[];
  teamNewsHooks: McsAdminVmTeamNewsHook[];
  warnings: string[];
}

export interface McsAdminVmOwnershipCorrectionPayload {
  leadId?: string | null;
  prospectId?: string | null;
  leadOwnerId?: string | null;
  vmCampaignId?: string | null;
  oldOwnerTmagId: string;
  newOwnerTmagId: string;
  oldSponsorTmagId: string;
  newSponsorTmagId: string;
  reason: string;
}

export interface McsAdminVmOwnershipCorrectionResponse {
  ok: true;
  applied: false;
  auditEntryId: string;
  note: string;
}

export interface McsAdminSuccessProfileSummary {
  tmagId: string;
  baName: string;
  sponsorTmagId: string | null;
  generatedAt: McsIsoTimestamp | null;
  primaryWhy: string | null;
  learningStyle: string[];
  supportAreas: string[];
  signedBy: string | null;
}

export interface McsAdminAgentMemoryStatus {
  collection: string;
  purpose: string;
  status: 'present' | 'missing' | 'unknown';
  recordCount: number | null;
  note: string;
}

export interface McsAdminAgentInteractionSummary {
  agentId: McsAgentId;
  events7d: number;
  lastEventAt: McsIsoTimestamp | null;
}

export interface McsAdminProjectionOutboxDeadLetter {
  outboxId: string;
  tier: 'knowledge' | 'operational' | string;
  target: 'neo4j' | 'chroma' | string;
  entityId: string;
  mongoCollection: string;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  nextAttemptAt: McsIsoTimestamp | null;
  updatedAt: McsIsoTimestamp | null;
}

export interface McsAdminSuccessProfileMemoryBridgeDraft {
  tmagId: string;
  ready: boolean;
  base: {
    id: string;
    type: 'document';
    schema_version: 1;
    namespace: 'momentum';
    source: 'momentum_admin_agent_memory_bridge';
    created_at: McsIsoTimestamp;
    title: string;
    origin_kind: 'system';
    service_name: 'admin_agent_memory_bridge';
  };
  semanticDocument: string;
  requiredWritePath: 'quadstack.write';
  options: { require: ['mongo', 'neo4j', 'chroma']; enforce_schema: true };
  note: string;
}

export interface McsAdminAgentOversightResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  successProfiles: McsAdminSuccessProfileSummary[];
  memoryStatus: McsAdminAgentMemoryStatus[];
  interactionSummary: McsAdminAgentInteractionSummary[];
  projectionOutboxDeadLetters: McsAdminProjectionOutboxDeadLetter[];
  bridgeDrafts: McsAdminSuccessProfileMemoryBridgeDraft[];
  warnings: string[];
}

export type McsSupportAgentKind = 'ivory' | 'michael' | 'steve_success';


export type McsSupportAgentInteractionKind =
  | 'invitation_draft'
  | 'followup_draft'
  | 'discovery_interview'
  | 'success_profile_generated'
  | 'training_recommendation'
  | 'daily_action_plan'
  | 'vm_campaign_recommendation'
  | 'crm_next_action';

export interface McsAgentInteractionRecord {
  interactionId: string;
  agent: McsSupportAgentKind;
  tmagId: TmagId;
  relatedProspectId: string | null;
  relatedCampaignId: string | null;
  kind: McsSupportAgentInteractionKind;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: McsIsoTimestamp;
}

export type McsDailyActionPrimaryFocus =
  | 'invite'
  | 'follow_up'
  | 'training'
  | 'vm_campaign'
  | 'event'
  | 'launch';

export interface McsDailyActionPlanItem {
  actionId: string;
  label: string;
  reason: string;
  priority: McsAgentRecommendationPriority;
  relatedProspectId: string | null;
  relatedCampaignId: string | null;
  suggestedAgent: McsSupportAgentKind | null;
  dueAt: McsIsoTimestamp | null;
  completedAt: McsIsoTimestamp | null;
}

export interface McsDailyActionPlan {
  planId: string;
  tmagId: TmagId;
  generatedAt: McsIsoTimestamp;
  primaryFocus: McsDailyActionPrimaryFocus;
  actions: McsDailyActionPlanItem[];
}

export interface McsSuccessProfileAgentContext {
  tmagId: TmagId;
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
  updatedAt: McsIsoTimestamp;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 · R0 — Runtime audit persistence (P7.2 schema / P7.3 write contract).
//
// Append-only extension of the 4.J audit substrate. A runtime audit event is a
// turn-lifecycle / gate-decision marker: which agent, on whose behalf, in which
// turn, made which transition — NEVER what was said. No body, no transcript, no
// PII beyond opaque ids. Persisted through the app-direct tripleStackWrite seam
// into the canonical `mcs_audit_log` substrate (NOT the external MCP tool server;
// ACR-0007). Writer: `appendRuntimeAuditEntry` in server/src/domain/auditLog.ts,
// canary-gated by RUNTIME_AUDIT_PERSISTENCE_ENABLED (default off).
// ─────────────────────────────────────────────────────────────────────────────

/** The internal runtime agents a runtime audit event can attribute a turn to. */
export type McsRuntimeAuditAgent = 'michael' | 'steve' | 'ivory';

/** Which kind of draft an emission event refers to (content is NOT stored). */
export type McsRuntimeAuditDraftKind = 'outcome' | 'guided_action';

/**
 * Runtime audit actions (P7.2 §3.2). `domain.entity.action` convention with a
 * `runtime` domain so the read surface isolates them by `actionPrefix: 'runtime.'`.
 */
export type McsRuntimeAuditAction =
  | 'runtime.turn.opened'
  | 'runtime.turn.draft_emitted'
  | 'runtime.turn.closed'
  | 'runtime.gate.allowed'
  | 'runtime.gate.denied'
  | 'runtime.persistence.enabled'
  | 'runtime.persistence.disabled';

/**
 * Runtime scope carried alongside a runtime audit entry (P7.2 §3.3). Ids only —
 * no body, no content, no PII. `turnId`+`action` form the idempotency dedup key.
 */
export interface McsRuntimeAuditContext {
  turnId: string;
  correlationId: string;
  agent: McsRuntimeAuditAgent;
  tmagId: string;
  tenantId: string;
  gate: string | null;
  draftKind: McsRuntimeAuditDraftKind | null;
}

/** Input to `appendRuntimeAuditEntry`. `reason` is a capped gate-denial cause only. */
export interface McsRuntimeAuditInput {
  action: McsRuntimeAuditAction;
  runtime: McsRuntimeAuditContext;
  severity?: McsAuditSeverity;
  reason?: string | null;
  timestamp?: McsIsoTimestamp;
}

/**
 * The persisted runtime audit row: a base `AuditLogEntry` (append-only 4.J
 * substrate) plus the dedicated `runtime` scope block (never overloads
 * `before`/`after`, which stay null for lifecycle markers).
 */
export interface McsRuntimeAuditLogEntry extends McsAuditLogEntry {
  runtime: McsRuntimeAuditContext;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 · App-memory envelope (P7.3 §4.2) — shared by R1 (outcomes),
// R2 (learning candidates), R3 (GraphRAG).
//
// The app-scoped replacement for the deprecated PERSISTENCE `quadstack.write` base
// envelope. App memory is app data in the `momentum` namespace, written through
// the app-direct tripleStackWrite seam (NEVER the external MCP tool server; ACR-0007).
// It preserves the Chat #135 anti-drift discipline (shared id, canonical typed
// envelope, deterministic ids, banned aliases) WITHOUT the PERSISTENCE-only fields
// (`chat_number`, `chat_registry_id`, `namespace: universal_PERSISTENCE`), which are
// forbidden on app records. All Phase 7 app memory is server-derived, so
// `originKind` is always 'system' and there is no `chat_number`.
// ─────────────────────────────────────────────────────────────────────────────

/** Canonical memory/lineage record types on the app's dedicated stack. */
export type McsMemoryType =
  | 'outcome'
  | 'learning_candidate'
  | 'graphrag_record'
  | 'graphrag_chunk';

/**
 * The app-memory envelope. camelCase (app-data convention, P10 §3.6). `id` is
 * shared across all three stores (Mongo `_id` / Neo4j `{id}` / Chroma id).
 *
 * Membership-first scope (DECISION_team_magnificent_membership_canonical_identity):
 * every record is scoped to Team Magnificent membership — `tenantId` + the
 * `teamKey: 'team_magnificent'` team scope, plus `tmagId` = the Team Magnificent
 * MEMBER id (value `TMAG-…`, the login). The app is exclusively for TM members (an
 * enrolled THREE BA in Kevin's downline); the THREE BA role is a
 * mirrored attribute of the member, never the identity.
 *
 * Banned on any app record: `chat_number`, `chat_registry_id`,
 * `namespace: 'universal_PERSISTENCE'`, and the `date`/`timestamp`/`chat`/
 * `synced_chat`/`start_time` aliases.
 */
export interface McsMemoryEnvelope {
  id: string;
  type: McsMemoryType;
  schemaVersion: number;
  namespace: 'momentum';
  source: string;
  createdAt: McsIsoTimestamp;
  title: string;
  originKind: 'system';
  serviceName: string;
  tenantId: string;
  /** Team Magnificent membership scope — the single tenant/team the app serves. */
  teamKey: 'team_magnificent';
  /** The Team Magnificent member id `tmagId` (value `TMAG-…`), when the record is member-scoped. */
  tmagId?: string;
  derivedFrom?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 · R1 — Outcome capture (P7.4).
//
// A BA-CONFIRMED, BA-scoped, team-scoped real-world outcome. The BA is the
// source of truth; the app records the confirmation — it never infers, scores,
// ranks, or qualifies an outcome. `enrolled_three` is a MIRROR of a BA report,
// never a programmatic THREE enrollment or handoff. No `.com` exposure; no
// income/compensation/cycle/placement values; no PII beyond opaque ids.
// ─────────────────────────────────────────────────────────────────────────────

/** Closed, enumerated outcome kinds. A new kind is a schema change, not free text. */
/**
 * Terminal outcome — how a prospect RESOLVED (P7.16 §1a). Small closed set; NOT
 * the journey milestones (watched video, attended webinar, …) which live in the
 * event log. `enrolled_iii` = enrolled into THREE = became a Brand
 * Ambassador (→ a Team Magnificent member in Kevin's downline). `became_customer`
 * = a product customer (not a member). The two are non-exclusive (a customer may
 * later enroll). `pending` = not yet resolved.
 */
export type McsOutcomeKind =
  | 'pending'
  | 'enrolled_iii'
  | 'became_customer'
  | 'declined';

/** A persisted outcome record: app-memory envelope + outcome fields (P7.4 §4.2). */
export interface McsOutcomeRecord extends McsMemoryEnvelope {
  type: 'outcome';
  kind: McsOutcomeKind;
  confirmedByTmagId: string;
  prospectId?: string;
  token?: string;
  outcomeAt: McsIsoTimestamp;
  note?: string | null;
  supersedesOutcomeId?: string | null;
}

/** Input to `appendOutcome`. The domain layer stamps id/envelope; BA supplies the fact. */
export interface McsOutcomeInput {
  kind: McsOutcomeKind;
  confirmedByTmagId: string;
  tenantId: string;
  prospectId?: string;
  token?: string;
  outcomeAt?: McsIsoTimestamp;
  note?: string | null;
  supersedesOutcomeId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 · R2 — Learning candidate pipeline (P7.5).
//
// A learning candidate is a PROPOSED, not-yet-approved unit of organizational
// learning derived from runtime signals / R1 outcomes. It is stored REVIEW-ONLY
// (separate from active knowledge collections) and is NEVER active knowledge.
// The one hard invariant: NO AGENT MAY APPROVE KNOWLEDGE. Only a human reviewer
// transitions a candidate to approved/rejected; agents/pipelines can only
// produce 'detected' candidates. There is no auto-promotion path.
// ─────────────────────────────────────────────────────────────────────────────

/** Candidate lifecycle. No `auto_approved`; no agent-drivable path to `approved`. */
export type McsLearningCandidateStatus =
  | 'detected'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'superseded';

/** Knowledge domains a candidate can belong to (KNOWLEDGE_EVOLUTION_RUNTIME §5.4). */
export type McsLearningDomain =
  | 'success'
  | 'training'
  | 'relationship'
  | 'performance'
  | 'organizational';

/**
 * A human review decision. `reviewedByTmagId` is a HUMAN reviewer id — never an
 * agent id. Written once; a changed decision supersedes with a new candidate.
 */
export interface McsLearningCandidateReview {
  decision: 'approved' | 'rejected';
  reviewedByTmagId: string;
  reviewedAt: McsIsoTimestamp;
  reason?: string | null;
  approvalReferenceId?: string | null;
}

/** A persisted learning candidate: app-memory envelope + candidate fields (P7.5 §4.2). */
export interface McsLearningCandidateRecord extends McsMemoryEnvelope {
  type: 'learning_candidate';
  status: McsLearningCandidateStatus;
  domain: McsLearningDomain;
  language: 'en' | 'es';
  proposedSummary: string;
  sourceOutcomeIds: string[];
  sourceSignalIds: string[];
  review?: McsLearningCandidateReview | null;
  supersedesCandidateId?: string | null;
}

/** Input to `appendLearningCandidate`. Always produces a `detected` candidate. */
export interface McsLearningCandidateInput {
  tenantId: string;
  domain: McsLearningDomain;
  language: 'en' | 'es';
  proposedSummary: string;
  sourceOutcomeIds?: string[];
  sourceSignalIds?: string[];
  tmagId?: string;
  supersedesCandidateId?: string | null;
}

/** Input to `reviewLearningCandidate` — a HUMAN review decision (P7.5 §5.1). */
export interface McsLearningCandidateReviewInput {
  candidateId: string;
  decision: 'approved' | 'rejected';
  reviewedByTmagId: string;
  reason?: string | null;
  approvalReferenceId?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 · R3 — GraphRAG (P7.6).
//
// Derived-memory records + retrieval over the app's OWN dedicated stores,
// app-direct. A GraphRAG record indexes an ACTIVE, approved Knowledge Object for
// semantic recall (Chroma) stitched to lineage (Neo4j) by the shared id. NO
// external MCP tool server, no `quadstack.write`, no `universal_PERSISTENCE` (ACR-0007).
// Only records with `retrievalReady: true` and an active knowledge object are
// served; superseded/archived/review-only records are excluded. The Context
// Manager is the sole caller — agents never read/write GraphRAG stores directly.
// ─────────────────────────────────────────────────────────────────────────────

/** Embedding model — all app vectors are 384-dim all-MiniLM-L6-v2 (P10 §7.3). */
export type McsEmbeddingModel = 'all-MiniLM-L6-v2';

/** A persisted GraphRAG derived-memory record: app-memory envelope + fields (P7.6 §4). */
export interface McsGraphRagRecord extends McsMemoryEnvelope {
  type: 'graphrag_record' | 'graphrag_chunk';
  knowledgeObjectId: string;
  version: number;
  domain: McsLearningDomain;
  language: 'en' | 'es';
  summary: string;
  model: McsEmbeddingModel;
  modelVersion: string;
  retrievalReady: boolean;
}

/** Input to `appendGraphRagRecord`. */
export interface McsGraphRagInput {
  knowledgeObjectId: string;
  version: number;
  tenantId: string;
  domain: McsLearningDomain;
  language: 'en' | 'es';
  summary: string;
  modelVersion: string;
  title?: string;
  type?: 'graphrag_record' | 'graphrag_chunk';
  retrievalReady?: boolean;
  derivedFrom?: string[];
}

/** A GraphRAG retrieval query (issued only by the Context Manager). */
export interface McsGraphRagQuery {
  tenantId: string;
  domain: McsLearningDomain;
  language: 'en' | 'es';
  queryText: string;
  topK?: number;
}

/** One retrieval hit — the shared id stitches Chroma/Neo4j/Mongo. */
export interface McsGraphRagHit {
  id: string;
  knowledgeObjectId: string;
  version: number;
  summary: string;
  distance: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7 · P7.11 — Learning observability (aggregate metrics).
//
// AGGREGATE metrics over the persisted R0-R2 rungs, for the admin surface only.
// Never a manual review queue, never `.com`-surfaced. Pure counts + rates — no
// PII, no scoring/ranking of BAs or prospects. Consumes the runtime-audit /
// outcome / learning-candidate records; the fetch path is the existing admin
// read surface (activation step).
// ─────────────────────────────────────────────────────────────────────────────

/** Aggregate snapshot of the learning loop's health (admin-only). */
export interface McsLearningObservabilitySnapshot {
  tenantId: string;
  generatedAt: McsIsoTimestamp;
  runtimeAudit: {
    total: number;
    gateAllowed: number;
    gateDenied: number;
    /** denials ÷ (allowed + denied); 0 when no gate events. */
    gateDenyRate: number;
  };
  outcomes: {
    total: number;
    byKind: Record<McsOutcomeKind, number>;
  };
  learningCandidates: {
    total: number;
    detected: number;
    approved: number;
    rejected: number;
    /** approvals ÷ (approved + rejected); 0 when nothing reviewed. */
    approvalRate: number;
  };
}

// ----------------------------------------------------------------------------
// BRIEF 5 - Three-way call scheduling v1.
//
// UPLINE-CHAIN routing: a member may book any upline member who has availability
// set. Availability is owner-local recurring weekly time; bookings store UTC.
// SMS remains dormant for v1; the in-app calendar rail is the notification
// surface.
// ----------------------------------------------------------------------------

export type McsThreeWayDayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface McsThreeWayAvailabilityWindow {
  windowId: string;
  dayOfWeek: McsThreeWayDayOfWeek;
  /** Owner-local HH:mm, 24-hour clock. */
  startTime: string;
  /** Owner-local HH:mm, 24-hour clock. */
  endTime: string;
  active: boolean;
}

export interface McsThreeWaySponsorAvailabilityRecord {
  availabilityId: string;
  ownerTmagId: string;
  ownerName: string;
  timezone: string;
  windows: McsThreeWayAvailabilityWindow[];
  createdAt: McsIsoTimestamp;
  updatedAt: McsIsoTimestamp;
}

export interface McsThreeWayAvailabilitySlot {
  startAt: McsIsoTimestamp;
  endAt: McsIsoTimestamp;
  ownerTimezone: string;
  localDate: string;
  localStartTime: string;
}

export interface McsThreeWayBookableUpline {
  tmagId: string;
  fullName: string;
  firstName: string;
  phone: string | null;
  timezone: string;
  windows: McsThreeWayAvailabilityWindow[];
  slots: McsThreeWayAvailabilitySlot[];
}

export interface McsThreeWayAvailabilityResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  horizonDays: number;
  myAvailability: McsThreeWaySponsorAvailabilityRecord | null;
  bookableUplines: McsThreeWayBookableUpline[];
}

export interface McsThreeWaySetAvailabilityPayload {
  timezone: string;
  windows: Array<Partial<McsThreeWayAvailabilityWindow>>;
}

export interface McsThreeWaySetAvailabilityResponse {
  ok: true;
  availability: McsThreeWaySponsorAvailabilityRecord;
}

export type McsThreeWayBookingStatus = 'booked' | 'cancelled';

export interface McsThreeWayBookingRecord {
  bookingId: string;
  bookerTmagId: string;
  bookerName: string;
  sponsorTmagId: string;
  sponsorName: string;
  startAt: McsIsoTimestamp;
  endAt: McsIsoTimestamp;
  ownerTimezone: string;
  bookerTimezone: string | null;
  prospectNote: string | null;
  status: McsThreeWayBookingStatus;
  createdAt: McsIsoTimestamp;
  cancelledAt: McsIsoTimestamp | null;
  cancelledByTmagId: string | null;
  notificationChannel: 'in_app';
}

export interface McsThreeWayBookingView extends McsThreeWayBookingRecord {
  myRole: 'booker' | 'sponsor' | 'both';
}

export interface McsThreeWayBookingsResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  bookings: McsThreeWayBookingView[];
}

export interface McsThreeWayBookPayload {
  sponsorTmagId: string;
  startAt: McsIsoTimestamp;
  prospectNote?: string | null;
}

export interface McsThreeWayBookResponse {
  ok: true;
  booking: McsThreeWayBookingRecord;
}

export interface McsThreeWayCancelResponse {
  ok: true;
  booking: McsThreeWayBookingRecord;
}

// Product Gallery / Training Content Videos (Brief 9, 2026-07-04)

export type McsContentVideoAudience = 'member' | 'prospect' | 'both';

export interface McsContentVideoRecord {
  _id?: string;
  contentVideoId: string;
  section: string;
  title: string;
  youtubeId: string | null;
  url: string | null;
  description: string;
  sortOrder: number;
  audience: McsContentVideoAudience;
  active: boolean;
  createdAt: string;
  createdByTmagId: string | null;
  updatedAt: string;
  updatedByTmagId: string | null;
  source: string | null;
}

export interface McsContentVideoSection {
  section: string;
  videos: McsContentVideoRecord[];
}

export interface McsContentVideosResponse {
  ok: true;
  sections: McsContentVideoSection[];
}

export type McsContentVideosAdminListResponse = McsContentVideosResponse;

export interface McsContentVideoUpsertPayload {
  section: string;
  title: string;
  youtubeId?: string | null;
  url?: string | null;
  description: string;
  sortOrder: number;
  audience: McsContentVideoAudience;
  active?: boolean;
}

export interface McsContentVideoMutationResponse {
  ok: true;
  video: McsContentVideoRecord;
}

export interface McsContentVideoReorderItem {
  contentVideoId: string;
  sortOrder: number;
}

export interface McsContentVideoReorderPayload {
  items: McsContentVideoReorderItem[];
}

export interface McsContentVideoReorderResponse {
  ok: true;
  videos: McsContentVideoRecord[];
}

export type McsAdminConsistencyOverall = 'green' | 'yellow' | 'red';

export interface McsAdminConsistencyTotals {
  halfWrites: number;
  staleProjections: number;
  failedProjections: number;
  orphanRecords: number;
  reconciliationIssues: number;
  warnings: number;
}

export interface McsAdminConsistencyHalfWriteRow {
  specKey: string;
  id: string;
  mongoCollection: string;
  neo4jStatus: 'missing' | 'error';
  detail: string;
}

export interface McsAdminConsistencyProjectionRow {
  outboxId: string;
  tier: 'knowledge' | 'operational' | string;
  target: 'neo4j' | 'chroma' | string;
  status: 'pending' | 'failed' | string;
  entityId: string;
  mongoCollection: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: McsIsoTimestamp | null;
  updatedAt: McsIsoTimestamp | null;
  ageMinutes: number;
  stale: boolean;
  lastError: string | null;
}

export interface McsAdminConsistencyOrphanRecord {
  id: string;
  detail: string;
}

export interface McsAdminConsistencyOrphanCategory {
  key: string;
  label: string;
  records: McsAdminConsistencyOrphanRecord[];
  error: string | null;
}

export interface McsAdminConsistencyReconciliationSpec {
  key: string;
  label: string;
  scanned: number;
  issueCount: number;
}

export interface McsAdminConsistencyReconciliationIssue {
  specKey: string;
  id: string;
  mongoCollection: string;
  issues: string[];
  neo4jStatus: string;
  chromaStatus: string;
  detail: string;
}

export interface McsAdminConsistencyReportResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  overall: McsAdminConsistencyOverall;
  totals: McsAdminConsistencyTotals;
  staleProjectionMinutes: number;
  reconciliation: {
    limitPerSpec: number;
    specs: McsAdminConsistencyReconciliationSpec[];
    issues: McsAdminConsistencyReconciliationIssue[];
  };
  halfWrites: McsAdminConsistencyHalfWriteRow[];
  staleProjections: McsAdminConsistencyProjectionRow[];
  orphanCategories: McsAdminConsistencyOrphanCategory[];
  warnings: string[];
}

export type McsAdminAgentHealthStatus = 'healthy' | 'degraded' | 'planned' | 'error';
export interface McsAdminAgentHealthCard {
  agentKey: import('./agent-registry.js').McsPlatformAgentKey;
  displayName: string;
  kind: import('./agent-registry.js').McsPlatformAgentKind;
  status: McsAdminAgentHealthStatus;
  activeSkills: number;
  plannedSkills: number;
  activeTemplates: number;
  plannedTemplates: number;
  events7d: number;
  lastEventAt: McsIsoTimestamp | null;
  behaviorSource: string;
  issues: string[];
  debug: { humanActionOwner: string; surfaces: readonly string[]; owns: readonly string[]; doesNotOwn: readonly string[] };
}
export interface McsAdminAgentHealthResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  cards: McsAdminAgentHealthCard[];
  summary: Record<McsAdminAgentHealthStatus, number>;
  warnings: string[];
}

/** P1-58 read-only admin CRM integrity report. */
export type McsAdminCrmIntegrityCategory =
  | 'stuck'
  | 'duplicate'
  | 'orphan'
  | 'inconsistent'
  | 'ambiguous';

export interface McsAdminCrmIntegrityFinding {
  category: McsAdminCrmIntegrityCategory;
  code: string;
  crmRecordId: string | null;
  prospectId: string | null;
  sponsorTmagId: string | null;
  detail: string;
  evidence: Record<string, unknown>;
  repairPolicy: 'report_only';
}

export interface McsAdminCrmIntegrityReportResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  policy: 'report_only';
  stuckDays: number;
  scanned: { crmRecords: number; followUps: number; prospects: number };
  totals: Record<McsAdminCrmIntegrityCategory, number> & {
    findings: number;
    cleanupCandidates: number;
  };
  cleanupPreview: {
    dryRun: true;
    planned: number;
    actions: Array<{ kind: string; prospectId: string; sponsorTmagId: string; reason: string }>;
    errors: Array<{ prospectId: string; kind: string; message: string }>;
  };
  findings: McsAdminCrmIntegrityFinding[];
}

export interface McsAdminOutboxDrainSummary {
  scanned: number;
  landed: number;
  reEnqueued: number;
  deadLettered: number;
}

export interface McsAdminOutboxHealthResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  worker: {
    started: boolean;
    inFlight: boolean;
    startedAt: McsIsoTimestamp | null;
    lastTickAt: McsIsoTimestamp | null;
    lastSuccessAt: McsIsoTimestamp | null;
    lastErrorAt: McsIsoTimestamp | null;
    lastError: string | null;
    intervalMs: number;
    drainLimit: number;
    lastSummary: McsAdminOutboxDrainSummary | null;
    totals: McsAdminOutboxDrainSummary;
  };
  queue: {
    total: number;
    pending: number;
    due: number;
    scheduled: number;
    deadLettered: number;
    attempts: number;
    oldestPendingAt: McsIsoTimestamp | null;
    byTier: { knowledge: number; operational: number };
    byTarget: { neo4j: number; chroma: number };
  };
  truncated: boolean;
}

export interface McsFlowCorrelation {
  correlationId: string;
  rootKind: 'invitation' | 'vm_rvm';
  rootId: string;
  tokenId: string | null;
  invitationId: string | null;
  prospectId: string | null;
  crmRecordId: string | null;
  vmCampaignId: string | null;
  leadId: string | null;
}

export interface McsAdminEntitlementAuditResponse {
  ok: true;
  generatedAt: McsIsoTimestamp;
  policy: 'read_only_audit';
  definitions: Array<{ entitlement: string; storage: string; gate: string; protectedRoutes: number; grantedPrincipals: number | null }>;
  adminAllowlist: string[];
  memberGrants: Array<{ tmagId: string; threeBaId: string | null; fullName: string; entitlement: string; recognized: boolean; source: 'member_record' }>;
  unknownGrants: Array<{ tmagId: string; threeBaId: string | null; fullName: string; entitlement: string; recognized: boolean; source: 'member_record' }>;
  totals: { membersScanned: number; memberGrants: number; unknownGrants: number; routesClassified: number };
  warnings: string[];
}

export interface McsAuditEventTaxonomy {
  version: 1;
  namespace: string;
  category: 'read' | 'create' | 'update' | 'delete' | 'lifecycle' | 'security' | 'delivery' | 'governance' | 'reporting' | 'runtime' | 'unknown';
  operation: string;
  impact: 'observation' | 'mutation' | 'destructive' | 'control';
  outcome: 'succeeded' | 'blocked' | 'failed' | 'queued' | 'unknown';
  sensitivity: 'routine' | 'sensitive' | 'governance_critical';
  reasonRequired: boolean;
}

export interface McsTaxonomizedAuditLogEntry extends McsAuditLogEntry {
  taxonomy: McsAuditEventTaxonomy;
}

export interface McsAdminVmQueueHealthRow {
  jobId: string;
  kind: string;
  status: string;
  condition: 'stuck_processing' | 'dead_lettered' | 'failed' | 'retry_due';
  attempts: number;
  maxAttempts: number;
  availableAt: McsIsoTimestamp | null;
  lockedAt: McsIsoTimestamp | null;
  failedAt: McsIsoTimestamp | null;
  failureReason: string | null;
  vmCampaignId: string | null;
  leadId: string | null;
  ageMs: number | null;
}

export interface McsAdminVmQueueHealth {
  policy: 'report_only';
  stuckAfterMs: number;
  counts: {
    total: number;
    queued: number;
    processing: number;
    complete: number;
    skipped: number;
    failed: number;
    deadLettered: number;
    retryDue: number;
    stuckProcessing: number;
  };
  oldestQueuedAt: McsIsoTimestamp | null;
  oldestLockedAt: McsIsoTimestamp | null;
  findings: McsAdminVmQueueHealthRow[];
}

export interface McsAdminVmQueueHealthOverviewResponse extends McsAdminVmOverviewResponse {
  queueHealth: McsAdminVmQueueHealth;
}
