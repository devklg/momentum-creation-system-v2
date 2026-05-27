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
 *
 * Also records the event in the rolling 60s window so the /admin Live
 * Operations H.1 usage strip can report events/min. Until a broader
 * centralized event firehose exists, "events" here is exactly
 * "placements" — H.1's domain layer is responsible for surfacing that
 * scope honestly (placements-per-minute, not all-system-events).
 */
export function publishPlacement(event: PlacementEvent): void {
  recordEvent();
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

/* ── /admin Live Operations H.1 — additive surface (Chat #144) ──────
 *
 * The H.1 usage strip needs two numbers this module is the natural
 * home for: events-per-minute (a rolling 60s count of placements
 * published) and active-admin-sessions (a counter the /admin SSE
 * stream bumps on connect/disconnect). Both are tiny in-memory
 * structures; if the process restarts they reset to zero, which is
 * fine — H.1 is a "right now" surface, not a historical one.
 *
 * Strict invariants:
 *  - The existing exports above are unchanged. publishPlacement gained
 *    a side-effect (recordEvent) but its public signature is identical.
 *  - These additions are pure-additive. No reader of the prior public
 *    API needs to know they exist.
 */

const EVENT_WINDOW_MS = 60_000;
const eventTimestamps: number[] = [];

function pruneOldEvents(now: number): void {
  // The ring is monotonically appended; shift() from the head until the
  // oldest entry is within the window.
  while (eventTimestamps.length > 0 && now - eventTimestamps[0]! > EVENT_WINDOW_MS) {
    eventTimestamps.shift();
  }
}

/**
 * Stamp the rolling event window. Called from publishPlacement above; can
 * be called by other publishers if a broader event firehose materializes
 * later. Cheap — bounded by the number of placements per minute.
 */
export function recordEvent(at: number = Date.now()): void {
  pruneOldEvents(at);
  eventTimestamps.push(at);
}

/** Count of recorded events in the trailing 60 seconds. */
export function eventsInLastMinute(): number {
  pruneOldEvents(Date.now());
  return eventTimestamps.length;
}

let adminSessionCount = 0;

/** /admin SSE stream calls this on connect. */
export function incrementAdminSessions(): void {
  adminSessionCount += 1;
}

/** /admin SSE stream calls this on disconnect. Floored at zero. */
export function decrementAdminSessions(): void {
  if (adminSessionCount > 0) adminSessionCount -= 1;
}

/** Current count of open /admin SSE subscribers (H.1 sanity check). */
export function activeAdminSessionCount(): number {
  return adminSessionCount;
}
