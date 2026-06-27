# Sprint 001 - Platform Alignment

Report date: 2026-06-27

Agent: Integration Planning Agent

Architecture version: v1.0 frozen

## Status

APPROVED for implementation planning — Kevin L. Gardner, 2026-06-27 (decision `dec_sprint1_approved_20260627`; governance audit `engineering/reports/ENGINEERING_WORKFLOW_AUDIT.md` = PASS). Planning artifacts only — no production code. The S1.3 persistence migration is planned under ACR-0007 (Approved); migration code execution remains gated (Implementing → Verified with persistence read-back → Merged, Kevin merges).

## Objective

Prepare the repository for Package 001 implementation by aligning platform contracts, unresolved implementation assumptions, and verification gates before production runtime code begins.

## Scope

Sprint 1 is a platform-alignment sprint. It does not implement Steve, Michael, Ivory runtime behavior yet.

## Required Pre-Implementation Gates

1. Claude governance audit of:
   - all reports in `engineering/audits/`
   - `engineering/plans/IMPLEMENTATION_MASTER_PLAN.md`
   - this Sprint 1 plan
2. Kevin explicit approval to begin implementation.
3. Branch creation after approval.
4. Confirmation of Gateway-native versus Mongoose-backed implementation mapping for Package 001 backend persistence.
5. Test harness decision.

## Planned Work Items

### S1.1 Shared Runtime Contract Plan

Define implementation paths for:

- `packages/shared/src/runtime/team.ts`
- `packages/shared/src/runtime/contextPacket.ts`
- `packages/shared/src/runtime/agentEvents.ts`
- `packages/shared/src/runtime/agentSession.ts`
- `packages/shared/src/runtime/knowledge.ts`
- `packages/shared/src/runtime/journal.ts`
- `packages/shared/src/runtime/learning.ts`
- `packages/shared/src/runtime/knowledgeEvolution.ts`
- `packages/shared/src/runtime/browserVoice.ts`
- `packages/shared/src/runtime/index.ts`

Acceptance:

- Team Magnificent scope is mandatory wherever `baId` exists.
- Runtime language includes English and Spanish.
- Types are additive and do not break current shared exports.

### S1.2 Backend Runtime Boundary Plan

Define additive backend module layout:

- `server/src/runtime/events/`
- `server/src/runtime/knowledge/`
- `server/src/runtime/context/`
- `server/src/runtime/agents/`
- `server/src/runtime/journal/`
- `server/src/runtime/ingestion/`
- `server/src/runtime/learning/`
- `server/src/runtime/knowledge-evolution/`

Acceptance:

- Existing app-domain routes are not replaced.
- Runtime routes are additive under `/api/runtime/*`.
- Agents do not access stores directly.
- Telnyx is excluded from internal runtime modules.

### S1.3 Persistence Mapping Decision

RESOLVED by ACR-0007 (Approved 2026-06-27). Runtime persistence is **direct** MongoDB (Mongoose) + Neo4j + Chroma, through dedicated adapters and service layers. The Universal Gateway is developer tooling only and is not a runtime dependency. This sprint PLANS the migration (it does not execute it):

- Plan direct `mongo` / `neo4j` / `chroma` adapters behind the existing service boundary.
- Plan repointing the internals of `gatewayCall` / `tripleStackWrite` / `tieredWrite` at the direct adapters; the 405 callers stay unchanged (incremental, no big-bang rip-out).

Acceptance:

- Migration plan documented before any backend code.
- No architecture redesign (this aligns the implementation to the already-ratified v1.0 architecture).
- Triple-stack semantics preserved (all three stores per write, read-back verified).
- Code execution stays under ACR-0007 gates; Kevin merges.

### S1.4 Runtime Event Foundation Plan

Define event model implementation details:

- `schemaVersion: "agent_event.v1"`
- idempotency key
- correlation ID
- causation ID
- privacy-safe payloads
- outbox
- replay boundaries
- subscriber offsets

Acceptance:

- Aligns with `runtime/AGENT_EVENT_MODEL.md`.
- Separates current recommendation events from runtime events.

### S1.5 Context Packet Foundation Plan

Define `context_packet.v1` validation and builder approach.

Acceptance:

- Context Manager is the only context-packet assembler.
- Candidate/review-only knowledge excluded by default.
- Telnyx boundary included in runtime rules.
- Degraded and failed packet behavior defined.

### S1.6 Browser Voice/Text Foundation Plan

Define client runtime layout and verification plan.

Acceptance:

- Lives inside `.team`.
- Permission requested only after BA action.
- Text fallback always available.
- English/Spanish language selector included.
- No Telnyx/PSTN dependency.

### S1.7 QA Harness Plan

Select verification tooling and first tests.

Acceptance:

- `pnpm typecheck` and `pnpm build` remain mandatory gates.
- Test harness selected before implementation.
- First tests cover Team Magnificent scope, event envelope, Telnyx boundary, and context packet schema.

## Out of Scope

- No production code changes before approval.
- No ratified document edits.
- No ACR application.
- No .com prospect surface changes.
- No agent behavior implementation.
- No Knowledge Evolution implementation.

## Sprint 1 Blockers

Resolved as of 2026-06-27:

- ~~Gateway V2 MCP connector unavailable during audit.~~ RESOLVED — verified live (Mongo/Neo4j/Chroma reachable); was a session-local tooling glitch, not a production issue (see `PERSISTENCE_AND_GATEWAY_CLARIFICATION.md`).
- ~~Persistence mapping needs governance confirmation.~~ RESOLVED — ACR-0007 (Approved): direct stores.
- ~~Claude governance audit not yet run.~~ RESOLVED — `ENGINEERING_WORKFLOW_AUDIT.md` = PASS.
- ~~Kevin approval not yet granted.~~ RESOLVED — approved 2026-06-27 (`dec_sprint1_approved_20260627`).

Remaining (in-sprint planning items, not blockers):

- Test framework not yet selected — to be decided in S1.7.

## Verification Plan

After Sprint 1 implementation is approved and completed:

- `pnpm typecheck`
- `pnpm build`
- selected runtime unit tests
- static import check for no Telnyx in internal runtime modules
- git status review

## Recommended Next Action

Send this audit package to Claude for governance review, then ask Kevin to approve or revise Sprint 1.

## Stop Condition

Approved for PLANNING 2026-06-27. Sprint 1 may produce platform-alignment plans, paths, and decisions (including the S1.3 migration plan) — no production code. Production runtime code and the persistence migration do not begin until their work is planned here and executed under ACR-0007's gates, with Kevin merging.
