/** Telnyx Messaging API client for BA SMS alerts. */

import { fetch } from 'undici';
import { env } from '../env.js';

export class TelnyxError extends Error {
  constructor(
    public readonly status: number,
    public readonly upstreamBody: string,
    message: string,
  ) {
    super(`[telnyx] ${message}`);
    this.name = 'TelnyxError';
  }
}

export class TelnyxConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `[telnyx] missing required env vars: ${missing.join(', ')}. ` +
        `Set these in .env before sending SMS alerts.`,
    );
    this.name = 'TelnyxConfigError';
  }
}

/**
 * The Messaging API expects a from-number provisioned for messaging on the
 * Telnyx account.
 */
function assertSmsConfig(): void {
  const missing: string[] = [];
  if (!env.TELNYX_API_KEY) missing.push('TELNYX_API_KEY');
  if (!env.TELNYX_FROM_NUMBER) missing.push('TELNYX_FROM_NUMBER');
  if (missing.length > 0) throw new TelnyxConfigError(missing);
}

// ============================================================================
// SMS (Messaging API)
// ============================================================================
//
// Used for raised-hand signal events to BAs (Chat #105 spec amendment: a
// callback request fires a Telnyx SMS to the BA; a webinar reservation does
// not). The SMS body is built by the caller (e.g. domain/callbackRequest.ts)
// so this service stays a thin transport.
//
// Per Telnyx Messaging API (POST /v2/messages):
//   Required: from, to, text  (or messaging_profile_id, but we use from)
// On 2xx: returns { messageId }. On 4xx/5xx: throws TelnyxError.
//
// Failures from this function should NOT bring down the calling route. The
// caller persists smsDeliveryStatus on the record and returns 200 to the
// .com client regardless — the prospect's submission landed even if the
// downstream SMS failed; the BA can be reached via cockpit alert instead.

const TELNYX_MESSAGES_URL = 'https://api.telnyx.com/v2/messages';

export interface SendSmsInput {
  /** E.164 destination, e.g. +13235551234. The BA's phone. */
  to: string;
  /** Plain SMS text. Caller builds the message; keep it under 1600 chars. */
  text: string;
}

export interface SendSmsResult {
  messageId: string;
}

interface TelnyxMessageResponse {
  data?: {
    id?: string;
  };
  errors?: Array<{ title?: string; detail?: string; code?: string }>;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  assertSmsConfig();

  const body = {
    from: env.TELNYX_FROM_NUMBER,
    to: input.to,
    text: input.text,
  };

  const res = await fetch(TELNYX_MESSAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new TelnyxError(
      res.status,
      text,
      `sms send failed: HTTP ${res.status} ${res.statusText}`,
    );
  }

  let parsed: TelnyxMessageResponse;
  try {
    parsed = JSON.parse(text) as TelnyxMessageResponse;
  } catch {
    throw new TelnyxError(res.status, text, 'sms response was not JSON');
  }

  const messageId = parsed.data?.id;
  if (!messageId) {
    throw new TelnyxError(res.status, text, 'sms response missing message id');
  }

  return { messageId };
}

