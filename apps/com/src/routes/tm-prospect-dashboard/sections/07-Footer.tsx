/**
 * Section 7 — Footer. The dashboard's compliance + brand close.
 *
 * Chat #112 build-state audit drift correction applied:
 *   The dashboard-prototype.html footer line that positioned this as
 *   an operational team inside the product company
 *   VIOLATES locked-spec 3.8 (brand isolation — Team Magnificent only,
 *   no product-company branding on .com). The corrected footer here names Team
 *   Magnificent only.
 *
 * Compliance disclaimer (locked-spec 3.10 verbatim):
 *   "Queue positions and momentum displays demonstrate team activity
 *    in real time and do not guarantee any final placement,
 *    compensation, or earnings outcome. Market figures cited from
 *    public sources are for context only. This page contains no
 *    income claims, placement promises, or guarantees of any kind."
 *
 * Note the disclaimer names only Team Magnificent — the brand isolation
 * (3.8) and the compliance language (3.10) reinforce each other.
 */

import { MCS_COM_DISCLAIMER } from '@momentum/shared';

export function DashboardFooter() {
  return (
    <>
      <footer className="tmpd-footer">
        <div className="tmpd-footer-mark">
          <div className="tmpd-footer-mark-circle">
            <span className="tmpd-footer-mark-dot" />
          </div>
          <div className="tmpd-footer-wordmark">
            <span className="tmpd-footer-wordmark-team">Team</span>{' '}
            <span className="tmpd-footer-wordmark-magnificent">Magnificent</span>
          </div>
        </div>
        <div className="tmpd-footer-tagline">
          We build people before we build volume.
        </div>
        <div className="tmpd-footer-disclaimer">{MCS_COM_DISCLAIMER}</div>
        <div className="tmpd-footer-links" aria-label="Legal links">
          <a href="/privacy">Privacy Policy</a>
          <span aria-hidden="true">•</span>
          <a href="/terms">Terms of Service</a>
        </div>
      </footer>
      <style>{footerCss}</style>
    </>
  );
}

const footerCss = `
  .tmpd-footer {
    border-top: 1px solid rgba(201, 168, 76, 0.18);
    padding: clamp(40px, 6vw, 64px) clamp(20px, 5vw, 56px);
    background: #0A0A0A;
    text-align: center;
  }
  .tmpd-footer-mark {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 18px;
  }
  .tmpd-footer-mark-circle {
    width: 28px;
    height: 28px;
    border: 1px solid #C9A84C;
    border-radius: 50%;
    position: relative;
  }
  .tmpd-footer-mark-circle::before,
  .tmpd-footer-mark-circle::after {
    content: '';
    position: absolute;
    background: #C9A84C;
  }
  .tmpd-footer-mark-circle::before {
    top: 50%;
    left: 3px;
    right: 3px;
    height: 1px;
    transform: translateY(-50%);
  }
  .tmpd-footer-mark-circle::after {
    left: 50%;
    top: 3px;
    bottom: 3px;
    width: 1px;
    transform: translateX(-50%);
  }
  .tmpd-footer-mark-dot {
    position: absolute;
    inset: 8px;
    background: #2DD4BF;
    border-radius: 50%;
  }
  .tmpd-footer-wordmark {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 22px;
    letter-spacing: 0.06em;
    line-height: 1;
  }
  .tmpd-footer-wordmark-team { color: #F5EFE6; }
  .tmpd-footer-wordmark-magnificent { color: #C9A84C; }
  .tmpd-footer-tagline {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
    margin-bottom: 24px;
  }
  .tmpd-footer-disclaimer {
    font-size: 11px;
    line-height: 1.6;
    color: rgba(245, 239, 230, 0.48);
    max-width: 64ch;
    margin: 0 auto;
  }

  .tmpd-footer-links {
    margin-top: 18px;
    display: flex;
    justify-content: center;
    gap: 10px;
    align-items: center;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.48);
  }

  .tmpd-footer-links a {
    color: inherit;
    text-decoration: none;
  }

  .tmpd-footer-links a:hover {
    color: #C9A84C;
  }
`;
