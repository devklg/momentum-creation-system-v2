import { useEffect, useState } from 'react';
import {
  MCS_KONGA_CONTRACT_VERSION,
  type McsHoldingTankSnapshot,
  type McsJoinEvent,
  type McsKongaContractVersion,
  type McsKongaHoldingTankSnapshot,
  type McsKongaPlacementEvent,
  type McsKongaPlacementTickerEntry,
  type McsPlacementEvent,
  type McsWebinarEvent,
} from '@momentum/shared';

const MAX_TICKER_ENTRIES = 80;

export interface PlacementStreamState {
  connecting: boolean;
  connected: boolean;
  errored: boolean;
  contractVersion: McsKongaContractVersion | null;
  globalMaxPosition: number;
  ticker: McsKongaPlacementTickerEntry[];
  placementsThisWeek: number | null;
  geoSpreadCount: number | null;
  sinceLastVisit: number | null;
  nextWebinar: McsWebinarEvent | null;
  pageVisitId: string | null;
  latestArrival: McsKongaPlacementEvent | null;
  latestJoin: McsJoinEvent | null;
}

const INITIAL: PlacementStreamState = {
  connecting: true,
  connected: false,
  errored: false,
  contractVersion: null,
  globalMaxPosition: 0,
  ticker: [],
  placementsThisWeek: null,
  geoSpreadCount: null,
  sinceLastVisit: null,
  nextWebinar: null,
  pageVisitId: null,
  latestArrival: null,
  latestJoin: null,
};

function legacyEntry(entry: McsPlacementEvent): McsKongaPlacementTickerEntry {
  return { ...entry, addedBy: null };
}

export function usePlacementStream(
  token: string | undefined,
  apiBase: '/api/p' | '/api/rvm' = '/api/p',
  pageVisitId?: string,
): PlacementStreamState {
  const [state, setState] = useState<PlacementStreamState>(INITIAL);

  useEffect(() => {
    if (!token) {
      setState({ ...INITIAL, connecting: false });
      return;
    }

    const visitQuery = pageVisitId
      ? `?pageVisitId=${encodeURIComponent(pageVisitId)}`
      : '';
    const es = new EventSource(
      `${apiBase}/${encodeURIComponent(token)}/stream${visitQuery}`,
    );

    const onSnapshot = (message: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(message.data) as
          | McsKongaHoldingTankSnapshot
          | McsHoldingTankSnapshot;
        if ('contractVersion' in payload && payload.contractVersion === MCS_KONGA_CONTRACT_VERSION) {
          setState((previous) => ({
            ...previous,
            connecting: false,
            connected: true,
            errored: false,
            contractVersion: payload.contractVersion,
            globalMaxPosition: payload.globalMaxPosition,
            ticker: payload.recent.slice(0, MAX_TICKER_ENTRIES),
            placementsThisWeek: payload.placementsThisWeek,
            geoSpreadCount: payload.geoSpreadCount,
            sinceLastVisit: payload.sinceLastVisit,
            nextWebinar: payload.nextWebinar,
            pageVisitId: payload.pageVisitId,
          }));
          return;
        }

        setState((previous) => ({
          ...previous,
          connecting: false,
          connected: true,
          errored: false,
          contractVersion: null,
          globalMaxPosition: payload.globalMaxPosition,
          ticker: payload.recent.map((entry) => ({ ...entry, addedBy: null })).slice(0, MAX_TICKER_ENTRIES),
        }));
      } catch {
        // A reconnect supplies another authoritative snapshot.
      }
    };

    const onPlacement = (message: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(message.data) as McsKongaPlacementEvent | McsPlacementEvent;
        const isKonga = 'contractVersion' in payload
          && payload.contractVersion === MCS_KONGA_CONTRACT_VERSION;
        const entry: McsKongaPlacementTickerEntry = isKonga
          ? payload as McsKongaPlacementEvent
          : legacyEntry(payload as McsPlacementEvent);
        setState((previous) => {
          if (previous.ticker.some((item) => item.positionNumber === entry.positionNumber)) {
            return previous;
          }
          return {
            ...previous,
            connecting: false,
            connected: true,
            errored: false,
            contractVersion: isKonga
              ? MCS_KONGA_CONTRACT_VERSION
              : previous.contractVersion,
            globalMaxPosition: Math.max(previous.globalMaxPosition, entry.positionNumber),
            ticker: [entry, ...previous.ticker].slice(0, MAX_TICKER_ENTRIES),
            placementsThisWeek:
              previous.placementsThisWeek === null
                ? null
                : previous.placementsThisWeek + 1,
            latestArrival: isKonga
              ? payload as McsKongaPlacementEvent
              : previous.latestArrival,
          };
        });
      } catch {
        // Ignore malformed public events; the next snapshot repairs state.
      }
    };

    const onJoin = (message: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(message.data) as McsJoinEvent;
        if (payload.contractVersion !== MCS_KONGA_CONTRACT_VERSION) return;
        setState((previous) => ({
          ...previous,
          connected: true,
          errored: false,
          contractVersion: payload.contractVersion,
          latestJoin: payload,
        }));
      } catch {
        // Ignore malformed public events; the next snapshot repairs state.
      }
    };

    const onError = () => setState((previous) => ({ ...previous, errored: true }));

    es.addEventListener('snapshot', onSnapshot as EventListener);
    es.addEventListener('placement', onPlacement as EventListener);
    es.addEventListener('join', onJoin as EventListener);
    es.addEventListener('error', onError);

    return () => {
      es.removeEventListener('snapshot', onSnapshot as EventListener);
      es.removeEventListener('placement', onPlacement as EventListener);
      es.removeEventListener('join', onJoin as EventListener);
      es.removeEventListener('error', onError);
      es.close();
    };
  }, [apiBase, pageVisitId, token]);

  return state;
}
