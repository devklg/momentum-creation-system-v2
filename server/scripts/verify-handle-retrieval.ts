/**
 * ACR-0013 §5 — standalone handle verification (same manifest the vitest
 * regression suite runs):
 *
 *   pnpm memory:verify
 *
 * Invokes every call phrase / alias, asserts top hit + visible separation,
 * prints the measured distances. Exit 1 on ANY broken handle — a handle
 * that does not retrieve is a broken handle.
 */

import { INVOCATION_HANDLE_CHECKS, SEMANTIC_HANDLE_CHECKS } from '../src/lib/handleManifest.js';
import { testHandleRetrieval } from '../src/lib/memoryContextIndex.js';
import { compileContextPacket } from '../src/lib/contextPacket.js';
import { DEFAULT_GATEWAY_URL } from '../src/lib/gatewayClient.js';

let failures = 0;

console.log('== semantic: top hit + visible separation ==');
for (const check of SEMANTIC_HANDLE_CHECKS) {
  try {
    const r = await testHandleRetrieval(check.expectedTopId, check.phrase, DEFAULT_GATEWAY_URL, check.connector, check.collection);
    const sepOk = r.separation == null || r.separation >= check.minSeparation;
    if (!sepOk) failures += 1;
    console.log(
      `${sepOk ? 'PASS' : 'FAIL'}  '${check.phrase}' @ ${check.connector}/${check.collection} → ${r.topHitId} ` +
        `distance ${r.distance.toFixed(4)}${r.runnerUpDistance != null ? ` · runner-up ${r.runnerUpDistance.toFixed(4)} · separation ${(r.separation ?? 0).toFixed(4)} (floor ${check.minSeparation})` : ''}`,
    );
  } catch (error) {
    failures += 1;
    console.log(`FAIL  '${check.phrase}' @ ${check.connector}/${check.collection}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

console.log('\n== invocation: rung-1 deterministic lookup ==');
for (const check of INVOCATION_HANDLE_CHECKS) {
  try {
    const packet = await compileContextPacket(check.phrase);
    const ok = packet.ladderRung === 'invocation' && packet.invokedHandle?.recordId === check.expectedRecordId;
    if (!ok) failures += 1;
    console.log(
      `${ok ? 'PASS' : 'FAIL'}  '${check.phrase}' → rung ${packet.ladderRung}, record ${packet.invokedHandle?.recordId ?? '(none)'} (expected ${check.expectedRecordId})`,
    );
  } catch (error) {
    failures += 1;
    console.log(`FAIL  '${check.phrase}': ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures > 0) {
  console.error(`\n${failures} broken handle check(s). A failing handle is a build failure, not a warning (ACR-0013 §5).`);
  process.exit(1);
}
console.log('\nAll handles retrieve.');
