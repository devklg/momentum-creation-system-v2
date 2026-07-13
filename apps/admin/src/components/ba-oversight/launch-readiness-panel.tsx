import { useEffect, useState } from 'react';
import type { McsAdminLaunchReadinessResponse } from '@momentum/shared';

const LABELS = {
  orientation: 'Orientation', training: 'Training', invitations: 'Invitations',
  success_profile: 'Success Profile', crm: 'CRM',
} as const;

export function LaunchReadinessPanel() {
  const [data, setData] = useState<McsAdminLaunchReadinessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/admin/bas/launch-readiness', { credentials: 'include' });
        const body = await response.json() as McsAdminLaunchReadinessResponse & { error?: string };
        if (!body.ok) throw new Error(body.error ?? 'Launch readiness could not be loaded.');
        setData(body);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Launch readiness could not be loaded.');
      }
    })();
  }, []);

  return (
    <section className="border border-line bg-cream/[0.025] mb-6" aria-label="Launch readiness factual state">
      <div className="px-4 py-3 border-b border-line flex flex-wrap justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] tracking-eyebrow uppercase text-gold">Launch Readiness · Factual State</p>
          <p className="text-xs text-cream-mute mt-1">Action evidence for support. No score, rank, or prediction.</p>
        </div>
        {data && <p className="font-mono text-[10px] text-cream-faint">{data.summary.members} members · {data.summary.membersWithAttention} with records to review</p>}
      </div>
      {error && <p className="p-4 text-xs font-mono text-red-400">{error}</p>}
      {!data && !error && <p className="p-4 text-xs font-mono text-cream-faint">Loading factual launch state…</p>}
      {data && data.warnings.map((warning) => <p key={warning} className="px-4 pt-3 text-[11px] font-mono text-gold">{warning}</p>)}
      {data && data.rows.length === 0 && <p className="p-4 text-xs text-cream-faint">No Brand Ambassadors found.</p>}
      {data && data.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="border-b border-line text-[10px] font-mono uppercase tracking-label text-cream-faint">
              <th className="px-4 py-2">Brand Ambassador</th>
              {Object.values(LABELS).map((label) => <th key={label} className="px-3 py-2">{label}</th>)}
            </tr></thead>
            <tbody>{data.rows.map((row) => <tr key={row.tmagId} className="border-b border-line/70 last:border-0">
              <td className="px-4 py-3"><span className="block text-cream">{row.fullName}</span><span className="font-mono text-[10px] text-cream-faint">{row.tmagId}</span></td>
              {row.readiness.items.map((entry) => <td key={entry.domain} className="px-3 py-3" title={entry.detail}>
                <span className={entry.status === 'needs_attention' ? 'font-mono text-[10px] uppercase text-gold' : 'font-mono text-[10px] uppercase text-cream-mute'}>
                  {entry.status.replaceAll('_', ' ')}
                </span>
                <span className="block text-[10px] text-cream-faint mt-1">Evidence {entry.evidenceCount}</span>
              </td>)}
            </tr>)}</tbody>
          </table>
        </div>
      )}
      <p className="px-4 py-3 border-t border-line text-[10px] font-mono text-cream-faint">
        Missing, duplicate, orphaned, or inconsistent evidence is report-only. Elapsed time never completes orientation, closes CRM records, or clears follow-ups.
      </p>
    </section>
  );
}
