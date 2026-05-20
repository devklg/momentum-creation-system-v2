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
  ResolvedTokenPayload,
  VideoEventKind,
  VideoEventPayload,
  VideoEventResponse,
  TokenState,
} from '@momentum/shared';
import { findTokenRecord, isTokenExpired, transitionTokenState } from '../domain/tokens.js';
import { findProspectById, lastInitialOf } from '../domain/prospects.js';
import { findBAByBaId } from '../domain/ba.js';
import { placeProspect } from '../domain/holdingTank.js';

export const prospectTokenRoutes: Router = Router();

// Dr. Dan video, locked-spec Part 4.8.
const DR_DAN_VIDEO_URL = 'https://www.youtube.com/embed/89wRvqx1d8M';

// Webinar slot — Tuesday 7pm PT (cadence still-open per locked-spec Part 5).
const WEBINAR = {
  dayOfWeek: 'Tuesday',
  timeOfDay: '7:00 PM',
  timezone: 'America/Los_Angeles',
};

prospectTokenRoutes.get('/:token', async (req, res) => {
  const { token } = req.params;

  if (!token || token.length < 4) {
    return res.status(404).json({ error: 'invalid_token' });
  }

  try {
    const tokenRecord = await findTokenRecord(token);
    if (!tokenRecord) return res.status(404).json({ error: 'invalid_token' });

    if (tokenRecord.state === 'enrolled') {
      return res.status(409).json({ error: 'enrolled' });
    }

    if (tokenRecord.state === 'expired' || isTokenExpired(tokenRecord)) {
      return res.status(410).json({ error: 'expired', expiredAt: tokenRecord.expiresAt });
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
    if (tokenRecord.state === 'enrolled') {
      return res.status(409).json({ error: 'enrolled' });
    }
    if (tokenRecord.state === 'expired' || isTokenExpired(tokenRecord)) {
      return res.status(410).json({ error: 'expired' });
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
