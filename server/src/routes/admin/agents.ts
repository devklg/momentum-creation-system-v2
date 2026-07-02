/**
 * /api/admin/agents — Agent 6 admin oversight for Success Profiles and memory.
 *
 * Read-only Kevin/Admin shell for Steve/Michael/Ivory support context. This
 * does not expose Success Profile fields to the BA editable profile and does
 * not perform GraphRAG writes from the repo server. Bridge rows are drafts that
 * name the required schema-enforced external MCP tool server quadstack path.
 */

import express, { type Request, type Router } from 'express';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import { buildAdminAgentOversight } from '../../domain/adminAgentMemory.js';
import type { McsAuditActor } from '@momentum/shared';

export const adminAgentsRoutes: Router = express.Router();

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

adminAgentsRoutes.get('/overview', requireAdmin, async (req, res) => {
  try {
    const payload = await buildAdminAgentOversight();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.agents.overview.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        generatedAt: payload.generatedAt,
        successProfiles: payload.successProfiles.length,
        bridgeDrafts: payload.bridgeDrafts.length,
        warnings: payload.warnings.length,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/agents/overview',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Agent oversight failed: ${msg}` });
  }
});
