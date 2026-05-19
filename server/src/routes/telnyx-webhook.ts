/**
 * /api/telnyx/webhook — Telnyx Call Control event sink.
 *
 * Drives Michael's outbound-call state machine (Chat #97 × #102):
 *   call.answered  while status=scheduled    → in_progress
 *   call.hangup    while status=in_progress  → completed (gate opens)
 *   call.hangup    while status=scheduled    → missed (BA can reschedule once)
 *
 * The route is mounted with express.raw() so the signature middleware sees
 * the unparsed bytes — signing is over raw payload, not the re-serialized
 * JSON. All other Express routes continue to use express.json().
 *
 * Binding webhook → schedule: every Telnyx event carries `client_state`,
 * which we set at call-origination time to base64(JSON({ baId, scheduleId })).
 * On call.answered we decode it and stash baId on the schedule via the
 * markCallStarted callSid argument. Subsequent events for the same call use
 * the same client_state, so the binding is stable.
 *
 * Telnyx requires a 200 response within 5 seconds. We return 200 for any
 * event we recognize (handled or noop). 4xx is only for malformed input
 * before we know what the event is.
 */

import express, { type Request, type Response, type Router } from 'express';
import {
  verifyTelnyxWebhook,
  type TelnyxWebhookEnvelope,
} from '../middleware/verifyTelnyxWebhook.js';
import {
  markCallStarted,
  markCallCompleted,
  markCallMissed,
  getMichaelSchedule,
} from '../domain/michael-schedule.js';

export const telnyxWebhookRoutes: Router = express.Router();

/**
 * Parse the client_state we set at call origination.
 * Shape: base64(JSON.stringify({ baId, scheduleId })).
 * Returns null on any decode failure — the caller falls back to callSid
 * lookup or logs and 200s.
 */
function decodeClientState(s: string | null | undefined): { baId: string } | null {
  if (!s) return null;
  try {
    const json = Buffer.from(s, 'base64').toString('utf8');
    const obj = JSON.parse(json) as { baId?: string };
    return obj.baId ? { baId: obj.baId } : null;
  } catch {
    return null;
  }
}

/**
 * Find the schedule for an incoming event. Primary key is client_state.baId.
 * Fallback: look up by callSid stored on the schedule (set at markCallStarted).
 * Returns null if neither resolves — caller logs + 200s.
 */
async function resolveScheduleBaId(
  event: TelnyxWebhookEnvelope,
): Promise<string | null> {
  const fromClientState = decodeClientState(event.data.payload.client_state ?? null);
  if (fromClientState) return fromClientState.baId;

  // Fallback by callSid — only works for events AFTER call.answered, since
  // markCallStarted is what writes the callSid.
  const callSid = event.data.payload.call_control_id;
  if (!callSid) return null;
  // Reverse lookup by callSid. Not on the hot path — we expect client_state
  // to be present for all events of calls this server originated.
  try {
    // We don't have a domain helper for callSid lookup yet; inline the query
    // so we don't drift the domain interface.
    const { gatewayCall } = await import('../services/gateway.js');
    const result = await gatewayCall<{
      documents: { baId: string }[];
    }>('mongodb', 'query', {
      database: 'momentum',
      collection: 'michael_schedules',
      filter: { callSid },
      limit: 1,
    });
    return result.documents[0]?.baId ?? null;
  } catch {
    return null;
  }
}

telnyxWebhookRoutes.post(
  '/webhook',
  express.raw({ type: '*/*', limit: '256kb' }),
  verifyTelnyxWebhook,
  async (req: Request, res: Response) => {
    const event = req.telnyxEvent!;
    const { event_type, payload, occurred_at, id: eventId } = event.data;
    const callSid = payload.call_control_id ?? null;

    const baId = await resolveScheduleBaId(event);
    if (!baId) {
      // eslint-disable-next-line no-console
      console.warn(
        `[telnyx-webhook] unbound event ${event_type} eventId=${eventId} callSid=${callSid} — 200 OK, no-op`,
      );
      res.status(200).json({ ok: true, handled: false, reason: 'no_binding' });
      return;
    }

    try {
      switch (event_type) {
        case 'call.answered': {
          const tx = await markCallStarted({
            baId,
            callSid: callSid ?? eventId,
            occurredAt: occurred_at,
          });
          // eslint-disable-next-line no-console
          console.log(
            `[telnyx-webhook] call.answered baId=${baId} result=${tx.kind}${
              tx.kind === 'transitioned' ? ` (${tx.from}->${tx.to})` : ` (${tx.reason})`
            }`,
          );
          res.status(200).json({ ok: true, handled: true, transition: tx.kind });
          return;
        }

        case 'call.hangup': {
          // Distinguish completed vs missed by current state. If status was
          // 'in_progress' the call was answered — a hangup is normal completion.
          // If status was 'scheduled' the call ended without ever being answered
          // — missed (no-answer, declined, busy, machine).
          const current = await getMichaelSchedule(baId);
          if (!current) {
            // eslint-disable-next-line no-console
            console.warn(`[telnyx-webhook] hangup for unknown baId=${baId}`);
            res.status(200).json({ ok: true, handled: false, reason: 'no_schedule' });
            return;
          }
          if (current.status === 'in_progress') {
            const tx = await markCallCompleted({ baId, occurredAt: occurred_at });
            // eslint-disable-next-line no-console
            console.log(
              `[telnyx-webhook] call.hangup baId=${baId} result=${tx.kind} (completed path)`,
            );
            res.status(200).json({ ok: true, handled: true, transition: tx.kind });
            return;
          }
          const reason = String(
            payload.hangup_cause ?? payload.state ?? 'unknown',
          );
          const tx = await markCallMissed({ baId, occurredAt: occurred_at, reason });
          // eslint-disable-next-line no-console
          console.log(
            `[telnyx-webhook] call.hangup baId=${baId} result=${tx.kind} (missed path, reason=${reason})`,
          );
          res.status(200).json({ ok: true, handled: true, transition: tx.kind });
          return;
        }

        // Events we acknowledge but don't act on:
        // call.initiated — we know we placed the call; no state change yet.
        // call.machine.detection.ended — AMD info, useful for Michael script
        //   tailoring but not for the scheduling state machine.
        case 'call.initiated':
        case 'call.machine.detection.ended':
        case 'call.machine.premium.detection.ended':
        case 'call.machine.greeting.ended':
        case 'call.machine.premium.greeting.ended':
          // eslint-disable-next-line no-console
          console.log(`[telnyx-webhook] ack ${event_type} baId=${baId}`);
          res.status(200).json({ ok: true, handled: false, reason: 'ack_only' });
          return;

        default:
          // eslint-disable-next-line no-console
          console.log(
            `[telnyx-webhook] unrecognized event_type=${event_type} eventId=${eventId} baId=${baId}`,
          );
          res.status(200).json({ ok: true, handled: false, reason: 'unrecognized' });
          return;
      }
    } catch (err) {
      // We still return 200 here — returning 5xx makes Telnyx retry, which
      // doesn't help if the failure is in our DB layer. The error is logged.
      const msg = err instanceof Error ? err.message : 'unknown';
      // eslint-disable-next-line no-console
      console.error(
        `[telnyx-webhook] handler error event=${event_type} baId=${baId}: ${msg}`,
      );
      res.status(200).json({ ok: false, handled: false, error: msg });
    }
  },
);
