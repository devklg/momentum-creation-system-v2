# P4.8 — Knowledge Retrieval Observability — Readiness Review (Agent A)

## Momentum Creation System V2 · Phase 4 · Slice P4.8

Branch: `feature/phase-04-p4.8-retrieval-observability`
Base: `4281bbf` (`main` after P4.7 / PR #84)
Mode: readiness review only.

---

## 1. Objective

Emit a **structured, compliant, content-free observability record** for each approved-knowledge
retrieval — what was asked, how many candidates survived each filter stage, what was excluded
and why, the outcome and degrade reasons, and the honest language/translation marking — so the
retrieval path is observable without leaking knowledge content or any `.com`-prohibited data,
and without any persistence.

## 2. Current retrieval pipeline (fully built out over P4.4–P4.7)

`server/src/runtime/context/contextManagerRetrievalAdapter.ts`:
`listApprovedKnowledge(scope)` → **status/domain** filter (candidate excluded) → **freshness**
guard (P4.7) → **language** resolution (P4.6) → `maxResults` → validated
`approved_knowledge_query.v1` result. Terminal states: `ok`, or `degraded` with
`knowledge_unavailable` / `no_approved_match` / `language_unavailable`.

The adapter already computes every fact worth observing (raw count, candidate exclusions,
status/domain-kept, fresh-kept, selected, language metadata, degrade reasons) — P4.8 assembles
those into a record and emits it. Nothing new needs to be *derived*; it needs to be *surfaced*.

## 3. What exists to build on

- The P4.6 result metadata carries the honest `RuntimeLanguageMetadata` (fallback + MT marking).
- The P4.7 guard classifies references (fresh vs deprecated/superseded/expired/…); a small
  `classifyFreshness` addition yields the exclusion tally cheaply in the same pass that produces
  `freshKept`.
- `retrievalAudit` inside `context_packet.v1` already models content-free traceability
  (`includedKnowledgeIds`, `excludedSourceIds`) — P4.8's record follows the same content-free
  discipline for the *retrieval* step (the packet audit is the *assembly* step).

## 4. Scope decision (additive, inert, opt-in, zero-overhead-by-default)

- New server module `retrievalObservability.ts`: a `RetrievalObservabilityRecord` type +
  `buildRetrievalObservabilityRecord(...)` — a **pure** assembler over facts the adapter already
  has (no clock, no I/O). `observedAt` is passed in (from the adapter's injected clock) so the
  builder stays deterministic.
- The adapter gains an OPTIONAL `onRetrievalObservability?: (record) => void` sink in its
  options. **Default undefined ⇒ nothing is built or emitted** (zero overhead, byte-for-byte
  backward compatible). When present, the adapter builds and emits a record on **every** outcome
  (including provider-failure and degrade paths, so misses are observable).
- A small `classifyFreshness` helper in `freshnessGuard.ts` (returns `{ fresh, excluded-tally }`)
  replaces the adapter's `filterFresh` call so the freshness exclusion tally is available in the
  same pass. `filterFresh` remains exported/unchanged for other callers.
- The record type lives **server-side** (not shared): it is the adapter's emission shape for a
  future Phase 8 sink, not a store-agnostic CM↔Knowledge-Core contract. It can be promoted to
  `@momentum/shared` when a consumer (e.g. an admin telemetry surface) lands.

## 5. Compliance discipline for the record

The record is **content-free**: identifiers (scope, `knowledgeId`s, `sourceId`s), domains,
objective, counts, reasons, and language marking — **never** knowledge body/summary text and
**none** of the five `.com`-prohibited items. Observability is BA/admin-facing and is **never**
wired to `apps/com`. The honest language marking (fallback + `machineTranslationUsed`) is
surfaced so a machine-translation or fallback event is *observable*, consistent with P4.6.

## 6. Invariants to preserve

- Zero behavior change when no sink is provided (opt-in).
- No persistence, no Gateway, no LLM; the sink is a caller-supplied callback (a Phase 8 concern
  to wire a real sink).
- Emit on all outcomes, including fail-closed degrades.
- Deterministic builder (time injected); the guard/adapter freshness behavior is unchanged.
- Context Manager remains the sole packet assembler; observability records the retrieval step
  only and assembles no packet.

## 7. Stop conditions

- If emitting observability required persisting anything or calling the Gateway → stop (P4.8
  only *builds and hands off* a record via an injected callback).
- If the record had to include knowledge content to be useful → stop (content-free is the rule).
- If surfacing counts required changing the P4.2 contract or its enums → stop (it does not).

**Verdict: READY.** Every observable fact is already computed in the adapter; P4.8 is a pure
record assembler + an opt-in sink + a cheap freshness-tally helper, all additive and inert.
