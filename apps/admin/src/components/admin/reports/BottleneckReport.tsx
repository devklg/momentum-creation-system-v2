import { useEffect, useState } from 'react';
import type {
  McsAdminBottleneckReportResponse,
  McsAdminBottleneckSectionBase,
} from '@momentum/shared';

const LABELS = {
  invitations: 'Invitations', crm: 'CRM integrity', training: 'Training',
  events: 'Events', delivery: 'Delivery operations',
} as const;

function Status({ section }: { section: McsAdminBottleneckSectionBase }) {
  const tone = section.status === 'attention'
    ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
    : section.status === 'unavailable'
      ? 'border-red-400/40 bg-red-400/10 text-red-200'
      : 'border-gold/30 bg-gold/10 text-gold';
  return <span className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-wide ${tone}`}>{section.status}</span>;
}

function Metrics({ report, kind }: { report: McsAdminBottleneckReportResponse; kind: keyof typeof LABELS }) {
  if (kind === 'invitations') {
    const s = report.sections.invitations.currentStates;
    return <p>{s.sentUnopened} unopened · {s.openedNotStarted} opened · {s.presentationInProgress} viewing · {s.expired} expired</p>;
  }
  if (kind === 'crm') {
    const s = report.sections.crm;
    return <p>{s.findings.total} findings · {s.findings.cleanupCandidates} dry-run cleanup candidates</p>;
  }
  if (kind === 'training') {
    const s = report.sections.training;
    return <p>{s.programStates.notStarted} not started · {s.programStates.underway} underway · {s.programStates.allModulesComplete} all modules complete</p>;
  }
  if (kind === 'events') {
    const s = report.sections.events;
    return <p>{s.events.upcoming} upcoming · {s.events.fullUpcoming} full · {s.attendance.missed} explicitly missed · {s.attendance.missedWithoutActiveReminder ?? 'unknown'} without active reminder</p>;
  }
  const s = report.sections.delivery;
  return <p>{s.failed24h} VM/RVM failures (24h) · {s.projections.due} projections due · {s.stoppedWorkers.length} stopped workers</p>;
}

export function BottleneckReport() {
  const [report, setReport] = useState<McsAdminBottleneckReportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetch('/api/admin/reporting/bottlenecks', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Report request failed (${response.status}).`);
        return response.json() as Promise<McsAdminBottleneckReportResponse>;
      })
      .then((value) => { if (active) setReport(value); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Report unavailable.'); });
    return () => { active = false; };
  }, []);

  return (
    <section className="mb-10" aria-labelledby="bottleneck-report-title">
      <div className="mb-4">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-gold">P2-128 · Aggregate operating snapshot</p>
        <h2 id="bottleneck-report-title" className="mt-1 font-display text-3xl tracking-wide">Bottleneck Report</h2>
        <p className="mt-2 max-w-3xl text-sm text-cream-mute">Bounded, aggregate observations from existing authorities. No person ranking, scoring, inferred attendance, automated contact, or repair action.</p>
      </div>
      {!report && !error && <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-cream-mute">Loading bounded snapshot…</div>}
      {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-5 text-sm text-red-100">{error}</div>}
      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(Object.keys(LABELS) as Array<keyof typeof LABELS>).map((kind) => {
              const section = report.sections[kind];
              return (
                <article key={kind} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-3"><h3 className="font-display text-xl tracking-wide">{LABELS[kind]}</h3><Status section={section} /></div>
                  <div className="mt-3 text-sm text-cream"><Metrics report={report} kind={kind} /></div>
                  <p className="mt-3 text-xs leading-5 text-cream-mute">{section.summary}</p>
                  <details className="mt-3 text-xs text-cream-mute"><summary className="cursor-pointer text-gold">Coverage boundary</summary><p className="mt-2">{section.coverage.note}</p><ul className="mt-1 list-disc pl-4">{section.coverage.constraints.map((item) => <li key={item}>{item}</li>)}</ul></details>
                </article>
              );
            })}
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-cream-mute">Bounded sources: {report.partialSources.length} · Unavailable sources: {report.unavailableSources.length}</p>
        </>
      )}
    </section>
  );
}
