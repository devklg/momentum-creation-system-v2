/**
 * /api/admin/tenant - Section F · Tenant Architecture.
 *
 * Kevin-only master settings, template/content control, role/permission map,
 * content inheritance, and save-time compliance validation.
 */

import express, { type Request, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import {
  getTenantOverview,
  saveTenantSettings,
  saveTenantTemplate,
  TenantComplianceError,
  TENANT_TEMPLATE_DEFINITIONS,
  validateMasterContent,
} from '../../domain/adminTenantArchitecture.js';
import type {
  AuditActor,
  TenantOverviewResponse,
  TenantSurface,
  TenantTemplateKey,
  UpdateTenantSettingsResponse,
  SaveTenantTemplateResponse,
  ValidateTenantTemplateResponse,
} from '@momentum/shared';

export const adminTenantRoutes: Router = express.Router();

const SurfaceSchema = z.enum(['com', 'team', 'admin', 'system']);
const TemplateKeySchema = z.enum(
  TENANT_TEMPLATE_DEFINITIONS.map((d) => d.templateKey) as [
    TenantTemplateKey,
    ...TenantTemplateKey[],
  ],
);

const SettingsBody = z.object({
  settings: z.object({
    tenantName: z.string().min(2).max(120),
    publicComDomain: z.string().min(3).max(160),
    teamDomain: z.string().min(3).max(160),
    adminDomain: z.string().min(3).max(160),
  }),
  reason: z.string().min(1).max(500),
});

const TemplateBody = z.object({
  content: z.string().min(1).max(20_000),
  reason: z.string().min(1).max(500),
});

const ValidateBody = z.object({
  surface: SurfaceSchema,
  content: z.string().max(20_000),
});

function adminActorFromRequest(req: Request): AuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.tmagId;
  return { kind: 'admin', tmagId: session.tmagId, displayName };
}

function baseContext(req: Request, route: string, method: string) {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    route,
    method,
    requestId: null,
  };
}

adminTenantRoutes.get('/overview', requireAdmin, async (req, res) => {
  try {
    const overview = await getTenantOverview();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.tenant.overview.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        templates: overview.templates.length,
        roles: overview.roleMatrix.length,
      },
      reason: null,
      context: baseContext(req, '/api/admin/tenant/overview', 'GET'),
    });

    const body: TenantOverviewResponse = { ok: true, overview };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Tenant overview failed: ${msg}` });
  }
});

adminTenantRoutes.patch('/settings', requireAdmin, async (req, res) => {
  const parsed = SettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: 'Invalid settings payload.',
      details: parsed.error.flatten(),
    });
    return;
  }

  const actor = adminActorFromRequest(req);
  try {
    const { before, after, version } = await saveTenantSettings({
      settings: parsed.data.settings,
      actor,
      reason: parsed.data.reason,
    });

    await appendAuditEntry({
      actor,
      action: 'admin.tenant.settings.changed',
      entity: {
        kind: 'compliance_rule',
        id: after.tenantId,
        displayLabel: `${after.tenantName} tenant settings`,
      },
      severity: 'warn',
      before: before as unknown as Record<string, unknown>,
      after: { ...(after as unknown as Record<string, unknown>), version: version.version },
      reason: parsed.data.reason,
      context: baseContext(req, '/api/admin/tenant/settings', 'PATCH'),
    });

    const verified = (await getTenantOverview()).settings;
    const body: UpdateTenantSettingsResponse = { ok: true, settings: verified };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Tenant settings save failed: ${msg}` });
  }
});

adminTenantRoutes.post('/templates/validate', requireAdmin, async (req, res) => {
  const parsed = ValidateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: 'Invalid validation payload.',
      details: parsed.error.flatten(),
    });
    return;
  }

  const validation = validateMasterContent(
    parsed.data.surface as TenantSurface,
    parsed.data.content,
  );
  const body: ValidateTenantTemplateResponse = { ok: true, validation };
  res.json(body);
});

adminTenantRoutes.put('/templates/:templateKey', requireAdmin, async (req, res) => {
  const params = z.object({ templateKey: TemplateKeySchema }).safeParse(req.params);
  const body = TemplateBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({
      ok: false,
      error: 'Invalid template save payload.',
      details: {
        params: params.success ? null : params.error.flatten(),
        body: body.success ? null : body.error.flatten(),
      },
    });
    return;
  }

  const actor = adminActorFromRequest(req);
  try {
    const result = await saveTenantTemplate({
      templateKey: params.data.templateKey,
      content: body.data.content,
      actor,
      reason: body.data.reason,
    });

    await appendAuditEntry({
      actor,
      action: 'admin.tenant.master_content.saved',
      entity: {
        kind: 'master_content',
        id: result.after.templateKey,
        displayLabel: result.after.label,
      },
      severity: 'critical',
      before: {
        version: result.before.version,
        source: result.before.source,
        content: result.before.content,
      },
      after: {
        version: result.after.version,
        source: result.after.source,
        content: result.after.content,
        validation: result.validation,
      },
      reason: body.data.reason,
      context: baseContext(
        req,
        `/api/admin/tenant/templates/${params.data.templateKey}`,
        'PUT',
      ),
    });

    const response: SaveTenantTemplateResponse = {
      ok: true,
      template: result.after,
      validation: result.validation,
    };
    res.json(response);
  } catch (err) {
    if (err instanceof TenantComplianceError) {
      await appendAuditEntry({
        actor,
        action: 'admin.tenant.master_content.blocked',
        entity: {
          kind: 'master_content',
          id: params.data.templateKey,
          displayLabel: params.data.templateKey,
        },
        severity: 'critical',
        before: null,
        after: { validation: err.validation },
        reason: body.data.reason,
        context: baseContext(
          req,
          `/api/admin/tenant/templates/${params.data.templateKey}`,
          'PUT',
        ),
      });
      res.status(422).json({
        ok: false,
        error: err.message,
        validation: err.validation,
      });
      return;
    }

    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg.startsWith('unknown_template_key')) {
      res.status(404).json({ ok: false, error: 'Unknown template key.' });
      return;
    }
    res.status(500).json({ ok: false, error: `Template save failed: ${msg}` });
  }
});
