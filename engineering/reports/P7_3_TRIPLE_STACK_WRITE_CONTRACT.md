# P7.3 — Triple-Stack Write Contract (AUTHORITATIVE — Path B killed)

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.3 (contract proposal — authoritative revision)
- Status: **PROPOSAL — NON-RATIFIED. Contract only.** No persistence implementation is authorized by this document.
- Base SHA: `cce9a951e3ca1b04307f68245201c389375b0a7a` (verified HEAD == Base SHA)
- Supersedes: the prior two-path P7.3 draft (Path A + Path B). **This revision removes Path B entirely.** See §9.
- Depends on: P7.1 (governance), P7.2 (audit schema). Implementation deferred to P7.4+.
- Aligns to: ACR-0007 (runtime persistence is DIRECT; Universal Gateway is dev tooling), the canonical MCS V2 schema design `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (commit `f976dd3`), `docs/graphrag-schema-contract.md` (scoped to Gateway memory — **not** app runtime), CLAUDE.md #135 (GraphRAG drift class), decision `dec_runtime_persistence_direct_not_gateway` (seq 28).
- Anchors to: `server/src/services/tripleStack.ts`, `server/src/services/gateway.ts`, `server/src/services/persistence/flags.ts`.

---

## 0. What changed in this revision (read first)

The prior P7.3 draft defined **two** write paths:

- **Path A — `tripleStackWrite()`** for operational records (audit, outcomes). *Correct — app-direct.*
- **Path B — `quadstack.write` (schema-enforced)** for memory/lineage records (GraphRAG, handoffs, decisions, learning notes). *Routed through the Universal Gateway's `QuadStackConnector`.*

**Path B is now DEPRECATED and removed from every app runtime path.** `quadstack.write` lives in `D:/server-gateway-mcp/gateway-core/src/connectors/QuadStackConnector.js` and writes into the **gateway's** `universal_gateway` stores. Making the app's memory/lineage layer call it makes the app **depend on the Universal Gateway as a production runtime dependency** — a direct violation of **ACR-0007**, which governs that *"the MCP Universal Gateway V2 is developer tooling only and never a production runtime dependency."*

**The rule now:** there is **one** write path — the app-direct seam (`persist()` / `tripleStackWrite()`) into the app's **own dedicated triple-stack**. Operational records *and* memory/lineage/outcome/learning/GraphRAG records all travel it. The gateway appears in no app write path.

---

## 1. Purpose

Define the **single, mandatory contract** that every Phase 7 persistent write obeys. Phase 7 introduces new write families (runtime audit, outcomes, learning candidates, GraphRAG records); without one contract they would drift in field names, store routing, and failure behavior — exactly the Chat #135 failure class. This contract makes the write path uniform, app-direct, and its failure behavior loud.

It defines **one write path** and the record shapes that travel it:

- **`tripleStackWrite()` / `persist()`** — the app-direct seam into the app's own MongoDB + Neo4j + ChromaDB. Already exists.

No second path. No `quadstack.write`. No direct store calls from agents. No raw `gatewayCall` to a store outside this helper for a persistent write.

---

## 2. The app's dedicated triple-stack (write target)

Every Phase 7 persistent write lands in the **app's own dedicated stores**, never the gateway's:

| Store | App target (dedicated) | Convention |
|---|---|---|
| MongoDB | database `momentum` @ `:30000` | camelCase fields; `_id` = natural/deterministic key |
| Neo4j | `:7710` | business labels per P10 §6; `MERGE` on `{id}`, specific-verb relationships |
| ChromaDB | `:8200`, **`mcs_`-prefixed** collections | id == Mongo `_id`; `document` = short summary; flat scalar `metadata` with a `kind` discriminator; 384-dim `all-MiniLM-L6-v2` |

These are distinct from the Universal Gateway's stores (`universal_gateway` DB, gateway Neo4j/Chroma). The gateway's `namespace: universal_gateway`, `chat_number`, and `chat_registry` concepts govern **gateway** memory — they do **not** appear on app records (§4.2, §7).

Whether each store resolves to the **direct adapter** or the MCP gateway HTTP path *for developer/dev-mode use* is decided by `flags.ts` (§3.3). Per `dec_runtime_persistence_direct_not_gateway` (seq 28) and ACR-0007 Part B, **direct is the ratified production target**; any gateway routing is developer tooling only and must be flag-off in production.

---

## 3. The single write path — `tripleStackWrite()` contract

The helper exists at `server/src/services/tripleStack.ts`. The contract for callers:

### 3.1 Required shape

```ts
await tripleStackWrite({
  id,                        // deterministic, shared across all three stores
  mongoCollection,           // momentum DB collection (mcs_-family where applicable)
  mongoDoc,                  // minimal payload — scoped fields, no body dump
  neo4j: { cypher, params }, // optional; MERGE on {id}, specific verbs only
  chroma: { collection, document, metadata }, // optional; mcs_-prefixed collection; short semantic summary
  mongoDatabase,             // defaults to 'momentum'
});
```

### 3.2 Invariants (enforced by the helper + required of callers)

1. **Fail-before-Mongo.** If a Chroma leg is present, the collection is asserted to exist first (`assertChromaCollectionExists`, #147) so a missing collection can never orphan a Mongo row. Callers must not bypass this by calling stores directly.
2. **Shared id.** `id` is Mongo `_id`, Neo4j node `{id}`, and Chroma id — identical across all three. Deterministic per P7.1 §4.2.
3. **Mongo insert uses `documents:` (plural array).** `update` does **not** honor `upsert:true` — callers branch on existence for upserts. (Both are documented gotchas at the top of `tripleStack.ts`.)
4. **Neo4j uses `neo4j.cypher` → gateway/adapter action `cypher`, param `query`.** `MERGE` on `{id}`; relationship names are specific verbs (no `RELATED`/`CONNECTED_TO`).
5. **Chroma `add` does not auto-create collections** — collection ensured at boot (`ensureChromaCollections`) or via the guard. Collection name is **`mcs_`-prefixed** (P10 §7.1; FINDING drift below). `document` is a short semantic summary, never a JSON dump; `metadata` is a flat scalar map carrying a required `kind` discriminator + scope ids + ISO timestamps.
6. **All-three-or-fail.** A required leg that throws fails the whole write loud. No silent fallback. (Optional `neo4j`/`chroma` legs are "optional" only in the sense that pure-document records may omit them by design — not a fallback on error.)
7. **Read-back verification** on the first write of a new family during canary (P7.1 §4.3), per store leg.

### 3.3 Direct-vs-gateway transparency (production = direct)

Whether a store resolves to the **direct adapter** or the MCP gateway HTTP path is decided by `flags.ts` (`PERSISTENCE_DIRECT_ENABLED` master switch, default `false` today; per-store `PERSISTENCE_<STORE>_MODE`). Callers do not know or care — `gatewayCall` routes transparently. Per `dec_runtime_persistence_direct_not_gateway` (seq 28) and ACR-0007, **direct is the ratified production target**; the MCP gateway is developer tooling only. Phase 7 callers must remain agnostic so the in-flight S1.3 cutover stays a flag flip, not a rewrite. **No Phase 7 record shape depends on the gateway being present.**

---

## 4. Record families and the app memory envelope

All families below travel the **same** `tripleStackWrite()` path (§3). The distinction is now the *shape stamped on the record*, not a second connector.

### 4.1 Routing table (one path, two envelope classes)

| Record family | Path | Envelope class | Store target |
|---|---|---|---|
| Runtime audit (P7.2 / R0) | `tripleStackWrite` | operational | `mcs_audit_log` (momentum) |
| Outcome capture (P7.4 / R1) | `tripleStackWrite` | **app-memory envelope** (§4.2) | `mcs_outcomes` (momentum) |
| Learning candidate (P7.5 / R2) | `tripleStackWrite` (review-only) | **app-memory envelope** | `mcs_learning_candidates` (momentum) |
| GraphRAG learning record (P7.6 / R3) | `tripleStackWrite` | **app-memory envelope** | `mcs_*` GraphRAG collections (momentum) |

**Decision test:** *"Is this a durable app fact that a future query will recall as memory or trace to a source?"* → stamp the **app-memory envelope** (§4.2). *"Is this an operational lifecycle marker read back by id/filter?"* → operational shape (P7.2). **Both use `tripleStackWrite`; neither uses the gateway.**

### 4.2 The app-memory envelope (replaces the deprecated `quadstack.write` base envelope)

Memory/lineage/outcome/learning/GraphRAG records carry a canonical, app-scoped envelope. It preserves the anti-drift discipline of the Chat #135 base envelope but is **app-scoped** — `momentum` namespace, `mcs_` stores, and **no gateway-only fields** (`chat_number`, `chat_registry_id`, `namespace: universal_gateway` are forbidden on app records).

```ts
// Proposed for a future append to packages/shared/src/types.ts (P7.4+, post-approval).
export interface McsMemoryEnvelope {
  id: string;                 // canonical, shared across all three stores (Mongo _id / Neo4j {id} / Chroma id)
  type: McsMemoryType;        // 'outcome' | 'learning_candidate' | 'graphrag_record' | 'graphrag_chunk' | ...
  schemaVersion: number;      // starts at 1; bump only via a decision
  namespace: 'momentum';      // app namespace — NEVER 'universal_gateway'
  source: string;             // writing service, e.g. 'mcs_server' | 'context_manager' | 'mcs_learning_pipeline'
  createdAt: string;          // ISO-8601 UTC '…Z' string (P10 §3.3 — never a BSON Date)
  title: string;              // human-readable label for admin/search
  originKind: 'system';       // ALL Phase 7 app memory is server-derived → always 'system'. Never 'chat'.
  serviceName: string;        // required origin field for originKind:'system' (e.g. 'mcs_learning_pipeline')
  tenantId: string;           // Team Magnificent tenant scope
  baId?: string;              // BA scope where the record is BA-scoped
  derivedFrom?: string[];     // provenance: ids of source records/chunks this was derived from
}
```

**Field conventions (governed-from-birth):**
- **camelCase** — app data convention (P10 §3.6). App memory is app data in `momentum`; it does not inherit the gateway family's snake_case. *(Open decision O-1 for Kevin: camelCase-for-app-consistency [recommended] vs snake_case-for-cross-system-portability. Whichever is chosen is enforced once, at birth, via Mongoose + `$jsonSchema`.)*
- **`originKind` is always `'system'`.** Phase 7 app memory is derived by the server, never by a chat. There is therefore **no `chat_number`** on any app record — the field does not exist in this envelope. This structurally removes the Chat #135 "fabricated chat number" failure mode from the app surface.
- **Deterministic `id`** from `(family, turnId | sourceId, kind)` so retries are idempotent (P7.1 §4.2).

### 4.3 Governed door (Mongoose + `$jsonSchema`)

Per the governed-from-birth principle (P10 §1 methodology; the `mongo/jsonSchema/generate.ts` → `apply.ts` pipeline), each new `mcs_` memory collection ships with a real per-collection Mongoose model (required-core + typed fields) that the existing generator turns into a `$jsonSchema` validator applied at `validationLevel:'moderate'`, `validationAction:'error'`. The envelope fields above are the **required-core** for every memory collection. This replaces the gateway's `enforce_schema` role with the app's own governed door — the same guarantee (reject a malformed memory record before it lands), inside the app, no gateway.

### 4.4 Banned aliases (unchanged intent, app-enforced)

No `date`, `timestamp`, `chat`, `synced_chat`, or `start_time` on any app memory record — the same anti-drift ban from Chat #135, now enforced by the app's `$jsonSchema` validator (§4.3) instead of the gateway's `enforce_schema`. Additionally banned on app records: `chat_number`, `chat_registry_id`, and `namespace: 'universal_gateway'` (those are **gateway-only** and must never appear on an app record). If a write fails validation, **fix the payload — never loosen the validator.**

---

## 5. Universal prohibitions

1. **No `quadstack.write`, no gateway in any app write path.** The Universal Gateway is developer tooling only (ACR-0007). If an app runtime path is about to call the gateway for a persistent write — STOP.
2. **No direct agent writes.** Agents never call MongoDB/Neo4j/ChromaDB or the gateway for a persistent write. All writes go server-side through `tripleStackWrite`, behind the domain boundary. The Context Manager is the sole Context Packet assembler.
3. **No `.com` data**, no Telnyx/PSTN/call-control payloads, no income/compensation/cycle/placement values, no LLM prompts/completions in any persisted record.
4. **Minimal payload.** Scope ids + structured fields. No raw transcript by default.
5. **Tenant + BA + agent scope** on every operational record; app-memory envelope + provenance on every memory record.
6. **Deterministic ids** for idempotent retries; write-readback verification on first write of a new family during canary.
7. **No new persistence enabled by default** — every family is canary/flag-gated per P7.1 §6.

---

## 6. Failure & rollback behavior

- **Partial write** (one leg fails) → the whole logical write fails loud and is surfaced to the caller; no leg is best-effort. Operational callers translate this to a 5xx / retry; they never swallow it.
- **Schema rejection** (app `$jsonSchema` validator, §4.3) → the write is rejected before any store mutates in that logical operation; caller fixes the payload. (This is the app-side replacement for the gateway's `GRAPH_RECORD_SCHEMA_INVALID`.)
- **Cleanup** (canary/bad writes) → delete-by-id across all three app stores using the deterministic `id` (P7.1 §6.2).

---

## 7. Relationship to the Gateway GraphRAG contract (`docs/graphrag-schema-contract.md`)

`docs/graphrag-schema-contract.md` is **explicitly scoped** (its own header) to *"Universal Gateway memory, provenance, lineage, and derived GraphRAG records"* — the gateway's `universal_gateway` namespace, `chat_registry`, `QuadStackConnector`, and `quadstack.write`. It governs **gateway** memory (Claude/Codex chat provenance, Perry handoffs, ARCHIE imports). It does **not** govern MCS V2 app runtime memory.

Phase 7's app memory is a **separate family** in the app's own stores. It **borrows the anti-drift discipline** (shared id, canonical typed envelope, deterministic ids, banned aliases, one-concept-one-name) but **not the transport** (`quadstack.write`) and **not the gateway-only fields** (`chat_number`, `chat_registry_id`, `universal_gateway`). The two families stay separate and never cross-apply validators (P10 §2). The gateway contract remains valid *for the gateway*; this document governs *the app*.

---

## 8. What this document does NOT do

- Does not modify `tripleStack.ts`, `gateway.ts`, `flags.ts`, `types.ts`, or `index.ts`.
- Does not perform any write to MongoDB, Neo4j, or ChromaDB.
- Does not enable any persistence family — it documents the required call shape for P7.4+ implementation, post-approval.
- Does not authorize the S1.3 direct-cutover flag flip (separate approval).
- Does not modify `docs/graphrag-schema-contract.md` (gateway-scoped; out of app scope).

---

## 9. DEPRECATION NOTICE — Path B (`quadstack.write`)

**Path B is DEPRECATED for all MCS V2 app runtime use, effective this revision.**

- **What it was:** memory/lineage records (GraphRAG, handoffs, decisions, learning notes) routed through the Universal Gateway's `QuadStackConnector.write` with `options.enforce_schema: true` and the `docs/graphrag-schema-contract.md` base envelope (`namespace: universal_gateway`, `chat_number`, etc.).
- **Why it is killed:** it makes the app's agent-memory layer **depend on the Universal Gateway as a production runtime dependency**, which **violates ACR-0007** (*"the MCP Universal Gateway V2 is developer tooling only and never a production runtime dependency"*) and `dec_runtime_persistence_direct_not_gateway` (seq 28). It also scopes app memory into the gateway's `universal_gateway` namespace with gateway-only fields (`chat_number`, `chat_registry_id`) that do not belong on app-derived, `originKind:'system'` records.
- **Replacement:** the single app-direct `tripleStackWrite()` path (§3) into the app's own dedicated stores (§2), stamped with the app-memory envelope (§4.2) and guarded by the app's own `$jsonSchema` governed door (§4.3).
- **Standing rule:** any future proposal that reintroduces `quadstack.write` (or any gateway call) into an app runtime write path is out of contract and must be rejected at review.

CLAUDE.md still carries a "#135 GraphRAG protocol" note that mandates `quadstack.write` for memory writes. That note is correct **for gateway memory tooling** but is superseded **for MCS V2 app runtime** by ACR-0007 and this contract. Reconciling the CLAUDE.md wording to scope it to gateway-only is recommended (tracked as open decision O-2; a doc edit outside this design run's allowed files).

---

## 10. Acceptance summary

A Phase 7 write is contract-compliant iff: it uses the single app-direct `tripleStackWrite()` path (never `quadstack.write`, never a raw store call, never the gateway); it targets the app's own dedicated stores (§2); ids are shared and deterministic; memory-class records carry the app-memory envelope (§4.2) and pass the app `$jsonSchema` governed door (§4.3); operational records carry full scope; the universal prohibitions (§5) hold; and failure is loud (§6). P7.4 and every later persistence slice are reviewed against this checklist before merge.
