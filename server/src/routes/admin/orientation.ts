/**
 * /api/admin/orientation — founder-facing group orientation roster + seeding
 * (Chat #147 — wireframe §3.6, dec_orientation_scheduling seq 21).
 *
 * The /admin side of the orientation scheduler: founders (Kevin + Paul) view
 * the per-session roster and add more sessions as the team grows (seed more
 * events — no rebuild). Hosts are ASSIGNABLE on create (default to founders).
 *
 *   GET  /sessions   every session (any status) with its roster
 *   POST /sessions   create a new session (assignable hosts, cap default 10)
 *
 * Gating: requireAdmin (Kevin-only via ADMIN_TMAG_IDS). Each request appends an
 * audit entry through the 4.J substrate, matching the rest of /admin.
 */

import express, { type Request, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import {
  createOrientationSession,
  getSessionWithRoster,
  listSessionsWithRosters,
} from '../../domain/orientationSession.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import { buildAdminOrientationDiagnostic } from '../../domain/orientationDiagnostic.js';
import type {
  McsAdminCreateOrientationSessionResponse,
  McsAdminOrientationDiagnosticResponse,
  McsAdminOrientationSessionsResponse,
  McsAuditActor,
  McsAuditContext,
} from '@momentum/shared';

export const adminOrientationRoutes: Router = express.Router();

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

function contextFromRequest(req: Request, route: string, method: string): McsAuditContext {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    route,
    method,
    requestId: null,
  };
}

/* ─── GET /sessions  (roster view) ──────────────────────────────── */

adminOrientationRoutes.get('/sessions', requireAdmin, async (req, res) => {
  try {
    const sessions = await listSessionsWithRosters();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.orientation.sessions.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { sessionCount: sessions.length },
      reason: null,
      context: contextFromRequest(req, '/api/admin/orientation/sessions', 'GET'),
    });

    const body: McsAdminOrientationSessionsResponse = { ok: true, sessions };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Roster failed: ${msg}` });
  }
});

/* ─── GET /diagnostic  (read-only record integrity) ─────────────── */

adminOrientationRoutes.get('/diagnostic', requireAdmin, async (req, res) => {
  try {
    const requestedLimit = Number(req.query.limit);
    const payload: McsAdminOrientationDiagnosticResponse = await buildAdminOrientationDiagnostic({
      limit: Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.floor(requestedLimit)
        : undefined,
    });

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.orientation.diagnostic.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: payload.totals.findings > 0 ? 'warn' : 'info',
      after: {
        generatedAt: payload.generatedAt,
        policy: payload.policy,
        scanned: payload.scanned,
        totals: payload.totals,
      },
      reason: null,
      context: contextFromRequest(req, '/api/admin/orientation/diagnostic', 'GET'),
    });

    res.json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Orientation diagnostic failed: ${msg}` });
  }
});

/* ─── POST /sessions  (create — founders seed a session) ────────── */

const CreateSchema = z.object({
  scheduledFor: z.string().datetime({ offset: true }),
  hosts: z.array(z.string().min(1).max(120)).max(10).optional(),
  capacity: z.number().int().min(1).max(100).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  joinUrl: z.string().url().max(500).nullish(),
});

adminOrientationRoutes.post('/sessions', requireAdmin, async (req, res) => {
  let payload: z.infer<typeof CreateSchema>;
  try {
    payload = CreateSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid request.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }

  // Reject sessions scheduled in the past — a session that can never be booked
  // is an operator error worth surfacing immediately.
  if (new Date(payload.scheduledFor).getTime() <= Date.now()) {
    res.status(400).json({ ok: false, error: 'scheduled_in_past' });
    return;
  }

  try {
    const session = await createOrientationSession({
      scheduledFor: payload.scheduledFor,
      hosts: payload.hosts,
      capacity: payload.capacity,
      durationMinutes: payload.durationMinutes,
      joinUrl: payload.joinUrl ?? null,
    });

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.orientation.session.created',
      entity: { kind: 'admin_session', id: session.sessionId, displayLabel: null },
      severity: 'info',
      after: {
        sessionId: session.sessionId,
        scheduledFor: session.scheduledFor,
        hosts: session.hosts,
        capacity: session.capacity,
      },
      reason: null,
      context: contextFromRequest(req, '/api/admin/orientation/sessions', 'POST'),
    });

    const withRoster = await getSessionWithRoster(session.sessionId);
    const body: McsAdminCreateOrientationSessionResponse = {
      ok: true,
      session: withRoster ?? {
        sessionId: session.sessionId,
        scheduledFor: session.scheduledFor,
        hosts: session.hosts,
        capacity: session.capacity,
        durationMinutes: session.durationMinutes,
        joinUrl: session.joinUrl,
        status: session.status,
        seatsTaken: 0,
        seatsRemaining: session.capacity,
        roster: [],
      },
    };
    res.status(201).json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Create failed: ${msg}` });
  }
});
