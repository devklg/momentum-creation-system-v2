# P10 — Production Topology Decision (resolves B1)

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Resolves:** Release-checklist blocker **B1** (production topology).
**Decided by:** Kevin, 2026-06-30.
**Status:** ✅ **Decision made.** Execution not started. This is a documentation record of the decision; it changes no code.
**Author:** Claude Code (Instance 2), Phase 10 worktree.

---

## 1. The decision

Production runs on an **InterServer Linux VPS** for the app tier, with **managed cloud data services**. The app writes **directly** to the stores; the Universal Gateway is **not** in the production runtime path (it stays MCP developer tooling only).

| Layer | Production choice |
|---|---|
| App / API host | InterServer Linux VPS |
| On the VPS | Express API (7700), `.com`, `.team`, `/admin`, Caddy or Nginx reverse proxy + TLS |
| MongoDB | **MongoDB Atlas** (managed) |
| Neo4j | **Neo4j Aura** (managed) |
| Vector store | **Chroma Cloud** — scoped to BA-facing **approved knowledge** |
| Embeddings | **Local GPU pipeline (MiniLM, 384-dim)** — batch publish every 12h + optional immediate publish for critical updates. No hosted/OpenAI embeddings. |
| Persistence path | Mongo/Neo4j: app writes **direct** to Atlas/Aura. Chroma: **written by the batch pipeline**, read by the app at runtime. |
| Universal Gateway | MCP developer tooling only — **not** a production dependency |

### Production topology

```
  Browser
    | teammagnificent.com   teammagnificent.team   admin.teammagnificent.team
    v
  Caddy/Nginx (TLS, reverse proxy)  ──►  Express API (7700)  ─┬─►  MongoDB Atlas   (direct write)
       [InterServer Linux VPS]                                ├─►  Neo4j Aura      (direct write)
                                                              └─►  Chroma Cloud    (read: BA-facing approved knowledge)

  Ingestion (GPU host / Kevin's machine):
    approved knowledge (Mongo) ─► local GPU embedder (MiniLM 384-dim) ─► publish vectors ─► Chroma Cloud
       every 12h  +  optional immediate publish for critical updates
```

Contrast with local dev (`DEPLOYMENT_GUIDE.md` §0/§1): everything — gateway, Mongo, Neo4j, Chroma, GPU embedder — runs on Kevin's Windows machine behind Gateway V2. **Prod drops the gateway**; Mongo/Neo4j move to managed cloud; the **local GPU stays** but only as the batch embedding pipeline that feeds Chroma Cloud (it is not in the VPS request path for writes).

---

## 2. Why this resolves B1

B1's three open questions (`DEPLOYMENT_GUIDE.md:261-267`) are now answered:

1. *Where does the triple-stack live in prod?* → Managed cloud (Atlas / Aura / Chroma Cloud), reached directly by the API.
2. *What happens to GPU embeddings without a GPU on the VPS?* → Embeddings stay on the **local GPU** (MiniLM, 384-dim), run as a **batch pipeline every 12h** (+ optional immediate publish) that publishes vectors to Chroma Cloud. No hosted/OpenAI embeddings; no dimension change. Query-time embedding approach is the one open sub-decision (see the migration plan §4.2).
3. *`D:/server-gateway-mcp-v2` outside VCS?* → No longer a production dependency (gateway is dev tooling), so it is not a deploy blocker — though bringing it under VCS is still good hygiene.

---

## 3. What this changes downstream (for the execution slices — NOT done here)

These are consequences to plan; none are implemented by this doc.

### 3.1 Persistence flips to direct mode
The direct adapters already exist (ACR-0007 / Option C / S1.3) and are gated OFF by default (`.env.example`: `PERSISTENCE_DIRECT_ENABLED=false`, all `PERSISTENCE_*_MODE=gateway`). Production sets:
- `PERSISTENCE_DIRECT_ENABLED=true`
- `PERSISTENCE_MONGO_MODE=direct`, `PERSISTENCE_NEO4J_MODE=direct` (Chroma writes come from the batch pipeline, not the app request path — see §3.2)
- `MONGODB_URI` → Atlas SRV string, `NEO4J_URI`/`NEO4J_USERNAME`/`NEO4J_PASSWORD` → Aura, `CHROMA_URL` → Chroma Cloud endpoint (+ its auth).

> Verify the direct adapters cover every write path currently exercised via `tripleStackWrite()` before flipping — the migration to `tieredWrite`/direct is noted as incomplete in the verification report (P10.7).

### 3.2 Embeddings — local GPU batch pipeline (no dimension change)
- Embeddings **stay on the local GPU** (all-MiniLM-L6-v2, **384-dim**, `CLAUDE.md`) — **no** OpenAI/hosted provider and **no** dimension change. Chroma Cloud collections are created at 384-dim.
- The GPU host runs a **batch pipeline every 12h** that embeds the approved-knowledge corpus and publishes vectors to Chroma Cloud, plus an **optional immediate-publish** path for critical updates. This decouples embedding from the VPS request path (which has no GPU).
- **Query-time embedding — DECIDED:** a co-located **CPU MiniLM query-embedder** on InterServer embeds the BA's query in the same 384-dim space (each request is one short question, so CPU is fine). Explicit approved service, not a silent fallback; bulk/corpus embedding stays on the local GPU. Two fail-closed checks: `dimensions===384` and `model_version` matches the local publisher. Detail in migration plan §4.2.
- The repo's "never silently degrade" rule holds: the batch fails loud if the GPU embedder is unreachable rather than publishing bad vectors.

### 3.3 Governance
- **This is an architectural change** (managed-cloud hosting + Chroma Cloud for approved knowledge + the batch embedding/publish pipeline). Per `ROADMAP.md` Governance Note, raise a proposed **ACR in `organization/ACR-REGISTER.md`** and record it in the decision ledger. Direct-persistence itself is already covered by **ACR-0007**; this extends it.
- **Standing prohibitions:** embeddings stay **local** (no external AI provider), so the earlier "No LLM calls" concern is **moot**. "No agent may approve knowledge" holds — the pipeline publishes only **already-approved** knowledge; approval stays human.

### 3.4 New env contract (prod) — additions beyond release-checklist §7.1
- Atlas / Aura connection strings + credentials; Chroma Cloud base + `CHROMA_API_KEY` + env-driven `CHROMA_TENANT`/`CHROMA_DATABASE` (replacing the hardcoded defaults).
- `GPU_EMBEDDER_URL` **kept** (batch pipeline + query embedder). No `OPENAI_API_KEY`/`EMBEDDINGS_MODEL`.
- Everything already in release-checklist §7.1 (`NODE_ENV`, `PROSPECT_BASE_URL`, public URLs, `CORS_ORIGINS`, `JWT_COOKIE_DOMAIN`, strong `JWT_SECRET`).

---

## 4. Remaining B1 execution checklist (owner-driven, not blockers to *decide* anymore)

- [ ] Provision MongoDB Atlas, Neo4j Aura, Chroma Cloud — capture connection strings as VPS-only secrets.
- [ ] Decide query-time embedding (migration plan §4.2); add Chroma Cloud auth (`CHROMA_API_KEY`/`CHROMA_TENANT`/`CHROMA_DATABASE`) to `env.ts` + `.env.example`.
- [ ] Build the batch embedding/publish pipeline on the GPU host (every 12h + immediate-publish); it reuses the existing 384-dim GPU embedder.
- [ ] Confirm/complete direct-adapter coverage for Mongo/Neo4j write paths; flip `PERSISTENCE_DIRECT_ENABLED` + Mongo/Neo4j `*_MODE=direct`.
- [ ] Stand up the InterServer VPS: Node ≥22, pnpm 9, Caddy/Nginx + TLS, process supervision (pm2/systemd) for API + workers.
- [ ] Raise the ACR (managed-cloud hosting + Chroma Cloud + batch pipeline) and log the decision in the ledger.
- [ ] (Hygiene) Bring `server-gateway-mcp-v2` under VCS even though it's no longer a prod dependency.

These roll into release-checklist §9 (build/deploy mechanics) and §7 (env contract). The execution detail for the persistence + embedding-pipeline pieces is planned in **`engineering/reports/P10_EMBEDDING_PIPELINE_AND_DIRECT_MODE_MIGRATION_PLAN.md`**.

---

## 5. Standing-prohibition check

This document decides and plans; it implements nothing, sends nothing, writes to no store, and adds no route. Embeddings stay local (no external AI provider); knowledge approval stays human. The change is routed through governance via the ACR in §3.3.
