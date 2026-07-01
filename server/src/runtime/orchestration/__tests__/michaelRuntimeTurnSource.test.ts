import { describe, expect, it } from 'vitest';
import {
  createMichaelRuntimeTurnForAuthenticatedBa,
  resolveMichaelRuntimeTurnResponse,
} from '../index.js';
import type {
  CreateMichaelRuntimeTurnForAuthenticatedBaInput,
  CreateMichaelRuntimeTurnForAuthenticatedBaResult,
  MichaelRuntimeResolutionResult,
} from '../index.js';

/**
 * S3.10 — Agent C tests for the server-owned Michael runtime turn source
 * (`createMichaelRuntimeTurnForAuthenticatedBa`). It is the future replacement
 * for the route's client-supplied `body.turn`. These tests prove it is:
 *
 *  - server-owned / session-scoped — BA scope comes from `input.tmagId` only;
 *  - fail-closed — missing tmagId / unsupported language|mode return typed issues,
 *    never throw, never emit a turn;
 *  - inert — produced turn has `agentResponseGenerated === false` and every
 *    persistence axis `'disabled'`;
 *  - FACADE-COMPATIBLE — the produced adapter input resolves cleanly through the
 *    S2.20 inert facade to the pre-authored degraded `safe_fallback` fixture.
 *
 * Returned-only; nothing here mutates production state or persists.
 */

const SESSION_BA_ID = 'TMAG-20240101-ABCDEF';

function expectOk(
  result: CreateMichaelRuntimeTurnForAuthenticatedBaResult,
): asserts result is Extract<CreateMichaelRuntimeTurnForAuthenticatedBaResult, { ok: true }> {
  expect(result.ok).toBe(true);
}

function expectFacadeOk(
  result: MichaelRuntimeResolutionResult,
): asserts result is Extract<MichaelRuntimeResolutionResult, { ok: true }> {
  expect(result.ok).toBe(true);
}

describe('S3.10 Michael runtime turn source — createMichaelRuntimeTurnForAuthenticatedBa', () => {
  it('1. accepts a session-derived BA identity and returns { ok:true, input }', async () => {
    const result = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: SESSION_BA_ID });

    expectOk(result);
    expect(result.input).toBeDefined();
    expect(result.input.identity).toBeDefined();
    expect(result.input.turnId).toBeDefined();
    expect(result.input.runtimeTurn).toBeDefined();
  });

  it('2. rejects a missing tmagId with { ok:false, issues } and never throws', async () => {
    let result: CreateMichaelRuntimeTurnForAuthenticatedBaResult | undefined;
    await expect(
      (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        result = await createMichaelRuntimeTurnForAuthenticatedBa({} as any);
      })(),
    ).resolves.toBeUndefined();

    expect(result).toBeDefined();
    expect(result!.ok).toBe(false);
    if (!result!.ok) {
      expect(result!.issues.length).toBeGreaterThan(0);
      const baIssue = result!.issues.find((i) => i.path === 'tmagId');
      expect(baIssue).toBeDefined();
      expect(baIssue!.code).toBe('missing_session_ba_id');
    }
  });

  it('3. rejects an empty/whitespace tmagId (fails closed, does not throw)', async () => {
    const result = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: '   ' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.path === 'tmagId')).toBe(true);
    }
  });

  it('4. identity scope tmagId === the session tmagId passed in (rejection of body authority is by-construction)', async () => {
    const result = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: SESSION_BA_ID });

    expectOk(result);
    // The function reads ONLY input.tmagId — the produced scope is anchored to it.
    expect(result.input.identity.scope.tmagId).toBe(SESSION_BA_ID);
  });

  it('5. ignores any extra/body-authority props — only input.tmagId is read (sponsorTmagId/targetTmagId/token have no path)', async () => {
    const polluted = {
      tmagId: SESSION_BA_ID,
      // None of these exist on the input type; passed via `as` to prove the
      // function reads only `tmagId` and cannot be steered by body authority.
      sponsorTmagId: 'TMAG-EVIL-000001',
      targetTmagId: 'TMAG-EVIL-000002',
      downlineTmagId: 'TMAG-EVIL-000003',
      token: 'prospect-token-xyz',
    } as unknown as CreateMichaelRuntimeTurnForAuthenticatedBaInput;

    const result = await createMichaelRuntimeTurnForAuthenticatedBa(polluted);

    expectOk(result);
    // The scope tmagId is the session tmagId — never any of the injected ids.
    expect(result.input.identity.scope.tmagId).toBe(SESSION_BA_ID);
    const serialized = JSON.stringify(result.input);
    expect(serialized).not.toContain('TMAG-EVIL-000001');
    expect(serialized).not.toContain('TMAG-EVIL-000002');
    expect(serialized).not.toContain('TMAG-EVIL-000003');
    expect(serialized).not.toContain('prospect-token-xyz');
  });

  it('6. produced input carries agentKey michael_magnificent and taskType training_support', async () => {
    const result = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: SESSION_BA_ID });

    expectOk(result);
    expect(result.input.identity.agentKey).toBe('michael_magnificent');
    expect(result.input.taskType).toBe('training_support');
  });

  it('7. runtimeTurn invariants: agentResponseGenerated === false and every persistence axis disabled', async () => {
    const result = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: SESSION_BA_ID });

    expectOk(result);
    const turn = result.input.runtimeTurn;
    expect(turn.agentResponseGenerated).toBe(false);
    expect(turn.metadata.agentResponseGenerated).toBe(false);
    expect(turn.metadata.persistence).toBe('disabled');
    expect(turn.eventPersistence).toBe('disabled');
    expect(turn.outcomePersistence).toBe('disabled');
    expect(turn.guidedActionPersistence).toBe('disabled');
    expect(turn.envelopePersistence).toBe('disabled');
  });

  it('8. FACADE COMPATIBILITY: the ok:true input resolves through resolveMichaelRuntimeTurnResponse to the degraded safe_fallback fixture', async () => {
    const source = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: SESSION_BA_ID });
    expectOk(source);

    const resolved = resolveMichaelRuntimeTurnResponse(source.input);

    expectFacadeOk(resolved);
    // Degraded, store-free, empty-knowledge packet -> the pre-authored
    // safe_fallback fixture (EN). Observed catalogKey asserted explicitly.
    expect(resolved.catalogKey).toBe('michael_safe_fallback_degraded_en');
    expect(resolved.response.responseType).toBe('safe_fallback');
    expect(resolved.response.agentResponseGenerated).toBe(false);
    expect(resolved.response.persistence).toBe('disabled');
    expect(resolved.trace.persistence).toBe('disabled');
    expect(resolved.selectionRequest.agentKey).toBe('michael_magnificent');
    expect(resolved.selectionRequest.taskType).toBe('training_support');
  });

  it('9. FACADE COMPATIBILITY (es): an es session resolves to the es safe_fallback sibling', async () => {
    const source = await createMichaelRuntimeTurnForAuthenticatedBa({
      tmagId: SESSION_BA_ID,
      language: 'es',
    });
    expectOk(source);
    expect(source.input.language).toBe('es');

    const resolved = resolveMichaelRuntimeTurnResponse(source.input);

    expectFacadeOk(resolved);
    expect(resolved.catalogKey.endsWith('_es')).toBe(true);
    expect(resolved.response.responseType).toBe('safe_fallback');
    expect(resolved.response.language).toBe('es');
  });

  it('10. fail-closed: an unsupported language returns typed issues {path,code,message} and never throws', async () => {
    let result: CreateMichaelRuntimeTurnForAuthenticatedBaResult | undefined;
    await expect(
      (async () => {
        result = await createMichaelRuntimeTurnForAuthenticatedBa({
          tmagId: SESSION_BA_ID,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          language: 'fr' as any,
        });
      })(),
    ).resolves.toBeUndefined();

    expect(result).toBeDefined();
    expect(result!.ok).toBe(false);
    if (!result!.ok) {
      const issue = result!.issues.find((i) => i.path === 'language');
      expect(issue).toBeDefined();
      expect(issue!.code).toBe('unsupported_language');
      expect(typeof issue!.message).toBe('string');
      expect(issue!.message.length).toBeGreaterThan(0);
    }
  });

  it('11. fail-closed: an unsupported mode returns typed issues and never throws', async () => {
    const result = await createMichaelRuntimeTurnForAuthenticatedBa({
      tmagId: SESSION_BA_ID,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mode: 'telephony' as any,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      const issue = result.issues.find((i) => i.path === 'mode');
      expect(issue).toBeDefined();
      expect(issue!.code).toBe('unsupported_mode');
    }
  });

  it('12. determinism: two calls with the same identity produce structurally equivalent adapter input (modulo generated ids)', async () => {
    const a = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: SESSION_BA_ID });
    const b = await createMichaelRuntimeTurnForAuthenticatedBa({ tmagId: SESSION_BA_ID });

    expectOk(a);
    expectOk(b);

    // Stable projection: everything that is NOT a per-call generated id/timestamp.
    const stable = (
      r: Extract<CreateMichaelRuntimeTurnForAuthenticatedBaResult, { ok: true }>,
    ) => ({
      scope: r.input.identity.scope,
      agentKey: r.input.identity.agentKey,
      mode: r.input.identity.mode,
      language: r.input.identity.language,
      taskType: r.input.taskType,
      topLanguage: r.input.language,
      scenario: r.input.runtimeTurn.scenario,
      metadata: r.input.runtimeTurn.metadata,
      agentResponseGenerated: r.input.runtimeTurn.agentResponseGenerated,
      eventPersistence: r.input.runtimeTurn.eventPersistence,
      outcomePersistence: r.input.runtimeTurn.outcomePersistence,
      guidedActionPersistence: r.input.runtimeTurn.guidedActionPersistence,
      envelopePersistence: r.input.runtimeTurn.envelopePersistence,
      decision: r.input.runtimeTurn.result.decision,
    });

    expect(stable(a)).toStrictEqual(stable(b));

    // And both resolve to the SAME catalog fixture through the facade.
    const ra = resolveMichaelRuntimeTurnResponse(a.input);
    const rb = resolveMichaelRuntimeTurnResponse(b.input);
    expectFacadeOk(ra);
    expectFacadeOk(rb);
    expect(ra.catalogKey).toBe(rb.catalogKey);
  });
});
