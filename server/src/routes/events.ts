import { Router } from 'express';
import { getEventCenterForBA } from '../domain/eventCenter.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';

export const eventRoutes: Router = Router();

eventRoutes.get('/', requireAuth, requireSteveComplete, async (req, res) => {
  const tmagId = req.session?.tmagId;
  if (!tmagId) {
    return res.status(401).json({ ok: false, error: 'Not authenticated.' });
  }
  try {
    return res.status(200).json(await getEventCenterForBA(tmagId));
  } catch (error) {
    console.error('[GET /api/events] failed', error);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});
