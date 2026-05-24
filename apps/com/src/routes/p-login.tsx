/**
 * /p/login — prospect re-entry phone-entry surface (locked-spec 3.17).
 *
 * Layer 3 of the prospect re-entry build (Chat #131).
 *
 * The prospect enters their phone number; the server fans out one
 * SMS magic link per matched active account (multi-token edge case
 * per 3.17) and returns the same opaque success body regardless of
 * whether any account matched. The page copy mirrors this:
 *   "If that phone is on file, you'll receive a text shortly."
 *
 * The page deliberately never confirms a match. A page that said
 * "we don't have a record of that number" would let anyone with a
 * phone book probe the system for prospect presence.
 *
 * Compliance / .com posture:
 *   - No income claims, placement promises, AI prospecting.
 *   - No THREE branding. No team head count.
 *   - The page names the act ("get back to your dashboard") without
 *     making any claim about what's on the dashboard.
 *
 * Where this is reached from:
 *   - The SMS-link expired view (F.2 on /p/{token}) — future enhancement.
 *   - A direct URL the BA shares ("text TM-login the word DASHBOARD")
 *     — also future enhancement.
 *   - Direct bookmark by a prospect who has been here before.
 */

import { useState, type FormEvent } from 'react';
import { postLoginStart } from '@/lib/api';
import { CompassRose } from '@/components/CompassRose';

type ViewState =
  | { kind: 'form' }
  | { kind: 'submitting' }
  | { kind: 'sent' }
  | { kind: 'rate_limited' }
  | { kind: 'network_error' };

export function PLoginPage() {
  const [phone, setPhone] = useState('');
  const [view, setView] = useState<ViewState>({ kind: 'form' });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = phone.trim();
    if (trimmed.length < 7) {
      // Treat too-short as a soft no-op rather than an error — the
      // server-side normalize would reject anyway and we'd land on
      // the same opaque-success view. Surface a quiet hint locally.
      return;
    }
    setView({ kind: 'submitting' });
    const result = await postLoginStart(trimmed);
    if (result.ok) {
      setView({ kind: 'sent' });
      return;
    }
    if (result.error === 'rate_limited') {
      setView({ kind: 'rate_limited' });
      return;
    }
    setView({ kind: 'network_error' });
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="flex justify-center mb-8">
          <CompassRose size={56} className="opacity-90" />
        </div>

        {view.kind === 'sent' ? (
          <SentView />
        ) : view.kind === 'rate_limited' ? (
          <RateLimitedView onTryAgain={() => setView({ kind: 'form' })} />
        ) : view.kind === 'network_error' ? (
          <NetworkErrorView onTryAgain={() => setView({ kind: 'form' })} />
        ) : (
          <FormView
            phone={phone}
            onPhoneChange={setPhone}
            submitting={view.kind === 'submitting'}
            onSubmit={onSubmit}
          />
        )}
      </div>
    </main>
  );
}

// ─── Form ────────────────────────────────────────────────────────

function FormView(props: {
  phone: string;
  onPhoneChange: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        Get back to your dashboard.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-md mx-auto">
        Enter the mobile number your invitation was sent to. We'll text you a
        link to walk right back in.
      </p>

      <form onSubmit={props.onSubmit} className="mt-10 flex flex-col items-center gap-4">
        <label htmlFor="phone" className="sr-only">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="(555) 123-4567"
          value={props.phone}
          onChange={(e) => props.onPhoneChange(e.target.value)}
          disabled={props.submitting}
          className="w-full max-w-sm px-5 py-3 rounded-full bg-ink-2 border border-line text-cream placeholder:text-cream-faint font-body text-base text-center focus:outline-none focus:border-gold transition-colors"
        />
        <button
          type="submit"
          disabled={props.submitting || props.phone.trim().length < 7}
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-gold text-gold font-mono text-xs tracking-eyebrow uppercase hover:bg-gold hover:text-ink transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {props.submitting ? 'Sending…' : 'Text me the link'}
        </button>
      </form>

      <p className="mt-10 font-body text-cream-faint text-xs max-w-sm mx-auto">
        We only text people whose phone was used to invite them and who have
        asked for their sponsor to reach out. If that's not you, ask whoever
        invited you for a fresh link.
      </p>
    </>
  );
}

// ─── Sent (opaque success) ──────────────────────────────────────────
//
// Always shown after a /start call returns ok, regardless of whether
// the phone matched zero, one, or many accounts. Copy is identical
// in every match-count case (locked-spec 3.17 anti-probing rule).

function SentView() {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        Check your phone.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-md mx-auto">
        If that mobile number is on file, you'll receive a text with your
        re-entry link shortly. The link works for the next hour.
      </p>
      <p className="mt-6 font-body text-cream-faint text-xs max-w-sm mx-auto">
        Didn't receive it? Ask whoever invited you to send a fresh link.
      </p>
    </>
  );
}

// ─── Rate limited ──────────────────────────────────────────────────

function RateLimitedView(props: { onTryAgain: () => void }) {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        Hold on a moment.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-md mx-auto">
        Too many requests from this device. Try again in a few minutes.
      </p>
      <button
        type="button"
        onClick={props.onTryAgain}
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full border border-cream-faint/40 text-cream-mute font-mono text-xs tracking-eyebrow uppercase hover:border-teal hover:text-teal transition-colors"
      >
        Back
      </button>
    </>
  );
}

// ─── Network error ─────────────────────────────────────────────────

function NetworkErrorView(props: { onTryAgain: () => void }) {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        Something didn't load.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-md mx-auto">
        Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={props.onTryAgain}
        className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gold text-gold font-mono text-xs tracking-eyebrow uppercase hover:bg-gold hover:text-ink transition-colors"
      >
        Try again
      </button>
    </>
  );
}
