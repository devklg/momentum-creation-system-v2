/**
 * tm-video-presentation / Section 7 — The Dossier
 *
 * Locked sources:
 *   • Handoff B Section 7:
 *     - Accordion, default closed
 *     - Cream body on dark card, teal section dividers
 *     - Sections: Ingredients & mechanism (MBC-267), Patent & scientific
 *       backing, Manufacturing standards, Usage protocol, FAQ
 *     - Optional "Download dossier as PDF" — wired in v1 per Kevin's
 *       Chat #107 decision
 *
 * Asset (deferred to Kevin's drop):
 *   apps/com/public/dossier/glp-three-dossier.pdf
 *   Until the PDF lands at that path, the download link is rendered
 *   but disabled with a small "PDF coming soon" note. Replace the
 *   `dossierAvailable` flag below with a server check or env flag
 *   when wiring for real.
 *
 * Compliance:
 *   • Content describes the product factually. No income, no comp,
 *     no THREE branding.
 *   • The price of GLP-THREE is NOT named on this page.
 *
 * COPY: working copy per COM Design H.2.
 */

import { useState } from "react";

interface DossierItem {
  id: string;
  title: string;
  // Body is a list of paragraphs (or any React node array) so each
  // section can hold structured content.
  body: string[];
}

const ITEMS: DossierItem[] = [
  {
    id: "ingredients",
    title: "Ingredients & mechanism",
    body: [
      "GLP-THREE is built around MBC-267, a patented peptide complex found naturally in salmon and certain mushrooms.",
      "MBC-267 supports the body's own GLP-1 signaling pathway rather than substituting a synthetic agonist. The mechanism is metabolic support, not chemical replacement.",
      "The full ingredient list is on the bottle and in the PDF dossier below.",
    ],
  },
  {
    id: "patent",
    title: "Patent & scientific backing",
    body: [
      "Trademark and patent pending. The peptide complex itself is patented; the formulation is proprietary.",
      "Dr. Dan Gubler — Chief Scientific Officer and Chief Formulator — developed the product. His scientific record: Caltech PhD in Organic Chemistry, sixteen patents, more than seventy supplements formulated across his career, a top-50 podcast on supplement science, and a public following of 1.3 million.",
    ],
  },
  {
    id: "manufacturing",
    title: "Manufacturing standards",
    body: [
      "Manufactured to current Good Manufacturing Practice (cGMP) standards.",
      "Quality, identity, and potency are verified at multiple stages of production. The dossier below contains the manufacturing summary.",
    ],
  },
  {
    id: "usage",
    title: "Usage protocol",
    body: [
      "GLP-THREE is taken as a liquid dropper.",
      "Three-quarters of a dropper, thirty minutes before a meal.",
      "Take consistently. The mechanism is metabolic — results compound with daily use, not from a single dose.",
    ],
  },
  {
    id: "faq",
    title: "Frequently asked questions",
    body: [
      "Is GLP-THREE a drug? No. It is a dietary supplement designed to support your body's own GLP-1 signaling. It is not a prescription drug, not an injection, and not a GLP-1 receptor agonist.",
      "Do I need a prescription? No.",
      "Can I take it with other medications? Talk to your physician before combining any supplement with prescribed medication — including GLP-THREE.",
      "How long does a bottle last? Standard daily use is roughly one bottle per month. The dossier below has the exact specifications.",
    ],
  },
];

// Flip this to true once apps/com/public/dossier/glp-three-dossier.pdf
// is on disk. Or move it to a server-provided flag.
const DOSSIER_AVAILABLE = false;
const DOSSIER_HREF = "/dossier/glp-three-dossier.pdf";

export function Dossier() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="tm-dossier" aria-label="The Dossier">
      <div className="tm-dossier__inner">
        <div className="tm-dossier__eyebrow">Part 4 — The Details</div>
        <h2 className="tm-dossier__headline">The Dossier.</h2>
        <p className="tm-dossier__lede">
          Five short briefings for the parts of the page that warranted more
          than a sentence. Open what you want. Skip what you do not.
        </p>

        <div className="tm-dossier__accordion">
          {ITEMS.map((item) => {
            const open = openId === item.id;
            return (
              <div
                key={item.id}
                className={`tm-dossier__item${open ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="tm-dossier__head"
                  aria-expanded={open}
                  aria-controls={`tm-dossier-${item.id}`}
                  onClick={() => setOpenId(open ? null : item.id)}
                >
                  <span className="tm-dossier__head-title">{item.title}</span>
                  <span className="tm-dossier__head-icon" aria-hidden="true">
                    {open ? "−" : "+"}
                  </span>
                </button>
                <div
                  id={`tm-dossier-${item.id}`}
                  className="tm-dossier__body"
                  role="region"
                  aria-labelledby={`tm-dossier-${item.id}-button`}
                  hidden={!open}
                >
                  {item.body.map((p, i) => (
                    <p key={i} className="tm-dossier__paragraph">
                      {p}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* PDF download link — wired in v1, gated on file presence */}
        <div className="tm-dossier__download">
          {DOSSIER_AVAILABLE ? (
            <a
              className="tm-dossier__download-link"
              href={DOSSIER_HREF}
              target="_blank"
              rel="noopener noreferrer"
              download
            >
              <span className="tm-dossier__download-icon" aria-hidden="true">↓</span>
              <span>Download the full dossier (PDF)</span>
            </a>
          ) : (
            <div className="tm-dossier__download-pending">
              <span className="tm-dossier__download-icon" aria-hidden="true">↓</span>
              <span>Full dossier PDF coming soon</span>
            </div>
          )}
        </div>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-dossier {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-dossier__inner {
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 32px);
  }
  .tm-dossier__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }
  .tm-dossier__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(36px, 5.4vw, 64px);
    line-height: 1.04;
    color: #F5EFE6;
    margin: 0;
  }
  .tm-dossier__lede {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.3vw, 18px);
    line-height: 1.55;
    color: rgba(245, 239, 230, 0.82);
    margin: 0;
    max-width: 52ch;
  }

  /* ---- accordion -------------------------------------------------- */
  .tm-dossier__accordion {
    width: 100%;
    background: #131312;
    border: 1px solid rgba(201, 168, 76, 0.18);
    border-radius: 4px;
    overflow: hidden;
    margin-top: clamp(8px, 2vw, 16px);
    text-align: left;
  }
  .tm-dossier__item + .tm-dossier__item {
    border-top: 1px solid rgba(45, 212, 191, 0.18);
  }
  .tm-dossier__head {
    appearance: none;
    width: 100%;
    background: transparent;
    color: #F5EFE6;
    border: 0;
    padding: clamp(16px, 2vw, 24px) clamp(18px, 2.4vw, 28px);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    cursor: pointer;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.25vw, 18px);
    font-weight: 500;
    line-height: 1.35;
    text-align: left;
    transition: background 200ms ease;
  }
  .tm-dossier__head:hover { background: rgba(201, 168, 76, 0.04); }
  .tm-dossier__head-title { flex: 1; }
  .tm-dossier__head-icon {
    font-family: 'Bebas Neue', sans-serif;
    font-size: 28px;
    color: #C9A84C;
    line-height: 1;
    width: 1.5ch;
    text-align: center;
    flex-shrink: 0;
  }
  .tm-dossier__item.is-open .tm-dossier__head { background: rgba(201, 168, 76, 0.05); }

  .tm-dossier__body {
    padding: 0 clamp(18px, 2.4vw, 28px) clamp(18px, 2.4vw, 28px);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tm-dossier__paragraph {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(14px, 1.1vw, 16px);
    line-height: 1.62;
    color: rgba(245, 239, 230, 0.86);
    margin: 0;
  }

  /* ---- PDF download ---------------------------------------------- */
  .tm-dossier__download {
    margin-top: clamp(8px, 2vw, 18px);
  }
  .tm-dossier__download-link {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border: 1px solid #C9A84C;
    border-radius: 999px;
    background: rgba(201, 168, 76, 0.05);
    color: #C9A84C;
    text-decoration: none;
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    transition: background 200ms ease, color 200ms ease;
  }
  .tm-dossier__download-link:hover {
    background: #C9A84C;
    color: #0A0A0A;
  }
  .tm-dossier__download-pending {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 12px 20px;
    border: 1px solid rgba(201, 168, 76, 0.32);
    border-radius: 999px;
    color: rgba(245, 239, 230, 0.5);
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }
  .tm-dossier__download-icon {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 14px;
  }
`;

export default Dossier;
