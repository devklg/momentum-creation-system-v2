import { describe, expect, it } from 'vitest';
import {
  invalidMichaelResponseFixtures,
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureClarificationQuestionEs,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureNextTrainingStepEs,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  michaelResponseInvalidFixtureWithForbiddenAutomaticActionField,
  michaelResponseInvalidFixtureWithForbiddenProspectFacingField,
  michaelResponseInvalidFixtureWithForbiddenScoringField,
  michaelResponseInvalidFixtureWithPersistenceNotDisabled,
  michaelResponseInvalidFixtureWithWrongAgentKey,
  michaelResponseInvalidFixtureWithWrongTaskType,
  validateMichaelResponseContract,
  validMichaelResponseFixtures,
  type MichaelResponseContractValidationIssue,
  type MichaelResponseContractValidationResult,
} from '../index.js';

function expectIssue(
  result: MichaelResponseContractValidationResult,
  path: string,
  code: MichaelResponseContractValidationIssue['code'],
): void {
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({ path, code })]));
}

describe('S2.12 Michael response fixtures', () => {
  it('exports the eight valid response envelopes requested by S2.12', () => {
    expect(validMichaelResponseFixtures).toEqual([
      michaelResponseFixtureNextTrainingStepEn,
      michaelResponseFixtureNextTrainingStepEs,
      michaelResponseFixtureClarificationQuestionEn,
      michaelResponseFixtureClarificationQuestionEs,
      michaelResponseFixtureSafeFallbackDegradedContextPacket,
      michaelResponseFixtureSafeFallbackMissingContextPacket,
      michaelResponseFixtureSafeCloseFailedContextPacket,
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
    ]);
    expect(validMichaelResponseFixtures).toHaveLength(8);
  });

  it('keeps all valid fixtures inside the Michael training-support response contract', () => {
    for (const fixture of validMichaelResponseFixtures) {
      expect(validateMichaelResponseContract(fixture)).toEqual({
        ok: true,
        contract: fixture,
        issues: [],
      });
      expect(fixture.agentResponseGenerated).toBe(false);
      expect(fixture.persistence).toBe('disabled');
      expect(fixture.agentKey).toBe('michael_magnificent');
      expect(fixture.taskType).toBe('training_support');
    }
  });

  it('covers English and Spanish next-step and clarification fixtures', () => {
    expect(michaelResponseFixtureNextTrainingStepEn).toMatchObject({
      responseType: 'next_training_step',
      language: 'en',
      nextStep: {
        baOwned: true,
        automaticSending: false,
        automaticCalling: false,
        externalSideEffect: false,
      },
    });
    expect(michaelResponseFixtureNextTrainingStepEs).toMatchObject({
      responseType: 'next_training_step',
      language: 'es',
    });
    expect(michaelResponseFixtureClarificationQuestionEn).toMatchObject({
      responseType: 'clarification_question',
      language: 'en',
    });
    expect(michaelResponseFixtureClarificationQuestionEs).toMatchObject({
      responseType: 'clarification_question',
      language: 'es',
    });
  });

  it('covers safe fallback and safe close Context Packet boundaries', () => {
    expect(michaelResponseFixtureSafeFallbackDegradedContextPacket).toMatchObject({
      responseType: 'safe_fallback',
      contextPacketStatus: 'degraded',
      safety: { validationStatus: 'degraded' },
    });
    expect(michaelResponseFixtureSafeFallbackMissingContextPacket).toMatchObject({
      responseType: 'safe_fallback',
      contextPacketStatus: 'missing',
      safety: { validationStatus: 'degraded' },
    });
    expect(michaelResponseFixtureSafeCloseFailedContextPacket).toMatchObject({
      responseType: 'safe_close',
      contextPacketStatus: 'failed',
      safety: { validationStatus: 'blocked' },
    });
    expect(michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection).toMatchObject({
      responseType: 'safe_close',
      contextPacketStatus: 'rejected',
      safety: {
        validationStatus: 'blocked',
        blockedReasonCodes: ['candidate_review_only_context_rejected'],
      },
    });
  });

  it('exports the six invalid fixtures requested by S2.12', () => {
    expect(invalidMichaelResponseFixtures).toEqual([
      michaelResponseInvalidFixtureWithForbiddenScoringField,
      michaelResponseInvalidFixtureWithForbiddenProspectFacingField,
      michaelResponseInvalidFixtureWithForbiddenAutomaticActionField,
      michaelResponseInvalidFixtureWithWrongTaskType,
      michaelResponseInvalidFixtureWithWrongAgentKey,
      michaelResponseInvalidFixtureWithPersistenceNotDisabled,
    ]);
    expect(invalidMichaelResponseFixtures).toHaveLength(6);
  });

  it('rejects the invalid fixture with a forbidden scoring field', () => {
    expectIssue(
      validateMichaelResponseContract(michaelResponseInvalidFixtureWithForbiddenScoringField),
      'score',
      'forbidden_field',
    );
  });

  it('rejects the invalid fixture with a forbidden prospect-facing field', () => {
    expectIssue(
      validateMichaelResponseContract(
        michaelResponseInvalidFixtureWithForbiddenProspectFacingField,
      ),
      'prospectFacingMessage',
      'forbidden_field',
    );
  });

  it('rejects the invalid fixture with a forbidden automatic action field', () => {
    expectIssue(
      validateMichaelResponseContract(
        michaelResponseInvalidFixtureWithForbiddenAutomaticActionField,
      ),
      'autoSend',
      'forbidden_field',
    );
  });

  it('rejects the invalid fixture with the wrong task type', () => {
    expectIssue(
      validateMichaelResponseContract(michaelResponseInvalidFixtureWithWrongTaskType),
      'taskType',
      'invalid_literal',
    );
  });

  it('rejects the invalid fixture with the wrong agent key', () => {
    expectIssue(
      validateMichaelResponseContract(michaelResponseInvalidFixtureWithWrongAgentKey),
      'agentKey',
      'invalid_literal',
    );
  });

  it('rejects the invalid fixture with persistence not disabled', () => {
    expectIssue(
      validateMichaelResponseContract(michaelResponseInvalidFixtureWithPersistenceNotDisabled),
      'persistence',
      'invalid_literal',
    );
  });
});
