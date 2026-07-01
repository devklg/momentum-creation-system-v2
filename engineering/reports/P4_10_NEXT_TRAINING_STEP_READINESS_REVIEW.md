# P4.10 — Next Training Step Resolution — Readiness Review (Agent A)

## Momentum Creation System V2 · Phase 4 · Slice P4.10 (final)

Branch: `feature/phase-04-p4.10-next-training-step`
Base: `32bda0d` (`main` after P4.9 / PR #86)
Mode: readiness review only.

---

## 1. Objective

The capstone of Phase 4: resolve the agent's **next training step** over the approved-knowledge
retrieval path — deterministically, fail-closed, and content-free. Given the approved knowledge
retrieved for a training objective and what the BA has already completed, pick the next step (a
pointer to an approved item), or report that all steps are complete, or — when retrieval
degraded — hand back the P4.9 safe fallback. **No LLM, no generation** — a pure selection over
approved knowledge.

## 2. What Phase 4 already provides (this slice composes it)

- **P4.4/P4.6/P4.7** — `retrieveApprovedKnowledge` returns a validated `approved_knowledge_query.v1`
  result: only approved/active references, language-marked, freshness-guarded, or a fail-closed
  `degraded` result.
- **P4.8** — the retrieval is observable.
- **P4.9** — `safeFallbackFromResult` maps a degraded result into a reason-specific
  `DegradedContextState`. P4.10 reuses this verbatim for its `unavailable` outcome.
- `KnowledgeReference` carries `knowledgeId` / `sourceId` / `domain` / `language` — enough for a
  content-free step pointer; there is no body field, so a step can never carry knowledge text.

## 3. The resolution model

The retrieved `result.references` are the **approved training sequence in curator order** (the
order the boundary returned). "Next step" = the first reference whose `knowledgeId` is not in the
BA's completed set, in that order. Three outcomes:

- **`resolved`** — a next uncompleted approved step exists → a content-free `NextTrainingStep`
  pointer (`knowledgeId`, `sourceId`, `domain`, `language`, `stepIndex`, `totalSteps`).
- **`all_completed`** — every approved step is completed → no step (the BA has finished the
  available approved training).
- **`unavailable`** — the retrieval degraded (or, defensively, an empty `ok`) → no step + the
  P4.9 `DegradedContextState` safe fallback.

## 4. Scope decision (additive, server-side, pure)

- New pure module `server/src/runtime/context/nextTrainingStep.ts`:
  `resolveNextTrainingStep({ result, completedKnowledgeIds? }): NextTrainingStepResolution`.
- Reuses `safeFallbackFromResult` / `resolveSafeFallbackState` (P4.9) for the unavailable path —
  so the fail-closed guidance is identical to the rest of Phase 4.
- Tests: resolved / all-completed / unavailable, ordering, completed-filtering, counts, and
  end-to-end over a real adapter result + a degraded result.
- **No shared-type change** (all identifiers + `DegradedContextState` already exist).
- **No change to any prior-slice file**; the resolver is a new consumer of the retrieval result.

## 5. Compliance & invariants

- **Content-free**: a step is identifiers + position only — never knowledge body/summary text,
  none of the five `.com`-prohibited items. Michael/training is BA-facing; never wired to `.com`.
- **No fabrication**: the resolver only selects among approved references; it invents nothing.
- **Fail-closed**: a degraded/empty retrieval yields `unavailable` + safe fallback, never a
  guessed step.
- **Deterministic & pure**: selection is by retrieval order + set membership; no clock, no I/O,
  no persistence, no LLM, no Gateway.
- Context Manager remains the sole packet assembler; the resolver assembles no packet.

## 6. Stop conditions

- If resolving a step required knowledge body text (to be useful) → stop (content-free pointer
  only; enrichment is a later concern).
- If a "next step" had to be synthesized when none is approved → stop (fail-closed unavailable).
- If ordering required a sequence field absent from `KnowledgeReference` → stop (use retrieval
  order, which is the curator order the boundary returns).

**Verdict: READY.** Every input is already produced by P4.4–P4.9; P4.10 is a pure selection
resolver that composes them, additive and provable end-to-end.
