/**
 * Master metrics row (wf_0077). Five tiles in order:
 *   active BAs · prospects in flow · queue Δ24h · enrollments 24h · training %
 *
 * Each tile is a clickable button that opens the drilldown panel (wf_0078).
 * The active tile is visually distinguished with a gold border.
 */

import type {
  McsAdminDashboardMetrics,
  McsAdminDashboardTile,
} from '@momentum/shared';

interface Props {
  metrics: McsAdminDashboardMetrics | null;
  loading: boolean;
  activeTile: McsAdminDashboardTile | null;
  onSelectTile: (tile: McsAdminDashboardTile) => void;
}

export function MetricsRow({ metrics, loading, activeTile, onSelectTile }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
      <Tile
        tile="active_bas"
        eyebrow="Active BAs · 24h"
        value={metrics ? `${metrics.activeBaCount}` : '—'}
        sub={metrics ? `of ${metrics.totalBaCount} total` : 'loading…'}
        loading={loading}
        active={activeTile === 'active_bas'}
        onClick={() => onSelectTile('active_bas')}
      />
      <Tile
        tile="prospects_in_flow"
        eyebrow="Prospects in flow"
        value={metrics ? `${metrics.prospectsInFlow}` : '—'}
        sub={metrics ? 'in-pool, not yet enrolled/expired' : 'loading…'}
        loading={loading}
        active={activeTile === 'prospects_in_flow'}
        onClick={() => onSelectTile('prospects_in_flow')}
      />
      <Tile
        tile="queue_movement"
        eyebrow="Queue Δ · 24h"
        value={metrics ? signedNumber(metrics.queueMovement24h.net) : '—'}
        sub={
          metrics
            ? `${metrics.queueMovement24h.placements} placed · ${metrics.queueMovement24h.flushes} flushed`
            : 'loading…'
        }
        loading={loading}
        active={activeTile === 'queue_movement'}
        onClick={() => onSelectTile('queue_movement')}
      />
      <Tile
        tile="enrollments"
        eyebrow="Enrollments · 24h"
        value={metrics ? `${metrics.enrollments24h}` : '—'}
        sub={metrics ? 'pool flushed → enrolled' : 'loading…'}
        loading={loading}
        active={activeTile === 'enrollments'}
        onClick={() => onSelectTile('enrollments')}
      />
      <Tile
        tile="training"
        eyebrow="Training %"
        value={metrics ? formatPct(metrics.trainingCompletionPct) : '—'}
        sub={metrics ? 'Fast Start complete' : 'loading…'}
        loading={loading}
        active={activeTile === 'training'}
        onClick={() => onSelectTile('training')}
      />
    </div>
  );
}

interface TileProps {
  tile: McsAdminDashboardTile;
  eyebrow: string;
  value: string;
  sub: string;
  loading: boolean;
  active: boolean;
  onClick: () => void;
}

function Tile({ eyebrow, value, sub, loading, active, onClick }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'text-left p-4 rounded-md border transition-colors',
        active
          ? 'border-gold bg-gold/[0.05]'
          : 'border-line bg-cream/[0.015] hover:border-gold/40 hover:bg-cream/[0.025]',
      ].join(' ')}
    >
      <p className="font-mono tracking-eyebrow text-[10px] text-cream-faint uppercase mb-2">
        {eyebrow}
      </p>
      <p
        className={[
          'font-display text-[34px] leading-none mb-1.5',
          loading ? 'text-cream-mute animate-pulse' : 'text-cream',
        ].join(' ')}
      >
        {value}
      </p>
      <p className="text-[11px] font-mono text-cream-mute">{sub}</p>
    </button>
  );
}

function signedNumber(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

function formatPct(p: number | null): string {
  if (p === null) return '—';
  return `${p}%`;
}
