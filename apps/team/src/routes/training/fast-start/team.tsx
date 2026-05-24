/**
 * /training/fast-start/team — Module 5: Build Your Team.
 *
 * TASK.md "core truth this training must teach (do NOT water this down)":
 *
 *   Team Magnificent's leadership is a six-figure earner (Adrianne) and a
 *   SEVEN-figure earner (Paul). Expectations are NOT built on "$500/month
 *   from two friends." That is the fallacy this module must actively
 *   correct:
 *
 *     - "Get your two" is the ACTIVATION step, not the income model.
 *       Two people who do nothing pays nothing. The 2→4→8…→8,190
 *       duplication chart only materializes when REAL recruiting
 *       volume flows through the legs.
 *
 *     - You make money by recruiting a TEAM and driving VOLUME. The
 *       binary compounds the activity you put in; it does not
 *       manufacture activity from inactivity.
 *
 *     - The REAL MODEL, from the upline onboarding call (verified,
 *       .team-only): the leader placed 22 people in her first two
 *       weeks (11 left / 11 right) by contacting ~240 people. Her
 *       numbers: ~120 names → ~12 recruits; 30 contacts → ~15 look
 *       → ~6 enroll. "It's a numbers game." Build far-left /
 *       far-right, balance the org.
 *
 *     - Tone: calm, demonstration-led Team Magnificent voice —
 *       recruit seriously, drive volume, duplicate — WITHOUT
 *       importing hard-sell / pressure framing.
 *
 * This is the closer. Final module. On mark-complete, the BA bounces
 * back to the hub so they see the progress strip flip COMPLETE.
 *
 * Compliance scope: .team only.
 */

import { Link } from 'react-router-dom';
import {
  ModuleScaffold,
  SectionLabel,
  SectionTitle,
  Prose,
  Callout,
  DataCard,
} from './_scaffold';

export function ModuleTeamPage() {
  return (
    <ModuleScaffold moduleId={5} nextSlug={null}>
      {/* ── The fallacy to kill ─────────────────────────────────── */}
      <SectionLabel>What this module corrects</SectionLabel>
      <SectionTitle>"Find two and stop" is the trap.</SectionTitle>
      <Prose>
        <p>
          Module 2 taught the cycle math. Module 3 walked the duplication chart that puts 16,384
          people on one leg after 14 rounds. It would be easy to leave Module 3 thinking the job is
          to "find two and stop." It is not. Your first two are how you{' '}
          <strong className="text-cream">activate</strong> — they unlock your ability to earn. Two
          who do nothing pays nothing.
        </p>
        <p>
          The duplication chart is what happens when{' '}
          <strong className="text-cream">real recruiting volume flows through the legs</strong>. The
          binary compounds the activity you put in. It does not manufacture activity from
          inactivity. You make money by{' '}
          <strong className="text-cream">recruiting a TEAM and driving VOLUME</strong>. Module 5 is
          how to do that without becoming the person nobody picks up the phone for.
        </p>
      </Prose>

      <Callout tone="gold" title="THE EXPECTATION ON TEAM MAGNIFICENT">
        Adrianne is a six-figure earner. Paul is a seven-figure earner. The expectation here is not
        "$500/month from two friends." The expectation is that you build a team and let the binary
        do what it does. The method is professional — never desperate — but the work is real work.
      </Callout>

      {/* ── The real model (the upline call) ────────────────────── */}
      <SectionLabel>The real model</SectionLabel>
      <SectionTitle>22 people in two weeks. From 240 contacts.</SectionTitle>
      <Prose>
        <p>
          The verified upline number for what a serious first two weeks looks like:{' '}
          <strong className="text-cream">22 people placed</strong> (11 on the left leg, 11 on the
          right), from{' '}
          <strong className="text-cream">~240 honest contacts</strong>. That's not "a few friends."
          That's a person who treated their warm market like a business for ten days straight.
        </p>
      </Prose>

      <div className="grid grid-cols-3 gap-2 my-8">
        <DataCard num="240" label="Contacts" />
        <DataCard num="22" label="Enrolled in 2 weeks" highlight />
        <DataCard num="11 / 11" label="Left leg / right leg" />
      </div>

      <Prose>
        <p>
          The general ratios behind those numbers — the honest ones the leader shared, and the ones
          worth holding loosely while you build your own data — break down like this:
        </p>
      </Prose>

      <div className="border border-line bg-[#1A1A1A] my-6">
        <RatioRow
          left="~120 names on the list"
          arrow="→"
          right="~12 recruits"
          note="The 100+ names list isn't decoration. It's the input."
        />
        <RatioRow
          left="30 contacts in a week"
          arrow="→"
          right="~15 look at the link"
          note="Roughly half of warm contacts will at least open and watch."
        />
        <RatioRow
          left="15 who look"
          arrow="→"
          right="~6 enroll"
          note="Of the people who actually watch, a meaningful fraction join."
          last
        />
      </div>

      <Callout tone="teal" title="THESE ARE HER NUMBERS, NOT YOURS">
        Your ratios will be different. They might be better. They might be worse early. The point
        is not the exact percentages. The point is{' '}
        <strong className="text-cream">the math is generous when your list and your activity are
        honest</strong>. The binary doesn't reward perfect — it rewards consistent.
      </Callout>

      {/* ── Build far-left / far-right ──────────────────────────── */}
      <SectionLabel>The placement habit</SectionLabel>
      <SectionTitle>Far-left, far-right. Balance the org.</SectionTitle>
      <Prose>
        <p>
          When you enroll someone, you choose placement in the back office —{' '}
          <strong className="text-cream">bottom-left or bottom-right of your tree</strong> — and then
          enroll them. Auto-placement defaults to the lower-volume leg if you don't choose. As you
          add people, you are intentionally extending the legs deep and balancing them so the
          cycles fire.
        </p>
        <p>
          The temptation early on is to place everyone on the "easier" leg. Resist it. A binary that
          becomes wildly unbalanced is a binary that doesn't pay you cycles — the lesser leg gates
          the math. Build both. Teach your people to build both. The leg that pays you next month is
          the one you stack now.
        </p>
      </Prose>

      {/* ── The CRM call-out ────────────────────────────────────── */}
      <SectionLabel>Make it real today</SectionLabel>
      <SectionTitle>Mark your first candidates in the CRM.</SectionTitle>
      <Prose>
        <p>
          The cockpit is your CRM. Every invitation you send is logged there with the prospect's
          status — sent, opened, watched, callback, enrolled. Module 4 walked you to Ivory to{' '}
          <em>build the names list</em>. This is the step that converts list into action:{' '}
          <strong className="text-cream">pick your first 10 candidates and write the invitations
          today.</strong>
        </p>
        <p>
          You do not need all 10 to say yes. You need 10 attempts to start. By the end of this week,
          the cockpit should have rows in it. By the end of week two, you should know which of those
          rows opened the link — and which ones you are calling next.
        </p>
      </Prose>

      <div className="grid md:grid-cols-2 gap-3 my-6">
        <div className="bg-[#1A1A1A] border border-gold p-6 flex flex-col gap-2">
          <div className="font-mono tracking-[0.22em] text-[10px] text-gold uppercase">
            Step 1
          </div>
          <div className="font-display tracking-[0.04em] text-[18px] text-cream leading-tight">
            Write your first invitation.
          </div>
          <div className="text-cream-mute text-[13px] font-light leading-[1.6]">
            ScriptMaker can draft for you, or write it yourself. The /invitations form mints the
            shareable link and logs it.
          </div>
          <Link
            to="/invitations"
            className="font-mono tracking-[0.18em] text-[10px] text-gold uppercase mt-2 hover:text-gold-bright"
          >
            OPEN INVITATIONS →
          </Link>
        </div>
        <div className="bg-[#1A1A1A] border border-line p-6 flex flex-col gap-2">
          <div className="font-mono tracking-[0.22em] text-[10px] text-cream-mute uppercase">
            Step 2
          </div>
          <div className="font-display tracking-[0.04em] text-[18px] text-cream leading-tight">
            Watch your cockpit fill in.
          </div>
          <div className="text-cream-mute text-[13px] font-light leading-[1.6]">
            Every invitation, every click, every video-complete, every callback request. Your
            business in one screen.
          </div>
          <Link
            to="/cockpit"
            className="font-mono tracking-[0.18em] text-[10px] text-cream-mute uppercase mt-2 hover:text-gold"
          >
            OPEN COCKPIT →
          </Link>
        </div>
      </div>

      {/* ── The closing ─────────────────────────────────────────── */}
      <SectionLabel>What you walk away with</SectionLabel>
      <SectionTitle>The work is the work.</SectionTitle>
      <Prose>
        <p>
          You now know the product (Module 1). You know the compensation (Module 2). You know the
          binary and the duplication that drives it (Module 3). You know how to build the list and
          send the first message (Module 4). And you know that the first two activate, but the
          team — and the volume that team drives — is what actually pays.
        </p>
        <p>
          Team Magnificent is calm, demonstration-led, and serious. The product is real. The market
          is enormous and early. The leaders ahead of you have already proven the model. Your job
          is the small thing, done twice, taught to your two, and then again. Numbers + duplication
          + a system that doesn't break = a binary that pays.
        </p>
        <p className="text-gold font-display tracking-[0.06em] text-[20px] mt-6">
          Mark this complete. Send your first invitation. Welcome to the team.
        </p>
      </Prose>
    </ModuleScaffold>
  );
}

function RatioRow({
  left,
  arrow,
  right,
  note,
  last,
}: {
  left: string;
  arrow: string;
  right: string;
  note: string;
  last?: boolean;
}) {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-[1fr_24px_1fr] gap-2 md:gap-4 items-center p-4 ${
        last ? '' : 'border-b border-line'
      }`}
    >
      <div className="font-display tracking-[0.03em] text-[16px] text-cream">{left}</div>
      <div className="font-display text-[22px] text-gold text-center max-md:hidden">{arrow}</div>
      <div className="font-display tracking-[0.03em] text-[16px] text-teal">{right}</div>
      <div className="md:col-span-3 text-cream-mute text-[12px] font-light leading-[1.5] mt-1 max-w-[640px]">
        {note}
      </div>
    </div>
  );
}
