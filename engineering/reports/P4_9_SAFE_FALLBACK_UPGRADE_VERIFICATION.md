# P4.9 — Approved-Knowledge Safe Fallback Upgrade — Final Verification (Agent E)

## Momentum Creation System V2 · Phase 4 · Slice P4.9

## Verdict: **PASS**

A fail-closed retrieval degrade now produces a **reason-specific, safe, compliant**
`DegradedContextState` instead of one generic instruction — the agent is told *why* retrieval
degraded and *what is safe to do*, always without fabricating knowledge or presenting a machine
translation as approved. A multi-agent adversarial review **proved the fallback strings
content-free**, found no critical/major issues, and its maintainability/pipeline findings were
fixed. All gates pass.

---

## Base & branch

- **Base:** `89a4cf6` (`main` after P4.8 / PR #85).
- **Branch:** `feature/phase-04-p4.9-safe-fallback-upgrade`.

## Files changed (server-side, additive, pure)

- `server/src/runtime/context/safeFallback.ts` — NEW: `resolveSafeFallbackState` (retrieval reason → packet `DegradedContextState`) + `safeFallbackFromResult` bridge.
- `server/src/runtime/context/index.ts` — export the P4.9 surface.
- `server/src/runtime/context/__tests__/safeFallback.test.ts` — NEW tests.

**Not touched:** `contextManager.ts` / `defaultDegradedState()` (remains the last-resort default), `packages/shared/**` (no shared change — both reason unions and `DegradedContextState` already exist), the P4.2 contract/enums, `server/src/index.ts`, `apps/com/**`, any store/Gateway/LLM client.

## Contract implemented

The resolver maps each `ApprovedKnowledgeQueryDegradeReason` to a valid `DegradedContextReason`
+ a specific safe guidance fragment (`knowledge_unavailable`/`no_approved_match`/`scope_empty`
→ `knowledge_unavailable`; `language_unavailable` → `translation_unavailable`;
`retrieval_timeout` → `retrieval_timeout`), assembles the base directive + de-duplicated
fragments in deterministic priority order, and always misses `approvedKnowledge`. Empty/unknown
input degrades safely to `knowledge_unavailable` + the base directive. The degraded packet still
carries **empty** approved knowledge — the upgrade only changes the instruction/reasons. Full
contract: `P4_9_SAFE_FALLBACK_UPGRADE_CONTRACT.md`.

## Multi-agent adversarial review — findings and resolution

A background review workflow ran **3 dimensions × verification skeptics (12 agents)** and
confirmed **9 findings — zero critical/major**. Compliance came back as a proven PASS (every
string content-free; language-name interpolation is a closed `en`/`es` union → fixed literals,
injection-impossible; the degraded packet structurally cannot re-introduce knowledge). Actioned:

| # | Sev | Finding | Resolution |
|---|---|---|---|
| 1 | minor | `REASON_ORDER` was a hand-maintained parallel list — a new degrade reason could be silently dropped | Replaced with a `Record<ApprovedKnowledgeQueryDegradeReason, number>` priority map — a new union member is now a **compile error** until ordered |
| 2 | nit | Redundant `seen` Set in the dedup filter | Removed — the priority-map keys are unique, so `filter(includes)` suffices |
| 3 | minor | Bridge-derived `fallbackLanguage` was always undefined, so the "offer the other language" guidance was dead in the real pipeline | The bridge now concretely offers `otherLanguage(requested)` on a `language_unavailable` degrade (which by definition means the other supported language had content); pinned by an updated integration test asserting "continue in Spanish" |
| 4–9 | minor/nit | Compliance PASS confirmations; validator doesn't check `reasons` membership (out-of-scope, noted) | No change (resolver constructs only valid reasons; boundary enforcement is a possible future slice) |

## Tests (10 P4.9 tests)

- Resolver: base directive always present; `knowledge_unavailable`/`scope_empty`/`no_approved_match` → `knowledge_unavailable`; `language_unavailable` → `translation_unavailable` with concrete/`rephrase` offer + "never present a machine translation as approved"; `retrieval_timeout`; multi-reason combine + dedupe + deterministic order; empty input fail-safe.
- Bridge + end-to-end: `ok` → `null`; a `language_unavailable` degrade → validated degraded packet with `translation_unavailable`, "continue in Spanish", **empty approvedKnowledge**; a provider-failure degrade → `knowledge_unavailable` packet.
- Static governance: no store/Gateway/LLM, no clock, assembles no packet.

## Gates run

| Gate | Result |
|---|---|
| `pnpm typecheck` (repo-wide, 5 projects) | ✅ pass |
| `pnpm build` (repo-wide) | ✅ pass |
| `pnpm --filter @momentum/server test` | ✅ **1219 passed / 96 files** (all prior slices remain green) |

## Remaining limitations

- The resolver is opt-in via the existing `input.degraded` seam; wiring the orchestrator to call
  `safeFallbackFromResult` on every degraded turn is downstream (the corpus is still not wired,
  P4.3 audit §8).
- `validateContextPacket` still does not check `degraded.reasons` membership; the reason-validity
  guarantee rests on resolver construction (a possible future boundary-hardening slice).

## Explicit statements

- Did **not** implement Phase 7 learning, outcome-based learning, or agent-approved knowledge.
- Did **not** add any LLM / dynamic generation / translation; did **not** persist or call the
  Gateway.
- Did **not** change `defaultDegradedState()`, the P4.2 contract/enums, or any shared type; did
  **not** bypass the Context Manager (it assembles no packet).
- A degraded packet still carries empty approved knowledge; every fallback string is content-free
  and forbids fabrication and passing off machine translation as approved.

## Recommendation for next slice

**Proceed to P4.10 — Next Training Step Resolution** (the final Phase 4 slice). With retrieval,
language, freshness, observability, and safe fallback all in place, P4.10 can resolve the
agent's next training step over the approved-knowledge path with a fully instrumented,
fail-closed foundation.
