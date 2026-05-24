/**
 * tm-video-presentation / Section 10 — What's Next
 *
 * Locked Chat #126. REPLACES Section 10 (QuietDoor) as the closer.
 *
 * The bridge from the presentation (reference library: video, dossier,
 * market stats) into the dashboard (live demonstration: position, the
 * team forming beneath the prospect in real time).
 *
 * Two beats, no form:
 *
 *   Beat 1 — assumptive reveal + demonstration.
 *     "Now that you've seen the video — what's next?" Then, assumptively
 *     but honestly: while you were watching, you were PLACED (not enrolled,
 *     not signed up) into the team's line, so we could show you something
 *     real. The team is being built right now, in real time. This is how
 *     it actually works. One gold CTA hands them into the dashboard to see
 *     it for themselves.
 *
 *   Beat 2 — the single soft ask (framing only, NO callback control here).
 *     The one thing we ask is a real conversation with the inviting BA,
 *     because the BA can show them exactly what's going on and the specific
 *     advantage that's been created for them. The actual "have [BA] reach
 *     out" mechanism lives on the dashboard's Section 6 (Your Next Move) —
 *     this section only frames it and points there. See the team form
 *     FIRST, then decide to talk.
 *
 * Why no callback control here (locked Chat #126, option A):
 *   The callback CTA already lives on the dashboard's Section 6. Asking for
 *   the conversation before the prospect has seen the team forming would
 *   pull the ask earlier than the demonstration. The sequence is: see why
 *   it works (video) -> see how it works (dashboard) -> then the human
 *   conversation. This section is the doorway between the first two.
 *
 * Compliance (locked-spec Part 3.10 / 3.6):
 *   - "Placed into the line" + "the team is being built right now" is the
 *     DEMONSTRATION — a real fact about pool activity (locked-spec 3.4).
 *   - NEVER says enrolled, signed up, secured a leg, or any income /
 *     placement / earnings promise. "Placed, not enrolled" does the
 *     assumptive AND the compliance work in one breath.
 *   - The PAGE demonstrates; the BA explains the advantage. This section
 *     names the BA as the holder of the real context — it does not spell
 *     the advantage out itself.
 *   - Names the inviting BA per locked-spec Part 3.9 personalization rule.
 *
 * This section takes an onSeeTeam callback from the composer instead of
 * navigating itself. The composer owns the presentation<->dashboard view
 * state and the ?view= URL param (Chat #126); this section just asks to
 * cross over.
 */

export interface WhatsNextProps {
  baFirstName: string;
  /**
   * Switch the page to the dashboard view. Provided by the composer,
   * which owns the view state + the ?view= URL param. Only meaningful
   * once placement has happened (the composer guarantees this section
   * only renders after video_complete is reachable).
   */
  onSeeTeam: () => void;
}

export function WhatsNext({ baFirstName, onSeeTeam }: WhatsNextProps) {
  const baLabel = baFirstName || 'the person who invited you';

  return (
    <section className="tm-whatsnext" aria-label="What's next">
      <div className="tm-whatsnext__inner">
        <div className="tm-whatsnext__eyebrow">What&rsquo;s Next</div>

        <div className="tm-whatsnext__card">
          <div className="tm-whatsnext__keyline" aria-hidden="true" />

          <h2 className="tm-whatsnext__headline">
            Now that you&rsquo;ve seen the video &mdash; what&rsquo;s next?
          </h2>

          {/* Beat 1 — assumptive reveal + demonstration. */}
          <p className="tm-whatsnext__body">
            Here&rsquo;s something you may not have noticed. While you were
            watching, you were placed into our team&rsquo;s line. Not enrolled,
            not signed up &mdash; <span className="tm-whatsnext__em">placed</span>,
            so we could show you something real.
          </p>

          <p className="tm-whatsnext__body">
            The team you&rsquo;re about to see is being built right now, in real
            time. This is the mechanism we&rsquo;re so excited about &mdash; how
            our teams are actually built, and why the opportunity in front of
            you is real. We wanted you to see it for yourself.
          </p>

          <button
            type="button"
            className="tm-whatsnext__cta"
            onClick={onSeeTeam}
          >
            See the team forming around you &rarr;
          </button>

          <div className="tm-whatsnext__rule" aria-hidden="true" />

          {/* Beat 2 — the single soft ask, framing only. */}
          <p className="tm-whatsnext__ask">
            We&rsquo;re not asking you to buy anything or do anything today. The
            one next step is a real conversation with{' '}
            <span className="tm-whatsnext__ask-name">{baLabel}</span> &mdash; the
            person who can walk you through exactly what&rsquo;s going on, and the
            advantage that&rsquo;s been created for you here. You&rsquo;ll find the
            way to start that conversation on the next screen.
          </p>
        </div>
      </div>
      <style>{styles}</style>
    </section>
  );
}

const styles = `
  .tm-whatsnext {
    position: relative;
    padding: clamp(56px, 9vw, 120px) clamp(20px, 5vw, 56px);
    color: #F5EFE6;
    border-top: 1px solid rgba(245, 239, 230, 0.08);
  }
  .tm-whatsnext__inner {
    max-width: 880px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: clamp(20px, 3vw, 28px);
  }
  .tm-whatsnext__eyebrow {
    font-family: 'DM Mono', ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #C9A84C;
  }

  .tm-whatsnext__card {
    width: 100%;
    background: #131312;
    border: 1px solid rgba(201, 168, 76, 0.32);
    border-radius: 4px;
    padding: clamp(32px, 4vw, 56px) clamp(24px, 3.5vw, 48px);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: clamp(16px, 2vw, 22px);
    position: relative;
    box-shadow:
      0 0 0 1px rgba(201, 168, 76, 0.08),
      0 24px 64px -16px rgba(0, 0, 0, 0.55);
  }
  .tm-whatsnext__keyline {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 64px;
    height: 2px;
    background: linear-gradient(90deg,
      transparent 0%,
      #C9A84C 50%,
      transparent 100%);
  }

  .tm-whatsnext__headline {
    font-family: 'Bebas Neue', sans-serif;
    font-weight: 400;
    font-size: clamp(34px, 5.2vw, 60px);
    line-height: 1.04;
    letter-spacing: 0.005em;
    color: #F5EFE6;
    margin: 0;
    max-width: 20ch;
  }
  .tm-whatsnext__body {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(16px, 1.3vw, 19px);
    line-height: 1.6;
    color: rgba(245, 239, 230, 0.86);
    margin: 0;
    max-width: 56ch;
  }
  .tm-whatsnext__em {
    color: #F5C030;
    font-weight: 600;
  }

  .tm-whatsnext__cta {
    margin-top: clamp(8px, 1.5vw, 14px);
    padding: 16px 36px;
    font-family: 'Bebas Neue', sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    letter-spacing: 0.05em;
    text-transform: uppercase;
    background: linear-gradient(180deg, #C9A84C 0%, #B89339 100%);
    color: #0A0A0A;
    border: 1px solid #C9A84C;
    border-radius: 4px;
    cursor: pointer;
    transition: transform 120ms ease, box-shadow 200ms ease, filter 200ms ease;
    box-shadow: 0 8px 24px -8px rgba(201, 168, 76, 0.5);
  }
  .tm-whatsnext__cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 32px -10px rgba(201, 168, 76, 0.6);
    filter: brightness(1.05);
  }

  .tm-whatsnext__rule {
    width: 48px;
    height: 1px;
    background: rgba(201, 168, 76, 0.45);
    margin-top: 6px;
  }

  .tm-whatsnext__ask {
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: clamp(15px, 1.2vw, 17px);
    line-height: 1.6;
    color: rgba(245, 239, 230, 0.7);
    margin: 0;
    max-width: 54ch;
  }
  .tm-whatsnext__ask-name {
    color: #F5EFE6;
  }
`;

export default WhatsNext;
