# S1.1 - Shared Runtime Contract Plan

Date: 2026-06-27

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

Status: PLANNING ONLY

## Governance Context

S1.3 Runtime Persistence Direct Adapter Migration is CLOSED / VERIFIED.

MongoDB, Neo4j, and ChromaDB are now verified through direct runtime adapter paths.

Gateway HTTP fallback remains in place and must not be removed by this workstream.

Remaining Sprint 1 work is planning/governance only. This document does not begin Sprint 2, redesign Momentum, edit ratified documents, modify governance records, or touch `.com` prospect-facing surfaces.

## 1. Purpose

The shared runtime contract layer defines the TypeScript contracts future runtime modules use to agree on identity, scope, language, IDs, event envelopes, context packets, knowledge references, outcomes, and QA fixtures.

The layer belongs under `packages/shared/src/runtime/` so server runtime modules, agent runtime modules, context manager, event model, browser voice/text runtime, and QA harness code can import the same definitions without duplicating local wire shapes.

This is a contract layer only. It should not own persistence, database clients, runtime behavior, agent prompts, Context Manager retrieval, event emission, browser UI, or Gateway fallback logic.

## 2. Scope

In scope:

- Additive shared TypeScript types and constants for runtime identity, IDs, language, events, context packets, knowledge, outcomes, browser text/voice, and test fixtures.
- Runtime scope contracts for tenant, Team Magnificent, Brand Ambassador, agent, request, and session identity.
- EN/ES language metadata contracts.
- Validation helpers or schemas only when they remain shared, pure, and dependency-light.
- Barrel exports that preserve existing `@momentum/shared` import compatibility.
- Test contracts future server/runtime tests can assert.

Out of scope:

- Production runtime implementation.
- MongoDB, Neo4j, ChromaDB, Mongoose, Chroma, or Neo4j driver code.
- Gateway fallback removal.
- New server routes.
- Agent behavior, prompts, or LLM integration.
- `.com` prospect-facing changes.
- Ratified `/runtime`, `/constitution`, `/organization`, or freeze document edits.
- Sprint 2 work.

## 3. Proposed Module Layout

Future implementation should create the runtime folder additively:

```text
packages/shared/src/runtime/
  index.ts
  identity.ts
  language.ts
  ids.ts
  events.ts
  context-packets.ts
  agents.ts
  browser-runtime.ts
  knowledge.ts
  outcomes.ts
  validation.ts
  qa.ts
```

Recommended ownership:

- `identity.ts`: tenant/team/BA/session/request/agent scope types.
- `language.ts`: EN/ES language codes, fallback status, translation metadata.
- `ids.ts`: branded ID aliases and ID prefix constants.
- `events.ts`: `agent_event.v1` envelope and source/type unions.
- `context-packets.ts`: `context_packet.v1` shared envelope, references, audit summaries, degraded/failed states.
- `agents.ts`: `AgentKey`, optional `AgentId`, agent mode and task types.
- `browser-runtime.ts`: browser voice/text mode, transcript references, no-Telnyx boundary types.
- `knowledge.ts`: knowledge IDs, candidate IDs, approved/review lifecycle references.
- `outcomes.ts`: outcome IDs, learning signal references, guided-action result references.
- `validation.ts`: pure validation functions or schema exports.
- `qa.ts`: shared QA fixture contracts and assertion result shapes.

`packages/shared/src/index.ts` should later export `./runtime/index.js` additively. Existing exports must remain untouched.

## 4. Shared Types Needed

The contract layer should introduce branded string aliases or equivalent nominal wrappers for:

- `TenantId`
- `TeamId`
- `BaId`
- `AgentId`
- `RequestId`
- `SessionId`
- `RuntimeEventId`
- `ContextPacketId`
- `ContextRequestId`
- `KnowledgeId`
- `KnowledgeCandidateId`
- `OutcomeId`
- `CorrelationId`
- `CausationId`
- `IdempotencyKey`

It should also define:

- `RuntimeLanguage = "en" | "es"`
- `AgentKey = "steve_success" | "michael_magnificent" | "ivory"`
- `RuntimeSchemaVersion = "agent_event.v1" | "context_packet.v1"`
- `RuntimeMode = "browser_voice" | "browser_text" | "mixed"`

## 5. Team Magnificent Scope Rule

Wherever `baId` exists, Team Magnificent scope must be explicit.

The shared contract should define one reusable scope block:

```ts
type TeamMagnificentScope = {
  tenantId: TenantId;
  teamId: TeamId;
  teamKey: "team_magnificent";
  teamName: "Team Magnificent";
};
```

Any BA-scoped record should extend:

```ts
type BaRuntimeScope = TeamMagnificentScope & {
  baId: BaId;
};
```

Validation must fail closed if a payload has `baId` without `tenantId`, `teamId`, `teamKey: "team_magnificent"`, and `teamName: "Team Magnificent"`.

## 6. EN/ES Language Support

Language support must be first-class, not an optional display concern.

Shared contracts should include:

- primary runtime language,
- detected input language,
- BA/user preference language,
- fallback language,
- fallback reason,
- translation status,
- machine-translation marker,
- reviewed/unreviewed translation status.

Rules:

- English and Spanish are valid runtime languages.
- Fallback must be explicit.
- Machine translation must be marked.
- Unreviewed translation must not be represented as approved organizational knowledge.
- Runtime events, context packets, agent sessions, browser turns, knowledge references, and outcomes must preserve language metadata.

## 7. Additive-Only Export Strategy

Implementation must be additive:

- Create new files under `packages/shared/src/runtime/`.
- Add only one new export line to `packages/shared/src/index.ts`.
- Do not edit or reorder existing exports.
- Do not move existing shared types from `types.ts`.
- Do not change public contracts used by current apps/server code.
- If a future shared type duplicates an existing type name, use a runtime-specific name rather than changing the existing export.

This preserves compatibility for all current `@momentum/shared` consumers.

## 8. Compatibility With Existing Shared Package Exports

Current shared exports include brand, compliance, rules, general types, reporting, product catalog, admin live ops, broadcast, tenant, and leaders.

The runtime contract should sit beside these modules, not underneath them. Runtime modules may import existing compliance/rules constants if necessary, but should not make the existing modules depend on runtime.

Compatibility expectations:

- `@momentum/shared` continues to resolve all current imports.
- Runtime consumers can import either from `@momentum/shared` or `@momentum/shared/runtime` if package exports later support subpath imports.
- No `.team` TS6059 workaround should be worsened; runtime contracts should compile through the existing shared build pipeline before downstream apps consume them.

## 9. Support For Runtime Foundations

Runtime Event Foundation:

- Uses `RuntimeEventId`, `CorrelationId`, `CausationId`, `IdempotencyKey`, `AgentKey`, `RuntimeLanguage`, and `BaRuntimeScope`.
- Enforces `schemaVersion: "agent_event.v1"`.
- Requires Team Magnificent scope on BA-scoped events.

Context Packet Foundation:

- Uses `ContextPacketId`, `ContextRequestId`, `RequestId`, `SessionId`, `AgentKey`, `RuntimeLanguage`, and `BaRuntimeScope`.
- Enforces `schemaVersion: "context_packet.v1"`.
- Carries retrieval audit, language fallback, and degraded/failed packet status.

Agent Runtime:

- Uses `AgentId`, `AgentKey`, `SessionId`, `RuntimeMode`, `RuntimeLanguage`, and shared scope.
- Keeps Steve, Michael, and Ivory aligned to the same session and context contracts.
- Keeps agents behind approved runtime services, not direct store clients.

Browser Voice/Text Runtime:

- Uses `SessionId`, turn/transcript references, runtime mode, language metadata, and event IDs.
- Preserves the internal-runtime rule: browser voice/text does not use Telnyx.
- Supports text fallback as a first-class mode.

QA Harness:

- Uses shared fixture types and assertion result contracts.
- Tests Team Magnificent scope, event envelope, context packet schema, language fallback, no-Telnyx browser boundary, no direct agent store access, direct adapter health, and Gateway fallback preservation.

## 10. Validation Strategy

Validation should be pure and layered:

1. Compile-time TypeScript checks for branded IDs and discriminated unions.
2. Runtime schema validation for external inputs and persisted runtime envelopes.
3. Scope validation that rejects `baId` without Team Magnificent scope.
4. Schema-version validation for `agent_event.v1` and `context_packet.v1`.
5. Language validation for `en` / `es` and explicit fallback metadata.
6. Boundary validation for no Telnyx in internal browser runtime contracts.
7. Privacy validation hooks for event/context payloads that reference private text by ID instead of embedding unnecessary content.

Shared validation must not import server-only dependencies or database clients.

## 11. Test Strategy

Future implementation tests should include:

- Shared package typecheck and build.
- Runtime identity contract tests.
- Team Magnificent scope negative tests.
- EN/ES language metadata tests.
- Event envelope schema tests.
- Context packet schema tests.
- Agent key/session/request ID tests.
- Browser voice/text no-Telnyx static boundary tests.
- QA fixture tests proving contracts can model direct adapter health and Gateway fallback preservation without invoking production code.

Required baseline gates for implementation:

```powershell
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```

## 12. Risks And Mitigations

Risk: shared contracts drift from ratified runtime documents.

Mitigation: implement only contracts directly mapped to v1.0 runtime documents; any architectural change requires ACR.

Risk: `baId` appears without Team Magnificent scope.

Mitigation: centralize `BaRuntimeScope`; add fail-closed validation and tests.

Risk: runtime types break existing shared consumers.

Mitigation: additive-only files and barrel export; no existing export edits or renames.

Risk: contracts accidentally imply direct agent database access.

Mitigation: shared types describe boundaries and references only; server adapters remain outside shared.

Risk: Gateway fallback is removed or weakened.

Mitigation: this plan explicitly preserves fallback and requires QA assertions for it.

Risk: bilingual support is treated as copy-only.

Mitigation: language metadata is required on events, context packets, agent sessions, browser turns, knowledge references, and outcomes.

## 13. Required Acceptance Criteria

The future S1.1 implementation is acceptable only when:

- `packages/shared/src/runtime/` exists with additive contract files.
- Existing shared exports remain compatible.
- Runtime IDs are typed or branded consistently.
- `RuntimeLanguage` supports exactly `en` and `es` for v1.0.
- `BaRuntimeScope` requires tenant and Team Magnificent scope.
- Any payload with `baId` but missing Team Magnificent scope fails validation.
- `agent_event.v1` and `context_packet.v1` schema versions are represented.
- Runtime Event Foundation, Context Packet Foundation, Agent Runtime, Browser Voice/Text Runtime, and QA Harness can import the contracts.
- No server route, app surface, persistence adapter, Gateway fallback, or `.com` code is changed as part of the contract-only implementation unless separately approved.
- Typecheck/build pass for the shared package and downstream consumers.

## 14. Confirmation: No Production Code Changed

This S1.1 planning step changes no production code.

The only intended file created by this workstream is:

```text
engineering/plans/SHARED_RUNTIME_CONTRACT_PLAN.md
```

## 15. Confirmation: No Ratified Documents Modified

This S1.1 planning step does not modify ratified documents, organization governance records, ACR records, runtime source-of-truth documents, constitution documents, or freeze documents.

This document is planning Markdown only.
