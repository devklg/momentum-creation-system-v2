import { PMV_LIFECYCLE_STAGES } from './pmv-contract.js';
import { MCS_VM_LEAD_LIFECYCLE_STATUSES } from './types.js';
import type {
  McsCallbackIntent,
  McsProspectCrmClosedReason,
  McsProspectCrmStatus,
  McsProspectLifecycleStage,
  McsProspectTimelineEventKind,
  McsTokenState,
  McsVmDeliveryStatus,
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

export const CRM_CALLBACK_INTENTS: readonly McsCallbackIntent[] = [
  'interested_tell_me_more',
  'have_questions',
  'ready_to_join',
] as const;

export const CRM_VM_DELIVERY_STATUSES: readonly McsVmDeliveryStatus[] = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'skipped',
  'opted_out',
  'suppressed',
  'unknown',
] as const;

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

export type CrmStateMapRail =
  | 'invitation_token'
  | 'prospect_account'
  | 'crm_record'
  | 'callback'
  | 'webinar'
  | 'vm_rvm_delivery'
  | 'vm_rvm_lead'
  | 'outcome'
  | 'follow_up'
  | 'timeline';

export interface CrmCrossStateMapping {
  rail: CrmStateMapRail;
  sourceState: string;
  canonicalStateIds: readonly CrmCanonicalLifecycleStateId[];
  sourceCollections: readonly string[];
  sourceFields: readonly string[];
  note: string;
}

export const CRM_TOKEN_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  {
    rail: 'invitation_token',
    sourceState: 'minted',
    canonicalStateIds: ['draft', 'sent_unopened'],
    sourceCollections: ['tmag_prospect_invite_tokens', 'tmag_prospects'],
    sourceFields: ['state', 'sentAt', 'token'],
    note: '`sentAt` distinguishes draft from sent_unopened; minted alone never proves delivery.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'clicked',
    canonicalStateIds: ['opened'],
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['state', 'clickedAt'],
    note: 'Prospect opened the link; no qualification or scoring is inferred.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'video_started',
    canonicalStateIds: ['watching'],
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['state', 'updatedAt'],
    note: 'Presentation progress without completion.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'video_quarter',
    canonicalStateIds: ['watching'],
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['state', 'updatedAt'],
    note: 'Presentation progress without completion.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'video_half',
    canonicalStateIds: ['watching'],
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['state', 'updatedAt'],
    note: 'Presentation progress without completion.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'video_three_quarter',
    canonicalStateIds: ['watching'],
    sourceCollections: ['tmag_prospect_invite_tokens'],
    sourceFields: ['state', 'updatedAt'],
    note: 'Presentation progress without completion.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'video_complete',
    canonicalStateIds: ['watched'],
    sourceCollections: ['tmag_prospect_invite_tokens', 'tmag_prospect_htank_placements'],
    sourceFields: ['state', 'placedAt', 'positionNumber'],
    note: 'Video completion may create pool visibility, never a placement or earnings promise.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'enrolled',
    canonicalStateIds: ['enrolled'],
    sourceCollections: ['tmag_prospect_invite_tokens', 'tmag_prospects'],
    sourceFields: ['state', 'updatedAt'],
    note: 'Manual off-app enrollment outcome.',
  },
  {
    rail: 'invitation_token',
    sourceState: 'expired',
    canonicalStateIds: ['expired'],
    sourceCollections: ['tmag_prospect_invite_tokens', 'tmag_prospects'],
    sourceFields: ['state', 'expiresAt'],
    note: 'Consideration window expired.',
  },
] as const;

export const CRM_PROSPECT_ACCOUNT_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  {
    rail: 'prospect_account',
    sourceState: 'created_without_sentAt',
    canonicalStateIds: ['draft'],
    sourceCollections: ['tmag_prospects'],
    sourceFields: ['prospectId', 'token', 'sentAt', 'createdAt'],
    note: 'Prospect account exists but the BA has not confirmed sharing the link.',
  },
  {
    rail: 'prospect_account',
    sourceState: 'sentAt_present',
    canonicalStateIds: ['sent_unopened'],
    sourceCollections: ['tmag_prospects', 'tmag_prospect_invitation_activity'],
    sourceFields: ['sentAt', 'activity.kind', 'activity.at'],
    note: 'BA-side delivery confirmation; token may still be minted.',
  },
  {
    rail: 'prospect_account',
    sourceState: 'positionNumber_or_placedAt_present',
    canonicalStateIds: ['watched'],
    sourceCollections: ['tmag_prospects', 'tmag_prospect_htank_placements'],
    sourceFields: ['positionNumber', 'placedAt'],
    note: 'Presentation completion evidence without implying binary placement.',
  },
  {
    rail: 'prospect_account',
    sourceState: 'becameCustomer_true',
    canonicalStateIds: ['customer'],
    sourceCollections: ['tmag_prospects'],
    sourceFields: ['becameCustomer', 'becameCustomerAt', 'customerNote'],
    note: 'Customer outcome manually marked after off-app follow-up.',
  },
  {
    rail: 'prospect_account',
    sourceState: 'deleted_true',
    canonicalStateIds: ['archived'],
    sourceCollections: ['tmag_prospects'],
    sourceFields: ['deleted', 'deletedAt'],
    note: 'Soft-delete removes the prospect from active CRM views.',
  },
] as const;

export const CRM_RECORD_STATUS_MAPPINGS: readonly CrmCrossStateMapping[] = [
  {
    rail: 'crm_record',
    sourceState: 'inactive_pre_engagement',
    canonicalStateIds: ['draft', 'sent_unopened'],
    sourceCollections: ['tmag_prospect_crm_records'],
    sourceFields: ['status', 'token', 'updatedAt'],
    note: 'CRM record exists before prospect engagement; delivery fields decide draft versus sent.',
  },
  {
    rail: 'crm_record',
    sourceState: 'active',
    canonicalStateIds: ['opened'],
    sourceCollections: ['tmag_prospect_crm_records'],
    sourceFields: ['status', 'updatedAt'],
    note: 'Engagement has started.',
  },
  {
    rail: 'crm_record',
    sourceState: 'needs_follow_up',
    canonicalStateIds: ['callback_requested', 'webinar_reserved', 'follow_up_due'],
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospect_crm_followups'],
    sourceFields: ['status', 'followUpDueAt'],
    note: 'Manual follow-up is needed; callback/webinar/follow-up evidence picks the display state.',
  },
  {
    rail: 'crm_record',
    sourceState: 'watching',
    canonicalStateIds: ['watching'],
    sourceCollections: ['tmag_prospect_crm_records'],
    sourceFields: ['status', 'updatedAt'],
    note: 'Presentation is in progress.',
  },
  {
    rail: 'crm_record',
    sourceState: 'presentation_completed',
    canonicalStateIds: ['watched'],
    sourceCollections: ['tmag_prospect_crm_records'],
    sourceFields: ['status', 'updatedAt'],
    note: 'Presentation completed before or without holding-tank placement evidence.',
  },
  {
    rail: 'crm_record',
    sourceState: 'holding_tank',
    canonicalStateIds: ['watched'],
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospect_htank_placements'],
    sourceFields: ['status', 'positionNumber', 'placedAt'],
    note: 'Holding-tank visibility remains a PMV signal, not a placement promise.',
  },
  {
    rail: 'crm_record',
    sourceState: 'closed',
    canonicalStateIds: ['customer', 'enrolled', 'closed_no_join', 'expired', 'archived'],
    sourceCollections: ['tmag_prospect_crm_records'],
    sourceFields: ['status', 'disposition', 'closedReason', 'closedAt'],
    note: 'Closed reason and disposition choose the terminal canonical outcome.',
  },
] as const;

export const CRM_CALLBACK_STATE_MAPPINGS: readonly CrmCrossStateMapping[] =
  CRM_CALLBACK_INTENTS.map((intent) => ({
    rail: 'callback',
    sourceState: intent,
    canonicalStateIds: ['callback_requested'],
    sourceCollections: ['tmag_prospect_callback_requests'],
    sourceFields: ['intent', 'callbackRequestId', 'createdAt'],
    note: 'Callback intent is a manual follow-up signal, not a token lifecycle state.',
  }));

export const CRM_WEBINAR_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  {
    rail: 'webinar',
    sourceState: 'reservation_created',
    canonicalStateIds: ['webinar_reserved'],
    sourceCollections: ['tmag_prospect_webinar_reservations'],
    sourceFields: ['reservationId', 'eventId', 'prospectId', 'createdAt'],
    note: 'Webinar reservation is logistics plus BA follow-up, not a token lifecycle state.',
  },
  {
    rail: 'webinar',
    sourceState: 'event_upcoming',
    canonicalStateIds: ['webinar_reserved'],
    sourceCollections: ['tmag_prospect_webinar_events'],
    sourceFields: ['eventId', 'status', 'scheduledFor'],
    note: 'Upcoming event status enriches a reservation but does not change token state.',
  },
] as const;

export const CRM_VM_RVM_DELIVERY_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'queued',
    canonicalStateIds: ['draft'],
    sourceCollections: ['tmag_vm_delivery_events'],
    sourceFields: ['status', 'leadId', 'createdAt'],
    note: 'Delivery is pending; no prospect engagement is inferred.',
  },
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'sent',
    canonicalStateIds: ['sent_unopened'],
    sourceCollections: ['tmag_vm_delivery_events'],
    sourceFields: ['status', 'leadId', 'createdAt'],
    note: 'Provider reports send attempt; click/activation is still required for engagement.',
  },
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'delivered',
    canonicalStateIds: ['sent_unopened'],
    sourceCollections: ['tmag_vm_delivery_events'],
    sourceFields: ['status', 'leadId', 'createdAt'],
    note: 'Provider delivery does not imply prospect interest.',
  },
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'failed',
    canonicalStateIds: ['draft'],
    sourceCollections: ['tmag_vm_delivery_events'],
    sourceFields: ['status', 'leadId', 'createdAt'],
    note: 'Failed delivery stays pre-engagement for cleanup/retry handling.',
  },
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'skipped',
    canonicalStateIds: ['draft'],
    sourceCollections: ['tmag_vm_delivery_events'],
    sourceFields: ['status', 'leadId', 'createdAt'],
    note: 'Skipped delivery is operational, not prospect engagement.',
  },
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'opted_out',
    canonicalStateIds: ['closed_no_join'],
    sourceCollections: ['tmag_vm_delivery_events', 'tmag_prospect_crm_records'],
    sourceFields: ['status', 'closedReason', 'disposition'],
    note: 'Opt-out should become a terminal do-not-contact/no-join state.',
  },
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'suppressed',
    canonicalStateIds: ['closed_no_join'],
    sourceCollections: ['tmag_vm_delivery_events', 'tmag_vm_suppressions'],
    sourceFields: ['status', 'leadId', 'reason'],
    note: 'Suppression keeps the person out of active CRM delivery.',
  },
  {
    rail: 'vm_rvm_delivery',
    sourceState: 'unknown',
    canonicalStateIds: ['draft'],
    sourceCollections: ['tmag_vm_delivery_events'],
    sourceFields: ['status', 'leadId', 'createdAt'],
    note: 'Unknown provider state needs reconciliation before lifecycle advancement.',
  },
] as const;

export const CRM_VM_RVM_LEAD_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  ...[
    'imported',
    'validated',
    'crm_created',
    'token_created',
    'queued',
    'delivery_dry_run',
    'manual_exported',
    'voicemail_drop_queued',
    'voicemail_drop_failed',
  ].map((sourceState) => ({
    rail: 'vm_rvm_lead' as const,
    sourceState,
    canonicalStateIds: ['draft'] as const,
    sourceCollections: ['tmag_vm_bulk_leads'],
    sourceFields: ['status', 'token', 'crmRecordId', 'updatedAt'],
    note: 'VM/RVM lead is prepared or delivery failed; no confirmed prospect engagement exists.',
  })),
  ...[
    'voicemail_drop_delivered',
    'voicemail_sent',
    'sms_sent',
    'email_sent',
  ].map((sourceState) => ({
    rail: 'vm_rvm_lead' as const,
    sourceState,
    canonicalStateIds: ['sent_unopened'] as const,
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_vm_delivery_events'],
    sourceFields: ['status', 'token', 'updatedAt'],
    note: 'Delivery happened; link engagement remains separate.',
  })),
  ...['invalid', 'duplicate', 'suppressed', 'opted_out'].map((sourceState) => ({
    rail: 'vm_rvm_lead' as const,
    sourceState,
    canonicalStateIds: ['closed_no_join'] as const,
    sourceCollections: ['tmag_vm_bulk_leads'],
    sourceFields: ['status', 'updatedAt'],
    note: 'Lead is not active for CRM follow-up.',
  })),
  {
    rail: 'vm_rvm_lead',
    sourceState: 'link_clicked',
    canonicalStateIds: ['opened'],
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_invite_tokens'],
    sourceFields: ['status', 'token', 'clickedAt'],
    note: 'RVM link click begins engagement.',
  },
  {
    rail: 'vm_rvm_lead',
    sourceState: 'activated',
    canonicalStateIds: ['opened'],
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_timeline_events'],
    sourceFields: ['status', 'timeline.kind', 'updatedAt'],
    note: 'RVM activation is engagement, not qualification.',
  },
  {
    rail: 'vm_rvm_lead',
    sourceState: 'info_requested',
    canonicalStateIds: ['opened'],
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_timeline_events'],
    sourceFields: ['status', 'timeline.kind', 'updatedAt'],
    note: 'Information request is an engagement signal.',
  },
  {
    rail: 'vm_rvm_lead',
    sourceState: 'callback_requested',
    canonicalStateIds: ['callback_requested'],
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_callback_requests'],
    sourceFields: ['status', 'intent', 'createdAt'],
    note: 'Callback request moves to manual follow-up.',
  },
  ...['presentation_started', 'presentation_25', 'presentation_50', 'presentation_75'].map(
    (sourceState) => ({
      rail: 'vm_rvm_lead' as const,
      sourceState,
      canonicalStateIds: ['watching'] as const,
      sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_timeline_events'],
      sourceFields: ['status', 'timeline.kind', 'updatedAt'],
      note: 'Presentation is in progress.',
    }),
  ),
  ...['presentation_completed', 'dashboard_entered', 'holding_tank'].map((sourceState) => ({
    rail: 'vm_rvm_lead' as const,
    sourceState,
    canonicalStateIds: ['watched'] as const,
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_htank_placements'],
    sourceFields: ['status', 'positionNumber', 'placedAt'],
    note: 'Presentation completion signal without placement promise.',
  })),
  {
    rail: 'vm_rvm_lead',
    sourceState: 'closed_new_brand_ambassador',
    canonicalStateIds: ['enrolled'],
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_crm_records'],
    sourceFields: ['status', 'closedReason', 'closedAt'],
    note: 'Manual off-app BA enrollment outcome.',
  },
  {
    rail: 'vm_rvm_lead',
    sourceState: 'closed_new_customer',
    canonicalStateIds: ['customer'],
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_crm_records'],
    sourceFields: ['status', 'closedReason', 'closedAt'],
    note: 'Manual customer outcome.',
  },
  ...['closed_not_interested', 'closed_later'].map((sourceState) => ({
    rail: 'vm_rvm_lead' as const,
    sourceState,
    canonicalStateIds: ['closed_no_join'] as const,
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_crm_records'],
    sourceFields: ['status', 'disposition', 'closedReason'],
    note: 'Manual no-join closure.',
  })),
  {
    rail: 'vm_rvm_lead',
    sourceState: 'expired',
    canonicalStateIds: ['expired'],
    sourceCollections: ['tmag_vm_bulk_leads', 'tmag_prospect_invite_tokens'],
    sourceFields: ['status', 'state', 'expiresAt'],
    note: 'RVM consideration window expired.',
  },
  {
    rail: 'vm_rvm_lead',
    sourceState: 'archived',
    canonicalStateIds: ['archived'],
    sourceCollections: ['tmag_vm_bulk_leads'],
    sourceFields: ['status', 'updatedAt'],
    note: 'Lead removed from active VM/RVM views.',
  },
] as const;

export const CRM_OUTCOME_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  {
    rail: 'outcome',
    sourceState: 'new_brand_ambassador',
    canonicalStateIds: ['enrolled'],
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospects'],
    sourceFields: ['disposition', 'state', 'closedAt'],
    note: 'Disposition for manual off-app BA enrollment.',
  },
  {
    rail: 'outcome',
    sourceState: 'enrolled_as_brand_ambassador',
    canonicalStateIds: ['enrolled'],
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospects'],
    sourceFields: ['closedReason', 'state', 'closedAt'],
    note: 'Closed reason for manual off-app BA enrollment.',
  },
  {
    rail: 'outcome',
    sourceState: 'new_customer',
    canonicalStateIds: ['customer'],
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospects'],
    sourceFields: ['disposition', 'becameCustomer', 'becameCustomerAt'],
    note: 'Disposition for customer outcome.',
  },
  {
    rail: 'outcome',
    sourceState: 'became_customer',
    canonicalStateIds: ['customer'],
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospects'],
    sourceFields: ['closedReason', 'becameCustomer', 'becameCustomerAt'],
    note: 'Closed reason for customer outcome.',
  },
  ...['interested', 'not_interested', 'later', 'no_response', 'wrong_number', 'do_not_contact'].map(
    (sourceState) => ({
      rail: 'outcome' as const,
      sourceState,
      canonicalStateIds: ['closed_no_join'] as const,
      sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospect_crm_dispositions'],
      sourceFields: ['disposition', 'closedReason', 'closedAt'],
      note: 'Manual CRM disposition that is not a BA or customer outcome.',
    }),
  ),
  ...['not_interested', 'do_not_contact', 'duplicate', 'invalid_contact', 'admin_closed'].map(
    (sourceState) => ({
      rail: 'outcome' as const,
      sourceState,
      canonicalStateIds: ['closed_no_join'] as const,
      sourceCollections: ['tmag_prospect_crm_records'],
      sourceFields: ['closedReason', 'closedAt'],
      note: 'Terminal CRM closure without BA or customer outcome.',
    }),
  ),
  {
    rail: 'outcome',
    sourceState: 'expired',
    canonicalStateIds: ['expired'],
    sourceCollections: ['tmag_prospect_crm_records', 'tmag_prospects'],
    sourceFields: ['closedReason', 'state', 'expiresAt'],
    note: 'Expired consideration window.',
  },
] as const;

export const CRM_FOLLOW_UP_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  {
    rail: 'follow_up',
    sourceState: 'none',
    canonicalStateIds: ['draft', 'sent_unopened', 'opened', 'watching', 'watched'],
    sourceCollections: ['tmag_prospect_crm_followups'],
    sourceFields: ['prospectId', 'clearedAt'],
    note: 'No active reminder; base lifecycle comes from token/prospect/CRM rails.',
  },
  {
    rail: 'follow_up',
    sourceState: 'scheduled',
    canonicalStateIds: ['follow_up_scheduled'],
    sourceCollections: ['tmag_prospect_crm_followups'],
    sourceFields: ['dueAt', 'clearedAt'],
    note: 'Manual reminder exists and is not yet due.',
  },
  {
    rail: 'follow_up',
    sourceState: 'due',
    canonicalStateIds: ['follow_up_due'],
    sourceCollections: ['tmag_prospect_crm_followups'],
    sourceFields: ['dueAt', 'clearedAt'],
    note: 'Manual reminder is due.',
  },
  {
    rail: 'follow_up',
    sourceState: 'cleared',
    canonicalStateIds: ['draft', 'sent_unopened', 'opened', 'watching', 'watched'],
    sourceCollections: ['tmag_prospect_crm_followups'],
    sourceFields: ['clearedAt'],
    note: 'Cleared reminder falls back to the base lifecycle.',
  },
] as const;

export const CRM_TIMELINE_STATE_MAPPINGS: readonly CrmCrossStateMapping[] =
  CRM_TIMELINE_EVENT_KINDS.map((sourceState) => {
    const canonicalStateIdsByEvent: Record<
      McsProspectTimelineEventKind,
      readonly CrmCanonicalLifecycleStateId[]
    > = {
      crm_created: ['draft'],
      token_created: ['draft'],
      voicemail_sent: ['sent_unopened'],
      sms_sent: ['sent_unopened'],
      email_sent: ['sent_unopened'],
      link_clicked: ['opened'],
      activated: ['opened'],
      info_requested: ['opened'],
      callback_requested: ['callback_requested'],
      presentation_started: ['watching'],
      presentation_25: ['watching'],
      presentation_50: ['watching'],
      presentation_75: ['watching'],
      presentation_completed: ['watched'],
      dashboard_entered: ['watched'],
      holding_tank: ['watched'],
      note_added: ['draft', 'sent_unopened', 'opened', 'watching', 'watched'],
      follow_up_set: ['follow_up_scheduled', 'follow_up_due'],
      follow_up_cleared: ['draft', 'sent_unopened', 'opened', 'watching', 'watched'],
      disposition_changed: ['customer', 'enrolled', 'closed_no_join'],
      closed_new_brand_ambassador: ['enrolled'],
      closed_new_customer: ['customer'],
      closed_not_interested: ['closed_no_join'],
      closed_later: ['closed_no_join'],
      expired: ['expired'],
      archived: ['archived'],
      ownership_corrected: ['draft', 'sent_unopened', 'opened', 'watching', 'watched'],
    };
    return {
      rail: 'timeline',
      sourceState,
      canonicalStateIds: canonicalStateIdsByEvent[sourceState],
      sourceCollections: ['tmag_prospect_timeline_events'],
      sourceFields: ['kind', 'occurredAt', 'payload'],
      note: 'Append-only CRM event evidence; base row fields may refine the final display state.',
    };
  });

export const CRM_CROSS_STATE_MAPPINGS: readonly CrmCrossStateMapping[] = [
  ...CRM_TOKEN_STATE_MAPPINGS,
  ...CRM_PROSPECT_ACCOUNT_STATE_MAPPINGS,
  ...CRM_RECORD_STATUS_MAPPINGS,
  ...CRM_CALLBACK_STATE_MAPPINGS,
  ...CRM_WEBINAR_STATE_MAPPINGS,
  ...CRM_VM_RVM_DELIVERY_STATE_MAPPINGS,
  ...CRM_VM_RVM_LEAD_STATE_MAPPINGS,
  ...CRM_OUTCOME_STATE_MAPPINGS,
  ...CRM_FOLLOW_UP_STATE_MAPPINGS,
  ...CRM_TIMELINE_STATE_MAPPINGS,
] as const;

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
  callbackIntents: CRM_CALLBACK_INTENTS,
  vmDeliveryStatuses: CRM_VM_DELIVERY_STATUSES,
  followUpStates: CRM_FOLLOW_UP_STATES,
  states: CRM_CANONICAL_LIFECYCLE_STATES,
  crossStateMappings: CRM_CROSS_STATE_MAPPINGS,
} as const;
