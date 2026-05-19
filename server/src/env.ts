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
});

export const env = Env.parse(process.env);
export type Env = z.infer<typeof Env>;
