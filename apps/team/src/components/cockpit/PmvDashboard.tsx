/**
 * BA-scoped PMV activity dashboard.
 *
 * This is an observational snapshot built from the existing PMV projection.
 * It deliberately avoids scoring people, predicting outcomes, compensation
 * language, and organization-position language.
 */

export type PmvDashboardLifecycle =
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

export interface PmvDashboardRow {
  lifecycle: PmvDashboardLifecycle;
  sentAt: string | null;
  clickedAt: string | null;
  latestCallbackIntent: string | null;
  crm: {
    followUpIsDue: boolean;
  };
  nextAction: {
    priority: number;
  };
}

export interface PmvDashboardSnapshot {
  peopleInvited: number;
  manualSends: number;
  linkOpens: number;
  videoStarts: number;
  presentationsCompleted: number;
  callbackRequests: number;
  followUpsDue: number;
  activeNextSteps: number;
  createdToOpenRate: number | null;
  openToCompleteRate: number | null;
  completeToCallbackRate: number | null;
}

const OPENED_LIFECYCLES = new Set<PmvDashboardLifecycle>([
  'clicked',
  'video_started',
  'video_25',
  'video_50',
  'video_75',
  'watched',
  'callback_requested',
  'customer',
  'enrolled',
]);

const VIDEO_STARTED_LIFECYCLES = new Set<PmvDashboardLifecycle>([
  'video_started',
  'video_25',
  'video_50',
  'video_75',
  'watched',
  'callback_requested',
  'customer',
  'enrolled',
]);

const COMPLETED_LIFECYCLES = new Set<PmvDashboardLifecycle>([
  'watched',
  'callback_requested',
  'customer',
  'enrolled',
]);

function rate(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Math.round((numerator / denominator) * 100);
}

export function buildPmvDashboardSnapshot(
  rows: readonly PmvDashboardRow[],
): PmvDashboardSnapshot {
  const peopleInvited = rows.length;
  const manualSends = rows.filter((row) => row.sentAt !== null).length;
  const linkOpens = rows.filter(
    (row) => row.clickedAt !== null || OPENED_LIFECYCLES.has(row.lifecycle),
  ).length;
  const videoStarts = rows.filter((row) =>
    VIDEO_STARTED_LIFECYCLES.has(row.lifecycle),
  ).length;
  const presentationsCompleted = rows.filter((row) =>
    COMPLETED_LIFECYCLES.has(row.lifecycle),
  ).length;
  const callbackRequests = rows.filter(
    (row) =>
      row.latestCallbackIntent !== null || row.lifecycle === 'callback_requested',
  ).length;
  const followUpsDue = rows.filter((row) => row.crm.followUpIsDue).length;
  const activeNextSteps = rows.filter((row) => row.nextAction.priority > 0).length;

  return {
    peopleInvited,
    manualSends,
    linkOpens,
    videoStarts,
    presentationsCompleted,
    callbackRequests,
    followUpsDue,
    activeNextSteps,
    createdToOpenRate: rate(linkOpens, peopleInvited),
    openToCompleteRate: rate(presentationsCompleted, linkOpens),
    completeToCallbackRate: rate(callbackRequests, presentationsCompleted),
  };
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="font-display text-[34px] leading-none text-cream">{value}</p>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.1em] text-cream-faint">
        {label}
      </p>
    </div>
  );
}

function RateLine({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-cream/10 pt-3">
      <span className="text-[12px] leading-[1.4] text-cream-mute">{label}</span>
      <span className="font-mono text-[12px] text-gold">
        {value === null ? '—' : `${value}%`}
      </span>
    </div>
  );
}

export function PmvDashboard({ rows }: { rows: readonly PmvDashboardRow[] }) {
  const snapshot = buildPmvDashboardSnapshot(rows);
  const groups = [
    {
      eyebrow: 'People',
      description: 'Relationships you invited',
      metrics: [
        { label: 'People invited', value: snapshot.peopleInvited },
        { label: 'Manual sends', value: snapshot.manualSends },
      ],
    },
    {
      eyebrow: 'Momentum',
      description: 'Presentation activity',
      metrics: [
        { label: 'Link opens', value: snapshot.linkOpens },
        { label: 'Video starts', value: snapshot.videoStarts },
      ],
    },
    {
      eyebrow: 'Volume',
      description: 'Completed presentations and replies',
      metrics: [
        { label: 'Presentations completed', value: snapshot.presentationsCompleted },
        { label: 'Callback requests', value: snapshot.callbackRequests },
      ],
    },
    {
      eyebrow: 'Next steps',
      description: 'Your manual follow-up work',
      metrics: [
        { label: 'Follow-ups due', value: snapshot.followUpsDue },
        { label: 'Active next steps', value: snapshot.activeNextSteps },
      ],
    },
  ] as const;

  return (
    <section
      aria-labelledby="pmv-dashboard-title"
      className="overflow-hidden rounded-md border border-gold/25 bg-cream/[0.025]"
    >
      <div className="flex flex-col gap-3 border-b border-cream/10 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold">
            PMV activity snapshot
          </p>
          <h3
            id="pmv-dashboard-title"
            className="mt-2 font-display text-[28px] leading-none text-cream"
          >
            People moving through the presentation
          </h3>
        </div>
        <p className="max-w-md text-[12px] leading-[1.55] text-cream-faint md:text-right">
          BA-scoped activity counts only. No person is scored, ranked, qualified,
          or predicted.
        </p>
      </div>

      <div className="grid grid-cols-1 divide-y divide-cream/10 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 xl:divide-x xl:divide-cream/10">
        {groups.map((group, index) => (
          <div
            key={group.eyebrow}
            className={
              'px-5 py-5 md:px-6 ' +
              (index >= 2 ? 'sm:border-t sm:border-cream/10 xl:border-t-0' : '') +
              (index % 2 === 1 ? ' sm:border-l sm:border-cream/10 xl:border-l-0' : '')
            }
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-gold">
              {group.eyebrow}
            </p>
            <p className="mt-1 min-h-9 text-[12px] leading-[1.45] text-cream-faint">
              {group.description}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-4">
              {group.metrics.map((metric) => (
                <Metric key={metric.label} label={metric.label} value={metric.value} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-t border-cream/10 bg-ink/20 px-5 py-4 md:grid-cols-3 md:px-6">
        <RateLine label="Invitations opened" value={snapshot.createdToOpenRate} />
        <RateLine label="Opens reaching completion" value={snapshot.openToCompleteRate} />
        <RateLine
          label="Completions requesting a callback"
          value={snapshot.completeToCallbackRate}
        />
      </div>
    </section>
  );
}
