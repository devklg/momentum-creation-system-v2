import { useEffect, useState } from 'react';
import type { McsAdminEntitlementAuditResponse } from '@momentum/shared';

export function EntitlementsPage() {
  const [data, setData] = useState<McsAdminEntitlementAuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void (async () => {
    try {
      const res = await fetch('/api/admin/bas/entitlements/audit', { credentials: 'include' });
      const body = await res.json() as McsAdminEntitlementAuditResponse & { error?: string };
      if (!res.ok || !body.ok) { setError(body.error ?? 'Entitlement audit unavailable.'); return; }
      setData(body);
    } catch (err) { setError(err instanceof Error ? err.message : 'Network error.'); }
  })(); }, []);
  return <div className="max-w-7xl">
    <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">Security · Read-only audit</p>
    <h1 className="font-display text-[36px] leading-none mb-2">Entitlements</h1>
    <p className="text-cream-mute text-sm mb-8">Who has explicit feature access, where that access is stored, and which routes enforce it. This view cannot grant or revoke access.</p>
    {error && <p className="text-red-300 text-sm">{error}</p>}
    {data && <>
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-8">
        {data.definitions.map((row) => <div key={row.entitlement} className="border border-line bg-cream/[0.025] p-4">
          <p className="font-mono text-[10px] uppercase text-gold">{row.entitlement}</p>
          <p className="font-display text-[28px] mt-2">{row.protectedRoutes}</p><p className="text-xs text-cream-mute">protected routes</p>
          <p className="text-xs text-cream-mute mt-3">{row.gate}</p><p className="font-mono text-[9px] text-cream-faint mt-1">{row.storage}</p>
          <p className="text-xs text-cream-mute mt-2">Granted: {row.grantedPrincipals ?? 'dynamic identity'}</p>
        </div>)}
      </section>
      <section className="border border-line p-5 mb-6"><h2 className="font-mono text-[11px] uppercase text-gold mb-4">Member grants</h2>
        {data.memberGrants.length === 0 ? <p className="text-sm text-cream-mute">No member feature entitlements granted.</p> : <div className="overflow-x-auto"><table className="min-w-full text-xs"><thead><tr className="text-left text-cream-faint"><th className="py-2">Member</th><th>Entitlement</th><th>Status</th></tr></thead><tbody>{data.memberGrants.map((row) => <tr key={`${row.tmagId}-${row.entitlement}`} className="border-t border-line"><td className="py-2">{row.fullName} · {row.tmagId}</td><td>{row.entitlement}</td><td>{row.recognized ? 'recognized' : 'unknown — report only'}</td></tr>)}</tbody></table></div>}
      </section>
      <p className="font-mono text-[10px] text-cream-faint">{data.totals.membersScanned} members scanned · {data.totals.routesClassified} routes classified · {data.totals.unknownGrants} unknown grants</p>
      {data.warnings.length > 0 && <p className="text-xs text-red-300 mt-3">{data.warnings.join(' · ')}</p>}
    </>}
  </div>;
}
