import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type AttendanceState = 'attended' | 'missed' | 'rescheduled';

interface WebinarReservation {
  reservationId: string;
  eventId: string;
  prospectId: string;
  sponsorTmagId: string;
  name: string;
  createdAt: string;
  attendance: AttendanceState | null;
  attendanceRecordedAt: string | null;
  crmFollowUpDueAt: string | null;
}

interface AdminEventCenterResponse {
  ok: true;
  schemaVersion: 'event_center.v1.2';
  sources: { orientation: 'available' | 'unavailable'; webinar: 'available' | 'unavailable' };
  dependencies: { attendance: 'available' | 'unavailable'; crm: 'available' | 'unavailable' };
  events: Array<{
    eventId: string;
    sourceId: string;
    eventType: 'new_member_orientation' | 'prospect_webinar';
    visibility: { prospect: string };
    capacity: { mode: string; limit: number | null; reserved: number | null };
    registration: { state: string };
    reminders: { status: string; channels: string[] };
    attendance: {
      state: 'not_recorded' | 'recorded' | 'unavailable';
      inferred: false;
      counts: { recorded: number; attended: number; missed: number; rescheduled: number };
    };
    followUp: { owner: 'human_crm'; connection: string; automated: false; connectedCount: number };
  }>;
  orientationSessions: Array<{
    sessionId: string;
    scheduledFor: string;
    hosts: string[];
    status: string;
    capacity: number;
    seatsTaken: number;
    seatsRemaining: number;
  }>;
  webinarEvents: Array<{
    eventId: string;
    scheduledFor: string;
    hosts: string[];
    status: string;
    reservationCount: number;
  }>;
  webinarReservations: WebinarReservation[];
  pageInfo: { pageSize: number; hasMore: boolean; nextCursor: string | null };
}

export function EventsAdminPage() {
  const [data, setData] = useState<AdminEventCenterResponse | null>(null);
  const [error, setError] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const requestSequence = useRef(0);

  const load = useCallback(async (mode: 'replace' | 'append' = 'replace', cursor?: string) => {
    const sequence = ++requestSequence.current;
    setLoadingPage(true);
    try {
      const params = new URLSearchParams({ pageSize: '50' });
      if (cursor) params.set('cursor', cursor);
      const response = await fetch(`/api/admin/events?${params.toString()}`, { credentials: 'include' });
      const payload = (await response.json()) as AdminEventCenterResponse | { ok: false };
      if (!response.ok || !payload.ok) throw new Error('unavailable');
      if (sequence !== requestSequence.current) return;
      const next = payload as AdminEventCenterResponse;
      setData((previous) => {
        if (mode === 'replace' || !previous) return next;
        const reservations = new Map(previous.webinarReservations.map((row) => [row.reservationId, row]));
        for (const row of next.webinarReservations) reservations.set(row.reservationId, row);
        return { ...next, webinarReservations: [...reservations.values()] };
      });
      setError(false);
    } catch {
      if (sequence === requestSequence.current) setError(true);
    } finally {
      if (sequence === requestSequence.current) setLoadingPage(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function recordAttendance(row: WebinarReservation, state: AttendanceState) {
    const key = `${row.reservationId}:${state}`;
    setWorking(key);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/admin/events/webinars/${encodeURIComponent(row.eventId)}/reservations/${encodeURIComponent(row.reservationId)}/attendance`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ state }),
        },
      );
      const payload = (await response.json()) as {
        ok?: boolean;
        attendance?: { state: AttendanceState; recordedAt: string };
        followUp?: { dueAt: string; created: boolean; automatedContact: false };
        error?: string;
      };
      if (!response.ok || !payload.ok || !payload.followUp || !payload.attendance) {
        throw new Error(payload.error ?? 'attendance_not_saved');
      }
      setNotice(
        `${row.name}: ${label(state)} recorded. Human CRM follow-up ${payload.followUp.created ? 'created' : 'preserved'}; no contact was sent.`,
      );
      setData((current) => current ? {
        ...current,
        webinarReservations: current.webinarReservations.map((candidate) => (
          candidate.reservationId === row.reservationId
            ? {
                ...candidate,
                attendance: payload.attendance!.state,
                attendanceRecordedAt: payload.attendance!.recordedAt,
                crmFollowUpDueAt: payload.followUp!.dueAt,
              }
            : candidate
        )),
      } : current);
    } catch (reason) {
      setNotice(reason instanceof Error ? `Could not record attendance: ${reason.message}` : 'Could not record attendance.');
    } finally {
      setWorking(null);
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between gap-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-gold">Event Center</p>
          <h1 className="mt-2 font-display text-4xl tracking-wide text-cream">Event operations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-cream-mute">
            A unified operational view over source-owned orientation and webinar records. Reservation counts do not prove attendance.
          </p>
        </div>
        <Link to="/orientation" className="shrink-0 rounded border border-gold/45 px-4 py-2 font-mono text-[10px] uppercase tracking-label text-gold hover:bg-gold/10">
          Manage orientation
        </Link>
      </header>

      {error && <Panel>The Event Center report is unavailable right now.</Panel>}
      {!error && !data && <Panel>Loading event operations…</Panel>}
      {notice && <Panel>{notice}</Panel>}

      {data && (
        <>
          <section className="grid gap-3 md:grid-cols-4">
            <Metric label="Orientation sessions" value={data.orientationSessions.length} />
            <Metric label="Orientation seats" value={data.orientationSessions.reduce((sum, event) => sum + event.seatsTaken, 0)} />
            <Metric label="Webinars" value={data.webinarEvents.length} />
            <Metric label="Webinar reservations" value={data.webinarEvents.reduce((sum, event) => sum + event.reservationCount, 0)} />
          </section>

          <SourceTable title="New-member orientation" status={data.sources.orientation} headers={['When', 'Hosts', 'Status', 'Seats']} empty="No orientation sessions found.">
            {data.orientationSessions.map((event) => (
              <tr key={event.sessionId}>
                <Cell>{formatDate(event.scheduledFor)}</Cell><Cell>{event.hosts.join(' & ')}</Cell><Cell>{event.status}</Cell><Cell>{event.seatsTaken} / {event.capacity} · {event.seatsRemaining} open</Cell>
              </tr>
            ))}
          </SourceTable>

          <SourceTable title="Prospect webinars" status={data.sources.webinar} headers={['When', 'Hosts', 'Status', 'Reservations']} empty="No upcoming webinars found.">
            {data.webinarEvents.map((event) => (
              <tr key={event.eventId}>
                <Cell>{formatDate(event.scheduledFor)}</Cell><Cell>{event.hosts.join(' & ')}</Cell><Cell>{event.status}</Cell><Cell>{event.reservationCount}</Cell>
              </tr>
            ))}
          </SourceTable>

          <section>
            <div className="mb-3">
              <h2 className="font-display text-2xl tracking-wide text-cream">Webinar attendance & human follow-up</h2>
              <p className="mt-1 text-xs text-cream-mute">
                Record only confirmed participation. This creates or preserves a CRM reminder for the sponsoring BA; it never sends a message or infers attendance.
              </p>
            </div>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream/[0.04] font-mono text-[9px] uppercase tracking-label text-cream-faint">
                  <tr><th className="px-3 py-3">Prospect</th><th className="px-3 py-3">Event</th><th className="px-3 py-3">Attendance</th><th className="px-3 py-3">CRM follow-up</th><th className="px-3 py-3">Record</th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.webinarReservations.map((row) => (
                    <tr key={row.reservationId}>
                      <Cell><span className="text-cream">{row.name}</span><br /><span className="text-cream-faint">{row.sponsorTmagId}</span></Cell>
                      <Cell>{row.eventId}</Cell>
                      <Cell>{row.attendance ? label(row.attendance) : 'Not recorded'}</Cell>
                      <Cell>{row.crmFollowUpDueAt ? formatDate(row.crmFollowUpDueAt) : 'Not connected'}</Cell>
                      <Cell>
                        <div className="flex min-w-max gap-2">
                          {(['attended', 'missed', 'rescheduled'] as const).map((state) => (
                            <button
                              key={state}
                              type="button"
                              disabled={working !== null}
                              onClick={() => void recordAttendance(row, state)}
                              className="rounded border border-line px-2 py-1 font-mono text-[9px] uppercase text-cream-mute hover:border-gold/50 hover:text-gold disabled:opacity-40"
                            >
                              {working === `${row.reservationId}:${state}` ? 'Saving…' : label(state)}
                            </button>
                          ))}
                        </div>
                      </Cell>
                    </tr>
                  ))}
                  {data.webinarReservations.length === 0 && <tr><td colSpan={5} className="px-4 py-7 text-center text-cream-mute">No webinar reservations are available for attendance recording.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={loadingPage || !data.pageInfo.hasMore || !data.pageInfo.nextCursor}
                onClick={() => data.pageInfo.nextCursor && void load('append', data.pageInfo.nextCursor)}
                className="rounded border border-gold/45 px-4 py-2 font-mono text-[10px] uppercase tracking-label text-gold disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loadingPage ? 'Loading…' : data.pageInfo.hasMore ? 'Load more reservations' : 'All reservations loaded'}
              </button>
              <span className="font-mono text-[10px] uppercase tracking-label text-cream-faint">
                Newest reservations first · {data.webinarReservations.length} loaded
              </span>
            </div>
          </section>

          <section>
            <div className="mb-3"><h2 className="font-display text-2xl tracking-wide text-cream">Normalized event model</h2><p className="mt-1 text-xs text-cream-mute">Current source truth for visibility, registration, reminders, attendance, and follow-up.</p></div>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-cream/[0.04] font-mono text-[9px] uppercase tracking-label text-cream-faint"><tr><th className="px-3 py-3">Type</th><th className="px-3 py-3">Visibility</th><th className="px-3 py-3">Capacity</th><th className="px-3 py-3">Registration</th><th className="px-3 py-3">Reminders</th><th className="px-3 py-3">Attendance</th><th className="px-3 py-3">Follow-up</th></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.events.map((event) => (
                    <tr key={event.eventId}>
                      <Cell>{label(event.eventType)}</Cell><Cell>Team + admin · Prospect: {label(event.visibility.prospect)}</Cell><Cell>{event.capacity.mode === 'limited' ? `${event.capacity.reserved ?? 0} / ${event.capacity.limit ?? 0}` : 'Unlimited'}</Cell><Cell>{label(event.registration.state)}</Cell><Cell>{label(event.reminders.status)}</Cell><Cell>{event.attendance.state === 'recorded' ? `${event.attendance.counts.recorded} recorded · never inferred` : event.attendance.state === 'unavailable' ? 'Attendance source unavailable' : 'Not recorded · never inferred'}</Cell><Cell>Human CRM · {label(event.followUp.connection)} · {event.followUp.connectedCount}</Cell>
                    </tr>
                  ))}
                  {data.events.length === 0 && <tr><td colSpan={7} className="px-4 py-7 text-center text-cream-mute">No events available to project.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>

          <Panel>Event Center never infers attendance or contacts a prospect. Confirmed webinar attendance makes a human-owned CRM reminder available to the sponsoring BA. Orientation attendance remains separate training evidence.</Panel>
        </>
      )}
    </div>
  );
}

function SourceTable({ title, status, headers, empty, children }: { title: string; status: 'available' | 'unavailable'; headers: string[]; empty: string; children: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl tracking-wide text-cream">{title}</h2><span className={`font-mono text-[10px] uppercase tracking-label ${status === 'available' ? 'text-teal' : 'text-gold'}`}>{status}</span></div><div className="overflow-x-auto rounded-md border border-line"><table className="w-full text-left text-sm"><thead className="bg-cream/[0.04] font-mono text-[10px] uppercase tracking-label text-cream-faint"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-line">{status === 'available' && hasRows ? children : <tr><td colSpan={headers.length} className="px-4 py-7 text-center text-cream-mute">{status === 'available' ? empty : `${title} source unavailable.`}</td></tr>}</tbody></table></div></section>;
}

function Panel({ children }: { children: ReactNode }) { return <div className="rounded-md border border-line bg-cream/[0.025] p-5 text-sm text-cream-mute">{children}</div>; }
function Metric({ label: metricLabel, value }: { label: string; value: number }) { return <div className="rounded-md border border-line bg-cream/[0.025] p-4"><p className="font-mono text-[9px] uppercase tracking-label text-cream-faint">{metricLabel}</p><p className="mt-2 font-display text-3xl text-cream">{value}</p></div>; }
function Cell({ children }: { children: ReactNode }) { return <td className="px-4 py-3 text-cream-mute">{children}</td>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date); }
function label(value: string) { return value.replaceAll('_', ' '); }
