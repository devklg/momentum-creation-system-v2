/**
 * tm-video-presentation / Section 4 — The Market
 *
 * Locked sources:
 *   • COM Design B.1 "Part 2 — The Market Opportunity" — verbatim
 *     headline: "A $6.8 Trillion Market. And A Problem Nobody Has Solved."
 *   • Handoff B Section 4 — 4-tile grid per locked-spec Part 1.6
 *     (handoff explicitly resolves the 3-vs-4 tile question in favor
 *     of FOUR per locked-spec). Tile style: dark card, gold number,
 *     cream label, teal source citation. Numbers count up on scroll.
 *   • Handoff B Section 4 — pull-quote below the grid:
 *     "You are watching a generational shift in how people manage
 *      weight. It has already started. It is accelerating."
 *
 * The 4 tiles (locked-spec 1.6 / handoff):
 *   1. $6.8T global wellness economy   — Global Wellness Institute, 2025
 *   2. $200B GLP-1 alternatives market — Grand View Research, 2025
 *   3. 72%+ American adults overweight — CDC, 2024
 *   4. $1,200/mo synthetic GLP-1 cost  — J.P. Morgan / WebMD / AMA, 2025-2026
 *
 * The two stats A's COM B.1 lists that B drops (10M+ Americans on
 * GLP-1; 70% accessibility gap) are NOT rendered, per Kevin's locked
 * choice to use B's 4-tile selection. Surfaced in the handoff readback.
 *
 * Compliance: every statistic carries its source. No income, no comp.
 */

import { useEffect, useRef, useState } from "react";

interface MarketStat {
  value: string;          // display string (e.g. "$6.8T")
  countTarget?: number;   // numeric target for count-up; if absent, no count-up
  countPrefix?: string;   // e.g. "$"
  countSuffix?: string;   // e.g. "T", "B", "%", "/mo"
  label: string;
  source: string;
}

// COPY: tiles per locked-spec 1.6 / handoff B Section 4.
const STATS: MarketStat[] = [
  {
    value: "$6.8T",
    countTarget: 6.8,
    countPrefix: "$",
    countSuffix: "T",
    label: "global wellness economy",
    source: "Global Wellness Institute, 2025",
  },
  {
    value: "$200B",
    countTarget: 200,
    countPrefix: "$",
    countSuffix: "B",
    label: "GLP-1 alternatives market projected by 2033",
    source: "Grand View Research, 2025",
  },
  {
    value: "72%+",
    countTarget: 72,
    countSuffix: "%+",
    label: "American adults overweight or obese",
    source: "CDC, 2024",
  },
  {
    value: "$1,200",
    countTarget: 1200,
    countPrefix: "$",
    countSuffix: "/mo",
    label: "average synthetic GLP-1 cost without insurance",
    source: "J.P. Morgan / WebMD / AMA, 2025–2026",
  },
];

export function Market() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setAnimated(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="tm-market" aria-label="The Market">
      <div className="tm-market__inner">
        <h2 className="tm-market__headline">
          A $6.8 Trillion Market.
          <br />
          And A Problem Nobody Has Solved.
        </h2>

        <div className="tm-market__grid">
          {STATS.map((s, i) => (
            <MarketTile key={i} stat={s} animated={animated} delay={i * 120} />
          ))}
        </div>

        <p className="tm-market__pullquote">
          You are watching a generational shift in how people manage weight.
          It has already started. It is accelerating.
        </p>
      </div>
      <style>{styles}</style>
    </section>
  );
}

interface MarketTileProps {
  stat: MarketStat;
  animated: boolean;
  delay: number;
}
function MarketTile({ stat, animated, delay }: MarketTileProps) {
  const [display, setDisplay] = useState<string>(() =>
    stat.countTarget !== undefined ? formatCount(0, stat) : stat.value
  );

  useEffect(() => {
    if (!animated || stat.countTarget === undefined) {
      setDisplay(stat.value);
      return;
    }
    const target = stat.countTarget;
    const durationMs = 1400;
    const startedAt = performance.now() + delay;
    let frame = 0;
    let cancelled = false;
    const tick = (now: number) => {
      if (cancelled) return;
      if (now < startedAt) {
        frame = requestAnimationFrame(tick);
        return;
      }
      const t = Math.min(1, (now - startedAt) / durationMs);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const v = target * eased;
      setDisplay(formatCount(v, stat));
      if (t < 1) frame = requestAnimationFrame(tick);
      else setDisplay(stat.value);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [animated, delay, stat]);

  return (
    <div
      className={`tm-market__tile${animated ? " is-animated" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="tm-market__value">{display}</div>
      <div className="tm-market__label">{stat.label}</div>
      <div className="tm-market__source">{stat.source}</div>
    </div>
  );
}

function formatCount(v: number, stat: MarketStat): string {
  const target = stat.countTarget ?? 0;
  let body: string;
  // Numbers with decimal in the locked display ($6.8T) — show 1 decimal
  if (target % 1 !== 0) {
    body = v.toFixed(1);
  } else if (target >= 1000) {
    body = Math.round(v).toLocaleString();
  } else {
    body = Math.round(v).toString();
  }
  return `${stat.countPrefix ?? ""}${body}${stat.countSuffix ?? ""}`;
}

const styles = `
  .tm-market {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-market__inner {
    max-width: 1180px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(28px, 4vw, 48px);
  }
  .tm-market__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 72px);
    line-height: 1.04;
    letter-spacing: 0.005em;
    color: #F5EFE6;
    margin: 0;
    max-width: 22ch;
  }

  .tm-market__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: clamp(14px, 2vw, 22px);
    width: 100%;
  }

  .tm-market__tile {
    background: #131312;
    border: 1px solid rgba(201, 168, 76, 0.18);
    border-radius: 4px;
    padding: clamp(20px, 2.4vw, 32px) clamp(18px, 2vw, 26px);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(16px);
    transition: opacity 700ms cubic-bezier(0.2, 0.65, 0.2, 1),
                transform 700ms cubic-bezier(0.2, 0.65, 0.2, 1);
  }
  .tm-market__tile.is-animated {
    opacity: 1;
    transform: none;
  }
  .tm-market__value {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(40px, 5.2vw, 72px);
    line-height: 1;
    letter-spacing: 0.005em;
    color: #F5C030;
    font-variant-numeric: tabular-nums;
  }
  .tm-market__label {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(13px, 1.05vw, 15px);
    line-height: 1.4;
    color: #F5EFE6;
    max-width: 22ch;
  }
  .tm-market__source {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #2DD4BF;
    margin-top: 4px;
  }

  .tm-market__pullquote {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(22px, 2.8vw, 36px);
    line-height: 1.25;
    color: #C9A84C;
    margin: 0;
    max-width: 36ch;
    letter-spacing: 0.005em;
  }

  @media (prefers-reduced-motion: reduce) {
    .tm-market__tile { opacity: 1; transform: none; transition: none; }
  }
`;

export default Market;
