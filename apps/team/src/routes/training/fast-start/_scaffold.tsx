/**
 * Shared scaffold for every Fast Start module page.
 *
 * Provides the brand chrome (header / hero / mantra strip / footer)
 * AND the progress wiring so each module file holds only its own
 * content. Behavior:
 *
 *   - On mount: POSTs `in_progress` (idempotent — the server
 *     short-circuits when the module is already in_progress or
 *     completed). Module 1 mounts pre-Michael; the route is
 *     whitelisted server-side.
 *
 *   - Mark complete button: POSTs `completed`. On success the dot
 *     turns teal, the button flips to "Marked complete" and a
 *     "Continue → next module" link surfaces (or, for Module 5, a
 *     "Back to Fast Start" link).
 *
 *   - Sequential, NOT hard-gated (Kevin, this branch): a BA can skip
 *     forward; the "next" link is the suggestion, not the enforcement.
 *
 * Compliance scope: .team only. CV/dollar figures inside the modules
 * are legitimate inside this regulated training environment and
 * never bleed to .com.
 */

import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
// Local wire shapes — .team TS6059 convention (see _wire.ts header).
import {
  FAST_START_MODULES,
  type FastStartMarkStateResponse,
  type FastStartModuleId,
  type FastStartModuleState,
} from './_wire';

interface MarkProgressState {
  current: FastStartModuleState;
  pending: boolean;
  err: string | null;
}

function useMarkModuleProgress(moduleId: FastStartModuleId) {
  const [state, setState] = useState<MarkProgressState>({
    current: 'not_started',
    pending: false,
    err: null,
  });

  // On mount: mark in_progress. Idempotent — server returns the
  // existing state if already in_progress or completed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/training/fast-start/modules/${moduleId}/state`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: 'in_progress' }),
          },
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as FastStartMarkStateResponse;
          setState((s) => ({ ...s, current: body.state }));
        }
        // 403 = Michael gate. The hub is still informative; ignore quietly here.
      } catch {
        // Network failure — silent. The user can still read the module
        // body; mark-complete will surface the error if it persists.
      }
    })();
    return () => {
      cancelled = true;
    };
    // moduleId is constant per page mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markComplete(): Promise<void> {
    if (state.pending || state.current === 'completed') return;
    setState((s) => ({ ...s, pending: true, err: null }));
    try {
      const res = await fetch(
        `/api/training/fast-start/modules/${moduleId}/state`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ state: 'completed' }),
        },
      );
      const body = (await res.json()) as
        | FastStartMarkStateResponse
        | { error?: string };
      if (!res.ok || !('ok' in body)) {
        setState({
          current: state.current,
          pending: false,
          err: 'error' in body ? String(body.error) : 'request_failed',
        });
        return;
      }
      setState({ current: body.state, pending: false, err: null });
    } catch {
      setState({ current: state.current, pending: false, err: 'network' });
    }
  }

  return { state, markComplete };
}

export interface ModuleScaffoldProps {
  moduleId: FastStartModuleId;
  /** Optional override for the next-module suggestion. Defaults to id+1's slug. */
  nextSlug?: string | null;
  children: ReactNode;
}

export function ModuleScaffold({ moduleId, nextSlug, children }: ModuleScaffoldProps) {
  const navigate = useNavigate();
  const meta = FAST_START_MODULES.find((m) => m.id === moduleId);
  if (!meta) {
    // Should never happen — moduleId is typed FastStartModuleId.
    return null;
  }

  const next = (() => {
    if (nextSlug === null) return null;
    if (nextSlug) return { slug: nextSlug, label: 'Continue' };
    const nextMeta = FAST_START_MODULES.find((m) => m.id === ((moduleId + 1) as FastStartModuleId));
    if (!nextMeta) return null;
    return { slug: nextMeta.slug, label: `Module ${nextMeta.id} · ${nextMeta.title}` };
  })();

  const { state, markComplete } = useMarkModuleProgress(moduleId);
  const completed = state.current === 'completed';

  async function handleMarkAndContinue() {
    await markComplete();
    // For the last module (5), markComplete is the end of the flow —
    // route the BA back to the hub so they see the strip flip green.
    if (moduleId === 5) {
      setTimeout(() => navigate('/training/fast-start'), 600);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-cream relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(900px circle at 12% 8%, rgba(201,168,76,0.06), transparent 60%), radial-gradient(900px circle at 88% 92%, rgba(45,212,191,0.04), transparent 60%)',
        }}
        aria-hidden="true"
      />

      <header className="relative z-10 px-6 md:px-10 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logos/logo_icon.png" alt="" aria-hidden="true" className="h-7 w-auto" />
          <Link
            to="/training/fast-start"
            className="font-display tracking-[0.18em] text-[15px] text-gold hover:opacity-80"
          >
            TEAM MAGNIFICENT
          </Link>
        </div>
        <Link
          to="/training/fast-start"
          className="font-mono tracking-[0.22em] text-[10px] text-cream-mute hover:text-gold uppercase"
        >
          ← Fast Start
        </Link>
      </header>

      <section className="relative z-10 px-6 pt-12 pb-8 border-b border-line">
        <div className="max-w-[860px] mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono tracking-[0.35em] text-[9px] text-gold uppercase">
              {meta.eyebrow}
            </span>
            <span className="flex-1 h-px bg-line" />
            <span
              className={`font-mono tracking-[0.18em] text-[9px] uppercase ${
                completed
                  ? 'text-teal'
                  : state.current === 'in_progress'
                    ? 'text-gold'
                    : 'text-cream-mute'
              }`}
            >
              {completed ? '✓ Completed' : state.current === 'in_progress' ? 'In progress' : 'Not started'}
            </span>
          </div>
          <h1 className="font-display tracking-[0.03em] leading-[0.95] text-[clamp(36px,6vw,64px)]">
            {meta.title}
          </h1>
          <p className="text-cream-mute text-[15px] leading-[1.7] font-light max-w-[640px] mt-4">
            {meta.blurb}
          </p>
        </div>
      </section>

      <main className="relative z-10 px-6 py-12">
        <div className="max-w-[860px] mx-auto">{children}</div>
      </main>

      {/* MARK COMPLETE + NEXT */}
      <section className="relative z-10 px-6 pb-14">
        <div className="max-w-[860px] mx-auto bg-[#1A1A1A] border border-line p-6 md:p-7 flex flex-col md:flex-row items-start md:items-center gap-4 justify-between">
          <div className="min-w-0">
            <div className="font-mono tracking-[0.2em] text-[10px] text-gold uppercase mb-1">
              When you have read this module
            </div>
            <div className="text-cream-mute text-[13px] font-light leading-[1.6]">
              Mark it complete. Your Fast Start finishes when all five modules are complete and you
              have sent at least one invitation.
            </div>
            {state.err && (
              <div className="font-mono text-[10px] tracking-[0.18em] text-red-400/80 uppercase mt-2">
                could not save · {state.err}
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {next && (
              <Link
                to={`/training/fast-start/${next.slug}`}
                className="font-mono tracking-[0.18em] text-[10px] text-cream-mute hover:text-gold uppercase whitespace-nowrap"
              >
                {next.label} →
              </Link>
            )}
            <button
              type="button"
              onClick={handleMarkAndContinue}
              disabled={state.pending}
              className={`font-display tracking-[0.08em] text-[14px] px-6 py-3 border whitespace-nowrap transition-colors ${
                completed
                  ? 'bg-teal/20 border-teal text-teal cursor-default'
                  : state.pending
                    ? 'border-gold/40 text-gold/40 cursor-wait'
                    : 'bg-gold border-gold text-ink hover:bg-gold-bright'
              }`}
            >
              {completed
                ? '✓ MARKED COMPLETE'
                : state.pending
                  ? 'SAVING…'
                  : 'MARK COMPLETE'}
            </button>
          </div>
        </div>
      </section>

      <section className="relative z-10 bg-gold py-3.5 px-6">
        <div className="max-w-[860px] mx-auto flex items-center justify-center gap-4 md:gap-8">
          <MantraItem word="People" sub="Build the team" />
          <span className="w-px h-9 bg-ink/20 flex-shrink-0" />
          <MantraItem word="Momentum" sub="Fuel the movement" />
          <span className="w-px h-9 bg-ink/20 flex-shrink-0" />
          <MantraItem word="Volume" sub="Create cycles" />
          <span className="w-px h-9 bg-ink/20 flex-shrink-0" />
          <MantraItem word="Checks" sub="Get paid weekly" />
        </div>
      </section>

      <footer className="relative z-10 bg-black border-t border-line py-7 px-10 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
        <div className="font-display tracking-[0.1em] text-[18px] text-gold">
          TEAM MAGNIFICENT × THREE INTERNATIONAL
        </div>
        <div className="font-mono tracking-[0.15em] text-[9px] text-cream-faint uppercase">
          For Training Purposes Only · Not a guarantee of income · © 2026 iii International LLC
        </div>
      </footer>
    </div>
  );
}

function MantraItem({ word, sub }: { word: string; sub: string }) {
  return (
    <div className="flex-1 max-w-[180px] text-center">
      <div className="font-display tracking-[0.1em] text-[clamp(18px,3vw,26px)] text-ink leading-none">
        {word}
      </div>
      <div className="font-mono tracking-[0.2em] text-[8px] text-ink/50 uppercase mt-0.5">
        {sub}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
 * Shared small components for module bodies — reduce per-module
 * cruft so each file holds content, not chrome.
 * ────────────────────────────────────────────────────────────────── */

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-4 mt-12 first:mt-0">
      <span className="font-mono tracking-[0.35em] text-[9px] text-gold uppercase">
        {children}
      </span>
      <span className="flex-1 h-px bg-line" />
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display tracking-[0.04em] text-[clamp(28px,4vw,42px)] leading-[1.05] mb-6">
      {children}
    </h2>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="text-cream-mute text-[15px] leading-[1.75] font-light space-y-4 max-w-[680px]">
      {children}
    </div>
  );
}

export function Callout({
  tone = 'gold',
  title,
  children,
}: {
  tone?: 'gold' | 'teal';
  title?: ReactNode;
  children: ReactNode;
}) {
  const colorClass =
    tone === 'teal'
      ? 'border-teal/60 bg-teal/[0.04]'
      : 'border-gold/60 bg-gold/[0.04]';
  const titleColor = tone === 'teal' ? 'text-teal' : 'text-gold';
  return (
    <div className={`border-l-4 ${colorClass} p-5 my-6`}>
      {title && (
        <div className={`font-display tracking-[0.06em] text-[18px] ${titleColor} mb-2`}>
          {title}
        </div>
      )}
      <div className="text-cream text-[14px] leading-[1.7] font-light">{children}</div>
    </div>
  );
}

export function DataCard({
  num,
  label,
  highlight = false,
}: {
  num: ReactNode;
  label: ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border p-4 text-center ${
        highlight ? 'border-gold/60 bg-gold/[0.06]' : 'border-line bg-[#1A1A1A]'
      }`}
    >
      <div
        className={`font-display text-[34px] leading-none tracking-[0.02em] ${highlight ? 'text-gold' : 'text-cream'}`}
      >
        {num}
      </div>
      <div className="font-mono tracking-[0.15em] text-[9px] text-cream-mute uppercase mt-2 leading-tight">
        {label}
      </div>
    </div>
  );
}
