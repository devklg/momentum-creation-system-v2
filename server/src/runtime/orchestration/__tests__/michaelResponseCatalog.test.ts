import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  getMichaelResponseCatalogEntry,
  hasMichaelResponseCatalogEntry,
  listMichaelResponseCatalogEntries,
  listMichaelResponseCatalogKeys,
  type MichaelResponseCatalogEntry,
} from '../index.js';

// ───────────────────────────────────────────────────────────────────────────
// S2.17 — Michael response catalog: structural / behavior tests.
// The catalog is an inert, returned-only wrapper over the pre-authored EN/ES
// Michael response contract fixtures. These tests prove coverage, lookups,
// the descriptive metadata rules, and unknown-key rejection. No route, no LLM,
// no persistence, no live services are touched.
// ───────────────────────────────────────────────────────────────────────────

const EXPECTED_CATALOG_KEYS = [
  'michael_next_training_step_en',
  'michael_next_training_step_es',
  'michael_clarification_question_en',
  'michael_clarification_question_es',
  'michael_safe_fallback_degraded_en',
  'michael_safe_fallback_degraded_es',
  'michael_safe_fallback_missing_en',
  'michael_safe_fallback_missing_es',
  'michael_safe_close_failed_en',
  'michael_safe_close_failed_es',
  'michael_safe_close_rejected_en',
  'michael_safe_close_rejected_es',
] as const;

function requireEntry(catalogKey: string): MichaelResponseCatalogEntry {
  const entry = getMichaelResponseCatalogEntry(catalogKey);
  expect(entry, `expected catalog entry for ${catalogKey}`).toBeDefined();
  // Narrow for the assertions below; presence is asserted just above.
  return entry as MichaelResponseCatalogEntry;
}

describe('S2.17 Michael response catalog — structure & behavior', () => {
  it('lists all controlled Michael response fixtures (length 12; keys match the set)', () => {
    expect(MICHAEL_RESPONSE_CATALOG).toHaveLength(12);
    expect(listMichaelResponseCatalogEntries()).toHaveLength(12);
    expect(listMichaelResponseCatalogKeys()).toEqual([...EXPECTED_CATALOG_KEYS]);
    expect([...listMichaelResponseCatalogKeys()].sort()).toEqual(
      [...EXPECTED_CATALOG_KEYS].sort(),
    );
  });

  it('includes the EN next-training-step entry', () => {
    expect(requireEntry('michael_next_training_step_en')).toMatchObject({
      language: 'en',
      responseType: 'next_training_step',
      contextPacketStatus: 'complete',
    });
  });

  it('includes the ES next-training-step entry', () => {
    expect(requireEntry('michael_next_training_step_es')).toMatchObject({
      language: 'es',
      responseType: 'next_training_step',
      contextPacketStatus: 'complete',
    });
  });

  it('includes the EN clarification-question entry', () => {
    expect(requireEntry('michael_clarification_question_en')).toMatchObject({
      language: 'en',
      responseType: 'clarification_question',
      contextPacketStatus: 'complete',
    });
  });

  it('includes the ES clarification-question entry', () => {
    expect(requireEntry('michael_clarification_question_es')).toMatchObject({
      language: 'es',
      responseType: 'clarification_question',
      contextPacketStatus: 'complete',
    });
  });

  it('includes the EN safe-fallback (degraded) entry', () => {
    expect(requireEntry('michael_safe_fallback_degraded_en')).toMatchObject({
      language: 'en',
      responseType: 'safe_fallback',
      contextPacketStatus: 'degraded',
    });
  });

  it('includes the ES safe-fallback (degraded) entry', () => {
    expect(requireEntry('michael_safe_fallback_degraded_es')).toMatchObject({
      language: 'es',
      responseType: 'safe_fallback',
      contextPacketStatus: 'degraded',
    });
  });

  it('includes the EN safe-fallback (missing) entry', () => {
    expect(requireEntry('michael_safe_fallback_missing_en')).toMatchObject({
      language: 'en',
      responseType: 'safe_fallback',
      contextPacketStatus: 'missing',
    });
  });

  it('includes the ES safe-fallback (missing) entry', () => {
    expect(requireEntry('michael_safe_fallback_missing_es')).toMatchObject({
      language: 'es',
      responseType: 'safe_fallback',
      contextPacketStatus: 'missing',
    });
  });

  it('includes the EN safe-close (failed) entry', () => {
    expect(requireEntry('michael_safe_close_failed_en')).toMatchObject({
      language: 'en',
      responseType: 'safe_close',
      contextPacketStatus: 'failed',
    });
  });

  it('includes the ES safe-close (failed) entry', () => {
    expect(requireEntry('michael_safe_close_failed_es')).toMatchObject({
      language: 'es',
      responseType: 'safe_close',
      contextPacketStatus: 'failed',
    });
  });

  it('includes the EN safe-close (candidate/rejected) entry', () => {
    expect(requireEntry('michael_safe_close_rejected_en')).toMatchObject({
      language: 'en',
      responseType: 'safe_close',
      contextPacketStatus: 'rejected',
    });
  });

  it('includes the ES safe-close (candidate/rejected) entry', () => {
    expect(requireEntry('michael_safe_close_rejected_es')).toMatchObject({
      language: 'es',
      responseType: 'safe_close',
      contextPacketStatus: 'rejected',
    });
  });

  it('limits substantive entries to contextPacketStatus "complete" (and every "complete" entry is substantive)', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      if (entry.isSubstantive) {
        expect(entry.contextPacketStatus).toBe('complete');
        expect(['next_training_step', 'clarification_question']).toContain(
          entry.responseType,
        );
      }
      if (entry.contextPacketStatus === 'complete') {
        expect(entry.isSubstantive).toBe(true);
      }
    }

    // Sanity: there are exactly four substantive/complete entries.
    expect(MICHAEL_RESPONSE_CATALOG.filter((entry) => entry.isSubstantive)).toHaveLength(4);
  });

  it('covers degraded/missing/failed/rejected scenario families among safe-path entries', () => {
    const safePathFamilies = new Set(
      MICHAEL_RESPONSE_CATALOG.filter((entry) => entry.isSafePath).map(
        (entry) => entry.scenarioFamily,
      ),
    );

    for (const family of ['degraded', 'missing', 'failed', 'rejected'] as const) {
      expect(safePathFamilies.has(family)).toBe(true);
    }

    // Safe-path entries are exactly the non-substantive ones (8 of 12).
    expect(MICHAEL_RESPONSE_CATALOG.filter((entry) => entry.isSafePath)).toHaveLength(8);
  });

  it('rejects unknown keys: lookup returns undefined and has() returns false', () => {
    expect(getMichaelResponseCatalogEntry('does_not_exist')).toBeUndefined();
    expect(hasMichaelResponseCatalogEntry('does_not_exist')).toBe(false);
    // And every known key resolves.
    for (const key of EXPECTED_CATALOG_KEYS) {
      expect(hasMichaelResponseCatalogEntry(key)).toBe(true);
    }
  });

  it('scopes every entry to the michael_magnificent agent key', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(entry.response.agentKey).toBe('michael_magnificent');
    }
  });

  it('scopes every entry to the training_support task type', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(entry.response.taskType).toBe('training_support');
    }
  });
});
