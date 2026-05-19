/**
 * /api/michael/* — BA-facing schedule routes.
 *
 * GET  /api/michael/slots   → list available 15-min slots in BA's TZ
 * POST /api/michael/book    → lock a chosen slot
 * GET  /api/michael/status  → current schedule record for this BA
 *
 * All routes require an authenticated session (requireAuth).
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  bookMichaelSlot,
  generateSlots,
  getMichaelSchedule,
  BookingError,
} from '../domain/michael-schedule.js';

export const michaelRoutes: Router = express.Router();

michaelRoutes.get('/slots', requireAuth, async (req: Request, res: Response) => {
  const session = req.session!;
  const schedule = await getMichaelSchedule(session.baId);
  if (!schedule) {
    res.status(404).json({ ok: false, error: 'No Michael schedule for this BA.' });
    return;
  }
  if (!schedule.timezone) {
    res.status(400).json({ ok: false, error: 'BA timezone missing. Update profile first.' });
    return;
  }
  const slots = generateSlots({
    signupAt: new Date(schedule.signupAt),
    timezone: schedule.timezone,
  });
  res.json({
    ok: true,
    timezone: schedule.timezone,
    status: schedule.status,
    slotStartUtc: schedule.slotStartUtc,
    rescheduleCount: schedule.rescheduleCount,
    slots,
  });
});

const BookBody = z.object({
  slotStartUtc: z.string().min(20).max(40),
});

michaelRoutes.post('/book', requireAuth, async (req: Request, res: Response) => {
  const parsed = BookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid input.', details: parsed.error.flatten() });
    return;
  }
  const session = req.session!;
  try {
    const schedule = await bookMichaelSlot({
      baId: session.baId,
      slotStartUtc: parsed.data.slotStartUtc,
    });
    // eslint-disable-next-line no-console
    console.log(
      `[audit] michael_slot_booked baId=${session.baId} slot=${schedule.slotStartUtc} rescheduleCount=${schedule.rescheduleCount}`,
    );
    res.json({ ok: true, schedule });
  } catch (err) {
    if (err instanceof BookingError) {
      res.status(400).json({ ok: false, error: err.message, code: err.code });
      return;
    }
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Booking failed: ${msg}` });
  }
});

michaelRoutes.get('/status', requireAuth, async (req: Request, res: Response) => {
  const session = req.session!;
  const schedule = await getMichaelSchedule(session.baId);
  if (!schedule) {
    res.status(404).json({ ok: false, error: 'No Michael schedule for this BA.' });
    return;
  }
  res.json({ ok: true, schedule });
});
