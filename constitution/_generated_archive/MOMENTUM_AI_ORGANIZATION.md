# Momentum AI Organization

Generated: 2026-06-26

<!-- PAGE 001 -->
# Page 1 - Authority and Source Basis

This handbook is grounded in the governing source set read on 2026-06-26.

- AGENTS.md
- docs/READ-ME-FIRST.md
- docs/AGENT-BRIEFING.md
- docs/locked-spec.md
- docs/build-registry.md
- docs/project-wireframe.md
- docs/graphrag-schema-contract.md
- docs/chat-registry-authority.md
- docs/handoff-contract.md
- MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md
- MOMENTUM_CREATION_SYSTEM_V2_PRODUCTION_VERSION.md
- AGENT_ARCHITECTURE.md
- AGENT_PROMPT_GOVERNANCE.md
- MULTI_DB_AGENT_LEARNING_GOVERNANCE.md
- SCHEMA_GOVERNANCE.md
- RECOMMENDATION_ENGINE_ARCHITECTURE.md
- PMV_ARCHITECTURE.md
- CRM_ARCHITECTURE.md
- COMMUNITY_ARCHITECTURE.md
- ORIENTATION_ARCHITECTURE.md
- LAUNCH_CENTER_ARCHITECTURE.md
- RESOURCE_CENTER_ARCHITECTURE.md
- EVENT_CENTER_ARCHITECTURE.md
- TRAINING_ARCHITECTURE.md
- HOLDING_TANK_ARCHITECTURE.md
- NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md
- MASTER_UX_IMPLEMENTATION_SPEC.md
- IMPLEMENTATION_TASKS.md
- PLATFORM_AUDIT.md
- graphify-out/GRAPH_REPORT.md

The governing precedence is: decision ledger, locked spec, design documents, build registry, git log, chat registry, then handoffs. The constitution created here does not override those sources. It organizes them into an AI software company operating model.

---

<!-- PAGE 002 -->
# Page 2 - Preamble

Momentum AI Organization exists to operate Momentum Creation System V2 as a human-centered AI software company. Its product is not automation for its own sake. Its product is transformation supported by clear software, governed agents, memory, training, community, and operational discipline.

The company exists under Kevin L. Gardner's human authority. AI agents assist, recommend, document, verify, retrieve, and coordinate. They do not replace human judgment, create hidden policy, score human worth, or turn relationships into pressure systems.

This constitution organizes the work of the company into departments, reporting structure, agent hierarchy, knowledge flow, permissions, escalation, and delivery responsibilities.

---

<!-- PAGE 003 -->
# Page 3 - Organizational North Star

The north star is simple: help real Brand Ambassadors share with real people they know, support those people respectfully, onboard new Brand Ambassadors clearly, and preserve community as the infrastructure that sustains momentum.

Every department must answer these questions before approving work:

- Does this create clarity?
- Does this help a human take the next right action?
- Does this protect trust?
- Does this preserve sponsor and relationship ownership?
- Does this comply with prospect-facing and BA-facing boundaries?
- Does this make memory more reliable, not noisier?
- Does this keep people at the center?

---

<!-- PAGE 004 -->
# Page 4 - Agency Structure Diagram

```mermaid
flowchart TD
  Kevin[Kevin L. Gardner - Human Authority] --> Exec[Executive Command]
  Exec --> Constitution[Constitution and Governance]
  Exec --> Program[Program Direction]
  Exec --> Ops[Operations and Live Systems]
  Program --> Architect[Architecture and Platform]
  Program --> Product[Product Surfaces]
  Program --> QA[QA and Verification]
  Program --> Docs[Documentation and Training]
  Architect --> Memory[Memory and Intelligence]
  Constitution --> Compliance[Compliance and Trust]
  Product --> Agents[Agent Operations]
  Agents --> Ivory[Ivory]
  Agents --> Steve[Steve]
  Agents --> Michael[Michael]
  Agents --> Daily[Daily Success Coach]
```

---

<!-- PAGE 005 -->
# Page 5 - Department Register

| Area | Owner | Reports To | Outputs |
|---|---|---|---|
| Executive Command | Executive Agent | Kevin L. Gardner | approved priorities, decision records, mission amendments, incident authority |
| Program Direction | Program Director Agent | Executive Command | release plans, work queues, dependency maps, handoff packets |
| Architecture and Platform | Architect Agent | Program Direction | architecture decisions, API contracts, state machines, integration plans |
| Constitution and Governance | Constitution Agent | Executive Command | governance rulings, policy updates, boundary reviews, source hierarchy decisions |
| Agent Operations | Agent Operations Lead | Program Direction | agent workflows, runtime events, recommendations, escalations |
| Memory and Intelligence | Knowledge Agent | Architecture and Platform | context packages, memory records, knowledge gap reports, lineage audits |
| Product Surfaces | Product Agent | Program Direction | surface specs, interaction flows, acceptance criteria, release notes |
| Compliance and Trust | Compliance Agent | Constitution and Governance | compliance reviews, blocked output reports, safe wording, risk escalations |
| QA and Verification | QA Agent | Program Direction | test plans, verification reports, bug findings, release gates |
| Research and Source Intelligence | Research Agent | Memory and Intelligence | research briefs, source packages, uncertainty flags, claim audits |
| Documentation and Training | Documentation Agent | Program Direction | handbooks, runbooks, training modules, diagram packs |
| Operations and Live Systems | Operations Agent | Executive Command | health reports, incident logs, live ops snapshots, operational checklists |

---

<!-- PAGE 006 -->
# Page 6 - Reporting Structure

Kevin L. Gardner is the human authority. Executive Command reports to Kevin. Constitution and Governance protects mission alignment. Program Direction coordinates delivery. Architecture and Platform protects system shape. Memory and Intelligence protects the data substrate. Product Surfaces owns user-facing execution. Agent Operations owns runtime agents. Compliance and Trust protects policy and relationships. QA and Verification protects release confidence. Documentation and Training turns truth into usable knowledge. Operations and Live Systems keeps the company awake.

No department may create its own private authority. Authority is explicit, logged, and reviewable.

---

<!-- PAGE 007 -->
# Page 7 - Company Operating Model

The company operates through six repeating loops:

- Strategy loop: Kevin directive -> Executive framing -> decision record -> program plan.
- Delivery loop: work leaf -> implementation -> verification -> documentation -> handoff.
- Memory loop: event -> canonical write -> semantic summary -> graph relationship -> retrieval package.
- Agent loop: trigger -> context -> recommendation -> human action -> outcome -> feedback.
- Compliance loop: draft -> rule check -> pass/warn/block -> safe alternative -> audit.
- Learning loop: observation -> recommendation -> outcome -> feedback -> governed pattern update.

---

<!-- PAGE 008 -->
# Page 8 - Memory Architecture

```mermaid
flowchart LR
  Event[Human or System Event] --> Mongo[Mongo Canonical Record]
  Mongo --> Chroma[Chroma Semantic Memory]
  Mongo --> Neo4j[Neo4j Relationship Graph]
  Mongo --> Audit[Audit Event]
  Chroma --> GraphRAG[GraphRAG Context Package]
  Neo4j --> GraphRAG
  Mongo --> GraphRAG
  GraphRAG --> Agent[Agent Recommendation]
  Agent --> Outcome[Outcome and Feedback]
  Outcome --> Mongo
```

---

<!-- PAGE 009 -->
# Page 9 - Agent Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Proposed
  Proposed --> ConstitutionalReview
  ConstitutionalReview --> ScopeDefined
  ScopeDefined --> DataImpactReview
  DataImpactReview --> PermissionReview
  PermissionReview --> PromptReview
  PromptReview --> Prototype
  Prototype --> LimitedRelease
  LimitedRelease --> FullRelease
  FullRelease --> Monitored
  Monitored --> Revised
  Revised --> PromptReview
  Monitored --> Retired
  Retired --> [*]
```

---

<!-- PAGE 010 -->
# Page 10 - Escalation Sequence

```mermaid
sequenceDiagram
  participant A as Agent
  participant C as Compliance
  participant G as Governance
  participant H as Human Owner
  A->>A: Detect uncertainty or boundary risk
  A->>C: Request review if content or policy risk
  C-->>A: pass, warn, block, or escalate
  A->>G: Submit governance escalation when authority is unclear
  G->>H: Route decision to human owner
  H-->>G: Decision or correction
  G-->>A: Bound action and memory update
```

---

<!-- PAGE 011 -->
# Page 11 - Executive Command Charter

## Purpose
Owns mission, constitutional alignment, capital allocation, final prioritization, and human authority.

## Owner
Executive Agent

## Reports To
Kevin L. Gardner

## Responsibilities
- Maintain the operating standards for Executive Command.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- approved priorities
- decision records
- mission amendments
- incident authority

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 012 -->
# Page 12 - Program Direction Charter

## Purpose
Turns mission into coordinated roadmaps, sequencing, dependencies, and delivery rhythm.

## Owner
Program Director Agent

## Reports To
Executive Command

## Responsibilities
- Maintain the operating standards for Program Direction.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- release plans
- work queues
- dependency maps
- handoff packets

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 013 -->
# Page 13 - Architecture and Platform Charter

## Purpose
Owns system structure, service boundaries, API contracts, persistence patterns, and scale readiness.

## Owner
Architect Agent

## Reports To
Program Direction

## Responsibilities
- Maintain the operating standards for Architecture and Platform.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- architecture decisions
- API contracts
- state machines
- integration plans

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 014 -->
# Page 14 - Constitution and Governance Charter

## Purpose
Owns mission alignment, source hierarchy, prompt governance, schema governance, and agent boundaries.

## Owner
Constitution Agent

## Reports To
Executive Command

## Responsibilities
- Maintain the operating standards for Constitution and Governance.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- governance rulings
- policy updates
- boundary reviews
- source hierarchy decisions

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 015 -->
# Page 15 - Agent Operations Charter

## Purpose
Runs Ivory, Michael, Steve, Daily Success Coach, and future operational agents under governed permissions.

## Owner
Agent Operations Lead

## Reports To
Program Direction

## Responsibilities
- Maintain the operating standards for Agent Operations.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- agent workflows
- runtime events
- recommendations
- escalations

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 016 -->
# Page 16 - Memory and Intelligence Charter

## Purpose
Maintains Mongo canonical state, Neo4j relationships, Chroma semantic memory, GraphRAG retrieval, and knowledge lineage.

## Owner
Knowledge Agent

## Reports To
Architecture and Platform

## Responsibilities
- Maintain the operating standards for Memory and Intelligence.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- context packages
- memory records
- knowledge gap reports
- lineage audits

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 017 -->
# Page 17 - Product Surfaces Charter

## Purpose
Owns .com, .team, /admin, prospect re-entry, cockpit, generator, PMV, CRM, and launch experiences.

## Owner
Product Agent

## Reports To
Program Direction

## Responsibilities
- Maintain the operating standards for Product Surfaces.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- surface specs
- interaction flows
- acceptance criteria
- release notes

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 018 -->
# Page 18 - Compliance and Trust Charter

## Purpose
Protects THREE policy alignment, prospect-facing restrictions, AI boundaries, privacy, and relationship trust.

## Owner
Compliance Agent

## Reports To
Constitution and Governance

## Responsibilities
- Maintain the operating standards for Compliance and Trust.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- compliance reviews
- blocked output reports
- safe wording
- risk escalations

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 019 -->
# Page 19 - QA and Verification Charter

## Purpose
Verifies behavior, visual quality, type safety, persistence completeness, and regression safety.

## Owner
QA Agent

## Reports To
Program Direction

## Responsibilities
- Maintain the operating standards for QA and Verification.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- test plans
- verification reports
- bug findings
- release gates

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 020 -->
# Page 20 - Research and Source Intelligence Charter

## Purpose
Retrieves external and internal source material, validates factual claims, and packages evidence.

## Owner
Research Agent

## Reports To
Memory and Intelligence

## Responsibilities
- Maintain the operating standards for Research and Source Intelligence.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- research briefs
- source packages
- uncertainty flags
- claim audits

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 021 -->
# Page 21 - Documentation and Training Charter

## Purpose
Maintains handbooks, training architecture, user guides, diagrams, and agent-operable documentation.

## Owner
Documentation Agent

## Reports To
Program Direction

## Responsibilities
- Maintain the operating standards for Documentation and Training.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- handbooks
- runbooks
- training modules
- diagram packs

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 022 -->
# Page 22 - Operations and Live Systems Charter

## Purpose
Runs live ops, gateway health, broadcast, events, reporting, audit logs, and operational readiness.

## Owner
Operations Agent

## Reports To
Executive Command

## Responsibilities
- Maintain the operating standards for Operations and Live Systems.
- Translate governing documents into executable procedures.
- Protect source hierarchy and auditability.
- Coordinate with dependent departments before changing shared behavior.
- Produce outputs that humans and agents can verify.

## Inputs
- Kevin directives
- locked spec
- decision ledger
- build registry
- wireframe leaves
- audit findings
- runtime events

## Outputs
- health reports
- incident logs
- live ops snapshots
- operational checklists

## Permissions
The department may read governance and operational records required for its mission. Writes must be auditable and, when persistent, must follow triple-stack or schema-enforced memory rules.

## Boundaries
The department may not override constitutional principles, create duplicate schemas, bypass compliance, hide uncertainty, or treat agent output as human approval.

---

<!-- PAGE 023 -->
# Page 23 - Human Authority

## Constitutional Rule
Human Authority exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Executive Command. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 024 -->
# Page 24 - Source Hierarchy

## Constitutional Rule
Source Hierarchy exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Program Direction. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 025 -->
# Page 25 - Department Interfaces

## Constitutional Rule
Department Interfaces exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Architecture and Platform. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 026 -->
# Page 26 - Decision Currency

## Constitutional Rule
Decision Currency exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Constitution and Governance. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 027 -->
# Page 27 - Work Queue Governance

## Constitutional Rule
Work Queue Governance exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Agent Operations. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 028 -->
# Page 28 - Release Governance

## Constitutional Rule
Release Governance exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Memory and Intelligence. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 029 -->
# Page 29 - Triple Stack Persistence

## Constitutional Rule
Triple Stack Persistence exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Product Surfaces. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 030 -->
# Page 30 - GraphRAG Evidence

## Constitutional Rule
GraphRAG Evidence exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Compliance and Trust. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 031 -->
# Page 31 - Prompt Governance

## Constitutional Rule
Prompt Governance exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: QA and Verification. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 032 -->
# Page 32 - Schema Governance

## Constitutional Rule
Schema Governance exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Research and Source Intelligence. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 033 -->
# Page 33 - Compliance Boundaries

## Constitutional Rule
Compliance Boundaries exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Documentation and Training. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 034 -->
# Page 34 - Prospect Surface Restrictions

## Constitutional Rule
Prospect Surface Restrictions exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Operations and Live Systems. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 035 -->
# Page 35 - BA Surface Responsibilities

## Constitutional Rule
BA Surface Responsibilities exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Executive Command. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 036 -->
# Page 36 - Admin Surface Responsibilities

## Constitutional Rule
Admin Surface Responsibilities exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Program Direction. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 037 -->
# Page 37 - Sponsor Immutability

## Constitutional Rule
Sponsor Immutability exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Architecture and Platform. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 038 -->
# Page 38 - Position Monotonicity

## Constitutional Rule
Position Monotonicity exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Constitution and Governance. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 039 -->
# Page 39 - Token Lifecycle

## Constitutional Rule
Token Lifecycle exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Agent Operations. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 040 -->
# Page 40 - Agent Recommendation Policy

## Constitutional Rule
Agent Recommendation Policy exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Memory and Intelligence. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 041 -->
# Page 41 - Audit Log Substrate

## Constitutional Rule
Audit Log Substrate exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Product Surfaces. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 042 -->
# Page 42 - Incident Governance

## Constitutional Rule
Incident Governance exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Compliance and Trust. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 043 -->
# Page 43 - Operational Metrics

## Constitutional Rule
Operational Metrics exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: QA and Verification. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 044 -->
# Page 44 - Visual Quality

## Constitutional Rule
Visual Quality exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Research and Source Intelligence. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 045 -->
# Page 45 - Documentation Discipline

## Constitutional Rule
Documentation Discipline exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Documentation and Training. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 046 -->
# Page 46 - Research Discipline

## Constitutional Rule
Research Discipline exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Operations and Live Systems. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 047 -->
# Page 47 - QA Gates

## Constitutional Rule
QA Gates exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Executive Command. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 048 -->
# Page 48 - Knowledge Flow

## Constitutional Rule
Knowledge Flow exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Program Direction. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 049 -->
# Page 49 - Escalation Flow

## Constitutional Rule
Escalation Flow exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Architecture and Platform. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 050 -->
# Page 50 - Collaboration Flow

## Constitutional Rule
Collaboration Flow exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Constitution and Governance. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 051 -->
# Page 51 - Memory Review

## Constitutional Rule
Memory Review exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Agent Operations. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 052 -->
# Page 52 - Future Expansion

## Constitutional Rule
Future Expansion exists to preserve clarity, trust, and momentum. It must be explicit enough that a future agent can operate without re-asking Kevin for documented facts.

## Department Ownership
Primary owner: Memory and Intelligence. Supporting owners: Constitution and Governance, QA and Verification, Documentation and Training.

## Inputs
- governing source
- canonical state
- agent event
- human correction
- runtime evidence

## Outputs
- decision
- recommendation
- audit entry
- handoff note
- documentation update

## Rules
- Do not proceed on memory alone when a source exists.
- Do not treat semantic similarity as proof.
- Do not create hidden or private state.
- Do not collapse human roles into agent authority.
- Do not weaken compliance to improve speed.
- Do not publish facts without source or uncertainty label.

## Escalation
Escalate to the owning department when source conflict, missing evidence, compliance risk, privacy risk, or authority ambiguity appears.

---

<!-- PAGE 053 -->
# Page 53 - Feature Intake Workflow

## Purpose
The Feature Intake workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 054 -->
# Page 54 - Governance Review Workflow

## Purpose
The Governance Review workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 055 -->
# Page 55 - Architecture Review Workflow

## Purpose
The Architecture Review workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 056 -->
# Page 56 - Prompt Review Workflow

## Purpose
The Prompt Review workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 057 -->
# Page 57 - Schema Review Workflow

## Purpose
The Schema Review workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 058 -->
# Page 58 - Implementation Dispatch Workflow

## Purpose
The Implementation Dispatch workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 059 -->
# Page 59 - Agent Runtime Invocation Workflow

## Purpose
The Agent Runtime Invocation workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 060 -->
# Page 60 - Recommendation Creation Workflow

## Purpose
The Recommendation Creation workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 061 -->
# Page 61 - Compliance Screening Workflow

## Purpose
The Compliance Screening workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 062 -->
# Page 62 - Memory Write Workflow

## Purpose
The Memory Write workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 063 -->
# Page 63 - QA Verification Workflow

## Purpose
The QA Verification workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 064 -->
# Page 64 - Release Readiness Workflow

## Purpose
The Release Readiness workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 065 -->
# Page 65 - Incident Response Workflow

## Purpose
The Incident Response workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 066 -->
# Page 66 - Handoff Creation Workflow

## Purpose
The Handoff Creation workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 067 -->
# Page 67 - Learning Note Capture Workflow

## Purpose
The Learning Note Capture workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 068 -->
# Page 68 - Documentation Update Workflow

## Purpose
The Documentation Update workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 069 -->
# Page 69 - Research Claim Validation Workflow

## Purpose
The Research Claim Validation workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 070 -->
# Page 70 - Admin Operational Review Workflow

## Purpose
The Admin Operational Review workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 071 -->
# Page 71 - Live Ops Monitoring Workflow

## Purpose
The Live Ops Monitoring workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 072 -->
# Page 72 - Future Agent Onboarding Workflow

## Purpose
The Future Agent Onboarding workflow defines how the organization turns intent into safe, verifiable action.

## Trigger
A human directive, system event, agent recommendation, governance finding, or operational signal.

## Steps
- Classify the request or event.
- Identify owner and supporting departments.
- Retrieve governing sources and canonical records.
- Check permissions, compliance, and privacy.
- Produce the smallest complete output that satisfies the mission.
- Verify with tests, readback, or source review.
- Record outcome and any unresolved risk.

## Inputs
- source documents
- entity records
- runtime logs
- human instructions
- agent context

## Outputs
- workflow result
- audit event
- recommendation
- handoff item
- documentation change

## State Machine
```mermaid
stateDiagram-v2
  [*] --> Received
  Received --> Classified
  Classified --> ContextLoaded
  ContextLoaded --> BoundaryChecked
  BoundaryChecked --> Executing
  Executing --> Verifying
  Verifying --> Complete
  Verifying --> Blocked
  Blocked --> Escalated
  Escalated --> Complete
  Complete --> [*]
```

---

<!-- PAGE 073 -->
# Page 73 - Department Permission Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Department Permission Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 074 -->
# Page 74 - Agent Permission Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Agent Permission Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 075 -->
# Page 75 - Memory Permission Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Memory Permission Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 076 -->
# Page 76 - Surface Boundary Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Surface Boundary Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 077 -->
# Page 77 - Compliance Boundary Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Compliance Boundary Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 078 -->
# Page 78 - Escalation Severity Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Escalation Severity Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 079 -->
# Page 79 - Release Gate Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Release Gate Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 080 -->
# Page 80 - Data Ownership Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Data Ownership Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 081 -->
# Page 81 - Prompt Ownership Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Prompt Ownership Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 082 -->
# Page 82 - Future Expansion Matrix

| Domain | Read | Write | Approve | Escalate |
|---|---|---|---|---|
| Governance | all governing sources | policies, findings | human owner required | source conflict |
| Product | scoped surface state | specs, acceptance criteria | product owner | user-impact risk |
| Memory | canonical and semantic records | governed memory only | schema owner | partial write |
| Compliance | drafts and rule sets | reviews, blocks | compliance owner | ambiguous policy |
| QA | diffs, logs, UI, docs | findings, gates | release owner | failed verification |
| Operations | health, logs, metrics | incident records | ops owner | outage or degraded service |

## Rule
The matrix named Future Expansion Matrix is deny-by-default. Permission expands only by explicit governance decision, not convenience.

---

<!-- PAGE 083 -->
# Page 83 - Future Department Creation

## Expansion Test
Before approving Future Department Creation, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 084 -->
# Page 84 - Future Agent Creation

## Expansion Test
Before approving Future Agent Creation, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 085 -->
# Page 85 - Future Surface Creation

## Expansion Test
Before approving Future Surface Creation, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 086 -->
# Page 86 - Future Memory Collection

## Expansion Test
Before approving Future Memory Collection, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 087 -->
# Page 87 - Future Prompt Slot

## Expansion Test
Before approving Future Prompt Slot, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 088 -->
# Page 88 - Future External Integration

## Expansion Test
Before approving Future External Integration, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 089 -->
# Page 89 - Future Compliance Rule

## Expansion Test
Before approving Future Compliance Rule, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 090 -->
# Page 90 - Future Reporting Surface

## Expansion Test
Before approving Future Reporting Surface, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 091 -->
# Page 91 - Future Tenant Expansion

## Expansion Test
Before approving Future Tenant Expansion, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 092 -->
# Page 92 - Future Governance Audit

## Expansion Test
Before approving Future Governance Audit, the organization must answer:

- What human momentum problem does this solve?
- Which existing department owns it?
- Which schemas are affected?
- Which agents need permission changes?
- Which prompts change?
- Which stores receive writes?
- Which audit events prove what happened?
- Which compliance rules apply?
- Which QA gates verify it?
- How is rollback handled?

## Required Output
An expansion packet containing mission, owner, scope, data model, API, prompt slot, testing plan, escalation plan, and retirement criteria.

---

<!-- PAGE 093 -->
# Page 93 - Operational Handbook Article 93

## Article Focus
This article applies Executive Command discipline to the full Momentum AI Organization.

## Principle
Owns mission, constitutional alignment, capital allocation, final prioritization, and human authority.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Executive Command]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 094 -->
# Page 94 - Operational Handbook Article 94

## Article Focus
This article applies Program Direction discipline to the full Momentum AI Organization.

## Principle
Turns mission into coordinated roadmaps, sequencing, dependencies, and delivery rhythm.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Program Direction]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 095 -->
# Page 95 - Operational Handbook Article 95

## Article Focus
This article applies Architecture and Platform discipline to the full Momentum AI Organization.

## Principle
Owns system structure, service boundaries, API contracts, persistence patterns, and scale readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Architecture and Platform]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 096 -->
# Page 96 - Operational Handbook Article 96

## Article Focus
This article applies Constitution and Governance discipline to the full Momentum AI Organization.

## Principle
Owns mission alignment, source hierarchy, prompt governance, schema governance, and agent boundaries.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Constitution and Governance]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 097 -->
# Page 97 - Operational Handbook Article 97

## Article Focus
This article applies Agent Operations discipline to the full Momentum AI Organization.

## Principle
Runs Ivory, Michael, Steve, Daily Success Coach, and future operational agents under governed permissions.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Agent Operations]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 098 -->
# Page 98 - Operational Handbook Article 98

## Article Focus
This article applies Memory and Intelligence discipline to the full Momentum AI Organization.

## Principle
Maintains Mongo canonical state, Neo4j relationships, Chroma semantic memory, GraphRAG retrieval, and knowledge lineage.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Memory and Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 099 -->
# Page 99 - Operational Handbook Article 99

## Article Focus
This article applies Product Surfaces discipline to the full Momentum AI Organization.

## Principle
Owns .com, .team, /admin, prospect re-entry, cockpit, generator, PMV, CRM, and launch experiences.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Product Surfaces]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 100 -->
# Page 100 - Operational Handbook Article 100

## Article Focus
This article applies Compliance and Trust discipline to the full Momentum AI Organization.

## Principle
Protects THREE policy alignment, prospect-facing restrictions, AI boundaries, privacy, and relationship trust.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Compliance and Trust]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 101 -->
# Page 101 - Operational Handbook Article 101

## Article Focus
This article applies QA and Verification discipline to the full Momentum AI Organization.

## Principle
Verifies behavior, visual quality, type safety, persistence completeness, and regression safety.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[QA and Verification]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 102 -->
# Page 102 - Operational Handbook Article 102

## Article Focus
This article applies Research and Source Intelligence discipline to the full Momentum AI Organization.

## Principle
Retrieves external and internal source material, validates factual claims, and packages evidence.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Research and Source Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 103 -->
# Page 103 - Operational Handbook Article 103

## Article Focus
This article applies Documentation and Training discipline to the full Momentum AI Organization.

## Principle
Maintains handbooks, training architecture, user guides, diagrams, and agent-operable documentation.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Documentation and Training]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 104 -->
# Page 104 - Operational Handbook Article 104

## Article Focus
This article applies Operations and Live Systems discipline to the full Momentum AI Organization.

## Principle
Runs live ops, gateway health, broadcast, events, reporting, audit logs, and operational readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Operations and Live Systems]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 105 -->
# Page 105 - Operational Handbook Article 105

## Article Focus
This article applies Executive Command discipline to the full Momentum AI Organization.

## Principle
Owns mission, constitutional alignment, capital allocation, final prioritization, and human authority.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Executive Command]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 106 -->
# Page 106 - Operational Handbook Article 106

## Article Focus
This article applies Program Direction discipline to the full Momentum AI Organization.

## Principle
Turns mission into coordinated roadmaps, sequencing, dependencies, and delivery rhythm.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Program Direction]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 107 -->
# Page 107 - Operational Handbook Article 107

## Article Focus
This article applies Architecture and Platform discipline to the full Momentum AI Organization.

## Principle
Owns system structure, service boundaries, API contracts, persistence patterns, and scale readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Architecture and Platform]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 108 -->
# Page 108 - Operational Handbook Article 108

## Article Focus
This article applies Constitution and Governance discipline to the full Momentum AI Organization.

## Principle
Owns mission alignment, source hierarchy, prompt governance, schema governance, and agent boundaries.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Constitution and Governance]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 109 -->
# Page 109 - Operational Handbook Article 109

## Article Focus
This article applies Agent Operations discipline to the full Momentum AI Organization.

## Principle
Runs Ivory, Michael, Steve, Daily Success Coach, and future operational agents under governed permissions.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Agent Operations]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 110 -->
# Page 110 - Operational Handbook Article 110

## Article Focus
This article applies Memory and Intelligence discipline to the full Momentum AI Organization.

## Principle
Maintains Mongo canonical state, Neo4j relationships, Chroma semantic memory, GraphRAG retrieval, and knowledge lineage.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Memory and Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 111 -->
# Page 111 - Operational Handbook Article 111

## Article Focus
This article applies Product Surfaces discipline to the full Momentum AI Organization.

## Principle
Owns .com, .team, /admin, prospect re-entry, cockpit, generator, PMV, CRM, and launch experiences.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Product Surfaces]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 112 -->
# Page 112 - Operational Handbook Article 112

## Article Focus
This article applies Compliance and Trust discipline to the full Momentum AI Organization.

## Principle
Protects THREE policy alignment, prospect-facing restrictions, AI boundaries, privacy, and relationship trust.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Compliance and Trust]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 113 -->
# Page 113 - Operational Handbook Article 113

## Article Focus
This article applies QA and Verification discipline to the full Momentum AI Organization.

## Principle
Verifies behavior, visual quality, type safety, persistence completeness, and regression safety.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[QA and Verification]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 114 -->
# Page 114 - Operational Handbook Article 114

## Article Focus
This article applies Research and Source Intelligence discipline to the full Momentum AI Organization.

## Principle
Retrieves external and internal source material, validates factual claims, and packages evidence.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Research and Source Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 115 -->
# Page 115 - Operational Handbook Article 115

## Article Focus
This article applies Documentation and Training discipline to the full Momentum AI Organization.

## Principle
Maintains handbooks, training architecture, user guides, diagrams, and agent-operable documentation.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Documentation and Training]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 116 -->
# Page 116 - Operational Handbook Article 116

## Article Focus
This article applies Operations and Live Systems discipline to the full Momentum AI Organization.

## Principle
Runs live ops, gateway health, broadcast, events, reporting, audit logs, and operational readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Operations and Live Systems]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 117 -->
# Page 117 - Operational Handbook Article 117

## Article Focus
This article applies Executive Command discipline to the full Momentum AI Organization.

## Principle
Owns mission, constitutional alignment, capital allocation, final prioritization, and human authority.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Executive Command]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 118 -->
# Page 118 - Operational Handbook Article 118

## Article Focus
This article applies Program Direction discipline to the full Momentum AI Organization.

## Principle
Turns mission into coordinated roadmaps, sequencing, dependencies, and delivery rhythm.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Program Direction]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 119 -->
# Page 119 - Operational Handbook Article 119

## Article Focus
This article applies Architecture and Platform discipline to the full Momentum AI Organization.

## Principle
Owns system structure, service boundaries, API contracts, persistence patterns, and scale readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Architecture and Platform]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 120 -->
# Page 120 - Operational Handbook Article 120

## Article Focus
This article applies Constitution and Governance discipline to the full Momentum AI Organization.

## Principle
Owns mission alignment, source hierarchy, prompt governance, schema governance, and agent boundaries.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Constitution and Governance]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 121 -->
# Page 121 - Operational Handbook Article 121

## Article Focus
This article applies Agent Operations discipline to the full Momentum AI Organization.

## Principle
Runs Ivory, Michael, Steve, Daily Success Coach, and future operational agents under governed permissions.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Agent Operations]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 122 -->
# Page 122 - Operational Handbook Article 122

## Article Focus
This article applies Memory and Intelligence discipline to the full Momentum AI Organization.

## Principle
Maintains Mongo canonical state, Neo4j relationships, Chroma semantic memory, GraphRAG retrieval, and knowledge lineage.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Memory and Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 123 -->
# Page 123 - Operational Handbook Article 123

## Article Focus
This article applies Product Surfaces discipline to the full Momentum AI Organization.

## Principle
Owns .com, .team, /admin, prospect re-entry, cockpit, generator, PMV, CRM, and launch experiences.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Product Surfaces]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 124 -->
# Page 124 - Operational Handbook Article 124

## Article Focus
This article applies Compliance and Trust discipline to the full Momentum AI Organization.

## Principle
Protects THREE policy alignment, prospect-facing restrictions, AI boundaries, privacy, and relationship trust.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Compliance and Trust]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 125 -->
# Page 125 - Operational Handbook Article 125

## Article Focus
This article applies QA and Verification discipline to the full Momentum AI Organization.

## Principle
Verifies behavior, visual quality, type safety, persistence completeness, and regression safety.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[QA and Verification]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 126 -->
# Page 126 - Operational Handbook Article 126

## Article Focus
This article applies Research and Source Intelligence discipline to the full Momentum AI Organization.

## Principle
Retrieves external and internal source material, validates factual claims, and packages evidence.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Research and Source Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 127 -->
# Page 127 - Operational Handbook Article 127

## Article Focus
This article applies Documentation and Training discipline to the full Momentum AI Organization.

## Principle
Maintains handbooks, training architecture, user guides, diagrams, and agent-operable documentation.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Documentation and Training]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 128 -->
# Page 128 - Operational Handbook Article 128

## Article Focus
This article applies Operations and Live Systems discipline to the full Momentum AI Organization.

## Principle
Runs live ops, gateway health, broadcast, events, reporting, audit logs, and operational readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Operations and Live Systems]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 129 -->
# Page 129 - Operational Handbook Article 129

## Article Focus
This article applies Executive Command discipline to the full Momentum AI Organization.

## Principle
Owns mission, constitutional alignment, capital allocation, final prioritization, and human authority.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Executive Command]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 130 -->
# Page 130 - Operational Handbook Article 130

## Article Focus
This article applies Program Direction discipline to the full Momentum AI Organization.

## Principle
Turns mission into coordinated roadmaps, sequencing, dependencies, and delivery rhythm.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Program Direction]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 131 -->
# Page 131 - Operational Handbook Article 131

## Article Focus
This article applies Architecture and Platform discipline to the full Momentum AI Organization.

## Principle
Owns system structure, service boundaries, API contracts, persistence patterns, and scale readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Architecture and Platform]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 132 -->
# Page 132 - Operational Handbook Article 132

## Article Focus
This article applies Constitution and Governance discipline to the full Momentum AI Organization.

## Principle
Owns mission alignment, source hierarchy, prompt governance, schema governance, and agent boundaries.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Constitution and Governance]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 133 -->
# Page 133 - Operational Handbook Article 133

## Article Focus
This article applies Agent Operations discipline to the full Momentum AI Organization.

## Principle
Runs Ivory, Michael, Steve, Daily Success Coach, and future operational agents under governed permissions.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Agent Operations]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 134 -->
# Page 134 - Operational Handbook Article 134

## Article Focus
This article applies Memory and Intelligence discipline to the full Momentum AI Organization.

## Principle
Maintains Mongo canonical state, Neo4j relationships, Chroma semantic memory, GraphRAG retrieval, and knowledge lineage.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Memory and Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 135 -->
# Page 135 - Operational Handbook Article 135

## Article Focus
This article applies Product Surfaces discipline to the full Momentum AI Organization.

## Principle
Owns .com, .team, /admin, prospect re-entry, cockpit, generator, PMV, CRM, and launch experiences.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Product Surfaces]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 136 -->
# Page 136 - Operational Handbook Article 136

## Article Focus
This article applies Compliance and Trust discipline to the full Momentum AI Organization.

## Principle
Protects THREE policy alignment, prospect-facing restrictions, AI boundaries, privacy, and relationship trust.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Compliance and Trust]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 137 -->
# Page 137 - Operational Handbook Article 137

## Article Focus
This article applies QA and Verification discipline to the full Momentum AI Organization.

## Principle
Verifies behavior, visual quality, type safety, persistence completeness, and regression safety.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[QA and Verification]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 138 -->
# Page 138 - Operational Handbook Article 138

## Article Focus
This article applies Research and Source Intelligence discipline to the full Momentum AI Organization.

## Principle
Retrieves external and internal source material, validates factual claims, and packages evidence.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Research and Source Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 139 -->
# Page 139 - Operational Handbook Article 139

## Article Focus
This article applies Documentation and Training discipline to the full Momentum AI Organization.

## Principle
Maintains handbooks, training architecture, user guides, diagrams, and agent-operable documentation.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Documentation and Training]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 140 -->
# Page 140 - Operational Handbook Article 140

## Article Focus
This article applies Operations and Live Systems discipline to the full Momentum AI Organization.

## Principle
Runs live ops, gateway health, broadcast, events, reporting, audit logs, and operational readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Operations and Live Systems]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 141 -->
# Page 141 - Operational Handbook Article 141

## Article Focus
This article applies Executive Command discipline to the full Momentum AI Organization.

## Principle
Owns mission, constitutional alignment, capital allocation, final prioritization, and human authority.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Executive Command]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 142 -->
# Page 142 - Operational Handbook Article 142

## Article Focus
This article applies Program Direction discipline to the full Momentum AI Organization.

## Principle
Turns mission into coordinated roadmaps, sequencing, dependencies, and delivery rhythm.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Program Direction]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 143 -->
# Page 143 - Operational Handbook Article 143

## Article Focus
This article applies Architecture and Platform discipline to the full Momentum AI Organization.

## Principle
Owns system structure, service boundaries, API contracts, persistence patterns, and scale readiness.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Architecture and Platform]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 144 -->
# Page 144 - Operational Handbook Article 144

## Article Focus
This article applies Constitution and Governance discipline to the full Momentum AI Organization.

## Principle
Owns mission alignment, source hierarchy, prompt governance, schema governance, and agent boundaries.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Constitution and Governance]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 145 -->
# Page 145 - Operational Handbook Article 145

## Article Focus
This article applies Agent Operations discipline to the full Momentum AI Organization.

## Principle
Runs Ivory, Michael, Steve, Daily Success Coach, and future operational agents under governed permissions.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Agent Operations]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 146 -->
# Page 146 - Operational Handbook Article 146

## Article Focus
This article applies Memory and Intelligence discipline to the full Momentum AI Organization.

## Principle
Maintains Mongo canonical state, Neo4j relationships, Chroma semantic memory, GraphRAG retrieval, and knowledge lineage.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Memory and Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 147 -->
# Page 147 - Operational Handbook Article 147

## Article Focus
This article applies Product Surfaces discipline to the full Momentum AI Organization.

## Principle
Owns .com, .team, /admin, prospect re-entry, cockpit, generator, PMV, CRM, and launch experiences.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Product Surfaces]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 148 -->
# Page 148 - Operational Handbook Article 148

## Article Focus
This article applies Compliance and Trust discipline to the full Momentum AI Organization.

## Principle
Protects THREE policy alignment, prospect-facing restrictions, AI boundaries, privacy, and relationship trust.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Compliance and Trust]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 149 -->
# Page 149 - Operational Handbook Article 149

## Article Focus
This article applies QA and Verification discipline to the full Momentum AI Organization.

## Principle
Verifies behavior, visual quality, type safety, persistence completeness, and regression safety.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[QA and Verification]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---

<!-- PAGE 150 -->
# Page 150 - Operational Handbook Article 150

## Article Focus
This article applies Research and Source Intelligence discipline to the full Momentum AI Organization.

## Principle
Retrieves external and internal source material, validates factual claims, and packages evidence.

## Standing Responsibilities
- Protect human authority.
- Use the source hierarchy before acting.
- Preserve compliance and relationship trust.
- Keep memory traceable across Mongo, Neo4j, and Chroma.
- Escalate ambiguity instead of inventing certainty.
- Document decisions where future agents will look.
- Verify critical writes and release gates.

## Inputs
- Kevin directive
- decision ledger
- locked spec
- project wireframe
- runtime evidence
- human correction

## Outputs
- actionable decision
- verified artifact
- audit record
- agent-ready documentation
- handoff note

## Interaction Diagram
```mermaid
flowchart LR
  Human[Human Direction] --> Department[Research and Source Intelligence]
  Department --> Sources[Governed Sources]
  Sources --> Work[Scoped Work]
  Work --> Verify[Verification]
  Verify --> Memory[Memory and Audit]
  Memory --> Handoff[Handoff and Future Retrieval]
```

## Boundary
No article in this handbook grants authority to bypass Kevin, the locked spec, compliance posture, sponsor immutability, triple-stack requirements, or auditability.

---
