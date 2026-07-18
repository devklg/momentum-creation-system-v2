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
 * Compliance: this surface is /admin-gated (Kevin-only via ADMIN_TMAG_IDS).
 * The intervention paths are critical-severity overrides per locked-spec
 * 2.4: reason is required (min 8 chars), requestingTmagId is required.
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
  listProspectDirectoryPage,
  synthesizeAdminSandboxPreview,
} from '../../domain/adminProspectOversight.js';
import { AdminCursorError } from '../../domain/adminPagination.js';
import {
  adminCreateProspect,
  adminEditProspect,
  adminSoftDeleteProspect,
  adminRestoreProspect,
  type AdminProspectCrudError,
} from '../../domain/adminProspectCrud.js';
import {
  flushExpiredPlacements,
  listProspectsAgedBeyond,
  HOLDING_TANK_WINDOW_WEEKS,
} from '../../domain/holdingTank.js';
import { appendAuditEntry, queryAuditEntries } from '../../domain/auditLog.js';
import {
  attestKongaEnrollment,
  KongaEnrollmentError,
} from '../../domain/kongaEnrollment.js';
import type {
  McsAdminDashboardFilter,
  McsAdminProspectActivityEvent,
  McsAdminProspectActivityEventKind,
  McsAdminProspectAddNoteResponse,
  McsAdminProspectDetailResponse,
  McsAdminProspectDirectoryResponse,
  McsAdminPaginationContract,
  McsAuditActor,
  McsAuditContext,
  McsAuditLogEntry,
} from '@momentum/shared';

export const adminProspectsRoutes: Router = express.Router();

/* ─── shared parsing helpers ────────────────────────────────────── */

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

function adminActorFromRequest(
  req: Request,
): McsAuditActor & { kind: 'admin' } {
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

/* ─── GET /  (D.1 directory) ────────────────────────────────────── */

adminProspectsRoutes.get('/', requireAdmin, async (req, res) => {
  let filter: McsAdminDashboardFilter;
  const pagination = z.object({
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().min(20).max(2000).optional(),
  }).safeParse({ pageSize: req.query.pageSize, cursor: req.query.cursor });
  if (!pagination.success) {
    res.status(400).json({ ok: false, error: 'Invalid pagination parameters.', issues: pagination.error.issues });
    return;
  }
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
    const page = await listProspectDirectoryPage({ filter, ...pagination.data });

    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.prospects.directory.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: {
        filter,
        pageSize: page.pageInfo.pageSize,
        returnedCount: page.rows.length,
        hasMore: page.pageInfo.hasMore,
        cursorSupplied: !!pagination.data.cursor,
      },
      reason: null,
      context: contextFromRequest(req, '/api/admin/prospects', 'GET'),
    });

    const body: McsAdminProspectDirectoryResponse & McsAdminPaginationContract = {
      ok: true,
      rows: page.rows,
      appliedFilter: filter,
      computedAt: new Date().toISOString(),
      leaderDetectionNote: LEADER_DETECTION_NOTE,
      pageInfo: page.pageInfo,
      appliedSort: 'createdAt_desc_prospectId_desc',
    };
    res.json(body);
  } catch (err) {
    if (err instanceof AdminCursorError) {
      res.status(400).json({ ok: false, error: err.code });
      return;
    }
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
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
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
    const adminEvents: McsAdminProspectActivityEvent[] = [
      ...auditPage.entries,
      ...placementAudits.entries,
    ]
      .map(toActivityEventFromAudit)
      .filter((e): e is McsAdminProspectActivityEvent => e !== null);

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

    const body: McsAdminProspectDetailResponse = {
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
    const out: McsAdminProspectAddNoteResponse = await appendProspectNote({
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
  requestingTmagId: z.string().min(2).max(80),
  reason: z.string().min(8).max(2000),
  toTmagId: z.string().min(2).max(80),
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
  requestingTmagId: z.string().min(2).max(80),
  reason: z.string().min(8).max(2000),
  newSponsorTmagId: z.string().min(2).max(80),
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
  requestingTmagId: z.string().min(2).max(80),
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
  requestingTmagId: z.string().min(2).max(80),
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
  entry: McsAuditLogEntry,
): McsAdminProspectActivityEvent | null {
  let kind: McsAdminProspectActivityEventKind;
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

/* ═══════════════════════════════════════════════════════════════════
 * Admin Prospect CRUD (Chat #138 / #140)
 *
 * Manual prospect lifecycle. Domain layer (adminProspectCrud.ts) writes
 * its own before/after audit entry per mutation; these routes validate,
 * call, and map the domain Result to HTTP. Create is MINT-ONLY — the
 * prospect goes through the same video_complete → placement path as any
 * other (Chat #140), so no position is returned at create.
 *
 * Route order note: GET /:prospectId already exists above and matches a
 * single path segment. The aged-alert read is mounted at the two-segment
 * literal /alerts/aged so it can never be captured as a :prospectId.
 * ═══════════════════════════════════════════════════════════════════ */

/** Map a domain CRUD error to an HTTP status + stable code. */
function crudErrorStatus(error: AdminProspectCrudError): number {
  switch (error.kind) {
    case 'prospect_not_found':
      return 404;
    case 'reason_too_short':
    case 'sponsor_not_found':
    case 'prospect_deleted':
    case 'prospect_not_deleted':
    case 'no_fields':
      return 400;
    case 'row_unavailable':
      return 500;
    default:
      return 400;
  }
}

const CreateProspectSchema = z.object({
  firstName: z.string().min(1).max(120),
  lastName: z.string().min(1).max(120),
  city: z.string().min(1).max(120),
  stateOrRegion: z.string().min(1).max(120),
  country: z.string().min(2).max(60).optional(),
  sponsorTmagId: z.string().min(2).max(80),
  phone: z.string().max(40).nullish(),
  email: z.string().email().max(200).nullish(),
  reason: z.string().min(8).max(2000),
});

const EditProspectSchema = z
  .object({
    firstName: z.string().min(1).max(120).optional(),
    lastName: z.string().min(1).max(120).optional(),
    city: z.string().min(1).max(120).optional(),
    stateOrRegion: z.string().min(1).max(120).optional(),
    country: z.string().min(2).max(60).optional(),
    phone: z.string().max(40).nullish(),
    email: z.string().email().max(200).nullish(),
    reason: z.string().min(8).max(2000),
  })
  .strict();

const ReasonOnlySchema = z.object({
  reason: z.string().min(8).max(2000),
});

/* ─── POST /  (create — mint only) ──────────────────────────────── */

adminProspectsRoutes.post('/', requireAdmin, async (req, res) => {
  let payload: z.infer<typeof CreateProspectSchema>;
  try {
    payload = CreateProspectSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid request.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }
  try {
    const result = await adminCreateProspect(
      {
        firstName: payload.firstName,
        lastName: payload.lastName,
        city: payload.city,
        stateOrRegion: payload.stateOrRegion,
        country: payload.country,
        sponsorTmagId: payload.sponsorTmagId,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        reason: payload.reason,
      },
      adminActorFromRequest(req),
    );
    if (!result.ok) {
      res.status(crudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.status(201).json({
      ok: true,
      prospectId: result.value.prospectId,
      token: result.value.token,
      inviteUrl: result.value.inviteUrl,
      positionNumber: result.value.row.positionNumber,
      placedAt: null,
      row: result.value.row,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Create failed: ${msg}` });
  }
});

/* ─── PATCH /:prospectId  (edit ordinary fields) ────────────────── */

adminProspectsRoutes.patch('/:prospectId', requireAdmin, async (req, res) => {
  let prospectId: string;
  let payload: z.infer<typeof EditProspectSchema>;
  try {
    prospectId = ProspectIdSchema.parse(req.params.prospectId);
    payload = EditProspectSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid request.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }
  try {
    const result = await adminEditProspect(
      prospectId,
      {
        firstName: payload.firstName,
        lastName: payload.lastName,
        city: payload.city,
        stateOrRegion: payload.stateOrRegion,
        country: payload.country,
        phone: payload.phone ?? undefined,
        email: payload.email ?? undefined,
        reason: payload.reason,
      },
      adminActorFromRequest(req),
    );
    if (!result.ok) {
      res.status(crudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({ ok: true, prospectId: result.value.prospectId, row: result.value.row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Edit failed: ${msg}` });
  }
});

/* ─── DELETE /:prospectId  (soft delete — tank untouched) ───────── */

adminProspectsRoutes.delete('/:prospectId', requireAdmin, async (req, res) => {
  let prospectId: string;
  let payload: z.infer<typeof ReasonOnlySchema>;
  try {
    prospectId = ProspectIdSchema.parse(req.params.prospectId);
    payload = ReasonOnlySchema.parse(req.body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid request.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }
  try {
    const result = await adminSoftDeleteProspect(prospectId, payload, adminActorFromRequest(req));
    if (!result.ok) {
      res.status(crudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({ ok: true, prospectId: result.value.prospectId, deletedAt: result.value.deletedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Delete failed: ${msg}` });
  }
});

/* ─── POST /:prospectId/restore ─────────────────────────────────── */

adminProspectsRoutes.post('/:prospectId/restore', requireAdmin, async (req, res) => {
  let prospectId: string;
  let payload: z.infer<typeof ReasonOnlySchema>;
  try {
    prospectId = ProspectIdSchema.parse(req.params.prospectId);
    payload = ReasonOnlySchema.parse(req.body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid request.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }
  try {
    const result = await adminRestoreProspect(prospectId, payload, adminActorFromRequest(req));
    if (!result.ok) {
      res.status(crudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({
      ok: true,
      prospectId: result.value.prospectId,
      restoredAt: result.value.restoredAt,
      row: result.value.row,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Restore failed: ${msg}` });
  }
});

/* ─── POST /flush-expired  (manual 8-week sweep) ────────────────── */

const FlushExpiredSchema = z.object({
  reason: z.string().min(8).max(2000),
  weeks: z.number().int().min(1).max(104).optional(),
});

adminProspectsRoutes.post('/flush-expired', requireAdmin, async (req, res) => {
  let payload: z.infer<typeof FlushExpiredSchema>;
  try {
    payload = FlushExpiredSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: 'Invalid request.',
      issues: (err as z.ZodError).issues,
    });
    return;
  }
  try {
    const weeks = payload.weeks ?? HOLDING_TANK_WINDOW_WEEKS;
    const result = await flushExpiredPlacements(weeks);

    // One audit entry for the whole sweep (Kevin-run, routine → info).
    await appendAuditEntry({
      actor: adminActorFromRequest(req),
      action: 'admin.prospects.flush_expired',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: { weeks, flushedCount: result.flushedCount, cutoff: result.cutoff },
      reason: payload.reason,
      context: contextFromRequest(req, '/api/admin/prospects/flush-expired', 'POST'),
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Flush failed: ${msg}` });
  }
});

/* ─── GET /alerts/aged  (≥8-week banner; read-only) ─────────────── */

adminProspectsRoutes.get('/alerts/aged', requireAdmin, async (req, res) => {
  try {
    const weeksRaw = typeof req.query.weeks === 'string' ? Number(req.query.weeks) : NaN;
    const weeks =
      Number.isInteger(weeksRaw) && weeksRaw >= 1 && weeksRaw <= 104
        ? weeksRaw
        : HOLDING_TANK_WINDOW_WEEKS;
    const aged = await listProspectsAgedBeyond(weeks);
    res.json({ ok: true, weeks, count: aged.length, aged });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Aged alert failed: ${msg}` });
  }
});

const KongaAdminEnrollmentSchema = z.object({
  sponsorTmagId: z.string().min(2).max(80),
  enrolleeTmagId: z.string().min(2).max(80),
  legPlacement: z.enum(['left', 'right', 'core3']),
  offAppEnrollmentComplete: z.literal(true),
  legPlacementComplete: z.literal(true),
  reason: z.string().min(8).max(2000),
}).strict();

/** Audited Kevin override. Sponsor attribution remains immutable and exact. */
adminProspectsRoutes.post(
  '/:prospectId/konga-enrollment-attestation',
  requireAdmin,
  async (req, res) => {
    const parsed = KongaAdminEnrollmentSchema.safeParse(req.body);
    const prospectId = Array.isArray(req.params.prospectId)
      ? req.params.prospectId[0] ?? ''
      : req.params.prospectId ?? '';
    if (!parsed.success || !prospectId) {
      return res.status(400).json({ ok: false, error: 'invalid_enrollment_attestation' });
    }
    const actor = adminActorFromRequest(req);
    try {
      const result = await attestKongaEnrollment({
        prospectId,
        sponsorTmagId: parsed.data.sponsorTmagId,
        enrolleeTmagId: parsed.data.enrolleeTmagId,
        actorTmagId: actor.tmagId,
        actorKind: 'admin_override',
        legPlacement: parsed.data.legPlacement,
        offAppEnrollmentComplete: true,
        legPlacementComplete: true,
        reason: parsed.data.reason,
      });
      await appendAuditEntry({
        actor,
        action: 'admin.prospects.konga_enrollment_attested',
        entity: { kind: 'prospect', id: prospectId, displayLabel: null },
        severity: 'critical',
        before: null,
        after: {
          attestationId: result.attestationId,
          sponsorTmagId: parsed.data.sponsorTmagId,
          enrolleeTmagId: parsed.data.enrolleeTmagId,
          legPlacement: parsed.data.legPlacement,
          joinedAt: result.event.joinedAt,
          alreadyAttested: result.alreadyAttested,
        },
        reason: parsed.data.reason,
        context: contextFromRequest(
          req,
          `/api/admin/prospects/${prospectId}/konga-enrollment-attestation`,
          'POST',
        ),
      });
      return res.status(200).json({
        ok: true,
        attestationId: result.attestationId,
        joinedAt: result.event.joinedAt,
        alreadyAttested: result.alreadyAttested,
      });
    } catch (error) {
      if (error instanceof KongaEnrollmentError) {
        return res.status(409).json({ ok: false, error: error.code });
      }
      console.error('[admin konga enrollment attestation] failed', error);
      return res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);
