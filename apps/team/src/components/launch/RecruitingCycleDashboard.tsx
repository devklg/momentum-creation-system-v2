import { useCallback, useEffect, useState } from 'react';
import type React from 'react';
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  ListChecks,
  MessageSquareText,
  RefreshCw,
  Send,
  Sparkles,
  UsersRound,
} from 'lucide-react';
import {
  MCS_RECRUITING_STEP_LABELS,
  RECRUITING_CYCLE_NAMES_TARGET,
  RECRUITING_CYCLE_TRANCHE_COUNT,
  type McsRecruitingAttestationLeg,
  type McsRecruitingCycleAttestPayload,
  type McsRecruitingCycleAttestResponse,
  type McsRecruitingCycleDerived,
  type McsRecruitingCycleMeResponse,
  type McsRecruitingCycleRecord,
  type McsRecruitingStep,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';

interface MichaelTouch {
  text: string;
  at: string | null;
}

interface RecruitingCycleMeView extends McsRecruitingCycleMeResponse {
  michael?: {
    latestTouch?: MichaelTouch | null;
  };
}

interface SponsorCycleSummary {
  tmagId: string;
  fullName: string;
  firstName: string;
  cycle: McsRecruitingCycleRecord;
  derived: McsRecruitingCycleDerived;
  pendingAttestations: Array<{
    leg: McsRecruitingAttestationLeg;
    label: string;
    suggestedEnrolleeTmagId?: string | null;
  }>;
}

type PendingAttestation = SponsorCycleSummary['pendingAttestations'][number];

interface SponsorCyclesResponse {
  ok: true;
  cycles: SponsorCycleSummary[];
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'ready';
      me: RecruitingCycleMeView;
      sponsorCycles: SponsorCycleSummary[];
    };

const STEP_ACTIONS: Record<McsRecruitingStep, string[]> = {
  1: ['Add the next names you already know.', 'Build toward this tranche before wording or sending.'],
  2: ['Choose one warm name.', 'Use Ivory or your own words, then send manually.'],
  3: ['Point the person back to the PMV presentation.', 'Watch for video progress in your cockpit.'],
  4: ['Follow up from their actual signal.', 'Record notes so your sponsor can support the next touch.'],
  5: ['Walk the new BA into their own launch path.', 'Keep the sponsor handoff personal and BA-to-BA.'],
};

const STEP_RESOURCES: Record<McsRecruitingStep, Array<{ label: string; href: string }>> = {
  1: [{ label: 'Open Ivory names', href: '/ivory' }],
  2: [
    { label: 'Draft an invitation', href: '/invitations' },
    { label: 'Open ScriptMaker videos', href: '/video-library' },
  ],
  3: [{ label: 'Work the PMV table', href: '/cockpit#pmv' }],
  4: [{ label: 'Open Prospect CRM', href: '/crm' }],
  5: [{ label: 'Open sponsor workbook', href: '/sponsor/interview-workbook/self' }],
};

const LEG_LABEL: Record<McsRecruitingAttestationLeg, string> = {
  left: 'Left leg',
  right: 'Right leg',
  core3: 'CORE 3',
};

function percent(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

function dateLabel(iso: string | null): string {
  if (!iso) return 'Not recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function countdownCopy(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return 'Target will appear when the cycle starts.';
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return 'Target will appear when the cycle starts.';
  const diff = target - nowMs;
  if (diff <= 0) return 'Momentum target window is open.';
  const hours = Math.ceil(diff / (60 * 60 * 1000));
  if (hours < 24) return `${hours}h to focus the next action.`;
  const days = Math.floor(hours / 24);
  const remainder = hours % 24;
  return remainder === 0 ? `${days}d to build momentum.` : `${days}d ${remainder}h to build momentum.`;
}

function cycleTone(cycle: McsRecruitingCycleRecord): string {
  if (cycle.status === 'completed') return 'Launch rhythm complete';
  if (cycle.status === 'stalled') return 'Michael has a support flag ready';
  return 'Launch rhythm active';
}

export async function attestRecruitingCycle(
  tmagId: string,
  payload: McsRecruitingCycleAttestPayload,
): Promise<McsRecruitingCycleAttestResponse> {
  const res = await fetch(`/api/recruiting-cycle/${encodeURIComponent(tmagId)}/attest`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new Error(body?.message ?? body?.error ?? 'Sponsor attestation was not accepted.');
  }
  return (await res.json()) as McsRecruitingCycleAttestResponse;
}

async function loadMe(): Promise<RecruitingCycleMeView> {
  const res = await fetch('/api/recruiting-cycle/me', { credentials: 'include' });
  if (!res.ok) throw new Error('Could not load your launch cycle.');
  return (await res.json()) as RecruitingCycleMeView;
}

async function loadSponsorCycles(): Promise<SponsorCycleSummary[]> {
  const res = await fetch('/api/recruiting-cycle/sponsor', { credentials: 'include' });
  if (!res.ok) return [];
  const body = (await res.json()) as SponsorCyclesResponse;
  return body.ok ? body.cycles : [];
}

export function RecruitingCycleDashboardPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const [me, sponsorCycles] = await Promise.all([loadMe(), loadSponsorCycles()]);
      setState({ kind: 'ready', me, sponsorCycles });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Could not load your launch cycle.',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.kind === 'loading') {
    return (
      <DashboardShell>
        <p className="font-mono text-[13px] tracking-[0.08em] text-cream-faint">
          Loading launch checklist...
        </p>
      </DashboardShell>
    );
  }

  if (state.kind === 'error') {
    return (
      <DashboardShell>
        <p className="mb-5 font-mono text-[13px] tracking-[0.06em] text-red-300">{state.message}</p>
        <Button
          onClick={() => {
            setState({ kind: 'loading' });
            void load();
          }}
          className="border border-cream/15 bg-cream/[0.04] px-5 py-4 font-mono text-[13px] tracking-[0.04em] text-cream hover:border-gold/40"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Try again
        </Button>
      </DashboardShell>
    );
  }

  return (
    <RecruitingCycleDashboardView
      me={state.me}
      sponsorCycles={state.sponsorCycles}
      onAttested={(tmagId, cycle) => {
        setState((prev) => {
          if (prev.kind !== 'ready') return prev;
          return {
            ...prev,
            sponsorCycles: prev.sponsorCycles.map((item) =>
              item.tmagId === tmagId ? { ...item, cycle } : item,
            ),
          };
        });
      }}
    />
  );
}

export function RecruitingCycleDashboardView({
  me,
  sponsorCycles,
  onAttested,
}: {
  me: RecruitingCycleMeView;
  sponsorCycles: SponsorCycleSummary[];
  onAttested?: (tmagId: string, cycle: McsRecruitingCycleRecord) => void;
}) {
  return (
    <DashboardShell>
      <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-gold">
            Launch checklist
          </p>
          <h1 className="font-display text-[clamp(36px,6vw,68px)] leading-[0.95] text-cream">
            5 Point Recruiting Cycle
          </h1>
          <p className="mt-4 max-w-3xl text-[15px] leading-[1.65] text-cream-mute">
            List, invite, present, follow up, and onboard with the same rhythm your sponsor
            can support. Targets are coaching markers, not pressure points.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:min-w-[360px]">
          <MetricTile label="Names target" value={String(RECRUITING_CYCLE_NAMES_TARGET)} />
          <MetricTile label="Tranches" value={String(RECRUITING_CYCLE_TRANCHE_COUNT)} />
        </div>
      </header>

      {me.cycle && me.derived ? (
        <ActiveCycle cycle={me.cycle} derived={me.derived} why={me.why} touch={me.michael?.latestTouch ?? null} />
      ) : (
        <PreSteveCycle why={me.why} />
      )}

      <SponsorAttestationPanel sponsorCycles={sponsorCycles} onAttested={onAttested} />
    </DashboardShell>
  );
}

function ActiveCycle({
  cycle,
  derived,
  why,
  touch,
}: {
  cycle: McsRecruitingCycleRecord;
  derived: McsRecruitingCycleDerived;
  why: string | null;
  touch: MichaelTouch | null;
}) {
  const currentLabel = MCS_RECRUITING_STEP_LABELS[derived.currentStep];
  const namesPct = percent(derived.namesCount, derived.namesTarget);

  return (
    <main className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <section className="space-y-6">
        <div className="rounded-md border border-gold/25 bg-gold/[0.04] p-5 sm:p-6">
          <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-teal">
                {cycleTone(cycle)}
              </p>
              <h2 className="mt-2 font-display text-[34px] leading-none text-cream">
                {currentLabel}
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <CountdownChip label="48h five-step" value={countdownCopy(cycle.fivePointTargetAt)} />
              <CountdownChip label="72h QBA" value={countdownCopy(cycle.qbaTargetAt)} />
            </div>
          </div>

          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cream-faint">
                Names list
              </span>
              <span className="font-mono text-[12px] text-teal">
                {derived.namesCount}/{derived.namesTarget} · tranche {derived.tranchesCompleted}/
                {derived.trancheCount}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full border border-cream/10 bg-ink/60">
              <div className="h-full bg-teal" style={{ width: `${namesPct}%` }} />
            </div>
          </div>

          <StepRail derived={derived} />
        </div>

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ActionPanel step={derived.currentStep} />
          <ProgressPanel derived={derived} />
        </section>
      </section>

      <aside className="space-y-5">
        <WhyPanel why={why} />
        <MichaelTouchPanel touch={touch} />
        <CycleDates cycle={cycle} />
      </aside>
    </main>
  );
}

function PreSteveCycle({ why }: { why: string | null }) {
  return (
    <main className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-6 sm:p-8">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-gold">
          Before Steve completes
        </p>
        <h2 className="font-display text-[34px] leading-none text-cream">
          Your launch cycle starts from your Discovery profile.
        </h2>
        <p className="mt-4 max-w-2xl text-[15px] leading-[1.65] text-cream-mute">
          Steve captures the why statement and hands the launch rhythm to Michael. Until
          then, this page stays ready without inventing progress.
        </p>
        <Button
          asChild
          className="mt-6 bg-gold px-6 py-5 font-display text-[16px] tracking-[0.06em] text-ink hover:bg-gold-bright"
        >
          <a href="/steve/discovery">
            Open Steve
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      </section>
      <WhyPanel why={why} />
    </main>
  );
}

function StepRail({ derived }: { derived: McsRecruitingCycleDerived }) {
  return (
    <ol className="grid grid-cols-1 gap-2 md:grid-cols-5">
      {derived.steps.map((step) => (
        <li
          key={step.step}
          className={[
            'min-h-[92px] rounded border p-3',
            step.complete
              ? 'border-teal/35 bg-teal/[0.05]'
              : step.step === derived.currentStep
                ? 'border-gold/45 bg-gold/[0.06]'
                : 'border-cream/10 bg-cream/[0.02]',
          ].join(' ')}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[11px] text-cream-faint">0{step.step}</span>
            {step.complete ? (
              <CheckCircle2 className="h-4 w-4 text-teal" aria-hidden="true" />
            ) : (
              <Clock3 className="h-4 w-4 text-cream-faint" aria-hidden="true" />
            )}
          </div>
          <p className="text-[13px] leading-[1.25] text-cream">{step.label}</p>
        </li>
      ))}
    </ol>
  );
}

function ActionPanel({ step }: { step: McsRecruitingStep }) {
  const resources = STEP_RESOURCES[step];
  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
        Today's actions
      </p>
      <ul className="space-y-3">
        {STEP_ACTIONS[step].map((action) => (
          <li key={action} className="flex gap-3 text-[14px] leading-[1.5] text-cream-mute">
            <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-teal" aria-hidden="true" />
            <span>{action}</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        {resources.map((resource) => (
          <a
            key={resource.href}
            href={resource.href}
            className="inline-flex items-center rounded border border-gold/30 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gold hover:border-gold/60"
          >
            {resource.label}
          </a>
        ))}
      </div>
    </section>
  );
}

function ProgressPanel({ derived }: { derived: McsRecruitingCycleDerived }) {
  const rows = [
    { label: 'Names', value: derived.namesCount, icon: <UsersRound className="h-4 w-4" /> },
    { label: 'Invites', value: derived.invitesCount, icon: <Send className="h-4 w-4" /> },
    {
      label: 'Presentations',
      value: derived.presentationsCount,
      icon: <Sparkles className="h-4 w-4" />,
    },
    {
      label: 'Follow-ups',
      value: derived.followUpsCount,
      icon: <MessageSquareText className="h-4 w-4" />,
    },
    { label: 'Onboarded', value: derived.enrollmentsCount, icon: <BadgeCheck className="h-4 w-4" /> },
  ];

  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
        Live state
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center gap-3 rounded border border-cream/10 p-3">
            <span className="text-teal">{row.icon}</span>
            <span className="flex-1 text-[13px] text-cream-mute">{row.label}</span>
            <span className="font-mono text-[14px] text-cream">{row.value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function WhyPanel({ why }: { why: string | null }) {
  return (
    <section className="rounded-md border border-gold/25 bg-gold/[0.04] p-5">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
        Pinned why
      </p>
      <p className="text-[15px] leading-[1.65] text-cream">
        {why ?? 'Your why appears here after Steve captures it verbatim.'}
      </p>
    </section>
  );
}

function MichaelTouchPanel({ touch }: { touch: MichaelTouch | null }) {
  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-teal">
        Michael's latest touch
      </p>
      <p className="text-[14px] leading-[1.6] text-cream-mute">
        {touch?.text ?? 'Michael will attach the next coaching touch to the earliest open step.'}
      </p>
      {touch?.at ? <p className="mt-3 font-mono text-[11px] text-cream-faint">{dateLabel(touch.at)}</p> : null}
    </section>
  );
}

function CycleDates({ cycle }: { cycle: McsRecruitingCycleRecord }) {
  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-cream-faint">
        Cycle markers
      </p>
      <dl className="space-y-2 text-[13px]">
        <Marker label="Started" value={dateLabel(cycle.enrolledAt)} />
        <Marker label="Five-step target" value={dateLabel(cycle.fivePointTargetAt)} />
        <Marker label="QBA target" value={dateLabel(cycle.qbaTargetAt)} />
        <Marker label="Last activity" value={dateLabel(cycle.lastActivityAt)} />
      </dl>
    </section>
  );
}

function SponsorAttestationPanel({
  sponsorCycles,
  onAttested,
}: {
  sponsorCycles: SponsorCycleSummary[];
  onAttested?: (tmagId: string, cycle: McsRecruitingCycleRecord) => void;
}) {
  return (
    <section className="mt-8 rounded-md border border-cream/10 bg-cream/[0.02] p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">
            Sponsor attestations
          </p>
          <h2 className="mt-2 font-display text-[30px] leading-none text-cream">
            Enrollee launch status
          </h2>
        </div>
        <span className="font-mono text-[12px] text-cream-faint">
          {sponsorCycles.length} active enrollees
        </span>
      </div>

      {sponsorCycles.length === 0 ? (
        <p className="max-w-2xl text-[14px] leading-[1.6] text-cream-mute">
          When your personally sponsored BAs enter the recruiting cycle, their status and
          pending left, right, and CORE 3 attestations appear here.
        </p>
      ) : (
        <div className="space-y-3">
          {sponsorCycles.map((item) => (
            <SponsorCycleRow key={item.tmagId} item={item} onAttested={onAttested} />
          ))}
        </div>
      )}
    </section>
  );
}

function SponsorCycleRow({
  item,
  onAttested,
}: {
  item: SponsorCycleSummary;
  onAttested?: (tmagId: string, cycle: McsRecruitingCycleRecord) => void;
}) {
  const [values, setValues] = useState<Record<McsRecruitingAttestationLeg, string>>({
    left: item.cycle.qbaLeftLegTmagId ?? '',
    right: item.cycle.qbaRightLegTmagId ?? '',
    core3: item.cycle.core3TmagId ?? '',
  });
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<McsRecruitingAttestationLeg | null>(null);

  const pendingLegs: PendingAttestation[] = item.pendingAttestations.length
    ? item.pendingAttestations
    : (['left', 'right', 'core3'] as McsRecruitingAttestationLeg[]).map((leg) => ({
        leg,
        label: LEG_LABEL[leg],
      }));

  async function submit(leg: McsRecruitingAttestationLeg) {
    const enrolleeTmagId = values[leg].trim();
    if (!enrolleeTmagId) {
      setMessage(`Enter the ${LEG_LABEL[leg]} enrollee TMAG ID first.`);
      return;
    }
    const confirmed = window.confirm(
      `Attest ${enrolleeTmagId} as ${LEG_LABEL[leg]} for ${item.fullName}?`,
    );
    if (!confirmed) return;
    setSubmitting(leg);
    setMessage(null);
    try {
      const result = await attestRecruitingCycle(item.tmagId, {
        leg,
        enrolleeTmagId,
        note: note.trim() || undefined,
      });
      setMessage(result.milestone ? `Recorded: ${result.milestone}.` : 'Attestation recorded.');
      onAttested?.(item.tmagId, result.cycle);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Sponsor attestation was not accepted.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <article className="rounded border border-cream/10 bg-ink/35 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[18px] leading-tight text-cream">{item.fullName}</p>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-faint">
            {item.tmagId} · step {item.derived.currentStep}/5 · {item.derived.namesCount}/
            {item.derived.namesTarget} names
          </p>
        </div>
        <span className="rounded border border-teal/30 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.1em] text-teal">
          {cycleTone(item.cycle)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {pendingLegs.map(({ leg, label, suggestedEnrolleeTmagId }) => (
          <div key={leg} className="rounded border border-cream/10 p-3">
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-[0.12em] text-cream-faint">
              {label}
            </label>
            <input
              value={values[leg] || suggestedEnrolleeTmagId || ''}
              onChange={(event) => setValues((prev) => ({ ...prev, [leg]: event.target.value }))}
              placeholder="TMAG ID"
              className="mb-3 w-full rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream outline-none focus:border-gold/60"
            />
            <button
              type="button"
              onClick={() => void submit(leg)}
              disabled={submitting !== null}
              className="w-full rounded border border-gold/35 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-gold hover:border-gold/60 disabled:cursor-wait disabled:opacity-60"
            >
              {submitting === leg ? 'Recording...' : 'Attest'}
            </button>
          </div>
        ))}
      </div>

      <label className="mt-3 block font-mono text-[11px] uppercase tracking-[0.12em] text-cream-faint">
        Sponsor note
      </label>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="Optional context for the audit record."
        className="mt-2 w-full resize-none rounded border border-cream/15 bg-ink px-3 py-2 text-[13px] text-cream outline-none focus:border-gold/60"
      />
      {message ? <p className="mt-3 text-[13px] leading-[1.5] text-cream-mute">{message}</p> : null}
    </article>
  );
}

function CountdownChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[158px] rounded border border-cream/10 bg-ink/40 px-3 py-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-cream-faint">{label}</p>
      <p className="mt-1 text-[13px] leading-tight text-cream">{value}</p>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-cream/10 bg-cream/[0.02] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cream-faint">{label}</p>
      <p className="mt-1 font-display text-[28px] leading-none text-gold">{value}</p>
    </div>
  );
}

function Marker({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-cream-faint">{label}</dt>
      <dd className="text-right font-mono text-[12px] text-cream">{value}</dd>
    </div>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-ink px-6 py-14 text-cream">
      <div className="mx-auto max-w-7xl">{children}</div>
    </div>
  );
}
