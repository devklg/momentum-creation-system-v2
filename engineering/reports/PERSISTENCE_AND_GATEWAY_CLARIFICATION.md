# Persistence & Universal Gateway Clarification

Report date: 2026-06-27
Author: Claude (Chief Governance Architect)
Status: Engineering working note — NON-RATIFIED. Lives in `engineering/` by design. Documents findings and a recommended disposition; changes no ratified document, no production code, and no source-of-truth doc.
Relates to: master-plan Blocker #2 / Sprint 1 item S1.3; the "Gateway unavailable" caveat in all seven Codex audits.

---

## Why this note exists

Two things have been tangled together under the name "Universal Gateway," and the tangle has been generating a recurring (false) blocker plus an unresolved architecture question. This note separates them cleanly so the gateway can be removed from Sprint 1's blocker scope and the real persistence work can be stated correctly.

The two meanings:

- **The MCP Universal Gateway (a developer tool).** `D:/server-gateway-mcp-v2`, `localhost:2526`. An MCP server that Claude Desktop, Claude Code, Codex, and Codex CLI use to reach Mongo / Neo4j / Chroma *during build sessions*. It is tooling, not product.
- **A runtime dependency on that gateway (an architecture mistake).** The current production server routes its own persistence through that same MCP gateway. This was never the ratified design; it was introduced in a non-ratified spec and the code that followed it.

Keeping these straight resolves everything below.

---

## Part 1 — Persistence reconciliation

### What the ratified architecture says

The frozen runtime layer specifies persistence as **direct MongoDB (Mongoose) + Neo4j + Chroma**, through dedicated adapters and service layers. Evidence in the ratified set:

- `runtime/KNOWLEDGE_CORE_RUNTIME.md`: "MongoDB is the primary canonical persistence layer," "Neo4j is the primary relationship persistence layer," "Chroma is the primary semantic persistence layer"; names `Neo4jKnowledgeMapper.ts`, `ChromaCollectionManager.ts`, `ChromaEmbeddingRepository.ts`; requires explicit Mongo collections, Neo4j constraints, and Chroma collections for v1.0.
- `runtime/AGENT_EVENT_MODEL.md`: "All runtime events must be stored in MongoDB"; workers `chroma_index_worker`, `neo4j_graph_worker`.
- Ratified `runtime/README.md` storage table: MongoDB + Mongoose = canonical source of truth; Chroma = semantic memory; Neo4j = relationship memory.
- `implementation/IMPLEMENTATION_PACKAGE_001_...md`: environment is `MONGODB_URI`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `CHROMA_URL`; adapters `server/src/runtime/knowledge/chroma.adapter.ts` and `neo4j.adapter.ts`.

Across every ratified runtime and implementation document, the Universal Gateway is named **zero** times as a runtime persistence path. There is no `GATEWAY_URL` in the ratified environment. **The ratified architecture already matches the intended design: persistence is the three stores, accessed directly.**

### Where the conflict actually lives

Two **non-ratified** places encode the gateway-as-runtime mistake:

1. `docs/locked-spec.md` §3.14 Persistence states that every write hits Mongo + Neo4j + Chroma "via Universal Gateway V2 at `localhost:2526`," and calls it "the standard MCS V2 gateway." Two earlier passages reinforce "gateway-mediated persistence / gateway-mediated writes" as deliberate.
2. The live server implements exactly that. `server/src/services/gateway.ts` declares "All persistence happens through this" and POSTs every operation to `${GATEWAY_URL}/execute`, where `GATEWAY_URL` defaults to `http://localhost:2526/api`. Reach: **405 `gatewayCall()` sites across 63 files**, plus 101 `tripleStackWrite` / `tieredWrite` wrappers layered on top.

`docs/locked-spec.md` is in `docs/`, outside the four ratified layers in `FOUNDATION_v1.0_FREEZE.md` (`constitution/`, `runtime/`, `implementation/`, `organization/`). So it is editable without an ACR. Where it conflicts with the ratified runtime specs, **the ratified specs are the higher authority and control.** `locked-spec.md` §3.14 is therefore stale/incorrect on this single point, and the current server code is implementation debt relative to the frozen architecture.

### Disposition

- **Reconcile `docs/locked-spec.md` §3.14** to match the ratified direct-DB architecture. This is reconciliation (aligning a stray doc *to* the freeze), not redesign. The one judgment call is paperwork: record as a decision-ledger entry (recommended) versus a formal ACR (maximum rigor). Recommended: decision-ledger entry, since nothing in the frozen architecture changes.
- **Treat the 405-site coupling as a planned migration, not a blocker.** Approach: introduce direct `mongo` / `neo4j` / `chroma` adapters behind the existing service boundary, repoint the internals of `gatewayCall` / `tripleStackWrite` / `tieredWrite` at them, and migrate callers incrementally. No big-bang rip-out. This migration is the concrete content of Sprint 1 item S1.3 ("Gateway-native vs. Mongoose persistence mapping") — and the answer is now unambiguous: direct stores, per the freeze.
- **Net architectural rule to carry forward:** the production runtime depends on MongoDB, Neo4j, and ChromaDB directly. The MCP Universal Gateway is developer tooling only and is never a runtime dependency.

### Redis — not in scope

Redis is **not** a current dependency and is **not** part of the canonical persistence layer. It appears only as a future horizontal-scaling option in two comments: `server/src/services/poolEvents.ts` (today a single in-memory `EventEmitter`, "no Redis," with Redis pub/sub noted as a someday option) and `server/src/routes/p-login.ts` (session state could move to Redis if the server ever scales horizontally). If ever added, Redis would be an ephemeral coordination/cache layer beside the three canonical stores — it does not change "persistence = Mongo / Neo4j / Chroma." No action for Sprint 1.

### Proposed §3.14 replacement text (for review — NOT applied)

> **3.14 Persistence.** Every write hits **MongoDB + Neo4j + ChromaDB** in the same logical operation. No store is optional; no store is deferred. The runtime accesses these three stores **directly**, through dedicated adapters and service layers (Mongoose models, Neo4j graph services, Chroma embedding/collection services). The MCP Universal Gateway V2 (`D:/server-gateway-mcp-v2`, `localhost:2526`) is **developer tooling only** — used by Claude Desktop, Claude Code, Codex, and Codex CLI to reach the stores during build sessions — and is **never a production runtime dependency**.

---

## Part 2 — The "Universal Gateway error," clarified and removed from scope

### What the error was

All seven Codex audits and both plans carry a blocker worded roughly as: *"Universal Gateway V2 MCP connector failed during audit; live store verification pending."* That was a **session-level MCP connector initialization failure inside Codex's own audit session** — the dev tool didn't come up for that run. It is not a statement about production, and it is not a statement about whether the databases are healthy.

### Why it is not a blocker

The thing Codex couldn't reach was the *developer tool*, not the *databases*. The databases are reachable and healthy, verified live this session directly:

| Store | Check | Result |
| --- | --- | --- |
| Neo4j | `MATCH (d:Decision) RETURN count(d)` | reachable — 301 nodes |
| ChromaDB | `list_collections` | reachable — 34 collections |
| MongoDB | `aggregate` count on `momentum.decisions` | reachable — 33 records |

So the caveat resolves two ways at once: the MCP tool is in fact up (the audit-time failure was transient/session-local), and even when the tool hiccups it says nothing about Sprint 1 readiness, because the runtime is not supposed to go through it anyway (Part 1).

### Disposition

- **Strike "Gateway unavailable / live store verification pending" from the audit blocker lists.** It is neither a Sprint 1 blocker nor a production concern. It was a one-session tooling glitch.
- The **only** legitimate gateway-related work item is the one in Part 1: removing the gateway as a runtime *dependency*. That is planned migration work, tracked under S1.3 — not a blocker, and explicitly not the same thing as the audit-time connector error.

---

## Reconciliation status — EXECUTED 2026-06-27 (Kevin approved)

The doc-level reconciliation has been applied. What changed:

- **Corrected (authoritative architecture/intent docs):** `docs/locked-spec.md` §3.14 + the reinforcing phrases at lines 131 and 199; `docs/UNIVERSAL_GATEWAY_V2_STANDARD.md` (reframed to dev-tooling standard + corrected Persistence Rule); `docs/AGENT-BRIEFING.md` line 37; `docs/project-wireframe.md` line 29. All now state direct-store persistence with the gateway as developer tooling only.
- **Logged:** governance decision `dec_runtime_persistence_direct_not_gateway` (seq 28), written to the triple-stack ledger (MongoDB `momentum.decisions` + Neo4j `:Decision` + ChromaDB `momentum_decisions`) and read back on each leg.
- **Intentionally left unchanged:** ratified docs (already correct, and frozen); production code and the 405 `gatewayCall` sites (Sprint 1 S1.3 migration, gated behind sprint approval + branch); dated snapshots (`*_2026-06-24.md`, `*_2026-06-23.md`) and current-state runbooks (`DEPLOYMENT_GUIDE.md`, `ADMINISTRATOR_GUIDE.md`, `DEPLOYMENT_AND_REALTIME_TEST_GUIDE_2026-06-24.md`) — they truthfully describe today's code and will update with the migration; the generated `docs/reference-manuals/` file (regenerates from corrected sources).

## Remaining (await go)

1. Schedule the gateway→direct-adapter migration as the concrete S1.3 work item, sequenced incrementally behind the service boundary.
2. When the migration lands, update the current-state runbooks listed above.
3. Optionally strike the "Gateway unavailable" caveat from the standing audit blocker lists.
