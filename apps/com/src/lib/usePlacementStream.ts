/**
 * usePlacementStream — React hook around the live placement SSE stream
 * (Chat #114 dashboard port).
 *
 * Behavior:
 *   - Opens an EventSource against /api/p/:token/stream on mount.
 *   - On `snapshot` event, hydrates globalMaxPosition + recent ticker.
 *   - On `placement` event, increments the global max + prepends the
 *     entry to the ticker, capping the ticker length.
 *   - On error (server closed, network dropped), EventSource auto-
 *     reconnects with exponential backoff per the spec; on each
 *     reconnect we receive a fresh `snapshot` and the client state
 *     converges to truth.
 *   - On unmount, closes the EventSource (server sees `close` and
 *     unsubscribes from the in-process emitter).
 *
 * Compliance: this hook never receives names beyond first name + last
 * initial; never receives emails/phones; never receives anything that
 * would let it identify a real person. The server enforces this; the
 * hook just renders what it gets.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  McsHoldingTankSnapshot,
  McsPlacementEvent,
  McsPlacementTickerEntry,
} from '@momentum/shared';

/** Max ticker entries to retain in memory. Locked-spec 4.4: 20–40 visible. */
const MAX_TICKER_ENTRIES = 80;

export interface PlacementStreamState {
  /** True before the first snapshot lands. */
  connecting: boolean;
  /** True once at least one snapshot has been received. */
  connected: boolean;
  /** Highest position number observed across the whole team. */
  globalMaxPosition: number;
  /** Most-recent placements newest first (capped at MAX_TICKER_ENTRIES). */
  ticker: McsPlacementTickerEntry[];
  /** True if the EventSource is in an errored state right now. */
  errored: boolean;
}

const INITIAL: PlacementStreamState = {
  connecting: true,
  connected: false,
  globalMaxPosition: 0,
  ticker: [],
  errored: false,
};

export function usePlacementStream(
  token: string | undefined,
  apiBase: '/api/p' | '/api/rvm' = '/api/p',
): PlacementStreamState {
  const [state, setState] = useState<PlacementStreamState>(INITIAL);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!token) {
      setState({ ...INITIAL, connecting: false });
      return;
    }

    const url = `${apiBase}/${encodeURIComponent(token)}/stream`;
    const es = new EventSource(url);
    sourceRef.current = es;

    const onSnapshot = (evt: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(evt.data) as McsHoldingTankSnapshot;
        setState({
          connecting: false,
          connected: true,
          globalMaxPosition: payload.globalMaxPosition,
          ticker: payload.recent.slice(0, MAX_TICKER_ENTRIES),
          errored: false,
        });
      } catch {
        // Malformed snapshot; leave state alone, next reconnect retries.
      }
    };

    const onPlacement = (evt: MessageEvent<string>) => {
      try {
        const event = JSON.parse(evt.data) as McsPlacementEvent;
        setState((prev) => {
          // De-dup by positionNumber in case a server reconnect causes a
          // brief replay (rare; defensive).
          if (prev.ticker[0]?.positionNumber === event.positionNumber) {
            return prev;
          }
          const nextTicker = [event, ...prev.ticker].slice(0, MAX_TICKER_ENTRIES);
          const nextGlobalMax = Math.max(prev.globalMaxPosition, event.positionNumber);
          return {
            ...prev,
            connected: true,
            globalMaxPosition: nextGlobalMax,
            ticker: nextTicker,
            errored: false,
          };
        });
      } catch {
        // ignore malformed event
      }
    };

    const onError = () => {
      // EventSource transitions through CONNECTING → OPEN → CLOSED; on
      // transient errors it retries automatically. Reflect the flag
      // so the UI can render a subtle 'reconnecting' affordance if it
      // wants (the dashboard does not, by design — silent failure).
      setState((prev) => ({ ...prev, errored: true }));
    };

    es.addEventListener('snapshot', onSnapshot as EventListener);
    es.addEventListener('placement', onPlacement as EventListener);
    es.addEventListener('error', onError);

    return () => {
      es.removeEventListener('snapshot', onSnapshot as EventListener);
      es.removeEventListener('placement', onPlacement as EventListener);
      es.removeEventListener('error', onError);
      es.close();
      sourceRef.current = null;
    };
  }, [token, apiBase]);

  return state;
}
