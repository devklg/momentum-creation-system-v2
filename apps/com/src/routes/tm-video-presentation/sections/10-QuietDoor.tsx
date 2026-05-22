/**
 * tm-video-presentation / Section 10 — The Quiet Door
 *
 * Locked Chat #109. Replaces the Chat #107 placeholder.
 *
 * Two soft-CTA radios:
 *   • I'm interested — tell me more
 *   • I have questions
 *
 * No phone field, no best-time field. The BA already has the prospect's
 * contact information — collecting it again would imply the system
 * doesn't trust the BA-prospect relationship that earned the invite.
 *
 * The harder "I'm ready to join" intent is intentionally absent. At this
 * point the prospect has only seen the video; the team forming around
 * them is on the post-video dashboard (Section 6 of tm-prospect-
 * dashboard, future build). "Ready to join" belongs there, after they've
 * seen the team.
 *
 * Submit fires POST /api/p/:token/callback-request. Server triple-stack
 * persists the record and best-effort fires Telnyx SMS to the BA. The
 * page transitions to a confirmation state regardless of SMS outcome —
 * the prospect's submission landed; the BA cockpit alert is the
 * canonical surface for the raised hand.
 *
 * Compliance:
 *   • No income, no comp, no placement promises.
 *   • Does NOT promise the prospect is in any binary line.
 *   • Names the inviting BA per locked-spec Part 3.9 personalization rule.
 *   • Confirmation reads "[BA First Name] will reach out to you soon." —
 *     factually neutral; does not promise timing, outcome, or any
 *     compensation-adjacent commitment.
 */

import { useState } from 'react';
import type { CallbackIntent } from '@momentum/shared';
import { postCallbackRequest } from '../../../lib/api';

export interface QuietDoorProps {
  token: string;
  baFirstName: string;
}

type SubmissionState =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'submitted'; intent: CallbackIntent }
  | { kind: 'error'; message: string };

const OPTIONS: ReadonlyArray<{ value: CallbackIntent; label: string }> = [
  { value: 'interested_tell_me_more', label: "I'm interested \u2014 tell me more" },
  { value: 'have_questions', label: 'I have questions' },
];

export function QuietDoor({ token, baFirstName }: QuietDoorProps) {
  const [intent, setIntent] = useState<CallbackIntent | null>(null);
  const [submission, setSubmission] = useState<SubmissionState>({ kind: 'idle' });

  const submitting = submission.kind === 'submitting';
  const disabled = !intent || submitting;

  async function handleSubmit() {
    if (!intent) return;
    setSubmission({ kind: 'submitting' });
    const result = await postCallbackRequest(token, intent);
    if (result.ok) {
      setSubmission({ kind: 'submitted', intent });
    } else {
      const message =
        result.error.kind === 'expired'
          ? 'This link has expired. Please ask for a fresh one.'
          : result.error.kind === 'invalid_token'
            ? 'This link is no longer valid. Please ask for a fresh one.'
            : result.error.kind === 'enrolled'
              ? 'Your account is already active. No need to request a callback.'
              : 'Something went wrong. Please try again in a moment.';
      setSubmission({ kind: 'error', message });
    }
  }

  if (submission.kind === 'submitted') {
    return (
      <section className="tm-quiet" aria-label="The Quiet Door \u2014 submitted">
        <div className="tm-quiet__inner">
          <div className="tm-quiet__eyebrow">Part 7 \u2014 What's Next</div>
          <div className="tm-quiet__card tm-quiet__card--confirmed">
            <div className="tm-quiet__keyline" aria-hidden="true" />
            <h2 className="tm-quiet__headline">
              {baFirstName} will reach out to you soon.
            </h2>
            <p className="tm-quiet__body">
              Your message just landed. Expect to hear from {baFirstName}{' '}
              shortly, the way you two already communicate.
            </p>
            <div className="tm-quiet__rule" aria-hidden="true" />
          </div>
        </div>
        <style>{styles}</style>
      </section>
    );
  }

  return (
    <section className="tm-quiet" aria-label="The Quiet Door">
      <div className="tm-quiet__inner">
        <div className="tm-quiet__eyebrow">Part 7 \u2014 What's Next</div>

        <div className="tm-quiet__card">
          <div className="tm-quiet__keyline" aria-hidden="true" />

          <h2 className="tm-quiet__headline">
            Want {baFirstName} to reach out?
          </h2>

          <p className="tm-quiet__body">
            No form to fill out. No phone number to enter. Pick the option
            that fits, and {baFirstName} will be in touch.
          </p>

          <fieldset className="tm-quiet__fieldset" disabled={submitting}>
            <legend className="tm-quiet__legend">How can {baFirstName} help?</legend>
            <div className="tm-quiet__radios">
              {OPTIONS.map((opt) => {
                const checked = intent === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={
                      'tm-quiet__radio' + (checked ? ' tm-quiet__radio--checked' : '')
                    }
                  >
                    <input
                      type="radio"
                      name="tm-quiet-intent"
                      value={opt.value}
                      checked={checked}
                      onChange={() => setIntent(opt.value)}
                    />
                    <span className="tm-quiet__radio-label">{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button
            type="button"
            className="tm-quiet__submit"
            onClick={handleSubmit}
            disabled={disabled}
          >
            {submitting ? 'Sending\u2026' : `Have ${baFirstName} reach out`}
          </button>

          {submission.kind === 'error' && (
            <p className="tm-quiet__error" role="alert">
              {submission.message}
            </p>
          )}

          <div className="tm-quiet__rule" aria-hidden="true" />
        </div>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-quiet {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-quiet__inner {
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 28px);
  }
  .tm-quiet__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }

  .tm-quiet__card {
    width: 100%;
    background: #131312;
    border: 1px solid rgba(201, 168, 76, 0.32);
    border-radius: 4px;
    padding: clamp(32px, 4vw, 56px) clamp(24px, 3.5vw, 48px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(14px, 2vw, 22px);
    position: relative;
    box-shadow:
      0 0 0 1px rgba(201, 168, 76, 0.08),
      0 24px 64px -16px rgba(0, 0, 0, 0.55);
  }
  .tm-quiet__card--confirmed {
    border-color: rgba(45, 212, 191, 0.42);
    box-shadow:
      0 0 0 1px rgba(45, 212, 191, 0.12),
      0 24px 64px -16px rgba(0, 0, 0, 0.55);
  }
  .tm-quiet__keyline {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 64px;
    height: 2px;
    background: linear-gradient(90deg,
      transparent 0%,
      #C9A84C 50%,
      transparent 100%);
  }
  .tm-quiet__card--confirmed .tm-quiet__keyline {
    background: linear-gradient(90deg,
      transparent 0%,
      #2DD4BF 50%,
      transparent 100%);
  }

  .tm-quiet__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(32px, 4.8vw, 56px);
    line-height: 1.05;
    letter-spacing: 0.005em;
    color: #F5EFE6;
    margin: 0;
    max-width: 22ch;
  }
  .tm-quiet__body {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(16px, 1.3vw, 19px);
    line-height: 1.6;
    color: rgba(245, 239, 230, 0.86);
    margin: 0;
    max-width: 56ch;
  }

  /* ---- form ---- */
  .tm-quiet__fieldset {
    border: none;
    padding: 0;
    margin: clamp(6px, 1vw, 10px) 0 0;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tm-quiet__fieldset[disabled] {
    opacity: 0.65;
  }
  .tm-quiet__legend {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
    margin-bottom: 4px;
    text-align: center;
    width: 100%;
  }
  .tm-quiet__radios {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tm-quiet__radio {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 16px 20px;
    background: rgba(10, 10, 10, 0.5);
    border: 1px solid rgba(245, 239, 230, 0.12);
    border-radius: 4px;
    cursor: pointer;
    transition: border-color 160ms ease, background-color 160ms ease;
    text-align: left;
  }
  .tm-quiet__radio:hover {
    border-color: rgba(201, 168, 76, 0.45);
  }
  .tm-quiet__radio--checked {
    border-color: #C9A84C;
    background: rgba(201, 168, 76, 0.08);
  }
  .tm-quiet__radio input {
    appearance: none;
    -webkit-appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.5px solid rgba(245, 239, 230, 0.4);
    background: transparent;
    margin: 0;
    flex-shrink: 0;
    position: relative;
    cursor: pointer;
    transition: border-color 160ms ease;
  }
  .tm-quiet__radio input:checked {
    border-color: #C9A84C;
  }
  .tm-quiet__radio input:checked::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: #F5C030;
    box-shadow: 0 0 8px rgba(245, 192, 48, 0.6);
  }
  .tm-quiet__radio-label {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.15vw, 17px);
    line-height: 1.4;
    color: #F5EFE6;
  }

  .tm-quiet__submit {
    margin-top: clamp(6px, 1vw, 10px);
    padding: 14px 32px;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 13px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    background: linear-gradient(180deg, #C9A84C 0%, #B89339 100%);
    color: #0A0A0A;
    border: 1px solid #C9A84C;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 200ms ease, filter 200ms ease;
    box-shadow: 0 8px 24px -8px rgba(201, 168, 76, 0.5);
  }
  .tm-quiet__submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 32px -10px rgba(201, 168, 76, 0.6);
    filter: brightness(1.05);
  }
  .tm-quiet__submit:disabled {
    cursor: not-allowed;
    opacity: 0.55;
    box-shadow: none;
  }

  .tm-quiet__error {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.5;
    color: rgba(245, 239, 230, 0.82);
    background: rgba(245, 100, 100, 0.08);
    border: 1px solid rgba(245, 100, 100, 0.32);
    border-radius: 4px;
    padding: 12px 16px;
    margin: 0;
    max-width: 480px;
  }

  .tm-quiet__rule {
    width: 48px;
    height: 1px;
    background: rgba(201, 168, 76, 0.45);
    margin-top: 8px;
  }
  .tm-quiet__card--confirmed .tm-quiet__rule {
    background: rgba(45, 212, 191, 0.45);
  }
  .tm-quiet__footnote {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.5);
  }
`;

export default QuietDoor;
