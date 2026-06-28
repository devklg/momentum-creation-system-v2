import { describe, expect, it } from 'vitest';
import {
  deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn,
  selectMichaelResponseCatalogEntry,
  selectMichaelResponseCatalogKey,
} from '../index.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';
import type {
  MichaelCatalogSelectorIntent,
  MichaelResponseCatalogSelectionRequest,
  MichaelResponseSelectionRequestDerivationResult,
  RuntimeTurnFixtureHarnessResult,
} from '../types.js';

// S2.19 — Selection-request negative space. The S2.19 derivation reuses the
// inert adapter classification; the S2.18 selector maps the result. This proves
// the negative space: safe paths never require substantive intent, and no
// degraded / candidate / wrong-agent / wrong-task / unsupported-language input
// can ever derive a substantive (next_training_step / clarification_question)
// entry. Pre-authored fixtures only; inert; generates no text, no persistence.

const MICHAEL_AGENT_KEY = 'michael_magnificent';
const MICHAEL_TASK_TYPE = 'training_support';

const SUBSTANTIVE_RESPONSE_TYPES = [
  'next_training_step',
  'clarification_question',
] as const;

// Local runContract-style helper: run an inert fixture turn, then derive its
// catalog-selection request (defaults identity / turnId / taskType from the
// runtime turn). Mirrors the harness usage in michaelRuntimeAdapterContract.test.ts.
type DeriveOverrides = {
  readonly scenario?: Parameters<typeof runRuntimeTurnFixtureScenario>[0]['scenario'];
  readonly agentKey?: unknown;
  readonly taskType?: 'training_support' | 'success_interview';
  readonly language?: unknown;
};

async function deriveFromScenario(
  overrides: DeriveOverrides = {},
): Promise<MichaelResponseSelectionRequestDerivationResult> {
  const taskType = overrides.taskType ?? 'training_support';
  const runtimeTurn: RuntimeTurnFixtureHarnessResult = await runRuntimeTurnFixtureScenario({
    scenario: overrides.scenario ?? 'accepted_complete',
    agentKey: overrides.agentKey ?? 'michael_magnificent',
    taskType,
  });

  return deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn({
    runtimeTurn,
    ...(overrides.language !== undefined ? { language: overrides.language } : {}),
  });
}

function safePathRequest(
  scenarioFamily: string,
  responseType: string,
  intent?: MichaelCatalogSelectorIntent,
): MichaelResponseCatalogSelectionRequest {
  return {
    agentKey: MICHAEL_AGENT_KEY,
    taskType: MICHAEL_TASK_TYPE,
    language: 'en',
    responseType,
    scenarioFamily,
    ...(intent ? { intent } : {}),
  };
}

describe('S2.19 Michael selection-request negative space', () => {
  it('#9 safe-path requests resolve without intent, and supplying intent is ignored', () => {
    const safePaths = [
      ['degraded', 'safe_fallback', 'michael_safe_fallback_degraded_en'],
      ['missing', 'safe_fallback', 'michael_safe_fallback_missing_en'],
      ['failed', 'safe_close', 'michael_safe_close_failed_en'],
      ['rejected', 'safe_close', 'michael_safe_close_rejected_en'],
    ] as const;

    for (const [scenarioFamily, responseType, expectedKey] of safePaths) {
      // No intent field at all — safe paths must not require substantive intent.
      const withoutIntent = selectMichaelResponseCatalogEntry(
        safePathRequest(scenarioFamily, responseType),
      );
      expect(withoutIntent.ok, `${scenarioFamily} resolves without intent`).toBe(true);
      if (withoutIntent.ok) expect(withoutIntent.catalogKey).toBe(expectedKey);

      // Intent is irrelevant on a safe path — same safe entry regardless.
      for (const intent of [
        'clear_training_support',
        'ambiguous_training_support',
      ] as const) {
        const withIntent = selectMichaelResponseCatalogEntry(
          safePathRequest(scenarioFamily, responseType, intent),
        );
        expect(withIntent.ok, `${scenarioFamily} ignores intent ${intent}`).toBe(true);
        if (withIntent.ok) expect(withIntent.catalogKey).toBe(expectedKey);
      }
    }
  });

  it('#10 candidate/review-only derives rejected + safe_close only', async () => {
    const derivedEn = await deriveFromScenario({
      scenario: 'candidate_review_only_rejected',
    });
    expect(derivedEn.ok).toBe(true);
    if (!derivedEn.ok) return;

    expect(derivedEn.selectionRequest.scenarioFamily).toBe('rejected');
    expect(derivedEn.selectionRequest.responseType).toBe('safe_close');

    const keyEn = selectMichaelResponseCatalogKey(derivedEn.selectionRequest);
    expect(keyEn).toBe('michael_safe_close_rejected_en');
    expect(keyEn?.endsWith('_safe_close_rejected_en')).toBe(true);

    const derivedEs = await deriveFromScenario({
      scenario: 'candidate_review_only_rejected',
      language: 'es',
    });
    expect(derivedEs.ok).toBe(true);
    if (!derivedEs.ok) return;

    expect(derivedEs.selectionRequest.scenarioFamily).toBe('rejected');
    expect(derivedEs.selectionRequest.responseType).toBe('safe_close');

    const keyEs = selectMichaelResponseCatalogKey(derivedEs.selectionRequest);
    expect(keyEs).toBe('michael_safe_close_rejected_es');
    expect(keyEs?.endsWith('_safe_close_rejected_es')).toBe(true);
  });

  it('#11 wrong-agent and wrong-task can only derive rejected + safe_close', async () => {
    const wrongAgent = await deriveFromScenario({ agentKey: 'steve_success' });
    expect(wrongAgent.ok).toBe(true);
    if (wrongAgent.ok) {
      expect(wrongAgent.selectionRequest.scenarioFamily).toBe('rejected');
      expect(wrongAgent.selectionRequest.responseType).toBe('safe_close');
      expect(SUBSTANTIVE_RESPONSE_TYPES).not.toContain(
        wrongAgent.selectionRequest.responseType,
      );
    }

    const wrongTask = await deriveFromScenario({ taskType: 'success_interview' });
    expect(wrongTask.ok).toBe(true);
    if (wrongTask.ok) {
      expect(wrongTask.selectionRequest.scenarioFamily).toBe('rejected');
      expect(wrongTask.selectionRequest.responseType).toBe('safe_close');
      expect(SUBSTANTIVE_RESPONSE_TYPES).not.toContain(
        wrongTask.selectionRequest.responseType,
      );
    }
  });

  it('#12 unsupported language can only derive a rejected + safe_close en entry', async () => {
    const derived = await deriveFromScenario({ language: 'fr' });
    expect(derived.ok).toBe(true);
    if (!derived.ok) return;

    expect(derived.selectionRequest.responseType).toBe('safe_close');
    expect(derived.selectionRequest.scenarioFamily).toBe('rejected');
    // Unsupported language falls back to the language-neutral EN safe entry.
    expect(derived.selectionRequest.language).toBe('en');
    expect(SUBSTANTIVE_RESPONSE_TYPES).not.toContain(
      derived.selectionRequest.responseType,
    );

    const result = selectMichaelResponseCatalogEntry(derived.selectionRequest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.catalogKey).toBe('michael_safe_close_rejected_en');
      expect(result.entry.responseType).toBe('safe_close');
      expect(result.entry.scenarioFamily).toBe('rejected');
      expect(result.entry.language).toBe('en');
    }
  });
});
