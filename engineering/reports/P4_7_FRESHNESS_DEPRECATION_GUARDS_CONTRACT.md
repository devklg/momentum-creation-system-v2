# P4.7 — Freshness and Deprecation Guards Contract (Agent B)

## Momentum Creation System V2 · Phase 4 · Slice P4.7

The official contract for keeping stale/deprecated/superseded/expired approved knowledge out of
the Context Manager retrieval path.

### Load-bearing rule

> **Absence of freshness metadata means current; present-but-bad metadata is guarded
> fail-closed.** A guarded reference is a non-match (dropped like out-of-domain), never a
> substituted or partially-returned item. The guard evaluates against an injected clock — it is
> pure and deterministic; it never mutates a reference and never translates or fetches.

---

## 1. Data model (shared, optional, additive)

`KnowledgeFreshness` (optional on `KnowledgeReference`):

| Field | Meaning |
|---|---|
| `lifecycle?` | `current` \| `deprecated` \| `superseded` (default treated as `current`) |
| `effectiveAt?` | ISO — not yet effective if `now < effectiveAt` |
| `updatedAt?` | ISO — used with `maxAgeDays` for staleness |
| `expiresAt?` | ISO — expired if `now > expiresAt` |
| `supersededBy?` | `KnowledgeId` of the replacement (provenance for a superseded item) |

`KnowledgeFreshnessPolicy` (optional on `ApprovedKnowledgeQueryRequest`):

| Field | Default | Meaning |
|---|---|---|
| `asOf?` | adapter clock `now()` | evaluation instant |
| `excludeDeprecated?` | `true` | drop `lifecycle: 'deprecated'` |
| `excludeSuperseded?` | `true` | drop `lifecycle: 'superseded'` |
| `excludeExpired?` | `true` | drop `now > expiresAt` |
| `excludeNotYetEffective?` | `true` | drop `now < effectiveAt` |
| `maxAgeDays?` | — (off) | drop when `updatedAt` older than N days |

## 2. Verdict function (pure)

`evaluateFreshness(reference, policy, now): FreshnessVerdict` where verdict ∈ `fresh` |
`deprecated` | `superseded` | `expired` | `not_yet_effective` | `stale`. Evaluation order
(first match wins):

1. no `freshness` metadata ⇒ **`fresh`** (absence = current; never empties a pre-P4.7 corpus).
2. `lifecycle === 'deprecated'` and `excludeDeprecated` ⇒ `deprecated`.
3. `lifecycle === 'superseded'` and `excludeSuperseded` ⇒ `superseded`.
4. `expiresAt` present, `now > expiresAt`, `excludeExpired` ⇒ `expired`.
5. `effectiveAt` present, `now < effectiveAt`, `excludeNotYetEffective` ⇒ `not_yet_effective`.
6. `maxAgeDays` set, `updatedAt` present, `now - updatedAt > maxAgeDays` ⇒ `stale`.
7. otherwise ⇒ `fresh`.

`isFresh(...)` = verdict === `fresh`. Only fresh references pass. Malformed/unparseable
timestamps are treated conservatively as **not fresh** for the corresponding check (fail-closed
on bad data), except that a wholly-absent `freshness` object is fresh.

## 3. Integration (retrieval pipeline)

The guard runs **after status/domain filtering and before language resolution** (freshness is
language-independent):

```
listApprovedKnowledge → status/domain filter → FRESHNESS GUARD (P4.7) → resolveLanguageSelection (P4.6) → maxResults → validated result
```

A guarded-out reference is a **non-match**, indistinguishable from out-of-domain — it is dropped,
not recorded as a candidate exclusion. If the guard (with the language resolver) leaves nothing,
the adapter degrades to the existing `no_approved_match` (fail-closed). The
`approved_knowledge_query.v1` contract, its exclusion-reason enum, and its degrade-reason enum
are **unchanged**.

## 4. Clock injection

`createContextManagerRetrievalAdapter(provider, options?)` gains an optional
`options.now?: () => Date` (default `() => new Date()`). The request's `freshness.asOf`, when
present, overrides the clock for that call. Pure guard logic receives a concrete `Date` — no
ambient clock reads — so tests are deterministic.

## 5. Backward compatibility

- References without `freshness` ⇒ always fresh ⇒ pre-P4.7 behavior byte-for-byte.
- `freshness` policy absent ⇒ safe defaults (exclude deprecated/superseded/expired/not-yet-
  effective); with no freshness metadata on references this changes nothing.
- The adapter's `options` argument is optional; every existing caller compiles and behaves
  identically.

## 6. Non-goals

No persistence, no Gateway, no LLM, no translation, no `.com`, no routes, no widening of the
P4.2 contract enums, no change to producer-side intake (P4.5A already models chunk
deprecation/archival independently).
