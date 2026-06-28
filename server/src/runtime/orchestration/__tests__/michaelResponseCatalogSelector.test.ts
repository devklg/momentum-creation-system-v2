import { describe, expect, it } from 'vitest';
import {
  getMichaelResponseCatalogEntry,
  selectMichaelResponseCatalogEntry,
  selectMichaelResponseCatalogKey,
  validateMichaelResponseContract,
} from '../index.js';
import type { MichaelResponseCatalogSelectionRequest } from '../types.js';

// ───────────────────────────────────────────────────────────────────────────
// S2.18 — Michael response catalog selector: deterministic mapping tests.
// The selector is a pure, returned-only resolver over the pre-authored EN/ES
// Michael response catalog. These tests prove the 12 valid
// (scenarioFamily, responseType, language) → catalogKey mappings, that every
// selected entry is the verbatim (immutable) catalog object, and that invalid
// requests are rejected with the expected issue codes. No route, no LLM, no
// persistence, no live services, no dynamic generation are touched.
// ───────────────────────────────────────────────────────────────────────────

type Language = 'en' | 'es';

/** The complete-family intent paired with each substantive response type. */
const INTENT_FOR_COMPLETE: Record<string, MichaelResponseCatalogSelectionRequest['intent']> = {
  next_training_step: 'clear_training_support',
  clarification_question: 'ambiguous_training_support',
};

/**
 * Build a valid selection request for a given (language, responseType,
 * scenarioFamily). Always scopes to the Michael agent + training_support task,
 * mirrors contextPacketStatus to scenarioFamily, and supplies the matching
 * intent for the complete family.
 */
function validRequest(
  language: Language,
  responseType: string,
  scenarioFamily: string,
): MichaelResponseCatalogSelectionRequest {
  return {
    agentKey: 'michael_magnificent',
    taskType: 'training_support',
    language,
    responseType,
    scenarioFamily,
    contextPacketStatus: scenarioFamily,
    ...(scenarioFamily === 'complete' ? { intent: INTENT_FOR_COMPLETE[responseType] } : {}),
  };
}

// The 12 governance-locked (scenarioFamily, responseType, language) → key rows.
const VALID_MAPPINGS: ReadonlyArray<{
  readonly label: string;
  readonly language: Language;
  readonly responseType: string;
  readonly scenarioFamily: string;
  readonly expectedKey: string;
}> = [
  {
    label: 'EN next-training-step',
    language: 'en',
    responseType: 'next_training_step',
    scenarioFamily: 'complete',
    expectedKey: 'michael_next_training_step_en',
  },
  {
    label: 'ES next-training-step',
    language: 'es',
    responseType: 'next_training_step',
    scenarioFamily: 'complete',
    expectedKey: 'michael_next_training_step_es',
  },
  {
    label: 'EN clarification-question',
    language: 'en',
    responseType: 'clarification_question',
    scenarioFamily: 'complete',
    expectedKey: 'michael_clarification_question_en',
  },
  {
    label: 'ES clarification-question',
    language: 'es',
    responseType: 'clarification_question',
    scenarioFamily: 'complete',
    expectedKey: 'michael_clarification_question_es',
  },
  {
    label: 'EN degraded safe-fallback',
    language: 'en',
    responseType: 'safe_fallback',
    scenarioFamily: 'degraded',
    expectedKey: 'michael_safe_fallback_degraded_en',
  },
  {
    label: 'ES degraded safe-fallback',
    language: 'es',
    responseType: 'safe_fallback',
    scenarioFamily: 'degraded',
    expectedKey: 'michael_safe_fallback_degraded_es',
  },
  {
    label: 'EN missing safe-fallback',
    language: 'en',
    responseType: 'safe_fallback',
    scenarioFamily: 'missing',
    expectedKey: 'michael_safe_fallback_missing_en',
  },
  {
    label: 'ES missing safe-fallback',
    language: 'es',
    responseType: 'safe_fallback',
    scenarioFamily: 'missing',
    expectedKey: 'michael_safe_fallback_missing_es',
  },
  {
    label: 'EN failed safe-close',
    language: 'en',
    responseType: 'safe_close',
    scenarioFamily: 'failed',
    expectedKey: 'michael_safe_close_failed_en',
  },
  {
    label: 'ES failed safe-close',
    language: 'es',
    responseType: 'safe_close',
    scenarioFamily: 'failed',
    expectedKey: 'michael_safe_close_failed_es',
  },
  {
    label: 'EN rejected safe-close',
    language: 'en',
    responseType: 'safe_close',
    scenarioFamily: 'rejected',
    expectedKey: 'michael_safe_close_rejected_en',
  },
  {
    label: 'ES rejected safe-close',
    language: 'es',
    responseType: 'safe_close',
    scenarioFamily: 'rejected',
    expectedKey: 'michael_safe_close_rejected_es',
  },
] as const;

describe('S2.18 Michael catalog selector — mappings', () => {
  // ── Tests 1–12: each valid mapping resolves to its locked catalog key. ─────
  for (const mapping of VALID_MAPPINGS) {
    it(`resolves ${mapping.label} → ${mapping.expectedKey}`, () => {
      const req = validRequest(mapping.language, mapping.responseType, mapping.scenarioFamily);

      expect(selectMichaelResponseCatalogKey(req)).toBe(mapping.expectedKey);

      const result = selectMichaelResponseCatalogEntry(req);
      expect(result.ok).toBe(true);
      if (!result.ok) return; // narrow for TS; .ok asserted above.
      expect(result.catalogKey).toBe(mapping.expectedKey);
    });
  }

  // ── Test 13: every selected entry validates as a Michael response contract. ─
  it('selects a contract-valid response for every mapping', () => {
    for (const mapping of VALID_MAPPINGS) {
      const req = validRequest(mapping.language, mapping.responseType, mapping.scenarioFamily);
      const result = selectMichaelResponseCatalogEntry(req);
      expect(result.ok, `expected ${mapping.expectedKey} to select`).toBe(true);
      if (!result.ok) continue;

      const validation = validateMichaelResponseContract(result.response);
      expect(
        validation.ok,
        validation.ok
          ? ''
          : `${mapping.expectedKey}: ${validation.issues.map((i) => i.code).join(', ')}`,
      ).toBe(true);
    }
  });

  // ── Test 14: agentResponseGenerated stays false on every selected response. ─
  it('preserves response.agentResponseGenerated === false on every selection', () => {
    for (const mapping of VALID_MAPPINGS) {
      const req = validRequest(mapping.language, mapping.responseType, mapping.scenarioFamily);
      const result = selectMichaelResponseCatalogEntry(req);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.response.agentResponseGenerated).toBe(false);
    }
  });

  // ── Test 15: persistence stays disabled on every selected response. ────────
  it('preserves response.persistence === "disabled" on every selection', () => {
    for (const mapping of VALID_MAPPINGS) {
      const req = validRequest(mapping.language, mapping.responseType, mapping.scenarioFamily);
      const result = selectMichaelResponseCatalogEntry(req);
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.response.persistence).toBe('disabled');
    }
  });

  // ── Test 16: selection is returned-only — same object reference, no mutation.
  it('returns the verbatim catalog object (same reference twice; no mutation)', () => {
    for (const mapping of VALID_MAPPINGS) {
      const req = validRequest(mapping.language, mapping.responseType, mapping.scenarioFamily);

      const first = selectMichaelResponseCatalogEntry(req);
      const second = selectMichaelResponseCatalogEntry(req);
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (!first.ok || !second.ok) continue;

      // Selecting twice yields the SAME response object reference (no copy).
      expect(second.response).toBe(first.response);
      expect(second.entry).toBe(first.entry);

      // The selected response is the catalog entry's response, unmodified.
      const catalogEntry = getMichaelResponseCatalogEntry(mapping.expectedKey);
      expect(catalogEntry).toBeDefined();
      expect(first.response).toBe(catalogEntry?.response);
      expect(first.response).toEqual(catalogEntry?.response);
    }
  });

  // ── Test 17: invalid scenario/response combinations are rejected. ──────────
  it('rejects unknown scenario/response combinations with invalid_combination', () => {
    const invalidCombinations: ReadonlyArray<{
      readonly responseType: string;
      readonly scenarioFamily: string;
    }> = [
      { responseType: 'safe_close', scenarioFamily: 'complete' },
      { responseType: 'next_training_step', scenarioFamily: 'failed' },
      { responseType: 'safe_fallback', scenarioFamily: 'rejected' },
      { responseType: 'next_training_step', scenarioFamily: 'missing' },
      { responseType: 'clarification_question', scenarioFamily: 'degraded' },
    ];

    for (const combo of invalidCombinations) {
      const req = validRequest('en', combo.responseType, combo.scenarioFamily);
      const result = selectMichaelResponseCatalogEntry(req);

      const label = `${combo.scenarioFamily}+${combo.responseType}`;
      expect(result.ok, `${label} should not resolve`).toBe(false);
      if (result.ok) continue;
      expect(result.issues.map((i) => i.code)).toContain('invalid_combination');
      expect(selectMichaelResponseCatalogKey(req)).toBeUndefined();
    }
  });

  // ── Test 18: unsupported language is rejected. ─────────────────────────────
  it('rejects an unsupported language with unsupported_language', () => {
    const req: MichaelResponseCatalogSelectionRequest = {
      agentKey: 'michael_magnificent',
      taskType: 'training_support',
      language: 'fr',
      responseType: 'next_training_step',
      scenarioFamily: 'complete',
      contextPacketStatus: 'complete',
      intent: 'clear_training_support',
    };

    const result = selectMichaelResponseCatalogEntry(req);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain('unsupported_language');
    expect(selectMichaelResponseCatalogKey(req)).toBeUndefined();
  });

  // ── Test 19: a non-Michael agent is rejected. ─────────────────────────────
  it('rejects a non-Michael agent with wrong_agent', () => {
    const req: MichaelResponseCatalogSelectionRequest = {
      ...validRequest('en', 'next_training_step', 'complete'),
      agentKey: 'steve_success',
    };

    const result = selectMichaelResponseCatalogEntry(req);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain('wrong_agent');
    expect(selectMichaelResponseCatalogKey(req)).toBeUndefined();
  });

  // ── Test 20: a non-training-support task is rejected. ──────────────────────
  it('rejects a non-training-support task with wrong_task', () => {
    const req: MichaelResponseCatalogSelectionRequest = {
      ...validRequest('en', 'next_training_step', 'complete'),
      taskType: 'success_interview',
    };

    const result = selectMichaelResponseCatalogEntry(req);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.map((i) => i.code)).toContain('wrong_task');
    expect(selectMichaelResponseCatalogKey(req)).toBeUndefined();
  });
});
