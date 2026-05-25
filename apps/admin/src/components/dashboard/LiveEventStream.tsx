/**
 * Live event stream (wf_0080). EventSource against /api/admin/dashboard/stream.
 *
 *   • snapshot event seeds the visible list with the most-recent audit entries.
 *   • placement events stream in real-time via the in-process pub/sub.
 *   • audit_entry events tail the audit_log every 5s server-side.
 *
 * Cap visible events at MAX_VISIBLE so the DOM stays trim during long
 * sessions. Newest first. Reconnects on the browser's automatic schedule.
 */

import { useEffect, useRef, useState } from 'react';
import type { AdminLiveEvent, AdminLiveSnapshot } from '@momentum/shared';

const MAX_VISIBLE = 80;

export function LiveEventStream() {
  const [events, setEvents] = useState<AdminLiveEvent[]>([]);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/admin/dashboard/stream', { withCredentials: true });
    esRef.current = es;

    es.addEventListener('open', () => setStatus('open'));
    es.addEventListener('error', () => setStatus('closed'));

    es.addEventListener('snapshot', (ev) => {
      try {
        const snap = JSON.parse((ev as MessageEvent).data) as AdminLiveSnapshot;
        setEvents(snap.events.slice(0, MAX_VISIBLE));
      } catch {
        // ignore malformed frame
      }
    });

    const onLive = (ev: MessageEvent) => {
      try {
        const live = JSON.parse(ev.data) as AdminLiveEvent;
        setEvents((prev) => {
          // de-dupe by eventId (the snapshot may overlap with the tail)
          if (prev.some((e) => e.eventId === live.eventId)) return prev;
          return [live, ...prev].slice(0, MAX_VISIBLE);
        });
      } catch {
        // ignore
      }
    };

    es.addEventListener('placement', onLive);
    es.addEventListener('audit_entry', onLive);

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return (
    <section className="border border-line rounded-md overflow-hidden">
      <header className="flex items-center justify-between px-4 py-3 border-b border-line bg-cream/[0.025]">
        <div>
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase">
            Live event stream
          </p>
          <p className="font-display text-[20px] leading-none mt-0.5">
            Placements + audit tail
          </p>
        </div>
        <ConnectionPill status={status} />
      </header>

      <div className="max-h-[480px] overflow-y-auto">
        {events.length === 0 ? (
          <p className="px-4 py-3 text-[11px] font-mono tracking-label uppercase text-cream-faint">
            {status === 'open' ? 'Waiting for activity…' : 'Connecting…'}
          </p>
        ) : (
          <ul>
            {events.map((ev) => (
              <li
                key={ev.eventId}
                className="border-t border-line first:border-t-0 px-4 py-2 grid grid-cols-[80px_1fr_140px] gap-3 items-baseline"
              >
                <KindPill kind={ev.kind} />
                <div className="min-w-0">
                  <EventLine event={ev} />
                </div>
                <span className="text-[11px] font-mono text-cream-faint text-right whitespace-nowrap">
                  {fmtTime(ev.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function EventLine({ event }: { event: AdminLiveEvent }) {
  if (event.kind === 'placement') {
    return (
      <p className="text-sm text-cream truncate">
        <span className="font-mono text-cream-mute">#{event.positionNumber}</span>{' '}
        {event.firstName} {event.lastInitial}.{' '}
        <span className="text-cream-mute">· {event.city}, {event.stateOrRegion}</span>
      </p>
    );
  }
  return (
    <p className="text-sm text-cream truncate">
      <span className="font-mono text-cream">{event.action}</span>{' '}
      <span className="text-cream-mute">· {event.actorLabel}</span>
      {event.entityLabel !== '—' && (
        <span className="text-cream-faint"> → {event.entityLabel}</span>
      )}
    </p>
  );
}

function KindPill({ kind }: { kind: AdminLiveEvent['kind'] }) {
  const cls =
    kind === 'placement'
      ? 'text-teal border-teal/30 bg-teal/[0.08]'
      : 'text-gold border-gold/30 bg-gold/[0.06]';
  const label = kind === 'placement' ? 'placement' : 'audit';
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
        cls,
      ].join(' ')}
    >
      {label}
    </span>
  );
}

function ConnectionPill({ status }: { status: 'connecting' | 'open' | 'closed' }) {
  const cls =
    status === 'open'
      ? 'text-teal border-teal/30 bg-teal/[0.08]'
      : status === 'connecting'
        ? 'text-cream-mute border-line bg-cream/[0.025]'
        : 'text-red-400 border-red-400/30 bg-red-400/[0.06]';
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

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString();
}
