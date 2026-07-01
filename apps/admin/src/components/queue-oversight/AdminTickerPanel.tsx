/**
 * E.5 — Rolling ticker activity (admin mirror).
 *
 * SAME event source as the .com prospect dashboard ticker — subscribed via
 * the /api/admin/queue/ticker/stream SSE endpoint, which fans out from the
 * in-process placement bus (services/poolEvents). Difference vs. .com:
 * real names instead of initials, deep-link to D.2 detail panel on click.
 */

import { useEffect, useRef, useState } from 'react';
import type {
  McsAdminQueueTickerSseEvent,
  McsAdminQueueTickerSnapshot,
  McsAdminTickerEntry,
} from '@momentum/shared';

const MAX_ENTRIES = 80;

export function AdminTickerPanel() {
  const [entries, setEntries] = useState<McsAdminTickerEntry[] | null>(null);
  const [globalMaxPosition, setGlobalMaxPosition] = useState<number>(0);
  const [status, setStatus] = useState<'connecting' | 'live' | 'closed'>('connecting');
  const [err, setErr] = useState<string | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const url = '/api/admin/queue/ticker/stream';
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    es.addEventListener('snapshot', (evt) => {
      try {
        const payload = JSON.parse((evt as MessageEvent).data) as McsAdminQueueTickerSnapshot;
        setEntries(payload.recent.slice(0, MAX_ENTRIES));
        setGlobalMaxPosition(payload.globalMaxPosition);
        setStatus('live');
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Snapshot parse failed.');
      }
    });

    es.addEventListener('admin_queue_placement', (evt) => {
      try {
        const event = JSON.parse((evt as MessageEvent).data) as McsAdminQueueTickerSseEvent;
        const entry: McsAdminTickerEntry = {
          positionNumber: event.positionNumber,
          prospectId: event.prospectId,
          firstName: event.firstName,
          lastName: event.lastName,
          city: event.city,
          stateOrRegion: event.stateOrRegion,
          placedAt: event.at,
          sponsorTmagId: event.sponsorTmagId,
          deepLink: event.deepLink,
        };
        setEntries((prev) => {
          const base = prev ?? [];
          // dedupe by prospectId + placedAt
          const filtered = base.filter(
            (b) => !(b.prospectId === entry.prospectId && b.placedAt === entry.placedAt),
          );
          return [entry, ...filtered].slice(0, MAX_ENTRIES);
        });
        setGlobalMaxPosition((prev) =>
          entry.positionNumber > prev ? entry.positionNumber : prev,
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Event parse failed.');
      }
    });

    es.onerror = () => {
      setStatus('closed');
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return (
    <section className="mb-10">
      <header className="flex items-baseline justify-between mb-3">
        <h2 className="font-display text-[22px] leading-none">
          E.5 · Live ticker (admin mirror · real names)
        </h2>
        <StatusDot status={status} />
      </header>
      <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mb-3">
        Same source as .com · click an entry to open prospect detail
      </p>

      <div className="bg-ink-2 border border-line rounded-md p-4">
        {err && (
          <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-3">
            {err}
          </p>
        )}
        {globalMaxPosition > 0 && (
          <p className="text-[11px] font-mono tracking-label text-cream-faint uppercase mb-3">
            Global max · #{globalMaxPosition.toLocaleString()}
          </p>
        )}
        {entries === null ? (
          <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
            Connecting…
          </p>
        ) : entries.length === 0 ? (
          <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
            No live placements.
          </p>
        ) : (
          <ol className="divide-y divide-line">
            {[...entries]
              .sort((a, b) => a.positionNumber - b.positionNumber)
              .map((e) => (
              <li
                key={`${e.prospectId}_${e.placedAt}`}
                className="flex items-baseline justify-between gap-4 py-1.5"
              >
                <span className="font-mono text-cream w-20 shrink-0">
                  #{e.positionNumber.toLocaleString()}
                </span>
                <a
                  href={e.deepLink}
                  className="flex-1 text-cream hover:text-gold transition-colors"
                >
                  {e.firstName} {e.lastName}
                  {e.city || e.stateOrRegion ? (
                    <span className="text-cream-mute">
                      {' · '}
                      {[e.city, e.stateOrRegion].filter(Boolean).join(', ')}
                    </span>
                  ) : null}
                </a>
                <span className="font-mono text-[11px] text-cream-faint whitespace-nowrap">
                  {new Date(e.placedAt).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function StatusDot({ status }: { status: 'connecting' | 'live' | 'closed' }) {
  const color =
    status === 'live'
      ? 'bg-teal'
      : status === 'connecting'
        ? 'bg-cream-mute'
        : 'bg-red-400';
  const label =
    status === 'live' ? 'LIVE' : status === 'connecting' ? 'CONNECTING' : 'CLOSED';
  return (
    <span className="inline-flex items-center gap-2 text-[10px] font-mono tracking-label uppercase text-cream-mute">
      <span className={`inline-block w-2 h-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
