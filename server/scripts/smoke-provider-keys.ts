/**
 * P2-143 live-environment provider-key smoke.
 *
 * This executable never sends an email and never submits an LLM prompt. It
 * performs authenticated GET-only metadata checks for the configured Resend
 * sending domain and Anthropic model. --live is mandatory so provider contact
 * cannot happen accidentally in CI or during an ordinary local test run.
 *
 * Run both:
 *   pnpm --filter @momentum/server smoke:provider-keys -- --live
 * Run one:
 *   pnpm --filter @momentum/server smoke:provider-keys -- --live --provider=email
 *   pnpm --filter @momentum/server smoke:provider-keys -- --live --provider=llm
 */

import { env } from '../src/env.js';
import {
  runProviderReleaseSmoke,
  type ProviderReleaseSmokeTarget,
} from '../src/services/providerReleaseSmoke.js';

const args = process.argv.slice(2);
if (!args.includes('--live')) {
  console.error(
    '[provider-smoke] Refusing provider contact without explicit --live. ' +
      'No email was sent and no LLM prompt was submitted.',
  );
  process.exitCode = 2;
} else {
  const providerArg = args.find((arg) => arg.startsWith('--provider='));
  const target = (providerArg?.slice('--provider='.length) ?? 'all') as ProviderReleaseSmokeTarget;
  if (!['email', 'llm', 'all'].includes(target)) {
    console.error('[provider-smoke] --provider must be email, llm, or all.');
    process.exitCode = 2;
  } else {
    const results = await runProviderReleaseSmoke(env, target);
    const ok = results.length > 0 && results.every((entry) => entry.ok);
    console.log(JSON.stringify({
      schemaVersion: 'provider_release_smoke.v1',
      checkedAt: new Date().toISOString(),
      ok,
      liveMetadataChecks: true,
      sendsEmail: false,
      sendsLlmPrompt: false,
      interviewDataSent: false,
      results,
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  }
}
