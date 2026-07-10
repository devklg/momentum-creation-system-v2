/**
 * Knowledge Evolution Runtime — metrics + operational health computations (Lane D · spec §28, §29).
 *
 * PURE functions over already-fetched canonical records/rollouts. The window aggregation query
 * itself lives in the container (via Lane A list repositories); these functions turn those rows
 * into (a) the raw counts the Lane B metrics service needs for a `KnowledgeEvolutionMetricsSnapshot`
 * and (b) an operational health view (backlog + failed jobs + retrieval-ready + blocked reasons).
 *
 * No persistence, no I/O — deterministic and unit-tested on their inputs alone.
 */

import type {
  KnowledgeEvolutionRecord,
  KnowledgeEvolutionStatus,
  KnowledgeRetrievalRollout,
} from '@momentum/shared/runtime';
import type { EvolutionMetricsRawCounts } from './services/ports.js';

/** Lifecycle statuses that are still in flight — the runtime's backlog (spec §29 health). */
const IN_FLIGHT_STATUSES: ReadonlySet<KnowledgeEvolutionStatus> = new Set([
  'received',
  'planning',
  'versioning',
  'writing_to_knowledge_core',
  'indexing',
  'graph_syncing',
  'retrieval_ready',
  'monitoring',
]);

/**
 * Turn a window of evolution records into the raw counts the metrics service needs. Reindex/graph
 * attempts are inferred from coordination status (`!= not_required`); activations are records that
 * reached retrieval-ready; time-to-ready is approximated as `updatedAt - createdAt` for ready rows.
 */
export function computeRawCountsFromRecords(
  records: readonly KnowledgeEvolutionRecord[],
): EvolutionMetricsRawCounts {
  const counts: EvolutionMetricsRawCounts = {
    totalEvolutions: records.length,
    completedEvolutions: 0,
    failedEvolutions: 0,
    timeToRetrievalReadyMsSamples: [],
    reindexAttempts: 0,
    reindexSuccesses: 0,
    graphSyncAttempts: 0,
    graphSyncSuccesses: 0,
    supersessionCount: 0,
    archiveCount: 0,
    rollbackCount: 0,
    englishActivations: 0,
    spanishActivations: 0,
    approvedCandidates: 0,
    activatedCandidates: 0,
  };

  for (const record of records) {
    if (record.status === 'completed') counts.completedEvolutions += 1;
    if (record.status === 'failed') counts.failedEvolutions += 1;
    if (record.status === 'rolled_back') counts.rollbackCount += 1;

    if (record.indexingStatus !== 'not_required') counts.reindexAttempts += 1;
    if (record.indexingStatus === 'completed') counts.reindexSuccesses += 1;
    if (record.graphStatus !== 'not_required') counts.graphSyncAttempts += 1;
    if (record.graphStatus === 'completed') counts.graphSyncSuccesses += 1;

    if (record.evolutionAction === 'supersede_existing_knowledge') counts.supersessionCount += 1;
    if (record.evolutionAction === 'archive_existing_knowledge') counts.archiveCount += 1;

    if (record.inputType === 'approved_candidate') counts.approvedCandidates += 1;

    const retrievalReady = record.retrievalStatus === 'ready';
    if (retrievalReady) {
      if (record.language === 'en') counts.englishActivations += 1;
      if (record.language === 'es') counts.spanishActivations += 1;
      if (record.inputType === 'approved_candidate') counts.activatedCandidates += 1;

      const readyAt = record.completedAt ?? record.updatedAt;
      const ms = readyAt.getTime() - record.createdAt.getTime();
      if (Number.isFinite(ms) && ms >= 0) counts.timeToRetrievalReadyMsSamples.push(ms);
    }
  }

  return counts;
}

/** A single blocked-rollout reason with how many rollouts carry it. */
export interface BlockedRolloutReason {
  reason: string;
  count: number;
}

/** Operational health view of the runtime (spec §29 — backlog + failure + retrieval readiness). */
export interface KnowledgeEvolutionOperationalHealth {
  tenantId: string;
  teamId: string;
  periodStart: string;
  periodEnd: string;
  /** Evolutions still in flight (not completed/failed/rolled_back). */
  backlog: number;
  failedEvolutionJobs: number;
  failedReindexJobs: number;
  failedGraphSyncJobs: number;
  retrievalReadyCount: number;
  blockedRolloutReasons: BlockedRolloutReason[];
  generatedAt: string;
}

export interface OperationalHealthWindow {
  tenantId: string;
  teamId: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;
}

/** Compute the operational health view from a window of records + rollouts. Pure. */
export function computeOperationalHealth(
  window: OperationalHealthWindow,
  records: readonly KnowledgeEvolutionRecord[],
  rollouts: readonly KnowledgeRetrievalRollout[],
): KnowledgeEvolutionOperationalHealth {
  let backlog = 0;
  let failedEvolutionJobs = 0;
  let failedReindexJobs = 0;
  let failedGraphSyncJobs = 0;
  let retrievalReadyCount = 0;

  for (const record of records) {
    if (IN_FLIGHT_STATUSES.has(record.status)) backlog += 1;
    if (record.status === 'failed') failedEvolutionJobs += 1;
    if (record.indexingStatus === 'failed') failedReindexJobs += 1;
    if (record.graphStatus === 'failed') failedGraphSyncJobs += 1;
    if (record.retrievalStatus === 'ready') retrievalReadyCount += 1;
  }

  const reasonCounts = new Map<string, number>();
  for (const rollout of rollouts) {
    if (rollout.retrievalReady) continue;
    const reason = rollout.blockedReason ?? 'unspecified';
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const blockedRolloutReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  return {
    tenantId: window.tenantId,
    teamId: window.teamId,
    periodStart: window.periodStart.toISOString(),
    periodEnd: window.periodEnd.toISOString(),
    backlog,
    failedEvolutionJobs,
    failedReindexJobs,
    failedGraphSyncJobs,
    retrievalReadyCount,
    blockedRolloutReasons,
    generatedAt: window.generatedAt.toISOString(),
  };
}
