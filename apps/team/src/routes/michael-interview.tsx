/**
 * /michael/interview — wireframe §3.2 leaves wf_0038/0039/0040/0041.
 *
 * Three-state interview surface (plus fallbacks). Reads /api/michael/interview/state
 * on mount and re-fetches when the SSE stream signals a phase advance. The
 * page-close-resume case is satisfied implicitly: a returning visit re-reads
 * state from the server, which is authoritative.
 *
 * State 1 (wf_0038) → AwaitingCall      : awaiting the outbound dial
 * State 2 (wf_0039) → CallInProgress    : SSE-driven live transcript
 * State 3 (wf_0040) → CallComplete      : artifact + Fast Start CTA
 * Fallbacks (wf_0041)                   : no-answer / invalid-number / STT-fail
 *
 * This page is reachable BEFORE the Michael gate opens — by design, since
 * being on this page IS how the gate opens.
 */

import { useCallback, useEffect, useState } from 'react';
import { AwaitingCall } from '../components/michael/AwaitingCall';
import { CallInProgress } from '../components/michael/CallInProgress';
import { CallComplete } from '../components/michael/CallComplete';
import {
  InvalidNumberView,
  NoAnswerView,
  SttFailedView,
} from '../components/michael/Fallbacks';
import type {
  MichaelInterviewPhase,
  MichaelInterviewView,
} from '../components/michael/_wire';

type FetchState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'no_schedule' }
  | { kind: 'ready'; view: MichaelInterviewView; canReschedule: boolean };

export function MichaelInterviewPage() {
  const [state, setState] = useState<FetchState>({ kind: 'loading' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/michael/interview/state', {
        credentials: 'include',
      });
      if (res.status === 404) {
        setState({ kind: 'no_schedule' });
        return;
      }
      const data = (await res.json()) as {
        ok: boolean;
        view?: MichaelInterviewView;
        error?: string;
      };
      if (!data.ok || !data.view) {
        setState({ kind: 'error', message: data.error ?? 'Could not load interview state.' });
        return;
      }
      // Reschedule eligibility is on the schedule, not the interview view —
      // fetch /status alongside. We optimistically allow once when phase is
      // no_answer; the schedule route returns 400 with NO_RESCHEDULES_LEFT
      // if the cap is hit, which the no-answer view handles.
      let canReschedule = true;
      if (data.view.phase === 'no_answer') {
        try {
          const statusRes = await fetch('/api/michael/status', { credentials: 'include' });
          const statusData = (await statusRes.json()) as {
            ok: boolean;
            schedule?: { rescheduleCount?: number };
          };
          canReschedule = (statusData.schedule?.rescheduleCount ?? 0) < 1;
        } catch {
          canReschedule = true;
        }
      }
      setState({ kind: 'ready', view: data.view, canReschedule });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      setState({ kind: 'error', message: `Network error: ${msg}` });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The CallInProgress component watches its own SSE stream and tells us when
  // the phase advances; we re-fetch authoritative state on any change.
  const handlePhaseAdvance = useCallback(
    (next: MichaelInterviewPhase) => {
      void next; // we don't trust the live signal; re-fetch the artifact
      void load();
    },
    [load],
  );

  const handleWrongNumberFlagged = useCallback((at: string) => {
    setState((prev) =>
      prev.kind === 'ready'
        ? {
            ...prev,
            view: { ...prev.view, wrongNumberFlaggedAt: at },
          }
        : prev,
    );
  }, []);

  if (state.kind === 'loading') {
    return <CenterMessage line="Loading…" />;
  }
  if (state.kind === 'error') {
    return <CenterMessage line={state.message} tone="error" />;
  }
  if (state.kind === 'no_schedule') {
    return (
      <CenterMessage
        line="No Michael interview is scheduled yet. Visit /michael/schedule to pick a time."
      />
    );
  }

  const { view, canReschedule } = state;

  switch (view.phase) {
    case 'awaiting_call':
      return (
        <AwaitingCall
          scheduledFor={view.scheduledFor}
          timezone={view.timezone}
          wrongNumberFlaggedAt={view.wrongNumberFlaggedAt}
          onWrongNumberFlagged={handleWrongNumberFlagged}
        />
      );
    case 'call_in_progress':
      return (
        <CallInProgress
          initialTranscript={view.transcript}
          onPhaseAdvance={handlePhaseAdvance}
        />
      );
    case 'complete':
      if (!view.artifact) {
        return <CenterMessage line="Interview complete — loading your readback…" />;
      }
      return <CallComplete artifact={view.artifact} />;
    case 'no_answer':
      return <NoAnswerView canReschedule={canReschedule} />;
    case 'invalid_number':
      return <InvalidNumberView />;
    case 'stt_failed':
      return <SttFailedView audioUrl={view.artifact?.audioUrl ?? null} />;
    default:
      return <CenterMessage line="Unknown interview phase." tone="error" />;
  }
}

function CenterMessage({
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
            ? 'text-[14px] font-mono tracking-[0.14em] text-red-400 uppercase max-w-xl text-center'
            : 'text-[12px] font-mono tracking-[0.18em] text-cream-faint uppercase max-w-xl text-center'
        }
      >
        {line}
      </p>
    </div>
  );
}
