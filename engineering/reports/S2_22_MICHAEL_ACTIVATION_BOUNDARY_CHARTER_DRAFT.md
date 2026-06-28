# Sprint 2 S2.22 Michael Activation Boundary Charter (DRAFT)

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.22 Route-Free Michael Activation Proposal Charter (non-authorizing draft)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY — NON-AUTHORIZING DRAFT
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent A (charter draft author). Final S2.22 report is owned separately by Agent E.
- Branch: `review/s2.22-michael-activation-charter-closeout`
- Predecessors: S2.11 First Activation Charter; S2.12–S2.20 inert runtime chain; S2.21 Inert Runtime Readiness Decision Gate (PASS WITH CONDITIONS)

> This document is a DRAFT proposal. It approves nothing, mounts nothing, persists
> nothing, and generates nothing. It describes a *future*, separately-approved
> activation boundary so Kevin has a single artifact to read before any Sprint 3
> activation decision. No code, route, mount, persistence, LLM, or voice surface is
> created or authorized by this charter.

## 1. Purpose of the Future Activation Proposal

The purpose of this charter is to define — in advance and in one place — the exact
boundary inside which Michael Magnificent *could* one day be activated as a live,
BA-facing training-support helper on internal `.team`, so that Kevin can evaluate the
whole shape of activation before any single piece of it is built.

It exists because S2.21 closed the S2.11–S2.20 inert runtime chain as a verified,
returned-only foundation (PASS WITH CONDITIONS) and ruled the next step to be a
*route-free, planning-only* activation charter, after which Sprint 2 closes as a sealed
inert foundation and live activation becomes a separately-approved Sprint 3. The fixed
sequence is **charter → route proposal → implementation slice**, each separately
approved by Kevin.

This charter is the first of those three steps and the only one in scope here. It is a
map of a future, not a key to it.

## 2. Explicit NON-AUTHORIZING Status

This charter authorizes nothing. Specifically:

- It does not approve a route, a mount, or any namespace.
- It does not approve persistence of any kind.
- It does not approve an LLM call, dynamic response generation, or flipping
  `agentResponseGenerated` to `true`.
- It does not approve voice, Telnyx, PSTN, or call-control.
- It does not approve live Michael behavior, nor any Steve or Ivory behavior.
- It does not approve any `.com` exposure.

Every item described below is a *proposal for a future, separate decision*. Approval of
this charter (if Kevin approves it at all) is approval of the **plan to seek approvals**,
not approval of any of those approvals. Each future step — route family, auth model,
feature flag shape, response policy, persistence policy, observability contract,
rollback owner, and the Sprint 3 charter as a whole — requires its own explicit,
recorded Kevin approval. Nothing in this document is implied consent for the next thing.

## 3. Future Activation Boundary

If Michael is ever activated, activation must remain inside this boundary:

- **`.team` only.** BA-facing internal surface (`apps/team`, port 7702) and the shared
  Express API (`server/`, port 7700). Never `apps/com` (port 7701), never prospect-facing.
- **Authenticated only.** No anonymous access. The `.team` JWT cookie scoped to
  `.teammagnificent.team` is the identity surface.
- **BA-scoped only.** A BA may only invoke Michael for their own training-support
  context; reads and any returned guidance are scoped to `req.session.baId`.
- **Internal only.** No external side effects — no send, call, schedule, prospect, or
  THREE handoff. THREE International remains the upstream authority; this system mirrors,
  never overrides.
- **No `.com`.** The five compliance prohibitions for `.com` stand absolutely: Michael
  (AI prospecting/training language) must never render on the prospect surface.

This boundary is identical in spirit to the S2.11 objective ("help an authenticated
Brand Ambassador on internal `.team` choose or continue one safe, BA-owned
training-support next step from an approved Context Packet") and is the precondition for
every later section.

## 4. Canonical Runtime Chain (modules named)

The only canonical resolution path for any future activation is the S2.17–S2.20
catalog → selector → derivation → facade chain verified at S2.21. Per Kevin's S2.21
decision, the S2.13 scenario-driven fixture harness
(`server/src/runtime/orchestration/fixtures/michaelRuntimeResponseHarness.ts` +
`michaelRuntimeResponseScenarios.ts`) is retained as a **test-only fixture harness** and
is explicitly **not** part of the activation path.

Canonical chain, upstream to downstream:

1. **Context-Manager-assembled Context Packet** — `context_packet.v1`, assembler
   `metadata.generatedBy = context_manager` only; candidate/review-only knowledge
   excluded and fail-closed.
2. **Runtime Turn** — the inert turn envelope carrying agent/task/session/turn/
   correlation identity, consumed by the adapter.
3. **Michael adapter contract** —
   `server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts` (with the agent
   adapter `server/src/runtime/orchestration/adapters/michaelMagnificentAdapter.ts`);
   `michael_magnificent` / `training_support` only; enforces status→responseType mapping
   and the adapter-level `failed → safe_close`.
4. **Selection-request derivation** —
   `server/src/runtime/orchestration/michaelResponseSelectionRequest.ts`
   (`deriveMichaelResponseCatalogSelectionRequest*`), reading only
   `responseType` / `contextPacketStatus` / `language` off the already-inert adapter
   response so request and response cannot diverge.
5. **Catalog selector** —
   `server/src/runtime/orchestration/michaelResponseCatalogSelector.ts`
   (`selectMichaelResponseCatalogEntry`), resolving via the explicit
   `(scenarioFamily|responseType)` table and revalidating defensively.
6. **Response catalog** —
   `server/src/runtime/orchestration/michaelResponseCatalog.ts`
   (`MICHAEL_RESPONSE_CATALOG`, 12 verbatim-fixture entries; `validateMichaelResponseCatalog`),
   built on `michaelResponseContract.ts` (`validateMichaelResponseContract`) and the
   EN/ES fixtures in `fixtures/michaelResponseFixtures.ts`.
7. **Inert resolution facade** —
   `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts`
   (`resolveMichaelRuntimeTurnResponse*`), composing selector + contract validator,
   returning the fixture **by reference**, never throwing.
8. **Redacted trace** — `buildTrace` inside the facade: redacted classification metadata
   plus `persistence: 'disabled'` and `agentResponseGenerated: false` only; never spreads
   the response or packet; carries no session/turn/correlation IDs, no generated text, no
   raw upstream payload, no prospect PII.

Any future activation must drive *only* this chain. No alternate resolution surface may
be wired into an activation path.

## 5. Required FUTURE Route Family Proposal (describe — do NOT implement)

This section describes a route family for Kevin to consider. It is **not** implemented
here, and nothing about it is decided.

Grounding in how this repo actually mounts gated BA routes
(`server/src/index.ts`): there are three mount zones — raw-body routes first, then
pre-gate routes (e.g. `/api/health`, `/api/auth`, `/api/welcome`, `/api/steve`,
`/api/admin/*`, `/api/p`), then **BA-facing gated routes mounted BELOW the marked
gated banner**. Gated route files apply the onboarding gate per-route, never globally
(e.g. `router.get('/', requireAuth, requireSteveComplete, handler)` — see
`/api/invitations`, `/api/cockpit`, `/api/crm`, `/api/ivory`, `/api/agents`).

Proposed shape for a future Michael runtime route family:

- **A gated BA route family mounted BELOW the gated banner** in `server/src/index.ts`,
  alongside the other `(requireAuth, requireSteveComplete)` route files, following the
  existing append-only mount convention (add only the import line and the mount line).
- **NOT `/api/runtime/*`.** That namespace stays unmounted and reserved; S2.21 verified
  it returns no matches anywhere, and this charter does not change that.
- **Must not collide with the existing pre-gate `/api/michael`.** `/api/michael`
  (`michaelRoutes`) is already mounted as a pre-gate onboarding route and does **not**
  import the runtime chain; a future runtime route family must use a distinct, clearly
  named namespace so the onboarding gate and the runtime helper never overlap.
- **Per-route gate, not global.** Each handler applies `requireAuth` then the onboarding
  gate middleware, matching the canonical pattern, never a router-wide `app.use` gate.

**The namespace itself is a proposal for Kevin to choose, not a decision.** Candidate
names (illustrative only — none selected): a dedicated BA-facing training-support
namespace under `/api/...`. Kevin chooses whether any route is mounted at all and, if so,
its exact namespace, before any route code is written.

**Naming-reconciliation note (tracked):** the predecessor charters and `CLAUDE.md`
reference a `requireMichaelComplete` gate, but the gate that actually exists on disk is
`server/src/middleware/requireSteveComplete.ts` (Steve is the onboarding gate; Michael is
the runtime training-support agent). Any future route proposal must reconcile this
naming explicitly — choose the actual middleware that enforces "onboarding complete"
(`requireSteveComplete` today) and not assume a `requireMichaelComplete` symbol exists.
This is a documentation/identity item for Kevin to resolve in the route-proposal step,
not a wiring change made here.

## 6. Required Auth Model Proposal

Proposed auth model for any future Michael runtime route (for separate approval):

- **`requireAuth`** — authenticated BA session required; `.team` JWT cookie scoped to
  `.teammagnificent.team`; no anonymous access.
- **Onboarding-complete gate** — the per-route "onboarding complete" middleware
  (`requireSteveComplete` as it exists today; see the §5 reconciliation note), applied
  per-handler below the gated banner.
- **BA ownership / BA scope** — every invocation is scoped to `req.session.baId`. The BA
  may only request Michael training support for their own context; sponsor/BA-id scoping
  is derived from the session, **never** from the request body (consistent with
  locked-spec 3.5 and sponsor immutability). No cross-BA reads.
- **No `.com` cookie path.** The prospect `.teammagnificent.com` cookie must never
  satisfy this gate; Michael is `.team`-only.

This mirrors S2.21 Required Decision 2 (route family + auth model) and remains a proposal
pending Kevin's explicit approval.

## 7. Required Feature Flag / Kill Switch

Any future activation must ship behind a default-off kill switch defined before live
exposure:

- **Default OFF.** Activation is disabled unless explicitly enabled; absence of the flag
  means inert.
- **Independently toggleable, three axes:**
  - **route-disable** — disable route handling if a route is later approved;
  - **response-disable** — disable response generation independently of the route;
  - **trace-disable** — disable redacted-trace emission independently.
- **Env-driven.** Flags read from environment (consistent with the repo's env-loader
  convention); no hardcoded enable.
- **Fail-closed.** On any flag-read failure, unknown state, or partial configuration, the
  surface behaves as disabled and returns a safe disabled response shape with no external
  side effects.
- **Test-covered.** Each disable path must be covered by tests before live exposure.

This extends S2.11 §9 and S2.21 Required Decision 5; the exact flag names and shape are a
proposal for Kevin to ratify.

## 8. Required Response-Generation Policy

- **Fixtures-only by default.** Responses come from the pre-authored
  `MICHAEL_RESPONSE_CATALOG` via the selector + contract validator, returned by reference
  through the facade. No text-generation engine.
- **`agentResponseGenerated: false`** remains the literal value at every result boundary.
- **No dynamic generation without separate approval.** No Anthropic/ScriptMaker/Ivory or
  any LLM call may be introduced into the Michael path, and `agentResponseGenerated` may
  not flip to `true`, without a distinct, recorded Kevin approval covering generation
  scope and the ES content-scanner question (S2.21 Condition 2).
- **Contract strictness tracking.** Per S2.21 Condition 3, `failed → safe_close` is
  adapter-enforced, not contract-enforced; if any non-adapter contract consumer is ever
  introduced, contract-level strictness must be added first.

## 9. Required Persistence Policy

- **Disabled by default.** Every persistence discriminant remains the literal
  `'disabled'`; envelopes are returned in memory only.
- **No persistence of any artifact without separate approval** — specifically no
  persistence of events, outcomes, Guided Actions, responses, sessions, transcripts, or
  logs.
- If persistence is ever approved, it must (per repo rule) write through the triple-stack
  helper (`tripleStackWrite()` → MongoDB + Neo4j + ChromaDB via Universal Gateway V2) and
  honor the GraphRAG schema contract — but that is a separate, separately-approved
  undertaking, not authorized here.

This mirrors S2.11 §12–§13 and S2.21 Required Decision 4.

## 10. Required Observability Policy

- **Returned-only redacted trace first.** Observability begins with the existing
  returned-only redacted trace (`buildTrace`); no log sink, no store, no external
  telemetry without separate approval.
- **No raw Context Packet.** The trace must never spread or embed the packet or the
  response.
- **No PII.** No prospect PII, no private journal/relationship text, no raw retrieval
  results.
- **No tokens / IDs.** No session, turn, or correlation IDs; no cookies, secrets, or
  access tokens in any emitted trace.
- Trace contents stay limited to redacted classification metadata plus
  `persistence: 'disabled'` and `agentResponseGenerated: false`.

This mirrors S2.11 §11 and S2.21 Required Decision 6; any move to log-only or stored
observability requires its own approval with these redaction rules intact.

## 11. Required Rollback Owner + Rollback Steps

- **Rollback owner — to be named before any activation.** A single accountable owner must
  be designated in the route-proposal/implementation step (S2.21 Required Decision 7);
  this charter does not name one and does not authorize one.
- **Rollback steps (proposed):**
  1. **Flag off** — set the kill switch to its default-off state (route-disable +
     response-disable + trace-disable) to make the surface inert immediately.
  2. **Redeploy** — redeploy the server with the flag off so the inert state is the
     running state.
  3. **Verify inert** — confirm: no route handles requests (or route unmounted), no
     response generated (`agentResponseGenerated: false`), no persistence occurred
     (`persistence: 'disabled'`, no inserts/updates/saves), `.com` untouched,
     `/api/runtime/*` still unmounted, and rerun all four merge gates
     (`pnpm build:shared`, `pnpm typecheck`, `pnpm build`,
     `pnpm --filter @momentum/server test`).

## 12. Required Gate Checklist Before ANY Sprint 3 Activation Implementation

All of the following must be true and recorded before a single line of activation
implementation is written:

- [ ] **Gates green** — `pnpm build:shared`, `pnpm typecheck`, `pnpm build`, and
      `pnpm --filter @momentum/server test` all pass on the working branch.
- [ ] **Governance-boundary tests green** — the Michael-chain governance/boundary specs
      (e.g. `s213…`, `s215…`, `s220…GovernanceBoundary`, guardrails, ES safe-paths,
      exhaustiveness, negative-space) all pass.
- [ ] **Charter approved** — this activation boundary charter is explicitly approved by
      Kevin.
- [ ] **Route proposal approved** — the exact route family + namespace + auth model
      (§5–§6), including the `requireSteveComplete` naming reconciliation, is explicitly
      approved by Kevin.
- [ ] **Kill switch verified** — default-off, three independent disable axes, env-driven,
      fail-closed, and test-covered (§7).
- [ ] **Rollback owner named** — a single accountable owner is designated and the
      rollback steps (§11) are agreed.

Approving this charter does not check any of these boxes; they are checked in their own
separate, recorded approvals.

## 13. Explicit Non-Approval Statement

This charter approves nothing for activation. Restated for the record:

- **No route approved** — including any `/api/runtime/*`, any new `.team` Michael runtime
  endpoint, or any reuse of the existing pre-gate `/api/michael` for the runtime chain.
- **No persistence approved** — no events, outcomes, Guided Actions, envelopes,
  responses, sessions, transcripts, or logs.
- **No LLM approved** — no Anthropic/ScriptMaker/Ivory or any dynamic response
  generation; `agentResponseGenerated` stays `false`.
- **No voice approved** — no browser voice, Telnyx, PSTN, or call-control.
- **No live Michael behavior approved.**
- **No Steve or Ivory behavior approved.**
- **No `.com` exposure approved.**

S2.22 is a planning-only, non-authorizing charter draft over a verified inert foundation.
Any activation remains a separate, separately-gated, separately-approved undertaking, in
the fixed order **charter → route proposal → implementation**, each requiring Kevin's
explicit approval. The open S2.21 conditions (ES content scanner; contract-level
`failed → safe_close` strictness) remain open and are explicitly not resolved here.

---

This is a DRAFT charter authored by Agent A. It is not the final S2.22 report (owned by
Agent E). No production code, test, route, UI, `.com`, ratified document, persistence
adapter, or Gateway fallback was modified, and nothing was committed.
