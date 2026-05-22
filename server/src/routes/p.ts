/**
 * GET /api/p/:token — the single prospect-facing resolver endpoint.
 *
 * Per COM Design Section A.1, every prospect-facing page on .com is served
 * from /p/{token}. The client calls this endpoint to learn what to render:
 *   - which BA invited (always present per locked-spec Part 3.9 — never
 *     anonymous)
 *   - prospect first name + last initial + location
 *   - current funnel state (drives presentation vs. dashboard render)
 *   - position number (null pre-video_complete)
 *
 * Status codes:
 *   200 — token resolved cleanly; render the matching surface
 *   404 — unknown token (show invalid-token branded message per F.1)
 *   410 — expired (8-week window elapsed) per E.1 / F.2
 *   409 — enrolled — the token has done its job; show welcome stub per E.2
 *   500 — unexpected (network/db); client shows F.4-style soft degrade
 *
 * No auth required. The token IS the identity surface; if a leaked token
 * gives a third party the page, they see exactly what the prospect would see
 * (COM Design Section E.3). Sponsor immutability is enforced at the data
 * layer — this endpoint never accepts a sponsorBaId input (locked-spec 3.5).
 */

import { Router } from 'express';
import type {
  CallbackIntent,
  CallbackRequestPayload,
  CallbackRequestResponse,
  EnrolledResponse,
  ExpiredResponse,
  ResolvedTokenPayload,
  VideoEventKind,
  VideoEventPayload,
  VideoEventResponse,
  TokenState,
} from '@momentum/shared';
import { findTokenRecord, isTokenExpired, transitionTokenState } from '../domain/tokens.js';
import { findProspectById, lastInitialOf } from '../domain/prospects.js';
import { findBAByBaId, type BARecord } from '../domain/ba.js';
import { buildHoldingTankSnapshot, placeProspect } from '../domain/holdingTank.js';
import { createCallbackRequest } from '../domain/callbackRequest.js';
import { alertBaVideoCompleted } from '../domain/invitations.js';
import { findNextUpcomingEvent } from '../domain/webinarEvent.js';
import { createWebinarReservation } from '../domain/webinarReservation.js';
import { computeTeamStats } from '../domain/teamStats.js';
import { subscribePlacements } from '../services/poolEvents.js';
import type { HoldingTankSnapshot, PlacementEvent, TeamStatsResponse, WebinarReservationPayload, WebinarReservationResponse } from '@momentum/shared';

export const prospectTokenRoutes: Router = Router();

// Dr. Dan video, locked-spec Part 4.8.
const DR_DAN_VIDEO_URL = 'https://www.youtube.com/embed/89wRvqx1d8M';

// Webinar slot — Mondays & Thursdays 5pm Pacific (locked Chat #116).
// This static descriptor is the fallback text for the dashboard's webinar
// copy; the live countdown + reservation target come from the actual next
// webinar_events record via findNextUpcomingEvent(), not this constant.
const WEBINAR = {
  dayOfWeek: 'Mondays & Thursdays',
  timeOfDay: '5:00 PM',
  timezone: 'America/Los_Angeles',
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Normalize a stored BA phone string to E.164 (e.g. "+13235551234").
 * Per locked-spec Part 4.9 the F.2 expired view receives phoneE164 raw
 * (no display formatting); the client formats for human display and uses
 * the same string in `tel:` links and SMS draft helpers.
 *
 * Rules (conservative — return null on anything we can't trust):
 *   - Strip everything except digits and a leading '+'.
 *   - If the input starts with '+', keep as-is after digit-only strip.
 *   - 10 digits → assume US/Canada NANP, prepend '+1'.
 *   - 11 digits starting with '1' → prepend '+'.
 *   - Anything else (empty, too short, too long without a '+') → null.
 */
function phoneToE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/**
 * Build the locked-spec Part 4.9 410 expired payload from a BA record.
 * Phone is normalized to E.164 raw; null if the BA has no phone on record.
 */
function buildExpiredResponse(ba: BARecord, expiredAt: string): ExpiredResponse {
  return {
    error: 'expired',
    expiredAt,
    ba: {
      firstName: ba.firstName,
      lastInitial: ba.lastName.charAt(0).toUpperCase(),
      phoneE164: phoneToE164(ba.phone),
    },
  };
}

/**
 * Build the locked-spec Part 4.9 409 enrolled payload from a BA record.
 * No phone (prospect already has the BA's number from the original invite).
 */
function buildEnrolledResponse(ba: BARecord): EnrolledResponse {
  return {
    error: 'enrolled',
    ba: {
      firstName: ba.firstName,
      lastName: ba.lastName,
      fullName: `${ba.firstName} ${ba.lastName}`,
    },
  };
}

/**
 * Resolve a token's sponsoring BA, used by every 409/410 branch in every
 * route in this module. Sponsor immutability (locked-spec 3.5): the BA is
 * looked up from the token record's sponsorBaId only — never from the
 * request body, query, or headers.
 *
 * Returns null only when the BA record is genuinely missing — callers
 * fall through to 404 rather than rendering a sponsorless page (locked-
 * spec 3.9, never anonymous; Part 5 sponsor-leaves question still open).
 */
async function findSponsorBA(sponsorBaId: string): Promise<BARecord | null> {
  return findBAByBaId(sponsorBaId);
}


prospectTokenRoutes.get('/:token', async (req, res) => {
  const { token } = req.params;

  if (!token || token.length < 4) {
    return res.status(404).json({ error: 'invalid_token' });
  }

  try {
    const tokenRecord = await findTokenRecord(token);
    if (!tokenRecord) return res.status(404).json({ error: 'invalid_token' });

    // ─── 409 enrolled ─── locked-spec Part 4.9 Branch 4
    if (tokenRecord.state === 'enrolled') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(409).json(buildEnrolledResponse(ba));
    }

    // ─── 410 expired ─── locked-spec Part 4.9 Branch 3 + lazy-flush rule
    //
    // Already-expired tokens return 410 immediately. Time-expired but
    // still-non-terminal tokens are flushed inline (triple-stack write)
    // BEFORE responding so the read path is self-healing and the flush
    // is a real lifecycle event — not a synthetic per-request error.
    if (tokenRecord.state === 'expired') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }
    if (isTokenExpired(tokenRecord)) {
      // Lazy-flush: forward-transition to 'expired' before responding.
      // transitionTokenState is idempotent and forward-only; if a parallel
      // request raced ahead, the second call is a no-op.
      await transitionTokenState(token, 'expired');
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }

    const [prospect, ba, nextEvent] = await Promise.all([
      findProspectById(tokenRecord.prospectId),
      findBAByBaId(tokenRecord.sponsorBaId),
      findNextUpcomingEvent(),
    ]);

    if (!prospect) {
      // Token exists but prospect record missing — treat as invalid.
      return res.status(404).json({ error: 'invalid_token' });
    }
    if (!ba) {
      // Sponsor BA missing — the locked-spec Part 5 'sponsor-leaves card
      // behavior' question covers this. Until that's decided, refuse to
      // render a page without the inviting BA per Part 3.9.
      return res.status(404).json({ error: 'invalid_token' });
    }

    const payload: ResolvedTokenPayload = {
      token: tokenRecord.token,
      state: tokenRecord.state,
      prospect: {
        firstName: prospect.firstName,
        lastInitial: prospect.lastInitial || lastInitialOf(prospect.lastName),
        city: prospect.location.city,
        stateOrRegion: prospect.location.stateOrRegion,
        country: prospect.location.country,
        positionNumber: prospect.positionNumber,
        placedAt: prospect.placedAt,
        expiresAt: prospect.expiresAt,
      },
      ba: {
        baId: ba.baId,
        firstName: ba.firstName,
        lastName: ba.lastName,
        lastInitial: ba.lastName.charAt(0).toUpperCase(),
        fullName: `${ba.firstName} ${ba.lastName}`,
      },
      videoUrl: DR_DAN_VIDEO_URL,
      webinar: WEBINAR,
      // Chat #115: carry the next upcoming event so Section 6's Countdown
      // can render a real ticking countdown server-side resolved. null
      // when no upcoming event is seeded; client renders a static fallback.
      nextEvent: nextEvent
        ? {
            eventId: nextEvent.eventId,
            scheduledFor: nextEvent.scheduledFor,
            hosts: nextEvent.hosts,
          }
        : null,
    };

    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/p/:token] resolve failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/p/:token/video-event
 *
 * The .com client reports a video milestone. The server advances the
 * token lifecycle forward (idempotent, never backward); on `complete`,
 * the prospect is silently placed in the team-wide holding tank with a
 * monotonic position number (locked-spec Part 3.2, 4.5; Chat #84 + #105
 * keystone).
 *
 * Body: { kind: 'started' | 'quarter' | 'half' | 'three_quarter' | 'complete' }
 *
 * Status codes:
 *   200 — event accepted; response carries the (possibly unchanged)
 *         token state and, if placed, the assigned positionNumber
 *   400 — missing/invalid `kind`
 *   404 — unknown token
 *   409 — token already enrolled (terminal forward state)
 *   410 — token expired (8-week window elapsed)
 *   500 — unexpected
 *
 * Idempotency:
 *   Replaying the same event is safe. Replaying an earlier event after
 *   a later one is a no-op (transitionTokenState rejects regression).
 *   placeProspect is itself idempotent on prospectId.
 *
 * Sponsor immutability (locked-spec Part 3.5):
 *   sponsorBaId is read exclusively from the token record. No request
 *   field can influence which leg/sponsor a placement belongs to.
 */

const VIDEO_EVENT_KINDS: readonly VideoEventKind[] = [
  'started',
  'quarter',
  'half',
  'three_quarter',
  'complete',
];

/** Map each milestone to the token state it transitions toward. */
const KIND_TO_STATE: Record<VideoEventKind, TokenState> = {
  started: 'video_started',
  quarter: 'video_quarter',
  half: 'video_half',
  three_quarter: 'video_three_quarter',
  complete: 'video_complete',
};

prospectTokenRoutes.post('/:token/video-event', async (req, res) => {
  const { token } = req.params;
  const body = req.body as Partial<VideoEventPayload>;

  if (!token || token.length < 4) {
    return res.status(404).json({ error: 'invalid_token' });
  }
  if (!body?.kind || !VIDEO_EVENT_KINDS.includes(body.kind)) {
    return res.status(400).json({ error: 'invalid_kind' });
  }

  try {
    const tokenRecord = await findTokenRecord(token);
    if (!tokenRecord) return res.status(404).json({ error: 'invalid_token' });

    // ─── 409 enrolled ─── locked-spec Part 4.9 Branch 4
    if (tokenRecord.state === 'enrolled') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(409).json(buildEnrolledResponse(ba));
    }

    // ─── 410 expired ─── locked-spec Part 4.9 Branch 3 + lazy-flush rule
    if (tokenRecord.state === 'expired') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }
    if (isTokenExpired(tokenRecord)) {
      await transitionTokenState(token, 'expired');
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }

    // Forward-only state transition. If the inbound event is stale this
    // returns the unchanged state and we still return the current position
    // (if any) so the client converges.
    const targetState = KIND_TO_STATE[body.kind];
    const transition = await transitionTokenState(token, targetState);

    // Placement only happens at video_complete. We check the EVENT, not
    // the state-after-transition, so a replayed 'complete' on an already-
    // complete token still walks placeProspect's idempotency check.
    let positionNumber: number | null = null;
    let placedAt: string | null = null;

    if (body.kind === 'complete') {
      const prospect = await findProspectById(tokenRecord.prospectId);
      if (!prospect) {
        // The token exists but the prospect record is missing. Same
        // condition GET treats as invalid_token. Don't half-place.
        return res.status(404).json({ error: 'invalid_token' });
      }

      const result = await placeProspect({
        prospectId: prospect.prospectId,
        sponsorBaId: tokenRecord.sponsorBaId,
        prospectExpiresAt: prospect.expiresAt,
        firstName: prospect.firstName,
        lastInitial: prospect.lastInitial || lastInitialOf(prospect.lastName),
        city: prospect.location.city,
        stateOrRegion: prospect.location.stateOrRegion,
      });
      positionNumber = result.positionNumber;
      placedAt = result.placedAt;

      // Chat #119: fire the BA alert ONLY on first placement (never on
      // idempotent replays). The BA is read from the token's sponsorBaId
      // (locked-spec 3.5); alert is best-effort and never blocks the
      // 200 response to the prospect.
      if (!result.alreadyPlaced) {
        const ba = await findSponsorBA(tokenRecord.sponsorBaId);
        await alertBaVideoCompleted({
          prospectId: prospect.prospectId,
          sponsorBaId: tokenRecord.sponsorBaId,
          prospectFirstName: prospect.firstName,
          prospectLastInitial:
            prospect.lastInitial || lastInitialOf(prospect.lastName),
          positionNumber: result.positionNumber,
          baPhone: ba?.phone ?? null,
        });
      }
    } else if (tokenRecord.state === 'video_complete') {
      // Stale earlier milestone arrived after placement already happened.
      // Carry the existing position forward so the client stays in sync.
      const prospect = await findProspectById(tokenRecord.prospectId);
      positionNumber = prospect?.positionNumber ?? null;
      placedAt = prospect?.placedAt ?? null;
    }

    const response: VideoEventResponse = {
      token,
      state: transition.state,
      positionNumber,
      placedAt,
    };
    return res.status(200).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/p/:token/video-event] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * POST /api/p/:token/callback-request
 *
 * The prospect submitted the soft CTA on Section 10 of tm-video-
 * presentation OR Section 6 of tm-prospect-dashboard. Three intent radios:
 *   - 'interested_tell_me_more'    (Section 10 pre-video, Section 6 dashboard)
 *   - 'have_questions'             (Section 10 pre-video, Section 6 dashboard)
 *   - 'ready_to_join'              (Section 6 dashboard ONLY — added Chat #113)
 *
 * The 'ready_to_join' intent surfaces only after video_complete, when the
 * prospect has seen the team forming around them on the dashboard. On the
 * pre-video presentation page (Section 10), only the two softer intents
 * appear; offering "ready to join" before the prospect has seen the team
 * line would be premature (Chat #109 lock + Chat #113 dashboard port).
 *
 * No phone/best-time fields. The BA already has the prospect's contact
 * info; collecting it again would imply the system doesn't trust the
 * BA-prospect relationship. The intent is the message.
 *
 * Sponsor immutability (locked-spec Part 3.5):
 *   The sponsoring BA is read from the token record only; no field in
 *   the request body can influence which BA gets the SMS.
 *
 * Status codes:
 *   200 — request accepted, record created, SMS attempted (best-effort)
 *   400 — missing/invalid intent
 *   404 — unknown token (or prospect missing for token)
 *   409 — token enrolled
 *   410 — token expired
 *   500 — unexpected (triple-stack write failure)
 *
 * Note on token state: submission does NOT transition the token state.
 * Per Chat #105 spec amendment, callback_requested is not a lifecycle
 * state — it's an independent intent record. A prospect can submit a
 * callback request before OR after video_complete, can submit multiple
 * over time, and the token continues its own funnel rail unaffected.
 */

const CALLBACK_INTENTS: readonly CallbackIntent[] = [
  'interested_tell_me_more',
  'have_questions',
  'ready_to_join',
];

prospectTokenRoutes.post('/:token/callback-request', async (req, res) => {
  const { token } = req.params;
  const body = req.body as Partial<CallbackRequestPayload>;

  if (!token || token.length < 4) {
    return res.status(404).json({ error: 'invalid_token' });
  }
  if (!body?.intent || !CALLBACK_INTENTS.includes(body.intent)) {
    return res.status(400).json({ error: 'invalid_intent' });
  }

  try {
    const tokenRecord = await findTokenRecord(token);
    if (!tokenRecord) return res.status(404).json({ error: 'invalid_token' });

    // ─── 409 enrolled ─── locked-spec Part 4.9 Branch 4
    if (tokenRecord.state === 'enrolled') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(409).json(buildEnrolledResponse(ba));
    }

    // ─── 410 expired ─── locked-spec Part 4.9 Branch 3 + lazy-flush rule
    if (tokenRecord.state === 'expired') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }
    if (isTokenExpired(tokenRecord)) {
      await transitionTokenState(token, 'expired');
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }

    const [prospect, ba] = await Promise.all([
      findProspectById(tokenRecord.prospectId),
      findBAByBaId(tokenRecord.sponsorBaId),
    ]);
    if (!prospect) {
      return res.status(404).json({ error: 'invalid_token' });
    }
    if (!ba) {
      // Sponsor BA missing — same posture as GET resolver (locked-spec
      // Part 5 sponsor-leaves question still open). Until that question
      // is decided, refuse to land a callback request that can't route.
      return res.status(404).json({ error: 'invalid_token' });
    }

    const result = await createCallbackRequest({
      token: tokenRecord.token,
      prospectId: prospect.prospectId,
      prospectFirstName: prospect.firstName,
      prospectLastInitial: prospect.lastInitial || lastInitialOf(prospect.lastName),
      sponsorBaId: tokenRecord.sponsorBaId,
      baFirstName: ba.firstName,
      baPhone: ba.phone || null,
      intent: body.intent,
    });

    const response: CallbackRequestResponse = {
      ok: true,
      intent: body.intent,
      baFirstName: ba.firstName,
      createdAt: result.createdAt,
    };
    return res.status(200).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/p/:token/callback-request] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /api/p/:token/stream — the live placement SSE channel
 * (Chat #114 dashboard port — recovered architecture from Chat #84/#94).
 *
 * Per locked-spec 4.4 the prospect dashboard's behind-you counter and
 * position-stack ticker are powered by a single Server-Sent Events
 * stream. One connection per viewer; one in-process emitter fans every
 * team-wide placement out to every connected viewer.
 *
 * Token gating: same 200/404/409/410 contract as GET /api/p/:token,
 * minus the resolved payload. SSE handshake is HTTP, so the route can
 * return a normal JSON error response before flipping to the
 * text/event-stream content-type. Once flipped, any error is sent as
 * an SSE comment line and the connection closes.
 *
 * Snapshot semantics (locked-spec 3.4):
 *   - On open, server emits one `snapshot` event with globalMaxPosition
 *     + the most-recent N placements.
 *   - On every subsequent team-wide placement, server emits one
 *     `placement` event.
 *   - 30-second `ping` keepalive so reverse proxies don't drop idle
 *     connections.
 */

/** Number of recent placements to include in the snapshot event. */
const SSE_SNAPSHOT_RECENT_LIMIT = 40;
/** Heartbeat interval. Long enough to be cheap, short enough to beat proxies. */
const SSE_PING_INTERVAL_MS = 30_000;

/** Format an SSE frame as the wire protocol requires. */
function sseFrame(event: string, data: unknown, id?: string): string {
  const lines: string[] = [];
  if (id) lines.push(`id: ${id}`);
  lines.push(`event: ${event}`);
  lines.push(`data: ${JSON.stringify(data)}`);
  lines.push('');
  lines.push('');
  return lines.join('\n');
}

prospectTokenRoutes.get('/:token/stream', async (req, res) => {
  const { token } = req.params;
  if (!token || token.length < 4) {
    return res.status(404).json({ error: 'invalid_token' });
  }

  // Resolve the token first — same 4-branch contract as the page resolver.
  // We do NOT block the stream on prospect placement (a prospect may open
  // the dashboard before placement completes if they hit complete mid-flight);
  // but enrolled/expired/invalid must close the connection cleanly.
  let tokenRecord;
  try {
    tokenRecord = await findTokenRecord(token);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/p/:token/stream] resolve failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
  if (!tokenRecord) return res.status(404).json({ error: 'invalid_token' });

  if (tokenRecord.state === 'enrolled') {
    const ba = await findSponsorBA(tokenRecord.sponsorBaId);
    if (!ba) return res.status(404).json({ error: 'invalid_token' });
    return res.status(409).json(buildEnrolledResponse(ba));
  }
  if (tokenRecord.state === 'expired') {
    const ba = await findSponsorBA(tokenRecord.sponsorBaId);
    if (!ba) return res.status(404).json({ error: 'invalid_token' });
    return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
  }
  if (isTokenExpired(tokenRecord)) {
    await transitionTokenState(token, 'expired');
    const ba = await findSponsorBA(tokenRecord.sponsorBaId);
    if (!ba) return res.status(404).json({ error: 'invalid_token' });
    return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
  }

  // Flip to SSE.
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders?.();

  // Send the initial snapshot.
  try {
    const snapshot: HoldingTankSnapshot = await buildHoldingTankSnapshot(
      SSE_SNAPSHOT_RECENT_LIMIT,
    );
    res.write(sseFrame('snapshot', snapshot));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[SSE :token/stream] snapshot failed', err);
    res.write(`: snapshot_error ${(err as Error).message}\n\n`);
    res.end();
    return;
  }

  // Subscribe to live placements; serialize each one onto the wire.
  const sub = subscribePlacements((event: PlacementEvent) => {
    try {
      res.write(sseFrame('placement', event, event.eventId));
    } catch {
      // Write to a closed socket throws; the `close` handler below will
      // tear down the subscription on the next tick.
    }
  });

  // Heartbeat. SSE comments (lines starting with `:`) are ignored by the
  // EventSource API but keep proxies alive.
  const heartbeat = setInterval(() => {
    try {
      res.write(`: ping ${Date.now()}\n\n`);
    } catch {
      // ignore — close handler will clean up.
    }
  }, SSE_PING_INTERVAL_MS);

  const teardown = () => {
    clearInterval(heartbeat);
    sub.unsubscribe();
  };
  req.on('close', teardown);
  req.on('aborted', teardown);
  res.on('close', teardown);
  return;
});

/**
 * POST /api/p/:token/webinar-reserve — Chat #114 dashboard port.
 *
 * The prospect submitted the webinar reservation form on Section 6
 * of tm-prospect-dashboard. Two fields: name + email.
 *
 * The reservation is captured against the next upcoming webinar event
 * (resolved server-side from `webinar_events`). Sponsor immutability
 * (locked-spec 3.5) holds — the BA is read from the token only.
 *
 * Email delivery to the prospect is deferred until the locked-spec
 * Part 5 email provider is decided. The reservation captures
 * successfully and the BA gets a Telnyx SMS alert; the response
 * payload's emailSent=false tells the client to render "your BA will
 * follow up with the Zoom link" copy instead of "check your inbox."
 *
 * Status codes:
 *   200 — reservation captured, BA SMS attempted (best-effort)
 *   400 — missing/invalid name or email shape
 *   404 — unknown token, missing prospect, missing BA, or no upcoming event
 *   409 — token enrolled
 *   410 — token expired
 *   500 — unexpected (triple-stack write failure)
 */

/** Conservative email shape check. Compliance, not validation. */
function looksLikeEmail(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (trimmed.length < 5 || trimmed.length > 254) return false;
  // Single-@, no whitespace, at least one '.' in the host part.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

prospectTokenRoutes.post('/:token/webinar-reserve', async (req, res) => {
  const { token } = req.params;
  const body = req.body as Partial<WebinarReservationPayload>;

  if (!token || token.length < 4) {
    return res.status(404).json({ error: 'invalid_token' });
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    return res.status(400).json({ error: 'invalid_name' });
  }
  if (!looksLikeEmail(body?.email)) {
    return res.status(400).json({ error: 'invalid_email' });
  }
  const email = (body!.email as string).trim();

  try {
    const tokenRecord = await findTokenRecord(token);
    if (!tokenRecord) return res.status(404).json({ error: 'invalid_token' });

    if (tokenRecord.state === 'enrolled') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(409).json(buildEnrolledResponse(ba));
    }
    if (tokenRecord.state === 'expired') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }
    if (isTokenExpired(tokenRecord)) {
      await transitionTokenState(token, 'expired');
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }

    const [prospect, ba, nextEvent] = await Promise.all([
      findProspectById(tokenRecord.prospectId),
      findBAByBaId(tokenRecord.sponsorBaId),
      findNextUpcomingEvent(),
    ]);
    if (!prospect) return res.status(404).json({ error: 'invalid_token' });
    if (!ba) return res.status(404).json({ error: 'invalid_token' });
    if (!nextEvent) return res.status(404).json({ error: 'no_upcoming_event' });

    const result = await createWebinarReservation({
      token: tokenRecord.token,
      prospectId: prospect.prospectId,
      prospectFirstName: prospect.firstName,
      prospectLastInitial: prospect.lastInitial || lastInitialOf(prospect.lastName),
      sponsorBaId: tokenRecord.sponsorBaId,
      baFirstName: ba.firstName,
      baPhone: ba.phone || null,
      eventId: nextEvent.eventId,
      scheduledFor: nextEvent.scheduledFor,
      zoomUrl: nextEvent.zoomUrl ?? null,
      name,
      email,
    });

    const response: WebinarReservationResponse = {
      ok: true,
      reservationId: result.reservationId,
      eventId: nextEvent.eventId,
      scheduledFor: nextEvent.scheduledFor,
      baFirstName: ba.firstName,
      emailSent: result.emailDeliveryStatus === 'sent',
      createdAt: result.createdAt,
    };
    return res.status(200).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/p/:token/webinar-reserve] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

/**
 * GET /api/p/:token/team-stats — Chat #115 dashboard Section 5 live activity.
 *
 * Replaces the four seeded constants (47/213/89/+38%) in TM Advantage
 * with real, server-computed counts. Same 200/404/409/410/500 token-gating
 * contract as the other /:token routes — prospect must hold a valid,
 * non-terminal token to read team stats from the prospect dashboard surface.
 *
 * Metric definitions per locked Chat #115:
 *   basActive24h           BAs who logged into .team in the last 24h
 *   invitationsSentToday   invite_tokens minted since 00:00 UTC today
 *   newPlacements24h       pool_placements in the last 24h
 *   recruitmentVelocityPct (this7d - prior7d) / max(1, prior7d) * 100,
 *                          rounded to nearest integer percent
 *
 * Compliance (locked-spec 3.10):
 *   No income, no rank, no placement promise. Pure team activity counts.
 *
 * No SSE on this route — client polls or re-fetches when it wants a
 * fresher read. v1 scale (41 BAs growing) makes this cheap; a 30-60s
 * server-side cache is flagged for future when team is 10k+.
 */
prospectTokenRoutes.get('/:token/team-stats', async (req, res) => {
  const { token } = req.params;
  if (!token || token.length < 4) {
    return res.status(404).json({ error: 'invalid_token' });
  }

  try {
    const tokenRecord = await findTokenRecord(token);
    if (!tokenRecord) return res.status(404).json({ error: 'invalid_token' });

    if (tokenRecord.state === 'enrolled') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(409).json(buildEnrolledResponse(ba));
    }
    if (tokenRecord.state === 'expired') {
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }
    if (isTokenExpired(tokenRecord)) {
      await transitionTokenState(token, 'expired');
      const ba = await findSponsorBA(tokenRecord.sponsorBaId);
      if (!ba) return res.status(404).json({ error: 'invalid_token' });
      return res.status(410).json(buildExpiredResponse(ba, tokenRecord.expiresAt));
    }

    const stats = await computeTeamStats();
    const payload: TeamStatsResponse = {
      basActive24h: stats.basActive24h,
      invitationsSentToday: stats.invitationsSentToday,
      newPlacements24h: stats.newPlacements24h,
      recruitmentVelocityPct: stats.recruitmentVelocityPct,
      computedAt: stats.computedAt,
    };
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/p/:token/team-stats] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
});

