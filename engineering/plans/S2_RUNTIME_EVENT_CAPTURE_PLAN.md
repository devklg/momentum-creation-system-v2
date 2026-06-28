# S2 - Runtime Event Capture Plan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Lane: Runtime Event capture for agent actions

## 1. Objective

Plan how Sprint 2 agent actions create privacy-safe runtime event envelopes without activating event persistence, outbox, replay, subscribers, projections, or event APIs.

This plan uses the S1.4 Runtime Event Foundation as an envelope and validation boundary only.

## 2. Foundation Inputs

This plan depends on:

- `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`
- `engineering/sprints/SPRINT_002_MULTI_AGENT_WORKPLAN.md`
- `engineering/reports/S1_4_RUNTIME_EVENT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- Agent Runtime orchestration plan
- Context Packet consumption plan
- Steve runtime activation plan
- Michael runtime activation plan
- Ivory boundary plan

## 3. Event Capture Boundary

Allowed in Sprint 2 planning:

- identify event facts;
- define event envelope fields;
- define idempotency key conventions;
- define correlation and causation strategy;
- define privacy-safe payload rules;
- define tests for envelope creation.

Not allowed:

- persist events;
- create outbox records;
- replay events;
- create subscribers;
- activate event APIs;
- write projections;
- trigger external side effects.

## 4. Event Envelope Use

Every planned event fact should use the S1.4 `agent_event.v1` foundation shape.

Required concepts:

- event id;
- event type;
- tenant scope;
- Team Magnificent scope;
- `baId` when BA-scoped;
- agent id when agent-scoped;
- request id;
- correlation id;
- causation id when known;
- idempotency key;
- actor;
- source;
- privacy-safe payload;
- metadata;
- schema version.

## 5. Event Taxonomy

Planned event families:

- `steve.*`
- `michael.*`
- `ivory.*`
- `agent_session.*`
- `agent_turn.*`
- `context_packet.*`
- `browser_voice.*`
- `browser_text.*`
- `guided_action.*`
- `outcome.*`
- `guardrail.*`
- `runtime_error.*`

Event names must be completed facts, not commands.

Examples:

- `agent_session.started`
- `agent_turn.received`
- `context_packet.requested`
- `context_packet.received`
- `guardrail.blocked`
- `guided_action.suggested`
- `outcome.captured`
- `runtime_error.recorded`

## 6. Capture Points

### Sessions

- session created;
- session resumed;
- session paused;
- session completed;
- session cancelled;
- session failed.

### Turns

- BA turn received;
- final voice transcript received;
- text fallback submitted;
- agent response produced;
- response blocked by guardrail.

### Context Packets

- packet requested;
- packet received;
- packet degraded;
- packet failed;
- packet rejected by validation.

### Guided Actions

- suggested;
- accepted;
- declined;
- completed;
- expired;
- failed.

### Outcomes

- Steve profile draft created/confirmed;
- Michael training support outcome captured;
- Ivory draft outcome captured;
- BA-owned next action captured;
- degraded or failed session outcome captured.

## 7. Idempotency Strategy

Planned idempotency keys should be deterministic where possible:

- `agent-session:{sessionId}:started`
- `agent-session:{sessionId}:completed`
- `agent-turn:{sessionId}:{turnId}:received`
- `context-packet:{requestId}:requested`
- `context-packet:{requestId}:{packetId}:received`
- `guided-action:{actionId}:suggested`
- `outcome:{sessionId}:{outcomeId}:captured`

Conflicting reuse of an idempotency key should be rejected in future implementation planning.

## 8. Correlation And Causation

Correlation id tracks the full agent session or workflow.

Causation id links:

- turn response to turn received;
- Context Packet received to Context Packet requested;
- Guided Action suggested to agent response;
- outcome captured to Guided Action completed or session completed.

Root events may omit causation id.

## 9. Privacy-Safe Payload Rules

Payloads should:

- avoid raw transcript dumps;
- avoid raw private journal text unless explicitly authorized by future contract;
- use transcript ids, hashes, summaries, or redacted excerpts;
- avoid secrets, tokens, API keys, provider details, stack traces, and internal credentials;
- avoid prospect-sensitive broad context;
- preserve Team Magnificent scope;
- identify packet-local references instead of raw database records.

## 10. Browser Voice/Text Capture

Browser event capture remains `.team` only.

Planned facts:

- capability checked;
- permission requested;
- permission granted;
- permission denied;
- listening started;
- final transcript received;
- fallback to text;
- language changed;
- speech response started/completed;
- voice error recorded.

No Telnyx/PSTN/call-control events belong to internal browser runtime.

## 11. QA Expectations

Future implementation approval should require:

- event envelope schema tests;
- event names are completed facts;
- no command events;
- privacy payload tests;
- idempotency key tests;
- correlation/causation tests;
- Browser Voice/Text `.team` event tests;
- no event persistence activation;
- no outbox/replay/subscriber/API modules activated;
- no external side effects.

Mandatory gates remain:

- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

## 12. Dependencies

Feeds:

- Outcome and Guided Action plan;
- QA and governance gates plan.

Consumes:

- Runtime Event Foundation;
- Agent Runtime orchestration plan;
- Context Packet consumption plan;
- agent lane plans.

## 13. Explicit Non-Actions

This plan does not:

- modify production code;
- modify ratified documents;
- modify `.com`;
- mount `/api/runtime/*`;
- remove Gateway fallback;
- persist events;
- create outbox;
- replay events;
- create subscribers;
- activate event APIs;
- write projections.
