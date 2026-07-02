# S2 - QA And Governance Gates Plan

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING ONLY
- Architecture version: v1.0 frozen
- Lane: Sprint 2 QA and governance gates

> **Supersession note (2026-07-02, ACR-0009):** this plan predates Kevin's
> approved retirement of the Gateway HTTP persistence fallback. Treat any
> fallback-preservation language below as historical planning context, not
> current architecture. Gateway is MCP/developer tooling; app runtime persistence
> is direct to the MCS stack.

## 1. Objective

Define the checks required before Sprint 2 agent runtime implementation can be approved.

This plan does not approve implementation. It defines the gate package that must protect the frozen v1.0 architecture, Sprint 1 verified foundations, and Kevin's Sprint 2 planning constraints.

## 2. Foundation Inputs

This plan depends on:

- `engineering/sprints/SPRINT_002_AGENT_RUNTIME_ACTIVATION_CHARTER.md`
- `engineering/sprints/SPRINT_002_MULTI_AGENT_WORKPLAN.md`
- `engineering/reports/SPRINT_001_FINAL_CLOSEOUT_GOVERNANCE_RECORD.md`
- `engineering/reports/S1_7_QA_HARNESS_SCAFFOLDING_VERIFICATION.md`
- all Sprint 2 lane plans

## 3. Baseline Gates

Mandatory repository gates:

- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

These remain mandatory for implementation approval and closeout.

## 4. Governance No-Change Checks

Sprint 2 implementation approval must include checks proving:

- ratified documents were not modified unless separately approved;
- `.com` prospect-facing surfaces were not modified;
- Universal Gateway is not reintroduced as an app runtime dependency;
- `/api/runtime/*` is not mounted unless separately approved;
- event persistence is not activated unless separately approved;
- outbox, replay, subscribers, and event APIs are not activated unless separately approved;
- Browser Voice/Text remains `.team` only;
- Telnyx/PSTN/call-control are excluded from internal browser voice/text runtime.

## 5. Agent Store Boundary Checks

Static checks should fail if agent runtime modules import or call:

- MongoDB clients or models;
- Neo4j drivers or adapters;
- ChromaDB clients or adapters;
- GraphRAG clients;
- direct persistence adapters;
- Gateway fallback clients;
- ad hoc retrieval helpers.

Allowed access path:

- agents consume Context Packets;
- Agent Runtime requests Context Packets from Context Manager;
- Context Manager remains the only Context Packet assembler.

## 6. Context Packet Tests

Required future tests:

- valid packet consumption by Steve;
- valid packet consumption by Michael;
- valid packet consumption by Ivory;
- invalid schema version rejected;
- missing Team Magnificent scope rejected;
- invalid agent/objective pair rejected;
- failed packet blocks substantive guidance;
- degraded packet uses safe response;
- candidate/review-only knowledge excluded by default;
- packet generated outside Context Manager rejected;
- packet-local source references only.

## 7. Runtime Event Envelope Tests

Required future tests:

- envelope schema valid;
- event names are completed facts;
- idempotency key present;
- correlation id present;
- causation id linked when applicable;
- privacy payload rules enforced;
- no raw audio in browser runtime events;
- no event persistence activation;
- no outbox/replay/subscriber/API activation.

## 8. Agent Guardrail Tests

### Steve Success

Tests must prove Steve does not:

- score BAs;
- rank BAs;
- predict success;
- qualify or disqualify BAs;
- make income claims;
- make placement promises.

### Michael Magnificent

Tests must prove Michael does not:

- become prospect-facing;
- use Telnyx/PSTN/call-control internally;
- make income or placement claims;
- retrieve context directly;
- bypass text fallback.

### Ivory

Tests must prove Ivory does not:

- auto-send;
- call;
- automate prospecting;
- qualify leads;
- score prospects;
- use candidate/review-only knowledge by default;
- bypass BA-owned action.

## 9. Browser Voice/Text Tests

Required future tests:

- `.team` only;
- no `apps/com` import or mount;
- microphone permission after explicit BA action only;
- text fallback always available;
- EN/ES language handling;
- no Telnyx/PSTN/call-control imports;
- no raw audio storage in MVP activation.

## 10. Outcome And Guided Action Tests

Required future tests:

- Guided Action suggested;
- accepted by BA;
- declined by BA;
- completed by BA;
- expired;
- failed safely;
- no automatic send;
- no automatic call;
- no external side effect;
- outcome captured as event envelope without persistence activation;
- learning signal does not approve knowledge.

## 11. Review Checklist Before Implementation Approval

Before implementation begins, the Sprint 2 package should show:

- all eight lane planning artifacts exist;
- integration review exists;
- assumptions across lanes are reconciled;
- open questions are listed;
- non-actions are restated;
- test plan is explicit;
- branch protection remains active;
- `gates` required status check remains active;
- Kevin approval is recorded for implementation scope.

## 12. Closeout Checklist For Future Implementation

Future Sprint 2 implementation closeout should require:

- all baseline gates pass;
- focused runtime tests pass;
- static boundary checks pass;
- no unapproved ratified-doc changes;
- no unapproved `.com` changes;
- no unapproved Universal Gateway runtime dependency;
- no unapproved `/api/runtime/*` mount;
- no unapproved event persistence activation;
- branch is merged through protected `main`;
- Sprint 2 governance report records evidence.

## 13. Dependencies

Consumes:

- all Sprint 2 lane plans;
- Sprint 1 closeout;
- S1.7 QA Harness.

Feeds:

- Sprint 2 planning integration review;
- future implementation approval package.

## 14. Explicit Non-Actions

This plan does not:

- modify production code;
- modify ratified documents;
- modify `.com`;
- mount `/api/runtime/*`;
- remove Gateway fallback;
- implement tests;
- implement event persistence, outbox, replay, subscribers, or event APIs;
- approve implementation.
