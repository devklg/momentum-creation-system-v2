# P7.1 — Runtime Persistence Governance Proposal

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.1 (architecture / governance proposal)
- Status: **PROPOSAL — NON-RATIFIED. Architecture/contracts only.** No persistence implementation is authorized by this document.
- Base SHA: `cce9a951e3ca1b04307f68245201c389375b0a7a` (verified HEAD == Base SHA)
- Author: Phase 7 worktree (Agent B — Architecture)
- Aligns to: **ACR-0007** (runtime persistence is DIRECT; Universal Gateway is dev tooling), the canonical MCS V2 schema design `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (commit `f976dd3`), decision `dec_runtime_persistence_direct_not_gateway` (seq 28).
- Depends on approval of: this proposal (P7.1) **and** P7.2 (Runtime Audit Schema) **and** P7.3 (Triple-Stack Write Contract) before any P7.4+ implementation.

---

## 0. Dependency-gate note (read first)

The orchestrator prompt names **Phase 6 (multi-agent runtime)** as the concurrent upstream that owns the persistence seam. At the current Base SHA (`cce9a95` = current `main`), `main` carries **Phases 3–5 closed, prior P6 work, and the canonical MCS V2 schema design commit `f976dd3`**. Phase 6 runs **concurrently** in a separate worktree and owns `server/src/runtime/orchestration/*` + the persistence adapters as *implementation*. This design run therefore stays **docs/contracts only** and anchors to the persistence/runtime foundation already on `main` (S1.3 direct-persistence migration scaffolding, S1.4 runtime-event foundation, S2 outcome/guided-action returned-only envelopes, S3 Michael runtime) plus the canonical schema. Every slice below stays implementation-blocked until Phase 6 lands and a separate approval is granted, so no harm follows from drafting the contracts now.

This document changes **no ratified doc, no production code, and no source-of-truth doc.** It does not write to MongoDB, Neo4j, or ChromaDB. (Registering this proposal in the app's `momentum.decisions` ledger is a separate, approval-gated step performed through the **app-direct** `tripleStackWrite()` seam — **never** the Universal Gateway — see §8.)

---

## 1. Purpose

Phase 7 is the first phase that proposes to **persist runtime-derived facts** (audit events, outcome captures, learning candidates, GraphRAG records). Every prior phase kept the runtime **returned-only** by deliberate governance choice (S2.10). Turning that boundary on is the single highest-risk change in the program: it converts inert envelopes into durable, downstream-affecting state across three stores.

This proposal defines the **governance frame** under which any Phase 7 persistence may later be approved and built. It does not approve persistence. It defines:

1. What is allowed to be persisted, and under what gate (§3).
2. The non-negotiable invariants any write must satisfy (§4).
3. The approval sequence and who owns each gate (§5).
4. The rollback / kill-switch contract (§6).
5. The standing prohibitions this phase must never violate (§7).

---

## 2. What already exists (do not rebuild)

| Capability | Where | State |
|---|---|---|
| Direct-store vs gateway dispatch flags | `server/src/services/persistence/flags.ts` | Live. Master switch `PERSISTENCE_DIRECT_ENABLED` defaults **false** → every store on gateway path. |
| Triple-stack write helper | `server/src/services/tripleStack.ts` | Live. Chroma-collection guard (#147) fails loud before Mongo commits. |
| Single-endpoint gateway client | `server/src/services/gateway.ts` | Live. Direct-adapter fast path when a store's mode is `direct`. |
| Admin audit substrate (4.J) | `server/src/domain/auditLog.ts`, `AuditLogEntry` in `@momentum/shared` | Live. Append-only, triple-stacked (`mcs_audit_log`). `appendAuditEntry` is the only writer. |
| Runtime events / outcome drafts / guided-action drafts | S2.3 / S2.4 orchestration | **Returned-only. Persistence disabled** by S2.10 governance decision. |
| Direct-persistence ratification | decision `dec_runtime_persistence_direct_not_gateway` (seq 28) | Ratified. Runtime persistence = MongoDB + Neo4j + ChromaDB **directly**; the MCP gateway is dev tooling only, never a runtime dependency. |
| Canonical MCS V2 schema design | `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (commit `f976dd3`) | Proposed schemas for the app's dedicated triple-stack (49 Mongo collections, Neo4j constraints, Chroma `mcs_*` registry). Memory/lineage align to this, not a parallel schema. |
| Gateway GraphRAG memory schema | `docs/graphrag-schema-contract.md` + CLAUDE.md #135 | Contract-only. **Scoped to Universal Gateway memory** (`universal_gateway` namespace, `chat_registry`, `quadstack.write`). **Out of app-runtime scope** — the app borrows its anti-drift discipline, not its transport. |

**Implication:** P7.1–P7.3 do not introduce a new persistence mechanism. They govern *use* of the existing **app-direct** triple-stack helper (`tripleStackWrite`) for **all** write families — operational and memory/lineage alike — into the app's own dedicated stores. Per ACR-0007 the Universal Gateway (`quadstack.write`) is **never** an app runtime path; P7.3 §9 deprecates the previously-proposed Path B on that basis.

---

## 3. Persistence scope ladder (what may be persisted, and the gate for each)

Persistence is approved **per family, never globally.** Each rung requires its own explicit Kevin approval before implementation. The ladder is ordered low-to-high risk.

Design contracts for each rung are produced **this run** (P7.2 audit schema, P7.4 outcome, P7.5 learning, P7.6 GraphRAG). Implementation slices are **P7.7+** and out of scope this run.

| Rung | Family | Default | Design contract (this run) | Gate to implement |
|---|---|---|---|---|
| R0 | **Runtime audit events** (turn/agent lifecycle, gate decisions) — metadata only, no transcript bodies | returned-only | P7.2 (audit schema) | P7.2 approved → P7.7 audit-persistence impl |
| R1 | **Outcome capture** — BA-confirmed, BA-scoped, team-scoped outcome records only | returned-only | P7.4 (outcome capture contract) | P7.4 approved → later impl slice |
| R2 | **Learning candidates** — review-only, never auto-promoted, never agent-approved | not stored as knowledge | P7.5 (learning candidate pipeline) | P7.5 approved → later impl + approval workflow |
| R3 | **GraphRAG learning records** — derived memory, app-direct, app-`$jsonSchema` enforced | none | P7.6 (GraphRAG architecture) | P7.6 approved → later write impl |

**Hard rule:** R1–R3 stay disabled until R0 (runtime audit) is implemented and proven, because audit is the observability substrate that makes every higher rung safe to turn on. This matches S2.10's recommendation to "first prove the activation boundary … with returned-only envelopes," extended forward: prove audit before outcomes, prove outcomes before learning.

**Excluded from every rung (never persisted):** raw transcript dumps by default, `.com`-surfaced data, Telnyx/PSTN/call-control payloads, income/compensation/cycle/placement values, agent-approved knowledge, anything outside Team Magnificent tenant/BA scope.

---

## 4. Non-negotiable write invariants

Any approved Phase 7 persistence must satisfy all of the following. These are lifted directly from S2.10 §§7–9 and the triple-stack rule; they are restated here as the acceptance bar for P7.4+.

1. **All-three-or-fail.** A logical write lands in MongoDB + Neo4j + ChromaDB or it fails loud. No store is optional; no silent fallback from a required leg. (`tripleStackWrite` + the Chroma guard already enforce fail-before-Mongo ordering.)
2. **Deterministic ids.** Event/outcome/candidate/record ids are deterministic from `(turnId, correlationId, kind)` so retries are idempotent and duplicate requests are no-ops.
3. **Write-readback verification** on the first write of a new family during canary.
4. **Tenant + BA + agent scope** stamped on every record. Minimal payload. No raw transcript by default.
5. **Append-only** for audit and decision-class records (mirrors 4.J and the decision ledger).
6. **Memory/lineage records** (R3, and any decision/learning-record write) travel the **same app-direct `tripleStackWrite()` seam** into the app's own dedicated stores, stamped with the app-memory envelope and guarded by the app's own Mongoose + `$jsonSchema` governed door (see P7.3 §4). **No `quadstack.write`, no Universal Gateway, no `universal_gateway`/`chat_number` fields on app records** (ACR-0007). No ad hoc `date`/`timestamp`/`chat`/`synced_chat`/`start_time` aliases.
7. **No direct agent writes.** Agents never call a store. All persistence goes through the server's domain → `tripleStackWrite()` app-direct boundary (never the Universal Gateway; ACR-0007). The Context Manager remains the sole Context Packet assembler.

---

## 5. Approval sequence & ownership

Design run (this run) produces the contracts; implementation is a separate, later, per-rung approval once Phase 6 lands.

```
DESIGN RUN (this run — contracts only):
  P7.1 governance ─┐
  P7.2 audit schema │
  P7.3 write contract (Path B killed)  ├─ all approved by Kevin ─► authorize IMPLEMENTATION per rung
  P7.4 outcome contract │
  P7.5 learning candidate pipeline │
  P7.6 GraphRAG architecture ─┘

IMPLEMENTATION (P7.7+ — out of scope this run, per-rung canary):
  R0 audit persistence ─► R1 outcome capture ─► R2 learning candidate + approval workflow
  ─► R3 GraphRAG write ─► observability ─► closeout
```

Each implementation rung stays disabled until the rung below it is proven in a controlled canary (audit before outcomes, outcomes before learning, learning before GraphRAG).

- **Kevin** owns every enable gate. No agent may approve knowledge or flip a persistence flag.
- **Context Manager** remains the sole Context Packet assembler (standing rule).
- **Server domain layer** owns the write boundary; routes stay thin.

---

## 6. Rollback / kill-switch contract

Before R0 is implemented, P7.4 must ship with:

1. A **feature flag / config kill switch** that disables the new persistence family without redeploy (pattern: extend the `flags.ts` model — additive, append-only).
2. **Idempotent cleanup** for canary/bad writes (deterministic ids from §4.2 make this a delete-by-id sweep across all three stores).
3. **Retention + deletion policy** stated per family.
4. **Rollback verification tests** and a named owner + execution steps.
5. No persistence family enabled by default on merge — canary-gated, mirroring S3's controlled-canary pattern.

---

## 7. Standing prohibitions (always in force)

- No `.com` exposure of any runtime/outcome/learning data.
- No `/api/runtime/*` route family.
- No unapproved persistence.
- No LLM calls, no dynamic generation.
- No voice/Telnyx/PSTN/call-control.
- No automatic sending/calling/scheduling/prospecting/scoring/ranking/qualification.
- No income/compensation/cycle/placement guarantees.
- No agent may approve knowledge.
- Context Manager remains sole Context Packet assembler.

---

## 8. What this proposal does NOT do

- Does not enable any persistence.
- Does not write to MongoDB / Neo4j / ChromaDB. Registering this proposal in the app's `momentum.decisions` ledger is a separate approval-gated action performed through the **app-direct `tripleStackWrite()` seam** (never the Universal Gateway), by the server/Context Manager boundary — **not** by an agent, and **not** in this slice.
- Does not modify `flags.ts`, `tripleStack.ts`, `types.ts`, `index.ts`, or any production code.
- Does not supersede S2.10; it extends S2.10's deferral into a staged enable ladder.

---

## 9. Recommendation to Kevin

Approve the Phase 7 design set — **P7.1 + P7.2 + P7.3 (revised, Path B killed) + P7.4 + P7.5 + P7.6** — together as the Phase 7 persistence governance baseline. Then, once Phase 6 lands, authorize **only R0 (runtime audit persistence) as the first implementation canary**, keeping R1–R3 deferred until audit is proven. This is the minimum surface that makes every later rung observable and reversible. All six contracts hold the same line: one app-direct write path, the app's own dedicated stores, no Universal Gateway in any runtime path (ACR-0007).
