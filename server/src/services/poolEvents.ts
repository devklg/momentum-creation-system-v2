/**
 * Pool events pub/sub — the in-process broadcast channel for live
 * placements (Chat #114 dashboard port).
 *
 * Architecture (recovered from Chat #84 + #94 spec; cf. types.ts SSE
 * section):
 *   - Every prospect-dashboard viewer opens a SSE connection at
 *     GET /api/p/:token/stream.
 *   - When ANY prospect on the whole team hits video_complete, the
 *     holdingTank.placeProspect call publishes a `placement` event
 *     through this module.
 *   - Every connected SSE handler is subscribed to this emitter; the
 *     handler serializes the event and pushes it down its own pipe.
 *   - Single Node process, single in-memory EventEmitter, no Redis.
 *     Multi-instance scale-out swaps this for a real pub/sub backend
 *     (Redis pub/sub or Postgres LISTEN/NOTIFY) without touching the
 *     SSE handler or the placement code.
 *
 * The triple-stack write in placeProspect is the authoritative
 * persistence path; this emitter is an ADDITIONAL fan-out for the live
 * viewers, not a replacement. If the process restarts, the SSE
 * connections drop, the client reconnects, and the snapshot event on
 * reconnect rehydrates state from the persisted data. Lost in-flight
 * events between disconnect and reconnect are acceptable — the
 * snapshot's `globalMaxPosition` is monotonic, so the client's
 * beneath-you count converges to truth on every reconnect.
 */

import { EventEmitter } from 'node:events';
import type { PlacementEvent } from '@momentum/shared';

export const POOL_EVENT_PLACEMENT = 'placement' as const;

/**
 * Process-wide pool event emitter. setMaxListeners is raised because
 * each SSE connection subscribes one listener — the default of 10 is
 * far too low for a real deployment. 10,000 is a comfortable upper
 * bound for a single Node process at the volumes targeted in locked-
 * spec 1.10; we'll revisit when multi-instance scale-out lands.
 */
class PoolEventBus extends EventEmitter {}

const bus = new PoolEventBus();
bus.setMaxListeners(10_000);

export interface PlacementSubscription {
  /** Call to detach the listener; safe to call multiple times. */
  unsubscribe: () => void;
}

/**
 * Publish a placement event. Called from holdingTank.placeProspect
 * after the triple-stack write commits. Fire-and-forget; the emitter
 * is synchronous and the listeners are pure (just push to a pipe).
 */
export function publishPlacement(event: PlacementEvent): void {
  bus.emit(POOL_EVENT_PLACEMENT, event);
}

/**
 * Subscribe to placement events. Returns an unsubscribe function the
 * caller MUST call when the connection closes (otherwise the listener
 * leaks and setMaxListeners eventually fires a warning).
 *
 * The SSE route's `close` handler is the canonical place to call
 * unsubscribe().
 */
export function subscribePlacements(
  handler: (event: PlacementEvent) => void,
): PlacementSubscription {
  bus.on(POOL_EVENT_PLACEMENT, handler);
  let detached = false;
  return {
    unsubscribe: () => {
      if (detached) return;
      detached = true;
      bus.off(POOL_EVENT_PLACEMENT, handler);
    },
  };
}

/**
 * For tests + introspection. Counts the number of live SSE subscribers
 * attached to the placement channel. The /admin Live Operations surface
 * (locked-spec ADMIN H) can read this to display "N prospects currently
 * viewing their dashboards."
 */
export function activePlacementSubscriberCount(): number {
  return bus.listenerCount(POOL_EVENT_PLACEMENT);
}
