# P7.2 — Runtime Audit Schema

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.2 (schema / contract proposal)
- Status: **PROPOSAL — NON-RATIFIED. Schema/contract only.** No persistence implementation is authorized by this document.
- Base SHA: `cce9a951e3ca1b04307f68245201c389375b0a7a` (verified HEAD == Base SHA)
- Depends on: P7.1 (governance) approved; P7.3 (write contract, Path B killed) approved. Implementation deferred to the R0 audit-persistence impl slice (P7.7+).
- Aligns to: **ACR-0007** (app-direct persistence; no Universal Gateway in runtime), the canonical MCS V2 schema design `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (commit `f976dd3`) — `mcs_audit_log` is the single canonical audit collection there (P10 §4.D).
- Anchors to: existing 4.J admin audit substrate (`AuditLogEntry`, `server/src/domain/auditLog.ts`).

---

## 0. Relationship to the existing audit substrate

The repo already has a **4.J admin audit substrate** — `AuditLogEntry` in `@momentum/shared`, written exclusively through `appendAuditEntry` in `server/src/domain/auditLog.ts`, triple-stacked to Mongo `mcs_audit_log` + Neo4j `(:AuditEntry)` + Chroma `mcs_audit_log`, append-only, monotonic by `(timestamp, entryId)`.

**P7.2 does not replace or fork that substrate.** It defines a **runtime audit** record that captures the agent-runtime turn lifecycle (Michael/Steve/Ivory turns, gate decisions, outcome/guided-action draft emission) — a concern the admin substrate doesn't model. The design choice (§4) is to **extend the existing substrate** rather than stand up a parallel one, because two append-only audit logs across the same three stores is exactly the drift the program fights.

> **Slice-numbering note.** Where this document says "P7.4," it means the **R0 runtime-audit-persistence implementation slice**. Under the reconciled Phase 7 numbering (P7.1 §3, §5) the design contracts are P7.2/P7.4/P7.5/P7.6 (this run) and implementation is **P7.7+**; the R0 audit-persistence implementation is the first of those. Read every "P7.4" below as "the R0 audit-persistence impl slice (P7.7+), post-approval."

---

## 1. Purpose

Define the schema for **runtime audit events** so that, when P7.4 is approved, the runtime turn lifecycle is observable and reversible without persisting any sensitive body. Runtime audit is rung R0 in the P7.1 ladder — the first thing persisted, because it is the substrate that makes outcomes/learning safe to enable later.

A runtime audit event answers: *which agent, on whose behalf, in which turn, made which gate/lifecycle transition, with what result* — **never** what was said.

---

## 2. Scope & exclusions

**In scope (metadata only):**
- Turn lifecycle transitions (turn opened, draft emitted, turn closed).
- Gate decisions (`requireSteveComplete`, michael-gate whitelist hit/miss, activation-boundary checks).
- Outcome-draft and guided-action-draft *emission events* (that a draft was produced — not its content).
- Persistence-family enable/disable and kill-switch flips (when R0+ later exists).

**Excluded (never in a runtime audit record):**
- Raw transcript / message bodies / generated copy.
- Prospect PII beyond an opaque id.
- Income/compensation/cycle/placement values.
- Anything `.com`-surfaced or Telnyx/PSTN/call-control-derived.
- LLM prompts/completions.

---

## 3. The runtime audit event — additive extension of 4.J

The cleanest, drift-free design is to add a **runtime entity kind** and a **`runtime.*` action namespace** to the existing `AuditLogEntry`, plus an optional `runtime` context block. All additions are **append-only to `packages/shared/src/types.ts`** (new exports at the bottom; never edit existing ones) — to be done in P7.4, not now.

### 3.1 New entity kind (additive to `AuditEntityKind`)

```
'runtime_turn'      // a single agent runtime turn
```

(`michael_session` already exists for the higher-level session; `runtime_turn` is the per-turn grain.)

### 3.2 Action namespace

Runtime audit actions use the existing `domain.entity.action` convention with a `runtime` domain:

| Action | Severity | When |
|---|---|---|
| `runtime.turn.opened` | info | a runtime turn begins |
| `runtime.turn.draft_emitted` | info | an outcome/guided-action draft is returned (returned-only; content not stored) |
| `runtime.turn.closed` | info | turn completes |
| `runtime.gate.allowed` | info | a gate (steve/michael/activation) passed |
| `runtime.gate.denied` | warn | a gate blocked the turn |
| `runtime.persistence.enabled` | critical | a persistence family flag flipped on |
| `runtime.persistence.disabled` | critical | a persistence family flag flipped off / kill switch |

### 3.3 Proposed `RuntimeAuditContext` (new export — additive, P7.4)

```ts
// APPEND to packages/shared/src/types.ts in P7.4 — shown here for review only.
export interface RuntimeAuditContext {
  turnId: string;            // deterministic per turn
  correlationId: string;     // groups turns in one interaction
  agent: 'michael' | 'steve' | 'ivory';
  baId: string;              // on whose behalf (BA scope)
  tenantId: string;          // Team Magnificent tenant scope
  gate: string | null;       // gate evaluated, if any (e.g. 'requireSteveComplete')
  draftKind: 'outcome' | 'guided_action' | null; // what kind of draft, if emitted
  // No body, no content, no PII beyond ids.
}
```

A runtime audit event is then an `AuditLogEntry` with:
- `actor` = `{ kind: 'system', label: 'runtime:<agent>' }` or `{ kind: 'ba', baId, displayName }` when BA-initiated;
- `entity` = `{ kind: 'runtime_turn', id: turnId, displayLabel: '<agent> turn' }`;
- `action` ∈ the table in §3.2;
- `context.requestId` reused for HTTP trace; the new `RuntimeAuditContext` carried alongside (stored under a dedicated field, not overloading `before`/`after`).

### 3.4 Determinism & idempotency

- `entryId` for runtime events: `audit_<ts>_<8hex>` (existing minting), but the **dedup key** is `(turnId, action)` — a retried turn-open must not double-write. P7.4 branches on existence (gateway `update` does not honor `upsert`).
- `turnId` and `correlationId` are produced by the server turn coordinator (S2.7), not by agents.

---

## 4. Storage mapping (reuses 4.J triple-stack)

| Store | Collection / label | Content |
|---|---|---|
| MongoDB | `mcs_audit_log` (canonical) | full `AuditLogEntry` + `runtime` context block |
| Neo4j | `(:AuditEntry {entryId})` | base props + `agent`, `turnId`, `gate`; `(:AuditEntry)-[:ACTED_BY]->(:BrandAmbassador)` when BA-initiated |
| ChromaDB | `mcs_audit_log` | semantic blob `action=… agent=… gate=… result=…` (no body) |

Snapshot clamping (4KB, already in `auditLog.ts`) applies. Runtime events carry **no** `before`/`after` body — they are lifecycle markers, so the clamp is a backstop, not a routine path.

**Single canonical audit collection (naming-drift guard).** Per the canonical schema (P10 §4.D), `mcs_audit_log` is **the** canonical append-only audit collection in Mongo, mirrored to Chroma `mcs_audit_log` and Neo4j `(:AuditEntry)`. Runtime audit events add rows to this **same** collection — they do **not** stand up a second audit collection. Do **not** create an unprefixed Mongo `audit_log`: the only legitimate unprefixed `audit_log` is a Chroma-only sponsor-override mirror. All app audit collections/labels are `mcs_`-prefixed and share the one canonical substrate — one concept, one name.

**Governed door.** When R0 is implemented, the `mcs_audit_log` collection carries a Mongoose model → `$jsonSchema` validator (P10 §1 pipeline: `mongo/jsonSchema/generate.ts` → `apply.ts`, `validationLevel:'moderate'`, `validationAction:'error'`) whose required-core includes the runtime fields in §3. Malformed runtime audit rows are rejected at the app's own governed door — no Universal Gateway, per ACR-0007 and P7.3 §4.3.

---

## 5. Read surface

Runtime audit reuses the existing 4.J read path: `GET /api/admin/audit` with `actionPrefix: 'runtime.'` and `entityKind: 'runtime_turn'`. **No new route** is introduced (standing prohibition: no `/api/runtime/*` route family). P7.11 (Learning Observability) consumes this read surface for aggregate metrics — never a manual review queue.

---

## 6. Invariants (acceptance bar for P7.4)

1. Append-only — no update/delete of runtime audit entries.
2. Metadata only — schema makes it structurally impossible to store a body (no free-text content field; `reason` is for gate-denial cause, capped).
3. All-three-or-fail via `tripleStackWrite`.
4. Deterministic dedup key `(turnId, action)`.
5. Tenant + BA + agent scope on every record.
6. No agent writes — only the server turn coordinator / domain layer appends.
7. Additions to `types.ts` are append-only; `auditLog.ts` gains a thin `appendRuntimeAuditEntry` wrapper over `appendAuditEntry` (no edit to existing exports).

---

## 7. What this document does NOT do

- Does not add any export to `types.ts` or any code to `auditLog.ts` (that is P7.4, post-approval).
- Does not write to any store.
- Does not introduce a route.
- Does not enable runtime persistence.

---

## 8. Open questions for Kevin

1. Should `runtime.gate.denied` be `warn` (proposed) or `critical`? Gate denials are expected traffic, so `warn` avoids flooding the "needs Kevin" widget — but a denial on the activation boundary may warrant `critical`. Recommend: `warn` default, `critical` only for activation-boundary denials.
2. Retention for runtime audit (R0): keep indefinitely like 4.J admin audit (recommended, since it is metadata-only and small), or apply a rolling window? Recommend: indefinite, matching the append-only 4.J substrate.
