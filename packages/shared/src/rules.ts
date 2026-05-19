/**
 * Standing rules locked across all chats. Read in code when behavior depends on them.
 */

export const STANDING_RULE_THREE_AUTHORITATIVE =
  'THREE International is the single source of truth and the final authority on ' +
  'sponsorship, enrollment, placement, and compensation. Every record in this system ' +
  'mirrors THREE\u2019s records for operational visibility. If at any point our records ' +
  'differ from THREE\u2019s, we update ours to match.';

export const STANDING_RULE_SPONSOR_IMMUTABLE =
  'The sponsor BA is captured at the moment the invite token is minted (for prospects) ' +
  'or at the moment the access code is used (for BAs) and is never recomputed. ' +
  'Any route accepting sponsorBaId as input must reject it and use the token-derived ' +
  'or code-derived value instead.';

export const STANDING_RULE_NO_PROGRAMMATIC_THREE_HANDOFF =
  'When a prospect decides to enroll, the BA walks them into THREE through THREE\u2019s own ' +
  'tools, off-app, BA-to-BA. The system has no programmatic registration handoff to THREE. ' +
  'No registration routes. No registration handoff state machine.';

export const STANDING_RULE_POOL_MONOTONIC =
  'The visible team line is monotonic — position numbers do not reshuffle. Position is ' +
  'timestamp-anchored to the prospect\u2019s entry into the team\u2019s growth. When a position ' +
  'flushes, the numerical position is vacated, but the numbers of remaining prospects do not ' +
  'reshuffle. If #347 flushes, #348 stays #348.';

export const STANDING_RULE_FLUSH_WINDOW_DAYS = 56;
