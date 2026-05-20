/**
 * /p/:token — Phase 0 placeholder.
 *
 * Resolves the opaque token via the server and renders a single line that
 * confirms both the inviting BA and the prospect were found. This is a
 * scaffold milestone, not the real surface: tm-video-presentation (locked-spec
 * Part 4.3) replaces this in Chat #106.
 *
 * Brand-locked: ink background, gold accent on the BA name, Bebas Neue
 * display, DM Sans body, DM Mono operational. Cream secondary text.
 * No THREE branding (locked-spec Part 3.8).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { resolveToken, type ResolveTokenError, type ResolveTokenResponse } from '@/lib/api';

type ResolveState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: ResolveTokenResponse }
  | { kind: 'err'; error: ResolveTokenError };

export function PTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ResolveState>({ kind: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'err', error: { kind: 'invalid_token' } });
      return;
    }
    let cancelled = false;
    void resolveToken(token).then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ kind: 'ok', data: result.data });
      else setState({ kind: 'err', error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">
        <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
          Team Magnificent
        </div>

        {state.kind === 'loading' && (
          <p className="font-body text-cream-mute text-sm">Loading…</p>
        )}

        {state.kind === 'err' && <ErrorView error={state.error} />}

        {state.kind === 'ok' && <ResolvedView data={state.data} />}

        <div className="mt-16 font-mono text-cream-faint text-[10px] tracking-eyebrow uppercase">
          Phase 0 placeholder · tm-video-presentation in Chat #106
        </div>
      </div>
    </main>
  );
}

function ResolvedView({ data }: { data: ResolveTokenResponse }) {
  return (
    <>
      <h1 className="font-display text-5xl md:text-7xl text-cream leading-none">
        Hello, {data.prospect.firstName}.
      </h1>
      <p className="mt-8 font-body text-cream-mute text-lg">
        You were personally invited by{' '}
        <span className="text-gold font-medium">{data.ba.fullName}</span>.
      </p>
      <p className="mt-3 font-mono text-cream-faint text-xs tracking-eyebrow uppercase">
        token state: {data.state}
      </p>
    </>
  );
}

function ErrorView({ error }: { error: ResolveTokenError }) {
  const message = (() => {
    switch (error.kind) {
      case 'invalid_token':
        return 'This link is no longer valid. Reach out to the person who invited you for a fresh one.';
      case 'expired':
        return 'This invitation has expired. Reach out to the person who invited you to renew it.';
      case 'enrolled':
        return 'Welcome aboard. Look out for your access code by separate message.';
      case 'network':
        return 'Connection issue — please try again in a moment.';
    }
  })();

  return (
    <>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">Team Magnificent</h1>
      <p className="mt-8 font-body text-cream-mute text-base max-w-lg mx-auto">{message}</p>
    </>
  );
}
