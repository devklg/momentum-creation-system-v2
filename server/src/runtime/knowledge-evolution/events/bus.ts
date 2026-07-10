/**
 * Knowledge Evolution Runtime — in-process event bus (Lane D · spec §24).
 *
 * A single-process pub/sub over Node's EventEmitter, mirroring the existing `poolEvents` pattern
 * (in-process, no external broker, no Telnyx). It carries both the consumed review→evolution
 * triggers and the published `knowledge.evolution.*` events so workers can chain off each other
 * (e.g. the reindex worker reacts to `reindex_requested`).
 *
 * Idempotent publish: an event whose `eventId` was already published is dropped, so replaying the
 * same event never fans out twice (spec §24 — replay must not duplicate side effects). Handlers are
 * awaited by the internal dispatcher so a subscriber's async work is observable in tests.
 */

import { EventEmitter } from 'node:events';
import type {
  KnowledgeEvolutionBusEvent,
  KnowledgeEvolutionConsumedEnvelope,
  KnowledgeEvolutionEmittedEvent,
} from './envelope.js';

/**
 * A bus handler. May be async — the bus awaits it (best-effort) before returning from publish.
 * The return value is ignored (handlers commonly return a worker's `process` promise), so it is
 * intentionally `unknown`.
 */
export type BusHandler<E extends KnowledgeEvolutionBusEvent = KnowledgeEvolutionBusEvent> = (
  event: E,
) => unknown;

/** Subscription handle — call `unsubscribe()` to detach (mirrors PlacementSubscription). */
export interface BusSubscription {
  unsubscribe(): void;
}

const ANY = '*';

export class KnowledgeEvolutionEventBus {
  private readonly emitter = new EventEmitter();
  private readonly seen = new Set<string>();
  private readonly recorded: KnowledgeEvolutionBusEvent[] = [];

  constructor() {
    // Workers + downstream consumers can add many listeners; avoid the default 10-listener warning.
    this.emitter.setMaxListeners(10_000);
  }

  /**
   * Publish an event. Idempotent by `eventId` — a duplicate is dropped and NOT re-dispatched.
   * Returns `true` if the event was dispatched, `false` if it was a suppressed replay.
   */
  async publish(event: KnowledgeEvolutionBusEvent): Promise<boolean> {
    if (this.seen.has(event.eventId)) return false;
    this.seen.add(event.eventId);
    this.recorded.push(event);
    await this.dispatch(event.type, event);
    await this.dispatch(ANY, event);
    return true;
  }

  private async dispatch(channel: string, event: KnowledgeEvolutionBusEvent): Promise<void> {
    const handlers = this.emitter.listeners(channel) as BusHandler[];
    for (const handler of handlers) {
      await handler(event);
    }
  }

  /** Subscribe to one event type (consumed or published). */
  on<E extends KnowledgeEvolutionBusEvent = KnowledgeEvolutionBusEvent>(
    type: E['type'],
    handler: BusHandler<E>,
  ): BusSubscription {
    this.emitter.on(type, handler as BusHandler);
    return { unsubscribe: () => this.emitter.off(type, handler as BusHandler) };
  }

  /** Subscribe to every event on the bus (used by audit/metrics probes and tests). */
  onAny(handler: BusHandler): BusSubscription {
    this.emitter.on(ANY, handler);
    return { unsubscribe: () => this.emitter.off(ANY, handler) };
  }

  /** All events published so far, in order (test/observability helper). */
  published(): readonly KnowledgeEvolutionBusEvent[] {
    return [...this.recorded];
  }

  /** Only the emitted `knowledge.evolution.*` events, in order. */
  emitted(): readonly KnowledgeEvolutionEmittedEvent[] {
    return this.recorded.filter(
      (event): event is KnowledgeEvolutionEmittedEvent =>
        event.type.startsWith('knowledge.evolution.'),
    );
  }

  /** Only the consumed review→evolution triggers, in order. */
  consumed(): readonly KnowledgeEvolutionConsumedEnvelope[] {
    return this.recorded.filter(
      (event): event is KnowledgeEvolutionConsumedEnvelope =>
        !event.type.startsWith('knowledge.evolution.'),
    );
  }

  /** Clear listeners + recorded history (test isolation). */
  reset(): void {
    this.emitter.removeAllListeners();
    this.seen.clear();
    this.recorded.length = 0;
  }
}

export function createKnowledgeEvolutionEventBus(): KnowledgeEvolutionEventBus {
  return new KnowledgeEvolutionEventBus();
}
