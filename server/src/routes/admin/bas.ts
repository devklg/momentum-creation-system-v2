/**
 * /api/admin/bas — flat Brand Ambassador roster for /admin.
 *
 * Per ADMIN Design Section C and Chat #98 carry-forward priority #2:
 * "flat BA list with sponsor column." Not genealogy — that lives in THREE.
 *
 * GET / — returns the entire active roster, reverse-chronological by join
 * date, with sponsor name joined in. Gated by requireAdmin.
 *
 * POST /:baId/dial-michael — admin trigger to originate Michael's outbound
 * call for a specific BA right now. Used for live testing of the Telnyx
 * webhook loop and as the fallback if the scheduler is down or a BA needs
 * a re-dial. Gated by requireAdmin.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { listAllBAsForAdmin } from '../../domain/ba.js';
import { originateCall, OriginateError } from '../../domain/michael-schedule.js';

export const adminBasRoutes: Router = express.Router();

adminBasRoutes.get('/', requireAdmin, async (req: Request, res: Response) => {
  const limitRaw = Number.parseInt(String(req.query.limit ?? '500'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(2000, limitRaw)) : 500;
  try {
    const bas = await listAllBAsForAdmin(limit);
    res.json({ ok: true, count: bas.length, bas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `List failed: ${msg}` });
  }
});

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
          (result.kind === 'placed' ? ` callControlId=${result.callControlId}` : ` reason=${result.reason}`),
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
