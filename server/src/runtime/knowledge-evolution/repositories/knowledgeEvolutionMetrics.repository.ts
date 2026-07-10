/**
 * Repository — `knowledge_evolution_metrics` (spec §28).
 *
 * APPEND-ONLY immutable snapshots. No patch, no delete. Idempotent on
 * `metricsSnapshotId`.
 */

import type { KnowledgeEvolutionMetricsSnapshot } from '@momentum/shared/runtime';
import {
  KnowledgeEvolutionValidationError,
  KNOWLEDGE_EVOLUTION_METRICS_COLLECTION,
  validateKnowledgeEvolutionMetricsSnapshot,
} from '../models/index.js';
import {
  repoExists,
  repoFind,
  repoFindOne,
  repoInsertOne,
  type RepoFindOptions,
} from '../persistence/mongoRepository.js';

const COLLECTION = KNOWLEDGE_EVOLUTION_METRICS_COLLECTION;

function toDoc(snapshot: KnowledgeEvolutionMetricsSnapshot): Record<string, unknown> {
  return { _id: snapshot.metricsSnapshotId, ...snapshot };
}

export async function recordMetricsSnapshot(
  snapshot: KnowledgeEvolutionMetricsSnapshot,
): Promise<KnowledgeEvolutionMetricsSnapshot> {
  const { ok, errors } = validateKnowledgeEvolutionMetricsSnapshot(snapshot);
  if (!ok) throw new KnowledgeEvolutionValidationError('metrics', errors);

  if (await repoExists(COLLECTION, { _id: snapshot.metricsSnapshotId })) {
    throw new KnowledgeEvolutionValidationError('metrics', [
      `metrics snapshot ${snapshot.metricsSnapshotId} already exists`,
    ]);
  }
  await repoInsertOne(COLLECTION, toDoc(snapshot));
  return snapshot;
}

export function getMetricsSnapshotById(
  metricsSnapshotId: string,
): Promise<KnowledgeEvolutionMetricsSnapshot | null> {
  return repoFindOne<KnowledgeEvolutionMetricsSnapshot>(COLLECTION, {
    _id: metricsSnapshotId,
  });
}

export function listMetricsSnapshots(
  filter: Record<string, unknown>,
  options: RepoFindOptions = { sort: { createdAt: -1 } },
): Promise<KnowledgeEvolutionMetricsSnapshot[]> {
  return repoFind<KnowledgeEvolutionMetricsSnapshot>(COLLECTION, filter, options);
}

/** Most recent snapshot for a team, or null. */
export async function getLatestMetricsSnapshot(
  tenantId: string,
  teamId: string,
): Promise<KnowledgeEvolutionMetricsSnapshot | null> {
  const [latest] = await repoFind<KnowledgeEvolutionMetricsSnapshot>(
    COLLECTION,
    { tenantId, teamId },
    { sort: { createdAt: -1 }, limit: 1 },
  );
  return latest ?? null;
}
