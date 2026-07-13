import type { RetrievalObservabilityRecord } from '../runtime/context/retrievalObservability.js';

const reasonCounts = new Map<string, number>();
let total = 0;
let degraded = 0;
let lastObservedAt: string | null = null;

export function recordContextManagerDiagnostic(record: RetrievalObservabilityRecord): void {
  total += 1;
  if (record.outcome === 'degraded') degraded += 1;
  lastObservedAt = record.observedAt ?? null;
  for (const reason of record.degradeReasons ?? []) reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
}

export function getContextManagerDiagnosticsSnapshot() {
  return {
    retention: 'in_process_since_restart' as const,
    total,
    degraded,
    successful: total - degraded,
    lastObservedAt,
    degradedReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
  };
}

export function resetContextManagerDiagnosticsForTests(): void {
  total = 0; degraded = 0; lastObservedAt = null; reasonCounts.clear();
}
