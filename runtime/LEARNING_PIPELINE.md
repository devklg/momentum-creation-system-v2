# LEARNING_PIPELINE.md

## Momentum Creation System V2

### Learning Pipeline Runtime Specification

#### Version 1.0

---

## 1. Document Status

**Document Name:** Learning Pipeline Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Upstream Dependencies:** Knowledge Core, Knowledge Ingestion Protocol, Context Manager, Context Packet Schema, Agent Runtime, Agent Event Model, Browser Voice Runtime
**Primary Downstream Consumers:** Knowledge Core, Knowledge Ingestion, Context Manager, Metrics Projection, Runtime Audit
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Team Scope:** Team Magnificent
**BA Scope:** Brand Ambassador inside Team Magnificent
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

---

## 2. Purpose

The Learning Pipeline defines how runtime activity improves Momentum knowledge over time.

It implements the ratified knowledge growth loop without creating new governance.

The Learning Pipeline observes runtime outcomes, links them to context and action, detects patterns, produces learning signals, proposes Knowledge Candidates, connects evidence, updates metrics, and requests review when knowledge should be improved, refined, validated, weakened, superseded, or expanded.

The Learning Pipeline answers this runtime question:

> What did Momentum learn from what happened?

The Learning Pipeline does not approve knowledge.

The Learning Pipeline does not activate knowledge.

The Learning Pipeline does not bypass governance.

The Learning Pipeline does not expose private Momentum Journal content.

The Learning Pipeline does not optimize pressure, manipulation, hype, or unsupported claims.

The Learning Pipeline creates evidence-informed signals and candidate proposals that must pass through review before becoming organizational knowledge.

---

## 3. Runtime Philosophy

Momentum is a learning organization.

Momentum learns when action produces outcomes and those outcomes are connected back to the knowledge, context, guidance, and decisions that preceded them.

The Learning Pipeline exists to make that loop visible, measurable, and improvable.

The runtime philosophy is:

```text id="5ya44k"
Knowledge creates context.

Context guides agents.

Agents guide Brand Ambassadors.

Brand Ambassadors take action.

Actions create outcomes.

Outcomes create learning signals.

Learning signals create candidate improvements.

Candidates go to review.

Approved knowledge improves retrieval.

Improved retrieval improves future guidance.
```

Agents do not become intelligent by self-modifying.

The Knowledge Core becomes richer because the Learning Pipeline observes outcomes and proposes knowledge evolution through governed pathways.

---

## 4. Core Learning Loop

The required learning loop is:

```text id="l2fhz5"
Guided Action
  ↓
BA Action
  ↓
Outcome
  ↓
Runtime Event
  ↓
Learning Signal
  ↓
Knowledge Candidate
  ↓
Review
  ↓
Approved Knowledge
  ↓
Better Retrieval
  ↓
Better Guided Action
```

This loop must preserve:

- Team Magnificent scope
- Brand Ambassador scope
- Session lineage
- Agent lineage
- Context Packet lineage
- Guided Action lineage
- Outcome lineage
- Knowledge lineage
- Review separation
- Bilingual metadata
- Auditability

---

## 5. Team Magnificent Identity Scope

Momentum Creation System V2 is implemented for Team Magnificent.

Within the app, a Brand Ambassador is never treated as a floating user.

Every Brand Ambassador is scoped to Team Magnificent.

The identity hierarchy is:

```text id="po1qdi"
Momentum Creation System V2
  ↓
Team Magnificent
  ↓
Brand Ambassador
  ↓
Session
  ↓
Agent Guidance
  ↓
Guided Action
  ↓
Outcome
  ↓
Learning Signal
```

### 5.1 Required Identity Fields

Every Learning Pipeline object must preserve:

```ts id="pt64sp"
teamId: string;
teamKey: "team_magnificent";
teamName: "Team Magnificent";
baId?: string;
```

### 5.2 Required Identity Rule

```text id="d9ptrf"
All BA-scoped learning records must also be Team Magnificent scoped.
```

### 5.3 Identity Meaning

`baId` remains the correct Three International Brand Ambassador identifier.

`teamId`, `teamKey`, and `teamName` define the Team Magnificent application boundary.

The Learning Pipeline must not aggregate, compare, or learn from Brand Ambassador activity outside Team Magnificent unless a future ratified architecture explicitly expands scope.

---

## 6. Runtime Position

The Learning Pipeline sits after outcomes and before knowledge evolution.

```text id="qmxaeo"
Agent Runtime
  ↓
Guided Action
  ↓
BA Action
  ↓
Outcome
  ↓
Agent Event Model
  ↓
Learning Pipeline
  ↓
Learning Signal
  ↓
Knowledge Candidate Proposal
  ↓
Knowledge Ingestion
  ↓
Review
  ↓
Knowledge Core
  ↓
Improved Retrieval
```

The Learning Pipeline is downstream of:

- Agent Runtime
- Browser Voice Runtime
- Browser Text Runtime
- Context Manager
- Context Packet records
- Agent Events
- Guided Actions
- Outcomes
- Journal selection events
- Knowledge Candidate events
- QA/admin review signals

The Learning Pipeline is upstream of:

- Knowledge Candidate proposals
- Knowledge review requests
- Knowledge quality flags
- Metrics projections
- Learning dashboards
- Knowledge Core learning signal records
- Graph updates
- Retrieval improvement signals

---

## 7. Scope

This document defines the Version 1.0 runtime specification for the Learning Pipeline.

It defines:

- Purpose
- Core learning loop
- Team Magnificent identity scope
- Learning definitions
- Signal sources
- Learning object models
- Outcome model
- Learning signal model
- Pattern model
- Candidate proposal model
- Pipeline stages
- Pattern detection
- Evidence rules
- Graph updates
- Metrics
- APIs
- Events
- Guardrails
- Privacy rules
- Bilingual rules
- Failure behavior
- Observability
- Acceptance criteria
- Testing requirements
- Implementation structure
- Relationships to other runtime components

This document does not define governance approval.

Governance remains separate.

This document does not define Knowledge Core storage.

Knowledge Core storage is defined in `KNOWLEDGE_CORE_RUNTIME.md`.

This document does not define Knowledge Ingestion stages.

Knowledge Ingestion is defined in `KNOWLEDGE_INGESTION_PROTOCOL.md`.

This document does not define Agent Runtime behavior.

Agent Runtime is defined in `AGENT_RUNTIME.md`.

This document does not define Browser Voice behavior.

Browser Voice is defined in `BROWSER_VOICE_RUNTIME.md`.

---

## 8. What Learning Means

In Momentum, learning means discovering and preserving evidence-informed improvement opportunities.

Learning includes:

- Discovering repeated useful patterns
- Improving confusing explanations
- Identifying training gaps
- Identifying relationship approaches that worked
- Identifying relationship approaches that need revision
- Turning repeated questions into training candidate knowledge
- Linking guided actions to outcomes
- Linking Context Packets to action results
- Validating knowledge that consistently helps
- Weakening knowledge that does not help
- Refining knowledge that partially helps
- Superseding knowledge that becomes outdated
- Detecting bilingual coverage gaps
- Detecting Momentum Journal adoption patterns
- Detecting template gaps
- Detecting agent guidance gaps
- Detecting repeated compliance-sensitive risks

Learning does not mean:

- Automatic approval
- Automatic activation
- Automatic promotion of private journal entries
- Automatic replacement of governance
- Automatic optimization for conversion without ethics
- Pressure-based behavioral optimization
- Treating draft usage as proof of effectiveness
- Treating one outcome as universal truth

---

## 9. Core Responsibilities

The Learning Pipeline is responsible for the following runtime functions.

### 9.1 Observe Runtime Activity

The Learning Pipeline observes events and records from:

- Agent Runtime
- Browser Voice Runtime
- Browser Text Runtime
- Context Manager
- Context Packet records
- Guided Actions
- Outcomes
- Momentum Journal selection
- Knowledge Candidate creation
- QA/admin review
- External runtime outcome events when available

### 9.2 Link Outcomes to Context

The Learning Pipeline must link outcomes to:

- Brand Ambassador
- Team Magnificent
- Agent session
- Agent key
- Context Packet
- Approved knowledge used
- Guided Action
- Candidate proposals
- Journal entries where selected
- Relationship context when scoped
- Runtime events

### 9.3 Score Outcomes

The Learning Pipeline must score or classify outcomes according to usefulness, confidence, evidence strength, and domain relevance.

### 9.4 Detect Patterns

The Learning Pipeline must detect repeated patterns across Team Magnificent activity.

Pattern detection may be rules-based in MVP.

Detected patterns must not become approved knowledge automatically.

### 9.5 Create Learning Signals

The Learning Pipeline creates Learning Signals when an observation suggests knowledge should be created, reviewed, improved, validated, weakened, refined, or superseded.

### 9.6 Propose Knowledge Candidates

The Learning Pipeline may propose Knowledge Candidates through Knowledge Ingestion.

Learning-proposed candidates are review-only.

### 9.7 Request Knowledge Review

The Learning Pipeline may request review when:

- Knowledge appears outdated.
- Knowledge appears confusing.
- Knowledge appears helpful.
- Knowledge appears unhelpful.
- A repeated question indicates a training gap.
- A relationship approach needs refinement.
- A compliance-sensitive pattern appears.
- English/Spanish parity is incomplete.

### 9.8 Update Metrics

The Learning Pipeline maintains runtime learning metrics.

Metrics help Team Magnificent understand whether knowledge, training, guidance, and action systems are improving.

### 9.9 Preserve Bilingual Learning

Learning records must preserve English and Spanish language metadata.

Bilingual parity must be tracked.

---

## 10. Non-Responsibilities

The Learning Pipeline must not perform responsibilities assigned to other runtime components.

### 10.1 It Does Not Approve Knowledge

Approval remains a governance and review responsibility.

### 10.2 It Does Not Activate Knowledge

The Knowledge Core lifecycle activates approved knowledge.

### 10.3 It Does Not Rewrite Agent Templates Directly

The Learning Pipeline may identify template gaps or propose candidate improvements.

Template changes require review and implementation.

### 10.4 It Does Not Retrieve Context for Agents

The Context Manager retrieves context.

The Learning Pipeline may evaluate past context but does not assemble live Context Packets.

### 10.5 It Does Not Promote Private Journal Entries Automatically

Momentum Journal entries remain private unless selected by the Brand Ambassador.

### 10.6 It Does Not Optimize Manipulation

The Learning Pipeline must not optimize pressure, fear, exaggeration, hype, or manipulation.

### 10.7 It Does Not Treat Activity as Proof

A draft being created, used, or copied is not proof that the approach worked.

The Learning Pipeline must distinguish between activity signals and outcome evidence.

### 10.8 It Does Not Send External Communications

SMS, ringless voicemail, and callback workflows belong to external runtime services.

Replay and learning workflows must not trigger external communications.

---

## 11. Signal Sources

Learning signals may originate from multiple sources.

| Source              | Example Signals                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Steve Success       | Win, breakthrough, obstacle, action completion, success lesson, momentum improvement, repeated obstacle             |
| Michael Magnificent | Training confusion, journal adoption, repeated system question, onboarding completion, training explanation success |
| Ivory               | Draft accepted, draft edited, relationship approach outcome, invitation tone issue, follow-up completion            |
| Momentum Journal    | BA-selected lesson, idea, script, reflection, personal strategy submitted for review                                |
| Agent Events        | Session completed, action suggested, candidate proposed, output blocked, state transition pattern                   |
| Context Packets     | Knowledge included, private context included, candidate excluded, language fallback used                            |
| Outcome Events      | Action completed, training resolved, draft used, follow-up completed, prospect responded                            |
| QA/Admin Review     | Outdated knowledge, compliance risk, duplicate knowledge, unclear explanation                                       |
| Browser Voice       | Voice fallback rate, low-confidence transcripts, Spanish recognition issues, session completion friction            |
| External Runtime    | SMS response, voicemail outcome, callback result, prospect engagement outcome                                       |

All signal sources must preserve Team Magnificent scope when BA-related.

---

## 12. Learning Outcome Model

A Learning Outcome records what happened after guidance or action.

```ts id="fqi8z4"
export interface LearningOutcome {
  outcomeId: string;

  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId?: string;

  sessionId?: string;

  agentKey?: "steve_success" | "michael_magnificent" | "ivory";

  contextPacketId?: string;

  guidedActionId?: string;

  journalEntryId?: string;

  relationshipContextId?: string;

  invitationDraftId?: string;

  prospectId?: string;

  outcomeType:
    | "action_completed"
    | "action_skipped"
    | "journal_entry_created"
    | "invitation_draft_created"
    | "invitation_draft_edited"
    | "invitation_draft_used"
    | "follow_up_completed"
    | "training_question_resolved"
    | "training_question_unresolved"
    | "success_lesson_confirmed"
    | "relationship_approach_worked"
    | "relationship_approach_needs_revision"
    | "knowledge_helpful"
    | "knowledge_not_helpful"
    | "voice_session_completed"
    | "voice_fallback_used"
    | "language_fallback_used";

  description: string;

  language: "en" | "es";

  linkedKnowledgeIds: string[];

  linkedCandidateIds: string[];

  linkedEventIds: string[];

  evidenceStrength:
    | "self_reported"
    | "system_observed"
    | "agent_observed"
    | "outcome_supported"
    | "multi_event_supported"
    | "review_supported";

  confidence: number;

  occurredAt: Date;

  recordedAt: Date;

  metadata?: Record<string, unknown>;
}
```

### 12.1 Outcome Requirements

Every outcome must preserve:

- Outcome ID
- Tenant ID
- Team Magnificent scope
- Language
- Outcome type
- Occurrence timestamp
- Evidence strength
- Linked records where available

BA-related outcomes must preserve `baId`.

Session-related outcomes must preserve `sessionId`.

Agent-related outcomes must preserve `agentKey`.

Guided-action outcomes must preserve `guidedActionId`.

---

## 13. Learning Signal Model

A Learning Signal represents a possible improvement opportunity.

```ts id="zkymzj"
export interface LearningSignal {
  signalId: string;

  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId?: string;

  signalType:
    | "repeat_question"
    | "successful_action_pattern"
    | "failed_action_pattern"
    | "template_gap"
    | "knowledge_gap"
    | "candidate_needed"
    | "knowledge_update_needed"
    | "compliance_review_needed"
    | "translation_gap"
    | "bilingual_parity_gap"
    | "journal_adoption_signal"
    | "relationship_pattern"
    | "voice_runtime_friction"
    | "context_retrieval_issue";

  sourceType:
    | "agent_event"
    | "outcome"
    | "journal_selection"
    | "qa_review"
    | "manual"
    | "context_packet"
    | "browser_voice_event"
    | "external_runtime_event";

  sourceId: string;

  domain:
    | "success"
    | "training"
    | "relationship"
    | "performance"
    | "organizational"
    | "system"
    | "governance";

  language: "en" | "es";

  priority: "low" | "normal" | "high" | "urgent";

  status:
    | "new"
    | "triaged"
    | "candidate_created"
    | "review_requested"
    | "dismissed"
    | "resolved";

  summary: string;

  evidence: LearningEvidenceReference[];

  linkedOutcomeIds: string[];

  linkedKnowledgeIds: string[];

  linkedCandidateIds: string[];

  createdAt: Date;

  updatedAt: Date;

  triagedAt?: Date;

  triagedBy?: string;

  metadata?: Record<string, unknown>;
}
```

### 13.1 Learning Evidence Reference

```ts id="bq2ewp"
export interface LearningEvidenceReference {
  evidenceId: string;

  evidenceType:
    | "event"
    | "outcome"
    | "context_packet"
    | "guided_action"
    | "journal_selection"
    | "knowledge_object"
    | "candidate"
    | "session"
    | "manual_review";

  referenceId: string;

  explanation: string;

  weight: "low" | "medium" | "high";
}
```

---

## 14. Learning Pattern Model

A Learning Pattern represents repeated evidence across multiple outcomes or events.

```ts id="j3ed4j"
export interface LearningPattern {
  patternId: string;

  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  patternType:
    | "repeat_question"
    | "successful_action_pattern"
    | "failed_action_pattern"
    | "training_confusion"
    | "relationship_approach"
    | "journal_adoption"
    | "voice_fallback"
    | "language_gap"
    | "context_gap"
    | "template_gap";

  domain:
    | "success"
    | "training"
    | "relationship"
    | "performance"
    | "organizational"
    | "system";

  language: "en" | "es";

  title: string;

  summary: string;

  evidenceOutcomeIds: string[];

  evidenceEventIds: string[];

  evidenceSessionIds: string[];

  evidenceKnowledgeIds: string[];

  count: number;

  confidence: number;

  firstSeenAt: Date;

  lastSeenAt: Date;

  status:
    | "detected"
    | "signal_created"
    | "candidate_proposed"
    | "dismissed"
    | "resolved";

  metadata?: Record<string, unknown>;
}
```

---

## 15. Knowledge Candidate Proposal Model

The Learning Pipeline may propose a Knowledge Candidate through Knowledge Ingestion.

```ts id="s0bolh"
export interface LearningCandidateProposal {
  proposalId: string;

  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  signalId: string;

  patternId?: string;

  domain:
    | "success"
    | "training"
    | "relationship"
    | "performance"
    | "organizational";

  language: "en" | "es";

  title: string;

  summary: string;

  proposedContent?: string;

  riskFlags: string[];

  evidence: LearningEvidenceReference[];

  sourceOutcomeIds: string[];

  sourceEventIds: string[];

  sourceKnowledgeIds: string[];

  status:
    | "proposed"
    | "sent_to_ingestion"
    | "candidate_created"
    | "dismissed"
    | "failed";

  createdCandidateId?: string;

  createdAt: Date;

  updatedAt: Date;
}
```

### 15.1 Candidate Proposal Rule

A Learning Candidate Proposal is not a Knowledge Candidate until Knowledge Ingestion creates the candidate.

A Knowledge Candidate is not approved knowledge.

Approved knowledge requires review and governance-defined lifecycle transition.

---

## 16. Pipeline Stages

The Learning Pipeline must implement the following stages:

```text id="aqga24"
Observe
  ↓
Link
  ↓
Score
  ↓
Detect Pattern
  ↓
Propose Candidate
  ↓
Review
  ↓
Approve / Reject / Revise
  ↓
Reindex
  ↓
Update Graph
  ↓
Monitor Outcomes
```

### 16.1 Observe

The pipeline observes runtime events and outcome records.

Inputs include:

- Agent events
- Context events
- Browser Voice events
- Journal events
- Guided Action events
- Knowledge events
- External runtime events
- Manual review records

### 16.2 Link

The pipeline links outcomes and events to:

- Team Magnificent
- BA
- Agent
- Session
- Context Packet
- Guided Action
- Knowledge objects
- Candidate records
- Journal selections
- Relationship context
- Invitation drafts

### 16.3 Score

The pipeline scores evidence according to:

- Evidence strength
- Outcome confidence
- Recency
- Frequency
- Domain relevance
- Language relevance
- Source reliability
- Risk sensitivity

### 16.4 Detect Pattern

The pipeline detects repeated or meaningful patterns.

MVP detection may be rules-based.

Later versions may use more advanced GraphRAG-supported analysis after governance approval.

### 16.5 Propose Candidate

The pipeline may propose a candidate when evidence supports a useful learning opportunity.

Candidate proposals must go through Knowledge Ingestion.

### 16.6 Review

Review remains separate from learning automation.

The Learning Pipeline may request review but cannot approve.

### 16.7 Approve / Reject / Revise

Review workflows decide whether proposed candidates are approved, rejected, revised, merged, or dismissed.

### 16.8 Reindex

When knowledge is approved or updated, Knowledge Core indexing services reindex approved knowledge.

The Learning Pipeline may observe reindex completion but does not perform active indexing directly unless implemented as a worker under Knowledge Core rules.

### 16.9 Update Graph

Graph relationships must be updated to connect actions, outcomes, signals, candidates, and knowledge.

### 16.10 Monitor Outcomes

The pipeline continues monitoring whether updated knowledge improves future retrieval and guided actions.

---

## 17. Pattern Detection Rules

MVP pattern detection may be rules-based.

Rules must be transparent, auditable, and conservative.

### 17.1 Repeat Training Question

```ts id="mw2i75"
if (sameQuestionCount >= 5 && domain === "training") {
  createLearningSignal("repeat_question");
}
```

### 17.2 Successful Relationship Draft Pattern

```ts id="li2ghc"
if (draftUsedCount >= 3 && positiveFeedbackCount >= 2) {
  createLearningSignal("successful_action_pattern");
}
```

### 17.3 Relationship Approach Needs Revision

```ts id="n0r62e"
if (similarApproachCount >= 3 && negativeOrNoResponseCount >= 2) {
  createLearningSignal("relationship_approach_needs_revision");
}
```

### 17.4 Journal Adoption Signal

```ts id="u0v2cw"
if (journalPromptAcceptedCount >= 3 && journalEntryCreatedCount >= 3) {
  createLearningSignal("journal_adoption_signal");
}
```

### 17.5 Voice Runtime Friction

```ts id="hwwxl9"
if (voiceFallbackCount >= 5 || lowConfidenceTranscriptCount >= 5) {
  createLearningSignal("voice_runtime_friction");
}
```

### 17.6 Bilingual Parity Gap

```ts id="c2d35q"
if (approvedKnowledgeExistsInEnglish && !approvedKnowledgeExistsInSpanish) {
  createLearningSignal("bilingual_parity_gap");
}
```

### 17.7 Rules-Based Detection Requirement

Rules-based detection must:

- Preserve evidence.
- Preserve count thresholds.
- Preserve source IDs.
- Preserve language.
- Preserve Team Magnificent scope.
- Avoid automatic approval.
- Avoid overgeneralizing from weak evidence.

---

## 18. Candidate Examples

### 18.1 Steve Success Candidate Example

```json id="b9be2q"
{
  "domain": "success",
  "title": "Ask for one next action after each breakthrough",
  "summary": "When a Brand Ambassador identifies a breakthrough, Steve should help them choose one concrete next action before closing the session.",
  "evidence": ["session_101", "session_118", "outcome_204"],
  "teamKey": "team_magnificent",
  "language": "en"
}
```

### 18.2 Michael Magnificent Candidate Example

```json id="riiy8c"
{
  "domain": "training",
  "title": "Momentum Journal onboarding explanation",
  "summary": "New Brand Ambassadors understand the journal better when Michael explains it as a private learning notebook first, then an optional source of Knowledge Candidates.",
  "teamKey": "team_magnificent",
  "language": "en"
}
```

### 18.3 Ivory Candidate Example

```json id="6jokhu"
{
  "domain": "relationship",
  "title": "Invite close family with permission and care",
  "summary": "For close family, Ivory should help the Brand Ambassador lead with care, ask permission, and avoid sounding like a sales pitch.",
  "riskFlags": ["compliance_sensitive"],
  "teamKey": "team_magnificent",
  "language": "en"
}
```

---

## 19. Graph Updates

The Learning Pipeline must support graph updates through Knowledge Core and graph service layers.

It must not write directly to Neo4j outside approved service layers.

### 19.1 Required Graph Relationships

```cypher id="tn81by"
(:GuidedAction)-[:PRODUCED]->(:Outcome)
(:BrandAmbassador)-[:COMPLETED]->(:GuidedAction)
(:Knowledge)-[:INFORMED]->(:GuidedAction)
(:ContextPacket)-[:INCLUDED]->(:Knowledge)
(:AgentSession)-[:USED]->(:ContextPacket)
(:Outcome)-[:VALIDATES]->(:Knowledge)
(:Outcome)-[:WEAKENS]->(:Knowledge)
(:Outcome)-[:REFINES]->(:Knowledge)
(:LearningSignal)-[:DERIVED_FROM]->(:Outcome)
(:LearningSignal)-[:PROPOSED]->(:KnowledgeCandidate)
(:KnowledgeCandidate)-[:APPROVED_AS]->(:Knowledge)
(:Knowledge)-[:SUPERSEDES]->(:Knowledge)
(:BrandAmbassador)-[:MEMBER_OF]->(:TeamMagnificent)
```

### 19.2 Graph Update Rules

Graph updates must:

- Preserve Team Magnificent scope.
- Preserve BA scope.
- Preserve session lineage.
- Preserve knowledge lineage.
- Preserve outcome lineage.
- Use service layers.
- Be idempotent.
- Not approve knowledge.
- Not activate knowledge.

---

## 20. Knowledge Validation, Weakening, Refinement, and Supersession

The Learning Pipeline may produce signals that affect knowledge quality.

### 20.1 Validation

Knowledge may be validated when repeated outcomes show the knowledge is useful.

Validation does not equal approval.

Validation may increase confidence metadata or trigger review.

### 20.2 Weakening

Knowledge may be weakened when outcomes suggest it is not helping or may be confusing.

Weakening does not remove knowledge automatically.

Weakening may trigger review.

### 20.3 Refinement

Knowledge may need refinement when it is partially useful but unclear, incomplete, too broad, or missing bilingual support.

### 20.4 Supersession

Knowledge may need supersession when newer evidence or governance decisions make prior knowledge outdated.

The Learning Pipeline may recommend supersession.

The Knowledge Core lifecycle performs supersession after review.

---

## 21. Metrics

The Learning Pipeline must calculate and expose learning metrics.

| Metric                        | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| Candidate creation rate       | Shows knowledge growth volume                             |
| Approval rate                 | Shows candidate quality                                   |
| Rejection rate                | Shows candidate noise or quality issues                   |
| Supersession rate             | Shows knowledge improvement and replacement               |
| Retrieval usefulness          | Shows whether context helps action                        |
| Repeated confusion count      | Shows where training is weak                              |
| Journal adoption              | Shows whether Brand Ambassadors use the Momentum Journal  |
| Bilingual parity score        | Shows English/Spanish knowledge coverage                  |
| Guided action completion rate | Shows whether suggested actions are completed             |
| Draft edit rate               | Shows whether Ivory drafts need adjustment                |
| Voice fallback rate           | Shows Browser Voice friction                              |
| Language fallback rate        | Shows bilingual context gaps                              |
| Knowledge helpfulness score   | Shows whether included knowledge supports useful outcomes |

### 21.1 Learning Metrics Snapshot

```ts id="uuodkp"
export interface LearningMetricsSnapshot {
  metricsSnapshotId: string;

  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  periodStart: Date;
  periodEnd: Date;

  candidateCreationRate: number;
  approvalRate: number;
  rejectionRate: number;
  supersessionRate: number;
  retrievalUsefulness: number;
  repeatedConfusionCount: number;
  journalAdoptionRate: number;
  bilingualParityScore: number;
  guidedActionCompletionRate: number;
  draftEditRate: number;
  voiceFallbackRate: number;
  languageFallbackRate: number;
  knowledgeHelpfulnessScore: number;

  createdAt: Date;
}
```

### 21.2 Bilingual Parity Score

Bilingual parity score measures whether approved knowledge coverage exists in both English and Spanish.

A low score indicates that one language has less usable approved knowledge than the other.

---

## 22. API Contracts

The Learning Pipeline must expose internal runtime APIs.

### 22.1 Create Outcome

```text id="n7ripj"
POST /api/runtime/outcomes
```

Request:

```ts id="r4uz0r"
export interface CreateLearningOutcomeRequest {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId?: string;

  sessionId?: string;
  agentKey?: "steve_success" | "michael_magnificent" | "ivory";
  contextPacketId?: string;
  guidedActionId?: string;
  journalEntryId?: string;
  relationshipContextId?: string;
  invitationDraftId?: string;
  prospectId?: string;

  outcomeType: LearningOutcome["outcomeType"];

  description: string;

  language: "en" | "es";

  linkedKnowledgeIds?: string[];
  linkedCandidateIds?: string[];
  linkedEventIds?: string[];

  occurredAt?: Date;

  metadata?: Record<string, unknown>;
}
```

Response:

```ts id="j4agbx"
export interface CreateLearningOutcomeResponse {
  outcome: LearningOutcome;
}
```

### 22.2 Get Outcomes

```text id="l02s1w"
GET /api/runtime/outcomes
```

Required filters:

- `tenantId`
- `teamId`
- Optional `baId`
- Optional `sessionId`
- Optional `agentKey`
- Optional `outcomeType`
- Optional date range

### 22.3 Create Learning Signal

```text id="xz7ky9"
POST /api/runtime/learning/signals
```

Request:

```ts id="jklsgb"
export interface CreateLearningSignalRequest {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  baId?: string;

  signalType: LearningSignal["signalType"];
  sourceType: LearningSignal["sourceType"];
  sourceId: string;
  domain: LearningSignal["domain"];
  language: "en" | "es";
  priority: LearningSignal["priority"];
  summary: string;
  evidence: LearningEvidenceReference[];
  linkedOutcomeIds?: string[];
  linkedKnowledgeIds?: string[];
  linkedCandidateIds?: string[];
}
```

Response:

```ts id="xbf0xt"
export interface CreateLearningSignalResponse {
  signal: LearningSignal;
}
```

### 22.4 Get Learning Signals

```text id="nmhji0"
GET /api/runtime/learning/signals
```

Required filters:

- `tenantId`
- `teamId`
- Optional `status`
- Optional `domain`
- Optional `language`
- Optional `priority`
- Optional `baId`

### 22.5 Triage Learning Signal

```text id="mb301n"
POST /api/runtime/learning/signals/:signalId/triage
```

Request:

```ts id="8pnkwb"
export interface TriageLearningSignalRequest {
  tenantId: string;
  teamId: string;
  signalId: string;

  decision: "create_candidate" | "request_review" | "dismiss" | "mark_resolved";

  triageNote?: string;

  triagedBy: string;
}
```

### 22.6 Create Candidate from Signal

```text id="cgbzlu"
POST /api/runtime/learning/signals/:signalId/create-candidate
```

Request:

```ts id="e6beqi"
export interface CreateCandidateFromSignalRequest {
  tenantId: string;
  teamId: string;
  signalId: string;

  title: string;
  summary: string;
  proposedContent?: string;

  domain: LearningCandidateProposal["domain"];

  language: "en" | "es";

  riskFlags?: string[];
}
```

### 22.7 Get Learning Metrics

```text id="w4md3x"
GET /api/runtime/learning/metrics
```

Required filters:

- `tenantId`
- `teamId`
- Date range

Optional filters:

- `agentKey`
- `domain`
- `language`

---

## 23. Service Interfaces

### 23.1 Learning Pipeline Service

```ts id="ralj44"
export interface LearningPipelineService {
  recordOutcome(input: CreateLearningOutcomeRequest): Promise<LearningOutcome>;

  createSignal(input: CreateLearningSignalRequest): Promise<LearningSignal>;

  detectPatterns(input: PatternDetectionRequest): Promise<LearningPattern[]>;

  triageSignal(input: TriageLearningSignalRequest): Promise<LearningSignal>;

  createCandidateFromSignal(
    input: CreateCandidateFromSignalRequest
  ): Promise<LearningCandidateProposal>;

  calculateMetrics(
    input: LearningMetricsRequest
  ): Promise<LearningMetricsSnapshot>;
}
```

### 23.2 Pattern Detection Request

```ts id="gmkxtd"
export interface PatternDetectionRequest {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  domain?: "success" | "training" | "relationship" | "performance" | "system";

  language?: "en" | "es";

  startAt: Date;
  endAt: Date;

  minimumEvidenceCount?: number;
}
```

### 23.3 Learning Metrics Request

```ts id="s9gj0k"
export interface LearningMetricsRequest {
  tenantId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  startAt: Date;
  endAt: Date;

  agentKey?: "steve_success" | "michael_magnificent" | "ivory";

  domain?: LearningSignal["domain"];

  language?: "en" | "es";
}
```

---

## 24. Events

The Learning Pipeline must publish and consume runtime events through the Runtime Event Service.

### 24.1 Events Published by Learning Pipeline

```text id="tp8x68"
learning.outcome.created
learning.signal.created
learning.signal.triaged
learning.pattern.detected
learning.candidate.proposed
learning.candidate.linked_to_outcome
learning.knowledge.validated
learning.knowledge.weakened
learning.knowledge.refined
learning.knowledge.superseded
learning.metrics.updated
```

### 24.2 Events Consumed by Learning Pipeline

```text id="k1cnpn"
agent.session.completed
agent.turn.responded
guided_action.suggested
guided_action.accepted
guided_action.dismissed
agent.journal_entry.created
agent.knowledge_candidate.proposed
agent.invitation_draft.created
context.packet.created
context.packet.delivered
context.packet.degraded
context.language.fallback_used
journal.entry.selected_for_review
journal.entry.promoted_to_candidate
guided_action.completed
guided_action.missed
guided_action.outcome_recorded
knowledge.candidate.created
knowledge.object.activated
knowledge.retrieval.completed
browser_voice.fallback_to_text
browser_voice.final_transcript
external.sms.response_received
external.callback.completed
```

### 24.3 Event Payload Requirements

Learning events must include:

- Tenant ID
- Team Magnificent scope
- BA ID where applicable
- Session ID where applicable
- Agent key where applicable
- Outcome ID or signal ID
- Language
- Evidence references
- Correlation ID
- Causation ID where applicable

### 24.4 Event Privacy Rule

Learning events must not include unnecessary private transcript text, private journal text, full SMS content, or sensitive prospect details.

Use references.

---

## 25. Guardrails

The Learning Pipeline must enforce the following guardrails.

### 25.1 Knowledge Governance Guardrails

The Learning Pipeline must not:

- Approve knowledge automatically.
- Activate knowledge automatically.
- Supersede knowledge automatically.
- Treat candidate proposals as approved knowledge.
- Bypass review.

### 25.2 Journal Privacy Guardrails

The Learning Pipeline must not:

- Learn from private journal entries unless selected for review.
- Promote journal entries without BA selection.
- Expose private journal text in learning events.
- Use private journal entries for organizational learning without authorized promotion.

### 25.3 Relationship Ethics Guardrails

The Learning Pipeline must not:

- Optimize pressure.
- Optimize manipulation.
- Optimize fear-based urgency.
- Treat prospect silence as proof of failure.
- Treat a draft being created as proof of effectiveness.
- Overgeneralize relationship approaches from weak evidence.

### 25.4 Compliance Guardrails

The Learning Pipeline must not:

- Promote unreviewed income claims.
- Promote unreviewed medical claims.
- Treat repeated risky claims as valid because they are common.
- Convert compliance-sensitive patterns into approved knowledge without review.

### 25.5 Bilingual Guardrails

The Learning Pipeline must not:

- Treat unreviewed translation as approved.
- Hide Spanish coverage gaps.
- Hide English coverage gaps.
- Merge English and Spanish evidence without preserving language metadata.

---

## 26. Bilingual Learning Requirements

English and Spanish are first-class runtime languages.

### 26.1 Required Bilingual Metadata

Every learning outcome, signal, pattern, and candidate proposal must include:

```ts id="z5kjb7"
language: "en" | "es";
```

### 26.2 Bilingual Parity Tracking

The Learning Pipeline must track:

- English approved knowledge coverage
- Spanish approved knowledge coverage
- English candidate creation
- Spanish candidate creation
- English training confusion
- Spanish training confusion
- English relationship pattern signals
- Spanish relationship pattern signals
- Translation gap signals
- Language fallback events

### 26.3 Language Separation Rule

Learning evidence must preserve the language in which it occurred.

Cross-language pattern detection may occur only when the system can preserve original language and explain the connection.

---

## 27. Privacy Requirements

### 27.1 Brand Ambassador Privacy

Learning records must be scoped to Team Magnificent and BA where applicable.

One BA's private data must not be exposed to another BA.

### 27.2 Journal Privacy

Private journal entries are excluded unless selected for review.

Selected journal entries may create signals or candidates only through authorized workflow.

### 27.3 Prospect Privacy

Prospect-sensitive relationship context must be minimized.

Learning records should reference relationship context IDs rather than embedding sensitive details.

### 27.4 Transcript Privacy

Browser Voice and Browser Text transcripts should be referenced by turn IDs, transcript IDs, or event IDs.

Learning records should not duplicate unnecessary transcript body text.

### 27.5 External Runtime Privacy

External SMS, voicemail, and callback outcomes must avoid unnecessary communication body text.

Use message hashes and references when possible.

---

## 28. Failure Behavior

The Learning Pipeline must fail safely.

### 28.1 Failure Types

```ts id="jg7fdd"
export type LearningPipelineErrorType =
  | "outcome_record_failed"
  | "signal_creation_failed"
  | "pattern_detection_failed"
  | "candidate_proposal_failed"
  | "metrics_update_failed"
  | "graph_update_failed"
  | "permission_denied"
  | "private_journal_not_selected"
  | "invalid_team_scope"
  | "invalid_ba_scope"
  | "invalid_language"
  | "evidence_missing"
  | "event_replay_blocked";
```

### 28.2 Error Model

```ts id="x3bh1j"
export interface LearningPipelineError {
  errorId: string;

  errorType: LearningPipelineErrorType;

  tenantId: string;

  teamId?: string;

  baId?: string;

  outcomeId?: string;

  signalId?: string;

  message: string;

  safeMessage: string;

  retryable: boolean;

  occurredAt: Date;

  metadata?: Record<string, unknown>;
}
```

### 28.3 Failure Rules

If learning signal creation fails:

- Preserve the outcome.
- Record error.
- Retry if safe.

If candidate proposal fails:

- Preserve signal.
- Do not create partial candidate.
- Record error.

If graph update fails:

- Preserve learning record.
- Mark graph sync pending or failed.
- Retry through graph service.

If private journal content is not selected:

- Do not create organizational signal.
- Record exclusion where appropriate.

---

## 29. Observability

The Learning Pipeline must expose operational observability.

### 29.1 Required Metrics

The implementation must track:

- Outcomes recorded
- Outcomes by type
- Outcomes by agent
- Outcomes by language
- Outcomes by Team Magnificent scope
- Learning signals created
- Signals by type
- Signals by domain
- Signals by priority
- Signals by language
- Patterns detected
- Candidate proposals created
- Candidate proposals sent to ingestion
- Candidates created from signals
- Review requests created
- Knowledge validation signals
- Knowledge weakening signals
- Knowledge refinement signals
- Knowledge supersession signals
- Metrics snapshots generated
- Bilingual parity score
- Journal adoption rate
- Guided action completion rate
- Voice fallback rate
- Language fallback rate
- Learning pipeline failures

### 29.2 Required Logs

The implementation must log:

- Outcome created
- Signal created
- Signal triaged
- Pattern detected
- Candidate proposed
- Candidate linked to outcome
- Knowledge validation signal
- Knowledge weakening signal
- Knowledge refinement signal
- Knowledge supersession signal
- Metrics updated
- Error recorded
- Private journal excluded
- Bilingual parity gap detected

### 29.3 Required Health Checks

The Learning Pipeline must expose health checks for:

- Event service availability
- Outcome storage availability
- Signal storage availability
- Knowledge Ingestion availability
- Knowledge Core availability
- Graph service availability
- Metrics projection availability
- Pattern detection worker availability
- Failed learning job backlog

---

## 30. Persistence Requirements

### 30.1 Required Collections

Version 1.0 requires:

```text id="d401ka"
learning_outcomes
learning_signals
learning_patterns
learning_candidate_proposals
learning_metrics_snapshots
learning_errors
learning_pattern_detection_jobs
learning_graph_update_jobs
```

### 30.2 Required Indexes

```text id="a9f9wz"
learning_outcomes.outcomeId unique
learning_outcomes.tenantId
learning_outcomes.teamId
learning_outcomes.baId
learning_outcomes.sessionId
learning_outcomes.agentKey
learning_outcomes.guidedActionId
learning_outcomes.outcomeType
learning_outcomes.language
learning_outcomes.occurredAt

learning_signals.signalId unique
learning_signals.tenantId
learning_signals.teamId
learning_signals.baId
learning_signals.signalType
learning_signals.domain
learning_signals.language
learning_signals.priority
learning_signals.status
learning_signals.createdAt

learning_patterns.patternId unique
learning_patterns.tenantId
learning_patterns.teamId
learning_patterns.patternType
learning_patterns.domain
learning_patterns.language
learning_patterns.status
learning_patterns.lastSeenAt

learning_candidate_proposals.proposalId unique
learning_candidate_proposals.tenantId
learning_candidate_proposals.teamId
learning_candidate_proposals.signalId
learning_candidate_proposals.domain
learning_candidate_proposals.language
learning_candidate_proposals.status

learning_metrics_snapshots.metricsSnapshotId unique
learning_metrics_snapshots.tenantId
learning_metrics_snapshots.teamId
learning_metrics_snapshots.periodStart
learning_metrics_snapshots.periodEnd
```

---

## 31. Runtime Data Flows

### 31.1 Guided Action Learning Flow

```text id="e1s35j"
Agent suggests Guided Action
  ↓
BA accepts or dismisses
  ↓
BA completes, misses, or skips action
  ↓
Outcome recorded
  ↓
Outcome linked to Context Packet and knowledge
  ↓
Learning Signal created if useful
  ↓
Pattern detection evaluates repeated outcomes
  ↓
Candidate proposed when evidence threshold is met
```

### 31.2 Training Confusion Flow

```text id="my7qgk"
Michael answers training question
  ↓
Similar question repeats across sessions
  ↓
Pattern detection identifies repeat question
  ↓
Learning Signal created
  ↓
Training candidate proposed
  ↓
Review decides whether to approve improved training knowledge
```

### 31.3 Relationship Learning Flow

```text id="g5zvde"
Ivory creates editable draft
  ↓
BA edits or uses draft
  ↓
Follow-up outcome recorded
  ↓
Relationship approach evaluated cautiously
  ↓
Signal created only when evidence is sufficient
  ↓
Candidate proposed for review
```

### 31.4 Journal Learning Flow

```text id="pn95td"
BA selects journal entry for review
  ↓
Journal selection event emitted
  ↓
Knowledge Ingestion creates candidate
  ↓
Learning Pipeline may link candidate to outcomes
  ↓
Review determines organizational use
```

### 31.5 Bilingual Gap Flow

```text id="o7yc3l"
Approved English knowledge exists
  ↓
No approved Spanish equivalent exists
  ↓
Language fallback events increase
  ↓
Bilingual parity gap detected
  ↓
Learning Signal created
  ↓
Translation or localization candidate requested
```

---

## 32. Relationship to Agent Runtime

Agent Runtime produces sessions, turns, guided actions, candidate proposals, journal entries, invitation drafts, and session completions.

The Learning Pipeline consumes Agent Runtime events to evaluate:

- Whether guidance led to action
- Whether actions were completed
- Whether outputs were edited
- Whether sessions completed successfully
- Whether agents repeatedly hit the same gaps
- Whether output guardrails are blocking repeated patterns

Agent Runtime does not perform learning analysis itself.

---

## 33. Relationship to Context Manager

Context Manager produces Context Packets and retrieval audits.

The Learning Pipeline uses Context Packet records to evaluate:

- Which knowledge was included
- Which private context was included
- Which relationship context was included
- Whether language fallback was used
- Whether degraded context affected outcomes
- Whether retrieval usefulness improved action quality

The Learning Pipeline must not assemble live Context Packets.

---

## 34. Relationship to Knowledge Core

Knowledge Core stores approved knowledge and learning-linked metadata.

The Learning Pipeline sends learning signals and quality flags to Knowledge Core through approved services.

The Learning Pipeline may recommend validation, weakening, refinement, or supersession.

Knowledge Core lifecycle and governance processes decide final knowledge status.

---

## 35. Relationship to Knowledge Ingestion

Knowledge Ingestion prepares candidate knowledge.

The Learning Pipeline sends candidate proposals to Knowledge Ingestion.

Knowledge Ingestion performs:

- Capture
- Normalize
- Classify
- Segment
- Risk-check
- Dedupe
- Candidate creation
- Review-only indexing
- Graph lineage

The Learning Pipeline does not skip ingestion.

---

## 36. Relationship to Agent Events

Agent Events provide runtime facts.

The Learning Pipeline consumes event streams and emits learning events.

Correlation IDs and causation IDs must allow reconstruction of:

- Agent session
- Context Packet usage
- Guided Action
- Outcome
- Learning Signal
- Candidate proposal

---

## 37. Relationship to Browser Voice Runtime

Browser Voice Runtime provides voice interaction events.

The Learning Pipeline may evaluate:

- Voice fallback rates
- Transcript correction frequency
- Low-confidence transcript frequency
- Language change frequency
- Spanish voice friction
- Session completion differences between voice and text

Browser Voice learning must not store raw audio.

---

## 38. Relationship to Browser Text Runtime

Browser Text Runtime provides typed interaction events.

The Learning Pipeline may evaluate:

- Text fallback completion
- Repeated typed questions
- Text-based training confusion
- Session completion patterns

---

## 39. Relationship to Momentum Journal

Momentum Journal is private by default.

The Learning Pipeline may learn from journal entries only when:

- The BA selects the entry for review.
- The journal entry enters authorized candidate pathway.
- The resulting candidate or outcome is linked through approved services.

The Learning Pipeline must not mine private journals automatically for organizational learning.

---

## 40. Relationship to External Runtime

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

The Learning Pipeline may observe external outcomes, such as SMS response or callback completion.

The Learning Pipeline must not send external communications.

Replay must not resend external communications.

---

## 41. Implementation Structure for Codex

Recommended implementation layout:

```text id="p400lo"
server/src/runtime/learning/
  index.ts

  learning.types.ts
  learning.constants.ts

  models/
    LearningOutcome.model.ts
    LearningSignal.model.ts
    LearningPattern.model.ts
    LearningCandidateProposal.model.ts
    LearningMetricsSnapshot.model.ts
    LearningError.model.ts
    LearningPatternDetectionJob.model.ts
    LearningGraphUpdateJob.model.ts

  services/
    LearningPipeline.service.ts
    OutcomeService.ts
    LearningSignalService.ts
    PatternDetectionService.ts
    CandidateProposalService.ts
    LearningMetricsService.ts
    LearningGraphService.ts
    LearningPrivacyService.ts
    LearningBilingualService.ts
    LearningEventConsumer.ts
    LearningEventPublisher.ts

  rules/
    repeatQuestion.rule.ts
    successfulActionPattern.rule.ts
    failedActionPattern.rule.ts
    journalAdoption.rule.ts
    voiceRuntimeFriction.rule.ts
    bilingualParityGap.rule.ts

  graph/
    learningGraphMapper.ts
    learningGraphSync.service.ts

  metrics/
    learningMetricsProjection.service.ts
    bilingualParity.service.ts
    journalAdoptionMetrics.service.ts
    retrievalUsefulnessMetrics.service.ts

  routes.ts

  tests/
    learning.outcome.test.ts
    learning.signal.test.ts
    learning.patternDetection.test.ts
    learning.candidateProposal.test.ts
    learning.privacy.test.ts
    learning.bilingual.test.ts
    learning.metrics.test.ts
    learning.graph.test.ts
```

---

## 42. Minimal Runtime Implementation Sequence

Codex should implement the Learning Pipeline in this order.

### Step 1: Types

Implement outcome, signal, pattern, proposal, evidence, metrics, and error types.

### Step 2: Models

Implement MongoDB models and required indexes.

### Step 3: Outcome Service

Implement outcome creation, linking, and event emission.

### Step 4: Signal Service

Implement learning signal creation, status changes, and triage.

### Step 5: Event Consumer

Consume agent, context, journal, guided action, browser voice, knowledge, and external events.

### Step 6: Pattern Detection Rules

Implement MVP rules-based detection.

### Step 7: Candidate Proposal Service

Create candidate proposals and send them to Knowledge Ingestion.

### Step 8: Graph Sync

Implement learning graph relationships through graph service.

### Step 9: Metrics

Implement learning metrics snapshots and projections.

### Step 10: Privacy and Bilingual Policies

Implement Team Magnificent scope, journal privacy, relationship privacy, and language metadata rules.

### Step 11: APIs

Implement runtime endpoints.

### Step 12: Events

Emit learning events.

### Step 13: Tests

Implement acceptance test suite.

---

## 43. Testing Requirements

### 43.1 Unit Tests

Unit tests must cover:

- Outcome creation
- Signal creation
- Signal triage
- Pattern detection
- Candidate proposal creation
- Metrics calculation
- Bilingual metadata
- Team Magnificent scope validation
- Journal privacy exclusion
- Evidence linking
- Error handling

### 43.2 Integration Tests

Integration tests must cover:

- Guided Action to outcome to signal flow
- Agent session completed to learning signal flow
- Context Packet to outcome linking
- Journal selection to candidate linkage
- Pattern detection from repeated questions
- Candidate proposal to Knowledge Ingestion handoff
- Metrics snapshot generation
- Graph relationship update

### 43.3 Privacy Tests

Privacy tests must prove:

- Private journal entries are excluded unless selected.
- Journal text is not copied into learning events.
- Prospect-sensitive details are minimized.
- One BA's private outcome details are not exposed to another BA.
- Learning records preserve Team Magnificent scope.

### 43.4 Bilingual Tests

Bilingual tests must prove:

- English outcomes are recorded.
- Spanish outcomes are recorded.
- English signals are created.
- Spanish signals are created.
- Bilingual parity gaps are detected.
- Language fallback events can produce signals.
- Cross-language evidence preserves original language.

### 43.5 Governance Boundary Tests

Governance boundary tests must prove:

- Learning Pipeline cannot approve knowledge.
- Learning Pipeline cannot activate knowledge.
- Learning Pipeline cannot supersede knowledge directly.
- Candidate proposals remain review-only.
- Compliance-sensitive patterns are routed to review.

### 43.6 Runtime Boundary Tests

Runtime boundary tests must prove:

- Learning replay does not send SMS.
- Learning replay does not send voicemail.
- Learning replay does not execute callbacks.
- Learning Pipeline does not use Telnyx directly.
- Learning Pipeline does not bypass Knowledge Ingestion.

---

## 44. Acceptance Criteria

The Learning Pipeline Runtime is complete only when all acceptance criteria are satisfied.

### 44.1 Outcome Acceptance Criteria

- Outcomes can be recorded.
- Outcomes preserve Team Magnificent scope.
- Outcomes can be linked to sessions.
- Outcomes can be linked to agents.
- Outcomes can be linked to Context Packets.
- Outcomes can be linked to Guided Actions.
- Outcomes can be linked to knowledge.
- Outcomes support English and Spanish.

### 44.2 Signal Acceptance Criteria

- Learning signals can be created.
- Signals preserve Team Magnificent scope.
- Signals can link to outcomes.
- Signals can link to events.
- Signals can link to candidates.
- Signals can link to knowledge.
- Signals can be triaged.
- Signals support English and Spanish.

### 44.3 Pattern Detection Acceptance Criteria

- Rules-based pattern detection works.
- Repeat question detection works.
- Successful action pattern detection works.
- Failed action pattern detection works.
- Journal adoption detection works.
- Voice runtime friction detection works.
- Bilingual parity gap detection works.
- Detected patterns preserve evidence.

### 44.4 Candidate Proposal Acceptance Criteria

- Pattern detection can propose candidates.
- Candidate proposals preserve evidence.
- Candidate proposals preserve risk flags.
- Candidate proposals are sent to Knowledge Ingestion.
- Review remains separate from learning automation.
- Candidates are not approved automatically.

### 44.5 Knowledge Evolution Acceptance Criteria

- Approved knowledge can be linked to outcomes.
- Knowledge can be validated by outcomes.
- Knowledge can be weakened by outcomes.
- Knowledge can be marked for refinement.
- Knowledge can be recommended for supersession.
- Actual approval, activation, and supersession remain Knowledge Core and governance responsibilities.

### 44.6 Graph Acceptance Criteria

- Guided Actions link to Outcomes.
- Knowledge links to Guided Actions.
- Outcomes can validate, weaken, or refine Knowledge.
- Learning Signals link to Outcomes.
- Learning Signals propose Knowledge Candidates.
- Team Magnificent membership is represented.
- Graph updates are idempotent.

### 44.7 Metrics Acceptance Criteria

- Candidate creation rate is calculated.
- Approval rate is calculated.
- Supersession rate is calculated.
- Retrieval usefulness is calculated.
- Repeated confusion count is calculated.
- Journal adoption is calculated.
- Bilingual parity score is calculated.
- Guided action completion rate is calculated.
- Voice fallback rate is calculated.

### 44.8 Privacy Acceptance Criteria

- Private journal entries are excluded unless selected.
- Learning does not mine private journals automatically.
- Learning events avoid unnecessary private text.
- Prospect-sensitive data is minimized.
- Team Magnificent scope is enforced.
- BA scope is enforced where applicable.

### 44.9 Guardrail Acceptance Criteria

- Learning Pipeline does not approve knowledge automatically.
- Learning Pipeline does not promote unreviewed claims.
- Learning Pipeline does not optimize pressure or manipulation.
- Learning Pipeline does not treat drafts as proof of effectiveness.
- Learning Pipeline does not expose sensitive context outside BA-owned workflows.

### 44.10 Runtime Boundary Acceptance Criteria

- Learning Pipeline does not send external communications.
- Learning Pipeline does not use Telnyx directly.
- Learning Pipeline does not bypass Knowledge Ingestion.
- Learning Pipeline does not bypass Knowledge Core lifecycle.
- Learning Pipeline uses Agent Events and service layers.

---

## 45. Required Invariants

The following invariants must always hold.

1. Learning does not approve knowledge.
2. Learning does not activate knowledge.
3. Learning does not supersede knowledge directly.
4. Learning does not bypass governance.
5. Learning does not bypass Knowledge Ingestion.
6. Learning signals are evidence-linked.
7. Candidate proposals are review-only.
8. Private journal entries are excluded unless selected.
9. Journal text is not unnecessarily copied into events.
10. Prospect-sensitive context is minimized.
11. Team Magnificent scope is required.
12. BA-scoped learning records are also Team Magnificent scoped.
13. English is supported.
14. Spanish is supported.
15. Language metadata is preserved.
16. Bilingual parity is measured.
17. Guided Actions are BA-owned.
18. Draft usage alone is not proof of effectiveness.
19. Learning does not optimize pressure or manipulation.
20. Learning replay does not send external communications.
21. Telnyx is external only.
22. Browser Voice learning does not store raw audio.
23. Outcomes link back to context where possible.
24. Context Packet records support learning traceability.
25. Metrics are derived from events and outcomes, not invented.

---

## 46. Completion Definition

The Learning Pipeline is considered Version 1.0 complete when:

- Learning Outcome model exists.
- Learning Signal model exists.
- Learning Pattern model exists.
- Learning Candidate Proposal model exists.
- Team Magnificent scope is implemented.
- Outcomes can be recorded.
- Signals can be created.
- Signals can be triaged.
- Pattern detection works.
- Candidate proposals can be sent to Knowledge Ingestion.
- Review remains separate.
- Approved knowledge can be linked to outcomes.
- Knowledge validation, weakening, refinement, and supersession signals exist.
- Graph relationships can be updated.
- Metrics can be calculated.
- English and Spanish learning records are supported.
- Private journal exclusion is enforced.
- External communication side effects are blocked.
- Learning events are emitted.
- Acceptance tests pass.

---

## 47. Final Runtime Statement

The Learning Pipeline is how Momentum Creation System V2 improves through experience.

It observes what happened.

It links outcomes to guidance.

It detects repeated patterns.

It creates evidence-backed signals.

It proposes candidate improvements.

It preserves Team Magnificent scope.

It protects Brand Ambassador privacy.

It keeps the Momentum Journal private unless selected.

It supports English and Spanish.

It avoids pressure, manipulation, and unreviewed claims.

It never approves knowledge automatically.

It never replaces governance.

It never bypasses the Knowledge Core.

It never sends external communications.

It helps Momentum become wiser because the organization learns from real actions and real outcomes.

The Agent guides.

The Brand Ambassador acts.

The outcome teaches.

The Learning Pipeline observes.

The Knowledge Core evolves through review.

Momentum improves.

---

## Ratification

Status: RATIFIED

Ratified By: Kevin Gardner

Ratification Date: 2026-06-27

Architecture Review: PASS

Review Authority: Claude (Chief Governance Architect)

Implementation Authority: Codex

Version: 1.0.0

This document is now a canonical source-of-truth for Momentum Creation System V2.

Future modifications require an approved ACR.
