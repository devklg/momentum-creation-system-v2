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

const EnvBoolean = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off', ''].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

const Env = z.object({
  SERVER_PORT: z.coerce.number().int().positive().default(7700),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  GATEWAY_URL: z.string().url().default('http://localhost:2526/api'),

  /**
   * Base URL minted /p/{token} prospect links are built on (#145). Dev
   * default is the local .com app (localhost:7701) so links resolve without
   * a deploy; production sets PROSPECT_BASE_URL=https://teammagnificent.com.
   * Was hardcoded in domain/invitations.ts through #144 — every dev link
   * 404'd against prod until hand-swapped. No trailing slash.
   */
  PROSPECT_BASE_URL: z.string().url().default('http://localhost:7701'),

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

  /**
   * VM campaign provider scale layer. Delivery is dry-run/manual by default.
   * Live voicemail/SMS/email provider sends require BOTH:
   *   1. VM_LIVE_DELIVERY_ENABLED=true
   *   2. the campaign document carrying adminApprovedForLiveDelivery=true
   */
  VM_PROVIDER_MODE: z.enum(['manual_csv', 'acquisition_provider_placeholder']).default('manual_csv'),
  VM_LIVE_DELIVERY_ENABLED: EnvBoolean.default(false),
  VM_DELIVERY_RATE_PER_MINUTE: z.coerce.number().int().positive().max(600).default(60),
  VM_WEBHOOK_SHARED_SECRET: z.string().default(''),
  VM_ACQUISITION_PROVIDER_API_URL: z.string().url().optional(),
  VM_ACQUISITION_PROVIDER_API_KEY: z.string().default(''),

  // ─── S1.3 direct-persistence (ACR-0007 / Option C) ───────────────────────
  // Additive and fully defaulted: the server boots unchanged in gateway mode.
  // Direct adapters connect only when a per-store *_MODE is 'direct' AND
  // PERSISTENCE_DIRECT_ENABLED is true. The Gateway HTTP path stays the default
  // runtime persistence path until a later, separately approved cutover.
  MONGODB_URI: z.string().default('mongodb://127.0.0.1:28000'),
  MONGODB_DB: z.string().default('momentum'),
  NEO4J_URI: z.string().default('bolt://127.0.0.1:7687'),
  NEO4J_USERNAME: z.string().default('neo4j'),
  NEO4J_PASSWORD: z.string().default(''),
  CHROMA_URL: z.string().url().default('http://localhost:8100'),
  GPU_EMBEDDER_URL: z.string().url().default('http://localhost:8300'),

  // Per-store cutover flags (S1_3_IMPLEMENTATION_BREAKDOWN §9). Default 'gateway'.
  PERSISTENCE_MONGO_MODE: z.enum(['gateway', 'direct']).default('gateway'),
  PERSISTENCE_NEO4J_MODE: z.enum(['gateway', 'direct']).default('gateway'),
  PERSISTENCE_CHROMA_MODE: z.enum(['gateway', 'direct']).default('gateway'),
  // Master safety switch: even if a *_MODE is 'direct', direct dispatch is only
  // active when this is true. Lets Phase 0/1 land without changing runtime.
  PERSISTENCE_DIRECT_ENABLED: EnvBoolean.default(false),
  // GPU embedder is required for Chroma direct writes; there is no CPU fallback.
  GPU_EMBEDDER_REQUIRED: EnvBoolean.default(true),
  // Phase 7 · R0 canary kill-switch (P7.1 §6 / P7.2). When false (default) the
  // runtime audit writer `appendRuntimeAuditEntry` is a no-op — the runtime turn
  // lifecycle is NOT persisted. Flipping to true enables the first persistence
  // rung (runtime audit only) without redeploy. Higher rungs (outcomes/learning/
  // GraphRAG) stay off regardless of this flag.
  RUNTIME_AUDIT_PERSISTENCE_ENABLED: EnvBoolean.default(false),
  // Phase 7 · R1 canary kill-switch (P7.1 §6 / P7.4). When false (default) the
  // outcome-capture writer `appendOutcome` is a no-op. Stays independent of R0 —
  // outcomes cannot be enabled until runtime audit (R0) is proven, but the flags
  // are separate so each rung is turned on and killed on its own.
  OUTCOME_CAPTURE_PERSISTENCE_ENABLED: EnvBoolean.default(false),
  // Phase 7 · R2 canary kill-switch (P7.1 §6 / P7.5). When false (default) the
  // learning-candidate writer/review are no-ops. Candidates are review-only and
  // NEVER active knowledge; no agent may approve — enabling this flag only turns
  // on candidate CAPTURE + the human review-decision recorder, nothing else.
  LEARNING_CANDIDATE_PERSISTENCE_ENABLED: EnvBoolean.default(false),
  // Phase 7 · R3 canary kill-switch (P7.1 §6 / P7.6). When false (default) the
  // GraphRAG writer + retrieval are no-ops. Only active, retrieval-ready,
  // approved knowledge is ever served; candidates/superseded/archived excluded.
  GRAPHRAG_PERSISTENCE_ENABLED: EnvBoolean.default(false),
});

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;

// ─── P10 H3/H4 — production configuration hardening ───────────────────────
// Fail fast at boot rather than silently running an insecure production config.
if (env.NODE_ENV === 'production') {
  const KNOWN_PLACEHOLDER_SECRETS = new Set([
    'replace-me-with-a-long-random-string',
    'changeme',
    'secret',
    'your-secret-here',
  ]);
  if (
    KNOWN_PLACEHOLDER_SECRETS.has(env.JWT_SECRET) ||
    env.JWT_SECRET.length < 32
  ) {
    throw new Error(
      '[env] JWT_SECRET is a known placeholder or too short (<32 chars) for ' +
        'production. Generate a strong secret, e.g. `openssl rand -base64 48`.',
    );
  }

  // Webhook signing key: warn (not hard-fail) so a deploy that intentionally
  // runs without inbound webhooks can still boot. The verifyTelnyxWebhook
  // middleware fails CLOSED at request time when the key is missing in
  // production, so a forged webhook is rejected regardless of this warning.
  if (!env.TELNYX_PUBLIC_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      '[env] TELNYX_PUBLIC_KEY is not set in production — Telnyx webhooks will ' +
        'be rejected (fail-closed) until it is configured.',
    );
  }
  if (env.VM_LIVE_DELIVERY_ENABLED && !env.VM_WEBHOOK_SHARED_SECRET) {
    // eslint-disable-next-line no-console
    console.warn(
      '[env] VM_LIVE_DELIVERY_ENABLED=true but VM_WEBHOOK_SHARED_SECRET is ' +
        'unset — inbound VM provider webhooks will not be authenticated.',
    );
  }
}
