# P7.5 — Learning Candidate Pipeline Contract

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.5 (contract proposal — design only)
- Status: **PROPOSAL — NON-RATIFIED. Contract only.** No persistence implementation is authorized by this document.
- Base SHA: `cce9a951e3ca1b04307f68245201c389375b0a7a` (verified HEAD == Base SHA)
- Rung: **R2** in the P7.1 persistence ladder (enabled only after R0 audit + R1 outcomes are proven).
- Depends on: P7.1 (governance), P7.3 (write contract — Path B killed), P7.4 (outcome capture — candidates derive from outcomes).
- Aligns to: **ACR-0007** (app-direct persistence), the ratified `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` (candidate → review → approved → evolution lifecycle), canonical schema `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (`f976dd3`), P7.3 §4 (app-memory envelope + `$jsonSchema` governed door).

---

## 1. Purpose

Define how a **learning candidate** — a *proposed*, not-yet-approved unit of organizational learning derived from runtime signals/outcomes — is captured, stored **review-only**, reviewed, and (only on human approval) handed forward. This is rung **R2**: it sits **upstream** of the ratified Knowledge Evolution Runtime, which activates *approved* knowledge. P7.5 governs only the **candidate** stage: `detected → candidate → in_review → approved | rejected → (handed to Knowledge Evolution)`.

The single hard invariant of this slice: **no agent may approve knowledge, and a candidate is never active knowledge.** A candidate is a review artifact. It becomes organizational knowledge only through the separate, human-owned review + Knowledge Evolution path — never automatically, never by an agent, never by the Learning Pipeline itself (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §3, §9.1).

---

## 2. Position in the learning loop

```
Runtime signals + P7.4 outcomes
   ↓  (Learning Pipeline detects — LEARNING_PIPELINE.md, out of scope here)
Learning candidate  ──stored REVIEW-ONLY (mcs_learning_candidates)──►  this contract (R2)
   ↓  (human review — Kevin / governance / review workflow)
approved | rejected
   ↓  approved only
Knowledge Evolution Runtime (activation, versioning, indexing)  ──►  later slice, ratified spec
```

- **Upstream** (out of scope here): signal detection (`LEARNING_PIPELINE.md`) and candidate *creation* (`KNOWLEDGE_INGESTION_PROTOCOL.md`). P7.5 governs the candidate *record and its review lifecycle*, not the detection heuristics.
- **Downstream** (out of scope here): Knowledge Evolution consumes an **approved** candidate. P7.5 stops at "approved," emits the approval, and hands off. It never activates, indexes into active collections, or graph-links as active knowledge.

---

## 3. Write path (single, app-direct, review-only)

Every candidate record travels the **one** path from P7.3 §3: `tripleStackWrite()` into the app's own dedicated stores (Mongo `momentum` @30000, Neo4j @7710, Chroma `mcs_*` @8200). **No `quadstack.write`. No Universal Gateway.** A candidate is a memory-class record → app-memory envelope (P7.3 §4.2) + `$jsonSchema` governed door (P7.3 §4.3).

### 3.1 Review-only isolation (critical)

Candidate embeddings live in a **separate, review-only** Chroma collection and are **never** mixed with active-knowledge collections (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §8.6, §19.2). The Context Manager's active-knowledge retrieval must **never** surface a candidate as guidance.

| Store | Target | Content |
|---|---|---|
| MongoDB | `mcs_learning_candidates` (momentum) | full candidate doc: app-memory envelope + candidate fields (§4) |
| Neo4j | `(:LearningCandidate {id})` | envelope core + `status`, `domain`; edges `(:LearningCandidate)-[:DERIVED_FROM]->(:Outcome)`, `-[:DERIVED_FROM]->(:LearningSignal)`, `-[:SCOPED_TO]->(:TeamMagnificent)` |
| ChromaDB | `mcs_learning_candidates_review` (**review-only**, separate from active knowledge) | short candidate summary; flat metadata with required `kind:'learning_candidate'` + `status` + scope ids |

`id` is shared across all three (P7.3 §3.2).

---

## 4. Schema

### 4.1 Candidate lifecycle status (closed enum)

```ts
// Proposed for a future append to packages/shared/src/types.ts (impl slice, post-approval).
export type McsLearningCandidateStatus =
  | 'detected'     // signal became a candidate (Learning Pipeline output)
  | 'in_review'    // a human reviewer picked it up
  | 'approved'     // human-approved → eligible for Knowledge Evolution handoff
  | 'rejected'     // human-rejected → terminal, retained for audit
  | 'superseded';  // replaced by a newer candidate (append-only chain)
```

There is **no** `auto_approved` state and **no** transition an agent can drive to `approved`. The only actor that can set `approved`/`rejected` is a human reviewer (Kevin / governance / review workflow).

### 4.2 Candidate record (app-memory envelope + fields)

```ts
export interface McsLearningCandidateRecord extends McsMemoryEnvelope {
  // envelope (P7.3 §4.2): id, type:'learning_candidate', schemaVersion, namespace:'momentum',
  //   source, createdAt, title, originKind:'system', serviceName:'mcs_learning_pipeline',
  //   tenantId, baId?, derivedFrom (outcome/signal ids)
  status: McsLearningCandidateStatus;   // starts 'detected'
  domain: 'success' | 'training' | 'relationship' | 'performance' | 'organizational';
  language: 'en' | 'es';
  proposedSummary: string;              // the proposed learning, capped; NOT active guidance
  sourceOutcomeIds: string[];           // P7.4 outcomes this derives from
  sourceSignalIds: string[];            // learning signals (Learning Pipeline)
  teamKey: 'team_magnificent';          // Team Magnificent scope (KNOWLEDGE_EVOLUTION_RUNTIME §5)
  review?: McsCandidateReview;          // present once reviewed (§4.3)
  supersedesCandidateId?: string;       // append-only correction chain
}

export interface McsCandidateReview {
  decision: 'approved' | 'rejected';
  reviewedByBaId: string;               // a HUMAN reviewer id — never an agent id
  reviewedAt: string;                   // ISO-8601 UTC '…Z'
  reason?: string;                      // capped; why approved/rejected
  approvalReferenceId?: string;         // links to the approval record Knowledge Evolution requires
}
```

`type` is always `'learning_candidate'`; `originKind` always `'system'`; `serviceName: 'mcs_learning_pipeline'`. No `chat_number`, no `universal_gateway` (P7.3 §4.4). Timestamps are **ISO-8601 strings**, not BSON `Date` (P10 §3.3 — this reconciles the `Date`-typed fields in the ratified `KNOWLEDGE_EVOLUTION_RUNTIME.md` models toward the canonical string convention; noted as O-2 below).

### 4.3 Determinism & append-only review

- `id` is deterministic from `(sortedSourceOutcomeIds + sortedSourceSignalIds, domain)` so the same evidence does not spawn duplicate candidates on retry.
- The `review` block is written **once** when a human decides; a changed decision writes a **new** candidate with `supersedesCandidateId` (append-only, mirroring P7.4 §5.7 and the decision ledger). Review history is never overwritten.

---

## 5. Invariants (acceptance bar for the impl slice)

1. **No agent approval — ever.** Only a human reviewer transitions a candidate to `approved`/`rejected`. `reviewedByBaId` must be a human BA id; the governed door rejects a record whose `review.decision` is set without a human reviewer. Agents/pipelines can only produce `detected` candidates.
2. **Candidate ≠ active knowledge.** Candidates persist **review-only**, in the separate `mcs_learning_candidates_review` Chroma collection, never in active-knowledge collections. The Context Manager never retrieves a candidate as guidance.
3. **No auto-promotion.** There is no path from `detected` to `approved` without a human review action. No timer, heuristic, score, or agent may promote.
4. **Single app-direct path** via `tripleStackWrite` (P7.3 §3). All-three-or-fail; fail-before-Mongo; read-back on first-of-family during canary. **No gateway.**
5. **App-memory envelope** (P7.3 §4.2) stamped; passes the `mcs_learning_candidates` `$jsonSchema` governed door.
6. **Team Magnificent scope** (`teamKey: 'team_magnificent'`) + `tenantId` on every candidate; BA scope where BA-derived (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §5.2).
7. **Provenance preserved** — `sourceOutcomeIds` / `sourceSignalIds` / `derivedFrom` are mandatory so review can trace every candidate to its evidence and Knowledge Evolution can preserve lineage later.
8. **No private-journal mining.** Private Momentum Journal content becomes a candidate only through explicit BA promotion (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §9.6); P7.5 never auto-derives candidates from private journals.
9. **No excluded data** — no income/compensation/cycle/placement, no `.com` exposure, no LLM prompt/completion bodies, no raw transcripts; `proposedSummary` is a capped derived summary, not source text.
10. **Append-only.** Candidates and their reviews are never edited in place; corrections use the supersession chain. Rejected candidates are retained for audit.
11. **No agent writes.** Server domain / Learning Pipeline boundary owns the write; the Context Manager remains the sole Context Packet assembler.

---

## 6. Handoff to Knowledge Evolution (boundary, not scope)

When a human approves a candidate, P7.5's responsibility ends with: (a) writing the `approved` status + `review` block + `approvalReferenceId`, and (b) emitting an approval marker the later Knowledge Evolution slice consumes (`knowledge.candidate.approved`, per `KNOWLEDGE_EVOLUTION_RUNTIME.md` §24.2). **P7.5 does not activate, version, index-as-active, or graph-link-as-active** — that is the ratified Knowledge Evolution Runtime, a separately-approved later slice. The approval reference (`KNOWLEDGE_EVOLUTION_RUNTIME.md` §12) is the contract seam between the two.

---

## 7. Read surface & observability

- Reviewers read pending candidates through a BA/admin-facing surface under the existing domain boundary — **no new `/api/runtime/*` route family** (standing prohibition). *(The ratified `KNOWLEDGE_EVOLUTION_RUNTIME.md` §25 sketches `/api/runtime/knowledge-evolution` routes for the downstream slice; reconciling those against the standing "no `/api/runtime/*`" prohibition is a governance question flagged as O-1 below — it does not affect this candidate-capture contract.)*
- `/admin` shows **aggregate** learning metrics (candidate volume, approval rate, time-in-review) — never surfaced on `.com`, and the candidate review surface is a decision queue for humans, not an agent-run auto-approver.

---

## 8. Failure & rollback

- Partial write → fail loud (P7.3 §6); no leg best-effort.
- Schema/human-reviewer rejection at the governed door → fix payload, never loosen the validator.
- Canary cleanup → delete-by-id across all three app stores using the deterministic `id`.
- Kill switch → the R2 candidate family is flag-gated (P7.1 §6); disabling it stops new candidate writes without redeploy and without touching R0 audit or R1 outcomes.

---

## 9. What this document does NOT do

- Adds no export to `types.ts`, no route, no domain code (impl slice, post-approval).
- Writes to no store; enables no persistence.
- Does not define signal detection (`LEARNING_PIPELINE.md`) or candidate creation heuristics (`KNOWLEDGE_INGESTION_PROTOCOL.md`).
- Does not activate, version, or index any knowledge as active (`KNOWLEDGE_EVOLUTION_RUNTIME.md`, later slice).
- Does not introduce any agent-driven approval, scoring, ranking, or auto-promotion.

---

## 10. Open decisions for Kevin

- **O-1 (route family):** the ratified `KNOWLEDGE_EVOLUTION_RUNTIME.md` §25 names `/api/runtime/knowledge-evolution` routes, but the Phase 7 standing prohibitions forbid a `/api/runtime/*` route family. Reconcile: either the review/evolution surfaces mount under the existing admin/domain route conventions (recommended, keeps the prohibition), or a scoped exception is ratified for the knowledge-evolution surface. **Recommend: no `/api/runtime/*`; mount under existing conventions.**
- **O-2 (timestamp type):** the ratified evolution models type timestamps as BSON `Date`; the canonical app schema (P10 §3.3) mandates ISO-8601 strings. Adopt ISO strings for the app-scoped candidate/evolution records (recommended, one convention app-wide) and note the reconciliation against the ratified spec.
- **O-3 (reviewer authority):** confirm the set of human roles that may approve a candidate (Kevin only, vs Kevin + a named governance reviewer role). Default: Kevin only, matching "only Kevin can approve knowledge."
