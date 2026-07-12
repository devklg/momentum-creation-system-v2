/**
 * /live-ops — Admin Section H · Live Operations (wireframe 4.H,
 * build-checklist #111–114).
 *
 * Composes the four H panels:
 *   • H.1  UsageStrip          — SSE-driven, top of page, pulsing
 *   • H.2  GrowthCards         — 24h / 7d / 30d, JSON GET, polled
 *   • H.3  HoldingTankGrid     — per-slot live grid, click → prospect panel
 *   • H.4  ConversionFunnel    — toggleable prospect / BA-activation funnel
 *
 * Filter (BA + leader-group) is reused from the existing dashboard filter
 * source — same dropdown options endpoint, same shape. The filter narrows
 * H.2 / H.3 / H.4; H.1 is operationally team-wide (cannot be sliced by BA
 * — it's machine telemetry, not business state).
 *
 * The H-server endpoints are live. Mocks remain importable for isolated visual
 * development, but production reads the real admin APIs.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  McsAdminDashboardFilter,
  McsAdminDashboardFiltersResponse,
  McsAdminFunnelKind,
  McsAdminFunnelResponse,
  McsAdminGrowthCardsResponse,
  McsAdminLiveGridResponse,
  McsAdminOperationsDashboardResponse,
} from '@momentum/shared';
import { MCS_ADMIN_LIVE_OPS_PATHS } from '@momentum/shared';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { UsageStrip } from '@/components/admin/live-ops/UsageStrip';
import { GrowthCards } from '@/components/admin/live-ops/GrowthCards';
import { HoldingTankGrid } from '@/components/admin/live-ops/HoldingTankGrid';
import { ConversionFunnel } from '@/components/admin/live-ops/ConversionFunnel';
import { useUsageStream } from '@/components/admin/live-ops/useUsageStream';
import {
  mockFunnel,
  mockGrowthCards,
  mockLiveGrid,
  mockUsageSample,
} from '@/components/admin/live-ops/mocks';

/**
 * Keep false in production. The mock path is retained only for isolated UI work.
 */
const USE_MOCKS = false;

const POLL_INTERVAL_MS = 30_000;
const DEFAULT_FILTER: McsAdminDashboardFilter = { tmagId: null, leaderGroup: 'all' };

export function LiveOpsPage() {
  const [filter, setFilter] = useState<McsAdminDashboardFilter>(DEFAULT_FILTER);
  const [options, setOptions] = useState<McsAdminDashboardFiltersResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [growth, setGrowth] = useState<McsAdminGrowthCardsResponse | null>(null);
  const [growthLoading, setGrowthLoading] = useState<boolean>(false);
  const [grid, setGrid] = useState<McsAdminLiveGridResponse | null>(null);
  const [gridLoading, setGridLoading] = useState<boolean>(false);
  const [funnelKind, setFunnelKind] = useState<McsAdminFunnelKind>('prospect');
  const [funnel, setFunnel] = useState<McsAdminFunnelResponse | null>(null);
  const [funnelLoading, setFunnelLoading] = useState<boolean>(false);
  const [operations, setOperations] = useState<McsAdminOperationsDashboardResponse | null>(null);

  const stream = useUsageStream({ enabled: !USE_MOCKS });

  const loadOperations = useCallback(async () => {
    try {
      const res = await fetch(MCS_ADMIN_LIVE_OPS_PATHS.operations, { credentials: 'include' });
      const data = (await res.json()) as McsAdminOperationsDashboardResponse & { error?: string };
      if (!res.ok || !data.ok) { setErr(data.error ?? 'Operations health unavailable.'); return; }
      setOperations(data);
    } catch (e) {
      setErr(e instanceof Error ? `Operations fetch failed: ${e.message}` : 'Operations fetch failed.');
    }
  }, []);

  useEffect(() => { void loadOperations(); }, [loadOperations]);

  // Filter dropdown options — load once. Same endpoint as /dashboard.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/dashboard/filters', {
          credentials: 'include',
        });
        const data = (await res.json()) as McsAdminDashboardFiltersResponse & { error?: string };
        if (!data.ok) {
          setErr(data.error ?? 'Could not load filter options.');
          return;
        }
        setOptions(data);
      } catch (e) {
        setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      }
    })();
  }, []);

  const loadGrowth = useCallback(
    async (f: McsAdminDashboardFilter) => {
      setGrowthLoading(true);
      try {
        if (USE_MOCKS) {
          setGrowth(mockGrowthCards(f));
          return;
        }
        const params = filterToQuery(f);
        const res = await fetch(`${MCS_ADMIN_LIVE_OPS_PATHS.growthCards}?${params}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as McsAdminGrowthCardsResponse & {
          ok?: boolean;
          error?: string;
        };
        if (data.error) {
          setErr(data.error);
          return;
        }
        setGrowth(data);
      } catch (e) {
        setErr(e instanceof Error ? `Growth fetch failed: ${e.message}` : 'Growth fetch failed.');
      } finally {
        setGrowthLoading(false);
      }
    },
    [],
  );

  const loadGrid = useCallback(
    async (f: McsAdminDashboardFilter) => {
      setGridLoading(true);
      try {
        if (USE_MOCKS) {
          setGrid(mockLiveGrid(f));
          return;
        }
        const params = filterToQuery(f);
        const res = await fetch(`${MCS_ADMIN_LIVE_OPS_PATHS.liveGrid}?${params}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as McsAdminLiveGridResponse & {
          ok?: boolean;
          error?: string;
        };
        if (data.error) {
          setErr(data.error);
          return;
        }
        setGrid(data);
      } catch (e) {
        setErr(e instanceof Error ? `Grid fetch failed: ${e.message}` : 'Grid fetch failed.');
      } finally {
        setGridLoading(false);
      }
    },
    [],
  );

  const loadFunnel = useCallback(
    async (kind: McsAdminFunnelKind, f: McsAdminDashboardFilter) => {
      setFunnelLoading(true);
      try {
        if (USE_MOCKS) {
          setFunnel(mockFunnel(kind, f));
          return;
        }
        const params = filterToQuery(f);
        params.set('kind', kind);
        const res = await fetch(`${MCS_ADMIN_LIVE_OPS_PATHS.funnel}?${params}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as McsAdminFunnelResponse & {
          ok?: boolean;
          error?: string;
        };
        if (data.error) {
          setErr(data.error);
          return;
        }
        setFunnel(data);
      } catch (e) {
        setErr(e instanceof Error ? `Funnel fetch failed: ${e.message}` : 'Funnel fetch failed.');
      } finally {
        setFunnelLoading(false);
      }
    },
    [],
  );

  // Refetch on filter change.
  useEffect(() => {
    void loadGrowth(filter);
    void loadGrid(filter);
  }, [filter, loadGrowth, loadGrid]);

  // Funnel depends on both filter and kind.
  useEffect(() => {
    void loadFunnel(funnelKind, filter);
  }, [funnelKind, filter, loadFunnel]);

  // Polling — periodic refresh for the JSON-GET panels. The strip is SSE
  // and self-refreshing; these three need a heartbeat.
  useEffect(() => {
    const t = setInterval(() => {
      void loadGrowth(filter);
      void loadGrid(filter);
      void loadFunnel(funnelKind, filter);
      void loadOperations();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [filter, funnelKind, loadGrowth, loadGrid, loadFunnel, loadOperations]);

  const sampleForStrip = stream.sample ?? (USE_MOCKS ? mockUsageSample() : null);

  return (
    <div className="max-w-7xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section H · Live Operations
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Live Operations</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-2xl">
        Right-now operational view. Usage strip is real-time (SSE);
        growth, grid, and funnel are polled every {POLL_INTERVAL_MS / 1000}s.
        {USE_MOCKS && (
          <>
            {' '}
            <span className="text-gold">Mocks active</span> — H-server endpoints
            not yet wired.
          </>
        )}
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">{err}</p>
      )}

      <UsageStrip
        sample={sampleForStrip}
        status={stream.status}
        lastHeartbeatAt={stream.lastHeartbeatAt}
      />

      {operations && <OperationsHealth data={operations} />}

      <FilterBar filter={filter} options={options} onChange={setFilter} />

      <GrowthCards data={growth} loading={growthLoading} />

      <HoldingTankGrid data={grid} loading={gridLoading} />

      <ConversionFunnel
        data={funnel}
        kind={funnelKind}
        onKindChange={setFunnelKind}
        loading={funnelLoading}
      />
    </div>
  );
}

function OperationsHealth({ data }: { data: McsAdminOperationsDashboardResponse }) {
  const cards = [
    ['Persistence', data.persistence.status, data.persistence.detail],
    ['Delivery', data.delivery.status, `${data.delivery.delivered24h} delivered · ${data.delivery.failed24h} failed / 24h`],
    ['Projections', data.projections.deadLettered > 0 ? 'warning' : 'healthy', `${data.projections.pending} pending · ${data.projections.due} due · ${data.projections.deadLettered} dead`],
    ['Knowledge', data.knowledge.status, `${data.knowledge.sources} sources · ${data.knowledge.chunks} chunks · ${data.knowledge.pendingProjections} projections`],
  ];
  return (
    <section className="border border-line bg-cream/[0.025] p-5 mb-6">
      <h2 className="font-mono text-[11px] tracking-label uppercase text-gold mb-4">Operational Readiness</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
        {cards.map(([label, status, detail]) => (
          <div key={label} className="border border-line p-3">
            <div className="flex justify-between gap-2"><p className="font-display text-[22px]">{label}</p><span className="font-mono text-[9px] uppercase text-gold">{status}</span></div>
            <p className="text-xs text-cream-mute mt-2">{detail}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {data.workers.map((row) => (
          <div key={row.key} className="border border-line/70 px-3 py-2">
            <p className="text-xs text-cream">{row.label}</p><p className="font-mono text-[9px] uppercase text-cream-faint">{row.status}</p>
          </div>
        ))}
      </div>
      {data.warnings.length > 0 && <p className="text-xs text-red-300 mt-3">{data.warnings.join(' · ')}</p>}
    </section>
  );
}

function filterToQuery(f: McsAdminDashboardFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (f.tmagId) params.set('tmagId', f.tmagId);
  if (f.leaderGroup) params.set('leaderGroup', f.leaderGroup);
  return params;
}
