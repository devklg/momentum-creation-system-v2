import { PMV_LIFECYCLE_STAGES } from './pmv-contract.js';
import { MCS_VM_LEAD_LIFECYCLE_STATUSES } from './types.js';
import type {
  McsProspectCrmClosedReason,
  McsProspectCrmStatus,
  McsProspectLifecycleStage,
  McsProspectTimelineEventKind,
  McsTokenState,
  McsVmLeadLifecycleStatus,
  McsCrmDisposition,
} from './types.js';

export const CRM_LIFECYCLE_MODEL_VERSION = 'p1-54.2026-07-11' as const;

export const CRM_TOKEN_STATES: readonly McsTokenState[] = [
  'minted',
  'clicked',
  'video_started',
  'video_quarter',
  'video_half',
  'video_three_quarter',
  'video_complete',
  'enrolled',
  'expired',
] as const;

export const CRM_PROSPECT_LIFECYCLE_STAGES: readonly McsProspectLifecycleStage[] =
  PMV_LIFECYCLE_STAGES;

export const CRM_RECORD_STATUSES: readonly McsProspectCrmStatus[] = [
  'inactive_pre_engagement',
  'active',
  'needs_follow_up',
  'watching',
  'presentation_completed',
  'holding_tank',
  'closed',
] as const;

export const CRM_DISPOSITIONS: readonly McsCrmDisposition[] = [
  'new_brand_ambassador',
  'new_customer',
  'interested',
  'not_interested',
  'later',
  'no_response',
  'wrong_number',
  'do_not_contact',
] as const;

export const CRM_CLOSED_REASONS: readonly McsProspectCrmClosedReason[] = [
  'enrolled_as_brand_ambassador',
  'became_customer',
  'not_interested',
  'do_not_contact',
  'expired',
  'duplicate',
  'invalid_contact',
  'admin_closed',
] as const;

export const CRM_TIMELINE_EVENT_KINDS: readonly McsProspectTimelineEventKind[] = [
  'crm_created',
  'token_created',
  'voicemail_sent',
  'sms_sent',
  'email_sent',
  'link_clicked',
  'activated',
  'info_requested',
  'callback_requested',
  'presentation_started',
  'presentation_25',
  'presentation_50',
  'presentation_75',
  'presentation_completed',
  'dashboard_entered',
  'holding_tank',
  'note_added',
  'follow_up_set',
  'follow_up_cleared',
  'disposition_changed',
  'closed_new_brand_ambassador',
  'closed_new_customer',
  'closed_not_interested',
  'closed_later',
  'expired',
  'archived',
  'ownership_corrected',
] as const;

export const CRM_VM_LEAD_STATUSES: readonly McsVmLeadLifecycleStatus[] =
  MCS_VM_LEAD_LIFECYCLE_STATUSES;

export const CRM_FOLLOW_UP_STATES = ['none', 'scheduled', 'due', 'cleared'] as const;

export type CrmFollowUpState = (typeof CRM_FOLLOW_UP_STATES)[number];
export type CrmCanonicalLifecyclePhase =
  | 'pre_engagement'
  | 'delivery'
  | 'engagement'
  | 'presentation'
  | 'manual_follow_up'
  | 'outcome'
  | 'terminal';

export interface CrmCanonicalLifecycleState {
  id: string;
  label: string;
  phase: CrmCanonicalLifecyclePhase;
  description: string;
  sourceCollections: readonly string[];
  sourceFields: readonly string[];
  tokenStates: readonly McsTokenState[];
  pmvStages: readonly McsProspectLifecycleStage[];
  crmStatuses: readonly McsProspectCrmStatus[];
  timelineEvents: readonly McsProspectTimelineEventKind[];
  followUpStates: readonly CrmFollowUpState[];
  terminal: boolean;
  manualOnly: boolean;
}

export const CRM_CANONICAL_LIFECYCLE_STATES: readonly CrmCanonicalLifecycleState[] = [
  {
    id: 'draft',
    label: 'Draft invite',
    phase: 'pre_engagement',
    description: 'A prospect record and token exist, but the BA has not confirmed sending it.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invite_tokens'],
    sourceFields: ['prospectId', 'token', 'state', 'sentAt', 'createdAt'],
    tokenStates: ['minted'],
    pmvStages: ['draft'],
    crmStatuses: ['inactive_pre_engagement'],
    timelineEvents: ['crm_created', 'token_created'],
    followUpStates: ['none'],
    terminal: false,
    manualOnly: true,
  },
  {
    id: 'sent_unopened',
    label: 'Sent, unopened',
    phase: 'delivery',
    description: 'The BA confirmed the invitation was sent and no prospect click is recorded.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invitation_activity'],
    sourceFields: ['prospectId', 'sentAt', 'activity.kind', 'activity.at'],
    tokenStates: ['minted'],
    pmvStages: ['sent_unopened'],
    crmStatuses: ['inactive_pre_engagement'],
    timelineEvents: ['voicemail_sent', 'sms_sent', 'email_sent'],
    followUpStates: ['none', 'scheduled', 'due'],
    terminal: false,
    manualOnly: true,
  },
  {
    id: 'opened',
    label: 'Opened',
    phase: 'engagement',
    description: 'The prospect opened the invitation link or otherwise activated the CRM record.',
    sourceCollections: ['tmag_prospect_invite_tokens', 'tmag_prospect_timeline_events'],
    sourceFields: ['token', 'clickedAt', 'state', 'timeline.kind', 'timeline.occurredAt'],
    tokenStates: ['clicked'],
    pmvStages: ['clicked'],
    crmStatuses: ['active'],
    timelineEvents: ['link_clicked', 'activated', 'info_requested'],
    followUpStates: ['none', 'scheduled', 'due'],
    terminal: false,
    manualOnly: false,
  },
  {
    id: 'watching',
    label: 'Watching',
    phase: 'presentation',
    description: 'The prospect started the presentation and has not completed it yet.',
    sourceCollections: ['tmag_prospect_invite_tokens', 'tmag_prospect_timeline_events'],
    sourceFields: ['token', 'state', 'updatedAt', 'timeline.kind', 'timeline.occurredAt'],
    tokenStates: ['video_started', 'video_quarter', 'video_half', 'video_three_quarter'],
    pmvStages: ['video_started', 'video_25', 'video_50', 'video_75'],
    crmStatuses: ['watching'],
    timelineEvents: [
      'presentation_started',
      'presentation_25',
      'presentation_50',
      'presentation_75',
    ],
    followUpStates: ['none', 'scheduled', 'due'],
    terminal: false,
    manualOnly: false,
  },
  {
    id: 'watched',
    label: 'Presentation watched',
    phase: 'presentation',
    description: 'The prospect completed the presentation; pool visibility may exist, but no placement promise is implied.',
    sourceCollections: [
      'tmag_prospect_invite_tokens',
      'tmag_prospect_timeline_events',
      'tmag_prospect_htank_placements',
    ],
    sourceFields: ['token', 'state', 'placedAt', 'positionNumber', 'timeline.kind'],
    tokenStates: ['video_complete'],
    pmvStages: ['watched'],
    crmStatuses: ['presentation_completed', 'holding_tank'],
    timelineEvents: ['presentation_completed', 'dashboard_entered', 'holding_tank'],
    followUpStates: ['none', 'scheduled', 'due'],
    terminal: false,
    manualOnly: false,
  },
  {
    id: 'callback_requested',
    label: 'Callback requested',
    phase: 'manual_follow_up',
    description: 'The prospect asked for a BA follow-up conversation; it is an intent signal, not a token state.',
    sourceCollections: ['tmag_prospect_callback_requests', 'tmag_prospect_timeline_events'],
    sourceFields: ['callbackRequestId', 'intent', 'createdAt', 'timeline.kind'],
    tokenStates: [],
    pmvStages: ['callback_requested'],
    crmStatuses: ['needs_follow_up'],
    timelineEvents: ['callback_requested', 'info_requested'],
    followUpStates: ['none', 'scheduled', 'due'],
    terminal: false,
    manualOnly: true,
  },
  {
    id: 'follow_up_scheduled',
    label: 'Follow-up scheduled',
    phase: 'manual_follow_up',
    description: 'The BA set a manual follow-up reminder that is not due yet.',
    sourceCollections: ['tmag_prospect_crm_followups', 'tmag_prospect_timeline_events'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'dueAt', 'clearedAt', 'timeline.kind'],
    tokenStates: [],
    pmvStages: ['draft', 'sent_unopened', 'clicked', 'video_started', 'video_25', 'video_50', 'video_75', 'watched'],
    crmStatuses: ['active', 'needs_follow_up', 'watching', 'presentation_completed', 'holding_tank'],
    timelineEvents: ['follow_up_set'],
    followUpStates: ['scheduled'],
    terminal: false,
    manualOnly: true,
  },
  {
    id: 'follow_up_due',
    label: 'Follow-up due',
    phase: 'manual_follow_up',
    description: 'The BA-created reminder is due and should be surfaced as a manual next action.',
    sourceCollections: ['tmag_prospect_crm_followups'],
    sourceFields: ['prospectId', 'sponsorTmagId', 'dueAt', 'clearedAt'],
    tokenStates: [],
    pmvStages: ['draft', 'sent_unopened', 'clicked', 'video_started', 'video_25', 'video_50', 'video_75', 'watched'],
    crmStatuses: ['needs_follow_up', 'active', 'watching', 'presentation_completed', 'holding_tank'],
    timelineEvents: ['follow_up_set'],
    followUpStates: ['due'],
    terminal: false,
    manualOnly: true,
  },
  {
    id: 'webinar_reserved',
    label: 'Webinar reserved',
    phase: 'manual_follow_up',
    description: 'The prospect reserved a live event seat and the BA remains responsible for human follow-up.',
    sourceCollections: ['tmag_prospect_webinar_reservations'],
    sourceFields: ['reservationId', 'eventId', 'prospectId', 'sponsorTmagId', 'createdAt'],
    tokenStates: [],
    pmvStages: ['watched', 'callback_requested'],
    crmStatuses: ['needs_follow_up', 'presentation_completed', 'holding_tank'],
    timelineEvents: ['info_requested'],
    followUpStates: ['none', 'scheduled', 'due'],
    terminal: false,
    manualOnly: true,
  },
  {
    id: 'customer',
    label: 'Customer outcome',
    phase: 'outcome',
    description: 'The prospect became a customer through off-app human follow-up.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_crm_records'],
    sourceFields: ['becameCustomer', 'becameCustomerAt', 'disposition', 'closedReason'],
    tokenStates: [],
    pmvStages: ['customer'],
    crmStatuses: ['closed'],
    timelineEvents: ['closed_new_customer'],
    followUpStates: ['none', 'cleared'],
    terminal: true,
    manualOnly: true,
  },
  {
    id: 'enrolled',
    label: 'Brand Ambassador outcome',
    phase: 'outcome',
    description: 'The prospect enrolled off-app and was marked as a Brand Ambassador outcome.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invite_tokens', 'tmag_prospect_crm_records'],
    sourceFields: ['state', 'updatedAt', 'disposition', 'closedReason', 'closedAt'],
    tokenStates: ['enrolled'],
    pmvStages: ['enrolled'],
    crmStatuses: ['closed'],
    timelineEvents: ['closed_new_brand_ambassador'],
    followUpStates: ['none', 'cleared'],
    terminal: true,
    manualOnly: true,
  },
  {
    id: 'closed_no_join',
    label: 'Closed, no join',
    phase: 'terminal',
    description: 'The CRM record was closed without a customer or BA outcome.',
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospect_timeline_events'],
    sourceFields: ['status', 'disposition', 'closedReason', 'closedAt', 'timeline.kind'],
    tokenStates: [],
    pmvStages: [],
    crmStatuses: ['closed'],
    timelineEvents: ['closed_not_interested', 'closed_later'],
    followUpStates: ['none', 'cleared'],
    terminal: true,
    manualOnly: true,
  },
  {
    id: 'expired',
    label: 'Expired',
    phase: 'terminal',
    description: 'The consideration window expired and the prospect is outside active PMV follow-up.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invite_tokens', 'tmag_prospect_crm_records'],
    sourceFields: ['state', 'expiresAt', 'closedReason', 'closedAt'],
    tokenStates: ['expired'],
    pmvStages: ['expired'],
    crmStatuses: ['closed'],
    timelineEvents: ['expired'],
    followUpStates: ['none', 'cleared'],
    terminal: true,
    manualOnly: false,
  },
  {
    id: 'archived',
    label: 'Archived',
    phase: 'terminal',
    description: 'The prospect was soft-deleted or removed from active CRM views.',
    sourceCollections: ['tmag_prospects', 'tmag_prospect_timeline_events'],
    sourceFields: ['deleted', 'deletedAt', 'timeline.kind'],
    tokenStates: [],
    pmvStages: ['archived'],
    crmStatuses: ['closed'],
    timelineEvents: ['archived'],
    followUpStates: ['none', 'cleared'],
    terminal: true,
    manualOnly: true,
  },
] as const;

export type CrmCanonicalLifecycleStateId =
  (typeof CRM_CANONICAL_LIFECYCLE_STATES)[number]['id'];

export const CRM_LIFECYCLE_MODEL = {
  version: CRM_LIFECYCLE_MODEL_VERSION,
  purpose:
    'Canonical CRM lifecycle model for BA-owned prospect records, manual follow-up, engagement signals, and off-app outcomes.',
  tokenStates: CRM_TOKEN_STATES,
  prospectLifecycleStages: CRM_PROSPECT_LIFECYCLE_STAGES,
  crmStatuses: CRM_RECORD_STATUSES,
  dispositions: CRM_DISPOSITIONS,
  closedReasons: CRM_CLOSED_REASONS,
  timelineEvents: CRM_TIMELINE_EVENT_KINDS,
  vmLeadStatuses: CRM_VM_LEAD_STATUSES,
  followUpStates: CRM_FOLLOW_UP_STATES,
  states: CRM_CANONICAL_LIFECYCLE_STATES,
} as const;
