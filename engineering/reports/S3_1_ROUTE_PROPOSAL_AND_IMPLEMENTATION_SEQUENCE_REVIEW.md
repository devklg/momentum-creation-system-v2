# Sprint 3 S3.1 Route Proposal and Implementation Sequence Review

- Sprint: Sprint 3 - Michael Activation Planning (charter slice)
- Slice: S3.1 Activation Planning Charter — future route-proposal definition + implementation-sequence recommendation
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no build/LLM/DB run; no route created or mounted)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Reviewer: Agent D (S3.1 route-proposal + implementation-sequence input — does NOT own the final S3.1 report; that is Agent E)
- Branch: `planning/s3.1-activation-planning-charter`
- Inputs:
  - `SPRINT_002_S2_22_MICHAEL_ACTIVATION_PROPOSAL_CHARTER_AND_CLOSEOUT_GATE.md` (Sprint 2 closeout + activation charter)
  - `S2_22_SPRINT_003_ACTIVATION_OPTIONS_REVIEW.md` (Sprint 3 options; Option A charter-first adopted)
  - `SPRINT_002_S2_10_RUNTIME_ACTIVATION_DECISION_GATE.md` (founding route-mount deferral)

> This is a planning/governance artifact. It defines, in advance, the shape of a
> FUTURE Sprint 3 route proposal and the FUTURE implementation sequence so Kevin can
> see the whole governed path before approving any single step. It approves nothing,
> proposes no concrete route as a decision, mounts nothing, persists nothing, and
> changes no production code. Candidate namespaces below are OPTIONS for Kevin to
> choose from, not decisions. This report does not create the final S3.1 charter
> (Agent E owns that); it is one input to it.

## 1. Grounding and Scope

Sprint 2 closed as a verified inert foundation (S2.22, PASS WITH CONDITIONS). The
canonical activation path is the S2.17 catalog → S2.18 selector → S2.19 derivation →
S2.20 facade chain. The S2.13 scenario-driven fixture harness is KEPT as test-only
and is explicitly NOT on the activation path. On disk: the onboarding-complete gate
is `requireSteveComplete` (there is **no** `requireMichaelComplete`); `/api/michael`
is an already-mounted **pre-gate onboarding** route that does not import the runtime
chain; `/api/runtime/*` is unmounted and returns zero matches.

Kevin's fixed sequence stands: **charter → route proposal → implementation, each
separately approved.** This report covers links two and three (the future route
proposal and the future implementation), and closes with a recommended slice
sequence. It does not authorize, write, or adopt any of them.

---

## Future Route Proposal Phase

### 1. Purpose of the Route Proposal

The future route-proposal phase exists to convert the ratified activation boundary
(from the Sprint 3 charter) into a single, concrete, reviewable specification of a
gated BA-facing surface — **before any code is written**. Its purpose is to let
Kevin evaluate the exact route family, auth chain, feature-flag/kill-switch shape,
observability contract, and rollback ownership as one decision, derived from the
charter rather than asserted ahead of it. The route proposal **specifies**; it does
not implement. It mounts nothing, creates no route file, and changes no runtime
behavior. Its deliverable is a document Kevin approves (or rejects) as the gate that
any implementation slice must clear.

### 2. Route Family Naming Constraints (candidate namespaces as OPTIONS)

The future route family is bound by hard constraints inherited from S2.10–S2.22:

- **NOT `/api/runtime/*`.** That namespace stays unmounted and reserved; S2.21
  verified it returns zero matches anywhere. The route proposal must not revive it.
- **NOT the existing pre-gate `/api/michael`.** `/api/michael` (`michaelRoutes`) is
  already mounted in the PRE-GATE block (above the gated banner, alongside
  `/api/health`, `/api/auth`, `/api/welcome`, `/api/admin/*`, `/api/p`) and does not
  import the runtime chain. It is how a new BA opens the onboarding gate. A runtime
  helper must NOT reuse, extend, or overload it; the onboarding gate and the runtime
  helper must never overlap on one namespace.
- **Must be a gated BA route family**, mounted BELOW the gated banner in
  `server/src/index.ts`, alongside the other `(requireAuth, requireSteveComplete)`
  route files, following the append-only mount convention (add only the import line
  and the mount line; touch no existing line).
- **Per-route gate, never global.** No router-wide `app.use` gate.

**Candidate namespaces — OPTIONS for Kevin to choose, not decisions here:**

| Option | Candidate namespace | Note |
|---|---|---|
| N-1 | `/api/michael-runtime/*` | Distinct from pre-gate `/api/michael`; names the agent + surface. |
| N-2 | `/api/training-support/*` | Function-named (BA training-support helper); agent-agnostic. |
| N-3 | `/api/team/michael/*` | Scopes under a `.team` segment; signals BA-facing surface. |
| N-4 | `/api/agents/michael/*` | Reserves an agent family for later Steve/Ivory parity. |

None of these is adopted. The route proposal phase selects exactly one (or proposes
a different one) **for Kevin's separate approval**. Whichever is chosen must remain
visibly distinct from `/api/michael` and must not be `/api/runtime/*`.

### 3. Auth Requirements

Every handler in the future route family must apply, per-route (not globally), in
order:

- **`requireAuth`** — authenticated BA session required; the `.team` JWT cookie
  scoped to `.teammagnificent.team` is the only identity surface. No anonymous
  access. The prospect `.teammagnificent.com` cookie must never satisfy the gate.
- **Onboarding-complete gate** — the per-route "onboarding complete" middleware that
  exists on disk today, which is `requireSteveComplete`. The route proposal must
  reconcile the historical `requireMichaelComplete` reference explicitly and use the
  actual middleware that enforces "onboarding complete" — it must NOT assume a
  `requireMichaelComplete` symbol exists.
- **BA scope from session** — every invocation scoped to `req.session.baId`. The
  BA/sponsor identity is derived from the session, **never from the request body**
  (consistent with sponsor immutability). Any `baId`/`sponsorBaId` in the body must
  be rejected. No cross-BA reads.

### 4. Feature Flag Requirements

- **Default OFF.** The surface is disabled unless explicitly enabled; absence of the
  flag means inert. No hardcoded enable.
- **Env-driven**, read through the repo env-loader convention (walk-up to the
  workspace marker; never `import.meta.url` path math).
- **Test-covered** — the off-by-default behavior must be covered before live
  exposure, proving the disabled shape returns with no external side effects.

### 5. Kill Switch Requirements

The future surface must ship behind a kill switch with **three independent disable
axes**, each toggleable on its own:

- **Route-disable** — the route handles no requests (returns a safe disabled shape).
- **Response-disable** — no response payload is produced even if the route answers.
- **Trace-disable** — no trace is emitted even if a response is produced.
- **Fail-closed.** On any flag-read failure, unknown state, or partial config, the
  surface behaves as **disabled** — safe disabled shape, no external side effects,
  no persistence, no generation. Each disable path must be test-covered before live
  exposure.

### 6. Observability Requirements

- **Returned-only redacted trace first.** Observability begins and ends, for the
  first activation, with the existing returned-only redacted trace (`buildTrace`).
  No log sink, store, or external telemetry without separate approval.
- **No raw Context Packet** — the trace never spreads, embeds, or echoes the packet
  or the response body.
- **No PII** — no prospect PII, private journal/relationship text, or raw retrieval
  results.
- **No tokens / IDs** — no session, turn, correlation, or pool IDs; no cookies,
  secrets, or access tokens in any emitted trace.
- Trace contents stay limited to redacted classification metadata plus the standing
  literals `persistence: 'disabled'` and `agentResponseGenerated: false`.

### 7. Rollback Requirements

- **Rollback owner** — a single accountable owner must be NAMED in the route
  proposal / implementation step (this slice names none and authorizes none).
- **Rollback steps (proposed):**
  1. **Flag off** — set the kill switch to default-off (route + response + trace
     disable) so the surface is immediately inert.
  2. **Redeploy** — redeploy the server with the flag off so the inert state is the
     running state.
  3. **Verify inert** — confirm no route handles requests, no response generated
     (`agentResponseGenerated: false`), no persistence (`persistence: 'disabled'`),
     `.com` untouched, `/api/runtime/*` still unmounted, and rerun all four merge
     gates (`pnpm build:shared`, `pnpm typecheck`, `pnpm build`,
     `pnpm --filter @momentum/server test`).

### 8. Non-Approval Statement (Route Proposal Phase)

This section approves nothing. No route is proposed-as-decided, adopted, mounted, or
created. The candidate namespaces are OPTIONS for Kevin's separate choice. The route
proposal phase itself is a future, separately-approved step that produces a document
Kevin must ratify before any implementation; writing this definition grants no
authorization for any of it.

---

## Future Implementation Phase

### 1. Gating — Occurs ONLY After Three Separate Approvals

The implementation phase is eligible ONLY after **all** of the following, in order,
have occurred and been separately approved by Kevin:

1. the Sprint 3 activation **charter is approved**;
2. the **route proposal is approved** (route family, namespace, auth chain, flags,
   kill switch, observability, rollback owner);
3. **Kevin separately approves the implementation slice itself.**

No step is implied by the prior one. Approving the charter does not approve a route
proposal; approving a route proposal does not approve implementation.

### 2. Implementation Constraints

When (and only when) eligible, the implementation must be:

- **`.team` only** — BA-facing internal surface (`apps/team`, port 7702) + the
  shared Express API (`server/`, port 7700). Never `apps/com`.
- **Authenticated** — `requireAuth` + onboarding-complete gate per-route.
- **BA-scoped** — scoped to `req.session.baId`; no body-supplied BA id; no cross-BA
  reads.
- **Fixtures-only unless separately approved** — responses come from
  `MICHAEL_RESPONSE_CATALOG` via selector + contract validator, returned by
  reference through the facade; `agentResponseGenerated` stays `false`.
- **No persistence unless separately approved** — every persistence discriminant
  stays the literal `'disabled'`; envelopes returned in memory only.
- **No LLM unless separately approved** — no Anthropic/ScriptMaker/Ivory or any
  dynamic generation may enter the path.
- **No voice unless separately approved** — no browser voice, Telnyx, PSTN, or
  call-control.

### 3. Must Use the Canonical Path

Implementation must drive **only** the canonical activation chain:
**catalog → selector → derivation → facade** (S2.17 `michaelResponseCatalog` →
S2.18 `michaelResponseCatalogSelector` → S2.19 `michaelResponseSelectionRequest`
derivation → S2.20 `michaelRuntimeResolutionFacade`, returning the validated fixture
by reference with a redacted trace). No alternate resolution surface may be wired
into the activation path.

### 4. Must NOT Use the S2.13 Harness

The S2.13 scenario-driven fixture harness
(`fixtures/michaelRuntimeResponseHarness.ts` + `michaelRuntimeResponseScenarios.ts`)
is test-only and NOT on the activation path. It bypasses the governance-bearing
selector/derivation/facade links via a direct `scenarioName → responseFixtureKey`
map and must NOT be reached by any route or implementation.

### 5. Must NOT Touch `.com`

The five `.com` compliance prohibitions stand absolutely. Michael (AI
training/prospecting language) must never render on the prospect surface. No
prospect-facing route, copy, or behavior.

### 6. Must NOT Use `/api/runtime/*`

That namespace stays unmounted and reserved. The implementation must not mount,
revive, or route through it.

### 7. Must NOT Reuse the Pre-Gate `/api/michael`

The existing pre-gate `/api/michael` onboarding route must not be reused, extended,
or overloaded for the runtime chain. The implementation uses the distinct gated BA
namespace approved in the route-proposal phase.

---

## Sequence Recommendation

The recommended Sprint 3 slice sequence, each step a distinct gate Kevin clears
before the next begins:

### S3.1 — Planning Charter
A planning-only charter defining the authenticated, `.team`-only, BA-scoped
activation boundary, the approval checklist, the kill-switch/rollback model, the
observability contract, and the live-behavior conditions (ES content scanner;
`failed → safe_close` contract strictness). **Gate:** it authorizes nothing — it
frames what Kevin must separately approve. Changing no runtime behavior, it is the
SAFEST, highest-value first link and the precondition for everything after it.
*(This report is one input to S3.1; Agent E owns the final S3.1 charter.)*

### S3.2 — Route Proposal
A single concrete specification derived from the ratified charter: the chosen gated
BA route family + namespace (NOT `/api/runtime/*`, distinct from pre-gate
`/api/michael`), the `requireAuth` + onboarding-complete + BA-scope auth chain, the
default-off feature flag, the three-axis fail-closed kill switch, the returned-only
redacted-trace observability contract, and a named rollback owner. **Gate:** Kevin
approves the proposal as the spec any implementation must clear. It mounts nothing
and creates no route file. Sequencing this before the charter is ratified would
invert decision currency and risk smuggling unapproved boundary assumptions — so it
must come second, not first.

### S3.3 — Pre-Implementation Hardening (only if Kevin requires it)
Targeted inert follow-ups that gate specific *live* behaviors: the ES content
scanner (prerequisite for any live non-fixture Spanish generation) and
`failed → safe_close` contract-level strictness (prerequisite for any non-adapter
contract consumer). **Gate:** included ONLY if Kevin's chosen activation scope
actually requires the corresponding live behavior. If the first implementation
remains fixtures-only and adapter-routed (as recommended), neither condition is a
blocker and this step may be skipped — guarding against "inert-hardening theater"
that delays the real boundary decision.

### S3.4 — Minimal Route Implementation (only if separately approved)
The first slice where Michael's inert resolution becomes reachable behind an
authenticated internal boundary: `.team`-only, authenticated, BA-scoped,
fixtures-only, no persistence, no LLM, no voice, driving only the
catalog → selector → derivation → facade chain, returning by reference with a
redacted trace, behind the default-off three-axis kill switch. **Gate:** eligible
ONLY after S3.1 charter approval AND S3.2 route-proposal approval AND a separate
Kevin approval of the implementation slice itself. All four merge gates must pass on
the implementation branch.

---

## Explicit Non-Actions (Stop Conditions for this report)

This S3.1 input review did not, and does not:

- approve, charter, or begin any activation, route, route proposal, route
  implementation, persistence, LLM, voice, or dynamic-generation work;
- create, mount, or modify any route or route file, or `/api/runtime/*`;
- adopt any candidate namespace as a decision (all are OPTIONS for Kevin);
- write the final S3.1 charter (Agent E owns that);
- resolve the ES content scanner or `failed → safe_close` contract strictness
  conditions;
- modify any production code, test, route, UI, `.com`, ratified document,
  persistence adapter, or Gateway fallback;
- run builds, typecheck, tests, LLMs, or any database;
- activate Michael, Steve, or Ivory behavior;
- commit, or mutate git history or any database.

This report is the only file written by Agent D for S3.1.
