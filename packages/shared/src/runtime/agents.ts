import type { AgentId, SessionId, TemplateId } from './ids.js';
import type { RuntimeLanguage } from './language.js';

export type AgentKey = 'steve_success' | 'michael_magnificent' | 'ivory';

export type AgentDisplayName = 'Steve Success' | 'Michael Magnificent' | 'Ivory';

export type AgentDomain = 'success' | 'training' | 'relationship';

export type RuntimeMode = 'browser_voice' | 'browser_text' | 'mixed';

export type AgentRuntimeMode =
  | 'guided_specialist'
  | 'interview_specialist'
  | 'training_specialist'
  | 'relationship_specialist';

export type AgentSessionStatus =
  | 'created'
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RuntimeTaskType =
  | 'success_interview'
  | 'training_support'
  | 'journal_teaching'
  | 'relationship_coaching'
  | 'invitation_drafting'
  | 'session_resume'
  | 'guided_action_review';

export type AgentAllowedOutput =
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

export type RuntimeToolKey =
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

export interface AgentRegistryEntry {
  agentKey: AgentKey;
  displayName: AgentDisplayName;
  primaryDomain: AgentDomain;
  roleSummary: string;
  supportedLanguages: RuntimeLanguage[];
  supportedModes: RuntimeMode[];
  defaultTemplateIds: Record<RuntimeLanguage, TemplateId>;
  allowedTools: RuntimeToolKey[];
  prohibitedBehaviors: string[];
  active: boolean;
}

export interface AgentRuntimeInstanceConfig {
  agentId: AgentId;
  agentKey: AgentKey;
  active: boolean;
  sessionId?: SessionId;
  metadata?: Record<string, unknown>;
}

export interface AgentContext {
  agentKey: AgentKey;
  agentId?: AgentId;
  displayName: AgentDisplayName;
  primaryDomain: AgentDomain;
  roleSummary: string;
  allowedOutputs: AgentAllowedOutput[];
  prohibitedOutputs: string[];
  agentRuntimeMode: AgentRuntimeMode;
  contextUsageInstruction: string;
}
