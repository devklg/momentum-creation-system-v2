import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_TYPES,
  validateMichaelResponseContract,
  type MichaelResponseContractValidationResult,
} from '../index.js';
import {
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureClarificationQuestionEs,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureNextTrainingStepEs,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
} from '../fixtures/index.js';

function expectValid(response: unknown): void {
  const result = validateMichaelResponseContract(response);
  expect(result.ok, result.ok ? '' : result.issues.map((issue) => issue.code).join(', ')).toBe(
    true,
  );
}

function expectInvalidCode(response: unknown, code: string): void {
  const result: MichaelResponseContractValidationResult =
    validateMichaelResponseContract(response);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.issues.map((issue) => issue.code)).toContain(code);
  }
}

function cloneWith(response: unknown, overrides: Record<string, unknown>): unknown {
  return {
    ...(response as Record<string, unknown>),
    ...overrides,
  };
}

describe('S2.12 Michael response contract validator', () => {
  it('declares exactly the four allowed response types', () => {
    expect(MICHAEL_RESPONSE_TYPES).toEqual([
      'next_training_step',
      'clarification_question',
      'safe_fallback',
      'safe_close',
    ]);
  });

  it('valid next_training_step EN passes', () => {
    expectValid(michaelResponseFixtureNextTrainingStepEn);
  });

  it('valid next_training_step ES passes', () => {
    expectValid(michaelResponseFixtureNextTrainingStepEs);
  });

  it('valid clarification_question EN passes', () => {
    expectValid(michaelResponseFixtureClarificationQuestionEn);
  });

  it('valid clarification_question ES passes', () => {
    expectValid(michaelResponseFixtureClarificationQuestionEs);
  });

  it('valid safe_fallback for degraded Context Packet passes', () => {
    expectValid(michaelResponseFixtureSafeFallbackDegradedContextPacket);
  });

  it('valid safe_close for failed Context Packet passes', () => {
    expectValid(michaelResponseFixtureSafeCloseFailedContextPacket);
  });

  it('training_support is the only accepted task type', () => {
    expectInvalidCode(
      cloneWith(michaelResponseFixtureClarificationQuestionEn, {
        taskType: 'guided_action_review',
      }),
      'invalid_literal',
    );
  });

  it('non-Michael agent key is rejected', () => {
    expectInvalidCode(
      cloneWith(michaelResponseFixtureClarificationQuestionEn, {
        agentKey: 'steve_success',
      }),
      'invalid_literal',
    );
  });

  it('unsupported language is rejected', () => {
    expectInvalidCode(
      cloneWith(michaelResponseFixtureClarificationQuestionEn, {
        language: 'fr',
      }),
      'invalid_enum',
    );
  });

  it('missing required fields are rejected', () => {
    const candidate = {
      ...(michaelResponseFixtureClarificationQuestionEn as unknown as Record<string, unknown>),
    };
    delete candidate.sessionId;

    expectInvalidCode(candidate, 'missing_required_field');
  });

  it('persistence must be disabled', () => {
    expectInvalidCode(
      cloneWith(michaelResponseFixtureClarificationQuestionEn, {
        persistence: 'enabled',
      }),
      'invalid_literal',
    );
  });

  it('agentResponseGenerated must remain false', () => {
    expectInvalidCode(
      cloneWith(michaelResponseFixtureClarificationQuestionEn, {
        agentResponseGenerated: true,
      }),
      'invalid_literal',
    );
  });

  it('nextStep must be BA-owned with no external side effects', () => {
    expectInvalidCode(
      cloneWith(michaelResponseFixtureNextTrainingStepEn, {
        nextStep: {
          label: 'Send an automatic message',
          baOwned: false,
          automaticSending: true,
          automaticCalling: false,
          externalSideEffect: true,
        },
      }),
      'invalid_literal',
    );
  });

  it('nextStep is required for next_training_step and forbidden otherwise', () => {
    const missingNextStep = {
      ...(michaelResponseFixtureNextTrainingStepEn as unknown as Record<string, unknown>),
    };
    delete missingNextStep.nextStep;

    expectInvalidCode(
      missingNextStep,
      'next_step_required',
    );
    expectInvalidCode(
      cloneWith(michaelResponseFixtureClarificationQuestionEn, {
        nextStep: {
          label: 'Unexpected',
          baOwned: true,
          automaticSending: false,
          automaticCalling: false,
          externalSideEffect: false,
        },
      }),
      'next_step_not_allowed',
    );
  });
});
