/**
 * H.3 — Holding-tank live grid. Every active placement slot rendered
 * as a square in a continuous stream, colored by `ageBucket`:
 *
 *   fresh    (0–6d)   gold #C9A84C
 *   warming  (7–20d)  teal #2DD4BF
 *   aging    (21–41d) cream #F5EFE6 outline (transparent fill)
 *   stale    (42–56d) ink   #0A0A0A border with low-saturation fill
 *
 * Server controls the bucketing thresholds — we just map bucket → token.
 * Clicking a slot deep-links into /admin/prospects?prospectId={id} (the
 * 4.D detail panel contract, shipped by Agent E in #141).
 */

import { useState } from 'react';
import type { McsAdminLiveGridResponse, McsAdminLiveGridSlot } from '@momentum/shared';

interface Props {
  data: McsAdminLiveGridResponse | null;
  loading: boolean;
}

const PAGE_SIZE = 96;

export function HoldingTankGrid({ data, loading }: Props) {
  const [visible, setVisible] = useState<number>(PAGE_SIZE);
  const [hovered, setHovered] = useState<McsAdminLiveGridSlot | null>(null);

  const slots = data?.slots ?? [];
  const shown = slots.slice(0, visible);
  const more = slots.length - shown.length;

  return (
    <section className="mb-6">
      <header className="flex items-baseline justify-between mb-3">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            H.3 · Holding-tank live grid
          </p>
          <h2 className="font-display text-[22px] leading-none mt-0.5">
            Active placements · click for detail
          </h2>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase">
            {data ? `${data.totalActive.toLocaleString()} active` : loading ? 'loading…' : 'no data'}
          </p>
          {data && (
            <p className="text-[10px] font-mono text-cream-faint mt-0.5">
              as of {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </header>

      <Legend />

      <div
        className="grid gap-1.5 mt-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))' }}
        onMouseLeave={() => setHovered(null)}
      >
        {shown.map((slot) => (
          <Slot key={slot.prospectId} slot={slot} onHover={setHovered} />
        ))}
      </div>

      {more > 0 && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-3 text-[11px] font-mono tracking-label uppercase text-cream-mute hover:text-gold transition-colors"
        >
          Show {Math.min(more, PAGE_SIZE).toLocaleString()} more · {more.toLocaleString()} hidden
        </button>
      )}

      <HoverDetail slot={hovered} />
    </section>
  );
}

function Slot({
  slot,
  onHover,
}: {
  slot: McsAdminLiveGridSlot;
  onHover: (s: McsAdminLiveGridSlot) => void;
}) {
  const cls = classesForBucket(slot.ageBucket);
  const label = `${slot.prospectFirstName} ${slot.prospectLastInitial}. · #${slot.positionNumber} · ${slot.ageDays}d in tank`;
  return (
    <a
      href={`/prospects?prospectId=${encodeURIComponent(slot.prospectId)}`}
      title={label}
      aria-label={label}
      onMouseEnter={() => onHover(slot)}
      onFocus={() => onHover(slot)}
      className={[
        'aspect-square rounded-sm border transition-transform hover:scale-110 hover:z-10 focus:outline-none focus:ring-1 focus:ring-gold',
        cls,
      ].join(' ')}
    />
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono tracking-label uppercase text-cream-mute">
      <LegendDot bucket="fresh" label="fresh · 0–6d" />
      <LegendDot bucket="warming" label="warming · 7–20d" />
      <LegendDot bucket="aging" label="aging · 21–41d" />
      <LegendDot bucket="stale" label="stale · 42–56d" />
    </div>
  );
}

function LegendDot({
  bucket,
  label,
}: {
  bucket: McsAdminLiveGridSlot['ageBucket'];
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={['inline-block w-3 h-3 rounded-sm border', classesForBucket(bucket)].join(' ')} />
      {label}
    </span>
  );
}

function HoverDetail({ slot }: { slot: McsAdminLiveGridSlot | null }) {
  return (
    <div className="mt-3 min-h-[44px] text-[12px] font-mono">
      {slot === null ? (
        <p className="text-cream-faint">Hover a slot for prospect detail · click to open panel.</p>
      ) : (
        <p className="text-cream-mute">
          <span className="text-cream">
            #{slot.positionNumber.toLocaleString()} · {slot.prospectFirstName}{' '}
            {slot.prospectLastInitial}.
          </span>{' '}
          · {slot.prospectCity}, {slot.prospectStateOrRegion} · {slot.ageDays}d in tank ·
          sponsor {slot.sponsorFullName}
        </p>
      )}
    </div>
  );
}

function classesForBucket(bucket: McsAdminLiveGridSlot['ageBucket']): string {
  switch (bucket) {
    case 'fresh':
      // gold C9A84C — saturated fill
      return 'bg-gold/80 border-gold';
    case 'warming':
      // teal 2DD4BF — saturated fill
      return 'bg-teal/80 border-teal';
    case 'aging':
      // cream F5EFE6 — outline only, no fill
      return 'bg-transparent border-cream/60';
    case 'stale':
    default:
      // ink 0A0A0A border + low-saturation fill — fades into the page
      return 'bg-cream/[0.04] border-ink';
  }
}
