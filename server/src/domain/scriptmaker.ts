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
import {
  readMasterContent,
  interpolateMasterContent,
} from '../services/masterContent.js';
import type {
  McsScriptMakerScriptKind,
  McsTenantTemplateKey,
} from '@momentum/shared';

export interface DraftInvitationInput {
  productName: string;
  videoTitle: string;
  prospectFirstName: string;
  prospectContext?: string | null;
  /**
   * Which master-content invitation seed to draft from. Defaults to
   * 'product_anchored' (the product-video front door). See SCRIPT_KIND_KEYS.
   */
  scriptKind?: McsScriptMakerScriptKind;
  /** Feeds the event_invite seed's {{eventDay}} token. */
  eventDay?: string | null;
  /** Feeds the event_invite seed's {{eventTime}} token. */
  eventTime?: string | null;
}

export interface DraftInvitationResult {
  draft: string;
  degraded: boolean;
}

/**
 * The ScriptMaker seed library (TASK-147, F.5). Each draft kind resolves its
 * base language through readMasterContent() from one of these master-content
 * templates — Kevin overrides them tenant-wide in the admin editor and the
 * change flows here with no code edit. readMasterContent() never throws: on a
 * PERSISTENCE/Mongo failure it returns the code default (the safe baseline shipped
 * in domain/adminTenantArchitecture.ts), so ScriptMaker degrades, never 500s.
 */
const SCRIPT_KIND_KEYS: Record<McsScriptMakerScriptKind, McsTenantTemplateKey> = {
  default_script: 'team.invitation.default_script',
  product_anchored: 'team.invitation.product_anchored',
  reconnect: 'team.invitation.reconnect',
  event_invite: 'team.invitation.event_invite',
};

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
 * Render-time compliance scan (TASK-147). The SYSTEM_PREFIX above is the
 * script-time gate that binds the LLM; this is its deterministic mirror,
 * applied to RESOLVED content — the interpolated master seed AND the model's
 * output — before anything is surfaced to the BA. A master override is
 * validated at save time, but only on the team surface (weakly) and BEFORE
 * token interpolation; this scan re-checks the fully resolved string so a
 * non-compliant override (or a non-compliant generation) is still caught and
 * dropped to a compliant fallback.
 *
 * It encodes the SAME NEVER rules as SYSTEM_PREFIX — income, comp/cycle/rank,
 * placement/queue, medical/weight-loss guarantee, high-pressure — and
 * deliberately does NOT include the .com "no THREE branding" rule: these are
 * BA-to-prospect personal texts that legitimately name the product (e.g.
 * "GLP-THREE"), so the .com chrome rule would false-positive on the product
 * name. Naming the product is allowed; income/placement/comp claims are not.
 */
const COMPLIANCE_PATTERNS: ReadonlyArray<{ id: string; pattern: RegExp }> = [
  {
    id: 'income',
    pattern:
      /\b(income|earnings?|profit|paychecks?|salary|six[-\s]?figure|seven[-\s]?figure|make money|making money|make \$|\$\s?\d|\d+\s?(?:dollars|usd))\b/i,
  },
  {
    id: 'comp_plan',
    pattern:
      /\b(compensation plan|comp[-\s]?plan|commissions?|cycles?|commissionable volume|cv|binary|ranks?|bonus(?:es)?|downline|residual income)\b/i,
  },
  {
    id: 'placement',
    pattern:
      /\b(placement|spillover|queue position|leg position|guaranteed (?:spot|position|placement)|locked[-\s]?spot)\b/i,
  },
  {
    id: 'medical',
    pattern:
      /\b(cure[sd]?|guaranteed? to (?:lose|cure|heal)|you will lose|lose \d+\s?(?:lbs?|pounds))\b/i,
  },
  {
    id: 'pressure',
    pattern:
      /\b(act now|limited time|hurry|last chance|don'?t miss out|only \d+ (?:spots?|seats?) left)\b/i,
  },
];

/** True when `text` trips none of the ScriptMaker NEVER rules. */
function scanDraftCompliance(text: string): { ok: boolean; violations: string[] } {
  const violations: string[] = [];
  for (const { id, pattern } of COMPLIANCE_PATTERNS) {
    if (pattern.test(text)) violations.push(id);
  }
  return { ok: violations.length === 0, violations };
}

/**
 * The token set ScriptMaker injects server-side — the SAME values it has
 * always personalized with, plus the event_invite scheduling tokens. Unknown
 * or empty tokens are left intact by interpolateMasterContent() (it never
 * blanks copy), so a seed that does not use a token is unaffected.
 */
function buildTokenValues(
  input: DraftInvitationInput,
): Record<string, string | null | undefined> {
  return {
    prospectFirstName: input.prospectFirstName,
    productName: input.productName,
    videoTitle: input.videoTitle,
    eventDay: input.eventDay,
    eventTime: input.eventTime,
  };
}

/**
 * Resolve the master-content seed for this draft kind through the inheritance
 * chain and interpolate the per-recipient tokens. Returns the resolved string
 * plus whether it passes the compliance scan, so callers can decide whether to
 * trust it as a deterministic fallback.
 */
async function resolveSeed(
  input: DraftInvitationInput,
): Promise<{ content: string; compliant: boolean }> {
  const key = SCRIPT_KIND_KEYS[input.scriptKind ?? 'product_anchored'];
  const raw = await readMasterContent(key); // never throws — code-default fallback
  const content = interpolateMasterContent(raw, buildTokenValues(input)).trim();
  const scan = scanDraftCompliance(content);
  return { content, compliant: scan.ok && content.length > 0 };
}

/**
 * Build the per-prospect user turn. This is the ONLY part that varies per
 * call, so the cache hits on the system prefix above. The resolved master
 * seed (when compliant) is handed to the model as approved base language to
 * personalize, so a tenant override actually changes the generated draft.
 */
function buildUserTurn(input: DraftInvitationInput, seed: string): string {
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
  const seedTrim = seed.trim();
  if (seedTrim) {
    lines.push(
      '',
      'Approved seed language to base the message on — personalize it in the ' +
        'BA’s own voice, keep it compliant, and do not add a link: ' +
        seedTrim,
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
 * Draft an invitation message anchored to the selected master-content seed.
 *
 * Flow (TASK-147 inherit-scriptmaker):
 *   1. Resolve the seed for input.scriptKind through readMasterContent() and
 *      interpolate the per-recipient tokens. The deterministic fallback text
 *      is the resolved seed when it is compliant, else the hardcoded neutral
 *      message (compliant by construction).
 *   2. Ask the LLM, handing it the resolved seed as approved base language.
 *   3. Scan the model's RESOLVED output. If it trips a NEVER rule, drop to the
 *      deterministic fallback rather than surfacing non-compliant copy.
 *
 * Never throws on an LLM problem: on AnthropicConfigError (key unset) or
 * AnthropicError (transport/model), returns the deterministic fallback with
 * degraded=true so the calling surface degrades gracefully rather than
 * failing the BA\u2019s flow. Only truly unexpected errors propagate.
 */
export async function draftInvitation(
  input: DraftInvitationInput,
): Promise<DraftInvitationResult> {
  const seed = await resolveSeed(input);
  const fallbackText = seed.compliant ? seed.content : neutralFallback(input);

  try {
    const { text } = await complete({
      system: SYSTEM_PREFIX,
      messages: [{ role: 'user', content: buildUserTurn(input, seed.content) }],
      maxTokens: 512,
    });
    const draft = text.trim();
    const scan = scanDraftCompliance(draft);
    if (!scan.ok || !draft) {
      // eslint-disable-next-line no-console
      console.warn(
        '[scriptmaker] LLM draft failed compliance scan, using seed fallback:',
        scan.violations.join(', ') || 'empty_draft',
      );
      return { draft: fallbackText, degraded: true };
    }
    return { draft, degraded: false };
  } catch (err) {
    if (err instanceof AnthropicConfigError || err instanceof AnthropicError) {
      // eslint-disable-next-line no-console
      console.warn(
        '[scriptmaker] LLM unavailable, using master-seed fallback:',
        err.message,
      );
      return { draft: fallbackText, degraded: true };
    }
    throw err;
  }
}
