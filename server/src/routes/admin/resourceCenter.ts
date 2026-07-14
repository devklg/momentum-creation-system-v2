import { Router, type Request } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { buildResourceUsageSummaryPage } from '../../domain/resourceUsage.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import { AdminCursorError } from '../../domain/adminPagination.js';

export const adminResourceCenterRoutes: Router = Router();

adminResourceCenterRoutes.get('/analytics', requireAdmin, async (_req, res) => {
  const parsed = z.object({
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(20).max(2000).optional(),
  }).safeParse(_req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'invalid_pagination', issues: parsed.error.issues });
    return;
  }
  try {
    const report = await buildResourceUsageSummaryPage(parsed.data);
    const req = _req as Request;
    await appendAuditEntry({
      actor: { kind: 'admin', tmagId: req.session!.tmagId, displayName: req.session!.tmagId },
      action: 'admin.resource_center.analytics.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: report.totals.staleReviewWarnings > 0 ? 'warn' : 'info',
      after: {
        sort: 'updatedAt_desc_resourceVersionId_desc',
        pageSize: report.pageInfo.pageSize,
        returnedCount: report.resources.length,
        hasMore: report.pageInfo.hasMore,
        cursorSupplied: !!parsed.data.cursor,
      },
      reason: null,
      context: { ip: req.ip ?? null, userAgent: req.get('user-agent') ?? null, route: '/api/admin/resource-center/analytics', method: 'GET', requestId: null },
    });
    res.status(200).json({
      ...report,
      appliedSort: 'updatedAt_desc_resourceVersionId_desc',
      computedAt: report.generatedAt,
    });
  } catch (error) {
    if (error instanceof AdminCursorError) {
      res.status(400).json({ ok: false, error: error.code });
      return;
    }
    console.error('[GET /api/admin/resource-center/analytics] failed', error);
    res.status(503).json({ ok: false, error: 'resource_analytics_unavailable' });
  }
});
