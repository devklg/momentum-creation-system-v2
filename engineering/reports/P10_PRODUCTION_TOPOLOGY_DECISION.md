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
| Vector store | **Chroma Cloud** or hosted vector service |
| Embeddings | **OpenAI / hosted embeddings** (no local GPU) |
| Persistence path | App → **direct** to each store (Atlas / Aura / Chroma Cloud) |
| Universal Gateway | MCP developer tooling only — **not** a production dependency |

### Production topology

```
  Browser
    | teammagnificent.com   teammagnificent.team   admin.teammagnificent.team
    v
  Caddy/Nginx (TLS, reverse proxy)  ──►  Express API (7700)  ─┬─►  MongoDB Atlas
       [InterServer Linux VPS]                                ├─►  Neo4j Aura
                                                              ├─►  Chroma Cloud / hosted vector
                                                              └─►  OpenAI / hosted embeddings
```

Contrast with local dev (`DEPLOYMENT_GUIDE.md` §0/§1): everything — gateway, Mongo, Neo4j, Chroma, GPU embedder — runs on Kevin's Windows machine behind Gateway V2. **Prod drops the gateway and the local GPU entirely.**

---

## 2. Why this resolves B1

B1's three open questions (`DEPLOYMENT_GUIDE.md:261-267`) are now answered:

1. *Where does the triple-stack live in prod?* → Managed cloud (Atlas / Aura / Chroma Cloud), reached directly by the API.
2. *What happens to GPU embeddings without the GPU?* → Replaced by OpenAI / hosted embeddings; the local `:8300` GPU embedder is dev-only.
3. *`D:/server-gateway-mcp-v2` outside VCS?* → No longer a production dependency (gateway is dev tooling), so it is not a deploy blocker — though bringing it under VCS is still good hygiene.

---

## 3. What this changes downstream (for the execution slices — NOT done here)

These are consequences to plan; none are implemented by this doc.

### 3.1 Persistence flips to direct mode
The direct adapters already exist (ACR-0007 / Option C / S1.3) and are gated OFF by default (`.env.example`: `PERSISTENCE_DIRECT_ENABLED=false`, all `PERSISTENCE_*_MODE=gateway`). Production sets:
- `PERSISTENCE_DIRECT_ENABLED=true`
- `PERSISTENCE_MONGO_MODE=direct`, `PERSISTENCE_NEO4J_MODE=direct`, `PERSISTENCE_CHROMA_MODE=direct`
- `MONGODB_URI` → Atlas SRV string, `NEO4J_URI`/`NEO4J_USERNAME`/`NEO4J_PASSWORD` → Aura, `CHROMA_URL` → Chroma Cloud endpoint (+ its auth).

> Verify the direct adapters cover every write path currently exercised via `tripleStackWrite()` before flipping — the migration to `tieredWrite`/direct is noted as incomplete in the verification report (P10.7).

### 3.2 Embeddings provider change — the biggest technical item ⚠️
- Today's embedder is the local GPU service (all-MiniLM-L6-v2, **384-dim**, `CLAUDE.md`). OpenAI `text-embedding-3-small` is **1536-dim** (large is 3072). **Vector dimension is fixed per Chroma collection** — you cannot mix. Because the app is moving to a **fresh dedicated triple-stack** and MCS V2 stores are under a write-freeze until schemas are approved (`[[mcs-v2-db-write-freeze]]`), this is the ideal moment to standardize on the hosted embedding model/dimension from the start — no migration of existing vectors needed.
- New provider + secret: an `OPENAI_API_KEY` (or chosen host) must be added to the env schema (`server/src/env.ts`) and `.env.example`; the embedder adapter (`server/src/services/persistence/embedder.ts`) needs a hosted-embeddings path.
- The repo's "never accept a silent CPU fallback" rule (`DEPLOYMENT_GUIDE.md:232`) is about the local GPU; with hosted embeddings, the equivalent rule is **fail closed if the embeddings API is unreachable** rather than degrade silently.

### 3.3 Governance
- **This is an architectural change** (hosting + embeddings provider). Per `ROADMAP.md` Governance Note, raise a proposed **ACR in `organization/ACR-REGISTER.md`** and record it in the decision ledger. The direct-persistence path itself is already covered by **ACR-0007**; the new elements are managed-cloud hosting and the hosted-embeddings provider.
- **Standing-prohibition clarification:** "No LLM calls" targets generative LLM usage. Hosted **embeddings** are a distinct, non-generative vector API — confirm in the ACR that hosted embeddings are explicitly permitted so no one reads this as a prohibition breach.

### 3.4 New env contract (prod) — additions beyond release-checklist §7.1
- `OPENAI_API_KEY` (or hosted-embeddings key) + optional `EMBEDDINGS_MODEL`.
- Atlas / Aura / Chroma Cloud connection strings + credentials (secrets, VPS-only).
- Everything already in release-checklist §7.1 (`NODE_ENV`, `PROSPECT_BASE_URL`, public URLs, `CORS_ORIGINS`, `JWT_COOKIE_DOMAIN`, strong `JWT_SECRET`).

---

## 4. Remaining B1 execution checklist (owner-driven, not blockers to *decide* anymore)

- [ ] Provision MongoDB Atlas, Neo4j Aura, Chroma Cloud (or chosen hosted vector) — capture connection strings as VPS-only secrets.
- [ ] Choose the hosted embeddings model + dimension; add `OPENAI_API_KEY`/`EMBEDDINGS_MODEL` to `env.ts` + `.env.example`; implement the hosted-embeddings path in the embedder adapter (fail-closed).
- [ ] Confirm/complete direct-adapter coverage for all write paths; flip the `PERSISTENCE_*` env to direct.
- [ ] Stand up the InterServer VPS: Node ≥22, pnpm 9, Caddy/Nginx + TLS, process supervision (pm2/systemd) for API + workers.
- [ ] Raise the ACR (hosting + embeddings) and log the decision in the ledger.
- [ ] (Hygiene) Bring `server-gateway-mcp-v2` under VCS even though it's no longer a prod dependency.

These roll into release-checklist §9 (build/deploy mechanics) and §7 (env contract). The execution detail for the persistence + embeddings pieces is planned in **`engineering/reports/P10_HOSTED_EMBEDDINGS_DIRECT_MODE_MIGRATION_PLAN.md`**.

---

## 5. Standing-prohibition check

This document decides and plans; it implements nothing, sends nothing, writes to no store, and adds no route. The embeddings-provider clarification (§3.3) is raised precisely so the change goes through governance rather than around it.
