import { describe, expect, it } from 'vitest';
import {
  getMichaelRuntimeResponseScenario,
  michaelRuntimeResponseScenarioEntries,
  michaelRuntimeResponseScenarios,
} from '../index.js';

describe('S2.13 Michael runtime response fixture scenarios', () => {
  it('defines the approved twelve scenario mappings', () => {
    expect(
      michaelRuntimeResponseScenarioEntries.map(
        ([, scenario]) => scenario.metadata.scenarioName,
      ),
    ).toEqual([
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
    ]);
  });

  it('records required metadata for every scenario', () => {
    for (const [, scenario] of michaelRuntimeResponseScenarioEntries) {
      expect(scenario.metadata).toMatchObject({
        fixtureOnly: true,
        persistence: 'disabled',
        agentResponseGenerated: false,
      });
      expect(scenario.metadata.scenarioName).toEqual(expect.any(String));
      expect(scenario.metadata.expectedResponseType).toEqual(expect.any(String));
      expect(scenario.metadata.expectedContextStatus).toEqual(expect.any(String));
      expect(scenario.metadata.expectedValidationStatus).toEqual(expect.any(String));
      expect(scenario.metadata.runtimeTurnStatus).toEqual(expect.any(String));
      expect(scenario.metadata.runtimeScenario).toEqual(expect.any(String));
      expect(scenario.responseFixtureKey).toEqual(expect.any(String));
    }
  });

  it('maps complete, degraded, failed, missing, and rejected paths to approved response types', () => {
    expect(michaelRuntimeResponseScenarios.completeTrainingSupport.metadata).toMatchObject({
      expectedResponseType: 'next_training_step',
      expectedContextStatus: 'complete',
      runtimeTurnStatus: 'accepted',
    });
    expect(
      michaelRuntimeResponseScenarios.completeAmbiguousTrainingSupport.metadata,
    ).toMatchObject({
      expectedResponseType: 'clarification_question',
      expectedContextStatus: 'complete',
      runtimeTurnStatus: 'accepted',
    });
    expect(michaelRuntimeResponseScenarios.degradedContextPacket.metadata).toMatchObject({
      expectedResponseType: 'safe_fallback',
      expectedContextStatus: 'degraded',
      runtimeTurnStatus: 'degraded',
    });
    expect(michaelRuntimeResponseScenarios.failedContextPacket.metadata).toMatchObject({
      expectedResponseType: 'safe_close',
      expectedContextStatus: 'failed',
      runtimeTurnStatus: 'blocked',
    });
    expect(
      michaelRuntimeResponseScenarios.missingContextManagerBoundary.metadata,
    ).toMatchObject({
      expectedResponseType: 'safe_fallback',
      expectedContextStatus: 'missing',
      runtimeTurnStatus: 'rejected',
    });
    expect(michaelRuntimeResponseScenarios.rejectedContextPacket.metadata).toMatchObject({
      expectedResponseType: 'safe_close',
      expectedContextStatus: 'rejected',
      runtimeTurnStatus: 'rejected',
    });
  });

  it('uses safe_close metadata for invalid, unknown, candidate/review-only, wrong-task, unsupported-language, and non-Michael paths', () => {
    const scenarioNames = [
      'invalid_objective',
      'unknown_agent',
      'candidate_review_only_rejected',
      'unsupported_language',
      'wrong_task_type',
      'non_michael_agent',
    ] as const;

    for (const scenarioName of scenarioNames) {
      const scenario = getMichaelRuntimeResponseScenario(scenarioName);
      expect(scenario.metadata.expectedResponseType).toBe('safe_close');
      expect(scenario.metadata.expectedValidationStatus).toBe('safe_close');
      expect(scenario.metadata.agentResponseGenerated).toBe(false);
      expect(scenario.metadata.persistence).toBe('disabled');
    }
  });
});
