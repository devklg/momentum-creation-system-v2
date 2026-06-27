# Context Packet Schema

Status: Canonical runtime source-of-truth  
Layer: `/runtime`

## Purpose

The Context Packet is the structured runtime payload delivered from the Context Manager to the Agent Runtime. It is the agent's source of truth for the current session.

## Version

```text
context_packet.v1
```

## Top-level TypeScript schema

```ts
export interface ContextPacketV1 {
  schemaVersion: 'context_packet.v1';
  packetId: string;
  requestId: string;
  createdAt: string;
  expiresAt?: string;

  tenant: TenantContext;
  ba: BAContext;
  session: SessionContext;
  agent: AgentContext;
  language: LanguageContext;

  runtimeRules: RuntimeRule[];
  guardrails: Guardrail[];

  activeTemplate?: InterviewTemplateContext;
  approvedKnowledge: ApprovedKnowledgeContextItem[];
  privateContext: PrivateContextSection;
  relationshipContext: RelationshipContextSection;
  journalContext: JournalContextSection;
  sessionHistory: SessionHistorySection;
  guidedActions: GuidedActionContextItem[];

  exclusions: ContextExclusion[];
  retrievalAudit: RetrievalAudit;
  degraded?: DegradedContextState;
}
```

## Core sections

```ts
export interface TenantContext {
  tenantId: string;
  tenantName: string;
  brandName: string;
  environment: 'development' | 'staging' | 'production';
}

export interface BAContext {
  baId: string;
  displayName?: string;
  preferredName?: string;
  timezone?: string;
  onboardingState?: string;
  journalEnabled: boolean;
  languagePreference: 'en' | 'es';
  permissions: {
    canUsePrivateJournal: boolean;
    canSelectJournalForReview: boolean;
    canCreateKnowledgeCandidate: boolean;
  };
}

export interface SessionContext {
  sessionId: string;
  mode: 'browser_voice' | 'text' | 'mixed';
  status: 'created' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  taskType:
    | 'success_interview'
    | 'training_support'
    | 'journal_teaching'
    | 'relationship_coaching'
    | 'invitation_drafting'
    | 'session_resume'
    | 'guided_action_review';
  currentState?: string;
}
```

## Agent section

```ts
export interface AgentContext {
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  displayName: 'Steve Success' | 'Michael Magnificent' | 'Ivory';
  primaryDomain: 'success' | 'training' | 'relationship';
  roleSummary: string;
  allowedOutputs: AgentAllowedOutput[];
  prohibitedOutputs: string[];
}

export type AgentAllowedOutput =
  | 'interview_question'
  | 'teaching_explanation'
  | 'journal_prompt'
  | 'knowledge_candidate_summary'
  | 'editable_invitation_draft'
  | 'guided_action_suggestion'
  | 'session_summary';
```

## Language section

```ts
export interface LanguageContext {
  primary: 'en' | 'es';
  fallback?: 'en' | 'es';
  detectedFromInput?: 'en' | 'es';
  userPreference?: 'en' | 'es';
  translationAllowed: boolean;
  interviewTemplateLanguage: 'en' | 'es';
}
```

## Required runtime rules

Every packet must include:

- internal agents use browser voice/text fallback;
- no Telnyx PSTN for internal coaching;
- BA owns relationship actions;
- Momentum Journal is private by default;
- agents do not present Knowledge Candidates as approved knowledge.

## Guardrails

```ts
export interface Guardrail {
  guardrailId: string;
  appliesTo: 'all_agents' | 'steve_success' | 'michael_magnificent' | 'ivory';
  instruction: string;
  reason?: string;
}
```

## Interview template context

```ts
export interface InterviewTemplateContext {
  templateId: string;
  agentKey: 'steve_success' | 'michael_magnificent' | 'ivory';
  language: 'en' | 'es';
  title: string;
  version: number;
  states: InterviewTemplateState[];
}

export interface InterviewTemplateState {
  stateKey: string;
  purpose: string;
  prompt: string;
  expectedCaptureFields: string[];
  nextStates: string[];
}
```

Minimum states:

```text
Steve:
welcome -> capture_win_or_obstacle -> extract_lesson -> choose_next_action -> journal_reflection_offer -> candidate_summary_offer -> close_session

Michael:
welcome -> teach_momentum_journal -> answer_training_question -> guide_system_action -> journal_practice_prompt -> candidate_summary_offer -> close_session

Ivory:
welcome -> who_came_to_mind -> relationship_context -> why_now -> tone_and_channel -> draft_invitation -> ba_review_and_edit -> mint_or_copy_next_step -> candidate_summary_offer -> close_session
```

## Knowledge item

```ts
export interface ApprovedKnowledgeContextItem {
  knowledgeId: string;
  domain: 'success' | 'training' | 'relationship';
  language: 'en' | 'es';
  title: string;
  summary: string;
  excerpt?: string;
  tags: string[];
  version: number;
  status: 'active';
  retrieval: {
    score: number;
    reasonCodes: string[];
    retrievedFrom: Array<'mongo' | 'chroma' | 'neo4j' | 'graphrag'>;
  };
}
```

## Private and journal context

```ts
export interface PrivateContextSection {
  included: boolean;
  visibility: 'private_to_ba';
  reason?: string;
  items: PrivateContextItem[];
}

export interface JournalContextSection {
  included: boolean;
  journalEnabled: boolean;
  privateByDefault: true;
  items: JournalContextItem[];
  allowedActions: Array<'create_entry' | 'update_entry' | 'select_for_review'>;
}
```

## Relationship context

```ts
export interface RelationshipContextItem {
  relationshipContextId: string;
  personDisplayName?: string;
  relationshipToBA?: string;
  whyNow?: string;
  tonePreference?: string;
  channelPreference?: 'phone' | 'text' | 'in_person' | 'email' | 'unknown';
  source: 'ba_input' | 'ivory_session' | 'crm_record' | 'journal_entry';
  privacy: 'ba_owned';
}
```

## Guided actions

```ts
export interface GuidedActionContextItem {
  actionType:
    | 'write_journal_entry'
    | 'schedule_follow_up'
    | 'review_training'
    | 'draft_invitation'
    | 'choose_next_prospect'
    | 'capture_lesson'
    | 'submit_candidate_for_review';
  title: string;
  description: string;
  owner: 'ba';
  urgency: 'low' | 'normal' | 'high';
  sourceKnowledgeIds?: string[];
}
```

## Exclusions and audit

```ts
export interface ContextExclusion {
  reason:
    | 'private_journal_not_requested'
    | 'candidate_not_approved'
    | 'wrong_tenant'
    | 'wrong_ba'
    | 'superseded_knowledge'
    | 'language_mismatch'
    | 'risk_flag_unresolved'
    | 'context_budget_exceeded';
  sourceId?: string;
  note?: string;
}

export interface RetrievalAudit {
  retrievalId: string;
  requestedScopes: string[];
  includedKnowledgeIds: string[];
  includedPrivateContextIds: string[];
  excludedSourceIds: string[];
  retrievalMethods: Array<'mongo' | 'chroma' | 'neo4j' | 'graphrag'>;
  tokenEstimate: number;
  createdAt: string;
}
```

## Degraded packet

```ts
export interface DegradedContextState {
  isDegraded: true;
  reason: 'knowledge_retrieval_failed' | 'graph_unavailable' | 'semantic_search_unavailable' | 'template_missing' | 'unknown';
  safeFallbackInstruction: string;
}
```

## Acceptance criteria

Schema version exists; agent key and template key match; private context is separated from approved knowledge; candidate knowledge is excluded by default; English and Spanish packets can be represented; packets include retrieval audit and exclusions.
