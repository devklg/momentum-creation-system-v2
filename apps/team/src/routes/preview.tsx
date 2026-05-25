/**
 * /preview — the in-app replicated .com preview shell.
 *
 * Chat #134, wireframe 3.7. Owns:
 *   - leaf wf_0068  /preview route in-app
 *   - leaf wf_0069  sandboxed token (read-only payload from /api/preview)
 *   - leaf wf_0070  PREVIEW MODE ribbon
 *
 * Flow:
 *   1. On mount, fetch GET /api/preview. The server synthesizes a
 *      PreviewResolvedTokenPayload from the session BA without writing
 *      anywhere. ZERO holding-tank placement, ZERO SSE emit, ZERO
 *      counter increment, ZERO prospect record (locked-spec 3.2 +
 *      sandbox contract in domain/previewToken.ts).
 *   2. Render the PREVIEW MODE ribbon (sticky top).
 *   3. Render PreviewPresentation (default). The BA can toggle to
 *      PreviewDashboard via the WhatsNext CTA — same UX as the real
 *      .com page's ?view=dashboard transition, but locally state-driven
 *      since this is a single in-app surface.
 *
 * Why a brand-faithful representation rather than importing apps/com:
 *   See the header in PreviewPresentation.tsx for the full rationale.
 *   Short version: apps/team rootDir=src + the @/ alias collision +
 *   the cascading dep graph make a direct import infeasible without
 *   edits to apps/com (which TASK-134 forbids). The representation
 *   uses the same locked brand tokens so the preview reads true.
 */

import { useEffect, useState } from 'react';
import { PreviewRibbon } from '@/components/preview/PreviewRibbon';
import {
  PreviewPresentation,
  type PreviewWirePayload,
} from '@/components/preview/PreviewPresentation';
import { PreviewDashboard } from '@/components/preview/PreviewDashboard';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ok'; payload: PreviewWirePayload }
  | { kind: 'err'; message: string };

type View = 'presentation' | 'dashboard';

export function PreviewPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [view, setView] = useState<View>('presentation');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/preview', { credentials: 'include' });
        if (cancelled) return;
        if (res.status === 401 || res.status === 403) {
          setState({
            kind: 'err',
            message:
              'You need to be signed in and Michael-complete to see your preview.',
          });
          return;
        }
        if (!res.ok) {
          setState({
            kind: 'err',
            message: `Couldn't load your preview (HTTP ${res.status}).`,
          });
          return;
        }
        const payload = (await res.json()) as PreviewWirePayload;
        setState({ kind: 'ok', payload });
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'unknown';
        setState({ kind: 'err', message: `Network error: ${msg}` });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <PreviewRibbon />
      {state.kind === 'loading' && <LoadingView />}
      {state.kind === 'err' && <ErrorView message={state.message} />}
      {state.kind === 'ok' && view === 'presentation' && (
        <PreviewPresentation
          payload={state.payload}
          onSeeDashboard={() => {
            setView('dashboard');
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
      )}
      {state.kind === 'ok' && view === 'dashboard' && (
        <PreviewDashboard
          payload={state.payload}
          onBackToPresentation={() => {
            setView('presentation');
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
      )}
    </>
  );
}

function LoadingView() {
  return (
    <main className="flex min-h-[60vh] items-center justify-center">
      <div className="text-center">
        <div className="font-mono text-[11px] uppercase tracking-eyebrow text-cream-faint">
          Synthesizing your preview…
        </div>
      </div>
    </main>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-eyebrow text-gold">
          Preview unavailable
        </div>
        <p className="font-body text-sm text-cream-mute">{message}</p>
      </div>
    </main>
  );
}

export default PreviewPage;
