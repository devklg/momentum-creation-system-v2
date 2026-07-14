import { useEffect, useState } from 'react';
import type {
  McsAdminDashboardFilter,
  McsAdminTrainingAnalyticsResponse,
} from '@momentum/shared';

interface Props {
  filter: McsAdminDashboardFilter;
  onClose: () => void;
}

export function TrainingAnalyticsPanel({ filter, onClose }: Props) {
  const [response, setResponse] = useState<McsAdminTrainingAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResponse(null);
    setError(null);
    const params = new URLSearchParams();
    if (filter.tmagId) params.set('tmagId', filter.tmagId);
    params.set('leaderGroup', filter.leaderGroup);

    void (async () => {
      try {
        const result = await fetch(`/api/admin/dashboard/training-analytics?${params.toString()}`, {
          credentials: 'include',
        });
        const data = (await result.json()) as McsAdminTrainingAnalyticsResponse & { error?: string };
        if (!data.ok) {
          setError(data.error ?? 'Could not load training analytics.');
          return;
        }
        setResponse(data);
      } catch (caught) {
        setError(caught instanceof Error ? `Network error: ${caught.message}` : 'Network error.');
      }
    })();
  }, [filter.leaderGroup, filter.tmagId]);

  const analytics = response?.analytics;

  return (
    <section className="border border-line rounded-md mb-6 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-line bg-cream/[0.025]">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">Aggregate analytics</p>
          <p className="font-display text-[20px] leading-none mt-0.5">Fast Start curriculum health</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[11px] font-mono uppercase tracking-label text-cream-mute hover:text-cream"
        >
          Close
        </button>
      </header>

      <div className="p-4">
        <p className="text-xs text-cream-mute mb-4 max-w-3xl">
          Explicit Fast Start progress only. Counts describe curriculum state; they do not rank,
          score, predict, or measure the effectiveness of any person.
        </p>

        {error && <p className="text-[13px] font-mono text-red-400">{error}</p>}
        {!error && !analytics && (
          <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint">Loading…</p>
        )}
        {!error && analytics && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <AggregateCard label="Scope" value={analytics.scopeBaCount} />
              <AggregateCard label="Not started" value={analytics.programStateCounts.notStarted} />
              <AggregateCard label="Underway" value={analytics.programStateCounts.underway} />
              <AggregateCard
                label="All 5 complete"
                value={analytics.programStateCounts.allModulesComplete}
                detail={
                  analytics.allModulesCompletionPct === null
                    ? 'No denominator'
                    : `${analytics.allModulesCompletionPct}% of scope`
                }
              />
            </div>

            <div className="border border-line rounded-md overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-cream/[0.025]">
                  <tr className="text-left">
                    {['Module', 'Not started', 'In progress', 'Completed', 'Completion'].map((header) => (
                      <th
                        key={header}
                        className="px-4 py-2 text-[10px] font-mono tracking-label uppercase text-cream-faint text-left"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {analytics.modules.map((module) => (
                    <tr key={module.moduleId} className="border-t border-line">
                      <td className="px-4 py-2 text-cream">
                        <span className="font-mono text-[11px] text-gold mr-2">{module.moduleId}</span>
                        {module.title}
                      </td>
                      <CountCell value={module.stateCounts.notStarted} />
                      <CountCell value={module.stateCounts.inProgress} />
                      <CountCell value={module.stateCounts.completed} />
                      <td className="px-4 py-2 font-mono text-cream">
                        {module.completionPct === null ? '—' : `${module.completionPct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(analytics.dataQuality.duplicateProgressRecordCount > 0 ||
              analytics.dataQuality.invalidProgressRecordCount > 0) && (
              <p className="mt-3 text-[11px] font-mono text-amber-300">
                Data integrity notice: {analytics.dataQuality.duplicateProgressRecordCount} duplicate and{' '}
                {analytics.dataQuality.invalidProgressRecordCount} invalid progress record(s) were excluded or resolved.
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function AggregateCard({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="border border-line rounded-md px-3 py-3 bg-cream/[0.015]">
      <p className="text-[10px] font-mono tracking-label uppercase text-cream-faint">{label}</p>
      <p className="font-display text-[28px] leading-none mt-1 text-cream">{value}</p>
      {detail && <p className="text-[10px] font-mono text-cream-mute mt-1">{detail}</p>}
    </div>
  );
}

function CountCell({ value }: { value: number }) {
  return <td className="px-4 py-2 font-mono text-cream-mute">{value}</td>;
}
