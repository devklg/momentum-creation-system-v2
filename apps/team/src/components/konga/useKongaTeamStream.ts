import { useEffect, useState } from 'react';
import type {
  McsJoinEvent,
  McsKongaPlacementEvent,
  McsKongaTeamSnapshotResponse,
} from '@momentum/shared';
import type { KongaLineConnectionState } from '@momentum/konga-ui';

interface KongaTeamStreamState {
  loading: boolean;
  error: string | null;
  snapshot: McsKongaTeamSnapshotResponse | null;
  stream: KongaLineConnectionState;
}

const EMPTY_STREAM: KongaLineConnectionState = {
  connecting: false,
  connected: false,
  errored: false,
  ticker: [],
  latestArrival: null,
  latestJoin: null,
};

function streamFromSnapshot(snapshot: McsKongaTeamSnapshotResponse): KongaLineConnectionState {
  return {
    ...EMPTY_STREAM,
    ticker: snapshot.placementSnapshot.recent,
    connecting: snapshot.hasFirstInvite,
  };
}

export function useKongaTeamStream(): KongaTeamStreamState {
  const [state, setState] = useState<KongaTeamStreamState>({
    loading: true,
    error: null,
    snapshot: null,
    stream: EMPTY_STREAM,
  });

  useEffect(() => {
    const abort = new AbortController();
    let events: EventSource | null = null;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/cockpit/konga', {
          credentials: 'include',
          signal: abort.signal,
        });
        if (!response.ok) throw new Error('konga_snapshot_unavailable');
        const snapshot = (await response.json()) as McsKongaTeamSnapshotResponse;
        if (cancelled) return;
        setState({
          loading: false,
          error: null,
          snapshot,
          stream: streamFromSnapshot(snapshot),
        });

        // The first persisted invitation is the factual genesis boundary.
        // Until it exists there is no line and no live connection to open.
        if (!snapshot.hasFirstInvite || !snapshot.genesis) return;

        events = new EventSource('/api/cockpit/konga/stream', { withCredentials: true });
        events.addEventListener('open', () => {
          setState((current) => ({
            ...current,
            stream: { ...current.stream, connecting: false, connected: true, errored: false },
          }));
        });
        events.addEventListener('snapshot', (raw) => {
          const next = JSON.parse((raw as MessageEvent<string>).data) as McsKongaTeamSnapshotResponse;
          setState((current) => ({
            ...current,
            snapshot: next,
            stream: {
              ...current.stream,
              ticker: next.placementSnapshot.recent,
              connecting: false,
              connected: true,
              errored: false,
            },
          }));
        });
        events.addEventListener('placement', (raw) => {
          const placement = JSON.parse((raw as MessageEvent<string>).data) as McsKongaPlacementEvent;
          setState((current) => ({
            ...current,
            stream: {
              ...current.stream,
              latestArrival: placement,
              ticker: [placement, ...current.stream.ticker.filter((entry) =>
                entry.positionNumber !== placement.positionNumber || entry.placedAt !== placement.placedAt
              )].slice(0, 40),
            },
          }));
        });
        events.addEventListener('join', (raw) => {
          const join = JSON.parse((raw as MessageEvent<string>).data) as McsJoinEvent;
          setState((current) => ({
            ...current,
            stream: { ...current.stream, latestJoin: join },
          }));
        });
        events.addEventListener('error', () => {
          setState((current) => ({
            ...current,
            stream: { ...current.stream, connecting: false, connected: false, errored: true },
          }));
        });
      } catch (error) {
        if (cancelled || abort.signal.aborted) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: error instanceof Error ? error.message : 'konga_snapshot_unavailable',
        }));
      }
    };

    void load();
    return () => {
      cancelled = true;
      abort.abort();
      events?.close();
    };
  }, []);

  return state;
}
