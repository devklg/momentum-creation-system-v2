# P4.6 — Language-Aware Retrieval — Readiness Review (Agent A)

## Momentum Creation System V2 · Phase 4 · Slice P4.6

Branch: `feature/phase-04-p4.6-language-aware-retrieval`
Base: `0a7ff09` (`main` after P4.5A merge, PR #82)
Mode: readiness review only — no implementation in Agent A.

---

## 1. Objective

Activate the language-fallback path that P4.4/P4.5A deliberately left inert. Today the Context
Manager retrieval adapter returns **same-language only**; `allowLanguageFallback` is carried by
the `approved_knowledge_query.v1` contract but never exercised. P4.6 makes retrieval
language-aware: when same-language approved knowledge is unavailable and fallback is allowed,
select fallback-language (`en`↔`es`) approved knowledge following the **priority ladder**, and
**mark it honestly** so a machine translation can never be misrepresented as native.

## 2. The activation point (exact)

`server/src/runtime/context/contextManagerRetrievalAdapter.ts:105-107`:

```ts
// P4.4 retrieves same-language only; language FALLBACK selection is deferred to P4.6.
// The `allowLanguageFallback` flag is carried by the contract but not yet exercised.
const languageKept = statusDomainKept.filter((reference) => reference.language === request.language);
```

This single strict filter is what P4.6 replaces with a priority-ladder resolver.

## 3. The compliance ladder P4.6 must implement

From `runtime/CONTEXT_PACKET_SCHEMA.md:614-629` (locked):

1. Same-language approved knowledge
2. Human-reviewed translation
3. **Marked** machine translation (`translationStatus: 'machine_translation_marked'`, `machineTranslationUsed: true`)
4. Language-neutral template
5. Ask a clarifying question (→ at the retrieval layer this is a fail-closed `language_unavailable` degrade)

> **Non-negotiable:** "Machine translation may be included only when clearly marked. Machine
> translation must not be represented as approved bilingual knowledge."

## 4. The compliance trap to fix (packet-level marking)

`server/src/runtime/context/contextManager.ts:428-451` — `approvedKnowledgeFromReferences()`
**hardcodes** `language: 'en'` (×2) and `translationStatus: 'same_language'` on every assembled
`ApprovedKnowledgeContextItem`, ignoring the reference's real language/translation status.

If P4.6 activated fallback but left this hardcoding, a machine-translated fallback item would
land in the packet marked `same_language` — a direct violation of §14.3. Therefore P4.6 **must**
thread the delivered language + translation marking from the retrieval result into the packet.
The seam is `ContextReference` (in `contextManager.ts`), which today carries no
language/translationStatus.

## 5. Existing types/contracts P4.6 reuses (no redefinition)

- `packages/shared/src/runtime/language.ts` — `RuntimeLanguage` (`en`|`es`), `RuntimeTranslationStatus`, `RuntimeLanguageFallbackReason`, `RuntimeLanguageMetadata` (already has `fallbackLanguage?`, `fallbackReason?`).
- `packages/shared/src/runtime/knowledge.ts` — `KnowledgeReference` already carries per-item `language` **and** `translationStatus`.
- `packages/shared/src/runtime/knowledge-query.ts` — `allowLanguageFallback?`, `metadata.language: RuntimeLanguageMetadata`, degrade reason `language_unavailable`.
- `server/src/runtime/context/approvedKnowledgeQueryContract.ts` — `APPROVED_KNOWLEDGE_SUPPORTED_LANGUAGES = ['en','es']`; result validator does **not** constrain `reference.language` vs `request.language` (so fallback references pass validation) and only requires `metadata.language` to be a supported language.

None of the three additional translation-status enum values (`human_reviewed_translation`,
`machine_translation_marked`, `language_neutral_template`) are used anywhere in `server/src`
yet — P4.6 is their first exercise.

## 6. Fail-closed invariants that must hold

- A degraded result carries **no** references (enforced by `approvedKnowledgeQueryContract` + tests). Language unavailability must EMPTY the result, never substitute.
- Candidate/review-only knowledge is never returned, in any language.
- Degrade reasons must be recorded (`language_unavailable`).
- Static governance (`server/src/qa/__tests__/staticBoundary.test.ts` + the context `__tests__`) auto-scan the new module: no direct Mongo/Neo4j/Chroma imports; Context Manager remains sole assembler.

## 7. Exact safe scope for P4.6

**In scope:**
- New pure resolver `server/src/runtime/context/languageAwareRetrieval.ts` implementing the ladder over already status/domain-filtered references, producing selected references + `RuntimeLanguageMetadata`.
- Minimal edit to `contextManagerRetrievalAdapter.ts`: replace the strict `languageKept` filter with the resolver; build `metadata.language` from resolver output; thread delivered language + marking into `toContextReferences`.
- Minimal, backward-compatible edit to `contextManager.ts`: add optional `language?`/`translationStatus?` to `ContextReference`; have `approvedKnowledgeFromReferences()` honor them (defaulting to `en`/`same_language` when absent, so all existing behavior is unchanged).
- Unit tests (resolver ladder) + integration tests (fallback flows through adapter → packet with correct marking) + degraded/fail-closed tests.

**Out of scope (hard stops):** no persistence/Gateway/LLM/actual translation engine (P4.6 SELECTS and MARKS pre-existing references; it never translates text); no `.com`; no routes/`/api/runtime`; no candidate inclusion; no shared-type append needed (all types exist); no change to P4.2 validator semantics.

## 8. Stop conditions

- A real translation engine or LLM call would be needed → stop (P4.6 only selects/marks existing references).
- Threading marking into the packet would require breaking an existing P4.1–P4.5 test → stop and reconcile.
- The resolver would need to return a degraded result WITH references → stop (violates fail-closed).

**Verdict: READY.** All types exist; the activation point and the compliance trap are both
precisely located; the change is a bounded resolver plus two backward-compatible edits, fully
provable against the existing retrieval/packet path.
