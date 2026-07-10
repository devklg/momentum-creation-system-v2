/**
 * Lane D worker tests — event-driven pipeline, idempotent replay, failure behavior, and the
 * correlation/causation lineage on emitted events.
 */

import { describe, expect, it } from 'vitest';
import type { KnowledgeReindexRequest, KnowledgeReindexResult } from '../indexing/index.js';
import { publishConsumedEvent } from '../events/index.js';
import { makeStartRequest, type FakeEvolutionRecordRepository } from './fakes.js';
import { makeTestRuntime } from './laneDTestKit.js';

const CANDIDATE = 'knowledge.candidate.approved' as const;

function recordCount(repositories: ReturnType<typeof makeTestRuntime>['repositories']): number {
  return (repositories.recordRepository as FakeEvolutionRecordRepository).store.size;
}

describe('Lane D workers', () => {
  it('runs the full approved-candidate pipeline and emits the ordered lineage', async () => {
    const { runtime, runtimeDeps } = makeTestRuntime();
    runtime.workers.startAll();

    await publishConsumedEvent(runtime.bus, runtimeDeps, CANDIDATE, {
      request: makeStartRequest(),
    });

    const types = runtime.bus.emitted().map((event) => event.type);
    expect(types).toEqual([
      'knowledge.evolution.received',
      'knowledge.evolution.plan_created',
      'knowledge.evolution.version_created',
      'knowledge.evolution.knowledge_written',
      'knowledge.evolution.reindex_requested',
      'knowledge.evolution.reindex_completed',
      'knowledge.evolution.graph_sync_requested',
      'knowledge.evolution.graph_sync_completed',
    ]);
  });

  it('is idempotent — a re-delivered approval creates no second record or event', async () => {
    const { runtime, runtimeDeps, repositories } = makeTestRuntime();
    runtime.workers.startAll();
    const request = makeStartRequest();

    await publishConsumedEvent(runtime.bus, runtimeDeps, CANDIDATE, { request });
    const emittedAfterFirst = runtime.bus.emitted().length;
    expect(recordCount(repositories)).toBe(1);

    // A second, distinct delivery of the SAME approved input.
    await publishConsumedEvent(runtime.bus, runtimeDeps, CANDIDATE, { request });
    expect(recordCount(repositories)).toBe(1);
    expect(runtime.bus.emitted().length).toBe(emittedAfterFirst);
  });

  it('emits `failed` when reindex coordination fails (and not reindex_completed)', async () => {
    const failingReindex = (req: KnowledgeReindexRequest): Promise<KnowledgeReindexResult> =>
      Promise.resolve({
        evolutionId: req.evolutionId,
        knowledgeObjectId: req.knowledgeObjectId,
        action: 'index_active',
        collection: 'mcs_test_knowledge_en',
        documentId: `doc_${req.knowledgeObjectId}`,
        status: 'failed',
        indexingStatus: 'failed',
        attempts: 3,
        retryable: true,
        reason: 'index_active failed',
        error: 'chroma unavailable',
      });
    const { runtime, runtimeDeps } = makeTestRuntime({ reindex: failingReindex });
    runtime.workers.startAll();

    await publishConsumedEvent(runtime.bus, runtimeDeps, CANDIDATE, {
      request: makeStartRequest(),
    });

    const types = runtime.bus.emitted().map((event) => event.type);
    expect(types).toContain('knowledge.evolution.failed');
    expect(types).not.toContain('knowledge.evolution.reindex_completed');
  });

  it('threads a single correlationId and links causationId across the chain', async () => {
    const { runtime, runtimeDeps } = makeTestRuntime();
    runtime.workers.startAll();
    const trigger = await publishConsumedEvent(runtime.bus, runtimeDeps, CANDIDATE, {
      request: makeStartRequest(),
    });

    const emitted = runtime.bus.emitted();
    const correlationIds = new Set(emitted.map((event) => event.correlationId));
    expect(correlationIds.size).toBe(1);

    const received = emitted.find((event) => event.type === 'knowledge.evolution.received');
    const planCreated = emitted.find((event) => event.type === 'knowledge.evolution.plan_created');
    expect(received?.causationId).toBe(trigger.eventId);
    expect(planCreated?.causationId).toBe(received?.eventId);

    // Every emitted event carries the required envelope context (spec §24.1).
    for (const event of emitted) {
      expect(event.actor).toBe('TMBA-20260101-000001');
      expect(event.teamScope.teamKey).toBe('team_magnificent');
      expect(event.language).toBe('en');
      expect(event.approvalReference?.approvalId).toBe('appr_1');
      expect(typeof event.occurredAt).toBe('string');
    }
  });

  it('emits supersession_applied for an approved supersession', async () => {
    const { runtime, runtimeDeps } = makeTestRuntime();
    runtime.workers.startAll();
    await publishConsumedEvent(runtime.bus, runtimeDeps, 'knowledge.supersession.approved', {
      request: makeStartRequest({
        inputType: 'approved_supersession',
        evolutionAction: 'supersede_existing_knowledge',
        sourceKnowledgeObjectIds: ['ko_old'],
      }),
    });
    const types = runtime.bus.emitted().map((event) => event.type);
    expect(types).toContain('knowledge.evolution.supersession_applied');
  });

  it('emits archive_applied for an approved archive', async () => {
    const { runtime, runtimeDeps } = makeTestRuntime();
    runtime.workers.startAll();
    await publishConsumedEvent(runtime.bus, runtimeDeps, 'knowledge.archive.approved', {
      request: makeStartRequest({
        inputType: 'approved_archive',
        evolutionAction: 'archive_existing_knowledge',
        sourceKnowledgeObjectIds: ['ko_old'],
      }),
    });
    const types = runtime.bus.emitted().map((event) => event.type);
    expect(types).toContain('knowledge.evolution.archive_applied');
  });

  it('start/stop gates whether triggers are processed', async () => {
    const { runtime, runtimeDeps, repositories } = makeTestRuntime();
    expect(runtime.workers.isRunning()).toBe(false);
    runtime.workers.startAll();
    expect(runtime.workers.isRunning()).toBe(true);

    runtime.workers.stopAll();
    expect(runtime.workers.isRunning()).toBe(false);
    await publishConsumedEvent(runtime.bus, runtimeDeps, CANDIDATE, {
      request: makeStartRequest(),
    });
    expect(recordCount(repositories)).toBe(0);
  });
});
