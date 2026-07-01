/**
 * C.C — BA CRUD modal (Chat #141). Sibling to SponsorOverrideFlow and to
 * the prospect ProspectCrudModal. Handles create / edit / delete / restore
 * of a Brand Ambassador roster record via a `mode` discriminator.
 *
 * Boundary (locked-spec 2.1, ADMIN standing rule): these write TM-side
 * MIRROR records only — they never enrol anyone in THREE, never fabricate
 * THREE genealogy or comp. THREE is the final authority.
 *
 * Distinct from SponsorOverrideFlow on purpose:
 *   - CRUD never touches sponsor. Sponsor changes route ONLY through the
 *     C.5 override flow (locked-spec 3.5). 'create' takes a sponsorTmagId
 *     because it STAMPS it immutably from birth; it can never CHANGE one.
 *     'edit' has no sponsor field at all.
 *   - 'create' is a roster mirror entry, NO password (the access-code
 *     signup flow owns credentials if the person later self-registers).
 *   - Every mutation requires a reason (min 8 chars) for the 4.J audit trail.
 *
 * Friction:
 *   - 'edit' shows a field-level before/after diff at confirm.
 *   - 'delete' / 'restore' show the lifecycle flip; delete is reversible.
 */

import { useState } from 'react';
import type {
  AdminBaDirectoryRow,
  AdminCreateBaResponse,
  AdminEditBaResponse,
  AdminBaDeleteResponse,
  AdminBaRestoreResponse,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type BaCrudMode = 'create' | 'edit' | 'delete' | 'restore';

export type BaCrudResponse =
  | ({ mode: 'create' } & AdminCreateBaResponse)
  | ({ mode: 'edit' } & AdminEditBaResponse)
  | ({ mode: 'delete' } & AdminBaDeleteResponse)
  | ({ mode: 'restore' } & AdminBaRestoreResponse);

interface Props {
  mode: BaCrudMode;
  /** Present for edit/delete/restore; absent for create. */
  row: AdminBaDirectoryRow | null;
  onClose: () => void;
  onDone: (resp: BaCrudResponse) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  threeBaId: string;
  threeUsername: string;
  email: string;
  phone: string;
  timezone: string;
  marketRegion: string;
  sponsorTmagId: string;
  reason: string;
}

/** Split a stored fullName into first / rest for the edit form. */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

function initialForm(mode: BaCrudMode, row: AdminBaDirectoryRow | null): FormState {
  if (mode === 'edit' && row) {
    const { firstName, lastName } = splitName(row.fullName);
    return {
      firstName,
      lastName,
      threeBaId: row.threeBaId ?? '',
      threeUsername: '',
      email: row.email ?? '',
      phone: row.phone ?? '',
      timezone: '',
      marketRegion: '',
      sponsorTmagId: '',
      reason: '',
    };
  }
  return {
    firstName: '',
    lastName: '',
    threeBaId: '',
    threeUsername: '',
    email: '',
    phone: '',
    timezone: '',
    marketRegion: '',
    sponsorTmagId: '',
    reason: '',
  };
}

const TITLE: Record<BaCrudMode, string> = {
  create: 'New Brand Ambassador',
  edit: 'Edit Brand Ambassador',
  delete: 'Remove Brand Ambassador',
  restore: 'Restore Brand Ambassador',
};

const DESCRIPTION: Record<BaCrudMode, string> = {
  create:
    'Add a TM-side roster mirror entry. The sponsor is stamped immutably from birth. No password is set — if this person later self-registers through the access-code flow, that path owns credentials. This never enrols anyone in THREE; THREE remains the authority.',
  edit: 'Update ordinary fields. Sponsor is not editable here — sponsor changes route through the C.5 override flow.',
  delete: 'Soft-remove this BA from the roster. Reversible. Distinct from suspension; the email stays claimed so it can\u2019t be reused while removed.',
  restore: 'Return a soft-removed BA to the roster. The original removal reason is kept as history.',
};

export function BaCrudModal({ mode, row, onClose, onDone }: Props) {
  const [form, setForm] = useState<FormState>(() => initialForm(mode, row));
  const [stage, setStage] = useState<'form' | 'confirm' | 'submitting'>('form');
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const reasonOk = form.reason.trim().length >= 8;
  const createOk =
    form.firstName.trim().length >= 1 &&
    form.lastName.trim().length >= 1 &&
    form.threeBaId.trim().length >= 1 &&
    form.threeUsername.trim().length >= 1 &&
    form.sponsorTmagId.trim().length >= 2;

  const canSubmit = reasonOk && (mode === 'create' ? createOk : true);

  function nextStep() {
    setError(null);
    if (!reasonOk) {
      setError('A reason (min 8 chars) is required for the audit trail.');
      return;
    }
    if (mode === 'create' && !createOk) {
      setError('First name, last name, THREE BA ID, THREE username, and sponsor BA ID are required.');
      return;
    }
    setStage('confirm');
  }

  async function submit() {
    setStage('submitting');
    setError(null);
    try {
      const resp = await callApi(mode, row, form);
      if (!resp.ok) {
        setError(resp.error);
        setStage('confirm');
        return;
      }
      onDone({ mode, ...resp.data } as BaCrudResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown');
      setStage('confirm');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center px-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-ink border border-line rounded-md max-w-[560px] w-full max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-1">
          Section C · BA lifecycle
        </p>
        <h3 className="font-display text-[24px] leading-none mb-3">{TITLE[mode]}</h3>
        <p className="text-sm text-cream-mute mb-5">{DESCRIPTION[mode]}</p>

        {stage === 'form' && (
          <div className="space-y-4">
            {(mode === 'create' || mode === 'edit') && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First name" id="firstName" value={form.firstName} onChange={(v) => set('firstName', v)} />
                  <Field label="Last name" id="lastName" value={form.lastName} onChange={(v) => set('lastName', v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="THREE BA ID" id="threeBaId" value={form.threeBaId} onChange={(v) => set('threeBaId', v)} />
                  <Field label="THREE username" id="threeUsername" value={form.threeUsername} onChange={(v) => set('threeUsername', v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email" id="email" value={form.email} onChange={(v) => set('email', v)} />
                  <Field label="Phone" id="phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1…" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Timezone" id="timezone" value={form.timezone} onChange={(v) => set('timezone', v)} placeholder="America/Los_Angeles" />
                  <Field label="Market region" id="marketRegion" value={form.marketRegion} onChange={(v) => set('marketRegion', v)} />
                </div>
              </>
            )}

            {mode === 'create' && (
              <div>
                <Label htmlFor="sponsorTmagId">Sponsor BA ID (stamped immutably from birth)</Label>
                <Input
                  id="sponsorTmagId"
                  value={form.sponsorTmagId}
                  onChange={(e) => set('sponsorTmagId', e.target.value)}
                  placeholder="TMBA-…"
                />
              </div>
            )}

            {(mode === 'delete' || mode === 'restore') && row && (
              <div className="border border-line rounded-md p-3 text-sm">
                <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint mb-2">
                  {mode === 'delete' ? 'Removing' : 'Restoring'}
                </p>
                <Row label="Name" v={row.fullName} />
                <Row label="BA ID" v={row.tmagId} />
                <Row label="THREE" v={row.threeBaId} />
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason (min 8 chars)</Label>
              <textarea
                id="reason"
                value={form.reason}
                onChange={(e) => set('reason', e.target.value)}
                placeholder="Surfaced in the audit entry."
                className="w-full bg-ink border border-line rounded px-3 py-2 text-sm text-cream font-body resize-y min-h-[90px]"
              />
            </div>

            {error && (
              <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button variant="primary" size="sm" onClick={nextStep} disabled={!canSubmit}>
                Review
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {(stage === 'confirm' || stage === 'submitting') && (
          <div className="space-y-4">
            <p className="text-[12px] font-mono tracking-label uppercase text-cream-faint">
              Confirm
            </p>

            {mode === 'edit' && row && (
              <div className="border border-line rounded-md p-3 text-sm space-y-1">
                <DiffRow label="First name" before={splitName(row.fullName).firstName} after={form.firstName} />
                <DiffRow label="Last name" before={splitName(row.fullName).lastName} after={form.lastName} />
                <DiffRow label="THREE BA ID" before={row.threeBaId} after={form.threeBaId} />
                <DiffRow label="Email" before={row.email ?? ''} after={form.email} />
                <DiffRow label="Phone" before={row.phone ?? ''} after={form.phone} />
              </div>
            )}

            {mode === 'create' && (
              <div className="border border-line rounded-md p-3 text-sm space-y-1">
                <Row label="Name" v={`${form.firstName} ${form.lastName}`} />
                <Row label="THREE" v={`${form.threeBaId} \u00b7 ${form.threeUsername}`} />
                <Row label="Sponsor" v={form.sponsorTmagId} />
                <p className="text-[11px] font-mono text-teal/80 mt-1">
                  TM mirror entry — no THREE enrolment, no password set.
                </p>
              </div>
            )}

            {(mode === 'delete' || mode === 'restore') && row && (
              <div className="border border-line rounded-md p-3 text-sm space-y-1">
                <DiffRow
                  label="Status"
                  before={mode === 'delete' ? 'on roster' : 'removed'}
                  after={mode === 'delete' ? 'removed (reversible)' : 'on roster'}
                />
              </div>
            )}

            <div className="border border-line rounded-md p-3 text-sm">
              <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint mb-1">
                Reason
              </p>
              <p className="text-cream whitespace-pre-wrap">{form.reason}</p>
            </div>

            {error && (
              <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{error}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void submit()}
                disabled={stage === 'submitting'}
              >
                {stage === 'submitting' ? 'Submitting\u2026' : 'Confirm and submit'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStage('form')}
                disabled={stage === 'submitting'}
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── api ────────────────────────────────────────────────────────── */

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

type BaCrudOkData =
  | AdminCreateBaResponse
  | AdminEditBaResponse
  | AdminBaDeleteResponse
  | AdminBaRestoreResponse;

async function callApi(
  mode: BaCrudMode,
  row: AdminBaDirectoryRow | null,
  form: FormState,
): Promise<ApiResult<BaCrudOkData>> {
  const reason = form.reason.trim();
  const base = '/api/admin/bas';
  const id = row ? encodeURIComponent(row.tmagId) : '';

  if (mode === 'create') {
    return request<AdminCreateBaResponse>(base, 'POST', {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      threeBaId: form.threeBaId.trim(),
      threeUsername: form.threeUsername.trim(),
      sponsorTmagId: form.sponsorTmagId.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      timezone: form.timezone.trim() || null,
      marketRegion: form.marketRegion.trim() || null,
      reason,
    });
  }
  if (mode === 'edit') {
    return request<AdminEditBaResponse>(`${base}/${id}`, 'PATCH', {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      threeBaId: form.threeBaId.trim(),
      threeUsername: form.threeUsername.trim() || undefined,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      timezone: form.timezone.trim() || null,
      marketRegion: form.marketRegion.trim() || null,
      reason,
    });
  }
  if (mode === 'delete') {
    return request<AdminBaDeleteResponse>(`${base}/${id}`, 'DELETE', { reason });
  }
  return request<AdminBaRestoreResponse>(`${base}/${id}/restore`, 'POST', { reason });
}

async function request<T>(
  url: string,
  method: string,
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const res = await fetch(url, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as (T & { ok: true }) | { ok: false; error: string };
  if (!('ok' in data) || !data.ok) {
    return { ok: false, error: ('error' in data && data.error) || 'Request failed.' };
  }
  return { ok: true, data: data as T };
}

/* ─── primitives ─────────────────────────────────────────────────── */

function Field({
  label,
  id,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-[13px] py-0.5">
      <span className="text-[11px] font-mono tracking-label uppercase text-cream-faint">{label}</span>
      <span className="text-cream">{v}</span>
    </div>
  );
}

function DiffRow({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  const changed = before !== after;
  return (
    <div className="grid grid-cols-[110px_1fr_1fr] gap-2 text-[13px] items-baseline">
      <span className="text-[11px] font-mono tracking-label uppercase text-cream-faint">{label}</span>
      <span className="text-cream-mute line-through">{before || '\u2014'}</span>
      <span className={changed ? 'text-gold' : 'text-cream-faint'}>{after || '\u2014'}</span>
    </div>
  );
}
