import { describe, expect, it } from 'vitest';
import { summarizeProjectionOutbox } from '../adminOutboxHealth.js';
import type { OutboxRecord } from '../../services/projectionOutbox.js';

function row(overrides: Partial<OutboxRecord>): OutboxRecord {
  return {
    _id: 'obx_1', outboxId: 'obx_1', tier: 'knowledge', target: 'neo4j', entityId: 'e1',
    mongoCollection: 'records', payload: { cypher: 'RETURN 1' }, priority: 'high', status: 'pending',
    attempts: 0, maxAttempts: 8, nextAttemptAt: '2026-07-12T12:00:00.000Z', lastError: null,
    createdAt: '2026-07-12T10:00:00.000Z', updatedAt: '2026-07-12T10:00:00.000Z', ...overrides,
  };
}

describe('summarizeProjectionOutbox', () => {
  it('separates due, scheduled, and dead-letter retry metrics without mutating rows', () => {
    const rows = [
      row({ attempts: 2, nextAttemptAt: '2026-07-12T11:00:00.000Z' }),
      row({ _id: 'obx_2', outboxId: 'obx_2', tier: 'operational', target: 'chroma', attempts: 1, nextAttemptAt: '2026-07-12T13:00:00.000Z' }),
      row({ _id: 'obx_3', outboxId: 'obx_3', status: 'failed', attempts: 8 }),
    ];
    expect(summarizeProjectionOutbox(rows, new Date('2026-07-12T12:00:00.000Z'))).toEqual({
      total: 3, pending: 2, due: 1, scheduled: 1, deadLettered: 1, attempts: 11,
      oldestPendingAt: '2026-07-12T10:00:00.000Z',
      byTier: { knowledge: 2, operational: 1 },
      byTarget: { neo4j: 2, chroma: 1 },
    });
    expect(rows[0]?.status).toBe('pending');
  });
});
