# P7.6 — GraphRAG Architecture

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.6 (architecture proposal — design only)
- Status: **PROPOSAL — NON-RATIFIED. Architecture only.** No persistence or retrieval implementation is authorized by this document.
- Base SHA: `cce9a951e3ca1b04307f68245201c389375b0a7a` (verified HEAD == Base SHA)
- Rung: **R3** in the P7.1 persistence ladder (enabled only after R0 audit, R1 outcomes, R2 candidates are proven).
- Depends on: P7.1 (governance), P7.3 (write contract — Path B killed), P7.4 (outcomes), P7.5 (learning candidates).
- Aligns to: **ACR-0007** (app-direct persistence; Universal Gateway is dev tooling), canonical schema `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (`f976dd3`, §6 Neo4j / §7 Chroma), the ratified `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` (graph/reindex model), P7.3 §4 (app-memory envelope).

---

## 1. Purpose

Define the architecture for **GraphRAG** — combined graph (Neo4j) + vector (Chroma) retrieval of derived organizational memory — built **entirely over the app's OWN dedicated stores, app-direct**. This is the rung (R3) that lets the Context Manager retrieve *approved, evolved* knowledge semantically (Chroma) and by lineage (Neo4j), so agents guide Brand Ambassadors with richer context.

The load-bearing constraint: **GraphRAG runs on the app's dedicated triple-stack (Mongo `momentum` @30000, Neo4j @7710, Chroma `mcs_*` @8200), reached directly.** It does **not** use the Universal Gateway, `quadstack.write`, `QuadStackConnector`, the `universal_gateway` namespace, or the gateway's GraphRAG contract as a runtime dependency (ACR-0007, P7.3 §9). The gateway's `docs/graphrag-schema-contract.md` governs *gateway* memory; this document governs *the app's own* GraphRAG.

---

## 2. What GraphRAG is here — and is not

**Is (in scope):**
- A **retrieval architecture** over the app's own derived-memory records: a **vector layer** (Chroma, semantic recall) + a **graph layer** (Neo4j, lineage/traversal) stitched by a **shared canonical `id`** (P7.3 §3.2).
- A read/write model for **derived memory records** (`type: 'graphrag_record'`, `'graphrag_chunk'`) that carry the app-memory envelope (P7.3 §4.2) and are written through the single `tripleStackWrite` seam.
- The retrieval substrate the **Context Manager** queries when assembling Context Packets from **active, retrieval-ready** knowledge only.

**Is not (excluded):**
- **Not** the gateway's GraphRAG. No `quadstack.write`, no `universal_gateway`, no `chat_number`/`chat_registry_id` on app records, no gateway runtime dependency (ACR-0007).
- **Not** a knowledge-approval mechanism. GraphRAG only **retrieves** approved knowledge; it never approves. No agent may approve knowledge, and candidates (P7.5, review-only) are never indexed into active GraphRAG collections.
- **Not** an agent-writable store. Agents query through the Context Manager; they never write graph/vector records directly.
- **Not** `.com`-surfaced; no income/compensation/cycle/placement, no PII beyond opaque ids, no raw transcript/LLM bodies.

---

## 3. The two layers (over the app's own stores)

### 3.1 Vector layer — Chroma `mcs_*` (semantic recall)

- All app GraphRAG collections are **`mcs_`-prefixed** and registered in `services/chromaCollections.ts` `CHROMA_COLLECTIONS` (P10 §7.1); ensured at boot (`ensureChromaCollections`) and asserted before write (`assertChromaCollectionExists`, P7.3 §3.2 invariant 5).
- **Active vs review-only separation** is mandatory (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §19.2): active-knowledge collections (per domain + language, e.g. `mcs_success_knowledge_en`, `mcs_organizational_knowledge_es`) are **disjoint** from review-only candidate collections (`mcs_learning_candidates_review`, P7.5 §3.1). GraphRAG active retrieval reads only active collections.
- **Embeddings:** `all-MiniLM-L6-v2`, **384-dim**, with provenance `model` + `model_version` on every record's metadata (P10 §7.3). Two client checks enforced: `dimensions === 384` and `model_version` matches the local publisher.
- **Record contract** (P10 §3.4 / §7.2): Chroma `id` == Mongo `_id`; `document` = short semantic summary sentence (never JSON); `metadata` = flat scalar map with a required `kind` discriminator + entity ids + ISO timestamps for `where` filtering + the app-memory envelope fields.

### 3.2 Graph layer — Neo4j @7710 (lineage & traversal)

- Business labels and per-label uniqueness constraints follow P10 §6 (constraints on `{id}`/business keys; today none exist — GraphRAG activation applies them idempotently, `IF NOT EXISTS`).
- GraphRAG-relevant labels/edges (aligned to `KNOWLEDGE_EVOLUTION_RUNTIME.md` §20.1, scoped to the app's Neo4j — **not** the gateway's `Conversation/Handoff/Chunk` universal-memory labels):

```cypher
// App-owned GraphRAG graph (Neo4j @7710). MERGE on {id}; specific-verb relationships only.
(:Knowledge {id})-[:HAS_VERSION]->(:KnowledgeVersion {id})
(:Knowledge)-[:SUPERSEDES]->(:Knowledge)
(:Knowledge)-[:HAS_LANGUAGE_VARIANT]->(:Knowledge)
(:Knowledge)-[:BELONGS_TO_DOMAIN]->(:KnowledgeDomain)
(:Knowledge)-[:DERIVED_FROM]->(:LearningSignal)
(:Knowledge)-[:SUPPORTED_BY]->(:Outcome)         // links to P7.4 outcomes
(:LearningCandidate)-[:APPROVED_AS]->(:Knowledge) // links to P7.5 approved candidates
(:Knowledge)-[:SCOPED_TO]->(:TeamMagnificent)
(:Knowledge)-[:AVAILABLE_TO]->(:Agent)            // steve / michael / ivory
// Lexical sub-layer for source traceability:
(:Document {id})-[:HAS_CHUNK]->(:Chunk {id})
(:Chunk)-[:NEXT_CHUNK]->(:Chunk)
(:Chunk)-[:MENTIONS]->(:Entity)
```

- **No generic relationships** (`RELATED`, `CONNECTED_TO`) — specific verbs only (P7.3 §3.2 invariant 4).
- **`MERGE`-on-typo caveat** (P10 §6.3): constraints prevent duplicate ids but not phantom nodes from a misspelled key. GraphRAG writes use the MATCH-anchor + read-back discipline (`tieredWrite` Tier-1 pattern) for graph legs.

### 3.3 The stitch — shared `id`

A single derived-memory record is one `id` across all three app stores: Mongo `_id`, Neo4j `{id}`, every Chroma id (P7.3 §3.2). A GraphRAG answer starts from a vector hit (Chroma), resolves the shared `id`, and traverses Neo4j for lineage/related knowledge — all within the app's own stores.

---

## 4. Write model (single, app-direct)

GraphRAG records are **derived memory** → memory-class → written through the **one** `tripleStackWrite` seam (P7.3 §3), app-memory envelope (P7.3 §4.2), `$jsonSchema` governed door (P7.3 §4.3). **No `quadstack.write`, no gateway.**

```ts
export interface McsGraphRagRecord extends McsMemoryEnvelope {
  // envelope: id, type:'graphrag_record' | 'graphrag_chunk', schemaVersion, namespace:'momentum',
  //   source, createdAt, title, originKind:'system', serviceName:'mcs_graphrag', tenantId, baId?, derivedFrom
  knowledgeObjectId: string;   // the active Knowledge Object this record indexes
  version: number;             // knowledge version (retrieval reads the active version only)
  domain: 'success' | 'training' | 'relationship' | 'performance' | 'organizational';
  language: 'en' | 'es';
  summary: string;             // the Chroma document (short summary; never source dump)
  model: 'all-MiniLM-L6-v2';   // embedding provenance (P10 §7.3)
  modelVersion: string;        // locked checksum; enforced 384-dim
  retrievalReady: boolean;     // only true records are eligible for active retrieval (§5)
}
```

Writes originate only from the server's Knowledge Evolution / GraphRAG service boundary (never an agent). `type` is `'graphrag_record'`/`'graphrag_chunk'`; `originKind` always `'system'`; `serviceName: 'mcs_graphrag'`; no `chat_number`, no `universal_gateway`.

---

## 5. Retrieval model (Context Manager only)

1. **Retrieval-ready gate.** Only records with `retrievalReady === true` and whose Knowledge Object is active/approved are eligible (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §21). Superseded, archived, and candidate (review-only) records are excluded from active retrieval.
2. **Vector recall** (Chroma): the Context Manager queries the active `mcs_*` collection(s) for the domain + language with a `where` filter on `kind`/scope, top-k by cosine over 384-dim embeddings.
3. **Graph expansion** (Neo4j): resolve each hit's shared `id`, traverse `SUPERSEDES` (to ensure the active version), `HAS_LANGUAGE_VARIANT`, `SUPPORTED_BY` (outcomes), and lineage for provenance.
4. **Assembly:** the **Context Manager is the sole Context Packet assembler** (standing rule). GraphRAG is a retrieval substrate the Context Manager calls; agents never query it directly and never write to it.
5. **Scope enforcement:** every retrieval is Team Magnificent + tenant scoped; BA-private content is never retrieved as organizational knowledge without approved promotion (P7.5 §5.8; `KNOWLEDGE_EVOLUTION_RUNTIME.md` §9.6).

---

## 6. Invariants (acceptance bar for the impl slice)

1. **App-direct only.** All GraphRAG reads/writes hit the app's own dedicated stores directly. **No Universal Gateway, no `quadstack.write`, no `universal_gateway` namespace, no gateway-only fields** on any app record (ACR-0007; P7.3 §9). If an app GraphRAG path is about to call the gateway — STOP.
2. **Single write path** via `tripleStackWrite`; all-three-or-fail; fail-before-Mongo; read-back on first-of-family during canary.
3. **App-memory envelope** + `$jsonSchema` governed door on every record; `mcs_`-prefixed collections; shared canonical `id` across all three stores.
4. **Active/review separation** — candidate (review-only) records are never in active GraphRAG collections; the Context Manager never retrieves a candidate as guidance.
5. **Retrieval-ready gate** — only active, approved, retrieval-ready knowledge is served; superseded/archived excluded.
6. **384-dim embedding parity** with `model` + `model_version` provenance; both client checks enforced.
7. **Specific-verb relationships only**; `MERGE` on `{id}`; MATCH-anchor + read-back for graph legs.
8. **No agent writes; Context Manager sole assembler.** Agents never read or write GraphRAG stores directly.
9. **No excluded data** — no `.com` exposure, no income/compensation/cycle/placement, no PII beyond opaque ids, no raw transcript/LLM bodies.
10. **Team Magnificent + tenant scope** on every record and every retrieval.

---

## 7. Bilingual (English + Spanish)

Active knowledge is indexed in **per-language collections** (`mcs_*_en` / `mcs_*_es`, `KNOWLEDGE_EVOLUTION_RUNTIME.md` §19.2). Retrieval selects the collection by the BA's language. Language variants are graph-linked (`HAS_LANGUAGE_VARIANT`) so provenance and parity monitoring survive. Unreviewed machine translation is never indexed as active (P7.5; `KNOWLEDGE_EVOLUTION_RUNTIME.md` §22.4).

## 8. Failure & rollback

- Partial write → fail loud (P7.3 §6); no leg best-effort.
- Reindex/graph-sync failure → the Knowledge Object may exist but stays **not** `retrievalReady`; the job is retryable; the Context Manager does not serve it (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §30.3).
- Canary cleanup / bad-index rollback → delete-by-id across all three app stores using the shared `id`; exclude from active retrieval first, then clean.
- Kill switch → the R3 GraphRAG family is flag-gated (P7.1 §6); disabling it stops GraphRAG writes/retrieval without redeploy and without touching R0/R1/R2.

## 9. What this document does NOT do

- Adds no export to `types.ts`, no route, no domain/service code (impl slice, post-approval).
- Writes to no store; ensures no collection; applies no Neo4j constraint; enables no retrieval.
- Does not modify `docs/graphrag-schema-contract.md` (gateway-scoped; out of app scope).
- Does not approve, activate, version, or supersede any knowledge (that is Knowledge Evolution, a later slice).
- Introduces no agent-driven retrieval-writing, scoring, or ranking.

## 10. Open decisions for Kevin

- **O-1 (collection granularity):** per-domain-per-language active collections (recommended, matches `KNOWLEDGE_EVOLUTION_RUNTIME.md` §19.2) vs a single active collection filtered by `where` metadata. Recommend per-domain-per-language for clean retrieval isolation.
- **O-2 (Neo4j `Knowledge` label vs P10 business labels):** the ratified evolution spec uses a generic `:Knowledge` label; P10 §6 inventories concrete business labels. Confirm whether GraphRAG active knowledge is a new `:Knowledge` label (recommended, distinct from operational business entities) or reuses existing labels.
- **O-3 (retrieval read path):** confirm GraphRAG retrieval is exposed only through the Context Manager's internal service boundary (recommended; no new `/api/runtime/*` route, standing prohibition) and never as a standalone BA/`.com` endpoint.
