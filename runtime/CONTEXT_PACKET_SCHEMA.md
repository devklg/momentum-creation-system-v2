# CONTEXT_PACKET_SCHEMA.md

## Momentum Creation System V2

### Context Packet Schema Runtime Specification

#### Version 1.0

---

## 1. Document Status

**Document Name:** Context Packet Schema Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Schema Version:** `context_packet.v1`
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Producer:** Context Manager
**Primary Consumer:** Agent Runtime
**Primary Agent Consumers:** Steve Success, Michael Magnificent, Ivory
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

---

## 2. Purpose

The Context Packet is the structured runtime payload delivered from the Context Manager to the Agent Runtime.

It is the agent's source of truth for the current session.

The Context Packet tells the agent:

- Who the Brand Ambassador is.
- Which agent is operating.
- What task is being performed.
- What language should be used.
- What runtime rules apply.
- What guardrails must be followed.
- What active template applies.
- What approved knowledge may be used.
- What private context is allowed.
- What journal context is allowed.
- What relationship context is allowed.
- What guided actions are relevant.
- What information was excluded.
- What retrieval audit supports the packet.
- Whether the packet is complete, degraded, or failed.

Agents must not search the Knowledge Core directly.

Agents must not query MongoDB directly.

Agents must not query Neo4j directly.

Agents must not query Chroma directly.

Agents must not perform their own GraphRAG retrieval.

Agents act from the Context Packet.

The Context Packet is the boundary between contextual intelligence and agent behavior.

---

## 3. Runtime Philosophy

Momentum transforms knowledge into guidance through controlled context.

The Knowledge Core stores what Momentum knows.

The Context Manager selects what is needed right now.

The Context Packet carries that selected context to the Agent Runtime.

The Agent Runtime uses the packet to guide the Brand Ambassador.

The Context Packet is not a database result.

The Context Packet is not raw memory.

The Context Packet is not a transcript dump.

The Context Packet is not unrestricted knowledge access.

The Context Packet is a governed, scoped, auditable, bilingual, task-specific runtime payload.

The guiding principle is:

```text
Agents do not retrieve knowledge.

Agents receive Context Packets.
```

---

## 4. Schema Version

The required schema version is:

```text
context_packet.v1
```

Every valid Context Packet must include:

```ts
schemaVersion: "context_packet.v1";
```

No other schema version is valid for Runtime Layer Version 1.0.

Future schema versions must be introduced through a ratified runtime upgrade.

---

## 5. Runtime Position

The Context Packet sits between the Context Manager and Agent Runtime.

```text
Knowledge Core
  ↓
Context Manager
  ↓
Context Packet
  ↓
Agent Runtime
  ↓
Steve / Michael / Ivory
  ↓
Browser Voice / Browser Text
```

The Context Packet is produced by the Context Manager.

The Context Packet is consumed by Agent Runtime.

The Context Packet may be referenced by the Learning Pipeline after outcomes are produced.

The Context Packet must be recorded for audit, traceability, and learning evaluation.

---

## 6. Scope

This document defines the complete `context_packet.v1` schema.

It defines:

- Top-level packet shape
- Required sections
- Optional sections
- Agent context
- Language context
- Runtime rules
- Guardrails
- Active templates
- Approved knowledge items
- Private context
- Journal context
- Relationship context
- Session history
- Guided actions
- Exclusions
- Retrieval audit
- Degraded packet state
- Validation rules
- Bilingual requirements
- Privacy requirements
- Runtime boundaries
- Acceptance criteria
- Implementation types

This document does not define how context is retrieved.

Retrieval is defined in `CONTEXT_MANAGER.md`.

This document does not define how knowledge is stored.

Storage is defined in `KNOWLEDGE_CORE_RUNTIME.md`.

This document does not define how knowledge is ingested.

Ingestion is defined in `KNOWLEDGE_INGESTION_PROTOCOL.md`.

This document does not define agent scripts.

Agent behavior belongs in Agent Runtime and Implementation documents.

---

## 7. Required Top-Level Schema

Every Context Packet must conform to the following top-level TypeScript schema.

```ts
export interface ContextPacketV1 {
  schemaVersion: "context_packet.v1";

  packetId: string;
  requestId: string;

  createdAt: string;
  expiresAt?: string;

  packetStatus: ContextPacketStatus;

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

  metadata?: ContextPacketMetadata;
}
```

---

## 8. Packet Status

```ts
export type ContextPacketStatus = "complete" | "degraded" | "failed";
```

### 8.1 Complete Packet

A complete packet includes all mandatory runtime context and all task-required context sections.

### 8.2 Degraded Packet

A degraded packet includes mandatory runtime context but lacks one or more requested or expected context sections.

A degraded packet must include a `degraded` section.

### 8.3 Failed Packet

A failed packet cannot safely support the requested agent task.

A failed packet must include:

- Mandatory safe fallback instruction when possible
- Failure reason
- Retrieval audit
- No invented knowledge
- No unauthorized private context

---

## 9. Context Packet Metadata

```ts
export interface ContextPacketMetadata {
  generatedBy: "context_manager";
  environment: RuntimeEnvironment;
  correlationId?: string;
  causationId?: string;
  buildDurationMs?: number;
  tokenEstimate?: number;
  compressionApplied?: boolean;
  notes?: string[];
}
```

```ts
export type RuntimeEnvironment = "development" | "staging" | "production";
```

---

## 10. Tenant Context

The tenant section identifies the organizational environment in which the packet was created.

```ts
export interface TenantContext {
  tenantId: string;
  tenantName: string;
  brandName: string;
  environment: RuntimeEnvironment;
}
```

### 10.1 Tenant Requirements

The tenant section must:

- Identify the tenant.
- Identify the brand name.
- Identify the environment.
- Be present in every packet.

### 10.2 Tenant Validation

A packet is invalid if:

- `tenantId` is missing.
- `environment` is not one of `development`, `staging`, or `production`.
- Tenant context conflicts with the request tenant.

---

## 11. Brand Ambassador Context

The Brand Ambassador context identifies the Brand Ambassador receiving guidance.

```ts
export interface BAContext {
  baId: string;

  displayName?: string;
  preferredName?: string;
  timezone?: string;

  onboardingState?: string;

  journalEnabled: boolean;

  languagePreference: LanguageCode;

  permissions: BAPermissions;

  profileSummary?: string;

  successProfileAvailable?: boolean;
  trainingProfileAvailable?: boolean;
  relationshipProfileAvailable?: boolean;
}
```

```ts
export interface BAPermissions {
  canUsePrivateJournal: boolean;
  canSelectJournalForReview: boolean;
  canCreateKnowledgeCandidate: boolean;
  canAccessRelationshipContext: boolean;
  canUseBrowserVoice: boolean;
  canUseBrowserText: boolean;
}
```

### 11.1 Brand Ambassador Requirements

The BA section must:

- Include `baId`.
- Include journal availability.
- Include language preference.
- Include permission flags.
- Be scoped to the active session Brand Ambassador.

### 11.2 Brand Ambassador Privacy Rule

A packet must never include private context belonging to a different Brand Ambassador.

If the packet includes private context, `ba.baId` must match the owner of that private context.

---

## 12. Session Context

The session section identifies the current runtime session.

```ts
export interface SessionContext {
  sessionId: string;

  mode: "browser_voice" | "browser_text" | "mixed";

  status:
    | "created"
    | "active"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";

  taskType: ContextTaskType;

  currentState?: string;

  previousState?: string;

  startedAt?: string;
  lastActivityAt?: string;

  workflowId?: string;

  prospectId?: string;

  guidedActionId?: string;
}
```

```ts
export type ContextTaskType =
  | "success_interview"
  | "training_support"
  | "journal_teaching"
  | "relationship_coaching"
  | "invitation_drafting"
  | "session_resume"
  | "guided_action_review";
```

### 12.1 Session Requirements

The session section must include:

- `sessionId`
- `mode`
- `status`
- `taskType`

### 12.2 Internal Runtime Mode Rule

The valid internal runtime modes are:

- `browser_voice`
- `browser_text`
- `mixed`

The Context Packet must not represent internal coaching as Telnyx PSTN voice.

---

## 13. Agent Context

The agent section identifies the specialist agent receiving the packet.

```ts
export interface AgentContext {
  agentKey: AgentKey;
  displayName: AgentDisplayName;
  primaryDomain: AgentPrimaryDomain;

  roleSummary: string;

  allowedOutputs: AgentAllowedOutput[];

  prohibitedOutputs: string[];

  agentRuntimeMode:
    | "guided_specialist"
    | "interview_specialist"
    | "training_specialist"
    | "relationship_specialist";

  contextUsageInstruction: string;
}
```

```ts
export type AgentKey = "steve_success" | "michael_magnificent" | "ivory";
```

```ts
export type AgentDisplayName =
  | "Steve Success"
  | "Michael Magnificent"
  | "Ivory";
```

```ts
export type AgentPrimaryDomain = "success" | "training" | "relationship";
```

### 13.1 Agent Key Mapping

The following mapping is mandatory:

```text
steve_success -> Steve Success -> success
michael_magnificent -> Michael Magnificent -> training
ivory -> Ivory -> relationship
```

A packet is invalid if agent key, display name, and primary domain do not match.

### 13.2 Agent Allowed Output Type

```ts
export type AgentAllowedOutput =
  | "interview_question"
  | "teaching_explanation"
  | "journal_prompt"
  | "knowledge_candidate_summary"
  | "editable_invitation_draft"
  | "guided_action_suggestion"
  | "session_summary"
  | "clarifying_question"
  | "next_step_prompt"
  | "reflection_prompt";
```

### 13.3 Universal Prohibited Outputs

Every agent packet must prohibit:

- Direct database queries
- Claims that candidate knowledge is approved
- Unauthorized use of private journal content
- Unauthorized exposure of prospect-sensitive context
- Unsupported income claims
- Unsupported medical claims
- Unapproved organizational claims
- Internal Telnyx PSTN coaching
- Automatic Brand Ambassador action without consent

---

## 14. Language Context

The language section controls bilingual runtime behavior.

```ts
export interface LanguageContext {
  primary: LanguageCode;

  fallback?: LanguageCode;

  detectedFromInput?: LanguageCode;

  userPreference?: LanguageCode;

  translationAllowed: boolean;

  interviewTemplateLanguage: LanguageCode;

  languageFallbackUsed: boolean;

  translationStatus:
    | "not_required"
    | "same_language"
    | "human_reviewed_translation"
    | "machine_translation_marked"
    | "language_neutral_template"
    | "clarification_required";
}
```

```ts
export type LanguageCode = "en" | "es";
```

### 14.1 Language Requirements

Every packet must:

- Support English.
- Support Spanish.
- Include primary language.
- Include interview template language.
- Mark fallback usage.
- Mark translation status.

### 14.2 Language Priority

The Context Packet must reflect the Context Manager's language priority:

```text
1. Same-language approved knowledge
2. Human-reviewed translation
3. Marked machine translation
4. Language-neutral template
5. Ask clarifying question
```

### 14.3 Translation Rule

Machine translation may be included only when clearly marked.

Machine translation must not be represented as approved bilingual knowledge.

---

## 15. Runtime Rules

Runtime rules are mandatory operating instructions included in every packet.

```ts
export interface RuntimeRule {
  ruleId: string;

  category:
    | "agent_boundary"
    | "knowledge_boundary"
    | "journal_privacy"
    | "relationship_privacy"
    | "runtime_transport"
    | "candidate_boundary"
    | "action_ownership"
    | "language"
    | "source_traceability"
    | "governance";

  instruction: string;

  required: true;

  appliesTo: "all_agents" | AgentKey;

  reason?: string;
}
```

### 15.1 Required Runtime Rules

Every packet must include rules equivalent to the following:

```text
Internal agents use browser voice, browser text, or mixed browser runtime.

No Telnyx PSTN is used for internal coaching.

Telnyx is limited to external runtime workflows: SMS, ringless voicemail, and future callback workflows.

Brand Ambassadors own relationship actions.

Agents guide; Brand Ambassadors decide and act.

Momentum Journal is private by default.

Private journal content may be used only within authorized Brand Ambassador scope.

Agents do not present Knowledge Candidates as approved knowledge.

Candidate knowledge is excluded from Brand Ambassador guidance by default.

Organizational knowledge must be active before use as guidance.

Agents do not query MongoDB, Neo4j, Chroma, or GraphRAG directly.

Every included knowledge item must preserve source traceability.

English and Spanish are supported runtime languages.
```

### 15.2 Runtime Rule Validation

A packet is invalid if it does not include:

- Telnyx boundary
- Journal privacy rule
- Candidate exclusion rule
- Agent database isolation rule
- BA action ownership rule
- Source traceability rule
- Bilingual runtime rule

---

## 16. Guardrails

Guardrails are task and agent safety instructions.

```ts
export interface Guardrail {
  guardrailId: string;

  appliesTo: "all_agents" | AgentKey;

  instruction: string;

  reason?: string;

  severity: "info" | "required" | "critical";

  category:
    | "privacy"
    | "compliance"
    | "knowledge_integrity"
    | "agent_scope"
    | "relationship_sensitivity"
    | "journal_privacy"
    | "language"
    | "runtime_boundary";
}
```

### 16.1 Universal Guardrails

Every packet must include guardrails equivalent to:

```text
Do not invent knowledge.

Do not claim unapproved knowledge as approved.

Do not expose private journal content outside the Brand Ambassador's authorized scope.

Do not expose prospect-sensitive information beyond the authorized relationship context.

Do not bypass governance.

Do not treat candidate knowledge as active guidance.

Do not imply the agent can take relationship actions for the Brand Ambassador.

Do not use Telnyx for internal Browser Voice.

Do not make unsupported income claims.

Do not make unsupported medical claims.

Ask a clarifying question when required context is missing.
```

### 16.2 Steve Guardrails

Steve-specific packets should include:

- Keep guidance focused on success, confidence, motivation, goals, obstacles, and momentum.
- Do not treat personal motivation patterns as universal truth.
- Do not use relationship-specific guidance unless relationship context is authorized.

### 16.3 Michael Guardrails

Michael-specific packets should include:

- Keep training practical and duplicable.
- Teach Momentum Journal privacy clearly.
- Do not promote journal content without Brand Ambassador selection.
- Do not treat training confusion as failure.

### 16.4 Ivory Guardrails

Ivory-specific packets should include:

- Preserve Brand Ambassador voice in invitations.
- Keep drafts editable.
- Do not overstate prospect interest.
- Minimize prospect-sensitive information.
- Respect relationship timing and tone.

---

## 17. Interview Template Context

The active template section provides the structured state machine or task template for the current agent task.

```ts
export interface InterviewTemplateContext {
  templateId: string;

  agentKey: AgentKey;

  language: LanguageCode;

  title: string;

  version: number;

  templateType:
    | "success_interview"
    | "training_support"
    | "journal_teaching"
    | "relationship_coaching"
    | "invitation_drafting"
    | "session_resume"
    | "guided_action_review";

  currentState?: string;

  states: InterviewTemplateState[];

  templateInstructions?: string[];
}
```

```ts
export interface InterviewTemplateState {
  stateKey: string;

  purpose: string;

  prompt: string;

  expectedCaptureFields: string[];

  nextStates: string[];

  completionCriteria?: string[];

  allowedAgentOutputs?: AgentAllowedOutput[];
}
```

### 17.1 Template Matching Rule

The template `agentKey` must match the packet `agent.agentKey`.

The template `language` must match `language.interviewTemplateLanguage`.

The template must be active for the current `session.taskType`.

---

## 18. Minimum Template States

### 18.1 Steve Success Minimum States

Steve Success templates must support:

```text
welcome
  ↓
capture_win_or_obstacle
  ↓
extract_lesson
  ↓
choose_next_action
  ↓
journal_reflection_offer
  ↓
candidate_summary_offer
  ↓
close_session
```

Required state keys:

```ts
export type SteveSuccessStateKey =
  | "welcome"
  | "capture_win_or_obstacle"
  | "extract_lesson"
  | "choose_next_action"
  | "journal_reflection_offer"
  | "candidate_summary_offer"
  | "close_session";
```

### 18.2 Michael Magnificent Minimum States

Michael Magnificent templates must support:

```text
welcome
  ↓
teach_momentum_journal
  ↓
answer_training_question
  ↓
guide_system_action
  ↓
journal_practice_prompt
  ↓
candidate_summary_offer
  ↓
close_session
```

Required state keys:

```ts
export type MichaelMagnificentStateKey =
  | "welcome"
  | "teach_momentum_journal"
  | "answer_training_question"
  | "guide_system_action"
  | "journal_practice_prompt"
  | "candidate_summary_offer"
  | "close_session";
```

### 18.3 Ivory Minimum States

Ivory templates must support:

```text
welcome
  ↓
who_came_to_mind
  ↓
relationship_context
  ↓
why_now
  ↓
tone_and_channel
  ↓
draft_invitation
  ↓
ba_review_and_edit
  ↓
mint_or_copy_next_step
  ↓
candidate_summary_offer
  ↓
close_session
```

Required state keys:

```ts
export type IvoryStateKey =
  | "welcome"
  | "who_came_to_mind"
  | "relationship_context"
  | "why_now"
  | "tone_and_channel"
  | "draft_invitation"
  | "ba_review_and_edit"
  | "mint_or_copy_next_step"
  | "candidate_summary_offer"
  | "close_session";
```

---

## 19. Approved Knowledge Context

Approved knowledge items are active, governed knowledge records retrieved from the Knowledge Core and included by the Context Manager.

```ts
export interface ApprovedKnowledgeContextItem {
  knowledgeId: string;

  sourceId: string;

  domain:
    | "success"
    | "training"
    | "relationship"
    | "performance"
    | "organizational"
    | "governance"
    | "system";

  language: LanguageCode;

  title: string;

  summary: string;

  excerpt?: string;

  tags: string[];

  version: number;

  status: "active";

  governanceStatus: "approved" | "not_required";

  lifecycleStatus: "active";

  retrieval: KnowledgeRetrievalMetadata;

  sourceTraceability: SourceTraceability;

  usageInstruction?: string;
}
```

```ts
export interface KnowledgeRetrievalMetadata {
  score: number;

  reasonCodes: RetrievalReasonCode[];

  retrievedFrom: RetrievalMethod[];

  retrievedAt: string;

  rank?: number;
}
```

```ts
export type RetrievalMethod = "mongo" | "chroma" | "neo4j" | "graphrag";
```

```ts
export interface SourceTraceability {
  sourceType: string;
  sourceId: string;
  capturedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
}
```

### 19.1 Approved Knowledge Requirements

Every approved knowledge item must:

- Have a `knowledgeId`.
- Have a `sourceId`.
- Be active.
- Be approved or not require governance approval.
- Include domain.
- Include language.
- Include retrieval reason codes.
- Include retrieval method.
- Preserve source traceability.

### 19.2 Approved Knowledge Prohibitions

Approved knowledge items must not include:

- Candidate knowledge
- Rejected knowledge
- Archived knowledge
- Superseded knowledge unless explicitly allowed for historical context
- Private journal content
- Unapproved translations
- Knowledge without source traceability

---

## 20. Retrieval Reason Codes

```ts
export type RetrievalReasonCode =
  | "same_agent_domain"
  | "same_language"
  | "active_interview_template"
  | "related_to_current_state"
  | "ba_owned_private_context"
  | "relationship_context_match"
  | "journal_instruction_required"
  | "outcome_validated"
  | "graph_neighbor"
  | "semantic_match"
  | "fallback_general_training"
  | "guided_action_relevant"
  | "recent_session_context"
  | "compliance_boundary_required"
  | "language_fallback_used"
  | "agent_identity_required"
  | "runtime_rule_required"
  | "template_state_required";
```

Every included item must include at least one reason code.

---

## 21. Private Context Section

Private context contains Brand Ambassador-owned context that is not organizational knowledge.

```ts
export interface PrivateContextSection {
  included: boolean;

  visibility: "private_to_ba";

  reason?: string;

  items: PrivateContextItem[];

  access: PrivateContextAccess;
}
```

```ts
export interface PrivateContextAccess {
  baOwned: true;
  authorizedForSession: boolean;
  explicitRequest: boolean;
  includedByTaskRelevance: boolean;
}
```

```ts
export interface PrivateContextItem {
  privateContextId: string;

  type:
    | "ba_profile"
    | "success_profile"
    | "training_profile"
    | "session_summary"
    | "guided_action_history"
    | "personal_goal"
    | "momentum_signal"
    | "support_need";

  title?: string;

  summary: string;

  excerpt?: string;

  sourceId?: string;

  language: LanguageCode;

  reasonCodes: RetrievalReasonCode[];

  sensitivity: "low" | "medium" | "high";
}
```

### 21.1 Private Context Requirements

Private context must:

- Be separated from approved knowledge.
- Be BA-owned.
- Be authorized for the session.
- Be marked as private.
- Include reason codes.
- Be audited when included.

### 21.2 Private Context Prohibitions

Private context must not:

- Be treated as organizational knowledge.
- Be exposed to another BA.
- Be sent to external runtime.
- Be used as approved knowledge.
- Be included without authorization.

---

## 22. Journal Context Section

Journal context contains Momentum Journal-related information.

Momentum Journal is private by default.

```ts
export interface JournalContextSection {
  included: boolean;

  journalEnabled: boolean;

  privateByDefault: true;

  items: JournalContextItem[];

  allowedActions: JournalAllowedAction[];

  journalInstructions: JournalInstruction[];

  access: JournalAccessContext;
}
```

```ts
export type JournalAllowedAction =
  | "create_entry"
  | "update_entry"
  | "select_for_review";
```

```ts
export interface JournalAccessContext {
  baOwned: true;
  canUsePrivateJournal: boolean;
  canSelectJournalForReview: boolean;
  explicitRequest: boolean;
}
```

```ts
export interface JournalInstruction {
  instructionId: string;
  instruction: string;
  appliesTo: "all_agents" | "michael_magnificent" | "steve_success" | "ivory";
}
```

```ts
export interface JournalContextItem {
  journalEntryId: string;

  baId: string;

  title?: string;

  summary: string;

  excerpt?: string;

  language: LanguageCode;

  createdAt?: string;

  tags?: string[];

  promotionStatus:
    | "not_selected"
    | "selected_for_review"
    | "promotion_candidate_created"
    | "under_review"
    | "approved"
    | "rejected"
    | "withdrawn";

  visibility: "private_to_ba";

  reasonCodes: RetrievalReasonCode[];
}
```

### 22.1 Required Journal Rules

Every packet must preserve the following journal rules:

```text
Momentum Journal is private by default.

Journal entries belong to the Brand Ambassador.

Journal entries are not organizational knowledge.

Journal entries become candidates only when selected for review through an authorized workflow.

Michael teaches Brand Ambassadors how to use the Momentum Journal.

Agents may not promote journal content without Brand Ambassador action.
```

### 22.2 Journal Context Prohibitions

Journal context must not:

- Appear inside `approvedKnowledge`.
- Be sent to external runtime.
- Be included for another Brand Ambassador.
- Be treated as active organizational guidance.
- Be promoted automatically.

---

## 23. Relationship Context Section

Relationship context contains Brand Ambassador-owned person-sensitive context.

```ts
export interface RelationshipContextSection {
  included: boolean;

  items: RelationshipContextItem[];

  access: RelationshipContextAccess;

  sensitivitySummary?: string;
}
```

```ts
export interface RelationshipContextAccess {
  baOwned: true;
  authorizedForAgent: boolean;
  prospectScoped: boolean;
  prospectId?: string;
  includedByTaskRelevance: boolean;
}
```

```ts
export interface RelationshipContextItem {
  relationshipContextId: string;

  prospectId?: string;

  personDisplayName?: string;

  relationshipToBA?: string;

  whyNow?: string;

  tonePreference?: string;

  channelPreference?: "phone" | "text" | "in_person" | "email" | "unknown";

  relationshipStage?:
    | "new_contact"
    | "known_relationship"
    | "invited"
    | "presentation_shared"
    | "follow_up_needed"
    | "not_interested"
    | "unknown";

  source:
    | "ba_input"
    | "ivory_session"
    | "crm_record"
    | "journal_entry"
    | "pmv_activity"
    | "sms_activity"
    | "ringless_voicemail_activity"
    | "callback_activity";

  privacy: "ba_owned";

  sensitivity: "low" | "medium" | "high";

  summary?: string;

  relevantFacts?: string[];

  reasonCodes: RetrievalReasonCode[];
}
```

### 23.1 Relationship Context Requirements

Relationship context must:

- Be BA-owned.
- Be person-sensitive.
- Be scoped to the task.
- Be minimized when possible.
- Include source.
- Include privacy marker.
- Include reason codes.

### 23.2 Relationship Context Prohibitions

Relationship context must not:

- Be used outside authorized scope.
- Be exposed unnecessarily.
- Be treated as organizational knowledge.
- Be included when agent scope does not permit it.
- Be included for unrelated prospects.

---

## 24. Session History Section

Session history gives the agent recent conversation state.

```ts
export interface SessionHistorySection {
  included: boolean;

  summary?: string;

  recentTurns: SessionTurnContextItem[];

  maxTurnsIncluded: number;

  truncated: boolean;

  reason?: string;
}
```

```ts
export interface SessionTurnContextItem {
  turnId: string;

  sequence: number;

  speaker: "brand_ambassador" | "agent" | "system";

  agentKey?: AgentKey;

  mode: "browser_voice" | "browser_text" | "mixed";

  language: LanguageCode;

  text?: string;

  summary?: string;

  capturedAt: string;

  reasonCodes: RetrievalReasonCode[];
}
```

### 24.1 Session History Requirements

Session history must:

- Prefer summaries over full transcripts.
- Preserve current state.
- Preserve recent turns when needed.
- Avoid excessive transcript dumping.
- Respect privacy and context budget.

---

## 25. Guided Actions

Guided actions are Brand Ambassador-owned next steps or action history.

```ts
export interface GuidedActionContextItem {
  guidedActionId?: string;

  actionType:
    | "write_journal_entry"
    | "schedule_follow_up"
    | "review_training"
    | "draft_invitation"
    | "choose_next_prospect"
    | "capture_lesson"
    | "submit_candidate_for_review";

  title: string;

  description: string;

  owner: "ba";

  urgency: "low" | "normal" | "high";

  status?: "suggested" | "accepted" | "completed" | "missed" | "cancelled";

  dueAt?: string;

  sourceKnowledgeIds?: string[];

  sourceContextIds?: string[];

  reasonCodes?: RetrievalReasonCode[];
}
```

### 25.1 Guided Action Requirements

Guided actions must:

- Be owned by the Brand Ambassador.
- Be suggestions or history, not agent-owned commands.
- Preserve source knowledge IDs when applicable.
- Respect the BA-owned action rule.

### 25.2 Guided Action Rule

Agents guide.

Brand Ambassadors decide and act.

No Context Packet may imply that the agent owns or performs the Brand Ambassador's relationship action.

---

## 26. Exclusions

Exclusions identify context that was intentionally not included.

```ts
export interface ContextExclusion {
  exclusionId?: string;

  reason: ContextExclusionReason;

  sourceId?: string;

  itemId?: string;

  itemType?:
    | "knowledge_object"
    | "knowledge_candidate"
    | "journal_entry"
    | "relationship_context"
    | "session_history"
    | "template"
    | "guided_action"
    | "translation"
    | "private_context";

  note?: string;

  severity: "info" | "warning" | "critical";
}
```

```ts
export type ContextExclusionReason =
  | "private_journal_not_requested"
  | "candidate_not_approved"
  | "wrong_tenant"
  | "wrong_ba"
  | "superseded_knowledge"
  | "archived_knowledge"
  | "rejected_knowledge"
  | "language_mismatch"
  | "unapproved_translation"
  | "risk_flag_unresolved"
  | "context_budget_exceeded"
  | "permission_denied"
  | "relationship_context_out_of_scope"
  | "outside_agent_domain"
  | "outside_task_scope"
  | "missing_source_traceability"
  | "low_relevance_score";
```

### 26.1 Required Exclusions

The packet must record exclusions when:

- Candidate knowledge is excluded.
- Private journal content is not requested.
- Private journal ownership does not match.
- Relationship context is out of scope.
- Knowledge is superseded.
- Knowledge is archived.
- Knowledge is rejected.
- Language fallback is unavailable.
- Context budget is exceeded.
- Source traceability is missing.

### 26.2 Candidate Exclusion Rule

Candidate knowledge is excluded by default.

When candidates are excluded, the packet must include an exclusion record with:

```text
reason: candidate_not_approved
```

---

## 27. Retrieval Audit

The retrieval audit records how the packet was assembled.

```ts
export interface RetrievalAudit {
  retrievalId: string;

  requestId: string;

  packetId: string;

  requestedScopes: string[];

  includedKnowledgeIds: string[];

  includedPrivateContextIds: string[];

  includedJournalEntryIds: string[];

  includedRelationshipContextIds: string[];

  includedGuidedActionIds: string[];

  excludedSourceIds: string[];

  retrievalMethods: RetrievalMethod[];

  tokenEstimate: number;

  createdAt: string;

  languageFallbackUsed: boolean;

  candidateKnowledgeIncluded: boolean;

  candidateKnowledgeExcluded: boolean;

  privateJournalIncluded: boolean;

  degraded: boolean;

  includedItems: RetrievalAuditItem[];

  exclusions: ContextExclusion[];
}
```

```ts
export interface RetrievalAuditItem {
  itemId: string;

  itemType:
    | "approved_knowledge"
    | "private_context"
    | "journal_context"
    | "relationship_context"
    | "session_history"
    | "template"
    | "guided_action"
    | "runtime_rule"
    | "guardrail";

  sourceId?: string;

  reasonCodes: RetrievalReasonCode[];

  retrievalMethods?: RetrievalMethod[];

  score?: number;

  language: LanguageCode;

  includedAt: string;
}
```

### 27.1 Retrieval Audit Requirements

Every packet must include retrieval audit.

Retrieval audit must preserve:

- Retrieval ID
- Request ID
- Packet ID
- Requested scopes
- Included knowledge IDs
- Included private context IDs
- Excluded source IDs
- Retrieval methods
- Token estimate
- Created timestamp
- Language fallback status
- Candidate exclusion status
- Private journal inclusion status
- Degraded status
- Included item reason codes

---

## 28. Degraded Packet State

A degraded packet is created when some retrieval failed but safe guidance may still proceed.

```ts
export interface DegradedContextState {
  isDegraded: true;

  reason: DegradedContextReason;

  safeFallbackInstruction: string;

  missingSections: ContextPacketSectionName[];

  recoverySuggestion?: string;

  agentInstruction: string;
}
```

```ts
export type DegradedContextReason =
  | "knowledge_retrieval_failed"
  | "graph_unavailable"
  | "semantic_search_unavailable"
  | "template_missing"
  | "private_context_unavailable"
  | "relationship_context_unavailable"
  | "language_fallback_unavailable"
  | "context_budget_limited"
  | "unknown";
```

```ts
export type ContextPacketSectionName =
  | "tenant"
  | "ba"
  | "session"
  | "agent"
  | "language"
  | "runtimeRules"
  | "guardrails"
  | "activeTemplate"
  | "approvedKnowledge"
  | "privateContext"
  | "relationshipContext"
  | "journalContext"
  | "sessionHistory"
  | "guidedActions"
  | "exclusions"
  | "retrievalAudit";
```

### 28.1 Degraded Packet Requirements

A degraded packet must:

- Include mandatory runtime rules.
- Include guardrails.
- Preserve audit.
- Mark missing sections.
- Include safe fallback instruction.
- Instruct the agent to ask clarifying questions when needed.
- Not invent missing knowledge.

---

## 29. Failed Packet Requirements

A failed packet is used when the agent cannot safely proceed.

A failed packet must still include as much safe metadata as possible.

### 29.1 Failed Packet Rules

A failed packet must:

- Set `packetStatus` to `failed`.
- Include retrieval audit.
- Include safe fallback instruction in degraded state where possible.
- Include no unauthorized private context.
- Include no unapproved knowledge.
- Instruct Agent Runtime not to proceed with substantive guidance.

### 29.2 Failed Packet Validity

A failed packet may omit active template and approved knowledge if retrieval failed.

A failed packet must not omit schema version, packet ID, request ID, created timestamp, tenant, BA, session, agent, language, runtime rules, guardrails, exclusions, and retrieval audit unless the Context Manager cannot safely construct the packet at all.

---

## 30. Agent-Specific Packet Requirements

### 30.1 Steve Success Packet

Steve Success packets must include:

- Agent key: `steve_success`
- Display name: `Steve Success`
- Primary domain: `success`
- Success-focused role summary
- Success interview template when task requires it
- Approved Success Knowledge where available
- BA success profile where authorized
- Recent action or momentum context where relevant
- Journal prompt options when relevant
- Guardrails against unsupported claims
- Candidate exclusion
- Telnyx boundary

Steve packets may include cross-domain training or performance context when task-relevant.

Steve packets must not include unrestricted relationship context.

### 30.2 Michael Magnificent Packet

Michael Magnificent packets must include:

- Agent key: `michael_magnificent`
- Display name: `Michael Magnificent`
- Primary domain: `training`
- Training-focused role summary
- Training support or journal teaching template when task requires it
- Approved Training Knowledge where available
- Onboarding state where available
- Training profile where authorized
- Momentum Journal teaching rules
- Journal allowed actions
- Guardrails against promoting journal content without consent
- Candidate exclusion
- Telnyx boundary

Michael packets may include private journal context only when BA-owned and authorized.

### 30.3 Ivory Packet

Ivory packets must include:

- Agent key: `ivory`
- Display name: `Ivory`
- Primary domain: `relationship`
- Relationship-focused role summary
- Relationship coaching or invitation drafting template when task requires it
- Approved Relationship Knowledge where available
- BA-owned relationship context where authorized
- Invitation tone principles where available
- Editable draft guardrails
- Prospect context only when scoped
- Guardrails against overclaiming prospect interest
- Candidate exclusion
- Telnyx boundary

Ivory packets must preserve person-sensitive relationship boundaries.

---

## 31. Task-Specific Packet Requirements

### 31.1 Success Interview

Required sections:

- Agent
- Language
- Runtime rules
- Guardrails
- Active success interview template
- Approved Success Knowledge
- BA context
- Session history
- Retrieval audit

Optional sections:

- Private context
- Journal context
- Guided actions

Excluded by default:

- Candidate knowledge
- Relationship context unrelated to task

### 31.2 Training Support

Required sections:

- Agent
- Language
- Runtime rules
- Guardrails
- Training support template
- Approved Training Knowledge
- BA training profile when available
- Session history
- Retrieval audit

Optional sections:

- Journal context
- Private context
- Guided actions

### 31.3 Journal Teaching

Required sections:

- Michael agent context
- Journal privacy rule
- Journal allowed actions
- Journal teaching template
- Approved Training Knowledge
- Guardrails
- Retrieval audit

Private journal content requires BA ownership and authorization.

### 31.4 Relationship Coaching

Required sections:

- Ivory agent context
- Relationship coaching template
- Approved Relationship Knowledge
- Relationship context when scoped
- Guardrails
- Runtime rules
- Retrieval audit

### 31.5 Invitation Drafting

Required sections:

- Ivory agent context
- Invitation drafting template
- Editable draft guardrails
- Relationship context when scoped
- Approved Relationship Knowledge
- BA-owned action rule
- Retrieval audit

The packet must instruct Ivory that the invitation draft is editable and must preserve the Brand Ambassador's voice.

### 31.6 Session Resume

Required sections:

- Agent
- Session history
- Current state
- Active template when available
- Runtime rules
- Guardrails
- Retrieval audit

### 31.7 Guided Action Review

Required sections:

- Agent
- Guided action context
- Outcome-linked approved knowledge where available
- Performance context when available
- Runtime rules
- Guardrails
- Retrieval audit

---

## 32. Bilingual Packet Requirements

### 32.1 English Packets

English packets must use:

```ts
language.primary = "en";
```

English packets should prioritize:

- English approved knowledge
- English templates
- English guardrails
- English private context where available

Spanish content may be included only when relevant and marked.

### 32.2 Spanish Packets

Spanish packets must use:

```ts
language.primary = "es";
```

Spanish packets should prioritize:

- Spanish approved knowledge
- Spanish templates
- Spanish guardrails
- Spanish private context where available

English fallback content may be included only when:

- Fallback is allowed.
- Spanish approved equivalent is unavailable.
- Fallback is marked in language context.
- Retrieval audit marks fallback usage.

### 32.3 Machine Translation

Machine-translated content must be marked with:

```ts
translationStatus: "machine_translation_marked";
```

Machine translation must not be represented as human-reviewed or approved.

---

## 33. Privacy and Security Requirements

### 33.1 Private Journal Security

Private journal content must:

- Appear only in `journalContext` or `privateContext`.
- Never appear in `approvedKnowledge`.
- Be BA-owned.
- Be authorized.
- Be audited.
- Be excluded from external runtime.

### 33.2 Relationship Security

Relationship context must:

- Appear only in `relationshipContext`.
- Be BA-owned.
- Be task-scoped.
- Be minimized.
- Preserve sensitivity rating.
- Preserve source.
- Preserve privacy marker.

### 33.3 Candidate Security

Candidate knowledge must:

- Be excluded by default.
- Never appear in `approvedKnowledge`.
- Be included only in authorized review workflows.
- Be clearly marked if included in future review-specific packet versions.

Version 1.0 Brand Ambassador-facing packets exclude candidate knowledge.

### 33.4 Agent Boundary Security

The packet must not include:

- Database credentials
- Direct database query instructions
- Raw GraphRAG access
- Knowledge Core write permissions
- Knowledge Ingestion write permissions
- Unauthorized private content

### 33.5 Telnyx Boundary

Every packet must include the rule:

```text
Internal Browser Voice does not use Telnyx. Telnyx is limited to external runtime workflows: SMS, ringless voicemail, and future callback workflows.
```

---

## 34. Validation Rules

The implementation must validate Context Packets before delivery.

### 34.1 Required Field Validation

A packet is invalid if missing:

- `schemaVersion`
- `packetId`
- `requestId`
- `createdAt`
- `packetStatus`
- `tenant`
- `ba`
- `session`
- `agent`
- `language`
- `runtimeRules`
- `guardrails`
- `approvedKnowledge`
- `privateContext`
- `relationshipContext`
- `journalContext`
- `sessionHistory`
- `guidedActions`
- `exclusions`
- `retrievalAudit`

### 34.2 Schema Version Validation

A packet is invalid unless:

```ts
schemaVersion === "context_packet.v1";
```

### 34.3 Agent Validation

A packet is invalid if:

- `agent.agentKey` does not match `agent.displayName`.
- `agent.agentKey` does not match `agent.primaryDomain`.
- `activeTemplate.agentKey` exists and does not match `agent.agentKey`.

### 34.4 Template Validation

A packet is invalid if:

- Template agent does not match packet agent.
- Template language does not match interview template language.
- Template task type conflicts with session task type.
- Template states are empty when the task requires a template.

### 34.5 Knowledge Validation

A packet is invalid if `approvedKnowledge` includes:

- Candidate knowledge
- Rejected knowledge
- Archived knowledge
- Unapproved knowledge
- Private journal content
- Missing source traceability

### 34.6 Privacy Validation

A packet is invalid if:

- Private context belongs to a different BA.
- Journal context belongs to a different BA.
- Relationship context is not BA-owned.
- External runtime packet includes private journal context.

### 34.7 Runtime Rule Validation

A packet is invalid if missing:

- Telnyx boundary
- Journal privacy rule
- Candidate exclusion rule
- Agent database isolation rule
- BA-owned action rule
- Source traceability rule

### 34.8 Audit Validation

A packet is invalid if:

- Retrieval audit is missing.
- Included knowledge IDs do not match approved knowledge IDs.
- Candidate exclusion is not recorded when candidate knowledge was requested and excluded.
- Private journal inclusion is not audited when journal items are present.

---

## 35. Example Minimal Complete Packet Shape

This example shows the shape of a valid packet. It is not a production fixture.

```ts
const examplePacket: ContextPacketV1 = {
  schemaVersion: "context_packet.v1",
  packetId: "ctxpkt_123",
  requestId: "ctxreq_123",
  createdAt: "2026-01-01T00:00:00.000Z",
  packetStatus: "complete",

  tenant: {
    tenantId: "tenant_momentum",
    tenantName: "Momentum Creation System",
    brandName: "Momentum",
    environment: "development"
  },

  ba: {
    baId: "ba_123",
    preferredName: "Kevin",
    journalEnabled: true,
    languagePreference: "en",
    permissions: {
      canUsePrivateJournal: true,
      canSelectJournalForReview: true,
      canCreateKnowledgeCandidate: true,
      canAccessRelationshipContext: true,
      canUseBrowserVoice: true,
      canUseBrowserText: true
    }
  },

  session: {
    sessionId: "sess_123",
    mode: "browser_text",
    status: "active",
    taskType: "training_support",
    currentState: "answer_training_question"
  },

  agent: {
    agentKey: "michael_magnificent",
    displayName: "Michael Magnificent",
    primaryDomain: "training",
    roleSummary:
      "Training specialist responsible for onboarding, skill development, and Momentum Journal teaching.",
    allowedOutputs: [
      "teaching_explanation",
      "journal_prompt",
      "guided_action_suggestion",
      "clarifying_question"
    ],
    prohibitedOutputs: [
      "Do not present Knowledge Candidates as approved knowledge.",
      "Do not promote private journal content without Brand Ambassador selection.",
      "Do not query databases directly."
    ],
    agentRuntimeMode: "training_specialist",
    contextUsageInstruction:
      "Use only the context in this packet and the current user message."
  },

  language: {
    primary: "en",
    userPreference: "en",
    translationAllowed: true,
    interviewTemplateLanguage: "en",
    languageFallbackUsed: false,
    translationStatus: "same_language"
  },

  runtimeRules: [
    {
      ruleId: "runtime_telnyx_boundary",
      category: "runtime_transport",
      instruction:
        "Internal Browser Voice does not use Telnyx. Telnyx is limited to SMS, ringless voicemail, and future callback workflows.",
      required: true,
      appliesTo: "all_agents"
    }
  ],

  guardrails: [
    {
      guardrailId: "guardrail_no_invention",
      appliesTo: "all_agents",
      instruction:
        "Do not invent knowledge that is not present in the packet or current user message.",
      severity: "critical",
      category: "knowledge_integrity"
    }
  ],

  activeTemplate: undefined,

  approvedKnowledge: [],

  privateContext: {
    included: false,
    visibility: "private_to_ba",
    items: [],
    access: {
      baOwned: true,
      authorizedForSession: false,
      explicitRequest: false,
      includedByTaskRelevance: false
    }
  },

  relationshipContext: {
    included: false,
    items: [],
    access: {
      baOwned: true,
      authorizedForAgent: false,
      prospectScoped: false,
      includedByTaskRelevance: false
    }
  },

  journalContext: {
    included: true,
    journalEnabled: true,
    privateByDefault: true,
    items: [],
    allowedActions: ["create_entry", "select_for_review"],
    journalInstructions: [
      {
        instructionId: "journal_private_default",
        instruction:
          "Momentum Journal entries are private by default and may be selected for review only by the Brand Ambassador.",
        appliesTo: "all_agents"
      }
    ],
    access: {
      baOwned: true,
      canUsePrivateJournal: true,
      canSelectJournalForReview: true,
      explicitRequest: false
    }
  },

  sessionHistory: {
    included: false,
    recentTurns: [],
    maxTurnsIncluded: 0,
    truncated: false
  },

  guidedActions: [],

  exclusions: [
    {
      reason: "candidate_not_approved",
      note: "Knowledge Candidates are excluded from Brand Ambassador guidance by default.",
      severity: "info"
    }
  ],

  retrievalAudit: {
    retrievalId: "retr_123",
    requestId: "ctxreq_123",
    packetId: "ctxpkt_123",
    requestedScopes: ["agent_instructions", "approved_knowledge"],
    includedKnowledgeIds: [],
    includedPrivateContextIds: [],
    includedJournalEntryIds: [],
    includedRelationshipContextIds: [],
    includedGuidedActionIds: [],
    excludedSourceIds: [],
    retrievalMethods: [],
    tokenEstimate: 1200,
    createdAt: "2026-01-01T00:00:00.000Z",
    languageFallbackUsed: false,
    candidateKnowledgeIncluded: false,
    candidateKnowledgeExcluded: true,
    privateJournalIncluded: false,
    degraded: false,
    includedItems: [],
    exclusions: []
  }
};
```

---

## 36. TypeScript Export Contract

The implementation must export the schema types from the runtime package.

Recommended export path:

```text
/src/runtime/context-packet/ContextPacketV1.types.ts
```

Required exports:

```ts
export type {
  ContextPacketV1,
  ContextPacketStatus,
  TenantContext,
  BAContext,
  BAPermissions,
  SessionContext,
  ContextTaskType,
  AgentContext,
  AgentKey,
  AgentDisplayName,
  AgentPrimaryDomain,
  AgentAllowedOutput,
  LanguageContext,
  LanguageCode,
  RuntimeRule,
  Guardrail,
  InterviewTemplateContext,
  InterviewTemplateState,
  ApprovedKnowledgeContextItem,
  KnowledgeRetrievalMetadata,
  RetrievalMethod,
  SourceTraceability,
  RetrievalReasonCode,
  PrivateContextSection,
  PrivateContextItem,
  JournalContextSection,
  JournalContextItem,
  RelationshipContextSection,
  RelationshipContextItem,
  SessionHistorySection,
  SessionTurnContextItem,
  GuidedActionContextItem,
  ContextExclusion,
  ContextExclusionReason,
  RetrievalAudit,
  RetrievalAuditItem,
  DegradedContextState,
  DegradedContextReason,
  ContextPacketMetadata
};
```

---

## 37. Runtime Events Related to Packets

The packet schema must support audit records for these Context Manager events:

```text
context.packet.created
context.packet.delivered
context.packet.degraded
context.packet.failed
context.private_journal.included
context.relationship_context.included
context.candidate.excluded
context.language.fallback_used
context.audit.recorded
```

The packet itself does not emit events.

The Context Manager emits events.

The packet must contain enough information for those events to be meaningful and traceable.

---

## 38. Persistence Requirements

Context Packets must be persistable.

### 38.1 Packet Record Requirements

Persisted packet records must include:

- Packet ID
- Request ID
- Schema version
- Created timestamp
- Expiration timestamp when applicable
- Tenant ID
- Brand Ambassador ID
- Session ID
- Agent key
- Language
- Task type
- Packet status
- Approved knowledge IDs
- Private context IDs
- Journal entry IDs
- Relationship context IDs
- Guided action IDs
- Exclusion records
- Retrieval audit
- Degraded state when applicable

### 38.2 Packet Expiration

The Context Packet may include `expiresAt`.

When `expiresAt` is present, Agent Runtime must not use the packet after expiration.

The Context Manager must generate a new packet when context is expired.

---

## 39. Runtime Data Flow

### 39.1 Standard Packet Flow

```text
Agent Runtime requests context
  ↓
Context Manager retrieves and scores context
  ↓
Context Manager assembles context_packet.v1
  ↓
Context Manager validates packet
  ↓
Context Manager records packet and audit
  ↓
Context Manager delivers packet to Agent Runtime
  ↓
Agent Runtime executes agent turn using packet
```

### 39.2 Degraded Packet Flow

```text
Agent Runtime requests context
  ↓
Context Manager retrieval partially fails
  ↓
Mandatory runtime rules and guardrails are assembled
  ↓
Available safe context is included
  ↓
Missing sections are recorded
  ↓
context_packet.v1 is marked degraded
  ↓
Agent receives safe fallback instruction
```

### 39.3 Failed Packet Flow

```text
Agent Runtime requests context
  ↓
Context Manager cannot assemble safe required context
  ↓
context_packet.v1 is marked failed
  ↓
Agent Runtime must not proceed with substantive guidance
  ↓
Safe fallback instruction is returned
```

---

## 40. Relationship to Context Manager

The Context Manager is the only runtime component authorized to assemble `context_packet.v1`.

The Context Manager must:

- Retrieve context through Knowledge Core.
- Apply permissions.
- Apply budget.
- Apply language rules.
- Apply exclusions.
- Include runtime rules.
- Include guardrails.
- Assemble the packet.
- Validate the packet.
- Record the packet.
- Deliver the packet to Agent Runtime.

---

## 41. Relationship to Knowledge Core

The Context Packet may contain Knowledge Core records only after Context Manager selection.

Approved knowledge items in the packet must represent:

- Active Knowledge Objects
- Approved or approval-not-required governance status
- Valid source traceability
- Valid language state
- Valid permission scope

Knowledge Core candidates must not appear as approved knowledge.

---

## 42. Relationship to Knowledge Ingestion Protocol

The Knowledge Ingestion Protocol may create Knowledge Candidates, review-only indexes, journal entries, and source records.

The Context Packet must not treat ingestion candidates as approved knowledge.

Journal entries may appear only in private or journal sections when BA-owned and authorized.

Candidate exclusion must be recorded.

---

## 43. Relationship to Agent Runtime

Agent Runtime consumes the Context Packet.

Agent Runtime must:

- Use the packet as the source of truth.
- Enforce packet status.
- Respect guardrails.
- Respect runtime rules.
- Respect language context.
- Respect private context boundaries.
- Respect relationship context boundaries.
- Refuse to treat excluded content as included.
- Request a new packet when context expires.
- Avoid direct database retrieval.

---

## 44. Relationship to Learning Pipeline

The Learning Pipeline may use recorded Context Packets to evaluate:

- What knowledge was included.
- Which guidance was produced.
- Which guided action resulted.
- Which outcome occurred.
- Whether included knowledge was useful.
- Whether retrieval ranking should be adjusted.
- Whether knowledge should be flagged for review.

The packet's retrieval audit is part of the learning trace.

---

## 45. Relationship to Browser Voice Runtime

Browser Voice Runtime is internal.

Browser Voice Runtime receives agent behavior driven by Context Packets.

Browser Voice Runtime must not use Telnyx.

Context Packets for Browser Voice should be compact and action-oriented.

Browser Voice packets must still include:

- Runtime rules
- Guardrails
- Telnyx boundary
- Agent identity
- Language context
- Active template state
- Retrieval audit

---

## 46. Relationship to Browser Text Runtime

Browser Text Runtime is internal.

Browser Text Runtime receives agent behavior driven by Context Packets.

Browser Text packets may include richer text context than Browser Voice packets when the context budget permits.

Browser Text packets must still preserve all privacy, governance, and runtime boundaries.

---

## 47. Relationship to External Runtime

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

External runtime must not receive a full internal coaching Context Packet unless a ratified workflow explicitly defines a limited external packet.

External runtime must not receive:

- Private journal context
- Full internal session history
- Candidate knowledge
- Unrestricted approved organizational knowledge
- Sensitive relationship notes beyond approved communication scope

---

## 48. Testing Requirements

### 48.1 Schema Tests

Schema tests must prove:

- `schemaVersion` exists.
- `schemaVersion` equals `context_packet.v1`.
- Required top-level fields exist.
- Packet status is valid.
- Tenant section is valid.
- BA section is valid.
- Session section is valid.
- Agent section is valid.
- Language section is valid.
- Runtime rules are present.
- Guardrails are present.
- Retrieval audit is present.

### 48.2 Agent Mapping Tests

Agent mapping tests must prove:

- `steve_success` maps to `Steve Success` and `success`.
- `michael_magnificent` maps to `Michael Magnificent` and `training`.
- `ivory` maps to `Ivory` and `relationship`.
- Template agent key matches packet agent key.

### 48.3 Privacy Tests

Privacy tests must prove:

- Private context is separated from approved knowledge.
- Journal context is separated from approved knowledge.
- Journal context is private by default.
- Journal context belongs to packet BA.
- Relationship context is BA-owned.
- Candidate knowledge is excluded by default.

### 48.4 Knowledge Tests

Knowledge tests must prove:

- Approved knowledge has active status.
- Approved knowledge has source ID.
- Approved knowledge has retrieval reason codes.
- Approved knowledge has retrieval method.
- Candidate knowledge cannot appear in approved knowledge.
- Superseded knowledge is excluded.
- Archived knowledge is excluded.
- Rejected knowledge is excluded.

### 48.5 Bilingual Tests

Bilingual tests must prove:

- English packets can be represented.
- Spanish packets can be represented.
- Language fallback can be represented.
- Human-reviewed translation can be represented.
- Marked machine translation can be represented.
- Language fallback audit is represented.

### 48.6 Degraded Packet Tests

Degraded packet tests must prove:

- Degraded packets include degraded state.
- Degraded packets include safe fallback instruction.
- Degraded packets include missing sections.
- Degraded packets include retrieval audit.
- Degraded packets do not invent knowledge.

### 48.7 Runtime Boundary Tests

Runtime boundary tests must prove:

- Packet includes Telnyx boundary.
- Packet includes no internal Telnyx PSTN coaching instruction.
- Agents are instructed not to query databases directly.
- BA owns guided actions.
- External runtime does not receive private journal context.

---

## 49. Acceptance Criteria

The Context Packet Schema Runtime is complete only when all acceptance criteria are satisfied.

### 49.1 Schema Acceptance Criteria

- Schema version exists.
- Schema version is `context_packet.v1`.
- Top-level packet shape is implemented.
- Required sections are represented.
- Packet status is represented.
- Degraded packet state is represented.

### 49.2 Agent Acceptance Criteria

- Agent key and template key match.
- Agent key, display name, and primary domain match.
- Steve packets can be represented.
- Michael packets can be represented.
- Ivory packets can be represented.
- Agent allowed outputs are represented.
- Agent prohibited outputs are represented.

### 49.3 Knowledge Acceptance Criteria

- Approved knowledge section is represented.
- Approved knowledge requires active status.
- Source IDs are represented.
- Retrieval methods are represented.
- Retrieval reason codes are represented.
- Candidate knowledge is excluded by default.
- Candidate knowledge cannot appear as approved knowledge.

### 49.4 Privacy Acceptance Criteria

- Private context is separated from approved knowledge.
- Journal context is separated from approved knowledge.
- Momentum Journal is private by default.
- Private context is BA-owned.
- Relationship context is BA-owned.
- Relationship context is person-sensitive.
- External runtime boundaries are preserved.

### 49.5 Bilingual Acceptance Criteria

- English packets can be represented.
- Spanish packets can be represented.
- Language preference can be represented.
- Detected language can be represented.
- Fallback language can be represented.
- Translation status can be represented.
- Interview template language can be represented.

### 49.6 Audit Acceptance Criteria

- Packets include retrieval audit.
- Packets include exclusions.
- Included knowledge IDs are represented.
- Included private context IDs are represented.
- Excluded source IDs are represented.
- Retrieval methods are represented.
- Token estimate is represented.
- Candidate exclusion status is represented.
- Private journal inclusion status is represented.
- Language fallback status is represented.

### 49.7 Runtime Boundary Acceptance Criteria

- Runtime rules include Telnyx boundary.
- Runtime rules include Browser Voice internal boundary.
- Runtime rules include journal privacy.
- Runtime rules include candidate exclusion.
- Runtime rules include source traceability.
- Runtime rules include BA-owned action rule.
- Runtime rules include agent database isolation.

---

## 50. Required Invariants

The following invariants must always hold.

1. Every packet has `schemaVersion: "context_packet.v1"`.
2. Every packet has a packet ID.
3. Every packet has a request ID.
4. Every packet has a packet status.
5. Every packet has tenant context.
6. Every packet has Brand Ambassador context.
7. Every packet has session context.
8. Every packet has agent context.
9. Every packet has language context.
10. Every packet has runtime rules.
11. Every packet has guardrails.
12. Every packet has retrieval audit.
13. Agent key, display name, and primary domain must match.
14. Active template agent key must match packet agent key.
15. Approved knowledge must be active.
16. Candidate knowledge must not appear as approved knowledge.
17. Private journal content must not appear as approved knowledge.
18. Private journal content is private by default.
19. Private context must belong to the packet Brand Ambassador.
20. Relationship context must be BA-owned.
21. Guided actions are owned by the Brand Ambassador.
22. Telnyx is not used for internal Browser Voice.
23. Telnyx is limited to external SMS, ringless voicemail, and future callback workflows.
24. English and Spanish are supported.
25. Every included knowledge item has source traceability.
26. Every included item has reason codes.
27. Exclusions are recorded.
28. Degraded packets do not invent knowledge.
29. Failed packets do not proceed with substantive guidance.
30. Agents use Context Packets as their source of truth.

---

## 51. Implementation Structure for Codex

A recommended implementation layout is:

```text
/src/runtime/context-packet/
  index.ts

  types/
    ContextPacketV1.types.ts
    TenantContext.types.ts
    BAContext.types.ts
    SessionContext.types.ts
    AgentContext.types.ts
    LanguageContext.types.ts
    RuntimeRule.types.ts
    Guardrail.types.ts
    InterviewTemplateContext.types.ts
    ApprovedKnowledgeContext.types.ts
    PrivateContext.types.ts
    JournalContext.types.ts
    RelationshipContext.types.ts
    SessionHistory.types.ts
    GuidedActionContext.types.ts
    ContextExclusion.types.ts
    RetrievalAudit.types.ts
    DegradedContext.types.ts

  validation/
    validateContextPacketV1.ts
    validateAgentMapping.ts
    validateRuntimeRules.ts
    validatePrivacyBoundaries.ts
    validateApprovedKnowledge.ts
    validateTemplateMatch.ts
    validateRetrievalAudit.ts
    validateBilingualContext.ts

  factories/
    createBaseContextPacket.ts
    createDegradedContextPacket.ts
    createFailedContextPacket.ts

  constants/
    agentMappings.ts
    requiredRuntimeRules.ts
    universalGuardrails.ts
    languageConstants.ts
    templateStateKeys.ts

  tests/
    contextPacket.schema.test.ts
    contextPacket.agentMapping.test.ts
    contextPacket.privacy.test.ts
    contextPacket.bilingual.test.ts
    contextPacket.degraded.test.ts
```

This structure may be adapted if all schema requirements and acceptance criteria are satisfied.

---

## 52. Minimal Runtime Implementation Sequence

Codex should implement the Context Packet Schema in this order.

### Step 1: Core Types

Implement:

- `ContextPacketV1`
- `ContextPacketStatus`
- `TenantContext`
- `BAContext`
- `SessionContext`
- `AgentContext`
- `LanguageContext`

### Step 2: Runtime Rules and Guardrails

Implement:

- `RuntimeRule`
- `Guardrail`
- Required runtime rule constants
- Universal guardrail constants

### Step 3: Template Types

Implement:

- `InterviewTemplateContext`
- `InterviewTemplateState`
- Steve state keys
- Michael state keys
- Ivory state keys

### Step 4: Context Sections

Implement:

- Approved knowledge
- Private context
- Journal context
- Relationship context
- Session history
- Guided actions

### Step 5: Audit and Exclusions

Implement:

- Context exclusions
- Retrieval audit
- Retrieval audit item

### Step 6: Degraded and Failed Packet Support

Implement:

- Degraded state
- Degraded reasons
- Failed packet validation

### Step 7: Validation

Implement validators for:

- Required fields
- Agent mapping
- Template match
- Approved knowledge
- Privacy boundaries
- Runtime rules
- Retrieval audit
- Bilingual context

### Step 8: Tests

Implement schema, privacy, bilingual, boundary, and degraded packet tests.

---

## 53. Completion Definition

The Context Packet Schema Runtime is considered Version 1.0 complete when:

- All required TypeScript types exist.
- `context_packet.v1` is enforced.
- Required packet sections are implemented.
- Agent mapping is validated.
- Active template matching is validated.
- Runtime rules are required.
- Guardrails are required.
- Approved knowledge structure is implemented.
- Private context structure is implemented.
- Journal context structure is implemented.
- Relationship context structure is implemented.
- Session history structure is implemented.
- Guided action structure is implemented.
- Exclusions are implemented.
- Retrieval audit is implemented.
- Degraded packet state is implemented.
- English and Spanish are represented.
- Candidate exclusion is represented.
- Journal privacy is represented.
- Telnyx boundary is represented.
- Tests pass.

---

## 54. Final Runtime Statement

The Context Packet is the delivery container for runtime intelligence.

It is how Momentum gives agents memory without giving them uncontrolled access.

It is how Momentum gives Steve, Michael, and Ivory the right knowledge without allowing them to search everything.

It is how Momentum protects Brand Ambassador privacy.

It is how Momentum keeps the Momentum Journal private.

It is how Momentum keeps relationship context person-sensitive.

It is how Momentum prevents candidate knowledge from becoming unapproved guidance.

It is how Momentum supports English and Spanish operation.

It is how Momentum separates internal Browser Voice from external Telnyx workflows.

It is how Momentum preserves auditability from knowledge retrieval to agent guidance to outcome learning.

The Knowledge Core knows.

The Context Manager selects.

The Context Packet carries.

The Agent Runtime acts from the packet.

The Brand Ambassador decides and acts.

The Learning Pipeline evaluates the outcome.

The organization learns.
