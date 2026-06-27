# Sprint 1 — Codex Execution Prompt (Planning Only)

You are working inside the Momentum Creation System V2 repository (`D:/momentum-creation-system-v2`).

Architecture Version: 1.0
Status: FROZEN
Governance: ACR-0007 APPROVED (2026-06-27, Kevin L. Gardner)
Sprint 1: APPROVED for implementation planning (2026-06-27)

## Approved persistence law (ACR-0007)

- The Momentum production runtime persists to **MongoDB + Neo4j + ChromaDB directly**, through dedicated adapters and service layers (Mongoose models, Neo4j graph services, Chroma embedding/collection services). Every write lands in all three stores in the same logical operation; read-back verifies it.
- The Universal Gateway V2 (`D:/server-gateway-mcp-v2`, `localhost:2526`) is **developer tooling only** — for Claude Desktop, Claude Code, Codex, Codex CLI, and MCP orchestration. It is **never** a Momentum production runtime dependency. Do not reintroduce gateway-mediated persistence in any plan.
- Redis is not part of the persistence layer (future ephemeral coordination only). Do not add it.

## What is already done (do not redo, do not re-touch)

- Documentation reconciliation is complete: `docs/locked-spec.md` §3.14, `docs/UNIVERSAL_GATEWAY_V2_STANDARD.md`, `docs/AGENT-BRIEFING.md`, `docs/project-wireframe.md`. Do not edit these.
- The decision ledger and ACR register already record ACR-0007 and the Sprint 1 approval. Do not edit `organization/`.
- The S1.3 migration plan already exists at `engineering/plans/S1_3_PERSISTENCE_MIGRATION_PLAN.md`. Use it as the basis for S1.3; do not rewrite it from scratch.

## Task — execute Sprint 1 (Platform Alignment) as PLANNING ONLY

Produce the platform-alignment planning artifacts defined in `engineering/sprints/SPRINT_001_PLATFORM_ALIGNMENT.md` (items S1.1–S1.7). No production code. The deliverables are plans, module layouts, decisions, and verification approaches — not implementations.

Create (Markdown, under `engineering/plans/`):

1. `SHARED_RUNTIME_CONTRACT_PLAN.md` (S1.1) — implementation paths and shapes for `packages/shared/src/runtime/*`; Team Magnificent scope mandatory wherever `baId` exists; EN/ES runtime language; additive, no breaking of current shared exports.
2. `BACKEND_RUNTIME_BOUNDARY_PLAN.md` (S1.2) — additive `server/src/runtime/*` module layout; runtime routes additive under `/api/runtime/*`; agents never access stores directly; Telnyx excluded from internal runtime modules.
3. (S1.3) — already planned in `engineering/plans/S1_3_PERSISTENCE_MIGRATION_PLAN.md`. Review and, if needed, extend it; do not rewrite. It moves gateway-routed writes to direct Mongo/Neo4j/Chroma adapters behind the existing `gatewayCall` seam, callers unchanged, `rollback_to` = `0c969c0`.
4. `RUNTIME_EVENT_FOUNDATION_PLAN.md` (S1.4) — `agent_event.v1` envelope, idempotency, correlation/causation IDs, outbox, replay boundaries, subscriber offsets; aligns with `runtime/AGENT_EVENT_MODEL.md`.
5. `CONTEXT_PACKET_FOUNDATION_PLAN.md` (S1.5) — `context_packet.v1` validation + builder approach; Context Manager is the only assembler; candidate/review-only knowledge excluded by default.
6. `BROWSER_VOICE_FOUNDATION_PLAN.md` (S1.6) — `.team`-only client runtime layout; permission-after-action; text fallback; EN/ES selector; no Telnyx/PSTN.
7. `QA_HARNESS_PLAN.md` (S1.7) — select the test harness; first tests cover Team Magnificent scope, event envelope, Telnyx-exclusion boundary, and context-packet schema; `pnpm typecheck` / `pnpm build` remain mandatory gates.

## Hard constraints

- Do NOT write or modify production code (`server/src/**`, `apps/**`, `packages/**` runtime code). Planning Markdown only.
- Do NOT modify any ratified document (`constitution/**`, `runtime/**`, `implementation/**`, `organization/**`).
- Do NOT apply any other proposed ACR (ACR-0001 … ACR-0006 stay Proposed).
- Do NOT redesign the architecture. Plans align the implementation to the already-ratified v1.0 architecture.
- Do NOT change `.com` prospect surfaces.
- Do NOT reintroduce the Universal Gateway as a runtime persistence path anywhere.
- Do NOT re-edit the already-reconciled docs or the `organization/` records.

## Output location and close

- All outputs go under `engineering/plans/` (planning) and, if a cross-cutting status note is useful, `engineering/reports/`.
- Close with: `pnpm typecheck` (expected green — no code changed), and a `git status` review confirming only `engineering/` Markdown changed.
- Stop after producing the plans. Production runtime code and the S1.3 persistence migration execute only under ACR-0007's gates (Implementing → Verified with persistence read-back → Merged), and Kevin merges.

## Note on the Universal Gateway "error"

The audit-time "Gateway unavailable" caveat was a session-local MCP-tool glitch, not a database or production issue — Mongo/Neo4j/Chroma were verified live. It is not a Sprint 1 blocker and is out of scope. See `engineering/reports/PERSISTENCE_AND_GATEWAY_CLARIFICATION.md`.
