import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  validateMichaelResponseCatalog,
  validateMichaelResponseContract,
} from '../index.js';

// ───────────────────────────────────────────────────────────────────────────
// S2.17 — Michael response catalog: contract-validation & guardrail tests.
// Every catalog entry must validate as michael_response_contract.v1, keep
// persistence disabled, never claim agent-generated output, carry no nextStep
// on a safe path, and emit no automatic-action or income language. All checks
// run against the pre-authored catalog only — no live services, no DB, no LLM.
// ───────────────────────────────────────────────────────────────────────────

const AUTOMATIC_ACTION_PATTERN =
  /auto-?send|send automatically|call automatically|schedule automatically|auto-?call|dial/i;

// A literal income figure such as "$5" / "$1,200". Income/earnings claims are
// forbidden across every surface; the catalog must never carry one.
const INCOME_DIGIT_PATTERN = /\$\s?\d/;

describe('S2.17 Michael response catalog — contract validation & guardrails', () => {
  it('validates every catalog entry against michael_response_contract.v1', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      const result = validateMichaelResponseContract(entry.response);
      expect(
        result.ok,
        result.ok ? '' : `${entry.catalogKey}: ${result.issues.map((i) => i.code).join(', ')}`,
      ).toBe(true);
    }
  });

  it('keeps response.agentResponseGenerated === false on every entry', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(entry.response.agentResponseGenerated).toBe(false);
    }
  });

  it('keeps response.persistence === "disabled" on every entry', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(entry.response.persistence).toBe('disabled');
    }
  });

  it('carries no nextStep on safe-close entries', () => {
    const safeCloseEntries = MICHAEL_RESPONSE_CATALOG.filter(
      (entry) => entry.isSafePath && entry.responseType === 'safe_close',
    );

    // Four safe-close entries: EN/ES failed + EN/ES rejected.
    expect(safeCloseEntries).toHaveLength(4);
    for (const entry of safeCloseEntries) {
      expect(entry.response.nextStep).toBeUndefined();
    }
  });

  it('emits no automatic-action language in safe-fallback entries', () => {
    const safeFallbackEntries = MICHAEL_RESPONSE_CATALOG.filter(
      (entry) => entry.responseType === 'safe_fallback',
    );

    // Four safe-fallback entries: EN/ES degraded + EN/ES missing.
    expect(safeFallbackEntries).toHaveLength(4);
    for (const entry of safeFallbackEntries) {
      expect(entry.response.text).not.toMatch(AUTOMATIC_ACTION_PATTERN);
    }
  });

  it('reports a clean validateMichaelResponseCatalog() result (ok, no issues, 12 entries)', () => {
    const result = validateMichaelResponseCatalog();
    expect(
      result.ok,
      result.ok ? '' : result.issues.map((i) => `${i.catalogKey}:${i.code}`).join(', '),
    ).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.entryCount).toBe(12);
  });

  it('carries non-empty text with no literal income figure on any entry', () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(typeof entry.response.text).toBe('string');
      expect(entry.response.text.length).toBeGreaterThan(0);
      expect(entry.response.text).not.toMatch(INCOME_DIGIT_PATTERN);
    }
  });
});
