# P4.11 — Retrieval Canary — Readiness Review (Agent A)

## Momentum Creation System V2 · Phase 4 · Slice P4.11

Current HEAD: `2e34723` (branch base = `main` after P4.10 / PR #87)
Branch: `feature/phase-04-p4.11-retrieval-canary`
Mode: readiness review only — no implementation in Agent A.

---

## 1. Objective

Run and document a controlled, deterministic, test-only **retrieval canary** proving the runtime
path moves safely from **degraded/empty approved knowledge → approved-knowledge-backed response
selection** without violating any Phase 4 boundary. Evidence slice; not a redesign, not a
production-enablement slice.

## 2. Dependency gate — P4.10 present

- **P4.1–P4.5** reports present under `engineering/reports/SPRINT_004_*` and P4.2 code.
- **P4.5A** present: `server/src/runtime/knowledge/intake/**` + `P4_5A_*` reports.
- **P4.6–P4.10** present: `languageAwareRetrieval.ts`, `freshnessGuard.ts`,
  `retrievalObservability.ts`, `safeFallback.ts`, `nextTrainingStep.ts` + `P4_6..P4_10_*` reports.
- P4.10 `resolveNextTrainingStep` is present and merged. **Gate satisfied — proceed** (no blocker).

## 3. Current retrieval path (summary)

`createContextManagerRetrievalAdapter(provider, { now?, onRetrievalObservability? })`:
`listApprovedKnowledge(scope)` → status/domain filter (candidate defensively excluded) →
**freshness guard** (P4.7: deprecated/superseded/expired/not-yet-effective/stale dropped) →
**language resolution** (P4.6: same-language → human/native fallback → MARKED machine → neutral;
else `language_unavailable`) → `maxResults` → validated `approved_knowledge_query.v1` result.
`toContextReferences(result)` maps approved refs (per-item language + honest translation status)
into `ContextReference[]`; a degraded result maps to `[]`.

## 4. Current degraded/fallback path (summary)

`buildContextPacket` assembles the sole `context_packet.v1`. A degraded retrieval → empty
`approvedKnowledge` + `packetStatus: 'degraded'`. **P4.9** `safeFallbackFromResult(result)` maps
the retrieval degrade reason(s) into a reason-specific `DegradedContextState` (offers the other
language on a language miss; never presents a machine translation as approved; never fabricates).

## 5. Current next-training-step selection (summary)

**P4.10** `resolveNextTrainingStep({ result, completedKnowledgeIds? })` selects the first
uncompleted approved reference over the distinct approved sequence (`resolved` / `all_completed`
/ `unavailable` + P4.9 safe fallback). Content-free step pointer; fail-closed.

## 6. Michael runtime selection (the consumer the canary drives)

- `consumeContextPacket({ expectedAgentKey, packet })` (`orchestration/consumption.ts`) — pure;
  runs `validateContextPacket`, enforces Context-Manager assembler, agent/objective match, and
  candidate-exclusion, and returns `{ decision, packetStatus, packet, issues }`. **No retrieval,
  no assembly, no persistence.**
- `selectMichaelResponseCatalogEntry(request)` (`orchestration/michaelResponseCatalogSelector.ts`)
  — pure; maps `(scenarioFamily, responseType, language, intent)` to a pre-authored catalog key /
  fixture (`michael_next_training_step_{en|es}`, `michael_clarification_question_*`,
  `michael_safe_fallback_degraded_*`, `michael_safe_close_failed_*`). Returned by reference; no
  generation.

Both are pure, synchronous, and free of store/Gateway/LLM access — ideal for a deterministic
canary.

## 7. Canary prerequisites (all satisfied)

- Deterministic fixtures via injected providers/sinks/clocks (already the test convention across
  P4.4–P4.10).
- No corpus needed — the provider is injected in-test.
- The full wiring `retrieve → toContextReferences → buildContextPacket → consumeContextPacket →
  selectMichaelResponseCatalogEntry` composes only pure functions.

## 8. Safe canary scope

- New test-only files under `server/src/runtime/context/__tests__/`:
  `retrievalCanary.test.ts` (Scenarios 1–4) + `retrievalCanaryGovernanceBoundary.test.ts` (static
  boundary tripwires).
- Imports the real retrieval + P4.9/P4.10 + orchestration selection functions (read-only).
- Emits only pass/fail assertions, content-free counts, catalog keys, approved reference ids,
  degrade-reason enums, and language-marking enums.
- **No production code changes**, no routes, no `.com`, no persistence, no LLM.

## 9. Blocked conditions (none triggered)

- P4.10 missing → would block. **Not the case.**
- Requiring a real store/Gateway/LLM to run the canary → would block. **Not the case** (injected
  providers).
- Needing to persist a Context Packet/response/trace to observe behavior → would block. **Not the
  case** (assertions read in-memory returns).

**Verdict: READY.** All dependencies present; the canary composes existing pure functions with
deterministic fixtures and emits only content-free evidence.
