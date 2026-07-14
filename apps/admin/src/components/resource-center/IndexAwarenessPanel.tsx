import { useEffect, useState } from 'react';

type IndexState = 'observed' | 'missing' | 'definition_mismatch' | 'not_checked';

interface IndexAwarenessResponse {
  ok: boolean;
  mutationAuthorized: false;
  observedAt: string;
  summary: {
    required: number;
    observed: number;
    missing: number;
    definitionMismatch: number;
    notChecked: number;
  };
  indexes: Array<{ collection: string; name: string; surface: string; state: IndexState }>;
}

export function IndexAwarenessPanel() {
  const [report, setReport] = useState<IndexAwarenessResponse | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/admin/resource-center/index-awareness', {
          credentials: 'include',
        });
        const payload = await response.json() as IndexAwarenessResponse;
        if (!response.ok || !payload.ok || !Array.isArray(payload.indexes)) throw new Error('unavailable');
        if (!cancelled) setReport(payload);
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const attention = report?.indexes.filter((row) => row.state !== 'observed') ?? [];
  return (
    <section className="rounded-md border border-line bg-ink-2 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-gold">Read-only index awareness</p>
          <h2 className="mt-1 font-display text-2xl tracking-wide text-cream">Admin query support</h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-cream-mute">
            Observes MongoDB index metadata only. This report cannot create, apply, or change an index.
          </p>
        </div>
        <span className="rounded border border-line px-2 py-1 font-mono text-[10px] uppercase tracking-label text-cream-mute">
          Verify only
        </span>
      </div>

      {unavailable && <p className="mt-4 text-sm text-cream-mute">Index metadata is unavailable; no installation state is claimed.</p>}
      {!unavailable && !report && <p className="mt-4 text-sm text-cream-mute">Checking observed metadata…</p>}
      {report && (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            <Count label="Required" value={report.summary.required} />
            <Count label="Observed" value={report.summary.observed} />
            <Count label="Missing" value={report.summary.missing} warn={report.summary.missing > 0} />
            <Count label="Mismatch" value={report.summary.definitionMismatch} warn={report.summary.definitionMismatch > 0} />
            <Count label="Not checked" value={report.summary.notChecked} warn={report.summary.notChecked > 0} />
          </div>
          {attention.length > 0 && (
            <ul className="mt-4 max-h-48 space-y-1 overflow-auto border-t border-line pt-3">
              {attention.map((row) => (
                <li key={`${row.collection}:${row.name}`} className="grid gap-1 text-xs sm:grid-cols-[1fr_1fr_auto]">
                  <span className="font-mono text-cream">{row.collection}</span>
                  <span className="font-mono text-cream-mute">{row.name}</span>
                  <span className="font-mono uppercase text-gold">{row.state.replaceAll('_', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function Count({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded border border-line px-3 py-2">
      <p className="font-mono text-[9px] uppercase tracking-label text-cream-faint">{label}</p>
      <p className={`mt-1 font-display text-2xl ${warn ? 'text-gold' : 'text-cream'}`}>{value}</p>
    </div>
  );
}
