/**
 * Section 5 — The Team Magnificent Advantage.
 *
 * Kevin's quote, the 100,000 mission board, pool activity grid, and the
 * compounding closer.
 *
 * Compliance (locked-spec 3.10):
 *   - The 100,000 GOAL is named. The current count is NOT shown.
 *   - The pool activity stats (BAs active in 24h, invitations sent today,
 *     new placements in 24h, recruitment velocity) describe team motion.
 *     Chat #115: now live counts via GET /api/p/:token/team-stats; while
 *     loading, render em-dash placeholders so layout doesn't jump.
 *   - The signature line at the bottom of the compounding closer:
 *     "Operational architecture · numbers of record · no performance promise"
 *     locks the section in compliance regardless of what the numbers say.
 *
 * Brand isolation (locked-spec 3.8):
 *   - Kevin Gardner attributed as "founding co-leader". No THREE reference.
 */

import { useEffect, useState } from 'react';
import { fetchTeamStats, type TeamStatsResponse } from '@/lib/api';

export interface TmAdvantageSectionProps {
  token: string;
  baFirstName: string;
  positionNumber: number;
}

export function TmAdvantageSection(props: TmAdvantageSectionProps) {
  const { token, baFirstName, positionNumber } = props;
  const [stats, setStats] = useState<TeamStatsResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTeamStats(token).then((result) => {
      if (cancelled) return;
      if (result.ok) setStats(result.data);
      // On error we leave stats=null — the section renders em-dash
      // placeholders. We do NOT surface the failure to the prospect;
      // a missing live-counter on a marketing surface is a non-event.
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <>
      <section className="tmpd-advantage">
        <div className="eyebrow">Why Team Magnificent moves faster</div>
        <h2>We work together. With the same goal.</h2>
        <p className="tmpd-advantage-lead">
          Most teams in network marketing recruit alone — every Brand
          Ambassador running their own scattered tools, their own scattered
          process. Team Magnificent built the technology that changes that.
        </p>

        <div className="tmpd-quote">
          <div className="tmpd-quote-q">
            &ldquo;We&rsquo;ve harnessed the power of our team using{' '}
            <span className="tmpd-quote-gold">technology</span> so we&rsquo;re
            working together with the{' '}
            <span className="tmpd-quote-teal">same goal</span> — to win.&rdquo;
          </div>
          <div className="tmpd-quote-sub">— Kevin L. Gardner, founding co-leader</div>
        </div>

        <div className="tmpd-mission">
          <div className="tmpd-mission-eyebrow">Our commitment · the goal</div>
          <div className="tmpd-mission-counter">100,000</div>
          <div className="tmpd-mission-label">
            Qualified Brand Ambassadors on Team Magnificent
          </div>
          <div className="tmpd-mission-philo">
            Our mission is simple — empower every Brand Ambassador to build
            their business, and help each one find at minimum two qualified
            recruits who do the same. Until we reach one hundred thousand,
            together.
          </div>
        </div>

        <div className="tmpd-pool-grid">
          <PoolStat
            num={formatCount(stats?.basActive24h)}
            label="Brand Ambassadors active in the last 24 hours"
            tag="Live"
          />
          <PoolStat
            num={formatCount(stats?.invitationsSentToday)}
            label="Invitations sent across the team today"
            tag="Pooled"
          />
          <PoolStat
            num={formatCount(stats?.newPlacements24h)}
            label="New placements added to the team in 24h"
            tag="Compounding"
          />
          <PoolStat
            num={formatVelocity(stats?.recruitmentVelocityPct)}
            label="Recruitment velocity through shared OS (week over week)"
            tag="Operational"
          />
        </div>

        <div className="tmpd-compounding">
          <h3>One team. One pool. One system.</h3>
          <p>
            When {baFirstName} invited you, that invitation didn&rsquo;t move
            alone. It moved alongside every other Brand Ambassador on Team
            Magnificent — feeding the same dashboard, the same momentum, the
            same proof you&rsquo;re seeing right now. The team&rsquo;s
            velocity is the sum of every BA&rsquo;s work, made visible through
            the same shared OS.
          </p>
          <p>
            Every prospect who lands here sees more team than the prospect who
            landed an hour ago. The momentum compounds. Your placement at
            #{positionNumber} is the result of every Brand Ambassador who came
            before you. The team at #500, #1,000, #5,000 will exist because of
            every Brand Ambassador who joins after.
          </p>
          <p>
            <strong className="tmpd-compounding-strong">
              Built to win. Built to win together.
            </strong>
          </p>
          <div className="tmpd-compounding-sig">
            Operational architecture · numbers of record · no performance promise
          </div>
        </div>
      </section>
      <style>{advantageCss}</style>
    </>
  );
}

function PoolStat(props: { num: string; label: string; tag: string }) {
  return (
    <div className="tmpd-pool-stat">
      <div className="tmpd-pool-stat-num">{props.num}</div>
      <div className="tmpd-pool-stat-label">{props.label}</div>
      <div className="tmpd-pool-stat-tag">{props.tag}</div>
    </div>
  );
}

/**
 * Format an integer count for display. Returns — (em dash) when the
 * value is undefined (still loading) so the cell stays layout-stable.
 * Uses locale grouping for readability at higher numbers (1,234).
 */
function formatCount(value: number | undefined): string {
  if (value === undefined || value === null) return '\u2014';
  return value.toLocaleString();
}

/**
 * Format the recruitment velocity percentage. Signed integer with %
 * suffix; em dash while loading. 0 reads as "0%" not "—" — a flat
 * week-over-week is real data, not missing data.
 */
function formatVelocity(value: number | undefined): string {
  if (value === undefined || value === null) return '\u2014';
  if (value === 0) return '0%';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}%`;
}

const advantageCss = `
  .tmpd-advantage h2 {
    color: #F5EFE6;
    margin-top: 14px;
    margin-bottom: 16px;
    max-width: 16ch;
  }
  .tmpd-advantage-lead {
    font-size: clamp(17px, 1.7vw, 19px);
    color: rgba(245, 239, 230, 0.62);
    max-width: 64ch;
    margin-bottom: 48px;
  }
  .tmpd-quote {
    border-left: 2px solid #C9A84C;
    padding: 20px 0 20px 28px;
    margin-bottom: 56px;
    max-width: 38em;
  }
  .tmpd-quote-q {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(26px, 3.4vw, 40px);
    line-height: 1.1;
    color: #F5EFE6;
    letter-spacing: 0.02em;
    margin-bottom: 14px;
  }
  .tmpd-quote-gold { color: #F5C030; }
  .tmpd-quote-teal { color: #2DD4BF; }
  .tmpd-quote-sub {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.48);
  }
  .tmpd-mission {
    border: 1px solid #C9A84C;
    background: linear-gradient(135deg, rgba(201, 168, 76, 0.08), rgba(45, 212, 191, 0.04));
    padding: clamp(32px, 5vw, 56px) clamp(28px, 4vw, 48px);
    margin-bottom: 40px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .tmpd-mission::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(500px circle at 50% 0%, rgba(201, 168, 76, 0.10), transparent 60%);
    pointer-events: none;
  }
  .tmpd-mission-eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: #C9A84C;
    margin-bottom: 20px;
    position: relative;
  }
  .tmpd-mission-counter {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(84px, 13vw, 168px);
    line-height: 0.9;
    color: #F5C030;
    text-shadow: 0 0 60px rgba(201, 168, 76, 0.4);
    margin-bottom: 18px;
    letter-spacing: 0.01em;
    position: relative;
  }
  .tmpd-mission-label {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.6vw, 17px);
    color: #F5EFE6;
    font-weight: 500;
    margin-bottom: 18px;
    position: relative;
  }
  .tmpd-mission-philo {
    font-size: clamp(14px, 1.4vw, 16px);
    color: rgba(245, 239, 230, 0.62);
    max-width: 52em;
    margin: 0 auto;
    line-height: 1.6;
    font-style: italic;
    position: relative;
  }
  .tmpd-pool-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 40px;
  }
  .tmpd-pool-stat {
    border: 1px solid rgba(201, 168, 76, 0.18);
    padding: 22px 22px 18px;
    background: #0F0F0F;
  }
  .tmpd-pool-stat-num {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(40px, 4.5vw, 56px);
    line-height: 1;
    color: #2DD4BF;
    letter-spacing: 0.02em;
  }
  .tmpd-pool-stat-label {
    margin-top: 10px;
    font-size: 13px;
    color: rgba(245, 239, 230, 0.62);
    line-height: 1.5;
  }
  .tmpd-pool-stat-tag {
    margin-top: 12px;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #C9A84C;
  }
  .tmpd-compounding {
    border: 1px solid rgba(201, 168, 76, 0.18);
    padding: clamp(28px, 4vw, 40px);
    background: #0F0F0F;
  }
  .tmpd-compounding h3 {
    color: #F5C030;
    margin-bottom: 16px;
    letter-spacing: 0.04em;
  }
  .tmpd-compounding p {
    color: rgba(245, 239, 230, 0.62);
    font-size: 16px;
    line-height: 1.65;
    max-width: 60ch;
  }
  .tmpd-compounding p + p { margin-top: 14px; }
  .tmpd-compounding-strong { color: #F5C030; font-weight: 500; }
  .tmpd-compounding-sig {
    margin-top: 22px;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: #C9A84C;
    border-top: 1px solid rgba(201, 168, 76, 0.18);
    padding-top: 18px;
  }
`;
