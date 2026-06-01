/**
 * Section 2 — Opportunity. The market the prospect just stepped into.
 *
 * Four-tile stat grid, each with a real public source citation
 * (locked-spec 1.6). No income claims; market figures are public
 * facts about the GLP-1 alternatives category.
 *
 * Copy and stat sources are locked Chat #82. Sources match those
 * cited in locked-spec 1.6 verbatim.
 */

export interface OpportunitySectionProps {
  /**
   * Master-content-resolved lead copy (`com.dashboard.opportunity`), resolved
   * server-side (TASK-147 inherit-com). Falls back to the built-in lead below.
   */
  copy?: string;
}

export function OpportunitySection({ copy }: OpportunitySectionProps) {
  return (
    <>
      <section className="tmpd-opportunity">
        <div className="eyebrow">The market you just stepped into</div>
        <h2>This isn&rsquo;t a small room.</h2>
        <p className="tmpd-opportunity-lead">
          {copy ?? (
            <>
              GLP-THREE is a natural alternative in one of the fastest-expanding
              wellness categories on the planet. The numbers aren&rsquo;t ours —
              they&rsquo;re public. We&rsquo;re just standing where they point.
            </>
          )}
        </p>

        <div className="tmpd-market-grid">
          <MarketCell value="$6.8" suffix="T" label="Global wellness market" source="GWI · 2025" />
          <MarketCell value="$200" suffix="B" label="GLP-1 alternatives by 2033" source="Industry projection" />
          <MarketCell value="72" suffix="%" label="Americans overweight" source="CDC · 2024" />
          <MarketCell value="$1,200" suffix="/mo" label="Cost of synthetic alternatives" source="Average retail · 2025" />
        </div>
      </section>
      <style>{opportunityCss}</style>
    </>
  );
}

function MarketCell(props: { value: string; suffix: string; label: string; source: string }) {
  return (
    <div className="tmpd-market-cell">
      <div className="tmpd-market-stat">
        {props.value}
        <span className="tmpd-market-stat-suffix">{props.suffix}</span>
      </div>
      <div className="tmpd-market-label">{props.label}</div>
      <div className="tmpd-market-source">{props.source}</div>
    </div>
  );
}

const opportunityCss = `
  .tmpd-opportunity { background: #0F0F0F; }
  .tmpd-opportunity h2 {
    color: #F5EFE6;
    margin-top: 14px;
    margin-bottom: 16px;
    max-width: 18ch;
  }
  .tmpd-opportunity-lead {
    font-size: clamp(17px, 1.7vw, 19px);
    color: rgba(245, 239, 230, 0.62);
    max-width: 64ch;
    margin-bottom: 56px;
  }
  .tmpd-market-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 1px;
    background: rgba(201, 168, 76, 0.18);
    border: 1px solid rgba(201, 168, 76, 0.18);
  }
  .tmpd-market-cell {
    background: #0F0F0F;
    padding: 32px 28px;
    transition: background 0.4s;
  }
  .tmpd-market-cell:hover { background: #1B1B19; }
  .tmpd-market-stat {
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(48px, 5.5vw, 68px);
    line-height: 1;
    color: #F5C030;
    margin-bottom: 12px;
    letter-spacing: 0.02em;
  }
  .tmpd-market-stat-suffix { font-size: 0.5em; color: #C9A84C; margin-left: 4px; }
  .tmpd-market-label {
    font-size: 14px;
    color: #F5EFE6;
    margin-bottom: 8px;
    font-weight: 500;
  }
  .tmpd-market-source {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    color: rgba(245, 239, 230, 0.48);
    letter-spacing: 0.15em;
    text-transform: uppercase;
  }
`;
