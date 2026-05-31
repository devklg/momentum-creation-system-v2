/**
 * /leadership — Leader Credibility for Brand Ambassadors (Chat #147, surface #1).
 *
 * Authority: momentum.decisions / dec_leadership_credibility_and_track_record
 * (seq 25). The .team face of the founder-credibility surface — gives a new
 * BA confidence in the leadership behind their system: who leads it (Kevin +
 * Paul), their track records, and why the path is trustworthy. Same stable
 * content as the .com presentation (Section 12-Leadership).
 *
 * CONTENT SOURCE OF TRUTH: packages/shared/src/leaders.ts (LEADER_CREDIBILITY).
 * Per the .team convention (see apps/team/src/routes/cockpit.tsx header), this
 * app cannot import @momentum/shared source without tripping TS6059, so the
 * content object is MIRRORED locally below. When packages/shared/src/leaders.ts
 * changes, update this mirror to match.
 *
 * This is BA-facing (.team), so the income context that the .com side forbids
 * would be permissible here — but the content is intentionally kept identical
 * across both surfaces ("same stable content for everyone," seq 25), so this
 * mirror carries the same compliance-clean copy as the shared module.
 *
 * Brand tokens via the team tailwind theme (ink / gold / gold-bright / teal /
 * cream) — verbatim from packages/shared/src/brand.ts.
 */

import { useNavigate } from 'react-router-dom';

// ── Local mirror of packages/shared/src/leaders.ts (LEADER_CREDIBILITY) ──────

interface LeaderProfile {
  baId: string;
  name: string;
  role: string;
  initials: string;
  tagline: string;
  trackRecord: string[];
}

interface LeaderCredibilityContent {
  eyebrow: string;
  headline: string;
  subhead: string;
  leaders: LeaderProfile[];
  trustLine: string;
}

const LEADER_CREDIBILITY: LeaderCredibilityContent = {
  eyebrow: 'WHO LEADS THIS',
  headline: "You're not following a stranger.",
  subhead:
    'Team Magnificent is led by the people who built it — and who walk the exact path they ask you to walk.',
  leaders: [
    {
      baId: 'TMBA-FOUNDER-KEVIN',
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
    },
    {
      baId: 'TMBA-FOUNDER-PAUL',
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
    },
  ],
  trustLine:
    'Same path, same product, same people leading it — whether you are deciding today or building a team tomorrow.',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export function LeadershipPage() {
  const navigate = useNavigate();
  const { eyebrow, headline, subhead, leaders, trustLine } = LEADER_CREDIBILITY;

  return (
    <div className="min-h-screen bg-ink text-cream py-14 px-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="text-center max-w-2xl mx-auto">
          <p className="font-mono tracking-[0.22em] text-[11px] text-teal uppercase mb-4">
            {eyebrow}
          </p>
          <h1 className="font-display text-[clamp(40px,7vw,68px)] leading-[0.95] text-cream">
            {headline}
          </h1>
          <p className="mt-5 text-cream-mute text-[clamp(15px,1.6vw,18px)] leading-[1.6]">
            {subhead}
          </p>
        </header>

        {/* Leader cards */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {leaders.map((leader) => (
            <article
              key={leader.baId}
              className="bg-cream/[0.02] border border-gold/25 rounded-md p-7 flex flex-col gap-5"
            >
              <div className="flex items-center gap-4">
                <span
                  aria-hidden="true"
                  className="flex-none grid place-items-center w-[52px] h-[52px] rounded-full font-display text-[22px] text-ink bg-[linear-gradient(135deg,#F5C030,#C9A84C)]"
                >
                  {leader.initials}
                </span>
                <div>
                  <div className="font-display text-[clamp(24px,2.6vw,30px)] leading-none text-cream">
                    {leader.name}
                  </div>
                  <div className="font-mono tracking-[0.18em] text-[11px] text-gold uppercase mt-1.5">
                    {leader.role}
                  </div>
                </div>
              </div>

              <p className="italic text-cream/90 text-[clamp(15px,1.3vw,17px)] leading-[1.5]">
                {leader.tagline}
              </p>

              <ul className="flex flex-col gap-3">
                {leader.trackRecord.map((point, i) => (
                  <li
                    key={i}
                    className="relative pl-[22px] text-cream-mute text-[clamp(14px,1.2vw,16px)] leading-[1.5]"
                  >
                    <span className="absolute left-1 top-[9px] w-1.5 h-1.5 rounded-full bg-teal" />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        {/* Trust line */}
        <p className="mt-12 max-w-2xl mx-auto text-center font-display text-[clamp(22px,3.4vw,34px)] leading-[1.12] text-gold">
          {trustLine}
        </p>

        {/* Back to cockpit */}
        <div className="mt-12 text-center">
          <button
            type="button"
            onClick={() => navigate('/cockpit')}
            className="font-mono tracking-[0.14em] text-[12px] text-cream-faint hover:text-cream uppercase transition-colors"
          >
            ← Back to cockpit
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeadershipPage;
