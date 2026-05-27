/**
 * H.2 — Growth stat cards. Three cards side-by-side, one per window
 * (24h / 7d / 30d). Each card shows three counts (BAs added, prospects
 * placed, enrollments) and the signed delta vs. the previous equal window.
 *
 * Mirrors MetricsRow's tile aesthetic (display 34px for the headline, mono
 * 10px eyebrow) but is non-interactive — these are read-only summaries,
 * not drilldown affordances.
 */

import type { AdminGrowthCard, AdminGrowthCardsResponse } from '@momentum/shared';

interface Props {
  data: AdminGrowthCardsResponse | null;
  loading: boolean;
}

export function GrowthCards({ data, loading }: Props) {
  return (
    <section className="mb-6">
      <header className="flex items-baseline justify-between mb-3">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            H.2 · Growth
          </p>
          <h2 className="font-display text-[22px] leading-none mt-0.5">
            BAs · prospects · enrollments
          </h2>
        </div>
        {data && (
          <p className="text-[10px] font-mono tracking-label text-cream-faint uppercase">
            as of {new Date(data.generatedAt).toLocaleTimeString()}
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {data
          ? data.cards.map((card) => <Card key={card.window} card={card} loading={loading} />)
          : [0, 1, 2].map((i) => <CardPlaceholder key={i} loading={loading} />)}
      </div>
    </section>
  );
}

function Card({ card, loading }: { card: AdminGrowthCard; loading: boolean }) {
  return (
    <div
      className={[
        'p-4 rounded-md border border-line bg-cream/[0.015]',
        loading ? 'opacity-70' : '',
      ].join(' ')}
    >
      <p className="font-mono tracking-eyebrow text-[10px] text-cream-faint uppercase mb-3">
        Window · {labelForWindow(card.window)}
      </p>
      <Row label="BAs added" value={card.basAdded} delta={card.basAddedDelta} />
      <Row
        label="Prospects placed"
        value={card.prospectsPlaced}
        delta={card.prospectsPlacedDelta}
      />
      <Row
        label="Enrollments"
        value={card.enrollments}
        delta={card.enrollmentsDelta}
        last
      />
    </div>
  );
}

function CardPlaceholder({ loading }: { loading: boolean }) {
  return (
    <div className="p-4 rounded-md border border-line bg-cream/[0.015]">
      <p className="font-mono tracking-eyebrow text-[10px] text-cream-faint uppercase mb-3">
        Window · —
      </p>
      <p className={['text-[12px] font-mono text-cream-mute', loading ? 'animate-pulse' : ''].join(' ')}>
        {loading ? 'loading…' : 'no data'}
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  delta,
  last,
}: {
  label: string;
  value: number;
  delta: number;
  last?: boolean;
}) {
  return (
    <div
      className={[
        'flex items-baseline justify-between py-2',
        last ? '' : 'border-b border-line',
      ].join(' ')}
    >
      <span className="text-[11px] font-mono tracking-label uppercase text-cream-faint">
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className="font-display text-[24px] leading-none text-cream tabular-nums">
          {value.toLocaleString()}
        </span>
        <Delta value={delta} />
      </span>
    </div>
  );
}

function Delta({ value }: { value: number }) {
  if (value === 0) {
    return (
      <span className="text-[11px] font-mono text-cream-faint tabular-nums">±0</span>
    );
  }
  const positive = value > 0;
  const color = positive ? 'text-teal' : 'text-red-400';
  const sign = positive ? '+' : '';
  return (
    <span className={`text-[11px] font-mono tabular-nums ${color}`}>
      {sign}
      {value.toLocaleString()}
    </span>
  );
}

function labelForWindow(window: AdminGrowthCard['window']): string {
  if (window === '24h') return 'last 24 hours';
  if (window === '7d') return 'last 7 days';
  return 'last 30 days';
}
