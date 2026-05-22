/**
 * tm-prospect-dashboard — the post-video_complete prospect surface.
 *
 * Locked sources:
 *   - Chat #82 (the conversation where this six-section design was
 *     locked) — see project knowledge dashboard-prototype.html.
 *   - locked-spec Part 3.4 (six-section dashboard).
 *   - locked-spec Part 3.9 (never anonymous; both prospect and BA
 *     interpolated everywhere).
 *   - locked-spec Part 3.10 (compliance — never on .com).
 *   - locked-spec Part 4.4 (live ticker, SSE, monotonic positions).
 *   - locked-spec Part 3.8 (brand isolation — Team Magnificent only,
 *     no THREE branding in footer or anywhere prospect-facing).
 *   - Chat #84 correction (Section 4 shows team being built BENEATH
 *     the prospect; the 'ahead-of-you' tile from the prototype was a
 *     pre-Chat-#84 artifact and is dropped here).
 *
 * Sections (vertical scroll, in render order):
 *   1. Arrival          — invited-by line, position card, headline.
 *   2. Opportunity      — market stat grid ($6.8T / $200B / 72% / $1,200).
 *   3. Mechanic         — Power of 2 cascade, 100,000 destination.
 *   4. LivePlace        — behind-only counter + live ticker (SSE).
 *   5. TmAdvantage      — Kevin quote, 100,000 mission board, pool
 *                         activity grid, compounding closer.
 *   6. YourNextMove     — callback form (3 intents) + webinar tile.
 *
 * Footer drift correction applied per Chat #112 build-state audit:
 *   the prototype's "An operational team inside THREE International"
 *   line VIOLATES locked-spec 3.8. The dashboard footer here carries
 *   the Team Magnificent line only.
 */

import { useMemo } from 'react';

import { ArrivalSection } from './sections/01-Arrival';
import { OpportunitySection } from './sections/02-Opportunity';
import { MechanicSection } from './sections/03-Mechanic';
import { LivePlaceSection } from './sections/04-LivePlace';
import { TmAdvantageSection } from './sections/05-TmAdvantage';
import { YourNextMoveSection } from './sections/06-YourNextMove';
import { DashboardRibbon } from './sections/00-Ribbon';
import { DashboardFooter } from './sections/07-Footer';
import { usePlacementStream } from '@/lib/usePlacementStream';

export interface TmProspectDashboardProps {
  token: string;
  prospectFirstName: string;
  baFullName: string;
  positionNumber: number;
  placedAt: string;
  /**
   * Next upcoming webinar event resolved server-side at /api/p/:token.
   * Null when no upcoming event is seeded. Forwarded to Section 6 so
   * the Countdown can render a real ticking countdown to scheduledFor.
   * Chat #115.
   */
  nextEvent: {
    eventId: string;
    scheduledFor: string;
    hosts: string[];
  } | null;
}

export function TmProspectDashboard(props: TmProspectDashboardProps) {
  const { token, prospectFirstName, baFullName, positionNumber, placedAt, nextEvent } = props;

  const baFirstName = useMemo(
    () => baFullName.trim().split(/\s+/)[0] ?? baFullName,
    [baFullName],
  );

  // Live placement stream — powers Section 4's beneath-you counter and
  // the position-stack ticker. Snapshot on connect, placement events on
  // every team-wide video_complete. See lib/usePlacementStream.ts.
  const stream = usePlacementStream(token);

  return (
    <main className="tm-prospect-dashboard">
      <DashboardRibbon />
      <ArrivalSection
        prospectFirstName={prospectFirstName}
        baFullName={baFullName}
        baFirstName={baFirstName}
        positionNumber={positionNumber}
        placedAt={placedAt}
      />
      <OpportunitySection />
      <MechanicSection />
      <LivePlaceSection
        prospectFirstName={prospectFirstName}
        positionNumber={positionNumber}
        stream={stream}
      />
      <TmAdvantageSection token={token} baFirstName={baFirstName} positionNumber={positionNumber} />
      <YourNextMoveSection
        token={token}
        baFullName={baFullName}
        baFirstName={baFirstName}
        nextEvent={nextEvent}
      />
      <DashboardFooter />

      <DashboardShellStyles />
    </main>
  );
}

export default TmProspectDashboard;

/**
 * Shell styles — the ink background, atmospheric gradient mesh, film
 * grain, and shared scaffolding for every section. Mirrors the
 * tm-video-presentation shell so the transition from video to dashboard
 * feels seamless. The atmosphere is fixed-position and z-indexed
 * underneath section content.
 */
function DashboardShellStyles() {
  return <style>{shellCss}</style>;
}

const shellCss = `
  .tm-prospect-dashboard {
    position: relative;
    min-height: 100svh;
    background: #0A0A0A;
    color: #F5EFE6;
    font-family: 'DM Sans', system-ui, sans-serif;
    overflow-x: hidden;
  }
  .tm-prospect-dashboard::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(900px circle at 12% 8%, rgba(201, 168, 76, 0.10), transparent 55%),
      radial-gradient(700px circle at 88% 95%, rgba(45, 212, 191, 0.08), transparent 55%),
      radial-gradient(500px circle at 50% 50%, rgba(201, 168, 76, 0.04), transparent 60%);
    pointer-events: none;
    z-index: 0;
  }
  .tm-prospect-dashboard::after {
    content: '';
    position: fixed;
    inset: 0;
    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.96 0 0 0 0 0.93 0 0 0 0 0.85 0 0 0 0.04 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>");
    pointer-events: none;
    z-index: 1;
    opacity: 0.6;
  }
  .tm-prospect-dashboard > * {
    position: relative;
    z-index: 2;
  }
  .tm-prospect-dashboard section {
    padding: clamp(40px, 6vw, 88px) clamp(20px, 5vw, 56px);
    border-bottom: 1px solid rgba(245, 239, 230, 0.08);
    position: relative;
  }
  .tm-prospect-dashboard .eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
    display: inline-flex;
    align-items: center;
    gap: 10px;
  }
  .tm-prospect-dashboard .eyebrow::before {
    content: '';
    width: 24px;
    height: 1px;
    background: #C9A84C;
  }
  .tm-prospect-dashboard h1,
  .tm-prospect-dashboard h2,
  .tm-prospect-dashboard h3 {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 0.96;
  }
  .tm-prospect-dashboard h1 { font-size: clamp(48px, 8.5vw, 112px); }
  .tm-prospect-dashboard h2 { font-size: clamp(36px, 5.5vw, 72px); }
  .tm-prospect-dashboard h3 { font-size: clamp(22px, 3vw, 32px); }
  @keyframes tmpd-rise {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes tmpd-pulse {
    0%   { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.6); }
    70%  { box-shadow: 0 0 0 10px rgba(45, 212, 191, 0); }
    100% { box-shadow: 0 0 0 0 rgba(45, 212, 191, 0); }
  }
  @keyframes tmpd-fresh {
    0%   { background: rgba(45, 212, 191, 0.25); transform: translateX(-8px); opacity: 0; }
    25%  { opacity: 1; transform: translateX(0); }
    100% { background: transparent; }
  }
`;
