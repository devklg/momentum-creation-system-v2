# P4.7 — Freshness and Deprecation Guards — Readiness Review (Agent A)

## Momentum Creation System V2 · Phase 4 · Slice P4.7

Branch: `feature/phase-04-p4.7-freshness-deprecation-guards`
Base: `ec7eaae` (`main` after P4.6 / PR #83)
Mode: readiness review only.

---

## 1. Objective

Keep **stale, deprecated, superseded, or expired** approved knowledge out of the retrieval
path, fail-closed, while leaving fresh knowledge untouched. Today the retrieval adapter filters
by status → domain → language (P4.4/P4.6) but has **no time/lifecycle guard**: an approved item
that has since been deprecated, superseded, or aged out would still be returned.

## 2. Current retrieval pipeline (the integration seam)

`server/src/runtime/context/contextManagerRetrievalAdapter.ts`:
`listApprovedKnowledge(scope)` → **status/domain filter** → `resolveLanguageSelection` (P4.6) →
`maxResults` → validated `approved_knowledge_query.v1` result. P4.7 inserts a **freshness guard
between the status/domain filter and the language resolver** — freshness is language-independent,
so it belongs before language tiering.

## 3. What exists to build on

- `KnowledgeReference` (`packages/shared/src/runtime/knowledge.ts`) is minimal: `knowledgeId`,
  `domain`, `status` (`approved`|`active`), `language`, `translationStatus`, `sourceId`. It
  carries **no freshness/lifecycle/timestamp** — so freshness cannot be guarded today.
- `KnowledgeLifecycleStatus` already names `superseded` / `archived`, and P4.5A's intake models
  `deprecated`/`archived` chunk lifecycle — but none of that reaches the retrieval reference.
- The adapter is fail-closed and already degrades to `no_approved_match` when nothing matches —
  a natural terminal state when everything is filtered out for freshness.
- `createContextManagerRetrievalAdapter(provider)` takes no clock — freshness/expiry needs a
  time source, injected for determinism.

## 4. Scope decision

P4.7 is **additive and backward-compatible**:
- New OPTIONAL `freshness?: KnowledgeFreshness` on `KnowledgeReference` (a reference with no
  freshness metadata is treated as **current** — so all existing references/tests are
  unaffected). Absence ⇒ fresh; only **present-and-bad** metadata is guarded (fail-closed on
  presence, fail-open on absence, so the guard can never empty a pre-P4.7 corpus).
- New OPTIONAL `freshness?: KnowledgeFreshnessPolicy` on `ApprovedKnowledgeQueryRequest`.
- New shared types file `knowledge-freshness.ts` + one appended barrel export.
- New pure server guard `freshnessGuard.ts` (verdict: `fresh` | `deprecated` | `superseded` |
  `expired` | `stale`).
- Adapter gains an optional injected clock (`{ now?: () => Date }`, default `() => new Date()`)
  and applies the guard before language resolution. Freshness-excluded references are
  **non-matches** (dropped like out-of-domain), so no change to the exclusion/degrade enums is
  needed — an all-excluded result degrades to the existing `no_approved_match`.

## 5. Why reuse `no_approved_match` (no contract-enum change)

The `ApprovedKnowledgeExclusionReason` enum is candidate-only, and the degrade-reason enum has
no freshness member. Rather than widen either shared enum (a riskier contract change), P4.7
treats a stale/deprecated/superseded/expired reference as a **non-match** — identical to
out-of-domain. If that empties the result, the adapter already degrades to `no_approved_match`.
This keeps the P4.2 contract and its validator untouched.

## 6. Invariants to preserve

- Fail-closed: present-but-bad freshness always excludes; a degraded result carries zero
  references (unchanged).
- Determinism: the guard takes an injected `now`; no `Date.now()` inside pure logic.
- Backward compatibility: references without freshness metadata behave exactly as pre-P4.7; the
  adapter's new clock option is optional.
- Context Manager remains the sole packet assembler; the guard imports no store/Gateway/LLM.

## 7. Stop conditions

- If guarding freshness required widening a shared enum or changing the P4.2 validator's
  semantics → stop (the non-match approach avoids this).
- If absence-of-metadata had to fail *closed* (which would empty the current corpus) → stop and
  reconsider (P4.7 fails open on absence by design).

**Verdict: READY.** The seam is clear (pre-language, in the adapter), the change is additive
optional types + a pure guard + an optional clock, and it reuses the existing degrade path.
