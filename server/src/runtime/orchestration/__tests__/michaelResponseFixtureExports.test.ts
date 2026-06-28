import { describe, expect, it } from 'vitest';
// S2.17 — the four Spanish (`es`) safe-path fixtures are now re-exported from
// the orchestration barrel (`../index.js`), giving them API-surface symmetry
// with their English (`en`) counterparts. This spec pins that reachability:
// every import below comes FROM THE BARREL, never the underlying fixtures
// module — that is the behavior under test.
import {
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  michaelResponseFixtureSafeCloseFailedContextPacket,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacket,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  validateMichaelResponseContract,
} from '../index.js';
import type { MichaelResponseContractV1 } from '../types.js';

// Automatic-action language must never appear in inert safe-path fixture text —
// Michael is BA-facing and never triggers external side effects on its own.
const AUTOMATIC_ACTION_LANGUAGE_PATTERN =
  /auto-?send|send automatically|call automatically|schedule automatically|auto-?call|dial/i;

const esFixtures = [
  { name: 'safe_fallback / degraded / es', fixture: michaelResponseFixtureSafeFallbackDegradedContextPacketEs },
  { name: 'safe_fallback / missing / es', fixture: michaelResponseFixtureSafeFallbackMissingContextPacketEs },
  { name: 'safe_close / failed / es', fixture: michaelResponseFixtureSafeCloseFailedContextPacketEs },
  { name: 'safe_close / rejected / es', fixture: michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs },
] as const satisfies readonly { name: string; fixture: MichaelResponseContractV1 }[];

const esSafeCloseFixtures = [
  { name: 'safe_close / failed / es', fixture: michaelResponseFixtureSafeCloseFailedContextPacketEs },
  { name: 'safe_close / rejected / es', fixture: michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs },
] as const satisfies readonly { name: string; fixture: MichaelResponseContractV1 }[];

const esSafeFallbackFixtures = [
  { name: 'safe_fallback / degraded / es', fixture: michaelResponseFixtureSafeFallbackDegradedContextPacketEs },
  { name: 'safe_fallback / missing / es', fixture: michaelResponseFixtureSafeFallbackMissingContextPacketEs },
] as const satisfies readonly { name: string; fixture: MichaelResponseContractV1 }[];

// EN ↔ ES symmetry pairs: same responseType + contextPacketStatus, language flips en→es.
const symmetryPairs = [
  {
    name: 'degraded',
    en: michaelResponseFixtureSafeFallbackDegradedContextPacket,
    es: michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  },
  {
    name: 'missing',
    en: michaelResponseFixtureSafeFallbackMissingContextPacket,
    es: michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  },
  {
    name: 'failed',
    en: michaelResponseFixtureSafeCloseFailedContextPacket,
    es: michaelResponseFixtureSafeCloseFailedContextPacketEs,
  },
  {
    name: 'rejected',
    en: michaelResponseFixtureSafeCloseCandidateReviewOnlyRejection,
    es: michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  },
] as const satisfies readonly {
  name: string;
  en: MichaelResponseContractV1;
  es: MichaelResponseContractV1;
}[];

describe('S2.17 Michael ES fixture export symmetry', () => {
  it('exports the four ES safe-path fixtures from the orchestration barrel', () => {
    for (const { name, fixture } of esFixtures) {
      expect(fixture, `${name} should be reachable from ../index.js`).toBeDefined();
    }
  });

  it('validates every ES safe-path fixture against the Michael response contract', () => {
    for (const { name, fixture } of esFixtures) {
      const validation = validateMichaelResponseContract(fixture);
      expect(validation.ok, `${name} should validate`).toBe(true);
    }
  });

  it('keeps every ES safe-path fixture in Spanish', () => {
    for (const { name, fixture } of esFixtures) {
      expect(fixture.language, `${name} language`).toBe('es');
    }
  });

  it('keeps every ES safe-path fixture inert: agentResponseGenerated === false', () => {
    for (const { name, fixture } of esFixtures) {
      expect(fixture.agentResponseGenerated, `${name} agentResponseGenerated`).toBe(false);
    }
  });

  it('keeps every ES safe-path fixture inert: persistence === disabled', () => {
    for (const { name, fixture } of esFixtures) {
      expect(fixture.persistence, `${name} persistence`).toBe('disabled');
    }
  });

  it('omits nextStep on the two ES safe_close fixtures', () => {
    for (const { name, fixture } of esSafeCloseFixtures) {
      expect(fixture.nextStep, `${name} nextStep`).toBeUndefined();
    }
  });

  it('omits nextStep and automatic-action language on the two ES safe_fallback fixtures', () => {
    for (const { name, fixture } of esSafeFallbackFixtures) {
      expect(fixture.nextStep, `${name} nextStep`).toBeUndefined();
      expect(
        AUTOMATIC_ACTION_LANGUAGE_PATTERN.test(fixture.text),
        `${name} text must omit automatic-action language`,
      ).toBe(false);
    }
  });

  it('mirrors each EN safe-path fixture with an ES counterpart of the same shape', () => {
    for (const { name, en, es } of symmetryPairs) {
      expect(en.language, `${name} EN language`).toBe('en');
      expect(es.language, `${name} ES language`).toBe('es');
      expect(es.responseType, `${name} responseType symmetry`).toBe(en.responseType);
      expect(es.contextPacketStatus, `${name} contextPacketStatus symmetry`).toBe(
        en.contextPacketStatus,
      );
    }
  });
});
