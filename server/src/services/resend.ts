/**
 * Resend email transport (Chat #116).
 *
 * Single responsibility: send one transactional email and return the
 * Resend message id. Mirrors the shape of services/telnyx.ts — a thin
 * transport with two error types and no retry/queue logic. Callers treat
 * sends as BEST-EFFORT: they persist an emailDeliveryStatus on their
 * record and return 200 to the client regardless, so a downstream email
 * failure never fails the prospect's submission.
 *
 * DORMANT BY DESIGN (Chat #116): the teammagnificent.com sending domain
 * is not yet verified in Resend (Namecheap DNS pending). Until EMAIL_API_KEY
 * is set AND EMAIL_FROM's domain is verified, sendEmail throws
 * ResendConfigError on the missing key; callers catch it, record
 * emailDeliveryStatus='skipped', and fall back to the BA-follow-up SMS.
 * The day the key + domain land, sends begin with no code change.
 *
 * Per Resend API (POST https://api.resend.com/emails):
 *   Required: from, to, subject, and one of { html, text }
 *   Auth: Authorization: Bearer <EMAIL_API_KEY>
 *   2xx returns { id }. 4xx/5xx returns { name, message }.
 */

import { fetch } from 'undici';
import { env } from '../env.js';

export class ResendError extends Error {
  constructor(
    public readonly status: number,
    public readonly upstreamBody: string,
    message: string,
  ) {
    super(`[resend] ${message}`);
    this.name = 'ResendError';
  }
}

export class ResendConfigError extends Error {
  constructor(missing: string[]) {
    super(
      `[resend] missing required env vars: ${missing.join(', ')}. ` +
        `Set these in .env (and verify the EMAIL_FROM domain in Resend) ` +
        `before sending email.`,
    );
    this.name = 'ResendConfigError';
  }
}

function assertEmailConfig(): void {
  const missing: string[] = [];
  if (!env.EMAIL_API_KEY) missing.push('EMAIL_API_KEY');
  if (!env.EMAIL_FROM) missing.push('EMAIL_FROM');
  if (missing.length > 0) throw new ResendConfigError(missing);
}

export interface SendEmailInput {
  /** Destination address. Single recipient for transactional sends. */
  to: string;
  /** Subject line. Keep concise; no marketing-y all-caps. */
  subject: string;
  /** HTML body. At least one of html/text must be present. */
  html?: string;
  /** Plain-text body (also serves as the fallback for non-HTML clients). */
  text?: string;
}

export interface SendEmailResult {
  messageId: string;
}

const RESEND_URL = 'https://api.resend.com/emails';

interface ResendApiResponse {
  id?: string;
  name?: string;
  message?: string;
}

/**
 * Send a single transactional email via Resend.
 *
 * Throws ResendConfigError if the API key or from-address is unset (the
 * dormant state today). Throws ResendError on a non-2xx response. Callers
 * MUST wrap in try/catch and treat any throw as a soft failure — record
 * the status and continue; do not fail the route.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  assertEmailConfig();

  if (!input.html && !input.text) {
    throw new ResendError(0, '', 'sendEmail requires at least one of html/text');
  }

  const body: Record<string, unknown> = {
    from: env.EMAIL_FROM,
    to: input.to,
    subject: input.subject,
  };
  if (input.html) body.html = input.html;
  if (input.text) body.text = input.text;
  if (env.EMAIL_REPLY_TO) body.reply_to = env.EMAIL_REPLY_TO;

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.EMAIL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new ResendError(
      res.status,
      text,
      `send failed: HTTP ${res.status} ${res.statusText}`,
    );
  }

  let parsed: ResendApiResponse;
  try {
    parsed = JSON.parse(text) as ResendApiResponse;
  } catch {
    throw new ResendError(res.status, text, 'send response was not JSON');
  }

  const messageId = parsed.id;
  if (!messageId) {
    throw new ResendError(res.status, text, 'send response missing message id');
  }

  return { messageId };
}
