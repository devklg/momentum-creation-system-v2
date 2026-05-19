/**
 * Telnyx Call Control client.
 *
 * Single responsibility: place an outbound call to a Michael interviewee
 * and return the Telnyx call_control_id so the schedule record can bind
 * webhook events back to the BA.
 *
 * Errors are surfaced via TelnyxError so the originator can mark the call
 * as failed cleanly (instead of leaving the schedule wedged in 'scheduled'
 * forever after a transient dial failure).
 *
 * Per Telnyx Dial API (POST /v2/calls):
 *   Required: connection_id, to, from
 *   Optional we use: client_state (base64 binding), webhook_url override,
 *                    answering_machine_detection ('detect_words' so we can
 *                    later choose to hang up on machine result).
 *
 * On 2xx response: returns { callControlId, callLegId, callSessionId }.
 * On 4xx/5xx response: throws TelnyxError with the upstream error body.
 */

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
        `Set these in .env before originating calls.`,
    );
    this.name = 'TelnyxConfigError';
  }
}

function assertCallOriginationConfig(): void {
  const missing: string[] = [];
  if (!env.TELNYX_API_KEY) missing.push('TELNYX_API_KEY');
  if (!env.TELNYX_CONNECTION_ID) missing.push('TELNYX_CONNECTION_ID');
  if (!env.TELNYX_FROM_NUMBER) missing.push('TELNYX_FROM_NUMBER');
  if (missing.length > 0) throw new TelnyxConfigError(missing);
}

export interface DialInput {
  /** E.164 destination, e.g. +13235551234. The BA's phone. */
  to: string;
  /**
   * Opaque payload to bind webhook → schedule. We use { baId, scheduleId }.
   * The Dial API expects the value already base64-encoded; this client does
   * the encoding so callers pass a plain object.
   */
  clientState: Record<string, string>;
}

export interface DialResult {
  callControlId: string;
  callLegId: string;
  callSessionId: string;
}

const TELNYX_DIAL_URL = 'https://api.telnyx.com/v2/calls';

interface TelnyxDialResponse {
  data?: {
    call_control_id?: string;
    call_leg_id?: string;
    call_session_id?: string;
  };
  errors?: Array<{ title?: string; detail?: string; code?: string }>;
}

export async function placeCall(input: DialInput): Promise<DialResult> {
  assertCallOriginationConfig();

  const clientStateB64 = Buffer.from(
    JSON.stringify(input.clientState),
    'utf8',
  ).toString('base64');

  const body: Record<string, unknown> = {
    connection_id: env.TELNYX_CONNECTION_ID,
    to: input.to,
    from: env.TELNYX_FROM_NUMBER,
    client_state: clientStateB64,
    answering_machine_detection: 'detect_words',
  };
  if (env.TELNYX_WEBHOOK_URL) {
    body.webhook_url = env.TELNYX_WEBHOOK_URL;
  }

  const res = await fetch(TELNYX_DIAL_URL, {
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
      `dial failed: HTTP ${res.status} ${res.statusText}`,
    );
  }

  let parsed: TelnyxDialResponse;
  try {
    parsed = JSON.parse(text) as TelnyxDialResponse;
  } catch {
    throw new TelnyxError(res.status, text, 'dial response was not JSON');
  }

  const callControlId = parsed.data?.call_control_id;
  const callLegId = parsed.data?.call_leg_id;
  const callSessionId = parsed.data?.call_session_id;
  if (!callControlId || !callLegId || !callSessionId) {
    throw new TelnyxError(
      res.status,
      text,
      'dial response missing required ids',
    );
  }

  return { callControlId, callLegId, callSessionId };
}
