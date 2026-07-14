import type {
  McsProspectLifecycleStage,
  McsProspectNextAction,
  McsProspectNextActionKind,
  McsProspectNextActionScriptKind,
} from '@momentum/shared';

export const COCKPIT_NEXT_ACTION_POLICY_VERSION = 'p2-127.2026-07-13' as const;

export type CockpitNextActionRuleId =
  | 'terminal_none'
  | 'callback_reply'
  | 'ba_follow_up_due'
  | 'watched_call'
  | 'draft_send'
  | 'expired_reinvite'
  | 'clicked_check_in'
  | 'partial_video_nudge'
  | 'sent_unopened_nudge'
  | 'sent_unopened_wait'
  | 'fallback_none';

export interface CockpitNextActionRule {
  id: CockpitNextActionRuleId;
  kind: McsProspectNextActionKind;
  label: string;
  priority: McsProspectNextAction['priority'];
  scriptKind: McsProspectNextActionScriptKind | null;
  trigger: string;
  manualOnly: true;
}

/**
 * Ordered source of truth for the current cockpit suggestion policy.
 * Earlier rules win. The policy prioritizes BA work, never people, and every
 * suggested contact remains a manual BA action.
 */
export const COCKPIT_NEXT_ACTION_RULES: readonly CockpitNextActionRule[] = [
  {
    id: 'terminal_none',
    kind: 'none',
    label: 'No PMV action',
    priority: 0,
    scriptKind: null,
    trigger: 'The prospect is enrolled, a customer, or archived.',
    manualOnly: true,
  },
  {
    id: 'callback_reply',
    kind: 'reply_to_callback',
    label: 'Reply to callback',
    priority: 5,
    scriptKind: 'callback_reply',
    trigger: 'The prospect explicitly requested a callback.',
    manualOnly: true,
  },
  {
    id: 'ba_follow_up_due',
    kind: 'follow_up_due',
    label: 'Follow-up due',
    priority: 4,
    scriptKind: 'later_reconnect',
    trigger: 'A BA-created follow-up reminder is due.',
    manualOnly: true,
  },
  {
    id: 'watched_call',
    kind: 'call_now',
    label: 'Call now',
    priority: 4,
    scriptKind: 'watched_no_callback',
    trigger: 'The prospect completed the presentation without requesting a callback.',
    manualOnly: true,
  },
  {
    id: 'draft_send',
    kind: 'send_invite',
    label: 'Manually send invite',
    priority: 3,
    scriptKind: 'initial_send',
    trigger: 'The invitation is minted but is not marked sent.',
    manualOnly: true,
  },
  {
    id: 'expired_reinvite',
    kind: 'reinvite',
    label: 'Consider re-invite',
    priority: 2,
    scriptKind: 'reinvite',
    trigger: 'The prospect consideration window expired.',
    manualOnly: true,
  },
  {
    id: 'clicked_check_in',
    kind: 'ask_if_video_played',
    label: 'Ask if video played',
    priority: 2,
    scriptKind: 'clicked_no_watch',
    trigger: 'The invite link was opened but the presentation did not start.',
    manualOnly: true,
  },
  {
    id: 'partial_video_nudge',
    kind: 'send_soft_nudge',
    label: 'Send soft nudge',
    priority: 2,
    scriptKind: 'partial_watch',
    trigger: 'The presentation started but is not complete.',
    manualOnly: true,
  },
  {
    id: 'sent_unopened_nudge',
    kind: 'send_soft_nudge',
    label: 'Send soft nudge',
    priority: 2,
    scriptKind: 'later_reconnect',
    trigger: 'A sent invitation remains unopened for at least 48 hours.',
    manualOnly: true,
  },
  {
    id: 'sent_unopened_wait',
    kind: 'wait',
    label: 'Wait',
    priority: 0,
    scriptKind: null,
    trigger: 'A sent invitation has been unopened for less than 48 hours.',
    manualOnly: true,
  },
  {
    id: 'fallback_none',
    kind: 'none',
    label: 'No PMV action',
    priority: 0,
    scriptKind: null,
    trigger: 'No current policy rule suggests a manual action.',
    manualOnly: true,
  },
] as const;

const RULE_BY_ID = new Map(
  COCKPIT_NEXT_ACTION_RULES.map((rule) => [rule.id, rule] as const),
);

const PARTIAL_VIDEO_LIFECYCLES = new Set<McsProspectLifecycleStage>([
  'video_started',
  'video_25',
  'video_50',
  'video_75',
]);

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export interface CockpitNextActionInput {
  lifecycle: McsProspectLifecycleStage;
  firstName: string;
  sentAt: string | null;
  expiresAt: string;
  followUpDueAt: string | null;
  followUpIsDue: boolean;
  lastSignalAt: string;
  nowMs: number;
}

function action(
  ruleId: CockpitNextActionRuleId,
  reason: string,
  dueAt: string | null,
): McsProspectNextAction {
  const rule = RULE_BY_ID.get(ruleId);
  if (!rule) throw new Error(`Unknown cockpit next-action rule: ${ruleId}`);
  return {
    kind: rule.kind,
    label: rule.label,
    reason,
    priority: rule.priority,
    dueAt,
    scriptKind: rule.scriptKind,
  };
}

function addMs(iso: string | null, ms: number): string | null {
  if (!iso) return null;
  const base = new Date(iso).getTime();
  return Number.isFinite(base) ? new Date(base + ms).toISOString() : null;
}

export function projectCockpitNextAction(
  input: CockpitNextActionInput,
): McsProspectNextAction {
  const {
    lifecycle,
    firstName,
    sentAt,
    expiresAt,
    followUpDueAt,
    followUpIsDue,
    lastSignalAt,
    nowMs,
  } = input;

  if (lifecycle === 'archived' || lifecycle === 'enrolled' || lifecycle === 'customer') {
    return action(
      'terminal_none',
      `${firstName} is in a terminal or archived state.`,
      null,
    );
  }

  if (lifecycle === 'callback_requested') {
    return action(
      'callback_reply',
      `${firstName} raised a hand and asked for follow-up.`,
      lastSignalAt,
    );
  }

  if (followUpIsDue && followUpDueAt) {
    return action(
      'ba_follow_up_due',
      `A BA-set reminder for ${firstName} is due.`,
      followUpDueAt,
    );
  }

  if (lifecycle === 'watched') {
    return action(
      'watched_call',
      `${firstName} watched the video and has not raised a callback request yet.`,
      lastSignalAt,
    );
  }

  if (lifecycle === 'draft') {
    return action(
      'draft_send',
      `${firstName}'s invitation is minted but not marked sent.`,
      null,
    );
  }

  if (lifecycle === 'expired') {
    return action(
      'expired_reinvite',
      `${firstName}'s consideration window has expired.`,
      expiresAt,
    );
  }

  if (lifecycle === 'clicked') {
    return action(
      'clicked_check_in',
      `${firstName} opened the link but has not started the video.`,
      lastSignalAt,
    );
  }

  if (PARTIAL_VIDEO_LIFECYCLES.has(lifecycle)) {
    return action(
      'partial_video_nudge',
      `${firstName} started the video and has not completed it yet.`,
      lastSignalAt,
    );
  }

  if (lifecycle === 'sent_unopened') {
    const nudgeDueAt = addMs(sentAt, TWO_DAYS_MS);
    if (nudgeDueAt && new Date(nudgeDueAt).getTime() <= nowMs) {
      return action(
        'sent_unopened_nudge',
        `${firstName}'s invitation was sent but has not been opened.`,
        nudgeDueAt,
      );
    }
    return action(
      'sent_unopened_wait',
      `${firstName}'s invitation was sent recently.`,
      nudgeDueAt,
    );
  }

  return action(
    'fallback_none',
    `${firstName} has no current PMV action.`,
    null,
  );
}
