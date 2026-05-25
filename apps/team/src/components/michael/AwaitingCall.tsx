/**
 * wf_0038 — Michael interview State 1: awaiting call.
 *
 * Render: gold pill with pulsing dot, the scheduled time in the BA's TZ,
 * and a wrong-number link that POSTs to /api/michael/interview/wrong-number.
 * The page-close-resume case is handled by the parent route re-fetching
 * /state on mount; this component is pure render + the wrong-number action.
 *
 * Compliance: no income/placement/comp language. The copy describes only what
 * happens next (a 15-min Layer-1 call from Michael).
 */

import { useCallback, useMemo, useState } from 'react';

interface AwaitingCallProps {
  scheduledFor: string | null;
  timezone: string | null;
  wrongNumberFlaggedAt: string | null;
  onWrongNumberFlagged: (at: string) => void;
}

export function AwaitingCall({
  scheduledFor,
  timezone,
  wrongNumberFlaggedAt,
  onWrongNumberFlagged,
}: AwaitingCallProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slotLabel = useMemo(() => {
    if (!scheduledFor || !timezone) return null;
    const d = new Date(scheduledFor);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }, [scheduledFor, timezone]);

  const flagged = !!wrongNumberFlaggedAt;

  const handleFlag = useCallback(async () => {
    if (submitting || flagged) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/michael/interview/wrong-number', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = (await res.json()) as { ok: boolean; flaggedAt?: string; error?: string };
      if (!data.ok || !data.flaggedAt) {
        setError(data.error ?? 'Could not flag the number.');
        return;
      }
      onWrongNumberFlagged(data.flaggedAt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setError(`Network error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [submitting, flagged, onWrongNumberFlagged]);

  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <span className="inline-flex items-center gap-2.5 rounded-full bg-gold/15 border border-gold/40 px-4 py-1.5 mb-8">
          <span className="h-2 w-2 rounded-full bg-gold animate-pulse" />
          <span className="font-mono tracking-[0.22em] text-[11px] text-gold uppercase">
            Awaiting call
          </span>
        </span>
        <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-6">
          Stay near your phone.
        </h1>
        {slotLabel ? (
          <div className="bg-cream/[0.025] border border-gold/30 rounded-md py-5 px-6 mb-8 inline-block">
            <p className="font-mono tracking-[0.18em] text-[11px] text-gold mb-2 uppercase">
              Michael will call you
            </p>
            <p className="font-display text-[26px] text-cream leading-tight">
              {slotLabel}
            </p>
            {timezone && (
              <p className="text-[12px] font-mono tracking-[0.06em] text-cream-mute mt-2">
                {timezone.replace(/_/g, ' ')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-cream-mute text-[15px] leading-[1.6] mb-8">
            Your call is queued. This page will update the moment the line rings.
          </p>
        )}
        <p className="text-cream-mute text-[15px] leading-[1.6] mb-8 max-w-md mx-auto">
          About 15 minutes. Michael learns how to support you — your sponsor takes it
          from there.
        </p>
        <div className="mt-2">
          {flagged ? (
            <p className="text-[12px] font-mono tracking-[0.12em] text-cream-faint uppercase">
              We've been notified — Kevin will reach out.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleFlag}
              disabled={submitting}
              className="text-[12px] font-mono tracking-[0.12em] text-cream-faint underline underline-offset-4 hover:text-gold transition-colors uppercase disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Wrong number? — this isn’t me'}
            </button>
          )}
          {error && (
            <p className="mt-3 text-[12px] font-mono tracking-[0.04em] text-red-400">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
