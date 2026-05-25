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
