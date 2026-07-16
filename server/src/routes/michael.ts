/**
 * /api/michael/* — Michael training-support suggestions only.
 *
 * Michael no longer schedules calls and no longer interviews. Steve owns
 * Discovery + Success Profile. Michael's surviving route reads Steve's
 * profile and projects sponsor-facing training suggestions.
 */

import express, { type Request, type Response, type Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireSteveComplete } from '../middleware/requireSteveComplete.js';
import {
  getTrainingSupportCardForSponsor,
  TrainingSupportAccessError,
} from '../domain/michael-training-support.js';

export const michaelRoutes: Router = express.Router();

/** GET /api/michael/training-support/:downlineTmagId — sponsor-only.
 *  Sponsor reads derived training-support suggestions for a downline BA.
 *  Authoritative access check is server-side; all access/not-found failures
 *  return one opaque 404. */
michaelRoutes.get(
  '/training-support/:downlineTmagId',
  requireAuth,
  requireSteveComplete,
  async (req: Request, res: Response) => {
    const session = req.session!;
    res.set('Cache-Control', 'private, no-store');
    res.set('Pragma', 'no-cache');
    const downlineTmagId = String(req.params.downlineTmagId ?? '');
    if (!downlineTmagId) {
      res.status(400).json({ ok: false, error: 'Missing downlineTmagId.' });
      return;
    }
    try {
      const card = await getTrainingSupportCardForSponsor({
        requestingTmagId: session.tmagId,
        downlineTmagId,
      });
      res.json({ ok: true, card });
    } catch (err) {
      if (err instanceof TrainingSupportAccessError) {
        res.status(404).json({
          ok: false,
          error: 'Training-support card unavailable.',
          code: 'TRAINING_SUPPORT_UNAVAILABLE',
        });
        return;
      }
      res.status(500).json({ ok: false, error: 'Training-support read failed.' });
    }
  },
);
