/**
 * E.1 — Queue depth and today's movement.
 * Counts are UTC-day-bounded server-side.
 */

import type { QueueDepthMovement } from '@momentum/shared';
import { Button } from '@/components/ui/button';

interface Props {
  movement: QueueDepthMovement | null;
  loading: boolean;
  onRefresh: () => void;
}

export function QueueDepthPanel({ movement, loading, onRefresh }: Props) {
  return (
    <section className="mb-10">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-[22px] leading-none">
          E.1 · Depth &amp; today's movement
        </h2>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="Current depth" value={movement?.currentDepth} accent="cream" />
        <Stat label="Today · placed" value={movement?.todaysPlacements} accent="teal" />
        <Stat label="Today · expired" value={movement?.todaysExpirations} />
        <Stat label="Today · manual flush" value={movement?.todaysManualFlushes} />
        <Stat label="Today · enrolled" value={movement?.todaysEnrollments} accent="gold" />
        <Stat label="Net movement" value={movement?.netMovement} accent="cream" />
      </div>
      <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mt-2">
        UTC-day bounded · placed − expired − manual − enrolled = net
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  accent = 'cream-mute',
}: {
  label: string;
  value: number | undefined;
  accent?: 'cream' | 'cream-mute' | 'gold' | 'teal';
}) {
  const colorClass =
    accent === 'gold'
      ? 'text-gold'
      : accent === 'teal'
        ? 'text-teal'
        : accent === 'cream'
          ? 'text-cream'
          : 'text-cream-mute';
  return (
    <div className="bg-ink-2 border border-line rounded-md px-4 py-3">
      <p className="text-[10px] font-mono tracking-label text-cream-faint uppercase mb-1">
        {label}
      </p>
      <p className={`font-display text-[28px] leading-none ${colorClass}`}>
        {typeof value === 'number' ? formatNumber(value) : '—'}
      </p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n > 0) return `+${n.toLocaleString()}`.replace('+', '');
  return n.toLocaleString();
}
