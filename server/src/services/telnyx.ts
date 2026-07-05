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

function assertVoiceConfig(): void {
  const missing: string[] = [];
  if (!env.TELNYX_API_KEY) missing.push('TELNYX_API_KEY');
  if (!env.TELNYX_CONNECTION_ID) missing.push('TELNYX_CONNECTION_ID');
  if (!env.TELNYX_DIAL_FROM_NUMBER) missing.push('TELNYX_DIAL_FROM_NUMBER');
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
const TELNYX_CALLS_URL = 'https://api.telnyx.com/v2/calls';

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

// ============================================================================
// Voice (Call Control API)
// ============================================================================

export interface DialCallInput {
  to: string;
  from?: string;
  connectionId?: string;
  amd?: boolean;
  webhookUrl?: string;
  clientState?: string;
}

export interface DialCallResult {
  callControlId: string;
  callLegId: string | null;
  callSessionId: string | null;
}

interface TelnyxCallResponse {
  data?: {
    call_control_id?: string;
    call_leg_id?: string;
    call_session_id?: string;
  };
}

async function telnyxJson<T>(url: string, body: Record<string, unknown>, label: string): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new TelnyxError(res.status, text, `${label} failed: HTTP ${res.status} ${res.statusText}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new TelnyxError(res.status, text, `${label} response was not JSON`);
  }
}

export async function dialCall(input: DialCallInput): Promise<DialCallResult> {
  assertVoiceConfig();
  const body: Record<string, unknown> = {
    connection_id: input.connectionId ?? env.TELNYX_CONNECTION_ID,
    to: input.to,
    from: input.from ?? env.TELNYX_DIAL_FROM_NUMBER,
  };
  if (input.amd === true) body.answering_machine_detection = 'premium';
  if (input.webhookUrl ?? env.TELNYX_WEBHOOK_URL) body.webhook_url = input.webhookUrl ?? env.TELNYX_WEBHOOK_URL;
  if (input.clientState) body.client_state = input.clientState;

  const parsed = await telnyxJson<TelnyxCallResponse>(TELNYX_CALLS_URL, body, 'call dial');
  const callControlId = parsed.data?.call_control_id;
  if (!callControlId) throw new TelnyxError(200, JSON.stringify(parsed), 'call dial response missing call_control_id');
  return {
    callControlId,
    callLegId: parsed.data?.call_leg_id ?? null,
    callSessionId: parsed.data?.call_session_id ?? null,
  };
}

export async function playbackStart(callControlId: string, audioUrl: string): Promise<void> {
  assertVoiceConfig();
  await telnyxJson(
    `${TELNYX_CALLS_URL}/${encodeURIComponent(callControlId)}/actions/playback_start`,
    { audio_url: audioUrl },
    'playback_start',
  );
}

export async function hangupCall(callControlId: string): Promise<void> {
  assertVoiceConfig();
  await telnyxJson(
    `${TELNYX_CALLS_URL}/${encodeURIComponent(callControlId)}/actions/hangup`,
    {},
    'hangup',
  );
}

export async function gatherSingleDigit(input: {
  callControlId: string;
  audioUrl: string;
  validDigits?: string;
  timeoutMs?: number;
}): Promise<void> {
  assertVoiceConfig();
  await telnyxJson(
    `${TELNYX_CALLS_URL}/${encodeURIComponent(input.callControlId)}/actions/gather_using_audio`,
    {
      audio_url: input.audioUrl,
      maximum_digits: 1,
      valid_digits: input.validDigits ?? '1',
      timeout_millis: input.timeoutMs ?? 8000,
    },
    'gather_using_audio',
  );
}

