# P7.13 — Phase 7 Schema Catalog (review-before-apply)

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.13 (consolidated schema reference — DOCS ONLY)
- Status: **DRAFTED, NOT APPLIED.** Single-page view of every Phase 7 model / collection / label + purpose, so the whole schema surface can be reviewed before anything is created in a store.
- Base: `feature/phase-07-outcomes-learning-graphrag`.
- Sources: P7.7–P7.12, `phase7Models.ts`, `phase7Constraints.ts`, `chromaCollections.ts`, `P10_MCS_V2_SCHEMA_DESIGN.md`.

---

## 0. How to read this

Everything below is **built as code but not applied to any store**. Mongo models live in `phase7Models.ts`; Neo4j statements in `phase7Constraints.ts`; Chroma names in `chromaCollections.ts`. Each is drafted + unit-tested but not wired into the live apply path. When you've reviewed the full surface, application is a per-store step (see P7.12 §5).

Shared **app-memory envelope** on every memory record (P7.3 §4.2), **membership-first** (`DECISION_team_magnificent_membership_canonical_identity`): `id · type · schemaVersion · namespace('momentum') · source · createdAt(ISO string) · title · originKind('system') · serviceName · tenantId · teamKey('team_magnificent')`, optional `baId` (= the Team Magnificent **member** id, `TMBA-…`), `derivedFrom[]`. Every record is scoped to Team Magnificent membership. Gateway-only fields (`chat_number`, `chat_registry_id`, `universal_gateway`) are never present.

---

## 1. MongoDB — collections (database `momentum`)

| Collection | Rung | Key (`_id`) | Required-core (beyond envelope) | Purpose |
|---|---|---|---|---|
| `mcs_audit_log` | R0 | `entryId` | *(4.J substrate)* + optional `runtime` block | Canonical append-only audit; R0 adds runtime turn/gate markers (metadata only, no body). |
| `mcs_outcomes` | R1 | `id` (`mcsoutcome_<hash>`) | `kind`(7-enum) · `confirmedByBaId` · `outcomeAt` | BA-confirmed real-world outcomes; `enrolled_three` is a THREE mirror, not a handoff. Append-only correction chain. |
| `mcs_learning_candidates` | R2 | `id` (`mcslearn_<hash>`) | `status`(5-enum) · `domain`(5-enum) · `language` · `proposedSummary` · `sourceOutcomeIds[]` · `sourceSignalIds[]` · optional `review` | Review-only proposed learning; **no agent may approve** (status starts `detected`; only a human review sets approved/rejected). |
| `mcs_graphrag_records` | R3 | `id` (`mcsgraph_<kobj>_v<n>_<lang>`) | `knowledgeObjectId` · `version`(int) · `domain` · `language` · `summary` · `model` · `modelVersion` · `retrievalReady`(bool) | Derived-memory index of active knowledge for GraphRAG retrieval. |

First-pass validator posture (all): `required` = core above; `additionalProperties:true`; ISO-string timestamps (never `Date`); field enums enforced client-side on direct writes. Tighten to `additionalProperties:false` per-collection after a soak (P10 §5/§8).

---

## 2. Neo4j — new Phase 7 labels

| Label | Constraint (unique) | Indexes | Relationships (specific verbs) | Purpose |
|---|---|---|---|---|
| `Outcome` | `id` | `baId` | `-[:CONFIRMED_BY]->(:BrandAmbassador)`, `-[:ABOUT_PROSPECT]->(:Prospect)`, `-[:SUPERSEDES]->(:Outcome)`, `-[:SCOPED_TO]->(:TeamMagnificent)` | R1 outcome lineage + team scope. |
| `LearningCandidate` | `id` | `status` | `-[:DERIVED_FROM]->(:Outcome)`, `-[:SCOPED_TO]->(:TeamMagnificent)` | R2 candidate provenance + team scope. |
| `Knowledge` | `id` | `retrievalReady` | `-[:SCOPED_TO]->(:TeamMagnificent)` | R3 active-knowledge nodes. |
| `TeamMagnificent` | `teamKey` | — | *(target of `:SCOPED_TO`)* | Single team scope node. |
| `AuditEntry` | `entryId` *(P10 §6 set)* | `entityId` | `-[:ACTED_FOR]->(:BrandAmbassador)` (R0) | Shared 4.J audit; constraint applied with the P10 canonical set. |

Prereq: `BA` vs `BrandAmbassador` label reconciliation (P10 §5.1) before the `:CONFIRMED_BY` / `:ACTED_FOR` edges are constrained.

---

## 3. ChromaDB — collections (`mcs_`-prefixed, 384-dim all-MiniLM-L6-v2)

| Collection(s) | Rung | Kind | Purpose |
|---|---|---|---|
| `mcs_audit_log` | R0 | active | Runtime + admin audit semantic search (no body). |
| `mcs_outcomes` | R1 | active | Outcome semantic index (scope summary, no PII). |
| `mcs_learning_candidates_review` | R2 | **review-only** | Candidate embeddings, **disjoint from active knowledge** — never retrieved as guidance. |
| `mcs_{success,training,relationship,performance,organizational}_knowledge_{en,es}` (10) | R3 | **active** | Per-domain-per-language active-knowledge retrieval; only `retrievalReady:true` served. |

Record contract (P10 §7.2): `id` == Mongo `_id`; `document` = short summary; flat `metadata` with required `kind` + scope ids + ISO timestamps + `model`/`modelVersion`. Convention-enforced by writers (Chroma has no schema validation).

---

## 4. Kill-switch flags (all default OFF)

| Flag | Rung |
|---|---|
| `RUNTIME_AUDIT_PERSISTENCE_ENABLED` | R0 |
| `OUTCOME_CAPTURE_PERSISTENCE_ENABLED` | R1 |
| `LEARNING_CANDIDATE_PERSISTENCE_ENABLED` | R2 |
| `GRAPHRAG_PERSISTENCE_ENABLED` | R3 |

Plus the S1.3 direct-mode master switch `PERSISTENCE_DIRECT_ENABLED` + per-store `PERSISTENCE_<STORE>_MODE` (unchanged).

---

## 5. Enum reference (closed sets)

- **Outcome kind:** `webinar_attended · callback_completed · orientation_attended · became_customer · enrolled_three · declined · no_show`
- **Candidate status:** `detected · in_review · approved · rejected · superseded`
- **Learning domain:** `success · training · relationship · performance · organizational`
- **Language:** `en · es`
- **GraphRAG type:** `graphrag_record · graphrag_chunk`
- **Memory type:** `outcome · learning_candidate · graphrag_record · graphrag_chunk`
- **Runtime audit action:** `runtime.turn.{opened,draft_emitted,closed} · runtime.gate.{allowed,denied} · runtime.persistence.{enabled,disabled}`

---

## 6. Apply readiness

When you've reviewed §1–§5 and want to create the schemas in the stores, the order (P7.12 §5) is: provision services → wire `phase7Models.ts` into `registry.ts` + run `apply.ts` (Mongo `$jsonSchema`) → iterate `PHASE7_NEO4J_SCHEMA` via the neo4j adapter (constraints/indexes) → confirm the Chroma registry ensured at boot → per-store read-back → then per-rung canary (R0 first). Every step is reversible (validators drop to permissive; constraints `DROP … IF EXISTS`; flags flip off).

**Nothing in this catalog is applied.** It is the review surface; application is your call, per store, per collection.
