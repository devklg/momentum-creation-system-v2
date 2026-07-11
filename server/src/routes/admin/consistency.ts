/**
 * /api/admin/consistency - Kevin-only data consistency report.
 */

import express, { type Request, type Router } from 'express';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import { buildAdminConsistencyReport } from '../../domain/adminConsistencyReport.js';
import type { McsAuditActor } from '@momentum/shared';

export const adminConsistencyRoutes: Router = express.Router();

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

function positiveNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

adminConsistencyRoutes.get('/report', requireAdmin, async (req, res) => {
  try {
    const payload = await buildAdminConsistencyReport({
      limitPerSpec: positiveNumber(req.query.limitPerSpec, 25),
      orphanLimit: positiveNumber(req.query.orphanLimit, 25),
    });

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.consistency.report.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: payload.overall === 'red' ? 'warn' : 'info',
      after: {
        generatedAt: payload.generatedAt,
        overall: payload.overall,
        totals: payload.totals,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/consistency/report',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Consistency report failed: ${msg}` });
  }
});
