/**
 * S3.6 — Michael runtime observability module unit tests (Agent C).
 *
 * PURE module-level coverage of the in-memory aggregate counter store. Verifies:
 *   - counters initialize to 0 and reset to 0;
 *   - snapshot flag booleans are EVALUATED (exact "true" only), never raw env;
 *   - each record* helper increments exactly its own counter;
 *   - the snapshot returns a defensive COPY of the counters;
 *   - the counters object exposes ONLY the six aggregate counts — no body,
 *     response, trace, Context Packet, PII, token, or session/turn/correlation
 *     ID keys.
 *
 * Env hygiene mirrors the S3.4 flag tests: the three MICHAEL_RUNTIME_* vars are
 * snapshotted/cleared in beforeEach and restored exactly in afterEach. The
 * counter store is reset around every test so nothing leaks across cases.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getMichaelRuntimeObservabilitySnapshot,
  recordMichaelRuntimeBodyBaOverrideRejection,
  recordMichaelRuntimeFacadeFailure,
  recordMichaelRuntimeMissingTurnRejection,
  recordMichaelRuntimeResponseDisabled,
  recordMichaelRuntimeRouteDisabled,
  recordMichaelRuntimeSuccess,
  resetMichaelRuntimeObservabilityForTests,
} from '../michaelRuntimeObservability.js';

const ENV_VARS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
] as const;

type EnvVarName = (typeof ENV_VARS)[number];

const COUNTER_KEYS = [
  'routeDisabledSkips',
  'responseDisabledSkips',
  'successfulFacadeResolutions',
  'facadeFailures',
  'bodyBaOverrideRejections',
  'missingTurnRejections',
] as const;

let snapshot: Record<EnvVarName, string | undefined>;

beforeEach(() => {
  snapshot = {
    MICHAEL_RUNTIME_ROUTE_ENABLED: process.env.MICHAEL_RUNTIME_ROUTE_ENABLED,
    MICHAEL_RUNTIME_RESPONSE_ENABLED: process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED,
    MICHAEL_RUNTIME_TRACE_ENABLED: process.env.MICHAEL_RUNTIME_TRACE_ENABLED,
  };
  for (const name of ENV_VARS) delete process.env[name];
  resetMichaelRuntimeObservabilityForTests();
});

afterEach(() => {
  resetMichaelRuntimeObservabilityForTests();
  for (const name of ENV_VARS) {
    const original = snapshot[name];
    if (original === undefined) delete process.env[name];
    else process.env[name] = original;
  }
});

describe('S3.6 michaelRuntimeObservability module', () => {
  it('1. counters all initialize to 0 after reset', () => {
    const snap = getMichaelRuntimeObservabilitySnapshot();
    for (const key of COUNTER_KEYS) {
      expect(snap.counters[key]).toBe(0);
    }
  });

  it('2. flag booleans are false when env is unset', () => {
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.routeEnabled).toBe(false);
    expect(snap.responseEnabled).toBe(false);
    expect(snap.traceEnabled).toBe(false);
  });

  it('3. flag booleans are true ONLY for the exact string "true"', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'true';
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.routeEnabled).toBe(true);
    expect(snap.responseEnabled).toBe(true);
    expect(snap.traceEnabled).toBe(true);
  });

  it('4. "TRUE" / "false" / "" all evaluate to false (exact "true" only)', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'TRUE';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'false';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = '';
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.routeEnabled).toBe(false);
    expect(snap.responseEnabled).toBe(false);
    expect(snap.traceEnabled).toBe(false);
  });

  it('5. flag fields are evaluated booleans, never raw env strings', () => {
    process.env.MICHAEL_RUNTIME_ROUTE_ENABLED = 'true';
    process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED = 'TRUE';
    process.env.MICHAEL_RUNTIME_TRACE_ENABLED = 'false';
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(typeof snap.routeEnabled).toBe('boolean');
    expect(typeof snap.responseEnabled).toBe('boolean');
    expect(typeof snap.traceEnabled).toBe('boolean');
    // No raw env string leaked anywhere in the serialized snapshot.
    const serialized = JSON.stringify(snap);
    expect(serialized).not.toContain('TRUE');
    expect(serialized).not.toContain('"true"');
    expect(serialized).not.toContain('"false"');
  });

  it('6. recordMichaelRuntimeRouteDisabled increments only routeDisabledSkips', () => {
    recordMichaelRuntimeRouteDisabled();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.counters.routeDisabledSkips).toBe(1);
    expect(snap.counters.responseDisabledSkips).toBe(0);
    expect(snap.counters.successfulFacadeResolutions).toBe(0);
    expect(snap.counters.facadeFailures).toBe(0);
    expect(snap.counters.bodyBaOverrideRejections).toBe(0);
    expect(snap.counters.missingTurnRejections).toBe(0);
  });

  it('7. recordMichaelRuntimeResponseDisabled increments only responseDisabledSkips', () => {
    recordMichaelRuntimeResponseDisabled();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.counters.responseDisabledSkips).toBe(1);
    expect(snap.counters.routeDisabledSkips).toBe(0);
    expect(snap.counters.successfulFacadeResolutions).toBe(0);
    expect(snap.counters.facadeFailures).toBe(0);
    expect(snap.counters.bodyBaOverrideRejections).toBe(0);
    expect(snap.counters.missingTurnRejections).toBe(0);
  });

  it('8. recordMichaelRuntimeSuccess increments only successfulFacadeResolutions', () => {
    recordMichaelRuntimeSuccess();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.counters.successfulFacadeResolutions).toBe(1);
    expect(snap.counters.routeDisabledSkips).toBe(0);
    expect(snap.counters.responseDisabledSkips).toBe(0);
    expect(snap.counters.facadeFailures).toBe(0);
    expect(snap.counters.bodyBaOverrideRejections).toBe(0);
    expect(snap.counters.missingTurnRejections).toBe(0);
  });

  it('9. recordMichaelRuntimeFacadeFailure increments only facadeFailures', () => {
    recordMichaelRuntimeFacadeFailure();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.counters.facadeFailures).toBe(1);
    expect(snap.counters.routeDisabledSkips).toBe(0);
    expect(snap.counters.responseDisabledSkips).toBe(0);
    expect(snap.counters.successfulFacadeResolutions).toBe(0);
    expect(snap.counters.bodyBaOverrideRejections).toBe(0);
    expect(snap.counters.missingTurnRejections).toBe(0);
  });

  it('10. recordMichaelRuntimeBodyBaOverrideRejection increments only bodyBaOverrideRejections', () => {
    recordMichaelRuntimeBodyBaOverrideRejection();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.counters.bodyBaOverrideRejections).toBe(1);
    expect(snap.counters.routeDisabledSkips).toBe(0);
    expect(snap.counters.responseDisabledSkips).toBe(0);
    expect(snap.counters.successfulFacadeResolutions).toBe(0);
    expect(snap.counters.facadeFailures).toBe(0);
    expect(snap.counters.missingTurnRejections).toBe(0);
  });

  it('11. recordMichaelRuntimeMissingTurnRejection increments only missingTurnRejections', () => {
    recordMichaelRuntimeMissingTurnRejection();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(snap.counters.missingTurnRejections).toBe(1);
    expect(snap.counters.routeDisabledSkips).toBe(0);
    expect(snap.counters.responseDisabledSkips).toBe(0);
    expect(snap.counters.successfulFacadeResolutions).toBe(0);
    expect(snap.counters.facadeFailures).toBe(0);
    expect(snap.counters.bodyBaOverrideRejections).toBe(0);
  });

  it('12. repeated record* calls accumulate monotonically', () => {
    recordMichaelRuntimeSuccess();
    recordMichaelRuntimeSuccess();
    recordMichaelRuntimeSuccess();
    expect(getMichaelRuntimeObservabilitySnapshot().counters.successfulFacadeResolutions).toBe(3);
  });

  it('13. resetMichaelRuntimeObservabilityForTests zeroes every counter', () => {
    recordMichaelRuntimeRouteDisabled();
    recordMichaelRuntimeResponseDisabled();
    recordMichaelRuntimeSuccess();
    recordMichaelRuntimeFacadeFailure();
    recordMichaelRuntimeBodyBaOverrideRejection();
    recordMichaelRuntimeMissingTurnRejection();

    resetMichaelRuntimeObservabilityForTests();

    const snap = getMichaelRuntimeObservabilitySnapshot();
    for (const key of COUNTER_KEYS) {
      expect(snap.counters[key]).toBe(0);
    }
  });

  it('14. snapshot returns a COPY — mutating returned counters does not affect the next snapshot', () => {
    const first = getMichaelRuntimeObservabilitySnapshot();
    const mutable = first.counters as unknown as Record<string, number>;
    mutable.successfulFacadeResolutions = 999;
    mutable.facadeFailures = 999;

    const second = getMichaelRuntimeObservabilitySnapshot();
    expect(second.counters.successfulFacadeResolutions).toBe(0);
    expect(second.counters.facadeFailures).toBe(0);
  });

  it('15. two snapshots return distinct counter objects (defensive copy each call)', () => {
    const a = getMichaelRuntimeObservabilitySnapshot();
    const b = getMichaelRuntimeObservabilitySnapshot();
    expect(a.counters).not.toBe(b.counters);
  });

  it('16. counters object key set equals EXACTLY the six aggregate counter names', () => {
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(Object.keys(snap.counters).sort()).toEqual([...COUNTER_KEYS].sort());
  });

  it('17. snapshot top-level keys are only the three flags + counters (no body/trace/pii/token/id)', () => {
    const snap = getMichaelRuntimeObservabilitySnapshot();
    expect(Object.keys(snap).sort()).toEqual(
      ['counters', 'responseEnabled', 'routeEnabled', 'traceEnabled'].sort(),
    );
  });

  it('18. snapshot exposes no request/response/trace/PII/token/ID-shaped keys', () => {
    recordMichaelRuntimeSuccess();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    const allKeys = new Set<string>();
    const walk = (value: unknown): void => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [k, child] of Object.entries(value as Record<string, unknown>)) {
          allKeys.add(k);
          walk(child);
        }
      }
    };
    walk(snap);
    const FORBIDDEN = [
      'body',
      'request',
      'response',
      'trace',
      'packet',
      'contextPacket',
      'retrieval',
      'token',
      'sessionId',
      'turnId',
      'correlationId',
      'tmagId',
      'email',
      'phone',
      'prospect',
      'text',
      'id',
    ];
    for (const forbidden of FORBIDDEN) {
      expect(allKeys.has(forbidden)).toBe(false);
    }
  });

  it('19. every counter value is an integer count (number), not a string or object', () => {
    recordMichaelRuntimeRouteDisabled();
    const snap = getMichaelRuntimeObservabilitySnapshot();
    for (const key of COUNTER_KEYS) {
      expect(typeof snap.counters[key]).toBe('number');
      expect(Number.isInteger(snap.counters[key])).toBe(true);
    }
  });
});
