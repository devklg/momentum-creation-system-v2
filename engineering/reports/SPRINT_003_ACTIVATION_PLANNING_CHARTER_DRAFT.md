# Sprint 3 Activation Planning Charter Draft

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.1 Activation Planning Charter (foundation draft)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no build/LLM/DB run)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent A (S3.1 charter-foundation draft input — does NOT own the final S3.1 report; that is Agent E)
- Branch: `planning/s3.1-activation-planning-charter`
- Inputs:
  - `SPRINT_002_S2_22_MICHAEL_ACTIVATION_PROPOSAL_CHARTER_AND_CLOSEOUT_GATE.md` (Sprint 2 closeout gate + activation-proposal charter)
  - `S2_22_SPRINT_003_ACTIVATION_OPTIONS_REVIEW.md` (Sprint 3 activation options; recommends charter-first)
  - `SPRINT_002_S2_11_MICHAEL_FIRST_ACTIVATION_CHARTER.md` (format/tone precedent)

> This is a planning/governance foundation draft. It approves nothing for
> activation, mounts nothing, persists nothing, generates nothing, and changes no
> production code. It is the FOUNDATION for the Sprint 3 Activation Planning
> Charter — it frames what Kevin must separately approve; it grants no approval.

## 1. Sprint 3 Purpose

Sprint 3 — Activation Planning — exists to define, in advance and in one governed
place, the path by which Michael Magnificent *could* one day be activated as a
live, BA-facing training-support helper on internal `.team`. Sprint 2 answered the
engineering question "can a runtime turn be resolved to a safe response purely,
route-free, persistence-free, and LLM-free?" — yes, via the verified inert chain.
Sprint 3 answers the governance question that the inert chain does not: "under what
exact authenticated, `.team`-only, BA-scoped boundary, with what kill-switch,
monitoring, persistence, and rollback model, and after which separately-approved
decisions, may Michael first run live?"

Sprint 3 begins with planning — not implementation. Its first deliverable is this
planning charter foundation, extending the S2.22 closeout charter from "Sprint 2 is
closed on a verified inert foundation" to "here is the governed path by which
Sprint 3 activation may be proposed." No activation slice is dispatched until the
charter, and then a route proposal, are each separately approved.

## 2. Sprint 3 Non-Authorizing Status

Sprint 3 planning is explicitly NON-AUTHORIZING. This charter — and the Sprint 3
planning slice it founds — approves nothing for activation. It proposes governance
and an approval checklist; it does not grant any approval.

Approving this charter (if Kevin does) approves only the *plan to seek approvals* —
the agreed gate and sequence — not any route, mount, namespace, persistence, LLM
call, dynamic generation, voice/Telnyx/PSTN surface, live Michael behavior,
Steve/Ivory behavior, or `.com` exposure. Each future step remains its own recorded,
separately-approved decision. Every Sprint 2 stop condition stays in force unchanged.

## 3. Relationship to Sprint 2

Sprint 2 — Agent Runtime Activation — closed (S2.22) as a **verified inert
foundation**. Despite the sprint name, no live activation occurred: the deliverable
is a pure, returned-only, route-free, non-persistent, LLM-free orchestration
substrate plus the complete Michael inert response-resolution chain, validated by
the 653/653 suite across 63 files. The chain is:

> Context Packet → Runtime Turn → Michael Adapter Contract → Selection-Request
> Derivation → Catalog Selector → Catalog Entry → Validated Response Fixture →
> Inert Resolution Facade → Redacted Trace.

Sprint 3 is **activation planning first** — it does **NOT** begin with
implementation. The inert foundation is complete and well-defended; the remaining
work is a governance question (whether, when, and under what boundary Michael
becomes live) plus carried conditions that gate *live* behavior, not *planning*.
Sprint 3 builds on Sprint 2's foundation by deciding the activation governance
before any activation code exists — consistent with the repo's decision-currency
rule (decision ledger > spec > code).

## 4. Fixed Approval Sequence

The sequence Kevin ratified at S2.21 close and reaffirmed at S2.22 stands, and
Sprint 3 is bound by it:

> **Sprint 3 planning charter → route proposal → implementation slice — each
> separately approved by Kevin.**

- **Link 1 — planning charter.** This charter. Defines the activation governance
  and the approval checklist. Authorizes nothing.
- **Link 2 — route proposal.** Proposes the exact gated BA route family, namespace,
  auth model, kill-switch, and DTO shape — only after the charter is ratified.
  Proposes, does not mount.
- **Link 3 — implementation slice.** A minimal internal route implementation —
  only after both the charter and the route proposal are separately approved, and
  only under its stated constraints.

No step is implied by approving the prior one. Approving the charter does not
approve a route; approving a route proposal does not approve a mount or live
behavior.

## 5. Canonical Activation Path

If Michael is ever activated, activation must drive **only** the single canonical
resolution chain locked in Sprint 2:

> **S2.17 catalog → S2.18 selector → S2.19 derivation → S2.20 facade.**

Concretely: the Context-Manager-assembled `context_packet.v1` → Runtime Turn →
Michael adapter contract (`michaelRuntimeAdapterContract.ts`) → selection-request
derivation (`michaelResponseSelectionRequest.ts`, S2.19) → catalog selector
(`michaelResponseCatalogSelector.ts`, S2.18) → response catalog
(`michaelResponseCatalog.ts`, S2.17 — verbatim-fixture entries on
`michaelResponseContract.ts`) → inert resolution facade
(`michaelRuntimeResolutionFacade.ts`, S2.20 — returns the fixture by reference,
never throws) → redacted trace (`buildTrace`).

No alternate resolution surface may be wired into an activation path. Any future
activation must consume this chain and no other.

## 6. S2.13 Fixture Harness Status

The S2.13 scenario-driven fixture harness
(`fixtures/michaelRuntimeResponseHarness.ts` +
`fixtures/michaelRuntimeResponseScenarios.ts`) is **TEST-ONLY, retained, and NOT
part of any activation path.** Per Kevin's recorded S2.21-close ruling, it is kept
(not scheduled for retirement) and explicitly documented as a test-only harness.

It is consumed only by `__tests__` files plus append-only barrel re-exports — zero
route, UI, service, or persistence consumers — and it resolves a response via a
single direct `scenarioName → responseFixtureKey` map that bypasses the
governance-bearing selector/derivation/facade links. For that reason it must never
appear on an activation path. All activation routes through the S2.17–S2.20 chain
(see §5). This is a standing constraint, not an open question.

## 7. Sprint 3 Boundaries

If Michael is ever activated, activation must remain inside this boundary:

- **`.team` only.** BA-facing internal surface (`apps/team`, port 7702) + the
  shared Express API (`server/`, port 7700). Never `apps/com` (port 7701), never
  prospect-facing.
- **Authenticated only.** No anonymous access; the `.team` JWT cookie scoped to
  `.teammagnificent.team` is the identity surface.
- **BA-scoped only.** A BA may invoke Michael only for their own training-support
  context; reads and returned guidance are scoped to `req.session.baId`, never to a
  request-body BA id (consistent with sponsor immutability). No cross-BA reads.
- **Internal only.** No external side effects — no send, call, schedule, prospect,
  or THREE handoff. THREE International remains the upstream authority; this system
  mirrors, never overrides.
- **No `.com`.** The five `.com` compliance prohibitions stand absolutely; Michael
  (AI training/prospecting language) must never render on the prospect surface.

## 8. Explicit Non-Approval Statement

This charter approves nothing for activation. Restated for the record:

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
- **No direct agent access approved** to MongoDB, Neo4j, ChromaDB, GraphRAG, direct
  adapters, Gateway fallback clients, or raw retrieval helpers; Context Manager
  remains the only Context Packet assembler.
- **No carried condition resolved** by this charter (see §9).

Sprint 3 planning is a non-authorizing charter over a verified inert foundation.
Any activation remains a separate, separately-approved undertaking in the fixed
order charter → route proposal → implementation.

## 9. Conditions Carried Into Sprint 3

These items are carried forward, charter-named, and NOT closed by this charter.
Each gates the specific live behavior it protects:

- **ES content scanner.** The prohibited-text patterns and the safe-close
  substantive-guidance guard are English-lexicon-only (numeric/currency triggers
  are language-agnostic; Spanish lexical equivalents are not in the set). Not
  required for the inert fixtures-only foundation — ES safety today rests on fixture
  authoring discipline + governance review over a fixed catalog, with every entry
  still run through the English scanner. It is a **hard prerequisite before any live
  (non-fixture) Spanish generation** (before `agentResponseGenerated` could ever
  flip to `true` for an `es` response).
- **`failed → safe_close` contract strictness.** The adapter enforces
  `failed → safe_close`; the response contract alone permits
  `failed → safe_fallback OR safe_close` (it has a `rejected`-specific `safe_close`
  rule but no equivalent `failed` rule). No live gap today — the entire S2.17–S2.20
  chain routes exclusively through the adapter. Contract-level strictness (a
  `failed_context_requires_safe_close` rule mirroring the existing
  `rejected_context_requires_safe_close` clause) is a **prerequisite before any
  non-adapter contract consumer** is introduced.
- **`requireSteveComplete` / `requireMichaelComplete` naming reconciliation.** On
  disk the onboarding gate is `requireSteveComplete.ts`; there is **no**
  `requireMichaelComplete`. `/api/michael` (`michaelRoutes`) is ALREADY mounted as a
  PRE-GATE onboarding route and does NOT import the runtime chain. In this repo
  **Steve is the onboarding gate; Michael is the runtime training-support agent.**
  Any future runtime route proposal must (1) reconcile this naming explicitly —
  use the actual `requireSteveComplete` middleware, not assume a
  `requireMichaelComplete` symbol — and (2) use a namespace distinct from the
  pre-gate `/api/michael`, keeping `/api/runtime/*` unmounted. This is a
  documentation/identity reconciliation item for the route-proposal step.
- **Future Kevin-only activation decisions.** The activation boundary, route family
  + namespace, auth model, kill switch, response-generation scope, persistence
  policy, observability contract, rollback owner, and the Sprint 3 charter as a
  whole all remain separately-approved future decisions reserved to Kevin. None is
  implied by approving this charter.

## 10. Recommended Sprint 3 First Implementation Sequence (PLANNING ONLY)

The following is a PLANNING recommendation only — it proposes ordering, approves
no slice, and dispatches nothing:

- **S3.1 — Activation Planning Charter.** This planning-only charter. Defines the
  activation governance, boundary, approval checklist, and carried conditions.
  Authorizes nothing. (This document is its foundation draft; Agent E owns the final
  S3.1 report.)
- **S3.2 — Route Proposal.** Only after S3.1 is approved. Proposes the exact gated
  BA route family, namespace (NOT `/api/runtime/*`, distinct from pre-gate
  `/api/michael`), auth model (`requireAuth` + the on-disk onboarding-complete gate,
  with the naming reconciliation of §9 resolved), default-off kill switch, and the
  inert S2.20 serialization/DTO shape. Proposes, does not mount. Requires separate
  Kevin approval.
- **S3.3 — Pre-implementation hardening (IF required).** Only if the route proposal
  or a separately-approved live-behavior decision calls for it: targeted inert
  follow-ups such as the ES content scanner (before live Spanish generation) or the
  `failed → safe_close` contract strictness (before a non-adapter consumer). Not a
  prerequisite to writing or approving the charter; addressed only when the
  governance calls for the corresponding capability, to avoid inert-hardening
  theater.
- **S3.4 — Minimal route implementation (IF separately approved).** Only after S3.1
  and S3.2 are both approved (and S3.3 satisfied if required). A minimal internal
  route implementation — `.team`-only, authenticated, BA-scoped, no persistence, no
  LLM, fixtures-only — returning inert fixture resolutions by reference behind a
  default-off kill switch. Requires its own separate Kevin approval.

Each slice is a distinct, separately-approved step. No slice is authorized by this
charter.

## Explicit Non-Actions (Stop Conditions for this draft)

This foundation draft did not, and S3.1 planning does not:

- approve, charter, or begin any activation, route, route proposal, route
  implementation, persistence, LLM, voice, or dynamic-generation work;
- write the final S3.1 report (Agent E owns that);
- create any route proposal or any route (this draft only founds the planning
  charter and recommends the sequence);
- resolve the ES content scanner, the `failed → safe_close` contract strictness,
  or the `requireSteveComplete`/`requireMichaelComplete` naming reconciliation;
- modify any production code, test, route, UI, `.com`, ratified document,
  persistence adapter, or Gateway fallback;
- run builds, typecheck, tests, LLMs, or any database;
- mount routes or `/api/runtime/*`;
- activate Michael, Steve, or Ivory behavior;
- commit, or mutate git history or any database.

This report is the only file written by Agent A for S3.1.
