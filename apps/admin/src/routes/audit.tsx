/**
 * /audit — admin view of the append-only audit log (locked-spec 4.J).
 *
 * Reads /api/admin/audit. Filterable by actor / role / action / entity /
 * severity / time range. Reverse-chronological, cursor-paged.
 *
 * Legacy Michael interview transcripts can still link FROM historical entries
 * via linkedTranscriptId (Chat #89 - no separate tab).
 */

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  AuditActor,
  AuditActorRole,
  AuditEntityKind,
  AuditEntity,
  AuditLogEntry,
  AuditSeverity,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ListResponse {
  ok: boolean;
  entries?: AuditLogEntry[];
  nextCursor?: string | null;
  error?: string;
}

interface FilterDraft {
  role: '' | AuditActorRole;
  actorBaId: string;
  action: string;
  entityKind: '' | AuditEntityKind;
  entityId: string;
  severity: '' | AuditSeverity;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterDraft = {
  role: '',
  actorBaId: '',
  action: '',
  entityKind: '',
  entityId: '',
  severity: '',
  from: '',
  to: '',
};

export function AuditPage() {
  const [draft, setDraft] = useState<FilterDraft>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterDraft>(EMPTY_FILTERS);
  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);

  const queryString = useMemo(() => buildQueryString(applied, null), [applied]);

  useEffect(() => {
    void load(queryString, false);
  }, [queryString]);

  async function load(qs: string, append: boolean): Promise<void> {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/audit${qs}`, { credentials: 'include' });
      const data = (await res.json()) as ListResponse;
      if (!data.ok) {
        setErr(data.error ?? 'Could not load audit log.');
        return;
      }
      const fresh = data.entries ?? [];
      setEntries((prev) => (append && prev ? [...prev, ...fresh] : fresh));
      setNextCursor(data.nextCursor ?? null);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
    } finally {
      setLoading(false);
    }
  }

  function onApply(e: FormEvent) {
    e.preventDefault();
    setApplied(draft);
  }

  function onReset() {
    setDraft(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
  }

  function onLoadMore() {
    if (!nextCursor) return;
    void load(buildQueryString(applied, nextCursor), true);
  }

  return (
    <div className="max-w-7xl">
      <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-2">
        Admin · Section J · Substrate
      </p>
      <h1 className="font-display text-[36px] leading-none mb-2">Audit Log</h1>
      <p className="text-cream-mute text-sm mb-8 max-w-2xl">
        Append-only. Every triple-stack write, every /admin request, every mutation.
        Filter by actor, role, action, entity, or time range. Michael transcripts link
        FROM entries when present.
      </p>

      <form onSubmit={onApply} className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Field label="Role">
          <Select value={draft.role} onChange={(v) => setDraft({ ...draft, role: v as FilterDraft['role'] })}>
            <option value="">Any</option>
            <option value="admin">admin</option>
            <option value="ba">ba</option>
            <option value="system">system</option>
            <option value="prospect">prospect</option>
            <option value="anonymous">anonymous</option>
          </Select>
        </Field>
        <Field label="Actor BA ID">
          <Input
            value={draft.actorBaId}
            onChange={(e) => setDraft({ ...draft, actorBaId: e.target.value })}
            placeholder="TMBA-…"
          />
        </Field>
        <Field label="Action (prefix)">
          <Input
            value={draft.action}
            onChange={(e) => setDraft({ ...draft, action: e.target.value })}
            placeholder="admin.sponsor"
          />
        </Field>
        <Field label="Severity">
          <Select value={draft.severity} onChange={(v) => setDraft({ ...draft, severity: v as FilterDraft['severity'] })}>
            <option value="">Any</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="critical">critical</option>
          </Select>
        </Field>
        <Field label="Entity kind">
          <Select
            value={draft.entityKind}
            onChange={(v) => setDraft({ ...draft, entityKind: v as FilterDraft['entityKind'] })}
          >
            <option value="">Any</option>
            <option value="brand_ambassador">brand_ambassador</option>
            <option value="invite_token">invite_token</option>
            <option value="prospect">prospect</option>
            <option value="access_code">access_code</option>
            <option value="callback_request">callback_request</option>
            <option value="webinar_reservation">webinar_reservation</option>
            <option value="pool_placement">pool_placement</option>
            <option value="admin_session">admin_session</option>
            <option value="master_content">master_content</option>
            <option value="queue_rule">queue_rule</option>
            <option value="compliance_rule">compliance_rule</option>
            <option value="michael_session">michael_session</option>
          </Select>
        </Field>
        <Field label="Entity ID">
          <Input
            value={draft.entityId}
            onChange={(e) => setDraft({ ...draft, entityId: e.target.value })}
          />
        </Field>
        <Field label="From">
          <Input
            type="datetime-local"
            value={draft.from}
            onChange={(e) => setDraft({ ...draft, from: e.target.value })}
          />
        </Field>
        <Field label="To">
          <Input
            type="datetime-local"
            value={draft.to}
            onChange={(e) => setDraft({ ...draft, to: e.target.value })}
          />
        </Field>
        <div className="md:col-span-4 flex gap-3 mt-1">
          <Button type="submit" disabled={loading}>Apply filters</Button>
          <Button type="button" variant="outline" onClick={onReset} disabled={loading}>Reset</Button>
        </div>
      </form>

      {err && (
        <p className="text-[13px] font-mono tracking-[0.04em] text-red-400 mb-4">{err}</p>
      )}

      {entries === null ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-[12px] font-mono tracking-label text-cream-faint uppercase">
          No entries match.
        </p>
      ) : (
        <div className="border border-line rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream/[0.025]">
              <tr className="text-left">
                <Th>Time</Th>
                <Th>Role</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Severity</Th>
                <Th>Details</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <Row
                  key={e.entryId}
                  entry={e}
                  open={openEntryId === e.entryId}
                  onToggle={() => setOpenEntryId(openEntryId === e.entryId ? null : e.entryId)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {nextCursor && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}

function Row({
  entry,
  open,
  onToggle,
}: {
  entry: AuditLogEntry;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-line hover:bg-cream/[0.015]">
        <Td className="font-mono text-[11px] text-cream-mute whitespace-nowrap">
          {formatTimestamp(entry.timestamp)}
        </Td>
        <Td><RolePill role={entry.role} /></Td>
        <Td className="text-cream-mute">{actorDisplay(entry.actor)}</Td>
        <Td><span className="font-mono text-cream">{entry.action}</span></Td>
        <Td className="text-cream-mute">{entityDisplay(entry.entity)}</Td>
        <Td><SeverityPill severity={entry.severity} /></Td>
        <Td>
          <button
            type="button"
            onClick={onToggle}
            className="text-[11px] font-mono uppercase tracking-label text-gold hover:underline"
          >
            {open ? 'Hide' : 'View'}
          </button>
        </Td>
      </tr>
      {open && (
        <tr className="border-t border-line bg-cream/[0.015]">
          <td colSpan={7} className="px-4 py-3">
            <Details entry={entry} />
          </td>
        </tr>
      )}
    </>
  );
}

function Details({ entry }: { entry: AuditLogEntry }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-[12px] font-mono text-cream-mute">
      <div><Label2>Entry ID</Label2> {entry.entryId}</div>
      <div><Label2>Created</Label2> {formatTimestamp(entry.createdAt)}</div>
      {entry.reason && <div className="md:col-span-2"><Label2>Reason</Label2> <span className="text-cream">{entry.reason}</span></div>}
      {entry.linkedTranscriptId && (
        <div className="md:col-span-2">
          <Label2>Michael transcript</Label2>{' '}
          <span className="text-gold">{entry.linkedTranscriptId}</span>
        </div>
      )}
      {entry.context && (
        <div className="md:col-span-2">
          <Label2>Context</Label2>
          <pre className="mt-1 p-2 bg-ink border border-line rounded text-[11px] overflow-x-auto">
            {JSON.stringify(entry.context, null, 2)}
          </pre>
        </div>
      )}
      {entry.before && (
        <div>
          <Label2>Before</Label2>
          <pre className="mt-1 p-2 bg-ink border border-line rounded text-[11px] overflow-x-auto">
            {JSON.stringify(entry.before, null, 2)}
          </pre>
        </div>
      )}
      {entry.after && (
        <div>
          <Label2>After</Label2>
          <pre className="mt-1 p-2 bg-ink border border-line rounded text-[11px] overflow-x-auto">
            {JSON.stringify(entry.after, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function actorDisplay(actor: AuditActor): string {
  switch (actor.kind) {
    case 'admin':
    case 'ba':
      return `${actor.displayName} · ${actor.baId}`;
    case 'prospect':
      return `${actor.displayName} · ${actor.prospectId}`;
    case 'system':
      return `system · ${actor.label}`;
    case 'anonymous':
      return `anonymous${actor.ip ? ` · ${actor.ip}` : ''}`;
  }
}

function entityDisplay(entity: AuditEntity): string {
  if (entity.kind === 'none') return '—';
  if (entity.displayLabel) return `${entity.kind} · ${entity.displayLabel}`;
  return `${entity.kind} · ${entity.id}`;
}

function formatTimestamp(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

function buildQueryString(f: FilterDraft, before: string | null): string {
  const p = new URLSearchParams();
  if (f.role) p.set('role', f.role);
  if (f.actorBaId) p.set('actorBaId', f.actorBaId);
  if (f.action) p.set('actionPrefix', f.action);
  if (f.entityKind) p.set('entityKind', f.entityKind);
  if (f.entityId) p.set('entityId', f.entityId);
  if (f.severity) p.set('severity', f.severity);
  if (f.from) p.set('from', new Date(f.from).toISOString());
  if (f.to) p.set('to', new Date(f.to).toISOString());
  if (before) p.set('before', before);
  const s = p.toString();
  return s ? `?${s}` : '';
}

function RolePill({ role }: { role: AuditActorRole }) {
  const cls =
    role === 'admin'
      ? 'text-gold border-gold/30 bg-gold/[0.06]'
      : role === 'ba'
      ? 'text-teal border-teal/30 bg-teal/[0.08]'
      : role === 'system'
      ? 'text-cream-mute border-line bg-cream/[0.025]'
      : role === 'prospect'
      ? 'text-cream border-line bg-cream/[0.04]'
      : 'text-red-400 border-red-400/30 bg-red-400/[0.06]';
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
        cls,
      ].join(' ')}
    >
      {role}
    </span>
  );
}

function SeverityPill({ severity }: { severity: AuditSeverity }) {
  const cls =
    severity === 'critical'
      ? 'text-red-400 border-red-400/30 bg-red-400/[0.06]'
      : severity === 'warn'
      ? 'text-gold border-gold/30 bg-gold/[0.06]'
      : 'text-cream-mute border-line bg-cream/[0.025]';
  return (
    <span
      className={[
        'inline-block px-2 py-0.5 rounded text-[10px] font-mono tracking-label uppercase border',
        cls,
      ].join(' ')}
    >
      {severity}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2.5 text-[10px] font-mono tracking-label uppercase text-cream-faint text-left">
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={['px-4 py-2.5 align-top', className ?? ''].join(' ')}>{children}</td>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="block mb-1">{label}</Label>
      {children}
    </div>
  );
}

function Label2({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-[10px] uppercase tracking-label text-cream-faint mr-2">
      {children}
    </span>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-ink border border-line rounded px-2 py-1.5 text-sm text-cream font-mono"
    >
      {children}
    </select>
  );
}
