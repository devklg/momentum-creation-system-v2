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

import { useEffect, useMemo, useState } from 'react';
import type { ComProspectCopy } from '@momentum/shared';

import { ArrivalSection } from './sections/01-Arrival';
import { OpportunitySection } from './sections/02-Opportunity';
import { MechanicSection } from './sections/03-Mechanic';
import { LivePlaceSection } from './sections/04-LivePlace';
import { TmAdvantageSection } from './sections/05-TmAdvantage';
import { YourNextMoveSection } from './sections/06-YourNextMove';
import { DashboardRibbon } from './sections/00-Ribbon';
import { DashboardFooter } from './sections/07-Footer';
import { usePlacementStream } from '@/lib/usePlacementStream';
import { fetchTeamStats, type TeamStatsResponse } from '@/lib/api';

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
  /**
   * Chat #126: when the dashboard was reached from the presentation
   * (the normal path via the WhatsNext closer / ?view=dashboard), the
   * composer passes this so the ribbon can render a "Back to the video"
   * link, letting the prospect return to the reference library and
   * re-watch / re-read. Optional so a future standalone mount can omit it.
   */
  onBackToPresentation?: () => void;
  /**
   * Master-content-resolved copy for the six dashboard sections (TASK-147
   * inherit-com), resolved + interpolated server-side. Each section reads its
   * own lead string from here and falls back to its built-in copy when the
   * field is absent (older server / master-content read failure).
   */
  copy?: ComProspectCopy | null;
}

export function TmProspectDashboard(props: TmProspectDashboardProps) {
  const { token, prospectFirstName, baFullName, positionNumber, placedAt, nextEvent, copy, onBackToPresentation } = props;

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
      <DashboardRibbon onBack={onBackToPresentation} />
      <PositionMomentumCenter
        prospectFirstName={prospectFirstName}
        baFullName={baFullName}
        baFirstName={baFirstName}
        positionNumber={positionNumber}
        placedAt={placedAt}
        nextEvent={nextEvent}
        stream={stream}
        token={token}
      />
      <ArrivalSection
        prospectFirstName={prospectFirstName}
        baFullName={baFullName}
        baFirstName={baFirstName}
        positionNumber={positionNumber}
        placedAt={placedAt}
        copy={copy?.dashboardArrival}
      />
      <OpportunitySection copy={copy?.dashboardOpportunity} />
      <MechanicSection copy={copy?.dashboardMechanic} />
      <LivePlaceSection
        prospectFirstName={prospectFirstName}
        positionNumber={positionNumber}
        placedAt={placedAt}
        stream={stream}
        copy={copy?.dashboardLivePlace}
      />
      <TmAdvantageSection token={token} baFirstName={baFirstName} positionNumber={positionNumber} copy={copy?.dashboardAdvantage} />
      <YourNextMoveSection
        token={token}
        baFullName={baFullName}
        baFirstName={baFirstName}
        nextEvent={nextEvent}
        copy={copy?.dashboardCallbackCta}
      />
      <DashboardFooter />

      <DashboardShellStyles />
    </main>
  );
}

export default TmProspectDashboard;

function PositionMomentumCenter(props: {
  prospectFirstName: string;
  baFullName: string;
  baFirstName: string;
  positionNumber: number;
  placedAt: string;
  nextEvent: TmProspectDashboardProps['nextEvent'];
  stream: ReturnType<typeof usePlacementStream>;
  token: string;
}) {
  const {
    prospectFirstName,
    baFullName,
    baFirstName,
    positionNumber,
    placedAt,
    nextEvent,
    stream,
    token,
  } = props;
  const beneathYou = Math.max(0, stream.globalMaxPosition - positionNumber);
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTeamStats(token).then((result) => {
      if (!cancelled && result.ok) setStats(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const ticker = stream.ticker
    .filter((entry) => entry.positionNumber !== positionNumber)
    .slice(0, 6);

  return (
    <section className="tmpd-center" aria-labelledby="tmpd-center-title">
      <div className="tmpd-center-brandline">
        <span className="tm-logo tm-logo--navbar" role="img" aria-label="Team Magnificent" />
        <span className="tmpd-center-live">
          <span className="tmpd-center-live-dot" />
          Live position center
        </span>
      </div>

      <div className="tmpd-center-grid">
        <div className="tmpd-center-lead">
          <div className="tmpd-center-eyebrow">Invited by {baFullName}</div>
          <h1 id="tmpd-center-title">
            {prospectFirstName}, this is where you are.
          </h1>
          <p>
            Your video is complete, your position is live, and the team is still
            moving beneath you. The next step is simple: talk with {baFirstName}
            when you are ready.
          </p>
          <div className="tmpd-center-actions">
            <a href="#tmpd-talk-to-ba" className="tmpd-center-primary">
              Talk with {baFirstName}
            </a>
            <a href="#tmpd-live-place" className="tmpd-center-secondary">
              Watch live motion
            </a>
          </div>
        </div>

        <div className="tmpd-center-position" aria-label={`Your position is ${positionNumber}`}>
          <span className="tmpd-center-position-label">Your position</span>
          <span className="tmpd-center-position-number">#{positionNumber}</span>
          <span className="tmpd-center-position-meta">
            Placed {formatPlacedAtCompact(placedAt)}
          </span>
        </div>

        <div className="tmpd-center-panel tmpd-center-beneath">
          <span className="tmpd-center-panel-kicker">Beneath you · live</span>
          <strong>{beneathYou}</strong>
          <span>
            New placements joining the team after your position as Team
            Magnificent grows.
          </span>
        </div>

        <div className="tmpd-center-panel tmpd-center-countdown">
          <span className="tmpd-center-panel-kicker">Next live decision point</span>
          <CenterCountdown scheduledFor={nextEvent?.scheduledFor ?? null} />
        </div>
      </div>

      <div className="tmpd-center-bottom">
        <div className="tmpd-center-ticker" aria-label="Recent team placements">
          <div className="tmpd-center-ticker-head">
            <span>Team momentum tape</span>
            <span>{stream.errored ? 'Reconnecting' : stream.connected ? 'Live' : 'Connecting'}</span>
          </div>
          <div className="tmpd-center-ticker-rows">
            {ticker.length === 0 ? (
              <div className="tmpd-center-ticker-empty">
                {stream.connecting
                  ? 'Connecting to the live position stream.'
                  : 'The next team placement will appear here.'}
              </div>
            ) : (
              ticker.map((entry) => (
                <div key={`${entry.positionNumber}-${entry.placedAt}`} className="tmpd-center-ticker-row">
                  <span>#{entry.positionNumber}</span>
                  <span>
                    {entry.firstName} {entry.lastInitial}.
                    {entry.city ? ` from ${entry.city}${entry.stateOrRegion ? `, ${entry.stateOrRegion}` : ''}` : ''}
                  </span>
                  <span>{formatClock(entry.placedAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {stats && (
          <div className="tmpd-center-stats" aria-label="Compact live team stats">
            <CenterStat value={stats.basActive24h} label="BAs active · 24h" />
            <CenterStat value={stats.invitationsSentToday} label="Invites today" />
            <CenterStat value={stats.newPlacements24h} label="Placements · 24h" />
          </div>
        )}
      </div>
    </section>
  );
}

function CenterCountdown({ scheduledFor }: { scheduledFor: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!scheduledFor) return;
    const target = new Date(scheduledFor).getTime();
    if (!Number.isFinite(target)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [scheduledFor]);

  if (!scheduledFor) {
    return (
      <div className="tmpd-center-event-fallback">
        Next Team Magnificent live · check back soon
      </div>
    );
  }

  const target = new Date(scheduledFor).getTime();
  if (!Number.isFinite(target)) {
    return (
      <div className="tmpd-center-event-fallback">
        Next Team Magnificent live · check back soon
      </div>
    );
  }

  const totalSeconds = Math.max(0, Math.floor((target - now) / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <>
      <div className="tmpd-center-countdown-grid">
        <CenterCountdownUnit value={days} label="days" />
        <CenterCountdownUnit value={hours} label="hrs" />
        <CenterCountdownUnit value={minutes} label="min" />
        <CenterCountdownUnit value={seconds} label="sec" />
      </div>
      <div className="tmpd-center-event-when">{formatEventWhen(scheduledFor)}</div>
    </>
  );
}

function CenterCountdownUnit(props: { value: number; label: string }) {
  return (
    <span className="tmpd-center-countdown-unit">
      <strong>{props.value < 10 ? `0${props.value}` : props.value}</strong>
      <span>{props.label}</span>
    </span>
  );
}

function CenterStat(props: { value: number; label: string }) {
  return (
    <div className="tmpd-center-stat">
      <strong>{props.value.toLocaleString()}</strong>
      <span>{props.label}</span>
    </div>
  );
}

function formatPlacedAtCompact(iso: string): string {
  const clock = formatClock(iso);
  return clock ? `at ${clock}` : 'just now';
}

function formatClock(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

function formatEventWhen(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return '';
  }
}

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
  .tmpd-center {
    min-height: calc(100svh - 64px);
    display: grid;
    align-content: center;
    gap: clamp(20px, 3vw, 32px);
    padding-top: clamp(28px, 4vw, 52px) !important;
    padding-bottom: clamp(28px, 4vw, 52px) !important;
    background:
      radial-gradient(780px circle at 12% 12%, rgba(201, 168, 76, 0.16), transparent 58%),
      radial-gradient(720px circle at 92% 20%, rgba(45, 212, 191, 0.12), transparent 54%),
      rgba(10, 10, 10, 0.92);
  }
  .tmpd-center-brandline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .tmpd-center-live,
  .tmpd-center-eyebrow,
  .tmpd-center-panel-kicker,
  .tmpd-center-ticker-head,
  .tmpd-center-stat span,
  .tmpd-center-position-label,
  .tmpd-center-position-meta,
  .tmpd-center-event-when,
  .tmpd-center-event-fallback {
    font-family: 'DM Mono', ui-monospace, monospace;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  .tmpd-center-live {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    color: #2DD4BF;
    font-size: 12px;
  }
  .tmpd-center-live-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    background: #2DD4BF;
    animation: tmpd-pulse 2s infinite;
  }
  .tmpd-center-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.72fr);
    grid-template-areas:
      'lead position'
      'lead beneath'
      'lead countdown';
    gap: clamp(14px, 2vw, 22px);
    align-items: stretch;
  }
  .tmpd-center-lead {
    grid-area: lead;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-right: clamp(0px, 3vw, 32px);
  }
  .tmpd-center-eyebrow {
    color: #C9A84C;
    font-size: 12px;
    margin-bottom: 18px;
  }
  .tmpd-center h1 {
    max-width: 12ch;
    margin: 0 0 18px;
    color: #F5EFE6;
    font-size: clamp(56px, 8vw, 118px);
  }
  .tmpd-center-lead p {
    max-width: 52ch;
    color: rgba(245, 239, 230, 0.7);
    font-size: clamp(16px, 1.5vw, 19px);
    line-height: 1.55;
    margin: 0 0 26px;
  }
  .tmpd-center-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .tmpd-center-primary,
  .tmpd-center-secondary {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid #C9A84C;
    padding: 0 18px;
    color: #0A0A0A;
    background: #C9A84C;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: 0;
    text-decoration: none;
    text-transform: uppercase;
  }
  .tmpd-center-secondary {
    color: #2DD4BF;
    background: rgba(45, 212, 191, 0.08);
    border-color: rgba(45, 212, 191, 0.45);
  }
  .tmpd-center-position,
  .tmpd-center-panel,
  .tmpd-center-ticker,
  .tmpd-center-stats {
    border: 1px solid rgba(245, 239, 230, 0.12);
    background: rgba(15, 15, 15, 0.78);
    box-shadow: 0 20px 70px rgba(0, 0, 0, 0.22);
  }
  .tmpd-center-position {
    grid-area: position;
    display: grid;
    min-height: 190px;
    align-content: center;
    padding: 24px;
    border-color: rgba(201, 168, 76, 0.42);
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.14), rgba(15, 15, 15, 0.82));
  }
  .tmpd-center-position-label,
  .tmpd-center-panel-kicker {
    color: #C9A84C;
    font-size: 11px;
  }
  .tmpd-center-position-number {
    color: #F5C030;
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(80px, 10vw, 132px);
    line-height: 0.86;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  .tmpd-center-position-meta {
    color: rgba(245, 239, 230, 0.58);
    font-size: 11px;
  }
  .tmpd-center-panel {
    display: grid;
    gap: 8px;
    align-content: center;
    min-height: 128px;
    padding: 20px;
  }
  .tmpd-center-beneath { grid-area: beneath; border-color: rgba(45, 212, 191, 0.36); }
  .tmpd-center-countdown { grid-area: countdown; border-color: rgba(45, 212, 191, 0.24); }
  .tmpd-center-panel strong {
    color: #2DD4BF;
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(46px, 6vw, 76px);
    line-height: 0.9;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  .tmpd-center-panel span:last-child,
  .tmpd-center-event-fallback {
    color: rgba(245, 239, 230, 0.62);
    font-size: 13px;
    line-height: 1.45;
  }
  .tmpd-center-countdown-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
  }
  .tmpd-center-countdown-unit {
    display: grid;
    place-items: center;
    min-height: 58px;
    border: 1px solid rgba(45, 212, 191, 0.22);
    background: rgba(45, 212, 191, 0.06);
  }
  .tmpd-center-countdown-unit strong {
    color: #2DD4BF;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 30px;
    line-height: 1;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  .tmpd-center-countdown-unit span {
    color: rgba(245, 239, 230, 0.58);
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    line-height: 1;
    letter-spacing: 0;
    text-transform: uppercase;
  }
  .tmpd-center-event-when {
    color: rgba(245, 239, 230, 0.62);
    font-size: 10px;
  }
  .tmpd-center-bottom {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(240px, 0.48fr);
    gap: clamp(14px, 2vw, 22px);
  }
  .tmpd-center-ticker {
    min-width: 0;
    overflow: hidden;
  }
  .tmpd-center-ticker-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 38px;
    padding: 0 14px;
    border-bottom: 1px solid rgba(245, 239, 230, 0.1);
    color: #C9A84C;
    font-size: 10px;
  }
  .tmpd-center-ticker-head span:last-child { color: #2DD4BF; }
  .tmpd-center-ticker-rows {
    display: grid;
  }
  .tmpd-center-ticker-row,
  .tmpd-center-ticker-empty {
    min-height: 38px;
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border-bottom: 1px solid rgba(245, 239, 230, 0.06);
    color: rgba(245, 239, 230, 0.68);
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0;
  }
  .tmpd-center-ticker-row span:first-child {
    color: #2DD4BF;
  }
  .tmpd-center-ticker-row span:nth-child(2) {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .tmpd-center-ticker-row span:last-child {
    color: rgba(245, 239, 230, 0.42);
  }
  .tmpd-center-ticker-empty {
    grid-template-columns: 1fr;
    color: rgba(245, 239, 230, 0.5);
  }
  .tmpd-center-stats {
    display: grid;
    grid-template-columns: 1fr;
  }
  .tmpd-center-stat {
    display: grid;
    gap: 4px;
    align-content: center;
    min-height: 76px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tmpd-center-stat strong {
    color: #2DD4BF;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 38px;
    line-height: 0.9;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }
  .tmpd-center-stat span {
    color: rgba(245, 239, 230, 0.58);
    font-size: 10px;
  }
  @media (max-width: 980px) {
    .tmpd-center {
      min-height: auto;
      align-content: start;
    }
    .tmpd-center-grid {
      grid-template-columns: 1fr;
      grid-template-areas:
        'lead'
        'position'
        'beneath'
        'countdown';
    }
    .tmpd-center-bottom {
      grid-template-columns: 1fr;
    }
    .tmpd-center-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  @media (max-width: 620px) {
    .tmpd-center-brandline,
    .tmpd-center-actions {
      align-items: flex-start;
      flex-direction: column;
    }
    .tmpd-center h1 {
      font-size: clamp(46px, 15vw, 72px);
    }
    .tmpd-center-countdown-grid,
    .tmpd-center-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .tmpd-center-ticker-row {
      grid-template-columns: 58px minmax(0, 1fr);
    }
    .tmpd-center-ticker-row span:last-child {
      display: none;
    }
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
  @media (prefers-reduced-motion: reduce) {
    .tmpd-center-live-dot {
      animation: none;
    }
  }
`;
