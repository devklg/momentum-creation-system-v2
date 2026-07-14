/**
 * /api/admin/bas — Brand Ambassador oversight (wireframe 4.C · locked-spec 4.C).
 *
 *   GET    /                          C.1 directory (15-column row per BA)
 *   GET    /:tmagId                     C.4 profile bundle (drawer)
 *   POST   /:tmagId/sponsor-override    C.5 sponsor override (friction-heavy, audited)
 *   POST   /:tmagId/leader-tag          C.4 toggle Kevin-curated leader badge
 *   POST   /:tmagId/notes               C.4 append Kevin-only note (append-only)
 *
 * All routes are admin-gated by `requireAdmin`. Compliance discipline lives
 * in `domain/adminBaOversight.ts`; this file is the thin route layer.
 *
 * The legacy GET / shape (used by the prior bas.tsx with `{ bas: BARow[] }`)
 * is preserved — the new directory uses `rows:` so a stale client can't
 * misparse the new shape as the old one. The old `bas:` field stays
 * populated for any caller that still expects it; the new client will
 * read `rows:`.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import {
  appendBaNote,
  applySponsorOverride,
  getTmagProfileBundle,
  listBADirectory,
  listBADirectoryPage,
  setBaEntitlement,
  setCuratedLeaderTag,
} from '../../domain/adminBaOversight.js';
import { AdminCursorError } from '../../domain/adminPagination.js';
import { appendAuditEntry } from '../../domain/auditLog.js';
import {
  adminCreateBa,
  adminEditBa,
  adminSoftDeleteBa,
  adminRestoreBa,
  type AdminBaCrudError,
  type AdminActor,
} from '../../domain/adminBaCrud.js';
import { buildAdminEntitlementAudit } from '../../domain/adminEntitlementAudit.js';
import { buildAdminLaunchReadiness } from '../../domain/adminLaunchReadiness.js';
import type {
  McsAdminBaDirectoryResponse,
  McsAdminBaEntitlementsResponse,
  McsAdminBaNoteResponse,
  McsAdminBaProfileResponse,
  McsAdminPaginationContract,
  McsAdminLeaderTagResponse,
  McsAdminSponsorOverrideResponse,
} from '@momentum/shared';

export const adminBasRoutes: Router = express.Router();

adminBasRoutes.get('/entitlements/audit', requireAdmin, async (_req, res) => {
  try { res.status(200).json(await buildAdminEntitlementAudit()); }
  catch (err) { res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) }); }
});

adminBasRoutes.get('/launch-readiness', requireAdmin, async (req, res) => {
  const requested = Number.parseInt(String(req.query.limit ?? '10000'), 10);
  const limit = Number.isFinite(requested) ? Math.max(1, Math.min(50_000, requested)) : 10_000;
  try {
    res.status(200).json(await buildAdminLaunchReadiness({ limit }));
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

adminBasRoutes.get('/', requireAdmin, async (req: Request, res: Response) => {
  const parsed = BaDirectoryQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid pagination parameters.', issues: parsed.error.issues });
    return;
  }

  try {
    const page = await listBADirectoryPage(parsed.data);
    await appendAuditEntry({
      actor: {
        kind: 'admin',
        tmagId: req.session!.tmagId,
        displayName: req.session!.email ?? req.session!.tmagId,
      },
      action: 'admin.ba.directory_page.viewed',
      entity: { kind: 'admin_session', id: req.session!.tmagId, displayLabel: null },
      severity: 'info',
      after: paginationAuditMetadata({
        pageSize: parsed.data.pageSize,
        cursorProvided: Boolean(parsed.data.cursor),
        searchApplied: Boolean(parsed.data.search),
        returnedCount: page.rows.length,
        hasMore: page.pageInfo.hasMore,
      }),
      reason: null,
      context: {
        ip: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
        route: '/api/admin/bas',
        method: 'GET',
        requestId: null,
      },
    });
    const body: McsAdminBaDirectoryResponse & McsAdminPaginationContract & {
      bas: typeof page.legacyBas;
      count: number;
      appliedSearch: string;
    } = {
      ok: true,
      count: page.rows.length,
      rows: page.rows,
      leaderDetectionNote: page.leaderDetectionNote,
      bas: page.legacyBas,
      pageInfo: page.pageInfo,
      appliedSearch: page.appliedSearch,
      appliedSort: 'createdAt_desc_tmagId_desc',
      computedAt: new Date().toISOString(),
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

const BaDirectoryQuery = z.object({
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(20).max(2000).optional(),
  search: z.string().trim().max(120).optional(),
}).strict();

export function parseBaDirectoryQuery(query: unknown) {
  return BaDirectoryQuery.safeParse(query);
}

export function paginationAuditMetadata(input: {
  pageSize: number;
  cursorProvided: boolean;
  searchApplied: boolean;
  returnedCount: number;
  hasMore: boolean;
}) {
  return { ...input, sort: 'createdAt_desc_tmagId_desc' as const };
}

const TmagIdParams = z.object({
  tmagId: z.string().min(2).max(80),
});

adminBasRoutes.get('/:tmagId', requireAdmin, async (req: Request, res: Response) => {
  const parsed = TmagIdParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
    return;
  }
  try {
    const profile = await getTmagProfileBundle(parsed.data.tmagId);
    if (!profile) {
      res.status(404).json({ ok: false, error: 'BA not found.' });
      return;
    }
    const body: McsAdminBaProfileResponse = { ok: true, profile };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Profile failed: ${msg}` });
  }
});

const SponsorOverrideBody = z.object({
  requestingTmagId: z.string().min(2).max(80),
  newSponsorTmagId: z.string().min(2).max(80),
  reason: z.string().trim().min(8).max(2000),
});

adminBasRoutes.post(
  '/:tmagId/sponsor-override',
  requireAdmin,
  async (req: Request, res: Response) => {
    const params = TmagIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
      return;
    }
    const body = SponsorOverrideBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({
        ok: false,
        error: 'Invalid override payload.',
        issues: body.error.issues,
      });
      return;
    }
    const session = req.session!;
    try {
      const result = await applySponsorOverride({
        tmagId: params.data.tmagId,
        requestingTmagId: body.data.requestingTmagId,
        newSponsorTmagId: body.data.newSponsorTmagId,
        reason: body.data.reason,
        performedByTmagId: session.tmagId,
        performedByDisplayName: session.email,
      });
      if (!result.ok) {
        const code =
          result.error.kind === 'ba_not_found' ||
          result.error.kind === 'new_sponsor_not_found' ||
          result.error.kind === 'requesting_ba_not_found'
            ? 404
            : 409;
        res.status(code).json({ ok: false, error: result.error });
        return;
      }
      // Refresh the row so the table can update in place.
      const bundle = await getTmagProfileBundle(params.data.tmagId);
      const responseBody: McsAdminSponsorOverrideResponse = {
        ok: true,
        override: result.entry,
        row:
          bundle?.row ??
          (await listBADirectory(2000)).rows.find((r) => r.tmagId === params.data.tmagId)!,
      };
      res.json(responseBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Override failed: ${msg}` });
    }
  },
);

const LeaderTagBody = z.object({
  curated: z.boolean(),
  reason: z.string().trim().max(500).optional(),
});

const EntitlementsBody = z.object({
  action: z.enum(['grant', 'revoke']),
  entitlement: z.literal('vm_dialer'),
});

adminBasRoutes.post(
  '/:tmagId/entitlements',
  requireAdmin,
  async (req: Request, res: Response) => {
    const params = TmagIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
      return;
    }
    const body = EntitlementsBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ ok: false, error: 'Invalid entitlement payload.' });
      return;
    }
    const session = req.session!;
    try {
      const result = await setBaEntitlement({
        tmagId: params.data.tmagId,
        action: body.data.action,
        performedByTmagId: session.tmagId,
        performedByDisplayName: session.email,
      });
      if (!result.ok) {
        res.status(404).json({ ok: false, error: result.error });
        return;
      }
      const bundle = await getTmagProfileBundle(params.data.tmagId);
      const responseBody: McsAdminBaEntitlementsResponse = {
        ok: true,
        tmagId: params.data.tmagId,
        entitlements: result.entitlements,
        row: bundle?.row ?? null,
      };
      res.json(responseBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Entitlement update failed: ${msg}` });
    }
  },
);

adminBasRoutes.post(
  '/:tmagId/leader-tag',
  requireAdmin,
  async (req: Request, res: Response) => {
    const params = TmagIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
      return;
    }
    const body = LeaderTagBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ ok: false, error: 'Invalid leader-tag payload.' });
      return;
    }
    const session = req.session!;
    try {
      await setCuratedLeaderTag({
        tmagId: params.data.tmagId,
        curated: body.data.curated,
        setByTmagId: session.tmagId,
        setByDisplayName: session.email,
        reason: body.data.reason,
      });
      const responseBody: McsAdminLeaderTagResponse = {
        ok: true,
        tmagId: params.data.tmagId,
        curated: body.data.curated,
      };
      res.json(responseBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Leader-tag toggle failed: ${msg}` });
    }
  },
);

const NoteBody = z.object({
  text: z.string().trim().min(1).max(4000),
});

adminBasRoutes.post(
  '/:tmagId/notes',
  requireAdmin,
  async (req: Request, res: Response) => {
    const params = TmagIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
      return;
    }
    const body = NoteBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ ok: false, error: 'Invalid note payload.' });
      return;
    }
    const session = req.session!;
    try {
      const note = await appendBaNote({
        tmagId: params.data.tmagId,
        text: body.data.text,
        authorTmagId: session.tmagId,
        authorDisplayName: session.email,
      });
      const responseBody: McsAdminBaNoteResponse = { ok: true, note };
      res.json(responseBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Note append failed: ${msg}` });
    }
  },
);

/* ═══════════════════════════════════════════════════════════════════
 * Admin BA CRUD (Chat #138 / #140)
 *
 * Manual BA lifecycle. The domain layer (adminBaCrud.ts) writes its own
 * before/after audit entry per mutation and delegates sponsor changes to
 * the C.5 applySponsorOverride path, so these routes only validate, build
 * the actor, call, and map the domain Result to HTTP.
 *
 *   POST   /                create a BA (sponsor stamped immutable, no pwd)
 *   PATCH  /:tmagId           edit ordinary fields (sponsor NOT editable here)
 *   DELETE /:tmagId           soft delete (reversible, reason required)
 *   POST   /:tmagId/restore   restore a soft-deleted BA
 *
 * Route order: GET /:tmagId and POST /:tmagId/<verb> already exist above.
 * /restore is a distinct second segment; PATCH and DELETE are new verbs on
 * /:tmagId with no existing collision.
 * ═══════════════════════════════════════════════════════════════════ */

/** Build the admin actor from the session, mirroring the prospect routes:
 * prefer a full name when present, else fall back to email/tmagId. */
function adminActor(req: Request): AdminActor {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.email ?? session.tmagId;
  return { tmagId: session.tmagId, displayName };
}

/** Map a domain CRUD error to an HTTP status. */
function baCrudErrorStatus(error: AdminBaCrudError): number {
  switch (error.kind) {
    case 'ba_not_found':
      return 404;
    case 'reason_too_short':
    case 'sponsor_not_found':
    case 'email_taken':
    case 'ba_deleted':
    case 'ba_not_deleted':
    case 'no_fields':
      return 400;
    case 'row_unavailable':
      return 500;
    default:
      return 400;
  }
}

const CreateBaBody = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  threeBaId: z.string().trim().min(1).max(80),
  threeUsername: z.string().trim().min(1).max(120),
  sponsorTmagId: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  timezone: z.string().trim().max(80).optional(),
  marketRegion: z.string().trim().max(120).optional(),
  reason: z.string().trim().min(8).max(2000),
});

const EditBaBody = z
  .object({
    firstName: z.string().trim().min(1).max(120).optional(),
    lastName: z.string().trim().min(1).max(120).optional(),
    threeBaId: z.string().trim().min(1).max(80).optional(),
    threeUsername: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
    timezone: z.string().trim().max(80).optional(),
    marketRegion: z.string().trim().max(120).optional(),
    reason: z.string().trim().min(8).max(2000),
  })
  .strict();

const ReasonOnlyBody = z.object({
  reason: z.string().trim().min(8).max(2000),
});

/* ─── POST /  (create) ────────────────────────────────────────── */

adminBasRoutes.post('/', requireAdmin, async (req: Request, res: Response) => {
  const body = CreateBaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'Invalid create payload.', issues: body.error.issues });
    return;
  }
  try {
    const result = await adminCreateBa(
      {
        firstName: body.data.firstName,
        lastName: body.data.lastName,
        threeBaId: body.data.threeBaId,
        threeUsername: body.data.threeUsername,
        sponsorTmagId: body.data.sponsorTmagId,
        email: body.data.email ?? null,
        phone: body.data.phone ?? null,
        timezone: body.data.timezone ?? null,
        marketRegion: body.data.marketRegion ?? null,
        reason: body.data.reason,
      },
      adminActor(req),
    );
    if (!result.ok) {
      res.status(baCrudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.status(201).json({ ok: true, tmagId: result.value.tmagId, row: result.value.row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Create failed: ${msg}` });
  }
});

/* ─── PATCH /:tmagId  (edit — sponsor not editable here) ───────────── */

adminBasRoutes.patch('/:tmagId', requireAdmin, async (req: Request, res: Response) => {
  const params = TmagIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
    return;
  }
  const body = EditBaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'Invalid edit payload.', issues: body.error.issues });
    return;
  }
  try {
    const result = await adminEditBa(params.data.tmagId, body.data, adminActor(req));
    if (!result.ok) {
      res.status(baCrudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({ ok: true, tmagId: result.value.tmagId, row: result.value.row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Edit failed: ${msg}` });
  }
});

/* ─── DELETE /:tmagId  (soft delete) ───────────────────────────── */

adminBasRoutes.delete('/:tmagId', requireAdmin, async (req: Request, res: Response) => {
  const params = TmagIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
    return;
  }
  const body = ReasonOnlyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'A reason (min 8 chars) is required.' });
    return;
  }
  try {
    const result = await adminSoftDeleteBa(params.data.tmagId, body.data, adminActor(req));
    if (!result.ok) {
      res.status(baCrudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({ ok: true, tmagId: result.value.tmagId, deletedAt: result.value.deletedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Delete failed: ${msg}` });
  }
});

/* ─── POST /:tmagId/restore ───────────────────────────────────── */

adminBasRoutes.post('/:tmagId/restore', requireAdmin, async (req: Request, res: Response) => {
  const params = TmagIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid tmagId.' });
    return;
  }
  const body = ReasonOnlyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'A reason (min 8 chars) is required.' });
    return;
  }
  try {
    const result = await adminRestoreBa(params.data.tmagId, body.data, adminActor(req));
    if (!result.ok) {
      res.status(baCrudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({
      ok: true,
      tmagId: result.value.tmagId,
      restoredAt: result.value.restoredAt,
      row: result.value.row,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Restore failed: ${msg}` });
  }
});
