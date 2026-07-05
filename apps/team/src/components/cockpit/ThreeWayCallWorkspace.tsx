/**
 * Three-way call scheduling workspace.
 *
 * Local wire types mirror packages/shared/src/types.ts. The .team app keeps
 * these local to avoid the shared-src TS6059 rootDir trap.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { CalendarClock, Clock, PhoneCall, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

interface AvailabilityWindow {
  windowId: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  active: boolean;
}

interface SponsorAvailability {
  availabilityId: string;
  ownerTmagId: string;
  ownerName: string;
  timezone: string;
  windows: AvailabilityWindow[];
  createdAt: string;
  updatedAt: string;
}

interface AvailabilitySlot {
  startAt: string;
  endAt: string;
  ownerTimezone: string;
  localDate: string;
  localStartTime: string;
}

interface BookableUpline {
  tmagId: string;
  fullName: string;
  firstName: string;
  phone: string | null;
  timezone: string;
  windows: AvailabilityWindow[];
  slots: AvailabilitySlot[];
}

interface AvailabilityResponse {
  ok: true;
  generatedAt: string;
  horizonDays: number;
  myAvailability: SponsorAvailability | null;
  bookableUplines: BookableUpline[];
}

interface Booking {
  bookingId: string;
  bookerTmagId: string;
  bookerName: string;
  sponsorTmagId: string;
  sponsorName: string;
  startAt: string;
  endAt: string;
  ownerTimezone: string;
  prospectNote: string | null;
  status: 'booked' | 'cancelled';
  createdAt: string;
  cancelledAt: string | null;
  cancelledByTmagId: string | null;
  notificationChannel: 'in_app';
  myRole: 'booker' | 'sponsor' | 'both';
}

interface BookingsResponse {
  ok: true;
  generatedAt: string;
  bookings: Booking[];
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; availability: AvailabilityResponse; bookings: BookingsResponse };

const DAYS: Array<{ value: DayOfWeek; label: string }> = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function localTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Los_Angeles';
}

function formatDateTime(iso: string): string {
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

function formatTimeRange(startAt: string, endAt: string): string {
  try {
    const start = new Date(startAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    const end = new Date(endAt).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    return `${start} - ${end}`;
  } catch {
    return `${startAt} - ${endAt}`;
  }
}

export function ThreeWayCallWorkspace({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [view, setView] = useState<View>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const [availabilityRes, bookingsRes] = await Promise.all([
        fetch('/api/three-way/availability', { credentials: 'include' }),
        fetch('/api/three-way/bookings', { credentials: 'include' }),
      ]);
      if (!availabilityRes.ok || !bookingsRes.ok) {
        setView({ kind: 'error', message: 'Could not load 3-way call scheduling.' });
        return;
      }
      setView({
        kind: 'ready',
        availability: (await availabilityRes.json()) as AvailabilityResponse,
        bookings: (await bookingsRes.json()) as BookingsResponse,
      });
    } catch {
      setView({ kind: 'error', message: 'Network error loading 3-way calls.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <section>
        <SectionLabel>3-Way Calls</SectionLabel>
        <div className="bg-cream/[0.02] border border-gold/20 rounded-md p-5">
          <div className="flex items-start gap-3 mb-4">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-gold/30 bg-gold/[0.06] text-gold shrink-0">
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-display text-[24px] leading-none text-cream">
                Book a 3-Way Call
              </p>
              <p className="text-cream-faint text-[13px] leading-[1.5] mt-2">
                Pick an available upline member and bring the prospect context.
              </p>
            </div>
          </div>
          <Button
            onClick={() => onOpenChange(true)}
            className="w-full bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-5 py-4"
          >
            <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
            Book a 3-Way Call
          </Button>
        </div>
      </section>

      {view.kind === 'loading' && (
        <p className="text-cream-faint font-mono text-[12px] tracking-[0.04em]">
          Loading call schedule...
        </p>
      )}

      {view.kind === 'error' && (
        <div className="bg-cream/[0.02] border border-red-400/25 rounded-md p-5">
          <p className="text-red-300 font-mono text-[12px] tracking-[0.04em] mb-3">
            {view.message}
          </p>
          <button
            type="button"
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

      {view.kind === 'ready' && (
        <>
          <MyAvailabilityEditor
            availability={view.availability.myAvailability}
            onSaved={() => void load()}
          />
          <TeamCalendarRail
            bookings={view.bookings.bookings}
            onChanged={() => void load()}
          />
          {open && (
            <BookThreeWayModal
              bookableUplines={view.availability.bookableUplines}
              onClose={() => onOpenChange(false)}
              onBooked={() => {
                onOpenChange(false);
                void load();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function MyAvailabilityEditor({
  availability,
  onSaved,
}: {
  availability: SponsorAvailability | null;
  onSaved: () => void;
}) {
  const [timezone, setTimezone] = useState(availability?.timezone ?? localTimezone());
  const [windows, setWindows] = useState<AvailabilityWindow[]>(
    availability?.windows ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setTimezone(availability?.timezone ?? localTimezone());
    setWindows(availability?.windows ?? []);
  }, [availability]);

  const updateWindow = useCallback(
    (index: number, patch: Partial<AvailabilityWindow>) => {
      setWindows((prev) =>
        prev.map((w, i) => (i === index ? { ...w, ...patch } : w)),
      );
    },
    [],
  );

  const addWindow = useCallback(() => {
    setWindows((prev) => [
      ...prev,
      {
        windowId: `window_${prev.length + 1}`,
        dayOfWeek: 1,
        startTime: '18:00',
        endTime: '20:00',
        active: true,
      },
    ]);
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/three-way/availability', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone, windows }),
      });
      if (res.ok) {
        setMessage('Availability saved.');
        onSaved();
      } else {
        setMessage('Could not save. Check the windows and try again.');
      }
    } catch {
      setMessage('Network error saving availability.');
    } finally {
      setSaving(false);
    }
  }, [timezone, windows, onSaved]);

  return (
    <section>
      <SectionLabel>My Availability</SectionLabel>
      <div className="bg-cream/[0.02] border border-cream/10 rounded-md p-5 space-y-4">
        <div>
          <label className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase">
            Timezone
          </label>
          <input
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-2 w-full bg-cream/[0.04] border border-cream/15 rounded px-3 py-2 text-cream font-mono text-[13px]"
          />
        </div>

        <div className="space-y-3">
          {windows.map((window, index) => (
            <div key={`${window.windowId}-${index}`} className="border border-cream/10 rounded p-3">
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={window.dayOfWeek}
                  onChange={(e) =>
                    updateWindow(index, { dayOfWeek: Number(e.target.value) as DayOfWeek })
                  }
                  className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-2 text-cream font-mono text-[12px]"
                >
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <div className="grid grid-cols-[1fr_1fr_36px] gap-2">
                  <input
                    type="time"
                    value={window.startTime}
                    onChange={(e) => updateWindow(index, { startTime: e.target.value })}
                    className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-2 text-cream font-mono text-[12px]"
                  />
                  <input
                    type="time"
                    value={window.endTime}
                    onChange={(e) => updateWindow(index, { endTime: e.target.value })}
                    className="bg-cream/[0.04] border border-cream/15 rounded px-2 py-2 text-cream font-mono text-[12px]"
                  />
                  <button
                    type="button"
                    onClick={() => setWindows((prev) => prev.filter((_, i) => i !== index))}
                    className="inline-flex items-center justify-center rounded border border-cream/15 text-cream-faint hover:text-red-300 hover:border-red-400/40"
                    title="Remove window"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {windows.length === 0 && (
            <p className="text-cream-faint text-[13px] leading-[1.5]">
              No weekly windows set. Add one to become bookable by your downline.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={addWindow}
            className="bg-cream/[0.05] text-cream border border-cream/15 hover:border-gold/40 font-mono tracking-[0.04em] text-[12px] px-4 py-2 h-auto"
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            Add window
          </Button>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[13px] px-5 py-2 h-auto disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
        {message && (
          <p className="text-cream-faint font-mono text-[11px] tracking-[0.04em]">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

function TeamCalendarRail({
  bookings,
  onChanged,
}: {
  bookings: Booking[];
  onChanged: () => void;
}) {
  const upcoming = useMemo(
    () =>
      bookings
        .filter((b) => b.status === 'booked' && new Date(b.endAt).getTime() >= Date.now())
        .slice(0, 6),
    [bookings],
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  const cancel = useCallback(
    async (bookingId: string) => {
      setBusyId(bookingId);
      try {
        const res = await fetch(`/api/three-way/bookings/${bookingId}/cancel`, {
          method: 'POST',
          credentials: 'include',
        });
        if (res.ok) onChanged();
      } finally {
        setBusyId(null);
      }
    },
    [onChanged],
  );

  return (
    <section>
      <SectionLabel>Team Calendar</SectionLabel>
      <div className="bg-cream/[0.02] border border-cream/10 rounded-md p-5">
        <p className="text-cream-faint text-[13px] leading-[1.5] mb-4">
          Upcoming 3-way calls show here in your local time.
        </p>
        {upcoming.length === 0 ? (
          <p className="text-cream-faint text-[13px] leading-[1.5]">
            No 3-way calls booked yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((booking) => (
              <li
                key={booking.bookingId}
                className="border border-cream/10 rounded p-3 bg-cream/[0.02]"
              >
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-gold mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-cream text-[14px] leading-[1.35]">
                      {formatDateTime(booking.startAt)}
                    </p>
                    <p className="font-mono text-[10px] tracking-[0.06em] text-cream-faint mt-1 uppercase">
                      {booking.myRole === 'sponsor' ? 'You host' : 'You booked'} ·{' '}
                      {booking.myRole === 'sponsor' ? booking.bookerName : booking.sponsorName}
                    </p>
                    {booking.prospectNote && (
                      <p className="text-cream-mute text-[12px] leading-[1.45] mt-2">
                        {booking.prospectNote}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={busyId === booking.bookingId}
                      onClick={() => void cancel(booking.bookingId)}
                      className="mt-2 font-mono tracking-[0.08em] text-[10px] text-cream-faint hover:text-red-300 disabled:opacity-50"
                    >
                      {busyId === booking.bookingId ? 'Cancelling...' : 'Cancel'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function BookThreeWayModal({
  bookableUplines,
  onClose,
  onBooked,
}: {
  bookableUplines: BookableUpline[];
  onClose: () => void;
  onBooked: () => void;
}) {
  const [selectedTmagId, setSelectedTmagId] = useState(bookableUplines[0]?.tmagId ?? '');
  const selected = bookableUplines.find((u) => u.tmagId === selectedTmagId) ?? null;
  const [selectedStartAt, setSelectedStartAt] = useState(selected?.slots[0]?.startAt ?? '');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = bookableUplines.find((u) => u.tmagId === selectedTmagId) ?? bookableUplines[0] ?? null;
    setSelectedStartAt(next?.slots[0]?.startAt ?? '');
  }, [selectedTmagId, bookableUplines]);

  const book = useCallback(async () => {
    if (!selected || !selectedStartAt) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/three-way/bookings', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sponsorTmagId: selected.tmagId,
          startAt: selectedStartAt,
          prospectNote: note.trim() || null,
        }),
      });
      if (res.ok) {
        onBooked();
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          data?.error === 'double_booked'
            ? 'That slot was just taken. Pick another.'
            : data?.error === 'sponsor_not_bookable'
              ? 'That upline member is no longer bookable.'
              : 'Could not book the call. Try once more.',
        );
      }
    } catch {
      setError('Network error booking the call.');
    } finally {
      setSaving(false);
    }
  }, [selected, selectedStartAt, note, onBooked]);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-4 py-8 overflow-y-auto">
      <div className="max-w-xl mx-auto bg-ink border border-gold/30 rounded-md p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="font-mono tracking-[0.18em] text-[11px] text-gold uppercase mb-2">
              3-Way Call
            </p>
            <h3 className="font-display text-[32px] leading-none text-cream">
              Book a call
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded border border-cream/15 text-cream-faint hover:text-cream"
            title="Close"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {bookableUplines.length === 0 ? (
          <p className="text-cream-mute text-[14px] leading-[1.6]">
            Nobody in your upline has availability set yet. Check back after
            Kevin, Paul, or your sponsor opens weekly windows.
          </p>
        ) : (
          <div className="space-y-4">
            {bookableUplines.length > 1 && (
              <div>
                <label className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase">
                  Person
                </label>
                <select
                  value={selectedTmagId}
                  onChange={(e) => setSelectedTmagId(e.target.value)}
                  className="mt-2 w-full bg-cream/[0.04] border border-cream/15 rounded px-3 py-2 text-cream font-mono text-[13px]"
                >
                  {bookableUplines.map((u) => (
                    <option key={u.tmagId} value={u.tmagId}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase">
                Slot
              </label>
              {selected && selected.slots.length > 0 ? (
                <select
                  value={selectedStartAt}
                  onChange={(e) => setSelectedStartAt(e.target.value)}
                  className="mt-2 w-full bg-cream/[0.04] border border-cream/15 rounded px-3 py-2 text-cream font-mono text-[13px]"
                >
                  {selected.slots.map((slot) => (
                    <option key={slot.startAt} value={slot.startAt}>
                      {formatDateTime(slot.startAt)} ({formatTimeRange(slot.startAt, slot.endAt)})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-2 text-cream-faint text-[13px]">
                  No open slots in the next 14 days.
                </p>
              )}
            </div>

            <div>
              <label className="font-mono tracking-[0.1em] text-[10px] text-cream-faint uppercase">
                Prospect note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={400}
                placeholder="Who is this about, and what should the upline know?"
                className="mt-2 w-full bg-cream/[0.04] border border-cream/15 rounded px-3 py-2 text-cream font-mono text-[13px] leading-[1.5] placeholder:text-cream-faint resize-y"
              />
            </div>

            {error && (
              <p className="text-red-300 font-mono text-[12px] tracking-[0.04em]">
                {error}
              </p>
            )}

            <Button
              onClick={book}
              disabled={saving || !selected || !selectedStartAt}
              className="w-full bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-5 py-4 disabled:opacity-50"
            >
              {saving ? 'Booking...' : 'Book call'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono tracking-[0.18em] text-[11px] text-cream-mute uppercase mb-4">
      {children}
    </p>
  );
}
