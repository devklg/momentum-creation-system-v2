# S1.3 — Persistence Migration Plan (Gateway → Direct Adapters)

Report date: 2026-06-27
Author: Claude (Chief Governance Architect)
Sprint: 1 (Platform Alignment), item S1.3
Governs / governed by: **ACR-0007 (Approved 2026-06-27)** and **ACR-0009 (Implemented 2026-07-02)** — runtime persistence is direct Mongo/Neo4j/Chroma; the Universal Gateway is developer tooling only.
Status: **Planning document superseded by implementation.** ACR-0009 retired the Gateway HTTP persistence fallback; this artifact remains as migration history.

---

## 1. Objective

Move the production runtime's persistence from gateway-routed HTTP calls to **direct** MongoDB, Neo4j, and ChromaDB drivers, **behind the existing service boundary**, with **zero changes to the ~405 caller sites**. The migration is reversible, incremental, and preserves triple-stack semantics and read-back verification throughout.

---

## 2. Historical starting state (verified on disk 2026-06-27)

At the start of the migration, all persistence funneled through one function: `gatewayCall(tool, action, params)` in `server/src/services/gateway.ts`, which POSTed `{ tool, action, params }` to `${GATEWAY_URL}/execute` (`http://localhost:2526/api`, the MCP gateway). Reach: **405 call sites across 63 files**, plus the two write helpers and the outbox that wrap it. ACR-0009 later repointed this seam to direct adapters only and removed the runtime `GATEWAY_URL` dependency:

- `services/tripleStack.ts` — `tripleStackWrite()` wraps three calls: `gatewayCall('mongodb','insert',…)`, `gatewayCall('neo4j','cypher',…)`, `gatewayCall('chromadb','add',…)`.
- `services/tieredWrite.ts` — `tieredWrite()` (+ `writeGraphCritical/Knowledge/Operational`) adds per-tier failure policy, Mongo read-back (`verifyMongoLanded` → `mongodb.query` with `filter`), compensating rollback (`mongodb.delete`), and Neo4j read-back (`neo4j.cypher` verify). Knowledge/operational projections defer to `projectionOutbox.ts` (durable retry, also via `gatewayCall`).
- `services/chromaCollections.ts` — `assertChromaCollectionExists()` guards Chroma writes (collections are not auto-created).

The `tool` argument already partitions the work cleanly:

| `tool` | actions seen in code | direct target |
| --- | --- | --- |
| `mongodb` | `insert`, `query` (param `filter`), `delete`; (`update`, `aggregate` used elsewhere) | MongoDB driver |
| `neo4j` | `cypher` (`{query, params}`) | neo4j-driver |
| `chromadb` | `add` (`{collection, ids, documents, metadatas}`); reads (`search`, `query_with_filter`) | Chroma client + GPU embedding |

This is the decisive fact: **the seam is `gatewayCall`.** Repoint its internals and the entire system migrates without touching `tripleStackWrite`, `tieredWrite`, the outbox, or any of the 405 callers.

---

## 3. Target state

`gatewayCall(tool, action, params)` keeps its exact signature and return contract, but its body dispatches on `tool` to a direct in-process adapter instead of an HTTP POST:

```
gatewayCall(tool, action, params)
   ├─ 'mongodb'  → mongoAdapter[action](params)
   ├─ 'neo4j'    → neo4jAdapter[action](params)
   └─ 'chromadb' → chromaAdapter[action](params)
```

Each adapter returns the **same response shape** the gateway returned, so callers' result-destructuring and error guards keep working unchanged. The gateway HTTP path is retained behind a flag during rollout and removed at the end.

---

## 4. Adapter design (behavioral parity is the contract)

The adapters must reproduce observable behavior, not just "talk to the DB." Parity targets drawn from the current call sites:

**MongoDB adapter** — actions `insert`, `query`, `update`, `delete`, `aggregate`, `list_collections`.
- Response shapes to match: `insert → { insertedCount, insertedIds }`; `query → { documents[], count }`; `delete → { deletedCount }`; `aggregate → { results[], count }`; `update → { matchedCount, modifiedCount, upsertedCount }`.
- Param-name parity: `query` filters on **`filter`** (not `query`); `database` is explicit (default `momentum`).
- **Driver: RESOLVED (see §10) — Mongoose models throughout.** The mongo adapter is implemented with Mongoose for every collection (legacy + runtime), mapping Mongoose results back to the gateway response shapes above so the ~405 callers are unchanged. Mongo `$jsonSchema` validators, generated from the Mongoose schemas (never hand-maintained), back the app layer as a bypass-proof floor. Parity caution: Mongoose validates/casts on write, so schemas must match real write shapes — details in §10.

**Neo4j adapter** — action `cypher` (`{query, params}`).
- Response shape: `{ records[], summary: { counters } }` (callers read `summary.counters` and `records`).
- Session/transaction management replaces the gateway's per-call execution; preserve the MATCH-not-MERGE / read-back patterns `tieredWrite` relies on.

**Chroma adapter** — actions `add`, `search`, `query_with_filter`, `get_collection`, `list_collections`, `create_collection`.
- `add` plural-array contract (`ids`, `documents`, `metadatas`).
- **Embedding parity is mandatory:** embeddings come from the GPU service (`localhost:8300`, all-MiniLM-L6-v2, 384-dim). The adapter must call the GPU embedder and **never silently fall back to CPU**; if 8300 is down, fail loud (matches the standing rule). Collections still asserted via `chromaCollections.ts` (no auto-create).

**Error parity** — preserve the `GatewayError(tool, action, message)` surface and the practice of surfacing the store's own message (e.g. "resource already exists"), because callers' error guards branch on it.

**Quirk preservation (then deliberately relax):** the current helpers encode gateway quirks — Mongo `update` not honoring `upsert`, Neo4j optional-field nulls for the email-unique constraint, Chroma no auto-create, Mongo `query` param `filter`. The adapters reproduce these **initially** for a clean cutover; relaxing any of them (e.g. enabling real `upsert`) is a separate, post-migration change, not part of S1.3.

---

## 5. Migration sequence (incremental, behind the seam)

Each phase is independently reversible. Callers are never edited.

- **Phase 0 — Config & connections.** Add `MONGODB_URI`, `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD`, `CHROMA_URL`, GPU embedder URL to `server/src/env.ts`. Add connection lifecycle (pooled clients, startup connect, graceful shutdown, health checks) to replace gateway health. Add **per-store flags** `PERSISTENCE_MONGO_MODE` / `PERSISTENCE_NEO4J_MODE` / `PERSISTENCE_CHROMA_MODE` (`gateway` | `direct`, default `gateway`), a master `PERSISTENCE_DIRECT_ENABLED`, and `GPU_EMBEDDER_REQUIRED=true` (canonical flag scheme in `S1_3_IMPLEMENTATION_BREAKDOWN.md` §9).
- **Phase 1 — Build adapters.** Implement the three adapters to the §4 parity contract. No caller changes. Adapters exist but are not yet wired into `gatewayCall`.
- **Phase 2 — Dispatcher.** Refactor `gatewayCall` internals to branch on `PERSISTENCE_MODE`: `gateway` keeps the HTTP POST; `direct` dispatches to adapters. Signature and return contract unchanged. Default stays `gateway`.
- **Phase 3 — Parity verification.** Run the parity test suite (§7) and shadow/compare reads against both paths until green. This is where "verify, don't assume" is proven.
- **Phase 4 — Cutover.** Flip per store in sequence — `PERSISTENCE_MONGO_MODE=direct`, then `PERSISTENCE_NEO4J_MODE=direct`, then `PERSISTENCE_CHROMA_MODE=direct` — watching each under live traffic before the next. Monitor read-backs, outbox drain, error rates.
- **Phase 5 — Retire the gateway path.** Remove the HTTP branch and `GATEWAY_URL` from the runtime; update the current-state runbooks (`DEPLOYMENT_GUIDE.md`, `ADMINISTRATOR_GUIDE.md`, `DEPLOYMENT_AND_REALTIME_TEST_GUIDE_2026-06-24.md`) to direct-store at this point (they correctly describe gateway-routed behavior until now). The MCP gateway remains available as developer tooling.

---

## 6. Triple-stack & verification semantics (preserved)

- Every write still lands in MongoDB + Neo4j + ChromaDB in the same logical operation; no store optional.
- `tieredWrite`'s existing guarantees carry over unchanged because they sit above the seam: Tier-1 Mongo+Neo4j atomic-or-rollback, Tier-2/3 durable projection via the outbox, Mongo read-back on every tier, `GraphCriticalWriteError` / `HalfWriteError` semantics intact.
- Read-back is the acceptance signal at cutover: the same `verifyMongoLanded` / Neo4j-verify queries must pass against the direct adapters.

---

## 7. Test / verification plan (for the implementation sprint, not now)

- **Parity unit tests** per adapter: assert response shapes for `insert`/`query`/`delete`/`aggregate`/`update`, `cypher` counters/records, `add` + embedding dimension 384.
- **`tripleStackWrite` / `tieredWrite` integration tests** run identically under `gateway` and `direct` modes — same results, same read-backs, same rollback behavior on induced Neo4j failure.
- **Quirk tests**: Mongo `query` honors `filter`; Chroma write fails loud on missing collection; GPU embedder down → loud failure, no CPU fallback.
- **Gates**: `pnpm typecheck` + `pnpm build` repo-wide; end-to-end flow against the running dev server; persistence read-back on every triple-stack write; `git status` review.

---

## 8. Rollback

`rollback_to` = commit `0c969c0` (pre-migration server state). Operationally, rollback is a flag flip: setting the affected store's flag back to `gateway` (e.g. `PERSISTENCE_MONGO_MODE=gateway`) restores gateway-routed writes for that store instantly without code changes, leaving the other stores in their verified mode, until Phase 5 removes the HTTP path. After Phase 5, rollback is the revert of the Phase-5 commit.

---

## 9. Constraints (ACR-0007 + frozen v1.0)

- No production code is written in S1.3 planning (this document).
- No ratified-document edits; no other proposed ACR (0001–0006) applied; no redesign.
- The Universal Gateway must not reappear as a runtime persistence path — it is developer tooling only.
- Redis is not introduced (not part of the persistence layer).
- `.com` prospect surfaces untouched.

---

## 10. Resolved decisions (all confirmed 2026-06-27, Kevin)

**Decision — Option C (Mongoose-authored, validator-enforced).** One schema source of truth, in one direction:

> **Mongoose schema → generated Mongo `$jsonSchema` validator → MongoDB collection enforcement.**

- MongoDB persistence uses **Mongoose models** as the primary application-layer schema and authoring layer.
- Mongo **`$jsonSchema` validators are generated from the Mongoose schemas** and applied as the database-level backstop. They **must not be hand-maintained separately** — the Mongoose schema is the sole source; the validator is a build artifact of it.
- **Neo4j** remains direct through the Neo4j driver + Cypher.
- **ChromaDB** remains direct through the Chroma adapter using the local GPU embedder, **no CPU fallback**.
- The **Universal Gateway** remains MCP developer tooling only — it is **not** the production runtime database access path.

**Q1 — Mongo access: RESOLVED 2026-06-27 (Kevin). Mongoose models throughout (supersedes the earlier native-first "Option A").**
- **All collections — legacy operational AND new runtime knowledge/event models → Mongoose models.** One consistent persistence standard across the whole system, chosen for hooks/middleware, references/`populate`, typed models, and the layered structure. The direct mongo adapter (per ACR-0007) is implemented with Mongoose; `gatewayCall('mongodb', …)` keeps its response-shape contract by mapping Mongoose results to the existing shapes (`insertedCount`, `documents`/`count`, `deletedCount`, …).
- **Parity caution:** Mongoose validates/casts on write, so each schema must match what the current code actually writes, or gateway-accepted writes get rejected mid-cutover. Disposable dev/test data makes this safe (model from real write shapes; wipe/re-seed any non-conforming test doc). Per-store parity testing must catch this.
- **Schema governance / drift backstop (anti-drift):** Mongoose schemas are the standard and the authoring layer. Because Mongoose only validates writes that go *through* Mongoose (a stray script/agent/shell write bypasses it), mirror the schemas to Mongo `$jsonSchema` collection validators as a bypass-proof backstop — the database rejects malformed writes regardless of path. **CONFIRMED 2026-06-27 (Kevin): keep the backstop.** The Mongoose schema is the sole author; the `$jsonSchema` validator is **generated from it, never hand-maintained** — one source of truth enforced at two altitudes (application + database), so the "two layers" concern never materializes. This is an elaboration of approved ACR-0007 ("direct adapters/service layers"), recorded here as implementation detail, not an in-place amendment to the ACR-0007 record.
- **Data context:** all current `momentum` data is disposable dev/test (holding tank + a few test invitations); only Kevin's login userid/password must be preserved (never touched by Claude). So validators can be applied against intended shapes now and any non-conforming test docs wiped/re-seeded — the cheap, clean moment to set the standard.

**Q2 — Embedding placement: CONFIRMED 2026-06-27 (Kevin).** Use the local GPU embedder, started at boot, with **no CPU fallback** — the adapter calls it and passes vectors to Chroma (explicit, keeps the no-fallback guarantee visible). If the embedder is unavailable, the Chroma leg fails loud rather than degrading silently.

**Q3 — Cutover granularity: CONFIRMED 2026-06-27 (Kevin). Per-store, sequential.** Independent per-store flags (Mongo → Neo4j → Chroma); each store cut to direct and watched under live traffic before the next, with isolated instant rollback (flip one store back to gateway without touching the others). The seam already branches on `tool`, so the per-store switch falls out of the existing dispatch. Triple-stack writes run safely in mixed transport mode during the rollout (each leg lands and read-backs independently); parity testing must include a mixed-mode triple-stack write.

---

## 11. ACR-0007 gate mapping

This plan satisfies the ACR-0007 **Review** gate (boundaries enumerated, no hidden persistence, future-development test passed). Phases 1–4 are **Implementing**; Phase 3/§7 is **Verified** (persistence read-back); cutover and Phase 5 are **Merged/Released** under Kevin's merge authority.
