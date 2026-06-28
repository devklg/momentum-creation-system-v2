# S2.10 Persistence / Event / Outcome / Guided Action Decision Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.10 Runtime Activation Approval Charter / Decision Gate
- Status: REVIEW / GOVERNANCE ONLY
- Architecture version: v1.0 frozen

## 1. Current State

Current state: runtime events, Outcome drafts, and Guided Action drafts are returned only.

S2.3 and S2.4 verification confirmed that event envelopes, outcome draft envelopes, and Guided Action draft envelopes are non-persistent. The orchestration code marks event, outcome, Guided Action, and envelope persistence as disabled.

## 2. Event Persistence Options

Option A: keep event persistence disabled.

This preserves the current inert runtime boundary and avoids introducing event stores, outbox, replay, subscribers, or event APIs before route and response scope are approved.

Option B: approve limited event persistence later.

This would persist minimal runtime lifecycle metadata only, with idempotency, scope, retention, and rollback requirements. It must not include outbox, replay, subscribers, or event API activation unless Kevin separately approves them.

Option C: approve full event platform later.

This would include event persistence plus outbox, replay, subscribers, and event APIs. This is not recommended for the first runtime activation slice.

## 3. Outcome Persistence Options

Option A: keep Outcome drafts returned only.

This preserves current Sprint 2 behavior and avoids storing incomplete or unapproved agent-derived facts.

Option B: approve limited outcome persistence later.

This would store only BA-scoped, team-scoped, approved outcome records after explicit BA/system confirmation and validation. It requires schema, idempotency, retention, and rollback approval.

Option C: defer outcome persistence until after first live response behavior is proven.

This is the recommended path.

## 4. Guided Action Persistence Options

Option A: keep Guided Action drafts returned only.

This preserves BA ownership and avoids turning suggestions into executable tasks.

Option B: approve limited Guided Action persistence later.

This would store a BA-owned suggested action only after explicit acceptance, with no automatic sending, calling, scheduling, enrollment, or prospecting side effect.

Option C: defer Guided Action persistence until after the first activation slice proves safe response behavior.

This is the recommended path.

## 5. Outbox / Replay / Subscriber Implications

Outbox, replay, and subscriber activation convert returned-only runtime facts into an event platform with downstream effects. That increases risks around duplicate effects, privacy scope, stale state replay, unapproved automation, and hidden coupling.

No outbox, replay, or subscribers should be introduced in the first activation slice.

## 6. Event API Implications

An event API would expose runtime events beyond the current call return. That requires auth, tenancy, BA scope, retention, redaction, pagination, rate limits, and route policy approval.

No event API should be activated in the first activation slice.

## 7. Idempotency Requirements

Any future persistence must define:

- deterministic event, outcome, and Guided Action ids;
- correlation id and turn id handling;
- duplicate request behavior;
- retry semantics;
- write-readback verification;
- failure behavior that fails loud on partial writes;
- no silent fallback from required persistence legs.

## 8. Privacy / Scope Requirements

Any future persistence must be:

- Team Magnificent scoped;
- tenant scoped;
- BA scoped;
- agent scoped;
- minimal in payload;
- free of raw transcript dumps by default;
- explicit about whether generated content, summaries, or metadata are stored;
- excluded from `.com`;
- excluded from Telnyx/PSTN/call-control.

Candidate/review-only knowledge must remain excluded by default and must not be promoted by agents or learning processes.

## 9. Rollback Requirements

Before any persistence is approved, the implementation plan must define:

- feature flag or config kill switch;
- route disable path if a route exists;
- response-generation disable path if responses are active;
- idempotent cleanup for test or bad writes;
- retention and deletion policy;
- log/event redaction policy;
- rollback verification tests;
- owner and execution steps for rollback.

## 10. Recommendation

Recommendation: keep persistence disabled for the first activation decision and defer event, outcome, and Guided Action persistence.

The next activation slice should keep envelopes returned only. If Kevin later approves persistence, start with a separate minimal event-persistence charter and explicitly keep outbox, replay, subscribers, and event API activation out of scope unless separately approved.

## 11. Recommendation To Kevin

Do not approve persistence as part of first runtime activation. First prove the activation boundary, route policy, response scope, and guardrails with returned-only envelopes.
