# GraphRAG And Context Manager Canary Criteria

Status: required before live GraphRAG or Context Manager expansion.
Created: 2026-07-11.

GraphRAG and Context Manager are governed design targets. They are not general live-enabled defaults. Production live flags remain off until a narrow canary is approved and verified.

## Current Safe Defaults

- `GRAPHRAG_PERSISTENCE_ENABLED=false`
- `MCS_CONTEXT_MANAGER_LIVE_ENABLED=false`
- `STEVE_CONTEXT_MANAGER_LIVE_ENABLED=false`
- `RUNTIME_AUDIT_PERSISTENCE_ENABLED=false`
- `OUTCOME_CAPTURE_PERSISTENCE_ENABLED=false`
- `LEARNING_CANDIDATE_PERSISTENCE_ENABLED=false`

Michael runtime flags are directly-read exact-string kill switches and default off when absent:

- `MICHAEL_RUNTIME_ROUTE_ENABLED`
- `MICHAEL_RUNTIME_RESPONSE_ENABLED`
- `MICHAEL_RUNTIME_TRACE_ENABLED`

## Canary Requirements

Before any live enablement:

1. Name one narrow approved-knowledge domain.
2. Document allowed agents, routes, and user-visible behavior.
3. Define Context Packet completeness, degraded, and failed states.
4. Prove retrieval uses approved knowledge only, with source lineage and citations.
5. Prove permission filters by team, BA, language, lifecycle state, and readiness.
6. Prove agents consume Context Packets only and do not directly query stores.
7. Prove no scoring, classification, qualification, pressure, income claims, or prospect-facing AI language.
8. Add English and Spanish parity tests where the agent can answer in both languages.
9. Add admin/runtime diagnostics showing degraded reasons and retrieval audit.
10. Add rollback steps that return the live flags to false.

## Verification Gates

- Unit tests for Context Packet shape and degraded reasons.
- Integration test for approved-knowledge retrieval and source lineage.
- Forbidden-output tests for agent responses.
- Admin diagnostic readback for retrieval audit.
- Manual canary smoke test with flags explicitly set and inherited DB/env values stripped.

## Rollback

Set all live flags back to false, restart the server, and verify the affected agent returns the approved degraded/fallback response rather than live Context Manager output.

