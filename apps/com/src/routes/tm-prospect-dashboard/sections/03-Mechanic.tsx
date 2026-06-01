/**
 * Section 3 — The Mechanic. Power of 2 cascade + 100,000 destination
 * + three principle cards.
 *
 * Compliance frame (locked-spec 3.10): structural mechanic only.
 * Never income, never placement promise. The cascade visualizes
 * doubling math (1→2→4→8→16→32→64) as the visible explanation
 * for how 100,000 qualified BAs is reached — not a personal
 * compensation projection.
 *
 * Animation: cascade nodes light up row-by-row on mount; principle
 * cards rise in beneath. Copy locked Chat #82.
 */

import { useEffect, useState } from 'react';

const CASCADE_ROWS: ReadonlyArray<{ count: number; label: string }> = [
  { count: 1, label: '1 leader' },
  { count: 2, label: '2 builders' },
  { count: 4, label: '4 builders' },
  { count: 8, label: '8 builders' },
  { count: 16, label: '16 builders' },
  { count: 32, label: '32 builders' },
  { count: 64, label: '64 builders' },
];

export interface MechanicSectionProps {
  /**
   * Master-content-resolved lead copy (`com.dashboard.mechanic`), resolved
   * server-side (TASK-147 inherit-com). Falls back to the built-in lead below.
   */
  copy?: string;
}

export function MechanicSection({ copy }: MechanicSectionProps) {
  // Sequence the rows lighting up after mount, matching the prototype.
  const [litCount, setLitCount] = useState(0);
  useEffect(() => {
    const timers: number[] = [];
    CASCADE_ROWS.forEach((_, i) => {
      const t = window.setTimeout(() => setLitCount((n) => Math.max(n, i + 1)), 600 + i * 220);
      timers.push(t);
    });
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <>
      <section className="tmpd-mechanic">
        <div className="eyebrow">How teams build in this market</div>
        <h2>Two people. Then they find two.</h2>
        <p className="tmpd-mechanic-lead">
          {copy ?? (
            <>
              The math is simple and the rhythm is fast. Each person finds{' '}
              <em>two</em>. Those two each find two. The team doubles. We move on
              a <em>72-hour</em> rhythm — speed is the multiplier, not the
              exception.
            </>
          )}
        </p>

        <div className="tmpd-cascade">
          {CASCADE_ROWS.map((row, i) => (
            <div
              key={row.count}
              className={`tmpd-cascade-row ${i < litCount ? 'tmpd-cascade-lit' : ''}`}
            >
              {Array.from({ length: row.count }, (_, n) => (
                <div
                  key={n}
                  className="tmpd-cascade-node"
                  style={{ animationDelay: `${i * 0.15 + n * 0.02}s` }}
                />
              ))}
              <span className="tmpd-cascade-marker">{row.label}</span>
            </div>
          ))}
        </div>

        <div className="tmpd-cascade-dest">
          <div className="tmpd-cascade-dest-arrow">↓</div>
          <div className="tmpd-cascade-dest-label">The math points here</div>
          <div className="tmpd-cascade-dest-number">100,000</div>
          <div className="tmpd-cascade-dest-sub">
            Qualified Brand Ambassadors. That&rsquo;s the team we&rsquo;re building.
          </div>
        </div>

        <div className="tmpd-principles">
          <Principle name="Power of 2">
            The team doubles when each person finds two. One becomes two, two
            becomes four, four becomes eight — that&rsquo;s how speed compounds.
          </Principle>
          <Principle name="2 in 72">
            Find your first two people in 72 hours. It&rsquo;s not a deadline —
            it&rsquo;s a rhythm. The team moves at the speed of its leaders.
          </Principle>
          <Principle name="One bite at a time">
            Big movements get built one daily action at a time. The system
            handles the scale. You handle the relationships.
          </Principle>
        </div>
      </section>
      <style>{mechanicCss}</style>
    </>
  );
}

function Principle({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="tmpd-principle">
      <div className="tmpd-principle-name">{name}</div>
      <div className="tmpd-principle-copy">{children}</div>
    </div>
  );
}

const mechanicCss = `
  .tmpd-mechanic h2 {
    color: #F5EFE6;
    margin-top: 14px;
    margin-bottom: 16px;
    max-width: 18ch;
  }
  .tmpd-mechanic-lead {
    font-size: clamp(17px, 1.7vw, 19px);
    color: rgba(245, 239, 230, 0.62);
    max-width: 60ch;
    margin-bottom: 48px;
  }
  .tmpd-mechanic-lead em {
    color: #2DD4BF;
    font-style: normal;
    font-weight: 500;
  }
  .tmpd-cascade {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 40px 0;
    align-items: center;
    position: relative;
    margin-bottom: 40px;
  }
  .tmpd-cascade::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 0;
    width: 1px;
    background: linear-gradient(180deg, transparent, #C9A84C 20%, #C9A84C 80%, transparent);
    transform: translateX(-50%);
  }
  .tmpd-cascade-row {
    display: flex;
    gap: 10px;
    align-items: center;
    z-index: 1;
  }
  .tmpd-cascade-node {
    width: 14px;
    height: 14px;
    background: #1B1B19;
    border: 1px solid #C9A84C;
    border-radius: 2px;
    opacity: 0;
    animation: tmpd-cascade-node-appear 0.5s ease forwards;
  }
  @keyframes tmpd-cascade-node-appear {
    from { opacity: 0; transform: scale(0.5); }
    to   { opacity: 1; transform: scale(1); }
  }
  .tmpd-cascade-lit .tmpd-cascade-node {
    background: #C9A84C;
    box-shadow: 0 0 12px rgba(201, 168, 76, 0.6);
  }
  .tmpd-cascade-marker {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    color: rgba(245, 239, 230, 0.48);
    letter-spacing: 0.12em;
    margin-left: 16px;
    min-width: 100px;
  }
  .tmpd-cascade-lit .tmpd-cascade-marker { color: #C9A84C; }
  .tmpd-cascade-dest {
    text-align: center;
    margin: -8px auto 56px;
    max-width: 38em;
  }
  .tmpd-cascade-dest-arrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    color: #C9A84C;
    font-size: 20px;
    line-height: 1;
    margin-bottom: 14px;
    opacity: 0.6;
  }
  .tmpd-cascade-dest-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
    margin-bottom: 12px;
  }
  .tmpd-cascade-dest-number {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(80px, 12vw, 144px);
    line-height: 0.9;
    color: #F5C030;
    letter-spacing: 0.02em;
    text-shadow: 0 0 60px rgba(201, 168, 76, 0.35);
    margin-bottom: 14px;
  }
  .tmpd-cascade-dest-sub {
    font-size: clamp(15px, 1.6vw, 17px);
    color: rgba(245, 239, 230, 0.62);
    line-height: 1.55;
  }
  .tmpd-principles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 24px;
    margin-top: 32px;
  }
  .tmpd-principle {
    border-top: 1px solid #C9A84C;
    padding-top: 18px;
  }
  .tmpd-principle-name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    color: #F5C030;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
  }
  .tmpd-principle-copy {
    font-size: 14px;
    line-height: 1.6;
    color: rgba(245, 239, 230, 0.62);
  }
`;
