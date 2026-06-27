# Backend Alignment Audit

Report date: 2026-06-27

Agent: Backend Alignment Agent

Architecture version: v1.0 frozen

## Scope

This audit reviews server-side alignment against the frozen Runtime Layer and Package 001. It is audit-only and does not modify production backend code.

## Sources Read

- `FOUNDATION_v1.0_FREEZE.md`
- `runtime/AGENT_EVENT_MODEL.md`
- `runtime/AGENT_RUNTIME.md`
- `runtime/KNOWLEDGE_CORE_RUNTIME.md`
- `runtime/KNOWLEDGE_INGESTION_PROTOCOL.md`
- `implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP_UPDATED.md`
- `server/src/index.ts`
- `server/src/domain/`
- `server/src/routes/`
- `server/src/services/`
- `server/src/workers/`
- `graphify-out/GRAPH_REPORT.md`

## Implemented Backend Capabilities Observed

- Express server mounts all major current routes in `server/src/index.ts`.
- Raw-body Telnyx webhook route is mounted before `express.json()`, preserving signature verification.
- Pre-gate and BA-gated route sections are documented in code.
- Persistence helpers exist:
  - `server/src/services/gateway.ts`
  - `server/src/services/tripleStack.ts`
  - `server/src/services/tieredWrite.ts`
  - `server/src/services/projectionOutbox.ts`
  - `server/src/services/chromaCollections.ts`
- Chroma collection registry and boot/write-time guards exist.
- Agent recommendation orchestration exists at `server/src/domain/agents/orchestrator.ts`.
- Admin agent-memory read models exist in `server/src/domain/adminAgentMemory.ts`.
- External runtime services exist for Telnyx, Resend, broadcast queue, VM workers, and pool events.

## Alignment Findings

1. Backend persistence is partially ahead of the frozen Runtime MVP.
   The repo has `tieredWrite()` and `projectionOutbox()` for durability policy, but many existing domain modules still call `tripleStackWrite()` directly. Sprint planning should decide migration order without changing architecture.

2. Current agent events are not the full `agent_event.v1` runtime model.
   `server/src/domain/agents/orchestrator.ts` records recommendation events to `agent_events` and `mcs_agent_events`, but the Package 001 runtime event service expects dedicated runtime event, outbox, subscriber offset, replay, and error models under `server/src/runtime/events/`.

3. Existing agent orchestration is a read-model/recommendation layer.
   It coordinates Steve, Michael, and Ivory surfaces but does not implement the full Agent Runtime backend described in Package 001: agent sessions, turns, templates, context packets, guardrails, state machine, or bilingual templates.

4. Knowledge Core is not implemented as a distinct runtime module.
   Current services support app persistence and projection, but Package 001 expects `server/src/runtime/knowledge/*` models/services and a GraphRAG service boundary.

5. Telnyx is used in external-facing flows, which is acceptable.
   Telnyx appears in callback alerts, webinar/orientation SMS, prospect magic links, VM/broadcast, and webhook handling. This is consistent with the external-runtime boundary, but Sprint 1 must explicitly guard against using Telnyx for internal browser voice agents.

6. Server route namespace for Runtime MVP is not present.
   Package 001 defines `/api/runtime/*` routes. Existing routes are app-domain routes (`/api/agents`, `/api/ivory`, `/api/steve`, etc.), so runtime routes should be planned as additive, not replacements.

## Persistence Risks

- Direct `tripleStackWrite()` remains sequential and optional for Neo4j/Chroma per input shape, while Package 001 expects runtime components to preserve scope and durable knowledge lineage.
- `tieredWrite()` explicitly says migration is additive and still pending for multiple caller categories.
- Gateway initialization failure in this session prevented live verification of Mongo/Neo4j/Chroma behavior.

## Backend Blockers

- Gateway V2 unavailable through MCP during audit, so live store consistency could not be audited.
- Runtime event and knowledge modules are absent as a dedicated `server/src/runtime/` tree.
- No Mongoose setup was located; the existing server uses Universal Gateway calls. Package 001 mentions Mongo/Mongoose, so Sprint 1 must either map the frozen architecture to the existing Gateway pattern or ask Kevin/Claude governance to confirm the implementation standard.

## Recommended Backend Sequencing

1. Create a backend implementation map before code: existing app-domain modules versus required `server/src/runtime/*` modules.
2. Start with shared runtime identity and event envelope types.
3. Add a runtime event service/outbox plan that reuses Gateway/tiered-write patterns where allowed.
4. Add Knowledge Core service boundaries before any agent direct retrieval.
5. Keep Telnyx isolated to external runtime flows.
