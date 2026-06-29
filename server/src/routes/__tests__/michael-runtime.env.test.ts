/**
 * S3.4 — Michael runtime route feature-flag helper tests (Agent C).
 *
 * PURE flag-helper coverage (no req/res). Verifies the three-axis kill switch
 * is default-OFF, fail-closed, exact-"true"-only, and read at CALL TIME from
 * process.env (never memoized, never sourced from a request).
 *
 * Env hygiene: every test starts from a clean slate (all three vars deleted in
 * beforeEach) and the original process.env values are restored exactly in
 * afterEach (deleted if originally undefined). No env leakage across tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  michaelRuntimeResponseEnabled,
  michaelRuntimeRouteEnabled,
  michaelRuntimeTraceEnabled,
} from '../../config/michaelRuntimeFlags.js';

const ENV_VARS = [
  'MICHAEL_RUNTIME_ROUTE_ENABLED',
  'MICHAEL_RUNTIME_RESPONSE_ENABLED',
  'MICHAEL_RUNTIME_TRACE_ENABLED',
] as const;

type EnvVarName = (typeof ENV_VARS)[number];

const HELPERS: ReadonlyArray<{ name: EnvVarName; helper: () => boolean }> = [
  { name: 'MICHAEL_RUNTIME_ROUTE_ENABLED', helper: michaelRuntimeRouteEnabled },
  { name: 'MICHAEL_RUNTIME_RESPONSE_ENABLED', helper: michaelRuntimeResponseEnabled },
  { name: 'MICHAEL_RUNTIME_TRACE_ENABLED', helper: michaelRuntimeTraceEnabled },
];

// Values that are NOT the exact string "true" and must therefore be disabled.
const MALFORMED_VALUES = [' true ', '1', 'yes', 'True', '0', 'TRUE', 'false', ''] as const;

let snapshot: Record<EnvVarName, string | undefined>;

beforeEach(() => {
  snapshot = {
    MICHAEL_RUNTIME_ROUTE_ENABLED: process.env.MICHAEL_RUNTIME_ROUTE_ENABLED,
    MICHAEL_RUNTIME_RESPONSE_ENABLED: process.env.MICHAEL_RUNTIME_RESPONSE_ENABLED,
    MICHAEL_RUNTIME_TRACE_ENABLED: process.env.MICHAEL_RUNTIME_TRACE_ENABLED,
  };
  for (const name of ENV_VARS) {
    delete process.env[name];
  }
});

afterEach(() => {
  for (const name of ENV_VARS) {
    const original = snapshot[name];
    if (original === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = original;
    }
  }
});

describe('S3.4 Michael runtime flag helpers — pure, fail-closed, exact "true"', () => {
  for (const { name, helper } of HELPERS) {
    describe(name, () => {
      it('1. returns false when the env var is unset', () => {
        expect(process.env[name]).toBeUndefined();
        expect(helper()).toBe(false);
      });

      it('2. returns false for empty string', () => {
        process.env[name] = '';
        expect(helper()).toBe(false);
      });

      it('3. returns false for "false"', () => {
        process.env[name] = 'false';
        expect(helper()).toBe(false);
      });

      it('4. returns false for "TRUE" (exact "true" only)', () => {
        process.env[name] = 'TRUE';
        expect(helper()).toBe(false);
      });

      it('5. returns true for the exact string "true"', () => {
        process.env[name] = 'true';
        expect(helper()).toBe(true);
      });

      it('6. returns false for every malformed/near-miss value', () => {
        for (const value of MALFORMED_VALUES) {
          process.env[name] = value;
          expect(helper(), `value=${JSON.stringify(value)}`).toBe(false);
        }
      });

      it('7. reads process.env at call time (set -> true, then delete -> false in one test)', () => {
        process.env[name] = 'true';
        expect(helper()).toBe(true);

        delete process.env[name];
        expect(helper()).toBe(false);
      });
    });
  }

  it('8. default state (all three unset) -> all helpers false', () => {
    for (const name of ENV_VARS) {
      expect(process.env[name]).toBeUndefined();
    }
    expect(michaelRuntimeRouteEnabled()).toBe(false);
    expect(michaelRuntimeResponseEnabled()).toBe(false);
    expect(michaelRuntimeTraceEnabled()).toBe(false);
  });
});
