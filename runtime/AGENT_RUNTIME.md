# AGENT_RUNTIME.md

## Momentum Creation System V2

### Agent Runtime Specification

#### Version 1.0

---

## 1. Document Status

**Document Name:** Agent Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Upstream Dependencies:** Knowledge Core, Knowledge Ingestion Protocol, Context Manager, Context Packet Schema
**Primary Downstream Consumers:** Browser Voice Runtime, Browser Text Runtime, Guided Action Runtime, Learning Pipeline, Agent Events
**Primary Agents:** Steve Success, Michael Magnificent, Ivory
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

**Operational Playbook:** `../AI_AGENT_PLAYBOOK.md` routes implementation work to this runtime spec and the prompt/agent governance documents. The playbook is subordinate to this ratified runtime source.

---

## 2. Purpose

The Agent Runtime defines how Momentum agents operate inside Momentum Creation System V2.

The Agent Runtime is responsible for creating, managing, executing, validating, and completing agent sessions for:

- Steve Success
- Michael Magnificent
- Ivory

The Agent Runtime receives input from Browser Voice and Browser Text, requests Context Packets from the Context Manager, executes agent templates, advances session state, captures Brand Ambassador responses, creates journal prompts, prepares editable outputs, proposes Knowledge Candidates, creates Guided Actions, emits Agent Events, and completes sessions.

The Agent Runtime answers this runtime question:

> How do Momentum agents operate safely, consistently, bilingually, and contextually inside a session?

The Agent Runtime does not own knowledge.

The Agent Runtime does not approve knowledge.

The Agent Runtime does not directly query databases.

The Agent Runtime does not bypass the Context Manager.

The Agent Runtime does not auto-send prospect outreach.

The Agent Runtime does not use Telnyx for internal coaching.

The Agent Runtime uses Context Packets as its source of truth.

---

## 3. Runtime Philosophy

Momentum agents are specialists.

They are not autonomous general-purpose systems.

They do not become intelligent by independently remembering everything.

They guide Brand Ambassadors using governed context from the Context Manager.

The runtime philosophy is:

```text
Knowledge Core stores what Momentum knows.

Context Manager selects what the agent needs right now.

Context Packet carries contextual intelligence.

Agent Runtime applies the packet through agent-specific templates.

Agents guide Brand Ambassadors.

Brand Ambassadors decide and act.

Outcomes teach Momentum.

Learning improves the Knowledge Core.
```

The Agent Runtime must preserve this separation.

Agents guide.

Brand Ambassadors act.

Knowledge evolves through governed runtime pathways.

---

## 4. Foundational Principle

The Agent Runtime must enforce the following principle:

```text
Agents do not retrieve knowledge.

Agents receive Context Packets.

Agents do not own actions.

Brand Ambassadors own actions.

Agents do not approve knowledge.

Governance approves knowledge.
```

This principle protects:

- Knowledge integrity
- Brand Ambassador agency
- Momentum Journal privacy
- Prospect relationship sensitivity
- Organizational governance
- Agent specialization
- Runtime predictability
- Bilingual consistency
- Source traceability
- Internal/external runtime boundaries

---

## 5. Runtime Position

The Agent Runtime sits after the Context Packet and before Guided Action, Outcome, and Learning.

```text
Browser Voice / Browser Text
  ↓
Agent Runtime Session
  ↓
Context Manager Request
  ↓
Context Packet
  ↓
Agent Template Execution
  ↓
Agent Turn Response
  ↓
Captured Turn / Journal Entry / Guided Action / Candidate Proposal
  ↓
Agent Events
  ↓
Outcome
  ↓
Learning Pipeline
  ↓
Knowledge Core Evolution
```

The Agent Runtime is downstream of:

- Knowledge Core
- Knowledge Ingestion Protocol
- Context Manager
- Context Packet Schema
- Agent templates
- Runtime guardrails
- Governance rules

The Agent Runtime is upstream of:

- Browser Voice output
- Browser Text output
- Guided Action Runtime
- Knowledge Ingestion
- Agent Events
- Learning Pipeline
- Outcome capture

---

## 6. Scope

This document defines the Version 1.0 runtime specification for Agent Runtime.

It defines:

- Agent registry
- Agent identities
- Agent responsibilities
- Agent non-responsibilities
- Runtime loop
- Session model
- Turn model
- Context Packet usage
- Shared runtime tools
- Ivory-specific tools
- Interview template structure
- Agent state machines
- Bilingual templates
- Agent response contract
- Output guardrails
- Journal creation rules
- Knowledge Candidate proposal rules
- Guided Action creation rules
- Invitation draft rules
- Event requirements
- API contracts
- Data flow
- Runtime flow
- Failure behavior
- Security and privacy boundaries
- Acceptance criteria
- Implementation file structure
- Testing requirements
- Relationship to other runtime components

This document does not define the detailed Context Packet schema.

That is defined in `CONTEXT_PACKET_SCHEMA.md`.

This document does not define Knowledge Core persistence.

That is defined in `KNOWLEDGE_CORE_RUNTIME.md`.

This document does not define Knowledge Ingestion.

That is defined in `KNOWLEDGE_INGESTION_PROTOCOL.md`.

This document does not define Context Manager retrieval logic.

That is defined in `CONTEXT_MANAGER.md`.

This document does not define external Telnyx workflows.

External runtime behavior belongs in external runtime implementation documents.

---

## 7. Agent Registry

The Agent Runtime must maintain a registry of all runtime agents.

### 7.1 Required Agents

| Agent Key             | Display Name        | Primary Domain | Runtime Role                                                                 |
| --------------------- | ------------------- | -------------- | ---------------------------------------------------------------------------- |
| `steve_success`       | Steve Success       | `success`      | Success interview, lesson capture, momentum reflection, next action guidance |
| `michael_magnificent` | Michael Magnificent | `training`     | Training support, onboarding, system guidance, Momentum Journal teaching     |
| `ivory`               | Ivory               | `relationship` | Relationship coaching, Opportunity Map support, editable invitation drafts   |

### 7.2 Agent Registry Type

```ts
export type AgentKey = "steve_success" | "michael_magnificent" | "ivory";

export type AgentDisplayName =
  | "Steve Success"
  | "Michael Magnificent"
  | "Ivory";

export type AgentDomain = "success" | "training" | "relationship";

export interface AgentRegistryEntry {
  agentKey: AgentKey;
  displayName: AgentDisplayName;
  primaryDomain: AgentDomain;
  roleSummary: string;
  supportedLanguages: RuntimeLanguage[];
  supportedModes: AgentRuntimeMode[];
  defaultTemplateIds: {
    en: string;
    es: string;
  };
  allowedTools: RuntimeToolKey[];
  prohibitedBehaviors: string[];
  active: boolean;
}
```

### 7.3 Required Registry Entries

```ts
export const AGENT_REGISTRY: Record<AgentKey, AgentRegistryEntry> = {
  steve_success: {
    agentKey: "steve_success",
    displayName: "Steve Success",
    primaryDomain: "success",
    roleSummary:
      "Success specialist responsible for helping the Brand Ambassador capture wins, obstacles, lessons, momentum signals, and next actions.",
    supportedLanguages: ["en", "es"],
    supportedModes: ["browser_voice", "browser_text", "mixed"],
    defaultTemplateIds: {
      en: "steve_success_template_en_v1",
      es: "steve_success_template_es_v1"
    },
    allowedTools: [
      "build_context_packet",
      "append_conversation_turn",
      "create_journal_entry",
      "create_knowledge_candidate",
      "create_guided_action",
      "emit_agent_event",
      "complete_session"
    ],
    prohibitedBehaviors: [
      "Do not approve knowledge.",
      "Do not auto-send outreach.",
      "Do not use Telnyx PSTN for internal coaching.",
      "Do not bypass the Context Manager.",
      "Do not query databases directly."
    ],
    active: true
  },

  michael_magnificent: {
    agentKey: "michael_magnificent",
    displayName: "Michael Magnificent",
    primaryDomain: "training",
    roleSummary:
      "Training specialist responsible for onboarding support, system guidance, skill development, duplication support, and Momentum Journal teaching.",
    supportedLanguages: ["en", "es"],
    supportedModes: ["browser_voice", "browser_text", "mixed"],
    defaultTemplateIds: {
      en: "michael_magnificent_template_en_v1",
      es: "michael_magnificent_template_es_v1"
    },
    allowedTools: [
      "build_context_packet",
      "append_conversation_turn",
      "create_journal_entry",
      "create_knowledge_candidate",
      "create_guided_action",
      "emit_agent_event",
      "complete_session"
    ],
    prohibitedBehaviors: [
      "Do not approve knowledge.",
      "Do not promote private journal content without Brand Ambassador selection.",
      "Do not use Telnyx PSTN for internal coaching.",
      "Do not bypass the Context Manager.",
      "Do not query databases directly."
    ],
    active: true
  },

  ivory: {
    agentKey: "ivory",
    displayName: "Ivory",
    primaryDomain: "relationship",
    roleSummary:
      "Relationship specialist responsible for Opportunity Map support, respectful invitation coaching, tone guidance, follow-up thinking, and editable invitation drafts.",
    supportedLanguages: ["en", "es"],
    supportedModes: ["browser_voice", "browser_text", "mixed"],
    defaultTemplateIds: {
      en: "ivory_template_en_v1",
      es: "ivory_template_es_v1"
    },
    allowedTools: [
      "build_context_packet",
      "append_conversation_turn",
      "create_journal_entry",
      "create_knowledge_candidate",
      "create_guided_action",
      "emit_agent_event",
      "complete_session",
      "create_relationship_context",
      "prepare_editable_invitation_draft",
      "mint_invitation_link_if_approved_by_ba"
    ],
    prohibitedBehaviors: [
      "Do not approve knowledge.",
      "Do not auto-send prospect outreach.",
      "Do not pressure prospects.",
      "Do not overstate prospect interest.",
      "Do not use Telnyx PSTN for internal coaching.",
      "Do not bypass the Context Manager.",
      "Do not query databases directly."
    ],
    active: true
  }
};
```

---

## 8. Runtime Languages

The Agent Runtime must support English and Spanish.

```ts
export type RuntimeLanguage = "en" | "es";
```

### 8.1 Language Rules

Agents must:

- Respond in the packet's primary language.
- Use bilingual templates.
- Respect language fallback metadata.
- Avoid presenting machine translation as human-reviewed wording.
- Ask a clarifying question if language ambiguity prevents safe guidance.
- Preserve Spanish and English input for ingestion.

### 8.2 Required Language Support

Each agent must have:

- English template
- Spanish template
- English starter prompts
- Spanish starter prompts
- English output guardrails
- Spanish output guardrails where surfaced to the Brand Ambassador

---

## 9. Runtime Modes

```ts
export type AgentRuntimeMode = "browser_voice" | "browser_text" | "mixed";
```

### 9.1 Browser Voice

Browser Voice is internal.

Browser Voice uses browser-based voice input/output or browser-supported voice interfaces.

Browser Voice does not use Telnyx.

Browser Voice sessions should produce concise agent responses that are easy to speak aloud.

### 9.2 Browser Text

Browser Text is internal.

Browser Text uses typed interaction.

Browser Text sessions may include richer formatting than Browser Voice sessions.

### 9.3 Mixed Mode

Mixed mode supports sessions that may switch between browser voice and browser text.

Mixed mode must preserve session continuity and language consistency.

### 9.4 Telnyx Boundary

The Agent Runtime must never use Telnyx PSTN for internal coaching.

Telnyx is reserved for external runtime workflows only:

- SMS
- Ringless voicemail
- Future callback workflows

---

## 10. Non-Negotiable Runtime Rules

The Agent Runtime must enforce these rules in every session.

```text
Agents do not own knowledge.

Agents do not approve knowledge.

Agents do not activate knowledge.

Agents do not auto-send prospect outreach.

Agents do not use Telnyx PSTN for internal coaching.

Agents do not bypass the Context Manager.

Agents do not query MongoDB directly.

Agents do not query Neo4j directly.

Agents do not query Chroma directly.

Agents do not perform their own GraphRAG retrieval.

Agents do not write directly to Chroma or Neo4j.

Agents use service layers only.

Agents support English and Spanish.

Agents treat Momentum Journal as private by default.

Agents may propose Knowledge Candidates but cannot approve them.

Agents may create Guided Actions, but Brand Ambassadors own the actions.

Ivory may prepare editable invitation drafts but may not send them automatically.

Michael teaches the Momentum Journal privacy and promotion pathway.

Steve captures success lessons and next actions without treating personal lessons as universal truth.
```

---

## 11. Agent Runtime Responsibilities

The Agent Runtime is responsible for:

- Creating agent sessions
- Loading the correct agent registry entry
- Loading the correct bilingual template
- Requesting Context Packets
- Validating Context Packets
- Applying agent state machines
- Receiving Browser Voice or Browser Text input
- Capturing conversation turns
- Advancing template state
- Creating journal entries when requested
- Creating Knowledge Candidate proposals when permitted
- Creating Guided Action suggestions
- Creating editable invitation drafts for Ivory
- Preventing auto-send behavior
- Emitting Agent Events
- Returning structured agent responses
- Completing sessions
- Handling degraded Context Packets safely
- Supporting English and Spanish operation
- Enforcing output guardrails

---

## 12. Agent Runtime Non-Responsibilities

The Agent Runtime is not responsible for:

- Knowledge storage
- Knowledge approval
- Knowledge activation
- Knowledge governance
- Direct database retrieval
- Direct vector indexing
- Direct graph writes
- Context assembly
- Raw audio telephony
- Telnyx internal coaching
- External SMS sending
- Ringless voicemail sending
- Future callback execution
- Prospect outreach automation without BA approval
- Replacing Brand Ambassador decision-making
- Replacing the Learning Pipeline

---

## 13. Runtime Loop

The standard Agent Runtime loop is:

```text
Brand Ambassador opens session
  ↓
Browser Runtime starts voice or text interaction
  ↓
Agent Runtime creates session
  ↓
Agent Runtime requests Context Packet
  ↓
Context Manager builds packet
  ↓
Agent Runtime validates packet
  ↓
Agent asks template-guided question
  ↓
Brand Ambassador responds
  ↓
Turn is captured
  ↓
Knowledge Ingestion receives turn
  ↓
Agent Runtime advances state
  ↓
Journal entry / candidate / guided action / draft may be created
  ↓
Agent returns next response
  ↓
Session continues, pauses, or completes
```

This loop must remain consistent across Steve, Michael, and Ivory.

---

## 14. Session Lifecycle

### 14.1 Session Statuses

```ts
export type AgentSessionStatus =
  | "created"
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
```

### 14.2 Session Lifecycle Flow

```text
created
  ↓
active
  ↓
paused OR completed OR failed OR cancelled
```

A paused session may resume as active.

A completed session is final.

A failed session requires error metadata.

A cancelled session is intentionally stopped.

### 14.3 Agent Runtime Session State

```ts
export interface AgentRuntimeSessionState {
  sessionId: string;
  tenantId: string;

  teamMagnificentId: string;
  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId: string;

  agentKey: AgentKey;

  language: RuntimeLanguage;

  mode: AgentRuntimeMode;

  status: AgentSessionStatus;

  currentTemplateId: string;

  currentStateKey: string;

  capturedFields: Record<string, unknown>;

  contextPacketId?: string;

  contextPacketStatus?: "complete" | "degraded" | "failed";

  turnCount: number;

  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  lastUserInputAt?: Date;
  lastAgentResponseAt?: Date;

  metadata?: Record<string, unknown>;
}
```

### 14.4 Session Creation Requirements

When a session is created, the Agent Runtime must:

- Validate tenant ID.
- Validate Brand Ambassador ID.
- Validate agent key.
- Validate language.
- Validate mode.
- Load agent registry entry.
- Load correct template.
- Initialize current state.
- Request initial Context Packet.
- Store session state.
- Emit `agent.session.created`.

### 14.5 Session Completion Requirements

When a session completes, the Agent Runtime must:

- Capture final state.
- Create session summary.
- Emit completion event.
- Send relevant session content to Knowledge Ingestion.
- Preserve Context Packet reference.
- Preserve created artifact references.
- Mark session as completed.
- Return final response.

---

## 15. Conversation Turn Model

Every user and agent turn must be captured.

```ts
export interface AgentConversationTurn {
  turnId: string;
  sessionId: string;
  tenantId: string;
  baId: string;

  agentKey: AgentKey;

  speaker: "brand_ambassador" | "agent" | "system";

  mode: AgentRuntimeMode;

  language: RuntimeLanguage;

  sequence: number;

  stateKey: string;

  text: string;

  transcriptMetadata?: BrowserTranscriptMetadata;

  contextPacketId?: string;

  createdAt: Date;

  metadata?: Record<string, unknown>;
}
```

```ts
export interface BrowserTranscriptMetadata {
  confidence?: number;
  isFinal?: boolean;
  segmentSequence?: number;
  detectedLanguage?: RuntimeLanguage;

  // Browser Voice fields (optional; see BROWSER_VOICE_RUNTIME.md §16.3)
  transcriptTurnId?: string;
  browserLocale?: string;
  transcriptHash?: string;
  corrected?: boolean;
}
```

### 15.1 Turn Capture Requirements

Every turn must preserve:

- Session ID
- Agent key
- Speaker
- Sequence
- State key
- Text
- Language
- Mode
- Timestamp
- Context Packet ID when available

Browser Voice turns must preserve transcript metadata.

Version 1.0 stores transcript text, not raw audio.

---

## 16. Context Packet Usage

The Agent Runtime must request a Context Packet from the Context Manager.

Agents must operate from the packet.

### 16.1 Context Packet Request Timing

The Agent Runtime must request a Context Packet:

- At session start
- At session resume
- When task type changes
- When current state changes materially
- When session context expires
- Before creating a Knowledge Candidate
- Before creating a guided action from knowledge
- Before generating an invitation draft
- After degraded retrieval recovery
- When language changes

### 16.2 Context Packet Validation

Before using a packet, Agent Runtime must validate:

- Schema version is `context_packet.v1`.
- Packet agent matches session agent.
- Packet BA matches session BA.
- Packet language matches session language or valid fallback.
- Packet includes runtime rules.
- Packet includes guardrails.
- Packet includes Telnyx boundary.
- Packet includes retrieval audit.
- Packet status is not failed.
- Active template matches agent and task where required.

### 16.3 Failed Packet Rule

If Context Packet status is `failed`, the Agent Runtime must not proceed with substantive guidance.

It must return a safe response asking the Brand Ambassador to try again or clarify, depending on failure instruction.

### 16.4 Degraded Packet Rule

If Context Packet status is `degraded`, the Agent Runtime may proceed only if the packet includes safe fallback instructions.

The agent must not invent missing knowledge.

The agent should ask clarifying questions when required.

---

## 17. Shared Runtime Tools

Agents may use shared tools only through service layers.

```ts
export interface RuntimeAgentTools {
  buildContextPacket(input: ContextRequest): Promise<ContextPacketV1>;

  appendConversationTurn(input: AppendConversationTurnInput): Promise<void>;

  createJournalEntry(
    input: CreateJournalEntryInput
  ): Promise<MomentumJournalEntry>;

  createKnowledgeCandidate(
    input: CreateKnowledgeCandidateInput
  ): Promise<KnowledgeCandidate>;

  createGuidedAction(input: CreateGuidedActionInput): Promise<GuidedAction>;

  emitAgentEvent(input: AgentEventInput): Promise<void>;

  completeSession(input: CompleteSessionInput): Promise<AgentSession>;
}
```

### 17.1 Runtime Tool Keys

```ts
export type RuntimeToolKey =
  | "build_context_packet"
  | "append_conversation_turn"
  | "create_journal_entry"
  | "create_knowledge_candidate"
  | "create_guided_action"
  | "emit_agent_event"
  | "complete_session"
  | "create_relationship_context"
  | "prepare_editable_invitation_draft"
  | "mint_invitation_link_if_approved_by_ba";
```

### 17.2 Tool Boundary Rules

Agents may not:

- Write directly to MongoDB.
- Write directly to Neo4j.
- Write directly to Chroma.
- Write directly to GraphRAG.
- Create active organizational knowledge.
- Approve Knowledge Candidates.
- Send SMS directly.
- Send voicemail directly.
- Perform callback workflows directly.

All operations must go through approved runtime services.

---

## 18. Shared Tool Input Models

### 18.1 Append Conversation Turn

```ts
export interface AppendConversationTurnInput {
  sessionId: string;
  tenantId: string;
  baId: string;
  agentKey: AgentKey;
  speaker: "brand_ambassador" | "agent" | "system";
  mode: AgentRuntimeMode;
  language: RuntimeLanguage;
  stateKey: string;
  text: string;
  contextPacketId?: string;
  transcriptMetadata?: BrowserTranscriptMetadata;
  metadata?: Record<string, unknown>;
}
```

### 18.2 Create Journal Entry

```ts
export interface CreateJournalEntryInput {
  tenantId: string;
  baId: string;
  sessionId: string;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  inputMode: "voice" | "text";
  text: string;
  promptId?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}
```

### 18.3 Create Knowledge Candidate

```ts
export interface CreateKnowledgeCandidateInput {
  tenantId: string;
  baId?: string;
  sessionId: string;
  agentKey: AgentKey;
  language: RuntimeLanguage;

  title: string;
  summary: string;
  content: string;

  domain:
    | "success"
    | "training"
    | "relationship"
    | "performance"
    | "organizational";

  sourceTurnIds: string[];

  candidateType:
    | "success_pattern"
    | "training_clarification"
    | "relationship_guidance"
    | "performance_pattern"
    | "journal_promotion"
    | "faq_candidate"
    | "script_template_candidate"
    | "workflow_improvement_candidate";

  visibility: "review_only";

  metadata?: Record<string, unknown>;
}
```

### 18.4 Create Guided Action

```ts
export interface CreateGuidedActionInput {
  tenantId: string;
  baId: string;
  sessionId: string;
  agentKey: AgentKey;

  language: RuntimeLanguage;

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

  sourceKnowledgeIds?: string[];
  sourceTurnIds?: string[];

  metadata?: Record<string, unknown>;
}
```

### 18.5 Complete Session

```ts
export interface CompleteSessionInput {
  tenantId: string;
  baId: string;
  sessionId: string;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  summary: string;
  finalStateKey: string;
  createdJournalEntryIds?: string[];
  createdKnowledgeCandidateIds?: string[];
  createdGuidedActionIds?: string[];
  createdInvitationDraftIds?: string[];
  metadata?: Record<string, unknown>;
}
```

---

## 19. Ivory-Specific Tools

Ivory has additional relationship-specific tools.

```ts
export interface IvoryTools extends RuntimeAgentTools {
  createRelationshipContext(
    input: CreateRelationshipContextInput
  ): Promise<RelationshipContext>;

  prepareEditableInvitationDraft(
    input: PrepareInvitationDraftInput
  ): Promise<InvitationDraft>;

  mintInvitationLinkIfApprovedByBA(
    input: MintInvitationLinkInput
  ): Promise<InvitationLink>;
}
```

### 19.1 Create Relationship Context

```ts
export interface CreateRelationshipContextInput {
  tenantId: string;
  baId: string;
  sessionId: string;
  agentKey: "ivory";

  personDisplayName?: string;
  relationshipToBA?: string;
  whyNow?: string;

  tonePreference?: "warm" | "direct" | "professional" | "gentle" | "casual";

  channelPreference?: "text" | "phone" | "email" | "in_person" | "unknown";

  language: RuntimeLanguage;

  sourceTurnIds: string[];

  privacy: "ba_owned";

  metadata?: Record<string, unknown>;
}
```

### 19.2 Invitation Draft

```ts
export interface InvitationDraft {
  draftId: string;
  tenantId: string;
  baId: string;
  sessionId: string;

  relationshipContextId: string;

  language: RuntimeLanguage;

  channel: "text" | "phone" | "email" | "in_person";

  tone: "warm" | "direct" | "professional" | "gentle" | "casual";

  body: string;

  editable: true;

  needsBAReview: true;

  approvedByBA: false | true;

  sentBySystem: false;

  createdAt: Date;

  metadata?: Record<string, unknown>;
}
```

### 19.3 Prepare Invitation Draft Input

```ts
export interface PrepareInvitationDraftInput {
  tenantId: string;
  baId: string;
  sessionId: string;
  agentKey: "ivory";

  relationshipContextId: string;

  language: RuntimeLanguage;

  channel: "text" | "phone" | "email" | "in_person";

  tone: "warm" | "direct" | "professional" | "gentle" | "casual";

  draftPurpose:
    | "initial_invitation"
    | "follow_up"
    | "check_in"
    | "presentation_share"
    | "thank_you";

  contextPacketId: string;

  sourceTurnIds: string[];

  metadata?: Record<string, unknown>;
}
```

### 19.4 Invitation Link

```ts
export interface InvitationLink {
  invitationLinkId: string;
  tenantId: string;
  baId: string;
  sessionId: string;
  relationshipContextId: string;
  draftId?: string;

  url: string;

  createdOnlyAfterBAApproval: true;

  createdAt: Date;

  metadata?: Record<string, unknown>;
}
```

### 19.5 Mint Invitation Link Rule

Ivory may prepare a link only when the Brand Ambassador explicitly approves the next step.

Ivory may not auto-send the link.

Ivory may not imply the system contacted the prospect.

Ivory may not bypass BA review.

---

## 20. Interview Template Structure

Each agent uses bilingual state-based templates.

```ts
export interface AgentInterviewTemplate {
  templateId: string;
  agentKey: AgentKey;
  language: RuntimeLanguage;
  version: number;
  title: string;
  description?: string;
  initialStateKey: string;
  states: AgentTemplateState[];
  active: boolean;
}
```

```ts
export interface AgentTemplateState {
  stateKey: string;
  prompt: string;
  purpose: string;
  captureFields: string[];
  transitions: AgentStateTransition[];
  allowedTools: RuntimeToolKey[];
  allowedOutputs: AgentAllowedOutput[];
  completionCriteria?: string[];
}
```

```ts
export interface AgentStateTransition {
  transitionKey: string;
  toStateKey: string;
  condition:
    | "always"
    | "field_captured"
    | "ba_requested_journal"
    | "ba_declined_journal"
    | "ba_requested_candidate"
    | "ba_declined_candidate"
    | "ba_requested_draft"
    | "ba_approved_draft"
    | "ba_requested_close"
    | "requires_clarification";
  requiredField?: string;
}
```

### 20.1 Template Requirements

Every template must:

- Match one agent.
- Match one language.
- Include version.
- Include initial state.
- Include states.
- Include transitions.
- Include allowed tools per state.
- Include allowed outputs per state.
- Preserve capture fields.
- Support safe close session.

---

## 21. Agent Allowed Outputs

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

### 21.1 Output Rules

Agent output must:

- Match the current state.
- Match allowed outputs for the state.
- Match the packet language.
- Respect guardrails.
- Avoid forbidden claims.
- Preserve BA ownership.
- Be appropriate for Browser Voice or Browser Text.

---

## 22. Steve Success

### 22.1 Mission

Steve Success helps the Brand Ambassador capture success, learn from experience, and choose the next action.

Steve focuses on:

- Wins
- Breakthroughs
- Obstacles
- Conversations
- Lessons learned
- Momentum
- Confidence
- Support needs
- Next actions
- Journal reflection offers
- Candidate summary offers

Steve does not treat one Brand Ambassador's personal experience as universal organizational truth.

Steve may propose Success Knowledge Candidates for review.

Steve may not approve candidates.

### 22.2 Steve State Machine

```text
welcome
  ↓
capture_win_or_obstacle
  ↓
clarify_context
  ↓
extract_lesson
  ↓
choose_next_action
  ↓
journal_reflection_offer
  ↓
knowledge_candidate_offer
  ↓
session_summary
  ↓
close_session
```

### 22.3 Steve State Keys

```ts
export type SteveSuccessStateKey =
  | "welcome"
  | "capture_win_or_obstacle"
  | "clarify_context"
  | "extract_lesson"
  | "choose_next_action"
  | "journal_reflection_offer"
  | "knowledge_candidate_offer"
  | "session_summary"
  | "close_session";
```

### 22.4 Steve Captured Fields

Steve should capture:

- Recent win or obstacle
- Context
- What happened
- Who was involved if relevant
- What was learned
- Confidence signal
- Momentum signal
- Support need
- Next action
- Journal preference
- Candidate review preference

### 22.5 Steve English Starter Prompt

```text
Welcome. Tell me one thing that happened recently that we should learn from: a win, a breakthrough, an obstacle, or a conversation.
```

### 22.6 Steve Spanish Starter Prompt

```text
Bienvenido. Cuéntame algo reciente de lo que debemos aprender: una victoria, un avance, un obstáculo o una conversación.
```

### 22.7 Steve Required Behavior

Steve must:

- Ask one clear question at a time.
- Capture lessons from experience.
- Help the BA choose a next action.
- Offer a journal reflection when appropriate.
- Offer a candidate summary only when there is a useful lesson.
- Clarify that candidate submission is for review, not approval.
- Keep the BA as the owner of the action.

---

## 23. Michael Magnificent

### 23.1 Mission

Michael Magnificent teaches and supports the Brand Ambassador.

Michael focuses on:

- Training support
- Onboarding
- System usage
- Momentum Journal teaching
- Skill development
- Duplication
- Repeated questions
- Training confidence
- Next system actions

Michael is the primary agent responsible for teaching every Brand Ambassador how to use the Momentum Journal.

### 23.2 Michael State Machine

```text
welcome
  ↓
identify_training_need
  ↓
teach_momentum_journal
  ↓
journal_practice_prompt
  ↓
answer_system_question
  ↓
guide_next_system_action
  ↓
knowledge_candidate_offer
  ↓
session_summary
  ↓
close_session
```

### 23.3 Michael State Keys

```ts
export type MichaelMagnificentStateKey =
  | "welcome"
  | "identify_training_need"
  | "teach_momentum_journal"
  | "journal_practice_prompt"
  | "answer_system_question"
  | "guide_next_system_action"
  | "knowledge_candidate_offer"
  | "session_summary"
  | "close_session";
```

### 23.4 Michael Captured Fields

Michael should capture:

- Training need
- Current onboarding state
- Current system question
- Learning style
- Confusion point
- Skill gap
- Journal understanding
- Journal practice response
- Next training action
- Candidate-worthy training clarification
- Support need

### 23.5 Momentum Journal Teaching Requirement

Michael must teach:

```text
The Momentum Journal is the Brand Ambassador's private place to capture lessons learned, ideas, questions, observations, reflections, scripts, personal strategies, voice notes, resources, and reminders.

The Momentum Journal is private by default.

A journal entry does not become organizational knowledge automatically.

The Brand Ambassador may intentionally select an entry for review.

Selected entries become Knowledge Candidates.

Knowledge Candidates must be reviewed before becoming approved organizational knowledge.
```

### 23.6 Michael English Starter Prompt

```text
Welcome. What would you like help learning or doing today: onboarding, using the system, understanding your next step, or using your Momentum Journal?
```

### 23.7 Michael Spanish Starter Prompt

```text
Bienvenido. ¿Con qué te gustaría recibir ayuda hoy: incorporación, uso del sistema, entender tu próximo paso o usar tu Momentum Journal?
```

### 23.8 Michael Required Behavior

Michael must:

- Teach clearly.
- Use simple explanations.
- Confirm understanding.
- Encourage practice.
- Teach Momentum Journal privacy.
- Guide one next system action.
- Offer a journal practice prompt when useful.
- Propose training Knowledge Candidates only for review.
- Avoid treating training confusion as failure.

---

## 24. Ivory

### 24.1 Mission

Ivory helps the Brand Ambassador think relationally, invite respectfully, and prepare editable invitation drafts.

Ivory focuses on:

- Who came to mind
- Relationship context
- Why now
- Tone
- Channel
- Invitation draft
- BA review and edit
- Optional invitation link after BA approval
- Follow-up next step
- Relationship sensitivity

Ivory must preserve Brand Ambassador ownership.

Ivory must not auto-send prospect outreach.

Ivory must not pressure prospects.

Ivory must not overstate prospect interest.

### 24.2 Ivory State Machine

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
optional_invitation_link
  ↓
journal_or_candidate_offer
  ↓
session_summary
  ↓
close_session
```

### 24.3 Ivory State Keys

```ts
export type IvoryStateKey =
  | "welcome"
  | "who_came_to_mind"
  | "relationship_context"
  | "why_now"
  | "tone_and_channel"
  | "draft_invitation"
  | "ba_review_and_edit"
  | "optional_invitation_link"
  | "journal_or_candidate_offer"
  | "session_summary"
  | "close_session";
```

### 24.4 Ivory Captured Fields

Ivory should capture:

- Person who came to mind
- Relationship to BA
- Why now
- Tone preference
- Channel preference
- Invitation purpose
- Draft wording preference
- BA edits
- BA approval status
- Optional link request
- Follow-up next step
- Relationship sensitivity

### 24.5 Ivory English Starter Prompt

```text
Welcome. Who came to mind today that you may want to reach out to?
```

### 24.6 Ivory Spanish Starter Prompt

```text
Bienvenido. ¿Quién te vino a la mente hoy como alguien a quien quizá quieras contactar?
```

### 24.7 Ivory Required Behavior

Ivory must:

- Ask who came to mind.
- Capture relationship context.
- Ask why now.
- Ask tone and channel when needed.
- Create short editable drafts.
- Keep drafts respectful.
- Avoid pressure.
- Avoid hype.
- Avoid auto-send.
- Make BA review explicit.
- Keep BA ownership clear.
- Create relationship context through service layer.
- Create invitation drafts through service layer.
- Create invitation links only after BA approval.

---

## 25. Invitation Draft Rules

Ivory may create editable invitation drafts.

An invitation draft is not outreach.

An invitation draft is not sent automatically.

### 25.1 Draft Requirements

Every invitation draft must:

- Belong to the BA.
- Reference relationship context.
- Be editable.
- Require BA review.
- Be language-specific.
- Match channel.
- Match tone.
- Avoid pressure.
- Avoid unsupported claims.
- Avoid income or medical claims unless approved context permits safe wording.
- Preserve BA voice.

### 25.2 Draft Prohibitions

Ivory must not:

- Auto-send a draft.
- Claim the prospect is interested unless the BA provided that information.
- Use pressure language.
- Use manipulative urgency.
- Use unsupported product, income, or medical claims.
- Mint a link without BA approval.
- Send a link automatically.

---

## 26. Momentum Journal Runtime Rules

Agents may create journal prompts and journal entries through service layers.

### 26.1 Journal Creation Rules

Journal entries may be created when:

- The BA explicitly asks to save a reflection.
- The agent offers and the BA accepts.
- The workflow state includes journal practice.
- The BA provides a journal response.

Journal entries must be private by default.

### 26.2 Journal Promotion Rules

Agents may explain that a journal entry can be selected for review.

Agents may offer a candidate summary.

Agents may not select journal entries for review without BA action.

Agents may not promote private journal content automatically.

### 26.3 Michael's Special Responsibility

Michael must teach how the Momentum Journal works.

Steve and Ivory may offer journal reflection prompts when relevant.

---

## 27. Knowledge Candidate Proposal Rules

Agents may propose Knowledge Candidates.

Agents may not approve them.

### 27.1 Candidate Proposal Conditions

An agent may propose a Knowledge Candidate when:

- A useful lesson, pattern, clarification, script principle, or workflow improvement emerges.
- The BA agrees to submit or the workflow permits candidate creation.
- The candidate is marked review-only.
- Source turns are preserved.
- Domain is correct.
- Language is preserved.
- Risk-sensitive content is flagged by ingestion.

### 27.2 Candidate Proposal by Agent

Steve may propose:

- Success patterns
- Obstacle patterns
- Action habits
- Momentum lessons
- Next-step patterns

Michael may propose:

- Training clarifications
- Onboarding FAQs
- System how-tos
- Journal teaching improvements
- Repeated training answers

Ivory may propose:

- Invitation wording principles
- Relationship coaching patterns
- Follow-up tone patterns
- Editable script templates

### 27.3 Candidate Prohibitions

Agents must not:

- Present candidates as approved knowledge.
- Activate candidates.
- Write candidates directly into active organizational knowledge.
- Hide candidate status from the BA.
- Use private journal content as candidate without authorized BA selection.

---

## 28. Guided Action Rules

Agents may create Guided Actions.

Guided Actions are BA-owned.

### 28.1 Guided Action Requirements

Every Guided Action must:

- Be owned by the BA.
- Be clear.
- Be actionable.
- Be appropriate to the agent and task.
- Include urgency.
- Include source knowledge IDs when applicable.
- Preserve session ID.
- Preserve agent key.
- Be created through service layer.

### 28.2 Guided Action Examples

Steve may suggest:

- Write a reflection about a lesson learned.
- Take one next success action.
- Capture a breakthrough.
- Review a momentum blocker.

Michael may suggest:

- Review a training module.
- Practice using the Momentum Journal.
- Complete an onboarding step.
- Ask a training question.

Ivory may suggest:

- Draft an invitation.
- Choose the next prospect.
- Schedule a follow-up.
- Capture relationship context.

### 28.3 Guided Action Prohibitions

Agents must not:

- Claim to perform the action for the BA.
- Auto-send outreach.
- Schedule external communication without approval.
- Create pressure-based actions.
- Override BA choice.

---

## 29. Agent Response Contract

Every agent turn must return a structured response.

```ts
export interface AgentTurnResponse {
  sessionId: string;

  agentKey: AgentKey;

  language: RuntimeLanguage;

  stateKey: string;

  message: string;

  outputMode: "text" | "voice_text";

  suggestedActions: SuggestedAction[];

  createdJournalEntryId?: string;

  createdKnowledgeCandidateId?: string;

  createdGuidedActionId?: string;

  createdInvitationDraftId?: string;

  relationshipContextId?: string;

  contextPacketId: string;

  contextPacketStatus: "complete" | "degraded";

  eventIds: string[];

  nextStateKey?: string;

  sessionStatus: AgentSessionStatus;
}
```

### 29.1 Suggested Action

```ts
export interface SuggestedAction {
  actionKey: string;

  label: string;

  description?: string;

  actionType:
    | "continue"
    | "answer_question"
    | "create_journal_entry"
    | "select_for_review"
    | "create_guided_action"
    | "edit_invitation_draft"
    | "approve_invitation_link"
    | "close_session";

  owner: "ba";

  requiresBAConfirmation: boolean;
}
```

### 29.2 Response Requirements

Every response must:

- Include session ID.
- Include agent key.
- Include language.
- Include current state key.
- Include message.
- Include output mode.
- Include Context Packet ID.
- Include event IDs.
- Match output guardrails.
- Match current state.
- Match allowed outputs.

---

## 30. Output Guardrails

Before returning output, the Agent Runtime must validate the response.

### 30.1 Required Output Guardrail Checks

The Agent Runtime must verify:

- No auto-send language.
- No Telnyx internal call behavior.
- No candidate-as-approved claims.
- No unapproved medical claims.
- No unapproved income claims.
- Correct language.
- Correct agent role.
- Journal privacy is respected.
- Relationship privacy is respected.
- Prospect interest is not overstated.
- BA owns the action.
- Drafts are editable and require BA review.
- Agent does not claim direct database knowledge.
- Agent does not reference excluded context.
- Agent does not invent missing knowledge.

### 30.2 Output Guardrail Result

```ts
export interface OutputGuardrailResult {
  passed: boolean;

  blocked: boolean;

  violations: OutputGuardrailViolation[];

  safeReplacementMessage?: string;
}
```

```ts
export interface OutputGuardrailViolation {
  violationType:
    | "auto_send_language"
    | "telnyx_internal_behavior"
    | "candidate_as_approved"
    | "unapproved_medical_claim"
    | "unapproved_income_claim"
    | "wrong_language"
    | "wrong_agent_role"
    | "journal_privacy_violation"
    | "relationship_privacy_violation"
    | "prospect_interest_overstated"
    | "ba_action_ownership_violation"
    | "excluded_context_used"
    | "invented_knowledge";

  severity: "low" | "medium" | "high" | "critical";

  message: string;
}
```

### 30.3 Guardrail Failure Behavior

If output guardrails fail:

- Block unsafe response.
- Create safe replacement message.
- Emit guardrail violation event.
- Preserve audit.
- Do not proceed with unsafe output.

---

## 31. API Contracts

The Agent Runtime must expose runtime APIs.

### 31.1 Create Agent Session

```text
POST /api/runtime/agents/:agentKey/sessions
```

Request:

```ts
export interface CreateAgentSessionRequest {
  tenantId: string;
  baId: string;
  language: RuntimeLanguage;
  mode: AgentRuntimeMode;
  taskType:
    | "success_interview"
    | "training_support"
    | "journal_teaching"
    | "relationship_coaching"
    | "invitation_drafting"
    | "session_resume"
    | "guided_action_review";
  initialStateKey?: string;
  prospectId?: string;
  metadata?: Record<string, unknown>;
}
```

Response:

```ts
export interface CreateAgentSessionResponse {
  session: AgentRuntimeSessionState;
  initialResponse: AgentTurnResponse;
}
```

### 31.2 Get Agent Session

```text
GET /api/runtime/agents/:agentKey/sessions/:sessionId
```

Response:

```ts
export interface GetAgentSessionResponse {
  session: AgentRuntimeSessionState;
}
```

### 31.3 Add Session Turn

```text
POST /api/runtime/agents/:agentKey/sessions/:sessionId/turns
```

Request:

```ts
export interface AddAgentSessionTurnRequest {
  tenantId: string;
  baId: string;

  // Team Magnificent identity (optional on the turn; established at session
  // creation in AgentRuntimeSessionState §14.3). Accepting these top-level
  // keeps the request compatible with the Browser Voice wire payload
  // (BROWSER_VOICE_RUNTIME.md §16.3).
  teamId?: string;
  teamKey?: "team_magnificent";
  teamName?: "Team Magnificent";

  text: string;
  language?: RuntimeLanguage;
  mode: AgentRuntimeMode;
  transcriptMetadata?: BrowserTranscriptMetadata;
  metadata?: Record<string, unknown>;
}
```

Response:

```ts
export interface AddAgentSessionTurnResponse {
  turn: AgentConversationTurn;
  response: AgentTurnResponse;
}
```

### 31.4 Complete Session

```text
POST /api/runtime/agents/:agentKey/sessions/:sessionId/complete
```

Request:

```ts
export interface CompleteAgentSessionRequest {
  tenantId: string;
  baId: string;
  completionReason:
    | "completed_by_ba"
    | "completed_by_agent_flow"
    | "cancelled_by_ba"
    | "failed"
    | "timeout";
  summary?: string;
}
```

Response:

```ts
export interface CompleteAgentSessionResponse {
  session: AgentRuntimeSessionState;
  finalResponse?: AgentTurnResponse;
}
```

### 31.5 Create Ivory Invitation Draft

```text
POST /api/runtime/agents/ivory/sessions/:sessionId/invitation-draft
```

Request:

```ts
export interface CreateIvoryInvitationDraftRequest {
  tenantId: string;
  baId: string;
  relationshipContextId: string;
  channel: "text" | "phone" | "email" | "in_person";
  tone: "warm" | "direct" | "professional" | "gentle" | "casual";
  draftPurpose:
    | "initial_invitation"
    | "follow_up"
    | "check_in"
    | "presentation_share"
    | "thank_you";
}
```

Response:

```ts
export interface CreateIvoryInvitationDraftResponse {
  draft: InvitationDraft;
}
```

---

## 32. Agent Events

The Agent Runtime must emit events.

### 32.1 Events Published by Agent Runtime

```text
agent.session.created
agent.session.started
agent.context.requested
agent.context.received
agent.turn.received
agent.turn.responded
agent.state.advanced
agent.journal_entry.created
agent.knowledge_candidate.proposed
agent.guided_action.created
agent.relationship_context.created
agent.invitation_draft.created
agent.invitation_link.requested
agent.invitation_link.created
agent.output_guardrail.blocked
agent.session.paused
agent.session.completed
agent.session.failed
agent.session.cancelled
```

### 32.2 Events Consumed by Agent Runtime

```text
context.packet.created
context.packet.delivered
context.packet.degraded
context.packet.failed
browser_voice.session.started
browser_voice.transcript.finalized
browser_text.message.created
guided_action.completed
journal.entry.created
knowledge.candidate.created
```

### 32.3 Agent Event Envelope

```ts
export interface AgentEventInput {
  eventType: AgentEventType;

  tenantId: string;
  baId: string;
  sessionId: string;
  agentKey: AgentKey;

  correlationId?: string;
  causationId?: string;

  payload: Record<string, unknown>;
}
```

```ts
export type AgentEventType =
  | "agent.session.created"
  | "agent.session.started"
  | "agent.context.requested"
  | "agent.context.received"
  | "agent.turn.received"
  | "agent.turn.responded"
  | "agent.state.advanced"
  | "agent.journal_entry.created"
  | "agent.knowledge_candidate.proposed"
  | "agent.guided_action.created"
  | "agent.relationship_context.created"
  | "agent.invitation_draft.created"
  | "agent.invitation_link.requested"
  | "agent.invitation_link.created"
  | "agent.output_guardrail.blocked"
  | "agent.session.paused"
  | "agent.session.completed"
  | "agent.session.failed"
  | "agent.session.cancelled";
```

---

## 33. Data Flow

### 33.1 Standard Agent Turn Flow

```text
BA sends voice/text input
  ↓
Browser Runtime sends turn to Agent Runtime
  ↓
Agent Runtime appends BA turn
  ↓
Agent Runtime requests fresh Context Packet if needed
  ↓
Agent Runtime validates packet
  ↓
Agent Runtime loads current template state
  ↓
Agent Runtime processes input
  ↓
Captured fields update
  ↓
State transition evaluated
  ↓
Optional tools executed
  ↓
Output guardrails validate response
  ↓
Agent response returned
  ↓
Agent Events emitted
  ↓
Turn sent to Knowledge Ingestion
```

### 33.2 Candidate Proposal Flow

```text
Agent identifies candidate-worthy lesson
  ↓
Agent asks or confirms BA permission when needed
  ↓
Agent creates review-only candidate through service layer
  ↓
Knowledge Ingestion applies risk-check and dedupe
  ↓
Candidate enters review queue
  ↓
Agent tells BA it was submitted for review, not approved
```

### 33.3 Journal Flow

```text
Agent offers journal reflection
  ↓
BA provides reflection or confirms save
  ↓
Agent creates private journal entry through service layer
  ↓
Journal entry remains private to BA
  ↓
BA may later select entry for review
```

### 33.4 Ivory Draft Flow

```text
Ivory captures relationship context
  ↓
Ivory captures why now
  ↓
Ivory captures tone and channel
  ↓
Ivory prepares editable draft
  ↓
Draft is marked needsBAReview
  ↓
BA edits or approves
  ↓
Optional invitation link may be minted only after BA approval
  ↓
No auto-send occurs
```

---

## 34. Failure Behavior

The Agent Runtime must fail safely.

### 34.1 Context Packet Failure

If Context Manager returns failed packet:

- Agent Runtime must not proceed with substantive guidance.
- Agent Runtime must return safe fallback message.
- Agent Runtime must emit `agent.session.failed` or degraded event depending on recoverability.

### 34.2 Degraded Context Packet

If Context Manager returns degraded packet:

- Agent Runtime may proceed only within safe fallback instructions.
- Agent must ask clarifying questions when context is missing.
- Agent must not invent missing knowledge.

### 34.3 Tool Failure

If a tool fails:

- Preserve the session.
- Emit failure event.
- Return safe explanation.
- Do not claim the action succeeded.
- Do not create duplicate actions on retry.
- Use idempotency where available.

### 34.4 Output Guardrail Failure

If output guardrails block a response:

- Do not send unsafe output.
- Return safe replacement.
- Emit `agent.output_guardrail.blocked`.
- Preserve violation details for audit.

---

## 35. Security and Privacy

### 35.1 Agent Knowledge Boundary

Agents must not access raw knowledge databases.

Agents must use Context Packets.

### 35.2 Journal Privacy

Momentum Journal content is private by default.

Agents may create journal entries only through service layers.

Agents may not expose journal content outside BA scope.

Agents may not promote journal content without BA selection.

### 35.3 Relationship Privacy

Relationship context is BA-owned and person-sensitive.

Ivory must minimize sensitive details.

Ivory must not expose unrelated prospect information.

### 35.4 Candidate Boundary

Knowledge Candidates are review-only.

Agents may propose candidates.

Agents may not approve or activate them.

### 35.5 Telnyx Boundary

Internal Browser Voice must not use Telnyx.

Agent Runtime must not create Telnyx internal voice behavior.

External runtime workflows are separate.

---

## 36. Observability

The Agent Runtime must expose operational observability.

### 36.1 Required Metrics

The implementation must track:

- Sessions created by agent
- Sessions completed by agent
- Sessions failed by agent
- Turns per session
- Average session duration
- Context packets requested
- Degraded packets used
- Failed packets received
- Journal entries created
- Knowledge Candidates proposed
- Guided Actions created
- Invitation drafts created
- Output guardrail blocks
- English sessions
- Spanish sessions
- Browser Voice sessions
- Browser Text sessions

### 36.2 Required Logs

The implementation must log:

- Session creation
- Context request
- Context receipt
- Turn received
- Turn response
- State transition
- Tool execution
- Journal entry creation
- Candidate proposal
- Guided Action creation
- Invitation draft creation
- Output guardrail block
- Session completion
- Session failure

### 36.3 Required Health Checks

The Agent Runtime must expose health checks for:

- Context Manager availability
- Knowledge Ingestion availability
- Journal service availability
- Guided Action service availability
- Event bus availability
- Template registry availability
- Output guardrail service availability

---

## 37. Persistence Requirements

### 37.1 Required Collections

Version 1.0 requires:

```text
agent_sessions
agent_conversation_turns
agent_state_transitions
agent_tool_executions
agent_response_records
agent_output_guardrail_results
agent_events
invitation_drafts
relationship_contexts
```

### 37.2 Required Indexes

```text
agent_sessions.sessionId unique
agent_sessions.tenantId
agent_sessions.baId
agent_sessions.agentKey
agent_sessions.status
agent_sessions.language
agent_sessions.startedAt

agent_conversation_turns.turnId unique
agent_conversation_turns.sessionId
agent_conversation_turns.baId
agent_conversation_turns.agentKey
agent_conversation_turns.sequence
agent_conversation_turns.createdAt

invitation_drafts.draftId unique
invitation_drafts.baId
invitation_drafts.sessionId
invitation_drafts.relationshipContextId
invitation_drafts.createdAt

relationship_contexts.relationshipContextId unique
relationship_contexts.baId
relationship_contexts.sessionId
```

---

## 38. Relationship to Context Manager

Agent Runtime requests Context Packets from the Context Manager.

Agent Runtime must not assemble its own context.

Agent Runtime must not perform knowledge retrieval directly.

Agent Runtime must validate every packet before use.

---

## 39. Relationship to Context Packet

Agent Runtime consumes `context_packet.v1`.

The packet is the agent's source of truth.

Agent Runtime must obey:

- Packet status
- Runtime rules
- Guardrails
- Active template
- Language context
- Approved knowledge boundaries
- Private context boundaries
- Relationship context boundaries
- Exclusions
- Retrieval audit

---

## 40. Relationship to Knowledge Ingestion Protocol

Agent Runtime produces conversation turns and session outputs.

Knowledge Ingestion captures and processes those outputs.

Agent Runtime sends or emits:

- Session turns
- Journal entries
- Candidate proposals
- Guided actions
- Relationship context
- Invitation draft metadata
- Session summaries

Knowledge Ingestion determines candidate preparation, risk-check, dedupe, review indexing, and graph lineage.

---

## 41. Relationship to Knowledge Core

Agent Runtime does not write directly to the Knowledge Core.

Agent Runtime contributes knowledge only through:

- Knowledge Ingestion
- Approved service layers
- Events
- Journal services
- Candidate proposal services

The Knowledge Core stores, governs, and evolves knowledge.

---

## 42. Relationship to Browser Voice Runtime

Browser Voice Runtime provides voice input and output transport.

Agent Runtime provides agent logic.

Browser Voice is internal.

Browser Voice does not use Telnyx.

Agent Runtime must produce voice-friendly responses when output mode is `voice_text`.

---

## 43. Relationship to Browser Text Runtime

Browser Text Runtime provides typed interaction.

Agent Runtime provides agent logic.

Browser Text may support richer text formatting than Browser Voice.

Agent Runtime must still enforce all guardrails.

---

## 44. Relationship to Guided Action Runtime

Agent Runtime may create Guided Actions through service layers.

Guided Action Runtime owns Guided Action lifecycle after creation.

Guided Actions remain BA-owned.

---

## 45. Relationship to Learning Pipeline

The Learning Pipeline evaluates outcomes from agent guidance.

Agent Runtime must preserve:

- Context Packet ID
- Source turns
- Created Guided Actions
- Created candidates
- Created journal entries
- Session summary
- Agent response records

These allow Learning Pipeline to evaluate whether guidance was useful.

---

## 46. Relationship to External Runtime

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

Agent Runtime does not perform external runtime operations directly.

Ivory may prepare editable drafts and optional links after BA approval.

Sending, voicemail delivery, SMS delivery, and callback workflows belong to external runtime services.

---

## 47. Implementation Structure for Codex

A recommended implementation layout is:

```text
server/src/runtime/agents/
  index.ts

  agent.registry.ts
  agent.types.ts

  agentRuntime.service.ts
  agentSession.service.ts
  agentTurn.service.ts
  agentStateMachine.service.ts
  agentTemplate.service.ts
  agentTool.service.ts
  agentResponse.service.ts
  agentOutputGuardrails.ts
  agentEvents.service.ts

  tools/
    buildContextPacket.tool.ts
    appendConversationTurn.tool.ts
    createJournalEntry.tool.ts
    createKnowledgeCandidate.tool.ts
    createGuidedAction.tool.ts
    completeSession.tool.ts

  ivory/
    createRelationshipContext.tool.ts
    prepareEditableInvitationDraft.tool.ts
    mintInvitationLinkIfApprovedByBA.tool.ts
    invitationDraft.types.ts
    ivory.service.ts

  templates/
    steve.en.ts
    steve.es.ts
    michael.en.ts
    michael.es.ts
    ivory.en.ts
    ivory.es.ts

  routes.ts

  models/
    AgentSession.model.ts
    AgentConversationTurn.model.ts
    AgentStateTransition.model.ts
    AgentToolExecution.model.ts
    AgentResponseRecord.model.ts
    AgentOutputGuardrailResult.model.ts
    AgentEvent.model.ts
    InvitationDraft.model.ts
    RelationshipContext.model.ts

  tests/
    agent.registry.test.ts
    agent.session.test.ts
    agent.contextPacket.test.ts
    agent.stateMachine.test.ts
    agent.outputGuardrails.test.ts
    steve.runtime.test.ts
    michael.runtime.test.ts
    ivory.runtime.test.ts
    bilingual.runtime.test.ts
```

Frontend route suggestions:

```text
apps/team/src/routes/steve/interview.tsx
apps/team/src/routes/michael/interview.tsx
apps/team/src/routes/ivory/index.tsx
```

Frontend route suggestions are non-normative Implementation Layer pointers. They are included only to help Codex locate likely UI entry points. They do not define Runtime Layer authority and may be adapted during implementation if the Runtime acceptance criteria remain satisfied.

---

## 48. Minimal Runtime Implementation Sequence

Codex should implement Agent Runtime in this order.

### Step 1: Agent Types

Implement all agent, session, turn, response, tool, template, and event types.

### Step 2: Agent Registry

Implement Steve, Michael, and Ivory registry entries.

### Step 3: Templates

Implement English and Spanish templates for all agents.

### Step 4: Session Service

Implement session creation, retrieval, update, pause, completion, failure, and cancellation.

### Step 5: Context Packet Integration

Implement Context Manager request and packet validation.

### Step 6: Turn Handling

Implement turn append, state update, and response generation.

### Step 7: State Machine

Implement state transition logic for Steve, Michael, and Ivory.

### Step 8: Shared Tools

Implement shared runtime tools through service layers.

### Step 9: Ivory Tools

Implement relationship context, editable draft, and approval-based link creation.

### Step 10: Output Guardrails

Implement response validation and safe replacement behavior.

### Step 11: Events

Implement all required Agent Events.

### Step 12: Persistence

Implement required models and indexes.

### Step 13: APIs

Implement runtime routes.

### Step 14: Observability

Implement logs, metrics, and health checks.

### Step 15: Tests

Implement acceptance test suite.

---

## 49. Acceptance Criteria

The Agent Runtime is complete only when all acceptance criteria are satisfied.

### 49.1 Agent Registry Acceptance Criteria

- Steve Success is registered.
- Michael Magnificent is registered.
- Ivory is registered.
- Each agent has correct key, display name, and domain.
- Each agent supports English.
- Each agent supports Spanish.
- Each agent supports Browser Voice.
- Each agent supports Browser Text.

### 49.2 Session Acceptance Criteria

- Steve sessions can be created.
- Michael sessions can be created.
- Ivory sessions can be created.
- Sessions store tenant ID, BA ID, agent key, language, mode, status, template, state, and Context Packet ID.
- Sessions can be completed.
- Sessions can be paused.
- Sessions can fail safely.

### 49.3 Context Packet Acceptance Criteria

- Each agent requests a Context Packet.
- Context Packet schema is validated.
- Failed packets prevent substantive guidance.
- Degraded packets use safe fallback instruction.
- Agents do not retrieve knowledge directly.

### 49.4 Template Acceptance Criteria

- Steve has English and Spanish templates.
- Michael has English and Spanish templates.
- Ivory has English and Spanish templates.
- Templates have states and transitions.
- Current state advances correctly.
- Allowed tools are enforced by state.

### 49.5 Steve Acceptance Criteria

- Steve captures success lessons.
- Steve captures wins, obstacles, and breakthroughs.
- Steve helps choose next actions.
- Steve can offer journal reflection.
- Steve can propose Success Knowledge Candidates for review.
- Steve cannot approve candidates.

### 49.6 Michael Acceptance Criteria

- Michael provides training support.
- Michael supports onboarding.
- Michael answers system questions.
- Michael teaches Momentum Journal.
- Michael explains journal privacy.
- Michael explains selected entries may become Knowledge Candidates.
- Michael can propose Training Knowledge Candidates for review.
- Michael cannot approve candidates.

### 49.7 Ivory Acceptance Criteria

- Ivory asks who came to mind.
- Ivory captures relationship context.
- Ivory captures why now.
- Ivory captures tone and channel.
- Ivory creates editable invitation drafts only.
- Ivory requires BA review.
- Ivory does not auto-send outreach.
- Ivory can create optional invitation links only after BA approval.
- Ivory can propose Relationship Knowledge Candidates for review.
- Ivory cannot approve candidates.

### 49.8 Journal Acceptance Criteria

- Agents can create journal entries through service layer.
- Journal entries are private by default.
- Agents cannot promote journal content without BA action.
- Michael teaches the Momentum Journal correctly.

### 49.9 Candidate Acceptance Criteria

- Agents may propose candidates.
- Candidates are review-only.
- Candidates preserve source turns.
- Candidates preserve language.
- Candidates preserve domain.
- Candidates are not approved knowledge.
- Agents cannot approve candidates.

### 49.10 Guided Action Acceptance Criteria

- Agents may create Guided Actions.
- Guided Actions are BA-owned.
- Guided Actions preserve source context.
- Agents do not claim ownership of BA actions.

### 49.11 Output Guardrail Acceptance Criteria

- Auto-send language is blocked.
- Telnyx internal call behavior is blocked.
- Candidate-as-approved claims are blocked.
- Unapproved medical claims are blocked.
- Unapproved income claims are blocked.
- Wrong language output is blocked.
- Journal privacy violations are blocked.
- Relationship privacy violations are blocked.
- BA ownership violations are blocked.

### 49.12 Runtime Boundary Acceptance Criteria

- Internal Browser Voice does not use Telnyx.
- Telnyx is not used for Steve, Michael, or Ivory internal coaching.
- External SMS, voicemail, and callback workflows remain outside Agent Runtime.
- Agents do not directly query MongoDB, Neo4j, Chroma, or GraphRAG.

### 49.13 Event Acceptance Criteria

- Session creation emits event.
- Context request emits event.
- Turn received emits event.
- Turn response emits event.
- State advance emits event.
- Journal creation emits event.
- Candidate proposal emits event.
- Guided Action creation emits event.
- Invitation draft creation emits event.
- Session completion emits event.
- Guardrail block emits event.

---

## 50. Testing Requirements

### 50.1 Unit Tests

Unit tests must cover:

- Agent registry mapping
- Agent session validation
- Context Packet validation
- Template loading
- State transitions
- Tool authorization by state
- Output guardrails
- Journal entry creation rules
- Candidate proposal rules
- Guided Action creation rules
- Ivory draft rules
- Bilingual prompt selection

### 50.2 Integration Tests

Integration tests must cover:

- Full Steve session
- Full Michael session
- Full Ivory session
- Browser Voice turn handling
- Browser Text turn handling
- Context Manager integration
- Knowledge Ingestion handoff
- Journal creation
- Candidate proposal
- Guided Action creation
- Ivory invitation draft creation
- Degraded packet behavior
- Failed packet behavior

### 50.3 Security Tests

Security tests must prove:

- Agents cannot query databases directly.
- Agents cannot approve candidates.
- Agents cannot auto-send outreach.
- Ivory cannot mint link without BA approval.
- Journal entries remain private.
- Agent output cannot violate Telnyx boundary.
- Candidate knowledge cannot be presented as approved.
- Unapproved income and medical claims are blocked.

### 50.4 Bilingual Tests

Bilingual tests must prove:

- Steve operates in English.
- Steve operates in Spanish.
- Michael operates in English.
- Michael operates in Spanish.
- Ivory operates in English.
- Ivory operates in Spanish.
- Correct templates load by language.
- Agent responses match packet language.

---

## 51. Required Invariants

The following invariants must always hold.

1. Steve Success has agent key `steve_success`.
2. Michael Magnificent has agent key `michael_magnificent`.
3. Ivory has agent key `ivory`.
4. Every agent session has a Context Packet.
5. Agents use Context Packets as source of truth.
6. Agents do not query databases directly.
7. Agents do not approve knowledge.
8. Agents do not activate knowledge.
9. Agents do not auto-send prospect outreach.
10. Internal Browser Voice does not use Telnyx.
11. Telnyx is limited to external SMS, ringless voicemail, and future callback workflows.
12. Momentum Journal is private by default.
13. Michael teaches the Momentum Journal.
14. Knowledge Candidates are review-only.
15. Ivory invitation drafts are editable.
16. Ivory invitation drafts require BA review.
17. Guided Actions are BA-owned.
18. English is supported.
19. Spanish is supported.
20. Agent Events are emitted for runtime actions.
21. Output guardrails run before responses are returned.
22. Degraded context does not permit invented knowledge.
23. Failed context prevents substantive guidance.
24. Every Agent Runtime session state includes Team Magnificent identity scope, including `teamMagnificentId`, `teamId`, `teamKey`, and `teamName`.

---

## 52. Completion Definition

The Agent Runtime is considered Version 1.0 complete when:

- Steve, Michael, and Ivory are registered.
- Each agent has English and Spanish templates.
- Sessions can be created, continued, paused, completed, failed, and cancelled.
- Browser Voice and Browser Text input are supported.
- Context Packets are requested and validated.
- Agent state machines execute.
- Conversation turns are captured.
- Journal entries can be created privately.
- Knowledge Candidates can be proposed for review.
- Guided Actions can be created as BA-owned actions.
- Ivory can create editable invitation drafts only.
- Ivory cannot auto-send outreach.
- Output guardrails block unsafe responses.
- Agent Events are emitted.
- Telnyx is excluded from internal coaching.
- Acceptance tests pass.

---

## 53. Final Runtime Statement

The Agent Runtime is the operational home of Steve Success, Michael Magnificent, and Ivory.

It allows agents to guide Brand Ambassadors without giving agents uncontrolled authority.

It keeps knowledge in the Knowledge Core.

It keeps context assembly in the Context Manager.

It keeps private journal content private.

It keeps candidates review-only.

It keeps relationship actions owned by the Brand Ambassador.

It keeps internal Browser Voice separate from Telnyx.

It allows Steve to capture success lessons.

It allows Michael to teach and support training.

It allows Ivory to guide respectful relationship action and prepare editable drafts.

It supports English and Spanish operation.

It emits the events that allow Momentum to learn from real outcomes.

The Agent Runtime is where contextual intelligence becomes guided conversation.

The agent guides.

The Brand Ambassador decides.

The outcome teaches.

Momentum learns.

---

## Ratification

Status: RATIFIED

Ratified By: Kevin Gardner

Ratification Date: 2026-06-27

Architecture Review: PASS

Review Authority: Claude (Chief Governance Architect)

Implementation Authority: Codex

Version: 1.0.1

This document is now a canonical source-of-truth for Momentum Creation System V2.

Future modifications require an approved ACR.

### Amendment History

- **1.0.1 (2026-06-27):** Append-only contract reconciliation with `BROWSER_VOICE_RUNTIME.md` §16.3. Added optional Team Magnificent identity fields (`teamId`, `teamKey`, `teamName`) to `AddAgentSessionTurnRequest` (§31.3) and optional Browser Voice fields (`transcriptTurnId`, `browserLocale`, `transcriptHash`, `corrected`) to `BrowserTranscriptMetadata` (§15), so the Browser Voice wire payload is `AddAgentSessionTurnRequest`-compatible. No existing field changed. Re-ratified by Kevin Gardner; Architecture Review: PASS.
- **1.0.0 (2026-06-27):** Initial ratification (closed Criterion 11 Team Magnificent Boundary and Criterion 4 scope note before ratification).
