import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_TYPE_REGISTRY,
} from '../../runtime/orchestration/michaelResponseCatalog.js';
import {
  MICHAEL_RUNTIME_FALLBACK_POLICY,
  MICHAEL_RUNTIME_LANGUAGE_AUTHORITY_VERSION,
  MICHAEL_RUNTIME_RESPONSE_COPY,
  MICHAEL_RUNTIME_SUPPORTED_LANGUAGES,
  MICHAEL_RUNTIME_UI_COPY,
} from '@momentum/shared';
import {
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureClarificationQuestionEs,
  michaelResponseFixtureNextTrainingStepEn,
  michaelResponseFixtureNextTrainingStepEs,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
} from '../../runtime/orchestration/fixtures/michaelResponseFixtures.js';
import { selectMichaelResponseCatalogEntry } from '../../runtime/orchestration/michaelResponseCatalogSelector.js';

describe('P2-122 Michael language authority', () => {
  it('pins the first governed language authority version and fallback policy', () => {
    expect(MICHAEL_RUNTIME_LANGUAGE_AUTHORITY_VERSION).toBe('1.0.0');
    expect(MICHAEL_RUNTIME_SUPPORTED_LANGUAGES).toEqual(['en', 'es']);
    expect(MICHAEL_RUNTIME_FALLBACK_POLICY).toEqual({
      degraded: { responseType: 'safe_fallback', behavior: 'return_controlled_copy' },
      missing: { responseType: 'safe_fallback', behavior: 'return_controlled_copy' },
      failed: { responseType: 'safe_close', behavior: 'close_without_side_effects' },
      rejected: { responseType: 'safe_close', behavior: 'close_without_side_effects' },
    });
  });

  it('keeps every controlled fixture on the shared EN/ES response copy', () => {
    const cases = [
      [michaelResponseFixtureNextTrainingStepEn, MICHAEL_RUNTIME_RESPONSE_COPY.nextTrainingStep.en.text],
      [michaelResponseFixtureNextTrainingStepEs, MICHAEL_RUNTIME_RESPONSE_COPY.nextTrainingStep.es.text],
      [michaelResponseFixtureClarificationQuestionEn, MICHAEL_RUNTIME_RESPONSE_COPY.clarificationQuestion.en.text],
      [michaelResponseFixtureClarificationQuestionEs, MICHAEL_RUNTIME_RESPONSE_COPY.clarificationQuestion.es.text],
      [michaelResponseFixtureSafeFallbackDegradedContextPacket, MICHAEL_RUNTIME_RESPONSE_COPY.safeFallback.degraded.en.text],
      [michaelResponseFixtureSafeFallbackDegradedContextPacketEs, MICHAEL_RUNTIME_RESPONSE_COPY.safeFallback.degraded.es.text],
      [michaelResponseFixtureSafeFallbackMissingContextPacket, MICHAEL_RUNTIME_RESPONSE_COPY.safeFallback.missing.en.text],
      [michaelResponseFixtureSafeFallbackMissingContextPacketEs, MICHAEL_RUNTIME_RESPONSE_COPY.safeFallback.missing.es.text],
      [michaelResponseFixtureSafeCloseFailedContextPacket, MICHAEL_RUNTIME_RESPONSE_COPY.safeClose.failed.en.text],
      [michaelResponseFixtureSafeCloseFailedContextPacketEs, MICHAEL_RUNTIME_RESPONSE_COPY.safeClose.failed.es.text],
      [michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection, MICHAEL_RUNTIME_RESPONSE_COPY.safeClose.rejected.en.text],
      [michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs, MICHAEL_RUNTIME_RESPONSE_COPY.safeClose.rejected.es.text],
    ] as const;

    for (const [fixture, expectedText] of cases) {
      expect(fixture.text).toBe(expectedText);
    }
    expect(michaelResponseFixtureNextTrainingStepEn.nextStep).toMatchObject(
      MICHAEL_RUNTIME_RESPONSE_COPY.nextTrainingStep.en.nextStep,
    );
    expect(michaelResponseFixtureNextTrainingStepEs.nextStep).toMatchObject(
      MICHAEL_RUNTIME_RESPONSE_COPY.nextTrainingStep.es.nextStep,
    );
  });

  it('drives every safe-path catalog selection from the shared policy', () => {
    for (const [scenarioFamily, policy] of Object.entries(MICHAEL_RUNTIME_FALLBACK_POLICY)) {
      for (const language of ['en', 'es'] as const) {
        const result = selectMichaelResponseCatalogEntry({
          agentKey: 'michael_magnificent',
          taskType: 'training_support',
          language,
          responseType: policy.responseType,
          scenarioFamily,
          contextPacketStatus: scenarioFamily,
        });
        expect(result.ok, `${scenarioFamily}/${language} should resolve`).toBe(true);
        if (!result.ok) continue;
        expect(result.catalogKey).toBe(
          `michael_${policy.responseType}_${scenarioFamily}_${language}`,
        );
        expect(result.response.responseType).toBe(policy.responseType);
        expect(result.response.contextPacketStatus).toBe(scenarioFamily);
        const expectedCopy = policy.responseType === 'safe_fallback'
          ? MICHAEL_RUNTIME_RESPONSE_COPY.safeFallback[
              scenarioFamily as keyof typeof MICHAEL_RUNTIME_RESPONSE_COPY.safeFallback
            ][language].text
          : MICHAEL_RUNTIME_RESPONSE_COPY.safeClose[
              scenarioFamily as keyof typeof MICHAEL_RUNTIME_RESPONSE_COPY.safeClose
            ][language].text;
        expect(result.response.text).toBe(expectedCopy);
      }
    }
  });

  it('keeps the response-type registry aligned with the shared fallback policy', () => {
    const scenariosFor = (responseType: 'safe_fallback' | 'safe_close') =>
      Object.entries(MICHAEL_RUNTIME_FALLBACK_POLICY)
        .filter(([, policy]) => policy.responseType === responseType)
        .map(([scenario]) => scenario);

    expect(MICHAEL_RESPONSE_TYPE_REGISTRY.safe_fallback.allowedScenarioFamilies).toEqual(
      scenariosFor('safe_fallback'),
    );
    expect(MICHAEL_RESPONSE_TYPE_REGISTRY.safe_close.allowedScenarioFamilies).toEqual(
      scenariosFor('safe_close'),
    );
  });

  it('keeps shared UI fallback copy inside Michael compliance boundaries', () => {
    const copy = Object.values(MICHAEL_RUNTIME_UI_COPY.en).join(' ');
    expect(copy).not.toMatch(/income|commission|cycle|payout|earnings|placement|guarantee/i);
    expect(copy).not.toMatch(/auto-?send|auto-?call|prospect/i);
  });
});
