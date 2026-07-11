# ACR-0013 — Knowledge Evolution Retrieval Canary (Single-Domain Activation)

## Momentum Creation System V2

Status: Approved

Ratified: Kevin Gardner, 2026-07-10 — approved. Single-domain canary authorized; flips GRAPHRAG_PERSISTENCE_ENABLED for the canary only; §4 pre-activation checklist must pass before activation; Kevin sole authority to widen scope.

Canonical Authority: runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md (§21 retrieval readiness, §37 Context Manager availability) / ACR-0012

Target Version: v1.2

Decision Owner: Kevin Gardner

Proposer: Claude — orchestrator follow-up to the merged Knowledge Evolution Runtime (ACR-0012), 2026-07-10

Affects (config + operational, no ratified-doc change): `.env` runtime flags; the KER retrieval-rollout path (`RetrievalRollout.service` + Lane C/D coordination); admin/metrics visibility. No `apps/com`, no Telnyx, no ratified spec/constitution edits.

---

## 1. Context

ACR-0012 implemented the Knowledge Evolution Runtime v1.0 and **deliberately left retrieval activation out of scope**: "GraphRAG and Context Manager live flags remain OFF … any broad live activation is a separate future canary decision." The runtime today marks knowledge `retrieval_ready` and emits `AVAILABLE_TO` graph links only after a rollout is marked ready, but nothing is actually retrievable because the persistence/retrieval flags are off by default.

Current live state (verified 2026-07-10):

- `MCS_CONTEXT_MANAGER_LIVE_ENABLED=true` and `STEVE_CONTEXT_MANAGER_LIVE_ENABLED=true` — already enabled 2026-07-07 so Michael/Steve read the approved KB. **This ACR does not change those.**
- `GRAPHRAG_PERSISTENCE_ENABLED` — default **false** (KER-evolved knowledge is not persisted to the retrievable GraphRAG path).
- Direct stack reachable: Mongo 30000, Neo4j 7710, Chroma 8200 (`chromadb2` / Chroma-MCS-v2), embedding 8300 — all up.

This ACR requests a **narrow, reversible canary**: make KER-evolved knowledge retrievable for **one domain only**, under explicit readiness gates, with rollback, before any broad enablement.

## 2. Decision (proposed)

Authorize a single-domain KER retrieval canary under the controls below. Nothing activates until this ACR is Approved.

### 2.1 Canary scope

- **One knowledge domain only** (proposed: `success_knowledge`, the Team-Magnificent training/success corpus), English + Spanish variants.
- **Team Magnificent scope only.** No cross-team, no `.com`, no prospect surface.
- A bounded set of **human-approved** Knowledge Objects (each already through Knowledge Core approval + KER versioning). No auto-approval, no candidate/review-only records.

### 2.2 Retrieval-readiness gates (all must pass per object before it is retrievable)

Approval reference present · source lineage preserved · lifecycle = active (not superseded/archived) · language metadata valid (human-reviewed, not unreviewed machine translation) · Chroma active-collection index confirmed · Neo4j graph links confirmed · governance/scope check = Team Magnificent. These are the §21 checks already implemented in `RetrievalRollout`/`RetrievalReadinessPolicy`; the canary requires them to be **enforced and observable**, not bypassed.

### 2.3 What flips (config only, staged)

1. `GRAPHRAG_PERSISTENCE_ENABLED=true` — persist KER-evolved knowledge to the retrievable path (currently the only broad-off flag in the way).
2. Mark the canary domain's approved objects `retrieval_ready` via the governed rollout path (not by hand-editing stores).
3. Leave everything else off. No new flags beyond these.

### 2.4 Monitoring + rollback

- **Metrics:** retrieval-ready counts, blocked-rollout reasons, failed reindex/graph-sync jobs, and (new) retrieval hit/citation counts for the canary domain — surfaced in the KER metrics/health endpoint.
- **Rollback:** a documented, tested path — set `GRAPHRAG_PERSISTENCE_ENABLED=false` and run the KER rollback to mark the canary objects not-retrieval-ready; audit history preserved (KER rollback already guarantees no record/version erasure). Rollback must be exercised in a dry run before go-live.
- **Exit criteria to widen beyond the canary:** a separate future ACR, only after the canary shows correct gating, correct citations, and clean rollback.

## 3. Non-negotiable boundaries (unchanged)

No candidate/review-only knowledge retrievable · no unreviewed machine translation · Chroma never canonical · Neo4j never overrides Mongo · no `.com` change · no Telnyx/external sends · no Universal Gateway as runtime persistence · agents never self-approve or self-activate knowledge.

## 4. Pre-activation checklist (orchestrator, before flipping anything)

1. Live-stack integration pass GREEN: a scoped end-to-end evolution against real Mongo/Neo4j/Chroma (disposable test IDs, cleaned up) proving persistence + indexing + graph-sync work outside mocks.
2. `ensureKnowledgeEvolutionIndexes` applied to live Mongo.
3. Rollback dry run GREEN.
4. Metrics endpoint shows the canary counters.

## 5. Approval

Approved by Kevin Gardner on 2026-07-10; registered (Approved, v1.2). The §4 pre-activation checklist must pass before §2.3 flips (GRAPHRAG_PERSISTENCE_ENABLED). Checklist status: (1) live-stack integration — persistence foundation GREEN (health of all four legs + indexes applied + Mongo evolution round-trip verified & cleaned 2026-07-10); Chroma-index + Neo4j-graph write legs pending; (2) indexes applied GREEN; (3) rollback dry run pending; (4) metrics visible pending. Kevin remains sole authority for the activation and for any decision to widen scope.

Register row to add on approval:

| ID | Title | Canonical Authority | Status | Target Version |
| --- | --- | --- | --- | --- |
| ACR-0013 | Knowledge Evolution Retrieval Canary (single-domain activation) | runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md §21/§37 | Approved | v1.2 |
