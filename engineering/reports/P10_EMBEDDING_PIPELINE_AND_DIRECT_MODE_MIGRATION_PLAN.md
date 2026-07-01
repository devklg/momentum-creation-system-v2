# P10 — Embedding Pipeline + Direct-Mode Cutover Migration Plan

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Feeds:** the B1 topology decision (`engineering/reports/P10_PRODUCTION_TOPOLOGY_DECISION.md`) and release-checklist §2/§7.
**Status:** 📐 Planning — **not implemented.** No code changes here. Execution is production-affecting (Kevin-gated) and further blocked by the MCS V2 schema **write-freeze** (`[[mcs-v2-db-write-freeze]]`) until schemas exist/are approved.
**Supersedes:** the earlier "Hosted Embeddings" draft — that assumed OpenAI/hosted embeddings with a 384→1536 dimension change. **Corrected (2026-06-30):** embeddings stay **local-GPU MiniLM at 384-dim**, produced by a **batch publish pipeline**, not a hosted API. No dimension change; no external embeddings provider.
**Author:** Claude Code (Instance 2), Phase 10 worktree.
**Date:** 2026-06-30.

---

## 1. Goal (corrected architecture)

- **App/API:** InterServer Linux VPS.
- **Mongo / Neo4j:** app writes **direct** to the production managed instances (Atlas / Aura).
- **Chroma Cloud:** holds **BA-facing approved knowledge** (the retrieval corpus) — nothing else.
- **Embeddings:** the **local GPU pipeline** (existing MiniLM, **384-dim**) embeds approved knowledge in a **batch every 12 hours** and publishes the vectors to Chroma Cloud, with an **optional immediate-publish** path for critical updates. No hosted/OpenAI embeddings; no dimension change.
- **Universal Gateway:** dev tooling only — not in the prod runtime path.

Two workstreams: **A. the embedding/publish pipeline**, **B. direct-mode cutover for Mongo/Neo4j**.

---

## 2. Current state (grounded)

**Persistence dispatch is flag-gated, defaults to Gateway.** `flags.ts:31-59` — direct only when `PERSISTENCE_DIRECT_ENABLED=true` **and** the store's `PERSISTENCE_<STORE>_MODE='direct'`; both default off. Direct adapters exist (ACR-0007 / S1.3):
- `mongo/connection.ts` — `mongoose.connect(env.MONGODB_URI, { dbName })`.
- `neo4j/connection.ts` — `neo4j.driver(env.NEO4J_URI, auth.basic(user, pass))`.
- `chroma/connection.ts` + `chroma/adapter.ts` — raw `fetch` to `env.CHROMA_URL`, tenant/database hardcoded to `default_tenant`/`default_database`.

**Embeddings: local-GPU MiniLM, 384-dim, no fallback — KEPT AS-IS.** `chroma/embedder.ts`: `EMBEDDING_DIM = 384`, POSTs to `env.GPU_EMBEDDER_URL/embeddings`, throws on unreachable / HTTP-error / dimension-mismatch. `chroma/adapter.ts` embeds inline today on both `add` (`:103`) and `query` (`:124`).

**Health exists.** `directPersistenceHealth()` + per-store `*Health()` + `embedderHealth()` (`persistence/index.ts`).

---

## 3. Target state

```
INGESTION — GPU host (Kevin's machine, RTX 4070 Ti):
  approved-knowledge corpus (Mongo) ─► local GPU embedder (MiniLM, 384-dim) ─► upsert vectors ─► Chroma Cloud
       schedule: every 12h   +   optional immediate publish for critical updates

RUNTIME — InterServer VPS (no GPU):
  Express API ─┬─► MongoDB Atlas   (direct write, mongoose)
               ├─► Neo4j Aura      (direct write, neo4j-driver)
               └─► Chroma Cloud    (BA-facing approved-knowledge retrieval / read + query)
  PERSISTENCE_DIRECT_ENABLED=true; PERSISTENCE_{MONGO,NEO4J}_MODE=direct
```

Note the asymmetry for Chroma: **writes** to Chroma Cloud come from the batch pipeline (Workstream A), **reads/queries** come from the app at runtime (Workstream B). Chroma document vectors are never written on the app's request path.

---

## 4. Workstream A — Embedding & publish pipeline (local GPU → Chroma Cloud)

This is a **batch ingestion job**, not an inline request-path change. Embeddings stay 384-dim, so the existing `chroma/embedder.ts` is reused unchanged.

### 4.1 The pipeline
- Runs on the **GPU host** (the VPS has no GPU). Reads the **approved-knowledge corpus** from Mongo, embeds each item with the local GPU embedder (MiniLM 384-dim), and **upserts** the vectors to Chroma Cloud (the adapter's `add` already upserts by stable id → idempotent re-runs).
- **Schedule: every 12 hours.** Cron or a scheduled worker on the GPU host.
- **Optional immediate publish:** an on-demand trigger that embeds + publishes a specific critical update without waiting for the batch tick.
- **No silent degradation:** keep the existing rule — if the GPU embedder is unreachable, the batch fails loud and retries next tick rather than publishing bad/empty vectors.

### 4.2 The crux open question — query-time embedding ⚠️
BA-facing retrieval must embed the **query text** to search Chroma Cloud, and query vectors MUST come from the **same model/space** as the stored vectors (MiniLM 384-dim) — you cannot query a MiniLM collection with a different model's vectors. The GPU is on the local host; the app is on the VPS. So one of these must be decided:
- **(a) VPS → local GPU call-back:** the app calls the local GPU embedder over the network for each query. Simplest reuse, but makes prod retrieval depend on the home machine's availability/latency.
- **(b) Co-located query embedder:** run a small MiniLM embedder next to the VPS for query-only embedding (CPU MiniLM is viable for single-query latency). This is a *deliberate* query-path embedder, not the forbidden silent CPU fallback of the GPU write pipeline.
- **(c) Cache/precompute:** if BA queries are bounded/templated, precompute their embeddings in the batch — likely too restrictive for free-text retrieval.

**Recommendation:** (b) — a dedicated small MiniLM query-embedder co-located with the API keeps retrieval self-contained on the VPS and avoids a home-machine runtime dependency, while the heavy corpus embedding stays on the GPU in batch. Confirm with Kevin.

### 4.3 Where it plugs in
- Reuse `chroma/embedder.ts` (`embed`) and `chroma/adapter.ts` (`add`/upsert, `query`). No dimension change.
- New: a batch runner (script/worker) + scheduler on the GPU host; an immediate-publish entrypoint.
- Query path wired to whichever query-embedder option (§4.2) is chosen.

### 4.4 Governance / prohibition note
- **"No agent may approve knowledge"** holds: the pipeline embeds + publishes **already-approved** knowledge; approval stays human (Kevin). The pipeline must read only items already marked approved — confirm the source-of-truth collection/status field.
- Embeddings remain **local** — no external AI provider is added, so the "No LLM calls" concern that the hosted-embeddings draft raised is now **moot**.

### 4.5 Tests
- Batch runner: reads only approved items; upsert idempotency; fail-loud when embedder down.
- Immediate-publish entrypoint: embeds + upserts a single item.
- Query embedder (per chosen option): 384-dim output; fail-closed on error.

---

## 5. Workstream B — Direct-mode cutover (Mongo/Neo4j) + Chroma Cloud reads

### 5.1 Connection changes by store
- **Mongo → Atlas:** mostly config. `MONGODB_URI` = Atlas `mongodb+srv://…`; mongoose negotiates TLS from the scheme. Ops: Atlas **IP allowlist** for the VPS egress IP; least-privilege user. Little/no code change.
- **Neo4j → Aura:** mostly config. `NEO4J_URI=neo4j+s://<id>.databases.neo4j.io` (`+s` = encryption) + Aura creds. `verifyConnectivity()` already validates at boot. Little/no code change.
- **Chroma → Chroma Cloud:** **real code change** (shared by read path + pipeline). `chroma/connection.ts` hardcodes tenant/database (`:4-5`) and every `fetch` in `chroma/adapter.ts` is unauthenticated. Add `CHROMA_API_KEY` + env-driven `CHROMA_TENANT`/`CHROMA_DATABASE`; inject the auth header in a shared request helper.

### 5.2 Pre-cutover coverage audit (blocking, Mongo/Neo4j)
Before flipping flags, confirm the **direct adapters cover every write path** currently served by the Gateway. Report P10.7 notes the `tieredWrite`/direct migration is **incomplete** and two write paths coexist (`tripleStackWrite()` legacy + `tieredWrite.ts`). Enumerate all `tripleStackWrite()` / gateway callers; verify each maps to a working direct adapter action. A gap = silent data loss on cutover.

### 5.3 Flip sequence (per-store, reversible)
1. Point `MONGODB_URI`/`NEO4J_URI`/`CHROMA_*` at managed endpoints (still `*_MODE=gateway`).
2. `PERSISTENCE_DIRECT_ENABLED=true`, then flip Mongo, then Neo4j to `direct`, verifying `directPersistenceHealth()` + a real read/write after each.
3. Chroma Cloud reads validated once Workstream A has published a corpus and the query-embedder (§4.2) is live.

---

## 6. New/changed env contract (summary)

| Var | Purpose | Notes |
|---|---|---|
| `MONGODB_URI` | Atlas SRV string | + Atlas IP allowlist for the VPS |
| `NEO4J_URI` / `NEO4J_PASSWORD` | Aura endpoint + creds | `neo4j+s://` scheme |
| `CHROMA_URL` | Chroma Cloud base | account host |
| `CHROMA_API_KEY` | Chroma Cloud auth | new — header on every request |
| `CHROMA_TENANT` / `CHROMA_DATABASE` | account tenant/db | replace hardcoded defaults |
| `GPU_EMBEDDER_URL` | local GPU embedder | **kept** — batch pipeline + (option a/b) query embedder |
| `PERSISTENCE_DIRECT_ENABLED` | master switch → `true` | Mongo/Neo4j |
| `PERSISTENCE_{MONGO,NEO4J}_MODE` | → `direct` | flip incrementally |
| _(pipeline)_ embed-publish schedule / immediate-publish config | 12h cadence + on-demand | on the GPU host |

**Removed vs the earlier draft:** `EMBEDDINGS_PROVIDER`, `OPENAI_API_KEY`, `EMBEDDINGS_MODEL` — no hosted embeddings. All secrets VPS-only, never committed.

---

## 7. Governance & sequencing

- **ACR:** raise one in `organization/ACR-REGISTER.md` covering managed-cloud hosting (Atlas/Aura), Chroma Cloud for approved knowledge, and the batch embedding/publish pipeline. Direct-persistence itself is already **ACR-0007**; this extends it. Log in the decision ledger.
- **Write-freeze:** the dedicated stack exists but has **no schemas yet**; do not write real data to Atlas/Aura/Chroma-Cloud until MCS V2 schemas exist/are approved (`[[mcs-v2-db-write-freeze]]`). Build + dry-run against throwaway collections is fine.
- **Recommended order:** decide §4.2 query-embedding → B.1 Chroma Cloud auth → B.2 Mongo/Neo4j coverage audit → schemas (unblocks writes) → staged flip (B.3) → Workstream A pipeline + first corpus publish → H1 smoke (release-checklist B4).

---

## 8. Open decisions for Kevin

1. **Query-time embedding (§4.2)** — call-back to local GPU (a), co-located MiniLM query embedder (b, recommended), or precompute (c). This is the crux; retrieval design depends on it.
2. **Batch host + scheduler** — confirm the pipeline runs on the GPU machine; cron vs scheduled worker; and the exact 12h window.
3. **Immediate-publish trigger** — admin UI action vs CLI/script.
4. **Approved-knowledge source of truth** — which Mongo collection + status marks an item "approved & publishable" for the pipeline to read.

---

## 9. Standing-prohibition note

Planning only — nothing implemented, sent, or written. Embeddings stay local (no external AI provider). Knowledge approval stays human — the pipeline only publishes already-approved items. Direct-write cutover is already approved architecture (ACR-0007); this plan extends it to managed cloud + a local-GPU batch publish pipeline.
