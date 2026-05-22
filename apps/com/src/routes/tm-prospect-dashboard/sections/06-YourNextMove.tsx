/**
 * Section 6 — Your Next Move. The post-video CTA section.
 *
 * Two CTAs side-by-side (single column on mobile):
 *   1. Callback request — three intent radios (interested / ready to
 *      join / questions) + phone + best-time. Submits to
 *      POST /api/p/:token/callback-request. Third intent
 *      'ready_to_join' is the dashboard's exclusive (Chat #109 +
 *      Chat #114 lock); it does NOT appear on the pre-video Section 10.
 *   2. Webinar reservation — countdown to next event + name/email
 *      reservation form. Submits to POST /api/p/:token/webinar-reserve.
 *      Email-to-prospect delivery waits on locked-spec Part 5 email
 *      provider decision; the BA always gets a Telnyx SMS alert.
 *
 * Compliance (locked-spec 3.10):
 *   - The webinar copy names hosts (Kevin + Paul — locked-spec 1.14).
 *   - The cadence wording ("weekly Tuesday 7pm PT" vs "every 72 hours")
 *     is still-open per Part 5. Until decided, copy here says "the
 *     next Team Magnificent live" without claiming cadence.
 */

import { useEffect, useState } from 'react';
import type { CallbackIntent } from '@momentum/shared';
import { postCallbackRequest, postWebinarReservation } from '@/lib/api';

export interface YourNextMoveSectionProps {
  token: string;
  baFullName: string;
  baFirstName: string;
  /**
   * Next upcoming webinar event resolved server-side at /api/p/:token.
   * Null when no upcoming event is seeded. Drives the live ticking
   * countdown in the webinar card; null falls back to a static
   * "check back soon" surface. Chat #115.
   */
  nextEvent: {
    eventId: string;
    scheduledFor: string;
    hosts: string[];
  } | null;
}

export function YourNextMoveSection(props: YourNextMoveSectionProps) {
  return (
    <>
      <section className="tmpd-nextmove">
        <div className="eyebrow">Your next move</div>
        <h2>Let&rsquo;s have a real conversation about this unfolding new opportunity.</h2>
        <p className="tmpd-nextmove-lead">
          Two ways to take the next step — a personal call with{' '}
          {props.baFirstName}, or the next live team event. Both lead to the
          same place: two humans, an honest conversation, real context for
          your decision.
        </p>

        <div className="tmpd-nextmove-grid">
          <CallbackCard
            token={props.token}
            baFullName={props.baFullName}
            baFirstName={props.baFirstName}
          />
          <WebinarCard token={props.token} nextEvent={props.nextEvent} />
        </div>
      </section>
      <style>{nextmoveCss}</style>
    </>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Callback card — three intent radios + submit (no phone/best-time
 * inputs collected here; the BA has the prospect's contact info per
 * Chat #109 lock).
 * ───────────────────────────────────────────────────────────────── */
function CallbackCard(props: { token: string; baFullName: string; baFirstName: string }) {
  const [intent, setIntent] = useState<CallbackIntent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!intent || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await postCallbackRequest(props.token, intent);
    setSubmitting(false);
    if (result.ok) {
      setSubmitted(true);
    } else if (result.error.kind === 'enrolled') {
      setError("You're already enrolled — your sponsor will be in touch.");
    } else if (result.error.kind === 'expired') {
      setError('This invitation has expired — ask your sponsor for a fresh one.');
    } else {
      setError('Something went wrong. Please try again.');
    }
  };

  if (submitted) {
    return (
      <div className="tmpd-cta tmpd-cta-primary">
        <div className="tmpd-cta-tag tmpd-cta-tag-gold">You&rsquo;re on the list</div>
        <h3>
          <span className="tmpd-cta-accent-gold">{props.baFirstName}</span>{' '}
          will reach out personally.
        </h3>
        <p>
          Your request landed. {props.baFirstName} got the alert and will be
          in touch — keep an eye on the number you got the invite from.
        </p>
      </div>
    );
  }

  return (
    <div className="tmpd-cta tmpd-cta-primary">
      <div className="tmpd-cta-tag tmpd-cta-tag-gold">A real conversation with {props.baFirstName}</div>
      <h3>
        I&rsquo;m ready to talk with{' '}
        <span className="tmpd-cta-accent-gold">{props.baFullName}</span>.
      </h3>
      <p>
        This is where it gets human. {props.baFirstName} will reach out
        personally to understand where you are and what this opportunity could
        mean for your future.
      </p>

      <div className="tmpd-reasons">
        <ReasonRadio
          checked={intent === 'interested_tell_me_more'}
          onChange={() => setIntent('interested_tell_me_more')}
          label="I'm interested — I want to understand more."
        />
        <ReasonRadio
          checked={intent === 'ready_to_join'}
          onChange={() => setIntent('ready_to_join')}
          label="I'm ready to join Team Magnificent."
        />
        <ReasonRadio
          checked={intent === 'have_questions'}
          onChange={() => setIntent('have_questions')}
          label="I have specific questions to work through."
        />
      </div>

      {error && <div className="tmpd-error">{error}</div>}

      <button
        className="tmpd-submit tmpd-submit-gold"
        onClick={() => void onSubmit()}
        disabled={!intent || submitting}
      >
        {submitting ? 'Sending\u2026' : `Yes — let's talk`}
      </button>
    </div>
  );
}

function ReasonRadio(props: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label className={`tmpd-reason ${props.checked ? 'tmpd-reason-checked' : ''}`}>
      <input
        type="radio"
        name="callback-intent"
        checked={props.checked}
        onChange={props.onChange}
      />
      <span>{props.label}</span>
    </label>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Webinar card — countdown + name/email reservation. Reservation
 * captures real; email-to-prospect is deferred per Part 5 email
 * provider open question. BA gets SMS regardless.
 * ───────────────────────────────────────────────────────────────── */
function WebinarCard(props: {
  token: string;
  nextEvent: YourNextMoveSectionProps['nextEvent'];
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    baFirstName: string;
    scheduledFor: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await postWebinarReservation(props.token, { name, email });
    setSubmitting(false);
    if (result.ok) {
      setConfirmation({
        baFirstName: result.data.baFirstName,
        scheduledFor: result.data.scheduledFor,
      });
    } else if (result.error.kind === 'invalid_email') {
      setError("That doesn't look like a valid email address.");
    } else if (result.error.kind === 'invalid_name') {
      setError('Please enter your name.');
    } else if (result.error.kind === 'no_upcoming_event') {
      setError("There's no upcoming event scheduled right now. Your sponsor can let you know when the next one is.");
    } else if (result.error.kind === 'expired') {
      setError('This invitation has expired — ask your sponsor for a fresh one.');
    } else {
      setError('Something went wrong. Please try again.');
    }
  };

  if (confirmation) {
    return (
      <div className="tmpd-cta tmpd-cta-secondary">
        <div className="tmpd-cta-tag tmpd-cta-tag-teal">Reserved</div>
        <h3>
          You&rsquo;re on the list for the next{' '}
          <span className="tmpd-cta-accent-teal">live event</span>.
        </h3>
        <p>
          <span className="tmpd-cta-accent-teal">{confirmation.baFirstName}</span>{' '}
          will follow up with the Zoom link before it starts.
        </p>
        <p className="tmpd-event-when">{formatEventWhen(confirmation.scheduledFor)}</p>
      </div>
    );
  }

  return (
    <div className="tmpd-cta tmpd-cta-secondary">
      <div className="tmpd-cta-tag tmpd-cta-tag-teal">Join us live</div>
      <h3>
        The next Team Magnificent <span className="tmpd-cta-accent-teal">live</span>.
      </h3>
      <Countdown scheduledFor={props.nextEvent?.scheduledFor ?? null} />
      <p className="tmpd-event-hosts">
        Hosted by Kevin L. Gardner and Paul Barrios. Open conversation, real
        team, real momentum — see for yourself.
      </p>

      <div className="tmpd-formrow">
        <div className="tmpd-field">
          <label className="tmpd-field-label">Name</label>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="tmpd-field">
          <label className="tmpd-field-label">Email</label>
          <input
            type="email"
            placeholder="Where to send the link"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="tmpd-error">{error}</div>}

      <button
        className="tmpd-submit tmpd-submit-teal"
        onClick={() => void onSubmit()}
        disabled={!name.trim() || !email.trim() || submitting}
      >
        {submitting ? 'Reserving\u2026' : 'Reserve my seat'}
      </button>
    </div>
  );
}

/**
 * Live countdown to the next event. scheduledFor is resolved server-side
 * at /api/p/:token and threaded down through the dashboard composer
 * (Chat #115). When null — because no event is currently seeded in
 * webinar_events — the component renders a static fallback so the
 * section degrades gracefully without breaking the visual layout.
 *
 * Ticks once per second. Cleans up its interval on unmount and when
 * the event has passed (the countdown freezes at "happening now" once
 * the time is in the past; the server will not return a past event on
 * the next render because findNextUpcomingEvent filters by
 * scheduledFor > now, so the page will pick up the next event on the
 * next visit).
 */
function Countdown(props: { scheduledFor: string | null }) {
  const { scheduledFor } = props;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!scheduledFor) return;
    const target = new Date(scheduledFor).getTime();
    if (!Number.isFinite(target)) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [scheduledFor]);

  if (!scheduledFor) {
    return (
      <div className="tmpd-event-when">
        The next live event · hosted by Kevin &amp; Paul
      </div>
    );
  }

  const target = new Date(scheduledFor).getTime();
  if (!Number.isFinite(target)) {
    return (
      <div className="tmpd-event-when">
        The next live event · hosted by Kevin &amp; Paul
      </div>
    );
  }

  const remainingMs = Math.max(0, target - now);
  const totalSeconds = Math.floor(remainingMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Happening-now state — freeze at zeros and surface the live framing.
  if (remainingMs === 0) {
    return (
      <div className="tmpd-countdown tmpd-countdown-live">
        <div className="tmpd-countdown-live-tag">Happening now</div>
        <div className="tmpd-event-when">{formatEventWhen(scheduledFor)}</div>
      </div>
    );
  }

  return (
    <div className="tmpd-countdown" aria-live="polite" aria-label="Countdown to next live event">
      <div className="tmpd-countdown-grid">
        <CountdownUnit value={days} label="days" />
        <CountdownUnit value={hours} label="hours" />
        <CountdownUnit value={minutes} label="min" />
        <CountdownUnit value={seconds} label="sec" />
      </div>
      <div className="tmpd-event-when">{formatEventWhen(scheduledFor)}</div>
    </div>
  );
}

function CountdownUnit(props: { value: number; label: string }) {
  const padded = props.value < 10 ? `0${props.value}` : `${props.value}`;
  return (
    <div className="tmpd-countdown-unit">
      <div className="tmpd-countdown-value">{padded}</div>
      <div className="tmpd-countdown-label">{props.label}</div>
    </div>
  );
}

function formatEventWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return '';
  }
}

const nextmoveCss = `
  .tmpd-nextmove {
    background: #0F0F0F;
    padding-bottom: clamp(56px, 8vw, 110px) !important;
  }
  .tmpd-nextmove h2 {
    color: #F5EFE6;
    margin-top: 14px;
    margin-bottom: 12px;
    max-width: 18ch;
  }
  .tmpd-nextmove-lead {
    font-size: clamp(17px, 1.7vw, 19px);
    color: rgba(245, 239, 230, 0.62);
    max-width: 56ch;
    margin-bottom: 48px;
  }
  .tmpd-nextmove-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
  @media (max-width: 820px) {
    .tmpd-nextmove-grid { grid-template-columns: 1fr; }
  }
  .tmpd-cta {
    border: 1px solid rgba(201, 168, 76, 0.18);
    padding: clamp(28px, 4vw, 40px);
    background: #0A0A0A;
    position: relative;
    overflow: hidden;
    transition: border-color 0.4s, transform 0.4s;
  }
  .tmpd-cta:hover { border-color: #C9A84C; transform: translateY(-2px); }
  .tmpd-cta-primary { border-color: #C9A84C; }
  .tmpd-cta-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(500px circle at 100% 0%, rgba(201, 168, 76, 0.12), transparent 60%);
    pointer-events: none;
  }
  .tmpd-cta-tag {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    margin-bottom: 18px;
    position: relative;
  }
  .tmpd-cta-tag-gold { color: #C9A84C; }
  .tmpd-cta-tag-teal { color: #2DD4BF; }
  .tmpd-cta h3 {
    color: #F5EFE6;
    margin-bottom: 18px;
    line-height: 1.05;
    position: relative;
  }
  .tmpd-cta-accent-gold { color: #F5C030; }
  .tmpd-cta-accent-teal { color: #2DD4BF; }
  .tmpd-cta p {
    color: rgba(245, 239, 230, 0.62);
    font-size: 15px;
    margin-bottom: 24px;
    line-height: 1.55;
    position: relative;
  }
  .tmpd-reasons {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 24px;
    position: relative;
  }
  .tmpd-reason {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid rgba(201, 168, 76, 0.18);
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.25s;
    font-size: 14px;
    color: #F5EFE6;
  }
  .tmpd-reason:hover { border-color: #C9A84C; background: rgba(201, 168, 76, 0.08); }
  .tmpd-reason-checked { border-color: #C9A84C; background: rgba(201, 168, 76, 0.12); }
  .tmpd-reason input { accent-color: #C9A84C; width: 16px; height: 16px; }
  .tmpd-formrow {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 18px;
    position: relative;
  }
  @media (max-width: 480px) {
    .tmpd-formrow { grid-template-columns: 1fr; }
  }
  .tmpd-field input {
    width: 100%;
    background: #0F0F0F;
    border: 1px solid rgba(201, 168, 76, 0.18);
    color: #F5EFE6;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14px;
    padding: 12px 14px;
    border-radius: 4px;
    outline: none;
    transition: border-color 0.2s;
  }
  .tmpd-field input:focus { border-color: #C9A84C; }
  .tmpd-field input::placeholder { color: rgba(245, 239, 230, 0.48); }
  .tmpd-field-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.48);
    margin-bottom: 6px;
    display: block;
  }
  .tmpd-submit {
    width: 100%;
    color: #0A0A0A;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: 0.06em;
    padding: 18px 24px;
    border: none;
    cursor: pointer;
    transition: background 0.2s, transform 0.2s;
    text-transform: uppercase;
    position: relative;
  }
  .tmpd-submit:disabled { opacity: 0.4; cursor: not-allowed; }
  .tmpd-submit-gold { background: #C9A84C; }
  .tmpd-submit-gold:hover:not(:disabled) { background: #F5C030; transform: scale(1.01); }
  .tmpd-submit-teal { background: #2DD4BF; }
  .tmpd-submit-teal:hover:not(:disabled) { background: #5BE5D2; transform: scale(1.01); }
  .tmpd-error {
    margin-bottom: 16px;
    padding: 12px 16px;
    border: 1px solid rgba(245, 192, 48, 0.4);
    background: rgba(245, 192, 48, 0.08);
    color: #F5C030;
    font-size: 13px;
    border-radius: 4px;
  }
  .tmpd-event-when {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 12px;
    color: #C9A84C;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .tmpd-event-hosts {
    font-size: 13px;
    color: rgba(245, 239, 230, 0.62);
    margin-bottom: 18px;
  }
  /* ---- Countdown (Chat #115) ----------------------------------- */
  .tmpd-countdown {
    margin-bottom: 18px;
    position: relative;
  }
  .tmpd-countdown-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin-bottom: 12px;
  }
  .tmpd-countdown-unit {
    text-align: center;
    background: rgba(45, 212, 191, 0.06);
    border: 1px solid rgba(45, 212, 191, 0.24);
    padding: 14px 8px 10px;
    border-radius: 4px;
  }
  .tmpd-countdown-value {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(28px, 4vw, 40px);
    color: #2DD4BF;
    line-height: 1;
    letter-spacing: 0.04em;
    font-variant-numeric: tabular-nums;
  }
  .tmpd-countdown-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.58);
    margin-top: 6px;
  }
  .tmpd-countdown-live {
    margin-bottom: 18px;
  }
  .tmpd-countdown-live-tag {
    display: inline-block;
    background: #2DD4BF;
    color: #0A0A0A;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    padding: 6px 12px;
    border-radius: 4px;
    margin-bottom: 10px;
    animation: tmpd-pulse 2s infinite;
  }
`;
