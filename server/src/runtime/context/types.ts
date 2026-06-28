import type {
  AgentKey,
  BaId,
  ContextPacketV1,
  RuntimeLanguage,
} from '@momentum/shared/runtime';

export type ContextPacketValidationCode =
  | 'invalid_packet'
  | 'schema_version_invalid'
  | 'context_manager_required'
  | 'team_scope_invalid'
  | 'ba_scope_invalid'
  | 'agent_identity_invalid'
  | 'language_invalid'
  | 'runtime_rule_missing'
  | 'guardrail_missing'
  | 'candidate_knowledge_included'
  | 'approved_knowledge_invalid'
  | 'private_context_scope_mismatch'
  | 'relationship_context_scope_mismatch'
  | 'journal_context_scope_mismatch'
  | 'retrieval_audit_invalid'
  | 'degraded_state_required';

export interface ContextPacketValidationIssue {
  path: string;
  code: ContextPacketValidationCode;
  message: string;
}

export type ContextPacketValidationResult =
  | {
      ok: true;
      packet: ContextPacketV1;
      errors: [];
    }
  | {
      ok: false;
      errors: ContextPacketValidationIssue[];
    };

export interface ContextPacketFoundationRequest {
  agentKey: AgentKey;
  baId: BaId;
  language: RuntimeLanguage;
  objective: string;
}

export interface ContextPacketFoundationBoundary {
  assembledBy: 'context_manager';
  agentsMayRetrieveDirectly: false;
  candidateKnowledgeIncludedByDefault: false;
  supportedLanguages: readonly RuntimeLanguage[];
  requiredRuntimeRuleIds: readonly string[];
}
