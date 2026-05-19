/**
 * /bas — flat Brand Ambassador list with sponsor column.
 *
 * Per Chat #98 carry-forward: "flat BA list with sponsor column."
 * Not the genealogy view (that lives in THREE) — just a flat operational
 * roster showing every BA, who sponsored them, when they joined, current status.
 *
 * GET /api/admin/bas — returns the list.
 */

import { useEffect, useState } from 'react';

interface BARow {
  baId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  sponsorBaId: string | null;
  sponsorName: string | null;
  joinedAt: string;
  status: 'active' | 'inactive' | 'pending';
  michaelStatus?: 'awaiting_schedule' | 'scheduled' | 'in_progress' | 'completed' | 'missed';
}

interface ListResponse {
  ok: boolean;
  bas?: BARow[];
  error?: string;
}

export function BAsPage() {
  const [bas, setBas] = useState<BARow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/admin/bas', { credentials: 'include' });
        const data = (await res.json()) as ListResponse;
        if (!data.ok) {
          setErr(data.error ?? 'Could not load BAs.');
          return;
        }
        setBas(data.bas ?? []);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown';
        setErr(`Network error: ${msg}`);
      }
    })();
  }, []);

  return (
    <div className="max-w-6xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section C
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Brand Ambassadors</h1>
      <p className="text-cream-mute text-sm mb-10 max-w-2xl">
        Flat operational roster. Sponsor column shows who recruited each BA. Genealogy and
        binary placement live in THREE.
      </p>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">{err}</p>
      )}

      {bas === null ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          Loading…
        </p>
      ) : bas.length === 0 ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          No BAs yet.
        </p>
      ) : (
        <div className="border border-line rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/[0.025]">
              <tr className="text-left">
                <Th>BA ID</Th>
                <Th>Name</Th>
                <Th>Sponsor</Th>
                <Th>Joined</Th>
                <Th>Status</Th>
                <Th>Michael</Th>
              </tr>
            </thead>
            <tbody>
              {bas.map((b) => (
                <tr key={b.baId} className="border-t border-line">
                  <Td><span className="font-mono text-cream">{b.baId}</span></Td>
                  <Td>{b.fullName}</Td>
                  <Td>
                    {b.sponsorName ? (
                      <>
                        <span className="text-cream">{b.sponsorName}</span>
                        <span className="text-cream-faint ml-2 font-mono text-[11px]">
                          {b.sponsorBaId}
                        </span>
                      </>
                    ) : (
                      <span className="text-cream-faint">— root —</span>
                    )}
                  </Td>
                  <Td className="text-cream-mute">{new Date(b.joinedAt).toLocaleDateString()}</Td>
                  <Td><StatusPill status={b.status} /></Td>
                  <Td>
                    <MichaelPill status={b.michaelStatus} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10px] font-mono tracking-label uppercase text-cream-faint text-left">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={['px-4 py-2.5', className ?? ''].join(' ')}>{children}</td>;
}

function StatusPill({ status }: { status: BARow['status'] }) {
  const cls =
    status === 'active'
      ? 'text-teal border-teal/30 bg-teal/[0.08]'
      : status === 'pending'
      ? 'text-gold border-gold/30 bg-gold/[0.06]'
      : 'text-cream-faint border-line bg-cream/[0.025]';
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
        cls,
      ].join(' ')}
    >
      {status}
    </span>
  );
}

function MichaelPill({ status }: { status: BARow['michaelStatus'] }) {
  if (!status) {
    return <span className="text-cream-faint font-mono text-[11px]">—</span>;
  }
  const label =
    status === 'awaiting_schedule'
      ? 'awaiting'
      : status === 'scheduled'
      ? 'scheduled'
      : status === 'in_progress'
      ? 'live'
      : status === 'completed'
      ? 'done'
      : 'missed';
  const cls =
    status === 'completed'
      ? 'text-teal'
      : status === 'missed'
      ? 'text-red-400'
      : 'text-cream-mute';
  return (
    <span className={['font-mono text-[11px] uppercase tracking-label', cls].join(' ')}>
      {label}
    </span>
  );
}
