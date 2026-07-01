/**
 * E.4 — Recruitment Leg movement.
 *
 * No binary leg structure. No comparison to other teams. No comp math.
 * Only TM's overall growth: rolling 7d / 30d / lifetime + a 30-day daily
 * sparkline. Locked Chat #85.
 */

import type { McsQueueGrowthSparkline } from '@momentum/shared';

interface Props {
  growth: McsQueueGrowthSparkline | null;
  loading: boolean;
}

export function GrowthSparkline({ growth, loading }: Props) {
  return (
    <section className="mb-10">
      <header className="mb-3">
        <h2 className="font-display text-[22px] leading-none">
          E.4 · Recruitment Leg movement
        </h2>
        <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mt-1">
          TM overall · new placements · no comp math · no binary detail
        </p>
      </header>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Tile label="Rolling 7 days" value={growth?.rolling7} loading={loading} />
        <Tile label="Rolling 30 days" value={growth?.rolling30} loading={loading} />
        <Tile
          label="Lifetime"
          value={growth?.lifetime}
          loading={loading}
          accent="gold"
        />
      </div>

      <div className="bg-ink-2 border border-line rounded-md p-4">
        <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-3">
          Daily placements · last 30 days (UTC)
        </p>
        {growth?.daily30 ? (
          <SparkChart buckets={growth.daily30} />
        ) : (
          <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
            {loading ? 'Loading…' : 'No data.'}
          </p>
        )}
      </div>
    </section>
  );
}

function Tile({
  label,
  value,
  loading,
  accent,
}: {
  label: string;
  value: number | undefined;
  loading: boolean;
  accent?: 'gold';
}) {
  return (
    <div className="bg-ink-2 border border-line rounded-md px-4 py-3">
      <p className="text-[10px] font-mono tracking-label text-cream-faint uppercase mb-1">
        {label}
      </p>
      <p
        className={[
          'font-display text-[28px] leading-none',
          accent === 'gold' ? 'text-gold' : 'text-cream',
        ].join(' ')}
      >
        {loading ? '…' : typeof value === 'number' ? value.toLocaleString() : '—'}
      </p>
    </div>
  );
}

function SparkChart({
  buckets,
}: {
  buckets: ReadonlyArray<{ date: string; count: number }>;
}) {
  const width = 720;
  const height = 96;
  const padding = 4;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const max = buckets.reduce((m, b) => (b.count > m ? b.count : m), 0);
  const denom = max === 0 ? 1 : max;
  const stepX = buckets.length > 1 ? innerW / (buckets.length - 1) : 0;

  const points = buckets
    .map((b, i) => {
      const x = padding + i * stepX;
      const y = padding + innerH - (b.count / denom) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const first = buckets[0]?.date ?? '';
  const last = buckets[buckets.length - 1]?.date ?? '';

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-24"
        aria-label="30-day daily placements"
      >
        {/* Baseline */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          stroke="rgba(245,239,230,0.12)"
          strokeWidth={1}
        />
        {/* Bars (subtle) */}
        {buckets.map((b, i) => {
          const x = padding + i * stepX - 3;
          const barH = (b.count / denom) * innerH;
          const y = padding + innerH - barH;
          return (
            <rect
              key={b.date}
              x={x}
              y={y}
              width={6}
              height={barH}
              fill="rgba(45,212,191,0.10)"
            />
          );
        })}
        {/* Line */}
        <polyline
          fill="none"
          stroke="#2DD4BF"
          strokeWidth={1.5}
          points={points}
        />
        {/* Dots */}
        {buckets.map((b, i) => {
          const x = padding + i * stepX;
          const y = padding + innerH - (b.count / denom) * innerH;
          return <circle key={b.date} cx={x} cy={y} r={1.6} fill="#2DD4BF" />;
        })}
      </svg>
      <div className="flex justify-between text-[10px] font-mono tracking-label text-cream-faint uppercase mt-1">
        <span>{first}</span>
        <span>max {max.toLocaleString()}/day</span>
        <span>{last}</span>
      </div>
    </div>
  );
}
