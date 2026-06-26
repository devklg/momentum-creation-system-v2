/**
 * GET/POST/DELETE /api/orientation/* — BA-facing group orientation scheduler
 * (Chat #147 — wireframe §3.6, dec_orientation_scheduling seq 21).
 *
 * The cockpit scheduling card's server side. A new BA (post-Michael) sees the
 * available group orientation sessions, books ONE seat (hard cap 10 per
 * session), and can cancel it. Founders see the per-session roster in /admin
 * (routes/admin/orientation.ts).
 *
 *   GET    /sessions                      available sessions + my reservation
 *   POST   /sessions/:sessionId/reserve   book a seat (cap 10)
 *   DELETE /sessions/:sessionId/reserve   cancel my seat
 *
 * Gating: requireAuth + requireSteveComplete — the BA-facing gated pattern
 * (a BA reaches the cockpit, and thus this card, only after Michael completes).
 *
 * Identity discipline (locked-spec 3.5): baId comes from req.session — never a
 * query param or body. The BA can only ever book/cancel their OWN seat.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import { findBAByBaId } from '../domain/ba.js';
import {
  cancelSeat,
  getSessionAvailabilityForBA,
  reserveSeat,
} from '../domain/orientationSession.js';
import type {
  OrientationCancelResponse,
  OrientationReserveResponse,
  OrientationSessionsResponse,
} from '@momentum/shared';

export const orientationRoutes: Router = Router();

/** GET /sessions — the cockpit scheduling-card payload for this BA. */
orientationRoutes.get(
  '/sessions',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
    try {
      const { sessions, myReservationSessionId } =
        await getSessionAvailabilityForBA(baId);
      const body: OrientationSessionsResponse = {
        ok: true,
        sessions,
        myReservationSessionId,
      };
      return res.status(200).json(body);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[GET /api/orientation/sessions] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

/** POST /sessions/:sessionId/reserve — book a seat. */
orientationRoutes.post(
  '/sessions/:sessionId/reserve',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const sessionId = String(req.params.sessionId ?? '');
    if (sessionId.length < 4 || sessionId.length > 120) {
      return res.status(400).json({ ok: false, error: 'invalid_session_id' });
    }

    try {
      const ba = await findBAByBaId(baId);
      if (!ba) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

      const result = await reserveSeat({
        sessionId,
        baId,
        baName: `${ba.firstName} ${ba.lastName}`.trim(),
        baPhone: ba.phone ?? null,
      });

      if (!result.ok) {
        const status =
          result.error.kind === 'session_not_found'
            ? 404
            : result.error.kind === 'session_full'
              ? 409
              : 400;
        return res.status(status).json({ ok: false, error: result.error });
      }

      const body: OrientationReserveResponse = {
        ok: true,
        reservationId: result.reservationId,
        sessionId: result.sessionId,
        scheduledFor: result.scheduledFor,
        seatsRemaining: result.seatsRemaining,
        createdAt: result.createdAt,
      };
      return res.status(201).json(body);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[POST /api/orientation/sessions/:id/reserve] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);

/** DELETE /sessions/:sessionId/reserve — cancel my seat. */
orientationRoutes.delete(
  '/sessions/:sessionId/reserve',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

    const sessionId = String(req.params.sessionId ?? '');
    if (!sessionId) return res.status(400).json({ ok: false, error: 'invalid_session_id' });

    try {
      const result = await cancelSeat(sessionId, baId);
      if (!result.ok) {
        return res.status(404).json({ ok: false, error: result.error });
      }
      const body: OrientationCancelResponse = {
        ok: true,
        sessionId: result.sessionId,
        cancelledAt: result.cancelledAt,
      };
      return res.status(200).json(body);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[DELETE /api/orientation/sessions/:id/reserve] failed', err);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);
