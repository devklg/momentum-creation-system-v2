/**
 * Deterministic compliance guard for generated prospect/BA copy.
 *
 * This is the post-generation mirror of the prompt-time HARD RULES used by
 * ScriptMaker and Ivory. Prompts can instruct a model; this scanner is the
 * fail-closed check before generated copy is returned to a BA.
 */

export type GeneratedCopyComplianceRuleId =
  | 'income'
  | 'comp_plan'
  | 'placement'
  | 'ai_qualification'
  | 'three_handoff'
  | 'medical'
  | 'pressure'
  | 'automation';

export interface GeneratedCopyComplianceViolation {
  id: GeneratedCopyComplianceRuleId;
  pattern: string;
}

export interface GeneratedCopyComplianceResult {
  ok: boolean;
  violations: GeneratedCopyComplianceViolation[];
}

const GENERATED_COPY_COMPLIANCE_RULES: ReadonlyArray<{
  id: GeneratedCopyComplianceRuleId;
  pattern: RegExp;
}> = [
  {
    id: 'income',
    pattern:
      /\b(income|earnings?|profit|paychecks?|salary|six[-\s]?figure|seven[-\s]?figure|make money|making money|make \$|\$\s?\d|\d+\s?(?:dollars|usd)|financial freedom)\b/i,
  },
  {
    id: 'comp_plan',
    pattern:
      /\b(compensation plan|comp[-\s]?plan|commissions?|cycles?|commissionable volume|\bcv\b|binary|ranks?|bonus(?:es)?|downline|residual income)\b/i,
  },
  {
    id: 'placement',
    pattern:
      /\b(placement|spillover|queue position|leg position|guaranteed (?:spot|position|placement)|locked[-\s]?spot|save (?:your|a) spot)\b/i,
  },
  {
    id: 'ai_qualification',
    pattern:
      /\b(ai[-\s]?(?:qualified|qualification|scored|scoring)|qualified prospect|lead score|prospect score|score[sd]? (?:them|you|the prospect)|rank(?:ed)? (?:them|you|the prospect)|rate(?:d)? (?:them|you|the prospect)|classif(?:y|ied) (?:them|you|the prospect))\b/i,
  },
  {
    id: 'three_handoff',
    pattern:
      /\b(three international|(?:system|app|platform|we)\s+(?:will\s+)?(?:enroll|register|sign(?:s|ed)?\s+up)\s+(?:you|them)\s+(?:with|in|into)\s+three|auto[-\s]?(?:enroll|register)|programmatic (?:enrollment|registration|handoff))\b/i,
  },
  {
    id: 'medical',
    pattern:
      /\b(cure[sd]?|treat(?:s|ed|ment)?|guaranteed? to (?:lose|cure|heal)|you will lose|lose \d+\s?(?:lbs?|pounds)|drop \d+\s?(?:lbs?|pounds)|diagnos(?:e|is)|prescription replacement)\b/i,
  },
  {
    id: 'pressure',
    pattern:
      /\b(act now|limited time|hurry|last chance|don'?t miss out|only \d+ (?:spots?|seats?) left|before it'?s too late|you'?ll regret)\b/i,
  },
  {
    id: 'automation',
    pattern:
      /\b(the system will (?:send|call|text|follow up)|the app will (?:send|call|text|follow up)|we'?ll (?:auto|automatically) (?:send|call|text|follow up)|automated (?:prospecting|calling|follow[-\s]?up))\b/i,
  },
];

/**
 * Scan one string or a group of generated strings. The scanner deliberately
 * allows product names like GLP-THREE; it blocks company branding /
 * programmatic handoff language via the narrower `three_handoff` rule.
 */
export function scanGeneratedCopyCompliance(
  text: string | readonly string[],
): GeneratedCopyComplianceResult {
  const combined = (Array.isArray(text) ? text : [text]).join('\n');
  const violations: GeneratedCopyComplianceViolation[] = [];

  for (const rule of GENERATED_COPY_COMPLIANCE_RULES) {
    if (rule.pattern.test(combined)) {
      violations.push({ id: rule.id, pattern: rule.pattern.source });
    }
  }

  return { ok: violations.length === 0, violations };
}

export function generatedCopyViolationIds(
  result: GeneratedCopyComplianceResult,
): string {
  return result.violations.map((v) => v.id).join(', ');
}
