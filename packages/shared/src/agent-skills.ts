import type { McsPlatformAgentKey } from './agent-registry.js';

export type McsAgentSkillStatus = 'implemented' | 'planned';
export type McsAgentTemplateStatus = 'active' | 'planned';
export type McsAgentDegradationMode = 'deterministic_fallback' | 'read_only_empty' | 'block_substantive';

export interface McsAgentSkillDescriptor {
  skillKey: string;
  ownerAgentKey: McsPlatformAgentKey;
  version: string;
  purpose: string;
  status: McsAgentSkillStatus;
  requiredInputs: readonly string[];
  allowedOutputs: readonly string[];
  forbiddenOutputs: readonly string[];
  behaviorSource: string;
  templateIds: readonly string[];
  testIds: readonly string[];
  handoffTarget: string | null;
  eventsEmitted: readonly string[];
  degradation: { mode: McsAgentDegradationMode; behavior: string };
  implementationPrompts?: readonly string[];
}

export interface McsAgentTemplateDescriptor {
  templateId: string;
  version: string;
  ownerAgentKey: McsPlatformAgentKey;
  skillKey: string;
  status: McsAgentTemplateStatus;
  owner: string;
  behaviorSource: string;
  allowedInputs: readonly string[];
  allowedOutputs: readonly string[];
  forbiddenOutputs: readonly string[];
  degradation: { mode: McsAgentDegradationMode; fallbackSource: string };
  testIds: readonly string[];
  approval: { state: 'approved' | 'planned'; authority: string; activatedAt: string | null };
}

const skill = (value: McsAgentSkillDescriptor): McsAgentSkillDescriptor => value;

export const MCS_AGENT_SKILL_REGISTRY: readonly McsAgentSkillDescriptor[] = [
  skill({ skillKey: 'steve.conduct_success_discovery', ownerAgentKey: 'steve_success', version: '1.0.0', status: 'implemented',
    purpose: 'Conduct adaptive, non-scored Success Discovery.', requiredInputs: ['authenticated_ba', 'conversation_turns'],
    allowedOutputs: ['interview_question', 'reflection', 'completion_marker'], forbiddenOutputs: ['score', 'rank', 'qualification', 'prediction'],
    behaviorSource: 'server/src/domain/steveConversationRuntime.ts', templateIds: ['steve_success_discovery'],
    testIds: ['steveConversationRuntime.test.ts'], handoffTarget: 'steve.assemble_success_profile', eventsEmitted: ['steve.interview.completed'],
    degradation: { mode: 'block_substantive', behavior: 'Preserve prior turns and request human retry without inventing answers.' } }),
  skill({ skillKey: 'steve.assemble_success_profile', ownerAgentKey: 'steve_success', version: '1.0.0', status: 'implemented',
    purpose: 'Assemble the descriptive Success Profile and Michael handoff.', requiredInputs: ['completed_discovery_answers'],
    allowedOutputs: ['success_profile', 'michael_handoff_summary'], forbiddenOutputs: ['score', 'rank', 'success_prediction'],
    behaviorSource: 'server/src/domain/steve-success-interview.ts', templateIds: ['steve_success_profile', 'steve_success_profile_extraction'],
    testIds: ['steveDiscoveryPersistence.test.ts'], handoffTarget: 'michael.project_training_support', eventsEmitted: ['success_profile.created'],
    degradation: { mode: 'block_substantive', behavior: 'Do not create a profile from incomplete authoritative answers.' } }),
  skill({ skillKey: 'michael.project_training_support', ownerAgentKey: 'michael_magnificent', version: '1.0.0', status: 'implemented',
    purpose: 'Project Steve context into supportive training guidance.', requiredInputs: ['success_profile', 'sponsor_relationship'],
    allowedOutputs: ['training_support_card', 'training_recommendation'], forbiddenOutputs: ['interview', 'score', 'income_claim', 'placement_promise'],
    behaviorSource: 'server/src/domain/michael-training-support.ts', templateIds: ['michael_training_support'],
    testIds: ['michaelTrainingSupport.test.ts'], handoffTarget: 'brand_ambassador_or_sponsor', eventsEmitted: ['michael.training.recommended'],
    degradation: { mode: 'read_only_empty', behavior: 'Return unavailable guidance when no Success Profile exists.' } }),
  skill({ skillKey: 'michael.surface_todays_actions', ownerAgentKey: 'michael_magnificent', version: '1.0.0', status: 'implemented',
    purpose: 'Surface current callback, follow-up, and expiry actions.', requiredInputs: ['authenticated_ba', 'cockpit_signals'],
    allowedOutputs: ['ba_owned_actions', 'bias_prompt'], forbiddenOutputs: ['pressure', 'automatic_action', 'success_prediction'],
    behaviorSource: 'server/src/domain/cockpit.ts#getCockpitTodaysActions', templateIds: ['michael_daily_success_actions'],
    testIds: ['cockpitTodaysActions.test.ts'], handoffTarget: 'cockpit', eventsEmitted: ['daily_action.created'],
    degradation: { mode: 'read_only_empty', behavior: 'Return a calm empty state and leadership-approved sharing prompt.' } }),
  skill({ skillKey: 'michael.sponsor_assisted_debrief', ownerAgentKey: 'michael_magnificent', version: '0.1.0', status: 'planned',
    purpose: 'Support sponsor-led call preparation, recording review, and debrief.', requiredInputs: ['participant_consent', 'sponsor_relationship', 'training_session'],
    allowedOutputs: ['teachable_moments', 'practice_suggestion'], forbiddenOutputs: ['trainee_score', 'live_interruption', 'automatic_outreach'],
    behaviorSource: 'planned:sponsor-assisted-coaching', templateIds: ['michael_sponsor_debrief'], testIds: ['planned:p160-sponsor-debrief'],
    handoffTarget: 'sponsor_or_upline', eventsEmitted: ['coaching.debrief.prepared'],
    degradation: { mode: 'block_substantive', behavior: 'Without consent or session evidence, defer to the human sponsor.' },
    implementationPrompts: [
      'engineering/sprints/agent-capabilities/03_SPONSOR_ASSISTED_COACHING.md',
      'engineering/sprints/agent-capabilities/04_TRAINING_RECORDINGS.md',
      'engineering/sprints/agent-capabilities/05_MICHAEL_DEBRIEF.md',
    ] }),
  skill({ skillKey: 'ivory.manage_personal_prospect_roster', ownerAgentKey: 'ivory', version: '1.0.0', status: 'implemented',
    purpose: 'Maintain the BA-authored warm relationship roster.', requiredInputs: ['authenticated_ba', 'ba_authored_relationship_context'],
    allowedOutputs: ['roster_entry', 'relationship_context'], forbiddenOutputs: ['scraped_contact', 'prospect_score', 'qualification'],
    behaviorSource: 'server/src/domain/ivory.ts', templateIds: ['ivory_wdyk_coach'], testIds: ['ivoryPersistence.test.ts'],
    handoffTarget: 'ivory.draft_personal_invitation', eventsEmitted: ['ivory.roster.updated'],
    degradation: { mode: 'deterministic_fallback', behavior: 'Use neutral memory prompts without inventing people or context.' } }),
  skill({ skillKey: 'ivory.suggest_follow_up', ownerAgentKey: 'ivory', version: '1.0.0', status: 'implemented',
    purpose: 'Suggest respectful follow-up from PMV and relationship context.', requiredInputs: ['owned_prospect', 'pmv_context'],
    allowedOutputs: ['editable_followup_suggestion', 'crm_handoff_context'], forbiddenOutputs: ['automatic_send', 'pressure', 'income_claim', 'medical_claim'],
    behaviorSource: 'server/src/domain/ivory-momentum.ts', templateIds: ['ivory_momentum_followup'],
    testIds: ['ivoryMomentumGeneratedCopyCompliance.test.ts'], handoffTarget: 'brand_ambassador_and_crm', eventsEmitted: ['ivory.followup.recommended'],
    degradation: { mode: 'deterministic_fallback', behavior: 'Return a neutral BA-owned follow-up suggestion.' } }),
  skill({ skillKey: 'scriptmaker.draft_product_invitation', ownerAgentKey: 'scriptmaker', version: '1.0.0', status: 'implemented',
    purpose: 'Create an editable compliant product invitation.', requiredInputs: ['product_name', 'video_title', 'prospect_first_name'],
    allowedOutputs: ['editable_invitation_draft'], forbiddenOutputs: ['automatic_send', 'income_claim', 'medical_claim', 'placement_promise'],
    behaviorSource: 'server/src/domain/scriptmaker.ts', templateIds: ['scriptmaker_product_invitation'],
    testIds: ['scriptmakerGeneratedCopyCompliance.test.ts'], handoffTarget: 'invitation_spine', eventsEmitted: ['scriptmaker.draft.created'],
    degradation: { mode: 'deterministic_fallback', behavior: 'Return the approved neutral invitation fallback.' } }),
  skill({ skillKey: 'scriptmaker.who_do_you_know_and_mint', ownerAgentKey: 'scriptmaker', version: '0.1.0', status: 'planned',
    purpose: 'Guide product/opportunity memory prompts, personalize, and prepare a token for BA sharing.',
    requiredInputs: ['approved_product_or_opportunity_context', 'ba_identified_person', 'authentic_reason'],
    allowedOutputs: ['memory_prompt', 'editable_invitation_draft', 'tokenized_link'],
    forbiddenOutputs: ['scraped_contact', 'qualification', 'automatic_send', 'income_projection'],
    behaviorSource: 'planned:scriptmaker-wdyk-token-flow', templateIds: ['scriptmaker_wdyk_product', 'scriptmaker_wdyk_opportunity'],
    testIds: ['planned:p160-scriptmaker-wdyk'], handoffTarget: 'brand_ambassador_then_ivory', eventsEmitted: ['ivory.invitation.created'],
    degradation: { mode: 'block_substantive', behavior: 'Do not mint until the BA identifies the person and approves the draft.' },
    implementationPrompts: [
      'engineering/sprints/agent-capabilities/01_SCRIPTMAKER_WDYK_PERSONAL_PROSPECT_LIST.md',
      'engineering/sprints/agent-capabilities/02_SCRIPTMAKER_INVITATION_TOKEN.md',
    ] }),
  skill({ skillKey: 'admin.inspect_agent_memory', ownerAgentKey: 'admin_recommendations', version: '1.0.0', status: 'implemented',
    purpose: 'Explain agent-memory health and report review-only findings.', requiredInputs: ['admin_session', 'agent_memory_projections'],
    allowedOutputs: ['overview', 'warning', 'bridge_draft'], forbiddenOutputs: ['automatic_mutation', 'ba_score', 'leadership_decision'],
    behaviorSource: 'server/src/domain/adminAgentMemory.ts', templateIds: ['admin_agent_oversight'], testIds: ['adminAgents.test.ts'],
    handoffTarget: 'sponsor_or_leadership', eventsEmitted: ['admin.agents.overview.viewed'],
    degradation: { mode: 'read_only_empty', behavior: 'Surface unavailable sources and warnings without repair.' } }),
] as const;

const template = (value: McsAgentTemplateDescriptor): McsAgentTemplateDescriptor => value;
export const MCS_AGENT_TEMPLATE_REGISTRY: readonly McsAgentTemplateDescriptor[] = [
  template({ templateId: 'steve_success_discovery', version: '1.0.0', ownerAgentKey: 'steve_success', skillKey: 'steve.conduct_success_discovery', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/steve-success-interview.ts#buildSteveSystemPrompt', allowedInputs: ['authenticated_ba', 'conversation_turns'], allowedOutputs: ['interview_question', 'reflection', 'completion_marker'], forbiddenOutputs: ['score', 'rank', 'qualification'], degradation: { mode: 'block_substantive', fallbackSource: 'steve_conversation_retry' }, testIds: ['steveConversationRuntime.test.ts'], approval: { state: 'approved', authority: 'locked-spec-3.12', activatedAt: '2026-06-26' } }),
  template({ templateId: 'steve_success_profile', version: '1.0.0', ownerAgentKey: 'steve_success', skillKey: 'steve.assemble_success_profile', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/steve-success-interview.ts#assembleSuccessProfile', allowedInputs: ['completed_discovery_answers'], allowedOutputs: ['success_profile', 'michael_handoff_summary'], forbiddenOutputs: ['score', 'prediction'], degradation: { mode: 'block_substantive', fallbackSource: 'incomplete_profile_block' }, testIds: ['steveDiscoveryPersistence.test.ts'], approval: { state: 'approved', authority: 'locked-spec-3.12', activatedAt: '2026-06-26' } }),
  template({ templateId: 'steve_success_profile_extraction', version: '1.0.0', ownerAgentKey: 'steve_success', skillKey: 'steve.assemble_success_profile', status: 'planned', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/steveConversationRuntime.ts#extractionSystem', allowedInputs: ['completed_discovery_transcript', 'registered_discovery_question_ids'], allowedOutputs: ['structured_discovery_answers', 'success_profile_input'], forbiddenOutputs: ['score', 'rank', 'qualification', 'prediction', 'income_claim', 'placement_promise'], degradation: { mode: 'block_substantive', fallbackSource: 'steve_extraction_retry_then_pending' }, testIds: ['steveConversationRuntime.test.ts', 'stevePromptPlaybook.test.ts'], approval: { state: 'planned', authority: 'ACR-0022-pending', activatedAt: null } }),
  template({ templateId: 'michael_training_support', version: '1.0.0', ownerAgentKey: 'michael_magnificent', skillKey: 'michael.project_training_support', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/michael-training-support.ts', allowedInputs: ['success_profile', 'sponsor_relationship'], allowedOutputs: ['training_support_card'], forbiddenOutputs: ['interview', 'score', 'income_claim'], degradation: { mode: 'read_only_empty', fallbackSource: 'training_support_not_available' }, testIds: ['michaelTrainingSupport.test.ts'], approval: { state: 'approved', authority: 'locked-spec-3.12', activatedAt: '2026-06-26' } }),
  template({ templateId: 'michael_daily_success_actions', version: '1.0.0', ownerAgentKey: 'michael_magnificent', skillKey: 'michael.surface_todays_actions', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/cockpit.ts#getCockpitTodaysActions', allowedInputs: ['cockpit_signals'], allowedOutputs: ['ba_owned_actions'], forbiddenOutputs: ['pressure', 'automatic_action'], degradation: { mode: 'read_only_empty', fallbackSource: 'cockpit_bias_prompt' }, testIds: ['cockpitTodaysActions.test.ts'], approval: { state: 'approved', authority: 'P1-59-capability-registry', activatedAt: '2026-07-11' } }),
  template({ templateId: 'michael_sponsor_debrief', version: '0.1.0', ownerAgentKey: 'michael_magnificent', skillKey: 'michael.sponsor_assisted_debrief', status: 'planned', owner: 'Team Magnificent Leadership', behaviorSource: 'planned:sponsor-assisted-coaching', allowedInputs: ['participant_consent', 'training_session'], allowedOutputs: ['teachable_moments'], forbiddenOutputs: ['trainee_score', 'live_interruption'], degradation: { mode: 'block_substantive', fallbackSource: 'human_sponsor_debrief' }, testIds: ['planned:p160-sponsor-debrief'], approval: { state: 'planned', authority: 'Kevin training-development-duplication', activatedAt: null } }),
  template({ templateId: 'ivory_wdyk_coach', version: '1.0.0', ownerAgentKey: 'ivory', skillKey: 'ivory.manage_personal_prospect_roster', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/ivory.ts#COACH_SYSTEM_PREFIX', allowedInputs: ['ba_authored_relationship_context'], allowedOutputs: ['memory_prompts', 'coaching'], forbiddenOutputs: ['scraped_contact', 'qualification'], degradation: { mode: 'deterministic_fallback', fallbackSource: 'ivoryCoachFallback' }, testIds: ['ivoryGeneratedCopyCompliance.test.ts'], approval: { state: 'approved', authority: 'existing-runtime', activatedAt: '2026-05-24' } }),
  template({ templateId: 'ivory_momentum_followup', version: '1.0.0', ownerAgentKey: 'ivory', skillKey: 'ivory.suggest_follow_up', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/ivory-momentum.ts#SUGGEST_SYSTEM_PREFIX', allowedInputs: ['owned_prospect', 'pmv_context'], allowedOutputs: ['editable_followup_suggestion'], forbiddenOutputs: ['automatic_send', 'pressure', 'income_claim'], degradation: { mode: 'deterministic_fallback', fallbackSource: 'neutralSuggestion' }, testIds: ['ivoryMomentumGeneratedCopyCompliance.test.ts'], approval: { state: 'approved', authority: 'existing-runtime', activatedAt: '2026-06-23' } }),
  template({ templateId: 'scriptmaker_product_invitation', version: '1.0.0', ownerAgentKey: 'scriptmaker', skillKey: 'scriptmaker.draft_product_invitation', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/scriptmaker.ts#SYSTEM_PREFIX', allowedInputs: ['product_name', 'video_title', 'prospect_first_name', 'prospect_context'], allowedOutputs: ['editable_invitation_draft'], forbiddenOutputs: ['automatic_send', 'income_claim', 'medical_claim'], degradation: { mode: 'deterministic_fallback', fallbackSource: 'neutralFallback' }, testIds: ['scriptmakerGeneratedCopyCompliance.test.ts'], approval: { state: 'approved', authority: 'existing-runtime', activatedAt: '2026-05-22' } }),
  template({ templateId: 'scriptmaker_wdyk_product', version: '0.1.0', ownerAgentKey: 'scriptmaker', skillKey: 'scriptmaker.who_do_you_know_and_mint', status: 'planned', owner: 'Team Magnificent Leadership', behaviorSource: 'planned:scriptmaker-wdyk-product', allowedInputs: ['approved_product_context', 'ba_identified_person', 'authentic_reason'], allowedOutputs: ['memory_prompt', 'editable_invitation_draft', 'tokenized_link'], forbiddenOutputs: ['qualification', 'automatic_send', 'medical_claim'], degradation: { mode: 'block_substantive', fallbackSource: 'return_to_product_training' }, testIds: ['planned:p160-scriptmaker-wdyk'], approval: { state: 'planned', authority: 'Kevin ScriptMaker clarification', activatedAt: null } }),
  template({ templateId: 'scriptmaker_wdyk_opportunity', version: '0.1.0', ownerAgentKey: 'scriptmaker', skillKey: 'scriptmaker.who_do_you_know_and_mint', status: 'planned', owner: 'Team Magnificent Leadership', behaviorSource: 'planned:scriptmaker-wdyk-opportunity', allowedInputs: ['leadership_approved_opportunity_context', 'ba_identified_person', 'authentic_reason'], allowedOutputs: ['memory_prompt', 'editable_invitation_draft', 'tokenized_link'], forbiddenOutputs: ['qualification', 'automatic_send', 'income_projection'], degradation: { mode: 'block_substantive', fallbackSource: 'return_to_leadership_training' }, testIds: ['planned:p160-scriptmaker-wdyk'], approval: { state: 'planned', authority: 'Kevin ScriptMaker clarification', activatedAt: null } }),
  template({ templateId: 'admin_agent_oversight', version: '1.0.0', ownerAgentKey: 'admin_recommendations', skillKey: 'admin.inspect_agent_memory', status: 'active', owner: 'Team Magnificent Leadership', behaviorSource: 'server/src/domain/adminAgentMemory.ts', allowedInputs: ['admin_session', 'agent_memory_projections'], allowedOutputs: ['overview', 'warning', 'bridge_draft'], forbiddenOutputs: ['automatic_mutation', 'ba_score'], degradation: { mode: 'read_only_empty', fallbackSource: 'warnings' }, testIds: ['adminAgents.test.ts'], approval: { state: 'approved', authority: 'admin-oversight-runtime', activatedAt: '2026-07-01' } }),
] as const;

export function validateAgentSkillTemplateRegistries(): string[] {
  const errors: string[] = [];
  const skillKeys = new Set<string>();
  const templateKeys = new Set<string>();
  const skills = new Map(MCS_AGENT_SKILL_REGISTRY.map((item) => [item.skillKey, item]));
  for (const item of MCS_AGENT_SKILL_REGISTRY) {
    if (skillKeys.has(item.skillKey)) errors.push(`duplicate_skill:${item.skillKey}`);
    skillKeys.add(item.skillKey);
    if (!/^\d+\.\d+\.\d+$/.test(item.version)) errors.push(`invalid_skill_version:${item.skillKey}`);
    if (!item.requiredInputs.length || !item.allowedOutputs.length || !item.forbiddenOutputs.length || !item.testIds.length) errors.push(`incomplete_skill:${item.skillKey}`);
    if (item.status === 'planned' && !item.implementationPrompts?.length) errors.push(`planned_without_prompt:${item.skillKey}`);
  }
  for (const item of MCS_AGENT_TEMPLATE_REGISTRY) {
    const identity = `${item.templateId}@${item.version}`;
    if (templateKeys.has(identity)) errors.push(`duplicate_template:${identity}`);
    templateKeys.add(identity);
    const owner = skills.get(item.skillKey);
    if (!owner) errors.push(`unknown_skill:${item.templateId}`);
    else if (owner.ownerAgentKey !== item.ownerAgentKey) errors.push(`owner_mismatch:${item.templateId}`);
    if (!/^\d+\.\d+\.\d+$/.test(item.version) || !item.allowedInputs.length || !item.allowedOutputs.length || !item.forbiddenOutputs.length || !item.testIds.length) errors.push(`incomplete_template:${item.templateId}`);
    if (item.status === 'active' && item.approval.state !== 'approved') errors.push(`active_not_approved:${item.templateId}`);
  }
  for (const item of MCS_AGENT_SKILL_REGISTRY) for (const templateId of item.templateIds) {
    if (!MCS_AGENT_TEMPLATE_REGISTRY.some((entry) => entry.templateId === templateId && entry.skillKey === item.skillKey)) errors.push(`missing_template:${item.skillKey}:${templateId}`);
  }
  return errors;
}
