import { describe, expect, it } from 'vitest';
import {
  MICHAEL_CATALOG_KEY_REGISTRY,
  MICHAEL_RESPONSE_CATALOG,
  MICHAEL_RESPONSE_TYPE_REGISTRY,
  validateMichaelResponseCatalog,
} from '../../runtime/orchestration/index.js';

describe('P1-62 Michael catalog key and response type registry', () => {
  it('has one registry row for every controlled catalog entry', () => {
    expect(Object.keys(MICHAEL_CATALOG_KEY_REGISTRY)).toEqual(
      MICHAEL_RESPONSE_CATALOG.map((entry) => entry.catalogKey),
    );
  });

  it('covers every Michael response type exactly once', () => {
    expect(Object.keys(MICHAEL_RESPONSE_TYPE_REGISTRY)).toEqual([
      'next_training_step', 'clarification_question', 'safe_fallback', 'safe_close',
    ]);
  });

  it('keeps substantive and safe-path scenario families disjoint', () => {
    expect(MICHAEL_RESPONSE_TYPE_REGISTRY.next_training_step).toMatchObject({ substantive: true });
    expect(MICHAEL_RESPONSE_TYPE_REGISTRY.clarification_question).toMatchObject({ substantive: true });
    expect(MICHAEL_RESPONSE_TYPE_REGISTRY.safe_fallback).toMatchObject({ substantive: false });
    expect(MICHAEL_RESPONSE_TYPE_REGISTRY.safe_close).toMatchObject({ substantive: false });
    expect(MICHAEL_RESPONSE_TYPE_REGISTRY.safe_close.allowedScenarioFamilies).toEqual(['failed', 'rejected']);
  });

  it('matches each key registry row to its catalog contract', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(MICHAEL_CATALOG_KEY_REGISTRY[entry.catalogKey]).toEqual({
        responseType: entry.responseType,
        scenarioFamily: entry.scenarioFamily,
        contextPacketStatus: entry.contextPacketStatus,
        language: entry.language,
        substantive: entry.isSubstantive,
        safePath: entry.isSafePath,
      });
    }
    expect(validateMichaelResponseCatalog()).toMatchObject({ ok: true, issues: [] });
  });
});
