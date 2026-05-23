/**
 * Environment variable loader and validator.
 * Reads .env from the monorepo root (gitignored) and validates required values at boot.
 * Fails fast at startup if anything required is missing or malformed.
 */

import { config as loadDotenv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { z } from 'zod';

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Fall back to cwd if we couldn't find it.
  return process.cwd();
}

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = findRepoRoot(here);
const envPath = path.join(repoRoot, '.env');
const result = loadDotenv({ path: envPath });
if (process.env.DEBUG_ENV) {
  // eslint-disable-next-line no-console
  console.log('[env] from:', here, '| root:', repoRoot, '| envPath:', envPath, '| parsed keys:', result.parsed ? Object.keys(result.parsed).length : 0, '| error:', result.error?.message);
}

const Env = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(7700),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  GATEWAY_URL: z.string().url().default('http://localhost:2525/api'),

  ADMIN_BA_IDS: z
    .string()
    .default('')
    .transform((s) =>
      s.split(',').map((id) => id.trim()).filter(Boolean),
    ),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_COOKIE_DOMAIN: z.string().default('.teammagnificent.team'),
  JWT_COOKIE_NAME: z.string().default('mcs_session'),
  JWT_TTL_REMEMBER_DAYS: z.coerce.number().int().positive().default(30),

  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),

  /**
   * Telnyx public key for Ed25519 webhook signature verification.
   * Base64-encoded — fetch from Mission Control Portal > Auth > Public Key.
   * Empty in dev means signature verification is bypassed (logged) so
   * webhook tooling like ngrok-replay works without portal config.
   */
  TELNYX_PUBLIC_KEY: z.string().default(''),

  /**
   * Telnyx API key (v2 Bearer token). Required to originate outbound calls.
   * From Mission Control Portal > Auth > API Keys.
   */
  TELNYX_API_KEY: z.string().default(''),

  /**
   * Telnyx Call Control Application connection_id. The application's webhook
   * URL is configured in the Portal; events route to /api/telnyx/webhook.
   * From Mission Control Portal > Call Control > Applications.
   */
  TELNYX_CONNECTION_ID: z.string().default(''),

  /**
   * Caller ID for Michael's outbound calls. E.164 format, e.g. +13235551234.
   * Must be a number assigned to the Telnyx Call Control Application above.
   */
  TELNYX_FROM_NUMBER: z.string().default(''),

  /**
   * Optional per-call webhook URL override. If set, included in every dial
   * request so Telnyx routes events here regardless of portal config — useful
   * for dev/staging environments using ngrok. If empty, Telnyx uses the
   * Application's configured webhook URL.
   */
  TELNYX_WEBHOOK_URL: z.string().default(''),

  /**
   * Zoom registration URL for the recurring Team Magnificent webinar.
   * One persistent registration link for all sessions (Mon/Thu 5pm Pacific).
   * The prospect registers through Zoom; Zoom sends them their own join link.
   * Stored on each seeded webinar_event as `zoomUrl` and surfaced by the
   * reservation flow. A future Zoom Server-to-Server OAuth sync agent may
   * later overwrite individual events with per-occurrence registration
   * links (Chat #116 decision); the field is already nullable to allow this
   * without a schema change. Empty default is non-fatal — the seeder warns
   * rather than failing boot.
   */
  WEBINAR_REGISTER_URL: z.string().default(''),

  /**
   * Email provider selector. Only 'resend' is wired (Chat #116). Kept as an
   * enum so a future provider swap is a one-line env change, not a code edit.
   */
  EMAIL_PROVIDER: z.enum(['resend']).default('resend'),

  /**
   * Resend API key (re_...). From resend.com > API Keys. Empty in dev/today:
   * the email transport WARNS and records emailDeliveryStatus='skipped' rather
   * than crashing, and the BA-follow-up SMS fallback stays the live behavior.
   * Webinar/welcome/reset emails begin sending the moment this is set AND the
   * EMAIL_FROM domain is verified in Resend. Chat #116: domain not yet set up
   * (Namecheap DNS pending) — wired dormant by design.
   */
  EMAIL_API_KEY: z.string().default(''),

  /**
   * From-address for outbound email. MUST be on a domain verified in Resend
   * (SPF/DKIM DNS records) or sends are rejected. Planned default
   * webinars@teammagnificent.com pending the teammagnificent.com domain
   * verification (Chat #116).
   */
  EMAIL_FROM: z.string().default('webinars@teammagnificent.com'),

  /**
   * Optional Reply-To header. Empty = no Reply-To set. Useful later to route
   * replies to a monitored inbox distinct from the no-reply send address.
   */
  EMAIL_REPLY_TO: z.string().default(''),

  /**
   * Anthropic API key (sk-ant-...) for the LLM-backed invitation front doors
   * — ScriptMaker (Chat #122) and Ivory (later). The gateway has NO LLM
   * connector (confirmed Chat #118 via list_tools), so these call the
   * Anthropic Messages API DIRECTLY. From console.anthropic.com > API Keys.
   *
   * DORMANT BY DESIGN, mirroring EMAIL_API_KEY: empty in dev means the LLM
   * service WARNS via AnthropicConfigError and the calling surface degrades
   * (ScriptMaker shows the manual compose path) rather than crashing boot.
   * Kevin HAS the key (Chat #120 correction) — it just needs to land in the
   * untracked .env so the running process can read it. Drafts begin the
   * moment this is set; no code change.
   */
  ANTHROPIC_API_KEY: z.string().default(''),

  /**
   * Model string for invitation-draft generation. A config constant so a
   * future model swap (e.g. to Claude 5) is a one-line env change, not a code
   * edit (Chat #118 lock). Default Haiku 4.5 — fast and cheap for short
   * personalized drafts; A/B against Sonnet on copy quality is a later tuning
   * step. Prompt-caching applies to the stable compliance+product prefix.
   */
  ANTHROPIC_MODEL: z.string().default('claude-haiku-4-5-20251001'),
});

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
