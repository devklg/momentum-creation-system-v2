/**
 * Persistence latency probe (/admin Live Operations H.1).
 *
 * Provides a thin instrumented wrapper around `persistenceCall` — which since
 * ACR-0009 dispatches ONLY to the direct persistence adapters — plus an
 * in-memory rolling 60s window of latency samples. The /admin Live Ops
 * H.1 usage strip reads `latencyPercentiles()` to fill the
 * `persistenceLatencyMsP50 / P95` fields on `AdminLiveUsageSample` (field names
 * kept for shared-type stability; they now measure direct-store round trips).
 *
 * Scope honesty: today the only callers of `instrumentedPersistenceCall`
 * are the H domain functions themselves (domain/liveOps.ts). That means
 * the percentiles reported on the usage strip are the percentiles of
 * persistence calls made by the live-ops domain functions, not the global
 * persistence-call population. This is the "honest-partial" pattern from
 * the #143 reporting branch: build the structure correctly, scope what
 * we measure, don't invent data. As more code adopts this wrapper the
 * sample population widens automatically; nothing else changes.
 *
 * Process-local, no persistence. On restart the buffer is empty and
 * the H.1 fields read null until the first sample lands — exactly the
 * contract documented on `AdminLiveUsageSample`.
 */

import { persistenceCall } from './persistence/dispatch.js';

const LATENCY_WINDOW_MS = 60_000;

interface LatencySample {
  ms: number;
  at: number;
}

const samples: LatencySample[] = [];

function pruneOld(now: number): void {
  while (samples.length > 0 && now - samples[0]!.at > LATENCY_WINDOW_MS) {
    samples.shift();
  }
}

/** Record a single persistence round-trip latency in milliseconds. */
export function recordSample(ms: number, at: number = Date.now()): void {
  pruneOld(at);
  samples.push({ ms, at });
}

/**
 * Return p50/p95 over the trailing 60s window. Both are null when no
 * samples are in-window — the contract permits this.
 */
export function latencyPercentiles(): { p50: number | null; p95: number | null } {
  pruneOld(Date.now());
  if (samples.length === 0) return { p50: null, p95: null };

  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  const p50Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.5));
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return {
    p50: sorted[p50Index] ?? null,
    p95: sorted[p95Index] ?? null,
  };
}

/**
 * Drop-in replacement for `persistenceCall` that records its own round-trip
 * latency into the rolling window. Use from H live-ops domain code; the
 * raw `persistenceCall` is still available everywhere else.
 *
 * Failed calls are also sampled — they still represent a real
 * round-trip — so the percentiles reflect "what users see," not
 * "what succeeded."
 */
export async function instrumentedPersistenceCall<T = unknown>(
  tool: string,
  action: string,
  params: Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    return await persistenceCall<T>(tool, action, params);
  } finally {
    recordSample(Date.now() - start);
  }
}
