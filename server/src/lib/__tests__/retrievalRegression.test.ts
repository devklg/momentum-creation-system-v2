/**
 * ACR-0013 §5 — retrieval regression. LIVE test against the Universal
 * Gateway: invokes every call phrase / alias in the handle manifest and
 * asserts (a) the canonical record is the TOP hit and (b) visible distance
 * separation from the runner-up. A failing handle is a BUILD FAILURE on the
 * machine that owns the library — Kevin will say these words and trust what
 * comes back.
 *
 * LOCAL ONLY, BY DESIGN (Kevin's ruling, chat 2026-07-11): the main library
 * lives on Kevin's machine and GitHub runners must NEVER reach it, so a live
 * retrieval test can never be a CI gate. This suite runs only when
 * RETRIEVAL_REGRESSION=live is set explicitly — otherwise it is SKIPPED with
 * a loud, visible message (never a silent pass, never a false failure).
 *
 * The deterministic CI gate for the same manifest is handleManifest.test.ts
 * (rung-1 invocation + audience boundary, no network). To run this suite
 * against the live library: `pnpm memory:verify` (script form), or
 * `RETRIEVAL_REGRESSION=live pnpm --filter @momentum/server test`.
 */

import { describe, expect, it } from 'vitest';
import { INVOCATION_HANDLE_CHECKS, SEMANTIC_HANDLE_CHECKS } from '../handleManifest.js';
import { testHandleRetrieval } from '../memoryContextIndex.js';
import { compileContextPacket } from '../contextPacket.js';
import { DEFAULT_GATEWAY_URL } from '../gatewayClient.js';

const live = process.env.RETRIEVAL_REGRESSION === 'live';

if (!live) {
  // Loud, visible skip — a skipped live suite must never look like a pass.
  console.warn(
    '\n[retrievalRegression] SKIPPED: live retrieval regression not run — the main library is LOCAL BY DESIGN ' +
      'and is not reachable from CI. Run `pnpm memory:verify` (or RETRIEVAL_REGRESSION=live) on the machine that ' +
      'owns the library. The deterministic CI gate is handleManifest.test.ts.\n',
  );
}

describe.skipIf(!live)('retrieval regression (LIVE, local library only) — a handle that does not retrieve is a broken handle', () => {
  describe('semantic: top hit + visible separation', () => {
    for (const check of SEMANTIC_HANDLE_CHECKS) {
      it(`'${check.phrase}' → ${check.expectedTopId} on ${check.connector}/${check.collection}`, async () => {
        const result = await testHandleRetrieval(
          check.expectedTopId,
          check.phrase,
          DEFAULT_GATEWAY_URL,
          check.connector,
          check.collection,
        );
        expect(result.topHitId).toBe(check.expectedTopId);
        if (result.separation != null) {
          expect(result.separation).toBeGreaterThanOrEqual(check.minSeparation);
        }
      }, 30_000);
    }
  });

  describe('invocation: rung-1 deterministic lookup against the live stores', () => {
    for (const check of INVOCATION_HANDLE_CHECKS) {
      it(`'${check.phrase}' invokes ${check.expectedRecordId}`, async () => {
        const packet = await compileContextPacket(check.phrase);
        expect(packet.ladderRung).toBe('invocation');
        expect(packet.invokedHandle?.recordId).toBe(check.expectedRecordId);
      }, 30_000);
    }
  });
});
