# Sprint 3 S3.2 Michael Route Proposal

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.2 Michael Route Proposal — final integration of the FUTURE Michael runtime route proposal (namespace, route shape, auth, kill switch, observability, preconditions) over the verified inert Michael runtime foundation
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (gate commands were run read-only; no production code, tests, routes, UI, or `.com` modified; no route created or mounted; `server/src/index.ts` untouched; no commit; no LLM/DB access)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent E (final integration + route-proposal agent — owns this verdict)
- Branch: `planning/s3.2-michael-route-proposal`
- Inputs (read in full, not modified):
  - Agent A — `engineering/reports/S3_2_ROUTE_NAMESPACE_PROPOSAL_REVIEW.md` (namespace analysis + single recommendation)
  - Agent B — `engineering/reports/S3_2_AUTH_AND_BA_SCOPE_PROPOSAL_REVIEW.md` (auth + BA-scope model)
  - Agent C — `engineering/reports/S3_2_FEATURE_FLAG_KILL_SWITCH_OBSERVABILITY_PROPOSAL.md` (feature flag / kill switch / observability)
  - Agent D — `engineering/reports/S3_2_ROUTE_SAFETY_PRECONDITIONS_REVIEW.md` (route safety preconditions + S3.3-blocker analysis)
  - Predecessor charter — `engineering/reports/SPRINT_003_S3_1_ACTIVATION_PLANNING_CHARTER.md`

> This is a planning/governance route proposal. It synthesizes the four S3.2 input
> reviews into one record Kevin reads as the second link of the Sprint 3 approval
> sequence (charter → route proposal → implementation). It is explicitly
> NON-AUTHORIZING: it proposes a single concrete route spec for Kevin's separate,
> recorded approval; it approves nothing, mounts nothing, creates no route file,
> persists nothing, generates nothing, and changes no production code. Approving this
> proposal (if Kevin does) approves only the route spec of record — not the
> implementation, not the mount, not any live Michael behavior.

## 1. Executive Result

**PASS WITH CONDITIONS.**

S3.2 is a route-free, planning-only proposal slice over the verified inert Michael
runtime chain. The namespace is analyzed and a single option recommended (Agent A), the
auth + BA-scope model is reviewed and grounded on disk (Agent B), the default-off
three-axis kill switch and returned-only observability contract are defined (Agent C),
and the route safety preconditions plus the S3.3-blocker analysis are settled (Agent D).
All four merge gates are green on this branch and the focused Michael-chain command
passes, matching the **653/653** baseline exactly — confirming this slice changed no
code.

The verdict is PASS **WITH CONDITIONS** because this is a planning slice that proposes a
route spec for separate approval and carries forward conditions that must be tracked and
separately resolved before any future activation. The carried conditions are:

- **Condition 1 — Namespace is a PROPOSAL, not a decision.** `/api/michael-runtime/*`
  is recommended (§7); Kevin must ratify it as its own recorded decision before any
  implementation. See §7, §8.
- **Condition 2 — Gate-name reconciliation (carried from S3.1 Condition D).** The
  onboarding gate on disk is `requireSteveComplete`; there is no `requireMichaelComplete`.
  The proposal binds to the real gate; no middleware is created or renamed in S3.2. See
  §10, §11.
- **Condition 3 — ES content scanner (open).** Not required for a fixtures-only route;
  a hard prerequisite before any live (non-fixture) Spanish generation. See §17.
- **Condition 4 — `failed → safe_close` contract strictness (open).** Adapter-enforced
  today; no live gap. Required before any non-adapter contract consumer. See §18.
- **Condition 5 — Kevin-only decisions before S3.4 (open).** The eleven implementation
  preconditions reserved to Kevin remain unresolved. See §19.

No production change is approved by this proposal. This report does not mount a route,
create a route file, persist, activate, or generate anything.

## 2. Proposal-Only Confirmation

This document is **proposal-only.** It recommends a single route spec (namespace,
method/path, request/response/disabled shapes, auth chain, kill switch, observability,
rollback) for Kevin's separate, recorded approval. Nothing here becomes a decision by
virtue of this document. Consistent with the repo decision-currency rule (decision
ledger > spec > code) and Kevin's fixed sequence (**charter → route proposal →
implementation, each separately approved**), S3.1 (the ratified charter) is the prior
link and this S3.2 proposal grants nothing beyond a recommendation.

## 3. No Code Changed

**No production code was changed.** No `.ts` source, middleware, service, route, type,
contract, or test file was created, edited, renamed, reordered, or deleted. The four
gate commands were run read-only; they emit build artifacts under each workspace `dist/`
(unchanged behavior) but mutate no source. The results match the established baseline
exactly, which is positive evidence the foundation remains inert and unchanged.

## 4. No Route Implemented

**No route is implemented by this proposal.** No route file was created in
`server/src/routes/`, no handler was written, and no router was constructed. The future
route shape in §9 is described as a contract, not coded.

## 5. No Mount Added

**No mount was added.** No `import` line and no mount line was added to
`server/src/index.ts`. The append-only shared-file rules (`server/src/index.ts`: add
only an import line + a mount line between the marked banners; never edit existing lines)
are not exercised here because nothing is mounted.

## 6. `server/src/index.ts` Untouched

**`server/src/index.ts` is untouched.** No existing line was edited, reordered, or
removed; no new line was added. `/api/runtime/*` remains unmounted and reserved (zero
matches), the pre-gate `/api/michael` onboarding mount is unchanged, and the boot order
(raw-body Telnyx first; pre-gate block; gated banner) is preserved exactly.

## 7. Proposed Route Namespace

**Recommended namespace: `/api/michael-runtime/*` (Agent A option N-1).**

This is a recommendation for Kevin's separate approval, not an adoption. Rationale
(carried from Agent A §6–§7):

- **Distinct from `/api/michael`.** A separate top-level prefix, not a child or
  extension of the pre-gate onboarding namespace. The `-runtime` suffix makes the
  separation legible: `/api/michael` = onboarding/training-support card;
  `/api/michael-runtime` = the inert resolution-chain surface.
- **Not `/api/runtime/*`.** It does not revive the reserved, prohibited namespace; it
  shares no path segment with `/api/runtime`.
- **`.team`-only, gated BA family.** Intended to mount below the gated banner alongside
  the other `(requireAuth, requireSteveComplete)` BA-facing families; the prospect
  `.com` cookie can never satisfy its gate.
- **Collision-free + convention-fit.** It matches the repo's agent-named file
  convention (`michael.ts`/`steve.ts`/`ivory.ts` → `michael-runtime.ts`) and collides
  with no existing mount.

## 8. Rejected Namespace Options (with reasons)

| Option | Candidate | Rejected because |
|---|---|---|
| N-2 | `/api/training-support/runtime` | "training-support" is already the semantic of the existing `GET /api/michael/training-support/:downlineBaId` card, **and `/api/training` (Fast Start) is ALREADY mounted** (index.ts line 213). The name collides on meaning with two live surfaces and misleads maintainers about which "training" concern it serves. |
| N-3 | `/api/team/michael` | Introduces an `/api/team/*` segment no other route uses; the segment is redundant since every gated route below the banner is already `.team`/BA-scoped. Adds a one-off structural pattern with no information. |
| N-4 | `/api/agents/michael` | **`/api/agents` is ALREADY mounted** (index.ts line 207, `agentRoutes`, the Agent Orchestration recommendation feed). Nesting the Michael runtime chain under it overloads an occupied namespace with different semantics and ownership — the exact collision class the distinct-namespace rule exists to prevent. |
| Discovered | `/api/michael/runtime` (nested under existing) | A child of the pre-gate `/api/michael` onboarding namespace; directly violates the no-reuse/extend/overload rule. Rejected on principle. |
| Prohibited | `/api/runtime/*` | Unmounted, reserved, and prohibited (zero matches in `server/src/index.ts`). The route proposal must not revive it. |
| Prohibited | reuse of `/api/michael` | The pre-gate onboarding/training-support route; must NOT be reused, extended, or overloaded for the runtime chain. |

## 9. Proposed FUTURE Route Shape (described, NOT implemented)

Defined as a contract for the implementation step, aligned to the S2.20 facade result
(`server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts`). **Nothing below
is coded, mounted, or approved.**

- **Method / path:** `POST /api/michael-runtime/resolve`
  - POST because the request carries a runtime-turn / adapter-contract input body; the
    operation is a pure resolution, returned-only, with no persistence and no external
    side effect.
  - Per-route gate chain (proposed, not implemented): `requireAuth`, then the
    onboarding-complete middleware that exists on disk (`requireSteveComplete`), applied
    per-handler — never a router-wide `app.use` gate.

- **Request shape (proposed):**
  ```
  POST /api/michael-runtime/resolve
  {
    // adapter-contract input for the canonical chain (S2.19 derivation source).
    // Identity/turn/task fields are validated by the derivation step.
    // NO baId / sponsorBaId in the body — BA scope is derived from
    // req.session.baId server-side; any body-supplied BA id is rejected/ignored.
    turn: { /* MichaelRuntimeAdapterContractInput, per runtime/orchestration/types */ }
  }
  ```

- **Response shape (enabled) — aligned to the S2.20 facade success result:**
  ```
  200 OK
  {
    "ok": true,
    "selectionRequest": { /* MichaelResponseCatalogSelectionRequest */ },
    "catalogKey": "<string>",
    "response": { /* MichaelResponseContract fixture, returned BY REFERENCE */ },
    "trace": {
      "classification": { "scenarioFamily", "responseType", "language", "intent?" },
      "selectionRequest": { /* redacted classification metadata only */ },
      "catalogKey": "<string>",
      "responseType": "<string>",
      "contextPacketStatus": "<string>",
      "language": "en" | "es",
      "persistence": "disabled",
      "agentResponseGenerated": false
    }
  }
  ```
  The trace is the existing returned-only redacted trace (`buildTrace`): redacted
  classification metadata plus the standing literals `persistence: 'disabled'` and
  `agentResponseGenerated: false`. It never embeds the raw Context Packet, the response
  body, PII, or any session/turn/correlation/pool IDs. Resolution failures from the
  facade surface as a deterministic `{ ok: false, issues: [...] }` shape, never a throw.

- **Disabled response shape (kill switch tripped / fail-closed) — a safe, fail-closed
  payload with NO response body and NO trace:**
  ```
  503 Service Unavailable   (route-disable)
  {
    "ok": false,
    "disabled": true,
    "reason": "michael_runtime_disabled"
    // NO "response", NO "trace", NO catalogKey, NO selectionRequest
    // NO external side effect, NO persistence, NO generation
  }
  ```
  Per Agent A/Agent C: a 503 with **no body content** (no `response`, no `trace`, no
  `catalogKey`, no `selectionRequest`) on the route-disable axis. The companion
  authorization failure shapes (Agent B §14) round out the surface: **401** (no/invalid
  `.team` cookie, emitted by `requireAuth`), **403 `STEVE_GATE_CLOSED`** (onboarding
  incomplete, emitted by `requireSteveComplete`), **403 `NOT_SPONSOR` / 404** (wrong BA
  scope on any sponsor-facing read), and **503 `MICHAEL_RUNTIME_DISABLED`** (flag off /
  unactivated surface).

## 10. Proposed Auth Model

For separate Kevin approval (carried from Agent B; not decided here):

- **`requireAuth`** — first middleware on every handler, applied per-route (never
  globally). Verifies the `.team` JWT cookie scoped to `.teammagnificent.team`, attaches
  `req.session: { baId, threeBaId, email }`; 401 if missing/invalid. No anonymous access;
  no `.com` cookie can satisfy it.
- **`requireSteveComplete`** — second middleware, applied per-route after `requireAuth`.
  The only onboarding-complete gate on disk; 403 `STEVE_GATE_CLOSED` until
  `isSteveDiscoveryComplete(baId)`. The runtime route must NOT be added to the
  `STEVE_GATE_WHITELIST`.
- **BA scope from `req.session.baId`** — every read/write filtered server-side on the
  session BA, mirroring `cockpit.ts`. No cross-BA reads.
- **No body-supplied BA authority** — any `baId`/`sponsorBaId` in the body/query is
  rejected or ignored (sponsor immutability); scope always falls back to the
  session-derived value. Any sponsor-facing read validates the sponsor→downline
  relationship **server-side** (403 `NOT_SPONSOR` / 404), exactly as
  `/api/michael/training-support/:downlineBaId` already does.

## 11. Gate-Name Reconciliation

**No `requireMichaelComplete` exists; no middleware is renamed in S3.2.**
`server/src/middleware/` contains exactly `og-injection.ts`, `requireAuth.ts`,
`requireSteveComplete.ts`, `verifyTelnyxWebhook.ts`. The canonical onboarding gate is
`requireSteveComplete`; `CLAUDE.md`'s references to `requireMichaelComplete` /
`MICHAEL_GATE_WHITELIST` are documentation drift (S3.1 Condition D). This proposal
reconciles that drift by **binding to the real gate** (`requireSteveComplete`) and
assuming no `requireMichaelComplete` symbol. Introducing or renaming a gate symbol would
require reconciling every existing gated route plus the `CLAUDE.md`/charter references
and is **out of scope for S3.2** — no middleware is created, renamed, or modified here.

## 12. Feature Flag / Kill Switch Proposal

Carried from Agent C / charter §11. Any future activation must ship behind a
default-off, env-driven, fail-closed kill switch with **three independent disable axes**.
Candidate env var names (PROPOSALS only — Kevin chooses/renames; no value is set):

| Candidate env var (proposal) | Axis | Unset / unreadable / malformed |
|---|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | Route-disable | disabled |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | Response-disable | disabled |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | Trace-disable | disabled |

- **Default OFF** — the surface is inert unless explicitly enabled; absence of a flag =
  disabled; no hardcoded enable anywhere.
- **Env-driven** — read via the repo env-loader convention (walk up to the
  `pnpm-workspace.yaml` marker; never `import.meta.url` path math). Never sourced from
  bodies, query params, headers, or DB rows.
- **Route-disable** — the route handles no request work; returns the §9 safe disabled
  shape before any derivation/selection/persistence/trace; no call into the S2.17–S2.20
  chain.
- **Response-disable** — even if the route answers, no `response` payload is produced;
  `agentResponseGenerated` stays the literal `false`.
- **Trace-disable** — no `trace` field is emitted even when a response is produced;
  `buildTrace` output is not attached, logged, or persisted.
- **Fail-closed** — on any flag-read failure, unknown/ambiguous state, malformed value,
  or partial config on any axis, that axis behaves as **disabled** (safe shape, no side
  effect, no persistence, no generation, no trace). Proposed parsing rule: only the exact
  string `"true"` enables an axis; every other value disables it. Each disable path and
  the off-by-default behavior must be test-covered before any live exposure.

## 13. Observability Proposal

Carried from Agent C / charter §14. Observability begins and ends, for the first
activation, with the existing **returned-only redacted trace** (S2.20 `buildTrace`).
The route returns that trace unchanged (when trace-enabled) and adds nothing. Hard
prohibitions on the route:

- **Returned-only redacted trace** — the only observability output; nothing richer.
- **No raw Context Packet** — never spread, embedded, echoed, or summarized.
- **No response body spread into the trace** — the validated fixture `response` is never
  merged into the trace.
- **No PII** — no prospect PII, BA private journal/relationship text, or names.
- **No tokens** — no invite/access tokens, cookies, JWTs, secrets, or API keys.
- **No session / turn / correlation / pool IDs.**
- **No prospect information of any kind.**
- **No raw retrieval / store / GraphRAG / Gateway output.**
- **No log persistence** — the trace is in-memory only; not written to any log file,
  store, or the triple-stack.
- **No external telemetry** — no metrics export, APM, tracing backend, webhook, or
  third-party analytics.

Any future broadening (a log sink, a store, external telemetry) is a separate,
separately-approved decision and is **not** proposed here.

## 14. Rollback Proposal

Carried from Agent C §4 / charter §15. Operator-executable; no code change required.
A rollback owner must be named in the implementation step (this proposal names none):

1. **Flag off route** — unset / set-non-`true` `MICHAEL_RUNTIME_ROUTE_ENABLED`.
2. **Flag off response** — unset / set-non-`true` `MICHAEL_RUNTIME_RESPONSE_ENABLED`.
3. **Flag off trace** — unset / set-non-`true` `MICHAEL_RUNTIME_TRACE_ENABLED`. After
   1–3 all three axes are off — full default-off inert state.
4. **Redeploy** with all three flags off so the inert state is the running state.
5. **Re-run gates** — `pnpm build:shared`, `pnpm typecheck`, `pnpm build`,
   `pnpm --filter @momentum/server test` — confirm the **653/653** baseline (focused
   Michael-chain **272/20**).
6. **Confirm `.com` untouched** — no Michael surface renders on `apps/com` (7701).
7. **Confirm `/api/runtime/*` still unmounted** in `server/src/index.ts`.
8. **Confirm persistence disabled** — every persistence discriminant is `'disabled'`.
9. **Confirm `agentResponseGenerated: false`** at every result/trace boundary.

## 15. Canonical Runtime Path Requirement

Carried from Agent D / charter §6. The future route must call **only** the single
canonical resolution chain locked in Sprint 2:

> Context-Manager-assembled `context_packet.v1` → Runtime Turn → Michael adapter
> contract (`michaelRuntimeAdapterContract.ts`) → selection-request derivation
> (`michaelResponseSelectionRequest.ts`, S2.19) → catalog selector
> (`michaelResponseCatalogSelector.ts`, S2.18) → response catalog (S2.17) → inert
> resolution facade (`michaelRuntimeResolutionFacade.ts`, S2.20) → redacted trace
> (`buildTrace`).

Practically, **the route is a one-call consumer of the S2.20 facade**
(`resolveMichaelRuntimeTurnResponse`): it constructs the adapter-contract input from the
session-scoped turn, calls the facade, and returns the facade result. It must not
re-implement, fork, or shortcut any link. It inherits and must not weaken the facade's
safety properties: returns by reference (never clones/mutates the fixture), never throws
(deterministic `{ ok: false, issues }` on failure), builds the trace from controlled
metadata only (never spreads the response), and carries the standing literals
`persistence: 'disabled'` and `agentResponseGenerated: false`. No alternate resolution
surface (no direct selector/contract/harness call, no `/api/runtime/*` revival) may be
wired in.

## 16. S2.13 Harness Exclusion

The S2.13 scenario-driven fixture harness
(`fixtures/michaelRuntimeResponseHarness.ts` + `fixtures/michaelRuntimeResponseScenarios.ts`)
is **TEST-ONLY, retained, and NOT on any activation path.** It resolves a response via a
direct `scenarioName → responseFixtureKey` map that bypasses the governance-bearing
adapter/derivation/selector/facade links. **The future route must NOT import it** — a
route-file import of either harness module is an automatic fail and a hard, testable
implementation blocker. The S3.4 route imports only the S2.20 facade (and its composed
chain), never the harness.

## 17. ES Scanner Condition

**Not required for a fixtures-only route; required before live Spanish generation.** The
prohibited-text patterns and the safe-close substantive-guidance guard in
`michaelResponseContract.ts` are English-lexicon-only (numeric/currency triggers are
language-agnostic). On the inert fixtures-only path no text is generated — the facade
returns pre-authored fixtures by reference, and every `es` fixture is still run through
`validateMichaelResponseContract`; ES safety rests on fixture-authoring discipline plus
governance review over a fixed catalog. The English-only lexical gap is reachable only
when live (non-fixture) Spanish text could be produced — i.e. before
`agentResponseGenerated` could flip to `true` for an `es` response. A fixtures-only,
facade-routed route never reaches that trigger. The 12-term ES floor in charter §16 is a
documented starting set for if/when Kevin approves the scanner; no scanner is approved or
implemented here.

## 18. `failed → safe_close` Strictness Condition

**Not required if the route uses the facade/adapter only; required before a non-adapter
consumer.** The adapter (`runMichaelRuntimeAdapterContract`) enforces `failed →
safe_close` (`block_substantive` OR `packetStatus === 'failed'` → `safe_close`), never
emitting `safe_fallback` for `failed`. The contract validator alone is more permissive
(it has `rejected_context_requires_safe_close` but no equivalent `failed` rule), so a
direct contract consumer could accept a `failed`-context `safe_fallback`. There is **no
live gap today**: the facade and the entire S2.17–S2.20 chain route exclusively through
the adapter, so `failed` always yields `safe_close`. A facade-routed route is, by
construction, an adapter consumer and does not reach the gap. Contract-level strictness
(a `failed_context_requires_safe_close` clause) becomes a prerequisite only before a
**non-adapter** contract consumer is introduced. No contract change is made or approved
here.

**Conclusion on S3.3:** S3.3 pre-implementation hardening is **NOT a prerequisite for a
fixtures-only, facade-routed S3.4.** Neither hardening condition is triggered by a route
that returns pre-authored fixtures by reference through the S2.20 facade. S3.3 stays
conditional — included only if Kevin's chosen activation scope adds a live behavior
(live/non-fixture/ES generation, or a non-adapter contract consumer) — consistent with
the charter's guard against inert-hardening theater (§19).

## 19. Kevin-Only Decisions Required Before S3.4 Implementation

Reserved to Kevin; must be recorded before any minimal route implementation begins. None
is implied by approving this S3.2 route proposal (carried verbatim in substance from
Agent D):

1. **Namespace** — the gated BA route family + namespace (recommended
   `/api/michael-runtime/*`; NOT `/api/runtime/*`; distinct from pre-gate `/api/michael`)
   and its mount position relative to the boot-order/append-only rules in
   `server/src/index.ts`.
2. **Auth / gate model** — `requireAuth` + `requireSteveComplete` (no
   `requireMichaelComplete` symbol may be assumed) + BA-scope from `req.session.baId`
   (no body-supplied `baId`/`sponsorBaId`), applied per-route never globally; BA-facing
   only.
3. **Feature flag names** — the concrete default-OFF, env-driven flag name(s).
4. **Kill switch shape** — the three independent fail-closed disable axes and who can
   trip them.
5. **Response scope** — fixtures-only vs. live (non-fixture) generation, per-language
   (EN vs. ES); this directly gates the ES scanner precondition.
6. **Persistence policy** — whether any persistence channel flips from `'disabled'`, and
   if so which, written through `tripleStackWrite()` per the triple-stack rule (all
   currently inert).
7. **Observability mode** — the returned-only redacted-trace contract, what is
   logged/traced, and what must never appear in traces.
8. **Rollback owner** — the single accountable owner of the rollback procedure.
9. **ES scanner yes/no** — approve/sequence the ES content scanner as a precondition on
   live Spanish generation.
10. **`failed → safe_close` strictness yes/no** — whether/when to add contract-level
    strictness (triggered only by a non-adapter contract consumer).
11. **Implementation approval** — the separate, explicit approval of the S3.4 minimal
    route implementation slice itself (in addition to S3.1 charter approval and S3.2
    route-proposal approval).

## 20. Recommendation for Next Slice

- **S3.3 — Pre-Implementation Hardening — only if required.** Include S3.3 ONLY if
  Kevin's chosen activation scope requires a live behavior — specifically live
  (non-fixture) **ES generation** (triggers the ES content scanner, §17) or a
  **non-adapter contract consumer** (triggers `failed → safe_close` contract strictness,
  §18). If the first implementation stays fixtures-only and adapter/facade-routed,
  neither is a blocker and S3.3 may be skipped without weakening any safety property.
- **S3.4 — Minimal Route Implementation — separately, after S3.2 approval.** If the
  first route stays fixtures-only and facade-routed, a minimal `.team`-only,
  authenticated, BA-scoped, no-persistence, no-LLM route driving only the
  catalog → selector → derivation → facade chain, returning by reference with a redacted
  trace behind the default-off three-axis kill switch, may be **proposed separately**
  after Kevin approves S3.2. S3.4 remains eligible only after S3.1 charter approval AND
  S3.2 route-proposal approval AND a separate Kevin approval of the implementation slice
  itself (and S3.3 satisfied if required).

## 21. Explicit Non-Approval Statement

This route proposal approves nothing for activation. Restated for the record:

- **No route approved** — including any `/api/runtime/*`, any new `.team` Michael runtime
  endpoint, or any reuse of the pre-gate `/api/michael` for the runtime chain. The
  `/api/michael-runtime/*` recommendation is a PROPOSAL for Kevin's separate approval.
- **No implementation approved** — no route file, no handler, no mount.
- **No mount approved** — `server/src/index.ts` is untouched.
- **No `/api/runtime/*`** mount approved; it stays unmounted and reserved.
- **No persistence approved** — no events, outcomes, Guided Actions, envelopes,
  responses, sessions, transcripts, or logs; every discriminant stays `'disabled'`.
- **No LLM approved** — no Anthropic/ScriptMaker/Ivory or any dynamic generation;
  `agentResponseGenerated` stays `false`.
- **No voice approved** — no browser voice, Telnyx, PSTN, or call-control.
- **No dynamic generation approved.**
- **No live Michael behavior approved.**
- **No Steve or Ivory behavior approved.**
- **No `.com` exposure approved** — the five `.com` compliance prohibitions stand
  absolutely.
- **No carried condition resolved** by this proposal (§7, §11, §17, §18, §19).

S3.2 is a planning-only, non-authorizing route proposal over a verified inert
foundation. Any activation remains a separate, separately-approved undertaking, in the
fixed order charter → route proposal → implementation.

## Gates Run and Results

All four merge gates were run read-only on the `planning/s3.2-michael-route-proposal`
branch with pnpm 9 / Node ≥ 22. The full server suite first showed **only** the known
transient `mongoAdapter.test.ts` parallel-load 5000ms timeout flake (1 failed / 652
passed) — unrelated to this slice, which changes no code. Per the documented procedure
the suite was re-run once and passed cleanly with **no** failures, matching the 653/653
baseline.

| Gate | Command | Exit | Duration | Result |
|---|---|---|---|---|
| Shared build | `pnpm build:shared` | 0 | ~3s | PASS |
| Typecheck | `pnpm typecheck` | 0 | ~14s | PASS (5 of 6 workspace projects scoped; all done) |
| Build | `pnpm build` | 0 | ~19s | PASS (standing Vite warnings only: `.com` dynamic/static import chunk note + `.team` >500kB chunk-size note) |
| Full server suite (run 1) | `pnpm --filter @momentum/server test` | 1 | ~12s | FLAKE — 62 files / 652 tests pass; **only** `mongoAdapter.test.ts` 5000ms timeout (pre-existing environment flake) |
| Full server suite (run 2, re-run) | `pnpm --filter @momentum/server test` | 0 | ~3s | PASS — **63 files / 653 tests**, 0 failures, no flake |

**Focused Michael-chain command** (run exactly as specified):

```
pnpm --filter @momentum/server test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary
```

- Exit 0, ~1.4s. **20 test files / 272 tests, all passing.** (vitest treats each
  argument as a filename substring filter, so the run includes the named modules plus
  their adjacent guardrail/boundary/ES/exhaustiveness/negative-space specs — the intended
  broad Michael-chain sweep.)

Results match the S3.1 charter / S2.22 closeout baseline (653/653 across 63 files;
focused 272/20) exactly, confirming S3.2 changed no code and the chain remains green on
this branch.

---

This is the final S3.2 Michael Route Proposal (Agent E). Planning / governance /
documentation only; gate commands were run read-only. No production code, test, route,
route file, mount, UI, `.com`, ratified document, persistence adapter, or Gateway
fallback was modified; `server/src/index.ts` is untouched; nothing was committed. This
proposal is NON-AUTHORIZING.
