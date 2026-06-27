# ROADMAP

## Momentum Creation System V2

Roadmap Date: 2026-06-27

Authority: Claude (Chief Governance Architect)

Architecture Version: 1.0 (Frozen)

Purpose: Show the transition from a frozen architecture to a production platform. This roadmap sequences engineering, not architecture. Architectural change occurs only through approved ACRs.

---

## Milestone Overview

| # | Milestone | State |
| - | --------- | ----- |
| M0 | Architecture | Complete (Frozen v1.0) |
| M1 | Infrastructure | Next |
| M2 | Core Runtime | Pending |
| M3 | Michael Magnificent | Pending |
| M4 | Steve Success | Pending |
| M5 | Ivory | Pending |
| M6 | Learning Pipeline | Pending |
| M7 | Knowledge Evolution | Pending |
| M8 | Beta | Pending |
| M9 | Production | Pending |

Agent order (M3–M5) follows Implementation Package 001: Michael first (Momentum Journal teaching anchors the knowledge loop), then Steve, then Ivory.

---

## M0 — Architecture

**Goal:** Ratify and freeze the complete v1.0 architecture.

**Dependencies:** None.

**Completion Criteria:**

- Constitution, Governance, Decision Framework, ACR System ratified.
- Nine runtime specifications ratified (12/12 against the Ratification Protocol).
- Implementation Package 001 present.
- `FOUNDATION_v1.0_FREEZE.md` declared; ACR Register established.

**Status: COMPLETE.**

---

## M1 — Infrastructure

**Goal:** Stand up the runtime substrate the specifications assume.

**Dependencies:** M0.

**Scope:**

- pnpm workspace, Node ≥ 22, TypeScript strict baseline.
- MongoDB, Neo4j, Chroma, and GraphRAG service boundaries reachable through the Universal Gateway.
- Shared runtime types and Team Magnificent identity scope.
- `agent_event.v1` event service + outbox skeleton.

**Completion Criteria:**

- `pnpm install`, `pnpm typecheck`, `pnpm build` succeed.
- Health checks pass for MongoDB, Neo4j, Chroma, GraphRAG, and the event service.
- Team Magnificent identity fields enforced in shared types before any BA-scoped record is finalized.

---

## M2 — Core Runtime

**Goal:** Implement the knowledge-and-context spine that every agent depends on.

**Dependencies:** M1.

**Scope (per runtime dependency order):**

- Knowledge Core (Mongo/Neo4j/Chroma/GraphRAG boundaries, lifecycle, retrieval).
- Knowledge Ingestion Protocol (capture → candidate, review-only indexing, lineage).
- Context Packet Schema (`context_packet.v1`).
- Context Manager (governed retrieval, ranking, budget, exclusions, audit).
- Agent Event Model (full taxonomy, idempotency, subscribers, replay).
- Browser Voice Runtime (state machine, text fallback, accessibility).

**Completion Criteria:**

- Knowledge Gate, Context Gate, Event Gate, and Browser Runtime Gate (runtime README §19) pass.
- Candidates are review-only; approved knowledge is separate; journal privacy enforced.
- Context Manager produces a valid `context_packet.v1`; agents never query stores directly.

---

## M3 — Michael Magnificent

**Goal:** First live agent — training support and Momentum Journal teaching.

**Dependencies:** M2.

**Completion Criteria:**

- Michael sessions create and run in Browser Voice and Browser Text, English and Spanish.
- Momentum Journal: private by default, BA-selected promotion to Knowledge Candidate.
- Output guardrails run before responses; candidate proposals are review-only.
- Agent Runtime Gate and Journal Gate (runtime README §19) pass for Michael.

---

## M4 — Steve Success

**Goal:** Success interviews, lesson capture, momentum reflection, next-action guidance.

**Dependencies:** M2 (M3 recommended for shared agent harness).

**Completion Criteria:**

- Steve sessions run bilingually across voice and text.
- Success knowledge captured; next-action guidance produced; personal experience never treated as universal truth.
- Success Knowledge Candidates proposed for review only.

---

## M5 — Ivory

**Goal:** Relationship coaching, Opportunity Map support, editable invitation drafts.

**Dependencies:** M2 (shared harness from M3/M4).

**Completion Criteria:**

- Ivory creates editable invitation drafts; never auto-sends; BA review required.
- Relationship context is BA-owned and person-sensitive; prospect data minimized.
- Optional invitation link minted only after explicit BA approval.

---

## M6 — Learning Pipeline

**Goal:** Turn outcomes into evidence-backed learning signals and review-only candidate proposals.

**Dependencies:** M2–M5 (needs real outcomes from live agents).

**Completion Criteria:**

- Outcomes recorded and linked to context, action, and knowledge.
- Rules-based pattern detection produces signals; candidate proposals route through Knowledge Ingestion.
- Bilingual parity, journal privacy, and the no-manipulation guardrails enforced.
- Learning Gate (runtime README §19) passes; review remains separate from learning automation.

---

## M7 — Knowledge Evolution

**Goal:** Safely activate approved learning into versioned, indexed, graph-linked, retrievable knowledge.

**Dependencies:** M2 (Knowledge Core) and M6 (approved learning to evolve).

**Completion Criteria:**

- Approved candidates become active Knowledge Objects only through controlled activation.
- Versioning, supersession, archival, reindex, graph sync, and retrieval rollout function.
- Rollback preserves audit history; Context Manager retrieves only retrieval-ready knowledge.

---

## M8 — Beta

**Goal:** Exercise the full loop with real Team Magnificent Brand Ambassadors in a controlled cohort.

**Dependencies:** M3–M7.

**Completion Criteria:**

- End-to-end loop verified: guidance → action → outcome → learning → review → evolution → better guidance.
- Compliance boundaries hold (no income/medical/placement claims; THREE boundary; `.com` prohibitions).
- Observability, metrics, and audit trails operational; `pnpm typecheck` clean; manual end-to-end flows pass.

---

## M9 — Production

**Goal:** General availability for Team Magnificent.

**Dependencies:** M8.

**Completion Criteria:**

- Deployment, real-time, and rollback procedures verified.
- All runtime acceptance gates (runtime README §19) pass in production configuration.
- Security and privacy review complete; bilingual operation confirmed.
- Governance live: changes flow through the ACR process and decision ledger.

---

## Governance Note

This roadmap is an engineering sequence, not an architectural authority. The frozen v1.0 architecture governs *what* is built; this roadmap governs *order*. Any architectural change discovered during implementation is raised as a proposed ACR in `organization/ACR-REGISTER.md` and resolved before the affected milestone proceeds.
