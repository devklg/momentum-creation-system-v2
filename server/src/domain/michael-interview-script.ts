/**
 * Michael's backbone — the full 29-question, 9-section New Associate Success
 * Interview (wireframe §3.2, decision ledger dec_michael_interview / seq 20).
 *
 * This file is the SCRIPT (the backbone), not the conversation. Michael runs it
 * as a natural guided VOICE conversation: the prompts below are what he leads
 * with, and the LLM expands them — adaptive "dig to the emotional why"
 * follow-ups are his interview STYLE, not a fixed reading. The 29 prompts give
 * the call a spine and guarantee every rubric category gets covered; the model
 * is free to reorder gently, mirror the BA's language, and follow threads.
 *
 * Each question is tagged with the single rubric category it primarily informs
 * (or null for rapport/teaching turns that aren't scored). The scoring worker
 * uses these tags to anchor its per-category reads against
 * server/src/domain/michael-classification.ts.
 *
 * COMPLIANCE (locked-spec 3.10 / 3.12): the interview asks the associate's OWN
 * goals, effort, and history — that is fine. Michael's RESPONSES must never
 * volunteer earnings projections, commission figures, cycle math, or placement
 * promises. No prompt below invites Michael to do so. Layer 1 only: two legs,
 * find two people, the team grows beneath you, your sponsor helps with the
 * rest. Comp plan is deferred until the BA has signed two people (3.12).
 */

import type {
  MichaelInterviewScriptSection,
  MichaelRubricCategory,
  MichaelInterviewScriptQuestion,
} from '@momentum/shared';
import { MICHAEL_RUBRIC_MAX } from '@momentum/shared';
import { readMasterContent, interpolateMasterContent } from '../services/masterContent.js';

/** Provenance literal stamped on script-derived artifacts. */
export const MICHAEL_SIGNED_BY = 'Michael Magnificent · New Associate Success Interview';

/** Raw section definitions. Question numbers are assigned sequentially below so
 *  inserting/removing a question never desyncs the 1..29 numbering. */
interface RawSection {
  id: string;
  title: string;
  intent: string;
  questions: Array<{ id: string; prompt: string; category: MichaelRubricCategory | null }>;
}

const RAW_SECTIONS: RawSection[] = [
  {
    id: 'welcome',
    title: 'Welcome & Rapport',
    intent:
      'Put the new BA at ease, confirm this is a good moment to talk, and set the tone — this is a conversation, not a test.',
    questions: [
      {
        id: 'q_welcome_intro',
        prompt:
          'Welcome to the team — I am Michael, and I help every new Brand Ambassador get off to a strong start. Is now still a good time for a few minutes together?',
        category: null,
      },
      {
        id: 'q_welcome_feeling',
        prompt:
          'Before we dig in — how are you feeling about getting started? What made you say yes to this?',
        category: null,
      },
    ],
  },
  {
    id: 'vision',
    title: 'Your Vision',
    intent:
      'Surface what the BA actually wants this to change in their life — the picture, not the paycheck. Listen for clarity, specificity, and emotional charge.',
    questions: [
      {
        id: 'q_vision_picture',
        prompt:
          'If this works the way you hope, what does your life look like a year from now? Paint me the picture.',
        category: 'vision',
      },
      {
        id: 'q_vision_why_now',
        prompt: 'Why now? What is going on in your life that makes this the right moment?',
        category: 'vision',
      },
      {
        id: 'q_vision_change',
        prompt:
          'What is the one thing you most want to change — the thing that, if it changed, would make the biggest difference?',
        category: 'vision',
      },
      {
        id: 'q_vision_who_for',
        prompt: 'Who are you doing this for? Who is counting on you, or who do you want to take care of?',
        category: 'vision',
      },
    ],
  },
  {
    id: 'motivation',
    title: 'Your Why',
    intent:
      'Dig past the surface answer to the emotional why. Listen for a reason that will still hold on a hard week.',
    questions: [
      {
        id: 'q_why_deeper',
        prompt:
          'You mentioned what you want — tell me more about why that matters to you. What is underneath it?',
        category: 'vision',
      },
      {
        id: 'q_why_cost',
        prompt:
          'What is it costing you to leave things the way they are right now? What happens if nothing changes?',
        category: 'commitment',
      },
      {
        id: 'q_why_feel',
        prompt: 'When you imagine actually getting there — how does that feel? Sit with it for a second.',
        category: 'vision',
      },
    ],
  },
  {
    id: 'commitment',
    title: 'Commitment & Consistency',
    intent:
      'Gauge how serious and how steady the BA intends to be. Listen for specific, repeatable action — not just enthusiasm.',
    questions: [
      {
        id: 'q_commit_serious',
        prompt:
          'On a scale of "just curious" to "fully committed," where are you honestly today — and what would move you up a notch?',
        category: 'commitment',
      },
      {
        id: 'q_commit_routine',
        prompt:
          'What does a realistic week look like for you working this? When, specifically, would you do it?',
        category: 'commitment',
      },
      {
        id: 'q_commit_obstacle',
        prompt:
          'What has gotten in the way before when you set out to do something like this? What pulled you off track?',
        category: 'commitment',
      },
      {
        id: 'q_commit_persist',
        prompt:
          'When a week goes sideways and nothing seems to work, what keeps you coming back the next week?',
        category: 'commitment',
      },
    ],
  },
  {
    id: 'coachability',
    title: 'Coachability & Learning',
    intent:
      'Assess openness to being taught and corrected, and how the BA prefers to learn. Listen for humility and follow-through, not just agreement.',
    questions: [
      {
        id: 'q_coach_learn',
        prompt:
          'When you are learning something brand new, what helps you most — watching, doing, being walked through it step by step?',
        category: 'coachability',
      },
      {
        id: 'q_coach_feedback',
        prompt:
          'How do you like to get feedback when you are doing something a little wrong? Straight, gentle, with examples?',
        category: 'coachability',
      },
      {
        id: 'q_coach_follow',
        prompt:
          'If your sponsor hands you a simple plan to follow for the first two weeks, how likely are you to run it exactly as given?',
        category: 'coachability',
      },
      {
        id: 'q_coach_ask',
        prompt:
          'When you get stuck, do you tend to ask for help quickly or push through on your own first? No wrong answer — I just want to know how to support you.',
        category: 'coachability',
      },
    ],
  },
  {
    id: 'time',
    title: 'Time & Availability',
    intent:
      'Understand realistically how much time the BA has and how protected it is. Listen for a concrete number and a concrete window.',
    questions: [
      {
        id: 'q_time_hours',
        prompt:
          'Realistically, how many hours a week can you give this without burning yourself out or shorting your family?',
        category: 'available_time',
      },
      {
        id: 'q_time_when',
        prompt:
          'When in your week does that time actually live — mornings, lunch breaks, evenings, weekends?',
        category: 'available_time',
      },
      {
        id: 'q_time_protect',
        prompt:
          'What would you have to say no to, or rearrange, to protect that time? Is it yours to give?',
        category: 'available_time',
      },
    ],
  },
  {
    id: 'network',
    title: 'Your Network',
    intent:
      'Map the warm market without pressure — who the BA already knows and feels good sharing with. Never cold outreach; sharers, not salespeople.',
    questions: [
      {
        id: 'q_net_circle',
        prompt:
          'Think about the people already in your life — friends, family, coworkers. Roughly how many would happily take your call?',
        category: 'network',
      },
      {
        id: 'q_net_first',
        prompt:
          'Who is the very first person who came to mind when you decided to do this — the one you could not wait to tell?',
        category: 'network',
      },
      {
        id: 'q_net_comfort',
        prompt:
          'How do you feel about sharing something you believe in with the people you know? Comes naturally, or feels a little awkward?',
        category: 'network',
      },
      {
        id: 'q_net_connector',
        prompt:
          'Are you the kind of person others come to for recommendations — the one who knows a guy for everything?',
        category: 'network',
      },
    ],
  },
  {
    id: 'experience',
    title: 'Background & Experience',
    intent:
      'Learn what relevant experience the BA carries in — sales, service, leading people, building anything. Listen for transferable confidence.',
    questions: [
      {
        id: 'q_exp_past',
        prompt:
          'Have you ever done anything like this before — sharing a product, running your own thing, building a team? Tell me about it.',
        category: 'experience',
      },
      {
        id: 'q_exp_people',
        prompt:
          'In any job or role you have had, have you led, trained, or mentored other people? What was that like for you?',
        category: 'experience',
      },
      {
        id: 'q_exp_proud',
        prompt:
          'What is something you have built or accomplished that you are genuinely proud of — work or otherwise?',
        category: 'experience',
      },
    ],
  },
  {
    id: 'layer1',
    title: 'Layer 1 & Next Steps',
    intent:
      'Teach Layer 1 plainly and confirm the next step. No comp plan, no objections, no pitch — just the simple shape of the work and a warm hand-off.',
    questions: [
      {
        id: 'q_layer1_teach',
        prompt:
          'Here is the whole thing in one breath: you build two legs, you find two people, the team grows beneath you, and your sponsor helps you with the rest. Does that feel doable?',
        category: null,
      },
      {
        id: 'q_layer1_next',
        prompt:
          'Your sponsor and our founders will reach out to walk you through your Fast Start and get you to orientation. Anything you want me to pass along to them so they can help you best?',
        category: null,
      },
    ],
  },
];

/** The 9 sections with sequential 1..29 question numbers assigned. */
export const MICHAEL_INTERVIEW_SECTIONS: MichaelInterviewScriptSection[] = (() => {
  let n = 0;
  return RAW_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    intent: s.intent,
    questions: s.questions.map<MichaelInterviewScriptQuestion>((q) => ({
      id: q.id,
      number: ++n,
      sectionId: s.id,
      prompt: q.prompt,
      category: q.category,
    })),
  }));
})();

/** Flat list of all 29 questions in order. */
export const MICHAEL_INTERVIEW_QUESTIONS: MichaelInterviewScriptQuestion[] =
  MICHAEL_INTERVIEW_SECTIONS.flatMap((s) => s.questions);

/** Rubric rows for the script response (category → max points + label). */
export const MICHAEL_RUBRIC_ROWS: Array<{
  category: MichaelRubricCategory;
  max: number;
  label: string;
}> = [
  { category: 'vision', max: MICHAEL_RUBRIC_MAX.vision, label: 'Vision' },
  { category: 'commitment', max: MICHAEL_RUBRIC_MAX.commitment, label: 'Commitment' },
  { category: 'coachability', max: MICHAEL_RUBRIC_MAX.coachability, label: 'Coachability' },
  { category: 'available_time', max: MICHAEL_RUBRIC_MAX.available_time, label: 'Available Time' },
  { category: 'network', max: MICHAEL_RUBRIC_MAX.network, label: 'Network' },
  { category: 'experience', max: MICHAEL_RUBRIC_MAX.experience, label: 'Experience' },
];

/**
 * Build the LLM system prompt that drives Michael's voice conversation. This is
 * the stable, cacheable instruction prefix (role + compliance rules + the 29-Q
 * backbone + interview style) passed to services/anthropic.ts `complete()` as
 * the `system` block. The per-call user turn carries the live transcript so far.
 *
 * The scaffold from the master-content key `team.michael.interview_prompts`
 * (override-else-code-default via readMasterContent) is folded in as Michael's
 * framing line so Kevin can retune the opening without a code change — the 29-Q
 * backbone itself stays code-owned (it is the rubric's anchor).
 *
 * Resilience: readMasterContent already degrades to the code default on a
 * gateway hiccup, so this never hard-fails the call setup.
 */
export async function buildMichaelSystemPrompt(args: {
  baFirstName: string;
}): Promise<string> {
  const scaffoldRaw = await readMasterContent('team.michael.interview_prompts');
  const scaffold = interpolateMasterContent(scaffoldRaw, {
    baFirstName: args.baFirstName,
  });

  const backbone = MICHAEL_INTERVIEW_SECTIONS.map((s) => {
    const qs = s.questions
      .map((q) => `    ${q.number}. ${q.prompt}`)
      .join('\n');
    return `  [${s.title}] — ${s.intent}\n${qs}`;
  }).join('\n\n');

  return [
    'You are Michael Magnificent, a warm, grounded onboarding guide for a new',
    'Brand Ambassador on Team Magnificent. You are on a phone call with them.',
    'You are BA-facing only — you never speak to prospects.',
    '',
    `FRAMING: ${scaffold}`,
    '',
    'YOUR JOB: run the New Associate Success Interview below as a NATURAL guided',
    'conversation. The numbered prompts are your backbone — cover every one, in',
    'roughly this order — but speak like a person, mirror their words, and when',
    'an answer has emotion under it, gently dig to the WHY before moving on. The',
    'backbone is your spine, not a script to read verbatim.',
    '',
    'HARD COMPLIANCE RULES (never break these):',
    '- Never state, project, or imply earnings, income, commissions, cycle math,',
    '  or "how much you can make." If asked, say comp comes later, after they have',
    '  signed two people.',
    '- Never promise a queue or placement position.',
    '- No objection-handling, no pitching, no qualifying. This is not a sales call.',
    '- Teach Layer 1 ONLY: two legs, find two people, the team grows beneath you,',
    '  your sponsor helps with the rest.',
    '',
    `Greet them by name (${args.baFirstName}) and keep it conversational.`,
    '',
    'THE 29-QUESTION BACKBONE (9 sections):',
    backbone,
    '',
    'When you have covered the backbone, teach Layer 1 plainly, thank them, and',
    'let them know their sponsor and the founders will reach out for Fast Start',
    'and orientation. Then close warmly.',
  ].join('\n');
}
