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
import type { ResolvedTokenPayload } from '@momentum/shared';
import { findTokenRecord, isTokenExpired } from '../domain/tokens.js';
import { findProspectById, lastInitialOf } from '../domain/prospects.js';
import { findBAByBaId } from '../domain/ba.js';

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
