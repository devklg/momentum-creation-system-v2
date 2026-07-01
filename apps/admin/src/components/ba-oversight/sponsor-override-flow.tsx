/**
 * C.5 — Sponsor override flow. Friction-heavy on purpose.
 *
 * Two-step modal launched from the profile drawer's Sponsor section:
 *
 *   Step 1: Form
 *     - Requesting BA's ID (typed, validated by server)
 *     - New sponsor's BA ID (typed, validated by server)
 *     - Reason (free text, required, min 8 chars)
 *
 *   Step 2: Confirmation
 *     - Before / after side-by-side
 *     - Kevin must re-confirm
 *
 * On submit: POST /api/admin/bas/:tmagId/sponsor-override → triple-stack
 * write + critical-severity audit entry. Original sponsor remains on the
 * BA record as historical (server stamps `originalSponsorTmagId` only on
 * the first override so re-overrides don't drift the original away).
 */

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  AdminBaDirectoryRow,
  AdminSponsorOverrideEntry,
  AdminSponsorOverrideResponse,
} from '@momentum/shared';

interface Props {
  row: AdminBaDirectoryRow;
  onCancel: () => void;
  onApplied: (
    nextRow: AdminBaDirectoryRow,
    entry: AdminSponsorOverrideEntry,
  ) => void;
}

type Phase = 'form' | 'confirm' | 'submitting';

export function SponsorOverrideFlow({ row, onCancel, onApplied }: Props) {
  const [phase, setPhase] = useState<Phase>('form');
  const [requestingTmagId, setRequestingTmagId] = useState(row.tmagId);
  const [newSponsorTmagId, setNewSponsorTmagId] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const canProceed =
    requestingTmagId.trim().length > 0 &&
    newSponsorTmagId.trim().length > 0 &&
    newSponsorTmagId.trim() !== row.sponsorTmagId &&
    reason.trim().length >= 8;

  function onFormSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (newSponsorTmagId.trim() === row.tmagId) {
      setErr('A BA cannot sponsor themselves.');
      return;
    }
    if (newSponsorTmagId.trim() === row.sponsorTmagId) {
      setErr('New sponsor is the same as the current sponsor — nothing to change.');
      return;
    }
    setPhase('confirm');
  }

  async function onConfirm() {
    setPhase('submitting');
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/bas/${encodeURIComponent(row.tmagId)}/sponsor-override`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requestingTmagId: requestingTmagId.trim(),
            newSponsorTmagId: newSponsorTmagId.trim(),
            reason: reason.trim(),
          }),
        },
      );
      const data = (await res.json()) as
        | AdminSponsorOverrideResponse
        | { ok: false; error: unknown };
      if (!data.ok) {
        setErr(humanError(data.error));
        setPhase('confirm');
        return;
      }
      onApplied(data.row, data.override);
    } catch (e) {
      setErr(e instanceof Error ? `Network error: ${e.message}` : 'Network error.');
      setPhase('confirm');
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/85 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[560px] max-w-[95vw] bg-ink border border-line rounded-md shadow-xl">
        <header className="px-6 py-5 border-b border-line">
          <p className="font-mono tracking-eyebrow text-[10px] text-gold uppercase mb-1">
            Admin · Section C.5 · Sponsor override
          </p>
          <h2 className="font-display text-[22px] text-cream leading-tight">
            {phase === 'confirm' || phase === 'submitting'
              ? 'Confirm override'
              : `Override ${row.fullName}'s sponsor`}
          </h2>
          <p className="text-[11px] font-mono text-cream-mute mt-1">
            Friction-heavy. Logged as critical audit entry.
          </p>
        </header>

        {phase === 'form' && (
          <form onSubmit={onFormSubmit} className="px-6 py-5 space-y-4">
            <div>
              <Label htmlFor="requestingTmagId">Requesting BA ID</Label>
              <Input
                id="requestingTmagId"
                value={requestingTmagId}
                onChange={(e) => setRequestingTmagId(e.target.value)}
                placeholder="TMAG-..."
                required
              />
              <p className="text-[11px] font-mono text-cream-faint mt-1">
                The BA who personally asked Kevin for this change.
              </p>
            </div>
            <div>
              <Label htmlFor="newSponsorTmagId">New sponsor BA ID</Label>
              <Input
                id="newSponsorTmagId"
                value={newSponsorTmagId}
                onChange={(e) => setNewSponsorTmagId(e.target.value)}
                placeholder="TMAG-..."
                required
              />
              <p className="text-[11px] font-mono text-cream-faint mt-1">
                Current sponsor:{' '}
                <span className="text-cream-mute">
                  {row.sponsorName ?? '— root —'}
                </span>{' '}
                <span className="font-mono">{row.sponsorTmagId ?? ''}</span>
              </p>
            </div>
            <div>
              <Label htmlFor="reason">Reason (required, min 8 chars)</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                required
                className="w-full bg-transparent border border-line rounded-md px-3 py-2 text-sm text-cream focus:border-gold focus:outline-none font-body"
                placeholder="What did the BA ask for and why?"
              />
            </div>
            {err && (
              <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{err}</p>
            )}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={!canProceed}>
                Review
              </Button>
              <Button type="button" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {(phase === 'confirm' || phase === 'submitting') && (
          <div className="px-6 py-5 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="border border-line rounded-md p-4">
                <p className="text-[10px] font-mono tracking-label uppercase text-cream-faint mb-2">
                  Before
                </p>
                <p className="text-[11px] font-mono text-cream-mute mb-1">Sponsor BA</p>
                <p className="text-cream">{row.sponsorName ?? '— root —'}</p>
                <p className="font-mono text-cream-mute text-[12px]">
                  {row.sponsorTmagId ?? '—'}
                </p>
              </div>
              <div className="border border-gold/40 bg-gold/[0.04] rounded-md p-4">
                <p className="text-[10px] font-mono tracking-label uppercase text-gold mb-2">
                  After
                </p>
                <p className="text-[11px] font-mono text-cream-mute mb-1">Sponsor BA</p>
                <p className="text-cream">{newSponsorTmagId.trim()}</p>
              </div>
            </div>

            <div className="border border-line rounded-md p-4 text-[13px]">
              <p className="text-[10px] font-mono tracking-label uppercase text-cream-faint mb-2">
                Reason
              </p>
              <p className="text-cream whitespace-pre-wrap">{reason.trim()}</p>
              <p className="text-[11px] font-mono text-cream-mute mt-3">
                Requested by{' '}
                <span className="text-cream">{requestingTmagId.trim()}</span>
              </p>
            </div>

            <p className="text-[11px] font-mono text-cream-faint">
              On apply: the BA's mirror sponsor changes. The original sponsor stays on
              the record as historical. Triple-stack write + critical audit entry.
            </p>

            {err && (
              <p className="text-[13px] font-mono tracking-[0.04em] text-red-400">{err}</p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={() => void onConfirm()}
                disabled={phase === 'submitting'}
              >
                {phase === 'submitting' ? 'Applying…' : 'Apply override'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPhase('form')}
                disabled={phase === 'submitting'}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={onCancel}
                disabled={phase === 'submitting'}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function humanError(err: unknown): string {
  if (err && typeof err === 'object' && 'kind' in err) {
    const kind = (err as { kind: string }).kind;
    if (kind === 'ba_not_found') return 'BA not found.';
    if (kind === 'new_sponsor_not_found') return 'New sponsor BA ID not found.';
    if (kind === 'requesting_ba_not_found') return 'Requesting BA ID not found.';
    if (kind === 'self_sponsor') return 'A BA cannot sponsor themselves.';
    if (kind === 'no_op') {
      const reason = (err as { reason?: string }).reason;
      return reason ? `No-op: ${reason}` : 'No-op.';
    }
  }
  if (typeof err === 'string') return err;
  return 'Override failed.';
}
