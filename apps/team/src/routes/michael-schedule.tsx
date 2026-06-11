/**
 * /michael/schedule — the real Michael Magnificent scheduling surface.
 *
 * Spec: TEAM Design Section D (locked Chat #82/#84/#94/#95/#96) amended by
 * Chat #97 to add the scheduling step in front of the original 3-state page.
 *
 * Four states, in order:
 *   1. SCHEDULING       — BA picks a 15-min slot from the offered list
 *   2. SCHEDULED        — confirmed; waiting for the call (countdown)
 *   3. IN_PROGRESS      — Telnyx call is live (placeholder for now)
 *   4. COMPLETED        — interview done; gate opens; "Continue to Day 1" CTA
 *
 * Locked behavior:
 *   - 18-hour window from signup, 8:00 AM – 9:45 PM in BA's local TZ
 *   - 15-min slots, continuous (no lunch break)
 *   - ONE reschedule allowed after the first booking
 *   - Hard gate: until status === 'completed', the rest of .team is locked
 *     (server enforces; this page is the unlock).
 *
 * On mount: GET /api/michael/slots → status + offers + timezone.
 * On submit: POST /api/michael/book { slotStartUtc }.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

type Status =
  | 'awaiting_schedule'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'missed';

interface SlotOffer {
  startUtc: string;
  endUtc: string;
  label: string;
  available: boolean;
}

interface SlotsResponse {
  ok: boolean;
  timezone?: string;
  status?: Status;
  slotStartUtc?: string | null;
  rescheduleCount?: number;
  slots?: SlotOffer[];
  error?: string;
}

interface BookResponse {
  ok: boolean;
  schedule?: {
    status: Status;
    slotStartUtc: string | null;
    slotEndUtc: string | null;
    rescheduleCount: number;
    timezone: string | null;
  };
  error?: string;
  code?: string;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | {
      kind: 'scheduling';
      slots: SlotOffer[];
      timezone: string;
      rescheduleCount: number;
      previousSlotUtc: string | null;
    }
  | {
      kind: 'scheduled';
      slotStartUtc: string;
      slotEndUtc: string;
      timezone: string;
      rescheduleCount: number;
    }
  | { kind: 'in_progress'; slotStartUtc: string; timezone: string }
  | { kind: 'completed' };

export function MichaelSchedulePage() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const loadSlots = useCallback(async () => {
    try {
      const res = await fetch('/api/michael/slots', { credentials: 'include' });
      const data = (await res.json()) as SlotsResponse;
      if (!data.ok) {
        setView({ kind: 'error', message: data.error ?? 'Could not load slots.' });
        return;
      }
      const status = data.status ?? 'awaiting_schedule';
      if (status === 'completed') {
        setView({ kind: 'completed' });
        return;
      }
      if (status === 'in_progress') {
        setView({
          kind: 'in_progress',
          slotStartUtc: data.slotStartUtc ?? '',
          timezone: data.timezone ?? 'UTC',
        });
        return;
      }
      if (status === 'scheduled' && data.slotStartUtc) {
        // We need the matching slot's endUtc; derive from start + 15min.
        const startMs = new Date(data.slotStartUtc).getTime();
        const endIso = new Date(startMs + 15 * 60 * 1000).toISOString();
        setView({
          kind: 'scheduled',
          slotStartUtc: data.slotStartUtc,
          slotEndUtc: endIso,
          timezone: data.timezone ?? 'UTC',
          rescheduleCount: data.rescheduleCount ?? 0,
        });
        return;
      }
      setView({
        kind: 'scheduling',
        slots: data.slots ?? [],
        timezone: data.timezone ?? 'UTC',
        rescheduleCount: data.rescheduleCount ?? 0,
        previousSlotUtc: data.slotStartUtc ?? null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setView({ kind: 'error', message: `Network error: ${msg}` });
    }
  }, []);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const handleBook = useCallback(async () => {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitErr(null);
    try {
      const res = await fetch('/api/michael/book', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotStartUtc: selectedSlot }),
      });
      const data = (await res.json()) as BookResponse;
      if (!data.ok || !data.schedule) {
        setSubmitErr(data.error ?? 'Could not book that slot.');
        return;
      }
      // Refresh view from server truth
      await loadSlots();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setSubmitErr(`Network error: ${msg}`);
    } finally {
      setSubmitting(false);
    }
  }, [selectedSlot, loadSlots]);

  if (view.kind === 'loading') {
    return <FullScreenMessage line='Loading your slots\u2026' />;
  }
  if (view.kind === 'error') {
    return <FullScreenMessage line={view.message} tone='error' />;
  }
  if (view.kind === 'in_progress') {
    return <InProgressView />;
  }
  if (view.kind === 'completed') {
    return <CompletedView onContinue={() => navigate('/cockpit')} />;
  }
  if (view.kind === 'scheduled') {
    return (
      <ScheduledView
        slotStartUtc={view.slotStartUtc}
        slotEndUtc={view.slotEndUtc}
        timezone={view.timezone}
        rescheduleCount={view.rescheduleCount}
        onReschedule={() => {
          // Show the slot grid again. Server enforces the rescheduleCount cap.
          void loadSlots().then(() => {
            setView((prev) =>
              prev.kind === 'scheduled'
                ? {
                    kind: 'scheduling',
                    slots: [],
                    timezone: prev.timezone,
                    rescheduleCount: prev.rescheduleCount,
                    previousSlotUtc: prev.slotStartUtc,
                  }
                : prev,
            );
            // re-fetch fresh slots
            void loadSlots();
          });
        }}
      />
    );
  }

  // SCHEDULING
  return (
    <SchedulingView
      slots={view.slots}
      timezone={view.timezone}
      rescheduleCount={view.rescheduleCount}
      previousSlotUtc={view.previousSlotUtc}
      selectedSlot={selectedSlot}
      onSelect={setSelectedSlot}
      onConfirm={handleBook}
      submitting={submitting}
      submitErr={submitErr}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────────────────

function FullScreenMessage({
  line,
  tone = 'mute',
}: {
  line: string;
  tone?: 'mute' | 'error';
}) {
  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <p
        className={
          tone === 'error'
            ? 'text-[14px] font-mono tracking-[0.14em] text-red-400 uppercase'
            : 'text-[12px] font-mono tracking-[0.18em] text-cream-faint uppercase'
        }
      >
        {line}
      </p>
    </div>
  );
}

function Eyebrow({ text }: { text: string }) {
  return (
    <p className="font-mono tracking-[0.28em] text-[11px] text-gold mb-6 uppercase">
      {text}
    </p>
  );
}

function SchedulingView({
  slots,
  timezone,
  rescheduleCount,
  previousSlotUtc,
  selectedSlot,
  onSelect,
  onConfirm,
  submitting,
  submitErr,
}: {
  slots: SlotOffer[];
  timezone: string;
  rescheduleCount: number;
  previousSlotUtc: string | null;
  selectedSlot: string | null;
  onSelect: (s: string) => void;
  onConfirm: () => void;
  submitting: boolean;
  submitErr: string | null;
}) {
  const grouped = useMemo(() => groupSlotsByDate(slots, timezone), [slots, timezone]);
  const isReschedule = rescheduleCount > 0 || !!previousSlotUtc;

  return (
    <div className="min-h-screen bg-ink text-cream py-16 px-6">
      <div className="max-w-3xl mx-auto">
        <Eyebrow text={isReschedule ? 'Reschedule · Michael Interview' : 'Step 1 of 7 · Michael Interview'} />
        <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-5">
          {isReschedule ? 'Pick a new time.' : 'Schedule your call.'}
        </h1>
        <p className="text-cream-mute text-[16px] leading-[1.6] mb-2 max-w-xl">
          A 15-minute call with Michael. He learns how we can support you best, then your
          sponsor takes it from there.
        </p>
        <p className="text-cream-mute text-[14px] leading-[1.55] mb-10 max-w-xl">
          Times shown in <span className="text-cream">{timezone.replace(/_/g, ' ')}</span>.{' '}
          {isReschedule
            ? 'One reschedule allowed. Pick carefully.'
            : 'Within the next 18 hours, between 8:00 AM and 9:45 PM your time.'}
        </p>

        {slots.length === 0 ? (
          <p className="text-[13px] font-mono tracking-[0.12em] text-cream-faint uppercase">
            No slots currently available. Refresh the page or contact your sponsor.
          </p>
        ) : (
          <div className="space-y-8 mb-10">
            {grouped.map(({ label, day }) => (
              <div key={label}>
                <p className="font-mono tracking-[0.22em] text-[11px] text-gold mb-3 uppercase">
                  {label}
                </p>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                  {day.map((slot) => {
                    const active = selectedSlot === slot.startUtc;
                    return (
                      <button
                        key={slot.startUtc}
                        type="button"
                        onClick={() => onSelect(slot.startUtc)}
                        className={
                          'py-3 px-2 rounded text-[13px] font-mono tracking-[0.04em] transition-colors border ' +
                          (active
                            ? 'bg-gold text-ink border-gold'
                            : 'bg-cream/[0.025] text-cream border-cream/10 hover:border-gold/40')
                        }
                      >
                        {slot.label.replace(/^[A-Za-z]{3} /, '')}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {submitErr && (
          <p className="text-[13px] font-mono tracking-[0.06em] text-red-400 mb-4">{submitErr}</p>
        )}

        <Button
          onClick={onConfirm}
          disabled={!selectedSlot || submitting}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-8 py-6"
        >
          {submitting ? 'Confirming\u2026' : isReschedule ? 'Confirm new time' : 'Confirm my call'}
        </Button>
      </div>
    </div>
  );
}

function ScheduledView({
  slotStartUtc,
  slotEndUtc,
  timezone,
  rescheduleCount,
  onReschedule,
}: {
  slotStartUtc: string;
  slotEndUtc: string;
  timezone: string;
  rescheduleCount: number;
  onReschedule: () => void;
}) {
  const slotLabel = useMemo(() => formatSlotRange(slotStartUtc, slotEndUtc, timezone), [
    slotStartUtc,
    slotEndUtc,
    timezone,
  ]);
  const canReschedule = rescheduleCount < 1;

  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <Eyebrow text='Step 1 of 7 · Confirmed' />
        <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-6">
          You're on the list.
        </h1>
        <div className="bg-cream/[0.025] border border-gold/30 rounded-md py-6 px-6 mb-8">
          <p className="font-mono tracking-[0.18em] text-[11px] text-gold mb-2 uppercase">
            Michael will call you
          </p>
          <p className="font-display text-[28px] text-cream leading-tight">{slotLabel}</p>
          <p className="text-[12px] font-mono tracking-[0.06em] text-cream-mute mt-3">
            {timezone.replace(/_/g, ' ')}
          </p>
        </div>
        <p className="text-cream-mute text-[15px] leading-[1.6] mb-8">
          The rest of your tools unlock the moment the call wraps. Until then, your Launch
          Center keeps the next step in front of you.
        </p>
        <div className="flex gap-3 justify-center">
          <Button
            className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[14px] px-6 py-5"
            onClick={() => (window.location.href = '/cockpit')}
          >
            Open Launch Center
          </Button>
          {canReschedule && (
            <Button
              variant="outline"
              className="border-cream/20 text-cream hover:bg-cream/[0.05] font-mono tracking-[0.04em] text-[13px] px-6 py-5"
              onClick={onReschedule}
            >
              Reschedule (1 left)
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function InProgressView() {
  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <div className="max-w-lg text-center">
        <Eyebrow text='Step 1 of 7 · In Progress' />
        <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-6">
          Michael is on the line.
        </h1>
        <div className="inline-flex items-center gap-3 mb-8">
          <span className="h-2 w-2 rounded-full bg-teal animate-pulse" />
          <p className="font-mono tracking-[0.18em] text-[11px] text-teal uppercase">
            Live call in progress
          </p>
        </div>
        <p className="text-cream-mute text-[15px] leading-[1.6]">
          You're on the call right now. This page will update when the conversation wraps.
        </p>
      </div>
    </div>
  );
}

function CompletedView({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <Eyebrow text='Step 1 of 7 · Complete' />
        <h1 className="font-display text-[clamp(40px,7vw,72px)] leading-[0.95] text-cream mb-6">
          Welcome aboard.
        </h1>
        <p className="text-cream-mute text-[16px] leading-[1.6] mb-10">
          Michael captured your context. Your sponsor will see the highlights in their cockpit.
          Your Launch Center is open and will show the next right action.
        </p>
        <Button
          onClick={onContinue}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[16px] px-8 py-6"
        >
          Open Launch Center
        </Button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────────
// Helpers (pure)
// ─────────────────────────────────────────────────────────────────────────────────────

interface DayGroup {
  label: string;       // e.g. "Tue, May 19"
  day: SlotOffer[];
}

function groupSlotsByDate(slots: SlotOffer[], timezone: string): DayGroup[] {
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const out: DayGroup[] = [];
  let current: DayGroup | null = null;
  for (const s of slots) {
    const label = dayFmt.format(new Date(s.startUtc));
    if (!current || current.label !== label) {
      current = { label, day: [] };
      out.push(current);
    }
    current.day.push(s);
  }
  return out;
}

function formatSlotRange(startUtc: string, endUtc: string, timezone: string): string {
  const start = new Date(startUtc);
  const end = new Date(endUtc);
  const dayFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const timeFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dayFmt.format(start)} · ${timeFmt.format(start)} – ${timeFmt.format(end)}`;
}
