/**
 * /api/admin/access-codes — Kevin-only access code generator.
 *
 * POST   creates a new code for a named BA (one code per BA, idempotent: if the
 *        BA already owns an active code, returns that code instead of minting
 *        a duplicate).
 * GET    lists recent codes (most recent first).
 *
 * Access is gated by `requireAdmin`. Per ADMIN Design A.2 (Locked Chat #85),
 * the gate returns the standard "Not found" error on rejection — no
 * indication that the admin surface exists.
 */

import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { requireAdmin } from '../../middleware/requireAuth.js';
import { listAccessCodes, mintAccessCode } from '../../domain/codeGen.js';

export const adminAccessCodesRoutes: Router = express.Router();

const MintBody = z.object({
  sponsorTmagId: z.string().min(2).max(80),
  sponsorThreeBaId: z.string().min(1).max(40),
  sponsorFirstName: z.string().min(1).max(80),
  sponsorLastName: z.string().min(1).max(80),
  note: z.string().max(280).optional(),
  explicit: z.string().max(16).optional(),
});

adminAccessCodesRoutes.post('/', requireAdmin, async (req: Request, res: Response) => {
  const parsed = MintBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      ok: false,
      error: 'Invalid input.',
      details: parsed.error.flatten(),
    });
    return;
  }

  const session = req.session!;
  try {
    const record = await mintAccessCode({
      sponsorTmagId: parsed.data.sponsorTmagId.trim(),
      sponsorThreeBaId: parsed.data.sponsorThreeBaId.trim(),
      sponsorFirstName: parsed.data.sponsorFirstName.trim(),
      sponsorLastName: parsed.data.sponsorLastName.trim(),
      note: parsed.data.note,
      explicit: parsed.data.explicit,
      mintedByTmagId: session.tmagId,
    });

    // eslint-disable-next-line no-console
    console.log(
      `[audit] access_code_minted code=${record.code} sponsorTmagId=${record.sponsorTmagId} by=${session.tmagId}`,
    );

    res.json({ ok: true, code: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Mint failed: ${msg}` });
  }
});

adminAccessCodesRoutes.get('/', requireAdmin, async (req: Request, res: Response) => {
  const limitRaw = Number.parseInt(String(req.query.limit ?? '100'), 10);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, limitRaw)) : 100;
  try {
    const codes = await listAccessCodes(limit);
    res.json({ ok: true, count: codes.length, codes });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `List failed: ${msg}` });
  }
});
