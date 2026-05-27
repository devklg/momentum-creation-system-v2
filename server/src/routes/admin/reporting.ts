/**
 * /api/admin/reporting — Section I · Reporting / Analytics server surface
 * (locked-spec / ADMIN Design Section I).
 *
 * Thin Express layer following the dashboard.ts pattern: requireAdmin,
 * filter parsing identical to the dashboard (narrowing-only), and one audit
 * entry per request via the 4.J substrate (every /admin request audits).
 *
 * Implemented so far:
 *   GET /master-report.pdf   I.3 Print Master Report (Chat #142)
 *
 * I.1 standard-report library and I.2 query builder are not built yet; this
 * file is where they will mount. The I.3 master report composites what data
 * exists today (Section B metrics) and prints an explicit provenance note —
 * see domain/adminMasterReport.ts for the honest-scope rationale.
 */

import express, { type Request, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { buildMasterReportPdf } from '../../domain/adminMasterReport.js';
import { buildBaActivationReport } from '../../domain/reports/baActivation.js';
import { resolveTimeRange } from '../../domain/reports/timeRange.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import type {
  AdminDashboardFilter,
  AdminReportTimeRange,
  AuditActor,
} from '@momentum/shared';

export const adminReportingRoutes: Router = express.Router();

const FilterSchema = z.object({
  baId: z.string().min(2).max(80).optional(),
  leaderGroup: z.enum(['all', 'leaders_only', 'non_leaders']).optional(),
});

function parseFilter(req: Request): AdminDashboardFilter {
  const parsed = FilterSchema.parse({
    baId: typeof req.query.baId === 'string' ? req.query.baId : undefined,
    leaderGroup:
      typeof req.query.leaderGroup === 'string' ? req.query.leaderGroup : undefined,
  });
  return {
    baId: parsed.baId ?? null,
    leaderGroup: parsed.leaderGroup ?? 'all',
  };
}

/**
 * Parse the time-range query params (Kevin decision A: preset enum AND
 * explicit from/to). The resolver tolerates absent / invalid inputs and
 * defaults to lifetime.
 */
function parseRange(req: Request): AdminReportTimeRange {
  return resolveTimeRange({
    preset: typeof req.query.preset === 'string' ? req.query.preset : null,
    from: typeof req.query.from === 'string' ? req.query.from : null,
    to: typeof req.query.to === 'string' ? req.query.to : null,
  });
}

function adminActorFromRequest(req: Request): AuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.baId;
  return { kind: 'admin', baId: session.baId, displayName };
}

/* ─── GET /master-report.pdf — I.3 ───────────────────────── */

adminReportingRoutes.get('/master-report.pdf', requireAdmin, async (req, res) => {
  let filter: AdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res
      .status(400)
      .json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }

  try {
    const { buffer, filename, generatedAt, sourceHash } = await buildMasterReportPdf(filter);

    // Audit the report generation (ADMIN J.1 — every report generation audits).
    // The source hash + timestamp are captured so the audit trail can later
    // confirm exactly which snapshot was produced.
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.master_report.generated',
      entity: { kind: 'admin_session', id: req.session!.baId, displayLabel: null },
      severity: 'info',
      after: { filter, generatedAt, sourceHash, byteLength: buffer.length },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/reporting/master-report.pdf',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.setHeader('Cache-Control', 'no-store');
    res.end(buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Master report failed: ${msg}` });
  }
});

/* ─── GET /activation — I.1 Report 1 · BA activation ───────── */

adminReportingRoutes.get('/activation', requireAdmin, async (req, res) => {
  let filter: AdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res
      .status(400)
      .json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);

  try {
    const { result, meta } = await buildBaActivationReport(filter, range);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.ba_activation.generated',
      entity: { kind: 'admin_session', id: req.session!.baId, displayLabel: null },
      severity: 'info',
      after: {
        filter,
        range,
        generatedAt: meta.generatedAt,
        sourceHash: meta.sourceHash,
        signups: result.totals.signups,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/reporting/activation',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json({
      ok: true,
      meta: { ...meta, title: 'BA Activation' },
      result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Activation report failed: ${msg}` });
  }
});
