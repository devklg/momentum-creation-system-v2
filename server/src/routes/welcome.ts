/**
 * /api/welcome routes.
 *
 * POST /api/welcome/load — idempotent. Marks welcome_seen=true, returns the
 *   BA's first name so the page can personalize the eyebrow. Per TEAM C.3,
 *   this is also where Michael's outbound-call job and the welcome email
 *   should be enqueued. Both are deferred:
 *     - Michael delay: J.4 is unresolved — enqueueing deferred until Kevin
 *       answers "immediate vs delayed."
 *     - Welcome email: provider TBD (Resend/Postmark/SendGrid/SES) per
 *       Signup Architecture E.6.
 *   Both gaps are noted in the audit log so a future agent or Kevin can
 *   close them in one place.
 *
 * POST /api/welcome/accept — records the click-acknowledge commitment as a
 *   triple-stack record (J.3 locked Chat #94: click, not typed signature).
 *   Idempotent: re-accepting returns ok with the existing record.
 */

import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  commitmentExists,
  findBaById,
  markCommitmentAccepted,
  markWelcomeSeen,
  recordCommitment,
} from '../domain/commitments.js';

export const welcomeRoutes: Router = express.Router();

welcomeRoutes.post('/load', requireAuth, async (req: Request, res: Response) => {
  const session = req.session!;
  try {
    const ba = await findBaById(session.baId);
    if (!ba) {
      res.status(404).json({ ok: false, error: 'BA record not found.' });
      return;
    }
    await markWelcomeSeen(session.baId);

    // Audit-log markers — written as console for now; will move to an
    // append-only audit collection in Phase 5 (ADMIN J).
    // eslint-disable-next-line no-console
    console.log(
      `[audit] welcome_screen_displayed baId=${session.baId} threeBaId=${session.threeBaId}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[audit] welcome_load_deferred_actions baId=${session.baId} michael_call=DEFERRED_J4 welcome_email=DEFERRED_E6`,
    );

    res.json({ ok: true, baFirstName: ba.firstName });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Welcome load failed: ${msg}` });
  }
});

welcomeRoutes.post('/accept', requireAuth, async (req: Request, res: Response) => {
  const session = req.session!;
  try {
    if (await commitmentExists(session.baId)) {
      // Idempotent: re-accepting is a no-op. Mirror BA-flag in case it drifted.
      await markCommitmentAccepted(session.baId);
      res.json({ ok: true, alreadyAccepted: true });
      return;
    }

    const ipAddress =
      (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
      req.socket.remoteAddress ??
      null;
    const userAgent = req.get('user-agent') ?? null;

    const record = await recordCommitment({
      baId: session.baId,
      threeBaId: session.threeBaId,
      email: session.email,
      ipAddress,
      userAgent,
    });

    await markCommitmentAccepted(session.baId);

    // eslint-disable-next-line no-console
    console.log(
      `[audit] welcome_commitment_accepted baId=${session.baId} commitmentId=${record.commitmentId} version=${record.version}`,
    );

    res.json({ ok: true, commitmentId: record.commitmentId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(500).json({ ok: false, error: `Could not record commitment: ${msg}` });
  }
});
