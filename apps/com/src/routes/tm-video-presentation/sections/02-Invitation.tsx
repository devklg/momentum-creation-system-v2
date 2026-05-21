/**
 * tm-video-presentation / Section 2 — The Invitation
 *
 * Locked sources:
 *   • Handoff B Section 2 — two short paragraphs, full-width centered
 *     column max 65ch, gold hairline above and below, body is
 *     confident/honest/no-pressure, presentation not pitch, no
 *     obligation, no hard sell, watch the video first.
 *   • COM Design B.1 Hero — verbatim opener:
 *     "{prospect}, you were personally invited by {ba full}."
 *     ...with the live pulse badge: "{ba first} personally invited you."
 *   • COM Design H.2 — final copy LOCKED by Kevin in Chat #108
 *     (combined options A + C: three-factor framing + memo-from-a-friend reading).
 *
 * Locked exclusion (Chat #106 → #107 handoff):
 *   • Do NOT reuse "Professionals use tools. Amateurs try to sell." —
 *     that line is locked to /welcome's signed note (TEAM Design C.2).
 *
 * Compliance:
 *   • No income claims, no placement promises, no THREE branding.
 *   • No fabricated track records (Chat #108: 'thirty years' removed,
 *     replaced with sourced three-factor language).
 */

export interface InvitationProps {
  prospectFirstName: string;
  baFullName: string;
  baFirstName: string;
}

export function Invitation({
  prospectFirstName,
  baFullName,
  baFirstName,
}: InvitationProps) {
  return (
    <section className="tm-invitation" aria-label="The Invitation">
      <div className="tm-invitation__inner">
        <div className="tm-invitation__rule" aria-hidden="true" />

        {/* Verbatim from COM Design B.1 Hero — opener line.
            Bebas Neue, cream, BA full name in gold. */}
        <h2 className="tm-invitation__opener">
          {prospectFirstName}, you were personally invited by{" "}
          <span className="tm-invitation__ba-name">{baFullName}</span>.
        </h2>

        {/* COPY: LOCKED by Kevin in Chat #108. Two paragraphs, three-factor
            framing in paragraph 1, briefing-not-pitch frame in paragraph 2.
            No BA name in body — it remains in the opener above and the
            pulse badge below. */}
        <div className="tm-invitation__body">
          <p className="tm-invitation__paragraph">
            What you are about to see is three things happening at the same
            time. A category-defining product. A team that is forming in this
            exact window. A moment in the market that won't come around again.
          </p>
          <p className="tm-invitation__paragraph">
            That is what the invitation is about. Not a sales call — a
            briefing on all three. Read it the way you would read a memo from
            a friend who has done the homework.
          </p>
        </div>

        {/* Live pulse badge — verbatim from COM Design B.1 Hero. */}
        <div className="tm-invitation__pulse-badge">
          <span className="tm-invitation__pulse" aria-hidden="true" />
          <span className="tm-invitation__pulse-text">
            {baFirstName} personally invited you
          </span>
        </div>

        <div className="tm-invitation__rule" aria-hidden="true" />
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-invitation {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #F5EFE6;
  }

  .tm-invitation__inner {
    width: 100%;
    max-width: 880px;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 32px);
  }

  /* Gold hairline above and below the section content */
  .tm-invitation__rule {
    width: 100%;
    max-width: 720px;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(201, 168, 76, 0) 5%,
      rgba(201, 168, 76, 0.55) 50%,
      rgba(201, 168, 76, 0) 95%,
      transparent 100%);
  }

  .tm-invitation__opener {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(32px, 4.4vw, 56px);
    line-height: 1.1;
    letter-spacing: 0.005em;
    color: #F5EFE6;
    margin: 0;
    max-width: 22ch;
  }
  .tm-invitation__ba-name {
    color: #C9A84C;
  }

  .tm-invitation__body {
    display: flex;
    flex-direction: column;
    gap: 18px;
    max-width: 65ch;
  }
  .tm-invitation__paragraph {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-weight: 400;
    font-size: clamp(16px, 1.4vw, 19px);
    line-height: 1.6;
    color: rgba(245, 239, 230, 0.86);
    margin: 0;
  }

  /* Live pulse badge — verbatim from COM Design B.1 Hero */
  .tm-invitation__pulse-badge {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 8px 18px;
    border: 1px solid rgba(45, 212, 191, 0.36);
    border-radius: 999px;
    background: rgba(45, 212, 191, 0.06);
  }
  .tm-invitation__pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #2DD4BF;
    box-shadow: 0 0 0 0 rgba(45, 212, 191, 0.55);
    animation: tm-invitation-pulse 1.8s ease-out infinite;
    flex-shrink: 0;
  }
  @keyframes tm-invitation-pulse {
    0%   { box-shadow: 0 0 0 0    rgba(45, 212, 191, 0.55); }
    100% { box-shadow: 0 0 0 12px rgba(45, 212, 191, 0);    }
  }
  .tm-invitation__pulse-text {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #2DD4BF;
  }

  @media (prefers-reduced-motion: reduce) {
    .tm-invitation__pulse { animation: none; }
  }
`;

export default Invitation;
