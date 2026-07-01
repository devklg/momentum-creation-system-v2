/**
 * Leader Credibility — founder credibility content (Chat #147, surface #1).
 *
 * Authority: momentum.decisions / dec_leadership_credibility_and_track_record
 * (seq 25) — "who leads the system, Kevin's + Paul's track records, why a
 * prospect AND a BA can trust the path. Same stable content for everyone."
 *
 * This is the SINGLE SOURCE OF TRUTH for the credibility copy. It is STATIC
 * content — intentionally NOT master-content-driven (no contract-lane
 * dependency). It renders on BOTH surfaces:
 *   - .com  (apps/com tm-video-presentation) — prospect-facing trust signal
 *   - .team (apps/team /leadership)          — new-BA confidence
 *
 * The .com app imports this module directly. The .team app cannot import
 * @momentum/shared source (TS6059 — shared `src` is outside the team app's
 * rootDir; see apps/team/src/routes/cockpit.tsx header), so it mirrors this
 * object locally and points back here. When this changes, update the mirror.
 *
 * COMPLIANCE (the strictest surface — .com — governs, so the copy is safe on
 * both): founder credibility is experience, story, and leadership track
 * record ONLY. NO income claims, NO commission/comp math, NO earnings
 * figures, NO THREE International branding (the company name / logo). Naming
 * the 100,000 goal is permitted (the head COUNT is not). The product name
 * "GLP-THREE" is allowed — it is the product the page already presents.
 *
 * SOURCING (Kevin): the track-record bullets are drawn from your own
 * approved welcome letter (Chat #95, apps/team/src/routes/welcome.tsx) — "we
 * have been doing this for decades," "I have built teams of thousands," "60+
 * years old and 19 pounds lighter," "practicing alongside you." The welcome
 * letter's income line ("Paul has earned tens of millions in binary network
 * marketing") is DELIBERATELY EXCLUDED here: that is an income claim, fine on
 * the .team-only welcome letter but forbidden on .com — and this content
 * renders on both, so it is stripped to the compliance-clean track record.
 * Nothing here is invented; edit this one file and both surfaces update.
 */

export interface LeaderProfile {
  /** Stable BA id (matches seed-founders.ts). */
  tmagId: string;
  /** Full display name. */
  name: string;
  /** Short role label — "Founder" / "Co-Leader". */
  role: string;
  /** Two-letter monogram for the avatar chip when no photo is set. */
  initials: string;
  /** One-line credibility hook under the name. */
  tagline: string;
  /**
   * Track-record / leadership-proof points. Experience and story only —
   * never income, comp, or earnings (compliance: never on .com).
   */
  trackRecord: string[];
}

export interface LeaderCredibilityContent {
  /** Small mono eyebrow above the headline. */
  eyebrow: string;
  /** Bebas-Neue headline. Works for prospect AND new BA. */
  headline: string;
  /** Supporting line under the headline. */
  subhead: string;
  /** The two leaders, in display order (Kevin first, Paul second). */
  leaders: LeaderProfile[];
  /** Closing trust line — "why you can trust the path." */
  trustLine: string;
}

const KEVIN: LeaderProfile = {
  tmagId: 'TMAG-FOUNDER-KEVIN',
  name: 'Kevin L. Gardner',
  role: 'Founder',
  initials: 'KG',
  tagline: 'Built the system. Walks the path.',
  trackRecord: [
    'Founded Team Magnificent and built — by hand — the entire system this team runs on.',
    'Has led in this profession for decades and built teams of thousands.',
    'Walks the path himself: 60+ years old and 19 lbs lighter on the product, no injections.',
    'Leads from the front toward one named goal — 100,000 people who own their own results.',
  ],
};

const PAUL: LeaderProfile = {
  tmagId: 'TMAG-FOUNDER-PAUL',
  name: 'Paul Barrios',
  role: 'Co-Leader',
  initials: 'PB',
  tagline: 'Builds the team shoulder to shoulder.',
  trackRecord: [
    'Co-leads Team Magnificent alongside Kevin — one team, one direction.',
    'A proven team-builder and leader in this profession for decades.',
    'Stands beside every new sharer on the same path they are asked to walk.',
    'Practices the same simple way: share the video, help two people, repeat.',
  ],
};

export const LEADER_CREDIBILITY: LeaderCredibilityContent = {
  eyebrow: 'WHO LEADS THIS',
  headline: "You're not following a stranger.",
  subhead:
    'Team Magnificent is led by the people who built it — and who walk the exact path they ask you to walk.',
  leaders: [KEVIN, PAUL],
  trustLine:
    'Same path, same product, same people leading it — whether you are deciding today or building a team tomorrow.',
};
