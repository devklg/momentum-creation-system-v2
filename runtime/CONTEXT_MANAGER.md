# CONTEXT_MANAGER.md

## Momentum Creation System V2

### Context Manager Runtime Specification

#### Version 1.0

---

## 1. Document Status

**Document Name:** Context Manager Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Upstream Dependencies:** Knowledge Core Runtime, Knowledge Ingestion Protocol
**Primary Downstream Consumer:** Agent Runtime
**Required Output Contract:** `context_packet.v1`
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

---

## 2. Purpose

The Context Manager is the runtime component responsible for assembling structured contextual intelligence for Momentum agents.

The Context Manager builds the `context_packet.v1` used by:

- Steve Success
- Michael Magnificent
- Ivory
- Browser Voice Runtime
- Browser Text Runtime
- Agent Runtime

Agents do not search every database directly.

Agents do not query MongoDB directly.

Agents do not query Neo4j directly.

Agents do not query Chroma directly.

Agents do not perform their own GraphRAG retrieval.

Agents request a Context Packet.

The Context Manager decides:

- What approved knowledge is relevant.
- What private context is allowed.
- What relationship context is allowed.
- What training or interview template applies.
- What language should be used.
- What runtime guardrails must be included.
- What knowledge should be excluded.
- What source references must travel with the packet.
- What retrieval audit must be preserved.
- Whether a packet is complete, degraded, or failed.

The Context Manager answers this runtime question:

> What knowledge does this agent need right now?

The Knowledge Core answers:

> What does Momentum know?

The Knowledge Ingestion Protocol answers:

> How does raw experience become structured knowledge Momentum can evaluate?

The Context Manager is the controlled bridge between organizational knowledge and agent action.

---

## 3. Runtime Philosophy

Momentum is a knowledge-centric platform.

The Context Manager transforms stored knowledge into task-ready context.

The Context Manager does not create knowledge.

The Context Manager does not approve knowledge.

The Context Manager does not conduct conversations.

The Context Manager does not replace agents.

The Context Manager does not own Brand Ambassador data.

The Context Manager assembles the right context for the right agent, at the right moment, in the right language, within the right permission boundaries.

The runtime philosophy is:

```text id="h6r2go"
Knowledge Core stores what Momentum knows.

Context Manager decides what is relevant right now.

Context Packet carries that relevance to the agent.

Agent Runtime uses the packet to guide the conversation.

Guided Action creates outcomes.

Outcomes create learning.

Learning improves the Knowledge Core.
```

The Context Manager exists because agents must not behave as uncontrolled search engines.

Agents guide Brand Ambassadors.

The Knowledge Core stores organizational understanding.

The Context Manager delivers controlled contextual intelligence.

---

## 4. Foundational Principle

The Context Manager must enforce the following principle:

```text id="nu8m7u"
Agents do not retrieve knowledge.

Agents receive context.
```

This principle protects:

- Brand Ambassador privacy
- Momentum Journal privacy
- Prospect relationship sensitivity
- Organizational governance
- Bilingual consistency
- Agent specialization
- Runtime predictability
- Source traceability
- Constitutional boundaries
- Knowledge quality

The Context Manager is responsible for ensuring that every agent receives enough context to act intelligently without receiving unrestricted access to the Knowledge Core.

---

## 5. Runtime Position

The Context Manager sits between the Knowledge Core and Agent Runtime.

```text id="ga4ylp"
Agent Runtime
  ↓
Context Request
  ↓
Context Manager
  ↓
Knowledge Core Retrieval
    ↓
    MongoDB canonical filters
    ↓
    Chroma semantic search
    ↓
    Neo4j graph traversal
    ↓
    GraphRAG result ranking
  ↓
Context scoring
  ↓
Context Packet
  ↓
Agent Runtime
```

The Context Manager is downstream of:

- Knowledge Core
- Knowledge Ingestion Protocol
- Knowledge Layer
- Governance
- AI Organization
- Agent identity definitions
- Active templates
- Runtime guardrails

The Context Manager is upstream of:

- Context Packet
- Agent Runtime
- Steve Success
- Michael Magnificent
- Ivory
- Browser Voice Runtime
- Browser Text Runtime
- Guided Action Runtime
- Learning Pipeline
- Agent Events

---

## 6. Scope

This document defines the Version 1.0 runtime specification for the Context Manager.

It defines:

- Purpose
- Responsibilities
- Non-responsibilities
- Context request contract
- Context scopes
- Required packet sections
- Retrieval layers
- Agent-specific context rules
- Ranking and scoring
- Context budget
- Privacy rules
- Candidate exclusion rules
- Bilingual behavior
- Service interfaces
- Data flow
- Runtime flow
- Failure behavior
- Degraded packets
- Events
- Audit requirements
- Security boundaries
- Acceptance criteria
- Relationship to other runtime components

This document does not define the detailed `context_packet.v1` schema.

That is defined in `CONTEXT_PACKET_SCHEMA.md`.

This document does not define Knowledge Core storage.

That is defined in `KNOWLEDGE_CORE_RUNTIME.md`.

This document does not define Knowledge Ingestion.

That is defined in `KNOWLEDGE_INGESTION_PROTOCOL.md`.

This document does not define agent scripts.

Agent scripts belong in Agent Runtime and Implementation documents.

This document does not define UI behavior.

Application-specific behavior belongs in Implementation documents.

---

## 7. Core Responsibilities

The Context Manager is responsible for the following runtime functions.

### 7.1 Receive Context Requests

The Context Manager must receive structured context requests from Agent Runtime.

A context request must identify:

- Tenant
- Brand Ambassador
- Session
- Agent
- Language
- Runtime mode
- Task type
- Current state
- Requested scopes
- User input when available
- Maximum context budget
- Private journal inclusion request
- Candidate inclusion request
- Relationship context need
- Guided action context need

### 7.2 Validate Request

The Context Manager must validate that the request is complete, authorized, and consistent with runtime rules.

Validation includes:

- Required identifiers are present.
- Agent key is valid.
- Brand Ambassador scope is valid.
- Session scope is valid.
- Language is supported.
- Runtime mode is supported.
- Task type is supported.
- Requested scopes are allowed for the agent.
- Private journal access is authorized.
- Relationship context access is authorized.
- Candidate access is excluded unless review workflow explicitly permits it.
- Telnyx boundary is enforced.

### 7.3 Retrieve Mandatory Runtime Context

The Context Manager must always include mandatory runtime context.

Mandatory runtime context includes:

- Agent identity
- Session language
- Runtime mode
- Telnyx boundary
- Journal privacy rule
- Brand Ambassador-owned action rule
- Active template state when available
- Constitutional guardrails
- Governance constraints
- Agent scope boundaries
- Candidate exclusion rule
- Source traceability rule
- Bilingual fallback rule

Mandatory runtime context must be included even when retrieval is degraded.

### 7.4 Retrieve Approved Knowledge

The Context Manager must retrieve approved, active knowledge from the Knowledge Core.

Approved knowledge retrieval must use Knowledge Core interfaces.

The Context Manager must never retrieve active knowledge directly from MongoDB, Neo4j, or Chroma.

Approved knowledge must be filtered by:

- Domain
- Agent
- Task type
- Language
- Governance status
- Lifecycle status
- Permission scope
- Visibility
- Source traceability
- Relevance
- Context budget

### 7.5 Retrieve Private Brand Ambassador Context

The Context Manager may retrieve private Brand Ambassador context only when authorized.

Private context may include:

- Brand Ambassador profile
- Current session summary
- Recent session turns
- Momentum Journal snippets
- Brand Ambassador-owned guided action history
- Brand Ambassador-owned training state
- Brand Ambassador-owned success context
- Brand Ambassador-entered relationship context

Private context must not be retrieved for another Brand Ambassador.

Private context must not be shared with external runtime unless explicitly authorized by a ratified workflow.

### 7.6 Retrieve Relationship Context

The Context Manager may retrieve relationship context when the task requires it.

Relationship context is person-sensitive.

Relationship context must be scoped by:

- Brand Ambassador
- Prospect
- Relationship permission
- Agent role
- Task type
- Current session
- Visibility
- Communication sensitivity

Relationship context must be especially controlled for Ivory because Ivory works with opportunity maps, invitations, follow-up, and prospect context.

### 7.7 Retrieve Template Context

The Context Manager must retrieve the active template required for the current task.

Templates may include:

- Success interview template
- Training support template
- Journal teaching template
- Relationship coaching template
- Invitation drafting template
- Session resume template
- Guided action review template

The Context Manager must include only the relevant active template state needed for the current task.

### 7.8 Score and Rank Context

The Context Manager must rank retrieved context using consistent scoring rules.

Ranking must consider:

- Agent domain relevance
- Task relevance
- Semantic similarity
- Graph relevance
- Language match
- Outcome usefulness
- Safety score
- Source strength
- Recency
- Brand Ambassador relevance
- Relationship relevance
- Template relevance
- Governance validity
- Context budget

### 7.9 Enforce Context Budget

The Context Manager must fit retrieved material into a defined context budget.

It must prefer:

- Summaries over full transcripts
- Active templates over old templates
- Approved knowledge over general background
- Current session state over distant history
- High-relevance private context over low-relevance private context
- Outcome-validated knowledge over unvalidated knowledge

The Context Manager must avoid flooding agents with unnecessary context.

### 7.10 Assemble Context Packet

The Context Manager must assemble `context_packet.v1`.

The packet must include:

- Tenant section
- Brand Ambassador section
- Session section
- Agent section
- Language section
- Runtime rules section
- Guardrails section
- Active template section
- Approved knowledge section
- Private context section
- Journal context section
- Relationship context section
- Guided actions section
- Exclusions section
- Retrieval audit section
- Packet status section

### 7.11 Record Context Packet

Every generated Context Packet must be recorded for traceability.

The record must include:

- Request ID
- Packet ID
- Agent key
- Brand Ambassador ID
- Session ID
- Language
- Task type
- Included knowledge IDs
- Excluded knowledge references or exclusion reasons
- Private context inclusion status
- Candidate exclusion status
- Language fallback status
- Packet status
- Timestamp

### 7.12 Emit Context Events

The Context Manager must emit runtime events for request, retrieval, packet creation, delivery, degradation, failure, private journal inclusion, candidate exclusion, and language fallback.

---

## 8. Non-Responsibilities

The Context Manager must not perform responsibilities assigned to other runtime components.

### 8.1 It Does Not Store Canonical Knowledge

The Knowledge Core stores canonical knowledge.

### 8.2 It Does Not Ingest Knowledge

The Knowledge Ingestion Protocol captures and prepares knowledge.

### 8.3 It Does Not Approve Knowledge

Governance, review workflows, and Knowledge Sessions approve knowledge.

### 8.4 It Does Not Activate Knowledge

The Knowledge Core lifecycle system activates knowledge.

### 8.5 It Does Not Conduct Conversations

Agent Runtime and agents conduct conversations.

### 8.6 It Does Not Generate Final Agent Responses

The Context Manager assembles context.

Agents generate responses from Context Packets.

### 8.7 It Does Not Give Agents Raw Database Access

Agents receive packets only.

### 8.8 It Does Not Promote Journal Knowledge

Momentum Journal promotion happens through authorized Knowledge Ingestion and review workflows.

### 8.9 It Does Not Treat Candidate Knowledge as Approved

Candidate knowledge is excluded by default.

### 8.10 It Does Not Replace Learning Pipeline

The Learning Pipeline evaluates outcomes and produces learning signals.

The Context Manager may include outcome-linked knowledge but does not evaluate outcomes itself.

---

## 9. Context Request Contract

The Context Manager must accept a structured `ContextRequest`.

### 9.1 Context Request Interface

```ts id="8h1l8g"
interface ContextRequest {
  requestId: string;

  tenantId: string;
  baId: string;
  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  language: "en" | "es";

  mode: "browser_voice" | "browser_text" | "mixed";

  taskType:
    | "success_interview"
    | "training_support"
    | "journal_teaching"
    | "relationship_coaching"
    | "invitation_drafting"
    | "session_resume"
    | "guided_action_review";

  userInput?: string;

  currentState?: string;

  requestedScopes: ContextScope[];

  maxTokens?: number;

  includePrivateJournal?: boolean;

  includeCandidates?: boolean;

  prospectId?: string;

  guidedActionId?: string;

  workflowId?: string;

  correlationId?: string;

  metadata?: Record<string, unknown>;
}
```

### 9.2 Context Scope Type

```ts id="5iml6a"
type ContextScope =
  | "agent_instructions"
  | "approved_knowledge"
  | "ba_profile"
  | "session_history"
  | "private_journal"
  | "relationship_context"
  | "training_templates"
  | "interview_templates"
  | "guided_actions"
  | "compliance_boundaries"
  | "runtime_rules"
  | "language_rules"
  | "outcome_linked_knowledge";
```

### 9.3 Request Requirements

Every request must include:

- `requestId`
- `tenantId`
- `baId`
- `sessionId`
- `agentKey`
- `language`
- `mode`
- `taskType`
- `requestedScopes`

### 9.4 Request Validation Rules

The Context Manager must reject or degrade requests when:

- Required identifiers are missing.
- Agent key is invalid.
- Language is unsupported.
- Runtime mode is unsupported.
- Task type is unsupported.
- Requested scope is invalid.
- Agent is not allowed to access requested scope.
- Private journal is requested without Brand Ambassador ownership.
- Relationship context is requested without valid scope.
- Candidate knowledge is requested outside authorized review context.
- Telnyx is implied for internal Browser Voice.

---

## 10. Required Packet Output

The Context Manager returns `context_packet.v1`.

The complete schema is defined in `CONTEXT_PACKET_SCHEMA.md`.

This document defines the minimum required sections.

### 10.1 Minimum Packet Sections

Every `context_packet.v1` must include:

```text id="688fzh"
tenant
brandAmbassador
session
agent
language
runtimeRules
guardrails
activeTemplate
approvedKnowledge
privateContext
journalContext
relationshipContext
guidedActions
exclusions
retrievalAudit
packetStatus
```

### 10.2 Packet Status

A packet must have one of these statuses:

```ts id="j2lcfx"
type ContextPacketStatus = "complete" | "degraded" | "failed";
```

### 10.3 Complete Packet

A complete packet includes all mandatory runtime context and all required task-specific context within budget.

### 10.4 Degraded Packet

A degraded packet includes mandatory runtime context but lacks some requested or expected retrieval results.

Degraded packets must include:

- Reason for degradation
- Missing sections
- Safe agent instruction
- Retrieval audit
- Clarifying question guidance where needed

### 10.5 Failed Packet

A failed packet cannot safely support the agent task.

A failed packet must include:

- Failure reason
- Safe fallback instruction
- No invented knowledge
- Audit event
- Retry guidance where appropriate

---

## 11. Retrieval Layers

The Context Manager retrieves context through ordered layers.

### 11.1 Layer 1: Mandatory Runtime Context

Mandatory runtime context is always included.

It includes:

- Agent identity
- Agent role boundaries
- Session language
- Runtime mode
- Telnyx boundary
- Journal privacy rule
- Brand Ambassador-owned action rule
- Candidate exclusion rule
- Source traceability rule
- Active template state
- Compliance boundaries
- Constitutional guardrails
- Bilingual behavior rules

Mandatory runtime context is included even if Knowledge Core retrieval fails.

### 11.2 Layer 2: Agent-Domain Knowledge

Each agent has a primary domain.

```text id="94aon4"
Steve Success
  Primary Domain: success

Michael Magnificent
  Primary Domain: training

Ivory
  Primary Domain: relationship
```

The Context Manager must retrieve primary domain knowledge first.

### 11.3 Layer 3: Cross-Domain Support

Cross-domain support is allowed only when relevant to the task.

Examples:

- Michael may need success context to personalize training.
- Ivory may need success context to match invitation style.
- Steve may need performance history to evaluate momentum.
- Michael may need journal context to teach journal usage.
- Ivory may need approved training knowledge when explaining invitation principles.

Cross-domain retrieval must be justified by reason codes.

### 11.4 Layer 4: Private Brand Ambassador Context

Private BA context may include:

- BA profile
- Current session summary
- Recent session turns
- BA-owned journal snippets
- BA-entered relationship context
- BA-owned guided action history
- Training state
- Momentum history

Private context requires permission validation.

### 11.5 Layer 5: Outcome-Linked Knowledge

Outcome-linked knowledge may be ranked higher when it has demonstrated usefulness.

Outcome-linked knowledge may include:

- Guidance that produced completed action
- Training that improved readiness
- Invitation guidance that produced a response
- Journal prompt that increased consistency
- Coaching pattern that improved momentum

Outcome-linked knowledge must still be approved and active before being used as agent guidance.

### 11.6 Layer 6: Exclusion and Safety Review

Before packet assembly, the Context Manager must remove:

- Candidate knowledge unless explicitly authorized for review workflow
- Rejected knowledge
- Archived knowledge
- Superseded knowledge unless requested for history
- Private journal content not owned by the BA
- Relationship context outside permission scope
- Unapproved translations
- Knowledge without source traceability
- Knowledge that violates agent scope
- Knowledge beyond context budget

---

## 12. Context Ranking

The Context Manager must score retrieved items before inclusion.

### 12.1 Retrieval Score Interface

```ts id="kn5pwf"
interface RetrievalScore {
  semanticSimilarity: number;
  graphRelevance: number;
  domainMatch: number;
  languageMatch: number;
  outcomeUsefulness: number;
  safetyScore: number;
  recencyScore: number;
  sourceStrength: number;
  taskRelevance: number;
  finalScore: number;
}
```

### 12.2 Scoring Dimensions

#### semanticSimilarity

Measures conceptual similarity between the current task or user input and retrieved knowledge.

#### graphRelevance

Measures graph proximity to the Brand Ambassador, prospect, session, agent, task, or workflow.

#### domainMatch

Measures whether the knowledge belongs to the agent's primary or allowed secondary domain.

#### languageMatch

Measures whether the knowledge is in the requested language or an approved fallback.

#### outcomeUsefulness

Measures whether prior outcomes support the usefulness of the knowledge.

#### safetyScore

Measures whether the item is safe to include based on governance, permission, lifecycle, and privacy rules.

#### recencyScore

Measures whether the item is current enough for the task.

#### sourceStrength

Measures the reliability of source lineage.

#### taskRelevance

Measures direct relevance to the current task type.

### 12.3 Final Score

The final score must combine relevance, safety, and task need.

Safety must never be outweighed by relevance.

A high semantic score cannot override permission failure.

A high graph score cannot override privacy.

A high outcome usefulness score cannot override governance.

### 12.4 MVP Ranking Rule

The MVP may use simpler ranking rules.

However, every included item must preserve:

- Source ID
- Knowledge object ID when applicable
- Reason codes
- Language
- Domain
- Permission scope
- Inclusion reason
- Retrieval timestamp

---

## 13. Retrieval Reason Codes

Every included context item must include one or more reason codes.

### 13.1 Retrieval Reason Code Type

```ts id="cgy0xe"
type RetrievalReasonCode =
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
  | "runtime_rule_required";
```

### 13.2 Required Reason Codes

Mandatory runtime context must use:

- `agent_identity_required`
- `runtime_rule_required`
- `compliance_boundary_required`

Approved knowledge must include at least one of:

- `same_agent_domain`
- `semantic_match`
- `graph_neighbor`
- `outcome_validated`
- `fallback_general_training`

Private context must include:

- `ba_owned_private_context`

Relationship context must include:

- `relationship_context_match`

Templates must include:

- `active_interview_template`

Language fallback must include:

- `language_fallback_used`

---

## 14. Context Budget

The Context Manager must respect a context budget.

The goal is to give agents useful context, not excessive context.

### 14.1 MVP Budget Table

| Section                  |                        MVP Maximum |
| ------------------------ | ---------------------------------: |
| Active template          |                                  1 |
| Approved knowledge       |                          5-8 items |
| Recent session turns     |                         8-12 turns |
| Private journal snippets |                         3 snippets |
| Relationship contexts    |                            3 items |
| Guided actions           |                            3 items |
| Outcome-linked knowledge |                            3 items |
| Guardrail blocks         |                   Required minimum |
| Exclusions               | All relevant exclusions summarized |
| Retrieval audit          |  Complete metadata, compact format |

### 14.2 Budget Rules

The Context Manager must:

- Prefer summaries over full transcripts.
- Prefer active templates over outdated templates.
- Prefer approved knowledge over candidate knowledge.
- Prefer high-relevance context over broad background.
- Prefer current session state over distant history.
- Prefer source-traced items over weakly sourced items.
- Prefer same-language knowledge over fallback language.
- Preserve enough audit metadata for traceability.

### 14.3 Budget Overflow

When context exceeds budget, the Context Manager must:

1. Keep mandatory runtime rules.
2. Keep active template.
3. Keep safety guardrails.
4. Keep agent-domain knowledge.
5. Keep task-critical private context.
6. Keep task-critical relationship context.
7. Summarize recent session history.
8. Exclude low-score knowledge.
9. Record exclusions in retrieval audit.

---

## 15. Privacy Rules

Privacy is enforced before packet assembly.

### 15.1 Organizational Knowledge Rule

Organizational knowledge must be:

- Active
- Approved where required
- Not rejected
- Not archived
- Not superseded unless historical retrieval is requested
- Source-traced
- Permission-valid
- Language-valid

### 15.2 Candidate Knowledge Rule

Candidate knowledge is excluded by default.

Candidate knowledge may only be included when:

- The request is part of an authorized review workflow.
- The request explicitly allows candidates.
- The actor has reviewer permission.
- The packet marks the content as candidate/review-only.
- The agent is operating in review support mode, not Brand Ambassador guidance mode.

For Version 1.0 Brand Ambassador-facing agent guidance, candidates are excluded.

### 15.3 Private Journal Rule

Private Momentum Journal context requires:

- Brand Ambassador ownership
- Explicit request or task relevance
- Scope validation
- Packet marking as private context
- Exclusion from external runtime
- Audit record when included

Private journal context must not be included for another Brand Ambassador.

Private journal context must not be used as organizational knowledge.

### 15.4 Relationship Context Rule

Relationship context is Brand Ambassador-owned and person-sensitive.

It may include prospect information only when:

- Prospect scope is valid.
- Brand Ambassador owns or is authorized for the relationship context.
- The task requires relationship context.
- Agent role permits it.
- The packet marks it as relationship context.
- Sensitive notes are minimized or summarized.

### 15.5 External Runtime Rule

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

Telnyx may be used only for external runtime.

External runtime must not receive private Momentum Journal content.

External runtime must not receive unrestricted internal context.

External runtime may receive only communication-specific context required for the approved workflow.

### 15.6 Internal Browser Voice Rule

Browser Voice Runtime is internal.

Browser Voice Runtime does not use Telnyx.

Context Packets for Browser Voice must include the Telnyx boundary.

---

## 16. Bilingual Behavior

The Context Manager must support English and Spanish.

### 16.1 Language Priority

The Context Manager must follow this language priority:

```text id="hslk8s"
1. Same-language approved knowledge
2. Human-reviewed translation
3. Marked machine translation
4. Language-neutral template
5. Ask clarifying question
```

### 16.2 English Packet Requirements

For English requests, the Context Manager should prioritize:

- English approved knowledge
- English active templates
- English guardrails
- English private context
- English relationship context

Spanish source material may be included only when relevant and marked appropriately.

### 16.3 Spanish Packet Requirements

For Spanish requests, the Context Manager should prioritize:

- Spanish approved knowledge
- Spanish active templates
- Spanish guardrails
- Spanish private context
- Spanish relationship context

English source material may be included only when:

- Spanish approved equivalent is unavailable.
- Fallback is allowed.
- The item is marked as fallback.
- The agent is instructed not to present unreviewed translation as approved wording.

### 16.4 Machine Translation Rule

Machine translation may be included only when marked.

Machine translation must not be represented as reviewed or approved.

When relying on machine translation, the packet must include:

- Translation status
- Source language
- Fallback reason
- Agent instruction to be cautious

### 16.5 Clarifying Question Rule

If language ambiguity prevents safe guidance, the Context Manager must instruct the agent to ask a clarifying question.

---

## 17. Agent-Specific Context Rules

Each agent receives context appropriate to its runtime identity.

### 17.1 Steve Success Context Rules

Steve Success focuses on Brand Ambassador success, confidence, motivation, goals, momentum, obstacles, and daily action.

Steve's packet should include:

- Steve agent identity
- Success interview template
- Current success interview state
- Brand Ambassador success profile
- Recent success/action context
- Goals and motivation
- Confidence and momentum signals
- Support needs
- Approved Success Knowledge
- Relevant guided action history
- Journal prompt options when relevant
- Guardrails
- Runtime rules
- Exclusions
- Retrieval audit

Steve may receive cross-domain context when:

- Training state affects success guidance.
- Guided action history affects momentum.
- Journal context is explicitly requested.
- Relationship context is needed for a success action review.

Steve must not receive unrestricted relationship CRM data.

Steve must not receive private journal content unless BA-owned and relevant.

### 17.2 Michael Magnificent Context Rules

Michael Magnificent focuses on training, onboarding, skill development, duplication, system usage, and Momentum Journal teaching.

Michael's packet should include:

- Michael agent identity
- Training support template
- Journal teaching template when relevant
- Training profile
- Onboarding state
- Current system action
- Learning style
- Skill gaps
- Training progress
- Momentum Journal teaching knowledge
- Approved Training Knowledge
- Relevant Success Knowledge for personalization
- Recent training session context
- Guided action history related to training
- Guardrails
- Runtime rules
- Exclusions
- Retrieval audit

Michael may receive private journal context only when:

- The Brand Ambassador owns it.
- The task is journal teaching or training support.
- The request explicitly allows it or the workflow requires it.
- The packet marks it as private.

Michael may suggest journal usage.

Michael may not promote journal content without Brand Ambassador action.

### 17.3 Ivory Context Rules

Ivory focuses on relationships, Opportunity Map, prospect context, invitations, follow-up, tone, and relationship-centered guidance.

Ivory's packet should include:

- Ivory agent identity
- Relationship coaching template
- Invitation drafting template when relevant
- BA-provided relationship context
- Prospect context when scoped
- Relationship history
- Communication preferences
- Invitation tone principles
- Editable draft guardrails
- Invitation spine state when needed
- Approved Relationship Knowledge
- Relevant guided action history
- PMV engagement context when available
- SMS / voicemail / callback activity when relevant and scoped
- Guardrails
- Runtime rules
- Exclusions
- Retrieval audit

Ivory may receive cross-domain context when:

- Success profile affects relationship approach.
- Training knowledge affects invitation coaching.
- Guided action history affects next follow-up.
- Outcome-linked knowledge improves relationship guidance.

Ivory must not receive private journal entries unless BA-owned and directly relevant.

Ivory must not expose prospect private data beyond the authorized relationship context.

---

## 18. Task-Specific Context Rules

### 18.1 Success Interview

Required context:

- Steve identity
- Success interview template
- BA profile if available
- Recent success session history
- Approved success knowledge
- Runtime rules
- Journal privacy rule
- Guided action rule
- Guardrails

Excluded by default:

- Candidate knowledge
- Relationship details unrelated to success
- Private journal snippets unless requested

### 18.2 Training Support

Required context:

- Michael identity
- Training support template
- Training profile
- Current training state
- Approved training knowledge
- Relevant system usage knowledge
- Recent training session history
- Guardrails

Optional context:

- Success profile for personalization
- Journal context if BA-owned and relevant

### 18.3 Journal Teaching

Required context:

- Michael identity
- Momentum Journal teaching knowledge
- Journal privacy rule
- Journal prompt options
- Private journal handling rule
- Approved training knowledge
- Guardrails

Private journal inclusion requires BA ownership.

### 18.4 Relationship Coaching

Required context:

- Ivory identity
- Relationship coaching template
- BA-owned relationship context
- Prospect context when scoped
- Approved relationship knowledge
- Communication boundaries
- Guardrails

Optional context:

- Success profile
- Recent guided actions
- PMV engagement

### 18.5 Invitation Drafting

Required context:

- Ivory identity
- Invitation drafting template
- Editable draft guardrails
- Relationship tone principles
- Prospect context when scoped
- Approved relationship knowledge
- Communication boundaries
- Runtime rules

The packet must instruct the agent that drafts are editable and should preserve the Brand Ambassador's voice.

### 18.6 Session Resume

Required context:

- Agent identity
- Recent session summary
- Current state
- Last completed step
- Next expected step
- Active template
- Guardrails

### 18.7 Guided Action Review

Required context:

- Agent identity
- Guided action history
- Outcome records
- Relevant approved knowledge
- Performance context
- Next-step rules
- Guardrails

---

## 19. Mandatory Runtime Rules

Every Context Packet must include mandatory runtime rules.

### 19.1 Required Runtime Rules

```text id="j8aaz7"
Agents receive Context Packets only.

Agents do not query MongoDB directly.

Agents do not query Neo4j directly.

Agents do not query Chroma directly.

Agents do not perform direct GraphRAG retrieval.

Private Momentum Journal content remains private unless intentionally promoted.

Candidate knowledge is excluded from Brand Ambassador guidance by default.

Organizational knowledge must be active before use as guidance.

Brand Ambassador actions remain Brand Ambassador-owned.

Agents guide; Brand Ambassadors decide and act.

Internal Browser Voice does not use Telnyx.

Telnyx is limited to external runtime workflows: SMS, ringless voicemail, and future callback workflows.

English and Spanish are first-class runtime languages.

Every knowledge item used must preserve source traceability.
```

---

## 20. Guardrails

The Context Manager must include guardrails appropriate to the agent and task.

### 20.1 Universal Guardrails

Every packet must include:

- Do not invent knowledge.
- Do not claim unapproved knowledge as approved.
- Do not expose private journal content.
- Do not expose prospect-sensitive information beyond scope.
- Do not bypass governance.
- Do not treat candidate knowledge as active guidance.
- Do not imply agent autonomy over Brand Ambassador action.
- Do not use Telnyx for internal Browser Voice.
- Do not produce unsupported claims.
- Ask clarifying questions when required context is missing.

### 20.2 Agent Guardrails

Steve-specific guardrails:

- Keep success guidance scoped to BA success and momentum.
- Do not provide relationship-specific coaching unless context permits.
- Do not treat motivation patterns as universal truth.

Michael-specific guardrails:

- Keep training guidance practical and duplicable.
- Do not promote journal content without consent.
- Do not treat training confusion as failure.

Ivory-specific guardrails:

- Respect relationship sensitivity.
- Preserve Brand Ambassador voice in invitations.
- Do not overstate prospect interest.
- Do not expose private prospect details unnecessarily.

### 20.3 Compliance Boundaries

The Context Manager must include compliance boundaries when relevant.

These may include:

- Income claim caution
- Medical claim caution
- Unverified claim caution
- External communication sensitivity
- Prospect privacy caution
- Training standard caution
- Bilingual translation caution

---

## 21. Exclusions

The Context Manager must explicitly track excluded context.

### 21.1 Exclusion Reasons

```ts id="q3k88t"
type ContextExclusionReason =
  | "candidate_excluded_by_default"
  | "permission_denied"
  | "private_journal_not_requested"
  | "private_journal_not_owned_by_ba"
  | "relationship_context_out_of_scope"
  | "knowledge_not_active"
  | "knowledge_not_approved"
  | "knowledge_superseded"
  | "knowledge_archived"
  | "language_not_available"
  | "unapproved_translation"
  | "outside_agent_domain"
  | "outside_task_scope"
  | "context_budget_exceeded"
  | "low_relevance_score"
  | "missing_source_traceability";
```

### 21.2 Exclusion Record

```ts id="5mbbb1"
interface ContextExclusion {
  itemId?: string;
  itemType:
    | "knowledge_object"
    | "knowledge_candidate"
    | "journal_entry"
    | "relationship_context"
    | "session_history"
    | "template"
    | "guided_action"
    | "translation";

  reason: ContextExclusionReason;

  explanation: string;
}
```

### 21.3 Required Exclusion Events

The Context Manager must emit `context.candidate.excluded` when candidate knowledge is excluded.

The Context Manager must include exclusion summaries in the retrieval audit.

---

## 22. Retrieval Audit

Every Context Packet must include retrieval audit metadata.

### 22.1 Retrieval Audit Requirements

Retrieval audit must include:

- Request ID
- Packet ID
- Agent key
- Brand Ambassador ID
- Session ID
- Language
- Task type
- Requested scopes
- Included item IDs
- Excluded item records
- Retrieval scores
- Reason codes
- Knowledge Core request IDs
- Language fallback status
- Private journal inclusion status
- Candidate exclusion status
- Packet status
- Generated timestamp

### 22.2 Retrieval Audit Model

```ts id="4zpc5x"
interface ContextRetrievalAudit {
  requestId: string;
  packetId: string;

  tenantId: string;
  baId: string;
  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  language: "en" | "es";

  taskType: ContextRequest["taskType"];

  requestedScopes: ContextScope[];

  knowledgeCoreRequestIds: string[];

  includedItems: ContextIncludedAuditItem[];

  exclusions: ContextExclusion[];

  languageFallbackUsed: boolean;

  privateJournalIncluded: boolean;

  candidateKnowledgeIncluded: boolean;

  candidateKnowledgeExcluded: boolean;

  packetStatus: ContextPacketStatus;

  generatedAt: Date;
}
```

### 22.3 Included Audit Item

```ts id="e450kg"
interface ContextIncludedAuditItem {
  itemId: string;
  itemType:
    | "approved_knowledge"
    | "private_context"
    | "journal_context"
    | "relationship_context"
    | "template"
    | "guided_action"
    | "runtime_rule"
    | "guardrail";

  sourceId?: string;
  knowledgeObjectId?: string;

  reasonCodes: RetrievalReasonCode[];

  score?: RetrievalScore;

  language: "en" | "es";

  permissionScope: string[];

  includedAt: Date;
}
```

---

## 23. Service Interface

The Context Manager must expose an internal service interface.

### 23.1 Context Manager Service

```ts id="rpkvxv"
interface ContextManagerService {
  buildContextPacket(request: ContextRequest): Promise<ContextPacketV1>;

  retrieveApprovedKnowledge(
    request: ContextRetrievalRequest
  ): Promise<ContextKnowledgeItem[]>;

  retrievePrivateJournalContext(
    request: PrivateJournalContextRequest
  ): Promise<PrivateJournalContextItem[]>;

  retrieveRelationshipContext(
    request: RelationshipContextRequest
  ): Promise<RelationshipContextItem[]>;

  retrieveTemplateContext(
    request: TemplateContextRequest
  ): Promise<TemplateContextItem | null>;

  retrieveGuidedActionContext(
    request: GuidedActionContextRequest
  ): Promise<GuidedActionContextItem[]>;

  recordContextPacket(packet: ContextPacketV1): Promise<void>;

  emitContextEvents(packet: ContextPacketV1): Promise<void>;
}
```

### 23.2 Context Retrieval Request

```ts id="ixwhge"
interface ContextRetrievalRequest {
  requestId: string;
  tenantId: string;
  baId: string;
  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  taskType: ContextRequest["taskType"];

  language: "en" | "es";

  domains: KnowledgeDomain[];

  userInput?: string;
  currentState?: string;

  maxItems: number;

  allowLanguageFallback: boolean;

  includeOutcomeLinked: boolean;

  requestedScopes: ContextScope[];
}
```

### 23.3 Context Knowledge Item

```ts id="q12aah"
interface ContextKnowledgeItem {
  knowledgeObjectId: string;
  sourceId: string;

  title: string;
  summary: string;
  excerpt?: string;

  domain: KnowledgeDomain[];

  language: "en" | "es";

  reasonCodes: RetrievalReasonCode[];

  score: RetrievalScore;

  governanceStatus: "approved";
  lifecycleStatus: "active";

  sourceTraceability: {
    sourceType: string;
    sourceId: string;
    capturedAt?: Date;
  };
}
```

### 23.4 Private Journal Context Request

```ts id="s0t3bq"
interface PrivateJournalContextRequest {
  requestId: string;
  tenantId: string;
  baId: string;
  sessionId: string;

  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  language: "en" | "es";

  taskType: ContextRequest["taskType"];

  maxItems: number;

  explicitRequest: boolean;
}
```

### 23.5 Private Journal Context Item

```ts id="kracwy"
interface PrivateJournalContextItem {
  journalEntryId: string;
  baId: string;

  summary: string;
  excerpt?: string;

  language: "en" | "es";

  visibility: "private_to_ba";

  reasonCodes: RetrievalReasonCode[];

  includedBecause: string;
}
```

### 23.6 Relationship Context Request

```ts id="fq74do"
interface RelationshipContextRequest {
  requestId: string;
  tenantId: string;
  baId: string;
  sessionId: string;

  prospectId?: string;

  agentKey: "ivory" | "steve_success" | "michael_magnificent";

  taskType: ContextRequest["taskType"];

  language: "en" | "es";

  maxItems: number;
}
```

### 23.7 Relationship Context Item

```ts id="fi6y67"
interface RelationshipContextItem {
  relationshipContextId: string;
  baId: string;
  prospectId?: string;

  summary: string;
  relevantFacts: string[];

  communicationPreferences?: string[];

  relationshipStage?: string;

  sensitivity: "low" | "medium" | "high";

  language: "en" | "es";

  reasonCodes: RetrievalReasonCode[];
}
```

### 23.8 Template Context Request

```ts id="f8f2ff"
interface TemplateContextRequest {
  requestId: string;
  tenantId: string;
  agentKey: "steve_success" | "michael_magnificent" | "ivory";

  taskType: ContextRequest["taskType"];

  language: "en" | "es";

  currentState?: string;
}
```

### 23.9 Template Context Item

```ts id="ds8s6v"
interface TemplateContextItem {
  templateId: string;
  templateType:
    | "success_interview"
    | "training_support"
    | "journal_teaching"
    | "relationship_coaching"
    | "invitation_drafting"
    | "session_resume"
    | "guided_action_review";

  version: string;

  language: "en" | "es";

  activeState?: string;

  instructions: string[];

  requiredSteps?: string[];

  reasonCodes: RetrievalReasonCode[];
}
```

---

## 24. Events

The Context Manager must publish and consume runtime events.

### 24.1 Events Published by Context Manager

```text id="45uxvv"
context.requested
context.validation.completed
context.retrieval.started
context.retrieval.completed
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

### 24.2 Events Consumed by Context Manager

```text id="gqew9z"
agent.context.requested
agent.session.started
agent.session.resumed
browser_voice.session.started
browser_text.session.started
guided_action.review_requested
knowledge.object.updated
knowledge.object.activated
knowledge.object.superseded
journal.entry.created
relationship.context.updated
training.state.updated
outcome.recorded
```

### 24.3 Event Envelope

```ts id="n1fip6"
interface RuntimeEventEnvelope<TPayload> {
  eventId: string;
  eventType: string;

  occurredAt: Date;
  producedBy: string;

  tenantId: string;

  correlationId?: string;
  causationId?: string;

  actor?: {
    actorType: "brand_ambassador" | "agent" | "system" | "admin";
    actorId: string;
  };

  payload: TPayload;
}
```

---

## 25. Failure Behavior

The Context Manager must fail safely.

It must never invent knowledge to compensate for retrieval failure.

### 25.1 Degraded Retrieval

If approved knowledge retrieval fails but mandatory runtime context and active template are available, the Context Manager must:

- Return a degraded packet.
- Include mandatory runtime rules.
- Include active template if available.
- Include safe guardrails.
- Mark missing retrieval sections.
- Instruct the agent to ask clarifying questions.
- Emit `context.packet.degraded`.
- Record retrieval audit.

### 25.2 Private Context Failure

If private journal retrieval fails, the Context Manager must:

- Continue without private journal context when safe.
- Mark private journal context as unavailable.
- Avoid inventing journal content.
- Emit degraded event if the task required journal context.

### 25.3 Relationship Context Failure

If relationship context retrieval fails, the Context Manager must:

- Continue only if the task can be safely performed without relationship context.
- Otherwise return a degraded or failed packet.
- Instruct the agent to ask for relationship details.
- Avoid inventing prospect details.

### 25.4 Template Failure

If active template retrieval fails, the Context Manager must:

- Return degraded packet when a safe generic task boundary exists.
- Return failed packet when the task requires a specific template.
- Instruct the agent not to proceed with structured interview flow without the required template.

### 25.5 Candidate Inclusion Attempt

If candidate knowledge is requested outside an authorized review workflow, the Context Manager must:

- Exclude candidate knowledge.
- Record exclusion.
- Emit `context.candidate.excluded`.
- Continue with approved knowledge only.

### 25.6 Complete Failure

If mandatory runtime context cannot be assembled, the Context Manager must:

- Return failed status.
- Emit `context.packet.failed`.
- Instruct Agent Runtime not to proceed with guidance.
- Record safe failure audit.

---

## 26. Error Types

```ts id="gxtbjc"
type ContextManagerErrorType =
  | "invalid_request"
  | "permission_denied"
  | "unsupported_language"
  | "unsupported_agent"
  | "unsupported_task_type"
  | "knowledge_retrieval_failed"
  | "private_journal_retrieval_failed"
  | "relationship_context_retrieval_failed"
  | "template_retrieval_failed"
  | "packet_assembly_failed"
  | "context_budget_exceeded"
  | "candidate_access_denied"
  | "language_fallback_failed"
  | "audit_record_failed"
  | "event_emit_failed";
```

### 26.1 Error Model

```ts id="dbvnvn"
interface ContextManagerError {
  errorId: string;
  requestId: string;

  errorType: ContextManagerErrorType;

  message: string;
  safeMessage: string;

  retryable: boolean;

  packetStatus: "degraded" | "failed";

  occurredAt: Date;

  metadata?: Record<string, unknown>;
}
```

---

## 27. Security Requirements

### 27.1 Agent Database Isolation

Agents must not receive credentials or direct access to:

- MongoDB
- Neo4j
- Chroma
- GraphRAG service
- Knowledge Core write interfaces
- Knowledge Ingestion write interfaces

### 27.2 Packet-Only Agent Rule

Agents may only use information included in their Context Packet or provided by the active user in the current session.

### 27.3 Private Journal Security

Private journal context must be:

- Owner-scoped
- Explicitly marked
- Audited when included
- Excluded from external runtime
- Excluded from organizational guidance
- Excluded when ownership cannot be validated

### 27.4 Relationship Security

Relationship context must be:

- BA-scoped
- Prospect-scoped when applicable
- Summarized where possible
- Sensitive-data minimized
- Excluded when scope is unclear
- Audited when included

### 27.5 Candidate Security

Candidate knowledge must be:

- Excluded by default
- Included only in authorized review mode
- Marked as candidate when included
- Never represented as approved guidance

### 27.6 Bilingual Security

Unreviewed translations must be marked.

Machine translations must not be treated as approved knowledge.

Language fallback must be audited.

---

## 28. Observability

The Context Manager must expose operational observability.

### 28.1 Required Metrics

The implementation must track:

- Context requests received
- Context requests by agent
- Context requests by task type
- Context requests by language
- Complete packets created
- Degraded packets created
- Failed packets
- Average packet build time
- Knowledge retrieval latency
- Private journal inclusion count
- Relationship context inclusion count
- Candidate exclusion count
- Language fallback count
- Permission denial count
- Context budget overflow count
- Retrieval item count by section

### 28.2 Required Logs

The implementation must log:

- Context request received
- Request validation result
- Retrieval started
- Retrieval completed
- Packet created
- Packet delivered
- Packet degraded
- Packet failed
- Private journal included
- Relationship context included
- Candidate excluded
- Language fallback used
- Audit recorded

### 28.3 Required Health Checks

The Context Manager must expose health checks for:

- Knowledge Core retrieval availability
- Template retrieval availability
- Journal retrieval availability
- Relationship context retrieval availability
- Event bus availability
- Packet persistence availability
- Context audit persistence availability

---

## 29. Persistence Requirements

The Context Manager must persist packet records and audits.

### 29.1 Required Collections

Version 1.0 requires these collections:

```text id="hpp260"
context_requests
context_packets
context_retrieval_audits
context_events
context_errors
context_exclusions
context_degraded_packets
```

### 29.2 Required Indexes

```text id="fm5frp"
context_requests.requestId unique
context_requests.tenantId
context_requests.baId
context_requests.sessionId
context_requests.agentKey
context_requests.taskType
context_requests.language
context_requests.createdAt

context_packets.packetId unique
context_packets.requestId
context_packets.tenantId
context_packets.baId
context_packets.sessionId
context_packets.agentKey
context_packets.status
context_packets.createdAt

context_retrieval_audits.requestId
context_retrieval_audits.packetId
context_retrieval_audits.baId
context_retrieval_audits.agentKey
context_retrieval_audits.language

context_exclusions.requestId
context_exclusions.packetId
context_exclusions.reason
```

---

## 30. Runtime Data Flow

### 30.1 Standard Context Flow

```text id="cqvinc"
Agent Runtime requests context
  ↓
Context Manager validates request
  ↓
Mandatory runtime context assembled
  ↓
Knowledge Core retrieval requested
  ↓
Approved knowledge retrieved
  ↓
Private context retrieved if authorized
  ↓
Relationship context retrieved if authorized
  ↓
Active template retrieved
  ↓
Guided action context retrieved if relevant
  ↓
Items scored and ranked
  ↓
Budget applied
  ↓
Exclusions recorded
  ↓
Context Packet assembled
  ↓
Packet recorded
  ↓
Events emitted
  ↓
Packet delivered to Agent Runtime
```

### 30.2 Degraded Context Flow

```text id="3984ym"
Agent Runtime requests context
  ↓
Context Manager validates request
  ↓
Retrieval partially fails
  ↓
Mandatory runtime context preserved
  ↓
Available template included if safe
  ↓
Missing sections marked
  ↓
Agent instructed to ask clarifying question
  ↓
Degraded packet recorded
  ↓
Degraded event emitted
  ↓
Packet delivered if safe
```

### 30.3 Candidate Exclusion Flow

```text id="lqx99l"
Context request includes candidates
  ↓
Context Manager checks authorization
  ↓
Request is not authorized review workflow
  ↓
Candidate knowledge excluded
  ↓
Exclusion recorded
  ↓
context.candidate.excluded emitted
  ↓
Approved knowledge retrieval continues
```

### 30.4 Private Journal Inclusion Flow

```text id="5k85vo"
Context request asks for private journal
  ↓
Context Manager validates BA ownership
  ↓
Task relevance checked
  ↓
Private journal snippets retrieved
  ↓
Snippets summarized and scoped
  ↓
context.private_journal.included emitted
  ↓
Packet marks content as private context
```

---

## 31. Relationship to Knowledge Core

The Context Manager retrieves from the Knowledge Core.

The Knowledge Core stores and governs knowledge.

The Context Manager must use Knowledge Core retrieval interfaces.

The Context Manager must not directly query storage systems.

### 31.1 Knowledge Core Retrieval Requirements

Requests to Knowledge Core must specify:

- Agent
- Brand Ambassador
- Session
- Task
- Domain
- Language
- Permission scope
- Lifecycle status
- Governance status
- Semantic query
- Graph seed entities
- Maximum result count
- Source traceability requirement

### 31.2 Knowledge Core Result Use

The Context Manager may use Knowledge Core results to assemble packets.

The Context Manager must still:

- Apply packet budget.
- Apply agent-specific rules.
- Apply task-specific rules.
- Record inclusion reasons.
- Record exclusions.
- Preserve source IDs.

---

## 32. Relationship to Knowledge Ingestion Protocol

Knowledge Ingestion creates candidates, captures raw experience, and prepares knowledge for review.

The Context Manager must not retrieve raw ingestion records as approved guidance.

The Context Manager may reference ingestion-derived session summaries only when they have appropriate scope.

Candidate knowledge from ingestion is excluded by default.

---

## 33. Relationship to Context Packet Schema

The Context Manager produces `context_packet.v1`.

`CONTEXT_PACKET_SCHEMA.md` defines the packet schema.

This document defines how the packet is assembled.

The implementation must satisfy both documents.

If this document and the packet schema conflict, the stricter privacy and governance rule applies until governance resolves the discrepancy.

---

## 34. Relationship to Agent Runtime

Agent Runtime requests Context Packets.

Agent Runtime must not directly retrieve knowledge.

Agents must operate from the packet.

### 34.1 Steve Success

Steve uses the packet to conduct success interviews, review action context, and guide Brand Ambassador momentum.

### 34.2 Michael Magnificent

Michael uses the packet to provide training support, teach Momentum Journal usage, and guide skill development.

### 34.3 Ivory

Ivory uses the packet to guide relationship coaching, opportunity map work, invitation drafting, and follow-up planning.

---

## 35. Relationship to Browser Voice Runtime

Browser Voice Runtime is internal.

Browser Voice Runtime requests context through Agent Runtime.

Browser Voice Runtime must not use Telnyx.

The Context Manager must include the Telnyx boundary in Browser Voice packets.

Browser Voice packets must be optimized for conversational turn-taking.

This means:

- Use compact summaries.
- Include active state.
- Include direct next-step instructions.
- Avoid excessive long-form knowledge blocks.
- Preserve safety guardrails.

---

## 36. Relationship to Browser Text Runtime

Browser Text Runtime is internal.

Browser Text Runtime requests context through Agent Runtime.

Browser Text packets may include slightly richer text context than Browser Voice when budget permits.

Browser Text packets must still preserve all runtime boundaries.

---

## 37. Relationship to External Runtime

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

External runtime must receive only narrowly scoped context required for the communication workflow.

External runtime must not receive:

- Private journal context
- Full internal session transcripts
- Unrestricted organizational knowledge
- Candidate knowledge
- Sensitive relationship notes beyond the specific workflow need

---

## 38. Relationship to Learning Pipeline

The Learning Pipeline evaluates outcomes.

The Context Manager may rank outcome-linked approved knowledge higher.

The Context Manager must preserve which knowledge was included in packets so that the Learning Pipeline can later evaluate whether guidance was useful.

Context Packet records are therefore part of the learning trace.

---

## 39. Implementation Structure for Codex

A recommended implementation layout is:

```text id="ty25zd"
/src/runtime/context-manager/
  index.ts

  models/
    ContextRequest.model.ts
    ContextPacket.model.ts
    ContextRetrievalAudit.model.ts
    ContextEvent.model.ts
    ContextError.model.ts
    ContextExclusion.model.ts
    ContextDegradedPacket.model.ts

  services/
    ContextManagerService.ts
    ContextRequestValidator.ts
    MandatoryRuntimeContextService.ts
    ApprovedKnowledgeContextService.ts
    PrivateJournalContextService.ts
    RelationshipContextService.ts
    TemplateContextService.ts
    GuidedActionContextService.ts
    ContextRankingService.ts
    ContextBudgetService.ts
    ContextPacketAssembler.ts
    ContextPacketRecorder.ts
    ContextEventPublisher.ts
    ContextAuditService.ts
    ContextFailureService.ts

  policies/
    AgentScopePolicy.ts
    PrivateJournalContextPolicy.ts
    RelationshipContextPolicy.ts
    CandidateExclusionPolicy.ts
    BilingualContextPolicy.ts
    ContextBudgetPolicy.ts
    RuntimeBoundaryPolicy.ts
    TelnyxBoundaryPolicy.ts

  integrations/
    KnowledgeCoreContextClient.ts
    TemplateRegistryClient.ts
    GuidedActionContextClient.ts
    SessionHistoryClient.ts

  events/
    ContextEventTypes.ts
    ContextEventConsumer.ts
    ContextEventPublisher.ts

  api/
    buildContextPacket.route.ts

  health/
    ContextManagerHealthCheck.ts

  types/
    ContextRequest.types.ts
    ContextScope.types.ts
    ContextRetrieval.types.ts
    ContextRanking.types.ts
    ContextExclusion.types.ts
    ContextAudit.types.ts
    ContextEvents.types.ts
```

This structure may be adapted if all runtime responsibilities and acceptance criteria are satisfied.

---

## 40. Minimal Runtime Implementation Sequence

Codex should implement the Context Manager in this order.

### Step 1: Types

Implement all request, scope, scoring, audit, exclusion, event, and error types.

### Step 2: Models

Implement persistence models for context requests, packets, audits, exclusions, and errors.

### Step 3: Request Validator

Validate agent, language, task, scopes, permissions, and runtime mode.

### Step 4: Mandatory Runtime Context

Implement mandatory runtime rule assembly.

### Step 5: Knowledge Core Client

Implement approved knowledge retrieval through Knowledge Core interfaces.

### Step 6: Template Retrieval

Implement active template retrieval by agent and task.

### Step 7: Private Journal Policy

Implement BA-owned private journal access checks.

### Step 8: Relationship Context Policy

Implement relationship context access checks.

### Step 9: Candidate Exclusion

Implement candidate exclusion by default.

### Step 10: Bilingual Policy

Implement language priority and fallback rules.

### Step 11: Ranking Service

Implement scoring and reason codes.

### Step 12: Budget Service

Implement section budgets and overflow behavior.

### Step 13: Packet Assembler

Assemble `context_packet.v1`.

### Step 14: Packet Recorder

Persist packet and retrieval audit.

### Step 15: Events

Emit context lifecycle events.

### Step 16: Failure Handling

Implement degraded and failed packet behavior.

### Step 17: Health Checks

Implement operational health checks.

### Step 18: Tests

Implement all acceptance tests.

---

## 41. Acceptance Criteria

The Context Manager Runtime is complete only when all acceptance criteria are satisfied.

### 41.1 Request Acceptance Criteria

- Agent Runtime can request context.
- Required request fields are validated.
- Invalid agent keys are rejected.
- Unsupported languages are rejected or safely handled.
- Unsupported task types are rejected.
- Requested scopes are validated.
- Request events are emitted.

### 41.2 Knowledge Retrieval Acceptance Criteria

- Approved knowledge retrieval works through the Knowledge Core.
- MongoDB, Neo4j, and Chroma are not queried directly by agents.
- Retrieved knowledge includes source IDs.
- Retrieved knowledge includes reason codes.
- Retrieved knowledge includes lifecycle and governance validity.
- Approved knowledge is active before inclusion.

### 41.3 Packet Assembly Acceptance Criteria

- `context_packet.v1` is created.
- Required packet sections are present.
- Mandatory runtime rules are present.
- Guardrails are present.
- Active template is included when available.
- Retrieval audit is included.
- Packet is recorded.

### 41.4 Private Journal Acceptance Criteria

- Private journal retrieval is scoped to the Brand Ambassador.
- Private journal context requires authorization.
- Private journal inclusion is audited.
- Private journal context is marked private.
- Private journal content is not included for another Brand Ambassador.
- Private journal content is not sent to external runtime.

### 41.5 Relationship Context Acceptance Criteria

- Relationship context is scoped to the Brand Ambassador.
- Prospect context is scoped when present.
- Relationship context inclusion is audited.
- Sensitive relationship content is minimized or summarized.
- Relationship context is excluded when out of scope.

### 41.6 Candidate Exclusion Acceptance Criteria

- Candidate knowledge is excluded by default.
- Candidate exclusion is recorded.
- `context.candidate.excluded` is emitted.
- Candidate knowledge is not used as Brand Ambassador guidance.
- Candidate inclusion requires authorized review workflow.

### 41.7 Bilingual Acceptance Criteria

- English packets work.
- Spanish packets work.
- Same-language approved knowledge is prioritized.
- Human-reviewed translations are supported.
- Machine translations are marked.
- Language fallback is audited.
- Clarifying question guidance is included when language confidence is insufficient.

### 41.8 Ranking Acceptance Criteria

- Retrieved items are scored.
- Reason codes are attached.
- Same-agent domain knowledge is prioritized.
- Same-language knowledge is prioritized.
- Outcome-validated knowledge can rank higher.
- Safety cannot be outweighed by relevance.
- Low-relevance items can be excluded.

### 41.9 Budget Acceptance Criteria

- Active template maximum is enforced.
- Approved knowledge budget is enforced.
- Recent session turn budget is enforced.
- Private journal snippet budget is enforced.
- Relationship context budget is enforced.
- Guided action budget is enforced.
- Summaries are preferred over full transcripts.

### 41.10 Failure Acceptance Criteria

- Retrieval failure produces degraded packet when safe.
- Mandatory runtime context is preserved in degraded packets.
- Missing sections are marked.
- Agent is instructed to ask clarifying questions.
- Failed packet is returned when mandatory context cannot be assembled.
- Knowledge is not invented during failure.

### 41.11 Runtime Boundary Acceptance Criteria

- Agents get context through the Context Manager.
- Agents do not directly query databases.
- Internal Browser Voice packets include Telnyx boundary.
- Telnyx boundary is always present.
- External runtime cannot access private journal context.
- External runtime receives only workflow-scoped context.

---

## 42. Testing Requirements

### 42.1 Unit Tests

Unit tests must cover:

- Context request validation
- Agent scope validation
- Task type validation
- Context scope validation
- Private journal policy
- Relationship context policy
- Candidate exclusion policy
- Bilingual fallback policy
- Ranking calculation
- Budget enforcement
- Exclusion creation
- Error creation
- Mandatory runtime context assembly

### 42.2 Integration Tests

Integration tests must cover:

- Full Steve Success context packet creation
- Full Michael Magnificent context packet creation
- Full Ivory context packet creation
- Browser Voice context packet creation
- Browser Text context packet creation
- Approved knowledge retrieval through Knowledge Core
- Private journal inclusion
- Relationship context inclusion
- Candidate exclusion
- Spanish packet creation
- Degraded packet creation
- Failed packet creation
- Packet recording
- Event emission

### 42.3 Security Tests

Security tests must prove:

- One Brand Ambassador cannot receive another Brand Ambassador's private journal context.
- Candidate knowledge is excluded by default.
- External runtime cannot retrieve private journal context.
- Agents cannot directly query Knowledge Core databases.
- Relationship context outside scope is excluded.
- Unapproved translations are not treated as approved knowledge.
- Rejected knowledge is not included.
- Archived knowledge is not included.
- Superseded knowledge is excluded by default.

### 42.4 Bilingual Tests

Bilingual tests must prove:

- English same-language retrieval works.
- Spanish same-language retrieval works.
- Human-reviewed translation fallback works.
- Machine translation is marked.
- Language fallback event is emitted.
- Clarifying question instruction appears when needed.

---

## 43. Required Invariants

The following invariants must always hold.

1. Agents receive Context Packets only.
2. Agents do not query MongoDB directly.
3. Agents do not query Neo4j directly.
4. Agents do not query Chroma directly.
5. Context Manager retrieves approved knowledge through Knowledge Core.
6. Context Packets include mandatory runtime rules.
7. Context Packets include Telnyx boundary.
8. Internal Browser Voice does not use Telnyx.
9. Telnyx is limited to external SMS, ringless voicemail, and future callback workflows.
10. Private Momentum Journal context is BA-owned and private.
11. Private journal context is included only when authorized.
12. Candidate knowledge is excluded by default.
13. Organizational knowledge must be active before guidance use.
14. Every included knowledge item has source traceability.
15. Every included item has reason codes.
16. Every packet has retrieval audit.
17. English and Spanish are supported.
18. Language fallback is audited.
19. Degraded packets do not invent knowledge.
20. Safety cannot be outweighed by relevance.

---

## 44. Completion Definition

The Context Manager Runtime is considered Version 1.0 complete when:

- Context requests are accepted and validated.
- Mandatory runtime context is assembled.
- Approved knowledge retrieval works through Knowledge Core.
- Agent-domain retrieval works for Steve, Michael, and Ivory.
- Cross-domain retrieval is controlled and reason-coded.
- Private journal retrieval is BA-scoped.
- Relationship context retrieval is permission-scoped.
- Candidate knowledge is excluded by default.
- Active templates are included by task.
- English packets work.
- Spanish packets work.
- Language fallback is audited.
- Items are scored and ranked.
- Context budgets are enforced.
- Exclusions are recorded.
- `context_packet.v1` is assembled.
- Packets are recorded.
- Events are emitted.
- Degraded packet behavior works.
- Failed packet behavior works.
- Telnyx boundary is always included.
- Acceptance tests pass.

---

## 45. Final Runtime Statement

The Context Manager is the runtime intelligence assembler of Momentum Creation System V2.

It does not store what Momentum knows.

It decides what part of what Momentum knows is needed right now.

It protects Brand Ambassador privacy.

It protects Momentum Journal ownership.

It protects relationship-sensitive information.

It protects governance-approved knowledge.

It protects agents from uncontrolled retrieval.

It gives Steve, Michael, and Ivory the contextual intelligence they need without allowing them to become unbounded systems.

It ensures that English and Spanish guidance are supported through governed context.

It ensures that internal Browser Voice remains separate from Telnyx.

It ensures that every packet is traceable, auditable, scoped, and safe.

Momentum becomes useful in the moment because the Context Manager transforms organizational knowledge into agent-ready intelligence.

The Knowledge Core knows.

The Context Manager selects.

The Context Packet carries.

The Agent guides.

The Brand Ambassador acts.

The outcome teaches Momentum.
