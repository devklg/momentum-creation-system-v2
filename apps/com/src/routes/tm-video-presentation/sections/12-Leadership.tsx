/**
 * tm-video-presentation / Leadership Credibility (Chat #147, surface #1).
 *
 * Authority: momentum.decisions / dec_leadership_credibility_and_track_record
 * (seq 25). Founder credibility — who leads the system (Kevin + Paul), their
 * track records, and why a prospect can trust the path. STATIC content (not
 * master-content-driven); the single source of truth is
 * packages/shared/src/leaders.ts (LEADER_CREDIBILITY), shared verbatim with
 * the .team surface so everyone sees the same stable content.
 *
 * Placement: renders late in the presentation — after Section 9 "The Timing"
 * (why now) and before Section 10 "What's Next" (the cross to the dashboard).
 * The flow is: the product works → the moment is now → here are the people
 * leading you into it → your next move.
 *
 * COMPLIANCE (.com — prospect-facing, fail-closed by design): leadership
 * credibility is experience + story ONLY. The shared content carries no
 * income/comp/earnings and no THREE International branding. This component
 * renders that content as-is and adds none of its own. Naming the 100,000
 * goal is permitted; the head count is not (the copy names the goal only).
 *
 * Brand tokens are verbatim from packages/shared/src/brand.ts — never
 * paraphrased: ink #0A0A0A, gold #C9A84C, gold-bright #F5C030, teal #2DD4BF,
 * cream #F5EFE6.
 */

import { LEADER_CREDIBILITY } from "@momentum/shared";

export function Leadership() {
  const { eyebrow, headline, subhead, leaders, trustLine } = LEADER_CREDIBILITY;

  return (
    <section className="tm-leadership" aria-label="Who leads this">
      <div className="tm-leadership__inner">
        <div className="tm-leadership__eyebrow">{eyebrow}</div>
        <h2 className="tm-leadership__headline">{headline}</h2>
        <p className="tm-leadership__subhead">{subhead}</p>

        <div className="tm-leadership__grid">
          {leaders.map((leader) => (
            <article key={leader.baId} className="tm-leadership__card">
              <header className="tm-leadership__card-head">
                <span className="tm-leadership__avatar" aria-hidden="true">
                  {leader.initials}
                </span>
                <div className="tm-leadership__id">
                  <div className="tm-leadership__name">{leader.name}</div>
                  <div className="tm-leadership__role">{leader.role}</div>
                </div>
              </header>

              <p className="tm-leadership__tagline">{leader.tagline}</p>

              <ul className="tm-leadership__points">
                {leader.trackRecord.map((point, i) => (
                  <li key={i} className="tm-leadership__point">
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="tm-leadership__trust">{trustLine}</p>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-leadership {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-leadership__inner {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(14px, 2vw, 22px);
  }
  .tm-leadership__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #2DD4BF;
  }
  .tm-leadership__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 64px);
    line-height: 1.04;
    color: #F5EFE6;
    margin: 0;
  }
  .tm-leadership__subhead {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.4vw, 19px);
    line-height: 1.55;
    color: rgba(245, 239, 230, 0.78);
    max-width: 640px;
    margin: 0;
  }
  .tm-leadership__grid {
    width: 100%;
    margin-top: clamp(18px, 3vw, 36px);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: clamp(18px, 2.5vw, 28px);
  }
  .tm-leadership__card {
    text-align: left;
    background: rgba(245, 239, 230, 0.02);
    border: 1px solid rgba(201, 168, 76, 0.22);
    border-radius: 6px;
    padding: clamp(22px, 3vw, 34px);
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .tm-leadership__card-head {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .tm-leadership__avatar {
    flex: 0 0 auto;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: 0.04em;
    color: #0A0A0A;
    background: linear-gradient(135deg, #F5C030, #C9A84C);
    box-shadow: 0 0 0 1px rgba(201, 168, 76, 0.4);
  }
  .tm-leadership__name {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(24px, 2.6vw, 30px);
    line-height: 1;
    color: #F5EFE6;
  }
  .tm-leadership__role {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #C9A84C;
    margin-top: 5px;
  }
  .tm-leadership__tagline {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.3vw, 17px);
    font-style: italic;
    line-height: 1.5;
    color: rgba(245, 239, 230, 0.9);
    margin: 0;
  }
  .tm-leadership__points {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tm-leadership__point {
    position: relative;
    padding-left: 22px;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(14px, 1.2vw, 16px);
    line-height: 1.5;
    color: rgba(245, 239, 230, 0.82);
  }
  .tm-leadership__point::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 9px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #2DD4BF;
  }
  .tm-leadership__trust {
    margin-top: clamp(18px, 3vw, 32px);
    max-width: 720px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(22px, 3vw, 34px);
    line-height: 1.12;
    color: #C9A84C;
  }
`;

export default Leadership;
