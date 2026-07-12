/**
 * ACR-0013 §4 — CLI for the retrieval ladder. Handle (noun) + verb
 * (operator) + audience:
 *
 *   pnpm memory:packet "krtp-mem"
 *   pnpm memory:packet "voice mailer reality"
 *   pnpm memory:packet "voice mailer reality" --verb excludes
 *   pnpm memory:packet "member sms channel" --verb protects --audience dev_agents
 *
 * Exact invocation first (no semantic guessing); compile with graph
 * expansion (the verb selects the traversal — multi-hop; no verb → the full
 * 13-verb chain) + capped neighbours + briefs in stated order; else union
 * semantic fallback across ALL stores ranked weight × recency × distance.
 * Packets for app agents contain only `app_agents`/`both` records — absent
 * audience fails closed to dev_agents. A hollow operator (verb with no
 * edges) is reported explicitly in `warnings`, never as an empty answer.
 * Prints the packet as JSON.
 */

import type { McsMemoryAudience, McsMemoryContextGraphVerb } from '@momentum/shared/runtime';
import { compileContextPacket, EXPANSION_VERBS } from '../src/lib/contextPacket.js';

const args = process.argv.slice(2);
let verb: McsMemoryContextGraphVerb | undefined;
let audience: McsMemoryAudience | undefined;
const queryParts: string[] = [];

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i]!;
  if (arg === '--verb') {
    const value = args[++i];
    if (!value || !(EXPANSION_VERBS as readonly string[]).includes(value)) {
      console.error(`--verb must be one of: ${EXPANSION_VERBS.join(', ')}`);
      process.exit(1);
    }
    verb = value as McsMemoryContextGraphVerb;
  } else if (arg === '--audience') {
    const value = args[++i];
    if (value !== 'dev_agents' && value !== 'app_agents' && value !== 'both') {
      console.error('--audience must be dev_agents | app_agents | both');
      process.exit(1);
    }
    audience = value;
  } else {
    queryParts.push(arg);
  }
}

const query = queryParts.join(' ').trim();
if (query === '') {
  console.error('usage: pnpm memory:packet "<call phrase, alias, or query>" [--verb <operator>] [--audience <dev_agents|app_agents|both>]');
  process.exit(1);
}

const packet = await compileContextPacket(query, verb, audience ? { audience } : {});
console.log(JSON.stringify(packet, null, 2));
