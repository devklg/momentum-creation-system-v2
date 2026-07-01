/**
 * D.D — prospect CRUD modal (Chat #141). Sibling to InterventionModal.
 *
 * Handles the four lifecycle actions via a `mode` discriminator:
 *   'create' | 'edit' | 'delete' | 'restore'
 *
 * Distinct from the D.4 InterventionModal on purpose:
 *   - CRUD never touches sponsor. Sponsor changes route ONLY through the
 *     D.4 reassign_sponsor intervention (locked-spec 3.5). 'create' takes a
 *     sponsorTmagId because it STAMPS it immutably at mint; it can never CHANGE
 *     one. 'edit' has no sponsor field at all.
 *   - 'create' is MINT-ONLY (Chat #140-A): a real /p/{token} is minted, no
 *     placement, no position. Position is earned later at video_complete.
 *   - Every mutation requires a reason (min 8 chars) for the 4.J audit trail.
 *
 * Friction:
 *   - 'edit' shows a field-level before/after diff at confirm (name,
 *     location, contact) so Kevin sees exactly what changes.
 *   - 'delete' / 'restore' show the lifecycle flag flip and a plain warning.
 *   - The holding tank is NEVER touched by delete (server-guaranteed); the
 *     modal says so explicitly so Kevin isn't surprised that a placed
 *     prospect keeps its position.
 */

import { useState } from 'react';
import type {
  McsAdminCreateProspectResponse,
  McsAdminEditProspectResponse,
  McsAdminProspectDeleteResponse,
  McsAdminProspectDetail,
  McsAdminProspectRestoreResponse,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type ProspectCrudMode = 'create' | 'edit' | 'delete' | 'restore';

/** Union of the four success responses; the parent narrows on mode. */
export type ProspectCrudResponse =
  | ({ mode: 'create' } & McsAdminCreateProspectResponse)
  | ({ mode: 'edit' } & McsAdminEditProspectResponse)
  | ({ mode: 'delete' } & McsAdminProspectDeleteResponse)
  | ({ mode: 'restore' } & McsAdminProspectRestoreResponse);

interface Props {
  mode: ProspectCrudMode;
  /** Present for edit/delete/restore; absent for create. */
  detail: McsAdminProspectDetail | null;
  onClose: () => void;
  onDone: (resp: ProspectCrudResponse) => void;
}

interface FormState {
  firstName: string;
  lastName: string;
  city: string;
  stateOrRegion: string;
  country: string;
  phone: string;
  email: string;
  sponsorTmagId: string;
  reason: string;
}

function initialForm(mode: ProspectCrudMode, detail: McsAdminProspectDetail | null): FormState {
  if (mode === 'edit' && detail) {
    return {
      firstName: detail.firstName ?? '',
      lastName: detail.lastName ?? '',
      city: detail.location?.city ?? '',
      stateOrRegion: detail.location?.stateOrRegion ?? '',
      country: detail.location?.country ?? 'US',
      phone: detail.phone ?? '',
      email: detail.email ?? '',
      sponsorTmagId: '',
      reason: '',
    };
  }
  return {
    firstName: '',
    lastName: '',
    city: '',
    stateOrRegion: '',
    country: 'US',
    phone: '',
    email: '',
    sponsorTmagId: '',
    reason: '',
  };
}

const TITLE: Record<ProspectCrudMode, string> = {
  create: 'New prospect',
  edit: 'Edit prospect',
  delete: 'Remove prospect',
  restore: 'Restore prospect',
};

const DESCRIPTION: Record<ProspectCrudMode, string> = {
  create:
    'Mint a prospect manually. A real /p/{token} is created with the sponsor stamped immutably. No placement and no position number now — the prospect earns a position later at video_complete, exactly like any invited prospect.',
  edit: 'Update ordinary fields. Sponsor is not editable here — sponsor changes route through the D.4 reassign-sponsor intervention.',
  delete:
    'Soft-remove this prospect from the directory. Reversible. The holding tank is left untouched: a placed prospect keeps its monotonic position, which only vacates on the 8-week flush or enrollment.',
  restore: 'Return a soft-removed prospect to the directory. The original removal reason is kept as history.',
};

export function ProspectCrudModal({ mode, detail, onClose, onDone }: Props) {
  const [form, setForm] = useState<FormState>(() => initialForm(mode, detail));
  const [stage, setStage] = useState<'form' | 'confirm' | 'submitting'>('form');
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof FormState, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const reasonOk = form.reason.trim().length >= 8;
  const createOk =
    form.firstName.trim().length >= 1 &&
    form.lastName.trim().length >= 1 &&
    form.city.trim().length >= 1 &&
    form.stateOrRegion.trim().length >= 1 &&
    form.sponsorTmagId.trim().length >= 2;

  const canSubmit = reasonOk && (mode === 'create' ? createOk : true);

  function nextStep() {
    setError(null);
    if (!reasonOk) {
      setError('A reason (min 8 chars) is required for the audit trail.');
      return;
    }
    if (mode === 'create' && !createOk) {
      setError('First name, last name, city, state, and sponsor BA ID are required.');
      return;
    }
    setStage('confirm');
  }

  async function submit() {
    setStage('submitting');
    setError(null);
    try {
      const resp = await callApi(mode, detail, form);
      if (!resp.ok) {
        setError(resp.error);
        setStage('confirm');
        return;
      }
      onDone({ mode, ...resp.data } as ProspectCrudResponse);
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
          Section D · Prospect lifecycle
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
                <div className="grid grid-cols-[1fr_120px_90px] gap-3">
                  <Field label="City" id="city" value={form.city} onChange={(v) => set('city', v)} />
                  <Field label="State / region" id="stateOrRegion" value={form.stateOrRegion} onChange={(v) => set('stateOrRegion', v)} />
                  <Field label="Country" id="country" value={form.country} onChange={(v) => set('country', v)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone" id="phone" value={form.phone} onChange={(v) => set('phone', v)} placeholder="+1…" />
                  <Field label="Email (optional)" id="email" value={form.email} onChange={(v) => set('email', v)} />
                </div>
              </>
            )}

            {mode === 'create' && (
              <div>
                <Label htmlFor="sponsorTmagId">Sponsor BA ID (stamped immutably)</Label>
                <Input
                  id="sponsorTmagId"
                  value={form.sponsorTmagId}
                  onChange={(e) => set('sponsorTmagId', e.target.value)}
                  placeholder="TMAG-…"
                />
              </div>
            )}

            {(mode === 'delete' || mode === 'restore') && detail && (
              <div className="border border-line rounded-md p-3 text-sm">
                <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint mb-2">
                  {mode === 'delete' ? 'Removing' : 'Restoring'}
                </p>
                <Row label="Name" v={`${detail.firstName} ${detail.lastName}`} />
                <Row label="State" v={detail.state} />
                <Row
                  label="Position"
                  v={detail.positionNumber !== null ? `#${detail.positionNumber} (kept)` : '\u2014'}
                />
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

            {mode === 'edit' && detail && (
              <div className="border border-line rounded-md p-3 text-sm space-y-1">
                <DiffRow label="First name" before={detail.firstName} after={form.firstName} />
                <DiffRow label="Last name" before={detail.lastName} after={form.lastName} />
                <DiffRow label="City" before={detail.location?.city ?? ''} after={form.city} />
                <DiffRow label="State" before={detail.location?.stateOrRegion ?? ''} after={form.stateOrRegion} />
                <DiffRow label="Country" before={detail.location?.country ?? ''} after={form.country} />
                <DiffRow label="Phone" before={detail.phone ?? ''} after={form.phone} />
                <DiffRow label="Email" before={detail.email ?? ''} after={form.email} />
              </div>
            )}

            {mode === 'create' && (
              <div className="border border-line rounded-md p-3 text-sm space-y-1">
                <Row label="Name" v={`${form.firstName} ${form.lastName}`} />
                <Row label="Location" v={`${form.city}, ${form.stateOrRegion} \u00b7 ${form.country}`} />
                <Row label="Phone" v={form.phone || '\u2014'} />
                <Row label="Sponsor" v={form.sponsorTmagId} />
                <p className="text-[11px] font-mono text-teal/80 mt-1">
                  Mint only — no placement, no position assigned now.
                </p>
              </div>
            )}

            {(mode === 'delete' || mode === 'restore') && detail && (
              <div className="border border-line rounded-md p-3 text-sm space-y-1">
                <DiffRow
                  label="Status"
                  before={mode === 'delete' ? 'in directory' : 'removed'}
                  after={mode === 'delete' ? 'removed (reversible)' : 'in directory'}
                />
                <DiffRow
                  label="Position"
                  before={detail.positionNumber !== null ? `#${detail.positionNumber}` : '\u2014'}
                  after={detail.positionNumber !== null ? `#${detail.positionNumber}` : '\u2014'}
                  preserved
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

/** The four success payloads share enough that the caller narrows by mode
 * after the call; the request helper returns the union so each branch can
 * pass its own concrete response type without fighting inference. */
type ProspectCrudOkData =
  | McsAdminCreateProspectResponse
  | McsAdminEditProspectResponse
  | McsAdminProspectDeleteResponse
  | McsAdminProspectRestoreResponse;

async function callApi(
  mode: ProspectCrudMode,
  detail: McsAdminProspectDetail | null,
  form: FormState,
): Promise<ApiResult<ProspectCrudOkData>> {
  const reason = form.reason.trim();
  const base = '/api/admin/prospects';
  const id = detail ? encodeURIComponent(detail.prospectId) : '';

  if (mode === 'create') {
    return request<McsAdminCreateProspectResponse>(base, 'POST', {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      city: form.city.trim(),
      stateOrRegion: form.stateOrRegion.trim(),
      country: form.country.trim() || undefined,
      sponsorTmagId: form.sponsorTmagId.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      reason,
    });
  }
  if (mode === 'edit') {
    return request<McsAdminEditProspectResponse>(`${base}/${id}`, 'PATCH', {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      city: form.city.trim(),
      stateOrRegion: form.stateOrRegion.trim(),
      country: form.country.trim() || undefined,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      reason,
    });
  }
  if (mode === 'delete') {
    return request<McsAdminProspectDeleteResponse>(`${base}/${id}`, 'DELETE', { reason });
  }
  return request<McsAdminProspectRestoreResponse>(`${base}/${id}/restore`, 'POST', { reason });
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
  preserved,
}: {
  label: string;
  before: string;
  after: string;
  preserved?: boolean;
}) {
  const changed = before !== after;
  return (
    <div className="grid grid-cols-[110px_1fr_1fr] gap-2 text-[13px] items-baseline">
      <span className="text-[11px] font-mono tracking-label uppercase text-cream-faint">{label}</span>
      <span className="text-cream-mute line-through">{before || '\u2014'}</span>
      <span className={changed ? 'text-gold' : 'text-cream-faint'}>
        {after || '\u2014'}
        {preserved && !changed && (
          <span className="ml-2 text-[10px] font-mono tracking-label uppercase text-teal/80">preserved</span>
        )}
      </span>
    </div>
  );
}
