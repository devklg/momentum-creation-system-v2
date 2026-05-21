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
import { placeProspect } from '../domain/holdingTank.js';
import { createCallbackRequest } from '../domain/callbackRequest.js';

export const prospectTokenRoutes: Router = Router();

// Dr. Dan video, locked-spec Part 4.8.
const DR_DAN_VIDEO_URL = 'https://www.youtube.com/embed/89wRvqx1d8M';

// Webinar slot — Tuesday 7pm PT (cadence still-open per locked-spec Part 5).
const WEBINAR = {
  dayOfWeek: 'Tuesday',
  timeOfDay: '7:00 PM',
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

    const [prospect, ba] = await Promise.all([
      findProspectById(tokenRecord.prospectId),
      findBAByBaId(tokenRecord.sponsorBaId),
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
 * presentation (Chat #109). Two intent radios only:
 *   - 'interested_tell_me_more'
 *   - 'have_questions'
 *
 * The harder "I'm ready to join" intent is reserved for the post-video
 * tm-prospect-dashboard Section 6 (Chat #109 lock) — not accepted here.
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
