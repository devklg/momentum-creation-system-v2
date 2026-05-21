/**
 * Section 1 — Arrival.
 *
 * The first thing the prospect sees after the video completes and
 * the page transitions from tm-video-presentation to the dashboard.
 *
 * Locked elements (Chat #82 dashboard-prototype + locked-spec 3.4):
 *   - "Invited by [BA full name]" eyebrow line (locked-spec 3.9 —
 *     never anonymous)
 *   - Headline: "You saw it. You're [in]." with 'in' in gold-bright
 *   - Subtitle paragraph
 *   - Position card: position number, "Held in [BA first]'s leg"
 *     copy (note: this is the demonstration framing, not a binary
 *     placement promise — the prototype copy is compliance-safe),
 *     placement timestamp
 *
 * Animations: each element rises in sequence on mount, matching the
 * prototype's staggered entrance.
 */

export interface ArrivalSectionProps {
  prospectFirstName: string;
  baFullName: string;
  baFirstName: string;
  positionNumber: number;
  placedAt: string;
}

export function ArrivalSection(props: ArrivalSectionProps) {
  const { baFullName, baFirstName, positionNumber, placedAt } = props;
  const placedDisplay = formatPlacedAt(placedAt);

  return (
    <>
      <section className="tmpd-arrival">
        <div className="tmpd-arrival-invited">
          Invited by <span className="tmpd-arrival-baname">{baFullName}</span>
        </div>

        <h1>
          You saw it.<br />
          You&rsquo;re <span className="tmpd-arrival-gold">in.</span>
        </h1>

        <p className="tmpd-arrival-sub">
          The video did its work. You&rsquo;re now part of the team that&rsquo;s
          building the fastest-moving wellness movement in network marketing.
          Welcome.
        </p>

        <div className="tmpd-position-card">
          <div>
            <div className="tmpd-position-label">Your position</div>
            <div className="tmpd-position-number">
              <span className="tmpd-position-prefix">#</span>
              {positionNumber}
            </div>
          </div>
          <div className="tmpd-position-copy">
            <h3>Held in {baFirstName}&rsquo;s leg</h3>
            <p>
              You&rsquo;ve been placed in the Team Magnificent holding tank —
              the live demonstration of how the team is forming around you,
              in real time.
            </p>
          </div>
          <div className="tmpd-position-stamp">
            <div>Placement</div>
            <div className="tmpd-position-stamp-when">{placedDisplay}</div>
          </div>
        </div>
      </section>
      <style>{arrivalCss}</style>
    </>
  );
}

/**
 * Format an ISO timestamp as e.g. "02:47 PT · today".
 * Time-zone awareness defers to the prospect's local timezone; the
 * "today/yesterday" anchor is computed against the same locale.
 * Server captures placedAt in UTC; this renders it locally.
 */
function formatPlacedAt(isoTimestamp: string): string {
  try {
    const placed = new Date(isoTimestamp);
    if (Number.isNaN(placed.getTime())) return '';
    const now = new Date();
    const timePart = placed.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const tzAbbrev = placed
      .toLocaleTimeString(undefined, { timeZoneName: 'short' })
      .split(' ')
      .pop() ?? '';
    const sameDay =
      placed.getFullYear() === now.getFullYear() &&
      placed.getMonth() === now.getMonth() &&
      placed.getDate() === now.getDate();
    const dayPart = sameDay ? 'today' : placed.toLocaleDateString();
    return `${timePart} ${tzAbbrev} · ${dayPart}`;
  } catch {
    return '';
  }
}

const arrivalCss = `
  .tmpd-arrival {
    min-height: 78vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding-top: clamp(56px, 8vw, 120px) !important;
    padding-bottom: clamp(56px, 8vw, 120px) !important;
  }
  .tmpd-arrival-invited {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 13px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
    margin-bottom: 28px;
    opacity: 0;
    animation: tmpd-rise 0.9s cubic-bezier(.2,.7,.2,1) 0.1s forwards;
  }
  .tmpd-arrival-baname {
    color: #C9A84C;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: none;
    font-size: 15px;
  }
  .tmpd-arrival h1 {
    color: #F5EFE6;
    margin-bottom: 24px;
    max-width: 14ch;
    opacity: 0;
    animation: tmpd-rise 1s cubic-bezier(.2,.7,.2,1) 0.3s forwards;
  }
  .tmpd-arrival-gold { color: #F5C030; }
  .tmpd-arrival-sub {
    font-size: clamp(17px, 1.8vw, 21px);
    color: rgba(245, 239, 230, 0.62);
    max-width: 56ch;
    line-height: 1.5;
    margin-bottom: 56px;
    opacity: 0;
    animation: tmpd-rise 1s cubic-bezier(.2,.7,.2,1) 0.55s forwards;
  }
  .tmpd-position-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: clamp(24px, 4vw, 56px);
    align-items: center;
    padding: clamp(24px, 3.5vw, 40px) clamp(24px, 4vw, 48px);
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.10), rgba(45, 212, 191, 0.05));
    border: 1px solid #C9A84C;
    border-radius: 4px;
    position: relative;
    overflow: hidden;
    opacity: 0;
    animation: tmpd-rise 1.1s cubic-bezier(.2,.7,.2,1) 0.8s forwards;
  }
  .tmpd-position-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(400px circle at 0% 100%, rgba(201, 168, 76, 0.18), transparent 60%);
    pointer-events: none;
  }
  .tmpd-position-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #C9A84C;
    margin-bottom: 8px;
  }
  .tmpd-position-number {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(80px, 14vw, 168px);
    line-height: 0.85;
    color: #F5C030;
    letter-spacing: -0.02em;
    text-shadow: 0 0 40px rgba(201, 168, 76, 0.4);
  }
  .tmpd-position-prefix {
    font-size: 0.5em;
    color: #C9A84C;
    vertical-align: top;
    margin-right: 4px;
  }
  .tmpd-position-copy h3 {
    color: #F5EFE6;
    margin-bottom: 8px;
    letter-spacing: 0.04em;
  }
  .tmpd-position-copy p {
    color: rgba(245, 239, 230, 0.62);
    font-size: 15px;
    max-width: 36ch;
  }
  .tmpd-position-stamp {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #2DD4BF;
    border-left: 1px solid rgba(201, 168, 76, 0.18);
    padding-left: 20px;
    text-align: left;
  }
  .tmpd-position-stamp-when {
    color: rgba(245, 239, 230, 0.62);
    margin-top: 6px;
  }
  @media (max-width: 720px) {
    .tmpd-position-card { grid-template-columns: 1fr; text-align: left; }
    .tmpd-position-stamp {
      border-left: none;
      border-top: 1px solid rgba(201, 168, 76, 0.18);
      padding-left: 0;
      padding-top: 16px;
    }
  }
`;
