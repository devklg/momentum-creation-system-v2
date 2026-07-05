/**
 * /api/telnyx/webhook — raw-body Telnyx event sink.
 *
 * Michael no longer places scheduled/interview calls. VM dialer v1 uses this
 * raw-body, Ed25519-verified sink for Telnyx Call Control AMD / press-1 events.
 */

import express, { type Request, type Response, type Router } from 'express';
import { verifyTelnyxWebhook } from '../middleware/verifyTelnyxWebhook.js';
import { recordProviderWebhook } from '../domain/vmProviderQueue.js';

export const telnyxWebhookRoutes: Router = express.Router();

telnyxWebhookRoutes.post(
  '/webhook',
  express.raw({ type: '*/*', limit: '256kb' }),
  verifyTelnyxWebhook,
  async (req: Request, res: Response) => {
    const event = req.telnyxEvent!;
    const { event_type, id: eventId } = event.data;
    const payload = event.data.payload ?? {};

    const isCallControlEvent =
      event_type.startsWith('call.') ||
      typeof payload.call_control_id === 'string' ||
      typeof payload.call_session_id === 'string';

    if (isCallControlEvent) {
      const result = await recordProviderWebhook({
        provider: 'telnyx_call_control',
        payload: {
          providerEventId: eventId,
          eventType: event_type,
          occurredAt: event.data.occurred_at,
          ...payload,
        },
        headers: req.headers,
      });
      res.status(202).json({ ok: true, handled: true, ...result });
      return;
    }

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
