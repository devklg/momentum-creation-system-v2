import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS,
  getMichaelResponseCatalogEntry,
  selectMichaelResponseCatalogEntry,
  selectMichaelResponseCatalogKey,
  selectionRequestForCatalogKey,
} from '../index.js';
import type {
  MichaelCatalogSelectorIntent,
  MichaelResponseCatalogSelectionRequest,
} from '../types.js';

// S2.19 — Selector exhaustiveness. The S2.18 selector is a pure, returned-only
// mapper. This proves the full closed world: exactly six of the twenty
// (scenarioFamily, responseType) combinations resolve, every valid combination
// maps to its EN and ES catalog key, every invalid combination is rejected with
// `invalid_combination`, every catalog entry is reachable through exactly one
// request, no request points at a phantom entry, and complete-family intent is
// enforced. Pre-authored catalog/fixtures only; inert; no I/O.

const MICHAEL_AGENT_KEY = 'michael_magnificent';
const MICHAEL_TASK_TYPE = 'training_support';

const SCENARIO_FAMILIES = [
  'complete',
  'degraded',
  'missing',
  'failed',
  'rejected',
] as const;

const RESPONSE_TYPES = [
  'next_training_step',
  'clarification_question',
  'safe_fallback',
  'safe_close',
] as const;

/** The six — and only six — valid combinations, with their catalog-key base. */
const VALID_COMBINATION_KEY_BASE: ReadonlyMap<string, string> = new Map([
  ['complete|next_training_step', 'michael_next_training_step'],
  ['complete|clarification_question', 'michael_clarification_question'],
  ['degraded|safe_fallback', 'michael_safe_fallback_degraded'],
  ['missing|safe_fallback', 'michael_safe_fallback_missing'],
  ['failed|safe_close', 'michael_safe_close_failed'],
  ['rejected|safe_close', 'michael_safe_close_rejected'],
]);

/** Matching intent that a complete-family request carries, when applicable. */
const INTENT_FOR_COMPLETE: Readonly<Record<string, MichaelCatalogSelectorIntent>> = {
  next_training_step: 'clear_training_support',
  clarification_question: 'ambiguous_training_support',
};

function buildRequest(
  scenarioFamily: string,
  responseType: string,
  language: string,
): MichaelResponseCatalogSelectionRequest {
  const intent =
    scenarioFamily === 'complete' ? INTENT_FOR_COMPLETE[responseType] : undefined;
  return {
    agentKey: MICHAEL_AGENT_KEY,
    taskType: MICHAEL_TASK_TYPE,
    language,
    responseType,
    scenarioFamily,
    ...(intent ? { intent } : {}),
  };
}

describe('S2.19 Michael response catalog selector exhaustiveness', () => {
  it('#1 exactly six of the twenty (scenarioFamily, responseType) combinations resolve ok (EN)', () => {
    const okCombos: string[] = [];
    const rejectedCombos: string[] = [];

    for (const scenarioFamily of SCENARIO_FAMILIES) {
      for (const responseType of RESPONSE_TYPES) {
        const combo = `${scenarioFamily}|${responseType}`;
        const result = selectMichaelResponseCatalogEntry(
          buildRequest(scenarioFamily, responseType, 'en'),
        );
        if (result.ok) {
          okCombos.push(combo);
        } else {
          rejectedCombos.push(combo);
        }
      }
    }

    // 5 families x 4 response types = 20 combinations.
    expect(okCombos.length + rejectedCombos.length).toBe(20);
    expect(okCombos.length).toBe(6);
    expect(rejectedCombos.length).toBe(14);

    // The resolving set is exactly the six valid combinations.
    expect([...okCombos].sort()).toEqual([...VALID_COMBINATION_KEY_BASE.keys()].sort());
  });

  it('#2 every valid combination maps to its EN catalog key', () => {
    for (const [combo, keyBase] of VALID_COMBINATION_KEY_BASE) {
      const [scenarioFamily, responseType] = combo.split('|') as [string, string];
      const key = selectMichaelResponseCatalogKey(
        buildRequest(scenarioFamily, responseType, 'en'),
      );
      expect(key, `EN key for ${combo}`).toBe(`${keyBase}_en`);
    }
  });

  it('#3 every valid combination maps to its ES catalog key', () => {
    for (const [combo, keyBase] of VALID_COMBINATION_KEY_BASE) {
      const [scenarioFamily, responseType] = combo.split('|') as [string, string];
      const key = selectMichaelResponseCatalogKey(
        buildRequest(scenarioFamily, responseType, 'es'),
      );
      expect(key, `ES key for ${combo}`).toBe(`${keyBase}_es`);
    }
  });

  it('#4 every invalid combination is rejected with invalid_combination', () => {
    const invalidCombos = [
      ['complete', 'safe_fallback'],
      ['complete', 'safe_close'],
      ['degraded', 'next_training_step'],
      ['degraded', 'clarification_question'],
      ['degraded', 'safe_close'],
      ['missing', 'next_training_step'],
      ['missing', 'clarification_question'],
      ['missing', 'safe_close'],
      ['failed', 'next_training_step'],
      ['failed', 'clarification_question'],
      ['failed', 'safe_fallback'],
      ['rejected', 'next_training_step'],
      ['rejected', 'clarification_question'],
      ['rejected', 'safe_fallback'],
    ] as const;

    // Exactly the 14 invalid combinations (complement of the 6 valid pairs).
    expect(invalidCombos.length).toBe(14);

    for (const [scenarioFamily, responseType] of invalidCombos) {
      const combo = `${scenarioFamily}|${responseType}`;
      const result = selectMichaelResponseCatalogEntry(
        buildRequest(scenarioFamily, responseType, 'en'),
      );
      expect(result.ok, `combo ${combo} must be rejected`).toBe(false);
      if (result.ok) continue;
      expect(
        result.issues.map((issue) => issue.code),
        `combo ${combo} issue codes`,
      ).toContain('invalid_combination');
    }
  });

  it('#5 every catalog entry is reachable through exactly one valid selection request', () => {
    expect(MICHAEL_RESPONSE_CATALOG.length).toBe(12);

    const reachableKeys: string[] = [];
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      const request = selectionRequestForCatalogKey(entry.catalogKey);
      expect(request, `request for ${entry.catalogKey}`).toBeDefined();

      const key = selectMichaelResponseCatalogKey(request!);
      expect(key, `resolved key for ${entry.catalogKey}`).toBe(entry.catalogKey);
      reachableKeys.push(entry.catalogKey);
    }

    // No two requests collide — the reachable set has no duplicates.
    expect(new Set(reachableKeys).size).toBe(reachableKeys.length);

    const catalogKeys = MICHAEL_RESPONSE_CATALOG.map((entry) => entry.catalogKey);
    expect([...reachableKeys].sort()).toEqual([...catalogKeys].sort());
    expect([...MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS].sort()).toEqual(
      [...catalogKeys].sort(),
    );
    expect(MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS.length).toBe(12);
  });

  it('#6 no selectable key points at a missing catalog entry', () => {
    for (const key of MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS) {
      const entry = getMichaelResponseCatalogEntry(key);
      expect(entry, `catalog entry for selectable key ${key}`).toBeDefined();
    }
  });

  it('#7 complete requests resolve with matching clear/ambiguous intent', () => {
    const nextStep = selectMichaelResponseCatalogEntry({
      agentKey: MICHAEL_AGENT_KEY,
      taskType: MICHAEL_TASK_TYPE,
      language: 'en',
      responseType: 'next_training_step',
      scenarioFamily: 'complete',
      intent: 'clear_training_support',
    });
    expect(nextStep.ok).toBe(true);
    if (nextStep.ok) expect(nextStep.catalogKey).toBe('michael_next_training_step_en');

    const clarification = selectMichaelResponseCatalogEntry({
      agentKey: MICHAEL_AGENT_KEY,
      taskType: MICHAEL_TASK_TYPE,
      language: 'en',
      responseType: 'clarification_question',
      scenarioFamily: 'complete',
      intent: 'ambiguous_training_support',
    });
    expect(clarification.ok).toBe(true);
    if (clarification.ok) {
      expect(clarification.catalogKey).toBe('michael_clarification_question_en');
    }
  });

  it('#8 complete requests with mismatched intent are rejected with intent_mismatch', () => {
    const nextStepWrongIntent = selectMichaelResponseCatalogEntry({
      agentKey: MICHAEL_AGENT_KEY,
      taskType: MICHAEL_TASK_TYPE,
      language: 'en',
      responseType: 'next_training_step',
      scenarioFamily: 'complete',
      intent: 'ambiguous_training_support',
    });
    expect(nextStepWrongIntent.ok).toBe(false);
    if (!nextStepWrongIntent.ok) {
      expect(nextStepWrongIntent.issues.map((issue) => issue.code)).toContain(
        'intent_mismatch',
      );
    }

    const clarificationWrongIntent = selectMichaelResponseCatalogEntry({
      agentKey: MICHAEL_AGENT_KEY,
      taskType: MICHAEL_TASK_TYPE,
      language: 'en',
      responseType: 'clarification_question',
      scenarioFamily: 'complete',
      intent: 'clear_training_support',
    });
    expect(clarificationWrongIntent.ok).toBe(false);
    if (!clarificationWrongIntent.ok) {
      expect(clarificationWrongIntent.issues.map((issue) => issue.code)).toContain(
        'intent_mismatch',
      );
    }
  });
});
