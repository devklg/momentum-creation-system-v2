/**
 * /training/10-steps — the 10-Step Orientation reference card.
 * Spec: locked-spec.md Part 4.5 (locked Chat #99, route locked Chat #100).
 *
 * Format: live Zoom/conference call hosted by Kevin or Paul. Not self-paced.
 * This page is the shared visual aid DURING the live call and the BA's
 * permanent reference AFTER.
 *
 * Compliance scope: .team only. The CV figures inside the step bodies
 * (900 CV from Simple Six Ultimate Pack, 60+ CV/month Smart Ship, 300 CV
 * lesser + 600 CV greater = $35 per cycle) are appropriate inside this
 * regulated training environment. They never bleed to .com.
 *
 * Source HTML: github.com/devklg/team-magnificent-training/blob/main/10-steps.html
 * Port differences from the legacy:
 *   - Legacy --accent (#2ECC71 green) and --orange (#D4601A) removed.
 *     Both colors drifted from the locked five-color palette. Replaced with
 *     teal (#2DD4BF) where teal accent serves the same semantic role.
 *   - Tailwind utility classes instead of inline <style> tags.
 *   - React useState for the active-step toggle instead of vanilla JS.
 *   - PMV+C footer mantra preserved verbatim (People · Momentum ·
 *     Volume · Checks).
 */

import { useState } from 'react';
import { ContextResources } from '@/components/resources/ContextResources';

interface Step {
  n: string;
  name: string;
  desc: string;
  insight: string;
}

const STEPS: Step[] = [
  {
    n: '01',
    name: 'Create an Emotional Barrier of Exit',
    desc: 'Establish your WHY — it should make you cry. Your WHY is bigger than any obstacle, any rejection, any slow week. When you know WHY, the HOW becomes possible.',
    insight: 'Your why is your fuel. Write it down. Say it out loud. Share it with your sponsor today.',
  },
  {
    n: '02',
    name: 'Place an Appropriate Initial Order',
    desc: 'Choose Entry, Elite, or Pro pack. People do what YOU do — start bigger, your team starts bigger. Your initial order is your first statement of belief in this business.',
    insight: 'The Simple Six Ultimate Pack generates 900 CV on day one — that\u2019s a full cycle by itself.',
  },
  {
    n: '03',
    name: 'Pay Your Overhead',
    desc: 'It costs money to do business. Set up your Smart Ship at 60+ CV per month to stay active and qualify for Team Commission payouts every week.',
    insight: 'Smart Ship is not an expense — it is your weekly paycheck qualification.',
  },
  {
    n: '04',
    name: 'Review Back Office Daily',
    desc: 'Review your back office DAILY for minimum 30 days. Know your numbers — your volume, your team, your rank. What gets measured gets improved.',
    insight: 'Your back office is your cockpit. Professionals check their instruments every day.',
  },
  {
    n: '05',
    name: 'Build Belief',
    desc: 'Build belief in the PRODUCT, the INDUSTRY, and YOURSELF. Use the product. Know the science. Study the numbers. You can only sell what you believe in — and you can only lead what you live.',
    insight: 'Kevin lost 14 lbs in 6 weeks on GLP THREE. That is belief with evidence.',
  },
  {
    n: '06',
    name: 'Create Your Candidate List',
    desc: 'Write 100+ names. Add 5–10 new names DAILY. Don\u2019t pre-judge anyone — the ones you think will say no are often the ones who build empires. Everyone deserves to hear about this.',
    insight: 'Your list is your business. A professional maintains and grows it every single day.',
  },
  {
    n: '07',
    name: 'Master the Art of Invitation',
    desc: 'Learn the proper way to invite. Be genuine, not salesy. Connect with 2–3 people per day. The invitation is not a pitch — it is an opportunity you are offering to someone you care about.',
    insight: 'Professionals invite. Amateurs try to sell. Master the difference.',
  },
  {
    n: '08',
    name: 'Learn How to Present',
    desc: 'Simple flow: Your Story → Products → Opportunity → Next Step. Keep it SHORT — 15 to 30 minutes maximum. Your story is your most powerful tool. People join people, not companies.',
    insight: 'The tools present for you. Your job is to connect, share your story, and invite to a next step.',
  },
  {
    n: '09',
    name: 'Winning the Race to Profitability',
    desc: 'Focus on profitable actions. Build BOTH legs equally for maximum cycles. The binary rewards balance — every week you build both sides is a week you move toward your next cycle threshold.',
    insight: '300 CV lesser leg + 600 CV greater leg = $35. Build both. Every week. Without exception.',
  },
  {
    n: '10',
    name: 'Take MASSIVE Action',
    desc: 'Implement CONSISTENT, MASSIVE action toward your goals. 67 enrollments in 3 days is POSSIBLE. Speed of the leader is the speed of the group. Move fast and your team moves fast.',
    insight: 'SUCCESS LOVES SPEED. This is not a hobby. This is a business. Run it like one.',
  },
];

export function TenStepsPage() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  function toggleStep(i: number) {
    setActiveIndex((curr) => (curr === i ? null : i));
  }

  return (
    <div className="min-h-screen bg-ink text-cream relative overflow-hidden">
      {/* Atmospheric mesh — fixed, behind everything */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'radial-gradient(900px circle at 12% 8%, rgba(201,168,76,0.06), transparent 60%), radial-gradient(900px circle at 88% 92%, rgba(45,212,191,0.04), transparent 60%)',
        }}
        aria-hidden="true"
      />

      {/* Top brand strip */}
      <header className="relative z-10 px-6 md:px-10 pt-6 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/logos/logo_icon.png"
            alt=""
            aria-hidden="true"
            className="h-7 w-auto"
          />
          <span className="font-display tracking-[0.18em] text-[15px] text-gold">
            TEAM MAGNIFICENT
          </span>
        </div>
        <span className="font-mono tracking-[0.22em] text-[10px] text-cream-mute uppercase">
          Training · 10-Step Orientation
        </span>
      </header>

      {/* MAIN SECTION */}
      <section className="relative z-10 px-6 py-20 border-b border-line">
        <div className="max-w-[860px] mx-auto">
          {/* Section tag */}
          <div className="flex items-center gap-3 mb-4">
            <span className="font-mono tracking-[0.35em] text-[9px] text-gold uppercase">
              Your Blueprint for Success
            </span>
            <span className="flex-1 h-px bg-line" />
          </div>

          {/* Section title */}
          <h1 className="font-display tracking-[0.03em] leading-[0.95] text-[clamp(36px,6vw,64px)] mb-6">
            <span className="block">10 Steps to</span>
            <span className="block text-gold">Building Your Business</span>
          </h1>

          {/* Steps */}
          <div className="flex flex-col gap-[2px] mt-9">
            {STEPS.map((step, i) => {
              const isActive = activeIndex === i;
              return (
                <button
                  key={step.n}
                  type="button"
                  onClick={() => toggleStep(i)}
                  className={[
                    'group text-left bg-[#1A1A1A] border transition-colors',
                    'grid grid-cols-[64px_1fr] gap-6 items-start',
                    'p-7 md:px-8',
                    'cursor-pointer',
                    isActive
                      ? 'border-gold bg-gold/[0.05]'
                      : 'border-line hover:border-gold/30',
                    // Mobile: tighter grid, smaller step number
                    'max-md:grid-cols-[48px_1fr] max-md:gap-4',
                  ].join(' ')}
                  aria-expanded={isActive}
                  aria-controls={`step-insight-${step.n}`}
                >
                  <div
                    className={[
                      'font-display text-[56px] leading-none transition-colors',
                      'max-md:text-[40px]',
                      isActive ? 'text-gold' : 'text-gold/25 group-hover:text-gold',
                    ].join(' ')}
                  >
                    {step.n}
                  </div>
                  <div>
                    <div className="font-display text-[22px] tracking-[0.04em] text-cream mb-2">
                      {step.name}
                    </div>
                    <div className="text-[13px] text-cream-mute leading-[1.65] font-light">
                      {step.desc}
                    </div>
                    {isActive && (
                      <div
                        id={`step-insight-${step.n}`}
                        className="font-mono text-[10px] tracking-[0.12em] text-teal mt-2.5 pt-2.5 border-t border-teal/15"
                      >
                        ★ {step.insight}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
          <ContextResources contextTag="context:training:10-steps" />
        </div>
      </section>

      {/* PMV+C MANTRA STRIP — gold band, ink text */}
      <section className="relative z-10 bg-gold py-3.5 px-6">
        <div className="max-w-[860px] mx-auto flex items-center justify-center gap-4 md:gap-8">
          <MantraItem word="People" sub="Build the team" />
          <span className="w-px h-9 bg-ink/20 flex-shrink-0" />
          <MantraItem word="Momentum" sub="Fuel the movement" />
          <span className="w-px h-9 bg-ink/20 flex-shrink-0" />
          <MantraItem word="Volume" sub="Create cycles" />
          <span className="w-px h-9 bg-ink/20 flex-shrink-0" />
          <MantraItem word="Checks" sub="Get paid weekly" />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 bg-black border-t border-line py-7 px-10 flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
        <div className="font-display tracking-[0.1em] text-[18px] text-gold">
          TEAM MAGNIFICENT
        </div>
        <div className="font-mono tracking-[0.15em] text-[9px] text-cream-faint uppercase">
          For Training Purposes Only · Not a guarantee of income · © 2026 Team Magnificent
        </div>
      </footer>
    </div>
  );
}

function MantraItem({ word, sub }: { word: string; sub: string }) {
  return (
    <div className="flex-1 max-w-[180px] text-center">
      <div className="font-display tracking-[0.1em] text-[clamp(18px,3vw,26px)] text-ink leading-none">
        {word}
      </div>
      <div className="font-mono tracking-[0.2em] text-[8px] text-ink/50 uppercase mt-0.5">
        {sub}
      </div>
    </div>
  );
}
