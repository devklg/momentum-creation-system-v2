# P4.10 — Next Training Step Resolution — Final Verification (Agent E)

## Momentum Creation System V2 · Phase 4 · Slice P4.10 (final)

## Verdict: **PASS**

The capstone resolves the agent's next training step by **selecting** over the approved-knowledge
retrieval result — deterministically, content-free, and fail-closed to the P4.9 safe fallback. A
multi-agent adversarial review found one major (latent, caller-gated) hazard and one substantive
minor; both were fixed. All gates pass. **Phase 4 is complete.**

---

## Base & branch

- **Base:** `32bda0d` (`main` after P4.9 / PR #86).
- **Branch:** `feature/phase-04-p4.10-next-training-step`.

## Files changed (server-side, additive, pure)

- `server/src/runtime/context/nextTrainingStep.ts` — NEW: `resolveNextTrainingStep`.
- `server/src/runtime/context/index.ts` — export the P4.10 surface.
- `server/src/runtime/context/__tests__/nextTrainingStep.test.ts` — NEW tests.

**Not touched:** `packages/shared/**` (no shared change), the P4.2 contract/enums, `contextManager.ts`, `server/src/index.ts`, `apps/com/**`, any store/Gateway/LLM client, prior-slice files.

## Contract implemented

`resolveNextTrainingStep({ result, completedKnowledgeIds? })` selects the first uncompleted
approved reference over the **distinct** approved sequence (retrieval/curator order): `resolved`
(a content-free `NextTrainingStep` pointer), `all_completed`, or `unavailable` (degraded/empty →
the P4.9 `DegradedContextState` safe fallback). It selects, never generates. **Precondition:** the
result must be the complete sequence (no `maxResults` on the training-resolution query). Full
contract: `P4_10_NEXT_TRAINING_STEP_CONTRACT.md`.

## Multi-agent adversarial review — findings and resolution

A background review workflow ran **3 dimensions × verification skeptics (7 agents)** and
confirmed **4 findings (1 major, 1 minor, 2 nits)**. Actioned:

| # | Sev | Finding | Resolution |
|---|---|---|---|
| 1 | major | A `maxResults`-truncated result would masquerade as the full sequence (false `all_completed`, wrong `totalSteps`); the resolver can't detect truncation from a result alone | Established a **hard, documented precondition** (module header + contract): the training-resolution query must not set `maxResults`; the resolver treats `result.references` as the complete sequence. Pinned by a full-sequence progress test. (Threading a pre-truncation total would require a P4.2 contract change — deliberately avoided.) |
| 2 | minor | Duplicate `knowledgeId`s double-counted `completed`/`total` and made position array-based | The resolver now **de-duplicates by `knowledgeId`** (first occurrence wins) → counts and position are per distinct approved item; pinned by a `[a,a,b]` test |
| 3 | nit | Resolution is not a discriminated union | Left flat (simpler for consumers; the runtime invariant — `step` only on `resolved`, `safeFallback` only on `unavailable` — holds and is tested) |
| 4 | nit | `references[nextIndex]!` non-null assertion | Confirmed safe under `noUncheckedIndexedAccess` (guarded by the `=== -1` branch) — no change |

## Tests (12 P4.10 tests)

- Selection: first step when nothing completed; advances past completed in order; `all_completed`;
  unknown completed ids ignored; **de-dupes repeated `knowledgeId`s**; **full-sequence progress
  (precondition)**; content-free step (key-allowlist + no `summary/text/body/content`).
- Fail-closed: provider failure → `unavailable` + `knowledge_unavailable` fallback; language miss
  → `unavailable` + `translation_unavailable` fallback with "continue in Spanish".
- Static governance: no store/Gateway/LLM, no clock, no packet assembly, no generation.

## Gates run

| Gate | Result |
|---|---|
| `pnpm typecheck` (repo-wide, 5 projects) | ✅ pass |
| `pnpm build` (repo-wide) | ✅ pass |
| `pnpm --filter @momentum/server test` | ✅ **1229 passed / 97 files** (all prior slices remain green) |

## Remaining limitations

- The resolver is a pure function; wiring the Michael runtime to call it (with an un-truncated
  training query) and to source the BA's `completedKnowledgeIds` is downstream. The corpus is
  still not wired (P4.3 audit §8).
- Progress correctness depends on the caller honoring the no-`maxResults` precondition (documented
  and tested; a pre-truncation total would need a future P4.2 contract addition to enforce in
  code).

## Explicit statements

- Did **not** implement Phase 7 learning, outcome-based learning, or agent-approved knowledge.
- Did **not** add any LLM / dynamic generation / knowledge-body enrichment; did **not** persist or
  call the Gateway.
- Did **not** change any shared type, the P4.2 contract/enums, or any prior-slice file; did **not**
  bypass the Context Manager (it assembles no packet).
- The step is content-free (identifiers + position); a degraded retrieval yields `unavailable` +
  the P4.9 safe fallback, never a guessed step; never wired to `apps/com`.

## Phase 4 — complete

P4.1 charter · P4.2 query contract · P4.3 registry audit · P4.4 retrieval adapter · P4.5 packet
enrichment · **P4.5A intake/parsing/indexing · P4.6 language-aware retrieval · P4.7
freshness/deprecation guards · P4.8 retrieval observability · P4.9 safe fallback upgrade · P4.10
next training step resolution** — all merged/ready. The approved-knowledge retrieval path is
end-to-end: intake → parse/chunk/index → retrieve (approved-only, language-aware, freshness-guarded)
→ observe → fail-closed safe fallback → resolve the next step, all content-free and Context-Manager-mediated.
