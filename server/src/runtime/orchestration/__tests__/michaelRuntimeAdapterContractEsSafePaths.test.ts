import type { McsRuntimeTaskType } from '@momentum/shared/runtime';
import { describe, expect, it } from 'vitest';
import { runMichaelRuntimeAdapterContract } from '../michaelRuntimeAdapterContract.js';
import {
  MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS,
  validateMichaelResponseContract,
} from '../michaelResponseContract.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import type {
  MichaelResponseContractV1,
  MichaelResponseType,
  MichaelRuntimeAdapterContractResult,
  RuntimeTurnFixtureHarnessResult,
  RuntimeTurnFixtureScenarioType,
} from '../types.js';

const allowedLimitedResponseTypes = [
  'safe_fallback',
  'safe_close',
] as const satisfies readonly MichaelResponseType[];

// Mirror of the production SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN guard
// (server/src/runtime/orchestration/michaelResponseContract.ts). Used only to
// independently re-assert that safe-path text never carries substantive
// training-step guidance — the contract validator already enforces this.
const SUBSTANTIVE_TRAINING_GUIDANCE_PATTERN =
  /\b(?:open|review|practice|complete|start|continue)\s+(?:module|lesson|training|script|next step)\b/i;

type ContractInputOverrides = {
  readonly scenario?: RuntimeTurnFixtureScenarioType;
  readonly agentKey?: unknown;
  readonly taskType?: McsRuntimeTaskType;
  readonly language?: unknown;
  readonly intent?: 'clear_training_support' | 'ambiguous_training_support';
  readonly mutateRuntimeTurn?: (
    runtimeTurn: RuntimeTurnFixtureHarnessResult,
  ) => RuntimeTurnFixtureHarnessResult;
};

// Local copy of the runContract helper pattern from
// michaelRuntimeAdapterContract.test.ts — intentionally duplicated rather than
// importing a private test helper from another spec file.
async function runContract(
  overrides: ContractInputOverrides = {},
): Promise<MichaelRuntimeAdapterContractResult> {
  const taskType = overrides.taskType ?? 'training_support';
  const runtimeTurn = await runRuntimeTurnFixtureScenario({
    scenario: overrides.scenario ?? 'accepted_complete',
    agentKey: overrides.agentKey ?? 'michael_magnificent',
    taskType,
  });
  const fixtureTurn = overrides.mutateRuntimeTurn
    ? overrides.mutateRuntimeTurn(runtimeTurn)
    : runtimeTurn;
  if (overrides.language !== undefined && fixtureTurn.input.identity) {
    fixtureTurn.input.identity.language = overrides.language as never;
  }
  const identity = fixtureTurn.input.identity;
  const turnId = fixtureTurn.input.turnId;

  expect(identity).toBeDefined();
  expect(turnId).toBeDefined();

  return runMichaelRuntimeAdapterContract({
    identity: identity!,
    turnId: turnId!,
    taskType,
    runtimeTurn: fixtureTurn,
    intent: overrides.intent,
    language: overrides.language,
  });
}

function expectValidated(response: MichaelResponseContractV1): void {
  const validation = validateMichaelResponseContract(response);
  expect(validation.ok).toBe(true);
}

function expectInert(result: MichaelRuntimeAdapterContractResult): void {
  expect(result.behavior).toBe('not_implemented');
  expect(result.agentResponseGenerated).toBe(false);
  expect(result.eventPersistence).toBe('disabled');
  expect(result.outcomePersistence).toBe('disabled');
  expect(result.guidedActionPersistence).toBe('disabled');
  expect(result.envelopePersistence).toBe('disabled');
  expect(result.responsePersistence).toBe('disabled');
  expect(result.michaelResponse.persistence).toBe('disabled');
  expect(result.michaelResponse.agentResponseGenerated).toBe(false);
}

function expectSpanishSafeClose(
  result: MichaelRuntimeAdapterContractResult,
): void {
  expect(result.michaelResponse.responseType).toBe('safe_close');
  expect(result.michaelResponse.language).toBe('es');
  expect(result.michaelResponse.contextPacketStatus).toBe('rejected');
  expect(result.michaelResponse.nextStep).toBeUndefined();
  expectValidated(result.michaelResponse);
  expectInert(result);
}

function withNonContextManagerAssembly(
  runtimeTurn: RuntimeTurnFixtureHarnessResult,
): RuntimeTurnFixtureHarnessResult {
  const result = runtimeTurn.result;
  if (
    'contextRequestResult' in result &&
    result.contextRequestResult.consumption.packet
  ) {
    result.contextRequestResult.consumption.packet.metadata = {
      ...result.contextRequestResult.consumption.packet.metadata,
      generatedBy: 'adapter',
    } as never;
  }
  return runtimeTurn;
}

// The set of Spanish (`es`) safe-path results exercised across the "every"
// invariants (#11-#16). Each entry drives a distinct safe path through the
// adapter with identity.language='es' + language:'es'.
async function collectSpanishSafePathResults(): Promise<
  ReadonlyArray<{
    readonly name: string;
    readonly result: MichaelRuntimeAdapterContractResult;
  }>
> {
  const [
    degraded,
    missing,
    failed,
    rejectedCandidate,
    wrongTask,
    wrongAgent,
    nonContextManager,
  ] = await Promise.all([
    runContract({ scenario: 'accepted_degraded', language: 'es' }),
    runContract({ scenario: 'missing_context_manager', language: 'es' }),
    runContract({ scenario: 'failed_context', language: 'es' }),
    runContract({ scenario: 'candidate_review_only_rejected', language: 'es' }),
    runContract({ taskType: 'success_interview', language: 'es' }),
    runContract({ agentKey: 'steve_success', scenario: 'accepted_complete', language: 'es' }),
    runContract({ mutateRuntimeTurn: withNonContextManagerAssembly, language: 'es' }),
  ]);

  return [
    { name: 'degraded', result: degraded },
    { name: 'missing', result: missing },
    { name: 'failed', result: failed },
    { name: 'rejected_candidate', result: rejectedCandidate },
    { name: 'wrong_task', result: wrongTask },
    { name: 'wrong_agent', result: wrongAgent },
    { name: 'non_context_manager', result: nonContextManager },
  ];
}

describe('S2.16 Michael runtime adapter contract — Spanish safe paths', () => {
  it('#1 degraded Context Packet returns validated Spanish safe_fallback', async () => {
    const result = await runContract({ scenario: 'accepted_degraded', language: 'es' });

    expect(result.michaelResponse.responseType).toBe('safe_fallback');
    expect(result.michaelResponse.language).toBe('es');
    expect(result.michaelResponse.contextPacketStatus).toBe('degraded');
    expect(result.michaelResponse.nextStep).toBeUndefined();
    expectValidated(result.michaelResponse);
    expectInert(result);
  });

  it('#2 missing Context Manager returns validated Spanish safe_fallback or safe_close', async () => {
    const result = await runContract({ scenario: 'missing_context_manager', language: 'es' });

    expect(allowedLimitedResponseTypes).toContain(result.michaelResponse.responseType);
    expect(result.michaelResponse.language).toBe('es');
    expect(result.michaelResponse.nextStep).toBeUndefined();
    expectValidated(result.michaelResponse);
    expectInert(result);
  });

  it('#3 failed Context Packet returns validated Spanish safe_close', async () => {
    const result = await runContract({ scenario: 'failed_context', language: 'es' });

    expect(result.michaelResponse.responseType).toBe('safe_close');
    expect(result.michaelResponse.language).toBe('es');
    expect(result.michaelResponse.contextPacketStatus).toBe('failed');
    expect(result.michaelResponse.nextStep).toBeUndefined();
    expectValidated(result.michaelResponse);
    expectInert(result);
  });

  it('#4 rejected / candidate-review-only returns validated Spanish safe_close', async () => {
    const result = await runContract({
      scenario: 'candidate_review_only_rejected',
      language: 'es',
    });

    expectSpanishSafeClose(result);
  });

  it('#5 candidate/review-only path surfaces the candidate_review_only issue code', async () => {
    const result = await runContract({
      scenario: 'candidate_review_only_rejected',
      language: 'es',
    });

    expectSpanishSafeClose(result);
    expect(result.issues.map((issue) => issue.code)).toContain('candidate_review_only');
  });

  it('#6 invalid objective / wrong task returns validated Spanish safe_close with wrong_task', async () => {
    const result = await runContract({ taskType: 'success_interview', language: 'es' });

    expectSpanishSafeClose(result);
    expect(result.issues.map((issue) => issue.code)).toContain('wrong_task');
  });

  it('#7 every non-training_support task returns Spanish safe_close with wrong_task', async () => {
    const wrongTaskTypes = [
      'relationship_coaching',
      'invitation_drafting',
      'journal_teaching',
    ] as const satisfies readonly McsRuntimeTaskType[];

    for (const taskType of wrongTaskTypes) {
      const result = await runContract({ taskType, language: 'es' });

      expectSpanishSafeClose(result);
      expect(result.issues.map((issue) => issue.code)).toContain('wrong_task');
    }
  });

  it('#8 wrong agent returns validated Spanish safe_close with wrong_agent', async () => {
    const result = await runContract({
      agentKey: 'steve_success',
      scenario: 'accepted_complete',
      language: 'es',
    });

    expectSpanishSafeClose(result);
    expect(result.issues.map((issue) => issue.code)).toContain('wrong_agent');
  });

  it('#9 non-Context-Manager assembly returns validated Spanish safe_close with non_context_manager', async () => {
    const result = await runContract({
      mutateRuntimeTurn: withNonContextManagerAssembly,
      language: 'es',
    });

    expectSpanishSafeClose(result);
    expect(result.issues.map((issue) => issue.code)).toContain('non_context_manager');
  });

  it('#10 unsupported language returns a validated safe_close with no substantive guidance', async () => {
    const result = await runContract({ language: 'fr' });

    expect(result.michaelResponse.responseType).toBe('safe_close');
    expect(result.michaelResponse.nextStep).toBeUndefined();
    expect(result.michaelResponse.language).not.toBe('es');
    expect(SUBSTANTIVE_TRAINING_GUIDANCE_PATTERN.test(result.michaelResponse.text)).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain('unsupported_language');
    expectValidated(result.michaelResponse);
    expectInert(result);
  });

  it('#11 every Spanish safe-path response validates with the contract validator', async () => {
    const results = await collectSpanishSafePathResults();

    for (const { name, result } of results) {
      const validation = validateMichaelResponseContract(result.michaelResponse);
      expect(validation.ok, `expected ${name} response to validate`).toBe(true);
    }
  });

  it('#12 every Spanish safe-path response preserves agentResponseGenerated === false', async () => {
    const results = await collectSpanishSafePathResults();

    for (const { name, result } of results) {
      expect(result.agentResponseGenerated, `${name} result.agentResponseGenerated`).toBe(false);
      expect(
        result.michaelResponse.agentResponseGenerated,
        `${name} michaelResponse.agentResponseGenerated`,
      ).toBe(false);
    }
  });

  it('#13 every Spanish safe-path response preserves persistence === disabled', async () => {
    const results = await collectSpanishSafePathResults();

    for (const { name, result } of results) {
      expect(result.eventPersistence, `${name} eventPersistence`).toBe('disabled');
      expect(result.outcomePersistence, `${name} outcomePersistence`).toBe('disabled');
      expect(result.guidedActionPersistence, `${name} guidedActionPersistence`).toBe('disabled');
      expect(result.envelopePersistence, `${name} envelopePersistence`).toBe('disabled');
      expect(result.responsePersistence, `${name} responsePersistence`).toBe('disabled');
      expect(result.michaelResponse.persistence, `${name} michaelResponse.persistence`).toBe(
        'disabled',
      );
    }
  });

  it('#14 no Spanish safe_close response includes nextStep', async () => {
    const results = await collectSpanishSafePathResults();

    for (const { name, result } of results) {
      if (result.michaelResponse.responseType !== 'safe_close') continue;
      expect(result.michaelResponse.nextStep, `${name} nextStep`).toBeUndefined();
    }
  });

  it('#15 no Spanish safe-path response includes forbidden fields', async () => {
    const results = await collectSpanishSafePathResults();

    for (const { name, result } of results) {
      const keys = Object.keys(result.michaelResponse as unknown as Record<string, unknown>);
      for (const forbidden of MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS) {
        expect(keys, `${name} michaelResponse keys must omit ${forbidden}`).not.toContain(
          forbidden,
        );
      }
    }
  });

  it('#16 no Spanish safe-path response text carries substantive training guidance on safe_close', async () => {
    const results = await collectSpanishSafePathResults();

    for (const { name, result } of results) {
      // The validator enforces this for safe_close; re-assert independently.
      const validation = validateMichaelResponseContract(result.michaelResponse);
      expect(validation.ok, `${name} response validates (no prohibited text)`).toBe(true);
      if (result.michaelResponse.responseType === 'safe_close') {
        expect(
          SUBSTANTIVE_TRAINING_GUIDANCE_PATTERN.test(result.michaelResponse.text),
          `${name} safe_close text must omit substantive training guidance`,
        ).toBe(false);
      }
    }
  });
});
