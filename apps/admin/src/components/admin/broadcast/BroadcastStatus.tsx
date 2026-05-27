/**
 * G.5 — Live broadcast status view.
 *
 * Polls `/api/admin/broadcast/:broadcastId` every 2 seconds until the
 * broadcast's top-level status hits 'complete' (or 'failed'). Shows
 * queued / sending / sent / failed / skipped counts plus the most
 * recent 50 recipient rows.
 *
 * SSE was considered but a 2s poll is plenty for a Kevin-only surface
 * and avoids adding a new SSE channel for a feature this small.
 */

import { useEffect, useState } from 'react';
import type {
  BroadcastRecipientRow,
  BroadcastStatusCounts,
  BroadcastStatusResponse,
} from '@momentum/shared';

interface BroadcastStatusProps {
  broadcastId: string;
}

const POLL_MS = 2000;

export function BroadcastStatus({ broadcastId }: BroadcastStatusProps) {
  const [snapshot, setSnapshot] = useState<BroadcastStatusResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/admin/broadcast/${broadcastId}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as BroadcastStatusResponse & { error?: string };
        if (cancelled) return;
        if (!data.ok) {
          setErr(data.error ?? 'Could not load status.');
        } else {
          setSnapshot(data);
          setErr(null);
        }
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : 'unknown';
        setErr(`Network error: ${msg}`);
      } finally {
        if (cancelled) return;
        const terminal =
          snapshot?.broadcast.status === 'complete' ||
          snapshot?.broadcast.status === 'failed';
        if (!terminal) timer = setTimeout(() => void fetchOnce(), POLL_MS);
      }
    };
    void fetchOnce();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // We intentionally exclude `snapshot` from deps — referencing it
    // inside the closure for the terminal check is the snapshot at the
    // last successful fetch, which is exactly what we want; restarting
    // the polling chain on every state update would double-poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastId]);

  if (err && !snapshot) {
    return (
      <p className="font-mono text-[12px] text-red-400 border border-red-500/40 rounded-md p-3">
        {err}
      </p>
    );
  }
  if (!snapshot) {
    return (
      <p className="font-mono text-[11px] tracking-label uppercase text-cream-faint">
        Loading status…
      </p>
    );
  }

  const b = snapshot.broadcast;
  return (
    <div className="space-y-4">
      <div className="border border-gold/40 rounded-md p-4 bg-gold/[0.04]">
        <p className="font-mono text-[10px] tracking-label uppercase text-gold mb-2">
          Broadcast {b.broadcastId} · {b.channel} · {b.audiencePreset}
        </p>
        <p className="font-display text-2xl text-cream tracking-wide">
          {b.status === 'complete'
            ? 'Complete'
            : b.status === 'failed'
              ? 'Failed'
              : b.status === 'sending'
                ? 'Sending…'
                : 'Queued'}
          <span className="text-cream-mute text-sm font-mono ml-3 tracking-label uppercase">
            {b.recipientCount} recipients
            {b.completedAt && ` · finished ${new Date(b.completedAt).toLocaleTimeString()}`}
          </span>
        </p>
      </div>

      <CountsRow counts={snapshot.counts} />

      <div className="border border-line rounded-md">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-line text-cream-faint font-mono tracking-label uppercase">
              <th className="text-left px-3 py-2">Recipient</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">SMS id</th>
              <th className="text-left px-3 py-2">Email id</th>
              <th className="text-left px-3 py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.recentRows.map((r) => (
              <RecipientRow key={r.rowId} row={r} />
            ))}
            {snapshot.recentRows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-cream-faint font-mono">
                  No recipient rows yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CountsRow({ counts }: { counts: BroadcastStatusCounts }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-2 font-mono text-[11px] tracking-label uppercase">
      <Tile label="Queued" value={counts.queued} />
      <Tile label="Sending" value={counts.sending} tone={counts.sending > 0 ? 'live' : undefined} />
      <Tile label="Sent" value={counts.sent} tone="good" />
      <Tile label="Failed" value={counts.failed} tone={counts.failed > 0 ? 'bad' : undefined} />
      <Tile label="STOP" value={counts.skippedOptedOut} tone={counts.skippedOptedOut > 0 ? 'warn' : undefined} />
      <Tile label="No addr" value={counts.skippedNoAddress} tone={counts.skippedNoAddress > 0 ? 'warn' : undefined} />
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'good' | 'bad' | 'warn' | 'live';
}) {
  const cls =
    tone === 'good'
      ? 'border-teal/40 text-teal'
      : tone === 'bad'
        ? 'border-red-500/40 text-red-400'
        : tone === 'warn'
          ? 'border-amber-500/40 text-amber-400'
          : tone === 'live'
            ? 'border-gold/40 text-gold'
            : 'border-line text-cream';
  return (
    <div className={`border rounded-md px-3 py-2 ${cls}`}>
      <p className="text-cream-faint">{label}</p>
      <p className="font-display text-lg">{value}</p>
    </div>
  );
}

function RecipientRow({ row }: { row: BroadcastRecipientRow }) {
  return (
    <tr className="border-b border-line/40 last:border-b-0">
      <td className="px-3 py-1.5 text-cream">{row.recipientFullName}</td>
      <td className="px-3 py-1.5 font-mono uppercase tracking-label text-[11px]">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-3 py-1.5 font-mono text-[11px] text-cream-mute">
        {row.smsMessageId ?? '—'}
      </td>
      <td className="px-3 py-1.5 font-mono text-[11px] text-cream-mute">
        {row.emailMessageId ?? '—'}
      </td>
      <td className="px-3 py-1.5 font-mono text-[11px] text-amber-400">
        {row.failureReason ?? ''}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: BroadcastRecipientRow['status'] }) {
  const cls =
    status === 'sent'
      ? 'text-teal'
      : status === 'failed'
        ? 'text-red-400'
        : status === 'sending'
          ? 'text-gold'
          : status === 'queued'
            ? 'text-cream-mute'
            : 'text-amber-400';
  return <span className={cls}>{status}</span>;
}
