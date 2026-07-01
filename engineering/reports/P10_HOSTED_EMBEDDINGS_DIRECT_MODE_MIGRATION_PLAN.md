# P10 — Hosted Embeddings + Direct-Mode Cutover Migration Plan

**Phase:** 10 — DevOps, Security, Environments, and Operations
**Feeds:** the B1 topology decision (`engineering/reports/P10_PRODUCTION_TOPOLOGY_DECISION.md`) and release-checklist §2/§7.
**Status:** 📐 Planning — **not implemented.** This is a migration plan. No code changes here. Execution is production-affecting (Kevin-gated) and further blocked by the MCS V2 schema **write-freeze** (`[[mcs-v2-db-write-freeze]]`) until schemas are approved — you can build and dry-run the adapters, but do not write to the new stores until then.
**Author:** Claude Code (Instance 2), Phase 10 worktree.
**Date:** 2026-06-30.

---

## 1. Goal

Move production persistence from the current **Gateway-fronted, local-GPU** path to the decided target: the app writes **directly** to **managed cloud** stores (MongoDB Atlas, Neo4j Aura, Chroma Cloud) and embeds via a **hosted embeddings** provider. Two workstreams, largely independent:

- **A. Hosted embeddings** — replace the local GPU embedder with a hosted provider (dimension change ⚠️).
- **B. Direct-mode cutover** — point the existing direct adapters at managed cloud endpoints and flip the flags.

---

## 2. Current state (grounded)

**Persistence dispatch is flag-gated and defaults to Gateway.** `flags.ts:31-59` — a store goes direct only when `PERSISTENCE_DIRECT_ENABLED=true` **and** its `PERSISTENCE_<STORE>_MODE='direct'`; both default off. Direct adapters already exist (ACR-0007 / Option C / S1.3):
- `mongo/connection.ts` — `mongoose.connect(env.MONGODB_URI, { dbName })`.
- `neo4j/connection.ts` — `neo4j.driver(env.NEO4J_URI, auth.basic(user, pass))`.
- `chroma/connection.ts` + `chroma/adapter.ts` — raw `fetch` to `env.CHROMA_URL` at `/api/v2/tenants/default_tenant/databases/default_database/collections`.

**Embeddings are local-GPU-only, 384-dim, no fallback.** `chroma/embedder.ts`: `EMBEDDING_DIM = 384` (hardcoded), POSTs to `env.GPU_EMBEDDER_URL/embeddings`, throws on unreachable/HTTP-error/dimension-mismatch (`:60-81`). `chroma/adapter.ts` calls `embed()` for both `add` (`:103`) and `query` (`:124`) — so the **embedder is the single swap point**; the adapter itself is provider-agnostic.

**Health already exists.** `directPersistenceHealth()` (`persistence/index.ts`) + per-store `*Health()` + `embedderHealth()` back a readiness probe (release-checklist §6 / report H7/P10.8).

---

## 3. Target state

```
Express API (InterServer VPS)
  ├─ Mongo  → MongoDB Atlas          (mongoose, mongodb+srv://…)
  ├─ Neo4j  → Neo4j Aura             (neo4j-driver, neo4j+s://…)
  └─ Chroma → Chroma Cloud           (fetch + API-key auth, account tenant/db)
                └─ embeddings → hosted provider (e.g. OpenAI text-embedding-3-small, 1536-dim)
PERSISTENCE_DIRECT_ENABLED=true; PERSISTENCE_{MONGO,NEO4J,CHROMA}_MODE=direct
Universal Gateway: dev tooling only — not in the prod path.
```

---

## 4. Workstream A — Hosted embeddings

### 4.1 The dimension problem (the #1 risk)
Chroma fixes vector dimension **per collection**; it cannot be changed after creation and vectors of different dims cannot coexist. Local MiniLM = **384**; OpenAI `text-embedding-3-small` = **1536** (`-large` = 3072). Because production uses a **fresh, dedicated** stack and MCS V2 stores are empty under the write-freeze, **there is no migration of existing vectors** — standardize on the chosen hosted model/dimension from the first collection creation. Getting this right up front is the whole game.

### 4.2 Design — a provider abstraction at the single swap point
Introduce an embeddings-provider seam so dev can keep the GPU and prod uses hosted, without touching `chroma/adapter.ts`:

- Define `EmbeddingsProvider { embed(texts): Promise<number[][]>; health(): Promise<boolean>; readonly dim: number }`.
- Keep the existing GPU implementation as the `gpu` provider (rename/wrap `chroma/embedder.ts`; make `EMBEDDING_DIM` provider-supplied, not a module constant).
- Add a `hosted` provider (OpenAI-compatible): POST to the embeddings API, validate `dim`, **no silent fallback** — throw on unreachable / HTTP error / dimension mismatch (mirror `EmbedderError`). The repo's "never silently degrade" rule (`embedder.ts:10-12`) becomes "fail closed if the hosted API is unreachable."
- Select the provider via env (`EMBEDDINGS_PROVIDER`), default `gpu` in dev so local behavior is unchanged.
- The adapter keeps calling a single `embed()` — it just resolves the active provider.

### 4.3 Env additions
- `EMBEDDINGS_PROVIDER` = `gpu` | `openai` (default `gpu`).
- `OPENAI_API_KEY` (or chosen host key) — secret, VPS-only, **not** the same as `ANTHROPIC_API_KEY`.
- `EMBEDDINGS_MODEL` (e.g. `text-embedding-3-small`) and the derived `dim` (1536).
- Add all to the Zod schema in `server/src/env.ts` and to `.env.example`.

### 4.4 Governance note
Hosted **embeddings** are a non-generative vector API, distinct from the "No LLM calls" prohibition (which targets generative use). Call this out explicitly in the ACR (§6) so the addition is on the record as permitted, not a breach.

### 4.5 Tests
- Provider selection (env → correct provider; default gpu).
- Hosted provider: dimension validation, fail-closed on error (no fallback), correct request shape (mock `fetch`).
- Adapter unchanged-behavior test against a stubbed provider.

---

## 5. Workstream B — Direct-mode cutover to managed cloud

### 5.1 Connection changes by store
- **Mongo → Atlas:** mostly config. Set `MONGODB_URI` to the Atlas `mongodb+srv://user:pass@cluster/…` string; mongoose negotiates TLS from the SRV scheme. Ops: Atlas **IP allowlist** must include the VPS egress IP; a least-privilege DB user. Little/no code change.
- **Neo4j → Aura:** mostly config. Set `NEO4J_URI=neo4j+s://<id>.databases.neo4j.io` (the `+s` gives encryption), `NEO4J_USERNAME`/`NEO4J_PASSWORD` from Aura. `verifyConnectivity()` already validates at boot. Little/no code change.
- **Chroma → Chroma Cloud:** **real code change.** `chroma/connection.ts` hardcodes `CHROMA_TENANT='default_tenant'` / `CHROMA_DATABASE='default_database'` (`:4-5`) and every `fetch` in `chroma/adapter.ts` is unauthenticated. Chroma Cloud needs (a) an **auth header** (API key / token) on every request, and (b) account-specific tenant + database from env. Plan: add `CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` to env; inject the auth header in a shared request helper; make tenant/database env-driven.

### 5.2 Pre-cutover coverage audit (blocking)
Before flipping flags, confirm the **direct adapters cover every write path** currently served by the Gateway. The verification report (P10.7) notes the migration to `tieredWrite`/direct is **incomplete**, and two write paths coexist (`tripleStackWrite()` legacy + `tieredWrite.ts`). Action: enumerate all `tripleStackWrite()` / gateway callers and verify each maps to a working direct adapter action. A gap here means silent data loss on cutover.

### 5.3 Flip sequence (per-store, reversible)
The flags are per-store, so cut over incrementally and roll back by reverting a single env value:
1. Point `MONGODB_URI`/`NEO4J_URI`/`CHROMA_*` at the managed endpoints (still `*_MODE=gateway`).
2. Set `PERSISTENCE_DIRECT_ENABLED=true`, then flip one store at a time to `direct`, verifying `directPersistenceHealth()` + real read/write after each.
3. Chroma last (it also depends on Workstream A's embeddings being live).

### 5.4 Tests
- Chroma Cloud auth-header injection + env-driven tenant/database (mock `fetch`).
- `resolveMode` / `anyDirect` already covered (`flags.test.ts`); add a managed-endpoint readiness test if practical.

---

## 6. Governance & sequencing

- **ACR:** raise one in `organization/ACR-REGISTER.md` covering (a) managed-cloud hosting and (b) the hosted-embeddings provider + the embeddings-permitted clarification. Direct-persistence itself is already **ACR-0007**; this extends it. Log in the decision ledger.
- **Write-freeze:** even with adapters ready, do not write real data to Atlas/Aura/Chroma-Cloud until MCS V2 schemas are approved (`[[mcs-v2-db-write-freeze]]`). Build + dry-run against throwaway collections is fine.
- **Recommended order:** A.2–A.3 (provider seam + env) → B.1 Chroma Cloud auth → B.2 coverage audit → provision managed services → staged flip (B.3) → smoke (incl. the H1 outbox drain, release-checklist B4).

---

## 7. New/changed env contract (summary)

| Var | Purpose | Notes |
|---|---|---|
| `EMBEDDINGS_PROVIDER` | `gpu` (dev) / `openai` (prod) | default `gpu` |
| `OPENAI_API_KEY` | hosted embeddings auth | secret; ≠ `ANTHROPIC_API_KEY` |
| `EMBEDDINGS_MODEL` | e.g. `text-embedding-3-small` | fixes the vector dim (1536) |
| `MONGODB_URI` | Atlas SRV string | + Atlas IP allowlist for the VPS |
| `NEO4J_URI` / `NEO4J_PASSWORD` | Aura endpoint + creds | `neo4j+s://` scheme |
| `CHROMA_URL` | Chroma Cloud base | account host |
| `CHROMA_API_KEY` | Chroma Cloud auth | new — header on every request |
| `CHROMA_TENANT` / `CHROMA_DATABASE` | account tenant/db | replace hardcoded defaults |
| `PERSISTENCE_DIRECT_ENABLED` | master switch → `true` | per-store flip below |
| `PERSISTENCE_{MONGO,NEO4J,CHROMA}_MODE` | → `direct` | flip incrementally |

All secrets live only in the VPS `.env`, never committed.

---

## 8. Open decisions for Kevin

1. **Embeddings provider + model/dimension** — OpenAI `text-embedding-3-small` (1536) vs `-large` (3072) vs another host. Fixes Chroma collection dims permanently for the fresh stack.
2. **Vector store** — Chroma Cloud (assumed here; needs the auth/tenant code change) vs another hosted vector DB (would replace `chroma/*` rather than extend it).
3. **GPU embedder retention** — keep as the `dev` default (recommended, zero-cost local) vs standardize dev on the hosted provider too (simpler parity, adds dev API cost).

---

## 9. Standing-prohibition note

Planning only — nothing implemented, sent, or written. The one prohibition-adjacent item (hosted embeddings vs "No LLM calls") is surfaced for the ACR precisely so the change goes through governance. Direct-write cutover is already an approved architecture (ACR-0007); this plan extends it to managed cloud + hosted embeddings.
