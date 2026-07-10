/**
 * Knowledge Evolution Runtime — Lane B error + policy-result primitives.
 *
 * Policies return `PolicyResult` (a pure decision, no throwing) so they compose and unit-test in
 * isolation. Services turn a violation into a thrown `KnowledgeEvolutionRuntimeError`, whose shape
 * mirrors the ratified error model (spec §30.2): a machine `errorType`, an internal `message`, an
 * externally-safe `safeMessage`, and a `retryable` flag. No persistence, no I/O here.
 */

import type { KnowledgeEvolutionErrorType } from '@momentum/shared/runtime';

/** A single policy violation — the reason a guardrail rejected an evolution operation. */
export interface PolicyViolation {
  errorType: KnowledgeEvolutionErrorType;
  /** Internal, may reference ids/details. Never surfaced to prospects. */
  reason: string;
  /** Externally-safe message with no private detail (spec §30.2 `safeMessage`). */
  safeMessage: string;
  retryable?: boolean;
}

/** Result of evaluating a pure policy. `ok:true` passes; otherwise carries the violation. */
export type PolicyResult = { ok: true } | ({ ok: false } & PolicyViolation);

/** Convenience constructor for a passing policy result. */
export const policyOk: PolicyResult = { ok: true };

/** Convenience constructor for a failing policy result. */
export function policyFail(violation: PolicyViolation): PolicyResult {
  return { ok: false, ...violation };
}

/**
 * Thrown when an evolution operation violates a runtime guardrail. Carries the ratified
 * `errorType` so callers (Lane D routes/workers) can map to an error record + failure event.
 */
export class KnowledgeEvolutionRuntimeError extends Error {
  readonly errorType: KnowledgeEvolutionErrorType;
  readonly safeMessage: string;
  readonly retryable: boolean;

  constructor(violation: PolicyViolation) {
    super(`[knowledge-evolution] ${violation.reason}`);
    this.name = 'KnowledgeEvolutionRuntimeError';
    this.errorType = violation.errorType;
    this.safeMessage = violation.safeMessage;
    this.retryable = violation.retryable ?? false;
  }

  /** Rebuild a violation object from this error (for error-record persistence). */
  toViolation(): PolicyViolation {
    return {
      errorType: this.errorType,
      reason: this.message.replace('[knowledge-evolution] ', ''),
      safeMessage: this.safeMessage,
      retryable: this.retryable,
    };
  }
}

/** Throw if a policy result is a failure; otherwise return void. */
export function assertPolicy(result: PolicyResult): void {
  if (!result.ok) {
    throw new KnowledgeEvolutionRuntimeError(result);
  }
}
