/**
 * /api/admin/health — production health probe seam.
 *
 * `/triple-stack` is called by the VPS systemd timer with a shared secret and
 * may also be reached by Kevin's admin session. `/status` is admin-only and
 * reads the JSON written by ops/health-probe.sh for the dashboard widget.
 */

import express, { type NextFunction, type Request, type Response, type Router } from 'express';
import { env } from '../../env.js';
import { requireAdmin } from '../../middleware/requireAuth.js';
import {
  handleHealthStatusTransition,
  readHealthStatusFile,
  runTripleStackHealthProbe,
} from '../../domain/healthProbe.js';

export const adminHealthRoutes: Router = express.Router();

function requireAdminOrHealthSecret(req: Request, res: Response, next: NextFunction): void {
  const provided = req.get('x-mcs-health-secret') ?? '';
  if (env.HEALTH_PROBE_SHARED_SECRET && provided === env.HEALTH_PROBE_SHARED_SECRET) {
    next();
    return;
  }
  void requireAdmin(req, res, next);
}

adminHealthRoutes.get('/triple-stack', requireAdminOrHealthSecret, async (_req, res) => {
  try {
    const result = await runTripleStackHealthProbe();
    res.status(result.ok ? 200 : 503).json({
      ok: result.ok,
      checkedAt: result.checkedAt,
      heartbeatId: result.heartbeatId,
      legs: result.legs,
      legDetails: result.legDetails,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      legs: { mongo: false, neo4j: false, chroma: false },
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

adminHealthRoutes.get('/status', requireAdmin, async (_req, res) => {
  const file = await readHealthStatusFile(env.HEALTH_STATUS_PATH);
  if (!file.ok || !file.status) {
    res.status(200).json({
      ok: false,
      status: null,
      error: file.error ?? 'health status unavailable',
    });
    return;
  }

  let transition: Awaited<ReturnType<typeof handleHealthStatusTransition>> | null = null;
  try {
    transition = await handleHealthStatusTransition(file.status, env.HEALTH_ALERT_STATE_PATH);
  } catch (err) {
    // Alert-state writes should not hide the current health status from Kevin.
    transition = {
      alertQueued: false,
      reason: err instanceof Error ? `transition_error: ${err.message}` : 'transition_error',
      previousOverall: null,
    };
  }

  res.json({
    ok: true,
    status: file.status,
    alert: transition,
  });
});
