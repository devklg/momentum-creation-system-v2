/**
 * H.1 — SSE consumer for /api/admin/live-ops/usage/stream.
 *
 * Mirrors the connect/snapshot/heartbeat/disconnect/auto-reconnect pattern
 * from dashboard/LiveEventStream.tsx, but adds explicit exponential backoff
 * because the usage strip is the page's "vital sign" — a flapping connection
 * should visibly settle, not thrash.
 *
 * Frame kinds (see admin-live-ops.ts):
 *   snapshot   → replace `sample`
 *   heartbeat  → no state change, just proves the stream is alive (we bump
 *                `lastHeartbeatAt` so consumers can render a freshness dot)
 */

import { useEffect, useRef, useState } from 'react';
import type {
  McsAdminLiveUsageSample,
  McsAdminLiveUsageStreamEvent,
} from '@momentum/shared';
import { MCS_ADMIN_LIVE_OPS_PATHS } from '@momentum/shared';

export type UsageStreamStatus = 'connecting' | 'live' | 'reconnecting' | 'closed' | 'disabled';

export interface UseUsageStreamOptions {
  /**
   * When false, the hook never opens an EventSource and reports a
   * neutral 'disabled' status. Used by /live-ops while mocks are on
   * so the connection pill doesn't show a permanent "reconnecting"
   * against a non-existent server.
   */
  enabled?: boolean;
}

export interface UseUsageStreamResult {
  sample: McsAdminLiveUsageSample | null;
  lastHeartbeatAt: string | null;
  status: UsageStreamStatus;
}

const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;

export function useUsageStream(options: UseUsageStreamOptions = {}): UseUsageStreamResult {
  const enabled = options.enabled ?? true;
  const [sample, setSample] = useState<McsAdminLiveUsageSample | null>(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState<string | null>(null);
  const [status, setStatus] = useState<UsageStreamStatus>(enabled ? 'connecting' : 'disabled');

  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef<number>(BACKOFF_INITIAL_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUnmountRef = useRef<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      setStatus('disabled');
      return;
    }
    closedByUnmountRef.current = false;

    function connect() {
      const es = new EventSource(MCS_ADMIN_LIVE_OPS_PATHS.usageStream, {
        withCredentials: true,
      });
      esRef.current = es;

      es.addEventListener('open', () => {
        backoffRef.current = BACKOFF_INITIAL_MS;
        setStatus('live');
      });

      const onFrame = (evt: MessageEvent) => {
        try {
          const frame = JSON.parse(evt.data) as McsAdminLiveUsageStreamEvent;
          if (frame.kind === 'snapshot') {
            setSample(frame.sample);
          } else if (frame.kind === 'heartbeat') {
            setLastHeartbeatAt(frame.at);
          }
        } catch {
          // malformed frame — ignore; stream stays open
        }
      };

      es.addEventListener('snapshot', onFrame);
      es.addEventListener('heartbeat', onFrame);

      es.onerror = () => {
        es.close();
        esRef.current = null;
        if (closedByUnmountRef.current) {
          setStatus('closed');
          return;
        }
        const delay = backoffRef.current;
        backoffRef.current = Math.min(delay * 2, BACKOFF_MAX_MS);
        setStatus('reconnecting');
        reconnectTimerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (!enabled) return;
      closedByUnmountRef.current = true;
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (esRef.current !== null) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [enabled]);

  return { sample, lastHeartbeatAt, status };
}
