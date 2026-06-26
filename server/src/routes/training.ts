/**
 * GET/POST /api/training/fast-start/* — Fast Start progress endpoints
 * (feat/fast-start-training · wireframe 3.5).
 *
 * Routes:
 *   GET  /api/training/fast-start/progress
 *     Whitelisted (pre-Steve accessible). Returns the BA's per-module
 *     status + invitations-sent cross-check + the canonical `complete`
 *     boolean the welcome flow + cockpit + admin metrics read.
 *
 *   POST /api/training/fast-start/modules/:id/state
 *     Body: { state: 'in_progress' | 'completed' }
 *     Module 1 is whitelisted (pre-Steve); 2-5 gated.
 *
 * Gating decision (Kevin, this branch):
 *   - Inter-module gating: sequential UI ordering, NOT hard-gated. A
 *     BA can jump to any module — the hub shows order, the route does
 *     not enforce it. (locked-spec E.3 / TASK.md open-question answer.)
 *   - Steve gate: Module 1 is whitelisted in requireSteveComplete
 *     (the on-ramp surface — build belief in the product BEFORE the
 *     Steve discovery). Modules 2-5 require Steve complete. The
 *     pre-Chat-#97 whitelist already anticipated this with
 *     '/api/training/day-1'; we add the fast-start equivalents.
 *
 * Sponsor immutability (locked-spec 3.5): baId comes from req.session,
 * NEVER from the request body. Nothing a client can send can write to
 * another BA's progress.
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  getFastStartProgress,
  isValidModuleId,
  markFastStartModuleState,
} from '../domain/training.js';
import type {
  FastStartMarkStatePayload,
  FastStartModuleId,
} from '@momentum/shared';

export const trainingRoutes: Router = Router();

/* ──────────────────────────────────────────────────────────────────
 * GET /api/training/fast-start/progress
 * Whitelisted (Module 1 hub render is pre-Steve accessible).
 * ────────────────────────────────────────────────────────────────── */
trainingRoutes.get('/fast-start/progress', requireAuth, async (req, res) => {
  const baId = req.session?.baId;
  if (!baId) {
    res.status(401).json({ ok: false, error: 'Not authenticated.' });
    return;
  }
  try {
    const payload = await getFastStartProgress(baId);
    res.status(200).json(payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[GET /api/training/fast-start/progress] failed', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
});

/* ──────────────────────────────────────────────────────────────────
 * POST /api/training/fast-start/modules/:id/state
 *
 * Both Module 1 and Modules 2-5 mount through the SAME handler. The
 * Steve gate is applied via the whitelist — '/api/training/fast-
 * start/modules/1' is whitelisted so this route resolves pre-Steve
 * for moduleId=1; all other ids hit requireSteveComplete inside the
 * middleware chain.
 *
 * (We mount requireSteveComplete unconditionally and let the
 * requireSteveComplete pathInWhitelist check handles the Module-1
 * exemption — see middleware/requireSteveComplete.ts startsWith
 * matching against '/api/training/fast-start/modules/1'.)
 * ────────────────────────────────────────────────────────────────── */
trainingRoutes.post(
  '/fast-start/modules/:id/state',
  requireAuth,
  requireSteveComplete,
  async (req, res) => {
    const baId = req.session?.baId;
    if (!baId) {
      res.status(401).json({ ok: false, error: 'Not authenticated.' });
      return;
    }

    const moduleIdNum = Number(req.params.id);
    if (!isValidModuleId(moduleIdNum)) {
      res.status(400).json({ ok: false, error: 'invalid_module_id' });
      return;
    }
    const moduleId: FastStartModuleId = moduleIdNum;

    const body = req.body as Partial<FastStartMarkStatePayload> | undefined;
    const to = body?.state;
    if (to !== 'in_progress' && to !== 'completed') {
      res.status(400).json({ ok: false, error: 'invalid_state' });
      return;
    }

    try {
      const result = await markFastStartModuleState({
        baId,
        moduleId,
        to,
        occurredAt: new Date().toISOString(),
      });
      res.status(200).json(result);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `[POST /api/training/fast-start/modules/${moduleId}/state] failed`,
        err,
      );
      res.status(500).json({ ok: false, error: 'server_error' });
    }
  },
);
