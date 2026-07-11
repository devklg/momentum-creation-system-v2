import { PMV_EVENT_IDS } from './pmv-contract.js';

export const PMV_ANALYTICS_TAXONOMY_VERSION = 'p1-53.2026-07-11' as const;

export type PmvAnalyticsEventId = (typeof PMV_EVENT_IDS)[number];
export type PmvAnalyticsConcept = 'people' | 'momentum' | 'volume' | 'next_action';
export type PmvAnalyticsAggregation = 'count' | 'rate' | 'timestamp' | 'duration';
export type PmvAnalyticsAudience = 'ba' | 'admin' | 'internal';

export interface PmvAnalyticsMetric {
  id: string;
  label: string;
  description: string;
  aggregation: PmvAnalyticsAggregation;
}

export interface PmvAnalyticsEventDefinition {
  eventId: PmvAnalyticsEventId;
  concept: PmvAnalyticsConcept;
  audience: readonly PmvAnalyticsAudience[];
  trigger: string;
  sourceCollections: readonly string[];
  sourceFields: readonly string[];
  allowedMetrics: readonly PmvAnalyticsMetric[];
  forbiddenMetrics: readonly string[];
}

export const PMV_ANALYTICS_FORBIDDEN_PATTERNS = [
  '\\bincome\\b',
  '\\bearnings?\\b',
  '\\bcommissions?\\b',
  '\\bpaychecks?\\b',
  '\\bchecks?\\s+(?:earned|forecast|projected)\\b',
  '\\bmake money\\b',
  '\\bCV\\b',
  '\\bcycle(?:s| math)?\\b',
  '\\bbinary\\b',
  '\\brank\\b',
  '\\bbonus(?:es)?\\b',
  '\\bplacement\\b',
  '\\bspillover\\b',
  '\\bleg position\\b',
  '\\bguaranteed spot\\b',
] as const;

const manualActionForbidden = [
  'No automated send count.',
  'No AI qualification count.',
  'No conversion prediction.',
] as const;

export const PMV_ANALYTICS_EVENTS: readonly PmvAnalyticsEventDefinition[] = [
  {
    eventId: 'invitation_created',
    concept: 'people',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A BA mints an invitation token for a personally known prospect.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invite_tokens'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'source', 'createdAt'],
    allowedMetrics: [
      {
        id: 'pmv_people_invited_count',
        label: 'People invited',
        description: 'Count of BA-owned prospects with an invitation created.',
        aggregation: 'count',
      },
      {
        id: 'pmv_invitation_source_mix',
        label: 'Invitation source mix',
        description: 'Count of invitations by self, Ivory, or ScriptMaker source.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: manualActionForbidden,
  },
  {
    eventId: 'invitation_sent',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'The BA confirms they manually sent the invite link from their own phone.',
    sourceCollections: ['tmag_prospect_invitation_activity', 'tmag_prospects'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'kind', 'sentAt', 'at'],
    allowedMetrics: [
      {
        id: 'pmv_manual_send_count',
        label: 'Manual sends',
        description: 'Count of BA-confirmed invitation sends.',
        aggregation: 'count',
      },
      {
        id: 'pmv_time_to_manual_send',
        label: 'Time to manual send',
        description: 'Duration from invitation creation to BA send confirmation.',
        aggregation: 'duration',
      },
    ],
    forbiddenMetrics: manualActionForbidden,
  },
  {
    eventId: 'token_clicked',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect opens the invite link.',
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['token', 'prospectId', 'sponsorTmagId', 'clickedAt', 'state'],
    allowedMetrics: [
      {
        id: 'pmv_link_open_count',
        label: 'Link opens',
        description: 'Count of invite links opened by prospects.',
        aggregation: 'count',
      },
      {
        id: 'pmv_created_to_open_rate',
        label: 'Created-to-open rate',
        description: 'Share of created invitations that were opened.',
        aggregation: 'rate',
      },
    ],
    forbiddenMetrics: ['No intent score.', 'No readiness label.', 'No prospect rank.'],
  },
  {
    eventId: 'video_started',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect starts the presentation video.',
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['token', 'prospectId', 'sponsorTmagId', 'state', 'updatedAt'],
    allowedMetrics: [
      {
        id: 'pmv_video_start_count',
        label: 'Video starts',
        description: 'Count of prospects who started the presentation video.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No product claim.', 'No intent score.', 'No pressure label.'],
  },
  {
    eventId: 'video_quarter',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect reaches the first video milestone.',
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['token', 'prospectId', 'sponsorTmagId', 'state', 'updatedAt'],
    allowedMetrics: [
      {
        id: 'pmv_video_25_count',
        label: 'Video 25 percent',
        description: 'Count of prospects who reached the first video milestone.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No intent score.', 'No prospect rank.', 'No pressure label.'],
  },
  {
    eventId: 'video_half',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect reaches the halfway video milestone.',
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['token', 'prospectId', 'sponsorTmagId', 'state', 'updatedAt'],
    allowedMetrics: [
      {
        id: 'pmv_video_50_count',
        label: 'Video 50 percent',
        description: 'Count of prospects who reached the halfway video milestone.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No intent score.', 'No prospect rank.', 'No pressure label.'],
  },
  {
    eventId: 'video_three_quarter',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect reaches the third video milestone.',
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['token', 'prospectId', 'sponsorTmagId', 'state', 'updatedAt'],
    allowedMetrics: [
      {
        id: 'pmv_video_75_count',
        label: 'Video 75 percent',
        description: 'Count of prospects who reached the third video milestone.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No intent score.', 'No prospect rank.', 'No pressure label.'],
  },
  {
    eventId: 'video_complete',
    concept: 'volume',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect completes the presentation video and enters the shared pool display.',
    sourceCollections: [
      'tmag_prospect_invite_tokens',
      'tmag_prospect_invitation_activity',
      'tmag_prospect_htank_placements',
    ],
    sourceFields: ['token', 'prospectId', 'sponsorTmagId', 'state', 'at', 'placedAt'],
    allowedMetrics: [
      {
        id: 'pmv_presentation_complete_count',
        label: 'Presentations completed',
        description: 'Count of prospects who completed the presentation video.',
        aggregation: 'count',
      },
      {
        id: 'pmv_open_to_complete_rate',
        label: 'Open-to-complete rate',
        description: 'Share of opened invitations that reached video completion.',
        aggregation: 'rate',
      },
    ],
    forbiddenMetrics: [
      'No business-outcome claim.',
      'No organization-position promise.',
      'No compensation forecast.',
    ],
  },
  {
    eventId: 'callback_requested',
    concept: 'next_action',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect asks for a BA follow-up conversation.',
    sourceCollections: ['tmag_prospect_callback_requests', 'tmag_prospect_invitation_activity'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'intent', 'createdAt', 'at'],
    allowedMetrics: [
      {
        id: 'pmv_callback_request_count',
        label: 'Callback requests',
        description: 'Count of prospects who asked for follow-up.',
        aggregation: 'count',
      },
      {
        id: 'pmv_complete_to_callback_rate',
        label: 'Complete-to-callback rate',
        description: 'Share of video completions that resulted in a callback request.',
        aggregation: 'rate',
      },
    ],
    forbiddenMetrics: ['No close probability.', 'No qualification label.', 'No pressure score.'],
  },
  {
    eventId: 'webinar_reserved',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect reserves a webinar seat from the prospect surface.',
    sourceCollections: ['tmag_prospect_webinar_reservations'],
    sourceFields: ['prospectId', 'token', 'eventId', 'sponsorTmagId', 'createdAt'],
    allowedMetrics: [
      {
        id: 'pmv_webinar_reservation_count',
        label: 'Webinar reservations',
        description: 'Count of prospect webinar reservations.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No enrollment promise.', 'No qualification label.', 'No pressure score.'],
  },
  {
    eventId: 'follow_up_due',
    concept: 'next_action',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A BA-created CRM follow-up reminder reaches its due time.',
    sourceCollections: ['tmag_prospect_crm_followups'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'dueAt', 'clearedAt'],
    allowedMetrics: [
      {
        id: 'pmv_follow_up_due_count',
        label: 'Follow-ups due',
        description: 'Count of active BA reminders that are due.',
        aggregation: 'count',
      },
      {
        id: 'pmv_follow_up_age',
        label: 'Follow-up age',
        description: 'Duration between due time and current reporting time.',
        aggregation: 'duration',
      },
    ],
    forbiddenMetrics: ['No shame score.', 'No prospect quality rank.', 'No automated outreach.'],
  },
  {
    eventId: 'crm_note_added',
    concept: 'people',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A BA adds a CRM note for a prospect.',
    sourceCollections: ['tmag_prospect_crm_notes'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'createdAt'],
    allowedMetrics: [
      {
        id: 'pmv_crm_note_count',
        label: 'CRM notes',
        description: 'Count of BA-authored prospect notes.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No sentiment score.', 'No prospect rank.', 'No qualification label.'],
  },
  {
    eventId: 'crm_disposition_set',
    concept: 'people',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A BA updates the prospect CRM disposition.',
    sourceCollections: ['tmag_prospect_crm_dispositions'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'disposition', 'updatedAt'],
    allowedMetrics: [
      {
        id: 'pmv_disposition_mix',
        label: 'Disposition mix',
        description: 'Count of current BA-set CRM dispositions by category.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No prospect value score.', 'No qualification label.', 'No outcome promise.'],
  },
  {
    eventId: 'customer_marked',
    concept: 'people',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect is marked as a customer outcome.',
    sourceCollections: ['tmag_prospects'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'becameCustomer', 'becameCustomerAt'],
    allowedMetrics: [
      {
        id: 'pmv_customer_outcome_count',
        label: 'Customer outcomes',
        description: 'Count of prospects marked as customer outcomes.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No revenue estimate.', 'No compensation forecast.', 'No product claim.'],
  },
  {
    eventId: 'enrolled_marked',
    concept: 'people',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect is marked as enrolled after off-app human handoff.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invite_tokens'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'state', 'updatedAt'],
    allowedMetrics: [
      {
        id: 'pmv_enrollment_outcome_count',
        label: 'Enrollment outcomes',
        description: 'Count of prospects marked enrolled after off-app follow-up.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: [
      'No programmatic company handoff.',
      'No earnings forecast.',
      'No organization-position promise.',
    ],
  },
  {
    eventId: 'expired',
    concept: 'momentum',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect consideration window expires.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invite_tokens'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'expiresAt', 'state'],
    allowedMetrics: [
      {
        id: 'pmv_expired_count',
        label: 'Expired windows',
        description: 'Count of prospect consideration windows that expired.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No failure label.', 'No pressure score.', 'No prospect rank.'],
  },
  {
    eventId: 'archived',
    concept: 'people',
    audience: ['ba', 'admin', 'internal'],
    trigger: 'A prospect is archived or soft-deleted.',
    sourceCollections: ['tmag_prospects'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'deleted', 'deletedAt'],
    allowedMetrics: [
      {
        id: 'pmv_archived_count',
        label: 'Archived prospects',
        description: 'Count of BA-owned prospects archived from active PMV views.',
        aggregation: 'count',
      },
    ],
    forbiddenMetrics: ['No failure label.', 'No prospect quality rank.', 'No shame score.'],
  },
] as const;

export const PMV_ANALYTICS_TAXONOMY = {
  version: PMV_ANALYTICS_TAXONOMY_VERSION,
  purpose:
    'PMV analytics measure invitation, viewing, callback, webinar, CRM, and outcome movement without earnings, cycle math, or organization-position claims.',
  forbiddenPatterns: PMV_ANALYTICS_FORBIDDEN_PATTERNS,
  events: PMV_ANALYTICS_EVENTS,
} as const;
