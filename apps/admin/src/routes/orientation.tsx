/**
 * /orientation — founder-facing group orientation roster + seeding
 * (Chat #147, wireframe §3.6, dec_orientation_scheduling seq 21).
 *
 * Founders (Kevin + Paul) see every orientation session with its per-session
 * roster of booked BAs, and add new sessions as the team grows (assignable
 * hosts, seat cap default 10). Reads/writes /api/admin/orientation/sessions.
 *
 * This is the /admin counterpart to the .team cockpit scheduling card; the BA
 * books a seat there, the founders see the roster here.
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  McsAdminOrientationSessionsResponse,
  McsAdminCreateOrientationSessionResponse,
  McsOrientationSessionWithRoster,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function OrientationPage() {
  const [sessions, setSessions] = useState<McsOrientationSessionWithRoster[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Create-form state
  const [scheduledFor, setScheduledFor] = useState('');
  const [hosts, setHosts] = useState('Kevin Gardner, Paul Barrios');
  const [capacity, setCapacity] = useState('10');
  const [joinUrl, setJoinUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch('/api/admin/orientation/sessions', {
        credentials: 'include',
      });
      if (!res.ok) {
        setLoadErr('Could not load orientation sessions.');
        return;
      }
      const data = (await res.json()) as McsAdminOrientationSessionsResponse;
      setSessions(data.sessions);
    } catch {
      setLoadErr('Network error loading sessions.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setCreateErr(null);

      if (!scheduledFor) {
        setCreateErr('Pick a date and time.');
        return;
      }
      const when = new Date(scheduledFor);
      if (Number.isNaN(when.getTime())) {
        setCreateErr('That date did not parse.');
        return;
      }
      if (when.getTime() <= Date.now()) {
        setCreateErr('Session must be in the future.');
        return;
      }
      const hostList = hosts
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);
      const cap = Number(capacity);

      setCreating(true);
      try {
        const res = await fetch('/api/admin/orientation/sessions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scheduledFor: when.toISOString(),
            hosts: hostList.length > 0 ? hostList : undefined,
            capacity: Number.isInteger(cap) && cap > 0 ? cap : undefined,
            joinUrl: joinUrl.trim() || null,
          }),
        });
        const data = (await res.json().catch(() => null)) as
          | McsAdminCreateOrientationSessionResponse
          | { ok: false; error?: string }
          | null;
        if (res.ok && data && data.ok) {
          setScheduledFor('');
          setJoinUrl('');
          await load();
        } else {
          setCreateErr('Could not create the session. Check the fields and try again.');
        }
      } catch {
        setCreateErr('Network error creating session.');
      } finally {
        setCreating(false);
      }
    },
    [scheduledFor, hosts, capacity, joinUrl, load],
  );

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <p className="font-mono tracking-label text-[10px] text-gold uppercase mb-1">
          Wireframe §3.6
        </p>
        <h1 className="font-display text-2xl text-cream">Group Orientation</h1>
        <p className="text-cream-mute text-sm mt-2 max-w-2xl">
          Scheduled group sessions for new Brand Ambassadors — up to 10 seats
          each, hosted by the founders. New BAs book a seat from their cockpit;
          their names appear on the roster below. Add sessions as the team grows.
        </p>
      </header>

      {/* Create a session */}
      <form
        onSubmit={create}
        className="border border-line rounded-md p-5 mb-8 bg-cream/[0.02] space-y-4"
      >
        <p className="font-mono tracking-label text-[11px] text-cream-mute uppercase">
          Add a session
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="o-when">Date &amp; time</Label>
            <Input
              id="o-when"
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="o-cap">Seat cap</Label>
            <Input
              id="o-cap"
              type="number"
              min={1}
              max={100}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="o-hosts">Hosts (comma-separated)</Label>
            <Input
              id="o-hosts"
              value={hosts}
              onChange={(e) => setHosts(e.target.value)}
              placeholder="Kevin Gardner, Paul Barrios"
            />
          </div>
          <div>
            <Label htmlFor="o-join">Join link (optional)</Label>
            <Input
              id="o-join"
              value={joinUrl}
              onChange={(e) => setJoinUrl(e.target.value)}
              placeholder="https://zoom.us/j/…"
            />
          </div>
        </div>
        {createErr && (
          <p className="text-red-400 font-mono text-[11px] tracking-label">{createErr}</p>
        )}
        <Button type="submit" disabled={creating}>
          {creating ? 'Creating…' : 'Create session'}
        </Button>
      </form>

      {/* Rosters */}
      {loadErr && (
        <div className="mb-4">
          <p className="text-red-400 font-mono text-[12px] tracking-label mb-2">{loadErr}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="font-mono text-[11px] tracking-label text-teal hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      {sessions === null && !loadErr && (
        <p className="text-cream-faint font-mono text-[12px] tracking-label">Loading…</p>
      )}

      {sessions !== null && sessions.length === 0 && (
        <p className="text-cream-faint text-sm">
          No sessions yet. Add one above (or run{' '}
          <code className="font-mono text-[12px]">seed:orientation-sessions</code>).
        </p>
      )}

      {sessions !== null && sessions.length > 0 && (
        <ul className="space-y-4">
          {sessions.map((s) => (
            <li key={s.sessionId} className="border border-line rounded-md p-5 bg-cream/[0.02]">
              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                <div>
                  <p className="text-cream text-[15px]">{fmt(s.scheduledFor)}</p>
                  <p className="font-mono text-[11px] text-cream-faint tracking-label mt-1">
                    {s.hosts.join(' & ')} · {s.durationMinutes} min ·{' '}
                    {s.status.toUpperCase()}
                  </p>
                </div>
                <span
                  className={
                    'font-mono text-[11px] tracking-label px-2 py-1 rounded border ' +
                    (s.seatsRemaining <= 0
                      ? 'text-gold border-gold/40 bg-gold/[0.06]'
                      : 'text-cream-mute border-cream/15')
                  }
                >
                  {s.seatsTaken}/{s.capacity} booked
                </span>
              </div>
              {s.roster.length === 0 ? (
                <p className="text-cream-faint text-[13px]">No seats booked yet.</p>
              ) : (
                <ol className="space-y-1.5">
                  {s.roster.map((seat, i) => (
                    <li
                      key={seat.reservationId}
                      className="flex items-baseline gap-3 text-[13px]"
                    >
                      <span className="font-mono text-[11px] text-cream-faint w-5 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-cream">{seat.baName}</span>
                      <span className="font-mono text-[10px] text-cream-faint tracking-label">
                        {seat.tmagId}
                      </span>
                      <span className="font-mono text-[10px] text-cream-faint tracking-label ml-auto">
                        booked {fmt(seat.reservedAt)}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
