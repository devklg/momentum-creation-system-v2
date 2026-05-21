/**
 * /p/:token — prospect-facing surface entry point.
 *
 * Resolves the opaque token via the server. While resolving, shows the
 * brand-locked loader. On error, shows the locked error views (invalid /
 * expired / enrolled / network). On success, mounts <TmVideoPresentation />
 * (Chat #107 composer, locked-spec Part 4.3, eleven-section build).
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

  // Happy path — mount the full eleven-section composer.
  if (state.kind === 'ok') {
    const composerInput: ComposerInput = {
      token: state.data.token,
      // Server's TokenState union is a superset of the composer's expected
      // ResolveTokenState; the composer only branches on a subset and treats
      // unknowns as the initial "clicked" state, so this cast is safe.
      state: state.data.state as ComposerInput['state'],
      prospectFirstName: state.data.prospect.firstName,
      baFullName: state.data.ba.fullName,
      positionNumber: state.data.prospect.positionNumber ?? undefined,
      placedAt: state.data.prospect.placedAt ?? undefined,
    };
    return <TmVideoPresentation resolved={composerInput} />;
  }

  // Loading + error states keep the existing brand-locked single-screen view.
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
      </div>
    </main>
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
