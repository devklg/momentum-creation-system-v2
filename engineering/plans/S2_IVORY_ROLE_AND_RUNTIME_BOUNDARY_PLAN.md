# S2 - Ivory Role And Runtime Boundary Plan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Lane: Ivory role clarification and runtime boundary

## 1. Objective

Clarify Ivory's approved runtime role before any activation work begins.

Ivory is BA-facing relationship and context support. Ivory may help a BA think through who they personally know, compose editable drafts, and prepare BA-owned actions. Ivory must not qualify leads, automate prospecting, auto-send, call, or directly access stores or retrieval systems.

## 2. Foundation Inputs

This plan depends on:

- `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`
- `engineering/sprints/SPRINT_002_MULTI_AGENT_WORKPLAN.md`
- Team Magnificent / THREE International compliance rules
- `engineering/reports/S1_5_CONTEXT_PACKET_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- existing Ivory and invitation-flow references, read-only during planning

## 3. Approved Role

Ivory may be planned as:

- internal `.team` relationship/context support;
- BA-owned thinking partner for known relationships;
- editable draft helper;
- reminder of compliant sharing boundaries;
- handoff assistant into BA-owned invitation workflows;
- source of Guided Action suggestions that require BA action.

Ivory is not:

- a lead qualification agent;
- a prospecting automation system;
- an outreach sender;
- a dialer;
- an enrollment assistant for THREE systems;
- an autonomous recommender of who must be contacted;
- a direct retrieval client.

## 4. Runtime Boundary

Ivory must operate through Agent Runtime and consume Context Packets only.

Allowed inputs must come from:

- authenticated `.team` BA session;
- Context Packet assembled by Context Manager;
- BA-provided prompt or selected relationship context;
- approved knowledge and runtime rules inside the packet.

Disallowed inputs:

- direct MongoDB query;
- direct Neo4j query;
- direct ChromaDB query;
- GraphRAG access;
- direct persistence adapters;
- Gateway fallback clients;
- candidate/review-only knowledge by default;
- hidden contact scraping or bulk contact import.

## 5. Context Packet Requirements

Ivory packet requirements:

- Team Magnificent scope;
- authenticated `baId`;
- allowed objective;
- relationship context explicitly included by Context Manager;
- compliance constraints;
- approved invitation/share language rules;
- language metadata;
- exclusions and retrieval audit;
- packet status.

Ivory must not assemble context. If needed relationship context is missing, Ivory must ask for a packet refresh, ask a clarifying question, or continue with safe generic guidance.

## 6. Draft Boundary

Ivory may produce editable drafts only.

Draft rules:

- draft belongs to the BA;
- BA reviews and edits;
- BA chooses whether to send;
- no automatic send;
- no automatic scheduling;
- no automatic calling;
- no bulk outreach;
- no hidden prospect list generation;
- source can be marked as Ivory in future implementation planning, but this document does not implement it.

Draft content must avoid:

- income claims;
- compensation figures;
- cycle math;
- placement promises;
- AI prospecting language;
- medical claims;
- urgency manipulation.

## 7. Runtime Event Capture

Planning should capture these non-persistent event facts through the S1.4 envelope foundation:

- `ivory.session.started`
- `ivory.turn.received`
- `ivory.context_packet.requested`
- `ivory.context_packet.received`
- `ivory.relationship_context.reviewed`
- `ivory.draft.created`
- `ivory.draft.edited_by_ba`
- `ivory.guardrail.blocked`
- `ivory.guided_action.suggested`
- `ivory.outcome.captured`
- `ivory.session.completed`
- `ivory.session.cancelled`
- `ivory.session.failed`

No event persistence, outbox, replay, subscribers, or event APIs are activated by this plan.

## 8. Outcome Capture

Planned Ivory outcomes:

- relationship context reviewed;
- editable draft created;
- BA edited draft;
- BA accepted a Guided Action;
- BA declined a Guided Action;
- BA chose manual next step;
- compliance guardrail blocked a draft;
- session completed or cancelled.

Outcome capture is internal, BA-owned, and Team Magnificent scoped. Outcomes may become learning signals or candidates only. Ivory cannot approve knowledge.

## 9. Guided Action Opportunities

Ivory may suggest:

- review the draft;
- edit tone;
- copy the BA-owned draft manually;
- open the invitation workflow;
- record a private note;
- ask Michael for training help;
- pause and return later.

Ivory must not perform the action. The BA remains the actor.

## 10. QA Expectations

Future implementation approval should require:

- Ivory consumes Context Packets only;
- Ivory cannot import store clients, GraphRAG, direct adapters, or Gateway fallback clients;
- Ivory does not auto-send;
- Ivory does not call;
- Ivory does not score or qualify prospects;
- Ivory does not automate prospecting;
- candidate/review-only knowledge is excluded by default;
- draft guardrails block income, placement, medical, and AI prospecting language;
- `.com` is untouched.

Mandatory gates remain:

- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

## 11. Dependencies

Feeds:

- Agent Runtime orchestration plan;
- Context Packet consumption plan;
- Runtime Event capture plan;
- Outcome and Guided Action plan;
- QA and governance gates plan.

Consumes:

- Sprint 2 charter;
- compliance boundaries;
- Context Packet Foundation.

## 12. Explicit Non-Actions

This plan does not:

- modify production code;
- modify ratified documents;
- modify `.com`;
- mount `/api/runtime/*`;
- remove Gateway fallback;
- implement event persistence, outbox, replay, subscribers, or event APIs;
- authorize automated prospecting;
- authorize AI lead qualification;
- authorize auto-send or calling;
- approve agent behavior implementation.
