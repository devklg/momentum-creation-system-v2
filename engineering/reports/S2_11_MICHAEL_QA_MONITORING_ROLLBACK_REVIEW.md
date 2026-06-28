# S2.11 Michael QA / Monitoring / Rollback Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.11 Michael First Activation Charter
- Status: PLANNING / GOVERNANCE ONLY
- Architecture version: v1.0 frozen

## 1. Required Gate Commands

Required gates for any S2.11-integrated branch and any later Michael implementation branch:

- `pnpm build:shared`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

The GitHub `gates` status check must continue to run these commands for pull requests to `main`.

## 2. Required Static Boundary Tests

Static tests must prove:

- Michael runtime source does not import MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, Gateway fallback clients, persistence adapters, or raw retrieval helpers;
- Context Manager remains the only Context Packet assembler;
- Michael consumes Context Packets only;
- `/api/runtime/*` remains unmounted unless separately approved;
- `.com` remains untouched;
- Gateway fallback remains preserved;
- Telnyx/PSTN/call-control remain excluded;
- no event persistence, outbox, replay, subscribers, event API activation, outcome persistence, or Guided Action persistence is introduced;
- no automatic sending, automatic calling, automated prospecting, scheduling, or knowledge approval is introduced.

## 3. Required Response Contract Tests

Before response generation can be implemented, tests must cover:

- `next_training_step` response type;
- `clarification_question` response type;
- `safe_fallback` response type;
- `safe_close` response type;
- required fields present;
- forbidden fields absent;
- EN response validation;
- ES response validation;
- response language follows Context Packet language metadata;
- `agentResponseGenerated` remains false until the implementation slice explicitly changes it under Kevin approval.

## 4. Required Guardrail Tests

Guardrail tests must block:

- prospect-facing content;
- Steve interview behavior;
- Ivory relationship/outreach behavior;
- scheduling calls or interviews;
- scoring, ranking, or qualifying;
- income claims, compensation figures, cycle math, and placement promises;
- THREE authority claims;
- medical advice;
- automatic sending, calling, or prospecting;
- knowledge approval by agents or learning processes;
- Telnyx/PSTN/call-control behavior.

## 5. Required Context Packet Tests

Tests must cover:

- complete Context Packet;
- degraded Context Packet;
- failed Context Packet;
- candidate/review-only knowledge rejection;
- invalid objective;
- unknown agent;
- missing identity;
- missing turn id;
- missing task type;
- missing Context Manager boundary;
- Context Manager-only assembly marker;
- retrieval audit with candidate knowledge excluded by default.

## 6. Required Monitoring Signals Without Persistence

Before persistence is approved, monitoring must use returned-only or log-only signals:

- request attempted;
- Context Packet requested;
- Context Packet status: complete, degraded, failed, rejected;
- guardrail blocked;
- response validation passed or failed if response generation is approved later;
- safe fallback returned;
- safe close returned;
- feature flag disabled;
- route rejected or not mounted if applicable.

These signals must not create event persistence, outcome persistence, Guided Action persistence, outbox, replay, subscribers, or event APIs.

## 7. Log Redaction Requirements

Logs must avoid:

- raw BA private journal text;
- raw relationship context;
- raw generated response text unless explicitly approved;
- raw transcript dumps;
- prospect PII;
- access tokens, session cookies, and secret values.

Logs may include ids, correlation ids, packet status, validation result codes, guardrail ids, and aggregate counts.

## 8. Rollback / Kill Switch Plan

Rollback must include:

- default-off feature flag;
- immediate disable path for response generation;
- immediate disable path for any later route;
- safe disabled return shape;
- confirmation that returned-only envelopes remain non-persistent;
- command sequence for verification after rollback;
- static scan proving no forbidden imports or `.com` exposure;
- owner verification checklist.

## 9. Owner Verification Steps

Owner verification before implementation approval:

- review changed files for planning/implementation scope;
- run all required gates;
- confirm test count and failures, if any;
- inspect route state for `/api/runtime/*`;
- inspect `.com` diff;
- inspect static boundary tests;
- confirm no persistence/outbox/replay/subscriber/event API code;
- confirm no Telnyx/PSTN/call-control code;
- confirm no Steve/Ivory behavior and no Michael behavior outside approved scope.

## 10. Recommendation To Kevin

Approve QA for the next Michael slice only if it remains fixture/evaluation-only or otherwise explicitly names the first approved response contract. Do not approve live activation until the kill switch, validation tests, and rollback checks are defined and passing.
