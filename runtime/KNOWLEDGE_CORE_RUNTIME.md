# KNOWLEDGE_CORE_RUNTIME.md

## Momentum Creation System V2

## Knowledge Core Runtime Specification

### Version 1.0

---

## 1. Document Status

**Document Name:** Knowledge Core Runtime Specification
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Status:** Ratified Runtime Specification
**Owner:** Momentum Creation System
**Primary Runtime Dependency:** Knowledge Layer
**Primary Runtime Consumer:** Context Manager
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Internal Runtime Scope:** Steve, Michael, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of the internal browser voice runtime.

---

## 2. Purpose

The Knowledge Core Runtime is the operational memory layer of Momentum Creation System V2.

Its purpose is to transform approved, traceable, structured, semi-structured, and experiential knowledge into durable organizational understanding that can be retrieved, reasoned over, governed, evolved, and delivered to runtime components through the Context Manager.

The Knowledge Core answers one foundational runtime question:

> What does Momentum know?

The Knowledge Core does not decide what an agent should say.

The Knowledge Core does not directly control conversations.

The Knowledge Core does not directly guide Brand Ambassadors.

The Knowledge Core does not replace agents.

The Knowledge Core preserves, connects, indexes, governs, and evolves knowledge so that authorized runtime components can retrieve the right understanding at the right time.

The Context Manager answers a different question:

> What knowledge does this agent need right now?

This separation is mandatory.

The Knowledge Core stores organizational understanding.

The Context Manager assembles contextual intelligence.

Agents consume contextual intelligence and guide Brand Ambassadors within their specialized responsibilities.

---

## 3. Runtime Philosophy

Momentum is a knowledge-centric platform.

The Runtime Layer exists to transform organizational knowledge into contextual intelligence.

The operating sequence is:

```text
Conversation
  ↓
Knowledge Acquisition
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
Learning
  ↓
Knowledge Evolution
```

The Knowledge Core is the inside of the runtime architecture.

All other runtime components depend on its correctness.

Momentum does not become more intelligent because agents become unrestricted or self-modifying.

Momentum becomes more intelligent because the Knowledge Core becomes richer, more accurate, more connected, and more useful over time.

Agents remain specialists.

The organization learns.

The Knowledge Core grows.

The Context Manager retrieves.

Agents guide.

Brand Ambassadors act.

Outcomes teach the system.

---

## 4. Runtime Principle

The Knowledge Core is not a single database.

The Knowledge Core is not a vector store.

The Knowledge Core is not a graph database.

The Knowledge Core is not a document archive.

The Knowledge Core is the unified runtime memory system of Momentum.

Databases preserve different aspects of organizational understanding:

```text
MongoDB / Mongoose
  Preserves canonical knowledge objects, source records, lifecycle status,
  audit metadata, permissions, language variants, ownership, and governance state.

Neo4j
  Preserves relationships between Brand Ambassadors, prospects, goals,
  interviews, actions, outcomes, knowledge objects, training paths, and organizational patterns.

Chroma
  Preserves semantic meaning through embeddings, similarity retrieval,
  multilingual search support, and contextual recall.

GraphRAG
  Coordinates retrieval and reasoning across MongoDB, Neo4j, and Chroma.
```

The Knowledge Core is the runtime boundary that makes these technologies operate as one governed knowledge system.

No agent may bypass the Knowledge Core and directly assemble its own knowledge from raw databases.

No runtime component may treat raw database access as contextual intelligence.

All knowledge retrieval for agent use must flow through the Context Manager.

All knowledge persistence must flow through the Knowledge Ingestion Protocol and Knowledge Core write interfaces.

---

## 5. Scope

This document defines the Version 1.0 runtime specification for the Knowledge Core.

It defines:

- Purpose
- Responsibilities
- Non-responsibilities
- Knowledge domains
- Knowledge object model
- Storage architecture
- Interfaces
- Ownership rules
- Lifecycle rules
- Data flow
- Runtime flow
- Bilingual requirements
- Governance integration
- Personal knowledge rules
- Organizational knowledge rules
- GraphRAG responsibilities
- Security and privacy boundaries
- Events
- Dependencies
- Acceptance criteria
- Relationship to other runtime components

This document does not define application-specific behavior.

Application-specific workflows belong in Implementation documents.

This document does not define detailed conversational scripts for Steve, Michael, or Ivory.

Agent behavior belongs in Agent Runtime and Implementation documents.

This document does not define the full ingestion workflow.

The Knowledge Ingestion Protocol defines how raw information becomes Knowledge Candidates and approved Knowledge Objects.

This document defines how the Knowledge Core stores, governs, connects, indexes, retrieves, and evolves those knowledge objects.

---

## 6. Runtime Position

The Knowledge Core sits after knowledge acquisition and before context assembly.

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
```

The Knowledge Core is upstream of:

- Context Manager
- Context Packet
- Agent Runtime
- Learning Pipeline
- Agent Events
- Browser Voice Runtime
- Browser Text Runtime
- Guided Action Runtime
- Implementation Runtime Interfaces

The Knowledge Core is downstream of:

- Constitution
- Governance
- Decision Framework
- ACR System
- AI Organization
- Knowledge Layer
- Knowledge Sessions
- Knowledge Ingestion Protocol
- Approved administrative decisions
- Approved organizational knowledge sources

---

## 7. Core Responsibilities

The Knowledge Core is responsible for the following runtime functions.

### 7.1 Preserve Canonical Knowledge

The Knowledge Core must preserve canonical knowledge objects in durable structured form.

Canonical knowledge includes:

- Knowledge object identity
- Knowledge domain
- Ownership
- Source attribution
- Lifecycle status
- Governance status
- Language metadata
- Access permissions
- Version history
- Evidence trail
- Approved content
- Related entities
- Retrieval metadata
- Expiration and review requirements

MongoDB is the primary canonical persistence layer.

### 7.2 Preserve Relationships

The Knowledge Core must preserve relationships among knowledge entities.

Relationships include:

- Brand Ambassador to Success Profile
- Brand Ambassador to Momentum Journal
- Brand Ambassador to training path
- Brand Ambassador to prospects
- Prospect to relationship history
- Interview to knowledge objects
- Guided action to outcome
- Outcome to learning signal
- Knowledge object to source
- Knowledge object to approval decision
- Organizational pattern to supporting evidence
- Personal knowledge to promoted candidate
- Knowledge Session to approved organizational update

Neo4j is the primary relationship persistence layer.

### 7.3 Preserve Semantic Meaning

The Knowledge Core must preserve semantic meaning so runtime components can retrieve relevant knowledge even when exact keywords do not match.

Semantic retrieval must support:

- English
- Spanish
- Cross-language conceptual recall where enabled
- Agent-specific retrieval
- Domain-specific retrieval
- Brand Ambassador-specific retrieval
- Prospect-specific retrieval
- Organizational knowledge retrieval
- Personal journal retrieval with permission constraints

Chroma is the primary semantic persistence layer.

### 7.4 Support GraphRAG Reasoning

The Knowledge Core must support GraphRAG retrieval across canonical records, relationships, and semantic vectors.

GraphRAG must be able to combine:

- MongoDB canonical knowledge records
- Neo4j graph relationships
- Chroma semantic matches
- Governance status
- Permissions
- Language requirements
- Runtime request intent

GraphRAG may retrieve and rank knowledge.

GraphRAG may explain why knowledge was retrieved.

GraphRAG may identify related knowledge.

GraphRAG may not override governance.

GraphRAG may not expose private knowledge without authorization.

GraphRAG may not create active organizational knowledge without review and approval.

### 7.5 Enforce Knowledge Ownership

The Knowledge Core must enforce ownership boundaries.

Ownership types include:

- Brand Ambassador personal ownership
- Momentum organizational ownership
- Agent-contributed knowledge ownership
- Administrative ownership
- Governance ownership
- System-generated derived ownership

Ownership determines:

- Who may access the knowledge
- Who may promote the knowledge
- Who may approve the knowledge
- Who may modify the knowledge
- Who may archive the knowledge
- Whether the knowledge can be used in agent context
- Whether the knowledge can become organizational knowledge

### 7.6 Preserve Source Traceability

Every knowledge object must preserve its source.

Knowledge is never anonymous.

Every recommendation, retrieval, learning signal, and organizational knowledge update must be traceable to one or more sources.

Sources may include:

- Steve Success Interview
- Michael Training Interview
- Ivory Opportunity Map Interview
- Momentum Journal entry
- Browser Voice conversation
- Browser Text conversation
- Guided action
- Outcome record
- CRM note
- PMV activity
- Ringless voicemail event
- SMS event
- Knowledge Session
- Administrative decision
- Leadership review
- Training completion
- Support interaction
- Approved architecture document
- Approved governance document

### 7.7 Support Knowledge Lifecycle

The Knowledge Core must track knowledge through its lifecycle.

Lifecycle states include:

```text
Captured
  ↓
Candidate
  ↓
Under Review
  ↓
Approved
  ↓
Active
  ↓
Referenced
  ↓
Evaluated
  ↓
Updated / Superseded / Archived / Rejected
```

Personal knowledge may remain private indefinitely.

Organizational knowledge must be reviewed before activation.

### 7.8 Support Context Manager Retrieval

The Knowledge Core must expose controlled retrieval interfaces for the Context Manager.

The Context Manager must be able to request knowledge by:

- Agent
- Brand Ambassador
- Prospect
- Session
- Workflow
- Domain
- Task
- Language
- Permission scope
- Relationship graph
- Semantic similarity
- Governance status
- Recency
- Confidence
- Evidence requirements

The Knowledge Core returns knowledge candidates and supporting metadata.

The Context Manager assembles the final Context Packet.

### 7.9 Support Learning Pipeline Feedback

The Knowledge Core must receive learning signals from the Learning Pipeline.

Learning signals may include:

- Guided action outcome
- Recommendation effectiveness
- Agent guidance quality
- Brand Ambassador feedback
- Training completion
- Prospect response
- Conversion signal
- Retention signal
- Confidence change
- Momentum change
- Repeated question pattern
- Knowledge gap
- Contradiction
- Deprecated knowledge alert

The Knowledge Core must preserve these signals without automatically converting them into active organizational knowledge.

### 7.10 Support Bilingual Operation

The Knowledge Core must support English and Spanish at every knowledge layer.

Bilingual support includes:

- Language metadata on every knowledge object
- Original language preservation
- Optional translated variants
- Retrieval by requested language
- Cross-language semantic search
- Bilingual source attribution
- Bilingual governance status
- Bilingual confidence metadata
- Bilingual Context Manager retrieval support

English and Spanish are first-class runtime languages.

---

## 8. Non-Responsibilities

The Knowledge Core must not perform responsibilities assigned to other runtime components.

### 8.1 The Knowledge Core Does Not Conduct Interviews

Steve, Michael, and Ivory conduct specialized interviews through the Agent Runtime.

The Knowledge Core stores resulting knowledge.

### 8.2 The Knowledge Core Does Not Assemble Context Packets

The Context Manager assembles Context Packets.

The Knowledge Core retrieves and returns governed knowledge records.

### 8.3 The Knowledge Core Does Not Decide Agent Responses

Agents generate guidance using Context Packets.

The Knowledge Core does not produce end-user conversation responses.

### 8.4 The Knowledge Core Does Not Govern Approval Alone

Governance rules determine approval.

The Knowledge Core stores governance state and enforces access to active knowledge.

### 8.5 The Knowledge Core Does Not Promote Personal Knowledge Automatically

Momentum Journal entries remain private unless intentionally promoted.

The Knowledge Core may store private personal knowledge.

The Knowledge Core may store promoted candidates.

The Knowledge Core may store approved organizational versions.

The Knowledge Core must never auto-promote private personal knowledge.

### 8.6 The Knowledge Core Does Not Replace the Learning Pipeline

The Learning Pipeline evaluates outcomes and produces learning signals.

The Knowledge Core stores those signals and connects them to knowledge evolution.

### 8.7 The Knowledge Core Does Not Replace Implementation Workflows

Application-specific workflows, screens, dashboards, campaign logic, PMV behavior, and user interface behavior belong in Implementation documents.

---

## 9. Knowledge Domains

Momentum organizes knowledge into primary runtime domains.

Every knowledge object must belong to at least one domain.

A knowledge object may belong to more than one domain when appropriate.

### 9.1 Success Knowledge

**Primary Contributor:** Steve Success
**Primary Purpose:** Understand the Brand Ambassador as a person, builder, leader, and participant in Momentum.

Success Knowledge includes:

- Success Interview results
- Success Profile
- Personal goals
- Motivation
- Purpose
- Confidence
- Momentum level
- Support needs
- Communication style
- Daily success patterns
- Personal strengths
- Personal obstacles
- Accountability preferences
- Leadership aspirations
- Time availability
- Growth goals
- Identity as a Brand Ambassador within Momentum

Success Knowledge is used by:

- Context Manager
- Steve Success
- Michael Magnificent
- Guided Action Runtime
- Learning Pipeline
- Leadership support workflows

Success Knowledge must be Brand Ambassador-scoped unless explicitly approved for organizational pattern learning.

### 9.2 Training Knowledge

**Primary Contributor:** Michael Magnificent
**Primary Purpose:** Develop Brand Ambassador capability.

Training Knowledge includes:

- Fast Start status
- Training Profile
- Learning style
- Skill gaps
- Completed modules
- Incomplete modules
- Confidence by skill area
- Practice history
- Coaching history
- Leadership development
- Duplication readiness
- Script comprehension
- Product education progress
- Opportunity education progress
- Follow-up skill
- Relationship-building skill
- Compliance training status

Training Knowledge is used by:

- Context Manager
- Michael Magnificent
- Guided Action Runtime
- Learning Pipeline
- Leadership dashboards
- Training recommendation workflows

Training Knowledge must be tied to actual training state and source evidence.

### 9.3 Relationship Knowledge

**Primary Contributor:** Ivory
**Primary Purpose:** Understand people, relationships, prospects, and communication history.

Relationship Knowledge includes:

- Opportunity Map
- Relationship CRM
- Prospect profile
- Prospect needs
- Prospect interests
- Communication preferences
- Invitation history
- Presentation history
- Follow-up history
- Relationship strength
- Relationship context
- Objections
- Timing signals
- Personal notes
- Next suggested relationship action
- Prospect Momentum Viewer activity
- SMS interaction records
- Ringless voicemail interaction records
- Callback workflow records

Relationship Knowledge is used by:

- Context Manager
- Ivory
- Guided Action Runtime
- PMV workflows
- CRM workflows
- Learning Pipeline

Relationship Knowledge must respect privacy, consent, communication boundaries, and access control.

### 9.4 Performance Knowledge

**Primary Contributor:** Guided Action Runtime, Learning Pipeline, activity tracking
**Primary Purpose:** Understand actions, consistency, outcomes, and performance patterns.

Performance Knowledge includes:

- Daily actions
- Guided actions
- Completed actions
- Missed actions
- Outcomes
- Consistency
- Activity history
- Recommendations
- Response patterns
- Follow-up completion
- PMV engagement
- Training completion velocity
- Prospect conversion signals
- Retention indicators
- Leadership activity
- Team momentum indicators

Performance Knowledge is used by:

- Context Manager
- Steve Success
- Michael Magnificent
- Ivory
- Learning Pipeline
- Leadership workflows
- Dashboard implementations

Performance Knowledge must separate factual activity from interpretation.

### 9.5 Personal Knowledge

**Owner:** Brand Ambassador
**Primary Source:** Momentum Journal
**Primary Purpose:** Preserve private personal learning, reflection, questions, insights, and strategy.

Personal Knowledge includes:

- Lessons learned
- Ideas
- Questions
- Reflections
- Scripts
- Personal strategies
- Voice notes
- Resources
- Personal reminders
- Daily observations
- Self-coaching notes
- Spiritual or motivational reflections when voluntarily entered
- Personal business-building thoughts
- Private improvement plans

Personal Knowledge remains private unless intentionally promoted.

Promotion path:

```text
Momentum Journal
  ↓
Knowledge Candidate
  ↓
Review
  ↓
Approval
  ↓
Organizational Knowledge
```

The Knowledge Core must enforce this path.

No private Momentum Journal entry may become organizational knowledge automatically.

Michael Magnificent teaches every Brand Ambassador how to use the Momentum Journal.

The Knowledge Core stores and protects Momentum Journal knowledge.

### 9.6 Organizational Knowledge

**Owner:** Momentum Creation System
**Primary Purpose:** Preserve approved shared knowledge, standards, practices, governance, and architecture.

Organizational Knowledge includes:

- Constitution
- Governance
- Decision Framework
- ACR System
- AI Organization
- Knowledge Layer
- Knowledge Sessions
- Approved best practices
- Approved training standards
- Approved leadership knowledge
- Approved scripts
- Approved architecture
- Approved runtime specifications
- Approved implementation standards
- Approved compliance guidance
- Approved duplication methods
- Approved organizational learning

Organizational Knowledge is governed and reviewed before becoming active.

Organizational Knowledge may be used across Brand Ambassadors when permission and context allow.

### 9.7 System Knowledge

**Owner:** Momentum Creation System
**Primary Purpose:** Preserve runtime, technical, and operational state needed by the platform.

System Knowledge includes:

- Runtime component definitions
- Agent identity definitions
- Knowledge schemas
- Integration contracts
- Version history
- Runtime event records
- Processing status
- Indexing status
- Retrieval policies
- Audit records
- Error records
- Data quality records
- Migration records

System Knowledge is not application behavior.

System Knowledge supports reliable runtime operation.

### 9.8 Governance Knowledge

**Owner:** Governance Layer
**Primary Purpose:** Preserve decisions, approvals, constraints, rules, and review outcomes.

Governance Knowledge includes:

- Ratified decisions
- Approval records
- Rejection records
- Review notes
- Supersession decisions
- Policy constraints
- Constitutional guardrails
- Agent boundaries
- Knowledge activation decisions
- Deprecation decisions
- Escalation records

Governance Knowledge controls whether knowledge may become active.

---

## 10. Knowledge Sources

Knowledge may enter the Knowledge Core from multiple runtime sources.

All sources must be preserved.

All source records must include origin metadata.

### 10.1 Internal Runtime Sources

Internal runtime sources include:

- Steve Success Interview
- Michael Magnificent Training Interview
- Ivory Opportunity Map Interview
- Browser Voice interaction
- Browser Text interaction
- Momentum Journal entry
- Guided action completion
- Outcome entry
- Training activity
- Support conversation
- Leadership review
- Knowledge Session

Internal runtime uses browser-based voice and text.

Internal runtime does not use Telnyx.

### 10.2 External Runtime Sources

External runtime sources include:

- Ringless voicemail activity
- SMS activity
- Future callback workflow activity
- External prospect response activity
- PMV activity
- CRM notes created through external workflows

External runtime may use Telnyx for SMS, ringless voicemail, and future callback workflows only.

Telnyx must not be used for Steve, Michael, Ivory, Browser Voice, or Browser Text internal runtime.

### 10.3 Administrative Sources

Administrative sources include:

- Approved administrative decision
- Governance approval
- Knowledge Session ratification
- Architecture document
- Runtime specification
- Implementation specification
- Compliance decision
- Leadership decision

### 10.4 Derived Sources

Derived sources include:

- Learning Pipeline signal
- Aggregated performance pattern
- Repeated training gap
- Repeated prospect objection
- Repeated support issue
- Knowledge contradiction alert
- Knowledge freshness alert
- Outcome pattern
- GraphRAG relationship discovery

Derived sources must always preserve the underlying evidence.

Derived sources may not become active organizational knowledge without review.

---

## 11. Knowledge Object Model

Every unit of durable knowledge in the Knowledge Core must be represented as a Knowledge Object.

A Knowledge Object is the canonical runtime unit of knowledge.

### 11.1 Required Fields

Every Knowledge Object must include:

```typescript
type KnowledgeObject = {
  id: string;
  version: number;

  title: string;
  summary: string;
  content: KnowledgeContent;

  domain: KnowledgeDomain[];
  type: KnowledgeObjectType;

  owner: KnowledgeOwner;
  visibility: KnowledgeVisibility;
  permissionScope: PermissionScope[];

  source: KnowledgeSourceReference[];
  provenance: ProvenanceRecord[];

  language: LanguageCode;
  languageVariants: LanguageVariantReference[];

  lifecycleStatus: KnowledgeLifecycleStatus;
  governanceStatus: GovernanceStatus;

  confidence: KnowledgeConfidence;
  evidenceStrength: EvidenceStrength;

  tags: string[];
  entities: KnowledgeEntityReference[];

  relationships: KnowledgeRelationshipReference[];

  createdAt: string;
  createdBy: ActorReference;

  updatedAt: string;
  updatedBy: ActorReference;

  reviewedAt?: string;
  reviewedBy?: ActorReference;

  approvedAt?: string;
  approvedBy?: ActorReference;

  supersedes?: string[];
  supersededBy?: string;

  expiresAt?: string;
  reviewDueAt?: string;

  auditTrail: AuditTrailReference[];

  embeddingStatus: EmbeddingStatus;
  graphStatus: GraphStatus;
  retrievalStatus: RetrievalStatus;
};
```

### 11.2 Knowledge Content

Knowledge content may include structured and unstructured data.

```typescript
type KnowledgeContent = {
  markdown?: string;
  plainText?: string;
  structured?: Record<string, unknown>;
  transcriptReference?: string;
  documentReference?: string;
  mediaReference?: string;
  extractedFacts?: ExtractedFact[];
  recommendations?: RecommendationRecord[];
  constraints?: ConstraintRecord[];
};
```

### 11.3 Knowledge Domains Enumeration

```typescript
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

### 11.4 Knowledge Object Types

```typescript
type KnowledgeObjectType =
  | "profile"
  | "interview_summary"
  | "journal_entry"
  | "training_state"
  | "relationship_record"
  | "prospect_record"
  | "activity_record"
  | "outcome_record"
  | "learning_signal"
  | "approved_practice"
  | "governance_decision"
  | "runtime_specification"
  | "implementation_specification"
  | "knowledge_session"
  | "source_document"
  | "derived_pattern"
  | "recommendation_memory"
  | "system_record";
```

### 11.5 Ownership Types

```typescript
type KnowledgeOwner =
  | {
      ownerType: "brand_ambassador";
      brandAmbassadorId: string;
    }
  | {
      ownerType: "momentum_organization";
    }
  | {
      ownerType: "agent";
      agentId: "steve" | "michael" | "ivory";
    }
  | {
      ownerType: "governance";
    }
  | {
      ownerType: "system";
    };
```

### 11.6 Visibility Types

```typescript
type KnowledgeVisibility =
  | "private"
  | "brand_ambassador_scoped"
  | "team_scoped"
  | "leadership_scoped"
  | "organizational"
  | "system_internal";
```

### 11.7 Lifecycle Status

```typescript
type KnowledgeLifecycleStatus =
  | "captured"
  | "candidate"
  | "under_review"
  | "approved"
  | "active"
  | "referenced"
  | "evaluated"
  | "updated"
  | "superseded"
  | "archived"
  | "rejected";
```

### 11.8 Governance Status

```typescript
type GovernanceStatus =
  | "not_required"
  | "requires_review"
  | "pending_review"
  | "approved"
  | "rejected"
  | "superseded"
  | "restricted";
```

### 11.9 Language Codes

```typescript
type LanguageCode = "en" | "es";
```

Additional languages may be added in later versions, but Version 1.0 requires English and Spanish.

### 11.10 Confidence

```typescript
type KnowledgeConfidence = {
  score: number; // 0.0 to 1.0
  reason: string;
  calculatedBy: "human" | "system" | "learning_pipeline" | "governance";
  lastCalculatedAt: string;
};
```

### 11.11 Evidence Strength

```typescript
type EvidenceStrength =
  | "self_reported"
  | "observed"
  | "system_recorded"
  | "agent_interpreted"
  | "outcome_supported"
  | "governance_approved"
  | "multi_source_validated";
```

---

## 12. Source Model

Every Knowledge Object must link to one or more source records.

### 12.1 Source Reference

```typescript
type KnowledgeSourceReference = {
  sourceId: string;
  sourceType: KnowledgeSourceType;
  sourceTitle?: string;
  sourceUri?: string;
  capturedAt: string;
  capturedBy: ActorReference;
  language: LanguageCode;
  trustLevel: SourceTrustLevel;
};
```

### 12.2 Source Types

```typescript
type KnowledgeSourceType =
  | "steve_success_interview"
  | "michael_training_interview"
  | "ivory_opportunity_map_interview"
  | "momentum_journal"
  | "browser_voice_session"
  | "browser_text_session"
  | "guided_action"
  | "outcome"
  | "crm_note"
  | "pmv_activity"
  | "sms_activity"
  | "ringless_voicemail_activity"
  | "callback_workflow_activity"
  | "knowledge_session"
  | "administrative_decision"
  | "governance_decision"
  | "leadership_review"
  | "support_conversation"
  | "training_outcome"
  | "runtime_specification"
  | "implementation_specification"
  | "system_event";
```

### 12.3 Source Trust Levels

```typescript
type SourceTrustLevel =
  | "unverified"
  | "self_reported"
  | "system_observed"
  | "agent_observed"
  | "leadership_reviewed"
  | "governance_approved"
  | "constitutionally_ratified";
```

### 12.4 Provenance Record

```typescript
type ProvenanceRecord = {
  id: string;
  knowledgeObjectId: string;
  action:
    | "captured"
    | "extracted"
    | "classified"
    | "translated"
    | "embedded"
    | "linked"
    | "reviewed"
    | "approved"
    | "activated"
    | "retrieved"
    | "used_in_context"
    | "evaluated"
    | "updated"
    | "superseded"
    | "archived";
  actor: ActorReference;
  timestamp: string;
  reason?: string;
  relatedSourceId?: string;
  metadata?: Record<string, unknown>;
};
```

---

## 13. Entity Model

The Knowledge Core must identify and preserve entities.

Entities are used for graph relationships, retrieval filtering, ownership, and contextual assembly.

### 13.1 Entity Types

```typescript
type KnowledgeEntityType =
  | "brand_ambassador"
  | "prospect"
  | "agent"
  | "training_module"
  | "goal"
  | "skill"
  | "guided_action"
  | "outcome"
  | "journal_entry"
  | "knowledge_session"
  | "team"
  | "workflow"
  | "runtime_component"
  | "document"
  | "decision"
  | "communication_event"
  | "relationship"
  | "organization";
```

### 13.2 Entity Reference

```typescript
type KnowledgeEntityReference = {
  entityId: string;
  entityType: KnowledgeEntityType;
  displayName?: string;
  relationshipToKnowledge: string;
};
```

---

## 14. Relationship Model

Relationships are stored in Neo4j and referenced from canonical MongoDB records.

### 14.1 Required Relationship Structure

```typescript
type KnowledgeRelationshipReference = {
  relationshipId: string;
  fromEntityId: string;
  fromEntityType: KnowledgeEntityType;
  toEntityId: string;
  toEntityType: KnowledgeEntityType;
  relationshipType: KnowledgeRelationshipType;
  strength?: number; // 0.0 to 1.0
  createdAt: string;
  sourceId: string;
};
```

### 14.2 Relationship Types

```typescript
type KnowledgeRelationshipType =
  | "CREATED_BY"
  | "OWNED_BY"
  | "DERIVED_FROM"
  | "SUPPORTED_BY"
  | "CONTRADICTS"
  | "SUPERSEDES"
  | "RELATED_TO"
  | "MENTIONS"
  | "APPLIES_TO"
  | "USED_BY"
  | "RETRIEVED_FOR"
  | "PART_OF"
  | "PROMOTED_FROM"
  | "APPROVED_BY"
  | "REVIEWED_BY"
  | "RESULTED_IN"
  | "IMPROVED_BY"
  | "ASSOCIATED_WITH"
  | "TRAINED_BY"
  | "GUIDED_BY"
  | "RESPONDED_TO";
```

### 14.3 Minimum Required Graph Links

Every Knowledge Object must be linked to:

- Its owner
- Its source
- Its domain
- Its lifecycle state
- Its governance state
- Its creating actor
- Any Brand Ambassador it applies to
- Any prospect it applies to
- Any agent that created or contributed it
- Any outcome that evaluates it
- Any parent or superseded knowledge object

---

## 15. Storage Architecture

The Knowledge Core uses a multi-database architecture.

Each database has a specific responsibility.

No database is optional in the Version 1.0 architecture.

### 15.1 MongoDB / Mongoose

MongoDB stores canonical truth.

MongoDB is responsible for:

- Knowledge Object records
- Source records
- Lifecycle state
- Governance state
- Language variants
- Ownership and visibility
- Permission metadata
- Audit trail references
- Version history
- Review status
- Approval status
- Content payloads
- Structured extracted facts
- Runtime metadata
- Indexing status
- Graph sync status
- Embedding sync status

MongoDB is the source of truth for whether a Knowledge Object exists and whether it is active.

### 15.2 Neo4j

Neo4j stores relationships.

Neo4j is responsible for:

- Entity nodes
- Knowledge Object nodes
- Source nodes
- Agent nodes
- Brand Ambassador nodes
- Prospect nodes
- Goal nodes
- Training nodes
- Outcome nodes
- Relationship edges
- Graph traversal
- Relationship strength
- Pattern discovery
- Multi-hop context discovery

Neo4j is not the canonical source of full knowledge content.

Neo4j must reference MongoDB Knowledge Object IDs.

### 15.3 Chroma

Chroma stores semantic embeddings.

Chroma is responsible for:

- Embedding approved text
- Embedding private journal text with permission isolation
- Embedding candidate knowledge where permitted
- Similarity search
- Language-aware semantic retrieval
- Cross-language semantic retrieval where supported
- Agent-specific semantic collections
- Domain-specific semantic collections
- Personal knowledge semantic isolation

Chroma is not the canonical source of truth.

Chroma records must reference MongoDB Knowledge Object IDs.

### 15.4 GraphRAG Service

GraphRAG is the retrieval orchestration layer.

GraphRAG is responsible for:

- Combining semantic retrieval and graph traversal
- Applying governance filters
- Applying permission filters
- Applying lifecycle filters
- Ranking knowledge
- Returning evidence
- Returning source references
- Returning relationship paths
- Returning confidence metadata
- Supporting Context Manager requests

GraphRAG must not bypass governance.

GraphRAG must not expose private knowledge outside its permission scope.

GraphRAG must not activate knowledge.

---

## 16. Required Collections and Indexes

### 16.1 MongoDB Collections

Version 1.0 requires the following MongoDB collections:

```text
knowledge_objects
knowledge_sources
knowledge_versions
knowledge_audit_events
knowledge_language_variants
knowledge_review_records
knowledge_permissions
knowledge_ingestion_jobs
knowledge_embedding_jobs
knowledge_graph_sync_jobs
knowledge_retrieval_logs
knowledge_learning_signals
knowledge_promotion_requests
knowledge_quality_flags
```

### 16.2 MongoDB Required Indexes

The implementation must create indexes for:

```text
knowledge_objects.id unique
knowledge_objects.domain
knowledge_objects.type
knowledge_objects.owner.ownerType
knowledge_objects.owner.brandAmbassadorId
knowledge_objects.visibility
knowledge_objects.lifecycleStatus
knowledge_objects.governanceStatus
knowledge_objects.language
knowledge_objects.createdAt
knowledge_objects.updatedAt
knowledge_objects.reviewDueAt
knowledge_objects.tags
knowledge_objects.entities.entityId
knowledge_objects.source.sourceId
knowledge_objects.embeddingStatus
knowledge_objects.graphStatus
knowledge_sources.sourceType
knowledge_sources.capturedAt
knowledge_retrieval_logs.requestId
knowledge_learning_signals.knowledgeObjectId
knowledge_promotion_requests.status
```

### 16.3 Neo4j Node Labels

Version 1.0 requires these node labels:

```text
KnowledgeObject
KnowledgeSource
BrandAmbassador
Prospect
Agent
TrainingModule
Goal
Skill
GuidedAction
Outcome
JournalEntry
KnowledgeSession
Team
Workflow
RuntimeComponent
Document
Decision
CommunicationEvent
Organization
Domain
LifecycleState
GovernanceState
```

### 16.4 Neo4j Required Constraints

Neo4j must enforce uniqueness for:

```cypher
KnowledgeObject.id
KnowledgeSource.id
BrandAmbassador.id
Prospect.id
Agent.id
GuidedAction.id
Outcome.id
JournalEntry.id
KnowledgeSession.id
Document.id
Decision.id
```

### 16.5 Chroma Collections

Version 1.0 requires these Chroma collection categories:

```text
organizational_knowledge_en
organizational_knowledge_es
success_knowledge_en
success_knowledge_es
training_knowledge_en
training_knowledge_es
relationship_knowledge_en
relationship_knowledge_es
performance_knowledge_en
performance_knowledge_es
personal_knowledge_{brandAmbassadorId}_en
personal_knowledge_{brandAmbassadorId}_es
system_knowledge_en
system_knowledge_es
governance_knowledge_en
governance_knowledge_es
```

Personal knowledge collections must be scoped by Brand Ambassador.

Private personal knowledge must not be stored in shared semantic collections.

---

## 17. Knowledge Lifecycle

### 17.1 Captured

Captured knowledge is raw or newly received.

Examples:

- Interview transcript
- Journal entry
- CRM note
- Activity event
- Outcome record
- SMS response
- Browser voice session transcript
- Browser text session transcript

Captured knowledge is not automatically active.

### 17.2 Candidate

A Knowledge Candidate is a structured extraction from captured knowledge.

Examples:

- A potential training insight
- A reusable script
- A repeated objection pattern
- A success pattern
- A leadership practice
- A personal strategy promoted by a Brand Ambassador

Candidate knowledge may be retrieved for review workflows.

Candidate knowledge may not be used as active organizational guidance.

### 17.3 Under Review

Under Review knowledge is being evaluated by authorized review workflow, governance process, or leadership process.

Review may evaluate:

- Accuracy
- Compliance
- Relevance
- Duplicative status
- Conflict with existing knowledge
- Constitutional alignment
- Training usefulness
- Organizational applicability
- Language correctness
- Source strength

### 17.4 Approved

Approved knowledge has passed review.

Approved knowledge is eligible for activation.

Approved knowledge is not necessarily active until activated.

### 17.5 Active

Active knowledge may be used by the Context Manager for agent Context Packets.

Active knowledge must have:

- Approved governance status where required
- Valid lifecycle status
- Valid permissions
- Valid source attribution
- Valid language metadata
- Current embedding status
- Current graph status

### 17.6 Referenced

Referenced knowledge has been used in one or more Context Packets.

The Knowledge Core must preserve retrieval logs showing where and when knowledge was referenced.

### 17.7 Evaluated

Evaluated knowledge has been connected to outcomes or feedback.

Evaluation may indicate:

- Helpful
- Neutral
- Unhelpful
- Outdated
- Confusing
- Contradictory
- High-performing
- Needs review
- Needs translation improvement
- Needs governance review

### 17.8 Updated

Updated knowledge has been modified while preserving prior versions.

Updates must create version history.

Updates must preserve provenance.

### 17.9 Superseded

Superseded knowledge has been replaced by newer knowledge.

Superseded knowledge must not be retrieved as active guidance unless explicitly requested for historical context.

### 17.10 Archived

Archived knowledge is retained for recordkeeping but removed from normal retrieval.

Archived knowledge may be accessed by authorized administrative or governance workflows.

### 17.11 Rejected

Rejected knowledge failed review.

Rejected knowledge must not be used as active guidance.

Rejected knowledge may remain stored for audit and learning purposes.

---

## 18. Personal Knowledge and Momentum Journal

Every Brand Ambassador owns a Momentum Journal.

The Momentum Journal is the Brand Ambassador's personal knowledge base.

The Knowledge Core must treat Momentum Journal content as private by default.

### 18.1 Personal Knowledge Rules

Personal Knowledge must be:

- Owned by the Brand Ambassador
- Private by default
- Retrieved only for that Brand Ambassador's authorized context
- Preserved with source attribution
- Language-tagged
- Searchable within the owner's permission scope
- Protected from organizational use unless promoted
- Excluded from shared Chroma collections
- Excluded from organizational GraphRAG retrieval unless approved

### 18.2 Promotion Rules

A Brand Ambassador may intentionally promote Personal Knowledge.

Promotion path:

```text
Momentum Journal Entry
  ↓
Promotion Request
  ↓
Knowledge Candidate
  ↓
Review
  ↓
Approval
  ↓
Organizational Knowledge Object
  ↓
Active Organizational Knowledge
```

### 18.3 Promotion Request Model

```typescript
type KnowledgePromotionRequest = {
  id: string;
  brandAmbassadorId: string;
  sourceJournalEntryId: string;
  proposedTitle: string;
  proposedSummary: string;
  proposedDomain: KnowledgeDomain[];
  language: LanguageCode;
  status: "submitted" | "under_review" | "approved" | "rejected" | "withdrawn";
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: ActorReference;
  resultingKnowledgeObjectId?: string;
  rejectionReason?: string;
};
```

### 18.4 Michael's Role

Michael Magnificent teaches Brand Ambassadors how to use the Momentum Journal.

Michael may help structure journal entries.

Michael may suggest that a Brand Ambassador consider promoting a useful insight.

Michael may not promote private knowledge without intentional Brand Ambassador action.

The Knowledge Core must enforce the promotion boundary.

---

## 19. Organizational Knowledge

Organizational Knowledge belongs to Momentum Creation System.

Organizational Knowledge represents shared, approved understanding.

### 19.1 Organizational Activation Requirements

Organizational Knowledge may become active only when:

- Source is preserved
- Ownership is assigned to Momentum Creation System
- Governance status permits activation
- Lifecycle status is approved or active
- Language metadata is complete
- Permissions are defined
- Graph sync is complete
- Embedding sync is complete
- Audit trail is complete
- No unresolved contradiction blocks activation

### 19.2 Organizational Knowledge Examples

Organizational Knowledge includes:

- Ratified constitutional documents
- Governance documents
- Decision Framework
- ACR System
- AI Organization documents
- Knowledge Layer documents
- Knowledge Sessions
- Runtime specifications
- Approved training methods
- Approved relationship-building methods
- Approved coaching practices
- Approved leadership patterns
- Approved operational standards
- Approved bilingual scripts
- Approved compliance standards

### 19.3 Organizational Knowledge Restrictions

Organizational Knowledge must not include:

- Private Momentum Journal content without promotion and approval
- Unreviewed candidate knowledge
- Unverified claims used as guidance
- Superseded standards
- Rejected knowledge
- Agent hallucinations
- Raw transcripts without approved extraction
- Private relationship notes outside their permission scope

---

## 20. Bilingual Runtime Requirements

English and Spanish are first-class languages in the Knowledge Core.

### 20.1 Language Metadata

Every Knowledge Object must include:

- Original language
- Available language variants
- Translation status
- Translation source
- Translation confidence
- Reviewer status where required

### 20.2 Language Variant Model

```typescript
type LanguageVariantReference = {
  id: string;
  knowledgeObjectId: string;
  language: LanguageCode;
  variantType: "original" | "translation" | "localized_adaptation";
  status: "draft" | "reviewed" | "approved" | "active";
  createdAt: string;
  createdBy: ActorReference;
  reviewedAt?: string;
  reviewedBy?: ActorReference;
};
```

### 20.3 Retrieval Language Rules

When the Context Manager requests knowledge, it must specify language preference.

The Knowledge Core must:

1. Return active knowledge in the requested language when available.
2. Return an approved translation when available.
3. Return original language with translation-needed metadata when permitted.
4. Never fabricate a translation as approved knowledge.
5. Preserve source language in retrieval metadata.

### 20.4 Cross-Language Semantic Retrieval

The Knowledge Core may support cross-language semantic retrieval.

Example:

A Spanish query may retrieve English organizational knowledge when:

- The English knowledge is active
- The requester has permission
- No Spanish variant exists
- The Context Manager allows fallback
- Retrieval metadata clearly marks fallback language

### 20.5 Translation Governance

Translations of organizational knowledge must be reviewed before becoming active when they are used for official guidance.

Machine-generated translations may be stored as draft variants.

Draft translations must not be represented as approved organizational knowledge.

---

## 21. Permission and Access Control

The Knowledge Core must enforce access control before returning knowledge to any runtime component.

### 21.1 Permission Scopes

```typescript
type PermissionScope =
  | "self"
  | "assigned_brand_ambassador"
  | "assigned_prospect"
  | "team"
  | "leadership"
  | "organization"
  | "governance"
  | "system";
```

### 21.2 Runtime Access Rules

Steve Success may access:

- Authorized Success Knowledge for the active Brand Ambassador
- Relevant Performance Knowledge
- Relevant Personal Knowledge for the active Brand Ambassador only
- Approved Organizational Knowledge
- Approved Governance Knowledge required for guardrails

Michael Magnificent may access:

- Authorized Training Knowledge for the active Brand Ambassador
- Relevant Success Knowledge needed for training personalization
- Relevant Performance Knowledge
- Relevant Personal Knowledge for the active Brand Ambassador only
- Approved Organizational Knowledge
- Approved Governance Knowledge required for guardrails

Ivory may access:

- Authorized Relationship Knowledge
- Prospect-related records within permission scope
- Relevant Success Knowledge needed for relationship guidance
- Relevant Performance Knowledge
- Approved Organizational Knowledge
- Approved Governance Knowledge required for guardrails

Browser Voice Runtime may access:

- Only knowledge provided through Context Packets
- No direct raw database access

Browser Text Runtime may access:

- Only knowledge provided through Context Packets
- No direct raw database access

External runtime workflows may access:

- Only permission-scoped communication and relationship knowledge required for the workflow
- No private Momentum Journal content
- No unrestricted organizational knowledge retrieval
- No internal browser voice runtime data unless explicitly permitted through approved interfaces

### 21.3 Private Knowledge Rule

Private Brand Ambassador knowledge must never be returned to another Brand Ambassador, prospect, external workflow, or organizational context unless promoted and approved.

### 21.4 Retrieval Enforcement

All Knowledge Core retrieval must apply:

- Actor identity check
- Runtime component check
- Permission scope check
- Visibility check
- Lifecycle status check
- Governance status check
- Brand Ambassador scope check
- Prospect scope check when applicable
- Language availability check

---

## 22. Runtime Interfaces

The Knowledge Core must expose internal service interfaces.

These interfaces are not public application APIs unless explicitly wrapped by Implementation Layer endpoints.

### 22.1 Write Interface

The Knowledge Core write interface receives structured knowledge from the Knowledge Ingestion Protocol.

```typescript
interface KnowledgeCoreWriteService {
  createKnowledgeObject(
    input: CreateKnowledgeObjectInput
  ): Promise<KnowledgeObject>;
  updateKnowledgeObject(
    input: UpdateKnowledgeObjectInput
  ): Promise<KnowledgeObject>;
  createSourceRecord(
    input: CreateKnowledgeSourceInput
  ): Promise<KnowledgeSourceRecord>;
  createKnowledgeVersion(
    input: CreateKnowledgeVersionInput
  ): Promise<KnowledgeVersionRecord>;
  recordProvenance(input: RecordProvenanceInput): Promise<ProvenanceRecord>;
  submitPromotionRequest(
    input: SubmitPromotionRequestInput
  ): Promise<KnowledgePromotionRequest>;
}
```

### 22.2 Lifecycle Interface

```typescript
interface KnowledgeLifecycleService {
  transitionLifecycleStatus(
    input: LifecycleTransitionInput
  ): Promise<KnowledgeObject>;
  markUnderReview(input: ReviewTransitionInput): Promise<KnowledgeObject>;
  approveKnowledge(input: ApprovalInput): Promise<KnowledgeObject>;
  activateKnowledge(input: ActivationInput): Promise<KnowledgeObject>;
  rejectKnowledge(input: RejectionInput): Promise<KnowledgeObject>;
  supersedeKnowledge(input: SupersessionInput): Promise<KnowledgeObject>;
  archiveKnowledge(input: ArchiveInput): Promise<KnowledgeObject>;
}
```

### 22.3 Retrieval Interface

The retrieval interface is primarily consumed by the Context Manager.

```typescript
interface KnowledgeRetrievalService {
  retrieveForContext(
    input: KnowledgeRetrievalRequest
  ): Promise<KnowledgeRetrievalResult>;
  retrieveById(input: KnowledgeByIdRequest): Promise<KnowledgeObject | null>;
  retrieveRelated(
    input: RelatedKnowledgeRequest
  ): Promise<RelatedKnowledgeResult>;
  retrievePersonalKnowledge(
    input: PersonalKnowledgeRequest
  ): Promise<KnowledgeRetrievalResult>;
  retrieveOrganizationalKnowledge(
    input: OrganizationalKnowledgeRequest
  ): Promise<KnowledgeRetrievalResult>;
}
```

### 22.4 Graph Interface

```typescript
interface KnowledgeGraphService {
  syncKnowledgeObject(input: GraphSyncInput): Promise<GraphSyncResult>;
  createRelationship(
    input: CreateKnowledgeRelationshipInput
  ): Promise<KnowledgeRelationshipReference>;
  retrieveGraphContext(input: GraphContextRequest): Promise<GraphContextResult>;
  detectRelationshipPatterns(
    input: RelationshipPatternRequest
  ): Promise<RelationshipPatternResult>;
}
```

### 22.5 Embedding Interface

```typescript
interface KnowledgeEmbeddingService {
  embedKnowledgeObject(
    input: EmbedKnowledgeObjectInput
  ): Promise<EmbeddingResult>;
  updateEmbedding(input: UpdateEmbeddingInput): Promise<EmbeddingResult>;
  deleteEmbedding(input: DeleteEmbeddingInput): Promise<DeleteEmbeddingResult>;
  semanticSearch(input: SemanticSearchInput): Promise<SemanticSearchResult>;
}
```

### 22.6 GraphRAG Interface

```typescript
interface GraphRAGService {
  retrieve(input: GraphRAGRequest): Promise<GraphRAGResult>;
  explainRetrieval(
    input: RetrievalExplanationRequest
  ): Promise<RetrievalExplanation>;
  detectContradictions(
    input: ContradictionDetectionRequest
  ): Promise<ContradictionDetectionResult>;
  identifyKnowledgeGaps(
    input: KnowledgeGapRequest
  ): Promise<KnowledgeGapResult>;
}
```

### 22.7 Learning Signal Interface

```typescript
interface KnowledgeLearningService {
  recordLearningSignal(
    input: LearningSignalInput
  ): Promise<LearningSignalRecord>;
  attachOutcomeToKnowledge(
    input: OutcomeKnowledgeLinkInput
  ): Promise<KnowledgeRelationshipReference>;
  flagKnowledgeQuality(
    input: KnowledgeQualityFlagInput
  ): Promise<KnowledgeQualityFlag>;
  requestKnowledgeReview(
    input: KnowledgeReviewRequestInput
  ): Promise<KnowledgeReviewRecord>;
}
```

---

## 23. Retrieval Request Model

The Context Manager must use a governed retrieval request.

```typescript
type KnowledgeRetrievalRequest = {
  requestId: string;

  requestingComponent:
    | "context_manager"
    | "learning_pipeline"
    | "governance_runtime"
    | "implementation_runtime";

  requestingAgent?: "steve" | "michael" | "ivory";

  actor: ActorReference;

  brandAmbassadorId?: string;
  prospectId?: string;
  teamId?: string;
  sessionId?: string;
  workflowId?: string;

  task: string;
  intent: string;

  domains: KnowledgeDomain[];

  language: LanguageCode;
  allowLanguageFallback: boolean;

  permissionScopes: PermissionScope[];

  lifecycleStatuses: KnowledgeLifecycleStatus[];
  governanceStatuses: GovernanceStatus[];

  includePersonalKnowledge: boolean;
  includeOrganizationalKnowledge: boolean;
  includeRelationshipKnowledge: boolean;
  includePerformanceKnowledge: boolean;

  semanticQuery?: string;
  graphSeedEntities?: KnowledgeEntityReference[];

  recencyPreference?: "recent" | "balanced" | "historical";
  evidenceRequirement?: EvidenceStrength[];
  maxResults: number;

  requireSourceTraceability: boolean;
  requireRetrievalExplanation: boolean;
};
```

---

## 24. Retrieval Result Model

```typescript
type KnowledgeRetrievalResult = {
  requestId: string;
  results: RetrievedKnowledgeItem[];
  omittedResults: OmittedKnowledgeItem[];
  retrievalExplanation?: RetrievalExplanation;
  languageFallbackUsed: boolean;
  generatedAt: string;
};
```

```typescript
type RetrievedKnowledgeItem = {
  knowledgeObjectId: string;
  version: number;
  title: string;
  summary: string;
  excerpt?: string;
  domain: KnowledgeDomain[];
  type: KnowledgeObjectType;
  language: LanguageCode;
  lifecycleStatus: KnowledgeLifecycleStatus;
  governanceStatus: GovernanceStatus;
  confidence: KnowledgeConfidence;
  evidenceStrength: EvidenceStrength;
  source: KnowledgeSourceReference[];
  relationships: KnowledgeRelationshipReference[];
  retrievalScore: number;
  retrievalReasons: string[];
  permissionScopeUsed: PermissionScope[];
};
```

```typescript
type OmittedKnowledgeItem = {
  knowledgeObjectId?: string;
  reason:
    | "permission_denied"
    | "lifecycle_not_active"
    | "governance_not_approved"
    | "language_unavailable"
    | "visibility_restricted"
    | "superseded"
    | "archived"
    | "low_confidence"
    | "outside_scope";
};
```

---

## 25. Data Flow

### 25.1 Knowledge Creation Flow

```text
Runtime Source
  ↓
Knowledge Ingestion Protocol
  ↓
Source Record Created
  ↓
Knowledge Candidate Created
  ↓
Canonical Record Stored in MongoDB
  ↓
Entities Extracted
  ↓
Relationships Stored in Neo4j
  ↓
Embeddings Stored in Chroma
  ↓
Lifecycle Status Assigned
  ↓
Governance Status Assigned
  ↓
Audit Trail Updated
```

### 25.2 Organizational Activation Flow

```text
Knowledge Candidate
  ↓
Review
  ↓
Approval
  ↓
Version Created
  ↓
Lifecycle Status: Approved
  ↓
Activation Check
  ↓
Lifecycle Status: Active
  ↓
Graph Sync Verified
  ↓
Embedding Sync Verified
  ↓
Available to Context Manager
```

### 25.3 Personal Knowledge Flow

```text
Momentum Journal Entry
  ↓
Source Record Created
  ↓
Private Knowledge Object Created
  ↓
Stored in Brand Ambassador Scope
  ↓
Personal Graph Links Created
  ↓
Personal Chroma Collection Updated
  ↓
Available only to Owner's Context
```

### 25.4 Personal Promotion Flow

```text
Brand Ambassador Selects Journal Insight
  ↓
Promotion Request Created
  ↓
Knowledge Candidate Created
  ↓
Review Workflow
  ↓
Approval or Rejection
  ↓
Approved Candidate Becomes Organizational Knowledge
  ↓
Original Journal Entry Remains Private
```

### 25.5 Retrieval Flow

```text
Context Manager Sends Retrieval Request
  ↓
Knowledge Core Validates Actor and Scope
  ↓
MongoDB Filters Canonical Records
  ↓
Chroma Performs Semantic Retrieval
  ↓
Neo4j Performs Relationship Traversal
  ↓
GraphRAG Combines Results
  ↓
Governance and Permission Filters Applied
  ↓
Results Ranked
  ↓
Retrieval Metadata Generated
  ↓
Knowledge Returned to Context Manager
```

### 25.6 Learning Flow

```text
Guided Action Completed
  ↓
Outcome Captured
  ↓
Learning Pipeline Evaluates Signal
  ↓
Learning Signal Sent to Knowledge Core
  ↓
Knowledge Object Linked to Outcome
  ↓
Quality / Usefulness Updated
  ↓
Review Requested if Needed
  ↓
Knowledge Evolution Path Begins
```

---

## 26. Runtime Flow

### 26.1 Steve Success Runtime Flow

```text
Steve conducts Success Interview
  ↓
Interview transcript captured
  ↓
Knowledge Ingestion extracts Success Knowledge
  ↓
Knowledge Core stores Success Profile
  ↓
Context Manager retrieves Success Knowledge in later sessions
  ↓
Steve personalizes guidance
  ↓
Guided actions produce outcomes
  ↓
Learning Pipeline sends learning signals
  ↓
Knowledge Core evolves Brand Ambassador understanding
```

### 26.2 Michael Magnificent Runtime Flow

```text
Michael conducts Training Interview
  ↓
Training profile captured
  ↓
Knowledge Core stores skill gaps and training state
  ↓
Context Manager retrieves training context
  ↓
Michael teaches and guides next step
  ↓
Training outcomes are captured
  ↓
Learning Pipeline evaluates progress
  ↓
Knowledge Core updates Training Knowledge
```

### 26.3 Ivory Runtime Flow

```text
Ivory conducts Opportunity Map Interview
  ↓
Prospect and relationship knowledge captured
  ↓
Knowledge Core stores relationship records
  ↓
Context Manager retrieves relationship context
  ↓
Ivory guides invitation or follow-up
  ↓
PMV / SMS / voicemail outcomes are captured
  ↓
Learning Pipeline evaluates relationship outcome
  ↓
Knowledge Core updates Relationship Knowledge
```

### 26.4 Browser Voice Runtime Flow

```text
Brand Ambassador speaks through browser voice
  ↓
Browser Voice Runtime captures session content
  ↓
Agent Runtime processes conversation
  ↓
Knowledge Ingestion extracts knowledge
  ↓
Knowledge Core stores authorized knowledge
  ↓
Context Manager retrieves future context
```

Browser Voice Runtime is internal.

Browser Voice Runtime must not use Telnyx.

### 26.5 Browser Text Runtime Flow

```text
Brand Ambassador interacts through browser text
  ↓
Browser Text Runtime captures session content
  ↓
Agent Runtime processes conversation
  ↓
Knowledge Ingestion extracts knowledge
  ↓
Knowledge Core stores authorized knowledge
  ↓
Context Manager retrieves future context
```

### 26.6 External Runtime Flow

```text
SMS / Ringless Voicemail / Callback Workflow
  ↓
External event captured
  ↓
Knowledge Ingestion classifies communication activity
  ↓
Knowledge Core stores relationship or performance knowledge
  ↓
Context Manager may retrieve it for Ivory or guided action
```

External runtime may use Telnyx.

Internal runtime must not use Telnyx.

---

## 27. GraphRAG Requirements

GraphRAG is required for contextual retrieval across the Knowledge Core.

### 27.1 GraphRAG Must Combine Three Retrieval Modes

GraphRAG must combine:

```text
Canonical Filtering
  MongoDB filters by lifecycle, governance, permissions, ownership, domain, language.

Semantic Search
  Chroma retrieves conceptually relevant knowledge.

Graph Traversal
  Neo4j retrieves relationships and multi-hop context.
```

### 27.2 GraphRAG Ranking Factors

GraphRAG ranking must consider:

- Permission validity
- Governance status
- Lifecycle status
- Semantic similarity
- Graph proximity
- Source trust level
- Evidence strength
- Recency
- Brand Ambassador relevance
- Prospect relevance
- Agent relevance
- Domain relevance
- Outcome effectiveness
- Language match
- Confidence score
- Supersession status

### 27.3 GraphRAG Prohibited Behavior

GraphRAG must not:

- Return private knowledge outside permission scope
- Return rejected knowledge as guidance
- Return archived knowledge as active guidance
- Return superseded knowledge unless requested for history
- Override governance restrictions
- Invent source attribution
- Treat semantic similarity as approval
- Treat repeated patterns as active organizational truth without review
- Expose raw sensitive notes unnecessarily
- Make final agent response decisions

### 27.4 Retrieval Explanation

When requested, GraphRAG must explain:

- Why each knowledge item was retrieved
- Which source supports it
- Which relationships were used
- Whether semantic search contributed
- Whether graph traversal contributed
- Whether language fallback was used
- Whether any relevant items were omitted due to permissions or governance

---

## 28. Knowledge Quality

The Knowledge Core must preserve quality metadata.

### 28.1 Quality Dimensions

Knowledge quality includes:

- Accuracy
- Completeness
- Freshness
- Source strength
- Governance status
- Outcome effectiveness
- Language quality
- Duplication status
- Conflict status
- Applicability
- Clarity
- Confidence

### 28.2 Quality Flags

```typescript
type KnowledgeQualityFlag = {
  id: string;
  knowledgeObjectId: string;
  flagType:
    | "outdated"
    | "contradictory"
    | "low_confidence"
    | "translation_issue"
    | "needs_review"
    | "poor_outcome"
    | "duplicate"
    | "compliance_concern"
    | "unclear"
    | "high_value";
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  createdBy: ActorReference;
  reason: string;
  status: "open" | "under_review" | "resolved" | "dismissed";
};
```

### 28.3 Review Triggers

The Knowledge Core must support review triggers when:

- Knowledge is repeatedly retrieved but produces poor outcomes
- A contradiction is detected
- A translation issue is flagged
- A source is superseded
- Governance rules change
- A Brand Ambassador disputes knowledge
- A leader flags knowledge
- The Learning Pipeline detects a pattern
- Review due date is reached
- Confidence falls below threshold

---

## 29. Versioning

Knowledge must be versioned.

### 29.1 Version Rules

The Knowledge Core must create a new version when:

- Content changes
- Summary changes
- Governance status changes materially
- Approval state changes
- Language variant changes
- Ownership changes
- Visibility changes
- Supersession occurs
- Organizational knowledge is updated

### 29.2 Version Record

```typescript
type KnowledgeVersionRecord = {
  id: string;
  knowledgeObjectId: string;
  version: number;
  snapshot: KnowledgeObject;
  createdAt: string;
  createdBy: ActorReference;
  reason: string;
};
```

### 29.3 Supersession Rules

When knowledge is superseded:

- Original Knowledge Object remains stored
- Original is marked superseded
- New Knowledge Object references superseded object
- Retrieval excludes superseded knowledge by default
- Audit trail records supersession reason
- Context Manager receives only active version unless historical retrieval is requested

---

## 30. Audit Requirements

Every significant action must be auditable.

### 30.1 Audit Events

Audit events must be recorded for:

- Source creation
- Knowledge creation
- Knowledge update
- Lifecycle transition
- Governance transition
- Permission change
- Visibility change
- Embedding creation
- Graph sync
- Retrieval
- Context usage
- Promotion request
- Approval
- Rejection
- Supersession
- Archive
- Quality flag
- Learning signal
- Translation variant creation

### 30.2 Audit Event Model

```typescript
type KnowledgeAuditEvent = {
  id: string;
  knowledgeObjectId?: string;
  sourceId?: string;
  eventType: string;
  actor: ActorReference;
  timestamp: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  requestId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};
```

### 30.3 Retrieval Logging

Every retrieval used for Context Packet assembly must be logged.

Retrieval logs must include:

- Request ID
- Requesting component
- Requesting agent
- Actor
- Brand Ambassador scope
- Prospect scope where applicable
- Domains requested
- Language requested
- Knowledge returned
- Knowledge omitted
- Permission filters applied
- Governance filters applied
- Retrieval scores
- Timestamp

---

## 31. Event Requirements

The Knowledge Core must publish and consume runtime events.

### 31.1 Events Published by Knowledge Core

```text
knowledge.object.created
knowledge.object.updated
knowledge.object.lifecycle_changed
knowledge.object.approved
knowledge.object.activated
knowledge.object.rejected
knowledge.object.superseded
knowledge.object.archived
knowledge.source.created
knowledge.embedding.completed
knowledge.graph_sync.completed
knowledge.retrieval.completed
knowledge.quality_flag.created
knowledge.review_requested
knowledge.promotion_request.created
knowledge.learning_signal.recorded
knowledge.translation_variant.created
```

### 31.2 Events Consumed by Knowledge Core

```text
ingestion.knowledge_candidate.created
ingestion.source.captured
governance.knowledge.approved
governance.knowledge.rejected
learning.signal.created
guided_action.completed
outcome.recorded
journal.entry.created
journal.entry.promotion_requested
agent.session.completed
browser_voice.session.completed
browser_text.session.completed
sms.event.received
ringless_voicemail.event.received
callback.event.received
training.completed
leadership.review.completed
```

### 31.3 Event Envelope

All events must use a consistent envelope.

```typescript
type RuntimeEventEnvelope<TPayload> = {
  eventId: string;
  eventType: string;
  occurredAt: string;
  producedBy: string;
  correlationId?: string;
  causationId?: string;
  actor?: ActorReference;
  payload: TPayload;
};
```

---

## 32. Dependencies

The Knowledge Core depends on ratified upstream architecture.

### 32.1 Constitutional Dependencies

The Knowledge Core must comply with:

- Momentum Constitution
- Governance Framework
- Decision Framework
- ACR System
- AI Organization
- Knowledge Layer
- Knowledge Sessions

### 32.2 Runtime Dependencies

The Knowledge Core depends on:

- Knowledge Ingestion Protocol
- Governance Runtime
- Event Bus
- Identity and permission system
- MongoDB
- Mongoose
- Neo4j
- Chroma
- Embedding service
- GraphRAG service
- Audit service

### 32.3 Downstream Runtime Consumers

The Knowledge Core serves:

- Context Manager
- Context Packet builder
- Agent Runtime
- Steve Success
- Michael Magnificent
- Ivory
- Browser Voice Runtime
- Browser Text Runtime
- Learning Pipeline
- Guided Action Runtime
- Agent Events
- Implementation Runtime Interfaces

### 32.4 External Integration Boundary

The Knowledge Core may receive external communication activity through approved ingestion events.

External systems include:

- Ringless voicemail
- SMS
- Future callback workflows

Telnyx may be used only in the external runtime boundary.

Telnyx must not be part of internal Steve, Michael, Ivory, Browser Voice, or Browser Text runtime.

---

## 33. Security and Privacy

### 33.1 Default Privacy Rule

Knowledge must be private unless explicitly classified otherwise.

### 33.2 Personal Knowledge Protection

Momentum Journal content must be:

- Private by default
- Owner-scoped
- Excluded from organizational retrieval
- Excluded from shared embeddings
- Excluded from leadership visibility unless explicitly shared through approved workflow
- Promoted only through intentional action

### 33.3 Relationship Knowledge Protection

Relationship Knowledge must be:

- Scoped to authorized Brand Ambassador and team permissions
- Protected from unrelated users
- Retrieved only for relevant workflows
- Logged when used
- Excluded from broad organizational learning unless anonymized, aggregated, or approved

### 33.4 Organizational Knowledge Protection

Organizational Knowledge may be broadly retrievable only when:

- Active
- Approved
- Properly scoped
- Not restricted
- Not superseded
- Not archived

### 33.5 Runtime Component Isolation

Agents must not access raw databases.

Browser runtimes must not access raw databases.

External workflows must not access raw databases.

All access must go through Knowledge Core and Context Manager interfaces.

---

## 34. Error Handling

The Knowledge Core must handle errors explicitly.

### 34.1 Error Categories

```typescript
type KnowledgeCoreErrorType =
  | "permission_denied"
  | "knowledge_not_found"
  | "invalid_lifecycle_transition"
  | "governance_violation"
  | "source_missing"
  | "embedding_failed"
  | "graph_sync_failed"
  | "database_unavailable"
  | "language_variant_missing"
  | "retrieval_failed"
  | "invalid_owner"
  | "invalid_visibility"
  | "promotion_not_authorized"
  | "private_knowledge_violation";
```

### 34.2 Failure Requirements

When an error occurs, the Knowledge Core must:

- Return a typed error
- Preserve a system audit event
- Avoid exposing private data in error messages
- Preserve correlation ID where available
- Allow retry where appropriate
- Prevent partial activation of invalid knowledge
- Mark sync jobs failed when applicable

### 34.3 Partial Failure Rules

If MongoDB write succeeds but Neo4j sync fails:

- Knowledge Object remains stored
- Graph status is marked failed
- Knowledge may not become active until required graph sync succeeds

If MongoDB write succeeds but Chroma embedding fails:

- Knowledge Object remains stored
- Embedding status is marked failed
- Retrieval may be limited to non-semantic retrieval
- Active organizational knowledge should not be activated until required embeddings succeed

If retrieval partially fails:

- Knowledge Core must return available governed results only if safe
- Result must include partial failure metadata
- Context Manager must decide whether packet assembly can proceed

---

## 35. Observability

The Knowledge Core must expose operational observability.

### 35.1 Required Metrics

The implementation must track:

- Knowledge objects created
- Knowledge candidates created
- Knowledge objects approved
- Knowledge objects activated
- Knowledge objects rejected
- Knowledge objects archived
- Personal journal objects created
- Promotion requests submitted
- Promotion requests approved
- Retrieval requests
- Retrieval latency
- Retrieval errors
- Permission denials
- Graph sync success rate
- Graph sync failure rate
- Embedding success rate
- Embedding failure rate
- Translation variant count
- Learning signals recorded
- Quality flags opened
- Review requests created

### 35.2 Required Logs

The implementation must log:

- Knowledge creation
- Source creation
- Lifecycle transition
- Governance transition
- Permission denial
- Retrieval completion
- Retrieval failure
- Embedding job result
- Graph sync result
- Learning signal recording
- Promotion request
- Quality flag creation

### 35.3 Required Health Checks

The Knowledge Core must expose health checks for:

- MongoDB connectivity
- Neo4j connectivity
- Chroma connectivity
- Embedding service availability
- Event bus availability
- GraphRAG service availability
- Pending job backlog
- Failed job backlog

---

## 36. Implementation Boundaries

### 36.1 Allowed Implementation Responsibilities

The Knowledge Core implementation may include:

- Database schemas
- Mongoose models
- Neo4j node and relationship sync
- Chroma collection management
- Knowledge service classes
- Retrieval service classes
- GraphRAG orchestration
- Permission filtering
- Lifecycle enforcement
- Governance state enforcement
- Audit logging
- Event publishing
- Event consumption
- Background sync jobs
- Embedding jobs
- Health checks

### 36.2 Disallowed Implementation Responsibilities

The Knowledge Core implementation must not include:

- User interface logic
- Agent prompt scripts
- Application-specific dashboards
- Steve conversation behavior
- Michael conversation behavior
- Ivory conversation behavior
- Browser audio transport details
- Telnyx internal voice handling
- PMV presentation behavior
- SMS campaign strategy
- Ringless voicemail campaign strategy
- Business compensation logic
- Application-specific onboarding pages

---

## 37. Service Structure for Codex Implementation

A recommended service layout is:

```text
/src/runtime/knowledge-core/
  index.ts

  models/
    KnowledgeObject.model.ts
    KnowledgeSource.model.ts
    KnowledgeVersion.model.ts
    KnowledgeAuditEvent.model.ts
    KnowledgeLanguageVariant.model.ts
    KnowledgeReviewRecord.model.ts
    KnowledgePermission.model.ts
    KnowledgeIngestionJob.model.ts
    KnowledgeEmbeddingJob.model.ts
    KnowledgeGraphSyncJob.model.ts
    KnowledgeRetrievalLog.model.ts
    KnowledgeLearningSignal.model.ts
    KnowledgePromotionRequest.model.ts
    KnowledgeQualityFlag.model.ts

  services/
    KnowledgeCoreWriteService.ts
    KnowledgeLifecycleService.ts
    KnowledgeRetrievalService.ts
    KnowledgeGraphService.ts
    KnowledgeEmbeddingService.ts
    GraphRAGService.ts
    KnowledgeLearningService.ts
    KnowledgePermissionService.ts
    KnowledgeAuditService.ts
    KnowledgeLanguageService.ts
    KnowledgeQualityService.ts

  repositories/
    KnowledgeObjectRepository.ts
    KnowledgeSourceRepository.ts
    KnowledgeVersionRepository.ts
    KnowledgeAuditRepository.ts
    KnowledgeReviewRepository.ts
    KnowledgeRetrievalRepository.ts
    KnowledgeLearningRepository.ts

  graph/
    Neo4jKnowledgeMapper.ts
    Neo4jRelationshipService.ts
    Neo4jGraphTraversalService.ts

  embeddings/
    ChromaCollectionManager.ts
    ChromaEmbeddingRepository.ts
    EmbeddingJobProcessor.ts

  graphrag/
    GraphRAGRetriever.ts
    GraphRAGRanker.ts
    GraphRAGExplanationBuilder.ts
    GraphRAGPermissionFilter.ts

  events/
    KnowledgeCoreEventPublisher.ts
    KnowledgeCoreEventConsumer.ts
    KnowledgeCoreEventTypes.ts

  permissions/
    KnowledgePermissionPolicy.ts
    PersonalKnowledgePolicy.ts
    OrganizationalKnowledgePolicy.ts
    RelationshipKnowledgePolicy.ts

  lifecycle/
    KnowledgeLifecyclePolicy.ts
    KnowledgeLifecycleTransitions.ts

  language/
    KnowledgeLanguagePolicy.ts
    TranslationVariantService.ts

  health/
    KnowledgeCoreHealthCheck.ts

  types/
    KnowledgeObject.types.ts
    KnowledgeSource.types.ts
    KnowledgeRetrieval.types.ts
    KnowledgeLifecycle.types.ts
    KnowledgeGraph.types.ts
    KnowledgeEvents.types.ts
```

This structure may be adapted by the implementation team as long as all required runtime responsibilities are satisfied.

---

## 38. Acceptance Criteria

The Knowledge Core Runtime is complete only when all acceptance criteria are satisfied.

### 38.1 Canonical Storage Acceptance Criteria

- MongoDB stores Knowledge Objects with required fields.
- MongoDB stores source records.
- MongoDB stores lifecycle status.
- MongoDB stores governance status.
- MongoDB stores ownership and visibility.
- MongoDB stores language metadata.
- MongoDB stores version history.
- MongoDB stores audit references.
- Required indexes exist.

### 38.2 Graph Acceptance Criteria

- Neo4j stores Knowledge Object nodes.
- Neo4j stores source nodes.
- Neo4j stores actor and entity nodes.
- Neo4j stores required relationships.
- Knowledge Objects are linked to owners, sources, domains, lifecycle, and governance state.
- Graph sync status is tracked.
- Graph traversal works for Context Manager retrieval.

### 38.3 Semantic Retrieval Acceptance Criteria

- Chroma stores embeddings for active organizational knowledge.
- Chroma stores personal embeddings in owner-scoped collections.
- English collections exist.
- Spanish collections exist.
- Retrieval can filter by language.
- Retrieval can support language fallback when allowed.
- Embedding status is tracked.

### 38.4 Lifecycle Acceptance Criteria

- Knowledge can move from captured to candidate.
- Candidate knowledge can move to under review.
- Reviewed knowledge can be approved or rejected.
- Approved knowledge can be activated.
- Active knowledge can be referenced.
- Active knowledge can be evaluated.
- Knowledge can be updated.
- Knowledge can be superseded.
- Knowledge can be archived.
- Invalid lifecycle transitions are blocked.

### 38.5 Personal Knowledge Acceptance Criteria

- Momentum Journal knowledge is private by default.
- Personal knowledge is owner-scoped.
- Personal knowledge is excluded from shared organizational retrieval.
- Personal knowledge is excluded from shared Chroma collections.
- Personal knowledge can be promoted only through intentional promotion request.
- Promotion request creates a Knowledge Candidate.
- Approved promoted knowledge creates a separate organizational Knowledge Object.
- Original journal entry remains private.

### 38.6 Organizational Knowledge Acceptance Criteria

- Organizational knowledge requires approval before active use.
- Active organizational knowledge is retrievable by Context Manager.
- Rejected organizational knowledge is not retrievable as guidance.
- Superseded organizational knowledge is excluded by default.
- Archived organizational knowledge is excluded by default.
- Organizational knowledge preserves source and approval trail.

### 38.7 Permission Acceptance Criteria

- Retrieval enforces actor identity.
- Retrieval enforces runtime component scope.
- Retrieval enforces Brand Ambassador scope.
- Retrieval enforces prospect scope.
- Retrieval enforces visibility.
- Retrieval enforces lifecycle status.
- Retrieval enforces governance status.
- Private knowledge cannot leak to unauthorized users or components.
- External workflows cannot access private Momentum Journal knowledge.

### 38.8 Bilingual Acceptance Criteria

- Every Knowledge Object has language metadata.
- English is supported.
- Spanish is supported.
- Language variants can be stored.
- Translation status can be tracked.
- Retrieval can request English.
- Retrieval can request Spanish.
- Fallback behavior is explicit.
- Draft translations are not treated as approved guidance.

### 38.9 GraphRAG Acceptance Criteria

- GraphRAG combines MongoDB canonical filtering, Chroma semantic retrieval, and Neo4j graph traversal.
- GraphRAG applies permission filters.
- GraphRAG applies governance filters.
- GraphRAG applies lifecycle filters.
- GraphRAG ranks results.
- GraphRAG returns source metadata.
- GraphRAG can explain retrieval when requested.
- GraphRAG does not override governance.

### 38.10 Learning Acceptance Criteria

- Learning signals can be recorded.
- Outcomes can be linked to Knowledge Objects.
- Quality flags can be created.
- Review requests can be triggered.
- Knowledge effectiveness can influence future review.
- Learning signals do not automatically become active organizational knowledge.

### 38.11 Audit Acceptance Criteria

- Creation is audited.
- Updates are audited.
- Lifecycle transitions are audited.
- Governance transitions are audited.
- Retrieval is audited.
- Promotion is audited.
- Approval is audited.
- Rejection is audited.
- Supersession is audited.
- Archive is audited.
- Permission denials are audited.

### 38.12 Runtime Boundary Acceptance Criteria

- Steve does not access databases directly.
- Michael does not access databases directly.
- Ivory does not access databases directly.
- Browser Voice Runtime does not access databases directly.
- Browser Text Runtime does not access databases directly.
- Context Manager retrieves through Knowledge Core interfaces.
- Internal browser voice does not use Telnyx.
- Telnyx is limited to external runtime workflows.

---

## 39. Relationship to Other Runtime Components

### 39.1 Relationship to Knowledge Ingestion Protocol

Knowledge Ingestion transforms raw sources into structured knowledge inputs.

The Knowledge Core persists, indexes, governs, and connects those inputs.

Knowledge Ingestion is responsible for acquisition and extraction.

The Knowledge Core is responsible for durable organizational memory.

### 39.2 Relationship to Context Manager

The Context Manager is the primary consumer of Knowledge Core retrieval.

The Knowledge Core returns governed knowledge results.

The Context Manager assembles Context Packets.

The Knowledge Core must not assemble the final Context Packet.

### 39.3 Relationship to Context Packet

The Context Packet contains selected contextual intelligence for a specific agent task.

Knowledge Core records may appear inside Context Packets only after Context Manager selection.

Knowledge Core retrieval metadata must support Context Packet traceability.

### 39.4 Relationship to Agent Runtime

Agents use Context Packets.

Agents do not directly query the Knowledge Core unless explicitly mediated by Context Manager services.

Agent Runtime produces conversations, actions, and outcomes that may become knowledge through ingestion.

### 39.5 Relationship to Steve Success

Steve contributes Success Knowledge.

Steve consumes Success Knowledge through Context Packets.

Steve does not own the Knowledge Core.

### 39.6 Relationship to Michael Magnificent

Michael contributes Training Knowledge.

Michael teaches Brand Ambassadors how to use the Momentum Journal.

Michael consumes Training Knowledge through Context Packets.

Michael may suggest promotion but may not auto-promote private journal knowledge.

### 39.7 Relationship to Ivory

Ivory contributes Relationship Knowledge.

Ivory consumes Relationship Knowledge through Context Packets.

Ivory guides relationship-centered action using governed context.

### 39.8 Relationship to Browser Voice Runtime

Browser Voice Runtime captures internal spoken interactions.

Browser Voice Runtime is internal.

Browser Voice Runtime does not use Telnyx.

Browser Voice Runtime may generate source records through Knowledge Ingestion.

### 39.9 Relationship to Browser Text Runtime

Browser Text Runtime captures internal text interactions.

Browser Text Runtime may generate source records through Knowledge Ingestion.

Browser Text Runtime consumes Context Packets through Agent Runtime.

### 39.10 Relationship to Learning Pipeline

The Learning Pipeline evaluates action and outcome data.

The Knowledge Core stores learning signals and connects them to knowledge.

The Learning Pipeline may request review or flag knowledge quality.

The Knowledge Core does not automatically convert learning signals into active organizational knowledge.

### 39.11 Relationship to Guided Action Runtime

Guided Action Runtime produces actions and outcomes.

The Knowledge Core stores guided action records and outcome-linked knowledge.

The Learning Pipeline evaluates whether guided action knowledge should influence future review.

### 39.12 Relationship to Agent Events

Agent Events provide runtime event records.

The Knowledge Core consumes relevant events and publishes knowledge events.

Events must preserve correlation and causation IDs.

### 39.13 Relationship to Implementation Layer

Implementation documents define application-specific workflows and interfaces.

The Knowledge Core provides runtime services that Implementation can call through approved interfaces.

Implementation must not bypass Knowledge Core rules.

---

## 40. Required Invariants

The following invariants must always hold.

1. Every Knowledge Object has an owner.
2. Every Knowledge Object has at least one source.
3. Every Knowledge Object has a lifecycle status.
4. Every Knowledge Object has a governance status.
5. Every Knowledge Object has language metadata.
6. Every Knowledge Object has visibility metadata.
7. Private Momentum Journal knowledge remains private unless intentionally promoted.
8. Promotion creates a new candidate and does not expose the original private journal entry.
9. Active organizational knowledge must be approved.
10. Rejected knowledge cannot be used as active guidance.
11. Superseded knowledge is excluded from normal retrieval.
12. Archived knowledge is excluded from normal retrieval.
13. Agents do not access raw databases.
14. Context Manager assembles Context Packets.
15. Knowledge Core retrieves and preserves knowledge.
16. GraphRAG cannot override permissions.
17. GraphRAG cannot override governance.
18. Telnyx is not part of internal browser voice runtime.
19. English and Spanish are supported.
20. Every retrieval used in a Context Packet is auditable.

---

## 41. Minimal Runtime Implementation Sequence

Codex should implement the Knowledge Core in the following dependency order.

### Step 1: Type Definitions

Implement all required TypeScript types for:

- Knowledge Object
- Source
- Lifecycle
- Governance
- Permissions
- Language variants
- Retrieval
- Graph
- Events
- Audit
- Learning signals

### Step 2: MongoDB Models

Implement Mongoose models for required collections.

Add required indexes.

### Step 3: Lifecycle Policy

Implement lifecycle transition validation.

Block invalid transitions.

### Step 4: Permission Policy

Implement permission checks.

Enforce private personal knowledge rules.

### Step 5: Source and Provenance Services

Implement source creation and provenance recording.

### Step 6: Knowledge Write Service

Implement Knowledge Object creation and update.

### Step 7: Audit Service

Implement audit event creation for all significant actions.

### Step 8: Neo4j Graph Sync

Implement graph node and relationship creation.

Track graph sync status.

### Step 9: Chroma Embedding Sync

Implement collection routing and embedding writes.

Track embedding status.

### Step 10: Retrieval Service

Implement governed retrieval from MongoDB, Chroma, and Neo4j.

### Step 11: GraphRAG Service

Implement combined retrieval, ranking, and explanation.

### Step 12: Learning Signal Service

Implement learning signal recording and outcome links.

### Step 13: Promotion Service

Implement Momentum Journal promotion path.

### Step 14: Event Publishing and Consumption

Implement required events.

### Step 15: Health Checks and Observability

Implement metrics, logs, and health checks.

### Step 16: Acceptance Test Suite

Implement tests for all acceptance criteria.

---

## 42. Testing Requirements

### 42.1 Unit Tests

Unit tests must cover:

- Knowledge Object validation
- Lifecycle transitions
- Permission checks
- Visibility rules
- Personal knowledge privacy
- Promotion request creation
- Governance status validation
- Language fallback rules
- Retrieval filtering
- Audit creation
- Error handling

### 42.2 Integration Tests

Integration tests must cover:

- MongoDB Knowledge Object persistence
- Neo4j graph sync
- Chroma embedding sync
- GraphRAG retrieval
- Context Manager retrieval simulation
- Learning signal recording
- Promotion to candidate flow
- Approval to active flow
- Supersession flow
- Archive flow

### 42.3 Security Tests

Security tests must prove:

- One Brand Ambassador cannot retrieve another Brand Ambassador's private journal knowledge.
- External runtime cannot retrieve Momentum Journal knowledge.
- Rejected knowledge is not returned as guidance.
- Superseded knowledge is excluded by default.
- Archived knowledge is excluded by default.
- Unauthorized agents cannot retrieve restricted domains.
- Permission-denied attempts are audited.

### 42.4 Bilingual Tests

Bilingual tests must prove:

- English knowledge can be stored.
- Spanish knowledge can be stored.
- English retrieval works.
- Spanish retrieval works.
- Language fallback is explicit.
- Draft translations are not returned as approved guidance.
- Spanish personal knowledge remains owner-scoped.

---

## 43. Completion Definition

The Knowledge Core Runtime is considered Version 1.0 complete when:

- All required models exist.
- All required services exist.
- All required lifecycle states are enforced.
- All required permissions are enforced.
- All required events are implemented.
- MongoDB, Neo4j, and Chroma are integrated.
- GraphRAG retrieves across all three stores.
- Personal knowledge privacy is enforced.
- Organizational knowledge activation is governed.
- English and Spanish are supported.
- Retrieval is auditable.
- Context Manager can retrieve governed knowledge.
- Learning Pipeline can attach learning signals.
- Acceptance criteria pass.
- Runtime boundaries are enforced.

---

## 44. Final Runtime Statement

The Knowledge Core is the organizational memory of Momentum Creation System V2.

It preserves what Momentum knows.

It protects what Brand Ambassadors own.

It connects what the organization learns.

It makes knowledge retrievable without allowing agents to bypass governance.

It allows Steve, Michael, and Ivory to guide Brand Ambassadors with contextual intelligence while remaining specialist agents.

It allows the organization to learn without allowing private personal knowledge to leak into organizational use.

It enables Momentum to become more valuable over time because the Knowledge Core becomes richer, more connected, more accurate, and more useful.

The Knowledge Core is the foundation of the Runtime Layer.

All runtime intelligence begins here.
