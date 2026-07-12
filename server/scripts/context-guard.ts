/**
 * ACR-0014 §3.1 — CLI for the guard. Run BEFORE proposing new work:
 *
 *   pnpm memory:guard "anchors for learning notes"
 *
 * Searches every store in ACR-0013 §3 and prints hits with provenance
 * (store, record, date, who stated it) plus any useWhen /
 * nextAgentInstruction. Exit code 0 = report produced (hits or verified
 * absence); exit 2 = stores unreachable (absence NOT verified).
 */

import { checkExisting, renderGuardReport } from '../src/lib/contextGuard.js';

const topic = process.argv.slice(2).join(' ').trim();
if (topic === '') {
  console.error('usage: pnpm memory:guard "<topic you are about to work on>"');
  process.exit(1);
}

const report = await checkExisting(topic);
console.log(renderGuardReport(report));
if (report.storesUnreachable.length > 0) process.exit(2);
