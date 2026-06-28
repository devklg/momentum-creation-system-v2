import { describe, expect, it } from 'vitest';
import {
  MICHAEL_RESPONSE_CATALOG,
  invalidMichaelResponseFixtures,
  michaelResponseFixtureClarificationQuestionEn,
  michaelResponseFixtureClarificationQuestionEs,
  michaelResponseFixtureNextTrainingStepEs,
  michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
  michaelResponseFixtureSafeCloseFailedContextPacketEs,
  michaelResponseFixtureSafeFallbackDegradedContextPacket,
  michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
  michaelResponseFixtureSafeFallbackMissingContextPacketEs,
  resolveMichaelRuntimeTurnResponseFromFixture,
  validMichaelResponseFixtures,
  validateMichaelResponseCatalog,
  validateMichaelResponseContract,
} from '../index.js';
import { runRuntimeTurnFixtureScenario } from '../fixtures/runtimeTurnHarness.js';

// ───────────────────────────────────────────────────────────────────────────
// S3.3 — Spanish (`es`) lexical guardrail coverage for
// validateMichaelResponseContract. The Spanish guardrails are ALREADY
// implemented in michaelResponseContract.ts (diacritic-/case-normalized ES
// prohibited-term scan + ES safe-close substantive-guidance guard). These tests
// PROVE the behavior end-to-end using pre-authored fixtures only — no live
// services, no DB, no LLM, no production-code change.
//
// Invalid candidates are built by cloning a contract-valid fixture and
// overriding `text` (plus responseType/contextPacketStatus only when exercising
// the safe-close guard). The fixtures themselves are never mutated.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Clone a valid fixture, override its text (and any extra fields), and validate.
 * The original fixture object is never mutated.
 */
function validateWithText(
  base: (typeof validMichaelResponseFixtures)[number],
  text: string,
  overrides: Record<string, unknown> = {},
) {
  return validateMichaelResponseContract({ ...base, text, ...overrides });
}

function hasProhibitedTextIssue(
  result: ReturnType<typeof validateMichaelResponseContract>,
): boolean {
  return !result.ok && result.issues.some((i) => i.code === 'prohibited_text');
}

const ES_PROHIBITED_TERM_CASES: ReadonlyArray<{ term: string; text: string }> = [
  { term: 'ingresos', text: 'Hablemos de los ingresos del equipo.' },
  { term: 'ganancias', text: 'Hay muchas ganancias disponibles para ti.' },
  { term: 'comisión', text: 'Tu comisión del mes será alta.' },
  { term: 'compensación', text: 'El plan de compensación es muy bueno.' },
  { term: 'colocación', text: 'Tu colocación en el equipo ya está lista.' },
  { term: 'garantizado', text: 'El resultado está garantizado para ti.' },
  { term: 'médico', text: 'Deberías consultar a un médico primero.' },
  { term: 'salud', text: 'Esto va a mejorar tu salud rápidamente.' },
  { term: 'prospecto', text: 'Habla directamente con tu prospecto ahora.' },
  { term: 'automático', text: 'Este es un proceso totalmente automático.' },
  { term: 'llamar', text: 'Voy a llamar a todos por ti hoy.' },
  { term: 'enviar', text: 'Quiero enviar el mensaje por ti ahora.' },
];

describe('S3.3 Michael response contract — Spanish (es) lexical guardrails', () => {
  describe('1–12 rejects a substantive candidate containing each ES prohibited term', () => {
    for (const { term, text } of ES_PROHIBITED_TERM_CASES) {
      it(`rejects clarification_question text containing "${term}"`, () => {
        const result = validateWithText(michaelResponseFixtureClarificationQuestionEn, text);
        expect(result.ok, `expected "${term}" to be rejected`).toBe(false);
        expect(hasProhibitedTextIssue(result), `expected prohibited_text for "${term}"`).toBe(
          true,
        );
      });
    }
  });

  it('13 rejects uppercase variants (INGRESOS, COMISIÓN)', () => {
    for (const text of ['Hablemos de INGRESOS del equipo.', 'Tu COMISIÓN será alta.']) {
      const result = validateWithText(michaelResponseFixtureClarificationQuestionEn, text);
      expect(result.ok, text).toBe(false);
      expect(hasProhibitedTextIssue(result), text).toBe(true);
    }
  });

  it('14 rejects both diacritic and non-diacritic variants (comision/comisión, medico/médico)', () => {
    for (const text of [
      'Tu comision sera alta.',
      'Tu comisión será alta.',
      'Consulta a un medico primero.',
      'Consulta a un médico primero.',
    ]) {
      const result = validateWithText(michaelResponseFixtureClarificationQuestionEn, text);
      expect(result.ok, text).toBe(false);
      expect(hasProhibitedTextIssue(result), text).toBe(true);
    }
  });

  it('15 rejects safe_close Spanish substantive training guidance', () => {
    const result = validateWithText(
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
      'Abre el módulo de entrenamiento y completa la lección.',
    );
    expect(result.ok).toBe(false);
    expect(hasProhibitedTextIssue(result)).toBe(true);
  });

  it('16 rejects safe_fallback Spanish automatic-action wording', () => {
    const result = validateWithText(
      michaelResponseFixtureSafeFallbackDegradedContextPacket,
      'Voy a enviar mensajes automáticamente y llamar a tus prospectos de forma automática.',
      { responseType: 'safe_fallback', contextPacketStatus: 'degraded' },
    );
    expect(result.ok).toBe(false);
    expect(hasProhibitedTextIssue(result)).toBe(true);
  });

  it('17 still passes every valid ES fixture (incl. past-tense "se envió nada" safe_close)', () => {
    const esFixtures = [
      michaelResponseFixtureNextTrainingStepEs,
      michaelResponseFixtureClarificationQuestionEs,
      michaelResponseFixtureSafeFallbackDegradedContextPacketEs,
      michaelResponseFixtureSafeFallbackMissingContextPacketEs,
      michaelResponseFixtureSafeCloseFailedContextPacketEs,
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
    ];
    expect(esFixtures).toHaveLength(6);
    for (const fixture of esFixtures) {
      const result = validateMichaelResponseContract(fixture);
      expect(
        result.ok,
        result.ok ? '' : result.issues.map((i) => i.code).join(', '),
      ).toBe(true);
    }

    // Past-tense statement "No se guardó ni se envió nada." must NOT be blocked
    // (mirrors EN not blocking "sent").
    expect(michaelResponseFixtureSafeCloseFailedContextPacketEs.text).toContain('se envió nada');
    expect(validateMichaelResponseContract(michaelResponseFixtureSafeCloseFailedContextPacketEs).ok).toBe(
      true,
    );
  });

  it('18 still passes every valid EN fixture', () => {
    const enFixtures = validMichaelResponseFixtures.filter((f) => f.language === 'en');
    expect(enFixtures.length).toBeGreaterThan(0);
    for (const fixture of enFixtures) {
      const result = validateMichaelResponseContract(fixture);
      expect(
        result.ok,
        result.ok ? '' : result.issues.map((i) => i.code).join(', '),
      ).toBe(true);
    }
  });

  it('19 still fails every invalid fixture', () => {
    for (const fixture of invalidMichaelResponseFixtures) {
      expect(validateMichaelResponseContract(fixture).ok).toBe(false);
    }
  });

  it('20 still validates the full MICHAEL_RESPONSE_CATALOG (ok, 12 entries, each response valid)', () => {
    const result = validateMichaelResponseCatalog();
    expect(
      result.ok,
      result.ok ? '' : result.issues.map((i) => `${i.catalogKey}:${i.code}`).join(', '),
    ).toBe(true);
    expect(result.entryCount).toBe(12);

    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(validateMichaelResponseContract(entry.response).ok, entry.catalogKey).toBe(true);
    }
  });

  it('21 facade returns only validated fixtures across resolved runtime turns', async () => {
    const scenarios = ['accepted_complete', 'accepted_degraded', 'failed_context'] as const;
    let resolvedCount = 0;
    for (const scenario of scenarios) {
      const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario });
      const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
      if (!result.ok) continue;
      resolvedCount += 1;
      expect(validateMichaelResponseContract(result.response).ok, scenario).toBe(true);
    }
    expect(resolvedCount, 'at least one scenario resolved').toBeGreaterThan(0);
  });

  it('22 keeps agentResponseGenerated false on resolved responses and catalog entries', async () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(entry.response.agentResponseGenerated, entry.catalogKey).toBe(false);
    }

    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });
    const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.agentResponseGenerated).toBe(false);
    }
  });

  it('23 keeps persistence "disabled" on resolved responses and catalog entries', async () => {
    for (const entry of MICHAEL_RESPONSE_CATALOG) {
      expect(entry.response.persistence, entry.catalogKey).toBe('disabled');
    }

    const runtimeTurn = await runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete' });
    const result = resolveMichaelRuntimeTurnResponseFromFixture({ runtimeTurn });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.persistence).toBe('disabled');
    }
  });

  it('24 introduces no dynamic generation — catalog responses are the verbatim fixtures by reference', () => {
    const byKey = new Map(MICHAEL_RESPONSE_CATALOG.map((e) => [e.catalogKey, e]));
    expect(byKey.get('michael_clarification_question_es')?.response).toBe(
      michaelResponseFixtureClarificationQuestionEs,
    );
    expect(byKey.get('michael_safe_close_failed_es')?.response).toBe(
      michaelResponseFixtureSafeCloseFailedContextPacketEs,
    );
    expect(byKey.get('michael_safe_close_rejected_es')?.response).toBe(
      michaelResponseFixtureSafeCloseCandidateReviewOnlyRejectionEs,
    );
  });
});
