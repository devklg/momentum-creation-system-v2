# P4.6 — Language-Aware Retrieval Contract (Agent B)

## Momentum Creation System V2 · Phase 4 · Slice P4.6

The official contract for how the Context Manager retrieval path selects and **marks**
approved knowledge across languages (`en`↔`es`). It activates the `allowLanguageFallback` flag
carried since P4.2 and honors the locked priority ladder in
`runtime/CONTEXT_PACKET_SCHEMA.md:614-629`.

### Load-bearing rule

> **P4.6 selects and marks; it never translates.** It chooses among *pre-existing* approved
> references and stamps an honest `RuntimeLanguageMetadata`. A machine translation is always
> marked (`machine_translation_marked` / `machineTranslationUsed: true`) and never presented as
> native. Unavailability is fail-closed (empty + `language_unavailable`), never substituted.

---

## 1. Inputs

The resolver operates on references that are **already** status-filtered (approved/active) and
domain-filtered by the adapter — it makes no store call and imports no client. It reads only
`request.language` and `request.allowLanguageFallback`.

## 2. The priority ladder (deterministic)

Given `primary = request.language` and `fallback = other(primary)`:

| Tier | Condition | Result `translationStatus` | Flags | `fallbackReason` |
|---|---|---|---|---|
| 1 · Same language | any reference with `language === primary` | `same_language` | mt=false, hr=true | — (no fallback) |
| — | *below tiers require `allowLanguageFallback === true`* | | | |
| 2 · Human/native fallback | fallback-lang refs with `translationStatus ∈ {same_language, human_reviewed_translation, not_required}` | `human_reviewed_translation` | mt=false, hr=true | `same_language_unavailable` |
| 3 · Marked machine | fallback-lang refs with `translationStatus === machine_translation_marked` | `machine_translation_marked` | **mt=true**, hr=false | `machine_translation_marked` |
| 4 · Language-neutral | fallback-lang refs with `translationStatus === language_neutral_template` | `language_neutral_template` | mt=false, hr=false | `language_neutral_template` |
| 5 · Unavailable | nothing usable (only `clarification_required`, or empty) | — | — | degrade `language_unavailable` |

**Highest available tier wins, and ONLY that tier's references are returned.** Tiers are never
mixed — this both respects the ladder (prefer human over machine) and prevents over-marking
human content as machine or under-marking machine content as human. `same_language` present ⇒
never fall back.

## 3. Marking is delivered-honest

- `metadata.language.language` = `primary` (what the caller asked for).
- `metadata.language.fallbackLanguage` = the delivered language when a fallback tier is used.
- `metadata.language.translationStatus` = the tier's status (see table) — the whole returned
  batch shares one honest marking.
- `machineTranslationUsed` is `true` **iff** the machine tier was selected.

## 4. Fail-closed (unchanged invariants)

- A degraded selection returns **zero** references and a `language_unavailable` degrade reason
  (empty-approved packet, safe fallback instruction downstream). Never a partial or substituted
  result.
- Candidate/review-only knowledge is never returned in any tier or language.
- `no_approved_match` (not `language_unavailable`) is still reported when there were **no**
  status/domain matches at all in any language.

## 5. Packet-level marking (the compliance thread)

The selected marking must reach the assembled packet so the ban on misrepresenting machine
translation holds end-to-end:

- `ContextReference` gains optional `language?` / `translationStatus?`.
- `toContextReferences()` sets each reference's `language` = its real `KnowledgeReference.language`
  and `translationStatus` = the **batch** `metadata.language.translationStatus`.
- `approvedKnowledgeFromReferences()` honors those fields (top-level `language`, and
  `retrieval.language` / `retrieval.translationStatus`), **defaulting to `en` / `same_language`
  only when absent** — so every existing caller and every P4.1–P4.5 test is byte-for-byte
  unchanged.

Result: a fallback machine-translated item appears in `packet.approvedKnowledge` with
`language: 'es'` and `translationStatus: 'machine_translation_marked'` — clearly marked, source
traceable.

## 6. Backward compatibility

- Same-language requests behave exactly as in P4.4 (tier 1).
- Requests without `allowLanguageFallback` degrade on same-language miss exactly as before.
- `ContextReference` additions are optional; omitting them reproduces prior packet output.

## 7. Non-goals

No translation engine, no LLM, no persistence, no `.com`, no routes, no new shared types, no
candidate inclusion, no change to the P4.2 validator's contract semantics.
