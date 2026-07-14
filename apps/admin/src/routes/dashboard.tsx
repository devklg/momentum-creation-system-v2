/**
 * /dashboard — Admin Core Dashboard (Section B · wireframe 4.B).
 *
 * Composes:
 *   • FilterBar      (wf_0079) — BA + leader-group filter
 *   • MetricsRow     (wf_0077) — five tiles (active BAs, prospects in flow,
 *                                queue Δ24h, enrollments 24h, training %)
 *   • DrilldownPanel (wf_0078) — operational detail rows, opens on tile click
 *   • TrainingAnalyticsPanel   — aggregate curriculum state, no person rows
 *   • LiveEventStream(wf_0080) — SSE: placements + audit-log tail
 *
 * Filter changes re-fetch metrics + drilldown together (the panel keys on
 * filter changes and refetches itself). The live stream is filter-agnostic
 * — operationally Kevin wants to see everything happening on the team in
 * real time, regardless of the filter narrowing.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  McsAdminDashboardFilter,
  McsAdminDashboardFiltersResponse,
  McsAdminDashboardMetrics,
  McsAdminDashboardMetricsResponse,
  McsAdminDashboardTile,
} from '@momentum/shared';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { MetricsRow } from '@/components/dashboard/MetricsRow';
import { DrilldownPanel } from '@/components/dashboard/DrilldownPanel';
import { LiveEventStream } from '@/components/dashboard/LiveEventStream';
import { HealthStatusWidget } from '@/components/dashboard/HealthStatusWidget';
import { TrainingAnalyticsPanel } from '@/components/dashboard/TrainingAnalyticsPanel';

const DEFAULT_FILTER: McsAdminDashboardFilter = { tmagId: null, leaderGroup: 'all' };

export function DashboardPage() {
  const [filter, setFilter] = useState<McsAdminDashboardFilter>(DEFAULT_FILTER);
  const [options, setOptions] = useState<McsAdminDashboardFiltersResponse | null>(null);
  const [metrics, setMetrics] = useState<McsAdminDashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeTile, setActiveTile] = useState<McsAdminDashboardTile | null>(null);

  // Filter options — load once.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/dashboard/filters', { credentials: 'include' });
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

  // Metrics — refetch on filter change.
  const loadMetrics = useCallback(async (f: McsAdminDashboardFilter) => {
    setLoadingMetrics(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (f.tmagId) params.set('tmagId', f.tmagId);
      if (f.leaderGroup) params.set('leaderGroup', f.leaderGroup);
      const res = await fetch(`/api/admin/dashboard/metrics?${params.toString()}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as McsAdminDashboardMetricsResponse & { error?: string };
      if (!data.ok) {
        setErr(data.error ?? 'Could not load metrics.');
        return;
      }
      setMetrics(data.metrics);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  useEffect(() => {
    void loadMetrics(filter);
  }, [filter, loadMetrics]);

  function onSelectTile(tile: McsAdminDashboardTile) {
    setActiveTile((prev) => (prev === tile ? null : tile));
  }

  return (
    <div className="max-w-7xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section B · Core Dashboard
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Core Dashboard</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-2xl">
        Operational metrics for Team Magnificent. Click a tile for its
        supporting detail; training opens aggregate curriculum state without
        person ranking or scoring. Live event stream tails placements and the
        audit log in real time.
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">{err}</p>
      )}

      <FilterBar filter={filter} options={options} onChange={setFilter} />

      <HealthStatusWidget />

      <MetricsRow
        metrics={metrics}
        loading={loadingMetrics}
        activeTile={activeTile}
        onSelectTile={onSelectTile}
      />

      {activeTile === 'training' && (
        <TrainingAnalyticsPanel
          filter={filter}
          onClose={() => setActiveTile(null)}
        />
      )}

      {activeTile && activeTile !== 'training' && (
        <DrilldownPanel
          tile={activeTile}
          filter={filter}
          onClose={() => setActiveTile(null)}
        />
      )}

      <LiveEventStream />
    </div>
  );
}
