import type { McsRuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  resolveMichaelRuntimeTurnResponseFromFixture,
  runMichaelRuntimeAdapterContract,
  runRuntimeTurnFixtureScenario,
  validateMichaelResponseContract,
} from '../index.js';
import type {
  MichaelResponseContractV1,
  MichaelResponseType,
  MichaelRuntimeAdapterContractResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

// ---------------------------------------------------------------------------
// Local adapter-run helper — copied from michaelRuntimeAdapterContract.test.ts
// so this file owns all of its tests without editing existing test files.
// ---------------------------------------------------------------------------
type ContractInputOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly taskType?: McsRuntimeTaskType;
};

async function runContract(
  overrides: ContractInputOverrides = {},
): Promise<MichaelRuntimeAdapterContractResult> {
  const taskType = overrides.taskType ?? 'training_support';
  const runtimeTurn: RuntimeTurnFixtureHarnessResult =
    await runRuntimeTurnFixtureScenario({
      scenario: overrides.scenario ?? 'accepted_complete',
      agentKey: 'michael_magnificent',
      taskType,
    });
  const identity = runtimeTurn.input.identity;
  const turnId = runtimeTurn.input.turnId;

  expect(identity).toBeDefined();
  expect(turnId).toBeDefined();

  return runMichaelRuntimeAdapterContract({
    identity: identity!,
    turnId: turnId!,
    taskType,
    runtimeTurn,
  });
}

function issueCodes(response: MichaelResponseContractV1 | unknown): readonly string[] {
  return validateMichaelResponseContract(response).issues.map((entry) => entry.code);
}

describe('S3.3 failed -> safe_close contract strictness', () => {
  // 1. failed + safe_fallback is REJECTED.
  it('rejects a failed Context Packet paired with safe_fallback', () => {
    const candidate = structuredClone(
      michaelResponseFixtureSafeCloseFailedContextPacket,
    ) as MichaelResponseContractV1;
    candidate.responseType = 'safe_fallback' as MichaelResponseType;
    expect(candidate.contextPacketStatus).toBe('failed');

    const validation = validateMichaelResponseContract(candidate);
    expect(validation.ok).toBe(false);
    expect(issueCodes(candidate)).toContain('failed_context_requires_safe_close');
  });

  // 2. failed + safe_close is ACCEPTED (EN + ES).
  it('accepts failed Context Packets paired with safe_close (EN + ES)', () => {
    for (const fixture of [
      michaelResponseFixtureSafeCloseFailedContextPacket,
      michaelResponseFixtureSafeCloseFailedContextPacketEs,
    ]) {
      expect(fixture.contextPacketStatus).toBe('failed');
      expect(fixture.responseType).toBe('safe_close');
      expect(validateMichaelResponseContract(fixture).ok).toBe(true);
    }
  });

  // 3. Existing failed safe-close fixtures still validate (EN + ES).
  it('keeps the existing failed safe-close fixtures valid (EN + ES)', () => {
    expect(
      validateMichaelResponseContract(michaelResponseFixtureSafeCloseFailedContextPacket).ok,
    ).toBe(true);
    expect(
      validateMichaelResponseContract(michaelResponseFixtureSafeCloseFailedContextPacketEs).ok,
    ).toBe(true);
  });

  // 4. Existing rejected safe-close fixtures still validate; rejected+safe_fallback rejected.
  it('keeps rejected safe-close valid (EN + ES) and rejects rejected + safe_fallback', () => {
    for (const fixture of [
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
    ]) {
      expect(fixture.contextPacketStatus).toBe('rejected');
      expect(fixture.responseType).toBe('safe_close');
      expect(validateMichaelResponseContract(fixture).ok).toBe(true);
    }

    const candidate = structuredClone(
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
    ) as MichaelResponseContractV1;
    candidate.responseType = 'safe_fallback' as MichaelResponseType;
    expect(candidate.contextPacketStatus).toBe('rejected');

    const validation = validateMichaelResponseContract(candidate);
    expect(validation.ok).toBe(false);
    expect(issueCodes(candidate)).toContain('rejected_context_requires_safe_close');
  });

  // 5. Existing missing safe-fallback fixtures still validate.
  it('keeps the missing safe-fallback fixtures valid (EN + ES)', () => {
    for (const fixture of [
      michaelResponseFixtureSafeFallbackMissingContextPacket,
      michaelResponseFixtureSafeFallbackMissingContextPacketEs,
    ]) {
      expect(fixture.contextPacketStatus).toBe('missing');
      expect(fixture.responseType).toBe('safe_fallback');
      expect(validateMichaelResponseContract(fixture).ok).toBe(true);
    }
  });

  // 6. Existing degraded safe-fallback fixtures still validate.
  it('keeps the degraded safe-fallback fixtures valid (EN + ES)', () => {
    for (const fixture of [
      michaelResponseFixtureSafeFallbackDegradedContextPacket,
      michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
    ]) {
      expect(fixture.contextPacketStatus).toBe('degraded');
      expect(fixture.responseType).toBe('safe_fallback');
      expect(validateMichaelResponseContract(fixture).ok).toBe(true);
    }
  });

  // 7. All 12 catalog entries still validate.
  it('keeps every catalog entry valid', () => {
    expect(MICHAEL_RESPONSE_CATALOG).toHaveLength(12);
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(validateMichaelResponseContract(entry.response).ok).toBe(true);
    }
  });

  // 8. Adapter failed path still emits safe_close.
  it('still emits safe_close from the adapter failed-context path', async () => {
    const result = await runContract({ scenario: 'failed_context' });
    expect(result.michaelResponse.responseType).toBe('safe_close');
    expect(result.michaelResponse.contextPacketStatus).toBe('failed');
    expect(validateMichaelResponseContract(result.michaelResponse).ok).toBe(true);
  });

  // 9. Facade failed path still resolves safe_close.
  it('still resolves safe_close from the facade failed-context path', async () => {
    const runtimeTurn = await runRuntimeTurnFixtureScenario({
      scenario: 'failed_context',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    const resolved = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.response.responseType).toBe('safe_close');
    expect(resolved.response.contextPacketStatus).toBe('failed');
    expect(validateMichaelResponseContract(resolved.response).ok).toBe(true);
  });

  // 10. No route/persistence/LLM/dynamic generation introduced.
  it('keeps the resolved failed-context response inert (no persistence, no generation)', async () => {
    const runtimeTurn = await runRuntimeTurnFixtureScenario({
      scenario: 'failed_context',
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
    });

    const resolved = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;

    expect(resolved.response.persistence).toBe('disabled');
    expect(resolved.response.agentResponseGenerated).toBe(false);
    expect(resolved.trace.persistence).toBe('disabled');
    expect(resolved.trace.agentResponseGenerated).toBe(false);
  });
});
