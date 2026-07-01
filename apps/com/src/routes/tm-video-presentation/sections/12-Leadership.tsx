/**
 * tm-video-presentation / Leadership Credibility.
 *
 * Founder credibility — who leads the system (Kevin + Paul), their track
 * records, and why a prospect can trust the path. STATIC content; the single
 * source of truth is packages/shared/src/leaders.ts (LEADER_CREDIBILITY),
 * shared verbatim with the .team surface.
 *
 * Placement: after Section 9 "The Timing" and before Section 10 "What's Next".
 *
 * LAYOUT (redesign): editorial / left-anchored, not centered. Header block,
 * leader cards, and trust line all align left; the two leaders read as an
 * indexed pair of authority cards with a gold accent stripe. Pure presentation
 * change — the data contract (eyebrow, headline, subhead, leaders[], trustLine)
 * is unchanged.
 *
 * COMPLIANCE (.com — prospect-facing): leadership credibility is experience +
 * story ONLY. The shared content carries no income/comp/earnings and no THREE
 * branding. This component renders that content as-is and adds none of its own.
 *
 * Brand tokens verbatim: ink #0A0A0A, gold #C9A84C, gold-bright #F5C030,
 * teal #2DD4BF, cream #F5EFE6.
 */

import { LEADER_CREDIBILITY } from "@momentum/shared";

export function Leadership() {
  const { eyebrow, headline, subhead, leaders, trustLine } = LEADER_CREDIBILITY;

  return (
    <section className="tm-leadership" aria-label="Who leads this">
      <div className="tm-leadership__inner">
        <header className="tm-leadership__head">
          <div className="tm-leadership__eyebrow">{eyebrow}</div>
          <h2 className="tm-leadership__headline">{headline}</h2>
          <p className="tm-leadership__subhead">{subhead}</p>
        </header>

        <div className="tm-leadership__rule" aria-hidden="true" />

        <div className="tm-leadership__grid">
          {leaders.map((leader, idx) => (
            <article key={leader.tmagId} className="tm-leadership__card">
              <span className="tm-leadership__index" aria-hidden="true">
                {String(idx + 1).padStart(2, "0")}
              </span>
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

        <div className="tm-leadership__trust">
          <span className="tm-leadership__trust-mark" aria-hidden="true" />
          <p className="tm-leadership__trust-text">{trustLine}</p>
        </div>
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
    max-width: 1120px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    text-align: left;
    gap: clamp(20px, 3vw, 30px);
  }
  .tm-leadership__head { max-width: 760px; }
  .tm-leadership__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
    color: #2DD4BF; margin-bottom: 14px;
  }
  .tm-leadership__headline {
    font-family: 'Bebas Neue', sans-serif; font-weight: 400;
    font-size: clamp(40px, 6vw, 76px); line-height: 0.98;
    letter-spacing: 0.005em; color: #F5EFE6; margin: 0;
  }
  .tm-leadership__subhead {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.4vw, 19px); line-height: 1.58;
    color: rgba(245, 239, 230, 0.78); max-width: 620px; margin: 18px 0 0;
  }
  .tm-leadership__rule {
    height: 1px; width: 100%;
    background: linear-gradient(to right, rgba(201,168,76,0.55), rgba(201,168,76,0.12) 60%, transparent);
  }
  .tm-leadership__grid {
    width: 100%; display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: clamp(18px, 2.5vw, 26px);
  }
  .tm-leadership__card {
    position: relative; overflow: hidden; text-align: left;
    background: linear-gradient(180deg, rgba(245,239,230,0.035), rgba(245,239,230,0.012));
    border: 1px solid rgba(201, 168, 76, 0.2);
    border-left: 2px solid #C9A84C; border-radius: 6px;
    padding: clamp(24px, 3vw, 36px);
    display: flex; flex-direction: column; gap: 16px;
  }
  .tm-leadership__index {
    position: absolute; top: clamp(14px, 2vw, 22px); right: clamp(16px, 2.4vw, 26px);
    font-family: 'Bebas Neue', sans-serif; font-size: clamp(34px, 4vw, 52px);
    line-height: 1; color: rgba(201, 168, 76, 0.16);
    pointer-events: none; user-select: none;
  }
  .tm-leadership__card-head { display: flex; align-items: center; gap: 16px; }
  .tm-leadership__avatar {
    flex: 0 0 auto; width: 54px; height: 54px; border-radius: 50%;
    display: grid; place-items: center;
    font-family: 'Bebas Neue', sans-serif; font-size: 23px; letter-spacing: 0.04em;
    color: #0A0A0A; background: linear-gradient(135deg, #F5C030, #C9A84C);
    box-shadow: 0 0 0 1px rgba(201, 168, 76, 0.4);
  }
  .tm-leadership__name {
    font-family: 'Bebas Neue', sans-serif; font-size: clamp(26px, 2.8vw, 32px);
    line-height: 1; color: #F5EFE6;
  }
  .tm-leadership__role {
    font-family: 'DM Mono', ui-monospace, monospace; font-size: 11px;
    letter-spacing: 0.18em; text-transform: uppercase; color: #C9A84C; margin-top: 6px;
  }
  .tm-leadership__tagline {
    font-family: 'DM Sans', system-ui, sans-serif; font-size: clamp(15px, 1.3vw, 17px);
    font-style: italic; line-height: 1.5; color: rgba(245, 239, 230, 0.92);
    margin: 0; padding-bottom: 4px; border-bottom: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-leadership__points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .tm-leadership__point {
    position: relative; padding-left: 22px;
    font-family: 'DM Sans', system-ui, sans-serif; font-size: clamp(14px, 1.2vw, 16px);
    line-height: 1.5; color: rgba(245, 239, 230, 0.82);
  }
  .tm-leadership__point::before {
    content: ''; position: absolute; left: 4px; top: 9px;
    width: 6px; height: 6px; border-radius: 50%; background: #2DD4BF;
  }
  .tm-leadership__trust {
    display: flex; align-items: stretch; gap: 18px;
    margin-top: clamp(10px, 2vw, 20px); max-width: 860px;
  }
  .tm-leadership__trust-mark {
    flex: 0 0 auto; width: 3px; border-radius: 2px;
    background: linear-gradient(180deg, #F5C030, #C9A84C);
  }
  .tm-leadership__trust-text {
    margin: 0; font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(24px, 3.2vw, 38px); line-height: 1.1;
    letter-spacing: 0.005em; color: #C9A84C;
  }
  @media (max-width: 560px) { .tm-leadership__index { font-size: 30px; } }
`;

export default Leadership;
