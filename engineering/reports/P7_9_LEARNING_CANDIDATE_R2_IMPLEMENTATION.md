# P7.9 — Learning Candidate Pipeline (R2) — Implementation

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.9 (R2 implementation — third persistence rung)
- Status: **IMPLEMENTED — wired-dormant, canary-gated (default OFF).** `LEARNING_CANDIDATE_PERSISTENCE_ENABLED=false` by default; no route wiring.
- Base: `feature/phase-07-outcomes-learning-graphrag` (post-Phase-6, after R1 `fbfbd42`).
- Implements: P7.5 (Learning Candidate Pipeline Contract), aligned to ratified `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md`; rung **R2** of the P7.1 ladder.
- Governed by: **ACR-0007** (app-direct); the hard rule **no agent may approve knowledge**.

---

## 1. What shipped

R2 persists **learning candidates** — proposed, not-yet-approved units of learning derived from R1 outcomes / runtime signals — **review-only**, and records **human** review decisions. It is the pipeline stage `detected → in_review → approved | rejected` that sits upstream of the ratified Knowledge Evolution Runtime (which activates *approved* knowledge — out of scope here).

| File | Change | Append-only? |
|---|---|---|
| `packages/shared/src/types.ts` | **Appended**: `McsLearningCandidateStatus`, `McsLearningDomain`, `McsCandidateReview`, `McsLearningCandidateRecord`, `AppendLearningCandidateInput`, `ReviewLearningCandidateInput`. | ✅ |
| `server/src/env.ts` | Added canary flag `LEARNING_CANDIDATE_PERSISTENCE_ENABLED` (default false). | n/a |
| `server/src/services/chromaCollections.ts` | Registered `mcs_learning_candidates_review` (the **review-only** collection). | additive |
| `server/src/domain/learningCandidates.ts` | New module: `appendLearningCandidate`, `reviewLearningCandidate`, `findLearningCandidate`, `deterministicCandidateId`, `learningCandidatePersistenceEnabled`, + two error types. | new file |
| `server/src/domain/__tests__/learningCandidates.test.ts` | New — 9 tests. | new file |

---

## 2. The hard invariant: no agent may approve knowledge (P7.5 §5.1)

Enforced structurally, not by convention:

1. **`appendLearningCandidate` has no status parameter.** It always produces a `detected` candidate. A pipeline or agent literally cannot mint an `approved` candidate — there is no code path to.
2. **`reviewLearningCandidate` is the only path to `approved`/`rejected`,** and it **throws** unless a non-empty human `reviewedByBaId` is supplied. (Route-level auth — Kevin/governance per P7.5 O-3 — ensures that id is a human BA.)
3. **No auto-promotion.** There is no timer, heuristic, score, or agent transition to `approved`.
4. **Reviews are written once.** Re-reviewing an already-reviewed candidate throws — a changed decision must **supersede** with a new candidate (`supersedesCandidateId`), append-only. Rejected candidates are retained.

---

## 3. Review-only isolation (P7.5 §3.1)

Candidate embeddings live in `mcs_learning_candidates_review` — a Chroma collection **disjoint** from any active-knowledge collection. A test asserts the writer targets the review-only collection (Mongo `mcs_learning_candidates` + Neo4j `(:LearningCandidate)` + Chroma `mcs_learning_candidates_review`), never an active one. The Context Manager's active-knowledge retrieval therefore can never surface a candidate as guidance.

---

## 4. Other design decisions

- **Canary-gated, default OFF** — both `appendLearningCandidate` and `reviewLearningCandidate` are no-ops (return `null`) when the flag is off; independent of R0/R1 flags.
- **App-direct only (ACR-0007)** — creation via `tripleStackWrite`; review status transition via `gatewayCall` mongo `update` + neo4j `cypher` (the same app-direct seam, flag-routed). No `quadstack.write`, no gateway, no `universal_gateway`.
- **App-memory envelope** — `type: 'learning_candidate'`, `namespace: 'momentum'`, `originKind: 'system'`, `serviceName: 'mcs_learning_pipeline'`; no gateway-only fields.
- **Provenance required** — a candidate must carry ≥1 `sourceOutcomeId`/`sourceSignalId` (`derivedFrom`), and Neo4j links `(:LearningCandidate)-[:DERIVED_FROM]->(:Outcome)` + `-[:SCOPED_TO]->(:TeamMagnificent)`.
- **Team Magnificent scope** — `teamKey: 'team_magnificent'` on every candidate.
- **Deterministic id** — `mcslearn_<hash(domain:sortedEvidence)>`; the same evidence set yields one candidate regardless of order.
- **Caps** — `proposedSummary` ≤2000, review `reason` ≤1000; the summary is a derived proposal, never source text/transcript.
- **Wired-dormant** — no route mounts these (no `/api/runtime/*`); live review-UI wiring is a later approved step, gated behind R0/R1 proven.

---

## 5. Verification

- **Typecheck:** repo-wide green (5/5).
- **New tests:** `learningCandidates.test.ts` — **9/9**. Covers: flag-off no-op; review-only chroma target; always-`detected` creation; no-human-reviewer rejection; provenance-required; human approve transition; re-review refusal (supersede); NotFound; order-independent deterministic id.
- **Full server suite:** **109 files, 1308 tests, all passed** (exit 0) — exactly **+1 file / +9 tests** over the post-R1 baseline (108 / 1299); zero regressions.

## 6. What R2 does NOT do

- Does not enable persistence by default; wires no route.
- Does not activate, version, or index any knowledge as active (that is Knowledge Evolution — later slice).
- Introduces no agent-driven approval, scoring, ranking, or auto-promotion.
- Does not mine private journals; does not touch `.com`, the coordinator, or `apps/**`.

## 7. Next step

R2 dormant. Then **R3 — GraphRAG (P7.6)**: retrieval over the app's own active-knowledge stores (which approved candidates feed, via Knowledge Evolution). Activation order stays R0 → R1 → R2 → R3, each proven before the next.
