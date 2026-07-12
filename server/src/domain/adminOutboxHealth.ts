import type { McsAdminOutboxHealthResponse } from '@momentum/shared';
import { persistenceCall } from '../services/persistence/dispatch.js';
import { getProjectionOutboxWorkerStatus, type OutboxRecord } from '../services/projectionOutbox.js';

export function summarizeProjectionOutbox(rows: OutboxRecord[], now = new Date()): McsAdminOutboxHealthResponse['queue'] {
  const nowMs = now.getTime();
  const pending = rows.filter((row) => row.status === 'pending');
  const failed = rows.filter((row) => row.status === 'failed');
  const due = pending.filter((row) => Date.parse(row.nextAttemptAt) <= nowMs);
  const scheduled = pending.filter((row) => Date.parse(row.nextAttemptAt) > nowMs);
  const oldestPendingAt = pending.map((row) => row.createdAt).sort()[0] ?? null;
  return {
    total: rows.length,
    pending: pending.length,
    due: due.length,
    scheduled: scheduled.length,
    deadLettered: failed.length,
    attempts: rows.reduce((sum, row) => sum + row.attempts, 0),
    oldestPendingAt,
    byTier: {
      knowledge: rows.filter((row) => row.tier === 'knowledge').length,
      operational: rows.filter((row) => row.tier === 'operational').length,
    },
    byTarget: {
      neo4j: rows.filter((row) => row.target === 'neo4j').length,
      chroma: rows.filter((row) => row.target === 'chroma').length,
    },
  };
}

export async function buildAdminOutboxHealth(): Promise<McsAdminOutboxHealthResponse> {
  const result = await persistenceCall<{ documents?: OutboxRecord[] }>('mongodb', 'query', {
    database: 'momentum',
    collection: 'tmag_projection_outbox',
    filter: {},
    limit: 1000,
  });
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    worker: getProjectionOutboxWorkerStatus(),
    queue: summarizeProjectionOutbox(result.documents ?? []),
    truncated: (result.documents?.length ?? 0) >= 1000,
  };
}
