import { Router, type Request } from 'express';
import { z } from 'zod';
import type { McsAuditActor, McsRecordEventAttendanceResponse } from '@momentum/shared';
import { getEventCenterForAdmin } from '../../domain/eventCenter.js';
import {
  EventAttendanceError,
  recordWebinarAttendance,
} from '../../domain/eventAttendance.js';
import { requireAdmin } from '../../middleware/requireAuth.js';

export const adminEventRoutes: Router = Router();

function adminActor(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  return {
    kind: 'admin',
    tmagId: session.tmagId,
    displayName: (session as unknown as { fullName?: string }).fullName ?? session.tmagId,
  };
}

adminEventRoutes.get('/', requireAdmin, async (_req, res) => {
  try {
    return res.status(200).json(await getEventCenterForAdmin());
  } catch (error) {
    console.error('[GET /api/admin/events] failed', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

const AttendanceSchema = z.object({
  state: z.enum(['attended', 'missed', 'rescheduled']),
}).strict();

adminEventRoutes.post(
  '/webinars/:eventId/reservations/:reservationId/attendance',
  requireAdmin,
  async (req, res) => {
    const parsed = AttendanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ ok: false, error: 'invalid_attendance_state' });
    }
    try {
      const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] ?? '' : req.params.eventId ?? '';
      const reservationId = Array.isArray(req.params.reservationId) ? req.params.reservationId[0] ?? '' : req.params.reservationId ?? '';
      const body: McsRecordEventAttendanceResponse = await recordWebinarAttendance({
        eventId,
        reservationId,
        state: parsed.data.state,
        actor: adminActor(req),
      });
      return res.status(200).json(body);
    } catch (error) {
      if (error instanceof EventAttendanceError) {
        return res.status(error.code === 'reservation_not_found' ? 404 : 409).json({
          ok: false,
          error: error.code,
        });
      }
      console.error('[POST /api/admin/events/webinars/:eventId/reservations/:reservationId/attendance] failed', error);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);
