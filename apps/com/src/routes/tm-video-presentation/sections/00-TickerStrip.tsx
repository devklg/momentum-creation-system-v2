/**
 * tm-video-presentation / Section 0 — Ticker Strip
 *
 * Locked source: COM Design B.1 "Ticker strip" (A1).
 * Kept per Kevin's Chat #107 decision: keep the ticker strip,
 * add it as a fixed top bar above Section 1, A1 copy.
 *
 * Visual contract (COM Design B.1):
 *   • Thin bar fixed to the top of the viewport.
 *   • Animated horizontal scroll of short messages.
 *   • Brand voice. Includes the BA personalization line.
 *   • No income, no comp, no head count.
 *
 * Copy direction transcribed from COM Design B.1 + App Description §3
 * "Ticker bar (top)" working messages. Marked as working copy per
 * COM Design H.2 — Kevin to finalize.
 */

import { useMemo } from "react";

export interface TickerStripProps {
  /** Inviting BA's first name — server-resolved from token, always present. */
  baFirstName: string;
}

export function TickerStrip({ baFirstName }: TickerStripProps) {
  // COPY: working messages from COM Design B.1 + App Description §3 ticker bar.
  // Kevin to finalize per COM Design H.2.
  const messages = useMemo(
    () => [
      `${baFirstName} personally invited you to see this`,
      `GLP-THREE launched January 2026 · trademark and patent pending`,
      `The first all-natural GLP-1 replacement`,
      `$6.8T global wellness economy · the category is moving`,
      `72% of American adults are overweight · the market is wide open`,
      `Real people. Real results. No injections, no prescription.`,
    ],
    [baFirstName]
  );

  // Duplicate the list once so the marquee can scroll a full cycle
  // without visible seams. The CSS animation translates by exactly
  // -50% over the duration.
  const doubled = [...messages, ...messages];

  return (
    <div className="tm-ticker" role="complementary" aria-label="Team Magnificent activity ticker">
      <div className="tm-ticker__track">
        {doubled.map((m, i) => (
          <span key={i} className="tm-ticker__item">
            <span className="tm-ticker__dot" aria-hidden="true" />
            <span className="tm-ticker__text">{m}</span>
          </span>
        ))}
      </div>
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .tm-ticker {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    height: 36px;
    background: rgba(10, 10, 10, 0.82);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border-bottom: 1px solid rgba(45, 212, 191, 0.32);
    overflow: hidden;
    font-family: 'DM Mono', ui-monospace, monospace;
    color: rgba(245, 239, 230, 0.78);
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
  }
  /* faint teal glow at the very top edge to telegraph "live" without shouting */
  .tm-ticker::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(45, 212, 191, 0) 5%,
      rgba(45, 212, 191, 0.55) 50%,
      rgba(45, 212, 191, 0) 95%,
      transparent 100%);
  }

  .tm-ticker__track {
    display: flex;
    flex-wrap: nowrap;
    gap: 56px;
    padding-left: 56px;
    white-space: nowrap;
    animation: tm-ticker-scroll 64s linear infinite;
    will-change: transform;
  }
  @keyframes tm-ticker-scroll {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .tm-ticker__item {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    flex-shrink: 0;
  }
  .tm-ticker__dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #2DD4BF;
    box-shadow: 0 0 8px rgba(45, 212, 191, 0.65);
    flex-shrink: 0;
  }
  .tm-ticker__text {
    color: rgba(245, 239, 230, 0.78);
  }

  @media (prefers-reduced-motion: reduce) {
    .tm-ticker__track { animation: none; }
  }
`;

export default TickerStrip;
