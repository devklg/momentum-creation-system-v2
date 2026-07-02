# Sprint 002 - Multi-Agent Planning Workplan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Coordinator: Sprint 2 Multi-Agent Planning Coordinator
- Charter: `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`

> **Supersession note (2026-07-02, ACR-0009):** this planning snapshot predates
> Kevin's approved retirement of the Gateway HTTP persistence fallback. Treat any
> older Gateway fallback language below as historical Sprint 2 planning context,
> not current architecture. Gateway is MCP/developer tooling; app runtime
> persistence is direct to the MCS stack.

## 1. Purpose

This workplan coordinates parallel planning lanes for Sprint 2 - Agent Runtime Activation.

Sprint 1 - Platform Alignment is CLOSED / VERIFIED. Sprint 2 is approved for planning only. The purpose of this document is to assign planning lanes, define lane outputs, identify dependencies, and preserve the frozen v1.0 architecture boundaries before any implementation work begins.

## 2. Global Rules For All Lanes

Every planning lane must obey these rules:

- Planning only.
- Do not modify ratified documents.
- Do not modify production code.
- Do not remove Gateway fallback.
- Do not modify `.com` prospect-facing surfaces.
- Do not mount `/api/runtime/*`.
- Do not implement event persistence, outbox, replay, subscribers, or event API activation.
- Do not let agents directly access MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, or Gateway fallback clients.
- Agents must consume Context Packets only.
- Context Manager remains the only Context Packet assembler.
- Candidate/review-only knowledge remains excluded by default.
- Browser Voice/Text remains `.team` only.
- Telnyx/PSTN/call-control remain excluded from internal browser voice/text runtime.

## 3. Coordination Model

Sprint 2 planning runs in parallel lanes with one integration pass at the end.

Each lane produces one additive planning artifact under `engineering/plans/` or `engineering/reports/`. Each artifact must include:

- lane objective;
- foundation inputs read;
- proposed activation boundary;
- Context Packet assumptions;
- Runtime Event capture assumptions;
- Guided Action and outcome assumptions where relevant;
- QA expectations;
- explicit non-actions;
- dependencies on other lanes;
- unresolved questions, if any.

No lane may implement code, mount routes, activate persistence, or edit ratified documents.

## 4. Parallel Planning Lanes

### Lane 1 - Steve Success Interview Agent Runtime Activation

Planning owner role: Steve Success Runtime Planning Agent.

Mission: define how Steve Success activates as a non-scored Success Interview runtime agent.

Inputs:

- Sprint 2 charter.
- Sprint 1 closeout governance record.
- S1.4 Runtime Event Foundation verification.
- S1.5 Context Packet Foundation verification.
- S1.6 Browser Voice/Text Foundation verification.
- Existing Steve domain code, read-only.

Required planning output:

- `engineering/plans/S2_STEVE_SUCCESS_RUNTIME_ACTIVATION_PLAN.md`

Plan must cover:

- session start, resume, pause, completion, and cancellation;
- allowed Success Interview objectives;
- Context Packet request requirements;
- output shape for a non-scored Success Profile;
- guardrails preventing scoring, ranking, prediction, qualification, income claims, or placement promises;
- Browser Voice/Text and text-only interaction modes inside `.team`;
- EN/ES template requirements;
- Runtime Event facts to capture without persistence activation;
- outcome capture points;
- Guided Action suggestions that remain BA-owned;
- QA gates for Steve activation.

Hard non-actions:

- no scoring;
- no BA qualification;
- no direct knowledge/store access;
- no auto-enrollment or THREE authority claims;
- no `.com` exposure.

### Lane 2 - Michael Magnificent Training Support Agent Runtime Activation

Planning owner role: Michael Training Runtime Planning Agent.

Mission: define how Michael Magnificent activates as an internal BA training support agent.

Inputs:

- Sprint 2 charter.
- S1.5 Context Packet Foundation verification.
- S1.6 Browser Voice/Text Foundation verification.
- S1.7 QA Harness verification.
- Existing Michael training/support code, read-only.

Required planning output:

- `engineering/plans/S2_MICHAEL_MAGNIFICENT_RUNTIME_ACTIVATION_PLAN.md`

Plan must cover:

- training-support session states;
- Context Packet request requirements;
- daily-success support boundary;
- coaching response guardrails;
- Browser Voice/Text `.team` usage;
- mandatory text fallback;
- EN/ES template requirements;
- Runtime Event facts to capture without persistence activation;
- training outcome capture;
- Guided Action suggestions;
- Telnyx/PSTN/call-control exclusion for internal browser runtime;
- QA gates for Michael activation.

Hard non-actions:

- no internal Telnyx/PSTN/call-control;
- no direct store access;
- no prospect-facing AI language;
- no `.com` changes.

### Lane 3 - Ivory Role Clarification And Runtime Boundary

Planning owner role: Ivory Boundary Planning Agent.

Mission: clarify Ivory's runtime role and boundaries before activation planning proceeds.

Inputs:

- Sprint 2 charter.
- compliance rules for Team Magnificent / THREE International.
- existing Ivory and invitation-flow references, read-only.
- S1.5 Context Packet Foundation verification.

Required planning output:

- `engineering/plans/S2_IVORY_ROLE_AND_RUNTIME_BOUNDARY_PLAN.md`

Plan must cover:

- Ivory's approved BA-facing role;
- relationship/context support boundary;
- editable draft support only;
- no auto-send;
- no AI lead qualification;
- no automated prospecting;
- no direct store/GraphRAG/adapter/Gateway client access;
- Context Packet inputs and exclusions;
- candidate/review-only knowledge exclusion;
- handoff boundary to invitation workflows;
- Runtime Event facts to capture without persistence activation;
- BA-owned Guided Action suggestions;
- outcome capture;
- QA gates for Ivory activation.

Hard non-actions:

- no automatic prospect selection;
- no automated outreach;
- no sending;
- no calling;
- no prospect scoring;
- no `.com` exposure.

### Lane 4 - Agent Runtime Orchestration

Planning owner role: Agent Runtime Orchestration Planning Agent.

Mission: define the orchestration layer that coordinates agent sessions without activating routes or behavior.

Inputs:

- Sprint 2 charter.
- S1.1 Shared Runtime Contracts verification.
- S1.2 Backend Runtime Boundary verification.
- S1.4 Runtime Event Foundation verification.
- S1.5 Context Packet Foundation verification.
- lane assumptions from Steve, Michael, and Ivory.

Required planning output:

- `engineering/plans/S2_AGENT_RUNTIME_ORCHESTRATION_PLAN.md`

Plan must cover:

- agent registry usage;
- session identity and Team Magnificent scope;
- session lifecycle;
- turn lifecycle;
- mode handling for browser text, browser voice, and mixed mode;
- Context Packet request lifecycle;
- response validation and guardrail boundary;
- Runtime Event capture points without persistence activation;
- outcome and Guided Action coordination;
- degraded and failed context behavior;
- no `/api/runtime/*` route mounting without separate approval.

Hard non-actions:

- no route mounting;
- no production behavior activation;
- no event persistence activation;
- no direct agent store access.

### Lane 5 - Context Packet Consumption By Agents

Planning owner role: Context Packet Consumption Planning Agent.

Mission: define how every Sprint 2 agent consumes `context_packet.v1` without assembling context directly.

Inputs:

- Sprint 2 charter.
- S1.5 Context Packet Foundation verification.
- Steve, Michael, Ivory lane assumptions.
- Agent Runtime orchestration lane assumptions.

Required planning output:

- `engineering/plans/S2_CONTEXT_PACKET_CONSUMPTION_PLAN.md`

Plan must cover:

- required packet fields by agent;
- allowed objective list by agent;
- packet validation before agent use;
- missing-context behavior;
- degraded packet behavior;
- failed packet behavior;
- packet-local source/citation usage;
- candidate/review-only exclusion by default;
- request-for-refresh behavior;
- static checks proving agents do not import MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, or Gateway fallback clients.

Hard non-actions:

- no Context Packet assembly outside Context Manager;
- no direct retrieval by agents;
- no raw database identifiers exposed to agent prompts except approved packet-local references.

### Lane 6 - Runtime Event Capture For Agent Actions

Planning owner role: Runtime Event Capture Planning Agent.

Mission: define event capture points and envelope usage for agent actions without activating persistence, outbox, replay, subscribers, or event APIs.

Inputs:

- Sprint 2 charter.
- S1.4 Runtime Event Foundation verification.
- Agent Runtime orchestration lane assumptions.
- Context Packet consumption lane assumptions.
- Steve, Michael, and Ivory lane assumptions.

Required planning output:

- `engineering/plans/S2_RUNTIME_EVENT_CAPTURE_PLAN.md`

Plan must cover:

- non-persistent event envelope creation;
- event categories for sessions, turns, context requests, packet delivery, guardrails, agent responses, Guided Actions, outcomes, errors, and completion;
- idempotency key conventions;
- correlation and causation conventions;
- privacy-safe payload rules;
- event names as completed facts, not commands;
- event capture boundaries for browser voice/text;
- explicit non-activation of event persistence, outbox, replay, subscribers, and event APIs;
- QA gates for event envelope creation without persistence activation.

Hard non-actions:

- no event persistence;
- no outbox;
- no replay;
- no subscribers;
- no event API activation;
- no projection writes.

### Lane 7 - Outcome Capture And Guided Action Integration

Planning owner role: Outcome And Guided Action Planning Agent.

Mission: define how agent-assisted sessions capture outcomes and suggest Guided Actions without taking unauthorized action.

Inputs:

- Sprint 2 charter.
- S1.4 Runtime Event Foundation verification.
- S1.5 Context Packet Foundation verification.
- Steve, Michael, Ivory, and orchestration lane assumptions.

Required planning output:

- `engineering/plans/S2_OUTCOME_AND_GUIDED_ACTION_PLAN.md`

Plan must cover:

- outcome types for Steve, Michael, and Ivory;
- BA-owned confirmation points;
- outcome-to-event relationship without persistence activation;
- outcome-to-learning relationship without automatic knowledge approval;
- Guided Action suggestion contract;
- accepted, declined, completed, expired, and failed action states;
- BA-owned execution;
- no external send/call side effects;
- no prospect-facing automation;
- UI handoff expectations inside `.team`;
- QA gates for outcomes and Guided Actions.

Hard non-actions:

- no automatic send;
- no automatic call;
- no automated prospecting;
- no knowledge approval by agents or learning processes;
- no external side effects.

### Lane 8 - Sprint 2 QA And Governance Gates

Planning owner role: Sprint 2 QA Governance Planning Agent.

Mission: define the checks required before any Sprint 2 implementation can be approved.

Inputs:

- Sprint 2 charter.
- Sprint 1 closeout governance record.
- S1.7 QA Harness verification.
- all Sprint 2 lane plans.

Required planning output:

- `engineering/plans/S2_QA_AND_GOVERNANCE_GATES_PLAN.md`

Plan must cover:

- `pnpm typecheck`;
- `pnpm build`;
- `pnpm --filter @momentum/server test`;
- static import checks preventing direct agent access to stores, GraphRAG, direct adapters, and Gateway fallback clients;
- static checks proving Context Manager remains the only Context Packet assembler;
- static checks proving Browser Voice/Text remains `.team` only;
- static checks proving Telnyx/PSTN/call-control are excluded from internal browser runtime;
- static checks proving `.com` is untouched;
- ratified-document no-change check;
- Runtime Event envelope tests without persistence activation;
- Context Packet consumption tests;
- Steve, Michael, and Ivory guardrail tests;
- Guided Action and outcome boundary tests;
- governance review checklist before implementation approval.

Hard non-actions:

- no implementation;
- no route mounting;
- no event persistence activation;
- no Universal Gateway app-runtime dependency.

## 5. Parallel Dependency Map

The lanes may begin in parallel, but final integration should observe these dependencies:

| Lane | Depends On | Feeds |
|---|---|---|
| Steve Success runtime activation | Sprint 2 charter, S1.5, S1.6 | Orchestration, Context Packet consumption, Event capture, Outcomes |
| Michael runtime activation | Sprint 2 charter, S1.5, S1.6 | Orchestration, Context Packet consumption, Event capture, Outcomes |
| Ivory boundary | Sprint 2 charter, compliance rules, S1.5 | Orchestration, Context Packet consumption, Event capture, Outcomes |
| Agent Runtime orchestration | S1.1, S1.2, S1.4, S1.5, agent lanes | QA gates, Event capture, Context Packet consumption |
| Context Packet consumption | S1.5, agent lanes, orchestration | QA gates, Event capture |
| Runtime Event capture | S1.4, agent lanes, orchestration | QA gates, Outcomes |
| Outcome and Guided Action integration | agent lanes, event capture, orchestration | QA gates |
| QA and governance gates | all lanes | Sprint 2 implementation approval package |

## 6. Integration Pass

After all lane plans exist, the coordinator should create an integration review that checks:

- all lane assumptions align;
- no lane authorizes implementation;
- no lane modifies ratified documents;
- no lane modifies production code;
- no lane reintroduces Universal Gateway as app runtime persistence;
- no lane modifies `.com`;
- no lane mounts `/api/runtime/*`;
- no lane activates event persistence, outbox, replay, subscribers, or event APIs;
- agents consume Context Packets only;
- Context Manager remains the only Context Packet assembler;
- candidate/review-only knowledge remains excluded by default;
- internal browser voice/text remains `.team` only;
- Telnyx/PSTN/call-control remain excluded from internal browser runtime.

Expected integration artifact:

- `engineering/reports/SPRINT_002_PLANNING_INTEGRATION_REVIEW.md`

## 7. Stop Condition

This workplan creates planning lanes only.

The coordinator must stop after creating this workplan unless Kevin separately approves the next planning artifacts.

No production code was changed by this workplan.

No ratified documents were modified by this workplan.

No `.com` prospect-facing surfaces were modified by this workplan.

Gateway HTTP persistence fallback status is superseded by ACR-0009.

No `/api/runtime/*` route was mounted.

No event persistence, outbox, replay, subscribers, or event API activation was implemented.
