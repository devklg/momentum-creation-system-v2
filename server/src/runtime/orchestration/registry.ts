import type { McsAgentKey, McsRuntimeTaskType } from '@momentum/shared/runtime';
import type { AgentOrchestrationDescriptor } from './types.js';

/**
 * S2.1 inert agent registry descriptors.
 *
 * Descriptors declare allowed objectives (as validated packet task types),
 * supported modes/languages, guardrail labels, allowed/forbidden output shapes,
 * event family, and Guided Action / outcome categories. They carry NO behavior,
 * prompts, or templates. `behaviorImplemented` is false for every entry.
 */

const STEVE_SUCCESS: AgentOrchestrationDescriptor = {
  agentKey: 'steve_success',
  displayName: 'Steve Success',
  primaryDomain: 'success',
  roleSummary:
    'Internal .team non-scored Success Interview agent that produces a Success Profile artifact.',
  allowedTaskTypes: ['success_interview', 'session_resume', 'guided_action_review'],
  supportedModes: ['browser_text', 'browser_voice', 'mixed'],
  supportedLanguages: ['en', 'es'],
  guardrailSet: [
    'no_scoring',
    'no_ranking',
    'no_success_prediction',
    'no_qualification',
    'no_income_or_placement_claims',
    'no_three_authority_claims',
    'no_direct_store_access',
  ],
  requiresContextPacket: true,
  allowedOutputs: [
    'interview_question',
    'clarifying_question',
    'session_summary',
    'next_step_prompt',
    'reflection_prompt',
    'guided_action_suggestion',
  ],
  forbiddenOutputs: [
    'score',
    'rank',
    'readiness_classification',
    'qualification_classification',
    'income_projection',
    'placement_promise',
    'automated_prospecting_list',
    'three_authority_decision',
  ],
  eventFamily: 'steve',
  guidedActionCategories: [
    'review_profile',
    'choose_training_topic',
    'open_michael_training',
    'record_private_note',
  ],
  outcomeCategories: [
    'success_interview_completed',
    'success_profile_draft_created',
    'success_profile_confirmed',
    'guided_action_accepted',
    'guided_action_declined',
    'session_degraded',
    'session_cancelled',
  ],
  behaviorImplemented: false,
};

const MICHAEL_MAGNIFICENT: AgentOrchestrationDescriptor = {
  agentKey: 'michael_magnificent',
  displayName: 'Michael Magnificent',
  primaryDomain: 'training',
  roleSummary:
    'Internal .team training support agent for BA learning, orientation, follow-through, and daily-success rhythm.',
  allowedTaskTypes: [
    'training_support',
    'journal_teaching',
    'session_resume',
    'guided_action_review',
  ],
  supportedModes: ['browser_text', 'browser_voice', 'mixed'],
  supportedLanguages: ['en', 'es'],
  guardrailSet: [
    'no_prospect_facing_language',
    'no_income_or_placement_claims',
    'no_three_authority_claims',
    'no_medical_advice',
    'no_internal_telephony',
    'mandatory_text_fallback',
    'no_direct_store_access',
  ],
  requiresContextPacket: true,
  allowedOutputs: [
    'teaching_explanation',
    'clarifying_question',
    'next_step_prompt',
    'reflection_prompt',
    'session_summary',
    'guided_action_suggestion',
  ],
  forbiddenOutputs: [
    'prospect_facing_message',
    'income_projection',
    'placement_promise',
    'three_authority_decision',
    'medical_claim',
    'automated_outreach',
  ],
  eventFamily: 'michael',
  guidedActionCategories: [
    'review_training_module',
    'open_team_page',
    'practice_compliant_explanation',
    'record_private_note',
    'continue_training_step',
  ],
  outcomeCategories: [
    'training_support_completed',
    'training_question_answered',
    'topic_completed',
    'guided_action_accepted',
    'guided_action_declined',
    'follow_up_requested',
    'session_degraded',
    'session_cancelled',
  ],
  behaviorImplemented: false,
};

const IVORY: AgentOrchestrationDescriptor = {
  agentKey: 'ivory',
  displayName: 'Ivory',
  primaryDomain: 'relationship',
  roleSummary:
    'Internal .team BA-facing relationship/context support that produces editable, BA-owned drafts only.',
  allowedTaskTypes: [
    'relationship_coaching',
    'invitation_drafting',
    'session_resume',
    'guided_action_review',
  ],
  supportedModes: ['browser_text', 'browser_voice', 'mixed'],
  supportedLanguages: ['en', 'es'],
  guardrailSet: [
    'no_auto_send',
    'no_calling',
    'no_lead_qualification',
    'no_prospect_scoring',
    'no_automated_prospecting',
    'no_bulk_outreach',
    'no_income_or_placement_claims',
    'no_medical_claims',
    'no_direct_store_access',
    'ba_owned_action',
  ],
  requiresContextPacket: true,
  allowedOutputs: [
    'editable_invitation_draft',
    'clarifying_question',
    'next_step_prompt',
    'reflection_prompt',
    'guided_action_suggestion',
  ],
  forbiddenOutputs: [
    'auto_sent_message',
    'placed_call',
    'lead_qualification',
    'prospect_score',
    'automated_prospecting_list',
    'bulk_outreach',
    'income_projection',
    'placement_promise',
  ],
  eventFamily: 'ivory',
  guidedActionCategories: [
    'review_draft',
    'edit_tone',
    'copy_draft_manually',
    'open_invitation_workflow',
    'record_private_note',
    'ask_michael_for_training',
  ],
  outcomeCategories: [
    'relationship_context_reviewed',
    'editable_draft_created',
    'draft_revised_by_ba',
    'guided_action_accepted',
    'guided_action_declined',
    'compliance_guardrail_blocked',
    'session_cancelled',
  ],
  behaviorImplemented: false,
};

export const AGENT_ORCHESTRATION_REGISTRY: Readonly<
  Record<McsAgentKey, AgentOrchestrationDescriptor>
> = {
  steve_success: STEVE_SUCCESS,
  michael_magnificent: MICHAEL_MAGNIFICENT,
  ivory: IVORY,
};

export const ORCHESTRATION_AGENT_KEYS: readonly McsAgentKey[] = [
  'steve_success',
  'michael_magnificent',
  'ivory',
];

export function getAgentDescriptor(agentKey: McsAgentKey): AgentOrchestrationDescriptor {
  // Guard against an agentKey cast from an external boundary (deserialized JSON,
  // a removed/typo'd key). The Record type reports this as always-present, but
  // at runtime an unknown key yields undefined and would crash every caller on
  // property access — fail loud with a clear error instead.
  const descriptor = AGENT_ORCHESTRATION_REGISTRY[agentKey];
  if (!descriptor) {
    throw new Error(`getAgentDescriptor: unknown agentKey "${String(agentKey)}"`);
  }
  return descriptor;
}

export function isKnownAgentKey(value: unknown): value is McsAgentKey {
  return (
    value === 'steve_success' || value === 'michael_magnificent' || value === 'ivory'
  );
}

export function isTaskTypeAllowed(agentKey: McsAgentKey, taskType: McsRuntimeTaskType): boolean {
  // Unknown agentKey → not allowed, rather than a TypeError on undefined.
  const descriptor = AGENT_ORCHESTRATION_REGISTRY[agentKey];
  return descriptor ? descriptor.allowedTaskTypes.includes(taskType) : false;
}

export function listOrchestrationDescriptors(): readonly AgentOrchestrationDescriptor[] {
  return ORCHESTRATION_AGENT_KEYS.map((key) => AGENT_ORCHESTRATION_REGISTRY[key]);
}
