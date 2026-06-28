# S1.7 QA Harness Plan

Date: 2026-06-27

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

Status: PLANNING ONLY

## Scope

This plan defines the QA harness strategy for Sprint 1 and future runtime implementation. It does not create test code, production code, runtime modules, Gateway fallback removal work, or ratified document edits.

S1.3 Runtime Persistence Direct Adapter Migration is CLOSED / VERIFIED. The current verified runtime state is:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=direct
```

Gateway HTTP fallback remains in place and must be tested as preserved until Kevin separately approves fallback removal.

## QA Harness Strategy

Sprint 1 QA should use a layered harness:

1. Static gates run first for every implementation change.
2. Server unit and contract tests run next using the existing `@momentum/server` Vitest harness.
3. Integration tests run only where the touched work crosses store, Gateway fallback, browser/runtime, or app/server boundaries.
4. Live-store verification is reserved for cutover, persistence, and rollback work where mocked tests cannot prove the behavior.
5. Every future verification report records commands, flags, live dependencies, results, limitations, and rollback posture.

The harness must stay additive. Runtime implementation may add test files and test scripts later under separate approval, but this S1.7 plan does not add them.

## Required Test Categories

- TypeScript compile and package boundary checks.
- Production build checks.
- Server unit tests.
- Runtime contract tests.
- Persistence adapter contract tests.
- Integration tests for cross-store and fallback behavior.
- Static boundary tests.
- Browser/runtime component tests once browser voice/text implementation is approved.
- Live-store smoke tests where direct persistence, read-back, or rollback behavior is under review.
- Compliance guard tests for `.com` exclusion and prospect-surface non-regression when relevant.

## Required Commands

Mandatory base gates:

```powershell
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```

Integration commands where applicable:

```powershell
pnpm --filter @momentum/server test -- --runInBand
```

Future integration commands may be added only when the corresponding harness exists. Until then, live integration checks should be run as explicit, logged harnesses under `.logs/` and summarized in `engineering/reports/`.

## First Acceptance Tests

### Team Magnificent Scope

Purpose: prove every BA-scoped runtime record includes mandatory Team Magnificent scope.

Initial assertions:

- Records with `baId` also carry `teamId` or equivalent Team Magnificent scope.
- Cross-team or missing-team runtime payloads fail validation.
- Test fixtures never use generic tenant-only scope when BA scope is present.

### Runtime Event Envelope

Purpose: prove `agent_event.v1` events have a stable envelope before event runtime implementation begins.

Initial assertions:

- `schemaVersion` equals `agent_event.v1`.
- Event id is present and stable.
- Idempotency key is required.
- Correlation id is required.
- Causation id is optional but validated when present.
- Payload is privacy-safe and does not carry raw secrets.
- Unknown envelope versions fail closed.

### Context Packet Schema

Purpose: prove `context_packet.v1` validation and builder outputs are stable.

Initial assertions:

- Packet has version, team scope, BA/session/agent identity, language, runtime rules, and retrieval audit.
- Candidate or review-only knowledge is excluded by default.
- Degraded packet state is explicit.
- Failed packet state is explicit and does not return partial unsafe context.
- Telnyx boundary rules are included in runtime guardrails.

### Telnyx Exclusion From Internal Browser Voice/Text Runtime

Purpose: prove internal browser voice/text runtime never imports or depends on Telnyx.

Initial assertions:

- Internal runtime browser voice/text modules have no imports from Telnyx services, Telnyx routes, Telnyx middleware, or PSTN call-control code.
- Static scan fails if runtime browser voice/text files reference `telnyx`, `TELNYX_`, PSTN call routing, or webhook verification.
- Browser voice/text fallback is browser-local text first and does not require phone infrastructure.

### Agent-Store Access Boundary

Purpose: prove agents do not access MongoDB, Neo4j, ChromaDB, Mongoose, or direct adapters directly.

Initial assertions:

- Agent runtime modules do not import `mongoose`, `neo4j-driver`, direct Chroma adapter modules, persistence connection modules, or low-level store clients.
- Agents call approved runtime services only.
- Persistence writes remain centralized behind service boundaries.
- Store access tests should fail on direct import or direct client creation inside agent modules.

### Gateway Fallback Preservation

Purpose: prove the Gateway HTTP fallback remains available while direct persistence is active.

Initial assertions:

- `gatewayCall(tool, action, params)` can route to fallback when master or per-store flags require Gateway mode.
- Direct HTTP Gateway calls still succeed for representative read/list operations.
- Unsupported tools fail safely through the existing `GatewayError` compatibility surface.
- No test assumes fallback removal.

### Direct Persistence Adapter Health

Purpose: prove direct adapters remain healthy under the verified S1.3 state.

Initial assertions:

- MongoDB direct health and read-back pass.
- Neo4j direct health and read-back pass.
- ChromaDB direct health and search/read-back pass.
- GPU embedder health passes when Chroma direct mode is enabled.
- No CPU fallback exists for embeddings.
- Per-store rollback flags can route a store back to Gateway without caller-site changes.

## Test Data Rules

- Test records must use unique run ids.
- Test ids must include the workstream prefix, for example `s1_7_qa_`.
- Test data must be clearly marked with `kind`, `runId`, `createdAt`, and `source`.
- Live-store tests must clean up disposable test data when cleanup is safe.
- If a successful live verification record is intentionally retained as evidence, the report must say so.
- Fixtures must not contain real secrets, real prospect PII, or real customer-sensitive data.
- `.com` prospect-facing copy fixtures must not include income claims, placement promises, AI prospecting language, current team headcount, or THREE branding.

## Environment Flag Rules

- Every verification report must state the effective persistence flags.
- Default mode tests must prove direct dispatch remains gated by `PERSISTENCE_DIRECT_ENABLED`.
- Direct-mode tests must explicitly set or confirm:

```text
PERSISTENCE_DIRECT_ENABLED=true
PERSISTENCE_MONGO_MODE=direct
PERSISTENCE_NEO4J_MODE=direct
PERSISTENCE_CHROMA_MODE=direct
GPU_EMBEDDER_REQUIRED=true
```

- Rollback tests must use fresh process/env parses when testing flag behavior.
- Secrets must never be written to reports, committed files, or console excerpts.
- Local `.env` changes remain untracked.

## Rollback Verification Rules

Rollback verification must prove both master and per-store controls:

- Master rollback:

```text
PERSISTENCE_DIRECT_ENABLED=false
```

Expected result: MongoDB, Neo4j, and ChromaDB resolve to Gateway mode regardless of per-store direct flags.

- Per-store rollback:

```text
PERSISTENCE_MONGO_MODE=gateway
PERSISTENCE_NEO4J_MODE=gateway
PERSISTENCE_CHROMA_MODE=gateway
```

Expected result: only the selected store routes to Gateway while other approved direct stores remain direct.

Rollback tests must also confirm no caller-site changes are required.

## Reporting Format

Future verification reports under `engineering/reports/` must include:

- Title, date, sprint/workstream, and scope.
- Approved flags and effective runtime snapshot.
- Commands run.
- Test categories covered.
- Live dependencies used.
- Results table with PASS / LIMITED / FAIL.
- Failures, skipped tests, and limitations.
- Rollback verification.
- Confirmation of non-actions:
  - no production code beyond the approved workstream,
  - no ratified document edits,
  - no Gateway fallback removal unless separately approved,
  - no `.com` prospect-surface changes unless separately approved.
- Recommendation for the next governance-safe action.

## PASS / LIMITED / FAIL Definitions

PASS:

- The required command or test completed successfully.
- Expected assertions were proven.
- Any warnings are understood and do not affect the tested contract.

LIMITED:

- The test could not fully execute because an external service, live dependency, credential, or approved harness was unavailable.
- The limitation is documented with the missing dependency and the residual risk.
- LIMITED is not a substitute for PASS when live cutover or rollback approval depends on the result.

FAIL:

- The command exits nonzero.
- An assertion fails.
- A required dependency is present but behaves incompatibly.
- A boundary is violated, such as direct agent store access, Telnyx import into internal browser runtime, missing Team Magnificent scope, missing rollback behavior, or Gateway fallback breakage.

## Explicit Non-Actions

- No production code.
- No ratified document edits.
- No Gateway fallback removal.
- No `.com` prospect-surface changes.
- No new runtime architecture implementation.
- No new test code in this planning step.
