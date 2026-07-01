# DECISION — Governed-From-Birth Dedicated Triple-Stack (Founding Principle)

## Momentum Creation System V2

Status: **Founding principle — records the governance posture for the app's dedicated triple-stack.** Formalizes a principle already applied across `P10_MCS_V2_SCHEMA_DESIGN.md` and `ACR-0007`. This document states the principle; it authorizes no store write, no validator application, and no destructive change on its own (write-freeze + Non-Destructive Rule remain in force).

Type: Persistence Pattern / Schema-Governance Founding Principle

Risk: Structural (sets the standard every new collection/label/write is held to).

Recorded: 2026-07-01 — Phase 7 design run (Claude Code Instance 5).

Canonical alignment: `ACR-0007` (runtime persistence is direct; Universal Gateway is dev tooling); `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (methodology §1, conventions §3, rollout §8); `FINDING_chroma_boot_naming_drift.md` (the drift this principle prevents).

---

## 1. Principle

> The MCS V2 app persists to its **own dedicated triple-stack** — MongoDB (`momentum` @30000), Neo4j (@7710), ChromaDB (`mcs_*` @8200) — and that stack is **governed from birth**: every collection, node label, and write is schema-shaped, canonically named, and routed through the governed door **from the first write**, not retrofitted later.

"Governed from birth" is the antidote to the two failure classes MCS V2 has repeatedly hit: the Chat #135 drift class (same concept, divergent names → broken retrieval) and the half-written triple-stack class (a leg fails after another commits → orphan rows). Governance applied at creation prevents both; governance retrofitted after drift only chases them.

---

## 2. Relationship to the Universal Gateway (ACR-0007)

The app's dedicated triple-stack is **separate** from the Universal Gateway's stores (`universal_gateway` DB, gateway Neo4j/Chroma). Per `ACR-0007`, the Universal Gateway V2 is **developer tooling only and never a production runtime dependency**. The app writes **direct** to its own stack; the gateway's `quadstack.write` / `QuadStackConnector` and its `docs/graphrag-schema-contract.md` envelope govern **gateway** memory, not app runtime. This founding principle governs the **app** stack; the gateway governs itself.

---

## 3. The three pillars

### 3.1 Schema-shaped (Mongoose + `$jsonSchema`, from birth)

Every app Mongo collection ships a **real per-collection Mongoose model** whose `$jsonSchema` validator is applied via the existing pipeline (`server/src/mongo/jsonSchema/generate.ts` → `apply.ts`, `validationLevel:'moderate'`, `validationAction:'error'`) — **at the time the collection is introduced**, not as a later hardening pass. The `required`-core is the fields written on every path (key + envelope/scope fields). First-pass posture is `additionalProperties:true` to tolerate polymorphic writers; tightening to `additionalProperties:false` follows the §5 reconciliations in `P10`. Neo4j labels ship per-label uniqueness constraints on their business key; Chroma collections ship a registered name + the record contract (id == `_id`, summary `document`, flat `kind`-tagged `metadata`, 384-dim `all-MiniLM-L6-v2` + `model`/`model_version` provenance).

**The governed door replaces external enforcement.** The app's own `$jsonSchema` validator is the rejection point for a malformed record — there is **no dependency on the gateway's `enforce_schema`** to validate an app write (ACR-0007). Memory/lineage records carry the app-memory envelope and pass the app's governed door (`engineering/reports/P7_3_TRIPLE_STACK_WRITE_CONTRACT.md` §4).

### 3.2 One-concept-one-name (canonical naming)

A single concept has **exactly one canonical name** across all three stores: Mongo collection, Neo4j label, and Chroma collection map to one concept with a shared canonical `id` (Mongo `_id` == Neo4j `{id}` == Chroma id). App-owned Chroma collections are **`mcs_`-prefixed**. Ad hoc aliases, duplicate names for the same concept, and unprefixed drift are governance defects — see `FINDING_chroma_boot_naming_drift.md` for a live example (`audit_log` vs `mcs_audit_log`). Named, documented exceptions (e.g. a Chroma-only mirror) are allowed **only when written down** in the registry and `P10` §4/§7; silence is not an exception.

**Casing is per software layer; the name is not (Kevin).** Both camelCase and snake_case are legitimate and are chosen by the layer — **camelCase** for TypeScript / app data / Mongo `momentum`; **snake_case** for the gateway-memory family and snake-case surfaces (P10 §3.6). But a concept has **one canonical name**, and its casing is a *deterministic transform* of that one name (`tmagId` ⇄ `tmag_id` are the same concept). The rule is: **maintain the same nomenclature throughout — never two different names for the same thing.** Field-name synonyms (`tmMemberId`, `memberTmagId`, `userId` for a member id, etc.) are the Chat #135 drift class and are forbidden.

### 3.3 Governed door only (no ad hoc store calls)

Every persistent write goes through the **single app-direct seam** — `tripleStackWrite()` / `persist()` (`server/src/services/tripleStack.ts`), which enforces: fail-before-Mongo Chroma-collection assertion, shared deterministic `id`, all-three-or-fail (no silent best-effort leg), and read-back verification on first-of-family during canary. **No agent writes a store directly. No raw store call bypasses the seam. No gateway call in any app write path.** The Context Manager remains the sole Context Packet assembler.

---

## 4. Consequences (what this principle requires of every new persistence slice)

1. A new collection/label is introduced **with** its Mongoose model + `$jsonSchema` (Mongo), uniqueness constraint (Neo4j), and registry entry + record contract (Chroma) — in the same slice, not deferred.
2. The canonical name is chosen once, `mcs_`-prefixed for Chroma, and recorded in `P10` §4/§7 + the registry; any exception is documented at birth.
3. The write goes through `tripleStackWrite`; the record carries the required-core (+ app-memory envelope for memory/lineage records).
4. No new persistence is enabled by default — canary/flag-gated per `engineering/reports/P7_1_RUNTIME_PERSISTENCE_GOVERNANCE_PROPOSAL.md` §6.
5. Failure is loud; cleanup is delete-by-id across all three stores using the deterministic `id`.

---

## 5. What this decision does NOT do

- Does not write to any store, apply any validator, or create any collection/constraint (write-freeze / Non-Destructive Rule in force — application is per-store, per-collection, separately approved, per `P10` §8).
- Does not modify runtime code.
- Does not redefine the Universal Gateway's own governance (gateway governs itself; this governs the app stack).
- Does not supersede `P10_MCS_V2_SCHEMA_DESIGN.md`; it states the principle `P10` operationalizes.

---

## 6. Structured record

```json
{
  "decision_id": "DECISION-governed-dedicated-stack-founding-principle",
  "title": "Governed-from-birth dedicated triple-stack (founding principle)",
  "status": "recorded",
  "risk_level": "structural",
  "change_type": "persistence-founding-principle",
  "recorded_by": "Claude Code (Instance 5), Phase 7 design run",
  "recorded_at": "2026-07-01",
  "base_sha": "cce9a951e3ca1b04307f68245201c389375b0a7a",
  "pillars": ["schema_shaped_mongoose_jsonschema", "one_concept_one_name", "governed_door_only"],
  "app_stack": { "mongo": "momentum@30000", "neo4j": "@7710", "chroma": "mcs_*@8200" },
  "canonical_authority": [
    "organization/ACR-0007-runtime-persistence-direct-not-gateway.md",
    "engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md",
    "organization/FINDING_chroma_boot_naming_drift.md"
  ],
  "authorizes_store_write": false,
  "authorizes_validator_application": false,
  "non_destructive_rule": true
}
```

---

## 7. Related

- `ACR-0007` — the direct-not-gateway persistence law this principle sits under.
- `FINDING_chroma_boot_naming_drift.md` — a live one-concept-one-name violation this principle names.
- `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` — the concrete schemas that operationalize this principle across 49 Mongo collections, Neo4j constraints, and the Chroma registry.
- `engineering/reports/P7_3_TRIPLE_STACK_WRITE_CONTRACT.md` — the single app-direct write path + app-memory envelope + `$jsonSchema` governed door.
- `engineering/reports/P7_1_RUNTIME_PERSISTENCE_GOVERNANCE_PROPOSAL.md` — the canary/flag-gated enable ladder every governed slice climbs.
