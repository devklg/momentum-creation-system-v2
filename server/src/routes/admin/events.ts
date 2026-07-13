import { Router } from 'express';
import { getEventCenterForAdmin } from '../../domain/eventCenter.js';
import { requireAdmin } from '../../middleware/requireAuth.js';

export const adminEventRoutes: Router = Router();

adminEventRoutes.get('/', requireAdmin, async (_req, res) => {
  try {
    return res.status(200).json(await getEventCenterForAdmin());
  } catch (error) {
    console.error('[GET /api/admin/events] failed', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});
