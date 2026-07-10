/**
 * Lane D event tests — in-process bus idempotency + envelope builder (correlation/causation,
 * conditional optional fields, deterministic id/timestamp).
 */

import { describe, expect, it } from 'vitest';
import {
  buildConsumedEnvelope,
  buildEmittedEvent,
  createKnowledgeEvolutionEventBus,
  type EmitContext,
  type KnowledgeEvolutionBusEvent,
} from '../events/index.js';
import { makeDeps } from './fakes.js';

const baseCtx: EmitContext = {
  correlationId: 'kev_0001',
  actor: 'TMBA-1',
  teamScope: { teamId: 'team_magnificent', teamKey: 'team_magnificent', teamName: 'Team Magnificent' },
  language: 'en',
};

describe('Lane D event bus', () => {
  it('dispatches a published event to subscribers and records it', async () => {
    const bus = createKnowledgeEvolutionEventBus();
    const runtime = makeDeps();
    const seen: KnowledgeEvolutionBusEvent[] = [];
    bus.on('knowledge.evolution.received', (event) => {
      seen.push(event);
    });

    const event = buildEmittedEvent(runtime, 'knowledge.evolution.received', baseCtx, { a: 1 });
    const dispatched = await bus.publish(event);

    expect(dispatched).toBe(true);
    expect(seen).toHaveLength(1);
    expect(bus.emitted()).toHaveLength(1);
    expect(bus.consumed()).toHaveLength(0);
  });

  it('is idempotent by eventId — a re-published event is suppressed', async () => {
    const bus = createKnowledgeEvolutionEventBus();
    const runtime = makeDeps();
    let count = 0;
    bus.on('knowledge.evolution.received', () => {
      count += 1;
    });

    const event = buildEmittedEvent(runtime, 'knowledge.evolution.received', baseCtx, {});
    expect(await bus.publish(event)).toBe(true);
    expect(await bus.publish(event)).toBe(false);
    expect(count).toBe(1);
  });

  it('onAny observes both consumed and emitted events', async () => {
    const bus = createKnowledgeEvolutionEventBus();
    const runtime = makeDeps();
    const all: string[] = [];
    bus.onAny((event) => {
      all.push(event.type);
    });

    await bus.publish(buildConsumedEnvelope(runtime, 'knowledge.candidate.approved', { x: 1 }));
    await bus.publish(buildEmittedEvent(runtime, 'knowledge.evolution.completed', baseCtx, {}));

    expect(all).toEqual(['knowledge.candidate.approved', 'knowledge.evolution.completed']);
    expect(bus.consumed()).toHaveLength(1);
    expect(bus.emitted()).toHaveLength(1);
  });
});

describe('Lane D emitted-event envelope', () => {
  it('omits absent optional fields and includes present ones', () => {
    const runtime = makeDeps();

    const minimal = buildEmittedEvent(runtime, 'knowledge.evolution.received', baseCtx, {});
    expect('causationId' in minimal).toBe(false);
    expect('approvalReference' in minimal).toBe(false);
    expect('knowledgeObjectId' in minimal).toBe(false);
    expect('version' in minimal).toBe(false);
    expect(minimal.source).toBe('knowledge_evolution');
    expect(minimal.eventId).toMatch(/^kevevt_/);
    expect(minimal.occurredAt).toBe('2026-07-10T12:00:00.000Z');

    const full = buildEmittedEvent(
      runtime,
      'knowledge.evolution.version_created',
      {
        ...baseCtx,
        causationId: 'kevevt_prev',
        knowledgeObjectId: 'ko_1',
        version: 2,
        sourceCandidateId: 'cand_1',
        approvalReference: {
          approvalId: 'appr_1',
          approvedBy: 'TMBA-1',
          approvalType: 'review_workflow',
          approvedAt: new Date('2026-07-09T00:00:00.000Z'),
        },
      },
      { note: 'x' },
    );
    expect(full.causationId).toBe('kevevt_prev');
    expect(full.knowledgeObjectId).toBe('ko_1');
    expect(full.version).toBe(2);
    expect(full.sourceCandidateId).toBe('cand_1');
    expect(full.approvalReference?.approvalId).toBe('appr_1');
  });
});
