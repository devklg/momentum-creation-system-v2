/**
 * /p/login/r/:linkToken — magic-link redeem (locked-spec 3.17).
 *
 * Layer 3 of the prospect re-entry build (Chat #131).
 *
 * The prospect lands here by tapping the SMS magic link. The page
 * posts the linkToken to /api/p/login/redeem on mount. On success,
 * the server has set the mcs_prospect_session cookie and the client
 * redirects to /p/{tokenId}.
 *
 * Failure surface (locked-spec 3.17 anti-leak):
 *   The server collapses invalid_link, expired_link, and already_used
 *   into one response shape. This page renders one view for all
 *   three — "This link has expired or has already been used" — so
 *   nothing about which specific failure case occurred leaks to a
 *   visitor.
 */

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { postLoginRedeem } from '@/lib/api';
import { CompassRose } from '@/components/CompassRose';

type RedeemView =
  | { kind: 'redeeming' }
  | { kind: 'invalid' }
  | { kind: 'rate_limited' }
  | { kind: 'network_error' };

export function PLoginRedeemPage() {
  const { linkToken } = useParams<{ linkToken: string }>();
  const navigate = useNavigate();
  const [view, setView] = useState<RedeemView>({ kind: 'redeeming' });

  useEffect(() => {
    if (!linkToken) {
      setView({ kind: 'invalid' });
      return;
    }
    let cancelled = false;
    void postLoginRedeem(linkToken).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        // Cookie is already set server-side. Hand the prospect into
        // their dashboard. Use replace so the redeem URL doesn't
        // sit in history — the link is single-use; navigating back
        // to it would show the "already used" view.
        navigate(`/p/${result.tokenId}`, { replace: true });
        return;
      }
      if (result.error === 'rate_limited') {
        setView({ kind: 'rate_limited' });
        return;
      }
      if (result.error === 'network') {
        setView({ kind: 'network_error' });
        return;
      }
      // invalid_link / expired_link / already_used — collapsed.
      setView({ kind: 'invalid' });
    });
    return () => {
      cancelled = true;
    };
  }, [linkToken, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="flex justify-center mb-8">
          <CompassRose
            size={56}
            className={view.kind === 'redeeming' ? 'opacity-90 motion-glow' : 'opacity-90'}
          />
        </div>

        {view.kind === 'redeeming' && <RedeemingView />}
        {view.kind === 'invalid' && <InvalidView />}
        {view.kind === 'rate_limited' && <RateLimitedView />}
        {view.kind === 'network_error' && <NetworkErrorView />}
      </div>
    </main>
  );
}

// ─── Redeeming ─────────────────────────────────────────────────────

function RedeemingView() {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <p className="font-body text-cream-mute text-sm">Opening your dashboard…</p>
    </>
  );
}

// ─── Invalid / expired / already-used (collapsed) ──────────────────

function InvalidView() {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        This link has expired or has already been used.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-md mx-auto">
        Request a fresh link below, or ask whoever invited you to send a new one.
      </p>
      <div className="mt-10">
        <a
          href="/p/login"
          className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-gold text-gold font-mono text-xs tracking-eyebrow uppercase hover:bg-gold hover:text-ink transition-colors"
        >
          Get a fresh link
        </a>
      </div>
    </>
  );
}

// ─── Rate limited ──────────────────────────────────────────────────

function RateLimitedView() {
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
    </>
  );
}

// ─── Network error ─────────────────────────────────────────────────

function NetworkErrorView() {
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
      <div className="mt-8">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-gold text-gold font-mono text-xs tracking-eyebrow uppercase hover:bg-gold hover:text-ink transition-colors"
        >
          Try again
        </button>
      </div>
    </>
  );
}
