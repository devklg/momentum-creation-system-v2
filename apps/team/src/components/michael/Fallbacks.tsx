/**
 * wf_0041 — Fallback states for the Michael interview surface.
 *
 *   - NoAnswerView      : Telnyx call.hangup before call.answered (no-answer,
 *                        busy, declined). BA can reschedule once if the
 *                        schedule's rescheduleCount is < 1.
 *   - InvalidNumberView : Telnyx flagged the destination as invalid. The BA
 *                        must update their phone via /profile (placeholder
 *                        link — profile editing is wireframe §3.8, still
 *                        pending). For now we point at /cockpit.
 *   - SttFailedView     : Call completed but the STT pipeline failed. The
 *                        audio recording is offered as fallback if present.
 *
 * Page-close-resume is handled by the parent route, which re-fetches /state
 * on mount and renders whichever phase is current.
 */

import { useNavigate } from 'react-router-dom';

interface BaseProps {
  children?: React.ReactNode;
}

function FallbackShell({
  pill,
  title,
  body,
  children,
}: BaseProps & { pill: { text: string; tone: 'gold' | 'red' | 'teal' }; title: string; body: string }) {
  const pillBg =
    pill.tone === 'gold'
      ? 'bg-gold/15 border-gold/40 text-gold'
      : pill.tone === 'teal'
        ? 'bg-teal/15 border-teal/40 text-teal'
        : 'bg-red-500/15 border-red-500/40 text-red-400';
  return (
    <div className="min-h-screen bg-ink text-cream flex items-center justify-center px-6">
      <div className="max-w-xl text-center">
        <span
          className={
            'inline-flex items-center gap-2.5 rounded-full border px-4 py-1.5 mb-8 font-mono tracking-[0.22em] text-[11px] uppercase ' +
            pillBg
          }
        >
          {pill.text}
        </span>
        <h1 className="font-display text-[clamp(36px,6vw,64px)] leading-[0.95] text-cream mb-5">
          {title}
        </h1>
        <p className="text-cream-mute text-[15px] leading-[1.6] mb-8">{body}</p>
        {children}
      </div>
    </div>
  );
}

export function NoAnswerView({ canReschedule }: { canReschedule: boolean }) {
  const navigate = useNavigate();
  return (
    <FallbackShell
      pill={{ text: 'No answer', tone: 'gold' }}
      title="Michael couldn't reach you."
      body={
        canReschedule
          ? 'Pick a new time and we’ll try again. One reschedule available.'
          : 'You’ve already used your reschedule. Reach out to your sponsor and they’ll help.'
      }
    >
      {canReschedule && (
        <button
          type="button"
          onClick={() => navigate('/michael/schedule')}
          className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-7 py-3.5 rounded transition-colors"
        >
          Pick a new time
        </button>
      )}
    </FallbackShell>
  );
}

export function InvalidNumberView() {
  const navigate = useNavigate();
  return (
    <FallbackShell
      pill={{ text: 'Number unreachable', tone: 'red' }}
      title="That number didn't go through."
      body="Update your phone number — Michael will call as soon as the new number is on file."
    >
      <button
        type="button"
        onClick={() => navigate('/cockpit')}
        className="bg-gold text-ink hover:bg-gold-bright font-display tracking-[0.06em] text-[15px] px-7 py-3.5 rounded transition-colors"
      >
        Update phone
      </button>
    </FallbackShell>
  );
}

export function SttFailedView({ audioUrl }: { audioUrl: string | null }) {
  return (
    <FallbackShell
      pill={{ text: 'Transcript unavailable', tone: 'teal' }}
      title="The call wrapped — the transcript didn't."
      body="The conversation came through fine on the line, but the transcript pipeline tripped on this one. The recording is below; your sponsor will follow up."
    >
      {audioUrl ? (
        <audio
          controls
          src={audioUrl}
          className="w-full mt-2"
        >
          Your browser doesn't support the audio element.
        </audio>
      ) : (
        <p className="font-mono tracking-[0.12em] text-[11px] text-cream-faint uppercase">
          Recording not yet available.
        </p>
      )}
    </FallbackShell>
  );
}
