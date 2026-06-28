# S3.2 Route Safety Preconditions Review

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.2 Route Proposal — route safety preconditions + implementation-blocker analysis (WHAT must be true before any future minimal Michael route is implemented)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no builds/LLMs/DB run; no route/contract/middleware/scanner change implemented)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent D (route safety preconditions / implementation-blocker review)
- Branch: `planning/s3.2-michael-route-proposal`
- Inputs (read, not edited):
  - `engineering/reports/S3_1_PRE_ACTIVATION_CONDITIONS_REVIEW.md` (Agent C conditions sequencing)
  - `engineering/reports/SPRINT_003_S3_1_ACTIVATION_PLANNING_CHARTER.md` (Agent E ratified charter)
  - `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts` (S2.20 canonical entrypoint)
  - `server/src/runtime/orchestration/michaelResponseSelectionRequest.ts` (S2.19 derivation)
  - `server/src/runtime/orchestration/michaelResponseCatalogSelector.ts` (S2.18 selector)
  - `server/src/runtime/orchestration/michaelResponseContract.ts` (response contract validator)
  - `server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts` (adapter contract)
  - `server/src/runtime/fixtures/michaelRuntimeResponseHarness.ts` + `michaelRuntimeResponseScenarios.ts` (S2.13 test-only harness)

> This is a planning/governance review. It approves nothing, mounts nothing, persists
> nothing, generates nothing, and changes no production code. It defines the safety
> preconditions and implementation blockers that must be satisfied before any future
> minimal Michael runtime route may be implemented, and concludes whether S3.3
> pre-implementation hardening is a prerequisite for a fixtures-only, facade-routed S3.4.
> It is a proposal input to the final S3.2 route-proposal report (owned by Agent E); it
> is not that report and it grants no approval.

## Executive Summary

The future minimal Michael route — if Kevin ever approves one (S3.4) — must be a thin,
inert consumer of the Sprint-2-locked canonical chain and nothing else. This review
confirms the single canonical runtime path the route must call, reaffirms the S2.13
harness as test-only and off the activation path, restates the fixtures-only response
and disabled-persistence policies as standing constraints, and analyzes whether the two
open hardening conditions (ES content scanner; contract-level `failed → safe_close`
strictness) block a fixtures-only, facade-routed first implementation.

**Headline conclusion: S3.3 pre-implementation hardening is NOT a prerequisite for a
fixtures-only, facade-routed S3.4.** Both hardening conditions are gated by *live*
behaviors a fixtures-only, adapter/facade-routed route does not exercise: the ES scanner
is required only before live (non-fixture) Spanish generation, and contract-level
`failed → safe_close` strictness is required only before a non-adapter contract consumer
is introduced. A minimal route that returns pre-authored fixtures by reference through
the S2.20 facade reaches neither trigger. S3.3 therefore stays conditional — included
only if Kevin's chosen activation scope actually requires a live behavior — consistent
with the charter's anti-"inert-hardening-theater" stance (§19).

This review implements none of this and approves no route, persistence, LLM, scanner, or
contract change.

---

## Canonical Runtime Path

The future route must call **only** the single canonical resolution chain locked in
Sprint 2. In Sprint-2 surface terms:

> **Context Manager → Runtime Turn → Michael Adapter Contract → Selection Request
> Derivation → Catalog Selector → Response Catalog → Inert Resolution Facade → Redacted
> Trace.**

Concretely, and verified on disk: the Context-Manager-assembled `context_packet.v1`
→ Runtime Turn → Michael adapter contract (`michaelRuntimeAdapterContract.ts`) →
selection-request derivation (`michaelResponseSelectionRequest.ts`, S2.19) → catalog
selector (`michaelResponseCatalogSelector.ts`, S2.18) → response catalog (S2.17,
verbatim fixtures on `michaelResponseContract.ts`) → inert resolution facade
(`michaelRuntimeResolutionFacade.ts`, S2.20) → redacted trace (`buildTrace`).

**Practically, the route is a one-call consumer of the S2.20 facade.** The facade is the
composition point: `resolveMichaelRuntimeTurnResponse(input)` (the primary export,
`michaelRuntimeResolutionFacade.ts:160-164`) aliases
`resolveMichaelRuntimeTurnResponseFromAdapterInput`, which composes S2.19 derivation
(`deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput`) → S2.18 selection
(`selectMichaelResponseCatalogEntry`) → contract validation
(`validateMichaelResponseContract`) and returns the fixture **by reference** with the
inert redacted trace (`:80-122`). The route must not re-implement, fork, or shortcut any
link of this chain; it constructs the adapter-contract input from the
session-scoped/Context-Manager-assembled turn, calls the facade, and returns the facade
result. Verified facade safety properties the route inherits and must not weaken:

- Returns by reference; **never clones or mutates** the fixture (`:118`).
- **Never throws**; returns deterministic `{ ok: false, issues }` on any failure
  (`:129-154`).
- Builds the trace **explicitly from controlled metadata only — never spreads** the
  response, so it cannot leak session/turn/correlation IDs or generated text (`:53-73`).
- Trace carries the standing literals `persistence: 'disabled'` and
  `agentResponseGenerated: false` (`:71-72`).

No alternate resolution surface (no direct selector call, no direct contract call, no
direct harness call, no `/api/runtime/*` revival) may be wired into the route. Any future
activation consumes this chain and no other.

## S2.13 Harness

The S2.13 scenario-driven fixture harness (`fixtures/michaelRuntimeResponseHarness.ts` +
`fixtures/michaelRuntimeResponseScenarios.ts`) carries forward unchanged from the S3.1
charter (§7) as a standing constraint:

1. **Retained, test-only.** Per Kevin's recorded S2.21-close ruling it is KEPT (not
   scheduled for retirement) and documented as a test-only harness. Its only consumers
   are `__tests__` files plus append-only barrel re-exports — zero route, UI, service, or
   persistence consumers.
2. **Not the activation path.** It resolves a response via a single direct
   `scenarioName → responseFixtureKey` map that **bypasses** the governance-bearing
   adapter/derivation/selector/facade links. It is a test convenience, not the canonical
   chain.
3. **The future route must NOT import it.** Because it bypasses the governance chain, the
   harness must never appear on an activation path. The S3.4 route must import only the
   S2.20 facade (and its composed chain), never `michaelRuntimeResponseHarness` or
   `michaelRuntimeResponseScenarios`. This is a hard, testable implementation blocker: a
   route-file import of either harness module is an automatic fail.

## Response Policy

Carried from charter §12 as a standing constraint on the first implementation:

1. **Fixtures-only by default.** Responses come from the response catalog via the S2.18
   selector + contract validator, returned by reference through the S2.20 facade. No
   text-generation engine on the path.
2. **`agentResponseGenerated: false`** remains the literal value at every result
   boundary — set in `buildTrace` (`michaelRuntimeResolutionFacade.ts:72`) and not
   overridable by the route.
3. **No dynamic generation.** The route produces no text; it selects and returns a
   pre-authored fixture.
4. **No LLM.** No language-model call may enter the Michael path.
5. **No Anthropic / ScriptMaker / Ivory.** None of the wired-dormant generation surfaces
   may be invoked from, or coupled to, the route. Flipping `agentResponseGenerated` to
   `true` or introducing any of these requires a distinct, separately-recorded Kevin
   approval covering generation scope and the ES content-scanner precondition.

## Persistence Policy

Carried from charter §13 as a standing constraint:

1. **Persistence disabled.** Every persistence discriminant remains the literal
   `'disabled'`; the trace's `persistence` field is hardcoded `'disabled'` in
   `buildTrace` (`michaelRuntimeResolutionFacade.ts:71`). Results are returned in memory
   only.
2. **No persistence of any artifact** — no events, outcomes, Guided Actions, envelopes,
   responses, sessions, transcripts, or logs written by the route.
3. **No triple-stack writes** from the Michael path unless separately approved. If
   persistence is ever approved it must write through `tripleStackWrite()` (MongoDB +
   Neo4j + ChromaDB via Universal Gateway V2) and honor the GraphRAG schema contract — a
   separate, separately-approved undertaking, not authorized here and not part of a
   fixtures-only first route.

## Preconditions — Is S3.3 Hardening Required Before S3.4 Implementation?

This section analyzes each open hardening condition against a fixtures-only,
facade-routed first implementation and reaches a single conclusion.

### 1. ES content scanner

**Required before live Spanish generation; NOT required for a fixtures-only route.**
The prohibited-text patterns and the safe-close substantive-guidance guard in
`michaelResponseContract.ts` are English-lexicon-only (numeric/currency triggers are
language-agnostic; Spanish lexical equivalents are absent). On the inert fixtures-only
path **no text is generated** — the facade returns pre-authored fixtures by reference,
and every `es` fixture is still run through `validateMichaelResponseContract`. ES safety
on this path therefore rests on fixture-authoring discipline plus governance review over
a fixed catalog, which is acceptable. The English-only lexical gap is reachable only when
live (non-fixture) Spanish text could be produced — i.e. before `agentResponseGenerated`
could flip to `true` for an `es` response. A fixtures-only route never reaches that
trigger. **Not a blocker for a fixtures-only S3.4.** (Charter §16; Agent C Condition B.)

### 2. `failed → safe_close` contract strictness

**Required before a non-adapter contract consumer; NOT required if the route uses the
adapter/facade only.** The adapter (`runMichaelRuntimeAdapterContract`) enforces
`failed → safe_close`: `consumption.decision === 'block_substantive'` OR
`consumption.packetStatus === 'failed'` maps to `selectResponse(input, 'failed_context',
'safe_close', 'failed', ...)` (`michaelRuntimeAdapterContract.ts:122-124`), never emitting
`safe_fallback` for `failed`. The contract validator alone is more permissive:
`validateContextPacketStatusBehavior` (`michaelResponseContract.ts:336-348`) permits only
`safe_fallback` or `safe_close` for `failed`/`missing`/`rejected`, and adds a
`rejected`-specific `safe_close` rule (`rejected_context_requires_safe_close`, `:350-358`)
but **no equivalent `failed` rule** — so the contract evaluated on its own would accept a
`failed`-context `safe_fallback`. There is **no live gap** today: the facade and the
entire S2.17–S2.20 chain route exclusively through the adapter (the facade's only entry
points derive via the adapter and `deriveMichaelResponseCatalogSelectionRequestFrom...`,
`michaelRuntimeResolutionFacade.ts:129-154`), so `failed` always yields `safe_close`. The
latent permissiveness becomes reachable only if a future **direct** consumer of
`validateMichaelResponseContract` bypasses the adapter. A facade-routed route is, by
construction, an adapter consumer — it does not reach the gap. **Not a blocker for an
adapter/facade-routed S3.4.** (Charter §17; Agent C Condition C.)

### 3. Additional negative-space tests

**Optional; not a blocker if the route stays fixtures-only + facade-routed.** The Sprint
2 closeout baseline (653/653 across 63 files; focused 272/20) already covers the chain's
guardrail/boundary/ES/exhaustiveness/negative-space behavior. Additional negative-space
tests for a new route (e.g. flag-off disabled shape, body-`baId` rejection, harness-import
guard) belong with the S3.4 implementation slice itself, not as a separate hardening
prerequisite. They are recommended implementation-time coverage, not an S3.3 gate.

### Conclusion

**Is S3.3 a prerequisite for a fixtures-only, facade-routed S3.4? NO.** Neither hardening
condition is triggered by a route that returns pre-authored fixtures by reference through
the S2.20 facade: the ES scanner gates *live Spanish generation* (not exercised) and
contract-level `failed → safe_close` strictness gates a *non-adapter contract consumer*
(not introduced). S3.3 remains conditional and should be included **only if** Kevin's
chosen activation scope adds a live behavior (live/non-fixture generation, ES generation,
or a non-adapter contract consumer). If the first route stays fixtures-only and
adapter/facade-routed, S3.3 may be skipped without weakening any safety property. This
matches charter §19's explicit guard against inert-hardening theater.

## Required Kevin Decisions (before S3.4 implementation)

The following are reserved to Kevin and must be recorded before any minimal route
implementation begins. None is implied by approving the S3.2 route proposal:

1. **Namespace** — the gated BA route family + namespace for the Michael runtime surface;
   NOT `/api/runtime/*` (unmounted, reserved), distinct from the pre-gate `/api/michael`
   onboarding route, and its mount position relative to the boot-order rules in
   `server/src/index.ts` (append-only: import line + mount line below the gated banner).
2. **Auth / gate model** — `requireAuth` + the onboarding-complete gate
   (`requireSteveComplete` as it exists on disk; no `requireMichaelComplete` symbol may
   be assumed) + BA-scope from `req.session.baId` (no body-supplied `baId`/`sponsorBaId`),
   applied per-route never globally; BA-facing only, never prospect-facing.
3. **Feature flag names** — the concrete default-OFF, env-driven flag name(s).
4. **Kill switch shape** — the three independent fail-closed disable axes (route-disable,
   response-disable, trace-disable) and who can trip them.
5. **Response scope** — fixtures-only vs. live (non-fixture) generation, per-language
   (EN vs. ES); this directly gates the ES scanner precondition.
6. **Persistence policy** — whether any persistence channel flips from `'disabled'`, and
   if so which, written through `tripleStackWrite()` per the triple-stack rule (all
   currently inert).
7. **Observability mode** — the returned-only redacted-trace contract, what is
   logged/traced, and what must never appear in traces (compliance-forbidden content, PII,
   tokens/IDs, raw Context Packet).
8. **Rollback owner** — the single accountable owner of the rollback procedure if
   activation regresses.
9. **ES scanner yes/no** — approve/sequence the ES content scanner as a precondition on
   live Spanish generation (triggered only by that scope).
10. **`failed → safe_close` strictness yes/no** — whether/when to add contract-level
    strictness (triggered only by introducing a non-adapter contract consumer).
11. **Implementation approval** — the separate, explicit approval of the S3.4 minimal
    route implementation slice itself (required in addition to S3.1 charter approval and
    S3.2 route-proposal approval).

## Non-Approval Statement

This planning review approves nothing for activation and changes no code. No route, no
`/api/runtime/*` mount, no `.team` Michael runtime endpoint, no reuse of `/api/michael`,
no persistence, no LLM/dynamic generation, no voice/Telnyx/PSTN, no ES scanner, no
contract edit, and no middleware rename are implemented, approved, or scheduled here. The
preconditions and the S3.3 conclusion above are inputs to the final S3.2 Route Proposal,
which is owned by Agent E. This report does not create that final S3.2 report.
