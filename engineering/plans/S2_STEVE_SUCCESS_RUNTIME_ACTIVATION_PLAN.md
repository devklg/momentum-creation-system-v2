# S2 - Steve Success Runtime Activation Plan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Lane: Steve Success Interview Agent runtime activation

## 1. Objective

Plan how Steve Success activates as an internal `.team` runtime agent for the non-scored Success Interview.

Steve's job is to guide a Brand Ambassador through a structured Success Interview and produce a useful Success Profile artifact without scoring, ranking, predicting, qualifying, or making compensation or placement claims.

## 2. Foundation Inputs

This plan depends on:

- `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`
- `engineering/sprints/SPRINT_002_MULTI_AGENT_WORKPLAN.md`
- `engineering/reports/SPRINT_001_FINAL_CLOSEOUT_GOVERNANCE_RECORD.md`
- `engineering/reports/S1_4_RUNTIME_EVENT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_5_CONTEXT_PACKET_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_6_BROWSER_VOICE_TEXT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- existing Steve domain code, read-only during planning

## 3. Activation Boundary

Steve may be planned for internal authenticated `.team` use only.

Allowed runtime purpose:

- start or resume a Success Interview;
- ask structured interview questions;
- clarify a BA's stated goals, constraints, confidence, and support needs;
- summarize interview responses into a non-scored Success Profile;
- suggest BA-owned Guided Actions.

Not allowed:

- score a BA;
- rank a BA;
- predict success;
- qualify or disqualify a BA;
- make income, compensation, cycle, or placement claims;
- make THREE enrollment or genealogy decisions;
- access stores, GraphRAG, direct adapters, or Gateway fallback clients directly.

## 4. Session Lifecycle

The Steve runtime activation plan should model these session states:

- `not_started`
- `started`
- `in_progress`
- `paused`
- `profile_draft_ready`
- `profile_confirmed`
- `completed`
- `cancelled`
- `failed`

Session identity must include:

- tenant scope;
- Team Magnificent scope;
- `baId` from authenticated `.team` session;
- agent key for Steve Success;
- runtime mode: browser text, browser voice, or mixed;
- language: English or Spanish;
- correlation id.

The frontend must not be trusted to choose another BA.

## 5. Context Packet Requirements

Steve must consume Context Packets only.

Required packet inputs:

- Team Magnificent scope;
- authenticated BA identity;
- current Steve session state;
- current interview objective;
- approved runtime rules and guardrails;
- approved knowledge relevant to Success Interview support;
- prior session summary when resuming;
- approved relationship or journal context only when explicitly allowed and packeted;
- language metadata;
- exclusions and retrieval audit.

Steve must not assemble packets. Missing context must result in:

- request for refreshed Context Packet;
- degraded-context response;
- clarifying question;
- safe stop.

Candidate and review-only knowledge remains excluded by default.

## 6. Interview Output

The planned Success Profile is non-scored.

Allowed output sections:

- stated reason for joining;
- near-term activity intention;
- learning support needs;
- confidence blockers stated by the BA;
- preferred support style;
- language preference;
- suggested next BA-owned actions;
- notes for BA self-review.

Forbidden output:

- score;
- rank;
- readiness classification;
- qualification classification;
- income projection;
- placement promise;
- automated prospecting list;
- direct instruction to contact a prospect;
- THREE authority decision.

## 7. Runtime Event Capture

Planning should capture these non-persistent event facts through the S1.4 envelope foundation:

- `steve.session.started`
- `steve.session.resumed`
- `steve.turn.received`
- `steve.context_packet.requested`
- `steve.context_packet.received`
- `steve.guardrail.blocked`
- `steve.profile.draft_created`
- `steve.profile.confirmed`
- `steve.guided_action.suggested`
- `steve.session.paused`
- `steve.session.completed`
- `steve.session.cancelled`
- `steve.session.failed`

These are capture points only. This plan does not activate event persistence, outbox, replay, subscribers, or event APIs.

Payloads should avoid raw transcript dumps. Use ids, hashes, summaries, and packet-local references where possible.

## 8. Outcome Capture

Planned Steve outcomes:

- Success Interview completed;
- Success Profile draft created;
- Success Profile confirmed by BA;
- BA accepted a Guided Action;
- BA declined a Guided Action;
- session ended with degraded context;
- session cancelled by BA.

Outcome capture remains BA-scoped and Team Magnificent scoped. Outcomes may feed future learning only as signals or candidates; they do not approve knowledge.

## 9. Guided Action Opportunities

Steve may suggest BA-owned actions such as:

- review profile summary;
- choose next training support topic;
- schedule a support follow-up inside approved app flow;
- open Michael training support;
- note a personal blocker for later review.

Steve must not execute external side effects. No send, call, enrollment, prospect outreach, or automated follow-up is authorized.

## 10. Browser Voice/Text Boundary

Steve may be planned for:

- browser text;
- browser voice;
- mixed browser mode.

Rules:

- `.team` only;
- text fallback always available;
- microphone permission only after BA action;
- EN/ES supported;
- no Telnyx/PSTN/call-control for internal browser runtime;
- no raw audio storage in MVP planning.

## 11. QA Expectations

Future implementation approval should require:

- Steve cannot import MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, or Gateway fallback clients;
- Steve consumes Context Packets only;
- Steve cannot score, rank, predict, or qualify BAs;
- Steve output excludes income and placement claims;
- candidate/review-only knowledge is excluded by default;
- Browser Voice/Text remains `.team` only;
- Telnyx/PSTN/call-control are absent from internal browser runtime;
- runtime event envelope creation is tested without persistence activation.

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
- Runtime Event Foundation.

## 13. Explicit Non-Actions

This plan does not:

- modify production code;
- modify ratified documents;
- modify `.com`;
- mount `/api/runtime/*`;
- remove Gateway fallback;
- implement event persistence, outbox, replay, subscribers, or event APIs;
- give Steve direct store, GraphRAG, adapter, or Gateway client access;
- approve agent behavior implementation.
