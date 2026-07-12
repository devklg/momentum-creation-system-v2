/** P1-59 canonical platform agent/capability registry. Metadata only. */
export const MCS_PLATFORM_AGENT_KEYS = [
  'steve_success',
  'michael_magnificent',
  'ivory',
  'scriptmaker',
  'admin_recommendations',
] as const;

export type McsPlatformAgentKey = (typeof MCS_PLATFORM_AGENT_KEYS)[number];
export type McsPlatformAgentKind = 'guided_agent' | 'drafting_agent' | 'derived_service';
export type McsPlatformAgentSurface = 'team' | 'admin';

export interface McsPlatformAgentDescriptor {
  agentKey: McsPlatformAgentKey;
  displayName: string;
  kind: McsPlatformAgentKind;
  surfaces: readonly McsPlatformAgentSurface[];
  mission: string;
  owns: readonly string[];
  doesNotOwn: readonly string[];
  humanActionOwner: 'brand_ambassador' | 'sponsor_or_leadership';
  behaviorSource: string;
  active: boolean;
}

export interface McsPlatformCapabilityDescriptor {
  capabilityKey: string;
  displayName: string;
  ownerAgentKey: McsPlatformAgentKey;
  purpose: string;
  independentlyAddressableAgent: boolean;
}

export interface McsFutureAgentRegistration {
  agentKey: string;
  displayName: string;
  kind: McsPlatformAgentKind;
  surfaces: readonly McsPlatformAgentSurface[];
  mission: string;
  humanActionOwner: McsPlatformAgentDescriptor['humanActionOwner'];
  behaviorSource: string;
  approvedByDecisionId: string;
  active: false;
}

export const MCS_PLATFORM_AGENT_REGISTRY: Readonly<
  Record<McsPlatformAgentKey, McsPlatformAgentDescriptor>
> = {
  steve_success: {
    agentKey: 'steve_success', displayName: 'Steve Success', kind: 'guided_agent', surfaces: ['team'],
    mission: 'Conduct non-scored discovery and create the Success Profile.',
    owns: ['success_interview', 'success_profile', 'michael_handoff_context'],
    doesNotOwn: ['training_recommendations', 'prospect_outreach', 'human_scoring'],
    humanActionOwner: 'brand_ambassador', behaviorSource: 'server/src/domain/steve-success-interview.ts', active: true,
  },
  michael_magnificent: {
    agentKey: 'michael_magnificent', displayName: 'Michael Magnificent', kind: 'guided_agent', surfaces: ['team'],
    mission: 'Support product learning, training, daily rhythm, practice, and sponsor-led development.',
    owns: ['training_support', 'product_learning', 'daily_success_coach', 'coaching_debrief'],
    doesNotOwn: ['success_interview', 'prospect_qualification', 'automated_outreach'],
    humanActionOwner: 'brand_ambassador', behaviorSource: 'server/src/domain/michael-training-support.ts', active: true,
  },
  ivory: {
    agentKey: 'ivory', displayName: 'Ivory', kind: 'guided_agent', surfaces: ['team'],
    mission: 'Support relationship context, PMV engagement, and respectful follow-up guidance.',
    owns: ['relationship_context', 'pmv_followup_guidance', 'crm_handoff_context'],
    doesNotOwn: ['automatic_sending', 'prospect_scoring', 'lead_qualification'],
    humanActionOwner: 'brand_ambassador', behaviorSource: 'server/src/domain/ivory-momentum.ts', active: true,
  },
  scriptmaker: {
    agentKey: 'scriptmaker', displayName: 'ScriptMaker', kind: 'drafting_agent', surfaces: ['team'],
    mission: 'Run Who Do You Know prompts and prepare personalized, compliant tokenized invitations.',
    owns: ['who_do_you_know', 'personalized_invitation_draft', 'invitation_token_preparation'],
    doesNotOwn: ['automatic_sending', 'prospect_qualification', 'outcome_prediction'],
    humanActionOwner: 'brand_ambassador', behaviorSource: 'server/src/domain/scriptmaker.ts', active: true,
  },
  admin_recommendations: {
    agentKey: 'admin_recommendations', displayName: 'Admin Recommendations', kind: 'derived_service', surfaces: ['admin'],
    mission: 'Explain operational findings and surface leadership-owned next actions.',
    owns: ['admin_recommendation_projection', 'explainable_operational_guidance'],
    doesNotOwn: ['automatic_mutation', 'ba_scoring', 'leadership_decisions'],
    humanActionOwner: 'sponsor_or_leadership', behaviorSource: 'server/src/domain/adminAgentMemory.ts', active: true,
  },
};

export const MCS_PLATFORM_CAPABILITY_REGISTRY: readonly McsPlatformCapabilityDescriptor[] = [
  {
    capabilityKey: 'daily_success_coach', displayName: 'Daily Success Coach',
    ownerAgentKey: 'michael_magnificent',
    purpose: 'Translate leadership guidance and current signals into three BA-owned actions.',
    independentlyAddressableAgent: false,
  },
  {
    capabilityKey: 'sponsor_assisted_coaching', displayName: 'Sponsor-Assisted Coaching',
    ownerAgentKey: 'michael_magnificent',
    purpose: 'Support sponsor/upline teaching, call preparation, and post-session debrief.',
    independentlyAddressableAgent: false,
  },
] as const;

export function isMcsPlatformAgentKey(value: unknown): value is McsPlatformAgentKey {
  return typeof value === 'string' && MCS_PLATFORM_AGENT_KEYS.includes(value as McsPlatformAgentKey);
}

export function getMcsPlatformAgent(agentKey: McsPlatformAgentKey): McsPlatformAgentDescriptor {
  return MCS_PLATFORM_AGENT_REGISTRY[agentKey];
}

export function validateFutureAgentRegistration(input: McsFutureAgentRegistration): string[] {
  const errors: string[] = [];
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(input.agentKey)) errors.push('invalid_agent_key');
  if (isMcsPlatformAgentKey(input.agentKey)) errors.push('agent_key_already_registered');
  if (!input.displayName.trim()) errors.push('display_name_required');
  if (!input.mission.trim()) errors.push('mission_required');
  if (!input.behaviorSource.trim()) errors.push('behavior_source_required');
  if (!input.approvedByDecisionId.trim()) errors.push('decision_approval_required');
  if (input.active !== false) errors.push('future_registration_must_be_inactive');
  return errors;
}
