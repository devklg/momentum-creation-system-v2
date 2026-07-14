import { env } from '../env.js';

export type LlmProviderErrorKind =
  | 'config'
  | 'transport'
  | 'rate_limit'
  | 'upstream_4xx'
  | 'upstream_5xx'
  | 'malformed_response'
  | 'empty_response';

export interface LlmProviderSafeFailure {
  at: string;
  kind: LlmProviderErrorKind;
  status: number | null;
  model: string;
  attempts: number;
  retryable: boolean;
}

export interface LlmProviderSafeDegradation {
  at: string;
  templateId: string;
  reason: 'deterministic_fallback';
}

export interface LlmProviderObservabilitySnapshot {
  provider: 'anthropic';
  configured: boolean;
  state: 'dormant' | 'healthy' | 'degraded' | 'unobserved';
  counters: {
    requests: number;
    attempts: number;
    successes: number;
    failures: number;
    retries: number;
    degradations: number;
  };
  failuresByKind: Record<LlmProviderErrorKind, number>;
  lastFailure: LlmProviderSafeFailure | null;
  lastDegradation: LlmProviderSafeDegradation | null;
  lastSuccessAt: string | null;
  privacy: {
    aggregateOnly: true;
    promptContentStored: false;
    outputContentStored: false;
    credentialsStored: false;
    upstreamBodyStored: false;
  };
}

const counters = {
  requests: 0,
  attempts: 0,
  successes: 0,
  failures: 0,
  retries: 0,
  degradations: 0,
};

const failuresByKind: Record<LlmProviderErrorKind, number> = {
  config: 0,
  transport: 0,
  rate_limit: 0,
  upstream_4xx: 0,
  upstream_5xx: 0,
  malformed_response: 0,
  empty_response: 0,
};

let lastFailure: LlmProviderSafeFailure | null = null;
let lastDegradation: LlmProviderSafeDegradation | null = null;
let lastSuccessAt: string | null = null;
let lastOutcome: 'success' | 'failure' | 'degradation' | null = null;

export function recordLlmProviderRequest(): void {
  counters.requests += 1;
}

export function recordLlmProviderAttempt(): void {
  counters.attempts += 1;
}

export function recordLlmProviderRetry(): void {
  counters.retries += 1;
}

export function recordLlmProviderSuccess(at: string = new Date().toISOString()): void {
  counters.successes += 1;
  lastSuccessAt = at;
  lastOutcome = 'success';
}

export function recordLlmProviderFailure(
  failure: Omit<LlmProviderSafeFailure, 'at'> & { at?: string },
): void {
  counters.failures += 1;
  failuresByKind[failure.kind] += 1;
  lastFailure = {
    at: failure.at ?? new Date().toISOString(),
    kind: failure.kind,
    status: failure.status,
    model: failure.model,
    attempts: failure.attempts,
    retryable: failure.retryable,
  };
  lastOutcome = 'failure';
}

export function recordLlmProviderDegradation(
  templateId: string,
  at: string = new Date().toISOString(),
): void {
  counters.degradations += 1;
  lastDegradation = { at, templateId, reason: 'deterministic_fallback' };
  lastOutcome = 'degradation';
}

export function getLlmProviderObservabilitySnapshot(): LlmProviderObservabilitySnapshot {
  const configured = Boolean(env.ANTHROPIC_API_KEY);
  const state = !configured
    ? 'dormant'
    : lastOutcome === null
      ? 'unobserved'
      : lastOutcome === 'success'
        ? 'healthy'
        : 'degraded';
  return {
    provider: 'anthropic',
    configured,
    state,
    counters: { ...counters },
    failuresByKind: { ...failuresByKind },
    lastFailure: lastFailure ? { ...lastFailure } : null,
    lastDegradation: lastDegradation ? { ...lastDegradation } : null,
    lastSuccessAt,
    privacy: {
      aggregateOnly: true,
      promptContentStored: false,
      outputContentStored: false,
      credentialsStored: false,
      upstreamBodyStored: false,
    },
  };
}

export function resetLlmProviderObservabilityForTests(): void {
  counters.requests = 0;
  counters.attempts = 0;
  counters.successes = 0;
  counters.failures = 0;
  counters.retries = 0;
  counters.degradations = 0;
  for (const kind of Object.keys(failuresByKind) as LlmProviderErrorKind[]) {
    failuresByKind[kind] = 0;
  }
  lastFailure = null;
  lastDegradation = null;
  lastSuccessAt = null;
  lastOutcome = null;
}
