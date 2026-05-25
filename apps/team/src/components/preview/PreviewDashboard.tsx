/**
 * PreviewDashboard — a brand-faithful representation of the .com
 * tm-prospect-dashboard six-section surface, rendered with the
 * synthesized preview payload (Chat #134, wireframe 3.7 leaf wf_0068).
 *
 * Same rationale as PreviewPresentation: we cannot import the .com
 * components directly because of TS6059 + @/ alias collision + cascading
 * deps + the apps/com read-only constraint. This component uses the same
 * locked brand tokens and section flow so the BA sees a faithful
 * personalized representation of the dashboard — position card, live
 * placement texture, webinar countdown.
 *
 * Sandbox notes:
 *   - The position number shown is the CURRENT pool counter + 1 (a
 *     pure read, computed server-side in domain/previewToken.ts). It
 *     reads as "where your next prospect would land" — informative,
 *     not predictive, and consumes no slot.
 *   - There is no SSE connection. The behind-you counter is rendered
 *     statically as "—" because (a) the preview must not subscribe to
 *     real placements and (b) seeding a fake number could mislead.
 *   - The webinar countdown reads from the real next event (pure read).
 *     The Reserve button is non-functional in preview (no form submit).
 */

import type { PreviewWirePayload } from './PreviewPresentation';

export interface PreviewDashboardProps {
  payload: PreviewWirePayload;
  onBackToPresentation: () => void;
}

export function PreviewDashboard({
  payload,
  onBackToPresentation,
}: PreviewDashboardProps) {
  const { prospect, ba, nextEvent } = payload;
  const positionNumber = prospect.positionNumber ?? 1;
  const baFirstName = ba.firstName;

  return (
    <main className="relative min-h-screen bg-ink text-cream">
      {/* ── 1. Arrival ─────────────────────────────────────────────── */}
      <section className="border-b border-line px-6 py-16 md:px-12 md:py-24">
        <div className="mx-auto max-w-4xl">
          <button
            type="button"
            onClick={onBackToPresentation}
            className="mb-8 font-mono text-[11px] uppercase tracking-eyebrow text-cream-mute transition-colors hover:text-cream"
          >
            ← Back to the video
          </button>
          <div className="mb-6 font-mono text-[11px] uppercase tracking-eyebrow text-gold">
            <span aria-hidden="true">— </span>
            Welcomed in by {ba.fullName}
          </div>
          <h1 className="font-display text-5xl leading-[0.96] text-cream md:text-7xl">
            {prospect.firstName},
            <br />
            you're in.
          </h1>
          <div className="mt-12 inline-flex flex-col items-start gap-2 rounded-md border border-gold/40 bg-ink-2 px-8 py-6">
            <div className="font-mono text-[11px] uppercase tracking-eyebrow text-cream-faint">
              Your position
            </div>
            <div className="font-display text-6xl text-gold md:text-7xl">
              #{positionNumber.toLocaleString()}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. LivePlace — behind-you texture (static in preview) ──── */}
      <section className="border-b border-line bg-ink-2 px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 font-mono text-[11px] uppercase tracking-eyebrow text-gold">
            <span aria-hidden="true">— </span>
            Behind you
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div>
              <div className="font-display text-6xl text-cream md:text-7xl">—</div>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-eyebrow text-cream-faint">
                Live placements arriving behind you
              </div>
              <div className="mt-3 font-body text-xs text-cream-faint">
                (Real dashboard shows a live counter via SSE; preview
                does not subscribe.)
              </div>
            </div>
            <div className="rounded-md border border-line bg-ink p-4">
              <div className="font-mono text-[11px] uppercase tracking-eyebrow text-cream-faint">
                Position stack — most recent
              </div>
              <ul className="mt-3 space-y-2 font-mono text-[11px] text-cream-mute">
                <li>· #{(positionNumber - 1).toLocaleString()} · arriving soon</li>
                <li>· #{(positionNumber - 2).toLocaleString()} · arriving soon</li>
                <li>· #{(positionNumber - 3).toLocaleString()} · arriving soon</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. YourNextMove — webinar countdown ───────────────────── */}
      <section className="border-b border-line px-6 py-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 font-mono text-[11px] uppercase tracking-eyebrow text-gold">
            <span aria-hidden="true">— </span>
            Your next move
          </div>
          <h2 className="font-display text-4xl leading-tight text-cream md:text-5xl">
            Meet the team live.
          </h2>
          {nextEvent ? (
            <div className="mt-8 rounded-md border border-teal/40 bg-ink-2 p-6">
              <div className="font-mono text-[11px] uppercase tracking-eyebrow text-teal">
                Next live call
              </div>
              <div className="mt-3 font-display text-3xl text-cream">
                {formatScheduled(nextEvent.scheduledFor)}
              </div>
              {nextEvent.hosts.length > 0 && (
                <div className="mt-2 font-body text-sm text-cream-mute">
                  Hosted by {nextEvent.hosts.join(' & ')}
                </div>
              )}
              <button
                type="button"
                disabled
                className="mt-6 cursor-not-allowed rounded-full border border-gold/40 px-6 py-3 font-mono text-xs uppercase tracking-button text-gold/60"
              >
                Reserve a seat (disabled in preview)
              </button>
            </div>
          ) : (
            <div className="mt-8 rounded-md border border-line bg-ink-2 p-6">
              <div className="font-body text-sm text-cream-mute">
                No upcoming live call seeded — check back soon.
              </div>
            </div>
          )}
          <p className="mt-8 max-w-xl font-body text-sm text-cream-mute">
            On the real dashboard {baFirstName} also receives an SMS the
            moment your prospect submits a callback intent. Preview does
            not submit either.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="px-6 py-12 md:px-12">
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

/** Format an ISO scheduledFor for the countdown card display. */
function formatScheduled(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
}

export default PreviewDashboard;
