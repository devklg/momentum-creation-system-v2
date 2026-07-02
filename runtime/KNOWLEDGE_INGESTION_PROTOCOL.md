# KNOWLEDGE_INGESTION_PROTOCOL.md

## Momentum Creation System V2

### Knowledge Ingestion Protocol Runtime Specification

#### Version 1.0

---

## 1. Document Status

**Document Name:** Knowledge Ingestion Protocol Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Upstream Dependency:** Knowledge Core Runtime
**Primary Downstream Consumer:** Knowledge Core Runtime
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

---

## 2. Purpose

The Knowledge Ingestion Protocol defines how raw conversations, sessions, outcomes, journal entries, administrative decisions, runtime events, and learning signals become structured knowledge inputs for the Knowledge Core.

The Knowledge Ingestion Protocol prepares knowledge.

It does not approve knowledge.

It does not activate organizational knowledge.

It does not determine what agents should know.

It does not assemble Context Packets.

It does not allow agents to bypass governance.

Its responsibility is to receive raw input, preserve the source, normalize the content, classify the domain, segment useful knowledge, detect risk, detect duplication, create Knowledge Candidates, preserve lineage, prepare review indexing, link graph relationships, and submit eligible knowledge into the Knowledge Core.

The Knowledge Ingestion Protocol answers this runtime question:

> How does raw experience become structured knowledge Momentum can evaluate?

The Knowledge Core answers:

> What does Momentum know?

The Context Manager answers:

> What knowledge does this agent need right now?

This separation is mandatory.

---

## 3. Runtime Philosophy

Momentum is a learning organization.

Learning begins when experience is captured.

Experience becomes useful only when it is preserved, structured, traced, governed, and connected.

The Knowledge Ingestion Protocol is the runtime bridge between lived activity and durable knowledge.

The operating philosophy is:

```text
Conversation creates raw experience.

Raw experience becomes captured input.

Captured input becomes normalized content.

Normalized content becomes classified knowledge material.

Classified material becomes segmented candidate knowledge.

Candidate knowledge enters review.

Reviewed knowledge may become approved organizational knowledge.

Approved knowledge enriches the Knowledge Core.

The Knowledge Core enriches context.

Context improves guidance.

Guidance produces action.

Action produces outcomes.

Outcomes produce learning.

Learning expands organizational understanding.
```

Agents do not become intelligent by independently remembering everything.

Momentum becomes more intelligent because the Knowledge Core receives better, cleaner, safer, traceable knowledge through this protocol.

---

## 4. Foundational Principle

The Knowledge Ingestion Protocol must enforce the following principle:

```text
Raw conversation != private journal != knowledge candidate != approved organizational knowledge
```

A raw conversation is not automatically knowledge.

A private journal entry is not automatically organizational learning.

A lesson is not automatically approved guidance.

A repeated pattern is not automatically truth.

A candidate is not approved knowledge.

A review item is not active guidance.

A private Brand Ambassador reflection is not organizational property unless intentionally promoted through an authorized workflow.

This principle protects:

- Brand Ambassador privacy
- Organizational integrity
- Knowledge quality
- Governance authority
- Runtime consistency
- Agent boundaries
- Bilingual accuracy
- Source traceability

---

## 5. Runtime Position

The Knowledge Ingestion Protocol sits between Knowledge Sources and the Knowledge Core.

```text
Knowledge Sources
  ↓
Knowledge Ingestion Protocol
  ↓
Knowledge Core
  ↓
Context Manager
  ↓
Context Packet
  ↓
Agent Runtime
  ↓
Guided Action
  ↓
Outcome
  ↓
Learning Pipeline
  ↓
Knowledge Evolution
```

The Knowledge Ingestion Protocol is upstream of the Knowledge Core write interface.

It is downstream of all runtime sources that generate knowledge-bearing material.

It must preserve all raw source lineage before any transformation occurs.

---

## 6. Scope

This document defines the Version 1.0 runtime specification for Knowledge Ingestion.

It defines:

- Purpose
- Responsibilities
- Non-responsibilities
- Ingestion sources
- Ingestion stages
- Data models
- Capture requirements
- Normalization requirements
- Classification requirements
- Segmentation requirements
- Risk-check requirements
- Dedupe requirements
- Candidate creation requirements
- Review-only indexing requirements
- Graph lineage requirements
- Journal privacy requirements
- Personal knowledge promotion requirements
- Bilingual requirements
- Event requirements
- Idempotency rules
- Interfaces
- APIs
- Storage requirements
- Runtime flows
- Error handling
- Observability
- Acceptance criteria
- Relationship to other runtime components

This document does not define the full Knowledge Core storage architecture.

That is defined in `KNOWLEDGE_CORE_RUNTIME.md`.

This document does not define Context Packet assembly.

That is defined in `CONTEXT_MANAGER.md` and `CONTEXT_PACKET_SCHEMA.md`.

This document does not define agent scripts.

Agent-specific behavior belongs in Agent Runtime and Implementation documents.

This document does not define application UI behavior.

Application behavior belongs in Implementation documents.

---

## 7. Core Responsibilities

The Knowledge Ingestion Protocol is responsible for the following runtime functions.

### 7.1 Capture Raw Input

The protocol must capture the original input exactly enough to preserve source integrity.

Captured input may come from:

- Browser Voice transcript
- Browser Text session
- Steve Success session
- Michael Magnificent session
- Ivory session
- Momentum Journal entry
- Knowledge Session
- Outcome event
- Guided Action event
- PMV activity
- SMS activity
- Ringless voicemail activity
- Future callback workflow activity
- Administrative import
- Governance decision
- Leadership review
- Training completion
- Support conversation

Capture must preserve:

- Source type
- Source ID
- Actor
- Brand Ambassador scope
- Language
- Timestamp
- Input mode
- Original text
- Transcript confidence where applicable
- Metadata
- Permission scope
- Visibility
- Correlation ID

### 7.2 Preserve Original Meaning

Normalization may clean and structure the input.

Normalization must not change meaning.

Normalization must not turn private content into organizational content.

Normalization must not convert uncertainty into certainty.

Normalization must not invent facts.

Normalization must not remove source context required for review.

### 7.3 Classify Knowledge Domain

The protocol must classify knowledge into one or more runtime domains.

Primary domains include:

- Success
- Training
- Relationship
- Performance
- Personal
- Organizational
- System
- Governance

Classification determines the candidate pathway.

Classification does not approve the knowledge.

### 7.4 Segment Knowledge

The protocol must break captured and normalized input into meaningful knowledge chunks.

Segments must be small enough for review and retrieval.

Segments must preserve source lineage.

Segments must preserve order where order matters.

Segments must preserve visibility and privacy constraints.

### 7.5 Risk-Check Knowledge

The protocol must detect sensitive, risky, private, unverified, outdated, or compliance-sensitive content before candidate creation or review queue insertion.

Risk flags do not automatically reject content.

Risk flags route content to appropriate review.

### 7.6 Detect Duplicates

The protocol must detect whether incoming knowledge duplicates or overlaps with:

- Existing approved organizational knowledge
- Existing review candidates
- Same source session content
- Same journal entry content
- Related Chroma semantic matches
- Related Neo4j concepts
- Superseded knowledge
- Existing training FAQs
- Existing relationship guidance
- Existing success patterns

Dedupe must occur before queue insertion.

### 7.7 Create Knowledge Candidates

The protocol must create Knowledge Candidates from eligible segmented knowledge.

Candidates must preserve:

- Source lineage
- Domain
- Owner
- Visibility
- Language
- Risk flags
- Dedupe result
- Candidate likelihood
- Review scope
- Graph lineage
- Audit trail

Candidate creation does not equal approval.

### 7.8 Index for Review Only

Candidates may be indexed in Chroma for review and dedupe purposes only.

Review-only indexing must not allow candidates to appear as approved agent guidance.

Candidate embeddings must be clearly separated from active organizational knowledge embeddings.

### 7.9 Link Graph Lineage

The protocol must create graph relationships showing where candidate knowledge came from and what it relates to.

Graph lineage allows Momentum to understand source, relationship, similarity, ownership, and review history.

### 7.10 Queue for Review

Candidates requiring review must be queued with complete metadata.

The review queue must include:

- Candidate summary
- Source references
- Risk flags
- Domain
- Candidate likelihood
- Dedupe outcome
- Language
- Visibility
- Suggested reviewer scope
- Evidence strength
- Review priority

### 7.11 Enforce Journal Privacy

Momentum Journal content is private to the Brand Ambassador by default.

Journal entries may become candidates only when:

- The Brand Ambassador selects the entry for review
- The Brand Ambassador explicitly consents through an authorized workflow
- A ratified governance process permits a specific promotion path

No private journal entry may be automatically promoted.

### 7.12 Support Bilingual Operation

The ingestion protocol must support English and Spanish.

It must preserve original language, detected language, translation status, and review requirements.

Machine translation may support review workflows but may not become approved organizational knowledge without review.

---

## 8. Non-Responsibilities

The Knowledge Ingestion Protocol must not perform responsibilities assigned to other runtime components.

### 8.1 It Does Not Approve Knowledge

Approval belongs to governance, review workflows, Knowledge Sessions, or authorized administrative processes.

### 8.2 It Does Not Activate Knowledge

Activation belongs to the Knowledge Core lifecycle process.

### 8.3 It Does Not Assemble Context Packets

The Context Manager assembles Context Packets.

### 8.4 It Does Not Decide Agent Responses

Agents respond using Context Packets.

Ingestion prepares knowledge for storage and review.

### 8.5 It Does Not Expose Private Journal Knowledge

Private Momentum Journal content remains private unless intentionally promoted.

### 8.6 It Does Not Treat Candidates as Approved Knowledge

Candidate knowledge must not be retrieved as active agent guidance.

### 8.7 It Does Not Replace the Learning Pipeline

The Learning Pipeline evaluates outcomes and proposes learning signals.

The Knowledge Ingestion Protocol receives and structures those signals.

### 8.8 It Does Not Replace the Knowledge Core

The Knowledge Core stores, governs, indexes, connects, retrieves, and evolves knowledge.

The Knowledge Ingestion Protocol prepares input for the Knowledge Core.

---

## 9. Ingestion Sources

Knowledge may enter ingestion from internal runtime, external runtime, administrative sources, and learning sources.

Every source must preserve origin metadata.

### 9.1 Source Table

| Source                      | Default Visibility                               | Candidate Pathway                                          | Notes                                                                                                |
| --------------------------- | ------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Steve Success session       | Session-scoped / BA-scoped                       | Success Knowledge Candidate                                | Captures Brand Ambassador success profile, goals, obstacles, motivation, momentum, and support needs |
| Michael Magnificent session | Session-scoped / BA-scoped                       | Training Knowledge Candidate                               | Captures training needs, learning style, skill gaps, progress, duplication readiness                 |
| Ivory session               | Session-scoped / BA-scoped / relationship-scoped | Relationship Knowledge Candidate                           | Captures opportunity map, prospect context, invitation history, follow-up patterns                   |
| Browser Voice session       | Session-scoped                                   | Agent-session candidate pathway                            | Internal browser voice transcript only; no Telnyx                                                    |
| Browser Text session        | Session-scoped                                   | Agent-session candidate pathway                            | Internal text session                                                                                |
| Momentum Journal            | Private to Brand Ambassador                      | BA selects for review                                      | Private by default; no automatic promotion                                                           |
| Knowledge Session           | Review-scoped                                    | Direct candidate creation                                  | Used for organizational learning and ratified knowledge development                                  |
| Outcome event               | Runtime event                                    | Learning Pipeline proposes candidate                       | Outcome may generate learning signal                                                                 |
| Guided Action event         | Runtime event                                    | Performance candidate / learning signal                    | Captures action completion and results                                                               |
| PMV activity                | Relationship / performance scoped                | Relationship or performance candidate                      | External prospect engagement context                                                                 |
| SMS activity                | Relationship scoped                              | Relationship candidate                                     | External runtime; Telnyx permitted only here if used                                                 |
| Ringless voicemail activity | Relationship scoped                              | Relationship candidate                                     | External runtime; Telnyx permitted only here if used                                                 |
| Callback workflow activity  | Relationship scoped                              | Relationship candidate                                     | Future external workflow; Telnyx permitted only here if used                                         |
| Administrative import       | Admin-scoped                                     | Candidate or approved import depending on ratified process | Must preserve authority and source                                                                   |
| Governance decision         | Governance-scoped                                | Governance knowledge candidate or direct approved record   | Depends on ratified process                                                                          |
| Leadership review           | Leadership-scoped                                | Candidate or quality flag                                  | May create learning or review signal                                                                 |
| Support conversation        | Support-scoped                                   | Training, system, or FAQ candidate                         | May identify repeated support patterns                                                               |

---

## 10. Ingestion Pipeline

The standard ingestion pipeline is:

```text
Capture
  ↓
Normalize
  ↓
Classify
  ↓
Segment
  ↓
Risk-check
  ↓
Dedupe
  ↓
Candidate-create
  ↓
Index-for-review
  ↓
Graph-link
  ↓
Queue-for-review
```

Each stage must be idempotent.

Each stage must preserve audit metadata.

Each stage must produce a typed result.

Each stage must emit an event.

Each stage must preserve source lineage.

A failure in a later stage must not erase the captured source.

---

## 11. Stage 1: Capture

Capture stores the original input.

Capture must happen before transformation.

Capture must preserve raw text or transcript text.

For Version 1.0 Browser Voice, Momentum stores transcripts, language, confidence, and final/interim status.

Version 1.0 does not require storing raw audio.

### 11.1 Captured Input Model

```ts
interface CapturedInput {
  captureId: string;
  tenantId: string;

  teamId?: string;
  teamKey?: "team_magnificent";
  teamName?: "Team Magnificent";

  baId?: string;
  prospectId?: string;

  sourceType:
    | "agent_session"
    | "journal_entry"
    | "knowledge_session"
    | "outcome"
    | "guided_action"
    | "manual_import"
    | "admin_decision"
    | "governance_decision"
    | "browser_voice_session"
    | "browser_text_session"
    | "pmv_activity"
    | "sms_activity"
    | "ringless_voicemail_activity"
    | "callback_workflow_activity"
    | "leadership_review"
    | "support_conversation"
    | "training_completion";

  sourceId: string;

  agentKey?: "steve_success" | "michael_magnificent" | "ivory";

  inputMode: "voice" | "text" | "system" | "import" | "event";

  language: "en" | "es";

  originalText: string;

  capturedAt: Date;
  capturedBy: RuntimeActor;

  visibility:
    | "private_to_ba"
    | "session_scoped"
    | "relationship_scoped"
    | "review_only"
    | "admin_scoped"
    | "governance_scoped"
    | "organizational";

  permissionScope: PermissionScope[];

  transcript?: TranscriptMetadata;

  correlationId?: string;
  causationId?: string;

  metadata?: Record<string, unknown>;
}
```

### 11.2 Runtime Actor Model

```ts
interface RuntimeActor {
  actorType:
    | "brand_ambassador"
    | "agent"
    | "system"
    | "admin"
    | "governance"
    | "learning_pipeline"
    | "external_runtime";

  actorId: string;

  displayName?: string;
}
```

### 11.3 Transcript Metadata

```ts
interface TranscriptMetadata {
  transcriptProvider?: "browser_speech" | "internal_stt" | "manual" | "system";
  confidence?: number;
  isFinal?: boolean;
  segmentSequence?: number;
  startedAt?: Date;
  endedAt?: Date;
  detectedLanguage?: "en" | "es";
}
```

### 11.4 Capture Requirements

Capture must:

- Store the original text.
- Preserve source type.
- Preserve source ID.
- Preserve Brand Ambassador scope where applicable.
- Preserve prospect scope where applicable.
- Preserve agent key where applicable.
- Preserve language.
- Preserve visibility.
- Preserve permission scope.
- Preserve timestamp.
- Preserve actor.
- Preserve transcript metadata for Browser Voice.
- Generate an immutable capture ID.
- Emit `knowledge.capture.created`.

### 11.5 Capture Prohibitions

Capture must not:

- Summarize before preserving original text.
- Translate without preserving original language.
- Promote private content.
- Create approved knowledge.
- Change visibility.
- Drop source metadata.
- Store internal Browser Voice as Telnyx activity.

---

## 12. Stage 2: Normalize

Normalization prepares captured input for classification and candidate evaluation.

Normalization may:

- Add punctuation to transcript text.
- Clean obvious transcription artifacts.
- Detect language.
- Create a summary.
- Extract entities.
- Extract action items.
- Extract relationship context.
- Extract goals.
- Extract obstacles.
- Extract candidate signals.
- Create a candidate title.
- Identify emotional or momentum signals.
- Identify questions or repeated support needs.

Normalization must not change meaning.

Normalization must preserve original text.

Normalization must preserve uncertainty.

### 12.1 Normalized Capture Model

```ts
interface NormalizedCapture {
  normalizationId: string;
  captureId: string;

  tenantId: string;
  baId?: string;
  prospectId?: string;

  originalText: string;
  normalizedText: string;
  summary: string;

  language: "en" | "es";
  detectedLanguage: "en" | "es";
  languageConfidence: number;

  detectedEntities: DetectedEntity[];

  actionItems: string[];
  candidateSignals: CandidateSignal[];

  relationshipContext?: RelationshipContext;
  successContext?: SuccessContext;
  trainingContext?: TrainingContext;
  performanceContext?: PerformanceContext;

  candidateTitle?: string;

  createdAt: Date;
  createdBy: RuntimeActor;

  metadata?: Record<string, unknown>;
}
```

### 12.2 Detected Entity Model

```ts
interface DetectedEntity {
  type:
    | "person"
    | "product"
    | "place"
    | "concept"
    | "action"
    | "relationship"
    | "goal"
    | "skill"
    | "objection"
    | "training_module"
    | "workflow"
    | "runtime_component";

  value: string;
  normalizedValue?: string;
  confidence: number;
  sourceText?: string;
}
```

### 12.3 Candidate Signal Model

```ts
interface CandidateSignal {
  signalType:
    | "lesson_learned"
    | "repeated_question"
    | "success_pattern"
    | "training_gap"
    | "relationship_pattern"
    | "objection_pattern"
    | "script_pattern"
    | "follow_up_pattern"
    | "system_issue"
    | "workflow_improvement"
    | "leadership_insight"
    | "outcome_learning"
    | "personal_reflection"
    | "journal_promotable";

  confidence: number;
  explanation: string;
}
```

### 12.4 Normalization Requirements

Normalization must:

- Preserve original input.
- Produce normalized text.
- Produce summary.
- Preserve language.
- Detect language when needed.
- Extract entities.
- Extract candidate signals.
- Preserve privacy and visibility.
- Emit `knowledge.capture.normalized`.

### 12.5 Normalization Prohibitions

Normalization must not:

- Convert private journal content into review content.
- Claim uncertain facts as verified.
- Remove risk-relevant statements.
- Add claims not present in the source.
- Approve knowledge.
- Activate knowledge.
- Store candidate embeddings in active collections.

---

## 13. Stage 3: Classify

Classification determines the likely knowledge domain and candidate pathway.

Classification does not approve knowledge.

Classification does not determine final organizational use.

### 13.1 Knowledge Domain Type

```ts
type KnowledgeDomain =
  | "success"
  | "training"
  | "relationship"
  | "performance"
  | "personal"
  | "organizational"
  | "system"
  | "governance";
```

### 13.2 Candidate Likelihood

```ts
type CandidateLikelihood = "none" | "low" | "medium" | "high";
```

### 13.3 Classification Result Model

```ts
interface ClassificationResult {
  classificationId: string;
  captureId: string;
  normalizationId: string;

  primaryDomain: KnowledgeDomain;
  secondaryDomains: KnowledgeDomain[];

  candidateLikelihood: CandidateLikelihood;

  candidatePathway:
    | "success_knowledge_candidate"
    | "training_knowledge_candidate"
    | "relationship_knowledge_candidate"
    | "performance_knowledge_candidate"
    | "personal_knowledge_only"
    | "journal_promotion_required"
    | "organizational_candidate"
    | "system_candidate"
    | "governance_candidate"
    | "learning_pipeline_candidate"
    | "no_candidate";

  classificationSignals: ClassificationSignal[];

  requiresHumanReview: boolean;

  createdAt: Date;
  createdBy: RuntimeActor;
}
```

### 13.4 Classification Signal Model

```ts
interface ClassificationSignal {
  domain: KnowledgeDomain;
  signal: string;
  confidence: number;
  explanation: string;
}
```

### 13.5 Success Classification Signals

Classify as `success` when the content includes:

- Win
- Breakthrough
- Obstacle
- Personal goal
- Confidence change
- Motivation
- Purpose
- Action habit
- Momentum signal
- Support need
- Daily success pattern
- Brand Ambassador self-understanding
- Leadership aspiration
- Personal blocker

### 13.6 Training Classification Signals

Classify as `training` when the content includes:

- Onboarding question
- How-to explanation
- Skill gap
- Training confusion
- Repeated question
- System usage issue
- Momentum Journal teaching
- Script practice
- Duplication method
- Fast Start progress
- Leadership development
- Coaching history
- Training outcome

### 13.7 Relationship Classification Signals

Classify as `relationship` when the content includes:

- Person
- Prospect
- Relationship
- Invitation
- Communication tone
- Follow-up
- Objection
- Presentation history
- Relationship context
- Prospect need
- Prospect interest
- PMV activity
- SMS response
- Voicemail response
- Callback response

### 13.8 Performance Classification Signals

Classify as `performance` when the content includes:

- Daily activity
- Completed action
- Missed action
- Outcome
- Consistency
- Momentum tracking
- Recommendation result
- Conversion signal
- Retention signal
- Engagement signal
- Productivity pattern

### 13.9 Personal Classification Signals

Classify as `personal` when the content includes:

- Private reflection
- Journal note
- Personal idea
- Personal reminder
- Private strategy
- Self-coaching note
- Personal question
- Private voice note
- Private lesson not selected for review

### 13.10 Organizational Classification Signals

Classify as `organizational` when the content includes:

- Approved best practice
- Organizational decision
- Training standard
- Leadership standard
- Architecture standard
- Runtime specification
- Implementation standard
- Knowledge Session output

### 13.11 Classification Requirements

Classification must:

- Assign primary domain.
- Assign secondary domains when applicable.
- Assign candidate likelihood.
- Assign candidate pathway.
- Preserve reasoning signals.
- Preserve privacy.
- Emit `knowledge.capture.classified`.

---

## 14. Stage 4: Segment

Segmentation divides normalized content into reviewable and indexable knowledge chunks.

Segments become candidate draft material.

A segment is not approved knowledge.

### 14.1 Knowledge Chunk Draft Model

```ts
interface KnowledgeChunkDraft {
  chunkId: string;

  captureId: string;
  normalizationId: string;
  classificationId: string;

  sourceType: string;
  sourceId: string;

  tenantId: string;
  baId?: string;
  prospectId?: string;
  teamId?: string;

  domain: KnowledgeDomain;
  language: "en" | "es";

  title: string;
  text: string;
  summary: string;

  tags: string[];

  visibility:
    | "private_to_ba"
    | "session_scoped"
    | "relationship_scoped"
    | "review_only"
    | "admin_scoped"
    | "governance_scoped"
    | "organizational";

  permissionScope: PermissionScope[];

  order: number;

  candidateLikelihood: CandidateLikelihood;

  sourceStartOffset?: number;
  sourceEndOffset?: number;

  createdAt: Date;
  createdBy: RuntimeActor;
}
```

### 14.2 Segmentation Requirements

Segmentation must:

- Preserve source reference.
- Preserve order.
- Preserve domain.
- Preserve language.
- Preserve visibility.
- Preserve Brand Ambassador scope.
- Preserve prospect scope where applicable.
- Produce useful review units.
- Avoid mixing unrelated topics into one chunk.
- Avoid splitting one necessary context into unusable fragments.
- Emit `knowledge.capture.segmented`.

### 14.3 Segmentation Rules by Domain

#### Success Segmentation

Success segments should isolate:

- Goals
- Motivation
- Obstacles
- Confidence
- Support needs
- Momentum patterns
- Action habits
- Breakthroughs
- Personal wins

#### Training Segmentation

Training segments should isolate:

- One training question
- One how-to explanation
- One skill gap
- One FAQ candidate
- One coaching insight
- One duplication issue
- One system usage problem

#### Relationship Segmentation

Relationship segments should isolate:

- One prospect
- One relationship note
- One invitation event
- One follow-up event
- One objection
- One communication preference
- One PMV activity pattern

#### Personal Segmentation

Personal segments should remain private unless selected for review.

#### Organizational Segmentation

Organizational segments should align with reviewable standards, practices, or decisions.

---

## 15. Stage 5: Risk-Check

Risk-checking detects content that requires careful handling.

Risk flags route content.

Risk flags do not automatically reject content.

### 15.1 Knowledge Risk Flag Type

```ts
type KnowledgeRiskFlag =
  | "income_claim"
  | "medical_claim"
  | "private_personal_data"
  | "prospect_private_data"
  | "unverified_claim"
  | "compliance_sensitive"
  | "duplicate_possible"
  | "outdated"
  | "needs_translation_review"
  | "legal_sensitive"
  | "financial_sensitive"
  | "employment_sensitive"
  | "identity_sensitive"
  | "relationship_sensitive"
  | "external_communication_sensitive"
  | "none";
```

### 15.2 Risk Check Result Model

```ts
interface RiskCheckResult {
  riskCheckId: string;
  chunkId: string;

  flags: KnowledgeRiskFlag[];

  severity: "none" | "low" | "medium" | "high" | "critical";

  requiresHumanReview: boolean;
  requiresGovernanceReview: boolean;
  requiresComplianceReview: boolean;
  requiresTranslationReview: boolean;

  explanation: string;

  createdAt: Date;
  createdBy: RuntimeActor;
}
```

### 15.3 Risk Flag Meanings

#### income_claim

The content references earnings, income, compensation, financial outcomes, or business projections.

#### medical_claim

The content references health, disease, treatment, diagnosis, supplement effects, weight loss claims, medical outcomes, or wellness claims.

#### private_personal_data

The content includes private personal information about the Brand Ambassador.

#### prospect_private_data

The content includes private personal information about a prospect.

#### unverified_claim

The content includes a claim that has not been verified.

#### compliance_sensitive

The content may require compliance review before organizational use.

#### duplicate_possible

The content may overlap existing knowledge.

#### outdated

The content may rely on outdated information.

#### needs_translation_review

The content requires bilingual review before use.

#### legal_sensitive

The content may involve legal matters or legal interpretation.

#### financial_sensitive

The content may involve personal finance, credit, income, or investment-related matters.

#### employment_sensitive

The content may involve job status, hiring, firing, workplace claims, or employment status.

#### identity_sensitive

The content may include sensitive identity information.

#### relationship_sensitive

The content may include delicate relationship context.

#### external_communication_sensitive

The content may affect SMS, voicemail, callback, or prospect-facing communication.

### 15.4 Risk-Check Requirements

Risk-check must:

- Run before candidate queue insertion.
- Attach flags to each candidate.
- Preserve explanation.
- Route high-risk content to appropriate review.
- Prevent risky content from becoming active without review.
- Preserve private content boundaries.
- Emit `knowledge.capture.risk_checked`.

### 15.5 Risk-Check Prohibitions

Risk-check must not:

- Delete captured input.
- Automatically approve safe-looking content.
- Automatically reject risky content.
- Convert private content into organizational content.
- Suppress audit requirements.

---

## 16. Stage 6: Dedupe

Dedupe prevents duplication, conflict, and noisy candidate creation.

Dedupe must compare candidate draft material against existing knowledge and candidates.

### 16.1 Dedupe Outcome Type

```ts
type DedupeOutcome =
  | "new_candidate"
  | "merge_with_existing_candidate"
  | "link_to_existing_knowledge"
  | "reject_duplicate"
  | "requires_human_review";
```

### 16.2 Dedupe Result Model

```ts
interface DedupeResult {
  dedupeId: string;
  chunkId: string;

  outcome: DedupeOutcome;

  matchedKnowledgeObjectIds: string[];
  matchedCandidateIds: string[];

  semanticSimilarityScore?: number;
  graphSimilarityScore?: number;
  titleHashMatch?: boolean;
  sourceDuplicateMatch?: boolean;

  explanation: string;

  createdAt: Date;
  createdBy: RuntimeActor;
}
```

### 16.3 Dedupe Must Check

Dedupe must check against:

- Approved organizational knowledge
- Active knowledge
- Superseded knowledge
- Archived knowledge when relevant
- Review candidates
- Same source session
- Same journal entry
- Same Knowledge Session
- Semantic similarity in Chroma
- Related Neo4j concepts
- Existing FAQs
- Existing training standards
- Existing relationship guidance
- Existing success patterns

### 16.4 Dedupe Requirements

Dedupe must:

- Run before candidate queue insertion.
- Preserve matched references.
- Preserve similarity metadata.
- Mark duplicate possibilities.
- Support merge workflows.
- Support link-to-existing workflows.
- Emit `knowledge.capture.deduped`.

### 16.5 Dedupe Prohibitions

Dedupe must not:

- Delete original captured input.
- Silently discard knowledge without audit.
- Merge private journal content into organizational knowledge.
- Treat semantic similarity as approval.
- Treat duplicate detection as governance rejection unless the proper review outcome exists.

---

## 17. Stage 7: Candidate Creation

Candidate creation converts eligible segmented and checked content into Knowledge Candidates.

A Knowledge Candidate is reviewable knowledge material.

A Knowledge Candidate is not approved organizational knowledge.

### 17.1 Knowledge Candidate Model

```ts
interface KnowledgeCandidate {
  candidateId: string;
  version: number;

  tenantId: string;

  teamId?: string;
  teamKey?: "team_magnificent";
  teamName?: "Team Magnificent";

  title: string;
  summary: string;
  content: string;

  domain: KnowledgeDomain[];
  candidateType:
    | "success_pattern"
    | "training_clarification"
    | "relationship_guidance"
    | "performance_pattern"
    | "journal_promotion"
    | "organizational_candidate"
    | "system_candidate"
    | "governance_candidate"
    | "learning_signal_candidate"
    | "faq_candidate"
    | "script_template_candidate"
    | "workflow_improvement_candidate";

  source: CandidateSourceReference[];

  owner: CandidateOwner;

  visibility:
    | "private_to_ba"
    | "review_only"
    | "team_review"
    | "leadership_review"
    | "governance_review"
    | "organizational_review";

  permissionScope: PermissionScope[];

  language: "en" | "es";

  originalLanguage: "en" | "es";

  translationStatus:
    | "not_required"
    | "needed"
    | "machine_draft"
    | "human_review_required"
    | "reviewed"
    | "approved";

  riskFlags: KnowledgeRiskFlag[];

  riskSeverity: "none" | "low" | "medium" | "high" | "critical";

  dedupeOutcome: DedupeOutcome;

  matchedKnowledgeObjectIds: string[];
  matchedCandidateIds: string[];

  candidateLikelihood: CandidateLikelihood;

  reviewStatus:
    | "not_queued"
    | "queued"
    | "under_review"
    | "approved"
    | "rejected"
    | "merged"
    | "withdrawn";

  reviewPriority: "low" | "normal" | "high" | "urgent";

  evidenceStrength:
    | "self_reported"
    | "agent_observed"
    | "system_observed"
    | "outcome_supported"
    | "leadership_reviewed"
    | "governance_supported";

  lineage: CandidateLineage;

  graphStatus: "not_started" | "linked" | "failed";

  reviewIndexStatus: "not_indexed" | "indexed_for_review" | "index_failed";

  createdAt: Date;
  createdBy: RuntimeActor;

  updatedAt: Date;
  updatedBy: RuntimeActor;
}
```

### 17.2 Candidate Source Reference

```ts
interface CandidateSourceReference {
  captureId: string;
  sourceType: string;
  sourceId: string;
  chunkId?: string;
  transcriptSegmentId?: string;
  journalEntryId?: string;
  eventId?: string;
  capturedAt: Date;
}
```

### 17.3 Candidate Owner

```ts
type CandidateOwner =
  | {
      ownerType: "brand_ambassador";
      baId: string;
      teamMagnificentId: string;
    }
  | {
      ownerType: "momentum_organization";
    }
  | {
      ownerType: "agent";
      agentKey: "steve_success" | "michael_magnificent" | "ivory";
    }
  | {
      ownerType: "governance";
    }
  | {
      ownerType: "system";
    };
```

### 17.4 Candidate Lineage

```ts
interface CandidateLineage {
  producedFromCaptureIds: string[];
  producedFromChunkIds: string[];
  producedFromCandidateIds?: string[];
  selectedFromJournalEntryId?: string;
  proposedByAgentKey?: "steve_success" | "michael_magnificent" | "ivory";
  proposedByLearningSignalId?: string;
  producedByKnowledgeSessionId?: string;
  producedByAdminImportId?: string;
}
```

### 17.5 Candidate Creation Requirements

Candidate creation must:

- Preserve source lineage.
- Preserve owner.
- Preserve language.
- Preserve visibility.
- Preserve permission scope.
- Preserve risk flags.
- Preserve dedupe result.
- Preserve candidate likelihood.
- Assign review status.
- Assign review priority.
- Emit `knowledge.candidate.created`.

### 17.6 Candidate Creation Prohibitions

Candidate creation must not:

- Approve knowledge.
- Activate knowledge.
- Place candidate into active organizational retrieval.
- Expose private journal entries.
- Remove risk flags.
- Remove source lineage.
- Treat agent proposal as organizational truth.

---

## 18. Candidate Creation by Agent

Agents may propose candidates within their specialty areas.

Agent proposals are not approvals.

### 18.1 Steve Success Candidate Scope

Steve Success may propose:

- Success patterns
- Obstacle patterns
- Action habits
- Momentum patterns
- Confidence patterns
- Support need patterns
- Field lessons
- Goal clarity patterns
- Next-step patterns

Steve may not approve organizational knowledge.

Steve may not convert private journal content into organizational content.

### 18.2 Michael Magnificent Candidate Scope

Michael Magnificent may propose:

- Onboarding clarifications
- System how-to improvements
- Momentum Journal teaching improvements
- Training FAQs
- Repeated support answers
- Training module improvement candidates
- Skill gap patterns
- Duplication readiness patterns
- Leadership development patterns

Michael teaches Brand Ambassadors how to use the Momentum Journal.

Michael may suggest that a Brand Ambassador consider selecting an insight for review.

Michael may not select private journal content on behalf of the Brand Ambassador unless an authorized workflow records explicit consent.

### 18.3 Ivory Candidate Scope

Ivory may propose:

- Relationship invitation patterns
- Tone guidance
- Follow-up wording principles
- Editable script template patterns
- Objection response patterns
- Prospect communication preference patterns
- Opportunity Map insights
- Relationship timing patterns

Ivory may not expose prospect private data outside permission scope.

Ivory may not convert relationship-sensitive content into organizational guidance without review.

---

## 19. Momentum Journal Ingestion

Every Brand Ambassador owns a Momentum Journal.

The Momentum Journal is personal knowledge.

Journal entries are private by default.

### 19.1 Journal Entry Capture

Journal entries must be captured with:

- Brand Ambassador owner
- Private visibility
- Original text
- Language
- Timestamp
- Optional prompt ID
- Optional session ID
- Optional voice transcript metadata
- Tags if supplied
- Source lineage

### 19.2 Journal Entry Model

```ts
interface MomentumJournalEntry {
  journalEntryId: string;
  tenantId: string;
  baId: string;

  teamId: string;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";

  sourceSessionId?: string;
  promptId?: string;

  inputMode: "voice" | "text";
  language: "en" | "es";

  originalText: string;
  normalizedText?: string;
  summary?: string;

  tags: string[];

  visibility: "private_to_ba";

  promotionStatus:
    | "not_selected"
    | "selected_for_review"
    | "promotion_candidate_created"
    | "under_review"
    | "approved"
    | "rejected"
    | "withdrawn";

  createdAt: Date;
  updatedAt: Date;
}
```

### 19.3 Journal Candidate Rule

Journal entries become candidates only when:

- The Brand Ambassador selects the journal entry for review, or
- The Brand Ambassador explicitly consents through an authorized workflow.

### 19.4 Journal Promotion Flow

```text
Momentum Journal Entry
  ↓
Brand Ambassador selects for review
  ↓
Ingestion validates consent
  ↓
Knowledge Candidate created
  ↓
Review-only indexing
  ↓
Graph lineage created
  ↓
Candidate queued for review
```

### 19.5 Journal Privacy Requirements

The ingestion protocol must ensure:

- Private journal entries are not automatically candidates.
- Private journal entries are not organizational knowledge.
- Private journal entries are not included in active organizational Chroma collections.
- Private journal entries are not visible to other Brand Ambassadors.
- Private journal entries are not visible to external runtime workflows.
- Promotion creates a separate candidate record.
- Original journal entry remains private after promotion.

---

## 20. Stage 8: Review-Only Indexing

Candidates may be indexed in Chroma for review and dedupe only.

Review-only indexing allows reviewers and dedupe workflows to compare candidates.

It must not make candidate knowledge available as approved agent guidance.

### 20.1 Review-Only Index Metadata

```json
{
  "sourceCollection": "knowledge_candidates",
  "sourceId": "cand_...",
  "status": "candidate",
  "retrievalScope": "review_only",
  "domain": "training",
  "language": "en",
  "visibility": "review_only",
  "approvedForAgentContext": false
}
```

### 20.2 Review-Only Indexing Requirements

Review-only indexing must:

- Store candidate embeddings separately from approved knowledge.
- Mark retrieval scope as `review_only`.
- Mark approval status as not approved.
- Preserve candidate ID.
- Preserve language.
- Preserve domain.
- Preserve risk flags.
- Exclude candidates from active Context Manager retrieval.
- Emit `knowledge.candidate.indexed_for_review`.

### 20.3 Chroma Review Collections

Version 1.0 requires review-only Chroma collections:

```text
knowledge_candidates_en
knowledge_candidates_es
journal_promotion_candidates_en
journal_promotion_candidates_es
training_review_candidates_en
training_review_candidates_es
relationship_review_candidates_en
relationship_review_candidates_es
success_review_candidates_en
success_review_candidates_es
```

Candidate embeddings must not be stored in active organizational collections.

---

## 21. Stage 9: Graph Lineage

Graph lineage connects captured input, candidates, sources, agents, Brand Ambassadors, prospects, and knowledge concepts.

Neo4j must preserve lineage.

### 21.1 Required Graph Patterns

```cypher
(:AgentSession)-[:PRODUCED]->(:KnowledgeCandidate)
(:BrowserVoiceSession)-[:PRODUCED]->(:KnowledgeCandidate)
(:BrowserTextSession)-[:PRODUCED]->(:KnowledgeCandidate)
(:JournalEntry)-[:SELECTED_AS]->(:KnowledgeCandidate)
(:KnowledgeSession)-[:PRODUCED]->(:KnowledgeCandidate)
(:Outcome)-[:PROPOSED]->(:KnowledgeCandidate)
(:GuidedAction)-[:RESULTED_IN]->(:Outcome)
(:KnowledgeCandidate)-[:ABOUT]->(:Concept)
(:KnowledgeCandidate)-[:SIMILAR_TO]->(:Knowledge)
(:KnowledgeCandidate)-[:OWNED_BY]->(:BrandAmbassador)
(:KnowledgeCandidate)-[:PROPOSED_BY]->(:Agent)
(:KnowledgeCandidate)-[:QUEUED_FOR]->(:ReviewQueue)
```

### 21.2 Graph Link Model

```ts
interface KnowledgeGraphLink {
  graphLinkId: string;

  fromNodeType: string;
  fromNodeId: string;

  relationshipType:
    | "PRODUCED"
    | "SELECTED_AS"
    | "PROPOSED"
    | "ABOUT"
    | "SIMILAR_TO"
    | "OWNED_BY"
    | "PROPOSED_BY"
    | "QUEUED_FOR"
    | "DERIVED_FROM"
    | "RELATED_TO"
    | "DUPLICATE_OF"
    | "MERGES_WITH"
    | "REQUIRES_REVIEW"
    | "FLAGGED_FOR";

  toNodeType: string;
  toNodeId: string;

  confidence?: number;
  sourceId: string;

  createdAt: Date;
  createdBy: RuntimeActor;
}
```

### 21.3 Graph Lineage Requirements

Graph linking must:

- Link candidate to source.
- Link candidate to owner.
- Link candidate to domain.
- Link candidate to proposing agent where applicable.
- Link journal promotion candidate to original journal entry without exposing private content.
- Link candidate to similar knowledge or candidates.
- Link candidate to risk flags where useful.
- Link candidate to review queue.
- Emit `knowledge.graph.linked`.

---

## 22. Stage 10: Queue for Review

Candidates that require review must be queued with complete metadata.

### 22.1 Review Queue Item Model

```ts
interface KnowledgeReviewQueueItem {
  queueItemId: string;
  candidateId: string;

  tenantId: string;

  domain: KnowledgeDomain[];
  language: "en" | "es";

  reviewQueue:
    | "success_review"
    | "training_review"
    | "relationship_review"
    | "performance_review"
    | "journal_promotion_review"
    | "organizational_review"
    | "governance_review"
    | "compliance_review"
    | "translation_review"
    | "system_review";

  priority: "low" | "normal" | "high" | "urgent";

  riskFlags: KnowledgeRiskFlag[];

  dedupeOutcome: DedupeOutcome;

  requiresHumanReview: boolean;
  requiresGovernanceReview: boolean;
  requiresComplianceReview: boolean;
  requiresTranslationReview: boolean;

  status:
    | "queued"
    | "assigned"
    | "under_review"
    | "approved"
    | "rejected"
    | "merged"
    | "withdrawn";

  assignedTo?: RuntimeActor;

  queuedAt: Date;
  queuedBy: RuntimeActor;
}
```

### 22.2 Review Queue Routing

Queue routing must follow these rules:

- Income claims route to compliance or governance review.
- Medical claims route to compliance or governance review.
- Translation issues route to translation review.
- Private journal promotions route to journal promotion review.
- Relationship-sensitive content routes to relationship review.
- Prospect-private data routes to restricted review.
- Governance candidates route to governance review.
- System candidates route to system review.
- High duplicate similarity routes to merge or human review.
- Low-risk training FAQs may route to training review.

### 22.3 Queue Requirements

Queue insertion must:

- Occur after risk-check.
- Occur after dedupe.
- Preserve source lineage.
- Preserve review scope.
- Preserve risk flags.
- Preserve language.
- Preserve visibility.
- Emit `knowledge.candidate.queued_for_review`.

---

## 23. Bilingual Ingestion Requirements

English and Spanish are first-class runtime languages.

### 23.1 Language Preservation

The protocol must preserve:

- Original language
- Detected language
- Language confidence
- Translation status
- Translation source
- Translation review status
- Language of candidate
- Language of review queue

### 23.2 Translation Rules

The protocol may create machine translation drafts to support review.

Machine translation drafts must be marked as draft.

Machine translation drafts are not approved organizational knowledge.

Official bilingual knowledge requires review before activation.

### 23.3 Language Metadata Model

```ts
interface IngestionLanguageMetadata {
  originalLanguage: "en" | "es";
  detectedLanguage: "en" | "es";
  languageConfidence: number;

  translationNeeded: boolean;

  translationStatus:
    | "not_required"
    | "needed"
    | "machine_draft"
    | "human_review_required"
    | "reviewed"
    | "approved";

  translatedText?: string;
  translationProvider?: string;
  translationReviewedBy?: RuntimeActor;
  translationReviewedAt?: Date;
}
```

### 23.4 Bilingual Acceptance Rules

- English input must be preserved.
- Spanish input must be preserved.
- Spanish input may generate Spanish candidates.
- English input may generate English candidates.
- Translation review must be required when candidate use depends on translated wording.
- Candidate review must show original language.
- Candidate review must show translation status.
- Context Manager must not receive unapproved translations as approved guidance.

---

## 24. Visibility and Permission Scope

Ingestion must preserve and enforce visibility from the moment of capture.

### 24.1 Permission Scope Type

```ts
type PermissionScope =
  | "self"
  | "assigned_brand_ambassador"
  | "assigned_prospect"
  | "team"
  | "leadership"
  | "organization"
  | "governance"
  | "system"
  | "reviewer";
```

### 24.2 Visibility Type

```ts
type IngestionVisibility =
  | "private_to_ba"
  | "session_scoped"
  | "relationship_scoped"
  | "review_only"
  | "admin_scoped"
  | "governance_scoped"
  | "organizational";
```

### 24.3 Visibility Rules

#### Private to BA

Used for Momentum Journal and private Brand Ambassador reflections.

Cannot become candidate without intentional selection or consent.

#### Session Scoped

Used for agent sessions and browser sessions.

May produce candidates based on domain and risk rules.

#### Relationship Scoped

Used for Ivory, prospects, PMV, SMS, voicemail, and callback workflows.

Requires prospect and Brand Ambassador permission boundaries.

#### Review Only

Used for candidates awaiting review.

Cannot be active guidance.

#### Admin Scoped

Used for administrative imports and decisions.

Requires authority metadata.

#### Governance Scoped

Used for governance decisions and ratification.

Requires governance provenance.

#### Organizational

Used only for approved organizational knowledge pathways.

Ingestion may prepare organizational candidates but must not activate them.

---

## 25. Idempotency

Every ingestion operation must be idempotent.

Repeated processing of the same input must not create duplicate captures, candidates, graph links, or review queue items.

### 25.1 Idempotency Keys

| Operation                              | Idempotency Key                                        |
| -------------------------------------- | ------------------------------------------------------ |
| Capture turn                           | `sessionId + turnSequence`                             |
| Browser voice final transcript segment | `sessionId + segmentSequence + finalStatus`            |
| Browser text message                   | `sessionId + messageId`                                |
| Journal prompt entry                   | `sessionId + promptId + baId`                          |
| Journal manual entry                   | `journalEntryId + baId`                                |
| Journal selected for review            | `journalEntryId + baId`                                |
| Candidate from source                  | `sourceType + sourceId + domain + normalizedTitleHash` |
| Candidate from chunk                   | `chunkId + normalizedTitleHash`                        |
| Candidate indexing                     | `candidateId + version`                                |
| Graph link                             | `fromNodeId + relationshipType + toNodeId + sourceId`  |
| Review queue insertion                 | `candidateId + reviewQueue`                            |
| Outcome ingestion                      | `outcomeId + eventType`                                |
| SMS event ingestion                    | `externalMessageId + prospectId`                       |
| Voicemail event ingestion              | `externalEventId + prospectId`                         |

### 25.2 Idempotency Requirements

The implementation must:

- Generate deterministic idempotency keys.
- Store idempotency records.
- Return existing result for duplicate requests.
- Prevent duplicate queue insertion.
- Prevent duplicate graph links.
- Prevent duplicate Chroma review embeddings.
- Emit duplicate-handled events where useful.

---

## 26. Event Requirements

Every ingestion stage must emit runtime events.

Events must use a consistent envelope.

### 26.1 Events Published by Knowledge Ingestion

```text
knowledge.capture.created
knowledge.capture.normalized
knowledge.capture.classified
knowledge.capture.segmented
knowledge.capture.risk_checked
knowledge.capture.deduped
knowledge.candidate.created
knowledge.candidate.queued_for_review
knowledge.candidate.indexed_for_review
knowledge.graph.linked
journal.entry.created
journal.entry.selected_for_review
knowledge.ingestion.failed
knowledge.ingestion.idempotent_replay
```

### 26.2 Events Consumed by Knowledge Ingestion

```text
agent.session.completed
browser_voice.session.completed
browser_voice.transcript.finalized
browser_text.message.created
journal.entry.created
journal.entry.selected_for_review
knowledge_session.completed
outcome.recorded
guided_action.completed
learning.signal.created
pmv.activity.recorded
sms.event.received
ringless_voicemail.event.received
callback.event.received
admin.import.submitted
governance.decision.ratified
leadership.review.completed
support.conversation.completed
training.completed
```

### 26.3 Event Envelope

```ts
interface RuntimeEventEnvelope<TPayload> {
  eventId: string;
  eventType: string;

  occurredAt: Date;
  producedBy: string;

  correlationId?: string;
  causationId?: string;

  actor?: RuntimeActor;

  tenantId: string;

  payload: TPayload;
}
```

### 26.4 Event Requirements

Events must:

- Include event ID.
- Include event type.
- Include timestamp.
- Include producer.
- Include tenant ID.
- Include actor where available.
- Include correlation ID where available.
- Preserve causation ID where available.
- Avoid exposing private content beyond authorized event consumers.

---

## 27. Runtime APIs

The following APIs define implementation-facing runtime endpoints.

These APIs may be internal service endpoints or server routes depending on implementation.

### 27.1 Capture Turn

```text
POST /api/runtime/ingestion/capture-turn
```

Purpose:

Capture a session turn from Browser Text, Browser Voice, or Agent Runtime.

Request:

```ts
interface CaptureTurnRequest {
  tenantId: string;
  sessionId: string;
  turnSequence: number;

  baId?: string;
  prospectId?: string;

  agentKey?: "steve_success" | "michael_magnificent" | "ivory";

  inputMode: "voice" | "text";

  language: "en" | "es";

  text: string;

  transcript?: TranscriptMetadata;

  visibility: "session_scoped" | "relationship_scoped" | "private_to_ba";

  metadata?: Record<string, unknown>;
}
```

Response:

```ts
interface CaptureTurnResponse {
  captureId: string;
  idempotencyKey: string;
  status: "created" | "already_exists";
}
```

### 27.2 Create Journal Entry

```text
POST /api/runtime/journal
```

Purpose:

Create a private Momentum Journal entry.

Request:

```ts
interface CreateJournalEntryRequest {
  tenantId: string;
  baId: string;
  sessionId?: string;
  promptId?: string;

  inputMode: "voice" | "text";

  language: "en" | "es";

  text: string;

  tags?: string[];

  metadata?: Record<string, unknown>;
}
```

Response:

```ts
interface CreateJournalEntryResponse {
  journalEntryId: string;
  captureId: string;
  visibility: "private_to_ba";
  promotionStatus: "not_selected";
}
```

### 27.3 Select Journal Entry for Review

```text
POST /api/runtime/journal/:journalEntryId/select-for-review
```

Purpose:

Allow a Brand Ambassador to intentionally promote a journal entry into the candidate review path.

Request:

```ts
interface SelectJournalEntryForReviewRequest {
  tenantId: string;
  baId: string;
  journalEntryId: string;

  consentConfirmed: boolean;

  proposedDomain?: KnowledgeDomain[];

  proposedTitle?: string;

  noteToReviewer?: string;
}
```

Response:

```ts
interface SelectJournalEntryForReviewResponse {
  journalEntryId: string;
  candidateId: string;
  status: "promotion_candidate_created";
}
```

### 27.4 Create Knowledge Candidate

```text
POST /api/runtime/knowledge-candidates
```

Purpose:

Create a candidate from an authorized source, usually after ingestion stages have completed.

Request:

```ts
interface CreateKnowledgeCandidateRequest {
  tenantId: string;

  sourceType: string;
  sourceId: string;

  chunkId?: string;

  title: string;
  summary: string;
  content: string;

  domain: KnowledgeDomain[];

  language: "en" | "es";

  owner: CandidateOwner;

  visibility:
    | "review_only"
    | "team_review"
    | "leadership_review"
    | "governance_review"
    | "organizational_review";

  permissionScope: PermissionScope[];

  riskFlags?: KnowledgeRiskFlag[];

  metadata?: Record<string, unknown>;
}
```

Response:

```ts
interface CreateKnowledgeCandidateResponse {
  candidateId: string;
  reviewStatus: "queued" | "not_queued";
  reviewQueue?: string;
}
```

### 27.5 Ingest Outcome

```text
POST /api/runtime/ingestion/outcome
```

Purpose:

Ingest an outcome event for potential learning candidate creation.

Request:

```ts
interface IngestOutcomeRequest {
  tenantId: string;
  outcomeId: string;

  baId?: string;
  prospectId?: string;
  guidedActionId?: string;

  language: "en" | "es";

  outcomeType:
    | "action_completed"
    | "action_missed"
    | "prospect_responded"
    | "presentation_viewed"
    | "follow_up_completed"
    | "training_completed"
    | "conversion"
    | "retention_signal"
    | "feedback_received";

  description: string;

  metadata?: Record<string, unknown>;
}
```

Response:

```ts
interface IngestOutcomeResponse {
  captureId: string;
  candidateCreated: boolean;
  candidateId?: string;
}
```

---

## 28. Internal Service Interfaces

The implementation must provide internal service interfaces.

### 28.1 Ingestion Orchestrator

```ts
interface KnowledgeIngestionOrchestrator {
  ingestCapture(input: CapturedInput): Promise<IngestionPipelineResult>;
  ingestJournalEntry(
    input: CreateJournalEntryRequest
  ): Promise<CreateJournalEntryResponse>;
  selectJournalEntryForReview(
    input: SelectJournalEntryForReviewRequest
  ): Promise<SelectJournalEntryForReviewResponse>;
  ingestOutcome(input: IngestOutcomeRequest): Promise<IngestOutcomeResponse>;
}
```

### 28.2 Capture Service

```ts
interface CaptureService {
  createCapture(input: CapturedInput): Promise<CapturedInput>;
  getCapture(captureId: string): Promise<CapturedInput | null>;
}
```

### 28.3 Normalization Service

```ts
interface NormalizationService {
  normalize(input: CapturedInput): Promise<NormalizedCapture>;
}
```

### 28.4 Classification Service

```ts
interface ClassificationService {
  classify(input: NormalizedCapture): Promise<ClassificationResult>;
}
```

### 28.5 Segmentation Service

```ts
interface SegmentationService {
  segment(input: {
    capture: CapturedInput;
    normalized: NormalizedCapture;
    classification: ClassificationResult;
  }): Promise<KnowledgeChunkDraft[]>;
}
```

### 28.6 Risk Check Service

```ts
interface RiskCheckService {
  check(chunk: KnowledgeChunkDraft): Promise<RiskCheckResult>;
}
```

### 28.7 Dedupe Service

```ts
interface DedupeService {
  dedupe(input: {
    chunk: KnowledgeChunkDraft;
    risk: RiskCheckResult;
  }): Promise<DedupeResult>;
}
```

### 28.8 Candidate Service

```ts
interface CandidateCreationService {
  createCandidate(input: {
    chunk: KnowledgeChunkDraft;
    risk: RiskCheckResult;
    dedupe: DedupeResult;
  }): Promise<KnowledgeCandidate>;
}
```

### 28.9 Review Index Service

```ts
interface ReviewIndexingService {
  indexCandidateForReview(
    candidate: KnowledgeCandidate
  ): Promise<ReviewIndexResult>;
}
```

### 28.10 Graph Lineage Service

```ts
interface GraphLineageService {
  linkCandidate(candidate: KnowledgeCandidate): Promise<KnowledgeGraphLink[]>;
}
```

### 28.11 Review Queue Service

```ts
interface ReviewQueueService {
  queueCandidate(
    candidate: KnowledgeCandidate
  ): Promise<KnowledgeReviewQueueItem>;
}
```

---

## 29. Pipeline Result Model

```ts
interface IngestionPipelineResult {
  captureId: string;

  normalizationId?: string;
  classificationId?: string;

  chunkIds: string[];

  riskCheckIds: string[];
  dedupeIds: string[];
  candidateIds: string[];
  reviewQueueItemIds: string[];
  graphLinkIds: string[];

  status:
    | "captured_only"
    | "candidate_created"
    | "queued_for_review"
    | "no_candidate"
    | "failed";

  errors?: IngestionError[];

  createdAt: Date;
}
```

---

## 30. Storage Requirements

The Knowledge Ingestion Protocol must persist intermediate and final ingestion records.

### 30.1 Required Collections

Version 1.0 requires these collections:

```text
knowledge_captures
knowledge_normalized_captures
knowledge_classifications
knowledge_chunk_drafts
knowledge_risk_checks
knowledge_dedupe_results
knowledge_candidates
knowledge_review_queue
knowledge_ingestion_events
knowledge_ingestion_errors
knowledge_ingestion_idempotency
journal_entries
journal_promotion_requests
review_index_jobs
graph_lineage_jobs
```

### 30.2 Required Indexes

Required MongoDB indexes:

```text
knowledge_captures.captureId unique
knowledge_captures.tenantId
knowledge_captures.baId
knowledge_captures.prospectId
knowledge_captures.sourceType
knowledge_captures.sourceId
knowledge_captures.agentKey
knowledge_captures.language
knowledge_captures.capturedAt

knowledge_candidates.candidateId unique
knowledge_candidates.tenantId
knowledge_candidates.domain
knowledge_candidates.language
knowledge_candidates.reviewStatus
knowledge_candidates.visibility
knowledge_candidates.riskFlags
knowledge_candidates.createdAt

knowledge_review_queue.queueItemId unique
knowledge_review_queue.candidateId
knowledge_review_queue.reviewQueue
knowledge_review_queue.status
knowledge_review_queue.priority

journal_entries.journalEntryId unique
journal_entries.baId
journal_entries.visibility
journal_entries.promotionStatus

knowledge_ingestion_idempotency.key unique
```

---

## 31. Relationship to Knowledge Core

The Knowledge Ingestion Protocol prepares knowledge for the Knowledge Core.

The Knowledge Core stores and governs durable knowledge.

### 31.1 Ingestion Sends to Knowledge Core

Ingestion may send the following to Knowledge Core:

- Captured source records
- Knowledge Candidates
- Candidate lineage
- Risk flags
- Dedupe results
- Review queue metadata
- Journal promotion candidates
- Outcome-derived learning candidates
- Graph lineage records
- Review-only indexing metadata

### 31.2 Knowledge Core Responsibilities After Ingestion

After ingestion, the Knowledge Core is responsible for:

- Canonical persistence
- Lifecycle state
- Governance state
- Ownership enforcement
- Active knowledge status
- Approved organizational knowledge
- Long-term retrieval
- GraphRAG retrieval
- Versioning
- Audit
- Learning integration
- Knowledge evolution

### 31.3 Required Boundary

Ingestion must not write directly into active organizational knowledge collections.

Ingestion must not mark knowledge as active.

Ingestion must not bypass Knowledge Core lifecycle rules.

---

## 32. Relationship to Context Manager

The Context Manager must not retrieve candidate knowledge as approved guidance.

Candidate knowledge may be visible to review workflows only.

The Context Manager receives active knowledge from the Knowledge Core, not raw ingestion records.

The Knowledge Ingestion Protocol may provide metadata that later helps the Context Manager understand source lineage, but it does not assemble context.

---

## 33. Relationship to Agent Runtime

Agent Runtime produces conversations and sessions.

Knowledge Ingestion captures and processes those sessions.

Agents may propose candidates.

Agents may not approve candidates.

Agents may not directly write approved organizational knowledge.

Agents may not retrieve review-only candidates as guidance.

### 33.1 Steve Success Relationship

Steve produces Success session material.

Ingestion may create Success Knowledge Candidates.

Steve may later receive approved Success Knowledge through Context Packets.

### 33.2 Michael Magnificent Relationship

Michael produces Training session material.

Ingestion may create Training Knowledge Candidates.

Michael teaches Brand Ambassadors how to use the Momentum Journal.

Michael may help identify journal insights but cannot promote private journal content without Brand Ambassador consent.

### 33.3 Ivory Relationship

Ivory produces Relationship session material.

Ingestion may create Relationship Knowledge Candidates.

Relationship candidates must preserve prospect privacy and Brand Ambassador ownership boundaries.

---

## 34. Relationship to Browser Voice Runtime

Browser Voice Runtime is internal.

Browser Voice captures spoken interaction through the browser.

Browser Voice Runtime does not use Telnyx.

The Knowledge Ingestion Protocol receives Browser Voice transcript events.

For Version 1.0:

- Store transcript text.
- Store language.
- Store confidence.
- Store final/interim status.
- Store session and segment IDs.
- Do not require raw audio storage.
- Do not classify Browser Voice as external Telnyx activity.

---

## 35. Relationship to Browser Text Runtime

Browser Text Runtime is internal.

Browser Text captures typed interaction through the browser.

The Knowledge Ingestion Protocol receives Browser Text message events.

Browser Text content follows the same capture, normalize, classify, segment, risk-check, dedupe, candidate-create, index, graph-link, and review queue flow.

---

## 36. Relationship to External Runtime

External runtime includes:

- Ringless voicemail
- SMS
- Future callback workflows

External runtime may use Telnyx.

External runtime is not the same as internal Browser Voice Runtime.

The Knowledge Ingestion Protocol may ingest external events as relationship or performance knowledge material.

External events must preserve:

- Prospect scope
- Brand Ambassador scope
- Communication type
- Timestamp
- Message status
- Response status
- Consent or compliance metadata where applicable
- Source provider metadata

External events must not gain access to private Momentum Journal content.

---

## 37. Relationship to Learning Pipeline

The Learning Pipeline evaluates outcomes and proposes learning signals.

The Knowledge Ingestion Protocol receives learning signals and outcome events, structures them, and may create learning candidate records.

Learning signals do not become approved organizational knowledge automatically.

### 37.1 Learning Candidate Flow

```text
Outcome Event
  ↓
Learning Pipeline evaluates signal
  ↓
Learning signal emitted
  ↓
Knowledge Ingestion captures signal
  ↓
Normalize and classify
  ↓
Segment learning pattern
  ↓
Risk-check and dedupe
  ↓
Create learning candidate
  ↓
Queue for review
```

---

## 38. Runtime Data Flow

### 38.1 Agent Session Flow

```text
Steve / Michael / Ivory Session
  ↓
Browser Voice or Browser Text captures turn
  ↓
knowledge.capture.created
  ↓
Normalize transcript or message
  ↓
Classify domain
  ↓
Segment knowledge chunks
  ↓
Risk-check each chunk
  ↓
Dedupe each chunk
  ↓
Create candidate if eligible
  ↓
Index candidate for review only
  ↓
Create graph lineage
  ↓
Queue candidate for review
  ↓
Knowledge Core stores candidate state
```

### 38.2 Momentum Journal Flow

```text
Brand Ambassador creates journal entry
  ↓
Entry captured as private_to_ba
  ↓
Private journal record stored
  ↓
Optional normalization for owner-only personal knowledge
  ↓
No organizational candidate unless selected
  ↓
Brand Ambassador selects for review
  ↓
Promotion candidate created
  ↓
Review-only indexing
  ↓
Graph lineage created
  ↓
Queue for journal promotion review
```

### 38.3 Knowledge Session Flow

```text
Knowledge Session completed
  ↓
Session output captured
  ↓
Normalize
  ↓
Classify as organizational / governance / system
  ↓
Segment
  ↓
Risk-check
  ↓
Dedupe
  ↓
Create candidate
  ↓
Queue for appropriate review or ratified process
```

### 38.4 Outcome Flow

```text
Guided Action produces outcome
  ↓
Outcome event captured
  ↓
Learning Pipeline evaluates
  ↓
Learning signal sent to ingestion
  ↓
Ingestion structures signal
  ↓
Candidate created when eligible
  ↓
Candidate queued for review
```

### 38.5 External Communication Flow

```text
SMS / Ringless Voicemail / Callback Event
  ↓
External event captured
  ↓
Relationship or performance classification
  ↓
Risk-check for prospect privacy and external communication sensitivity
  ↓
Dedupe against existing relationship knowledge
  ↓
Candidate created if eligible
  ↓
Review-only indexing if needed
  ↓
Graph linked to Brand Ambassador and prospect
  ↓
Queued for review when appropriate
```

---

## 39. Error Handling

The Knowledge Ingestion Protocol must fail safely.

Captured input must not be lost when downstream stages fail.

### 39.1 Error Types

```ts
type IngestionErrorType =
  | "capture_failed"
  | "normalization_failed"
  | "classification_failed"
  | "segmentation_failed"
  | "risk_check_failed"
  | "dedupe_failed"
  | "candidate_creation_failed"
  | "review_indexing_failed"
  | "graph_link_failed"
  | "queue_insert_failed"
  | "permission_denied"
  | "invalid_visibility"
  | "journal_consent_missing"
  | "language_detection_failed"
  | "idempotency_conflict"
  | "external_event_invalid";
```

### 39.2 Ingestion Error Model

```ts
interface IngestionError {
  errorId: string;
  errorType: IngestionErrorType;

  captureId?: string;
  candidateId?: string;
  journalEntryId?: string;

  message: string;
  safeMessage: string;

  retryable: boolean;

  occurredAt: Date;

  metadata?: Record<string, unknown>;
}
```

### 39.3 Error Handling Requirements

When an error occurs:

- The error must be recorded.
- The pipeline must preserve completed prior stages.
- Private data must not leak through error messages.
- Retryable errors must be marked retryable.
- Failed stages must emit `knowledge.ingestion.failed`.
- Graph or indexing failure must not activate a candidate.
- Queue insertion failure must not mark candidate as queued.
- Journal promotion must fail if consent is missing.

---

## 40. Observability

The Knowledge Ingestion Protocol must expose operational observability.

### 40.1 Required Metrics

The implementation must track:

- Captures created
- Captures by source type
- Captures by language
- Normalizations completed
- Classifications completed
- Chunks created
- Risk checks completed
- Risk flags by type
- Dedupe outcomes
- Candidates created
- Candidates by domain
- Candidates by language
- Candidates queued for review
- Journal entries created
- Journal entries selected for review
- Review-only index jobs completed
- Graph lineage links created
- Ingestion failures
- Idempotent replays
- Average pipeline processing time
- Queue insertion latency

### 40.2 Required Logs

The implementation must log:

- Capture creation
- Normalization completion
- Classification completion
- Segmentation completion
- Risk flags
- Dedupe outcome
- Candidate creation
- Review queue insertion
- Journal promotion request
- Review-only indexing
- Graph linking
- Ingestion failure
- Idempotency replay

### 40.3 Required Health Checks

The ingestion runtime must expose health checks for:

- MongoDB connectivity
- Knowledge Core write interface availability
- Chroma review indexing availability
- Neo4j graph lineage availability
- Event bus availability
- Ingestion queue backlog
- Failed ingestion jobs
- Failed review indexing jobs
- Failed graph lineage jobs

---

## 41. Security and Privacy

### 41.1 Default Privacy

Ingestion must treat captured knowledge as scoped and private unless classification and source authority permit broader handling.

### 41.2 Journal Privacy

Momentum Journal entries are private to the Brand Ambassador.

The ingestion protocol must enforce:

- No automatic promotion
- No external runtime access
- No organizational indexing
- No shared Chroma embedding
- No cross-BA retrieval
- No leadership visibility unless approved by an authorized workflow
- No Context Manager approved retrieval unless owner-scoped

### 41.3 Prospect Privacy

Prospect-related data must be relationship-scoped.

Prospect private information must not become organizational knowledge without review, anonymization, aggregation, or explicit approval.

### 41.4 Agent Boundaries

Agents may propose candidates.

Agents may not approve candidates.

Agents may not override privacy.

Agents may not bypass ingestion.

Agents may not write active organizational knowledge.

### 41.5 External Runtime Boundary

External runtime may include Telnyx for SMS, ringless voicemail, and future callback workflows.

External runtime must not access internal Browser Voice transcripts unless explicitly authorized through approved runtime interfaces.

Internal Browser Voice does not use Telnyx.

---

## 42. Implementation Structure for Codex

A recommended implementation layout is:

```text
/src/runtime/knowledge-ingestion/
  index.ts

  models/
    KnowledgeCapture.model.ts
    NormalizedCapture.model.ts
    KnowledgeClassification.model.ts
    KnowledgeChunkDraft.model.ts
    KnowledgeRiskCheck.model.ts
    KnowledgeDedupeResult.model.ts
    KnowledgeCandidate.model.ts
    KnowledgeReviewQueueItem.model.ts
    KnowledgeIngestionEvent.model.ts
    KnowledgeIngestionError.model.ts
    KnowledgeIngestionIdempotency.model.ts
    MomentumJournalEntry.model.ts
    JournalPromotionRequest.model.ts
    ReviewIndexJob.model.ts
    GraphLineageJob.model.ts

  services/
    KnowledgeIngestionOrchestrator.ts
    CaptureService.ts
    NormalizationService.ts
    ClassificationService.ts
    SegmentationService.ts
    RiskCheckService.ts
    DedupeService.ts
    CandidateCreationService.ts
    ReviewIndexingService.ts
    GraphLineageService.ts
    ReviewQueueService.ts
    JournalIngestionService.ts
    OutcomeIngestionService.ts
    ExternalEventIngestionService.ts
    IngestionPermissionService.ts
    IngestionAuditService.ts
    IngestionIdempotencyService.ts

  policies/
    JournalPrivacyPolicy.ts
    CandidateCreationPolicy.ts
    RiskRoutingPolicy.ts
    DedupePolicy.ts
    ReviewQueueRoutingPolicy.ts
    BilingualIngestionPolicy.ts
    ExternalRuntimeBoundaryPolicy.ts

  events/
    KnowledgeIngestionEventPublisher.ts
    KnowledgeIngestionEventConsumer.ts
    KnowledgeIngestionEventTypes.ts

  graph/
    IngestionGraphLineageMapper.ts
    IngestionGraphLineageService.ts

  embeddings/
    CandidateReviewEmbeddingService.ts
    ReviewCollectionRouter.ts

  api/
    captureTurn.route.ts
    journal.route.ts
    journalSelectForReview.route.ts
    knowledgeCandidates.route.ts
    outcomeIngestion.route.ts

  health/
    KnowledgeIngestionHealthCheck.ts

  types/
    Capture.types.ts
    Normalization.types.ts
    Classification.types.ts
    Segmentation.types.ts
    Risk.types.ts
    Dedupe.types.ts
    Candidate.types.ts
    Journal.types.ts
    ReviewQueue.types.ts
    IngestionEvents.types.ts
```

This structure may be adapted if all runtime responsibilities and acceptance criteria are satisfied.

---

## 43. Minimal Runtime Implementation Sequence

Codex should implement Knowledge Ingestion in this order.

### Step 1: Types

Implement all TypeScript types for:

- Captures
- Normalized captures
- Classifications
- Chunks
- Risk checks
- Dedupe results
- Candidates
- Journal entries
- Review queue items
- Events
- Errors
- Idempotency

### Step 2: Models

Implement MongoDB / Mongoose models and indexes.

### Step 3: Idempotency

Implement idempotency service before pipeline stages.

### Step 4: Capture Service

Implement capture storage for agent sessions, Browser Voice, Browser Text, journal entries, outcomes, and external events.

### Step 5: Journal Privacy

Implement Momentum Journal private storage and promotion boundary.

### Step 6: Normalization Service

Implement normalization while preserving original meaning.

### Step 7: Classification Service

Implement domain classification and candidate likelihood.

### Step 8: Segmentation Service

Implement chunk creation by domain.

### Step 9: Risk Check Service

Implement risk flags and review routing metadata.

### Step 10: Dedupe Service

Implement dedupe against candidates, approved knowledge, Chroma, and Neo4j.

### Step 11: Candidate Creation

Implement Knowledge Candidate creation.

### Step 12: Review-Only Indexing

Implement Chroma candidate collections with review-only metadata.

### Step 13: Graph Lineage

Implement Neo4j lineage links.

### Step 14: Review Queue

Implement candidate queue insertion.

### Step 15: Events

Implement event publishing and consuming.

### Step 16: APIs

Implement runtime endpoints.

### Step 17: Observability

Implement metrics, logs, errors, and health checks.

### Step 18: Tests

Implement acceptance test suite.

---

## 44. Acceptance Criteria

The Knowledge Ingestion Protocol is complete only when all acceptance criteria are satisfied.

### 44.1 Capture Acceptance Criteria

- Raw session turns are captured.
- Browser Voice transcript text is captured.
- Browser Voice language, confidence, and final/interim status are captured.
- Browser Text messages are captured.
- Journal entries are captured as private.
- Outcome events are captured.
- External SMS, voicemail, and callback events can be captured.
- Original input is preserved.
- Source lineage is preserved.
- `knowledge.capture.created` is emitted.

### 44.2 Normalization Acceptance Criteria

- Normalized text is created.
- Summary is created.
- Language is preserved.
- Entities are extracted.
- Candidate signals are extracted.
- Meaning is not changed.
- Private content is not promoted.
- `knowledge.capture.normalized` is emitted.

### 44.3 Classification Acceptance Criteria

- Primary domain is assigned.
- Secondary domains can be assigned.
- Candidate likelihood is assigned.
- Candidate pathway is assigned.
- Classification signals are preserved.
- Personal journal content is classified as private unless selected.
- `knowledge.capture.classified` is emitted.

### 44.4 Segmentation Acceptance Criteria

- Knowledge chunks are created.
- Chunks preserve source ID.
- Chunks preserve order.
- Chunks preserve language.
- Chunks preserve visibility.
- Chunks preserve permission scope.
- `knowledge.capture.segmented` is emitted.

### 44.5 Risk-Check Acceptance Criteria

- Risk flags attach before review.
- Income claims are flagged.
- Medical claims are flagged.
- Private personal data is flagged.
- Prospect private data is flagged.
- Unverified claims are flagged.
- Translation review needs are flagged.
- Risk flags route content to careful review.
- Risk flags do not automatically reject content.
- `knowledge.capture.risk_checked` is emitted.

### 44.6 Dedupe Acceptance Criteria

- Duplicate checks run before queue insertion.
- Existing approved knowledge is checked.
- Existing review candidates are checked.
- Same source session is checked.
- Same journal entry is checked.
- Chroma semantic similarity is checked.
- Neo4j related concepts are checked.
- Dedupe outcome is stored.
- `knowledge.capture.deduped` is emitted.

### 44.7 Candidate Creation Acceptance Criteria

- Knowledge Candidates can be created.
- Candidate creation preserves lineage.
- Candidate creation preserves owner.
- Candidate creation preserves language.
- Candidate creation preserves visibility.
- Candidate creation preserves risk flags.
- Candidate creation preserves dedupe result.
- Candidates are not approved knowledge.
- `knowledge.candidate.created` is emitted.

### 44.8 Journal Acceptance Criteria

- Journal entries are private by default.
- Journal entries do not automatically become candidates.
- Brand Ambassador selection is required for review.
- Consent is required for journal promotion.
- Journal promotion creates a candidate.
- Original journal entry remains private.
- External runtime cannot access private journal entries.
- `journal.entry.created` is emitted.
- `journal.entry.selected_for_review` is emitted.

### 44.9 Review-Only Indexing Acceptance Criteria

- Candidate review collections exist in Chroma.
- Candidate chunks can be indexed for review.
- Candidate metadata marks retrieval scope as `review_only`.
- Candidate chunks are not retrieved as approved agent knowledge.
- Candidate embeddings are separate from active organizational embeddings.
- `knowledge.candidate.indexed_for_review` is emitted.

### 44.10 Graph Lineage Acceptance Criteria

- Neo4j lineage edges are created.
- Agent sessions link to candidates.
- Browser sessions link to candidates.
- Journal entries link to selected candidates.
- Candidates link to concepts.
- Candidates link to similar knowledge when detected.
- Candidates link to owner.
- Candidates link to review queue.
- `knowledge.graph.linked` is emitted.

### 44.11 Review Queue Acceptance Criteria

- Candidates are queued after risk-check and dedupe.
- Review queue routing respects risk flags.
- Review queue routing respects domain.
- Review queue routing respects language.
- Review queue routing respects privacy.
- Queue insertion is idempotent.
- `knowledge.candidate.queued_for_review` is emitted.

### 44.12 Bilingual Acceptance Criteria

- English inputs are preserved.
- Spanish inputs are preserved.
- English candidates can be created.
- Spanish candidates can be created.
- Language metadata is stored.
- Translation status is tracked.
- Translation review can be required.
- Machine translations are not treated as approved guidance.

### 44.13 Idempotency Acceptance Criteria

- Capture turn idempotency works.
- Journal entry idempotency works.
- Journal selected-for-review idempotency works.
- Candidate creation idempotency works.
- Candidate indexing idempotency works.
- Graph link idempotency works.
- Review queue idempotency works.
- Idempotent replay does not create duplicates.

### 44.14 Runtime Boundary Acceptance Criteria

- Internal Browser Voice does not use Telnyx.
- External SMS may use Telnyx.
- External ringless voicemail may use Telnyx.
- Future callback workflows may use Telnyx.
- External runtime cannot access private journal content.
- Agents cannot approve knowledge.
- Candidates cannot be active guidance.

---

## 45. Testing Requirements

### 45.1 Unit Tests

Unit tests must cover:

- Capture validation
- Journal privacy policy
- Journal promotion consent
- Normalization preservation
- Classification routing
- Segmentation output
- Risk flag detection
- Dedupe outcomes
- Candidate creation
- Review queue routing
- Idempotency key generation
- Language metadata
- Error creation

### 45.2 Integration Tests

Integration tests must cover:

- Full agent session ingestion flow
- Full Browser Voice transcript ingestion flow
- Full Browser Text ingestion flow
- Full journal entry creation flow
- Full journal promotion flow
- Full outcome ingestion flow
- Full external SMS ingestion flow
- Candidate review-only indexing
- Neo4j graph lineage creation
- Review queue insertion
- Knowledge Core candidate handoff

### 45.3 Security Tests

Security tests must prove:

- Journal entries are private by default.
- Journal entries are not candidates until selected.
- Journal promotion requires consent.
- Another Brand Ambassador cannot access private journal content.
- External runtime cannot access journal content.
- Review-only candidates are not active guidance.
- Candidate embeddings are not stored in active organizational collections.
- Private prospect data is risk-flagged.

### 45.4 Bilingual Tests

Bilingual tests must prove:

- English capture works.
- Spanish capture works.
- English normalization works.
- Spanish normalization works.
- English candidates are created.
- Spanish candidates are created.
- Translation-needed status is applied correctly.
- Spanish review queues work.
- Machine translation remains draft until reviewed.

---

## 46. Required Invariants

The following invariants must always hold.

1. Original input is captured before transformation.
2. Every capture has a source type.
3. Every capture has a source ID.
4. Every capture has language metadata.
5. Every candidate has source lineage.
6. Every candidate has visibility metadata.
7. Every candidate has ownership metadata.
8. Every candidate has review status.
9. Candidates are not approved knowledge.
10. Candidates are not active organizational knowledge.
11. Journal entries are private by default.
12. Journal entries require Brand Ambassador selection before review.
13. Risk-check occurs before queue insertion.
14. Dedupe occurs before queue insertion.
15. Review-only embeddings are separate from active knowledge embeddings.
16. Graph lineage is preserved.
17. English and Spanish are supported.
18. Internal Browser Voice does not use Telnyx.
19. External Telnyx usage is limited to SMS, ringless voicemail, and future callback workflows.
20. All ingestion stages are idempotent.
21. Every Brand Ambassador-scoped ingestion object carries Team Magnificent identity, including captured inputs, Knowledge Candidates, Momentum Journal entries, and Brand Ambassador-owned candidate records.

---

## 47. Completion Definition

The Knowledge Ingestion Protocol Runtime is considered Version 1.0 complete when:

- Captures are stored.
- Original text is preserved.
- Journal entries are private by default.
- Normalization works.
- Classification works.
- Segmentation works.
- Risk-check works.
- Dedupe works.
- Candidate creation works.
- Candidates preserve lineage.
- Candidates are not approved knowledge.
- Review-only Chroma indexing exists.
- Neo4j lineage edges are created.
- Review queue insertion works.
- English and Spanish are supported.
- Events are emitted for every stage.
- Idempotency prevents duplicate processing.
- Internal Browser Voice remains separate from Telnyx.
- External runtime events can be ingested safely.
- Acceptance tests pass.

---

## 48. Final Runtime Statement

The Knowledge Ingestion Protocol is the intake discipline of Momentum Creation System V2.

It protects the difference between raw experience, private reflection, reviewable candidate knowledge, and approved organizational knowledge.

It ensures that every lesson has a source.

It ensures that every candidate has lineage.

It ensures that every journal entry remains private unless intentionally promoted.

It ensures that every risky claim is flagged before review.

It ensures that every duplicate is checked before the organization learns from it.

It ensures that English and Spanish knowledge can enter the system with integrity.

It ensures that Steve, Michael, and Ivory can contribute knowledge without becoming uncontrolled sources of truth.

It ensures that the Knowledge Core receives clean, traceable, governed knowledge material.

Momentum learns because experience is captured carefully.

Momentum improves because knowledge is prepared responsibly.

The Knowledge Ingestion Protocol is the runtime bridge from experience to organizational learning.

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
