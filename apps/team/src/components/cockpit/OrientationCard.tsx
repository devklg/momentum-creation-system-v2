/**
 * Cockpit scheduling card — group orientation (Chat #147, wireframe §3.6).
 *
 * The BA-facing face of the group orientation scheduler. A post-Michael BA
 * sees the available group sessions (hosted by the founders, up to 10 seats
 * each), books ONE seat, and can cancel it. Founders see the roster in /admin.
 *
 * Data:
 *   GET    /api/orientation/sessions                     available + my seat
 *   POST   /api/orientation/sessions/:id/reserve         book
 *   DELETE /api/orientation/sessions/:id/reserve         cancel
 *
 * Per .team convention (cockpit.tsx, invitations.tsx): wire shapes are
 * declared locally, not imported from @momentum/shared (TS6059). Source of
 * truth is packages/shared/src/types.ts (OrientationSession* types).
 *
 * Compliance (locked-spec 3.10): BA-facing .team surface. Logistics only —
 * session times, hosts, seat counts. No income/placement language.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ContextResources } from '@/components/resources/ContextResources';

// ── Local wire shapes (mirror packages/shared/src/types.ts) ──────────────

interface SessionAvailability {
  sessionId: string;
  scheduledFor: string;
  hosts: string[];
  capacity: number;
  seatsTaken: number;
  seatsRemaining: number;
  durationMinutes: number;
  reservedByMe: boolean;
}

interface SessionsResponse {
  ok: true;
  sessions: SessionAvailability[];
  myReservationSessionId: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatSessionTime(iso: string): string {
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

// ── View state ─────────────────────────────────────────────────────────

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; data: SessionsResponse };

export function OrientationCard() {
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/orientation/sessions', { credentials: 'include' });
      if (!res.ok) {
        setView({ kind: 'error', message: 'Could not load orientation sessions.' });
        return;
      }
      const data = (await res.json()) as SessionsResponse;
      setView({ kind: 'ready', data });
    } catch {
      setView({ kind: 'error', message: 'Network error loading sessions.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reserve = useCallback(
    async (sessionId: string) => {
      setBusyId(sessionId);
      setActionErr(null);
      try {
        const res = await fetch(`/api/orientation/sessions/${sessionId}/reserve`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) {
          await load();
        } else {
          const data = (await res.json().catch(() => null)) as
            | { error?: { kind?: string } | string }
            | null;
          const kind =
            data && typeof data.error === 'object' ? data.error?.kind : undefined;
          setActionErr(
            kind === 'session_full'
              ? 'That session just filled up. Pick another.'
              : kind === 'already_reserved_elsewhere'
                ? 'You already hold a seat in another session. Cancel it first.'
                : 'Could not reserve that seat. Try again.',
          );
        }
      } catch {
        setActionErr('Network error. Try again.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const cancel = useCallback(
    async (sessionId: string) => {
      setBusyId(sessionId);
      setActionErr(null);
      try {
        const res = await fetch(`/api/orientation/sessions/${sessionId}/reserve`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          await load();
        } else {
          setActionErr('Could not cancel that seat. Try again.');
        }
      } catch {
        setActionErr('Network error. Try again.');
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  return (
    <div>
      <p className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase mb-4">
        New-member orientation
      </p>
      <div className="bg-cream/[0.02] border border-gold/20 rounded-md p-5">
        <p className="text-cream-mute text-[14px] leading-[1.6] mb-4">
          Orientation runs as a live group session with Kevin &amp; Paul — up to
          10 new Brand Ambassadors at a time. Grab a seat that works for you.
        </p>

        {view.kind === 'loading' && (
          <p className="text-cream-faint font-mono text-[12px] tracking-[0.04em]">
            Loading sessions…
          </p>
        )}

        {view.kind === 'error' && (
          <div>
            <p className="text-red-400 font-mono text-[12px] tracking-[0.04em] mb-3">
              {view.message}
            </p>
            <button
              onClick={() => {
                setView({ kind: 'loading' });
                void load();
              }}
              className="font-mono text-[11px] tracking-[0.06em] text-teal hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {view.kind === 'ready' && view.data.sessions.length === 0 && (
          <p className="text-cream-faint text-[13px] leading-[1.55]">
            No orientation sessions this week.
          </p>
        )}

        {view.kind === 'ready' && view.data.sessions.length > 0 && (
          <>
            {actionErr && (
              <p className="text-red-400 font-mono text-[11px] tracking-[0.04em] mb-3">
                {actionErr}
              </p>
            )}
            <ul className="space-y-3">
              {view.data.sessions.map((s) => {
                const full = s.seatsRemaining <= 0;
                const heldElsewhere =
                  view.data.myReservationSessionId !== null && !s.reservedByMe;
                const busy = busyId === s.sessionId;
                return (
                  <li
                    key={s.sessionId}
                    className={
                      'rounded border p-4 ' +
                      (s.reservedByMe
                        ? 'border-teal/40 bg-teal/[0.05]'
                        : 'border-cream/10 bg-cream/[0.02]')
                    }
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-cream text-[15px] leading-[1.3]">
                          {formatSessionTime(s.scheduledFor)}
                        </p>
                        <p className="font-mono text-[11px] text-cream-faint tracking-[0.04em] mt-1">
                          {s.hosts.join(' & ')} · {s.durationMinutes} min
                        </p>
                        <p
                          className={
                            'font-mono text-[11px] tracking-[0.06em] mt-1.5 ' +
                            (full ? 'text-cream-faint' : 'text-gold')
                          }
                        >
                          {s.reservedByMe
                            ? "You're booked · "
                            : ''}
                          {s.seatsRemaining} of {s.capacity} seats open
                        </p>
                      </div>
                      <div className="shrink-0">
                        {s.reservedByMe ? (
                          <Button
                            onClick={() => void cancel(s.sessionId)}
                            disabled={busy}
                            className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-red-400/40 hover:text-red-300 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto disabled:opacity-50"
                          >
                            {busy ? 'Cancelling…' : 'Cancel seat'}
                          </Button>
                        ) : (
                          <Button
                            onClick={() => void reserve(s.sessionId)}
                            disabled={busy || full || heldElsewhere}
                            className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[13px] px-5 py-2 h-auto disabled:opacity-50"
                          >
                            {busy
                              ? 'Booking…'
                              : full
                                ? 'Full'
                                : 'Reserve seat'}
                          </Button>
                        )}
                      </div>
                    </div>
                    {heldElsewhere && !full && (
                      <p className="text-cream-faint text-[11px] mt-2">
                        Cancel your other seat to switch to this one.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
      <ContextResources
        contextTag="context:event:orientation"
        title="Approved orientation materials"
      />
    </div>
  );
}
