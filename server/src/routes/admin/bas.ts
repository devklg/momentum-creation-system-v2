/**
 * /api/admin/bas — Brand Ambassador oversight (wireframe 4.C · locked-spec 4.C).
 *
 *   GET    /                          C.1 directory (15-column row per BA)
 *   GET    /:baId                     C.4 profile bundle (drawer)
 *   POST   /:baId/sponsor-override    C.5 sponsor override (friction-heavy, audited)
 *   POST   /:baId/leader-tag          C.4 toggle Kevin-curated leader badge
 *   POST   /:baId/notes               C.4 append Kevin-only note (append-only)
 *   POST   /:baId/dial-michael        operator dial — existed pre-#135, untouched
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
import { listAllBAsForAdmin } from '../../domain/ba.js';
import { originateCall, OriginateError } from '../../domain/michael-schedule.js';
import {
  appendBaNote,
  applySponsorOverride,
  getBAProfileBundle,
  listBADirectory,
  setCuratedLeaderTag,
} from '../../domain/adminBaOversight.js';
import {
  adminCreateBa,
  adminEditBa,
  adminSoftDeleteBa,
  adminRestoreBa,
  type AdminBaCrudError,
  type AdminActor,
} from '../../domain/adminBaCrud.js';
import type {
  AdminBaDirectoryResponse,
  AdminBaNoteResponse,
  AdminBaProfileResponse,
  AdminLeaderTagResponse,
  AdminSponsorOverrideResponse,
} from '@momentum/shared';

export const adminBasRoutes: Router = express.Router();

adminBasRoutes.get('/', requireAdmin, async (req: Request, res: Response) => {
  const limitRaw = Number.parseInt(String(req.query.limit ?? '500'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, limitRaw)) : 500;

  try {
    const [{ rows, leaderDetectionNote }, legacy] = await Promise.all([
      listBADirectory(limit),
      // Preserve the pre-#135 shape so any caller still keying off `bas:`
      // keeps working. The new client reads `rows:`.
      listAllBAsForAdmin(limit),
    ]);
    const body: AdminBaDirectoryResponse & { bas: typeof legacy; count: number } = {
      ok: true,
      count: rows.length,
      rows,
      leaderDetectionNote,
      bas: legacy,
    };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Directory failed: ${msg}` });
  }
});

const BaIdParams = z.object({
  baId: z.string().min(2).max(80),
});

adminBasRoutes.get('/:baId', requireAdmin, async (req: Request, res: Response) => {
  const parsed = BaIdParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: 'Invalid baId.' });
    return;
  }
  try {
    const profile = await getBAProfileBundle(parsed.data.baId);
    if (!profile) {
      res.status(404).json({ ok: false, error: 'BA not found.' });
      return;
    }
    const body: AdminBaProfileResponse = { ok: true, profile };
    res.json(body);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Profile failed: ${msg}` });
  }
});

const SponsorOverrideBody = z.object({
  requestingBaId: z.string().min(2).max(80),
  newSponsorBaId: z.string().min(2).max(80),
  reason: z.string().trim().min(8).max(2000),
});

adminBasRoutes.post(
  '/:baId/sponsor-override',
  requireAdmin,
  async (req: Request, res: Response) => {
    const params = BaIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ ok: false, error: 'Invalid baId.' });
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
        baId: params.data.baId,
        requestingBaId: body.data.requestingBaId,
        newSponsorBaId: body.data.newSponsorBaId,
        reason: body.data.reason,
        performedByBaId: session.baId,
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
      const bundle = await getBAProfileBundle(params.data.baId);
      const responseBody: AdminSponsorOverrideResponse = {
        ok: true,
        override: result.entry,
        row:
          bundle?.row ??
          (await listBADirectory(2000)).rows.find((r) => r.baId === params.data.baId)!,
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

adminBasRoutes.post(
  '/:baId/leader-tag',
  requireAdmin,
  async (req: Request, res: Response) => {
    const params = BaIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ ok: false, error: 'Invalid baId.' });
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
        baId: params.data.baId,
        curated: body.data.curated,
        setByBaId: session.baId,
        setByDisplayName: session.email,
        reason: body.data.reason,
      });
      const responseBody: AdminLeaderTagResponse = {
        ok: true,
        baId: params.data.baId,
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
  '/:baId/notes',
  requireAdmin,
  async (req: Request, res: Response) => {
    const params = BaIdParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ ok: false, error: 'Invalid baId.' });
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
        baId: params.data.baId,
        text: body.data.text,
        authorBaId: session.baId,
        authorDisplayName: session.email,
      });
      const responseBody: AdminBaNoteResponse = { ok: true, note };
      res.json(responseBody);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Note append failed: ${msg}` });
    }
  },
);

const DialParams = z.object({
  baId: z.string().min(2).max(80),
});

adminBasRoutes.post(
  '/:baId/dial-michael',
  requireAdmin,
  async (req: Request, res: Response) => {
    const parsed = DialParams.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: 'Invalid baId.' });
      return;
    }
    const session = req.session!;
    try {
      const result = await originateCall(parsed.data.baId);
      // eslint-disable-next-line no-console
      console.log(
        `[audit] admin_dial_michael baId=${parsed.data.baId} by=${session.baId} result=${result.kind}` +
          (result.kind === 'placed'
            ? ` callControlId=${result.callControlId}`
            : ` reason=${result.reason}`),
      );
      if (result.kind === 'skipped') {
        res.status(409).json({ ok: false, error: result.reason, schedule: result.schedule });
        return;
      }
      res.json({
        ok: true,
        callControlId: result.callControlId,
        schedule: result.schedule,
      });
    } catch (err) {
      if (err instanceof OriginateError) {
        res.status(400).json({ ok: false, error: err.message, code: err.code });
        return;
      }
      const msg = err instanceof Error ? err.message : 'unknown';
      res.status(500).json({ ok: false, error: `Dial failed: ${msg}` });
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
 *   PATCH  /:baId           edit ordinary fields (sponsor NOT editable here)
 *   DELETE /:baId           soft delete (reversible, reason required)
 *   POST   /:baId/restore   restore a soft-deleted BA
 *
 * Route order: GET /:baId and POST /:baId/<verb> already exist above.
 * /restore is a distinct second segment; PATCH and DELETE are new verbs on
 * /:baId with no existing collision.
 * ═══════════════════════════════════════════════════════════════════ */

/** Build the admin actor from the session, mirroring the prospect routes:
 * prefer a full name when present, else fall back to email/baId. */
function adminActor(req: Request): AdminActor {
  const session = req.session!;
  const displayName =
    (session as unknown as { fullName?: string }).fullName ?? session.email ?? session.baId;
  return { baId: session.baId, displayName };
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
  sponsorBaId: z.string().trim().min(2).max(80),
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
        sponsorBaId: body.data.sponsorBaId,
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
    res.status(201).json({ ok: true, baId: result.value.baId, row: result.value.row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Create failed: ${msg}` });
  }
});

/* ─── PATCH /:baId  (edit — sponsor not editable here) ───────────── */

adminBasRoutes.patch('/:baId', requireAdmin, async (req: Request, res: Response) => {
  const params = BaIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid baId.' });
    return;
  }
  const body = EditBaBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'Invalid edit payload.', issues: body.error.issues });
    return;
  }
  try {
    const result = await adminEditBa(params.data.baId, body.data, adminActor(req));
    if (!result.ok) {
      res.status(baCrudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({ ok: true, baId: result.value.baId, row: result.value.row });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Edit failed: ${msg}` });
  }
});

/* ─── DELETE /:baId  (soft delete) ───────────────────────────── */

adminBasRoutes.delete('/:baId', requireAdmin, async (req: Request, res: Response) => {
  const params = BaIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid baId.' });
    return;
  }
  const body = ReasonOnlyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'A reason (min 8 chars) is required.' });
    return;
  }
  try {
    const result = await adminSoftDeleteBa(params.data.baId, body.data, adminActor(req));
    if (!result.ok) {
      res.status(baCrudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({ ok: true, baId: result.value.baId, deletedAt: result.value.deletedAt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Delete failed: ${msg}` });
  }
});

/* ─── POST /:baId/restore ───────────────────────────────────── */

adminBasRoutes.post('/:baId/restore', requireAdmin, async (req: Request, res: Response) => {
  const params = BaIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ ok: false, error: 'Invalid baId.' });
    return;
  }
  const body = ReasonOnlyBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ ok: false, error: 'A reason (min 8 chars) is required.' });
    return;
  }
  try {
    const result = await adminRestoreBa(params.data.baId, body.data, adminActor(req));
    if (!result.ok) {
      res.status(baCrudErrorStatus(result.error)).json({ ok: false, error: result.error.kind });
      return;
    }
    res.json({
      ok: true,
      baId: result.value.baId,
      restoredAt: result.value.restoredAt,
      row: result.value.row,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Restore failed: ${msg}` });
  }
});
