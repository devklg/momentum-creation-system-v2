/**
 * ACR-0013 §5 — retrieval regression. LIVE test against the Universal
 * Gateway: invokes every call phrase / alias in the handle manifest and
 * asserts (a) the canonical record is the TOP hit and (b) visible distance
 * separation from the runner-up. A failing handle is a BUILD FAILURE, not a
 * warning — Kevin will say these words and trust what comes back.
 *
 * Escape hatch (offline dev machines only): RETRIEVAL_REGRESSION=skip.
 * CI and Kevin's machine run it live. If the gateway is unreachable the
 * suite FAILS — an unreachable store is not evidence that handles work
 * (absence discipline, ACR-0013 §4.6).
 */

import { describe, expect, it } from 'vitest';
import { INVOCATION_HANDLE_CHECKS, SEMANTIC_HANDLE_CHECKS } from '../handleManifest.js';
import { testHandleRetrieval } from '../memoryContextIndex.js';
import { compileContextPacket } from '../contextPacket.js';
import { DEFAULT_GATEWAY_URL } from '../gatewayClient.js';

const skip = process.env.RETRIEVAL_REGRESSION === 'skip';

describe.skipIf(skip)('retrieval regression — a handle that does not retrieve is a broken handle', () => {
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

  describe('invocation: rung-1 deterministic lookup', () => {
    for (const check of INVOCATION_HANDLE_CHECKS) {
      it(`'${check.phrase}' invokes ${check.expectedRecordId}`, async () => {
        const packet = await compileContextPacket(check.phrase);
        expect(packet.ladderRung).toBe('invocation');
        expect(packet.invokedHandle?.recordId).toBe(check.expectedRecordId);
      }, 30_000);
    }
  });
});
