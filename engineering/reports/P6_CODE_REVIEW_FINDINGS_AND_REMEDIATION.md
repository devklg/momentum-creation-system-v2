# P6 Code Review — Findings & Remediation

- **Branch:** `fix/phase-06-multi-agent-runtime-defects` (off `main` @ `cce9a95`)
- **Date:** 2026-07-01
- **Author:** Claude Code (Instance 4)
- **Scope reviewed:** the Phase 6 multi-agent runtime already on `main` — Steve
  (`domain/steve-success-interview.ts`, `routes/steve.ts`), Ivory
  (`domain/ivory.ts`, `domain/ivory-momentum.ts`, `routes/ivory.ts`),
  orchestration (`registry.ts`, `events.ts`, `adapters/ivoryAdapter.ts`,
  `adapters/steveSuccessAdapter.ts`).
- **Method:** 4 parallel finder passes (line-by-line, removed-behavior,
  cross-file, persistence/race, cleanup/altitude) → dedup → per-finding
  verification against source and the existing test suite.

> This is a **bug-hunting** review, distinct from `P6_RECONCILIATION_AUDIT.md`
> (which checked conformance to contracts/prohibitions, not correctness).

## Gate results (this branch, after fixes)

| Gate | Result |
|---|---|
| `pnpm build:shared` | ✅ |
| `pnpm typecheck` (5 workspaces) | ✅ |
| `pnpm --filter @momentum/server test` | ✅ 102 files / 1260 tests |

Steve/Ivory domain code has **no direct unit tests**; correctness of these fixes
rests on typecheck + the 1260 existing tests (unbroken) + code reasoning. Adding
domain-level tests for these paths is a recommended follow-up.

## Findings and fixes

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | High | `mintIvoryInvitation` (`ivory.ts`): `markIvoryInvited` runs after a live token is minted; its failure threw, so the BA retried → **second live token** for the same person. | Wrapped `markIvoryInvited` in try/catch — the mint returns success (token is primary), linkage failure is logged for reconciliation. No double-mint. |
| 2 | High | Steve `ensureDiscoveriesCollection`: a transient failure cached a **rejected promise forever**, breaking all new-BA ingests until restart. | On failure, clear the cache (`= null`) before rethrowing so the next call retries and self-heals. |
| 3 | Med-High | `markIvoryInvited` cypher used `MATCH (n) MATCH (p:Prospect)`: a missing Prospect node **no-op'd the whole statement**, leaving Neo4j stale while Mongo committed `status:'invited'`. | `SET n.*` now runs before a `MERGE (p:Prospect …)` (was `MATCH`), so the status update can't be gated on the prospect node's presence. |
| 4 | Med-High | Steve re-ingest (existing branch) updated Mongo + Neo4j only, **never Chroma** → semantic doc pinned to v1. | Re-ingest now refreshes Chroma via `add` (which maps to the Chroma **upsert** endpoint), through a shared `upsertChromaDoc` helper. |
| 5 | Med | `tripleStackWrite` has no rollback and `createIvoryName` had **no compensation/read-back** → a failed Neo4j/Chroma leg orphaned the Mongo row; retries (fresh `ivoryId`) accumulated duplicates. | Wrapped the write with best-effort compensation: on failure, delete the orphaned Mongo row + graph node before rethrowing. |
| 6 | Med | Ivory `updateIvoryName` updated Mongo + Neo4j only → `mcs_ivory` Chroma doc drifted from edited name/categories/angle/notes. (Status/invited transitions don't touch those fields, so only this path needed it.) | Refresh the Chroma doc on name edits via `add` upsert; extracted a shared `ivoryChromaDoc()` so create/update text can't diverge. |
| 7 | Med | Steve read-back verified row **existence only** — a silently-modified-nothing update still returned 200 with stale content. | Read-back now also asserts `readback.completedAt === artifact.completedAt`. |
| 8 | Med | `registry.getAgentDescriptor` / `isTaskTypeAllowed` indexed the registry with **no guard** → unknown (cast) agentKey crashed callers on property access. | Both now guard: `getAgentDescriptor` throws a clear error; `isTaskTypeAllowed` returns `false` for an unknown key. |
| 9 | Med-Low | Steve upsert is a **TOCTOU race** — concurrent same-`baId` ingests both take the insert path → duplicate `_id` 500. | The insert path now catches the error, re-checks existence, and falls back to the update path so a raced re-ingest converges idempotently. |
| 10 | Low (cleanup) | `ivoryAdapter` had a **dead `if`** (both branches identical); `isIvoryRuntimeTaskAllowed` had no effect. Verified NOT a functional bug — `composeOrchestrationTurn` already rejects disallowed task types (`ivoryAdapter.test.ts`). | Removed the dead branch; kept `isIvoryRuntimeTaskAllowed` exported for pre-dispatch checks; documented where rejection actually happens. |

### Reviewed and intentionally NOT changed
- Worker-secret string compare is non-constant-time but is a fixed localhost
  machine-to-machine secret with no timing oracle on that path — defense-in-depth
  only, left as-is.
- `ivory-momentum` focus-queue `slice(0,12)` is a curated highlight; the full set
  is returned as `rows`, so nothing is lost (initial finding refuted).
- Chroma has no `delete` action in the gateway; `deleteIvoryName` intentionally
  leaves Chroma history (documented existing behavior).

### Lower-severity items deferred (not fixed here)
- `updateIvoryStatus` accepts `status:'invited'` directly, bypassing the
  `lastProspectId`/`INVITED_AS` invariant maintained by `markIvoryInvited`.
- Update paths return the optimistic `next` object even on a 0-match update.
- Steve profile free-text statements aren't truncated to 5000 chars (transcript
  and answers are).
- Focus-queue comparator returns `-1` (never `0`) for fully-equal rows.
- `tripleStackWrite`'s per-store `ok` flags are hardcoded `true` (can't report
  partial failure).
- `ANGLE_LABEL` wording differs between `ivory.ts` and `ivory-momentum.ts`.

These are recorded for a follow-up pass; none is a live data-integrity risk on
par with #1–#9.

## Recommendation
Merge behind CI gates. All changes are server-side domain/runtime hardening with
no route/contract/compliance surface change; the 1260-test suite is unbroken.
