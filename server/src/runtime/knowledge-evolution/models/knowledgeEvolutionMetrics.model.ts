/**
 * Canonical model — `knowledge_evolution_metrics` (spec §28).
 *
 * Immutable metrics snapshots over a time window. Snapshots are append-only —
 * a new period produces a new row rather than mutating an old one.
 */

import { KNOWLEDGE_EVOLUTION_COLLECTIONS } from '@momentum/shared/runtime';
import type { KnowledgeEvolutionMetricsSnapshot } from '@momentum/shared/runtime';
import {
  requireDate,
  requireNumber,
  requireString,
  requireTeamMagnificentScope,
  result,
  type ValidationResult,
} from './validation.js';

export const KNOWLEDGE_EVOLUTION_METRICS_COLLECTION = KNOWLEDGE_EVOLUTION_COLLECTIONS.metrics;

export function validateKnowledgeEvolutionMetricsSnapshot(
  doc: Partial<KnowledgeEvolutionMetricsSnapshot>,
): ValidationResult {
  const errors: string[] = [];

  requireString(errors, doc.metricsSnapshotId, 'metricsSnapshotId');
  requireString(errors, doc.tenantId, 'tenantId');
  requireTeamMagnificentScope(errors, doc);

  requireDate(errors, doc.periodStart, 'periodStart');
  requireDate(errors, doc.periodEnd, 'periodEnd');
  if (
    doc.periodStart instanceof Date &&
    doc.periodEnd instanceof Date &&
    doc.periodEnd.getTime() < doc.periodStart.getTime()
  ) {
    errors.push('periodEnd must be >= periodStart');
  }

  requireNumber(errors, doc.evolutionCompletionRate, 'evolutionCompletionRate');
  requireNumber(errors, doc.evolutionFailureRate, 'evolutionFailureRate');
  requireNumber(errors, doc.averageTimeToRetrievalReadyMs, 'averageTimeToRetrievalReadyMs');
  requireNumber(errors, doc.reindexSuccessRate, 'reindexSuccessRate');
  requireNumber(errors, doc.graphSyncSuccessRate, 'graphSyncSuccessRate');
  requireNumber(errors, doc.supersessionCount, 'supersessionCount');
  requireNumber(errors, doc.archiveCount, 'archiveCount');
  requireNumber(errors, doc.rollbackCount, 'rollbackCount');
  requireNumber(errors, doc.bilingualActivationParity, 'bilingualActivationParity');
  requireNumber(errors, doc.candidateToActiveRate, 'candidateToActiveRate');

  requireDate(errors, doc.createdAt, 'createdAt');

  return result(errors);
}
