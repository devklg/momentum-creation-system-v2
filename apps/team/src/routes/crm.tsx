/**
 * /crm - Prospect CRM Hub.
 *
 * BA-scoped prospect management view built on the existing PMV projection.
 * This is a hub over leads/prospects before enrollment, not team-member
 * management. Wire shapes stay local per the .team TS6059 convention.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Filter,
  MessageSquareText,
  PlayCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type TokenState =
  | 'minted'
  | 'clicked'
  | 'video_started'
  | 'video_quarter'
  | 'video_half'
  | 'video_three_quarter'
  | 'video_complete'
  | 'enrolled'
  | 'expired';

type InvitationSource = 'self' | 'ivory' | 'scriptmaker' | 'vm' | 'rvm';

type CrmDisposition =
  | 'new_brand_ambassador'
  | 'new_customer'
  | 'interested'
  | 'not_interested'
  | 'later';

type ProspectLifecycleStage =
  | 'draft'
  | 'sent_unopened'
  | 'clicked'
  | 'video_started'
  | 'video_25'
  | 'video_50'
  | 'video_75'
  | 'watched'
  | 'callback_requested'
  | 'customer'
  | 'enrolled'
  | 'expired'
  | 'archived';

interface ProspectNextAction {
  kind: string;
  label: string;
  reason: string;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: string | null;
  scriptKind: string | null;
}

interface ProspectLastSignal {
  kind: string;
  label: string;
  at: string;
}

interface ProspectMomentumRow {
  prospectId: string;
  token: string;
  firstName: string;
  lastInitial: string;
  city: string;
  stateOrRegion: string;
  source: InvitationSource;
  lifecycle: ProspectLifecycleStage;
  tokenState: TokenState;
  videoProgressPct: 0 | 25 | 50 | 75 | 100 | null;
  clickedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  expiresAt: string;
  positionNumber: number | null;
  placedAt: string | null;
  latestCallbackIntent: string | null;
  crm: {
    disposition: CrmDisposition | null;
    followUpDueAt: string | null;
    followUpIsDue: boolean;
    noteCount: number;
    latestNoteAt: string | null;
  };
  lastSignal: ProspectLastSignal;
  nextAction: ProspectNextAction;
}

interface ProspectMomentumViewerResponse {
  ok: true;
  generatedAt: string;
  focusQueue: unknown[];
  rows: ProspectMomentumRow[];
  lifecycleGaps: string[];
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; rows: ProspectMomentumRow[]; generatedAt: string };

type CrmFilter =
  | 'all'
  | 'personal'
  | 'pmv'
  | 'vm'
  | 'callbacks'
  | 'followup'
  | 'watching'
  | 'completed'
  | 'holding'
  | 'closed';

const FILTERS: Array<{ key: CrmFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'personal', label: 'Personal' },
  { key: 'pmv', label: 'PMV' },
  { key: 'vm', label: 'VM' },
  { key: 'callbacks', label: 'Callbacks' },
  { key: 'followup', label: 'Follow-up' },
  { key: 'watching', label: 'Watching' },
  { key: 'completed', label: 'Completed' },
  { key: 'holding', label: 'Holding Tank' },
  { key: 'closed', label: 'Closed' },
];

const SOURCE_LABEL: Record<InvitationSource, string> = {
  self: 'Personal',
  ivory: 'Ivory',
  scriptmaker: 'PMV',
  vm: 'VM',
  rvm: 'VM',
};

const LIFECYCLE_LABEL: Record<ProspectLifecycleStage, string> = {
  draft: 'Draft',
  sent_unopened: 'Sent',
  clicked: 'Clicked',
  video_started: 'Started',
  video_25: '25%',
  video_50: '50%',
  video_75: '75%',
  watched: 'Completed',
  callback_requested: 'Callback',
  customer: 'Customer',
  enrolled: 'New BA',
  expired: 'Expired',
  archived: 'Archived',
};

function formatDate(iso: string | null): string {
  if (!iso) return 'Not set';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function isVm(row: ProspectMomentumRow): boolean {
  return row.source === 'vm' || row.source === 'rvm';
}

function isWatching(row: ProspectMomentumRow): boolean {
  return [
    'clicked',
    'video_started',
    'video_25',
    'video_50',
    'video_75',
  ].includes(row.lifecycle);
}

function isClosed(row: ProspectMomentumRow): boolean {
  return ['customer', 'enrolled', 'expired', 'archived'].includes(row.lifecycle);
}

export function CrmPage() {
  const navigate = useNavigate();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [filter, setFilter] = useState<CrmFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cockpit/pmv', { credentials: 'include' });
      if (res.status === 401) {
        navigate('/login');
        return;
      }
      if (!res.ok) {
        setView({ kind: 'error', message: 'Could not load Prospect CRM.' });
        return;
      }
      const data = (await res.json()) as ProspectMomentumViewerResponse;
      setView({ kind: 'ready', rows: data.rows, generatedAt: data.generatedAt });
      setSelectedId((prev) => prev ?? data.rows[0]?.prospectId ?? null);
    } catch {
      setView({ kind: 'error', message: 'Network error loading Prospect CRM.' });
    }
  }, [navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (view.kind !== 'ready') return [];
    const q = query.trim().toLowerCase();
    return view.rows.filter((row) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'personal' && row.source === 'self') ||
        (filter === 'pmv' && row.source !== 'self' && !isVm(row)) ||
        (filter === 'vm' && isVm(row)) ||
        (filter === 'callbacks' && row.latestCallbackIntent !== null) ||
        (filter === 'followup' && row.crm.followUpDueAt !== null) ||
        (filter === 'watching' && isWatching(row)) ||
        (filter === 'completed' && row.lifecycle === 'watched') ||
        (filter === 'holding' && row.positionNumber !== null) ||
        (filter === 'closed' && isClosed(row));
      if (!matchesFilter) return false;
      if (!q) return true;
      return [
        row.firstName,
        row.lastInitial,
        row.city,
        row.stateOrRegion,
        row.token,
        row.nextAction.label,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [view, filter, query]);

  const selected =
    view.kind === 'ready'
      ? view.rows.find((row) => row.prospectId === selectedId) ?? filtered[0] ?? null
      : null;

  const counts =
    view.kind === 'ready'
      ? {
          all: view.rows.length,
          callbacks: view.rows.filter((r) => r.latestCallbackIntent !== null).length,
          followup: view.rows.filter((r) => r.crm.followUpDueAt !== null).length,
          watching: view.rows.filter(isWatching).length,
          completed: view.rows.filter((r) => r.lifecycle === 'watched').length,
          holding: view.rows.filter((r) => r.positionNumber !== null).length,
        }
      : null;

  return (
    <main className="min-h-screen px-4 py-8 md:py-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/cockpit')}
              className="mb-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.12em] text-cream-faint hover:text-gold uppercase"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Cockpit
            </button>
            <p className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase mb-2">
              Prospect CRM
            </p>
            <h1 className="font-display text-[clamp(38px,7vw,72px)] leading-[0.9] text-cream">
              People before enrollment
            </h1>
          </div>
          <Button
            onClick={() => navigate('/invitations')}
            className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-6 py-5"
          >
            Invite someone
          </Button>
        </header>

        {view.kind === 'loading' && (
          <StatusCard text="Loading Prospect CRM..." />
        )}

        {view.kind === 'error' && (
          <div className="rounded-md border border-red-400/30 bg-red-500/5 p-6">
            <p className="font-mono text-[13px] tracking-[0.04em] text-red-300">
              {view.message}
            </p>
            <button
              type="button"
              onClick={() => {
                setView({ kind: 'loading' });
                void load();
              }}
              className="mt-4 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.08em] text-gold hover:underline"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          </div>
        )}

        {view.kind === 'ready' && (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-6">
              <Metric label="Total" value={counts?.all ?? 0} />
              <Metric label="Callbacks" value={counts?.callbacks ?? 0} accent="gold" />
              <Metric label="Follow-up" value={counts?.followup ?? 0} accent="teal" />
              <Metric label="Watching" value={counts?.watching ?? 0} />
              <Metric label="Completed" value={counts?.completed ?? 0} />
              <Metric label="Holding Tank" value={counts?.holding ?? 0} accent="gold" />
            </div>

            <section className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_340px]">
              <div className="rounded-md border border-cream/10 bg-cream/[0.02] p-3">
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-cream-faint">
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  Views
                </div>
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setFilter(f.key)}
                      className={
                        'rounded border px-3 py-1.5 font-mono text-[11px] tracking-[0.05em] transition-colors ' +
                        (filter === f.key
                          ? 'border-gold/60 bg-gold/[0.08] text-gold'
                          : 'border-cream/10 bg-cream/[0.02] text-cream-faint hover:border-cream/25 hover:text-cream')
                      }
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="relative block">
                <span className="sr-only">Search prospects</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cream-faint" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, city, token"
                  className="h-full min-h-[74px] border-cream/10 bg-cream/[0.02] pl-10 font-mono text-[13px]"
                />
              </label>
            </section>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream-mute">
                    {filtered.length} shown
                  </p>
                  <p className="font-mono text-[10px] tracking-[0.06em] text-cream-faint">
                    Updated {formatDate(view.generatedAt)}
                  </p>
                </div>
                {filtered.length === 0 ? (
                  <StatusCard text="No prospects match this view." />
                ) : (
                  <ul className="space-y-2">
                    {filtered.map((row) => (
                      <li key={row.prospectId}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(row.prospectId)}
                          className={
                            'w-full rounded-md border p-4 text-left transition-colors ' +
                            (selected?.prospectId === row.prospectId
                              ? 'border-gold/50 bg-gold/[0.05]'
                              : 'border-cream/10 bg-cream/[0.02] hover:border-cream/25')
                          }
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[17px] leading-[1.2] text-cream">
                                {row.firstName} {row.lastInitial}.
                              </p>
                              <p className="mt-1 font-mono text-[11px] tracking-[0.04em] text-cream-faint">
                                {row.city || 'Unknown city'}
                                {row.stateOrRegion ? `, ${row.stateOrRegion}` : ''} / {SOURCE_LABEL[row.source] ?? row.source}
                              </p>
                            </div>
                            <StatusPill row={row} />
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                            <Signal icon={<MessageSquareText />} label="Next" value={row.nextAction.label} />
                            <Signal icon={<PlayCircle />} label="Video" value={row.videoProgressPct === null ? 'Not started' : `${row.videoProgressPct}%`} />
                            <Signal icon={<CalendarClock />} label="Follow-up" value={formatDate(row.crm.followUpDueAt)} />
                            <Signal icon={<CheckCircle2 />} label="Notes" value={`${row.crm.noteCount}`} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <aside className="xl:sticky xl:top-6">
                {selected ? (
                  <DetailPanel row={selected} onOpenCockpit={() => navigate('/cockpit')} />
                ) : (
                  <StatusCard text="Select a prospect to view the timeline." />
                )}
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: 'gold' | 'teal';
}) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/[0.02] p-4">
      <p
        className={
          'font-display text-[32px] leading-none ' +
          (accent === 'gold'
            ? 'text-gold'
            : accent === 'teal'
              ? 'text-teal'
              : 'text-cream')
        }
      >
        {value}
      </p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-cream-faint">
        {label}
      </p>
    </div>
  );
}

function StatusCard({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-cream/10 bg-cream/[0.02] p-6">
      <p className="font-mono text-[13px] tracking-[0.04em] text-cream-faint">
        {text}
      </p>
    </div>
  );
}

function StatusPill({ row }: { row: ProspectMomentumRow }) {
  const closed = isClosed(row);
  const cls = closed
    ? 'border-cream/15 text-cream-faint bg-transparent'
    : row.latestCallbackIntent
      ? 'border-gold/40 text-gold bg-gold/[0.06]'
      : isWatching(row)
        ? 'border-teal/40 text-teal bg-teal/[0.06]'
        : 'border-cream/15 text-cream-mute bg-cream/[0.03]';
  return (
    <span className={`rounded border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] ${cls}`}>
      {LIFECYCLE_LABEL[row.lifecycle]}
    </span>
  );
}

function Signal({
  icon,
  label,
  value,
}: {
  icon: React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-cream-faint">
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-[0.08em]">
          {label}
        </span>
      </div>
      <p className="truncate text-[13px] text-cream-mute">{value}</p>
    </div>
  );
}

function DetailPanel({
  row,
  onOpenCockpit,
}: {
  row: ProspectMomentumRow;
  onOpenCockpit: () => void;
}) {
  const events = [
    { label: 'Created', at: row.createdAt },
    row.sentAt ? { label: 'Sent', at: row.sentAt } : null,
    row.clickedAt ? { label: 'Clicked', at: row.clickedAt } : null,
    row.placedAt ? { label: 'Completed presentation', at: row.placedAt } : null,
    row.crm.latestNoteAt ? { label: 'Latest note', at: row.crm.latestNoteAt } : null,
  ].filter(Boolean) as Array<{ label: string; at: string }>;

  return (
    <div className="rounded-md border border-gold/25 bg-cream/[0.02] p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold">
        Contact record
      </p>
      <h2 className="mt-2 font-display text-[34px] leading-none text-cream">
        {row.firstName} {row.lastInitial}.
      </h2>
      <p className="mt-2 font-mono text-[11px] tracking-[0.04em] text-cream-faint">
        {row.token} / {SOURCE_LABEL[row.source] ?? row.source}
      </p>

      <dl className="mt-5 space-y-3 text-[13px]">
        <Info label="Status" value={LIFECYCLE_LABEL[row.lifecycle]} />
        <Info label="Next action" value={row.nextAction.label} />
        <Info label="Why" value={row.nextAction.reason} />
        <Info label="Disposition" value={row.crm.disposition ?? 'Active'} />
        <Info label="Follow-up" value={formatDate(row.crm.followUpDueAt)} />
        <Info label="Holding Tank" value={row.positionNumber ? `#${row.positionNumber}` : 'Not placed'} />
      </dl>

      <div className="mt-6 border-t border-cream/10 pt-5">
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em] text-cream-faint">
          Timeline
        </p>
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={`${event.label}-${event.at}`} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold" />
              <span>
                <span className="block text-[13px] text-cream">{event.label}</span>
                <span className="font-mono text-[10px] tracking-[0.05em] text-cream-faint">
                  {formatDate(event.at)}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <Button
        onClick={onOpenCockpit}
        className="mt-6 w-full border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px] tracking-[0.04em]"
      >
        Open PMV row drawer
      </Button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-cream/10 pb-2 last:border-0">
      <dt className="text-cream-faint">{label}</dt>
      <dd className="text-right text-cream">{value}</dd>
    </div>
  );
}

export default CrmPage;
