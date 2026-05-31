/**
 * Section 01 — Personal Open.
 *
 * Locked-spec Part 4.3 + Chat #39 schematic Section 01.
 *
 * Prospect's question this section answers: "Why is this in front of me?"
 *
 * What it does:
 *   - Full-bleed ink hero. No navigation. No scroll cue.
 *   - Compass rose mark, softly glowing.
 *   - Bebas Neue headline interpolating BOTH names (locked-spec 3.9 —
 *     never anonymous; both prospect first name and inviting BA full name
 *     appear here).
 *   - DM Sans body sub-line.
 *   - DM Mono instruction line at the bottom.
 *
 * Compliance:
 *   - No time estimates. No rushing language. No income claims.
 *   - The prospect's name is interpolated server-side from the token.
 *   - The BA's name is interpolated from the token-resolved BA record.
 *   - Personalization is the rule, not the exception.
 *
 * Visual register (this section sets the DNA for the rest of the page):
 *   - Full viewport height. Ink #0A0A0A. Atmospheric gradient inherited
 *     from main.css body::before.
 *   - Headline: Bebas Neue clamp(56px, 9vw, 116px). Cream with the
 *     BA's name in gold.
 *   - Sub-line: DM Sans clamp(17px, 1.7vw, 19px). Cream-mute.
 *   - Instruction: DM Mono 11px, gold, tracking-eyebrow, uppercase.
 *   - Motion: rise animation, staggered.
 */

import { CompassRose } from '@/components/CompassRose';

export interface PersonalOpenProps {
  prospectFirstName: string;
  baFullName: string;
  /**
   * The inviting BA's own personal note ({{baVoiceCopy}} — locked-spec F.2 /
   * 3.9 "inviting BA voice copy"). Optional: rendered as a personal line in
   * the BA's voice when present, omitted otherwise. The master-content read
   * path (services/masterContent.ts) supplies it once Wave-2 inherit-com
   * wires this surface to read from master_content_versions; until then it is
   * simply absent and the generic sub-line carries the hero.
   */
  baVoiceCopy?: string;
}

export function PersonalOpen({ prospectFirstName, baFullName, baVoiceCopy }: PersonalOpenProps) {
  return (
    <section
      className="
        relative min-h-screen w-full
        flex flex-col items-center justify-center
        px-6 sm:px-10 lg:px-20
        text-center
      "
    >
      {/* Compass rose mark */}
      <div className="motion-rise motion-rise-delay-1">
        <div className="motion-glow">
          <CompassRose size={180} className="sm:hidden" />
          <CompassRose size={220} className="hidden sm:block lg:hidden" />
          <CompassRose size={260} className="hidden lg:block" />
        </div>
      </div>

      {/* Eyebrow */}
      <div
        className="
          motion-rise motion-rise-delay-2
          mt-10 mb-8
          font-mono text-[11px] sm:text-xs
          tracking-eyebrow uppercase
          text-cream-faint
        "
      >
        —  A Personal Invitation  ·  Team Magnificent
      </div>

      {/* Headline */}
      <h1
        className="
          motion-rise motion-rise-delay-3
          font-display text-cream
          leading-[0.96] tracking-[0.01em]
          max-w-[20ch]
        "
        style={{ fontSize: 'clamp(56px, 9vw, 116px)' }}
      >
        {prospectFirstName},
        <br />
        <span className="text-gold">{baFullName}</span>
        <br />
        thinks highly of you.
      </h1>

      {/* Sub-line */}
      <p
        className="
          motion-rise motion-rise-delay-4
          mt-10 max-w-[44ch]
          font-body text-cream-mute
          leading-[1.55]
        "
        style={{ fontSize: 'clamp(17px, 1.7vw, 19px)' }}
      >
        And has information that is timely and powerful to share with you.
      </p>

      {/* Inviting BA's personal note ({{baVoiceCopy}}). Rendered only when the
          master-content read path supplies it; absent by default. */}
      {baVoiceCopy && (
        <p
          className="
            motion-rise motion-rise-delay-4
            mt-6 max-w-[44ch]
            font-body text-cream
            leading-[1.55]
          "
          style={{ fontSize: 'clamp(16px, 1.6vw, 18px)' }}
        >
          “{baVoiceCopy}”
        </p>
      )}

      {/* Italic instruction line */}
      <p
        className="
          motion-rise motion-rise-delay-4
          mt-6 max-w-[44ch]
          font-body italic text-cream-faint
        "
        style={{ fontSize: 'clamp(15px, 1.5vw, 16px)' }}
      >
        You were not chosen randomly. You were chosen deliberately.
      </p>

      {/* Bottom-anchored instruction (out of the way; doesn't fight the hero) */}
      <div
        className="
          motion-rise motion-rise-delay-4
          absolute bottom-10
          font-mono text-[10px] tracking-eyebrow uppercase
          text-cream-faint
        "
      >
        Take your time with what follows.
      </div>
    </section>
  );
}
