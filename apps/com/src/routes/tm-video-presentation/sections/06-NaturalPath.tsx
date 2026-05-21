/**
 * tm-video-presentation / Section 6 — The Natural Path
 *
 * Locked sources:
 *   • Handoff B Section 6:
 *     - Pivot from problem to solution
 *     - Comparison card is the visual anchor:
 *       Injectable GLP-1 vs GLP-THREE across mechanism, form, monthly
 *       cost, side-effect profile, long-term sustainability
 *     - GLP-THREE column uses gold + teal accents
 *     - Injectable column neutral
 *     - MBC-267 detail: patented peptide complex, naturally in salmon
 *       and mushrooms, supports body's own GLP-1 signaling
 *     - Form: liquid dropper, 3/4 of a dropper, 30 minutes before a
 *       meal (locked-spec Part 1.6 — supersedes Chat #39's "half")
 *     - Cost framing: "a fraction of the cost"
 *     - NO price disclosure on this page
 *
 * Compliance:
 *   • No specific dollar figure for GLP-THREE on .com.
 *   • No income, no comp.
 *
 * COPY: working copy per COM Design H.2.
 */

interface CompareRow {
  dimension: string;
  injectable: string;
  glpThree: string;
}

const ROWS: CompareRow[] = [
  {
    dimension: "Mechanism",
    injectable: "Synthetic GLP-1 receptor agonist — pharmaceutical.",
    glpThree: "MBC-267 peptide complex supporting your body's own GLP-1 signaling.",
  },
  {
    dimension: "Form",
    injectable: "Weekly injection, prescription required.",
    glpThree: "Liquid dropper. ¾ of a dropper, 30 minutes before a meal.",
  },
  {
    dimension: "Monthly cost",
    injectable: "$1,000–$1,500 out of pocket without coverage.",
    glpThree: "A fraction of the cost.",
  },
  {
    dimension: "Side-effect profile",
    injectable: "Nausea, gastric slowing, pancreatitis risk, muscle loss.",
    glpThree: "All-natural ingredients. Trademark and patent pending.",
  },
  {
    dimension: "Long-term",
    injectable: "Effect tapers when injections stop.",
    glpThree: "Designed to be sustainable — built around what the body already does.",
  },
];

export function NaturalPath() {
  return (
    <section className="tm-natural" aria-label="The Natural Path">
      <div className="tm-natural__inner">
        <div className="tm-natural__eyebrow">Part 3 — The Pivot</div>
        <h2 className="tm-natural__headline">
          Natural. Patented. No Needle. No Prescription.
        </h2>
        <p className="tm-natural__lede">
          GLP-THREE was built for the same outcome the category is chasing —
          through a different door. Same destination. Different mechanism.
          Different profile. Different cost.
        </p>

        {/* MBC-267 detail card */}
        <div className="tm-natural__mbc">
          <div className="tm-natural__mbc-label">The ingredient</div>
          <h3 className="tm-natural__mbc-title">MBC-267</h3>
          <p className="tm-natural__mbc-body">
            A patented peptide complex found naturally in salmon and
            mushrooms. It supports your body's own GLP-1 signaling rather
            than substituting for it. The peptide is delivered orally as a
            liquid dropper — ¾ of a dropper, thirty minutes before a meal.
          </p>
        </div>

        {/* Comparison card — the visual anchor */}
        <div className="tm-natural__compare">
          <div className="tm-natural__compare-header">
            <div className="tm-natural__compare-col tm-natural__compare-col--neutral">
              <span className="tm-natural__compare-coltag">Injectable GLP-1</span>
            </div>
            <div className="tm-natural__compare-col tm-natural__compare-col--ours">
              <span className="tm-natural__compare-coltag">GLP-THREE</span>
            </div>
          </div>
          <div className="tm-natural__compare-body">
            {ROWS.map((row, i) => (
              <div className="tm-natural__compare-row" key={i}>
                <div className="tm-natural__compare-dim">{row.dimension}</div>
                <div className="tm-natural__compare-cells">
                  <div className="tm-natural__compare-cell tm-natural__compare-cell--neutral">
                    {row.injectable}
                  </div>
                  <div className="tm-natural__compare-cell tm-natural__compare-cell--ours">
                    {row.glpThree}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-natural {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-natural__inner {
    max-width: 1180px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 32px);
  }
  .tm-natural__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }
  .tm-natural__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 68px);
    line-height: 1.04;
    letter-spacing: 0.005em;
    color: #F5EFE6;
    margin: 0;
    max-width: 24ch;
  }
  .tm-natural__lede {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(16px, 1.4vw, 20px);
    line-height: 1.55;
    color: rgba(245, 239, 230, 0.82);
    margin: 0;
    max-width: 56ch;
  }

  /* ---- MBC-267 card ---------------------------------------------- */
  .tm-natural__mbc {
    background: #131312;
    border: 1px solid rgba(45, 212, 191, 0.32);
    border-radius: 4px;
    padding: clamp(22px, 3vw, 36px);
    max-width: 760px;
    width: 100%;
    text-align: left;
    box-shadow: 0 0 0 1px rgba(45, 212, 191, 0.08);
  }
  .tm-natural__mbc-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #2DD4BF;
    margin-bottom: 8px;
  }
  .tm-natural__mbc-title {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(32px, 4vw, 48px);
    line-height: 1.04;
    color: #F5C030;
    margin: 0 0 12px;
    letter-spacing: 0.01em;
  }
  .tm-natural__mbc-body {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.2vw, 17px);
    line-height: 1.62;
    color: rgba(245, 239, 230, 0.86);
    margin: 0;
  }

  /* ---- Comparison card ------------------------------------------- */
  .tm-natural__compare {
    width: 100%;
    background: #131312;
    border: 1px solid rgba(201, 168, 76, 0.32);
    border-radius: 4px;
    overflow: hidden;
    margin-top: clamp(12px, 2vw, 20px);
    text-align: left;
  }
  .tm-natural__compare-header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-bottom: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-natural__compare-col {
    padding: clamp(14px, 1.8vw, 22px);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tm-natural__compare-coltag {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  .tm-natural__compare-col--neutral .tm-natural__compare-coltag {
    color: rgba(245, 239, 230, 0.62);
  }
  .tm-natural__compare-col--ours {
    background: rgba(201, 168, 76, 0.06);
    border-left: 1px solid rgba(201, 168, 76, 0.32);
  }
  .tm-natural__compare-col--ours .tm-natural__compare-coltag {
    color: #C9A84C;
  }

  .tm-natural__compare-body {
    display: flex;
    flex-direction: column;
  }
  .tm-natural__compare-row {
    padding: clamp(14px, 1.8vw, 22px);
    border-bottom: 1px solid rgba(245, 239, 230, 0.05);
  }
  .tm-natural__compare-row:last-child { border-bottom: 0; }
  .tm-natural__compare-dim {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.5);
    margin-bottom: 12px;
  }
  .tm-natural__compare-cells {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: clamp(14px, 2vw, 28px);
  }
  .tm-natural__compare-cell {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(14px, 1.1vw, 16px);
    line-height: 1.55;
  }
  .tm-natural__compare-cell--neutral { color: rgba(245, 239, 230, 0.72); }
  .tm-natural__compare-cell--ours    { color: #F5EFE6; font-weight: 500; }

  /* On narrow screens, stack the columns per-row */
  @media (max-width: 720px) {
    .tm-natural__compare-cells { grid-template-columns: 1fr; gap: 12px; }
    .tm-natural__compare-cell--ours {
      padding-top: 10px;
      border-top: 1px solid rgba(201, 168, 76, 0.18);
    }
    .tm-natural__compare-col--ours { border-left: 0; border-top: 1px solid rgba(201, 168, 76, 0.32); }
    .tm-natural__compare-header { grid-template-columns: 1fr; }
  }
`;

export default NaturalPath;
