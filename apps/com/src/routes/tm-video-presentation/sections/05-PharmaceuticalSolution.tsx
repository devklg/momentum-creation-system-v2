/**
 * tm-video-presentation / Section 5 — The Pharmaceutical Solution
 *
 * Locked sources:
 *   • Handoff B Section 5 — "Factual, not disparaging. Two-column:
 *     mechanism + cost/profile. No logos, no brand marks of
 *     pharmaceutical products. Tone educational, never attacking."
 *   • Content: Ozempic, Wegovy, Mounjaro as GLP-1 receptor agonists.
 *     ~$1,000-$1,500/mo, often not insured. Weekly/daily injection.
 *     Profile: nausea, gastroparesis risk, pancreatitis risk, muscle
 *     loss, "Ozempic face." Pattern: get on, get results, go off,
 *     rebound.
 *
 * Compliance:
 *   • No income, no comp.
 *   • Tone is educational. We do not disparage the pharmaceutical
 *     category. We describe it.
 *
 * COPY: working copy per COM Design H.2. Kevin to finalize.
 */

export function PharmaceuticalSolution() {
  return (
    <section className="tm-pharma" aria-label="The Pharmaceutical Solution">
      <div className="tm-pharma__inner">
        <div className="tm-pharma__eyebrow">Part 2 — Context</div>
        <h2 className="tm-pharma__headline">
          What Is Already In The Market.
        </h2>
        <p className="tm-pharma__lede">
          The injectable GLP-1 category is the reason the world is paying
          attention. It works. It also has a profile worth understanding.
        </p>

        <div className="tm-pharma__columns">
          <article className="tm-pharma__column">
            <div className="tm-pharma__column-label">Mechanism</div>
            <h3 className="tm-pharma__column-title">GLP-1 receptor agonists</h3>
            <p className="tm-pharma__body">
              Ozempic, Wegovy, Mounjaro and others belong to a class called
              GLP-1 receptor agonists. They mimic a hormone the body makes
              naturally and signal the brain that you are full. Appetite
              quiets. Stomach emptying slows. People lose weight.
            </p>
            <p className="tm-pharma__body">
              Delivery is by injection — weekly for the most common dosing.
              Use is typically continuous; the effect tapers when the
              injections stop.
            </p>
          </article>

          <article className="tm-pharma__column">
            <div className="tm-pharma__column-label">Cost &amp; profile</div>
            <h3 className="tm-pharma__column-title">What it costs to be on it</h3>
            <p className="tm-pharma__body">
              Out-of-pocket cost runs roughly $1,000 to $1,500 per month.
              Many insurance plans do not cover weight management on these
              drugs, leaving the cost on the patient.
            </p>
            <p className="tm-pharma__body">
              The known side-effect profile includes nausea, slowed gastric
              emptying (gastroparesis), pancreatitis risk, lean muscle loss,
              and a recognizable change in facial appearance the press has
              labeled "Ozempic face."
            </p>
            <p className="tm-pharma__body">
              Pattern users describe: get on, results come, go off, weight
              returns.
            </p>
          </article>
        </div>

        <p className="tm-pharma__footnote">
          None of this is a knock on the category. It is the starting line
          everyone is comparing against. What comes next on this page is
          how that comparison changed.
        </p>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-pharma {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-pharma__inner {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 32px);
  }
  .tm-pharma__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }
  .tm-pharma__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 64px);
    line-height: 1.04;
    letter-spacing: 0.005em;
    color: #F5EFE6;
    margin: 0;
    max-width: 22ch;
  }
  .tm-pharma__lede {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(16px, 1.4vw, 20px);
    line-height: 1.55;
    color: rgba(245, 239, 230, 0.82);
    margin: 0;
    max-width: 56ch;
  }

  .tm-pharma__columns {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: clamp(18px, 2.6vw, 32px);
    margin-top: clamp(12px, 2vw, 20px);
  }
  .tm-pharma__column {
    background: #131312;
    border: 1px solid rgba(245, 239, 230, 0.08);
    border-radius: 4px;
    padding: clamp(22px, 2.8vw, 36px);
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tm-pharma__column-label {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(245, 239, 230, 0.5);
  }
  .tm-pharma__column-title {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(22px, 2.4vw, 32px);
    line-height: 1.1;
    color: #F5EFE6;
    margin: 0;
    letter-spacing: 0.01em;
  }
  .tm-pharma__body {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(14px, 1.15vw, 16px);
    line-height: 1.62;
    color: rgba(245, 239, 230, 0.82);
    margin: 0;
  }

  .tm-pharma__footnote {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-style: italic;
    font-size: clamp(13px, 1.1vw, 16px);
    line-height: 1.55;
    color: rgba(245, 239, 230, 0.62);
    margin: clamp(12px, 2vw, 20px) 0 0;
    max-width: 60ch;
  }
`;

export default PharmaceuticalSolution;
