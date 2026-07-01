# P7.11 — Learning Observability + Phase 7 Closeout

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.11 (learning observability) + **Phase 7 closeout / verification**
- Status: **Design set + R0–R3 rungs + observability IMPLEMENTED (all wired-dormant, canary-gated, default OFF).** Activation is per-rung on Kevin's approval. `main` untouched.
- Base: `feature/phase-07-outcomes-learning-graphrag`, rebased onto post-Phase-6 `main` (merge `3ed893b`). Latest: this slice.
- Governed by: **ACR-0007** (app-direct; no Universal Gateway in runtime) throughout.

---

## 1. Learning observability (P7.11)

`computeLearningObservabilitySnapshot` (`server/src/domain/learningObservability.ts`) — a **pure** aggregation over the R0 runtime-audit / R1 outcome / R2 candidate records: gate allow/deny counts + deny rate, outcome distribution by kind, candidate lifecycle distribution + approval rate.

- **Aggregate only** — never a manual review queue (P7.2 §5 / P7.5 §7); admin-surface metrics, never `.com`.
- **Pure + deterministic** — no fetch, no persistence, no side effects; carries no assumption about gateway count/aggregate query semantics. Loading records (via the existing admin read surface) and mounting the read is the **activation** step, not done here.
- **No PII, no scoring/ranking** of BAs or prospects — counts and rates only.
- Tests: `learningObservability.test.ts` — **5/5** (zeroed empty snapshot without NaN rates; gate deny-rate; outcome-by-kind; candidate approval-rate; passthrough).

---

## 2. Phase 7 — what was built

### 2.1 Design set (contracts) — commit `db7427b`
P7.1 Governance · P7.2 Audit Schema · P7.3 Write Contract (**Path B killed**, ACR-0007) · P7.4 Outcome Capture · P7.5 Learning Candidate Pipeline · P7.6 GraphRAG Architecture · SPRINT_007 verification · plus `organization/FINDING_chroma_boot_naming_drift.md` + `organization/DECISION_governed_dedicated_stack_founding_principle.md`.

### 2.2 Implementation — the R0→R3 ladder (all dormant, canary-gated, app-direct)

| Rung | Slice | Commit | Flag (default off) | Stores |
|---|---|---|---|---|
| R0 | Runtime audit (P7.7) | `3e2f771` | `RUNTIME_AUDIT_PERSISTENCE_ENABLED` | `mcs_audit_log` |
| R1 | Outcome capture (P7.8) | `fbfbd42` | `OUTCOME_CAPTURE_PERSISTENCE_ENABLED` | `mcs_outcomes` |
| R2 | Learning candidates (P7.9) | `f4292dc` | `LEARNING_CANDIDATE_PERSISTENCE_ENABLED` | `mcs_learning_candidates` (+ review-only Chroma) |
| R3 | GraphRAG (P7.10) | `6d6d4fb` | `GRAPHRAG_PERSISTENCE_ENABLED` | `mcs_graphrag_records` + active-knowledge Chroma |
| P7.11 | Observability | this slice | — (pure, read-only) | reads R0–R2 |

### 2.3 Invariants held across every rung
- **App-direct only (ACR-0007)** — every write goes through `tripleStackWrite`/`gatewayCall` into the app's own dedicated stores. Zero `quadstack.write`, zero Universal Gateway, zero `universal_gateway`/`chat_number` on app records.
- **Canary-gated, default OFF** — runtime behavior is byte-for-byte unchanged until a flag is flipped; each rung has its own kill-switch.
- **Append-only to shared types** — no edits to existing `@momentum/shared` exports; all additions at the bottom.
- **App-memory envelope** — `namespace: 'momentum'`, `originKind: 'system'`, camelCase, shared id; gateway-only fields banned.
- **Governance guarantees enforced structurally** — R2: no agent may approve knowledge (creation is always `detected`; review requires a human reviewer); R1: `enrolled_three` is a THREE mirror, not a handoff, no scoring/ranking; R3: retrieval-ready gate + active/review isolation, Context Manager sole caller.
- **No standing-prohibition breach** — no `.com` exposure, no `/api/runtime/*` routes, no LLM/dynamic-gen, no Telnyx/PSTN, no income/comp/cycle/placement, no auto send/call/schedule/score/rank/qualify.
- **Inert S2.7 coordinator untouched** — its governance boundary forbids persistence in coordinator source; the R0 writer is deliberately standalone.

---

## 3. Verification (final state)

- **Typecheck:** repo-wide green (5/5 workspaces).
- **Server suite:** **111 files, 1321 tests, all passed** — grown from the pre-Phase-7 baseline of 106 files / 1281 tests by exactly the Phase 7 additions (+5 files / +40 tests: R0 +8, R1 +10, R2 +9, R3 +8, observability +5), **zero regressions** at every step, including all Phase 6 orchestration governance boundaries.
- **`main`:** untouched. All work on `feature/phase-07-outcomes-learning-graphrag`; Kevin merges.

---

## 4. What remains in Phase 7 (NOT started — needs Kevin)

Everything built above is **substrate**. It does nothing until activated. Remaining work, each gated on Kevin:

1. **Store provisioning** — stand up the dedicated triple-stack (Mongo `momentum`@30000, Neo4j@7710, Chroma `mcs_*`@8200) with the P10 schema applied (tied to the write-freeze lift / P10 §8 rollout).
2. **Governed doors** — author the Mongoose + `$jsonSchema` validators for `mcs_outcomes`, `mcs_learning_candidates`, `mcs_graphrag_records` (the audit collection already has one path).
3. **Per-rung activation, in ladder order** — flip R0 on in a canary → wire a live turn path to call `appendRuntimeAuditEntry` → prove read-back → then R1 → R2 → R3. Each needs approval and a route decision (the `/api/runtime/*` prohibition means live wiring is its own decision).
4. **Observability read wiring** — load records via the admin read surface into `computeLearningObservabilitySnapshot` and expose on `/admin` (aggregate only).

## 5. Open decisions still on the table (from the contracts)
- App-memory field casing — camelCase adopted (P7.3 O-1, recommended); confirm.
- CLAUDE.md #135 wording — scope `quadstack.write` to gateway-only (P7.3 O-2).
- `KNOWLEDGE_EVOLUTION_RUNTIME.md` conflicts — `/api/runtime/*` routes + BSON `Date` vs standing prohibition + ISO-string rule (P7.5 O-1/O-2, P7.6 O-3).
- Candidate reviewer authority — Kevin-only vs +governance role (P7.5 O-3).
- The two `organization/` docs created under authorization — confirm for commit to `main`.

---

## 6. Bottom line

Phase 7 is **fully designed and fully built as dormant substrate**: one app-direct write path, the app's own dedicated stores, the gateway in no runtime path, four canary-gated persistence rungs + aggregate observability, all green. It is **inert by default** and ready for controlled, per-rung activation on Kevin's approval — nothing turns on until a flag is flipped.
