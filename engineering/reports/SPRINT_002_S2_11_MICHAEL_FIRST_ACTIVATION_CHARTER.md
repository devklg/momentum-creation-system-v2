# Sprint 2 S2.11 Michael First Activation Charter

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.11 First Activation Charter for Michael Magnificent Internal `.team` Training Support
- Status: PLANNING / GOVERNANCE ONLY
- Architecture version: v1.0 frozen

## 1. Executive Verdict

PASS WITH CONDITIONS.

S2.11 defines the smallest safe first activation charter for Michael Magnificent, but it does not activate Michael. The recommended next slice is route-free fixture/evaluation implementation of the Michael response contract and guardrails.

Conditions before implementation:

- Kevin must approve the exact implementation slice.
- The first implementation must remain route-free unless Kevin separately approves a route.
- Response generation must be limited to the approved Michael contract.
- Persistence must remain disabled unless Kevin separately approves it.
- Required gates and QA tests must pass.
- Feature flag, rollback, and monitoring behavior must be defined before live exposure.

## 2. Planning / Governance Only Confirmation

Confirmed: S2.11 is planning/governance only.

This package creates planning reports and a first activation charter. It does not modify runtime code, production routes, UI, `.com`, ratified documents, persistence adapters, or Gateway fallback.

## 3. Runtime Activation Confirmation

Confirmed: no runtime activation occurred.

Michael remains behavior-not-implemented in the current runtime foundation. No agent response generation was implemented, and no Steve, Michael, or Ivory behavior was activated.

## 4. Michael First Activation Objective

Michael's first activation objective:

Help an authenticated Brand Ambassador on internal `.team` choose or continue one safe, BA-owned training-support next step from an approved Context Packet.

The objective is training support only. Michael must not schedule calls, interview BAs, run Steve discovery, draft Ivory outreach, become prospect-facing, or trigger external side effects.

## 5. Exact Approved Proposed Scope

Proposed first implementation scope:

- agent: `michael_magnificent`;
- first task type: `training_support`;
- input: validated `context_packet.v1` only;
- assembler: Context Manager only;
- output: returned-only Michael response contract envelope;
- allowed response types: `next_training_step`, `clarification_question`, `safe_fallback`, `safe_close`;
- language: EN/ES only;
- route policy: route-free fixture/evaluation only;
- persistence: disabled;
- events/outcomes/Guided Actions: returned only;
- surface: no UI exposure in the first implementation slice.

## 6. Exact Out-Of-Scope Items

Out of scope:

- route mounting;
- `/api/runtime/*`;
- UI changes;
- `.com` changes;
- event persistence;
- outcome persistence;
- Guided Action persistence;
- outbox;
- replay;
- subscribers;
- event API activation;
- Gateway fallback removal;
- direct agent access to MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, Gateway fallback clients, or raw retrieval helpers;
- Steve Success behavior;
- Michael behavior beyond the approved response-contract fixture/evaluation slice;
- Ivory behavior;
- broad agent response generation;
- automatic sending;
- automatic calling;
- automated prospecting;
- scheduling calls or interviews;
- knowledge approval by agents or learning processes;
- Telnyx/PSTN/call-control.

## 7. Response Contract Recommendation

Approve a proposed `michael_response_contract.v1` for the next implementation slice.

Allowed response types:

- `next_training_step`;
- `clarification_question`;
- `safe_fallback`;
- `safe_close`.

The envelope must include agent, task, session, turn, correlation, Context Packet status, language, text, safety validation fields, generated timestamp, and `persistence: "disabled"`.

Forbidden fields include scoring, ranking, qualification, prediction, income projection, commission estimates, cycle math, placement promises, prospect-facing messages, lead qualification, medical advice, THREE authority decisions, send/call/schedule actions, knowledge approval, persistence instructions, raw store results, raw GraphRAG results, and raw Gateway fallback responses.

Until implementation is approved, existing tests should continue to assert `agentResponseGenerated: false`.

## 8. Route / Surface Recommendation

Recommendation: keep the first Michael implementation route-free.

Use fixtures and evaluation tests first. Do not mount `/api/runtime/*` and do not add a `.team` UI surface in the first implementation slice.

A later `.team` route may be considered only after Kevin approves the exact route family, auth boundary, feature flag, route-disable rollback, monitoring, and UI placement.

## 9. Feature Flag / Kill Switch Recommendation

Any future implementation must be protected by a default-off kill switch before live exposure.

Required behavior:

- disable response generation independently;
- disable route handling if a route is later approved;
- return a safe disabled response shape;
- preserve returned-only non-persistent envelopes;
- avoid external side effects;
- be covered by tests.

## 10. QA Gate Requirements

Required gates:

- `pnpm build:shared`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

S2.11 integrated branch gate results:

- `pnpm build:shared` - PASS.
- `pnpm typecheck` - PASS.
- `pnpm build` - PASS. Existing Vite warnings only: `.com` dynamic/static import chunk note and `.team` chunk-size warning.
- `pnpm --filter @momentum/server test` - PASS, 31 test files / 203 tests.

The passing gates above were run with pnpm 9.15.0 from the project environment.

Required tests before implementation:

- response contract validation for all four response types;
- EN and ES response validation;
- missing, complete, degraded, failed, rejected, and candidate/review-only Context Packet paths;
- invalid objective;
- unknown agent;
- missing identity, turn id, task type, and Context Manager boundary;
- no direct store, GraphRAG, adapter, Gateway fallback, persistence, or retrieval access;
- no `/api/runtime/*` unless separately approved;
- `.com` untouched;
- no Telnyx/PSTN/call-control;
- no persistence/outbox/replay/subscriber/event API activation;
- no automatic sending/calling/prospecting/scheduling;
- no knowledge approval.

## 11. Monitoring Requirements

Before persistence is approved, monitoring must remain returned-only or log-only.

Required monitoring signals:

- Michael turn attempted;
- Context Packet requested;
- Context Packet status: complete, degraded, failed, missing, rejected;
- guardrail blocked;
- response validation passed or failed;
- safe fallback returned;
- safe close returned;
- feature flag disabled;
- route not mounted or disabled if applicable.

Monitoring must not store raw transcripts, raw relationship context, raw private journal text, prospect PII, tokens, cookies, secrets, or unapproved generated text.

## 12. Rollback Requirements

Required rollback plan:

- default-off feature flag;
- immediate response-generation disable path;
- immediate route-disable path if a route is later approved;
- safe disabled return shape;
- verification that no event/outcome/Guided Action persistence occurred;
- verification that `.com` remains untouched;
- verification that `/api/runtime/*` remains unmounted unless separately approved;
- rerun all required gates after rollback;
- owner checklist for file diff, route state, static boundaries, and test results.

## 13. Context Packet Requirements

Michael must consume `context_packet.v1` only.

Required packet constraints:

- `metadata.generatedBy` must be `context_manager`;
- `agent.agentKey` must be `michael_magnificent`;
- `session.taskType` must be `training_support` for the first slice;
- packet status must be handled explicitly;
- `retrievalAudit.candidateKnowledgeIncluded` must be `false`;
- `retrievalAudit.candidateKnowledgeExcluded` must be `true`;
- language must be `en` or `es`;
- approved knowledge only;
- Context Manager remains the only assembler.

Failed, missing, rejected, wrong-agent, wrong-task, unsupported-language, non-Context-Manager, or candidate/review-only packets must block substantive training guidance.

## 14. Guardrail Requirements

Guardrails must block:

- prospect-facing content;
- Steve interview behavior;
- Ivory relationship/outreach behavior;
- scoring, ranking, qualification, prediction, and readiness classification;
- income claims, compensation figures, cycle math, and placement promises;
- THREE authority claims;
- medical advice;
- automatic sending, calling, scheduling, prospecting, or enrollment actions;
- knowledge approval;
- direct store, GraphRAG, adapter, Gateway fallback, or retrieval access;
- Telnyx/PSTN/call-control.

Guardrail failure must fail closed and return a validated `safe_fallback` or `safe_close` envelope without returning the blocked text.

## 15. Required Kevin Decisions Before Implementation

Kevin must approve:

- whether the next slice implements the Michael response-contract fixture/evaluation harness;
- whether response generation remains fixture-only or can produce returned-only text from controlled fixtures;
- whether `training_support` is the only approved first task type;
- whether the first slice remains route-free;
- whether the kill switch shape is sufficient;
- whether any `.team` surface planning should begin after the route-free slice;
- whether persistence remains disabled;
- whether monitoring is returned-only/log-only for the first slice.

## 16. Recommended Next Implementation Slice

Recommended next slice: S2.12 Michael Response Contract Fixture / Evaluation Harness.

Scope should be:

- implement contract types/validators and fixtures only;
- cover the four allowed response types;
- validate EN/ES behavior;
- validate guardrail blocks;
- validate complete/degraded/failed/missing/rejected Context Packet behavior;
- keep `training_support` as the only first-slice task type;
- keep route-free;
- keep persistence disabled;
- keep `.com` untouched;
- keep `agentResponseGenerated: false` unless Kevin explicitly approves a returned-only generated-response marker change.

## 17. Explicit Non-Actions

S2.11 did not:

- activate runtime behavior;
- mount routes;
- mount `/api/runtime/*`;
- implement response generation;
- implement Michael behavior;
- activate Steve behavior;
- activate Ivory behavior;
- modify UI;
- modify `.com`;
- add persistence;
- add outbox, replay, subscribers, or event APIs;
- persist outcomes or Guided Actions;
- remove Gateway fallback;
- edit ratified documents;
- give agents direct store, GraphRAG, adapter, Gateway fallback, or retrieval access;
- add Telnyx/PSTN/call-control;
- add automatic sending, calling, scheduling, prospecting, or knowledge approval.
