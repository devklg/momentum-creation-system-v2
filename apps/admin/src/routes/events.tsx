import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AdminEventCenterResponse {
  ok: true;
  sources: { orientation: 'available' | 'unavailable'; webinar: 'available' | 'unavailable' };
  events: Array<{
    eventId: string; sourceId: string; eventType: 'new_member_orientation' | 'prospect_webinar';
    visibility: { team: string; admin: string; prospect: string };
    capacity: { mode: 'limited' | 'unlimited'; limit: number | null; reserved: number | null; remaining: number | null };
    registration: { owner: string; mode: string; state: string };
    reminders: { status: string; channels: string[] };
    attendance: { state: string; inferred: false };
    followUp: { owner: 'human_crm'; connection: string; automated: false };
  }>;
  orientationSessions: Array<{ sessionId: string; scheduledFor: string; hosts: string[]; status: string; capacity: number; seatsTaken: number; seatsRemaining: number }>;
  webinarEvents: Array<{ eventId: string; scheduledFor: string; hosts: string[]; status: string; reservationCount: number }>;
}

export function EventsAdminPage() {
  const [data, setData] = useState<AdminEventCenterResponse | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/admin/events', { credentials: 'include' })
      .then(async (response) => {
        const payload = (await response.json()) as AdminEventCenterResponse | { ok: false };
        if (!response.ok || !payload.ok) throw new Error('unavailable');
        return payload;
      })
      .then((payload) => { if (!cancelled) setData(payload); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between gap-6">
        <div><p className="font-mono text-[10px] uppercase tracking-eyebrow text-gold">Event Center</p><h1 className="mt-2 font-display text-4xl tracking-wide text-cream">Event operations</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-cream-mute">A unified operational view over source-owned orientation and webinar records. Reservation counts do not prove attendance.</p></div>
        <Link to="/orientation" className="shrink-0 rounded border border-gold/45 px-4 py-2 font-mono text-[10px] uppercase tracking-label text-gold hover:bg-gold/10">Manage orientation</Link>
      </header>
      {error && <Panel>The Event Center report is unavailable right now.</Panel>}
      {!error && !data && <Panel>Loading event operations…</Panel>}
      {data && <>
        <section className="grid gap-3 md:grid-cols-4"><Metric label="Orientation sessions" value={data.orientationSessions.length} /><Metric label="Orientation seats" value={data.orientationSessions.reduce((sum, event) => sum + event.seatsTaken, 0)} /><Metric label="Webinars" value={data.webinarEvents.length} /><Metric label="Webinar reservations" value={data.webinarEvents.reduce((sum, event) => sum + event.reservationCount, 0)} /></section>
        <SourceTable title="New-member orientation" status={data.sources.orientation} headers={['When', 'Hosts', 'Status', 'Seats']} empty="No orientation sessions found.">
          {data.orientationSessions.map((event) => <tr key={event.sessionId}><Cell>{formatDate(event.scheduledFor)}</Cell><Cell>{event.hosts.join(' & ')}</Cell><Cell>{event.status}</Cell><Cell>{event.seatsTaken} / {event.capacity} · {event.seatsRemaining} open</Cell></tr>)}
        </SourceTable>
        <SourceTable title="Prospect webinars" status={data.sources.webinar} headers={['When', 'Hosts', 'Status', 'Reservations']} empty="No upcoming webinars found.">
          {data.webinarEvents.map((event) => <tr key={event.eventId}><Cell>{formatDate(event.scheduledFor)}</Cell><Cell>{event.hosts.join(' & ')}</Cell><Cell>{event.status}</Cell><Cell>{event.reservationCount}</Cell></tr>)}
        </SourceTable>
        <section><div className="mb-3"><h2 className="font-display text-2xl tracking-wide text-cream">Normalized event model</h2><p className="mt-1 text-xs text-cream-mute">Current source truth for visibility, registration, reminders, attendance, and follow-up.</p></div><div className="overflow-x-auto rounded-md border border-line"><table className="w-full text-left text-xs"><thead className="bg-cream/[0.04] font-mono text-[9px] uppercase tracking-label text-cream-faint"><tr><th className="px-3 py-3">Type</th><th className="px-3 py-3">Visibility</th><th className="px-3 py-3">Capacity</th><th className="px-3 py-3">Registration</th><th className="px-3 py-3">Reminders</th><th className="px-3 py-3">Attendance</th><th className="px-3 py-3">Follow-up</th></tr></thead><tbody className="divide-y divide-line">{data.events.map((event) => <tr key={event.eventId}><Cell>{label(event.eventType)}</Cell><Cell>Team + admin · Prospect: {label(event.visibility.prospect)}</Cell><Cell>{event.capacity.mode === 'limited' ? `${event.capacity.reserved ?? 0} / ${event.capacity.limit ?? 0}` : 'Unlimited'}</Cell><Cell>{label(event.registration.state)}</Cell><Cell>{label(event.reminders.status)}</Cell><Cell>{label(event.attendance.state)} · never inferred</Cell><Cell>Human CRM · {label(event.followUp.connection)}</Cell></tr>)}{data.events.length === 0 && <tr><td colSpan={7} className="px-4 py-7 text-center text-cream-mute">No events available to project.</td></tr>}</tbody></table></div></section>
        <Panel>Event Center does not infer attendance or initiate follow-up. Orientation rosters remain in Group Orientation; prospect follow-up remains human-owned in CRM.</Panel>
      </>}
    </div>
  );
}

function SourceTable({ title, status, headers, empty, children }: { title: string; status: 'available' | 'unavailable'; headers: string[]; empty: string; children: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section><div className="mb-3 flex items-center justify-between"><h2 className="font-display text-2xl tracking-wide text-cream">{title}</h2><span className={`font-mono text-[10px] uppercase tracking-label ${status === 'available' ? 'text-teal' : 'text-gold'}`}>{status}</span></div><div className="overflow-x-auto rounded-md border border-line"><table className="w-full text-left text-sm"><thead className="bg-cream/[0.04] font-mono text-[10px] uppercase tracking-label text-cream-faint"><tr>{headers.map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-line">{status === 'available' && hasRows ? children : <tr><td colSpan={headers.length} className="px-4 py-7 text-center text-cream-mute">{status === 'available' ? empty : `${title} source unavailable.`}</td></tr>}</tbody></table></div></section>;
}
function Cell({ children }: { children: ReactNode }) { return <td className="px-4 py-3 text-cream-mute">{children}</td>; }
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-md border border-line bg-ink-2 p-4"><p className="font-mono text-[10px] uppercase tracking-label text-cream-faint">{label}</p><p className="mt-2 font-display text-3xl text-cream">{value}</p></div>; }
function Panel({ children }: { children: ReactNode }) { return <div className="rounded-md border border-line bg-ink-2 p-5 text-sm leading-6 text-cream-mute">{children}</div>; }
function formatDate(iso: string): string { return new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
function label(value: string): string { return value.replaceAll('_', ' '); }

export default EventsAdminPage;
