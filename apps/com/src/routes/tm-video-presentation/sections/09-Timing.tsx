/**
 * tm-video-presentation / Section 9 — The Timing
 *
 * Locked source: Handoff B Section 9.
 *
 *   "Three-factor convergence: awareness wave, natural-alternative gap,
 *    company's moment. Venn diagram or three stacked tiles, teal accents
 *    on convergence point.
 *
 *    Closing line full-width, Bebas Neue large, gold on dark:
 *    'Five years from now, everyone will know about this category. The
 *     people who moved first will have built something that runs without
 *     them. The people who waited will have watched.'
 *
 *    Word 'opportunity' allowed; earnings not."
 *
 * I chose three stacked tiles (not Venn diagram). Reasoning: three
 * separate facts that converge at the present moment land cleaner as
 * three labeled cards than as overlapping circles. The convergence is
 * stated in the closing line.
 *
 * Compliance:
 *   • No income, no comp, no earnings.
 *   • "Opportunity" is permitted.
 *
 * COPY: working copy per COM Design H.2.
 */

interface Factor {
  index: string;
  title: string;
  body: string;
}

const FACTORS: Factor[] = [
  {
    index: "01",
    title: "The awareness wave",
    body: "Two years ago, almost nobody outside the medical world had heard of GLP-1. Today it is on the cover of every magazine and in every other ad break. The category is mainstream. The market is paying attention.",
  },
  {
    index: "02",
    title: "The natural-alternative gap",
    body: "Every major movement in wellness eventually produces a natural alternative to the pharmaceutical version. The injectable category created the demand. The shelf for a natural answer has been empty.",
  },
  {
    index: "03",
    title: "The company's moment",
    body: "GLP-THREE launched in the third week of January 2026 with trademark and patent pending. The first all-natural GLP-1 replacement on the market. The window is opening, not closing.",
  },
];

export function Timing() {
  return (
    <section className="tm-timing" aria-label="The Timing">
      <div className="tm-timing__inner">
        <div className="tm-timing__eyebrow">Part 6 — The Timing</div>
        <h2 className="tm-timing__headline">
          Three things are converging at once.
        </h2>

        <div className="tm-timing__factors">
          {FACTORS.map((f) => (
            <article className="tm-timing__factor" key={f.index}>
              <div className="tm-timing__factor-index">{f.index}</div>
              <h3 className="tm-timing__factor-title">{f.title}</h3>
              <p className="tm-timing__factor-body">{f.body}</p>
            </article>
          ))}
        </div>

        {/* Convergence note — teal accent line that visually says
            "the three above meet here" without needing a Venn diagram */}
        <div className="tm-timing__convergence" aria-hidden="true">
          <div className="tm-timing__convergence-line" />
          <div className="tm-timing__convergence-dot" />
          <div className="tm-timing__convergence-line" />
        </div>
        <div className="tm-timing__convergence-label">
          The moment all three are true is now.
        </div>

        {/* Locked closing line — Bebas Neue large, gold on dark */}
        <p className="tm-timing__closing">
          Five years from now, everyone will know about this category. The
          people who moved first will have built something that runs without
          them. The people who waited will have watched.
        </p>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-timing {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-timing__inner {
    max-width: 1180px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 32px);
  }
  .tm-timing__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }
  .tm-timing__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 64px);
    line-height: 1.04;
    color: #F5EFE6;
    margin: 0;
    max-width: 22ch;
  }

  /* ---- 3-factor tiles -------------------------------------------- */
  .tm-timing__factors {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
    gap: clamp(14px, 2vw, 22px);
    margin-top: clamp(8px, 2vw, 16px);
  }
  .tm-timing__factor {
    background: #131312;
    border: 1px solid rgba(245, 239, 230, 0.08);
    border-radius: 4px;
    padding: clamp(20px, 2.6vw, 32px);
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: relative;
  }
  .tm-timing__factor::before {
    content: '';
    position: absolute;
    left: 0;
    top: clamp(20px, 2.6vw, 32px);
    width: 3px;
    height: 28px;
    background: #2DD4BF;
    border-radius: 0 2px 2px 0;
  }
  .tm-timing__factor-index {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #2DD4BF;
  }
  .tm-timing__factor-title {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(22px, 2.6vw, 32px);
    line-height: 1.1;
    color: #F5EFE6;
    margin: 0;
    letter-spacing: 0.01em;
  }
  .tm-timing__factor-body {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(14px, 1.1vw, 16px);
    line-height: 1.6;
    color: rgba(245, 239, 230, 0.82);
    margin: 0;
  }

  /* ---- convergence marker ---------------------------------------- */
  .tm-timing__convergence {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    max-width: 480px;
    margin-top: clamp(8px, 2vw, 18px);
  }
  .tm-timing__convergence-line {
    flex: 1;
    height: 1px;
    background: linear-gradient(90deg,
      transparent 0%,
      rgba(45, 212, 191, 0.5) 50%,
      transparent 100%);
  }
  .tm-timing__convergence-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #2DD4BF;
    box-shadow: 0 0 14px rgba(45, 212, 191, 0.55);
    flex-shrink: 0;
  }
  .tm-timing__convergence-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #2DD4BF;
  }

  /* ---- closing line ---------------------------------------------- */
  .tm-timing__closing {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(28px, 4vw, 52px);
    line-height: 1.16;
    color: #C9A84C;
    margin: clamp(16px, 3vw, 32px) 0 0;
    max-width: 28ch;
    letter-spacing: 0.005em;
  }
`;

export default Timing;
