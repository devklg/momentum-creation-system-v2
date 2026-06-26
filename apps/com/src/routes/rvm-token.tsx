/**
 * /rvm/:token — RVM prospect-facing entry point.
 *
 * This surface is separate because voicemail-acquired prospects arrive with a
 * different context than warm PMV invitations. The mechanics intentionally
 * stay aligned with /p/:token: server-side token resolution, click activation,
 * forward-only video milestones, and Holding Tank placement only after
 * video_complete.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CompassRose } from '@/components/CompassRose';
import { resolveRvmToken, type ResolveTokenError, type ResolveTokenResponse } from '@/lib/api';
import {
  TmVideoPresentation,
  type ResolveTokenResponse as ComposerInput,
} from './tm-video-presentation/tm-video-presentation';

type ResolveState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: ResolveTokenResponse }
  | { kind: 'err'; error: ResolveTokenError };

export function RvmTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<ResolveState>({ kind: 'loading' });

  useEffect(() => {
    if (!token) {
      setState({ kind: 'err', error: { kind: 'invalid_token' } });
      return;
    }
    let cancelled = false;
    void resolveRvmToken(token).then((result) => {
      if (cancelled) return;
      if (result.ok) setState({ kind: 'ok', data: result.data });
      else setState({ kind: 'err', error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state.kind === 'ok') {
    const composerInput: ComposerInput = {
      token: state.data.token,
      state: state.data.state as ComposerInput['state'],
      prospectFirstName: state.data.prospect.firstName,
      baFullName: state.data.ba.fullName,
      videoUrl: state.data.videoUrl,
      positionNumber: state.data.prospect.positionNumber ?? undefined,
      placedAt: state.data.prospect.placedAt ?? undefined,
      nextEvent: state.data.nextEvent ?? null,
      copy: state.data.copy ?? null,
    };
    return <TmVideoPresentation resolved={composerInput} entryKind="rvm" />;
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-2xl text-center">
        {state.kind === 'loading' && <RvmLoadingView />}
        {state.kind === 'err' && <RvmErrorView error={state.error} />}
      </div>
    </main>
  );
}

function RvmLoadingView() {
  return (
    <>
      <div className="font-mono text-cream-faint text-xs tracking-eyebrow uppercase mb-6">
        Team Magnificent
      </div>
      <p className="font-body text-cream-mute text-sm">Loading…</p>
    </>
  );
}

function RvmErrorView({ error }: { error: ResolveTokenError }) {
  switch (error.kind) {
    case 'invalid_token':
      return <RvmInvalidTokenView />;
    case 'expired':
      return <RvmExpiredView ba={error.ba} />;
    case 'enrolled':
      return <RvmEnrolledView ba={error.ba} />;
    case 'network':
      return <RvmNetworkView />;
  }
}

function RvmInvalidTokenView() {
  return (
    <>
      <div className="flex justify-center mb-8">
        <CompassRose size={64} className="opacity-90" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        This link is not valid.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-lg mx-auto">
        Check the link, or ask the person who shared it for a fresh one.
      </p>
    </>
  );
}

function RvmExpiredView({
  ba,
}: {
  ba: { firstName: string; lastInitial: string; phoneE164: string | null };
}) {
  const baLabel = ba.firstName
    ? `${ba.firstName}${ba.lastInitial ? ` ${ba.lastInitial}.` : ''}`
    : 'the person who shared it';
  return (
    <>
      <div className="flex justify-center mb-8">
        <CompassRose size={64} className="opacity-90" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        This link has expired.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-lg mx-auto">
        Ask <span className="text-cream">{baLabel}</span> for a fresh link.
      </p>
    </>
  );
}

function RvmEnrolledView({ ba }: { ba: { firstName: string; lastName: string; fullName: string } }) {
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
        You are in. Your sponsor <span className="text-cream">{sponsorName}</span> will reach
        out to set up your access code for the team site.
      </p>
    </>
  );
}

function RvmNetworkView() {
  return (
    <>
      <div className="flex justify-center mb-8">
        <CompassRose size={64} className="opacity-90" />
      </div>
      <h1 className="font-display text-4xl md:text-5xl text-cream leading-tight">
        Something did not load.
      </h1>
      <p className="mt-6 font-body text-cream-mute text-base max-w-lg mx-auto">
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
