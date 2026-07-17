/**
 * tm-video-presentation / Section 11 — Footer
 *
 * Locked sources:
 *   • Handoff B Section 11:
 *     - BA attribution: "Presented to you by {BA_FIRST_NAME} {BA_LAST_NAME}."
 *     - Compass rose logo (inline SVG with gold glow)
 *     - NO product-company branding (locked-spec Part 3.8)
 *     - Team Magnificent compliance disclaimer in Team Magnificent's
 *       voice (locked-spec G.5 / 3.8)
 *
 *   • COM Design G.5 disclaimer verbatim (Team Magnificent voice):
 *     "Queue positions and momentum displays demonstrate team activity
 *      in real time and do not guarantee any final placement,
 *      compensation, or earnings outcome. Market figures cited from
 *      public sources are for context only. This page contains no
 *      income claims, placement promises, or guarantees of any kind."
 *
 *   • COM Design B.1 Footer: "Team Magnificent wordmark in teal,
 *     URL teammagnificent.com, ... no product-company branding,
 *     no third-party promoter-tool disclaimer, no logo other than
 *     Team Magnificent's. No BA name in the footer."
 *
 * Reconciling: B says include BA attribution in the footer; A says
 * no BA name in the footer. Going with B (handoff is later, explicit,
 * and gives the attribution exact format). Surfaced in the README.
 */

import { MCS_COM_DISCLAIMER } from '@momentum/shared';

export interface FooterProps {
  baFullName: string;
}

export function Footer({ baFullName }: FooterProps) {
  return (
    <footer className="tm-footer" aria-label="Team Magnificent footer">
      <div className="tm-footer__inner">
        <CompassRoseMini />

        <div className="tm-footer__wordmark">Team Magnificent</div>
        <a className="tm-footer__url" href="https://teammagnificent.com">
          teammagnificent.com
        </a>

        <div className="tm-footer__rule" aria-hidden="true" />

        <div className="tm-footer__attribution">
          Presented to you by {baFullName}.
        </div>

        <p className="tm-footer__disclaimer">{MCS_COM_DISCLAIMER}</p>

        <div className="tm-footer__legal-links" aria-label="Legal links">
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true">•</span>
          <a href="/terms">Terms of Service</a>
        </div>
      </div>
      <style>{styles}</style>
    </footer>
  );
}

function CompassRoseMini() {
  return (
    <svg
      className="tm-footer__rose"
      viewBox="0 0 60 60"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="30" cy="30" r="27" fill="none" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.32" />
      <circle cx="30" cy="30" r="18" fill="none" stroke="#C9A84C" strokeWidth="1" strokeOpacity="0.5" />
      <g stroke="#C9A84C" strokeWidth="1.2" strokeLinecap="round">
        <line x1="30" y1="6"  x2="30" y2="20" />
        <line x1="30" y1="40" x2="30" y2="54" />
        <line x1="40" y1="30" x2="54" y2="30" />
        <line x1="6"  y1="30" x2="20" y2="30" />
      </g>
      <circle cx="30" cy="30" r="3" fill="#2DD4BF" />
    </svg>
  );
}

const styles = `
  .tm-footer {
    position: relative;
    padding: clamp(48px, 8vw, 88px) clamp(20px, 5vw, 56px) clamp(40px, 6vw, 72px);
    border-top: 1px solid rgba(201, 168, 76, 0.18);
    background: #0A0A0A;
    color: rgba(245, 239, 230, 0.62);
    text-align: center;
  }
  .tm-footer__inner {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }
  .tm-footer__rose {
    width: 60px;
    height: 60px;
    filter: drop-shadow(0 0 12px rgba(201, 168, 76, 0.28))
            drop-shadow(0 0 28px rgba(201, 168, 76, 0.10));
  }
  .tm-footer__wordmark {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(22px, 2.4vw, 28px);
    color: #2DD4BF;
    letter-spacing: 0.04em;
    margin-top: 4px;
  }
  .tm-footer__url {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
    text-decoration: none;
  }
  .tm-footer__url:hover { color: #C9A84C; }

  .tm-footer__rule {
    width: 48px;
    height: 1px;
    background: rgba(201, 168, 76, 0.32);
    margin: 14px 0;
  }
  .tm-footer__attribution {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 14px;
    color: rgba(245, 239, 230, 0.78);
  }
  .tm-footer__disclaimer {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-style: italic;
    font-size: 12px;
    line-height: 1.7;
    color: rgba(245, 239, 230, 0.5);
    margin: 12px 0 0;
    max-width: 60ch;
  }

  .tm-footer__legal-links {
    margin: 18px 0 0;
    display: flex;
    justify-content: center;
    gap: 8px;
    align-items: center;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .tm-footer__legal-links a {
    color: rgba(245, 239, 230, 0.76);
    text-decoration: none;
    border-bottom: 1px solid transparent;
  }

  .tm-footer__legal-links a:hover {
    color: #C9A84C;
    border-bottom-color: currentColor;
  }
`;

export default Footer;
