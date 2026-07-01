# P7.8 — Outcome Capture (R1) — Implementation

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.8 (R1 implementation — second persistence rung)
- Status: **IMPLEMENTED — wired-dormant, canary-gated (default OFF).** No route wiring; `OUTCOME_CAPTURE_PERSISTENCE_ENABLED=false` by default.
- Base: `feature/phase-07-outcomes-learning-graphrag` (post-Phase-6, after R0 `3e2f771`).
- Implements: P7.4 (Outcome Capture Contract) under P7.3 (write contract, Path B killed); rung **R1** of the P7.1 ladder.
- Governed by: **ACR-0007** (app-direct; no Universal Gateway in runtime).

---

## 1. What shipped

R1 is the **outcome-capture substrate** — persistence of a **BA-confirmed** real-world outcome (webinar attended, callback completed, enrolled in THREE off-app, etc.) through the single app-direct `tripleStackWrite` seam into the app's own dedicated `mcs_outcomes` triple-stack. It also introduces the shared **app-memory envelope** (`McsMemoryEnvelope`) that R1/R2/R3 all reuse.

| File | Change | Append-only? |
|---|---|---|
| `packages/shared/src/types.ts` | **Appended**: `McsMemoryType`, `McsMemoryEnvelope`, `McsOutcomeKind`, `McsOutcomeRecord`, `AppendOutcomeInput`. Zero edits to existing exports. | ✅ |
| `server/src/env.ts` | Added canary flag `OUTCOME_CAPTURE_PERSISTENCE_ENABLED` (default false). | n/a |
| `server/src/services/chromaCollections.ts` | Registered `mcs_outcomes` (so the boot ensure + write-time guard cover it). | additive |
| `server/src/domain/outcomes.ts` | New module: `appendOutcome`, `findOutcome`, `deterministicOutcomeId`, `outcomeCapturePersistenceEnabled`, `OutcomeValidationError`. | new file |
| `server/src/domain/__tests__/outcomes.test.ts` | New — 10 tests. | new file |

---

## 2. The app-memory envelope (`McsMemoryEnvelope`)

R1 introduces the shared app-scoped envelope from P7.3 §4.2 — the replacement for the deprecated gateway `quadstack.write` base envelope:

- `namespace: 'momentum'` (never `universal_gateway`), `originKind: 'system'` (all app memory is server-derived → **no `chat_number`**), camelCase (P10 §3.6), shared `id` across all three stores.
- **Banned on app records**: `chat_number`, `chat_registry_id`, `universal_gateway`, and the `date`/`timestamp`/`chat`/`synced_chat`/`start_time` aliases. A test asserts the record carries none of the gateway-only fields.

R2 (learning candidates) and R3 (GraphRAG) will extend this same envelope.

---

## 3. Design decisions (P7.4 §5)

1. **Canary-gated, default OFF.** `appendOutcome` returns `null` and performs no store I/O when the flag is off (the default) — runtime behavior unchanged until Kevin flips it. Flag is independent of R0's flag so each rung is turned on / killed on its own.
2. **BA-confirmed only; no scoring/ranking/qualification.** The function records a fact the BA supplies; it never infers, scores, or ranks. A test asserts the record carries no `score`/`rank`/`qualification`/`commission`/`income`/`placement` field.
3. **THREE is authority.** `enrolled_three` is a **mirror** of a BA report — a plain outcome record, never a programmatic enrollment or handoff. No registration-handoff route.
4. **App-direct only (ACR-0007).** Persists through `tripleStackWrite` into `mcs_outcomes` (Mongo `momentum` + Neo4j `(:Outcome)` + Chroma `mcs_outcomes`). No `quadstack.write`, no gateway, no `universal_gateway`.
5. **Metadata only.** Opaque ids + an optional capped (≤2000 char) note. No `.com` data, no income/compensation/cycle/placement, no transcript/LLM body. Chroma document is a scope summary, not PII.
6. **Deterministic id + idempotency.** `id = mcsoutcome_<hash(baId:kind:scope)>`. A retried confirmation of the same fact is a no-op (returns the existing row). Multi-occurrence kinds (`callback_completed`) fold `outcomeAt` into the id so two distinct callbacks don't collide.
7. **Append-only correction chain.** A correction is a NEW record carrying `supersedesOutcomeId` (Neo4j `(:Outcome)-[:SUPERSEDES]->(:Outcome)`) — outcomes are never edited in place. The dedup short-circuit is bypassed for corrections.
8. **Scope-required.** Refuses a body lacking BA id, tenant, or a prospect/token subject — an outcome with no subject is meaningless (`OutcomeValidationError`).
9. **Wired-dormant.** No route mounts `appendOutcome` in this slice (no `/api/runtime/*`). Live wiring into the BA-facing team surface is a later approved activation step, gated behind R0 being proven first.

---

## 4. Verification

- **Typecheck:** repo-wide green (5/5).
- **New tests:** `outcomes.test.ts` — **10/10**. Covers: flag-off no-op; flag-on `mcs_outcomes` write; envelope stamping + no gateway-only fields; scope validation; note cap + no body; `enrolled_three` mirror + no score/rank fields; deterministic-id idempotency; stable vs multi-occurrence id; correction-chain `:SUPERSEDES`.

## 5. Test gate record

- **Typecheck:** `pnpm typecheck` → 5/5 workspaces `Done`, exit 0.
- **R1 tests:** `outcomes.test.ts` → **10/10 passed**.
- **Full server suite:** → **108 files, 1299 tests, all passed** (exit 0) — exactly **+1 file / +10 tests** over the post-R0 baseline (107 files / 1289 tests); zero regressions.

## 6. What R1 does NOT do

- Does not enable persistence by default (flag off); does not wire any route.
- Does not implement R2 (learning) or R3 (GraphRAG).
- Does not authorize any THREE enrollment handoff; introduces no scoring/ranking/qualification.
- Does not touch the coordinator, the seam, `.com`, or `apps/**`.

## 7. Next step

R1 is dormant. Activation: (a) R0 proven in canary; (b) Kevin enables R1; (c) a BA-facing route calls `appendOutcome` on an authenticated BA confirmation; (d) read-back on `mcs_outcomes`. Then R2 (learning candidate pipeline, P7.5) becomes eligible — outcomes are its input corpus (`derivedFrom`).
