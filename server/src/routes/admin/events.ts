import { Router, type Request } from 'express';
import { z } from 'zod';
import type { McsAuditActor, McsRecordEventAttendanceResponse } from '@momentum/shared';
import { getEventCenterForAdmin } from '../../domain/eventCenter.js';
import { AdminCursorError } from '../../domain/adminPagination.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import {
  EventAttendanceError,
  recordWebinarAttendance,
} from '../../domain/eventAttendance.js';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { rotateKongaReplay } from '../../domain/kongaReplay.js';

export const adminEventRoutes: Router = Router();

function adminActor(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  return {
    kind: 'admin',
    tmagId: session.tmagId,
    displayName: (session as unknown as { fullName?: string }).fullName ?? session.tmagId,
  };
}

adminEventRoutes.get('/', requireAdmin, async (req, res) => {
  const parsed = z.object({
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(20).max(2000).optional(),
  }).safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_pagination', issues: parsed.error.issues });
  }
  try {
    const report = await getEventCenterForAdmin(parsed.data);
    await appendAuditEntry({
      actor: adminActor(req),
      action: 'admin.events.reservations.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        filters: report.appliedFilters,
        sort: report.appliedSort,
        pageSize: report.pageInfo.pageSize,
        returnedCount: report.webinarReservations.length,
        hasMore: report.pageInfo.hasMore,
        cursorSupplied: Boolean(parsed.data.cursor),
      },
      reason: null,
      context: {
        ip: null,
        userAgent: null,
        route: '/api/admin/events',
        method: 'GET',
        requestId: null,
      },
    });
    return res.status(200).json(report);
  } catch (error) {
    if (error instanceof AdminCursorError) {
      return res.status(400).json({ ok: false, error: error.code });
    }
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

const ReplayRotationSchema = z.object({
  eventId: z.string().min(1).max(200),
  resourceVersionId: z.string().min(1).max(240),
  recordedAt: z.string().datetime(),
  availableAt: z.string().datetime(),
  displayDate: z.string().min(1).max(120),
}).strict();

adminEventRoutes.post('/webinars/replay-rotation', requireAdmin, async (req, res) => {
  const parsed = ReplayRotationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: 'invalid_replay_rotation' });
  }
  try {
    const actor = adminActor(req);
    const replay = await rotateKongaReplay({
      ...parsed.data,
      authorizedByTmagId: actor.tmagId,
    });
    await appendAuditEntry({
      actor,
      action: 'admin.events.konga_replay_rotated',
      entity: { kind: 'admin_session', id: actor.tmagId, displayLabel: replay.displayDate },
      severity: 'critical',
      after: {
        eventId: replay.eventId,
        resourceVersionId: replay.resourceVersionId,
        availableAt: replay.availableAt,
        publicationStatus: replay.publicationStatus,
      },
      reason: 'Authorized Konga replay pointer rotation.',
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/events/webinars/replay-rotation',
        method: 'POST',
        requestId: null,
      },
    });
    return res.status(201).json({ ok: true, replay });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'server_error';
    const status = message.startsWith('konga_replay_') ? 409 : 500;
    return res.status(status).json({ ok: false, error: message });
  }
});
