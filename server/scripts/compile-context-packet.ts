/**
 * ACR-0013 §4 — CLI for the retrieval ladder:
 *
 *   pnpm memory:packet "krtp-mem"
 *   pnpm memory:packet "voice mailer reality"
 *
 * Exact invocation first (no semantic guessing); compile with graph
 * expansion + capped neighbours + briefs in stated order; else union
 * semantic fallback across ALL stores ranked weight × recency × distance.
 * Prints the packet as JSON.
 */

import { compileContextPacket } from '../src/lib/contextPacket.js';

const query = process.argv.slice(2).join(' ').trim();
if (query === '') {
  console.error('usage: pnpm memory:packet "<call phrase, alias, or query>"');
  process.exit(1);
}

const packet = await compileContextPacket(query);
console.log(JSON.stringify(packet, null, 2));
