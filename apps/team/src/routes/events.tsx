import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ContextResources } from '@/components/resources/ContextResources';

type SourceStatus = 'available' | 'unavailable';
type EventFilter = 'all' | 'orientation' | 'webinar';

interface OrientationEvent {
  sessionId: string;
  scheduledFor: string;
  hosts: string[];
  capacity: number;
  seatsRemaining: number;
  durationMinutes: number;
  reservedByMe: boolean;
}

interface WebinarEvent {
  eventId: string;
  scheduledFor: string;
  hosts: string[];
  durationMinutes: number;
  status: 'upcoming' | 'past' | 'cancelled';
  reservationMode: 'invitation_token_only';
}

interface EventCenterResponse {
  ok: true;
  schemaVersion: 'event_center.v1.1';
  sources: { orientation: SourceStatus; webinar: SourceStatus };
  events: NormalizedEvent[];
  orientationSessions: OrientationEvent[];
  myOrientationReservationSessionId: string | null;
  webinarEvents: WebinarEvent[];
}

interface NormalizedEvent {
  sourceId: string;
  eventType: 'new_member_orientation' | 'prospect_webinar';
  visibility: { prospect: 'none' | 'invitation_token_only' };
  registration: { state: 'available' | 'full' | 'reserved_by_me' | 'invitation_required' };
  reminders: { status: 'not_configured' | 'configured' };
  attendance: { state: 'not_recorded' | 'attended' | 'missed' | 'rescheduled'; inferred: false };
  followUp: { owner: 'human_crm'; connection: 'not_connected' | 'available'; automated: false };
}

function formatDate(iso: string): { day: string; time: string } {
  const date = new Date(iso);
  return {
    day: date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }),
    time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
  };
}

export function EventsPage() {
  const [data, setData] = useState<EventCenterResponse | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/events', { credentials: 'include' });
      const payload = (await response.json()) as EventCenterResponse | { ok: false };
      if (!response.ok || !payload.ok) throw new Error('event_center_unavailable');
      setData(payload);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const actOnSeat = useCallback(async (sessionId: string, method: 'POST' | 'DELETE') => {
    setBusyId(sessionId);
    setActionError(null);
    try {
      const response = await fetch(`/api/orientation/sessions/${encodeURIComponent(sessionId)}/reserve`, {
        method,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('seat_action_failed');
      await load();
    } catch {
      setActionError('That seat could not be updated. Refresh and try again.');
    } finally {
      setBusyId(null);
    }
  }, [load]);

  const counts = useMemo(() => ({
    orientation: data?.orientationSessions.length ?? 0,
    webinar: data?.webinarEvents.length ?? 0,
  }), [data]);

  return (
    <main className="min-h-screen bg-ink text-cream">
      <section className="border-b border-line px-6 py-14 md:py-20">
        <div className="mx-auto max-w-6xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-teal">Event Center</p>
          <div className="mt-4 grid gap-8 md:grid-cols-[1fr_0.65fr] md:items-end">
            <h1 className="font-display text-[clamp(48px,8vw,88px)] leading-[0.9]">
              Show up.<br /><span className="text-gold-bright">Build together.</span>
            </h1>
            <p className="max-w-xl text-[16px] leading-7 text-cream-mute">
              One calendar for live Team Magnificent orientation and prospect webinar sessions. Each event stays owned by the system that schedules it.
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
        <div className="flex flex-wrap gap-2" aria-label="Filter events">
          {(['all', 'orientation', 'webinar'] as const).map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] ${filter === value ? 'border-gold bg-gold/10 text-gold' : 'border-line text-cream-mute hover:text-cream'}`}>
              {value === 'all' ? `All · ${counts.orientation + counts.webinar}` : `${value} · ${counts[value]}`}
            </button>
          ))}
        </div>

        {error && <StatusPanel>The Event Center is unavailable right now. Your existing orientation and prospect invitation flows are unchanged.</StatusPanel>}
        {!error && !data && <StatusPanel>Loading upcoming events…</StatusPanel>}
        {actionError && <StatusPanel tone="error">{actionError}</StatusPanel>}

        {data && (filter === 'all' || filter === 'orientation') && (
          <EventSection title="New-member orientation" detail="Reserve your own seat in a live group orientation.">
            {data.sources.orientation === 'unavailable' && <StatusPanel>Orientation schedules are temporarily unavailable.</StatusPanel>}
            {data.sources.orientation === 'available' && data.orientationSessions.length === 0 && <StatusPanel>No upcoming orientation sessions are scheduled.</StatusPanel>}
            <div className="grid gap-4 md:grid-cols-2">
              {data.orientationSessions.map((event) => {
                const when = formatDate(event.scheduledFor);
                const model = data.events.find((item) => item.sourceId === event.sessionId);
                const heldElsewhere = data.myOrientationReservationSessionId !== null && !event.reservedByMe;
                return (
                  <article key={event.sessionId} className={`rounded-md border p-5 ${event.reservedByMe ? 'border-teal/45 bg-teal/[0.05]' : 'border-line bg-ink-2'}`}>
                    <p className="font-display text-2xl tracking-wide">{when.day}</p>
                    <p className="mt-1 font-mono text-xs text-gold">{when.time}</p>
                    <p className="mt-4 text-sm text-cream-mute">Hosted by {event.hosts.join(' & ')} · {event.durationMinutes} minutes</p>
                    {model && <EventTruthLine event={model} />}
                    <div className="mt-5 flex items-end justify-between gap-4">
                      <p className="font-mono text-[10px] uppercase tracking-label text-cream-faint">{event.seatsRemaining} of {event.capacity} seats open</p>
                      <Button disabled={busyId === event.sessionId || event.seatsRemaining === 0 || heldElsewhere} onClick={() => void actOnSeat(event.sessionId, event.reservedByMe ? 'DELETE' : 'POST')} className={event.reservedByMe ? 'border border-line bg-transparent text-cream' : 'bg-gold text-ink'}>
                        {busyId === event.sessionId ? 'Updating…' : event.reservedByMe ? 'Cancel seat' : 'Reserve seat'}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
            <ContextResources contextTag="context:event:orientation" title="Approved orientation materials" />
          </EventSection>
        )}

        {data && (filter === 'all' || filter === 'webinar') && (
          <EventSection title="Prospect webinars" detail="Share the schedule. Prospects reserve only through their personal invitation link.">
            {data.sources.webinar === 'unavailable' && <StatusPanel>Webinar schedules are temporarily unavailable.</StatusPanel>}
            {data.sources.webinar === 'available' && data.webinarEvents.length === 0 && <StatusPanel>No upcoming prospect webinars are scheduled.</StatusPanel>}
            <div className="grid gap-4 md:grid-cols-2">
              {data.webinarEvents.map((event) => {
                const when = formatDate(event.scheduledFor);
                const model = data.events.find((item) => item.sourceId === event.eventId);
                return (
                  <article key={event.eventId} className="rounded-md border border-line bg-ink-2 p-5">
                    <div className="flex items-start justify-between gap-4"><CalendarDays className="h-6 w-6 text-teal" /><span className="font-mono text-[9px] uppercase tracking-label text-cream-faint">Invitation link only</span></div>
                    <p className="mt-7 font-display text-2xl tracking-wide">{when.day}</p>
                    <p className="mt-1 font-mono text-xs text-gold">{when.time}</p>
                    <p className="mt-4 text-sm text-cream-mute">Hosted by {event.hosts.join(' & ')} · {event.durationMinutes} minutes</p>
                    {model && <EventTruthLine event={model} />}
                  </article>
                );
              })}
            </div>
            <ContextResources contextTag="context:event:webinar" title="Approved webinar materials" />
          </EventSection>
        )}
      </div>
    </main>
  );
}

function EventTruthLine({ event }: { event: NormalizedEvent }) {
  const reminder = event.reminders.status === 'configured' ? 'Reminder configured' : 'No reminder scheduled';
  const attendance = event.attendance.state === 'not_recorded' ? 'Attendance not recorded' : event.attendance.state;
  return <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.1em] text-cream-faint">{reminder} · {attendance} · Follow-up stays human-owned</p>;
}

function EventSection({ title, detail, children }: { title: string; detail: string; children: React.ReactNode }) {
  return <section className="mt-12 border-t border-line pt-9"><div className="mb-6 flex items-start gap-3"><Users className="mt-1 h-5 w-5 text-teal" /><div><h2 className="font-display text-4xl tracking-wide">{title}</h2><p className="mt-1 text-sm text-cream-mute">{detail}</p></div></div>{children}</section>;
}

function StatusPanel({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'error' }) {
  return <div className={`mt-5 rounded-md border p-5 text-sm ${tone === 'error' ? 'border-red-400/30 text-red-300' : 'border-line bg-cream/[0.02] text-cream-mute'}`}>{children}</div>;
}

export default EventsPage;
