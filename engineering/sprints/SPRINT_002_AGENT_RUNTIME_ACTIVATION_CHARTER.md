# Sprint 002 - Agent Runtime Activation Charter

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Approval: Kevin L. Gardner approved Sprint 2 planning after Sprint 1 closeout

> **Supersession note (2026-07-02, ACR-0009):** this charter predates Kevin's
> approved retirement of the Gateway HTTP persistence fallback. Treat any older
> Gateway fallback language below as historical Sprint 2 planning context, not
> current architecture. Gateway is MCP/developer tooling; app runtime persistence
> is direct to the MCS stack.

## 1. Authorization

Sprint 1 - Platform Alignment is CLOSED / VERIFIED.

The v1.0 frozen architecture remains unchanged. This charter authorizes Sprint 2 planning only. It does not authorize implementation, production route activation, event persistence activation, reintroducing Universal Gateway as an app runtime dependency, ratified-document edits, or `.com` prospect-facing changes.

## 2. Sprint 2 Objective

Sprint 2 plans the activation path for the internal Team Magnificent agent runtime.

The objective is to define how Steve Success, Michael Magnificent, and Ivory will consume Context Packets, operate through the Agent Runtime boundary, emit runtime facts through approved event capture interfaces, surface Guided Actions, and capture outcomes without violating the Sprint 1 platform boundaries.

## 3. Approved Planning Scope

Sprint 2 planning may define:

- Steve Success Interview Agent runtime activation plan.
- Michael Magnificent Training Support Agent runtime activation plan.
- Ivory role clarification and boundary plan.
- Agent Runtime orchestration plan.
- Context Packet consumption by agents.
- Runtime Event capture for agent actions.
- Outcome capture.
- Guided Action integration.
- QA and governance gates for agent activation.

## 4. Hard Boundaries

Sprint 2 planning must preserve these rules:

- Do not modify ratified documents.
- Do not remove Gateway fallback.
- Do not modify `.com` prospect-facing surfaces.
- Do not mount `/api/runtime/*` without separate approval.
- Do not implement event persistence, outbox, replay, subscribers, or event API activation without separate approval.
- Do not let agents directly access MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, or Gateway fallback clients.
- Agents must consume Context Packets.
- Context Manager remains the only assembler of Context Packets.
- Candidate/review-only knowledge remains excluded by default.
- Browser Voice/Text remains `.team` only.
- Telnyx/PSTN/call-control remain excluded from internal browser voice/text runtime.

## 5. Foundation Inputs

Sprint 2 planning starts from the Sprint 1 verified foundation:

- S1.1 Shared Runtime Contracts - IMPLEMENTED / VERIFIED.
- S1.2 Backend Runtime Boundary Skeleton - IMPLEMENTED / VERIFIED.
- S1.3 Runtime Persistence Direct Adapter Migration - CLOSED / VERIFIED.
- S1.4 Runtime Event Foundation - IMPLEMENTED / VERIFIED.
- S1.5 Context Packet Foundation - IMPLEMENTED / VERIFIED.
- S1.6 Browser Voice/Text Foundation - IMPLEMENTED / VERIFIED.
- S1.7 QA Harness Scaffolding - IMPLEMENTED / VERIFIED.

Evidence of record:

- `engineering/sprints/SPRINT_001_STATUS_TRACKER.md`
- `engineering/reports/SPRINT_001_FINAL_CLOSEOUT_GOVERNANCE_RECORD.md`
- `engineering/reports/S1_4_RUNTIME_EVENT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_5_CONTEXT_PACKET_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_6_BROWSER_VOICE_TEXT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_7_QA_HARNESS_SCAFFOLDING_VERIFICATION.md`

## 6. Agent Activation Planning Workstreams

### S2.1 Steve Success Interview Agent

Plan the Steve Success runtime activation path for the non-scored Success Interview.

Planning must cover:

- session start and resume boundary;
- allowed interview objectives;
- Context Packet request shape;
- success-profile output shape;
- guardrails preventing scoring, ranking, prediction, or qualification claims;
- runtime event facts to capture;
- outcome capture points;
- Guided Action opportunities;
- EN/ES template requirements;
- `.team` browser text/voice interaction boundary.

### S2.2 Michael Magnificent Training Support Agent

Plan the Michael Magnificent runtime activation path for internal BA training support.

Planning must cover:

- training-support session states;
- Context Packet consumption;
- training progress and daily-success support boundaries;
- safe coaching response rules;
- runtime event facts to capture;
- outcome capture points;
- Guided Action suggestions;
- EN/ES template requirements;
- Browser Voice/Text usage inside `.team` only;
- Telnyx/PSTN exclusion for internal browser runtime.

### S2.3 Ivory Role Clarification And Boundary

Plan Ivory's runtime role without expanding into prohibited automation.

Planning must cover:

- Ivory's approved role as BA-facing relationship/context support;
- editable draft support only;
- no auto-send;
- no AI lead qualification;
- no automated prospecting;
- no direct store access;
- Context Packet inputs and exclusions;
- handoff boundaries to invitation workflows;
- runtime event facts and outcomes;
- Guided Action suggestions that remain BA-owned.

### S2.4 Agent Runtime Orchestration

Plan the orchestration layer that starts, resumes, advances, and completes agent sessions.

Planning must cover:

- agent registry usage;
- session identity and Team Magnificent scope;
- text, browser voice, and mixed modes;
- Context Packet request lifecycle;
- guarded agent turn execution;
- response validation;
- runtime event capture points;
- outcome capture;
- Guided Action generation and acceptance/decline flow;
- degraded and failed context behavior;
- no `/api/runtime/*` route mounting unless separately approved.

### S2.5 Context Packet Consumption

Plan how agents consume `context_packet.v1` without assembling context themselves.

Planning must cover:

- required packet fields per agent;
- allowed objectives by agent;
- missing-context behavior;
- degraded packet behavior;
- packet-local source/citation handling;
- exclusion of candidate/review-only knowledge by default;
- static and runtime checks proving agents do not import retrieval clients.

### S2.6 Runtime Event Capture

Plan non-persistent event capture points for agent actions unless separate approval authorizes persistence activation.

Planning must cover:

- event envelope creation through the S1.4 foundation;
- privacy-safe payload rules;
- correlation and causation strategy;
- idempotency key conventions;
- event facts for sessions, turns, context packets, guardrails, Guided Actions, outcomes, errors, and completions;
- explicit non-activation of event persistence, outbox, replay, subscribers, and event APIs.

### S2.7 Outcome Capture

Plan outcome capture for agent-assisted work.

Planning must cover:

- Steve interview outcomes;
- Michael training support outcomes;
- Ivory draft/action outcomes;
- BA-owned confirmation points;
- outcome-to-event relationship;
- outcome-to-learning relationship without automatic knowledge approval;
- privacy and Team Magnificent scope.

### S2.8 Guided Action Integration

Plan how agents suggest guided actions without taking unauthorized action.

Planning must cover:

- action suggestion contract;
- accepted, declined, completed, expired, and failed action states;
- BA-owned execution;
- no external send/call side effects;
- no prospect-facing automation;
- event facts and outcomes;
- UI handoff expectations for `.team`.

### S2.9 QA And Governance Gates

Plan the activation gates required before any Sprint 2 implementation.

Planning must include:

- `pnpm typecheck`;
- `pnpm build`;
- `pnpm --filter @momentum/server test`;
- static import checks proving agents do not import store clients or Gateway fallback clients;
- static checks proving Browser Voice/Text remains `.team` only;
- static checks proving Telnyx/PSTN/call-control are excluded from internal browser runtime;
- Context Packet schema/consumption tests;
- runtime event envelope tests without persistence activation;
- guardrail tests for Steve, Michael, and Ivory;
- `.com` exclusion verification;
- ratified-document no-change verification.

## 7. Explicit Non-Actions

This charter does not authorize:

- production code implementation;
- route mounting under `/api/runtime/*`;
- event persistence;
- outbox creation;
- replay jobs;
- subscribers;
- event API activation;
- Universal Gateway app-runtime dependency;
- direct agent access to MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, or Gateway clients;
- `.com` prospect-facing edits;
- ratified-document edits;
- Telnyx/PSTN/call-control integration for internal browser voice/text runtime;
- AI lead qualification;
- automated prospecting;
- automatic sending or calling;
- knowledge approval by agents or learning processes.

## 8. Planning Deliverables

Sprint 2 planning may produce additive engineering planning documents under `engineering/`.

Expected planning deliverables:

- Steve Success runtime activation plan.
- Michael Magnificent runtime activation plan.
- Ivory boundary and activation plan.
- Agent Runtime orchestration plan.
- Context Packet consumption plan.
- Runtime Event capture plan.
- Outcome capture plan.
- Guided Action integration plan.
- QA/governance gate plan.

Each deliverable must restate its non-actions and must not modify ratified architecture documents.

## 9. Stop Condition

Sprint 2 begins with this charter only.

The next step after this charter is planning document creation under the approved scope. Implementation, route activation, event persistence activation, Universal Gateway app-runtime dependency, and any `.com` or ratified-document change require separate Kevin approval.

No production code was changed by this charter.

No ratified documents were modified by this charter.

No `.com` prospect-facing surfaces were modified by this charter.
