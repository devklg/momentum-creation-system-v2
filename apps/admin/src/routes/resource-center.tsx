import { useEffect, useState, type ReactNode } from 'react';

type ResourceRow = {
  resourceVersionId: string;
  title: string;
  kind: string;
  version: number;
  openCount: number;
  uniqueMemberCount: number;
  opensLast30Days: number;
  lastOpenedAt: string | null;
  staleReviewWarning: boolean;
  staleReviewAgeDays: number | null;
};

type Summary = {
  ok: true;
  policy: { staleReviewDays: number; warningOnly: true; changesPublishingState: false };
  totals: { activeResources: number; totalOpens: number; opensLast30Days: number; neverOpened: number; staleReviewWarnings: number };
  resources: ResourceRow[];
};

export function ResourceCenterAdminPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/resource-center/analytics', { credentials: 'include' })
      .then(async (response) => {
        const payload = await response.json() as Summary | { ok: false };
        if (!response.ok || !payload.ok) throw new Error('unavailable');
        return payload;
      })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-7">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-gold">Resource Center</p>
        <h1 className="mt-2 font-display text-4xl tracking-wide text-cream">Usage & review health</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-cream-mute">
          Verified resource opens and advisory review warnings. Warnings never publish, retire, or change the authority of a resource.
        </p>
      </header>
      {error && <Panel>The resource usage report is unavailable right now.</Panel>}
      {!error && !data && <Panel>Loading verified resource usage…</Panel>}
      {data && (
        <>
          <section className="grid gap-3 md:grid-cols-5">
            <Metric label="Active resources" value={data.totals.activeResources} />
            <Metric label="Total opens" value={data.totals.totalOpens} />
            <Metric label="Opens · 30 days" value={data.totals.opensLast30Days} />
            <Metric label="Never opened" value={data.totals.neverOpened} />
            <Metric label="Review warnings" value={data.totals.staleReviewWarnings} warn={data.totals.staleReviewWarnings > 0} />
          </section>
          <div className="rounded-md border border-line bg-ink-2 px-4 py-3 text-xs leading-5 text-cream-mute">
            Review warning threshold: {data.policy.staleReviewDays} days since the active version was updated. This is a warning only.
          </div>
          <section className="overflow-x-auto rounded-md border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-cream/[0.04] font-mono text-[10px] uppercase tracking-label text-cream-faint">
                <tr><th className="px-4 py-3">Resource</th><th className="px-4 py-3">Opens</th><th className="px-4 py-3">Members</th><th className="px-4 py-3">30 days</th><th className="px-4 py-3">Last opened</th><th className="px-4 py-3">Review</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.resources.map((row) => (
                  <tr key={row.resourceVersionId}>
                    <td className="px-4 py-3"><p className="text-cream">{row.title}</p><p className="font-mono text-[10px] text-cream-faint">{row.kind} · v{row.version}</p></td>
                    <td className="px-4 py-3 text-cream">{row.openCount}</td>
                    <td className="px-4 py-3 text-cream-mute">{row.uniqueMemberCount}</td>
                    <td className="px-4 py-3 text-cream-mute">{row.opensLast30Days}</td>
                    <td className="px-4 py-3 text-cream-mute">{row.lastOpenedAt ? new Date(row.lastOpenedAt).toLocaleDateString() : 'Never'}</td>
                    <td className="px-4 py-3">{row.staleReviewWarning ? <span className="text-gold">Review due{row.staleReviewAgeDays === null ? '' : ` · ${row.staleReviewAgeDays}d`}</span> : <span className="text-teal">Current</span>}</td>
                  </tr>
                ))}
                {data.resources.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-cream-mute">No active verified resources yet.</td></tr>}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return <div className="rounded-md border border-line bg-ink-2 p-4"><p className="font-mono text-[10px] uppercase tracking-label text-cream-faint">{label}</p><p className={`mt-2 font-display text-3xl ${warn ? 'text-gold' : 'text-cream'}`}>{value}</p></div>;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-md border border-line bg-ink-2 p-5 text-sm text-cream-mute">{children}</div>;
}
