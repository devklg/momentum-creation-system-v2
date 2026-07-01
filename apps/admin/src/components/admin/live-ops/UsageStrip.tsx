/**
 * H.1 — Real-time usage strip. Four tiles across the top of /live-ops:
 *   • Dashboard viewers  · active .com prospect-dashboard SSE subscribers
 *   • Events / min       · pool placements + audit tail combined
 *   • Gateway p50        · last-60s round-trip
 *   • Gateway p95        · last-60s round-trip
 *
 * The connection pill in the header pulses (per locked-spec 3.15 — "the
 * usage strip pulses; everything else is calm"). When the contract sends
 * null for either latency, the tile shows "—" and a faint hint.
 */

import type { McsAdminLiveUsageSample } from '@momentum/shared';
import type { UsageStreamStatus } from './useUsageStream';

interface Props {
  sample: McsAdminLiveUsageSample | null;
  status: UsageStreamStatus;
  lastHeartbeatAt: string | null;
}

export function UsageStrip({ sample, status, lastHeartbeatAt }: Props) {
  return (
    <section className="border border-line rounded-md overflow-hidden mb-6">
      <header className="flex items-center justify-between px-4 py-3 border-b border-line bg-cream/[0.025]">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            H.1 · Real-time usage strip
          </p>
          <p className="font-display text-[20px] leading-none mt-0.5">
            Right now on Team Magnificent
          </p>
        </div>
        <ConnectionPill status={status} lastHeartbeatAt={lastHeartbeatAt} />
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4">
        <Tile
          eyebrow="Dashboard viewers"
          value={sample ? `${sample.activeDashboardViewers}` : '—'}
          sub={
            sample
              ? `${sample.activeAdminSessions} admin session${sample.activeAdminSessions === 1 ? '' : 's'}`
              : 'awaiting first frame'
          }
        />
        <Tile
          eyebrow="Events / min"
          value={sample ? `${sample.eventsPerMinute}` : '—'}
          sub={sample ? 'placements + audit · last 60s' : 'awaiting first frame'}
        />
        <Tile
          eyebrow="Gateway p50"
          value={sample ? fmtLatency(sample.gatewayLatencyMsP50) : '—'}
          sub={
            sample === null
              ? 'awaiting first frame'
              : sample.gatewayLatencyMsP50 === null
                ? 'no calls in last 60s'
                : 'round-trip · last 60s'
          }
        />
        <Tile
          eyebrow="Gateway p95"
          value={sample ? fmtLatency(sample.gatewayLatencyMsP95) : '—'}
          sub={
            sample === null
              ? 'awaiting first frame'
              : sample.gatewayLatencyMsP95 === null
                ? 'no calls in last 60s'
                : 'round-trip · last 60s'
          }
        />
      </div>
    </section>
  );
}

interface TileProps {
  eyebrow: string;
  value: string;
  sub: string;
}

function Tile({ eyebrow, value, sub }: TileProps) {
  return (
    <div className="p-4 border-r border-line last:border-r-0 [&:nth-child(2)]:border-r-0 md:[&:nth-child(2)]:border-r md:[&:nth-child(3)]:border-l-0 [&:nth-child(3)]:border-t md:[&:nth-child(3)]:border-t-0">
      <p className="font-mono tracking-eyebrow text-[10px] text-cream-faint uppercase mb-2">
        {eyebrow}
      </p>
      <p className="font-display text-[34px] leading-none mb-1.5 text-cream tabular-nums">
        {value}
      </p>
      <p className="text-[11px] font-mono text-cream-mute">{sub}</p>
    </div>
  );
}

function fmtLatency(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function ConnectionPill({
  status,
  lastHeartbeatAt,
}: {
  status: UsageStreamStatus;
  lastHeartbeatAt: string | null;
}) {
  const cls =
    status === 'live'
      ? 'text-teal border-teal/30 bg-teal/[0.08]'
      : status === 'connecting' || status === 'reconnecting' || status === 'disabled'
        ? 'text-cream-mute border-line bg-cream/[0.025]'
        : 'text-red-400 border-red-400/30 bg-red-400/[0.06]';
  const dot =
    status === 'live'
      ? 'bg-teal animate-pulse'
      : status === 'reconnecting'
        ? 'bg-gold animate-pulse'
        : status === 'connecting' || status === 'disabled'
          ? 'bg-cream-mute'
          : 'bg-red-400';
  const label = status === 'disabled' ? 'mock' : status;
  return (
    <span
      className={[
        'inline-flex items-center gap-2 px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
        cls,
      ].join(' ')}
      title={lastHeartbeatAt ? `last heartbeat ${new Date(lastHeartbeatAt).toLocaleTimeString()}` : undefined}
    >
      <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
