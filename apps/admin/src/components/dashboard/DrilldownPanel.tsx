/**
 * Drilldown panel (wf_0078). Renders the rows for whichever tile is
 * selected — one per-shape table. Closes when the user re-clicks the
 * active tile (parent flips activeTile to null).
 */

import { useEffect, useState } from 'react';
import type {
  AdminDashboardFilter,
  AdminDashboardTile,
  AdminDrilldownPayload,
  AdminDrilldownResponse,
} from '@momentum/shared';

interface Props {
  tile: AdminDashboardTile;
  filter: AdminDashboardFilter;
  onClose: () => void;
}

interface FetchResponse {
  ok: boolean;
  payload?: AdminDrilldownPayload;
  computedAt?: string;
  error?: string;
}

export function DrilldownPanel({ tile, filter, onClose }: Props) {
  const [resp, setResp] = useState<AdminDrilldownResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setResp(null);
    setErr(null);
    const params = new URLSearchParams();
    params.set('tile', tile);
    if (filter.tmagId) params.set('tmagId', filter.tmagId);
    if (filter.leaderGroup) params.set('leaderGroup', filter.leaderGroup);

    void (async () => {
      try {
        const r = await fetch(`/api/admin/dashboard/drilldown?${params.toString()}`, {
          credentials: 'include',
        });
        const data = (await r.json()) as FetchResponse;
        if (!data.ok || !data.payload || !data.computedAt) {
          setErr(data.error ?? 'Could not load drilldown.');
          return;
        }
        setResp({
          ok: true,
          payload: data.payload,
          appliedFilter: filter,
          computedAt: data.computedAt,
        });
      } catch (e) {
        setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      }
    })();
  }, [tile, filter.tmagId, filter.leaderGroup, filter]);

  return (
    <section className="border border-line rounded-md mb-6 overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-line bg-cream/[0.025]">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">Drilldown</p>
          <p className="font-display text-[20px] leading-none mt-0.5">
            {tileTitle(tile)}
          </p>
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
        {err && (
          <p className="text-[13px] font-mono text-red-400">{err}</p>
        )}
        {!err && !resp && (
          <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint">
            Loading…
          </p>
        )}
        {!err && resp && <DrilldownBody payload={resp.payload} />}
      </div>
    </section>
  );
}

function tileTitle(tile: AdminDashboardTile): string {
  switch (tile) {
    case 'active_bas':
      return 'Active BAs (last 24h)';
    case 'prospects_in_flow':
      return 'Prospects in flow';
    case 'queue_movement':
      return 'Queue movement (last 24h)';
    case 'enrollments':
      return 'Enrollments (last 24h)';
    case 'training':
      return 'Training progress';
  }
}

function DrilldownBody({ payload }: { payload: AdminDrilldownPayload }) {
  if (payload.rows.length === 0) {
    return (
      <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint">
        No rows match the current filter.
      </p>
    );
  }
  switch (payload.tile) {
    case 'active_bas':
      return (
        <Table headers={['BA ID', 'Name', 'Last login', 'In-flow']}>
          {payload.rows.map((r) => (
            <tr key={r.tmagId} className="border-t border-line">
              <Td><Mono>{r.tmagId}</Mono></Td>
              <Td>{r.fullName}</Td>
              <Td className="text-cream-mute">{fmtDateTime(r.lastLoginAt)}</Td>
              <Td className="text-cream">{r.prospectsInFlow}</Td>
            </tr>
          ))}
        </Table>
      );
    case 'prospects_in_flow':
      return (
        <Table headers={['Pos', 'Prospect', 'Location', 'State', 'Sponsor', 'Placed', 'Expires']}>
          {payload.rows.map((r) => (
            <tr key={r.prospectId} className="border-t border-line">
              <Td><Mono>{r.positionNumber ?? '—'}</Mono></Td>
              <Td>{r.firstName} {r.lastInitial}.</Td>
              <Td className="text-cream-mute">{r.city}, {r.stateOrRegion}</Td>
              <Td><Mono className="text-cream-mute">{r.state}</Mono></Td>
              <Td><span className="text-cream">{r.sponsorName}</span></Td>
              <Td className="text-cream-mute">{fmtDateTime(r.placedAt)}</Td>
              <Td className="text-cream-mute">{fmtDate(r.expiresAt)}</Td>
            </tr>
          ))}
        </Table>
      );
    case 'queue_movement':
      return (
        <Table headers={['Kind', 'Pos', 'Prospect', 'Sponsor', 'When', 'Reason']}>
          {payload.rows.map((r) => (
            <tr key={`${r.kind}-${r.prospectId}-${r.at}`} className="border-t border-line">
              <Td>
                <span
                  className={[
                    'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
                    r.kind === 'placement'
                      ? 'text-teal border-teal/30 bg-teal/[0.08]'
                      : 'text-cream-mute border-line bg-cream/[0.025]',
                  ].join(' ')}
                >
                  {r.kind}
                </span>
              </Td>
              <Td><Mono>{r.positionNumber}</Mono></Td>
              <Td>{r.firstName} {r.lastInitial}.</Td>
              <Td><span className="text-cream">{r.sponsorName}</span></Td>
              <Td className="text-cream-mute">{fmtDateTime(r.at)}</Td>
              <Td className="text-cream-mute">{r.flushReason ?? '—'}</Td>
            </tr>
          ))}
        </Table>
      );
    case 'enrollments':
      return (
        <Table headers={['Pos', 'Prospect', 'Sponsor', 'Enrolled']}>
          {payload.rows.map((r) => (
            <tr key={r.prospectId} className="border-t border-line">
              <Td><Mono>{r.positionNumber}</Mono></Td>
              <Td>{r.firstName} {r.lastInitial}.</Td>
              <Td><span className="text-cream">{r.sponsorName}</span></Td>
              <Td className="text-cream-mute">{fmtDateTime(r.enrolledAt)}</Td>
            </tr>
          ))}
        </Table>
      );
    case 'training':
      return (
        <Table headers={['BA ID', 'Name', 'Modules', 'Complete', 'Last touched']}>
          {payload.rows.map((r) => (
            <tr key={r.tmagId} className="border-t border-line">
              <Td><Mono>{r.tmagId}</Mono></Td>
              <Td>{r.fullName}</Td>
              <Td><Mono>{r.modulesCompleted}/5</Mono></Td>
              <Td>
                <span
                  className={[
                    'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
                    r.fastStartComplete
                      ? 'text-teal border-teal/30 bg-teal/[0.08]'
                      : 'text-cream-mute border-line bg-cream/[0.025]',
                  ].join(' ')}
                >
                  {r.fastStartComplete ? 'done' : 'in progress'}
                </span>
              </Td>
              <Td className="text-cream-mute">{r.lastTouchedAt ? fmtDateTime(r.lastTouchedAt) : '—'}</Td>
            </tr>
          ))}
        </Table>
      );
  }
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="border border-line rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-cream/[0.025]">
          <tr className="text-left">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-2 text-[10px] font-mono tracking-label uppercase text-cream-faint text-left"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={['px-4 py-2 align-top', className ?? ''].join(' ')}>{children}</td>;
}

function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={['font-mono text-cream text-[12px]', className ?? ''].join(' ')}>{children}</span>;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}
