# P7.7 — Runtime Audit Persistence (R0) — Implementation

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.7 (R0 implementation — the first persistence rung)
- Status: **IMPLEMENTED — wired-dormant, canary-gated (default OFF).** Runtime behavior is unchanged until `RUNTIME_AUDIT_PERSISTENCE_ENABLED=true`.
- Base: `feature/phase-07-outcomes-learning-graphrag` rebased onto `main` (post-Phase-6: PRs #97/#98/#99). Merge commit `3ed893b`.
- Implements: P7.2 (Runtime Audit Schema) under the P7.3 (Triple-Stack Write Contract, Path B killed) write path; rung **R0** of the P7.1 ladder.
- Governed by: **ACR-0007** (app-direct persistence; no Universal Gateway in runtime).

---

## 1. What shipped

R0 is the **runtime-audit-persistence substrate** — the observability layer P7.1 requires before any higher rung (outcomes/learning/GraphRAG) may turn on. It records the agent-runtime **turn lifecycle and gate decisions** as append-only, metadata-only markers in the canonical `mcs_audit_log` triple-stack, through the single app-direct `tripleStackWrite` seam.

| File | Change | Append-only? |
|---|---|---|
| `packages/shared/src/types.ts` | **Appended** (bottom, new exports only): `RuntimeAuditAgent`, `RuntimeAuditDraftKind`, `RuntimeAuditAction`, `RuntimeAuditContext`, `AppendRuntimeAuditEntryInput`, `RuntimeAuditLogEntry`. Zero edits to existing exports. | ✅ |
| `server/src/env.ts` | Added canary flag `RUNTIME_AUDIT_PERSISTENCE_ENABLED` (`EnvBoolean.default(false)`). | n/a (not under the types/index append-only rule) |
| `server/src/domain/auditLog.ts` | Added new exports `appendRuntimeAuditEntry`, `findRuntimeAuditEntry`, `runtimeAuditPersistenceEnabled` + private helpers. **No edit** to `appendAuditEntry` or any existing export. | ✅ |
| `server/src/domain/__tests__/runtimeAudit.test.ts` | New — 8 tests. | new file |

---

## 2. Design decisions (and why)

1. **Not wired into the turn coordinator.** The S2.7 coordinator is inert and its governance-boundary test (`s27TurnCoordinatorGovernanceBoundary.test.ts`) statically **forbids** `tripleStackWrite`/`gatewayCall`/`persist*` in coordinator source. So the writer is a **standalone, wired-dormant** capability in the audit domain. Live wiring into a real turn path is a later, separately-approved activation step (and no live turn route exists yet — the `/api/runtime/*` prohibition still holds).
2. **Canary-gated, default OFF.** `appendRuntimeAuditEntry` returns `null` and performs **no** store I/O when `RUNTIME_AUDIT_PERSISTENCE_ENABLED` is false (the default). Runtime behavior is byte-for-byte unchanged until Kevin flips the flag — satisfying P7.1 §6 (no persistence family enabled by default; kill-switch without redeploy).
3. **Extends the 4.J substrate, does not fork it.** Writes to the canonical `mcs_audit_log` (Mongo + Neo4j `(:AuditEntry)` + Chroma `mcs_audit_log`) — one canonical audit collection (P7.2 §0; naming-drift guard in `FINDING_chroma_boot_naming_drift.md`). No second audit store.
4. **Metadata-only, structurally.** `before`/`after` are hard-coded `null` — a runtime marker cannot carry a body. Content, transcripts, PII (beyond opaque ids), and income/compensation values never enter a runtime audit row.
5. **App-direct only (ACR-0007).** Persists through `tripleStackWrite`; no `quadstack.write`, no Universal Gateway, no `universal_gateway` namespace, no `chat_number`. The `runtime` scope block is app-scoped (`tenantId`, `baId`, `agent`, `turnId`, `correlationId`).
6. **Idempotent on `(turnId, action)`.** A retried lifecycle marker is a no-op: the writer queries `{action, 'runtime.turnId'}` and returns the existing row instead of double-writing (the gateway `update` path does not honor upsert — documented gotcha).
7. **Append-only to `types.ts`, honored strictly.** Rather than editing the existing `AuditEntityKind` union, runtime entries use the existing `'none'` entity kind (id = `turnId`) and are isolated on read by the `runtime.` action prefix (`AuditQueryFilters.actionPrefix`, already supported). This keeps the change 100% append-only. *(If a dedicated `runtime_turn` entity kind is later wanted for read ergonomics, that is a separate approved edit — noted as an open item.)*

---

## 3. Severity mapping (P7.2 §3.2)

| Action | Severity |
|---|---|
| `runtime.turn.opened` / `draft_emitted` / `closed`, `runtime.gate.allowed` | `info` |
| `runtime.gate.denied` | `warn` (expected traffic; avoids flooding the "needs Kevin" widget) |
| `runtime.persistence.enabled` / `disabled` | `critical` (a persistence-flag flip) |

Callers may override `severity`; `reason` is a capped (≤500 char) gate-denial cause only.

---

## 4. Verification

- **Typecheck:** repo-wide green (5/5 workspaces).
- **New tests:** `runtimeAudit.test.ts` — 8/8 pass. Covers: flag-off no-op (no store I/O), flag-on triple-stack write, no before/after body, system-actor + tenant/BA/agent scope, gate-denial reason cap + `warn`, persistence-flip `critical`, dedup returns existing row without double-write, dedup query shape.
- **Full server suite:** result recorded in §5 (no regression to the 1281 pre-existing tests / governance boundaries).

## 5. Test gate record

- **Typecheck:** `pnpm typecheck` → 5/5 workspaces `Done`, exit 0.
- **R0 tests:** `runtimeAudit.test.ts` → **8/8 passed**.
- **Full server suite:** `pnpm --filter @momentum/server test` → **107 files, 1289 tests, all passed** (exit 0). This is exactly **+1 file / +8 tests** over the pre-R0 baseline (106 files / 1281 tests) — no regression to any existing test or governance boundary (including `s27TurnCoordinatorGovernanceBoundary`, which stays green because the coordinator was not touched).

## 6. What R0 does NOT do

- Does not enable persistence by default (flag off).
- Does not wire the writer into any live turn or route (no activation; no `/api/runtime/*`).
- Does not implement R1 (outcomes), R2 (learning candidates), or R3 (GraphRAG) — those stay deferred until R0 is proven in a controlled canary.
- Does not touch the S2.7 coordinator, the persistence seam, `.com`, or `apps/**`.

## 7. Next step

With R0 in place (dormant), the activation path is: (a) Kevin approves turning the canary on in a controlled environment; (b) a live turn path (post-`/api/runtime` decision) calls `appendRuntimeAuditEntry` at the lifecycle/gate points; (c) prove read-back on `mcs_audit_log`; then (d) R1 (outcome capture, P7.4) becomes eligible.
