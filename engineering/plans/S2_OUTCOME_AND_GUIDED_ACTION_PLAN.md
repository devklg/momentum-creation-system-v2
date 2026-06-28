# S2 - Outcome And Guided Action Plan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Lane: Outcome capture and Guided Action integration

## 1. Objective

Plan how Sprint 2 agent sessions capture outcomes and suggest Guided Actions while keeping execution BA-owned and avoiding unauthorized external side effects.

Agents may suggest. BAs act.

## 2. Foundation Inputs

This plan depends on:

- `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`
- `engineering/sprints/SPRINT_002_MULTI_AGENT_WORKPLAN.md`
- `engineering/reports/S1_4_RUNTIME_EVENT_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- `engineering/reports/S1_5_CONTEXT_PACKET_FOUNDATION_IMPLEMENTATION_VERIFICATION.md`
- Steve runtime activation plan
- Michael runtime activation plan
- Ivory boundary plan
- Agent Runtime orchestration plan
- Runtime Event capture plan

## 3. Outcome Capture Boundary

Outcome capture records what happened or what the BA confirmed.

Allowed:

- capture session completion;
- capture BA-confirmed profile/draft/training outcomes;
- capture accepted or declined Guided Actions;
- capture degraded/failed context outcomes;
- capture learning signals or candidate-worthy observations for future review.

Not allowed:

- approve knowledge;
- auto-send;
- auto-call;
- automate prospecting;
- qualify leads;
- make external side effects;
- mutate THREE authority records;
- trigger `.com` behavior.

## 4. Guided Action Boundary

Guided Actions are suggestions that remain BA-owned.

Allowed states:

- `suggested`
- `accepted`
- `declined`
- `completed`
- `expired`
- `failed`

The BA must remain the actor for acceptance and completion. Agents do not execute the action.

## 5. Agent-Specific Outcomes

### Steve Success

Planned outcomes:

- Success Interview started;
- Success Interview completed;
- Success Profile draft created;
- Success Profile confirmed by BA;
- BA accepted suggested next step;
- BA declined suggested next step;
- session cancelled;
- session completed with degraded context.

### Michael Magnificent

Planned outcomes:

- training support session completed;
- training topic clarified;
- BA practice completed;
- daily-success reflection captured;
- BA accepted training next step;
- BA requested more support;
- session completed with degraded context.

### Ivory

Planned outcomes:

- relationship context reviewed;
- editable draft created;
- draft revised by BA;
- BA chose manual next step;
- compliance guardrail blocked draft;
- BA declined suggested action;
- session cancelled.

## 6. Guided Action Categories

Allowed categories:

- review profile;
- continue training;
- open an internal `.team` workflow;
- edit a draft;
- copy a draft manually;
- record private note;
- request context refresh;
- ask follow-up question;
- pause session;
- resume later.

Forbidden categories:

- send message automatically;
- call automatically;
- ringless voicemail;
- prospect scoring;
- lead qualification;
- automated prospecting;
- bulk outreach;
- enrollment submission;
- THREE genealogy or placement action.

## 7. Relationship To Runtime Events

Outcomes and Guided Actions should emit non-persistent event envelope facts in planning:

- `guided_action.suggested`
- `guided_action.accepted`
- `guided_action.declined`
- `guided_action.completed`
- `guided_action.expired`
- `guided_action.failed`
- `outcome.captured`
- `outcome.confirmed_by_ba`
- `outcome.capture_failed`

This plan does not activate event persistence, outbox, replay, subscribers, or event APIs.

## 8. Relationship To Learning

Outcomes may become learning signals or candidate prompts in future implementation.

Rules:

- learning may propose candidates;
- learning cannot approve knowledge;
- private journal material stays private unless BA explicitly selects it for review;
- candidate/review-only knowledge remains excluded from normal Context Packets by default;
- agents cannot self-modify instructions or approved knowledge.

## 9. UI Handoff Expectations

Future `.team` UI planning should display:

- suggested action label;
- reason from packet-local context;
- accept/decline controls;
- completion confirmation;
- safe failure text;
- no hidden external side effects.

No `.com` surface is modified or involved.

## 10. QA Expectations

Future implementation approval should require:

- Guided Action state transition tests;
- BA-owned acceptance/completion tests;
- no external send/call side effects;
- no automated prospecting;
- no knowledge approval by agents;
- outcome event envelope tests without persistence activation;
- `.team` UI boundary tests;
- `.com` exclusion checks;
- candidate/review-only exclusion checks.

Mandatory gates remain:

- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

## 11. Dependencies

Feeds:

- QA and governance gates plan;
- Sprint 2 planning integration review.

Consumes:

- agent lane plans;
- Agent Runtime orchestration plan;
- Runtime Event capture plan;
- Context Packet consumption plan.

## 12. Explicit Non-Actions

This plan does not:

- modify production code;
- modify ratified documents;
- modify `.com`;
- mount `/api/runtime/*`;
- remove Gateway fallback;
- implement event persistence, outbox, replay, subscribers, or event APIs;
- implement Guided Actions;
- implement outcome persistence;
- authorize external side effects.
