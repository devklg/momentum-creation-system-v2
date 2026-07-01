/**
 * H.4 — Conversion funnels. Two shapes (prospect funnel · BA activation),
 * toggleable via a segmented control in the header. Horizontal bars,
 * bar width = stage.count / stages[0].count.
 *
 * The kind toggle is *control-only* — the parent owns the kind state
 * because the parent does the fetch, so changing kind triggers a refetch.
 */

import type { McsAdminFunnelKind, McsAdminFunnelResponse, McsAdminFunnelStage } from '@momentum/shared';

interface Props {
  data: McsAdminFunnelResponse | null;
  kind: McsAdminFunnelKind;
  onKindChange: (next: McsAdminFunnelKind) => void;
  loading: boolean;
}

export function ConversionFunnel({ data, kind, onKindChange, loading }: Props) {
  const stages = data?.stages ?? [];
  const firstCount = stages[0]?.count ?? 0;

  return (
    <section className="mb-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4 mb-3">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            H.4 · Conversion funnel
          </p>
          <h2 className="font-display text-[22px] leading-none mt-0.5">
            {kind === 'prospect' ? 'Prospect funnel' : 'BA activation funnel'}
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <KindToggle kind={kind} onChange={onKindChange} />
          {data && (
            <p className="text-[10px] font-mono tracking-label text-cream-faint uppercase">
              as of {new Date(data.generatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
      </header>

      <div className="border border-line rounded-md p-4 bg-cream/[0.015]">
        {data === null ? (
          <p
            className={[
              'text-[12px] font-mono tracking-label uppercase text-cream-faint',
              loading ? 'animate-pulse' : '',
            ].join(' ')}
          >
            {loading ? 'loading…' : 'no data'}
          </p>
        ) : stages.length === 0 ? (
          <p className="text-[12px] font-mono tracking-label uppercase text-cream-faint">
            funnel empty
          </p>
        ) : (
          <ol className="space-y-2">
            {stages.map((stage, idx) => (
              <Row key={stage.key} stage={stage} firstCount={firstCount} index={idx} />
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function Row({
  stage,
  firstCount,
  index,
}: {
  stage: McsAdminFunnelStage;
  firstCount: number;
  index: number;
}) {
  const widthPct = firstCount > 0 ? Math.max(2, (stage.count / firstCount) * 100) : 0;
  const isFirst = index === 0;
  return (
    <li className="grid grid-cols-[200px_1fr_120px] items-center gap-3">
      <span className="text-[12px] font-mono tracking-label uppercase text-cream-mute truncate">
        {stage.label}
      </span>
      <div className="relative h-7 bg-cream/[0.04] rounded-sm overflow-hidden border border-line">
        <div
          className={[
            'absolute inset-y-0 left-0 transition-[width] duration-300',
            isFirst ? 'bg-gold/70' : 'bg-teal/70',
          ].join(' ')}
          style={{ width: `${widthPct}%` }}
        />
        <span className="absolute inset-0 flex items-center px-2 text-[12px] font-mono text-cream tabular-nums">
          {stage.count.toLocaleString()}
        </span>
      </div>
      <span className="text-[11px] font-mono text-cream-mute tabular-nums text-right">
        {formatConversion(stage.conversionFromStart)}
      </span>
    </li>
  );
}

function KindToggle({
  kind,
  onChange,
}: {
  kind: McsAdminFunnelKind;
  onChange: (next: McsAdminFunnelKind) => void;
}) {
  return (
    <div className="inline-flex border border-line rounded overflow-hidden">
      <ToggleButton active={kind === 'prospect'} onClick={() => onChange('prospect')}>
        Prospect
      </ToggleButton>
      <ToggleButton
        active={kind === 'ba_activation'}
        onClick={() => onChange('ba_activation')}
      >
        BA activation
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1 text-[11px] font-mono tracking-label uppercase transition-colors',
        active
          ? 'bg-gold/[0.12] text-gold'
          : 'bg-transparent text-cream-mute hover:text-cream',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function formatConversion(c: number | null): string {
  if (c === null) return '—';
  return `${(c * 100).toFixed(1)}%`;
}
