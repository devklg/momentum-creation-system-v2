# P4.6 — Language-Aware Retrieval — Final Verification (Agent E)

## Momentum Creation System V2 · Phase 4 · Slice P4.6

## Verdict: **PASS**

Language fallback (`en`↔`es`) is activated in the Context Manager retrieval path, following the
locked priority ladder, with honest per-item translation marking carried all the way into the
assembled packet. A multi-agent adversarial review caught a critical compliance defect in the
first implementation; it was fixed and re-verified. All gates pass.

---

## Base & branch

- **Base:** `0a7ff09` (`main` after P4.5A / PR #82).
- **Branch:** `feature/phase-04-p4.6-language-aware-retrieval`.

## Files changed

**New**
- `server/src/runtime/context/languageAwareRetrieval.ts` — pure ladder resolver.
- `server/src/runtime/context/__tests__/languageAwareRetrieval.test.ts` — unit + adapter→packet integration.
- `server/src/runtime/context/__tests__/p46LanguageAwareGovernanceBoundary.test.ts` — targeted static governance.
- Reports: `P4_6_..._READINESS_REVIEW.md` (A), `P4_6_..._CONTRACT.md` (B), this file (E).

**Edited (same-component evolution; the P4.4 adapter's own comment deferred fallback to "P4.6")**
- `server/src/runtime/context/contextManagerRetrievalAdapter.ts` — uses the resolver; `toContextReferences` carries per-item language + translation status.
- `server/src/runtime/context/contextManager.ts` — `ContextReference` gains optional `language?`/`translationStatus?`; `approvedKnowledgeFromReferences()` honors them (defaulting to `en`/`same_language` when absent).

**Not touched:** `packages/shared/**` (all types already existed — no shared change, no append), `server/src/index.ts`, `apps/com/**`, any store/Gateway/LLM client, P4.1–P4.3/P4.5/P4.5A files.

## Contract implemented

The ladder is applied **within each language** (native → human-reviewed → MARKED machine →
language-neutral), preferring the primary language over the fallback language. Each returned
batch is a single homogeneous quality tier, so batch marking and each reference's own
`translationStatus` agree. `clarification_required` is never deliverable (fail-closed
ask-clarify tier), in the primary language as well as the fallback. Degraded selections carry
zero references. Full contract: `P4_6_LANGUAGE_AWARE_RETRIEVAL_CONTRACT.md`.

## Multi-agent adversarial review — findings and resolution

A background review workflow ran **4 review dimensions × verification skeptics (15 agents)**
over the diff. It surfaced **9 confirmed findings (3 critical/major, all one root cause)**; two
additional findings were correctly rejected by the skeptics as non-issues.

**Critical/major (FIXED):** the original Tier-1 selection matched on `reference.language ===
primary` only, ignoring `translationStatus`. Because `KnowledgeReference.language` and
`translationStatus` are independent, a **machine translation *into* the primary language**
(`language:'en', translationStatus:'machine_translation_marked'`) was selected by Tier 1 and
re-stamped `same_language` — laundering a machine translation into native approved knowledge in
`packet.approvedKnowledge`, a direct §14.3 violation. The same gap let a primary-language
`clarification_required` item bypass fail-closed. `toContextReferences` compounded it by
overwriting each item's real status with the single batch value.

**Fix:**
1. The resolver now applies the quality ladder **within each language** via `pickQualityTier`,
   so a same-language machine translation is delivered marked `machine_translation_marked`
   (only when no native/human same-language exists) and is **never** re-stamped native; a
   native + MT mix returns native only.
2. `clarification_required` is filtered out up front — fail-closed in both languages.
3. `toContextReferences` carries **per-item** `language` + `translationStatus` (defense in
   depth), so no marking can ever be laundered by a batch value.

**Rejected (correctly, by skeptics):** "human tier over-marks native as human_reviewed" — an
over-claim of review effort, never an under-claim of machine translation, so the invariant
holds; the per-item fix removes even that. The `staticBoundary` gap was real-but-informational
and is now closed by the new targeted governance test.

## Tests added (21 P4.6 tests)

- Resolver ladder: primary native wins; **primary-language MT is marked, never native
  (critical regression)**; native preferred over MT within a language; primary
  `clarification_required` fails closed; fallback disallowed → degrade; native / human /
  marked-machine / language-neutral fallback tiers each marked correctly; fallback prefers
  native > human > machine; fallback `clarification_required` fails closed; `otherLanguage`.
- Adapter → packet: same-language unchanged; **primary-language MT marked in the packet, never
  `same_language` (end-to-end critical proof)**; fallback MT marked in the packet with
  `languageFallbackUsed`; degrade fail-closed; `no_approved_match` vs `language_unavailable`.
- Static governance: no store/Gateway/LLM import or call; no packet assembly; resolver never
  mutates a reference (selects/marks only, never translates).

## Gates run

| Gate | Result |
|---|---|
| `pnpm typecheck` (repo-wide, 5 projects) | ✅ pass |
| `pnpm build` (repo-wide) | ✅ pass |
| `pnpm --filter @momentum/server test` | ✅ **1179 passed / 93 files** (all prior slices remain green) |

## Remaining limitations

- P4.6 **selects and marks**; it never translates text. Producing translated references (human
  or machine) is a corpus/producer concern (Phase 8 intake), not this slice.
- No persistence/Gateway/LLM; the corpus is still not wired (P4.3 audit §8) — behavior is proven
  against injected providers and the packet assembler.
- Packet-level `language.fallback` is caller-supplied from the result metadata (demonstrated in
  tests); wiring the orchestrator to set it is downstream.

## Explicit statements

- Did **not** implement Phase 7 learning, outcome-based learning, or agent-approved knowledge.
- Did **not** add any LLM / dynamic generation / translation engine (selection + marking only).
- Did **not** bypass the Context Manager — `buildContextPacket` remains the sole assembler.
- A machine translation is **always** marked and **never** represented as native, verified
  end-to-end into `packet.approvedKnowledge`.

## Recommendation for next slice

**Proceed to P4.7 — Freshness and Deprecation Guards.** P4.5A already models source/chunk
lifecycle (`deprecated`/`archived`) and P4.6 keeps the retrieval path fail-closed and honestly
marked — P4.7 can layer freshness/deprecation filtering onto the same resolver seam.
