/**
 * /api/telnyx/webhook — raw-body Telnyx event sink.
 *
 * Michael no longer places scheduled/interview calls. This endpoint remains
 * mounted because Telnyx may still POST historical or provider-level events,
 * but it intentionally performs no onboarding state transitions.
 */

import express, { type Request, type Response, type Router } from 'express';
import { verifyTelnyxWebhook } from '../middleware/verifyTelnyxWebhook.js';

export const telnyxWebhookRoutes: Router = express.Router();

telnyxWebhookRoutes.post(
  '/webhook',
  express.raw({ type: '*/*', limit: '256kb' }),
  verifyTelnyxWebhook,
  async (req: Request, res: Response) => {
    const event = req.telnyxEvent!;
    const { event_type, id: eventId } = event.data;

    // eslint-disable-next-line no-console
    console.log(
      `[telnyx-webhook] ack ${event_type} eventId=${eventId} — Michael call routes retired`,
    );
    res.status(200).json({
      ok: true,
      handled: false,
      reason: 'michael_call_routes_retired',
    });
  },
);
