# Sprint 001 - Platform Alignment

Report date: 2026-06-27

Agent: Integration Planning Agent

Architecture version: v1.0 frozen

## Status

APPROVED for implementation planning — Kevin L. Gardner, 2026-06-27 (decision `dec_sprint1_approved_20260627`; governance audit `engineering/reports/ENGINEERING_WORKFLOW_AUDIT.md` = PASS).

S1.3 is CLOSED / VERIFIED as of 2026-06-27. Runtime persistence direct adapter migration is complete under the approved flags:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=direct
```

MongoDB, Neo4j, and ChromaDB are verified through direct runtime adapter paths. Gateway HTTP persistence fallback was later retired by ACR-0009; Universal Gateway remains MCP/developer tooling, not app runtime persistence. Caller sites were not rewritten. Ratified architecture documents and `.com` prospect-facing surfaces were not modified. Closeout governance record: `engineering/reports/S1_3_CLOSEOUT_GOVERNANCE_RECORD.md`.

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

RESOLVED by ACR-0007 (Approved 2026-06-27). Runtime persistence is **direct** MongoDB (Mongoose) + Neo4j + Chroma, through dedicated adapters and service layers. The Universal Gateway is developer tooling only and is not a runtime dependency.

S1.3 execution is CLOSED / VERIFIED as of 2026-06-27:

- MongoDB direct adapter path verified.
- Neo4j direct adapter path verified.
- ChromaDB direct adapter path verified.
- Generated Mongo `$jsonSchema` validator determinism verified.
- GPU embedder required behavior verified.
- No CPU fallback verified.
- Gateway HTTP fallback was preserved at this checkpoint; ACR-0009 later retired it.
- Rollback flags verified.
- Existing caller sites preserved behind the `gatewayCall(tool, action, params)` seam.

Acceptance:

- Migration plan documented before backend code.
- No architecture redesign (this aligns implementation to the already-ratified v1.0 architecture).
- Triple-stack semantics preserved (all three stores per write, read-back verified).
- Code execution completed under ACR-0007 gates; Kevin approvals and merges recorded through the S1.3 verification reports.
- Gateway HTTP persistence fallback retirement is superseded by ACR-0009.

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
