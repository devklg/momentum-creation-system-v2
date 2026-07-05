/**
 * /training/fast-start — the Fast Start hub.
 *
 * Self-paced first-7-days curriculum (feat/fast-start-training,
 * wireframe 3.5). Five modules ordered, sequential in display but NOT
 * hard-gated — a BA can jump to any module. The Steve gate restricts
 * Modules 2-5 server-side; this hub renders all 5 cards but indicates
 * gated state when relevant.
 *
 * Source content scope:
 *   - Module 1 = THREE GLP-THREE fact sheet + product line story
 *   - Modules 2-3 = ported from Team Magnificent's published
 *     "Power in Numbers" comp training (devklg.github.io/team-magnificent-training)
 *   - Module 4 = intro + LINK to /ivory (does not embed Ivory)
 *   - Module 5 = team-building mindset (names-list + numbers model)
 *
 * Completion = 5 modules `completed` AND >=1 invitation sent. The
 * server is canonical; the hub reads it via /api/training/fast-start/progress.
 *
 * Compliance scope: .team only. CV/dollar figures inside the modules
 * are legitimate inside this regulated training environment and never
 * bleed to .com.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SponsorQuickModal,
  type SponsorQuickAccessCard,
} from '@/components/SponsorQuickAccess';
// Local wire shapes — .team TS6059 convention (see _wire.ts header).
import {
  FAST_START_MODULES,
  type FastStartProgressResponse,
  type FastStartModuleStatus,
} from './_wire';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; data: FastStartProgressResponse }
  | { kind: 'err'; reason: string };

export function FastStartHubPage() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const [sponsorLoading, setSponsorLoading] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [sponsor, setSponsor] = useState<SponsorQuickAccessCard | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/training/fast-start/progress', {
          credentials: 'include',
        });
        const body = (await res.json()) as FastStartProgressResponse | { error?: string };
        if (cancelled) return;
        if (!res.ok || !('ok' in body)) {
          setState({ kind: 'err', reason: 'error' in body ? String(body.error) : 'request_failed' });
          return;
        }
        setState({ kind: 'ready', data: body });
      } catch {
        if (!cancelled) setState({ kind: 'err', reason: 'network' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modules = state.kind === 'ready' ? state.data.modules : null;
  const completedCount = modules?.filter((m) => m.state === 'completed').length ?? 0;
  const invitationsSent = state.kind === 'ready' ? state.data.invitationsSent : 0;
  const allModulesComplete = completedCount === 5;
  const fastStartComplete = state.kind === 'ready' ? state.data.complete : false;

  async function openSponsorCard() {
    setSponsorOpen(true);
    if (sponsor || sponsorLoading) return;
    setSponsorLoading(true);
    setSponsorError(null);
    try {
      const res = await fetch('/api/profile/sponsor', { credentials: 'include' });
      const body = (await res.json()) as
        | { ok: true; sponsor: SponsorQuickAccessCard | null }
        | { ok: false; error?: string };
      if (!res.ok || !body.ok) {
        setSponsorError('Could not load your sponsor card.');
        return;
      }
      setSponsor(body.sponsor);
    } catch {
      setSponsorError('Network error loading your sponsor card.');
    } finally {
      setSponsorLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink text-cream relative overflow-hidden">
      <SponsorQuickModal
        sponsor={sponsor}
        open={sponsorOpen}
        loading={sponsorLoading}
        error={sponsorError}
        onClose={() => setSponsorOpen(false)}
      />
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
            to="/cockpit"
            className="font-display tracking-[0.18em] text-[15px] text-gold hover:opacity-80"
          >
            TEAM MAGNIFICENT
          </Link>
        </div>
        <div className="flex items-center gap-6">
          <span className="font-mono tracking-[0.22em] text-[10px] text-cream-mute uppercase">
            Fast Start · The First Seven Days
          </span>
          <Link
            to="/cockpit"
            className="font-mono tracking-[0.22em] text-[10px] text-cream-mute hover:text-gold uppercase"
          >
            ← Cockpit
          </Link>
        </div>
      </header>

      <section className="relative z-10 px-6 pt-14 pb-10">
        <div className="max-w-[860px] mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono tracking-[0.35em] text-[9px] text-gold uppercase">
              Your Fast Start
            </span>
            <span className="flex-1 h-px bg-line" />
          </div>
          <h1 className="font-display tracking-[0.03em] leading-[0.95] text-[clamp(36px,6vw,64px)] mb-6">
            <span className="block">The First</span>
            <span className="block text-gold">Seven Days.</span>
          </h1>
          <p className="text-cream-mute text-[15px] leading-[1.75] font-light max-w-[640px]">
            Five short modules. The product, the comp plan, the binary, your prospect list, your
            team. Move through them in order — or jump to whichever one you need right now. You
            finish when all five are done <strong className="text-cream">and</strong> you have sent
            at least one invitation. That is the test. That is the start.
          </p>
          <button
            type="button"
            onClick={() => void openSponsorCard()}
            className="mt-6 inline-flex items-center justify-center bg-cream/[0.06] text-cream hover:bg-cream/[0.1] border border-cream/15 rounded-md font-display tracking-[0.08em] text-[14px] px-5 py-3"
          >
            Talk to my sponsor
          </button>
        </div>
      </section>

      <section className="relative z-10 px-6 pb-12">
        <div className="max-w-[860px] mx-auto flex flex-col gap-[2px]">
          {FAST_START_MODULES.map((m) => {
            const status =
              modules?.find((s) => s.moduleId === m.id) ??
              ({ moduleId: m.id, state: 'not_started', startedAt: null, completedAt: null } as FastStartModuleStatus);
            return (
              <ModuleCard
                key={m.id}
                moduleId={m.id}
                slug={m.slug}
                eyebrow={m.eyebrow}
                title={m.title}
                blurb={m.blurb}
                status={status}
              />
            );
          })}
        </div>
      </section>

      {/* PROGRESS STRIP */}
      <section className="relative z-10 px-6 pb-14">
        <div className="max-w-[860px] mx-auto bg-[#1A1A1A] border border-line p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProgressStat
            value={`${completedCount} / 5`}
            label="Modules complete"
            ok={allModulesComplete}
          />
          <ProgressStat
            value={String(invitationsSent)}
            label="Invitations sent"
            ok={invitationsSent >= 1}
          />
          <ProgressStat
            value={fastStartComplete ? 'COMPLETE' : 'IN PROGRESS'}
            label="Fast Start"
            ok={fastStartComplete}
          />
        </div>
        {state.kind === 'err' && (
          <p className="max-w-[860px] mx-auto mt-3 font-mono text-[10px] tracking-[0.18em] text-red-400/80 uppercase">
            could not load progress · {state.reason}
          </p>
        )}
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

function ModuleCard({
  moduleId,
  slug,
  eyebrow,
  title,
  blurb,
  status,
}: {
  moduleId: number;
  slug: string;
  eyebrow: string;
  title: string;
  blurb: string;
  status: FastStartModuleStatus;
}) {
  const ctaText =
    status.state === 'completed'
      ? 'Review →'
      : status.state === 'in_progress'
        ? 'Continue →'
        : 'Begin →';

  return (
    <Link
      to={`/training/fast-start/${slug}`}
      className={[
        'group block bg-[#1A1A1A] border transition-colors',
        'grid grid-cols-[56px_1fr_auto] gap-6 items-center',
        'p-6 md:px-7',
        status.state === 'completed'
          ? 'border-teal/40 hover:border-teal'
          : status.state === 'in_progress'
            ? 'border-gold/40 hover:border-gold'
            : 'border-line hover:border-gold/30',
        'max-md:grid-cols-[40px_1fr] max-md:gap-4',
      ].join(' ')}
    >
      <StatusDot state={status.state} />
      <div className="min-w-0">
        <div className="font-mono tracking-[0.25em] text-[9px] text-gold uppercase mb-1.5">
          {eyebrow}
        </div>
        <div className="font-display text-[22px] tracking-[0.04em] text-cream mb-1.5 leading-tight">
          {title}
        </div>
        <div className="text-[13px] text-cream-mute leading-[1.6] font-light">{blurb}</div>
      </div>
      <div className="font-mono tracking-[0.15em] text-[10px] text-gold uppercase max-md:hidden">
        {ctaText}
      </div>
      <div className="hidden max-md:block max-md:col-span-2 max-md:text-right max-md:-mt-1">
        <span className="font-mono tracking-[0.15em] text-[10px] text-gold uppercase">
          {ctaText}
        </span>
      </div>
      <span className="sr-only">{`Module ${moduleId} · ${status.state.replace('_', ' ')}`}</span>
    </Link>
  );
}

function StatusDot({ state }: { state: FastStartModuleStatus['state'] }) {
  if (state === 'completed') {
    return (
      <div className="flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-teal/20 border border-teal/60 flex items-center justify-center max-md:w-8 max-md:h-8">
          <span className="text-teal font-display text-[18px] leading-none">✓</span>
        </div>
      </div>
    );
  }
  if (state === 'in_progress') {
    return (
      <div className="flex items-center justify-center">
        <div className="w-10 h-10 rounded-full bg-gold/15 border border-gold/60 flex items-center justify-center max-md:w-8 max-md:h-8">
          <div className="w-3 h-3 rounded-full bg-gold animate-pulse" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border border-line max-md:w-8 max-md:h-8" />
    </div>
  );
}

function ProgressStat({ value, label, ok }: { value: string; label: string; ok: boolean }) {
  return (
    <div className="text-center">
      <div
        className={`font-display text-[36px] leading-none tracking-[0.04em] ${ok ? 'text-teal' : 'text-gold'}`}
      >
        {value}
      </div>
      <div className="font-mono tracking-[0.2em] text-[9px] text-cream-mute uppercase mt-2">
        {label}
      </div>
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
