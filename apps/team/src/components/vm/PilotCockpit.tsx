/**
 * Pilot cockpit components — the screens Kevin and Paul actually use during
 * the LeadPower pilot (lane feat/vm-live-transfer-cockpit):
 *
 *   RaisedHandsCard          "Called back — call them now." Unresolved
 *                            callbacks stay visible until dispositioned;
 *                            unattributed inbound calls are listed too.
 *   PilotReadoutCard         Per-campaign dropped / voicemails / transfers /
 *                            callbacks / callback rate — the pilot's output.
 *   TransferAvailabilityCard The fail-closed "I'm holding my phone" switch
 *                            plus the transfer-to number.
 *   LeadWorkPanel            Work one lead: disposition, notes, follow-up,
 *                            invite link (human send only), do-not-call.
 *
 * Two-person cockpit — no BA-facing polish, no onboarding.
 */

import { useCallback, useEffect, useState } from 'react';
import { PhoneIncoming, PhoneForwarded, RefreshCw, X } from 'lucide-react';
import type {
  McsCrmDisposition,
  McsVmLeadInviteResponse,
  McsVmLeadWorkDetailResponse,
  McsVmPilotReadoutResponse,
  McsVmPilotReadoutRow,
  McsVmRaisedHandRow,
  McsVmRaisedHandsResponse,
  McsVmTransferAvailabilityRecord,
  McsVmTransferAvailabilityResponse,
  McsVmUnattributedInboundRow,
} from '@momentum/shared';
import { CRM_DISPOSITIONS } from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ApiErrorBody = { ok?: false; error?: string };

async function readJson<T>(res: Response): Promise<T | ApiErrorBody> {
  try {
    return (await res.json()) as T | ApiErrorBody;
  } catch {
    return { ok: false, error: res.ok ? 'Invalid server response.' : `Request failed (${res.status}).` };
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDay(iso: string | null): string {
  if (!iso) return 'Unknown';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

function formatDurationMs(ms: number | null): string {
  if (ms === null) return '—';
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

function titleCase(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

// ── Raised hands ────────────────────────────────────────────────────────────

export function RaisedHandsCard({ onWorkLead }: { onWorkLead: (leadId: string) => void }) {
  const [rows, setRows] = useState<McsVmRaisedHandRow[]>([]);
  const [unattributed, setUnattributed] = useState<McsVmUnattributedInboundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vm/raised-hands', { credentials: 'include' });
      const body = await readJson<McsVmRaisedHandsResponse>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setRows(body.raisedHands);
        setUnattributed(body.unattributed);
      } else {
        setError((body as ApiErrorBody).error ?? 'Could not load callbacks.');
      }
    } catch {
      setError('Network error loading callbacks.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  async function dismiss(inboundCallId: string) {
    try {
      const res = await fetch(`/api/vm/inbound-calls/${encodeURIComponent(inboundCallId)}/dismiss`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) void load();
    } catch {
      // Row stays visible — never quietly disappears on failure.
    }
  }

  return (
    <section className="rounded-md border border-gold/40 bg-gold/[0.04] p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <PhoneIncoming className="h-5 w-5 text-gold" aria-hidden="true" />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">Raised hands</p>
            <h2 className="mt-1 font-display text-[28px] leading-none text-cream">
              Called back — call them now
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-display text-[28px] leading-none text-gold">{rows.length}</span>
          <Button
            onClick={() => void load()}
            className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]"
          >
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </div>

      {error && <p className="mb-3 font-mono text-[11px] text-red-300">{error}</p>}
      {loading && rows.length === 0 && (
        <p className="font-mono text-[12px] text-cream-faint">Loading callbacks…</p>
      )}

      {rows.length === 0 && !loading ? (
        <p className="text-[13px] text-cream-mute">
          No unworked callbacks right now. New callbacks appear here the moment they dial in.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="text-cream-faint font-mono text-[10px] uppercase tracking-[0.1em]">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Phone</th>
                <th className="px-3 py-2 text-left">City</th>
                <th className="px-3 py-2 text-left">Called back</th>
                <th className="px-3 py-2 text-left">Campaign</th>
                <th className="px-3 py-2 text-left">Lead age</th>
                <th className="px-3 py-2 text-left" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.callbackRequestId} className="border-t border-cream/10">
                  <td className="px-3 py-2 text-cream">
                    {row.firstName ?? 'Unknown'} {row.lastName ?? ''}
                  </td>
                  <td className="px-3 py-2 font-mono text-[13px] text-gold">{row.phone ?? '—'}</td>
                  <td className="px-3 py-2 text-cream-mute">
                    {row.city ?? '—'}{row.stateOrRegion ? `, ${row.stateOrRegion}` : ''}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-cream">{timeAgo(row.calledBackAt)}</span>
                  </td>
                  <td className="px-3 py-2 text-cream-mute">{row.campaignName ?? row.vmCampaignId}</td>
                  <td className="px-3 py-2 text-cream-faint">{formatDay(row.leadCreatedAt)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      onClick={() => onWorkLead(row.leadId)}
                      className="bg-gold text-ink hover:bg-gold-bright font-mono text-[12px]"
                    >
                      Work lead
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unattributed.length > 0 && (
        <div className="mt-5 rounded-md border border-cream/10 bg-cream/[0.02] p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-mute">
            Unattributed inbound — someone heard the voicemail and dialed; caller ID matched no lead
          </p>
          <ul className="space-y-2">
            {unattributed.map((call) => (
              <li key={call.inboundCallId} className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono text-[13px] text-gold">
                  {call.normalizedFromNumber ?? call.fromNumber ?? 'Unknown number'}
                </span>
                <span className="text-[12px] text-cream-faint">{timeAgo(call.calledAt)}</span>
                <Button
                  onClick={() => void dismiss(call.inboundCallId)}
                  className="border border-cream/15 bg-cream/[0.05] text-cream-mute hover:border-cream/40 font-mono text-[11px]"
                >
                  Dismiss
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

// ── Pilot readout ───────────────────────────────────────────────────────────

export function PilotReadoutCard() {
  const [rows, setRows] = useState<McsVmPilotReadoutRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/vm/pilot-readout', { credentials: 'include' });
      const body = await readJson<McsVmPilotReadoutResponse>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setRows(body.rows);
      } else {
        setError((body as ApiErrorBody).error ?? 'Could not load the readout.');
      }
    } catch {
      setError('Network error loading the readout.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-md border border-cream/10 bg-cream/[0.02] p-5 md:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">The readout</p>
          <p className="mt-2 text-[14px] text-cream-mute">
            Callback rate per campaign — callbacks ÷ voicemails left. The cohorts answer what lead age is worth.
          </p>
        </div>
        <Button
          onClick={() => void load()}
          className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refresh
        </Button>
      </div>
      {error && <p className="mb-3 font-mono text-[11px] text-red-300">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-cream-faint font-mono text-[10px] uppercase tracking-[0.1em]">
            <tr>
              <th className="px-3 py-2 text-left">Campaign</th>
              <th className="px-3 py-2 text-right">Dropped</th>
              <th className="px-3 py-2 text-right">Voicemails left</th>
              <th className="px-3 py-2 text-right">Live transfers</th>
              <th className="px-3 py-2 text-right">Callbacks</th>
              <th className="px-3 py-2 text-right">Callback rate</th>
              <th className="px-3 py-2 text-right">Median time to callback</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-cream-mute" colSpan={7}>
                  {loading ? 'Loading…' : 'No delivery activity yet.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.vmCampaignId} className="border-t border-cream/10">
                  <td className="px-3 py-2 text-cream">{row.campaignName}</td>
                  <td className="px-3 py-2 text-right text-cream-mute">{row.dropped}</td>
                  <td className="px-3 py-2 text-right text-cream-mute">{row.voicemailsLeft}</td>
                  <td className="px-3 py-2 text-right text-cream-mute">{row.liveTransfers}</td>
                  <td className="px-3 py-2 text-right text-gold font-display text-[18px]">{row.callbacks}</td>
                  <td className="px-3 py-2 text-right text-gold font-display text-[18px]">
                    {row.callbackRate === null ? '—' : `${(row.callbackRate * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-3 py-2 text-right text-cream-faint">
                    {formatDurationMs(row.medianTimeToCallbackMs)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Transfer availability ──────────────────────────────────────────────────

export function TransferAvailabilityCard() {
  const [record, setRecord] = useState<McsVmTransferAvailabilityRecord | null>(null);
  const [number, setNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/vm/transfer-availability', { credentials: 'include' });
      const body = await readJson<McsVmTransferAvailabilityResponse>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setRecord(body.availability);
        setNumber(body.availability.transferToNumber ?? '');
      }
    } catch {
      setError('Could not load availability.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(available: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/vm/transfer-availability', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available, transferToNumber: number.trim() || null }),
      });
      const body = await readJson<McsVmTransferAvailabilityResponse>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setRecord(body.availability);
        setNumber(body.availability.transferToNumber ?? '');
      } else {
        setError((body as ApiErrorBody).error ?? 'Could not save availability.');
      }
    } catch {
      setError('Network error saving availability.');
    } finally {
      setSaving(false);
    }
  }

  const available = record?.available === true;

  return (
    <section className="rounded-md border border-teal/30 bg-teal/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <PhoneForwarded className="h-4 w-4 text-teal" aria-hidden="true" />
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cream-mute">
          Live-transfer availability
        </p>
      </div>
      <p className="mb-3 text-[12px] leading-[1.6] text-cream-faint">
        Bridges only happen while you are marked available. Unavailable: live-transfer campaigns stop
        dialing; “both” campaigns leave the voicemail instead. Fail closed — never dead air.
      </p>
      <div className="mb-3">
        <Label htmlFor="transferToNumber">Transfer calls to</Label>
        <Input
          id="transferToNumber"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="+13235551234"
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <span
          className={
            'rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] ' +
            (available
              ? 'border-teal/40 bg-teal/[0.06] text-teal'
              : 'border-cream/15 bg-cream/[0.03] text-cream-mute')
          }
        >
          {available ? 'Available — bridging on' : 'Unavailable — bridging off'}
        </span>
        <Button
          onClick={() => void save(!available)}
          disabled={saving}
          className={
            available
              ? 'border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]'
              : 'bg-teal text-ink hover:opacity-90 font-mono text-[12px]'
          }
        >
          {saving ? 'Saving…' : available ? 'Go unavailable' : 'Go available'}
        </Button>
      </div>
      {error && <p className="mt-2 font-mono text-[11px] text-red-300">{error}</p>}
    </section>
  );
}

// ── Lead work panel ─────────────────────────────────────────────────────────

export function LeadWorkPanel({
  leadId,
  onClose,
  onChanged,
}: {
  leadId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<McsVmLeadWorkDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [followUpAt, setFollowUpAt] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/vm/leads/${encodeURIComponent(leadId)}`, { credentials: 'include' });
      const body = await readJson<McsVmLeadWorkDetailResponse>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setDetail(body);
      } else {
        setError((body as ApiErrorBody).error ?? 'Could not load the lead.');
      }
    } catch {
      setError('Network error loading the lead.');
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(path: string, init: RequestInit, successToast: string) {
    setBusy(true);
    setToast(null);
    setError(null);
    try {
      const res = await fetch(`/api/vm/leads/${encodeURIComponent(leadId)}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        ...init,
      });
      const body = await readJson<{ ok: true }>(res);
      if (res.ok && 'ok' in body && body.ok === true) {
        setToast(successToast);
        await load();
        onChanged();
        return body as unknown as Record<string, unknown>;
      }
      setError((body as ApiErrorBody).error ?? 'Action failed.');
      return null;
    } catch {
      setError('Network error.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite(markSent: boolean) {
    const body = (await act(
      '/invite',
      { method: 'POST', body: JSON.stringify({ markSent }) },
      markSent ? 'Invite marked sent.' : 'Invite link ready.',
    )) as unknown as McsVmLeadInviteResponse | null;
    if (body?.inviteUrl) {
      try {
        await navigator.clipboard.writeText(body.inviteUrl);
        setToast(markSent ? 'Invite marked sent — link copied.' : 'Invite link copied to clipboard.');
      } catch {
        setToast(`Invite link: ${body.inviteUrl}`);
      }
    }
  }

  const lead = detail?.lead ?? null;
  const followUpState = detail?.followUp
    ? new Date(detail.followUp.dueAt).getTime() <= Date.now()
      ? 'due'
      : 'scheduled'
    : 'none';

  return (
    <section className="rounded-md border border-gold/40 bg-ink-2 p-5 md:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold">Work the lead</p>
          <h3 className="mt-1 font-display text-[26px] leading-none text-cream">
            {lead ? `${lead.firstName ?? 'Unknown'} ${lead.lastName ?? ''}` : leadId}
          </h3>
          {lead && (
            <p className="mt-2 font-mono text-[13px] text-gold">
              {lead.normalizedPhone ?? 'No phone'}
              <span className="ml-3 text-cream-faint">
                {lead.city ?? '—'}{lead.stateOrRegion ? `, ${lead.stateOrRegion}` : ''} · added {formatDay(lead.createdAt)} · {titleCase(String(lead.status))}
              </span>
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-cream-faint hover:text-cream" aria-label="Close">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {toast && <p className="mb-3 font-mono text-[11px] text-teal">{toast}</p>}
      {error && <p className="mb-3 font-mono text-[11px] text-red-300">{error}</p>}
      {loading && !detail && <p className="font-mono text-[12px] text-cream-faint">Loading…</p>}

      {detail && lead && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-mute">
                Disposition {detail.disposition ? `— ${titleCase(detail.disposition)}` : '— none yet'}
              </p>
              <div className="flex flex-wrap gap-2">
                {CRM_DISPOSITIONS.map((disposition: McsCrmDisposition) => (
                  <button
                    key={disposition}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        '/disposition',
                        { method: 'POST', body: JSON.stringify({ disposition }) },
                        `Dispositioned: ${titleCase(disposition)}.`,
                      )
                    }
                    className={
                      'rounded border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.05em] transition-colors ' +
                      (detail.disposition === disposition
                        ? 'border-gold/60 bg-gold/[0.08] text-gold'
                        : 'border-cream/10 bg-cream/[0.02] text-cream-faint hover:border-cream/25 hover:text-cream')
                    }
                  >
                    {titleCase(disposition)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-mute">
                Follow-up {followUpState !== 'none' ? `— ${followUpState} ${detail.followUp ? formatDay(detail.followUp.dueAt) : ''}` : '— none'}
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  type="datetime-local"
                  value={followUpAt}
                  onChange={(e) => setFollowUpAt(e.target.value)}
                  className="max-w-[240px]"
                />
                <Button
                  disabled={busy || !followUpAt}
                  onClick={() => {
                    const iso = new Date(followUpAt).toISOString();
                    void act('/follow-up', { method: 'POST', body: JSON.stringify({ dueAt: iso }) }, 'Follow-up scheduled.');
                  }}
                  className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]"
                >
                  Schedule
                </Button>
                {detail.followUp && (
                  <Button
                    disabled={busy}
                    onClick={() => void act('/follow-up', { method: 'DELETE' }, 'Follow-up cleared.')}
                    className="border border-cream/15 bg-cream/[0.05] text-cream-mute hover:border-cream/40 font-mono text-[12px]"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-mute">
                Invite — you send it yourself; the system never texts a prospect
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={busy || !detail.inviteUrl}
                  onClick={() => void copyInvite(false)}
                  className="border border-teal/30 bg-teal/[0.06] text-teal hover:border-teal/60 font-mono text-[12px]"
                >
                  Copy invite link
                </Button>
                <Button
                  disabled={busy || !detail.inviteUrl}
                  onClick={() => void copyInvite(true)}
                  className="border border-cream/15 bg-cream/[0.05] text-cream hover:border-gold/40 font-mono text-[12px]"
                >
                  I sent it
                </Button>
              </div>
              {!detail.inviteUrl && (
                <p className="mt-2 text-[12px] text-cream-faint">This lead has no invite token yet.</p>
              )}
            </div>

            <div>
              <Button
                disabled={busy || lead.doNotDrop}
                onClick={() => {
                  if (window.confirm('Permanently suppress this number? It will never be dialed again, in any mode.')) {
                    void act('/do-not-call', { method: 'POST', body: JSON.stringify({}) }, 'Suppressed — will never be dialed again.');
                  }
                }}
                className="border border-red-400/40 bg-red-500/10 text-red-300 hover:border-red-400/70 font-mono text-[12px]"
              >
                {lead.doNotDrop ? 'Already suppressed' : 'Do not call — permanent'}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-cream-mute">
              Notes — the conversation is the asset
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="What did they say?"
              className="w-full resize-y rounded-md border border-cream/10 bg-cream/[0.03] p-3 text-[13px] leading-[1.55] text-cream placeholder:text-cream-faint"
            />
            <div className="mt-2 flex justify-end">
              <Button
                disabled={busy || !noteText.trim()}
                onClick={() => {
                  const text = noteText.trim();
                  void act('/notes', { method: 'POST', body: JSON.stringify({ text }) }, 'Note saved.').then(() =>
                    setNoteText(''),
                  );
                }}
                className="bg-gold text-ink hover:bg-gold-bright font-mono text-[12px]"
              >
                Add note
              </Button>
            </div>
            <ul className="mt-3 max-h-[320px] space-y-2 overflow-y-auto">
              {detail.notes.map((note) => (
                <li key={note.noteId} className="rounded border border-cream/10 bg-cream/[0.02] p-3">
                  <p className="text-[13px] leading-[1.55] text-cream">{note.text}</p>
                  <p className="mt-1 font-mono text-[10px] text-cream-faint">{new Date(note.createdAt).toLocaleString()}</p>
                </li>
              ))}
              {detail.notes.length === 0 && (
                <li className="text-[12px] text-cream-faint">No notes yet.</li>
              )}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
