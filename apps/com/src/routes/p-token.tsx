/**
 * /p/:token — prospect-facing surface entry point.
 *
 * Resolves the opaque token via the server. While resolving, shows the
 * brand-locked loader. On error, dispatches to the four locked views per
 * locked-spec Part 4.9:
 *
 *   F.1 invalid_token (404)  — minimal branded message, no BA contact
 *   F.2 expired       (410)  — tap-to-text helper: phone as tel: link,
 *                              "Copy a text to [BA first]" button writes
 *                              a pre-filled SMS to the clipboard so the
 *                              prospect pastes it into their own SMS app.
 *                              System never sends on prospect's behalf
 *                              (locked-spec 1.13 channel protection +
 *                              3.6 BA-to-BA off-app).
 *   E.2 enrolled      (409)  — brief acknowledgment, no CTA, no register
 *                              link, no programmatic path. Access to .team
 *                              comes through a separately-issued access
 *                              code per locked-spec 2.3.
 *   F.4-F.6 network/server   — soft degrade with retry.
 *
 * 200 return-visit routing per Part 4.9 Branch 1: the composer initializes
 * firedMilestones from initialState and rehydrates placement from the
 * resolved props when state is video_complete, so a mid-stream return
 * resumes at the right milestone and a post-complete return goes straight
 * to the dashboard. That dispatch happens inside <TmVideoPresentation/>.
 *
 * Sponsor immutability (locked-spec Part 3.5) is enforced server-side; this
 * file does not pass any sponsor field to anything.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveToken, type ResolveTokenError, type ResolveTokenResponse } from '@/lib/api';
import {
  TmVideoPresentation,
  type ResolveTokenResponse as ComposerInput,
} from './tm-video-presentation/tm-video-presentation';
import { CompassRose } from '@/components/CompassRose';

type ResolveState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: ResolveTokenResponse }
  | { kind: 'err'; error: ResolveTokenError };

export function PTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [pageVisitId] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<ResolveState>({ kind: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'err', error: { kind: 'invalid_token' } });
      return;
    }
    let cancelled = false;
    void resolveToken(token, pageVisitId).then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ kind: 'ok', data: result.data });
      else setState({ kind: 'err', error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [pageVisitId, token]);

  // Happy path — mount the full eleven-section composer. The composer
  // handles 200 return-visit routing internally: it initializes
  // firedMilestones from state, and on state === 'video_complete' it
  // rehydrates placement from the resolved positionNumber + placedAt
  // and renders the dashboard placeholder directly.
  if (state.kind === 'ok') {
    const composerInput: ComposerInput = {
      token: state.data.token,
      // Server's TokenState union is a superset of the composer's expected
      // ResolveTokenState; the composer only branches on a subset and treats
      // unknowns as the initial "clicked" state, so this cast is safe.
      state: state.data.state as ComposerInput['state'],
      prospectFirstName: state.data.prospect.firstName,
      baFullName: state.data.ba.fullName,
      videoUrl: state.data.videoUrl,
      positionNumber: state.data.prospect.positionNumber ?? undefined,
      placedAt: state.data.prospect.placedAt ?? undefined,
      // Chat #115: next upcoming webinar event resolved server-side.
      // Threaded through to dashboard Section 6 Countdown.
      nextEvent: state.data.nextEvent ?? null,
      // TASK-147 inherit-com: master-content-resolved copy for the hero +
      // dashboard sections, resolved + interpolated server-side.
      copy: state.data.copy ?? null,
      contractVersion: state.data.contractVersion ?? null,
      pageVisitId: state.data.pageVisitId ?? pageVisitId,
      replay: state.data.replay ?? null,
    };
    return <TmVideoPresentation resolved={composerInput} />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">
        {state.kind === 'loading' && <LoadingView />}
        {state.kind === 'err' && <ErrorView error={state.error} />}
      </div>
    </main>
  );
}

// ─── Loading ─────────────────────────────────────────────────────

function LoadingView() {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <p className="font-body text-cream-mute text-sm">Loading…</p>
    </>
  );
}

// ─── Error dispatch ────────────────────────────────────────────────

function ErrorView({ error }: { error: ResolveTokenError }) {
  switch (error.kind) {
    case 'invalid_token':
      return <InvalidTokenView />;
    case 'expired':
      return <ExpiredView ba={error.ba} />;
    case 'enrolled':
      return <EnrolledView ba={error.ba} />;
    case 'network':
      return <NetworkView />;
  }
}

// ─── F.1 Invalid token ────────────────────────────────────────────
// Per locked-spec Part 4.9 Branch 2: no BA contact in payload because we
// don't know who they are. Minimal branded message asking the prospect
// to check the link or ask the person who invited them for a fresh one.

function InvalidTokenView() {
  return (
    <>
      <div className="flex justify-center mb-8">
        <CompassRose size={64} className="opacity-90" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        This link isn’t valid.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-lg mx-auto">
        Double-check the link, or ask the person who invited you for a fresh one.
      </p>
    </>
  );
}

// ─── F.2 Expired tap-to-text helper ────────────────────────────────────
// Per locked-spec Part 4.9 Branch 3:
//   • Compass mark, headline: "This invitation has expired."
//   • Body: "Ask [BA first] [BA last initial]. for a fresh link."
//   • Phone displayed as (XXX) XXX-XXXX, wrapped in <a href="tel:+1...">
//   • Secondary action: "Copy a text to [BA first]." Clicking copies a
//     pre-filled SMS to the clipboard. The prospect pastes into their
//     own SMS app and sends. System never sends on prospect's behalf.
//
// No auto-renew. The BA mints fresh from their cockpit when ready,
// honoring locked-spec 1.4 (share, respect, move on).

/**
 * Format an E.164 phone string for human display.
 *   '+13235551234' → '(323) 555-1234'
 *   anything else  → the input unchanged (or empty string if null)
 * Display-only; the underlying E.164 string is used for tel: and SMS.
 */
function formatPhoneForDisplay(e164: string | null): string {
  if (!e164) return '';
  // Match +1XXXXXXXXXX (NANP) and format. Other country codes fall through.
  const nanp = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(e164);
  if (nanp) return `(${nanp[1]}) ${nanp[2]}-${nanp[3]}`;
  return e164;
}

function ExpiredView({ ba }: { ba: { firstName: string; lastInitial: string; phoneE164: string | null } }) {
  const [copied, setCopied] = useState(false);
  const baLabel = ba.firstName
    ? `${ba.firstName}${ba.lastInitial ? ` ${ba.lastInitial}.` : ''}`
    : 'the person who invited you';
  const phoneDisplay = formatPhoneForDisplay(ba.phoneE164);
  const smsDraft = ba.firstName
    ? `Hi ${ba.firstName}, the link you sent me expired. Could you send a fresh one?`
    : `Hi, the link you sent me expired. Could you send a fresh one?`;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(smsDraft);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API unavailable (older browsers, insecure contexts) —
      // fall through silently. The tel: link still works.
    }
  };

  return (
    <>
      <div className="flex justify-center mb-8">
        <CompassRose size={64} className="opacity-90" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        This invitation has expired.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-lg mx-auto">
        Ask <span className="text-cream">{baLabel}</span> for a fresh link.
      </p>

      {ba.phoneE164 && (
        <div className="mt-8 flex flex-col items-center gap-4">
          <a
            href={`tel:${ba.phoneE164}`}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gold text-gold font-mono text-xs tracking-eyebrow uppercase hover:bg-gold hover:text-ink transition-colors"
          >
            <span aria-hidden="true">☎</span>
            <span>{phoneDisplay}</span>
          </a>

          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-cream-faint/40 text-cream-mute font-mono text-xs tracking-eyebrow uppercase hover:border-teal hover:text-teal transition-colors"
          >
            <span aria-hidden="true">{copied ? '✓' : '✎'}</span>
            <span>{copied ? `Copied — paste into your SMS app` : `Copy a text to ${ba.firstName || 'them'}`}</span>
          </button>
        </div>
      )}
    </>
  );
}

// ─── E.2 Enrolled brief acknowledgment ──────────────────────────────────
// Per locked-spec Part 4.9 Branch 4: brief acknowledgment only. No CTA, no
// register link, no programmatic path. The new BA's access to .team comes
// through a separately-issued access code from Kevin per locked-spec 2.3.
// Adding a register link would re-introduce the programmatic THREE handoff
// Chat #84 explicitly dropped.

function EnrolledView({ ba }: { ba: { firstName: string; lastName: string; fullName: string } }) {
  const sponsorName = ba.fullName || 'your sponsor';
  return (
    <>
      <div className="flex justify-center mb-8">
        <CompassRose size={64} className="opacity-90" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        Welcome to Team Magnificent.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-lg mx-auto">
        You’re in. Your sponsor <span className="text-cream">{sponsorName}</span> will reach
        out to set up your access code for the team site.
      </p>
    </>
  );
}

// ─── F.4-F.6 Network / server soft degrade ───────────────────────────────
// Per locked-spec Part 4.9 out-of-band branch (500 server_error and any
// network failure). Quiet retry surface; the dashboard's live counters
// already degrade gracefully per F.4, this is the page-level fallback.

function NetworkView() {
  const onRetry = () => window.location.reload();
  return (
    <>
      <div className="flex justify-center mb-8">
        <CompassRose size={64} className="opacity-90" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        Something didn’t load.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-lg mx-auto">
        Check your connection and try again.
      </p>
      <div className="mt-8">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gold text-gold font-mono text-xs tracking-eyebrow uppercase hover:bg-gold hover:text-ink transition-colors"
        >
          Try again
        </button>
      </div>
    </>
  );
}

