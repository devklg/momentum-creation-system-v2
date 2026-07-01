import type { McsAgentId, McsSessionId, McsTemplateId } from './ids.js';
import type { McsRuntimeLanguage } from './language.js';

export type McsAgentKey = 'steve_success' | 'michael_magnificent' | 'ivory';

export type McsAgentDisplayName = 'Steve Success' | 'Michael Magnificent' | 'Ivory';

export type McsAgentDomain = 'success' | 'training' | 'relationship';

export type McsRuntimeMode = 'browser_voice' | 'browser_text' | 'mixed';

export type McsAgentRuntimeMode =
  | 'guided_specialist'
  | 'interview_specialist'
  | 'training_specialist'
  | 'relationship_specialist';

export type McsAgentSessionStatus =
  | 'created'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type McsRuntimeTaskType =
  | 'success_interview'
  | 'training_support'
  | 'journal_teaching'
  | 'relationship_coaching'
  | 'invitation_drafting'
  | 'session_resume'
  | 'guided_action_review';

export type McsAgentAllowedOutput =
  | 'interview_question'
  | 'teaching_explanation'
  | 'journal_prompt'
  | 'knowledge_candidate_summary'
  | 'editable_invitation_draft'
  | 'guided_action_suggestion'
  | 'session_summary'
  | 'clarifying_question'
  | 'next_step_prompt'
  | 'reflection_prompt';

export type McsRuntimeToolKey =
  | 'build_context_packet'
  | 'append_conversation_turn'
  | 'create_journal_entry'
  | 'create_knowledge_candidate'
  | 'create_guided_action'
  | 'emit_agent_event'
  | 'complete_session'
  | 'create_relationship_context'
  | 'prepare_editable_invitation_draft'
  | 'mint_invitation_link_if_approved_by_ba';

export interface McsAgentRegistryEntry {
  agentKey: McsAgentKey;
  displayName: McsAgentDisplayName;
  primaryDomain: McsAgentDomain;
  roleSummary: string;
  supportedLanguages: McsRuntimeLanguage[];
  supportedModes: McsRuntimeMode[];
  defaultTemplateIds: Record<McsRuntimeLanguage, McsTemplateId>;
  allowedTools: McsRuntimeToolKey[];
  prohibitedBehaviors: string[];
  active: boolean;
}

export interface McsAgentRuntimeInstanceConfig {
  agentId: McsAgentId;
  agentKey: McsAgentKey;
  active: boolean;
  sessionId?: McsSessionId;
  metadata?: Record<string, unknown>;
}

export interface McsAgentContext {
  agentKey: McsAgentKey;
  agentId?: McsAgentId;
  displayName: McsAgentDisplayName;
  primaryDomain: McsAgentDomain;
  roleSummary: string;
  allowedOutputs: McsAgentAllowedOutput[];
  prohibitedOutputs: string[];
  agentRuntimeMode: McsAgentRuntimeMode;
  contextUsageInstruction: string;
}
