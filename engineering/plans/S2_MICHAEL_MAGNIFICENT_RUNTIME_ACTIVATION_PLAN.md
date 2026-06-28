# S2 - Michael Magnificent Runtime Activation Plan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Lane: Michael Magnificent Training Support Agent runtime activation

## 1. Objective

Plan how Michael Magnificent activates as an internal `.team` training support agent for Brand Ambassadors.

Michael's job is to support BA learning, orientation, follow-through, and daily-success rhythm without becoming prospect-facing, replacing THREE authority, or using Telnyx/PSTN/call-control inside the browser runtime.

## 2. Foundation Inputs

This plan depends on:

- `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`
- `engineering/sprints/SPRINT_002_MULTI_AGENT_WORKPLAN.md`
- `engineering/reports/S1_5_CONTEXT_PACKET_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_6_BROWSER_VOICE_TEXT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_7_QA_HARNESS_SCAFFOLDING_VERIFICATION.md`
- existing Michael training/support code, read-only during planning

## 3. Activation Boundary

Michael may be planned for authenticated `.team` BA training support only.

Allowed runtime purpose:

- explain training concepts;
- answer BA questions from approved context;
- guide a BA through training support states;
- help a BA reflect on daily-success activity;
- suggest BA-owned Guided Actions;
- capture training support outcomes.

Not allowed:

- prospect-facing interaction;
- AI prospecting;
- automated outreach;
- internal Telnyx/PSTN/call-control;
- income, placement, or cycle promises;
- direct access to stores, GraphRAG, adapters, or Gateway fallback clients.

## 4. Session States

The Michael activation plan should model:

- `not_started`
- `training_context_loaded`
- `active_support`
- `question_answering`
- `guided_practice`
- `daily_success_check`
- `guided_action_pending`
- `completed`
- `cancelled`
- `failed`

Session identity must preserve:

- tenant scope;
- Team Magnificent scope;
- authenticated `baId`;
- Michael agent key;
- runtime mode;
- language;
- session id;
- correlation id.

## 5. Context Packet Requirements

Michael must consume Context Packets only.

Required packet inputs:

- Team Magnificent BA scope;
- current training surface or task;
- allowed support objective;
- approved training knowledge;
- approved runtime rules;
- BA progress summary when available in the packet;
- language metadata;
- exclusions and retrieval audit;
- degraded/failed packet status.

Michael must not assemble packets or retrieve context directly. If packet context is missing, Michael must ask for a refresh, provide a safe degraded response, ask a clarifying question, or stop.

Candidate/review-only knowledge remains excluded by default.

## 6. Response Guardrails

Michael responses must:

- stay inside approved training support;
- avoid prospect-facing AI language;
- avoid income claims;
- avoid placement promises;
- avoid THREE authority claims;
- avoid medical advice;
- preserve BA agency;
- keep actions BA-owned;
- use the packet language when possible.

Michael may explain app workflow, training concepts, and next-step options if the Context Packet permits it.

## 7. Browser Voice/Text Boundary

Michael may be planned for `.team` browser text, browser voice, and mixed mode.

Rules:

- text fallback always available;
- microphone permission only after explicit BA action;
- visible listening state;
- EN/ES supported;
- no Telnyx/PSTN/call-control imports or calls;
- no raw audio storage in MVP planning;
- no `.com` exposure.

## 8. Runtime Event Capture

Planning should capture these non-persistent event facts through the S1.4 envelope foundation:

- `michael.session.started`
- `michael.session.resumed`
- `michael.turn.received`
- `michael.context_packet.requested`
- `michael.context_packet.received`
- `michael.training_topic.selected`
- `michael.guidance.provided`
- `michael.guardrail.blocked`
- `michael.guided_action.suggested`
- `michael.outcome.captured`
- `michael.session.completed`
- `michael.session.cancelled`
- `michael.session.failed`

No event persistence, outbox, replay, subscribers, or event APIs are activated by this plan.

## 9. Outcome Capture

Planned Michael outcomes:

- training support session completed;
- training question answered;
- topic completed;
- BA accepted Guided Action;
- BA declined Guided Action;
- BA requested follow-up;
- degraded context path used;
- session cancelled.

Outcomes may become learning signals or candidates only. Michael cannot approve knowledge.

## 10. Guided Action Opportunities

Michael may suggest BA-owned actions such as:

- review a training module;
- open a relevant `.team` page;
- practice a compliant explanation;
- record a private note;
- schedule or request support through approved app workflow;
- continue to the next training step.

Michael must not send messages, call anyone, auto-enroll, automate prospecting, or trigger external side effects.

## 11. QA Expectations

Future implementation approval should require:

- Michael cannot import store clients, GraphRAG, direct adapters, or Gateway fallback clients;
- Michael consumes Context Packets only;
- Browser Voice/Text remains `.team` only;
- Telnyx/PSTN/call-control are absent from internal browser runtime;
- text fallback is always available;
- candidate/review-only knowledge is excluded by default;
- guardrail tests block income, placement, AI prospecting, and THREE authority claims;
- event envelope tests run without persistence activation.

Mandatory gates remain:

- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

## 12. Dependencies

Feeds:

- Agent Runtime orchestration plan;
- Context Packet consumption plan;
- Runtime Event capture plan;
- Outcome and Guided Action plan;
- QA and governance gates plan.

Consumes:

- Context Packet Foundation;
- Browser Voice/Text Foundation;
- QA Harness Foundation.

## 13. Explicit Non-Actions

This plan does not:

- modify production code;
- modify ratified documents;
- modify `.com`;
- mount `/api/runtime/*`;
- remove Gateway fallback;
- implement event persistence, outbox, replay, subscribers, or event APIs;
- authorize internal Telnyx/PSTN/call-control;
- approve agent behavior implementation.
