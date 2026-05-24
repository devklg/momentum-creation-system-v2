/**
 * Section 4 — Live Place. The team building beneath the prospect, in
 * real time.
 *
 * Chat #84 correction (applied this session): the prototype's
 * "ahead-of-you" tile is dropped. The Section shows only the team
 * being placed BENEATH the prospect — the demonstration of how the
 * team is built, which creates the FOMO that drives conversion.
 *
 * Layout: vertical scroll (no left/right columns). Position anchor at
 * top, beneath-you live counter, then the ticker stack flowing down.
 *
 * Live data: powered by the SSE stream resolved in the composer
 * (lib/usePlacementStream.ts). The counter reads
 *   beneath_you = max(0, globalMaxPosition - my_position)
 * which updates on every team-wide placement. The ticker prepends the
 * latest entry with a gold flash (tmpd-fresh keyframe).
 *
 * Locked-spec 4.4 entry format (verbatim):
 *   #347   Marcus T. from Los Angeles, CA · invited by Kevin G.   7:34:18 PM PT
 * The dashboard doesn't have invited-by metadata in the SSE stream by
 * design (locked-spec 3.10 — the position stream is team momentum, not
 * personal downline). The entry format here matches what the snapshot
 * data carries: position + first/last initial + city/state + time.
 *
 * Compliance (locked-spec 3.10):
 *   - The beneath-you count demonstrates team momentum.
 *   - It is NOT a downline projection — not every prospect beneath
 *     this one ends up in this prospect's binary leg.
 *   - The Section 5 footer signature "Operational architecture ·
 *     numbers of record · no performance promise" carries the lock.
 */

import type { PlacementStreamState } from '@/lib/usePlacementStream';
import type { PlacementTickerEntry } from '@momentum/shared';

export interface LivePlaceSectionProps {
  prospectFirstName: string;
  positionNumber: number;
  /** The prospect's own placement time — anchors the self-row (Chat #125). */
  placedAt: string;
  stream: PlacementStreamState;
}

export function LivePlaceSection(props: LivePlaceSectionProps) {
  const { positionNumber, placedAt, stream } = props;
  const beneathYou = Math.max(0, stream.globalMaxPosition - positionNumber);

  // The prospect's own position is anchored SEPARATELY above the ticker
  // (locked-spec 4.4: three stacked elements — own position, counter,
  // then the tape of OTHERS). The tape below shows only OTHER placements,
  // never the prospect themselves — that's why a 'You' row was leaking in
  // before (Chat #125 fix).
  const others = stream.ticker.filter(
    (entry) => entry.positionNumber !== positionNumber,
  );

  // Render order (locked-spec 4.4): newest enters at the BOTTOM and scrolls
  // upward, oldest exits at the top. The stream stores newest-first, so we
  // render a reversed copy (oldest at top, newest at bottom) WITHOUT
  // mutating the source array.
  const tape = [...others].reverse();

  // Continuous scroll needs enough entries to overflow the viewport;
  // below this we render static (no animation) so 2–3 rows don't jitter.
  const SCROLL_MIN = 8;
  const scrolling = tape.length >= SCROLL_MIN;

  return (
    <>
      <section className="tmpd-liveplace">
        <div className="eyebrow">Your place in the live team</div>
        <h2>The team is forming beneath you. Right now.</h2>
        <p className="tmpd-liveplace-lead">
          You&rsquo;re position #{positionNumber}. The numbers below update
          live. Watch what happens when you stay on this page.
        </p>

        {/* Element 1 — the prospect's OWN anchored position. */}
        <div className="tmpd-liveplace-anchor">
          <span className="tmpd-liveplace-anchor-pos">#{positionNumber}</span>
          <span className="tmpd-liveplace-anchor-who">You</span>
          <span className="tmpd-liveplace-anchor-when">{formatTime(placedAt)}</span>
        </div>

        {/* Element 2 — the beneath-you live counter. */}
        <div className="tmpd-liveplace-counter">
          <div className="tmpd-liveplace-counter-label">
            <span className="tmpd-liveplace-counter-pulse" />
            Placed beneath you · live
          </div>
          <div className="tmpd-liveplace-counter-value">{beneathYou}</div>
          <div className="tmpd-liveplace-counter-sub">
            Joining the team beneath your position as Team Magnificent grows.
          </div>
        </div>

        {/* Element 3 — the tape of OTHER placements, scrolling upward. */}
        <div className="tmpd-liveplace-stack">
          <div className="tmpd-liveplace-stack-label">
            <span>Live placements</span>
            <span className="tmpd-liveplace-stack-live">↑ growing</span>
          </div>
          <div className="tmpd-liveplace-stack-viewport">
            {tape.length === 0 && stream.connecting ? (
              <div className="tmpd-liveplace-stack-empty">Connecting&hellip;</div>
            ) : tape.length === 0 ? (
              <div className="tmpd-liveplace-stack-empty">
                You&rsquo;re first in line. The next placement will land here.
              </div>
            ) : (
              <div
                className={
                  scrolling
                    ? 'tmpd-liveplace-stack-track tmpd-liveplace-stack-track--scroll'
                    : 'tmpd-liveplace-stack-track'
                }
              >
                {tape.map((entry, idx) => (
                  <TickerEntry
                    key={`${entry.positionNumber}-${entry.placedAt}`}
                    entry={entry}
                    isFresh={idx === tape.length - 1 && stream.connected}
                  />
                ))}
                {/* Duplicate the track for a seamless loop when scrolling. */}
                {scrolling &&
                  tape.map((entry) => (
                    <TickerEntry
                      key={`dup-${entry.positionNumber}-${entry.placedAt}`}
                      entry={entry}
                      isFresh={false}
                      ariaHidden
                    />
                  ))}
              </div>
            )}
          </div>
        </div>
      </section>
      <style>{liveplaceCss}</style>
    </>
  );
}

function TickerEntry(props: {
  entry: PlacementTickerEntry;
  isFresh: boolean;
  ariaHidden?: boolean;
}) {
  const { entry, isFresh, ariaHidden } = props;
  const cls = [
    'tmpd-liveplace-stack-item',
    'tmpd-liveplace-stack-beneath',
    isFresh ? 'tmpd-liveplace-stack-fresh' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const who = `${entry.firstName} ${entry.lastInitial}.${entry.city ? ` from ${entry.city}${entry.stateOrRegion ? `, ${entry.stateOrRegion}` : ''}` : ''}`;

  return (
    <div className={cls} aria-hidden={ariaHidden ? 'true' : undefined}>
      <span className="tmpd-liveplace-stack-pos">#{entry.positionNumber}</span>
      <span className="tmpd-liveplace-stack-who">{who}</span>
      <span className="tmpd-liveplace-stack-when">{formatTime(entry.placedAt)}</span>
    </div>
  );
}

/** Absolute clock time per locked-spec 4.4 ("the tombstone not just now"). */
function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

const liveplaceCss = `
  .tmpd-liveplace { background: #0F0F0F; }
  .tmpd-liveplace h2 {
    color: #F5EFE6;
    margin-top: 14px;
    margin-bottom: 16px;
    max-width: 18ch;
  }
  .tmpd-liveplace-lead {
    font-size: clamp(17px, 1.7vw, 19px);
    color: rgba(245, 239, 230, 0.62);
    max-width: 60ch;
    margin-bottom: 40px;
  }
  .tmpd-liveplace-anchor {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: 12px;
    align-items: baseline;
    padding: 16px 18px;
    margin-bottom: 24px;
    border: 1px solid #C9A84C;
    border-radius: 4px;
    background: rgba(201, 168, 76, 0.12);
    font-family: 'DM Mono', ui-monospace, monospace;
    color: #F5C030;
  }
  .tmpd-liveplace-anchor-pos {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 26px;
    line-height: 1;
    letter-spacing: 0.02em;
  }
  .tmpd-liveplace-anchor-who {
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.06em;
    align-self: center;
  }
  .tmpd-liveplace-anchor-when {
    font-size: 11px;
    opacity: 0.7;
    align-self: center;
  }
  .tmpd-liveplace-counter {
    border: 1px solid #2DD4BF;
    background: linear-gradient(135deg, rgba(45, 212, 191, 0.10), rgba(45, 212, 191, 0.02));
    padding: 28px 32px;
    border-radius: 4px;
    margin-bottom: 32px;
    position: relative;
  }
  .tmpd-liveplace-counter-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #2DD4BF;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .tmpd-liveplace-counter-pulse {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #2DD4BF;
    border-radius: 50%;
    box-shadow: 0 0 0 0 #2DD4BF;
    animation: tmpd-pulse 2s infinite;
  }
  .tmpd-liveplace-counter-value {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(72px, 10vw, 132px);
    line-height: 0.9;
    color: #2DD4BF;
    letter-spacing: 0.01em;
    text-shadow: 0 0 40px rgba(45, 212, 191, 0.3);
  }
  .tmpd-liveplace-counter-sub {
    margin-top: 10px;
    font-size: 14px;
    color: rgba(245, 239, 230, 0.62);
  }
  .tmpd-liveplace-stack {
    border: 1px solid rgba(201, 168, 76, 0.18);
    background: #0A0A0A;
    border-radius: 4px;
    padding: 24px;
    min-height: 320px;
    max-height: 540px;
    overflow: hidden;
    position: relative;
  }
  .tmpd-liveplace-stack-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.48);
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
  }
  .tmpd-liveplace-stack-live { color: #2DD4BF; }
  .tmpd-liveplace-stack-viewport {
    position: relative;
    overflow: hidden;
    max-height: 440px;
    /* Fade the top + bottom edges so entries scroll in/out softly. */
    -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%);
    mask-image: linear-gradient(180deg, transparent 0, #000 36px, #000 calc(100% - 36px), transparent 100%);
  }
  .tmpd-liveplace-stack-track {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.06em;
  }
  /* Continuous upward scroll (locked-spec 4.4: 'never at rest'). The track
     is rendered twice; translating by -50% loops seamlessly because the
     second copy is identical to the first. */
  .tmpd-liveplace-stack-track--scroll {
    animation: tmpd-ticker-scroll 40s linear infinite;
    will-change: transform;
  }
  @keyframes tmpd-ticker-scroll {
    from { transform: translateY(0); }
    to   { transform: translateY(-50%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .tmpd-liveplace-stack-track--scroll { animation: none; }
  }
  .tmpd-liveplace-stack-empty {
    padding: 16px 10px;
    color: rgba(245, 239, 230, 0.48);
    font-style: italic;
  }
  .tmpd-liveplace-stack-item {
    display: grid;
    grid-template-columns: 64px 1fr auto;
    gap: 12px;
    padding: 10px 12px;
    border-left: 2px solid transparent;
    color: rgba(245, 239, 230, 0.62);
    transition: all 0.4s;
  }
  .tmpd-liveplace-stack-beneath { color: #2DD4BF; }
  .tmpd-liveplace-stack-fresh {
    animation: tmpd-fresh 1.6s ease;
  }
  .tmpd-liveplace-stack-pos { opacity: 0.7; }
  .tmpd-liveplace-stack-when {
    font-size: 11px;
    opacity: 0.55;
  }
`;
