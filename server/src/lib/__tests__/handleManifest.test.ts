/**
 * THE CI GATE for the handle system — deterministic, no network, always runs.
 *
 * The main library is LOCAL BY DESIGN (Kevin's ruling): GitHub runners must
 * never reach the Universal Gateway, so live retrieval can never be a CI
 * gate. This suite gates what CAN be gated deterministically:
 *
 * 1. Rung-1 invocation — every call phrase and alias in the committed handle
 *    manifest resolves to its record through the REAL matching rule
 *    (`matchHandleDoc`), exactly and unambiguously. Fails if a handle is
 *    renamed, duplicated, or dropped.
 * 2. The audience boundary (compile time, fail closed) — no dev/personal
 *    handle can appear in an app-agent packet, and an unmarked record never
 *    reaches one.
 *
 * The semantic/distance assertions live in retrievalRegression.test.ts,
 * local-only behind RETRIEVAL_REGRESSION=live (`pnpm memory:verify`).
 */

import { describe, expect, it } from 'vitest';
import { HANDLE_MANIFEST, entryPhrases, toFixtureDoc, type HandleManifestEntry } from '../handleManifest.js';
import { matchHandleDoc } from '../contextPacket.js';
import { audienceOf, isVisibleToAudience } from '../memoryStores.js';

const RANK = { exact_handle: 0, exact_alias: 1, use_when: 2 } as const;

/** Rung-1 resolution against the committed fixture: best-ranked match wins. */
function resolveAgainstFixture(phrase: string): { entry: HandleManifestEntry; matchKind: keyof typeof RANK }[] {
  const matches: { entry: HandleManifestEntry; matchKind: keyof typeof RANK }[] = [];
  for (const entry of HANDLE_MANIFEST) {
    const matchKind = matchHandleDoc(toFixtureDoc(entry), phrase);
    if (matchKind) matches.push({ entry, matchKind });
  }
  const best = Math.min(...matches.map((m) => RANK[m.matchKind]));
  return matches.filter((m) => RANK[m.matchKind] === best);
}

describe('handle manifest — rung-1 invocation is deterministic (CI gate, no network)', () => {
  it('has at least the five Kevin-named handles', () => {
    expect(HANDLE_MANIFEST.length).toBeGreaterThanOrEqual(5);
  });

  for (const entry of HANDLE_MANIFEST) {
    for (const phrase of entryPhrases(entry)) {
      it(`'${phrase}' resolves to ${entry.recordId} by exact invocation`, () => {
        const winners = resolveAgainstFixture(phrase);
        expect(winners).toHaveLength(1);
        expect(winners[0]!.entry.recordId).toBe(entry.recordId);
        // Exact, not a useWhen substring — a renamed handle fails here.
        expect(['exact_handle', 'exact_alias']).toContain(winners[0]!.matchKind);
      });
    }
  }

  it('no phrase is claimed by two handles — a duplicated handle is a broken handle', () => {
    const seen = new Map<string, string>();
    for (const entry of HANDLE_MANIFEST) {
      for (const phrase of entryPhrases(entry)) {
        const key = phrase.trim().toLowerCase();
        const prior = seen.get(key);
        expect(prior, `phrase '${phrase}' claimed by both ${prior} and ${entry.recordId}`).toBeUndefined();
        seen.set(key, entry.recordId);
      }
    }
  });

  it('every handle carries Kevin as namer and an explicit audience', () => {
    for (const entry of HANDLE_MANIFEST) {
      expect(entry.namedBy.toLowerCase()).toContain('kevin');
      expect(['dev_agents', 'app_agents', 'both']).toContain(entry.audience);
    }
  });
});

describe('audience boundary — compile time, fail closed (CI gate, no network)', () => {
  it('no dev/personal handle can appear in an app-agent packet', () => {
    for (const entry of HANDLE_MANIFEST) {
      const doc = toFixtureDoc(entry);
      const visibleToApp = isVisibleToAudience(audienceOf(doc), 'app_agents');
      if (entry.audience === 'dev_agents') {
        expect(visibleToApp, `dev handle ${entry.recordId} leaked into an app-agent packet`).toBe(false);
      }
      // Dev agents (Kevin/Claude/Codex) get everything.
      expect(isVisibleToAudience(audienceOf(doc), 'dev_agents')).toBe(true);
    }
  });

  it('an unmarked record never reaches an app-agent packet — absent audience fails closed to dev_agents', () => {
    const unmarked: Record<string, unknown> = { _id: 'unmarked_entry', call_phrase: 'unmarked entry' };
    expect(audienceOf(unmarked)).toBe('dev_agents');
    expect(isVisibleToAudience(audienceOf(unmarked), 'app_agents')).toBe(false);
    expect(isVisibleToAudience(audienceOf(unmarked), 'dev_agents')).toBe(true);
  });

  it('an unknown audience value also fails closed — never app_agents', () => {
    expect(audienceOf({ audience: 'everyone' })).toBe('dev_agents');
    expect(audienceOf({ audience: 42 })).toBe('dev_agents');
    expect(audienceOf({ audience: 'APP_AGENTS ' })).toBe('app_agents'); // case/space tolerant, still explicit
    expect(audienceOf({ audience: '' })).toBe('dev_agents');
  });

  it('only explicitly marked app_agents/both records are visible to app agents', () => {
    expect(isVisibleToAudience('app_agents', 'app_agents')).toBe(true);
    expect(isVisibleToAudience('both', 'app_agents')).toBe(true);
    expect(isVisibleToAudience('dev_agents', 'app_agents')).toBe(false);
    // dev requester sees all three
    expect(isVisibleToAudience('app_agents', 'dev_agents')).toBe(true);
    expect(isVisibleToAudience('both', 'dev_agents')).toBe(true);
    expect(isVisibleToAudience('dev_agents', 'dev_agents')).toBe(true);
  });
});
