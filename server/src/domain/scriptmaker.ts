/**
 * ScriptMaker domain (Chat #122) — the product-video draft engine.
 *
 * ScriptMaker is the VIDEO-LIBRARY front door of the one invitation engine
 * (Chat #118 lock). When a BA finishes a product video (or taps a card's
 * "who can use this?"), ScriptMaker writes a personalized, compliance-clean
 * invitation DRAFT anchored to that product. The BA reviews/edits it, then
 * it flows into the existing /invitations spine via seed + source=
 * 'scriptmaker' (Chat #120 seam). ScriptMaker proposes; the BA disposes.
 *
 * BOUNDARY (Chat #118): ScriptMaker drafts only. It does NOT mint the
 * token, create the prospect record, or send anything — those stay in the
 * deterministic spine (domain/invitations.ts). Prospect-surfacing ("who do
 * you know") is IVORY's job, a separate surface next session; this session
 * the BA names the prospect and ScriptMaker writes the message.
 *
 * COMPLIANCE — script-time enforcement (locked-spec 3.11 + 3.10):
 *   The system prefix below encodes the NEVER rules as hard constraints.
 *   The draft is BA-to-prospect word-of-mouth, so it leads with the product
 *   and a personal, low-pressure invitation to watch — never income,
 *   earnings, placement/queue, comp/cycle/rank math, or medical/weight-loss
 *   guarantees. If the model cannot honor the ask without violating a rule,
 *   it is instructed to fall back to a neutral product-and-invite message.
 *   The prefix is STABLE across calls (only the per-prospect turn varies) so
 *   it hits the prompt cache (Chat #118 cost lock) via services/anthropic.ts.
 *
 * DORMANT-AWARE: if ANTHROPIC_API_KEY is unset, complete() throws
 * AnthropicConfigError; draftInvitation catches it and returns a neutral
 * deterministic fallback with degraded=true, so the surface still works
 * before the key lands (mirrors the Resend dormant pattern).
 */

import {
  complete,
  AnthropicConfigError,
  AnthropicError,
} from '../services/anthropic.js';

export interface DraftInvitationInput {
  productName: string;
  videoTitle: string;
  prospectFirstName: string;
  prospectContext?: string | null;
}

export interface DraftInvitationResult {
  draft: string;
  degraded: boolean;
}

/**
 * The stable, cacheable system prefix. Everything that does NOT vary per
 * prospect lives here so repeated drafts hit the prompt cache. This is the
 * script-time compliance gate (locked-spec 3.11) — the rules are stated as
 * hard constraints the model must satisfy.
 */
const SYSTEM_PREFIX = [
  'You are ScriptMaker, a writing assistant for Team Magnificent Brand',
  'Ambassadors. A Brand Ambassador (BA) just watched a product video and',
  'wants to share it with someone they personally know. Your job is to draft',
  'a short, warm, personal invitation message the BA can send from their own',
  'phone — the way a real recommendation travels between two people who know',
  'each other.',
  '',
  'WHAT A GOOD DRAFT IS:',
  '- Personal and casual, in the BA\u2019s own voice, like a text to a friend.',
  '- Leads with the product and a genuine reason the person might find it',
  '  interesting. The product leads; everything else follows.',
  '- Invites them to WATCH a short video and decide for themselves. No',
  '  pressure, no chasing, no objection-handling, no “closing.”',
  '- 2–4 sentences. SMS-length. Ends with a light, no-pressure nudge to watch.',
  '- Does NOT include a link — the system adds the personal link separately.',
  '- Warm, respectful, and true. The BA shares; the person decides; the BA',
  '  moves on. That is the whole ethos.',
  '',
  'HARD COMPLIANCE RULES — NEVER violate these, even if asked:',
  '- NEVER state, imply, or hint at income, earnings, money, profit, or',
  '  financial outcomes of any kind.',
  '- NEVER mention the compensation plan, commissions, cycles, volume, ranks,',
  '  bonuses, “opportunity” in the business/earning sense, or team position.',
  '- NEVER promise or imply a queue position, placement, spot, or leg.',
  '- NEVER make a medical claim or guarantee a health/weight-loss result.',
  '  You may say the product is worth a look or that the person watched the',
  '  video and felt it was worth sharing — never “you will lose X” or any cure',
  '  or treatment claim.',
  '- NEVER use high-pressure, urgency, scarcity, or fear-of-missing-out tactics.',
  '- This is a PERSONAL share between people who know each other — never',
  '  spammy, never mass-market, never salesy.',
  '',
  'If you cannot write a compliant draft for any reason, return a neutral,',
  'simple message that mentions the product by name and invites the person to',
  'watch a short video — nothing more.',
  '',
  'Return ONLY the message text. No preamble, no quotes, no explanation, no',
  'subject line, no signature, no placeholder link.',
].join('\n');

/**
 * Build the per-prospect user turn. This is the ONLY part that varies per
 * call, so the cache hits on the system prefix above.
 */
function buildUserTurn(input: DraftInvitationInput): string {
  const lines = [
    `Product: ${input.productName}`,
    `Video the BA just watched: ${input.videoTitle}`,
    `Person to invite (first name): ${input.prospectFirstName}`,
  ];
  const ctx = (input.prospectContext ?? '').trim();
  if (ctx) {
    lines.push(
      `What the BA knows about them (use lightly, optional): ${ctx}`,
    );
  }
  lines.push(
    '',
    `Write the invitation message to ${input.prospectFirstName} now.`,
  );
  return lines.join('\n');
}

/**
 * Deterministic neutral fallback used when the LLM is unavailable (key not
 * yet wired) OR when a generation error occurs. Compliance-safe by
 * construction: product name + invitation to watch, nothing else.
 */
function neutralFallback(input: DraftInvitationInput): string {
  const name = input.prospectFirstName.trim() || 'there';
  return (
    `Hi ${name}, I came across ${input.productName} and thought of you. ` +
    `There\u2019s a short video that explains it better than I can — ` +
    `want to take a look and tell me what you think?`
  );
}

/**
 * Draft a product-anchored invitation message.
 *
 * Never throws on an LLM problem: on AnthropicConfigError (key unset) or
 * AnthropicError (transport/model), returns the neutral fallback with
 * degraded=true so the calling surface degrades gracefully rather than
 * failing the BA\u2019s flow. Only truly unexpected errors propagate.
 */
export async function draftInvitation(
  input: DraftInvitationInput,
): Promise<DraftInvitationResult> {
  try {
    const { text } = await complete({
      system: SYSTEM_PREFIX,
      messages: [{ role: 'user', content: buildUserTurn(input) }],
      maxTokens: 512,
    });
    return { draft: text, degraded: false };
  } catch (err) {
    if (err instanceof AnthropicConfigError || err instanceof AnthropicError) {
      // eslint-disable-next-line no-console
      console.warn(
        '[scriptmaker] LLM unavailable, using neutral fallback:',
        err.message,
      );
      return { draft: neutralFallback(input), degraded: true };
    }
    throw err;
  }
}
