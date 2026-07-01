# P4.7 — Freshness and Deprecation Guards — Final Verification (Agent E)

## Momentum Creation System V2 · Phase 4 · Slice P4.7

## Verdict: **PASS**

A freshness/deprecation guard now keeps stale, deprecated, superseded, expired, and
not-yet-effective approved knowledge out of the Context Manager retrieval path — fail-closed on
bad metadata, fully backward compatible, and deterministic. A multi-agent adversarial review
found no critical/major issues; seven minor/nit hardening items were addressed. All gates pass.

---

## Base & branch

- **Base:** `ec7eaae` (`main` after P4.6 / PR #83).
- **Branch:** `feature/phase-04-p4.7-freshness-deprecation-guards`.

## Files changed

**Shared (additive/optional)**
- `packages/shared/src/runtime/knowledge-freshness.ts` — NEW: `KnowledgeFreshness`, `KnowledgeFreshnessLifecycle`, `KnowledgeFreshnessPolicy`, `KnowledgeFreshnessVerdict`.
- `packages/shared/src/runtime/knowledge.ts` — `KnowledgeReference` gains OPTIONAL `freshness?`.
- `packages/shared/src/runtime/knowledge-query.ts` — `ApprovedKnowledgeQueryRequest` gains OPTIONAL `freshness?` policy.
- `packages/shared/src/runtime/index.ts` — one appended barrel export.

**Server**
- `server/src/runtime/context/freshnessGuard.ts` — NEW pure guard (`evaluateFreshness`/`isFresh`/`filterFresh`).
- `server/src/runtime/context/contextManagerRetrievalAdapter.ts` — optional injected clock; freshness guard runs after status/domain filter, before language resolution; degrade keys off `freshKept.length`.
- `server/src/runtime/context/__tests__/freshnessGuard.test.ts` — NEW tests (unit + adapter integration + static governance).

**Not touched:** the P4.2 `approved_knowledge_query.v1` validator and its exclusion/degrade enums (unchanged — no enum widening), `server/src/index.ts`, `apps/com/**`, any store/Gateway/LLM client, prior-slice files.

## Contract implemented

Guard order (first match wins): no `freshness` ⇒ **fresh**; deprecated; superseded;
**unrecognized lifecycle ⇒ deprecated (fail-closed)**; expired (`now > expiresAt`);
not-yet-effective (`now < effectiveAt`); stale (`updatedAt` older than `maxAgeDays`); else fresh.
A guarded reference is a **non-match** (dropped like out-of-domain); all-guarded-out degrades to
the existing `no_approved_match`. The evaluation instant is `policy.asOf` when valid, else the
injected clock. Absence of metadata ⇒ current (never empties a pre-P4.7 corpus). Full contract:
`P4_7_FRESHNESS_DEPRECATION_GUARDS_CONTRACT.md`.

## Multi-agent adversarial review — findings and resolution

A background review workflow ran **3 dimensions × verification skeptics (10 agents)** over the
diff and confirmed **7 findings — zero critical/major**. All were addressed:

| # | Sev | Finding | Resolution |
|---|---|---|---|
| 1 | minor | `maxAgeDays` unvalidated: negative drops fresh refs, NaN disables staleness | `effectivePolicy` now treats a non-positive/non-finite `maxAgeDays` as **inert** (off) — a typo can never empty the corpus |
| 2 | minor | Unknown/corrupt `lifecycle` fails open (kept) | Present-but-unrecognized lifecycle now **fails closed** (dropped as deprecated) when deprecation exclusion is on |
| 3 | nit | Pure guard ignored `policy.asOf` (footgun for direct callers) | `asOf` resolution **centralized inside the guard** — every caller (adapter or direct) honors it identically |
| 4 | nit | Absent `updatedAt` under `maxAgeDays` treated fresh | Documented on the `maxAgeDays` field (intended: not a proof-of-recency gate) |
| 5 | nit | Boundary/empty-string/invalid-`asOf` paths untested | Added tests: `now == expiresAt`/`effectiveAt` ⇒ fresh; empty/whitespace timestamp ⇒ fail-closed; invalid `asOf` ⇒ clock fallback; unknown lifecycle; `maxAgeDays ≤ 0` inert |
| 6 | nit | Invalid `asOf` fell back to clock silently | Now handled uniformly in the guard (documented intent) + tested |
| 7 | nit | Request-level `freshness` bypasses P4.2 validator | Neutralized in the pure guard (clamp) rather than widening the frozen P4.2 contract |

No finding required changing the P4.2 contract or its enums.

## Tests (24 P4.7 tests)

- Guard: absent metadata ⇒ fresh; deprecated/superseded excluded (and opt-out); expired vs not-expired; not-yet-effective vs effective; `maxAgeDays` staleness on/off; unparseable **and** empty-string timestamp fail-closed; **exact boundary instant ⇒ fresh**; **unknown lifecycle ⇒ fail-closed**; **`maxAgeDays ≤ 0`/NaN inert**; **`asOf` override + invalid-`asOf` fallback**; priority order; `isFresh`/`filterFresh`.
- Adapter: drops deprecated/expired keeps fresh; all-guarded ⇒ `no_approved_match`; no-metadata refs unaffected (backward compat); policy opt-out; `asOf` deterministic override; invalid `asOf` ⇒ clock fallback.
- Static governance: no store/Gateway/LLM import; no ambient clock in pure logic; guard never mutates a reference.

## Gates run

| Gate | Result |
|---|---|
| `pnpm build:shared` | ✅ pass |
| `pnpm typecheck` (repo-wide, 5 projects) | ✅ pass |
| `pnpm build` (repo-wide) | ✅ pass |
| `pnpm --filter @momentum/server test` | ✅ **1199 passed / 94 files** (all prior slices remain green) |

## Remaining limitations

- No persistence/Gateway/LLM; freshness metadata is produced upstream (Phase 8 intake) — P4.7
  only consumes and guards it. The corpus is still not wired (P4.3 audit §8).
- `maxAgeDays` acts only on references that carry `updatedAt` (documented; opt-in proof-of-
  recency is a future flag if needed).

## Explicit statements

- Did **not** implement Phase 7 learning, outcome-based learning, or agent-approved knowledge.
- Did **not** add any LLM / dynamic generation / translation.
- Did **not** widen the P4.2 contract or its enums; did **not** bypass the Context Manager
  (`buildContextPacket` remains the sole assembler).
- Fail-closed on present-but-bad metadata; fail-open only on genuine absence (by design, so a
  pre-P4.7 corpus is never emptied).

## Recommendation for next slice

**Proceed to P4.8 — Knowledge Retrieval Observability.** The retrieval path now has four
filter stages (status → domain → freshness → language) with well-defined degrade reasons — a
natural surface for structured, compliant retrieval telemetry.
