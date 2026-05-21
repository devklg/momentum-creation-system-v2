/**
 * tm-video-presentation / Section 8 — Kevin's Story
 *
 * Locked source: Handoff B Section 8 + locked-spec Part 4.7.
 *
 *   "Render apps/com/public/assets/luxury-favorite.jpeg full-width or
 *    full-bleed AS-IS. No rebuilt card, no React decomposition, image
 *    leads. Optional minimal caption below; image stands alone.
 *
 *    The dynamic-inviter Phase 2 and gallery Phase 3 sections from
 *    Chat #39 are deferred — only Kevin's card renders in v1."
 *
 * Kevin's Chat #107 decision: real-results testimonials block (COM
 * Design A.7 "Part 5 — Real Results") is DEFERRED to v1.1. Section 8
 * in v1 is just Kevin's card.
 *
 * Asset:
 *   apps/com/public/assets/luxury-favorite.jpeg (260KB, SHA verified
 *   per Chat #106 handoff)
 *
 * Compliance:
 *   • The image carries weight-loss measurements (-19 lbs, -8 in belly,
 *     etc.) which are Kevin's own results, captioned "Real People. Real
 *     Results." This is testimony, not an income claim, and the image
 *     itself is the locked artifact per Part 4.7. The Team Magnificent
 *     compliance disclaimer in the footer governs the broader page.
 */

export function KevinStory() {
  return (
    <section className="tm-kevin" aria-label="Kevin's Story">
      <div className="tm-kevin__inner">
        <div className="tm-kevin__eyebrow">Part 5 — The Proof</div>
        <h2 className="tm-kevin__headline">
          The product works.
        </h2>

        <figure className="tm-kevin__figure">
          <img
            className="tm-kevin__image"
            src="/assets/luxury-favorite.jpeg"
            alt="Kevin Gardner before and after using GLP-THREE — down 19 lbs, no injections, with measurements"
            loading="lazy"
            decoding="async"
          />
          <figcaption className="tm-kevin__caption">
            Kevin Gardner. Down 19 lbs. No injections.
            <br />
            <span className="tm-kevin__caption-faint">Real people. Real results.</span>
          </figcaption>
        </figure>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-kevin {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-kevin__inner {
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 36px);
  }
  .tm-kevin__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }
  .tm-kevin__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 64px);
    line-height: 1.04;
    color: #F5EFE6;
    margin: 0;
  }
  .tm-kevin__figure {
    margin: 0;
    width: 100%;
    max-width: 720px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .tm-kevin__image {
    display: block;
    width: 100%;
    max-width: 640px;
    height: auto;
    border-radius: 4px;
    box-shadow:
      0 0 0 1px rgba(201, 168, 76, 0.32),
      0 32px 80px -20px rgba(0, 0, 0, 0.6);
  }
  .tm-kevin__caption {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.3vw, 18px);
    line-height: 1.55;
    color: rgba(245, 239, 230, 0.86);
    margin: 0;
  }
  .tm-kevin__caption-faint {
    font-style: italic;
    color: rgba(245, 239, 230, 0.62);
  }
`;

export default KevinStory;
