# P7.10 — GraphRAG (R3) — Implementation

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.10 (R3 implementation — fourth persistence rung)
- Status: **IMPLEMENTED — wired-dormant, canary-gated (default OFF).** `GRAPHRAG_PERSISTENCE_ENABLED=false` by default; no route wiring.
- Base: `feature/phase-07-outcomes-learning-graphrag` (post-Phase-6, after R2 `f4292dc`).
- Implements: P7.6 (GraphRAG Architecture); rung **R3** of the P7.1 ladder.
- Governed by: **ACR-0007** (app-direct; no Universal Gateway in runtime).

---

## 1. What shipped

R3 is **GraphRAG** — derived-memory writes + retrieval over the app's **own** dedicated stores, app-direct. It indexes active, approved Knowledge Objects into per-domain-per-language ACTIVE Chroma collections (semantic recall) stitched to Neo4j `(:Knowledge)` (lineage) by a shared id, and serves them to the Context Manager behind a hard retrieval-ready gate.

| File | Change | Append-only? |
|---|---|---|
| `packages/shared/src/types.ts` | **Appended**: `McsEmbeddingModel`, `McsGraphRagRecord`, `AppendGraphRagRecordInput`, `GraphRagRetrievalQuery`, `GraphRagRetrievalHit`. | ✅ |
| `server/src/env.ts` | Added canary flag `GRAPHRAG_PERSISTENCE_ENABLED` (default false). | n/a |
| `server/src/services/chromaCollections.ts` | Registered the 10 per-domain-per-language ACTIVE-knowledge collections (`mcs_<domain>_knowledge_<lang>`). | additive |
| `server/src/domain/graphrag.ts` | New module: `appendGraphRagRecord`, `retrieveGraphRag`, `activeKnowledgeCollection`, `graphRagPersistenceEnabled`, `graphRagEmbeddingDim`, `GraphRagValidationError`. | new file |
| `server/src/domain/__tests__/graphrag.test.ts` | New — 8 tests. | new file |

---

## 2. Design decisions (P7.6 §6)

1. **App-direct only (ACR-0007).** Writes via `tripleStackWrite` (Mongo `mcs_graphrag_records` + Neo4j `(:Knowledge)` + the active Chroma collection); retrieval via `gatewayCall('chromadb','query',…)` — the same app-direct seam. No `quadstack.write`, no gateway, no `universal_gateway`.
2. **Active / review separation.** Records route to `activeKnowledgeCollection(domain, language)` = `mcs_<domain>_knowledge_<lang>` — the 10 ACTIVE collections, **disjoint** from the R2 review-only `mcs_learning_candidates_review`. A test asserts the active collection name never contains `review`. A candidate can never land in an active collection.
3. **Retrieval-ready gate.** `retrieveGraphRag` applies a hard `where: { retrievalReady: true, tenantId }` filter on the active collection — superseded / archived / review-only / not-ready records are **structurally excluded** from what the Context Manager can retrieve.
4. **Context Manager is the sole caller.** These are domain functions, not routes (no `/api/runtime/*`). Agents never read or write GraphRAG stores directly; the Context Manager remains the sole Context Packet assembler.
5. **Embedding parity.** `model: 'all-MiniLM-L6-v2'` + `modelVersion` provenance on every record's Chroma metadata; the module is fixed at **384-dim** (`graphRagEmbeddingDim()`), per P10 §7.3.
6. **App-memory envelope.** `type: 'graphrag_record' | 'graphrag_chunk'`, `namespace: 'momentum'`, `originKind: 'system'`, `serviceName: 'mcs_graphrag'`; no gateway-only fields.
7. **Canary-gated, default OFF.** Both write and retrieval are no-ops (`null` / `[]`) when the flag is off — independent of R0/R1/R2 flags.
8. **Wired-dormant.** No route mounts these; live Context-Manager wiring is a later approved step, gated behind R0/R1/R2 proven.

---

## 3. Verification

- **Typecheck:** repo-wide green (5/5). *(One iteration: an unused `MONGO_DB` const → removed; re-green.)*
- **New tests:** `graphrag.test.ts` — **8/8**. Covers: flag-off no-op (write + retrieval); active-collection routing + never-review isolation; write to active collection + `mcs_graphrag_records` with model provenance; envelope + no gateway-only fields; validation (missing knowledgeObjectId/tenant/summary); retrieval-ready + tenant `where` filter + hit mapping; empty-result handling; 384-dim parity.
- **Full server suite:** **110 files, 1316 tests, all passed** (exit 0) — exactly **+1 file / +8 tests** over the post-R2 baseline (109 / 1308); zero regressions.

## 4. What R3 does NOT do

- Does not enable persistence by default; wires no route.
- Does not approve, activate, version, or supersede knowledge (that is Knowledge Evolution, a later slice) — it retrieves what is already active/ready.
- Introduces no agent-driven retrieval-writing, scoring, or ranking (vector similarity is retrieval, not qualification).
- Does not touch the coordinator, `.com`, or `apps/**`.

## 5. Phase 7 persistence ladder — status after R3

| Rung | Slice | Status |
|---|---|---|
| R0 | Runtime audit (P7.7) | ✅ implemented, dormant |
| R1 | Outcome capture (P7.8) | ✅ implemented, dormant |
| R2 | Learning candidates (P7.9) | ✅ implemented, dormant |
| R3 | GraphRAG (P7.10) | ✅ implemented, dormant |

All four rungs are built as wired-dormant, canary-gated, app-direct substrates. Activation is per-rung, in ladder order (R0 → R1 → R2 → R3), each proven in a controlled canary before the next, gated on Kevin's approval. Remaining Phase 7 work: per-rung live wiring/activation, learning observability (aggregate metrics), and phase closeout.
