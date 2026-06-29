/**
 * S3.6 — Michael runtime route observability (in-memory aggregate counters ONLY).
 *
 * In-memory only: plain module-level integer counters. NO persistence, NO file
 * writes, NO MongoDB/Neo4j/ChromaDB/GraphRAG/Gateway, NO LLM. Counters reset to
 * zero on every process restart. Aggregate counts ONLY — this module stores no
 * request body, no response body, no trace, no Context Packet, no PII, and no
 * tokens or session/turn/correlation IDs.
 *
 * Flag booleans in the snapshot are EVALUATED via the canonical flag functions
 * at call time, never sourced from raw env strings.
 */

import {
  michaelRuntimeResponseEnabled,
  michaelRuntimeRouteEnabled,
  michaelRuntimeTraceEnabled,
} from '../config/michaelRuntimeFlags.js';

/** Aggregate-only counter shape. Integer counts, nothing else. */
export interface MichaelRuntimeObservabilityCounters {
  routeDisabledSkips: number;
  responseDisabledSkips: number;
  successfulFacadeResolutions: number;
  facadeFailures: number;
  bodyBaOverrideRejections: number;
  missingTurnRejections: number;
}

/** Evaluated-flag snapshot returned to callers (counters are a defensive copy). */
export interface MichaelRuntimeObservabilitySnapshot {
  routeEnabled: boolean;
  responseEnabled: boolean;
  traceEnabled: boolean;
  counters: MichaelRuntimeObservabilityCounters;
}

const counters: MichaelRuntimeObservabilityCounters = {
  routeDisabledSkips: 0,
  responseDisabledSkips: 0,
  successfulFacadeResolutions: 0,
  facadeFailures: 0,
  bodyBaOverrideRejections: 0,
  missingTurnRejections: 0,
};

/**
 * Returns the current evaluated flag state plus a COPY of the counters. The
 * returned counters object is detached from internal state — mutating it cannot
 * affect future snapshots.
 */
export function getMichaelRuntimeObservabilitySnapshot(): MichaelRuntimeObservabilitySnapshot {
  return {
    routeEnabled: michaelRuntimeRouteEnabled(),
    responseEnabled: michaelRuntimeResponseEnabled(),
    traceEnabled: michaelRuntimeTraceEnabled(),
    counters: { ...counters },
  };
}

export function recordMichaelRuntimeRouteDisabled(): void {
  counters.routeDisabledSkips += 1;
}

export function recordMichaelRuntimeResponseDisabled(): void {
  counters.responseDisabledSkips += 1;
}

export function recordMichaelRuntimeSuccess(): void {
  counters.successfulFacadeResolutions += 1;
}

export function recordMichaelRuntimeFacadeFailure(): void {
  counters.facadeFailures += 1;
}

export function recordMichaelRuntimeBodyBaOverrideRejection(): void {
  counters.bodyBaOverrideRejections += 1;
}

export function recordMichaelRuntimeMissingTurnRejection(): void {
  counters.missingTurnRejections += 1;
}

/** Test-only reset — sets every counter back to zero. */
export function resetMichaelRuntimeObservabilityForTests(): void {
  counters.routeDisabledSkips = 0;
  counters.responseDisabledSkips = 0;
  counters.successfulFacadeResolutions = 0;
  counters.facadeFailures = 0;
  counters.bodyBaOverrideRejections = 0;
  counters.missingTurnRejections = 0;
}
