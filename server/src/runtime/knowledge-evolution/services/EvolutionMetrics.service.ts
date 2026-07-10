/**
 * Evolution Metrics Service (spec §28).
 *
 * Turns raw counts for a window into a `KnowledgeEvolutionMetricsSnapshot` (completion/failure
 * rates, time-to-ready, reindex/graph success rates, supersession/archive/rollback counts,
 * bilingual activation parity, candidate-to-active rate). The arithmetic is pure and unit-tested;
 * the aggregation query itself is supplied by an injected data source (Lane A/D). No route/worker
 * coupling.
 */

import type {
  KnowledgeEvolutionMetricsQuery,
  KnowledgeEvolutionMetricsSnapshot,
} from '@momentum/shared/runtime';
import {
  KNOWLEDGE_EVOLUTION_TEAM_KEY,
  KNOWLEDGE_EVOLUTION_TEAM_NAME,
} from '@momentum/shared/runtime';
import type { EvolutionRuntimeDeps } from '../deps.js';
import type {
  EvolutionMetricsDataSource,
  EvolutionMetricsRawCounts,
  EvolutionMetricsRepository,
} from './ports.js';

/** Safe division: 0 when the denominator is 0 (no activity ⇒ no rate). */
function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function average(samples: number[]): number {
  if (samples.length === 0) return 0;
  const total = samples.reduce((sum, value) => sum + value, 0);
  return total / samples.length;
}

/**
 * Bilingual activation parity: how balanced English/Spanish activations are in the window.
 * 1 = perfect parity (or no activity), approaching 0 as one language dominates.
 */
function bilingualParity(english: number, spanish: number): number {
  const max = Math.max(english, spanish);
  if (max === 0) return 1;
  return Math.min(english, spanish) / max;
}

/** Pure snapshot computation from raw counts — no ids, no clock, no persistence. */
export function computeMetricsSnapshotFields(
  counts: EvolutionMetricsRawCounts,
): Omit<
  KnowledgeEvolutionMetricsSnapshot,
  | 'metricsSnapshotId'
  | 'tenantId'
  | 'teamId'
  | 'teamKey'
  | 'teamName'
  | 'periodStart'
  | 'periodEnd'
  | 'createdAt'
> {
  return {
    evolutionCompletionRate: rate(counts.completedEvolutions, counts.totalEvolutions),
    evolutionFailureRate: rate(counts.failedEvolutions, counts.totalEvolutions),
    averageTimeToRetrievalReadyMs: average(counts.timeToRetrievalReadyMsSamples),
    reindexSuccessRate: rate(counts.reindexSuccesses, counts.reindexAttempts),
    graphSyncSuccessRate: rate(counts.graphSyncSuccesses, counts.graphSyncAttempts),
    supersessionCount: counts.supersessionCount,
    archiveCount: counts.archiveCount,
    rollbackCount: counts.rollbackCount,
    bilingualActivationParity: bilingualParity(
      counts.englishActivations,
      counts.spanishActivations,
    ),
    candidateToActiveRate: rate(counts.activatedCandidates, counts.approvedCandidates),
  };
}

export interface EvolutionMetricsService {
  buildSnapshot(
    query: KnowledgeEvolutionMetricsQuery,
  ): Promise<KnowledgeEvolutionMetricsSnapshot>;
}

export function createEvolutionMetricsService(
  dataSource: EvolutionMetricsDataSource,
  metricsRepository: EvolutionMetricsRepository,
  deps: EvolutionRuntimeDeps,
): EvolutionMetricsService {
  return {
    async buildSnapshot(query) {
      const counts = await dataSource.collect({
        tenantId: query.tenantId,
        teamId: query.teamId,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
      });

      const snapshot: KnowledgeEvolutionMetricsSnapshot = {
        metricsSnapshotId: deps.ids.newId('kevmet'),
        tenantId: query.tenantId,
        teamId: query.teamId,
        teamKey: KNOWLEDGE_EVOLUTION_TEAM_KEY,
        teamName: KNOWLEDGE_EVOLUTION_TEAM_NAME,
        periodStart: query.periodStart,
        periodEnd: query.periodEnd,
        ...computeMetricsSnapshotFields(counts),
        createdAt: deps.clock.now(),
      };

      return metricsRepository.insert(snapshot);
    },
  };
}
