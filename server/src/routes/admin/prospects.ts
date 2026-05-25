/**
 * /api/admin/prospects — Section D · Prospect Oversight server surface
 * (locked-spec 4.D · wireframe 4.D · brief: TASK-admin-d.md).
 *
 * Thin Express layer over `domain/adminProspectOversight.ts`. Every
 * handler appends one audit entry through the 4.J substrate per the
 * TASK-134 hard rule: "every /admin request writes an audit entry."
 * Reads produce `severity:'info'`; interventions produce
 * `severity:'critical'` (audit entry is written inside the domain layer
 * for the four interventions and for note-append, so the route only
 * stamps an additional `*.viewed` info entry).
 *
 *   GET  /             directory rows (D.1)              info
 *   GET  /filters      filter-bar options                info
 *   GET  /:prospectId  detail panel (D.2)                info
 *   GET  /:prospectId/sandbox-preview  pure-read snapshot info
 *   POST /:prospectId/notes            append Kevin note (audit inside domain)
 *   POST /:prospectId/move             intervention      (audit inside domain)
 *   POST /:prospectId/reassign-sponsor intervention      (audit inside domain)
 *   POST /:prospectId/manual-flush     intervention      (audit inside domain)
 *   POST /:prospectId/force-enroll     intervention      (audit inside domain)
 *
 * Filter contract — server-enforced, narrowing only. Matches B.2
 * exactly so the same FilterBar component can target either route.
 *
 * Compliance: this surface is /admin-gated (Kevin-only via ADMIN_BA_IDS).
 * The intervention paths are critical-severity overrides per locked-spec
 * 2.4: reason is required (min 8 chars), requestingBaId is required.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import {
  appendProspectNote,
  buildDetailPayload,
  executeForceEnrollIntervention,
  executeManualFlushIntervention,
  executeMoveIntervention,
  executeReassignSponsorIntervention,
  getDirectoryFilterOptions,
  InterventionError,
  LEADER_DETECTION_NOTE,
  listDirectoryRows,
  synthesizeAdminSandboxPreview,
} from '../../domain/adminProspectOversight.js';
import { appendAuditEntry, queryAuditEntries } from '../../domain/auditLog.js';
import type {
  AdminDashboardFilter,
  AdminProspectActivityEvent,
  AdminProspectActivityEventKind,
  AdminProspectAddNoteResponse,
  AdminProspectDetailResponse,
  AdminProspectDirectoryResponse,
  AuditActor,
  AuditContext,
  AuditLogEntry,
} from '@momentum/shared';

export const adminProspectsRoutes: Router = express.Router();

/* ─── shared parsing helpers ────────────────────────────────────── */

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

function adminActorFromRequest(
  req: Request,
): AuditActor & { kind: 'admin' } {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.baId;
  return { kind: 'admin', baId: session.baId, displayName };
}

function contextFromRequest(req: Request, route: string, method: string): AuditContext {
  return {
    ip: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
    route,
    method,
    requestId: null,
  };
}

/* ─── GET /  (D.1 directory) ────────────────────────────────────── */

adminProspectsRoutes.get('/', requireAdmin, async (req, res) => {
  let filter: AdminDashboardFilter;
  try {
    filter = parseFilter(req);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid filter.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }

  try {
    const rows = await listDirectoryRows(filter);

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.prospects.directory.viewed',
      entity: { kind: 'admin_session', id: req.session!.baId, displayLabel: null },
      severity: 'info',
      after: { filter, rowCount: rows.length },
      reason: null,
      context: contextFromRequest(req, '/api/admin/prospects', 'GET'),
    });

    const body: AdminProspectDirectoryResponse = {
      ok: true,
      rows,
      appliedFilter: filter,
      computedAt: new Date().toISOString(),
      leaderDetectionNote: LEADER_DETECTION_NOTE,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Directory failed: ${msg}` });
  }
});

/* ─── GET /filters ──────────────────────────────────────────────── */

adminProspectsRoutes.get('/filters', requireAdmin, async (req, res) => {
  try {
    const { bas, leaderGroups, leaderDetectionNote } = await getDirectoryFilterOptions();

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.prospects.filters.viewed',
      entity: { kind: 'admin_session', id: req.session!.baId, displayLabel: null },
      severity: 'info',
      reason: null,
      context: contextFromRequest(req, '/api/admin/prospects/filters', 'GET'),
    });

    res.json({ ok: true, bas, leaderGroups, leaderDetectionNote });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Filters failed: ${msg}` });
  }
});

/* ─── GET /:prospectId  (D.2 detail) ────────────────────────────── */

const ProspectIdSchema = z.string().min(4).max(120);

adminProspectsRoutes.get('/:prospectId', requireAdmin, async (req, res) => {
  let prospectId: string;
  try {
    prospectId = ProspectIdSchema.parse(req.params.prospectId);
  } catch {
    res.status(400).json({ ok: false, error: 'Invalid prospectId.' });
    return;
  }

  try {
    const detail = await buildDetailPayload(prospectId);
    if (!detail) {
      res.status(404).json({ ok: false, error: 'Prospect not found.' });
      return;
    }

    // Fold the admin-action audit timeline into detail.activity. The detail
    // builder returns the non-admin (system) timeline; admin actions live
    // in audit_log and are merged here for one consolidated chronological
    // view. The audit_log read is scoped to entity {kind:'prospect', id}
    // and pool_placement / audit_session entries are filtered out.
    const auditPage = await queryAuditEntries({
      entityKind: 'prospect',
      entityId: prospectId,
      limit: 250,
    });
    const placementAudits = await queryAuditEntries({
      entityKind: 'pool_placement',
      entityId: prospectId,
      limit: 250,
    });
    const adminEvents: AdminProspectActivityEvent[] = [
      ...auditPage.entries,
      ...placementAudits.entries,
    ]
      .map(toActivityEventFromAudit)
      .filter((e): e is AdminProspectActivityEvent => e !== null);

    const merged = [...detail.activity, ...adminEvents].sort((a, b) =>
      a.at < b.at ? -1 : a.at > b.at ? 1 : 0,
    );

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.prospect.detail.viewed',
      entity: {
        kind: 'prospect',
        id: prospectId,
        displayLabel: `${detail.firstName} ${detail.lastName}`,
      },
      severity: 'info',
      after: { prospectId, activityEventCount: merged.length },
      reason: null,
      context: contextFromRequest(req, '/api/admin/prospects/:prospectId', 'GET'),
    });

    const body: AdminProspectDetailResponse = {
      ok: true,
      detail: { ...detail, activity: merged },
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Detail failed: ${msg}` });
  }
});

/* ─── GET /:prospectId/sandbox-preview  (D.1/D.2 click target) ──── */

adminProspectsRoutes.get(
  '/:prospectId/sandbox-preview',
  requireAdmin,
  async (req, res) => {
    let prospectId: string;
    try {
      prospectId = ProspectIdSchema.parse(req.params.prospectId);
    } catch {
      res.status(400).json({ ok: false, error: 'Invalid prospectId.' });
      return;
    }
    try {
      const payload = await synthesizeAdminSandboxPreview(prospectId);
      if (!payload) {
        res.status(404).json({ ok: false, error: 'Prospect or token not found.' });
        return;
      }

      // Audit the sandbox preview view so the trail captures "Kevin
      // inspected the prospect-routed URL for X". No state advances.
      await appendAuditEntry({
        actor: adminActorFromRequest(req),
        action: 'admin.prospect.sandbox_preview.viewed',
        entity: { kind: 'prospect', id: prospectId, displayLabel: null },
        severity: 'info',
        after: { tokenState: payload.state, positionNumber: payload.prospect.positionNumber },
        reason: null,
        context: contextFromRequest(
          req,
          '/api/admin/prospects/:prospectId/sandbox-preview',
          'GET',
        ),
      });

      res.json({ ok: true, payload });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Sandbox preview failed: ${msg}` });
    }
  },
);

/* ─── POST /:prospectId/notes  (Kevin's append-only note) ───────── */

const AddNoteSchema = z.object({
  body: z.string().min(1).max(4000),
});

adminProspectsRoutes.post('/:prospectId/notes', requireAdmin, async (req, res) => {
  let prospectId: string;
  let bodyParsed: { body: string };
  try {
    prospectId = ProspectIdSchema.parse(req.params.prospectId);
    bodyParsed = AddNoteSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid request.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }

  try {
    const out: AdminProspectAddNoteResponse = await appendProspectNote({
      prospectId,
      body: bodyParsed.body,
      actor: adminActorFromRequest(req),
      context: contextFromRequest(req, '/api/admin/prospects/:prospectId/notes', 'POST'),
    });
    res.status(201).json(out);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Add note failed: ${msg}` });
  }
});

/* ─── POST /:prospectId/move ────────────────────────────────────── */

const MoveSchema = z.object({
  requestingBaId: z.string().min(2).max(80),
  reason: z.string().min(8).max(2000),
  toBaId: z.string().min(2).max(80),
});

adminProspectsRoutes.post('/:prospectId/move', requireAdmin, (req, res) =>
  runIntervention(req, res, '/api/admin/prospects/:prospectId/move', async () => {
    const prospectId = ProspectIdSchema.parse(req.params.prospectId);
    const body = MoveSchema.parse(req.body);
    return executeMoveIntervention({
      prospectId,
      body,
      actor: adminActorFromRequest(req),
      context: contextFromRequest(req, '/api/admin/prospects/:prospectId/move', 'POST'),
    });
  }),
);

/* ─── POST /:prospectId/reassign-sponsor ─────────────────────── */

const ReassignSchema = z.object({
  requestingBaId: z.string().min(2).max(80),
  reason: z.string().min(8).max(2000),
  newSponsorBaId: z.string().min(2).max(80),
});

adminProspectsRoutes.post(
  '/:prospectId/reassign-sponsor',
  requireAdmin,
  (req, res) =>
    runIntervention(
      req,
      res,
      '/api/admin/prospects/:prospectId/reassign-sponsor',
      async () => {
        const prospectId = ProspectIdSchema.parse(req.params.prospectId);
        const body = ReassignSchema.parse(req.body);
        return executeReassignSponsorIntervention({
          prospectId,
          body,
          actor: adminActorFromRequest(req),
          context: contextFromRequest(
            req,
            '/api/admin/prospects/:prospectId/reassign-sponsor',
            'POST',
          ),
        });
      },
    ),
);

/* ─── POST /:prospectId/manual-flush ────────────────────────── */

const FlushSchema = z.object({
  requestingBaId: z.string().min(2).max(80),
  reason: z.string().min(8).max(2000),
});

adminProspectsRoutes.post('/:prospectId/manual-flush', requireAdmin, (req, res) =>
  runIntervention(
    req,
    res,
    '/api/admin/prospects/:prospectId/manual-flush',
    async () => {
      const prospectId = ProspectIdSchema.parse(req.params.prospectId);
      const body = FlushSchema.parse(req.body);
      return executeManualFlushIntervention({
        prospectId,
        body,
        actor: adminActorFromRequest(req),
        context: contextFromRequest(
          req,
          '/api/admin/prospects/:prospectId/manual-flush',
          'POST',
        ),
      });
    },
  ),
);

/* ─── POST /:prospectId/force-enroll ────────────────────────── */

const ForceEnrollSchema = z.object({
  requestingBaId: z.string().min(2).max(80),
  reason: z.string().min(8).max(2000),
});

adminProspectsRoutes.post('/:prospectId/force-enroll', requireAdmin, (req, res) =>
  runIntervention(
    req,
    res,
    '/api/admin/prospects/:prospectId/force-enroll',
    async () => {
      const prospectId = ProspectIdSchema.parse(req.params.prospectId);
      const body = ForceEnrollSchema.parse(req.body);
      return executeForceEnrollIntervention({
        prospectId,
        body,
        actor: adminActorFromRequest(req),
        context: contextFromRequest(
          req,
          '/api/admin/prospects/:prospectId/force-enroll',
          'POST',
        ),
      });
    },
  ),
);

/* ─── intervention runner — uniform error handling ──────────────── */

async function runIntervention(
  _req: Request,
  res: Response,
  _route: string,
  exec: () => Promise<unknown>,
): Promise<void> {
  try {
    const out = await exec();
    res.status(200).json(out);
  } catch (err) {
    if (err instanceof InterventionError) {
      res.status(err.status).json({ ok: false, error: err.code });
      return;
    }
    if (err instanceof z.ZodError) {
      res.status(400).json({ ok: false, error: 'Invalid request.', issues: err.issues });
      return;
    }
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Intervention failed: ${msg}` });
  }
}

/* ─── audit → activity-event projection ─────────────────────────── */

function toActivityEventFromAudit(
  entry: AuditLogEntry,
): AdminProspectActivityEvent | null {
  let kind: AdminProspectActivityEventKind;
  let label: string;
  switch (entry.action) {
    case 'admin.prospect.move':
      kind = 'admin_move';
      label = 'Moved by admin to a different inviting BA';
      break;
    case 'admin.prospect.sponsor.reassigned':
      kind = 'admin_reassign_sponsor';
      label = 'Sponsor reassigned by admin';
      break;
    case 'admin.prospect.manual_flush':
      kind = 'admin_manual_flush';
      label = 'Manual flush by admin';
      break;
    case 'admin.prospect.force_enroll':
      kind = 'admin_force_enroll';
      label = 'Force-enrolled by admin';
      break;
    case 'admin.prospect.note.appended':
      kind = 'admin_kevin_note';
      label = 'Admin note appended';
      break;
    default:
      return null;
  }
  return {
    eventId: entry.entryId,
    at: entry.timestamp,
    kind,
    label,
    ip: entry.context?.ip ?? null,
    referrer: null,
    details: {
      reason: entry.reason,
      before: entry.before,
      after: entry.after,
      auditEntryId: entry.entryId,
    },
  };
}
