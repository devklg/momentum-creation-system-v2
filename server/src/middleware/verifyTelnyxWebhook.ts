/**
 * Telnyx webhook signature verification.
 *
 * Telnyx signs every webhook with Ed25519. The signature is computed over
 * `timestamp + "|" + raw_body_bytes`. Headers:
 *   - telnyx-signature-ed25519  : base64-encoded signature
 *   - telnyx-timestamp          : unix timestamp (seconds, as string)
 *
 * Replay defense: reject if the timestamp is more than 5 minutes old.
 * Public key: env.TELNYX_PUBLIC_KEY (base64-encoded, from Mission Control Portal).
 *
 * Key-missing behavior (P10 H4):
 *   - development/test: if TELNYX_PUBLIC_KEY is empty, signature verification is
 *     SKIPPED with a warning, so local/ngrok replays work without portal config.
 *   - production: an empty TELNYX_PUBLIC_KEY FAILS CLOSED — the request is
 *     rejected with 401 rather than accepted unsigned. The env boot log also
 *     warns when the key is missing in production.
 *
 * Express's default express.json() parses the body before middlewares get a
 * chance to see the raw bytes. The route that uses this middleware MUST be
 * mounted with express.raw({ type: '*\/*' }) so req.body is a Buffer.
 */

import type { Request, Response, NextFunction } from 'express';
import nacl from 'tweetnacl';
import { env } from '../env.js';

const REPLAY_WINDOW_SEC = 5 * 60; // 5 minutes

export interface TelnyxWebhookEnvelope {
  data: {
    record_type: string;
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id?: string;
      call_leg_id?: string;
      call_session_id?: string;
      client_state?: string | null;
      from?: string;
      to?: string;
      state?: string;
      hangup_cause?: string;
      hangup_source?: string;
      [k: string]: unknown;
    };
  };
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      telnyxEvent?: TelnyxWebhookEnvelope;
    }
  }
}

function parseBase64(s: string): Uint8Array | null {
  try {
    return new Uint8Array(Buffer.from(s, 'base64'));
  } catch {
    return null;
  }
}

export function verifyTelnyxWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const signature = req.get('telnyx-signature-ed25519');
  const timestamp = req.get('telnyx-timestamp');
  const rawBody = req.body as Buffer | undefined;

  if (!rawBody || !Buffer.isBuffer(rawBody)) {
    res.status(400).json({ ok: false, error: 'Webhook body must be raw bytes.' });
    return;
  }

  // Replay window check (always enforced, even in dev).
  if (!timestamp) {
    res.status(400).json({ ok: false, error: 'Missing telnyx-timestamp header.' });
    return;
  }
  const tsNum = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(tsNum)) {
    res.status(400).json({ ok: false, error: 'Invalid telnyx-timestamp header.' });
    return;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - tsNum) > REPLAY_WINDOW_SEC) {
    res
      .status(401)
      .json({ ok: false, error: 'Webhook timestamp outside replay window.' });
    return;
  }

  // Signature verification. Skipped if no public key configured (dev mode).
  if (env.TELNYX_PUBLIC_KEY) {
    if (!signature) {
      res.status(401).json({ ok: false, error: 'Missing telnyx-signature-ed25519 header.' });
      return;
    }
    const sigBytes = parseBase64(signature);
    const pubKeyBytes = parseBase64(env.TELNYX_PUBLIC_KEY);
    if (!sigBytes || !pubKeyBytes) {
      res.status(400).json({ ok: false, error: 'Malformed signature or public key.' });
      return;
    }
    // Per Telnyx docs: signed message is `timestamp + "|" + raw_body`.
    const signed = Buffer.concat([Buffer.from(`${timestamp}|`), rawBody]);
    const ok = nacl.sign.detached.verify(
      new Uint8Array(signed),
      sigBytes,
      pubKeyBytes,
    );
    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[telnyx-webhook] signature verification FAILED ts=${timestamp} bodyBytes=${rawBody.length}`,
      );
      res.status(401).json({ ok: false, error: 'Signature verification failed.' });
      return;
    }
  } else if (process.env.NODE_ENV === 'production') {
    // P10 H4 — fail closed in production: a missing key must never mean
    // "accept unsigned". Read NODE_ENV at call time (like the runtime kill
    // switches) so deploy-mode changes take effect without a rebuild and so
    // this branch is unit-testable. The env-boot warning surfaces the same
    // misconfiguration at startup.
    // eslint-disable-next-line no-console
    console.error(
      '[telnyx-webhook] TELNYX_PUBLIC_KEY not set in production — rejecting webhook.',
    );
    res
      .status(401)
      .json({ ok: false, error: 'Webhook verification not configured.' });
    return;
  } else {
    // Dev only: skip with a warning so local/ngrok replays work.
    // eslint-disable-next-line no-console
    console.warn(
      '[telnyx-webhook] TELNYX_PUBLIC_KEY not set — signature verification SKIPPED. Dev only.',
    );
  }

  // Parse the now-trusted body.
  let parsed: TelnyxWebhookEnvelope;
  try {
    parsed = JSON.parse(rawBody.toString('utf8')) as TelnyxWebhookEnvelope;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    res.status(400).json({ ok: false, error: `Invalid JSON: ${msg}` });
    return;
  }

  if (!parsed?.data?.event_type) {
    res.status(400).json({ ok: false, error: 'Missing data.event_type in payload.' });
    return;
  }

  req.telnyxEvent = parsed;
  next();
}
