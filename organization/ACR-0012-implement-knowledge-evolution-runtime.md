# ACR-0012 — Implement Knowledge Evolution Runtime v1.0

## Momentum Creation System V2

Status: Approved

Ratified: Kevin Gardner, 2026-07-10 — approved as written via orchestrator readiness decision. Implementation authorized as the governed six-lane run; GraphRAG/Context Manager live flags remain OFF; Kevin final authority on merges.

Canonical Authority: runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md

Target Version: v1.2

Decision Owner: Kevin Gardner

Proposer: Claude — orchestrator readiness verification for CODEX_EXECUTION_PROMPT_KNOWLEDGE_EVOLUTION_RUNTIME.md, 2026-07-10

Affects (code only — no ratified document changes):

- `packages/shared/src/runtime/knowledge-evolution/**` (new shared contracts, append-only exports)
- `server/src/runtime/knowledge-evolution/**` (new module: models, repositories, services, policies, indexing, graph, routes, workers, events, metrics)
- `server/src/index.ts` (additive route import + mount lines only)
- `engineering/reports/**` (non-ratified implementation report)

Does NOT affect: any `runtime/**`, `constitution/**`, or `organization/**` ratified document; `.com` prospect surfaces; Telnyx/external communication paths; GraphRAG or Context Manager live flags.

---

## 1. Context

`runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` is a **Ratified Runtime Specification (v1.0)** with `Implementation Target: Codex / Engineering Runtime Implementation`. The architecture is ratified; what is missing is an **approval record authorizing the build**.

The master implementation brief `engineering/sprints/CODEX_EXECUTION_PROMPT_KNOWLEDGE_EVOLUTION_RUNTIME.md` contains its own Governance And Gate Rule:

> Before launching implementation lanes, the orchestrator must verify whether a current approved ACR or decision-ledger entry authorizes implementation of the Knowledge Evolution Runtime. If there is no active approval record, stop and create an implementation-readiness packet instead of launching code lanes.

Orchestrator verification (2026-07-10, HEAD `9b34f96`, branch `main`) found:

- No ACR in `organization/ACR-REGISTER.md` authorizes implementation of the Knowledge Evolution Runtime.
- The two Knowledge-Evolution-touching ACRs are **Proposed**, targeting v1.1: ACR-0001 (Agent Event Model ← Knowledge Evolution Events) and ACR-0005 (Runtime README completion). Neither authorizes building the runtime; the v1.1 band is explicitly for consistency ACRs "without changing runtime behavior."
- No decision-ledger entry (`organization/DECISION_*.md`) covers Knowledge Evolution implementation.
- Implementation is greenfield: no `knowledge-evolution` module exists under `server/src` or `packages/shared`; no routes mounted.
- Persistence prerequisites exist and are reusable: `server/src/services/tieredWrite.ts` and `server/src/services/projectionOutbox.ts`.

Per the gate, code lanes were **not** launched. This ACR is the approval record required to proceed.

## 2. Decision (proposed)

Authorize implementation of Knowledge Evolution Runtime v1.0 exactly as scoped by the master brief, executed as a governed six-lane multi-agent run (Lane 0 → A/B/C → D → E), under the non-negotiable runtime boundaries below. Agents open PRs; the orchestrator merges only after gates pass; Kevin remains final authority. No lane self-merges.

### 2.1 Authorized scope

Knowledge Evolution records; evolution plans; approval validation; Team Magnificent scope validation; approved-candidate activation; versioning; supersession; archival; Chroma reindex coordination; Neo4j graph-sync coordination; retrieval rollout; bilingual EN/ES variants; rollback plans and execution; runtime event emission; metrics and health; privacy guardrails; runtime boundary tests; and the acceptance criteria in `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md`.

### 2.2 Non-negotiable boundaries (unchanged from spec + brief)

The runtime must never: approve knowledge; create raw candidates; detect learning signals; assemble Context Packets; generate agent responses; mine private journals; bypass Knowledge Core / Ingestion / governance; let agents self-modify; activate unapproved knowledge; activate unreviewed machine translation; use Telnyx; send external communications; modify `.com` prospect surfaces; or reintroduce Universal Gateway as a production runtime dependency.

### 2.3 Persistence law

MongoDB canonical; Neo4j graph/lineage; ChromaDB semantic retrieval only. Direct MCS stack (Mongo 30000, Neo4j 7710, Chroma 8200, embedding 8300). Prefer tiered writes + projection outbox. No Universal Gateway / external MCP for app-runtime persistence. No parallel hidden persistence path.

### 2.4 Activation guardrail

GraphRAG and Context Manager live flags remain OFF. Evolved knowledge becomes retrievable only after a retrieval rollout is explicitly marked ready and its readiness checks (approval, source, lifecycle, language, Chroma, Neo4j, governance, scope) pass. Any broad live activation is a separate future canary decision, not covered by this ACR.

## 3. Done definition

All lanes merged; `main` passes typecheck and build; server test status recorded honestly (pre-existing Michael runtime failures called out separately, not masked); acceptance criteria passing or explicitly listed as blocked; implementation report exists; no live flag flipped without approved canary criteria; no `.com` change; no Telnyx/external path added; no ratified document modified without approved ACR authority.

## 4. Register entry to add on approval

Add to `organization/ACR-REGISTER.md`:

| ID       | Title                                   | Canonical Authority              | Status   | Target Version |
| -------- | --------------------------------------- | -------------------------------- | -------- | -------------- |
| ACR-0012 | Implement Knowledge Evolution Runtime v1.0 | runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md | Approved | v1.2 |

## 5. Approval

Approved by Kevin Gardner on 2026-07-10. Register updated; orchestrator authorized to launch Lane 0 per the staged plan in `engineering/reports/KNOWLEDGE_EVOLUTION_RUNTIME_IMPLEMENTATION_READINESS.md`. Consumer lanes (A/B/C/D/E) remain gated by the dependency sequence and per-lane gate passes; no lane self-merges; Kevin remains final merge authority.
