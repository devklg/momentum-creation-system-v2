/**
 * /api/admin/vm — Agent 6 VM oversight surface.
 *
 * Kevin-only reads for global VM campaign analytics plus an audited ownership
 * correction stub. The stub records the correction request but does not mutate
 * ownership until the upstream VM ownership domain lands.
 */

import express, { type Request, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import {
  buildAdminVmCampaignProgress,
  buildAdminVmOverview,
  buildAdminVmQueueState,
  runAdminVmDialerAction,
} from '../../domain/adminVm.js';
import type {
  McsAdminVmDialerAction,
  McsAdminVmOwnershipCorrectionPayload,
  McsAdminVmOwnershipCorrectionResponse,
  McsAuditActor,
} from '@momentum/shared';

export const adminVmRoutes: Router = express.Router();

function adminActorFromRequest(req: Request): McsAuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

adminVmRoutes.get('/overview', requireAdmin, async (req, res) => {
  try {
    const payload = await buildAdminVmOverview();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.vm.overview.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        generatedAt: payload.generatedAt,
        campaigns: payload.campaigns.length,
        leadOwners: payload.leadOwners.length,
        warnings: payload.warnings.length,
      },
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/vm/overview',
        method: 'GET',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `VM overview failed: ${msg}` });
  }
});

adminVmRoutes.get('/queue', requireAdmin, async (_req, res) => {
  try {
    const payload = await buildAdminVmQueueState();
    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `VM queue failed: ${msg}` });
  }
});

adminVmRoutes.get('/campaigns/:id/progress', requireAdmin, async (req, res) => {
  const campaignId = String(req.params.id ?? '').trim();
  if (!campaignId) {
    res.status(400).json({ ok: false, error: 'Missing campaign id.' });
    return;
  }
  try {
    const payload = await buildAdminVmCampaignProgress(campaignId);
    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `VM campaign progress failed: ${msg}` });
  }
});

const ACTION_BY_ROUTE: Record<string, McsAdminVmDialerAction> = {
  pause: 'pause',
  resume: 'resume',
  'retry-failed': 'retry_failed',
  cancel: 'cancel',
};

adminVmRoutes.post('/campaigns/:id/:action', requireAdmin, async (req, res) => {
  const campaignId = String(req.params.id ?? '').trim();
  const routeAction = String(req.params.action ?? '').trim();
  const action = ACTION_BY_ROUTE[routeAction];
  if (!campaignId) {
    res.status(400).json({ ok: false, error: 'Missing campaign id.' });
    return;
  }
  if (!action) {
    res.status(404).json({ ok: false, error: 'Unknown VM campaign action.' });
    return;
  }
  try {
    const payload = await runAdminVmDialerAction({
      vmCampaignId: campaignId,
      action,
      actorTmagId: req.session!.tmagId,
    });

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: `admin.vm.${action}`,
      entity: { kind: 'admin_session', id: campaignId, displayLabel: null },
      severity: action === 'cancel' ? 'critical' : 'warn',
      after: payload as unknown as Record<string, unknown>,
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: `/api/admin/vm/campaigns/${campaignId}/${routeAction}`,
        method: 'POST',
        requestId: null,
      },
    });

    res.status(200).json(payload);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `VM action failed: ${msg}` });
  }
});

const OwnershipCorrectionSchema = z.object({
  leadId: z.string().trim().min(1).nullable().optional(),
  prospectId: z.string().trim().min(1).nullable().optional(),
  leadOwnerId: z.string().trim().min(1).nullable().optional(),
  vmCampaignId: z.string().trim().min(1).nullable().optional(),
  oldOwnerTmagId: z.string().trim().min(2),
  newOwnerTmagId: z.string().trim().min(2),
  oldSponsorTmagId: z.string().trim().min(2),
  newSponsorTmagId: z.string().trim().min(2),
  reason: z.string().trim().min(12).max(1000),
}).refine(
  (payload) => payload.leadId || payload.prospectId || payload.leadOwnerId || payload.vmCampaignId,
  {
    message: 'Provide at least one target id.',
    path: ['leadId'],
  },
);

adminVmRoutes.post('/ownership-correction', requireAdmin, async (req, res) => {
  const parsed = OwnershipCorrectionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: 'Invalid ownership correction payload.',
      issues: parsed.error.issues,
    });
    return;
  }

  const payload: McsAdminVmOwnershipCorrectionPayload = parsed.data;

  try {
    const audit = await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.vm.ownership_correction.requested_stub',
      entity: {
        kind: 'prospect',
        id:
          payload.prospectId ??
          payload.leadId ??
          payload.leadOwnerId ??
          payload.vmCampaignId ??
          'unknown',
        displayLabel: null,
      },
      severity: 'critical',
      before: {
        ownerTmagId: payload.oldOwnerTmagId,
        sponsorTmagId: payload.oldSponsorTmagId,
      },
      after: {
        ownerTmagId: payload.newOwnerTmagId,
        sponsorTmagId: payload.newSponsorTmagId,
        leadId: payload.leadId ?? null,
        prospectId: payload.prospectId ?? null,
        leadOwnerId: payload.leadOwnerId ?? null,
        vmCampaignId: payload.vmCampaignId ?? null,
        applied: false,
      },
      reason: payload.reason,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/vm/ownership-correction',
        method: 'POST',
        requestId: null,
      },
    });

    const body: McsAdminVmOwnershipCorrectionResponse = {
      ok: true,
      applied: false,
      auditEntryId: audit.entryId,
      note:
        'Correction request was audit-logged. Ownership mutation waits for the Agent 2 VM ownership service so every affected lead, CRM, token, and graph edge changes together.',
    };
    res.status(202).json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Ownership correction audit failed: ${msg}` });
  }
});
