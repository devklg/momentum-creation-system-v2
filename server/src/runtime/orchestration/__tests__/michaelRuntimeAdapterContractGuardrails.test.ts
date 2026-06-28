import { describe, expect, it } from 'vitest';
import {
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  runMichaelRuntimeResponseFixtureScenario,
} from '../fixtures/index.js';
import {
  MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS,
  validateMichaelResponseContract,
} from '../michaelResponseContract.js';

const aliasForbiddenFields = [
  'earningsProjection',
  'compensationProjection',
  'cvCalculation',
  'placementGuarantee',
  'prospectQualification',
  'callControl',
] as const;

const prohibitedTextCases = [
  {
    label: 'income claim',
    text: 'You are guaranteed to make $5,000 this month when your first two join.',
  },
  {
    label: 'placement promise',
    text: 'Your queue position guarantees placement under the strongest leg.',
  },
  {
    label: 'cycle math promise',
    text: '300 CV plus 600 CV guarantees a weekly cycle and check.',
  },
  {
    label: 'medical advice',
    text: 'Stop taking your medication and use GLP-THREE instead.',
  },
  {
    label: 'THREE authority claim',
    text: 'THREE has approved your enrollment and placement decision.',
  },
  {
    label: 'prospect-facing instruction',
    text: 'Tell the prospect they are qualified and send this exact page now.',
  },
  {
    label: 'automatic action language',
    text: 'I will automatically send texts, call prospects, and schedule follow-ups.',
  },
] as const;

const automaticActionLanguage =
  /\b(?:automatically|auto(?:matic)?[- ]?send|auto(?:matic)?[- ]?call|send texts?|call prospects?|schedule follow-ups?|prospecting automation)\b/i;

const substantiveTrainingGuidance =
  /\b(?:open|review|practice|complete|start|continue)\s+(?:module|lesson|training|script|next step)\b/i;

function issueCodes(response: unknown): string[] {
  const result = validateMichaelResponseContract(response);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function issuePaths(response: unknown): string[] {
  const result = validateMichaelResponseContract(response);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.issues.map((issue) => issue.path);
}

function expectRejectedAtPath(response: unknown, path: string): void {
  const paths = issuePaths(response);
  expect(paths).toContain(path);
}

describe('S2.15 Michael response contract guardrail expansion', () => {
  it('rejects every MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS value at the top level', () => {
    for (const field of MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS) {
      const codes = issueCodes({
        ...michaelResponseFixtureClarificationQuestionEn,
        [field]: 'blocked',
      });

      expect(codes).toContain('forbidden_field');
    }
  });

  it('rejects every MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS value nested in allowed objects', () => {
    for (const field of MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS) {
      expectRejectedAtPath(
        {
          ...michaelResponseFixtureNextTrainingStepEn,
          nextStep: {
            ...michaelResponseFixtureNextTrainingStepEn.nextStep,
            [field]: 'blocked',
          },
        },
        `nextStep.${field}`,
      );
    }
  });

  it('explicitly rejects readinessClassification, medicalAdvice, and threeAuthorityDecision', () => {
    for (const field of [
      'readinessClassification',
      'medicalAdvice',
      'threeAuthorityDecision',
    ] as const) {
      const topLevelCodes = issueCodes({
        ...michaelResponseFixtureClarificationQuestionEn,
        [field]: 'blocked',
      });
      const nestedPaths = issuePaths({
        ...michaelResponseFixtureNextTrainingStepEn,
        nextStep: {
          ...michaelResponseFixtureNextTrainingStepEn.nextStep,
          [field]: 'blocked',
        },
      });

      expect(topLevelCodes).toContain('forbidden_field');
      expect(nestedPaths).toContain(`nextStep.${field}`);
    }
  });

  it('rejects alias and synonym fields for money, volume, placement, qualification, and call control', () => {
    for (const field of aliasForbiddenFields) {
      expect(issueCodes({
        ...michaelResponseFixtureClarificationQuestionEn,
        [field]: 'blocked',
      })).toContain('unexpected_field');

      expectRejectedAtPath(
        {
          ...michaelResponseFixtureNextTrainingStepEn,
          nextStep: {
            ...michaelResponseFixtureNextTrainingStepEn.nextStep,
            [field]: 'blocked',
          },
        },
        `nextStep.${field}`,
      );
    }
  });

  it('scans allowed response text for prohibited claims and actions', () => {
    for (const testCase of prohibitedTextCases) {
      expectRejectedAtPath(
        {
          ...michaelResponseFixtureClarificationQuestionEn,
          text: testCase.text,
        },
        'text',
      );
    }
  });

  it('scans nextStep.label and nextStep.instruction for prohibited claims and actions', () => {
    expectRejectedAtPath(
      {
        ...michaelResponseFixtureNextTrainingStepEn,
        nextStep: {
          ...michaelResponseFixtureNextTrainingStepEn.nextStep,
          label: 'Guarantee $500 this week',
        },
      },
      'nextStep.label',
    );

    expectRejectedAtPath(
      {
        ...michaelResponseFixtureNextTrainingStepEn,
        nextStep: {
          ...michaelResponseFixtureNextTrainingStepEn.nextStep,
          instruction: 'Automatically call prospects and promise their placement.',
        },
      },
      'nextStep.instruction',
    );
  });

  it('keeps safe-close responses from carrying nextStep', () => {
    expect(issueCodes({
      ...michaelResponseFixtureSafeCloseFailedContextPacket,
      nextStep: michaelResponseFixtureNextTrainingStepEn.nextStep,
    })).toContain('next_step_not_allowed');
  });

  it('keeps safe-fallback responses from carrying automatic action language', () => {
    expectRejectedAtPath(
      {
        ...michaelResponseFixtureSafeFallbackMissingContextPacket,
        text: 'I will automatically send the prospect a message and schedule the call.',
      },
      'text',
    );
  });

  it('keeps candidate/review-only rejection from returning substantive training guidance', () => {
    expectRejectedAtPath(
      {
        ...michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
        text: 'Open Module 2 and practice the training script before your next call.',
      },
      'text',
    );
  });
});

describe('S2.15 Michael runtime adapter contract guardrails', () => {
  it('returns no nextStep for every safe-close runtime scenario', async () => {
    for (const scenarioName of [
      'failed_context_packet',
      'rejected_context_packet',
      'invalid_objective',
      'unknown_agent',
      'candidate_review_only_rejected',
      'unsupported_language',
      'wrong_task_type',
      'non_michael_agent',
    ] as const) {
      const result = await runMichaelRuntimeResponseFixtureScenario({ scenarioName });

      expect(result.michaelResponse.responseType).toBe('safe_close');
      expect(result.michaelResponse.nextStep).toBeUndefined();
      expect(result.validation.ok).toBe(true);
    }
  });

  it('returns no automatic action language for every safe-fallback runtime scenario', async () => {
    for (const scenarioName of [
      'degraded_context_packet',
      'missing_context_manager_boundary',
    ] as const) {
      const result = await runMichaelRuntimeResponseFixtureScenario({ scenarioName });

      expect(result.michaelResponse.responseType).toBe('safe_fallback');
      expect(result.michaelResponse.text).not.toMatch(automaticActionLanguage);
      expect(result.validation.ok).toBe(true);
    }
  });

  it('returns no substantive training guidance for candidate/review-only runtime rejection', async () => {
    const result = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'candidate_review_only_rejected',
    });

    expect(result.michaelResponse.responseType).toBe('safe_close');
    expect(result.michaelResponse.contextPacketStatus).toBe('rejected');
    expect(result.michaelResponse.nextStep).toBeUndefined();
    expect(result.michaelResponse.text).not.toMatch(substantiveTrainingGuidance);
    expect(result.validation.ok).toBe(true);
  });
});
