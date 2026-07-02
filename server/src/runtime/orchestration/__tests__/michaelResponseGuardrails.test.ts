import { describe, expect, it } from 'vitest';
import {
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseFailedContextPacket,
} from '../fixtures/index.js';
import { validateMichaelResponseContract } from '../index.js';

function expectForbidden(field: string, value: unknown): void {
  const result = validateMichaelResponseContract({
    ...michaelResponseFixtureClarificationQuestionEn,
    [field]: value,
  });
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.issues.map((issue) => issue.code)).toContain('forbidden_field');
  }
}

function expectInvalidCode(response: unknown, code: string): void {
  const result = validateMichaelResponseContract(response);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.issues.map((issue) => issue.code)).toContain(code);
  }
}

describe('S2.12 Michael response guardrails', () => {
  it('rejects forbidden scoring, ranking, and qualification fields', () => {
    for (const field of ['score', 'rank', 'qualification', 'classification']) {
      expectForbidden(field, 'blocked');
    }
  });

  it('rejects forbidden income, placement, and cycle-math fields', () => {
    for (const field of [
      'incomeProjection',
      'commissionEstimate',
      'cycleMath',
      'placementPromise',
    ]) {
      expectForbidden(field, 'blocked');
    }
  });

  it('rejects forbidden prospect-facing fields', () => {
    for (const field of ['prospectFacingMessage', 'prospectingList', 'leadQualification']) {
      expectForbidden(field, 'blocked');
    }
  });

  it('rejects forbidden automatic send, call, schedule, and prospecting fields', () => {
    for (const field of [
      'sendMessage',
      'callProspect',
      'scheduleCall',
      'autoSend',
      'autoCall',
      'automaticProspecting',
    ]) {
      expectForbidden(field, true);
    }
  });

  it('rejects forbidden knowledge approval and raw access fields', () => {
    for (const field of [
      'knowledgeApproval',
      'persistenceInstruction',
      'rawStoreResults',
      'rawGraphRagResults',
      'rawPERSISTENCEFallbackResponse',
    ]) {
      expectForbidden(field, true);
    }
  });

  it('candidate/review-only rejection must not allow substantive training guidance', () => {
    expect(
      validateMichaelResponseContract(michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection)
        .ok,
    ).toBe(true);
    expectInvalidCode(
      {
        ...michaelResponseFixtureNextTrainingStepEn,
        contextPacketId: undefined,
        contextPacketStatus: 'rejected',
      },
      'substantive_response_not_allowed',
    );
  });

  it('failed Context Packet must return safe close or safe fallback only', () => {
    expect(validateMichaelResponseContract(michaelResponseFixtureSafeCloseFailedContextPacket).ok).toBe(
      true,
    );
    expectInvalidCode(
      {
        ...michaelResponseFixtureClarificationQuestionEn,
        contextPacketStatus: 'failed',
      },
      'substantive_response_not_allowed',
    );
  });
});
