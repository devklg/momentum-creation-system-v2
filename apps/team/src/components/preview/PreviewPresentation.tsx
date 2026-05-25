/**
 * PreviewPresentation — a brand-faithful representation of the .com
 * tm-video-presentation page personalized to the previewing BA's
 * synthesized payload (Chat #134, wireframe 3.7 leaf wf_0068).
 *
 * Why not import apps/com directly:
 *   apps/team's tsconfig.json sets `rootDir: "src"` and includes only
 *   `src/**\/*`. Importing `apps/com/src/...` from this app trips TS6059
 *   (the documented lesson lives in apps/team/src/routes/cockpit.tsx
 *   header). Cross-app imports would also cascade dependency surface
 *   (the YT IFrame API state machine, the @/ alias collision between
 *   apps/com/src and apps/team/src) and require editing apps/com files
 *   to expose them — which TASK-134 forbids.
 *
 *   This component is therefore a CONDENSED, brand-faithful rendering
 *   that uses the same locked brand tokens (ink #0A0A0A, gold #C9A84C,
 *   cream #F5EFE6, teal #2DD4BF; Bebas Neue display + DM Sans body) and
 *   shows the BA exactly what a prospect would experience: the
 *   personalization (their name as inviting BA, the sample prospect's
 *   first name woven into the hero), the section flow, and the
 *   CTA-to-dashboard handoff. The .com page itself remains the
 *   authoritative production surface.
 *
 * COMPLIANCE (locked-spec 3.10): every line of copy here is the same
 * marketing posture used on real .com — no income claims, no placement
 * promises, no AI/prospecting vocabulary, no team head count, no THREE
 * branding. The preview literally cannot violate compliance because the
 * preview surface is not prospect-facing — but mirroring the same
 * discipline keeps the BA's mental model accurate.
 */

// Local wire shape — mirror of PreviewResolvedTokenPayload in
// packages/shared/src/types.ts. The team convention (cockpit.tsx,
// video-library.tsx, ivory.tsx) is to declare wire shapes locally to
// sidestep TS6059 — the shared `src` alias is outside this app's
// rootDir so `import { ... } from '@momentum/shared'` trips the
// composite-project boundary (lesson chat120). Server is the source of
// truth.
interface PreviewWirePayload {
  token: string;
  state: string;
  prospect: {
    firstName: string;
    lastInitial: string;
    city: string;
    stateOrRegion: string;
    country: string;
    positionNumber: number | null;
    placedAt: string | null;
    expiresAt: string;
  };
  ba: {
    baId: string;
    firstName: string;
    lastName: string;
    lastInitial: string;
    fullName: string;
  };
  videoUrl: string;
  webinar: { dayOfWeek: string; timeOfDay: string; timezone: string };
  nextEvent: {
    eventId: string;
    scheduledFor: string;
    hosts: string[];
  } | null;
  preview: true;
}

export type { PreviewWirePayload };

export interface PreviewPresentationProps {
  payload: PreviewWirePayload;
  onSeeDashboard: () => void;
}

export function PreviewPresentation({
  payload,
  onSeeDashboard,
}: PreviewPresentationProps) {
  const { prospect, ba } = payload;
  const baFirstName = ba.firstName;

  return (
    <main className="relative min-h-screen bg-ink text-cream">
      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-12 md:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 font-mono text-[11px] uppercase tracking-eyebrow text-gold">
            <span aria-hidden="true">— </span>
            An invitation from {ba.fullName}
          </div>
          <h1 className="font-display text-5xl leading-[0.96] text-cream md:text-7xl lg:text-8xl">
            {prospect.firstName},
            <br />
            this isn't a pitch.
          </h1>
          <p className="mt-8 max-w-2xl font-body text-base leading-relaxed text-cream-mute md:text-lg">
            {baFirstName} sent you this because you were on their mind.
            It's a short film about a moment in pharmaceutical history
            and a doctor named Dan Lukaczer who has a different read on
            it. Watch when you have seventeen quiet minutes.
          </p>
        </div>
      </section>

      {/* ── Video card placeholder ──────────────────────────────────── */}
      <section className="border-y border-line bg-ink-2 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 font-mono text-[11px] uppercase tracking-eyebrow text-cream-faint">
            Section 03 · Dr. Dan
          </div>
          <div className="flex aspect-video w-full items-center justify-center rounded-md border border-gold/30 bg-ink">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-gold/50">
                <span className="ml-1 text-2xl text-gold" aria-hidden="true">
                  ▶
                </span>
              </div>
              <div className="font-mono text-[11px] uppercase tracking-eyebrow text-cream-mute">
                Dr. Dan · 17 minutes
              </div>
              <div className="mt-2 font-body text-xs text-cream-faint">
                (Preview placeholder — real prospect sees the embedded video)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Market stats ────────────────────────────────────────────── */}
      <section className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 font-mono text-[11px] uppercase tracking-eyebrow text-gold">
            <span aria-hidden="true">— </span>
            The market
          </div>
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            <MarketStat label="Global market" value="$6.8T" />
            <MarketStat label="GLP category" value="$200B" />
            <MarketStat label="Population affected" value="72%" />
            <MarketStat label="Per-person spend" value="$1,200" />
          </div>
        </div>
      </section>

      {/* ── Closer / CTA ───────────────────────────────────────────── */}
      <section className="border-t border-line px-6 py-20 md:px-12 md:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 font-mono text-[11px] uppercase tracking-eyebrow text-gold">
            <span aria-hidden="true">— </span>
            What's next
          </div>
          <h2 className="font-display text-4xl leading-tight text-cream md:text-6xl">
            See the team forming
            <br />
            beneath you.
          </h2>
          <p className="mt-6 max-w-xl font-body text-base text-cream-mute">
            Once the video completes, the page transitions to your
            replicated dashboard — your position, the team line, the
            countdown to the next live call.
          </p>
          <button
            type="button"
            onClick={onSeeDashboard}
            className="mt-10 inline-flex items-center gap-3 rounded-full border border-gold px-8 py-4 font-mono text-xs uppercase tracking-button text-gold transition-colors hover:bg-gold hover:text-ink"
          >
            <span>Preview the dashboard view</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-line px-6 py-12 md:px-12">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="font-mono text-[11px] uppercase tracking-eyebrow text-cream-faint">
            Team Magnificent
          </div>
          <div className="font-body text-xs text-cream-mute">
            Shared with you by {ba.fullName}
          </div>
        </div>
      </footer>
    </main>
  );
}

function MarketStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-4xl text-cream md:text-5xl">{value}</div>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-eyebrow text-cream-faint">
        {label}
      </div>
    </div>
  );
}

export default PreviewPresentation;
