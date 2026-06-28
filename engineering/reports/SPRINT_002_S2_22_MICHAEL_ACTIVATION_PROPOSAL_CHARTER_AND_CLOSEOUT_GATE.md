# Sprint 2 S2.22 Michael Activation Proposal Charter + Sprint 2 Closeout Gate

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.22 Michael Activation Charter Closeout — final integration + activation-proposal charter + Sprint 2 closeout decision gate
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (gate commands were run read-only; no production code, tests, routes, UI, or `.com` modified; no commit; no LLM/DB access)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent E (final integration + closeout-gate agent — owns this verdict)
- Branch: `review/s2.22-michael-activation-charter-closeout`
- Inputs:
  - Agent A — `S2_22_MICHAEL_ACTIVATION_BOUNDARY_CHARTER_DRAFT.md` (activation boundary charter draft)
  - Agent B — `S2_22_REMAINING_CONDITIONS_REVIEW.md` (three carried-forward S2.21 conditions)
  - Agent C — `S2_22_SPRINT_002_CLOSEOUT_FOUNDATION_DRAFT.md` (Sprint 2 closeout foundation record)
  - Agent D — `S2_22_SPRINT_003_ACTIVATION_OPTIONS_REVIEW.md` (Sprint 3 activation options)
  - Predecessor gate — `SPRINT_002_S2_21_MICHAEL_INERT_RUNTIME_READINESS_DECISION_GATE.md` + Kevin's recorded S2.21-close decisions

> This is a planning/governance closeout artifact. It approves nothing for
> activation, mounts nothing, persists nothing, generates nothing, and changes no
> production code. It synthesizes the four S2.22 input reports into one record
> Kevin reads before closing Sprint 2 and before any Sprint 3 activation decision.

## 1. Executive Result

**PASS WITH CONDITIONS.**

S2.22 is a route-free, planning-only slice over the verified inert Michael runtime
chain. The activation-proposal charter is complete (Agent A), the three carried
S2.21 conditions are reviewed and dispositioned (Agent B), the Sprint 2 closeout
foundation is assembled and evidence-grounded (Agent C), and the Sprint 3 options
are analyzed with a clear recommendation (Agent D). All four merge gates are green
on this branch and the focused Michael-chain command passes, matching the
**653/653** baseline exactly — confirming this slice changed no code.

The verdict is PASS **WITH CONDITIONS** because this is a planning slice that
carries forward conditions which must be tracked and separately resolved before
any future activation. The conditions are:

- **Condition A — S2.13 harness disposition (resolved as documentation).** Kevin
  ruled at S2.21 close that the S2.13 scenario-driven fixture harness is KEPT as
  test-only and is NOT on the activation path. Carried as a standing constraint;
  the canonical activation path is the S2.17–S2.20 chain. See §12.
- **Condition B — ES content scanner (open).** The prohibited-text scanner is
  English-lexicon-only. Not required for the inert fixtures-only foundation, but a
  hard prerequisite before any live (non-fixture) Spanish generation. See §13.
- **Condition C — `failed → safe_close` contract strictness (open).** Adapter-
  enforced today, not contract-enforced. No live gap (the chain always routes
  through the adapter), but contract-level strictness must be added before any
  non-adapter contract consumer is introduced. See §14.
- **Condition D — `requireMichaelComplete` vs `requireSteveComplete` naming
  reconciliation (open).** The onboarding gate on disk is `requireSteveComplete`;
  there is no `requireMichaelComplete`. This naming must be reconciled in the
  future route-proposal step. See §6 (finding 1).
- **Condition E — future-activation governance decisions (open, Kevin-only).** The
  boundary, route family + namespace, auth model, kill switch, response-generation
  scope, persistence policy, observability contract, rollback owner, and the
  Sprint 3 charter all remain separately-approved future decisions. See §19.

No production change is approved by this gate. This report does not mount a route,
persist, activate, or generate anything.

## 2. Planning / Governance Only — No Code Changed

This slice is documentation and governance only. The only commands run were the
four read-only merge gates plus the focused Michael-chain test command (all
captured in "Gates run and results" below). No production code, test, route, UI,
`.com` surface, ratified document, persistence adapter, or Gateway fallback was
modified; no LLM was called; no database was touched; nothing was committed. The
653/653 suite baseline holding unchanged is the positive evidence that the slice
is inert.

## 3. Activation Proposal Charter (synthesis of Agent A)

The charter (Agent A) defines — in advance and in one place — the exact boundary
inside which Michael Magnificent *could* one day be activated as a live, BA-facing
training-support helper on internal `.team`, so Kevin can evaluate the whole shape
of activation before any single piece is built. It is **explicitly non-authorizing**:
it approves no route, mount, namespace, persistence, LLM call, dynamic generation,
voice/Telnyx/PSTN surface, live Michael behavior, Steve/Ivory behavior, or `.com`
exposure. Approving the charter (if Kevin does) approves only the *plan to seek
approvals*, not any of those approvals; each future step is its own recorded
decision.

The charter names the single canonical resolution path: Context Packet (Context-
Manager-assembled, `context_packet.v1`) → Runtime Turn → Michael adapter contract
(`michaelRuntimeAdapterContract.ts`) → selection-request derivation
(`michaelResponseSelectionRequest.ts`) → catalog selector
(`michaelResponseCatalogSelector.ts`) → response catalog
(`michaelResponseCatalog.ts`, 12 verbatim-fixture entries on
`michaelResponseContract.ts`) → inert resolution facade
(`michaelRuntimeResolutionFacade.ts`, returns the fixture by reference, never
throws) → redacted trace (`buildTrace`). Any future activation must drive *only*
this chain; no alternate resolution surface may be wired into an activation path.

The fixed sequence Kevin ratified at S2.21 stands: **charter → route proposal →
implementation slice, each separately approved.** This charter is the first link.

## 4. Future Activation Boundary

If Michael is ever activated, activation must remain inside this boundary (Agent A §3):

- **`.team` only.** BA-facing internal surface (`apps/team`, port 7702) + the
  shared Express API (`server/`, port 7700). Never `apps/com` (port 7701), never
  prospect-facing.
- **Authenticated only.** No anonymous access; the `.team` JWT cookie scoped to
  `.teammagnificent.team` is the identity surface.
- **BA-scoped only.** A BA may only invoke Michael for their own training-support
  context; reads and returned guidance are scoped to `req.session.baId`.
- **Internal only.** No external side effects — no send, call, schedule, prospect,
  or THREE handoff. THREE International remains the upstream authority; this system
  mirrors, never overrides.
- **No `.com`.** The five `.com` compliance prohibitions stand absolutely; Michael
  (AI training/prospecting language) must never render on the prospect surface.

## 5. Future Route Proposal Requirements

The future route family is described for Kevin to consider; it is **not**
implemented or decided here (Agent A §5):

- **Gated BA route family, mounted BELOW the gated banner** in
  `server/src/index.ts`, alongside the other `(requireAuth, requireSteveComplete)`
  route files, following the append-only mount convention (add only the import
  line and the mount line).
- **NOT `/api/runtime/*`.** That namespace stays unmounted and reserved; S2.21
  verified it returns no matches anywhere, and this slice does not change that.
- **Distinct from the existing pre-gate `/api/michael`.** `/api/michael`
  (`michaelRoutes`) is ALREADY mounted as a PRE-GATE onboarding route and does
  **not** import the runtime chain (verified — see §6, finding 1). A future runtime
  route family must use a distinct, clearly named namespace so the onboarding gate
  and the runtime helper never overlap.
- **Per-route gate, not global.** Each handler applies `requireAuth` then the
  onboarding-complete gate per-handler; never a router-wide `app.use` gate.
- The exact namespace is a **proposal for Kevin to choose**, not a decision here.

## 6. Future Auth Model Requirements (incl. gate-name reconciliation)

Proposed auth model for any future Michael runtime route (Agent A §6), for separate
approval:

- **`requireAuth`** — authenticated BA session required; `.team` JWT cookie scoped
  to `.teammagnificent.team`; no anonymous access.
- **Onboarding-complete gate** — the per-route "onboarding complete" middleware,
  applied per-handler below the gated banner.
- **BA ownership / BA scope** — every invocation scoped to `req.session.baId`;
  sponsor/BA-id scoping derived from the session, never from the request body
  (consistent with sponsor immutability). No cross-BA reads.
- **No `.com` cookie path.** The prospect `.teammagnificent.com` cookie must never
  satisfy this gate.

**Finding 1 (verified) — `requireMichaelComplete` vs `requireSteveComplete`
reconciliation item.** The onboarding-gate middleware that exists on disk is
`server/src/middleware/requireSteveComplete.ts`. There is **no**
`requireMichaelComplete.ts` (the only middleware present are `requireAuth.ts` and
`requireSteveComplete.ts`), despite `CLAUDE.md` and prior charters (including S2.11
and the S2.21 gate's "Required Decision 2") referencing a `requireMichaelComplete`
gate. In this repo **Steve is the onboarding gate; Michael is the runtime
training-support agent.** Furthermore `/api/michael` (`michaelRoutes`) is mounted
in the PRE-GATE block of `server/src/index.ts` (above the gated banner, alongside
`/api/health`, `/api/auth`, `/api/welcome`, `/api/admin/*`, `/api/p`) and does NOT
import the runtime chain — it is how a new BA opens the onboarding gate, not a
runtime surface. Any future runtime route proposal must:

1. Reconcile this naming explicitly — use the actual middleware that enforces
   "onboarding complete" (`requireSteveComplete` as it exists today), not assume a
   `requireMichaelComplete` symbol exists; and
2. Use a namespace distinct from the existing pre-gate `/api/michael`, and keep
   `/api/runtime/*` unmounted.

This is a documentation/identity reconciliation item for Kevin to resolve in the
route-proposal step — not a wiring change made here.

## 7. Future Feature Flag / Kill Switch Requirements

Any future activation must ship behind a default-off kill switch defined before
live exposure (Agent A §7):

- **Default OFF.** Disabled unless explicitly enabled; absence of the flag means
  inert.
- **Three independent disable axes:** route-disable, response-disable, trace-disable
  — each independently toggleable.
- **Env-driven.** Flags read from environment (repo env-loader convention); no
  hardcoded enable.
- **Fail-closed.** On any flag-read failure, unknown state, or partial config, the
  surface behaves as disabled and returns a safe disabled shape with no external
  side effects.
- **Test-covered.** Each disable path must be covered by tests before live exposure.

## 8. Future Response-Generation Policy

- **Fixtures-only by default** (Agent A §8). Responses come from
  `MICHAEL_RESPONSE_CATALOG` via selector + contract validator, returned by
  reference through the facade. No text-generation engine.
- **`agentResponseGenerated: false`** remains the literal value at every result
  boundary.
- **No dynamic generation without separate approval.** No Anthropic/ScriptMaker/
  Ivory or any LLM call may enter the Michael path, and `agentResponseGenerated`
  may not flip to `true`, without a distinct recorded Kevin approval covering
  generation scope and the ES content-scanner question (§13).

## 9. Future Persistence Policy

- **Disabled by default** (Agent A §9). Every persistence discriminant remains the
  literal `'disabled'`; envelopes are returned in memory only.
- **No persistence of any artifact without separate approval** — no events,
  outcomes, Guided Actions, responses, sessions, transcripts, or logs.
- If persistence is ever approved, it must write through the triple-stack helper
  (`tripleStackWrite()` → MongoDB + Neo4j + ChromaDB via Universal Gateway V2) and
  honor the GraphRAG schema contract — a separate, separately-approved undertaking,
  not authorized here.

## 10. Future Observability / Trace Policy

- **Returned-only redacted trace first** (Agent A §10). Observability begins with
  the existing returned-only redacted trace (`buildTrace`); no log sink, store, or
  external telemetry without separate approval.
- **No raw Context Packet** — the trace never spreads or embeds the packet or the
  response.
- **No PII** — no prospect PII, private journal/relationship text, or raw retrieval
  results.
- **No tokens / IDs** — no session, turn, or correlation IDs; no cookies, secrets,
  or access tokens in any emitted trace.
- Trace contents stay limited to redacted classification metadata plus
  `persistence: 'disabled'` and `agentResponseGenerated: false`.

## 11. Future Rollback Policy

- **Rollback owner — to be named before any activation** (Agent A §11). A single
  accountable owner must be designated in the route-proposal/implementation step;
  this slice names none and authorizes none.
- **Rollback steps (proposed):**
  1. **Flag off** — set the kill switch to default-off (route + response + trace
     disable) to make the surface inert immediately.
  2. **Redeploy** — redeploy the server with the flag off so the inert state is the
     running state.
  3. **Verify inert** — confirm no route handles requests, no response generated
     (`agentResponseGenerated: false`), no persistence (`persistence: 'disabled'`),
     `.com` untouched, `/api/runtime/*` still unmounted, and rerun all four merge
     gates.

## 12. Condition A — S2.13 Harness Keep/Retire Decision

**Decision: KEPT as test-only.** Per Kevin's recorded S2.21-close ruling, the
S2.13 scenario-driven fixture harness
(`server/src/runtime/orchestration/fixtures/michaelRuntimeResponseHarness.ts` +
`michaelRuntimeResponseScenarios.ts`) is retained, explicitly documented as a
test-only fixture harness, and is NOT part of the activation path. Agent B confirmed
the files are consumed only by five `__tests__` files plus append-only barrel
re-exports — zero route, UI, service, or persistence consumers — and that the
harness resolves a response via a single direct `scenarioName → responseFixtureKey`
map, bypassing the governance-bearing selector/derivation/facade links.

The **canonical activation path is the S2.17–S2.20 catalog → selector → derivation
→ facade chain.** Agent B's recommended doc language (paste-ready, to be applied as
a future edit — not applied in S2.22):

> *"The S2.13 scenario-driven fixture harness
> (`fixtures/michaelRuntimeResponseHarness.ts` +
> `fixtures/michaelRuntimeResponseScenarios.ts`) is a test-only fixture harness,
> retained and not scheduled for retirement. It is not part of the activation path.
> All activation routes through the S2.17–S2.20 catalog → selector → derivation →
> facade chain. Condition 1 is resolved as documentation."*

No retirement slice is scheduled; this is carried forward as a standing constraint,
not an open question.

## 13. Condition B — ES Content Scanner

**Status: NOT implemented in S2.22; must be decided before live Spanish generation.**
Agent B confirmed `PROHIBITED_TEXT_PATTERNS` and `SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN`
are English-lexicon-only (numeric/currency triggers are language-agnostic; Spanish
lexical equivalents are not in the set). The inert fixtures-only path generates no
text, so an ES scanner is **not** a prerequisite for the inert facade and **not**
required to close Sprint 2 — ES safety today rests on fixture authoring discipline +
governance review over a fixed catalog (every catalog entry is still run through the
English scanner via `validateMichaelResponseContract`). It becomes a hard
prerequisite the moment any live (non-fixture) Spanish generation is contemplated
(before `agentResponseGenerated` could ever flip to `true` for an `es` response).

Agent B's minimum ES term floor, if/when implemented (mapping to existing English
categories):

| Category (parallels EN pattern) | Minimum ES terms |
|---|---|
| income / compensation | `ingresos`, `ganancias`, `comisión`, `compensación` |
| placement / guarantee | `colocación`, `garantizado` |
| medical | `médico`, `salud` |
| prospect-facing / automatic action | `prospecto`, `automático`, `llamar`, `enviar` |

Full floor: **ingresos, ganancias, comisión, compensación, colocación, garantizado,
médico, salud, prospecto, automático, llamar, enviar** — with diacritic-insensitive,
inflection-aware matching and a safe-close ES substantive-guidance pattern
paralleling `SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN`. This is a documented starting
set, not an implementation spec. No scanner is approved or implemented here.

## 14. Condition C — `failed → safe_close` Contract Strictness

**Status: NOT changed in S2.22; must be decided before any non-adapter consumer.**
Agent B confirmed the adapter enforces `failed → safe_close`
(`michaelRuntimeAdapterContract.ts`), while the response contract alone
(`validateContextPacketStatusBehavior` in `michaelResponseContract.ts`) permits
`failed → safe_fallback OR safe_close` — it has a `rejected`-specific `safe_close`
rule but **no equivalent `failed` rule**. There is **no live gap today**: the facade
and the entire S2.17–S2.20 chain route exclusively through the adapter, so `failed`
always yields `safe_close`. The risk is latent — a future direct contract consumer
bypassing the adapter could legitimately emit a `failed`-context `safe_fallback`.
Contract-level strictness (a `failed_context_requires_safe_close` rule mirroring the
existing `rejected_context_requires_safe_close` clause) must be added if/when any
non-adapter consumer of `validateMichaelResponseContract` is introduced. No contract
change is made or approved here.

## 15. Sprint 2 Closeout Foundation Summary (synthesis of Agent C)

Sprint 2 — Agent Runtime Activation — built an **inert agent-runtime foundation
only**. Despite the sprint name, no live activation occurred. The deliverable is a
pure, returned-only, route-free, non-persistent, LLM-free orchestration substrate
plus a complete Michael inert response-resolution chain, validated by the expanded
suite. Agent C re-confirmed, evidence-grounded against the source tree and the S2.21
gate, that across S2.1–S2.22: the inert foundation is complete; no activation
occurred; no route mounted (`/api/runtime` returns zero matches; the mounted
`/api/michael` onboarding route does not import the runtime chain); no persistence
added; no LLM / dynamic generation added; no voice/Telnyx/PSTN/call-control added;
`.com` untouched; `.team` UI not exposed to the chain; Gateway fallback preserved
and uncoupled; the Michael inert chain complete (modules named); Steve/Ivory not
activated; candidate/review-only knowledge excluded by default and fail-closed. The
suite baseline of record is **653/653 across 63 files**.

**S2.9 report-on-disk finding (finding 2, verified — recorded honestly).** There is
**no standalone S2.9 slice report on disk.** The S2.9 activation-readiness
transition is folded into `SPRINT_002_RUNTIME_ACTIVATION_READINESS_REVIEW.md` plus
the S2.10 decision gate. Agent C's slice index records this as "No standalone slice
report on disk" rather than fabricating a missing report; this gate affirms that
honest representation — no missing report is invented.

## 16. Sprint 3 Activation Options Summary (synthesis of Agent D)

Agent D analyzed four Sprint 3 options:

- **Option A — Sprint 3 Planning Charter First (RECOMMENDED).** A planning-only
  charter defining the authenticated, `.team`-only, BA-scoped activation boundary,
  approval checklist, kill-switch/rollback model, and pre-code conditions. Highest
  value, lowest risk, SAFEST — it changes no runtime behavior and authorizes
  nothing; it is the precondition for everything after it.
- **Option B — Sprint 3 Route Proposal.** Correct step *after* the charter, wrong
  order if first; proposing a route family before the boundary is ratified inverts
  decision currency and risks smuggling in unapproved assumptions.
- **Option C — Minimal internal route implementation.** Too early by a wide margin;
  presupposes both a ratified charter and an approved route proposal.
- **Option D — More inert hardening (ES scanner, contract strictness, more
  negative-space tests).** Not a prerequisite for Sprint 3 *planning*; those items
  gate *live generation* and *non-adapter consumers*, and risk "inert-hardening
  theater" that delays the actual unresolved boundary decision.

**This gate adopts Agent D's recommendation: Option A — charter-first.** The fixed
sequence stands: **charter → route proposal → implementation, each separately
approved.**

## 17. Recommendation

**Close Sprint 2 — Agent Runtime Activation as a verified inert foundation** (after
this S2.22 report lands and Kevin confirms), and **create a Sprint 3 planning
charter next** (Agent D Option A). The S2.11–S2.20 Michael inert chain is complete,
safe as a returned-only chain, and clean of every forbidden activation surface,
with all merge gates green and the 653/653 baseline holding. The remaining open
items (Conditions B, C, D, E) are governance/content-discipline matters carried to
Sprint 3, not wiring defects in the foundation. Live activation — any route, mount,
persistence, LLM, voice, or live Michael/Steve/Ivory behavior — remains a separate,
separately-gated, separately-approved Sprint 3 undertaking.

## 18. Explicit Non-Approval Statement

This gate approves nothing for activation. Restated for the record:

- **No route approved** — including any `/api/runtime/*`, any new `.team` Michael
  runtime endpoint, or any reuse of the existing pre-gate `/api/michael` for the
  runtime chain.
- **No `/api/runtime/*`** mount approved; it stays unmounted and reserved.
- **No persistence approved** — no events, outcomes, Guided Actions, envelopes,
  responses, sessions, transcripts, or logs.
- **No LLM approved** — no Anthropic/ScriptMaker/Ivory or any dynamic response
  generation; `agentResponseGenerated` stays `false`.
- **No voice approved** — no browser voice, Telnyx, PSTN, or call-control.
- **No live Michael behavior approved.**
- **No Steve or Ivory behavior approved.**
- **No `.com` exposure approved.**

S2.22 is a planning-only, non-authorizing charter + closeout gate over a verified
inert foundation. Any activation remains a separate, separately-approved
undertaking, in the fixed order charter → route proposal → implementation.

## 19. Required Kevin Decisions Before Sprint 3 Implementation

Each is a distinct, explicit approval — none is implied by approving the charter or
closing Sprint 2:

1. **Activation boundary** — authenticated, internal `.team`-only, BA-scoped,
   Context-Packet-only.
2. **Route family + namespace** — whether a route is mounted at all, and if so the
   exact gated BA route family and namespace (NOT `/api/runtime/*`, distinct from
   the pre-gate `/api/michael`).
3. **Auth / gate-name reconciliation** — confirm `requireAuth` + the onboarding-
   complete gate + BA scope, AND reconcile the `requireMichaelComplete` vs
   `requireSteveComplete` naming (the gate on disk is `requireSteveComplete`; no
   `requireMichaelComplete` exists).
4. **Response-generation scope** — confirm fixtures-only / returned-only vs. any
   future generated text, and whether `agentResponseGenerated` may ever flip to
   `true`.
5. **Persistence policy** — confirm disabled, or approve a specific persisted
   artifact with its triple-stack contract.
6. **Kill switch** — default-off, three independent disable axes, env-driven,
   fail-closed, test-covered.
7. **Monitoring / observability contract** — returned-only or log-only first, with
   PII/text/ID redaction rules intact.
8. **Rollback owner** — name a single accountable owner and agree the post-rollback
   gate-rerun checklist.
9. **ES scanner go/no-go** (Condition B) — required before any live (non-fixture)
   Spanish generation.
10. **`failed → safe_close` contract strictness** (Condition C) — required before
    any non-adapter contract consumer.
11. **Sprint 3 charter approval** — the Sprint 3 activation-sprint charter as a
    whole, before any activation slice is dispatched.

## Gates Run and Results

All four merge gates were run read-only on the review branch with pnpm 9 / Node ≥ 22.
The full server suite passed cleanly on the first run with **no** failures — the
known transient `mongoAdapter.test.ts` parallel-load 5000ms timeout flake did **not**
appear, so no re-run was required.

| Gate | Command | Exit | Duration | Result |
|---|---|---|---|---|
| Shared build | `pnpm build:shared` | 0 | ~1s | PASS |
| Typecheck | `pnpm typecheck` | 0 | ~5s | PASS (5 of 6 workspace projects scoped; all done) |
| Build | `pnpm build` | 0 | ~6s | PASS (standing Vite warnings only: `.com` dynamic/static import chunk note + `.team` >500kB chunk-size note) |
| Full server suite | `pnpm --filter @momentum/server test` | 0 | ~2s | PASS — **63 files / 653 tests**, 0 failures, no flake |

**Focused Michael-chain command** (run exactly as specified):

```
pnpm --filter @momentum/server test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary
```

- Exit 0, ~1s. **20 test files / 272 tests, all passing.** (vitest treats each
  argument as a filename substring filter, so the run includes the named modules
  plus their adjacent guardrail/boundary/ES/exhaustiveness/negative-space specs —
  e.g. `michaelRuntimeAdapterContract` also matches its `...Guardrails`,
  `...EsSafePaths`, and `...Boundary` specs — the intended broad Michael-chain
  sweep.)

Results match the S2.20/S2.21 closeout baseline (653/653 across 63 files; focused
272/20) exactly, confirming S2.22 changed no code and the chain remains green on
this branch.

---

This is the final S2.22 closeout-gate report (Agent E). Planning / governance /
documentation only; gate commands were run read-only. No production code, test,
route, UI, `.com`, ratified document, persistence adapter, or Gateway fallback was
modified, and nothing was committed.
