# README.md

## Momentum Creation System V2

### Runtime Layer README

#### Version 1.0

---

## 1. Document Status

**Document Name:** Runtime Layer README
**System:** Momentum Creation System V2
**Layer:** Runtime Layer
**Version:** 1.0
**Status:** Ratified Runtime Source-of-Truth
**Repository Folder:** `/runtime`
**Phase:** Phase 2 — Knowledge → Runtime → Implementation
**Owner:** Momentum Creation System
**Team Scope:** Team Magnificent
**BA Scope:** Brand Ambassador inside Team Magnificent
**Implementation Target:** Codex / Engineering Runtime Implementation
**Bilingual Requirement:** English and Spanish
**Internal Runtime Scope:** Steve Success, Michael Magnificent, Ivory, Browser Voice, Browser Text
**External Runtime Scope:** Ringless Voicemail, SMS, future callback workflows
**Telnyx Scope:** External runtime only. Telnyx is not part of internal Browser Voice, Steve, Michael, or Ivory runtime.

---

## 2. Purpose

The `/runtime` folder defines the runtime architecture that implements the ratified Momentum Creation System V2 Foundation.

This folder is implementation architecture.

It is not constitutional architecture.

It does not redesign the platform.

It does not create new governance.

It does not replace the Constitution, Governance, Decision Framework, ACR System, AI Organization, Knowledge Layer, or Knowledge Sessions.

The Runtime Layer defines how Momentum operates after the Foundation has already been ratified.

The Runtime Layer answers:

```text
How does Momentum think?
How does Momentum acquire knowledge?
How does Momentum preserve knowledge?
How does Momentum assemble context?
How does Momentum guide Brand Ambassadors?
How does Momentum learn from outcomes?
How does Momentum improve organizational knowledge over time?
```

---

## 3. Runtime Philosophy

Momentum Creation System V2 is a Knowledge-Centric Platform.

The runtime exists to transform organizational knowledge into contextual intelligence.

The core operating loop is:

```text
Conversation
  ↓
Knowledge Acquisition
  ↓
Knowledge Core
  ↓
Knowledge Ingestion Protocol
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
Knowledge Growth
```

Agents do not become intelligent by independently remembering everything.

The Knowledge Core becomes richer.

The Context Manager delivers relevant intelligence.

Agents guide Brand Ambassadors.

Brand Ambassadors act.

Outcomes teach the system.

The organization learns.

---

## 4. Team Magnificent Runtime Scope

Momentum Creation System V2 is implemented for **Team Magnificent**, Kevin Gardner’s personal Team Magnificent organization.

Within this app, a Brand Ambassador is never treated as a floating user.

Every Brand Ambassador is scoped to Team Magnificent.

The runtime identity hierarchy is:

```text
Momentum Creation System V2
  ↓
Team Magnificent
  ↓
Brand Ambassador
  ↓
Session
  ↓
Agent Interaction
  ↓
Journal / Relationship / Guided Action / Outcome
```

### Required Team Identity Fields

All BA-scoped runtime records must support:

```ts
teamId: string;
teamKey: "team_magnificent";
teamName: "Team Magnificent";
baId: string;
```

### Identity Rule

```text
All BA-scoped records in this app must also be Team Magnificent scoped.
```

`baId` remains the correct Three International Brand Ambassador identity.

`teamId`, `teamKey`, and `teamName` define the Team Magnificent application boundary.

---

## 5. Runtime Documents

The `/runtime` folder contains the canonical Runtime Layer documents.

```text
/runtime/README.md
/runtime/KNOWLEDGE_CORE_RUNTIME.md
/runtime/KNOWLEDGE_INGESTION_PROTOCOL.md
/runtime/CONTEXT_MANAGER.md
/runtime/CONTEXT_PACKET_SCHEMA.md
/runtime/AGENT_RUNTIME.md
/runtime/AGENT_EVENT_MODEL.md
/runtime/BROWSER_VOICE_RUNTIME.md
/runtime/LEARNING_PIPELINE.md
```

Current operational routing for agents is summarized in `../AI_AGENT_PLAYBOOK.md`. That playbook is subordinate to the ratified runtime specifications and points agents to the correct source before implementation.

Implementation documents live outside `/runtime`.

If present, implementation specifications belong under `/implementation`.

Example:

```text
/implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP.md
```

Runtime documents define the operating architecture.

Implementation documents define application-specific build packages, workflows, routes, components, and engineering tasks.

---

## 6. Runtime Dependency Order

Runtime documents should be read and implemented in this order:

```text
1. KNOWLEDGE_CORE_RUNTIME.md
2. KNOWLEDGE_INGESTION_PROTOCOL.md
3. CONTEXT_MANAGER.md
4. CONTEXT_PACKET_SCHEMA.md
5. AGENT_RUNTIME.md
6. AGENT_EVENT_MODEL.md
7. BROWSER_VOICE_RUNTIME.md
8. LEARNING_PIPELINE.md
```

Guided Actions are part of the runtime architecture, but this folder does not contain a separate Guided Action document.

Guided Action responsibilities are defined across:

```text
AGENT_RUNTIME.md
AGENT_EVENT_MODEL.md
LEARNING_PIPELINE.md
```

If a future separate Guided Action Runtime document is added, it must be ratified as a Runtime Layer addition and must not conflict with the existing Agent Runtime, Event Model, or Learning Pipeline specifications.

---

## 7. Runtime Scope

The Runtime Layer defines how knowledge is:

```text
Captured
Stored
Indexed
Retrieved
Packetized
Delivered to agents
Used for guidance
Connected to action
Evaluated through outcomes
Improved through learning
```

Runtime includes:

- Knowledge Core
- Knowledge Ingestion
- Context Manager
- Context Packet
- Agent Runtime
- Agent Events
- Browser Voice Runtime
- Browser Text fallback
- Learning Pipeline
- Guided Action references
- Outcome learning references
- Runtime identity scope
- Bilingual operation
- Internal/external runtime boundary

Runtime does not define:

- Constitutional authority
- New governance
- Compensation logic
- Prospect earnings claims
- Product claims
- Medical claims
- External campaign strategy
- Corporate policy
- New platform philosophy
- Unratified agent behavior

---

## 8. Ratified Runtime Agents

Momentum Creation System V2 includes three internal runtime agents.

| Agent               | Runtime Responsibility                                                          | Knowledge Created      |
| ------------------- | ------------------------------------------------------------------------------- | ---------------------- |
| Steve Success       | Success interviews, lesson capture, momentum reflection, next-action planning   | Success Knowledge      |
| Michael Magnificent | Training support, onboarding support, system support, Momentum Journal teaching | Training Knowledge     |
| Ivory               | Relationship coaching, Opportunity Map support, editable invitation drafting    | Relationship Knowledge |

Knowledge belongs to Momentum.

Knowledge does not belong to individual agents.

Agents contribute knowledge through runtime workflows.

Agents do not approve knowledge.

Agents do not activate knowledge.

Agents do not bypass the Context Manager.

---

## 9. Internal Runtime Boundary

Internal runtime includes:

```text
Steve Success
Michael Magnificent
Ivory
Browser Voice
Browser Text
Context Packets
Momentum Journal
Agent Sessions
Guided Actions
Learning Signals
```

Internal agents use:

```text
Browser voice
Browser text fallback
Session transcript capture
Context Packets
Runtime events
Knowledge Ingestion
```

Internal agents do not use:

```text
Telnyx PSTN
Outbound phone calls
SMS sending
Ringless voicemail sending
External callback execution
Direct database access
Direct Chroma access
Direct Neo4j access
Direct GraphRAG retrieval
```

---

## 10. External Runtime Boundary

External runtime includes:

```text
Ringless voicemail
SMS
Future callback workflows
```

Telnyx is reserved for external runtime only.

External runtime may use Telnyx for:

```text
SMS
Ringless voicemail
Future callback workflows
```

Telnyx must not be used for:

```text
Steve internal coaching
Michael internal coaching
Ivory internal coaching
Browser Voice Runtime
Browser Text Runtime
Internal agent conversations
```

---

## 11. Bilingual Runtime Requirement

Momentum Runtime Version 1.0 supports:

```text
English
Spanish
```

English and Spanish are first-class runtime languages.

Every runtime component must preserve language metadata.

Every runtime document must support bilingual operation.

The following must support English and Spanish:

- Agent templates
- Context Packets
- Knowledge objects
- Knowledge candidates
- Journal entries
- Browser Voice transcripts
- Browser Text turns
- Runtime events
- Learning outcomes
- Learning signals
- Relationship context
- Guided actions

Language fallback must be explicit.

Machine translation must be marked.

Unreviewed translation must not be treated as approved organizational knowledge.

---

## 12. Momentum Journal Rule

Every Brand Ambassador owns a Momentum Journal.

The Momentum Journal is the Brand Ambassador’s private personal knowledge base.

Michael Magnificent teaches every Brand Ambassador how to use it.

The Momentum Journal may capture:

```text
Lessons learned
Ideas
Questions
Observations
Reflections
Scripts
Personal strategies
Voice notes
Resources
Personal reminders
```

Momentum Journal entries are private by default.

A private journal entry is not organizational knowledge.

A private journal entry does not become a Knowledge Candidate automatically.

A Brand Ambassador may intentionally select a journal entry for review.

The promotion path is:

```text
Momentum Journal Entry
  ↓
Brand Ambassador selects for review
  ↓
Knowledge Candidate
  ↓
Review
  ↓
Approval
  ↓
Organizational Knowledge
```

Agents may explain this pathway.

Agents may not promote private journal content automatically.

---

## 13. Runtime Architecture

The high-level runtime architecture is:

```text
Team Magnificent Brand Ambassador
  ↓
Browser Runtime
  ↓
Agent Runtime
  ↓
Context Manager
  ↓
Knowledge Core
  ↓
Learning Pipeline
```

Expanded runtime architecture:

```text
Browser Voice / Browser Text
  ↓
Agent Runtime
  ↓
Context Request
  ↓
Context Manager
  ↓
Knowledge Core Retrieval
    ↓
    MongoDB
    Chroma
    Neo4j
    GraphRAG
  ↓
Context Packet
  ↓
Agent Guidance
  ↓
Guided Action
  ↓
Outcome
  ↓
Learning Pipeline
  ↓
Knowledge Candidate / Review Signal
  ↓
Knowledge Core Evolution
```

---

## 14. Store Responsibilities

Momentum uses multiple stores because different forms of knowledge require different persistence models.

| Store              | Runtime Responsibility                                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MongoDB + Mongoose | Canonical operational source of truth: sessions, turns, journal entries, candidates, approved knowledge, events, outcomes, permissions, lifecycle state |
| Chroma             | Semantic retrieval for approved knowledge, review candidates, summaries, templates, bilingual search, and similarity matching                           |
| Neo4j              | Knowledge lineage, Team Magnificent membership, BA/session/journal relationships, outcomes, concepts, graph traversal, GraphRAG relationships           |
| GraphRAG           | Retrieval strategy combining graph relationships, semantic search, canonical filters, permissions, lifecycle state, language, and governance status     |

MongoDB is the canonical source of operational truth.

Neo4j is the relationship memory.

Chroma is the semantic memory.

GraphRAG is the retrieval orchestration strategy.

Agents do not access these stores directly.

P0 live-flag guardrail (2026-07-11): GraphRAG and Context Manager remain governed design targets, not broad live-enabled defaults. See `../docs/GRAPHRAG_CONTEXT_CANARY_CRITERIA.md` before enabling live flags.

---

## 15. Runtime Document Responsibilities

### 15.1 KNOWLEDGE_CORE_RUNTIME.md

Defines the organizational memory system.

Responsibilities include:

- Canonical knowledge objects
- Personal knowledge
- Organizational knowledge
- MongoDB, Neo4j, Chroma, and GraphRAG boundaries
- Knowledge lifecycle
- Source traceability
- Governance state
- Bilingual knowledge support
- Permission boundaries
- Knowledge retrieval interfaces

### 15.2 KNOWLEDGE_INGESTION_PROTOCOL.md

Defines how raw experience becomes structured candidate knowledge.

Responsibilities include:

- Capture
- Normalize
- Classify
- Segment
- Risk-check
- Dedupe
- Candidate creation
- Review-only indexing
- Graph lineage
- Journal promotion path
- Event emission

### 15.3 CONTEXT_MANAGER.md

Defines how contextual intelligence is assembled for agents.

Responsibilities include:

- Context requests
- Approved knowledge retrieval
- Private context retrieval
- Relationship context retrieval
- Template retrieval
- Context ranking
- Context budget
- Exclusions
- Retrieval audit
- Degraded packet behavior

### 15.4 CONTEXT_PACKET_SCHEMA.md

Defines the structured runtime payload delivered to agents.

Responsibilities include:

- Packet schema
- Tenant/team/BA/session/agent sections
- Runtime rules
- Guardrails
- Active templates
- Approved knowledge section
- Private context section
- Journal context section
- Relationship context section
- Guided actions
- Exclusions
- Retrieval audit
- Degraded state

### 15.5 AGENT_RUNTIME.md

Defines how Steve, Michael, and Ivory operate.

Responsibilities include:

- Agent registry
- Agent sessions
- Conversation turns
- Agent templates
- State machines
- Journal prompts
- Candidate proposal rules
- Guided Action creation
- Ivory editable invitation drafts
- Output guardrails
- Agent APIs

### 15.6 AGENT_EVENT_MODEL.md

Defines immutable runtime events.

Responsibilities include:

- Event envelope
- Event taxonomy
- Event storage
- Event idempotency
- Event outbox
- Subscribers
- Replay rules
- Privacy-safe payloads
- Correlation and causation IDs

### 15.7 BROWSER_VOICE_RUNTIME.md

Defines internal browser voice operation.

Responsibilities include:

- Browser voice state machine
- Web Speech API strategy
- SpeechSynthesis strategy
- Text fallback
- Transcript handling
- Microphone permission
- Accessibility
- Bilingual voice
- Browser Voice events
- No Telnyx internal voice path

### 15.8 LEARNING_PIPELINE.md

Defines how outcomes improve knowledge over time.

Responsibilities include:

- Outcomes
- Learning signals
- Pattern detection
- Candidate proposals
- Knowledge validation signals
- Knowledge weakening signals
- Knowledge refinement signals
- Knowledge supersession signals
- Learning metrics
- Bilingual parity
- Journal privacy protection
- Team Magnificent learning scope

---

## 16. Default Local Development Expectations

Expected local development commands:

```powershell
pnpm install
pnpm dev:server
pnpm dev:com
pnpm dev:team
pnpm typecheck
pnpm build
```

Expected local runtime URLs:

```text
server: http://localhost:7700
.com prospect app: http://localhost:7701
.team app: http://localhost:7702
```

These defaults may be adjusted by implementation configuration, but Runtime Layer documents assume a split between:

```text
server runtime
.com prospect experience
.team Team Magnificent Brand Ambassador app
```

The internal runtime agents operate inside the `.team` application.

---

## 17. Implementation Order

The recommended implementation order is:

```text
1. Agent Event Model and shared runtime types
2. MongoDB / Mongoose models
3. Team Magnificent identity scope
4. Knowledge Core service interfaces
5. Knowledge Ingestion Protocol
6. Context Packet Schema
7. Context Manager
8. Browser Voice Runtime
9. Agent Runtime
10. Michael Magnificent MVP with Momentum Journal teaching
11. Steve Success MVP
12. Ivory MVP
13. Learning Pipeline
14. Runtime QA and acceptance tests
```

Team Magnificent identity scope must be implemented before BA-scoped runtime records are finalized.

---

## 18. Required Runtime Identity Invariants

The following identity invariants must always hold:

```text
Every BA-scoped record is also Team Magnificent scoped.

Every internal agent session belongs to Team Magnificent.

Every Momentum Journal belongs to a BA inside Team Magnificent.

Every relationship context belongs to a BA inside Team Magnificent.

Every Guided Action belongs to a BA inside Team Magnificent.

Every Learning Outcome belongs to Team Magnificent and, where applicable, a BA.

Every Browser Voice transcript belongs to Team Magnificent and a BA.

Every Context Packet identifies tenant, team, BA, session, and agent scope.

No BA is treated as a floating user outside Team Magnificent.
```

---

## 19. Runtime Acceptance Gates

The Runtime Layer is complete when the following gates pass:

### 19.1 Agent Runtime Gate

- Steve sessions can be created.
- Michael sessions can be created.
- Ivory sessions can be created.
- Each agent receives a Context Packet.
- Each agent supports English and Spanish.
- Each agent supports Browser Voice and Browser Text fallback.
- Agent output guardrails run before responses are returned.

### 19.2 Knowledge Gate

- Knowledge Core stores canonical knowledge.
- Knowledge Ingestion captures raw runtime experience.
- Knowledge Candidates are review-only.
- Approved knowledge is separate from candidates.
- Personal journal knowledge remains private unless selected.
- Source traceability is preserved.

### 19.3 Context Gate

- Context Manager builds `context_packet.v1`.
- Agents do not retrieve knowledge directly.
- Approved knowledge retrieval works.
- Private context is BA-scoped.
- Relationship context is BA-owned and person-sensitive.
- Exclusions and retrieval audit are preserved.

### 19.4 Browser Runtime Gate

- Browser Voice support detection works.
- Text fallback always works.
- Microphone permission is requested only after BA action.
- Final transcripts submit to Agent Runtime.
- Agent responses display as text.
- Agent responses may be spoken through browser TTS.
- No Telnyx/PSTN code path is used for internal coaching.

### 19.5 Journal Gate

- Momentum Journal is private by default.
- Michael teaches Momentum Journal usage.
- Journal entries can be created.
- Selected journal entries can become Knowledge Candidates.
- Journal entries do not automatically become organizational knowledge.

### 19.6 Event Gate

- Runtime events are emitted consistently.
- Event schema `agent_event.v1` is enforced.
- Idempotency is enforced.
- Correlation IDs connect related runtime activity.
- Event payloads avoid unnecessary private text.
- Outbox supports asynchronous workers.

### 19.7 Learning Gate

- Outcomes can be recorded.
- Learning signals can be created.
- Learning signals link to events, sessions, candidates, knowledge, and actions.
- Pattern detection can propose candidates.
- Review remains separate from learning automation.
- Private journal entries are excluded unless selected.
- English and Spanish learning records are supported.

### 19.8 Team Magnificent Gate

- `teamId`, `teamKey`, and `teamName` exist where BA-scoped records exist.
- `teamKey` equals `team_magnificent`.
- All BA records are scoped to Team Magnificent.
- Runtime events preserve Team Magnificent scope in payload or metadata.
- Learning and knowledge records preserve Team Magnificent scope.

---

## 20. Runtime Guardrails

The Runtime Layer must enforce these guardrails:

```text
Agents do not approve knowledge.

Agents do not activate knowledge.

Agents do not bypass Context Manager.

Agents do not query MongoDB directly.

Agents do not query Neo4j directly.

Agents do not query Chroma directly.

Agents do not perform their own GraphRAG retrieval.

Knowledge Candidates are not approved knowledge.

Momentum Journal entries are private by default.

Private journal content is not organizational knowledge unless selected, reviewed, and approved.

Brand Ambassadors own relationship actions.

Ivory creates editable drafts only.

Ivory does not auto-send prospect outreach.

Browser Voice is internal.

Browser Voice does not use Telnyx.

Telnyx is external only.

Learning does not approve knowledge.

Learning does not optimize pressure or manipulation.

English and Spanish are first-class runtime languages.

All BA-scoped records are Team Magnificent scoped.
```

---

## 21. Final Runtime Statement

The Runtime Layer is the operating system of Momentum Creation System V2.

It transforms knowledge into context.

It transforms context into guidance.

It transforms guidance into Brand Ambassador-owned action.

It transforms action into outcomes.

It transforms outcomes into learning.

It transforms learning into better organizational knowledge.

The Runtime Layer exists for Team Magnificent.

Every Brand Ambassador in the app is a Team Magnificent Brand Ambassador.

Steve Success, Michael Magnificent, and Ivory guide Brand Ambassadors through browser voice and browser text.

The Knowledge Core preserves what Momentum knows.

The Knowledge Ingestion Protocol prepares what Momentum may learn.

The Context Manager selects what agents need.

The Context Packet carries contextual intelligence.

The Agent Runtime guides.

The Agent Event Model records.

The Browser Voice Runtime enables accessible internal voice interaction.

The Learning Pipeline evaluates outcomes.

Momentum improves because Team Magnificent learns from real experience while preserving privacy, governance, bilingual operation, and Brand Ambassador ownership.
