/**
 * Section 0 — Ribbon. Top status bar on the prospect dashboard.
 * Brand mark + "Live · holding tank" label with a pulsing teal dot.
 * Sticky to the top of the viewport, blurred background.
 *
 * Compliance (locked-spec 3.8): Team Magnificent branding only,
 * no THREE references anywhere.
 */

export function DashboardRibbon() {
  return (
    <>
      <div className="tmpd-ribbon">
        <div className="tmpd-ribbon-brand">
          <div className="tmpd-ribbon-mark">
            <span className="tmpd-ribbon-dot" />
          </div>
          <span>Team Magnificent</span>
        </div>
        <div className="tmpd-ribbon-live">
          <span className="tmpd-ribbon-pulse" />
          <span>Live · holding tank</span>
        </div>
      </div>
      <style>{ribbonCss}</style>
    </>
  );
}

const ribbonCss = `
  .tmpd-ribbon {
    border-bottom: 1px solid rgba(201, 168, 76, 0.18);
    background: rgba(10, 10, 10, 0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 14px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.62);
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .tmpd-ribbon-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #C9A84C;
  }
  .tmpd-ribbon-mark {
    width: 22px;
    height: 22px;
    border: 1px solid #C9A84C;
    border-radius: 50%;
    position: relative;
  }
  .tmpd-ribbon-mark::before,
  .tmpd-ribbon-mark::after {
    content: '';
    position: absolute;
    background: #C9A84C;
  }
  .tmpd-ribbon-mark::before {
    top: 50%;
    left: 2px;
    right: 2px;
    height: 1px;
    transform: translateY(-50%);
  }
  .tmpd-ribbon-mark::after {
    left: 50%;
    top: 2px;
    bottom: 2px;
    width: 1px;
    transform: translateX(-50%);
  }
  .tmpd-ribbon-dot {
    position: absolute;
    inset: 6px;
    background: #2DD4BF;
    border-radius: 50%;
  }
  .tmpd-ribbon-live {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #2DD4BF;
  }
  .tmpd-ribbon-pulse {
    width: 8px;
    height: 8px;
    background: #2DD4BF;
    border-radius: 50%;
    box-shadow: 0 0 0 0 #2DD4BF;
    animation: tmpd-pulse 2s infinite;
  }
`;
