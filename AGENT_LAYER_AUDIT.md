# Agent Layer Audit

## Executive Summary

The multi-agent layer is substantially implemented and wired. Steve, Michael,
Ivory, orchestration recommendations/events, admin oversight, and cockpit Today’s
Actions are present. The main gap is schema consolidation: the canonical runtime
registry covers only Steve, Michael, and Ivory, while ScriptMaker, admin
recommendations, and an extension contract for future agents are absent.

## Overall Status

**PASS WITH ISSUES**

## Implemented Components

- Separate Steve discovery/success-profile domain, route, and `.team` page.
- Michael training-support projection consuming Steve Success Profile data.
- Ivory relationship and prospect-momentum domains/routes/pages.
- Inert runtime orchestration registry, adapters, Context Packet boundary, and tests.
- BA recommendation feed and durable per-agent interaction events.
- Kevin-only agent oversight route/page.
- Cockpit Today’s Actions derived from callback, follow-up, and expiry signals.

## Missing Components

- Canonical registry entries for ScriptMaker and admin recommendations.
- Explicit future-agent extension metadata/schema.
- The exact event names requested by the supplied audit brief.
- Standalone `dailySuccessCoach.ts` and `/daily-success-coach` route; equivalent
  behavior currently lives in cockpit Today’s Actions and orchestration reads.

## Broken Components

No broken route registration or imports were found in the inspected surfaces.

## Typecheck Results

The preceding P1-58 workspace verification passed `pnpm typecheck`. P1-59 must
rerun it after registry changes.

## Build Results

The preceding production admin build passed. A full build remains a P1-59 gate.

## Steve Audit

Steve is separate from Michael, owns Discovery/Success Interview and Success
Profile generation, explicitly prohibits scoring/ranking/prediction, persists
its artifact, and exposes the handoff as read-only training context.

## Michael Audit

Michael training support consumes Steve’s Success Profile and remains scoped to
BA training/support. The inspected domain explicitly excludes interviewing,
income/cycle claims, and placement promises.

## Ivory Audit

Ivory is connected to relationship context, invitations, and PMV follow-up.
Guardrails prohibit auto-send, qualification/scoring, pressure, income,
placement, and medical claims.

## Agent Orchestration Audit

The repository contains both an inert runtime orchestration layer and an app
recommendation/event layer. The runtime registry is currently limited to three
semantic keys. App recommendations are explainable derived read models. User
interaction events are durable and triple-stacked, but recommendation records
themselves are not stored.

## Daily Success Coach Audit

Today’s Actions is implemented as a derived cockpit card, ordered across
callbacks, due follow-ups, and expiring windows. It is not a standalone agent
domain and does not guarantee exactly three cross-category actions.

## Frontend Integration Audit

Steve and Ivory pages exist. Today’s Actions is connected to the cockpit API.
Admin agent oversight exists. Route registration is present in `server/src/index.ts`.

## Backend Integration Audit

Steve, Michael, Ivory, agents, admin agents, cockpit, and ScriptMaker routes are
mounted. Existing agent domains remain separate rather than being rewritten by
the orchestration layer.

## Shared Types Audit

Runtime shared types define only `steve_success`, `michael_magnificent`, and
`ivory` as `McsAgentKey`. This is the principal P1-59 schema gap.

## Data Persistence Audit

Steve and agent events persist. Agent recommendations are derived on request;
only views/actions/dismissals and handoff interaction events are durable.

## Mongo / Neo4j / Chroma Audit

Agent interaction events use the approved knowledge write path with MongoDB,
Neo4j, and Chroma projections. This audit did not mutate or live-probe app data.

## Governance & Compliance Audit

Inspected code contains explicit no-scoring, no-qualification, no-prediction,
no-income, no-placement, no-auto-outreach, and BA-owned-action boundaries.

## Risk Assessment

The largest risk is identity drift between the three-key runtime registry and
the wider set of agent-like platform services. Event-name drift and the split
between derived recommendations and durable interaction events can also confuse
audit consumers unless documented in the canonical registry.

## Required Fixes

- **P1 High:** Expand the registry schema to cover ScriptMaker and admin
  recommendations without activating new behavior.
- **P1 High:** Define a safe future-agent extension contract and preserve the
  `agentKey` versus configured `agentId` distinction.
- **P2 Medium:** Map existing durable event kinds to the requested audit taxonomy.
- **P2 Medium:** Document that recommendation content is derived while interaction
  outcomes are stored, or approve durable recommendation snapshots separately.

## Recommended Improvements

- Treat Daily Success Coach as a named capability owned by the existing Michael/
  cockpit surfaces unless a later decision authorizes a separate agent identity.
- Keep prompt/version governance in P1-60 rather than embedding prompts in P1-59.

## Priority Matrix

| Priority | Finding |
|---|---|
| P1 High | Registry omits ScriptMaker and admin recommendations |
| P1 High | No explicit future-agent extension contract |
| P2 Medium | Expected event taxonomy is not represented verbatim |
| P2 Medium | Recommendations are derived; only interactions are durable |
| P3 Low | Expected Daily Success Coach filenames differ from current architecture |

## Final Recommendation

Proceed with a narrow P1-59 registry-schema consolidation. Do not rebuild agent
behavior. Preserve existing canonical domains and defer prompt/version ownership
to P1-60.
