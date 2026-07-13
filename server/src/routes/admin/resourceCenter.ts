import { Router, type Request } from 'express';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { buildResourceUsageSummary } from '../../domain/resourceUsage.js';
import { appendAuditEntry } from '../../domain/auditLog.js';

export const adminResourceCenterRoutes: Router = Router();

adminResourceCenterRoutes.get('/analytics', requireAdmin, async (_req, res) => {
  try {
    const report = await buildResourceUsageSummary();
    const req = _req as Request;
    await appendAuditEntry({
      actor: { kind: 'admin', tmagId: req.session!.tmagId, displayName: req.session!.tmagId },
      action: 'admin.resource_center.analytics.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: report.totals.staleReviewWarnings > 0 ? 'warn' : 'info',
      after: { generatedAt: report.generatedAt, totals: report.totals, policy: report.policy },
      reason: null,
      context: { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, route: '/api/admin/resource-center/analytics', method: 'GET', requestId: null },
    });
    res.status(200).json(report);
  } catch (error) {
    console.error('[GET /api/admin/resource-center/analytics] failed', error);
    res.status(503).json({ ok: false, error: 'resource_analytics_unavailable' });
  }
});
