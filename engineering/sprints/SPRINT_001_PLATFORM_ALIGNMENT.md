# Sprint 001 - Platform Alignment

Report date: 2026-06-27

Agent: Integration Planning Agent

Architecture version: v1.0 frozen

## Status

Planned only. Not approved for implementation.

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

Resolve implementation mapping:

- Option to confirm: use existing Gateway/tiered-write adapter boundary for runtime persistence.
- Risk to resolve: Package 001 says Mongo/Mongoose, but repo currently uses Universal Gateway calls.

Acceptance:

- Decision is documented before backend implementation.
- No architecture redesign occurs.
- If governance says ACR is needed, stop and route through ACR process.

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

- Gateway V2 MCP connector unavailable during audit.
- Persistence mapping needs governance confirmation.
- Test framework not selected.
- Claude governance audit not yet run.
- Kevin approval not yet granted.

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

Stop now. Do not implement Sprint 1 until Kevin approves this plan.
