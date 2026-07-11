/**
 * Prospect Momentum Viewer contract (P1-52).
 *
 * PMV is awareness without surveillance. These constants map the PMV concepts
 * to allowed language, forbidden language, fields, and events so future PMV
 * analytics/admin work has one compliance-safe vocabulary.
 */

export const PMV_CONTRACT_VERSION = 'p1-52.2026-07-11' as const;

export const PMV_LIFECYCLE_STAGES = [
  'draft',
  'sent_unopened',
  'clicked',
  'video_started',
  'video_25',
  'video_50',
  'video_75',
  'watched',
  'callback_requested',
  'customer',
  'enrolled',
  'expired',
  'archived',
] as const;

export const PMV_NEXT_ACTION_KINDS = [
  'send_invite',
  'call_now',
  'reply_to_callback',
  'follow_up_due',
  'send_soft_nudge',
  'ask_if_video_played',
  'reinvite',
  'schedule_followup',
  'wait',
  'none',
] as const;

export const PMV_NEXT_ACTION_SCRIPT_KINDS = [
  'initial_send',
  'callback_reply',
  'clicked_no_watch',
  'partial_watch',
  'watched_no_callback',
  'reinvite',
  'later_reconnect',
] as const;

export const PMV_LAST_SIGNAL_KINDS = [
  'created',
  'sent',
  'opened',
  'video_started',
  'video_25',
  'video_50',
  'video_75',
  'watched',
  'callback_requested',
  'customer',
  'enrolled',
  'expired',
  'archived',
] as const;

export const PMV_ROW_FIELDS = [
  'prospectId',
  'token',
  'firstName',
  'lastInitial',
  'city',
  'stateOrRegion',
  'source',
  'relationshipReason',
  'lifecycle',
  'tokenState',
  'videoProgressPct',
  'clickedAt',
  'sentAt',
  'createdAt',
  'expiresAt',
  'positionNumber',
  'placedAt',
  'latestCallbackIntent',
  'crm',
  'lastSignal',
  'nextAction',
] as const;

export const PMV_EVENT_IDS = [
  'invitation_created',
  'invitation_sent',
  'token_clicked',
  'video_started',
  'video_quarter',
  'video_half',
  'video_three_quarter',
  'video_complete',
  'callback_requested',
  'webinar_reserved',
  'follow_up_due',
  'crm_note_added',
  'crm_disposition_set',
  'customer_marked',
  'enrolled_marked',
  'expired',
  'archived',
] as const;

export type PmvConceptAudience = 'prospect' | 'ba' | 'admin' | 'internal';

export interface PmvConceptContract {
  id: string;
  name: string;
  audience: readonly PmvConceptAudience[];
  allowedLanguage: readonly string[];
  forbiddenLanguage: readonly string[];
  fields: readonly string[];
  events: readonly string[];
}

export const PMV_FORBIDDEN_LANGUAGE_CATEGORIES = [
  {
    id: 'income_or_checks_claims',
    phrases: ['income', 'earnings', 'commissions', 'paycheck', 'checks', 'make money'],
    rule: 'Never use PMV to imply earnings, checks, commissions, or financial outcomes.',
  },
  {
    id: 'comp_plan_or_cycle_math',
    phrases: ['CV', 'cycle', 'binary', 'rank', 'volume math', 'bonus'],
    rule: 'Never turn PMV into compensation-plan, cycle, rank, or CV math.',
  },
  {
    id: 'placement_or_spillover_promises',
    phrases: ['placement', 'spillover', 'leg position', 'guaranteed spot'],
    rule: 'Never imply PMV position creates binary placement, spillover, or a guaranteed spot.',
  },
  {
    id: 'scoring_or_qualification',
    phrases: ['score', 'rank', 'qualified lead', 'hot prospect', 'likely to enroll'],
    rule: 'Never score, rank, qualify, or predict a person from PMV signals.',
  },
  {
    id: 'surveillance_or_pressure',
    phrases: ['tracking you', 'watching you', 'act now', 'last chance', 'only spots left'],
    rule: 'Never describe PMV as surveillance or use PMV signals to create pressure.',
  },
  {
    id: 'current_team_headcount_or_company_handoff',
    phrases: ['current team count', 'THREE International enrollment', 'auto-enroll'],
    rule: 'Never expose current team headcount or programmatic THREE enrollment/handoff language.',
  },
] as const;

export const PMV_CONCEPTS: readonly PmvConceptContract[] = [
  {
    id: 'people',
    name: 'People',
    audience: ['ba', 'admin', 'internal'],
    allowedLanguage: [
      'prospects invited',
      'people you are following up with',
      'relationship context',
      'invited by you',
    ],
    forbiddenLanguage: [
      'leads',
      'hot prospects',
      'qualified prospects',
      'ranked people',
      'low-value contacts',
    ],
    fields: [
      'prospectId',
      'firstName',
      'lastInitial',
      'city',
      'stateOrRegion',
      'source',
      'relationshipReason',
      'crm.disposition',
    ],
    events: ['invitation_created', 'crm_note_added', 'crm_disposition_set'],
  },
  {
    id: 'momentum',
    name: 'Momentum',
    audience: ['prospect', 'ba', 'admin', 'internal'],
    allowedLanguage: [
      'opened the link',
      'started the video',
      'watched the video',
      'asked for a callback',
      'follow-up due',
      'consideration window',
    ],
    forbiddenLanguage: [
      'ready to buy',
      'guaranteed to enroll',
      'qualified by engagement',
      'high-intent score',
      'pressure them now',
    ],
    fields: [
      'lifecycle',
      'tokenState',
      'videoProgressPct',
      'clickedAt',
      'sentAt',
      'lastSignal',
      'nextAction',
      'latestCallbackIntent',
      'crm.followUpDueAt',
      'crm.followUpIsDue',
    ],
    events: [
      'invitation_sent',
      'token_clicked',
      'video_started',
      'video_quarter',
      'video_half',
      'video_three_quarter',
      'video_complete',
      'callback_requested',
      'follow_up_due',
    ],
  },
  {
    id: 'volume',
    name: 'Volume',
    audience: ['ba', 'admin', 'internal'],
    allowedLanguage: [
      'invitations sent',
      'presentations watched',
      'callbacks requested',
      'webinar reservations',
      'team activity',
    ],
    forbiddenLanguage: [
      'commissionable volume',
      'CV',
      'cycle volume',
      'binary volume',
      'pay-leg volume',
    ],
    fields: [
      'source',
      'createdAt',
      'expiresAt',
      'positionNumber',
      'placedAt',
      'lifecycle',
    ],
    events: [
      'invitation_created',
      'invitation_sent',
      'video_complete',
      'callback_requested',
      'webinar_reserved',
    ],
  },
  {
    id: 'checks',
    name: 'Checks',
    audience: ['admin', 'internal'],
    allowedLanguage: [
      'internal PMV+C planning label',
      'never prospect-facing',
      'no earnings projection',
      'no compensation claim',
    ],
    forbiddenLanguage: [
      'checks earned',
      'paycheck forecast',
      'income projection',
      'commission estimate',
      'cycle payout',
    ],
    fields: [],
    events: [],
  },
  {
    id: 'next_action',
    name: 'Next Action',
    audience: ['ba', 'admin', 'internal'],
    allowedLanguage: [
      'manual next step',
      'call now',
      'reply to callback',
      'send soft nudge',
      'wait',
      'consider re-invite',
    ],
    forbiddenLanguage: [
      'automatic send',
      'AI will follow up',
      'close them',
      'pressure play',
      'conversion score',
    ],
    fields: [
      'nextAction.kind',
      'nextAction.label',
      'nextAction.reason',
      'nextAction.priority',
      'nextAction.dueAt',
      'nextAction.scriptKind',
    ],
    events: [
      'invitation_sent',
      'token_clicked',
      'video_complete',
      'callback_requested',
      'follow_up_due',
      'expired',
    ],
  },
] as const;

export const PMV_CONTRACT = {
  version: PMV_CONTRACT_VERSION,
  purpose:
    'PMV is awareness without surveillance: it helps a BA follow up with respectful timing and never scores, ranks, qualifies, or pressures a person.',
  route: '/api/cockpit/pmv',
  lifecycleStages: PMV_LIFECYCLE_STAGES,
  nextActionKinds: PMV_NEXT_ACTION_KINDS,
  nextActionScriptKinds: PMV_NEXT_ACTION_SCRIPT_KINDS,
  lastSignalKinds: PMV_LAST_SIGNAL_KINDS,
  rowFields: PMV_ROW_FIELDS,
  eventIds: PMV_EVENT_IDS,
  forbiddenLanguageCategories: PMV_FORBIDDEN_LANGUAGE_CATEGORIES,
  concepts: PMV_CONCEPTS,
} as const;
