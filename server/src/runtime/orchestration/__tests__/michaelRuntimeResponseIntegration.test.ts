import { describe, expect, it } from 'vitest';
import {
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  runMichaelRuntimeResponseFixtureScenario,
  validateMichaelResponseContract,
} from '../index.js';

describe('S2.13 Michael runtime response fixture integration', () => {
  it('connects complete runtime turns to pre-authored next-step and clarification fixtures', async () => {
    const nextStep = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'complete_training_support',
    });
    const clarification = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'complete_ambiguous_training_support',
    });

    expect(nextStep.runtimeTurn.result.decision).toBe('proceed');
    expect(nextStep.michaelResponse).toBe(michaelResponseFixtureNextTrainingStepEn);
    expect(clarification.runtimeTurn.result.decision).toBe('proceed');
    expect(clarification.michaelResponse).toBe(
      michaelResponseFixtureClarificationQuestionEn,
    );
  });

  it('connects degraded, missing, failed, and rejected paths to safe fixtures', async () => {
    const degraded = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'degraded_context_packet',
    });
    const missing = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'missing_context_manager_boundary',
    });
    const failed = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'failed_context_packet',
    });
    const rejected = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'candidate_review_only_rejected',
    });

    expect(degraded.michaelResponse).toBe(
      michaelResponseFixtureSafeFallbackDegradedContextPacket,
    );
    expect(missing.michaelResponse).toBe(
      michaelResponseFixtureSafeFallbackMissingContextPacket,
    );
    expect(failed.michaelResponse).toBe(michaelResponseFixtureSafeCloseFailedContextPacket);
    expect(rejected.michaelResponse).toBe(
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
    );
  });

  it('keeps invalid, unknown, wrong-task, unsupported-language, and non-Michael paths safe-close only', async () => {
    const scenarioNames = [
      'invalid_objective',
      'unknown_agent',
      'wrong_task_type',
      'unsupported_language',
      'non_michael_agent',
    ] as const;

    for (const scenarioName of scenarioNames) {
      const result = await runMichaelRuntimeResponseFixtureScenario({ scenarioName });
      expect(result.michaelResponse).toBe(
        michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
      );
      expect(result.michaelResponse.responseType).toBe('safe_close');
      expect(result.michaelResponse.nextStep).toBeUndefined();
      expect(result.michaelResponse.agentKey).toBe('michael_magnificent');
      expect(result.michaelResponse.taskType).toBe('training_support');
    }
  });

  it('validates every returned response and preserves returned-only runtime state', async () => {
    const scenarioNames = [
      'complete_training_support',
      'complete_ambiguous_training_support',
      'degraded_context_packet',
      'missing_context_manager_boundary',
      'failed_context_packet',
      'rejected_context_packet',
      'invalid_objective',
      'unknown_agent',
      'candidate_review_only_rejected',
      'unsupported_language',
      'wrong_task_type',
      'non_michael_agent',
    ] as const;

    for (const scenarioName of scenarioNames) {
      const result = await runMichaelRuntimeResponseFixtureScenario({ scenarioName });
      expect(validateMichaelResponseContract(result.michaelResponse).ok).toBe(true);
      expect(result.michaelResponse.agentKey).toBe('michael_magnificent');
      expect(result.michaelResponse.taskType).toBe('training_support');
      expect(result.michaelResponse.persistence).toBe('disabled');
      expect(result.michaelResponse.agentResponseGenerated).toBe(false);
      expect(result.runtimeTurn.eventPersistence).toBe('disabled');
      expect(result.runtimeTurn.outcomePersistence).toBe('disabled');
      expect(result.runtimeTurn.guidedActionPersistence).toBe('disabled');
      expect(result.runtimeTurn.envelopePersistence).toBe('disabled');
      expect(result.responsePersistence).toBe('disabled');
      expect(result.agentResponseGenerated).toBe(false);
      expect(Object.hasOwn(result.runtimeTurn.result, 'agentResponse')).toBe(false);
      expect(Object.hasOwn(result.runtimeTurn.result, 'responseText')).toBe(false);
      expect(Object.hasOwn(result.runtimeTurn.result, 'llmOutput')).toBe(false);
    }
  });

  it('does not enable automatic sending, calling, scheduling, or prospecting', async () => {
    const result = await runMichaelRuntimeResponseFixtureScenario({
      scenarioName: 'complete_training_support',
    });

    expect(result.michaelResponse.nextStep).toMatchObject({
      baOwned: true,
      automaticSending: false,
      automaticCalling: false,
      externalSideEffect: false,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /\b(?:sendMessage|callProspect|scheduleCall|autoSend|autoCall|automaticProspecting|prospectingList|leadQualification)\b/,
    );
  });
});
