/**
 * /api/three-way — three-way call scheduling v1.
 *
 * Identity is session-owned. A caller never supplies a booker id; target
 * sponsors are validated against the caller's upline chain and active
 * availability. No role gate: availability is what makes an upline bookable.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  cancelThreeWayBooking,
  createThreeWayBooking,
  getThreeWayAvailability,
  listThreeWayBookings,
  setMyThreeWayAvailability,
} from '../domain/threeWayCalls.js';
import type {
  McsThreeWayBookPayload,
  McsThreeWayBookResponse,
  McsThreeWayCancelResponse,
  McsThreeWaySetAvailabilityPayload,
  McsThreeWaySetAvailabilityResponse,
} from '@momentum/shared';

export const threeWayRoutes: Router = Router();

threeWayRoutes.get('/availability', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const payload = await getThreeWayAvailability(tmagId);
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/three-way/availability] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

threeWayRoutes.put('/availability', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const record = await setMyThreeWayAvailability(
      tmagId,
      req.body as McsThreeWaySetAvailabilityPayload,
    );
    const body: McsThreeWaySetAvailabilityResponse = { ok: true, availability: record };
    return res.status(200).json(body);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'invalid_availability') {
      return res.status(400).json({ ok: false, error: 'invalid_availability' });
    }
    // eslint-disable-next-line no-console
    console.error('[PUT /api/three-way/availability] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

threeWayRoutes.get('/bookings', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  try {
    const payload = await listThreeWayBookings(tmagId);
    return res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/three-way/bookings] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

threeWayRoutes.post('/bookings', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });

  const body = req.body as Partial<McsThreeWayBookPayload>;
  const sponsorTmagId = typeof body.sponsorTmagId === 'string' ? body.sponsorTmagId.trim() : '';
  const startAt = typeof body.startAt === 'string' ? body.startAt.trim() : '';
  const prospectNote =
    typeof body.prospectNote === 'string' ? body.prospectNote.trim() : null;

  if (!sponsorTmagId || !startAt) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }

  try {
    const result = await createThreeWayBooking({
      bookerTmagId: tmagId,
      sponsorTmagId,
      startAt,
      prospectNote,
    });
    if (!result.ok) {
      const status = result.error === 'double_booked' ? 409 : 400;
      return res.status(status).json({ ok: false, error: result.error });
    }
    const response: McsThreeWayBookResponse = { ok: true, booking: result.booking };
    return res.status(201).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/three-way/bookings] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

threeWayRoutes.post('/bookings/:id/cancel', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  const bookingId = String(req.params.id ?? '').trim();
  if (!bookingId) return res.status(400).json({ ok: false, error: 'invalid_booking_id' });

  try {
    const result = await cancelThreeWayBooking(bookingId, tmagId);
    if (!result.ok) {
      return res
        .status(result.error === 'not_found' ? 404 : 403)
        .json({ ok: false, error: result.error });
    }
    const response: McsThreeWayCancelResponse = { ok: true, booking: result.booking };
    return res.status(200).json(response);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[POST /api/three-way/bookings/:id/cancel] failed', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});
