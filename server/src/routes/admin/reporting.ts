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
import { buildTrainingReport } from '../../domain/reports/trainingCompletion.js';
import { buildInviteFunnelReport } from '../../domain/reports/inviteFunnel.js';
import { buildQueueVelocityReport } from '../../domain/reports/queueVelocity.js';
import { buildEnrollmentReport } from '../../domain/reports/enrollmentCompletion.js';
import { buildFollowUpReport } from '../../domain/reports/followUpAging.js';
import { buildLeaderScorecardReport } from '../../domain/reports/leaderScorecards.js';
import { buildAdminBottleneckReport } from '../../domain/adminBottlenecks.js';
import { buildMissionFunnelReport } from '../../domain/reports/missionFunnel.js';
import { resolveTimeRange } from '../../domain/reports/timeRange.js';
import {
  exportBaActivation,
  exportTraining,
  exportInviteFunnel,
  exportQueueVelocity,
  exportEnrollment,
  exportFollowUp,
  exportLeaderScorecards,
  type ExportOutput,
} from '../../domain/reports/export.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import type {
  McsAdminDashboardFilter,
  McsAdminReportTimeRange,
  McsAuditActor,
} from '@momentum/shared';

export const adminReportingRoutes: Router = express.Router();

const FilterSchema = z.object({
  tmagId: z.string().min(2).max(80).optional(),
  leaderGroup: z.enum(['all', 'leaders_only', 'non_leaders']).optional(),
});

function parseFilter(req: Request): McsAdminDashboardFilter {
  const parsed = FilterSchema.parse({
    tmagId: typeof req.query.tmagId === 'string' ? req.query.tmagId : undefined,
    leaderGroup:
      typeof req.query.leaderGroup === 'string' ? req.query.leaderGroup : undefined,
  });
  return {
    tmagId: parsed.tmagId ?? null,
    leaderGroup: parsed.leaderGroup ?? 'all',
  };
}

/**
 * Parse the time-range query params (Kevin decision A: preset enum AND
 * explicit from/to). The resolver tolerates absent / invalid inputs and
 * defaults to lifetime.
 */
function parseRange(req: Request): McsAdminReportTimeRange {
  return resolveTimeRange({
    preset: typeof req.query.preset === 'string' ? req.query.preset : null,
    from: typeof req.query.from === 'string' ? req.query.from : null,
    to: typeof req.query.to === 'string' ? req.query.to : null,
  });
}

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

/* ─── GET /bottlenecks — P2-128 aggregate operational composition ── */

adminReportingRoutes.get('/bottlenecks', requireAdmin, async (req, res) => {
  try {
    const report = await buildAdminBottleneckReport();
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.bottlenecks.generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: report.unavailableSources.length > 0 ? 'warn' : 'info',
      after: {
        schemaVersion: report.schemaVersion,
        generatedAt: report.generatedAt,
        scope: report.scope,
        sectionStatus: Object.fromEntries(
          Object.entries(report.sections).map(([key, section]) => [key, section.status]),
        ),
        partialSources: report.partialSources,
        unavailableSources: report.unavailableSources,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/reporting/bottlenecks',
        method: 'GET',
        requestId: null,
      },
    });
    res.status(200).json(report);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Bottleneck report failed: ${msg}` });
  }
});

/* ─── GET /master-report.pdf — I.3 ───────────────────────── */

adminReportingRoutes.get('/master-report.pdf', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
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
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
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
  let filter: McsAdminDashboardFilter;
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
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
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

/* ─── GET /training — I.1 Report 2 · Training completion ────── */

adminReportingRoutes.get('/training', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
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
    const { result, meta } = await buildTrainingReport(filter, range);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.training_completion.generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        filter,
        range,
        generatedAt: meta.generatedAt,
        sourceHash: meta.sourceHash,
        bas: result.totals.bas,
        fastStartComplete: result.totals.fastStartComplete,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/reporting/training',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json({
      ok: true,
      meta: { ...meta, title: 'Training Completion' },
      result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Training report failed: ${msg}` });
  }
});

/* ─── GET /invite-funnel — I.1 Report 3 · Invite-to-presentation movement ── */

adminReportingRoutes.get('/invite-funnel', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);

  // Per-BA sort: completes | mints | completion_pct (default completes).
  const rawSort = typeof req.query.sort === 'string' ? req.query.sort : '';
  const perBaSort: 'completes' | 'mints' | 'completion_pct' =
    rawSort === 'mints' || rawSort === 'completion_pct' ? rawSort : 'completes';

  try {
    const { result, meta } = await buildInviteFunnelReport(filter, range, perBaSort);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.invite_to_presentation.generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        filter,
        range,
        perBaSort,
        generatedAt: meta.generatedAt,
        sourceHash: meta.sourceHash,
        minted: result.totals.minted,
        videoComplete: result.totals.videoComplete,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/reporting/invite-funnel',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json({
      ok: true,
      meta: { ...meta, title: 'Invite-to-Presentation Movement' },
      result,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Invite funnel report failed: ${msg}` });
  }
});

/* ─── GET /queue-velocity — I.1 Report 4 ───────────────────── */

adminReportingRoutes.get('/queue-velocity', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);

  try {
    const { result, meta } = await buildQueueVelocityReport(filter, range);
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.queue_velocity.generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { filter, range, generatedAt: meta.generatedAt, sourceHash: meta.sourceHash, days: result.days.length },
      reason: null,
      context: { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, route: '/api/admin/reporting/queue-velocity', method: 'GET', requestId: null },
    });
    res.status(200).json({ ok: true, meta: { ...meta, title: 'Queue Velocity' }, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Queue velocity report failed: ${msg}` });
  }
});

/* ─── GET /enrollment-completion — I.1 Report 5 (renamed) ────── */

adminReportingRoutes.get('/enrollment-completion', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);

  try {
    const { result, meta } = await buildEnrollmentReport(filter, range);
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.enrollment_completion.generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { filter, range, generatedAt: meta.generatedAt, sourceHash: meta.sourceHash, enrollments: result.totals.enrollments },
      reason: null,
      context: { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, route: '/api/admin/reporting/enrollment-completion', method: 'GET', requestId: null },
    });
    res.status(200).json({ ok: true, meta: { ...meta, title: 'Enrollment Completion' }, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Enrollment completion report failed: ${msg}` });
  }
});

/* ─── GET /follow-up-aging — I.1 Report 6 ──────────────────── */

adminReportingRoutes.get('/follow-up-aging', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);

  try {
    const { result, meta } = await buildFollowUpReport(filter, range);
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.follow_up_aging.generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { filter, range, generatedAt: meta.generatedAt, sourceHash: meta.sourceHash, prospects: result.totals.prospects },
      reason: null,
      context: { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, route: '/api/admin/reporting/follow-up-aging', method: 'GET', requestId: null },
    });
    res.status(200).json({ ok: true, meta: { ...meta, title: 'Follow-Up Aging' }, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Follow-up aging report failed: ${msg}` });
  }
});

/* ─── GET /leader-scorecards — I.1 Report 9 (Kevin-only) ────── */

adminReportingRoutes.get('/leader-scorecards', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);

  try {
    const { result, meta } = await buildLeaderScorecardReport(filter, range);
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.leader_scorecards.generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { filter, range, generatedAt: meta.generatedAt, sourceHash: meta.sourceHash, leaderCount: result.leaderCount },
      reason: null,
      context: { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, route: '/api/admin/reporting/leader-scorecards', method: 'GET', requestId: null },
    });
    res.status(200).json({ ok: true, meta: { ...meta, title: 'Leader Scorecards' }, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Leader scorecards report failed: ${msg}` });
  }
});

/* ─── I.4/I.5 · CSV export (Chat #144) ──────────────────────────
 *
 * Seven export routes — one per I.1 report. The redact choice is a
 * required boolean query param (Kevin picks per-export via the
 * RedactionModal in apps/admin). Format defaults to CSV; PDF and
 * JSON formats are reserved for future tranches but the param is
 * accepted now so the URL is stable.
 *
 * Audit (per brief #144 / locked-spec 4.J):
 *   action  = 'admin.report_export'
 *   entity  = { kind: 'admin_session', id: actor.tmagId } — the export is a
 *             session-scoped read; the reportKey + redact + rowCount live
 *             in `after` so the audit drill-in shows them
 *   severity= 'info'
 *
 * Each route follows the same three-step shape: parse filter+range,
 * build the report via the existing domain fn, hand the result to the
 * corresponding `export*` serializer in domain/reports/export.ts.
 */

function parseRedact(req: Request): boolean {
  const v = typeof req.query.redact === 'string' ? req.query.redact.toLowerCase() : '';
  // Default to redacted — safest if a caller forgets the param. The UI always
  // sends an explicit choice, so this default only protects against curl typos.
  return v !== 'false' && v !== '0' && v !== 'no';
}

function streamCsv(res: import('express').Response, out: ExportOutput): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
  res.setHeader('Content-Length', String(Buffer.byteLength(out.csv, 'utf8')));
  res.setHeader('Cache-Control', 'no-store');
  res.end(out.csv);
}

async function auditExport(
  req: Request,
  reportKey: string,
  redact: boolean,
  rowCount: number,
  sourceHash: string,
  generatedAt: string,
  routePath: string,
): Promise<void> {
  await appendAuditEntry({
    actor: adminActorFromRequest(req),
    action: 'admin.report_export',
    entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
    severity: 'info',
    after: { reportKey, redact, rowCount, sourceHash, generatedAt, format: 'csv' },
    reason: null,
    context: {
      ip: req.ip ?? null,
      userAgent: req.get('user-agent') ?? null,
      route: routePath,
      method: 'GET',
      requestId: null,
    },
  });
}

adminReportingRoutes.get('/activation/export', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);
  const redact = parseRedact(req);

  try {
    const { result, meta } = await buildBaActivationReport(filter, range);
    const out = exportBaActivation({
      reportKey: 'ba_activation',
      result,
      meta: { ...meta, title: 'BA Activation' },
      redact,
    });
    await auditExport(req, 'ba_activation', redact, out.rowCount, meta.sourceHash, meta.generatedAt, '/api/admin/reporting/activation/export');
    streamCsv(res, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Activation export failed: ${msg}` });
  }
});

adminReportingRoutes.get('/training/export', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);
  const redact = parseRedact(req);

  try {
    const { result, meta } = await buildTrainingReport(filter, range);
    const out = exportTraining({
      reportKey: 'training_completion',
      result,
      meta: { ...meta, title: 'Training Completion' },
      redact,
    });
    await auditExport(req, 'training_completion', redact, out.rowCount, meta.sourceHash, meta.generatedAt, '/api/admin/reporting/training/export');
    streamCsv(res, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Training export failed: ${msg}` });
  }
});

adminReportingRoutes.get('/invite-funnel/export', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);
  const redact = parseRedact(req);
  const rawSort = typeof req.query.sort === 'string' ? req.query.sort : '';
  const perBaSort: 'completes' | 'mints' | 'completion_pct' =
    rawSort === 'mints' || rawSort === 'completion_pct' ? rawSort : 'completes';

  try {
    const { result, meta } = await buildInviteFunnelReport(filter, range, perBaSort);
    const out = exportInviteFunnel({
      reportKey: 'invite_to_presentation',
      result,
      meta: { ...meta, title: 'Invite-to-Presentation Movement' },
      redact,
    });
    await auditExport(req, 'invite_to_presentation', redact, out.rowCount, meta.sourceHash, meta.generatedAt, '/api/admin/reporting/invite-funnel/export');
    streamCsv(res, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Invite funnel export failed: ${msg}` });
  }
});

adminReportingRoutes.get('/queue-velocity/export', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);
  const redact = parseRedact(req);

  try {
    const { result, meta } = await buildQueueVelocityReport(filter, range);
    const out = exportQueueVelocity({
      reportKey: 'queue_velocity',
      result,
      meta: { ...meta, title: 'Queue Velocity' },
      redact,
    });
    await auditExport(req, 'queue_velocity', redact, out.rowCount, meta.sourceHash, meta.generatedAt, '/api/admin/reporting/queue-velocity/export');
    streamCsv(res, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Queue velocity export failed: ${msg}` });
  }
});

adminReportingRoutes.get('/enrollment-completion/export', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);
  const redact = parseRedact(req);

  try {
    const { result, meta } = await buildEnrollmentReport(filter, range);
    const out = exportEnrollment({
      reportKey: 'enrollment_completion',
      result,
      meta: { ...meta, title: 'Enrollment Completion' },
      redact,
    });
    await auditExport(req, 'enrollment_completion', redact, out.rowCount, meta.sourceHash, meta.generatedAt, '/api/admin/reporting/enrollment-completion/export');
    streamCsv(res, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Enrollment completion export failed: ${msg}` });
  }
});

adminReportingRoutes.get('/follow-up-aging/export', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);
  const redact = parseRedact(req);

  try {
    const { result, meta } = await buildFollowUpReport(filter, range);
    const out = exportFollowUp({
      reportKey: 'follow_up_aging',
      result,
      meta: { ...meta, title: 'Follow-Up Aging' },
      redact,
    });
    await auditExport(req, 'follow_up_aging', redact, out.rowCount, meta.sourceHash, meta.generatedAt, '/api/admin/reporting/follow-up-aging/export');
    streamCsv(res, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Follow-up aging export failed: ${msg}` });
  }
});

adminReportingRoutes.get('/leader-scorecards/export', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({ ok: false, error: 'Invalid filter.', issues: (err as z.ZodError).issues });
    return;
  }
  const range = parseRange(req);
  const redact = parseRedact(req);

  try {
    const { result, meta } = await buildLeaderScorecardReport(filter, range);
    const out = exportLeaderScorecards({
      reportKey: 'leader_scorecards',
      result,
      meta: { ...meta, title: 'Leader Scorecards' },
      redact,
    });
    await auditExport(req, 'leader_scorecards', redact, out.rowCount, meta.sourceHash, meta.generatedAt, '/api/admin/reporting/leader-scorecards/export');
    streamCsv(res, out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Leader scorecards export failed: ${msg}` });
  }
});

adminReportingRoutes.get('/mission-funnel', requireAdmin, async (req, res) => {
  try {
    const report = await buildMissionFunnelReport();
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.reporting.konga_mission_funnel_generated',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      before: null,
      after: {
        reportOnly: true,
        generatedAt: report.generatedAt,
        eventCount: report.events.length,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/reporting/mission-funnel',
        method: 'GET',
        requestId: null,
      },
    });
    return res.status(200).json(report);
  } catch (error) {
    console.error('[GET /api/admin/reporting/mission-funnel] failed', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});
