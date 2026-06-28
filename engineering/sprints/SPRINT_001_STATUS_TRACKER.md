# Sprint 1 Status Tracker

Date: 2026-06-28

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

## Current Sprint State

Sprint 1 remains governed by the frozen v1.0 architecture and the Sprint 1 platform-alignment boundaries. This tracker records status only; it does not approve Gateway fallback removal, new runtime architecture implementation, or Sprint 2 work.

Canonical tracker path:

```text
engineering/sprints/SPRINT_001_STATUS_TRACKER.md
```

## Workstream Status

| Item | Workstream | Status | Evidence / Next Step |
|---|---|---:|---|
| S1.1 | Shared Runtime Contract Plan | PLANNING COMPLETE | See `engineering/plans/SHARED_RUNTIME_CONTRACT_PLAN.md`. |
| S1.2 | Backend Runtime Boundary Plan | PLANNING COMPLETE | See `engineering/plans/BACKEND_RUNTIME_BOUNDARY_PLAN.md`. |
| S1.3 | Runtime Persistence Direct Adapter Migration | CLOSED / VERIFIED | See `engineering/reports/S1_3_CLOSEOUT_GOVERNANCE_RECORD.md` and `engineering/reports/S1_3_FINAL_DIRECT_MODE_CLOSEOUT.md`. |
| S1.4 | Runtime Event Foundation Plan | PLANNING COMPLETE | See `engineering/plans/RUNTIME_EVENT_FOUNDATION_PLAN.md`. |
| S1.5 | Context Packet Foundation Plan | PLANNING COMPLETE | See `engineering/plans/CONTEXT_PACKET_FOUNDATION_PLAN.md`. |
| S1.6 | Browser Voice/Text Foundation Plan | PLANNING COMPLETE | See `engineering/plans/BROWSER_VOICE_FOUNDATION_PLAN.md`. |
| S1.7 | QA Harness Plan | PLANNING COMPLETE | See `engineering/plans/QA_HARNESS_PLAN.md`. |

## S1.3 Closure Record

S1.3 remains CLOSED / VERIFIED as of 2026-06-28.

Final approved runtime flags:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=direct
```

Confirmed:

- MongoDB is verified through the direct runtime adapter path.
- Neo4j is verified through the direct runtime adapter path.
- ChromaDB is verified through the direct runtime adapter path.
- Gateway HTTP fallback remains in place and must not be removed yet.
- Caller sites were not rewritten.
- Ratified architecture documents were not modified.
- `.com` prospect-facing surfaces were not modified.

## Sprint 1 Planning Package Status

The Sprint 1 planning package is complete with conditions recorded by `engineering/reports/SPRINT_001_PLANNING_INTEGRATION_REVIEW.md`.

Planning-complete items:

1. S1.1 - Shared Runtime Contract Plan.
2. S1.2 - Backend Runtime Boundary Plan.
3. S1.4 - Runtime Event Foundation Plan.
4. S1.5 - Context Packet Foundation Plan.
5. S1.6 - Browser Voice/Text Foundation Plan.
6. S1.7 - QA Harness Plan.

Closed / verified item:

1. S1.3 - Runtime Persistence Direct Adapter Migration.

## Pre-Implementation Decisions And Open Items

These items must be resolved before implementation begins:

1. Canonical event timestamp fields.
   - Current planning state: S1.4 uses `createdAt` and notes that the ratified event model names `occurredAt` and `recordedAt`.
   - Required decision: define whether implementation uses `occurredAt` / `recordedAt` directly, uses `createdAt` as an API-facing alias, or carries all three with distinct meanings.
   - Governance rule: do not modify ratified documents during this cleanup.

2. Canonical agent identity naming.
   - Current planning state: S1.1 uses `AgentKey`; S1.5 uses `agentId` with literal agent keys; S1.6 uses `agentKey`.
   - Required decision: define whether `agentKey` names the stable agent type (`steve_success`, `michael_magnificent`, `ivory`) and `agentId` names a concrete runtime instance/session participant, or choose one canonical field.

3. Vitest-compatible replacement for `--runInBand`.
   - Current planning state: S1.7 lists `pnpm --filter @momentum/server test -- --runInBand`, but the server harness is Vitest.
   - Required decision: replace with a Vitest-compatible serial/live-test command during QA implementation, or omit the serial flag until a dedicated integration script exists.

4. Runtime feature flag names and defaults for the first implementation slice.
   - Current planning state: S1.2 proposes safe default-off runtime flags, including `RUNTIME_ENABLED=false`, `RUNTIME_API_ENABLED=false`, `RUNTIME_CONTEXT_MANAGER_ENABLED=false`, `RUNTIME_AGENT_RUNTIME_ENABLED=false`, `RUNTIME_BROWSER_VOICE_ENABLED=false`, and `RUNTIME_QA_HARNESS_ENABLED=false`.
   - Required decision: confirm the initial implementation slice uses these names and defaults, or record a revised flag set before production code begins.

## Recommended Next Governance-Safe Workstream

Recommended first implementation candidate after Kevin approval: S1.1 - Shared Runtime Contracts.

Reason: every remaining implementation path depends on shared scope, ID, language, event, context, agent, browser-runtime, and QA fixture contracts.

Recommended companion workstream after S1.1: QA harness scaffolding, limited to the accepted S1.7 gates and static boundary checks.

## Explicit Non-Actions

- Do not begin Gateway fallback removal.
- Do not begin new runtime architecture work.
- Do not modify ratified documents.
- Do not modify production code.
- Do not modify `.com` prospect-facing surfaces.
