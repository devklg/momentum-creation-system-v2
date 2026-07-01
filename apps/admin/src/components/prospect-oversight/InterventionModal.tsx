/**
 * D.4 — generic intervention modal. Handles all four kinds via a
 * `kind` discriminator: 'move' | 'reassign_sponsor' | 'manual_flush' |
 * 'force_enroll'.
 *
 * Every kind requires:
 *   - requestingTmagId (the BA who asked Kevin to intervene)
 *   - reason         (min 8 chars; surfaced in the critical audit entry)
 * Two kinds also require a target BA:
 *   - move           → toTmagId
 *   - reassign_sponsor → newSponsorTmagId
 *
 * UX scaffold:
 *   - Confirmation step shows the BEFORE snapshot (current sponsor /
 *     position / state) and the AFTER preview (what will change).
 *   - Submission posts to the matching server route. On success, the
 *     parent panel patches the directory row in place and refetches the
 *     detail to pick up the new audit-log event.
 *   - Monotonic queue is preserved server-side; the modal shows the
 *     unchanged positionNumber in the AFTER preview so Kevin sees it.
 */

import { useState } from 'react';
import type {
  McsAdminProspectDetail,
  McsAdminProspectInterventionKind,
  McsAdminProspectInterventionResponse,
} from '@momentum/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  kind: McsAdminProspectInterventionKind;
  detail: McsAdminProspectDetail;
  onClose: () => void;
  onDone: (resp: McsAdminProspectInterventionResponse) => void;
}

interface FormState {
  requestingTmagId: string;
  reason: string;
  /** Used by 'move'. */
  toTmagId: string;
  /** Used by 'reassign_sponsor'. */
  newSponsorTmagId: string;
}

const EMPTY_FORM: FormState = {
  requestingTmagId: '',
  reason: '',
  toTmagId: '',
  newSponsorTmagId: '',
};

export function InterventionModal({ kind, detail, onClose, onDone }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [stage, setStage] = useState<'form' | 'confirm' | 'submitting'>('form');
  const [error, setError] = useState<string | null>(null);

  const title = TITLE[kind];
  const description = DESCRIPTION[kind];
  const requiresTargetBa = kind === 'move' || kind === 'reassign_sponsor';
  const targetBaLabel = kind === 'move' ? 'New inviting BA ID' : 'New sponsor BA ID';
  const targetBaValue = kind === 'move' ? form.toTmagId : form.newSponsorTmagId;

  const setTargetBa = (v: string) => {
    setForm((f) => (kind === 'move' ? { ...f, toTmagId: v } : { ...f, newSponsorTmagId: v }));
  };

  const canSubmit =
    form.requestingTmagId.trim().length >= 2 &&
    form.reason.trim().length >= 8 &&
    (!requiresTargetBa || targetBaValue.trim().length >= 2);

  function nextStep() {
    setError(null);
    if (!canSubmit) {
      setError('Provide a requesting BA ID (≥2 chars) and a reason (≥8 chars).');
      return;
    }
    setStage('confirm');
  }

  async function submit() {
    setStage('submitting');
    setError(null);
    try {
      const path = PATH[kind];
      const body: Record<string, string> = {
        requestingTmagId: form.requestingTmagId.trim(),
        reason: form.reason.trim(),
      };
      if (kind === 'move') body.toTmagId = form.toTmagId.trim();
      if (kind === 'reassign_sponsor') body.newSponsorTmagId = form.newSponsorTmagId.trim();

      const res = await fetch(
        `/api/admin/prospects/${encodeURIComponent(detail.prospectId)}/${path}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as
        | McsAdminProspectInterventionResponse
        | { ok: false; error: string };
      if (!('ok' in data) || !data.ok) {
        setError(('error' in data && data.error) || 'Intervention failed.');
        setStage('confirm');
        return;
      }
      onDone(data);
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
          Section D.4 · Intervention
        </p>
        <h3 className="font-display text-[24px] leading-none mb-3">{title}</h3>
        <p className="text-sm text-cream-mute mb-5">{description}</p>

        {stage === 'form' && (
          <div className="space-y-4">
            <BeforeBlock detail={detail} />

            <div>
              <Label htmlFor="requestingTmagId">Requesting BA ID</Label>
              <Input
                id="requestingTmagId"
                value={form.requestingTmagId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, requestingTmagId: e.target.value }))
                }
                placeholder="TMAG-…"
              />
            </div>

            {requiresTargetBa && (
              <div>
                <Label htmlFor="targetBa">{targetBaLabel}</Label>
                <Input
                  id="targetBa"
                  value={targetBaValue}
                  onChange={(e) => setTargetBa(e.target.value)}
                  placeholder="TMAG-…"
                />
              </div>
            )}

            <div>
              <Label htmlFor="reason">Reason (min 8 chars)</Label>
              <textarea
                id="reason"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Kevin's words. Surfaced in the critical audit entry."
                className="w-full bg-ink border border-line rounded px-3 py-2 text-sm text-cream font-body resize-y min-h-[100px]"
              />
            </div>

            {error && (
              <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">
                {error}
              </p>
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

            <div className="border border-line rounded-md p-3 text-sm space-y-1">
              <Diff label="Sponsor BA" before={detail.sponsorTmagIdNow} after={afterSponsor(kind, detail, form)} />
              <Diff
                label="State"
                before={detail.state}
                after={afterState(kind, detail.state)}
              />
              <Diff
                label="Position"
                before={detail.positionNumber !== null ? `#${detail.positionNumber}` : '—'}
                after={detail.positionNumber !== null ? `#${detail.positionNumber}` : '—'}
                preserved
              />
              <Diff
                label="Handoff"
                before={detail.prospectStatus}
                after={afterHandoff(kind, detail.prospectStatus)}
              />
            </div>

            <div className="border border-line rounded-md p-3 text-sm">
              <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint mb-1">
                Reason
              </p>
              <p className="text-cream whitespace-pre-wrap">{form.reason}</p>
              <p className="text-[11px] font-mono text-cream-faint mt-2">
                Requesting BA: {form.requestingTmagId}
              </p>
            </div>

            {error && (
              <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">
                {error}
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => void submit()}
                disabled={stage === 'submitting'}
              >
                {stage === 'submitting' ? 'Submitting…' : 'Confirm and submit'}
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

/* ─── kind-specific copy and route paths ────────────────────────── */

const TITLE: Record<McsAdminProspectInterventionKind, string> = {
  move: 'Move prospect',
  reassign_sponsor: 'Reassign sponsor',
  manual_flush: 'Manual flush',
  force_enroll: 'Force enroll',
};

const DESCRIPTION: Record<McsAdminProspectInterventionKind, string> = {
  move:
    'Reassign the inviting BA. Position number is preserved. The original sponsor-at-mint is recorded on the prospect; the drift detector surfaces the change on the detail panel.',
  reassign_sponsor:
    'Change the sponsor of record on the prospect (3.5 override). Position number is preserved. Audited as a critical entry separately from `move` so Kevin’s intent survives in the log.',
  manual_flush:
    'Vacate the holding-tank slot before the 8-week window expires. flushReason=archived. Position number is preserved as a vacant slot (monotonic queue).',
  force_enroll:
    'Mark enrolled even if the BA hasn’t. flushReason=enrolled. Position number is preserved. THREE remains the upstream authority; this only mirrors the operational state.',
};

const PATH: Record<McsAdminProspectInterventionKind, string> = {
  move: 'move',
  reassign_sponsor: 'reassign-sponsor',
  manual_flush: 'manual-flush',
  force_enroll: 'force-enroll',
};

/* ─── before / after helpers ────────────────────────────────────── */

function BeforeBlock({ detail }: { detail: McsAdminProspectDetail }) {
  return (
    <div className="border border-line rounded-md p-3 text-sm">
      <p className="text-[11px] font-mono tracking-label uppercase text-cream-faint mb-2">
        Before
      </p>
      <Row label="Sponsor BA" v={`${detail.sponsorNameNow} · ${detail.sponsorTmagIdNow}`} />
      <Row label="State" v={detail.state} />
      <Row
        label="Position"
        v={detail.positionNumber !== null ? `#${detail.positionNumber}` : '—'}
      />
      <Row label="Handoff" v={detail.prospectStatus} />
    </div>
  );
}

function Row({ label, v }: { label: string; v: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-[13px] py-0.5">
      <span className="text-[11px] font-mono tracking-label uppercase text-cream-faint">
        {label}
      </span>
      <span className="text-cream">{v}</span>
    </div>
  );
}

function Diff({
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
      <span className="text-[11px] font-mono tracking-label uppercase text-cream-faint">
        {label}
      </span>
      <span className="text-cream-mute line-through">{before}</span>
      <span className={changed ? 'text-gold' : 'text-cream-faint'}>
        {after}
        {preserved && !changed && (
          <span className="ml-2 text-[10px] font-mono tracking-label uppercase text-teal/80">
            preserved
          </span>
        )}
      </span>
    </div>
  );
}

function afterSponsor(
  kind: McsAdminProspectInterventionKind,
  detail: McsAdminProspectDetail,
  form: FormState,
): string {
  if (kind === 'move') return form.toTmagId || detail.sponsorTmagIdNow;
  if (kind === 'reassign_sponsor') return form.newSponsorTmagId || detail.sponsorTmagIdNow;
  return detail.sponsorTmagIdNow;
}

function afterState(
  kind: McsAdminProspectInterventionKind,
  current: McsAdminProspectDetail['state'],
): string {
  if (kind === 'manual_flush') return 'expired';
  if (kind === 'force_enroll') return 'enrolled';
  return current;
}

function afterHandoff(
  kind: McsAdminProspectInterventionKind,
  current: McsAdminProspectDetail['prospectStatus'],
): string {
  if (kind === 'manual_flush') return 'withdrew';
  if (kind === 'force_enroll') return 'enrolled';
  return current;
}
