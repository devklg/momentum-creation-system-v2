# P4.8 — Knowledge Retrieval Observability Contract (Agent B)

## Momentum Creation System V2 · Phase 4 · Slice P4.8

The official contract for the retrieval observability record and how it is emitted.

### Load-bearing rule

> **The observability record is content-free and opt-in.** It carries identifiers, domains,
> objective, stage counts, exclusion reasons, and the honest language marking — **never**
> knowledge body/summary text and **none** of the five `.com`-prohibited items. It is built and
> emitted only when a caller supplies a sink; with no sink, nothing is built (zero overhead) and
> behavior is byte-for-byte pre-P4.8. It is emitted on **every** outcome — ok and every degrade.

---

## 1. Record shape (`knowledge_retrieval_observability.v1`)

```
RetrievalObservabilityRecord {
  schemaVersion: 'knowledge_retrieval_observability.v1'
  observedAt?: string                     // ISO, from the adapter's injected clock
  scope: { tenantId, teamId?, baId?, requestId?, sessionId? }   // identity only
  objective: string
  domains: KnowledgeDomain[]
  requestedLanguage: RuntimeLanguage
  allowLanguageFallback: boolean
  outcome: 'ok' | 'degraded'
  degradeReasons?: ApprovedKnowledgeQueryDegradeReason[]
  stageCounts: { raw, candidateExcluded, statusDomainKept, freshKept, selected }
  freshnessExclusions: Partial<Record<Exclude<KnowledgeFreshnessVerdict,'fresh'>, number>>
  language: RuntimeLanguageMetadata        // delivered marking (fallback + MT visible)
  fallbackUsed: boolean
  machineTranslationUsed: boolean
  selectedKnowledgeIds: KnowledgeId[]
  candidateExcludedSourceIds: SourceId[]
}
```

Every field is a count, an identifier, an enum, or the language marking. There is no field that
can carry knowledge text.

## 2. Stage counts (the funnel)

`raw` (returned by the boundary) → `candidateExcluded` (defensive non-approved drop) →
`statusDomainKept` → `freshKept` (P4.7) → `selected` (returned after language resolution +
`maxResults`). These reconstruct exactly where references were lost, per stage.

## 3. Freshness exclusions

A tally by verdict (`deprecated` / `superseded` / `expired` / `not_yet_effective` / `stale`),
produced by `classifyFreshness` in the same pass that yields `freshKept`. Absent verdicts are
omitted (a `Partial` record). This is what makes "why did retrieval come back thin?" answerable.

## 4. Language marking is surfaced (compliance-observable)

`language` (the P4.6 `RuntimeLanguageMetadata`), `fallbackUsed`, and `machineTranslationUsed`
are recorded verbatim, so a fallback or machine-translation event is *observable* — never
hidden. This complements P4.6's guarantee that MT is always marked in the packet.

## 5. Emission

`createContextManagerRetrievalAdapter(provider, options?)` gains an optional
`options.onRetrievalObservability?: (record) => void`:
- **absent** ⇒ no record is built or emitted; zero overhead; behavior identical to pre-P4.8;
- **present** ⇒ the adapter builds a record from the facts it already computed and invokes the
  sink exactly once per `retrieveApprovedKnowledge` call, on **every** outcome:
  - provider throw ⇒ `outcome: 'degraded'`, `degradeReasons: ['knowledge_unavailable']`, all
    counts zero;
  - language/no-match degrade ⇒ `outcome: 'degraded'` with the resolved reason;
  - success ⇒ `outcome: 'ok'` with the selected ids.

A sink exception must not corrupt retrieval: the adapter isolates the sink call (a throwing sink
does not change the returned result).

## 6. Purity & determinism

`buildRetrievalObservabilityRecord` is pure — it takes `observedAt` as an argument (the adapter
supplies it from `options.now`), reads no ambient clock, and performs no I/O. Tests inject a
fixed clock for a deterministic `observedAt`.

## 7. Non-goals

No persistence, no Gateway, no LLM, no `.com`, no routes, no real sink implementation (Phase 8),
no change to the P4.2 contract/enums, no shared-type change (the record is a server-side
emission shape until a consumer lands).
