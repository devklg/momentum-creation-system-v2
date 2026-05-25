/**
 * /training/fast-start/prospect-list — Module 4: Build Your Prospect List.
 *
 * Per TASK.md (hard rule): this module LINKS OUT to Ivory (/ivory) — it
 * does NOT embed Ivory. Ivory itself ships in a parallel worktree
 * (feat/invitation-generator-ivory). This module sets up:
 *   - The names-list mindset (don't pre-judge)
 *   - The first-touch script (curiosity only — never the whole story)
 *   - The book-the-follow-up-BEFORE-sending-the-link discipline
 *   - The hand-off to Ivory at /ivory
 *
 * First-touch script comes from the verified upline onboarding call
 * (TASK.md, .team-only content), adapted to TM voice.
 *
 * Compliance scope: .team only. The script never includes income, comp,
 * or claims; it is the curiosity message that precedes the shared video.
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

export function ModuleProspectListPage() {
  return (
    <ModuleScaffold moduleId={4}>
      {/* ── The names list ──────────────────────────────────────── */}
      <SectionLabel>The first asset of the business</SectionLabel>
      <SectionTitle>Your names list is the business.</SectionTitle>
      <Prose>
        <p>
          The single most predictive thing a Brand Ambassador can do in their first 30 days is build
          and maintain a names list. <strong className="text-cream">100+ names to start. 5–10 new
          names added every single day.</strong> The list is not a one-time exercise. It is a
          discipline.
        </p>
        <p>
          You don't sell from your list. You don't pre-judge from your list. The list is the universe
          you draw from when you invite. The bigger and more honest the list, the less precious any
          one share becomes — which is the whole point of doing this professionally.
        </p>
      </Prose>

      <div className="grid grid-cols-3 gap-2 my-8">
        <DataCard num="100+" label="Names to start" />
        <DataCard num="5–10" label="New names per day" highlight />
        <DataCard num="0" label="People you pre-judge" />
      </div>

      <Callout tone="gold" title="DON'T PRE-JUDGE ANYONE">
        The ones you think will say no are often the ones who build empires. The ones you think will
        say yes often don't. You don't know who is ready. Your job is to make sure they{' '}
        <em>have the chance</em> to decide. Everyone deserves to hear about this.
      </Callout>

      {/* ── The mindset ─────────────────────────────────────────── */}
      <SectionLabel>The mindset</SectionLabel>
      <SectionTitle>You are sharing, not selling.</SectionTitle>
      <Prose>
        <p>
          The locked-spec calls Brand Ambassadors <strong className="text-cream">sharers</strong>,
          not salespeople. The difference is everything. A salesperson tries to convince. A sharer
          offers and respects the answer. The system — the market — the product — is doing the
          convincing. Your job is access.
        </p>
        <p>
          Three rules from Kevin's welcome letter:{' '}
          <em>share the video, respect the decision, move on, repeat.</em> When you take the
          pressure off yourself to "close," the conversation becomes natural again — and natural
          conversations are the only ones that convert.
        </p>
      </Prose>

      {/* ── The first-touch script ──────────────────────────────── */}
      <SectionLabel>The first-touch script</SectionLabel>
      <SectionTitle>Curiosity only. Never the whole story.</SectionTitle>
      <Prose>
        <p>
          The first message is not a pitch. It is a doorknob. Your only job at first-touch is to make
          the person curious enough to want the link — and to <strong className="text-cream">book a
          follow-up time BEFORE you send the link</strong>. Sending the link without a booked
          follow-up is how a great prospect quietly disappears.
        </p>
      </Prose>

      <div className="bg-[#1A1A1A] border-l-4 border-gold p-6 my-6">
        <div className="font-mono tracking-[0.22em] text-[10px] text-gold uppercase mb-3">
          The script
        </div>
        <p className="font-display tracking-[0.02em] text-[18px] text-cream leading-[1.55]">
          "Hey [name] — I'm launching a new GLP-THREE business that's super hot, and you came to
          mind. Can I send you a quick info link and get your honest feedback? Nothing for you to
          buy. I just want to know what you think."
        </p>
        <div className="border-t border-line/50 pt-3 mt-4">
          <div className="font-mono tracking-[0.15em] text-[10px] text-cream-mute uppercase mb-2">
            Then, BEFORE sending the link:
          </div>
          <p className="font-display tracking-[0.02em] text-[16px] text-cream leading-[1.55]">
            "Cool — let's grab 15 minutes after you've watched it. Does Thursday at 6 work, or is
            Friday morning better?"
          </p>
        </div>
      </div>

      <Callout tone="teal" title="WHY THIS WORKS">
        Curiosity beats persuasion. Specificity ("GLP-THREE", "quick info link") beats vagueness.
        Asking for feedback flips the dynamic — you are not selling, they are evaluating. And the
        booked follow-up is the discipline that turns a 30-second share into a real conversation.
      </Callout>

      {/* ── The hand-off to Ivory ───────────────────────────────── */}
      <SectionLabel>Where the list lives</SectionLabel>
      <SectionTitle>Ivory.</SectionTitle>
      <Prose>
        <p>
          You can keep your list on paper. Plenty of seven-figure earners did, and still do.{' '}
          <strong className="text-cream">Ivory</strong> is the in-app version — the who-do-you-know
          assistant built for Team Magnificent. It helps you surface names from your warm market that
          you would not have thought of unaided, and it hands those names off to ScriptMaker (the
          /invitations form) when you are ready to write a personalized message.
        </p>
        <p>
          Ivory and ScriptMaker do not send anything. They never auto-message anyone. They help you
          remember and write — you still send from your own phone, BA to prospect, the way the
          channel has always worked. That is by design.
        </p>
      </Prose>

      <div className="bg-[#1A1A1A] border border-gold p-6 my-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <div className="font-mono tracking-[0.22em] text-[10px] text-gold uppercase mb-1">
            When you're ready
          </div>
          <div className="font-display tracking-[0.04em] text-[20px] text-cream">
            Open Ivory and surface your first 25 names.
          </div>
          <div className="text-cream-mute text-[13px] font-light mt-1">
            You'll come back here when you're done. Module 5 turns those names into action.
          </div>
        </div>
        <Link
          to="/ivory"
          className="font-display tracking-[0.08em] text-[14px] px-6 py-3 bg-gold text-ink hover:bg-gold-bright transition-colors flex-shrink-0"
        >
          OPEN IVORY →
        </Link>
      </div>

      {/* ── The numbers preview (Module 5 setup) ────────────────── */}
      <SectionLabel>The numbers reality</SectionLabel>
      <SectionTitle>This is a numbers game. Honest one.</SectionTitle>
      <Prose>
        <p>
          The leader who placed 22 people in her first two weeks did it by contacting roughly{' '}
          <strong className="text-cream">240 people</strong>. Her honest ratios:{' '}
          <strong className="text-cream">120 names → 12 recruits</strong>; in any given week,{' '}
          <strong className="text-cream">30 contacts → 15 look → 6 enroll</strong>. The point is not
          that her ratios will be yours. The point is the math is generous when your list and your
          activity are honest.
        </p>
        <p className="text-gold font-display tracking-[0.06em] text-[18px] mt-6">
          Module 5 makes this concrete — how to turn a names list into a team, why "find two and
          stop" is the trap, and what the real model looks like.
        </p>
      </Prose>
    </ModuleScaffold>
  );
}
