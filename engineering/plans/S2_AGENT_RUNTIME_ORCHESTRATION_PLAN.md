# S2 - Agent Runtime Orchestration Plan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Lane: Agent Runtime orchestration

## 1. Objective

Plan the orchestration layer that starts, resumes, advances, and completes internal agent sessions for Steve Success, Michael Magnificent, and Ivory without activating production behavior or mounting runtime routes.

The orchestration layer coordinates identity, session state, Context Packet requests, guarded turns, runtime event capture points, outcomes, and Guided Actions.

## 2. Foundation Inputs

This plan depends on:

- `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`
- `engineering/sprints/SPRINT_002_MULTI_AGENT_WORKPLAN.md`
- `engineering/reports/S1_1_SHARED_RUNTIME_CONTRACTS_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_2_BACKEND_RUNTIME_BOUNDARY_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_4_RUNTIME_EVENT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_5_CONTEXT_PACKET_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- Steve, Michael, and Ivory lane plans

## 3. Orchestration Boundary

The planned Agent Runtime Orchestrator owns:

- agent registry lookup;
- session lifecycle coordination;
- turn lifecycle coordination;
- runtime mode handling;
- Context Packet request coordination;
- guardrail boundary invocation;
- response validation boundary;
- non-persistent event envelope capture points;
- outcome and Guided Action coordination.

The orchestrator does not:

- mount routes;
- persist runtime events;
- activate outbox/replay/subscribers;
- query stores directly on behalf of agents;
- remove Gateway fallback;
- expose `.com` behavior;
- approve knowledge.

## 4. Agent Registry Usage

The orchestration plan should define a registry entry per agent:

- `steve_success`
- `michael_magnificent`
- `ivory`

Each entry should define:

- allowed objectives;
- supported modes;
- supported languages;
- guardrail set;
- Context Packet requirement;
- allowed output shapes;
- forbidden output shapes;
- event family prefix;
- Guided Action categories;
- outcome categories.

## 5. Session Lifecycle

Common session states:

- `not_started`
- `created`
- `context_requested`
- `context_ready`
- `active`
- `waiting_for_ba`
- `guided_action_pending`
- `paused`
- `completed`
- `cancelled`
- `failed`

The orchestrator must preserve:

- tenant id;
- Team Magnificent team id/key/name;
- authenticated `baId`;
- session id;
- agent key;
- runtime mode;
- language;
- correlation id;
- current state.

## 6. Turn Lifecycle

Planned turn flow:

1. Receive BA text turn or final browser voice transcript.
2. Validate authenticated Team Magnificent session.
3. Validate agent and objective.
4. Request Context Packet from Context Manager.
5. Validate packet status and agent/objective match.
6. Invoke agent with packet-local context only.
7. Validate response against agent guardrails.
8. Produce response for `.team` browser surface.
9. Capture non-persistent runtime event envelope facts.
10. Capture outcome or Guided Action if applicable.

Agents must not retrieve more context directly. Missing context returns to Context Manager refresh or safe degraded behavior.

## 7. Runtime Modes

Supported modes for planning:

- `browser_text`
- `browser_voice`
- `mixed`

Rules:

- `.team` only;
- text fallback always available;
- microphone permission after BA action only;
- Browser Voice/Text carries identity and language through the orchestrator;
- Telnyx/PSTN/call-control excluded from internal browser runtime.

## 8. Context Packet Coordination

The orchestrator may request context from Context Manager. It may not assemble Context Packets.

The request should include:

- authenticated BA scope;
- agent key;
- objective;
- session id;
- runtime mode;
- language;
- current state;
- compact turn input or transcript reference;
- correlation id.

The response must be a `context_packet.v1` packet with complete, degraded, or failed status.

## 9. Runtime Event Capture Points

The orchestrator should plan non-persistent event envelope capture for:

- session created/resumed/completed/cancelled/failed;
- turn received/responded;
- Context Packet requested/received/degraded/failed;
- guardrail blocked;
- Guided Action suggested/accepted/declined/completed/expired/failed;
- outcome captured;
- runtime error.

This plan does not activate event persistence, outbox, replay, subscribers, or event APIs.

## 10. Response Validation

The orchestrator should validate:

- response is in allowed output shape;
- response matches packet language or records fallback;
- no forbidden claims;
- no `.com` exposure;
- no agent attempts to cite raw stores;
- no request for direct store access;
- no external side effect command.

Invalid responses should produce a guardrail-blocked event envelope and safe fallback text.

## 11. QA Expectations

Future implementation approval should require:

- static import checks proving agents and orchestrator do not import stores, GraphRAG, direct adapters, or Gateway fallback clients;
- route mount check proving `/api/runtime/*` remains unmounted until separately approved;
- `.com` exclusion check;
- Context Manager-only assembly check;
- event envelope tests without persistence activation;
- guardrail tests for all agents;
- degraded and failed packet tests;
- Browser Voice/Text `.team` boundary tests.

Mandatory gates remain:

- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

## 12. Dependencies

Consumes:

- Steve runtime activation plan;
- Michael runtime activation plan;
- Ivory boundary plan;
- Shared Runtime Contracts;
- Backend Runtime Boundary;
- Runtime Event Foundation;
- Context Packet Foundation.

Feeds:

- Context Packet consumption plan;
- Runtime Event capture plan;
- Outcome and Guided Action plan;
- QA and governance gates plan.

## 13. Explicit Non-Actions

This plan does not:

- modify production code;
- modify ratified documents;
- modify `.com`;
- mount `/api/runtime/*`;
- remove Gateway fallback;
- implement event persistence, outbox, replay, subscribers, or event APIs;
- activate agent runtime behavior;
- approve implementation.
