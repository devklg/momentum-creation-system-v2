# S3.1 Michael Activation Boundary + Auth Model Review

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.1 Activation Planning Charter — boundary + auth-model review (planning input)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; nothing mounted; no commit; no build/LLM/DB run)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent B (activation boundary + auth-model reviewer)
- Branch: `planning/s3.1-activation-planning-charter`
- Inputs:
  - On-disk verification — `server/src/index.ts`, `server/src/middleware/`, `server/src/routes/michael.ts`, `server/src/runtime/context/contextManager.ts`
  - Predecessor charter — `engineering/reports/SPRINT_002_S2_22_MICHAEL_ACTIVATION_PROPOSAL_CHARTER_AND_CLOSEOUT_GATE.md` (boundary/auth §4–§6)
  - Project rules — `CLAUDE.md` (sponsor immutability, compliance, server boot order)

> This is a planning/governance review. It approves nothing for activation, mounts
> nothing, persists nothing, and changes no production code. It analyzes the FUTURE
> Michael activation boundary and auth model and hands the analysis to Agent E, who
> owns the final S3.1 report. This document does not implement, propose-as-decided,
> or create any route.

## 0. Verification Basis (read-only, this slice)

Every claim below is grounded in files read this slice. No file was edited.

- `server/src/middleware/` contains exactly: `og-injection.ts`, `requireAuth.ts`,
  `requireSteveComplete.ts`, `verifyTelnyxWebhook.ts`. There is **no**
  `requireMichaelComplete.ts`.
- `server/src/index.ts` mounts `/api/michael` (`michaelRoutes`) at line 104, inside
  the **PRE-GATE** block (above the "BA-FACING GATED ROUTES" banner at line 154),
  alongside `/api/health`, `/api/auth`, `/api/welcome`, `/api/steve`, `/api/admin/*`,
  and `/api/p`.
- No `app.use('/api/runtime'...)` exists in `server/src/index.ts` (zero matches).
  The `server/src/runtime/**` modules exist as code in the build graph but are
  **unmounted** — reachable by no HTTP route.
- `server/src/routes/michael.ts` imports `michael-training-support` only; it does
  **not** import the runtime chain (`michaelRuntimeResolutionFacade`, adapter
  contract, selection-request, catalog selector, Context Manager). Its one route
  applies `(requireAuth, requireSteveComplete)` per-handler.
- `server/src/runtime/context/contextManager.ts` is the sole assembler of the
  `context_packet.v1` envelope (`CONTEXT_PACKET_V1_SCHEMA_VERSION`,
  `CONTEXT_MANAGER_COMPONENT = 'context_manager'`).
- Gated BA route files (`/api/cockpit`, `/api/invitations`, `/api/crm`,
  `/api/scriptmaker`, `/api/ivory`, `/api/profile`, `/api/orientation`) all mount
  below the gated banner and apply `(requireAuth, requireSteveComplete)` per-route.

## 1. `.team`-Only Activation Boundary

If Michael is ever activated, activation MUST be confined to the internal
Brand-Ambassador surface:

- **`apps/team` (port 7702)** — the BA-facing client — plus the **shared Express
  API (`server/`, port 7700)** mounted at `/api`.
- The `.team` JWT cookie scoped to `.teammagnificent.team` is the identity surface
  (shared with `apps/admin`, never with `.com`).
- Never `apps/com` (port 7701), never `apps/admin` as a Michael runtime surface,
  never any anonymous/prospect surface.

Rationale: Michael is an AI training-support helper. AI prospecting/training
language is BA-facing only by standing compliance rule (`CLAUDE.md` — "Michael is
BA-facing only, never prospect-facing").

## 2. No `.com` Exposure

The five `.com` prohibitions in `CLAUDE.md` stand absolutely and apply to any future
Michael activation:

1. No income claims / earnings / commission / cycle math.
2. No placement promises.
3. **No AI prospecting language — Michael must never render on the prospect surface.**
4. No current team head count.
5. No THREE International branding.

Concretely: the prospect `.teammagnificent.com` cookie must never satisfy a Michael
runtime gate; no Michael route may mount under `/api/p/*` or be reachable by
`apps/com`; render-time fail-closed remains in force. The `/api/p/*` family stays
auth-free and prospect-only and is out of scope for any Michael runtime route.

## 3. BA-Scoped Access Model

A future Michael runtime surface must be BA-scoped, not team-wide and not cross-BA:

- Every invocation is scoped to the authenticated BA — `req.session.baId`.
- A BA may invoke Michael only for **their own** training-support context; no BA may
  read or drive Michael for another BA's context.
- The single sponsor-facing exception already on disk (`/api/michael/training-support/:downlineBaId`)
  performs its sponsor-relationship check **server-side** (`getTrainingSupportCardForSponsor`,
  403 `NOT_SPONSOR`), deriving the requesting identity from `session.baId` — it does
  not trust a body-supplied BA id. Any future runtime route must follow the same
  server-authoritative ownership pattern (`assertOwnership`-style checks as used by
  `/api/crm`).

## 4. Context-Packet-Only Runtime Input

The Context Manager is the **only** assembler of runtime input; agents consume
packets, they do not assemble them.

- `server/src/runtime/context/contextManager.ts` is the sole producer of the
  `context_packet.v1` envelope (`CONTEXT_PACKET_V1_SCHEMA_VERSION`, component tag
  `context_manager`).
- A future Michael runtime route must accept/resolve a Context-Manager-assembled
  Context Packet as the ONLY runtime input and drive exactly the canonical inert
  chain ratified at S2.22: Context Packet → Runtime Turn → Michael adapter contract
  → selection-request derivation → catalog selector → response catalog → inert
  resolution facade → redacted trace.
- No route handler, UI, or alternate caller may hand-assemble a packet, bypass the
  Context Manager, or wire an alternate resolution surface into an activation path.
  Agents are packet **consumers** only.

## 5. Auth Model

Proposed auth model for any future Michael runtime route (for separate Kevin
approval — not decided here):

- **`requireAuth`** — authenticated BA session required; verifies the `.team` JWT
  cookie and attaches `req.session` (`server/src/middleware/requireAuth.ts`); 401 if
  missing/invalid. No anonymous access.
- **Onboarding-complete gate** — the per-route "onboarding complete" middleware
  applied per-handler below the gated banner (today this is `requireSteveComplete`;
  see §6 for the naming reconciliation).
- **BA scope derived from session** — every read/write scoped to `req.session.baId`.
- **NO BA id from the request body** — sponsor immutability (`CLAUDE.md`): scope is
  derived from the authenticated session (and, for sponsor-facing reads, validated
  server-side), never accepted from the request body. A route that receives a
  `baId`/`sponsorBaId` in the body must reject or ignore it and use the
  session-derived value.
- **Per-route, never global** — apply `(requireAuth, <onboarding gate>)` on each
  handler, matching the canonical pattern in `index.ts` (lines 154–171) and the
  existing gated route files. Never a router-wide `app.use` gate.

## 6. Gate-Name Reconciliation (verified)

**The onboarding gate on disk is `requireSteveComplete`; there is no
`requireMichaelComplete`.**

- File evidence: `server/src/middleware/` contains `requireAuth.ts` and
  `requireSteveComplete.ts` only. `requireMichaelComplete.ts` does not exist.
- `requireSteveComplete.ts` enforces a hard 403 (`code: 'STEVE_GATE_CLOSED'`) until
  `isSteveDiscoveryComplete(session.baId)` is true, with a whitelist of pre-complete
  paths. It is the project-wide canonical onboarding gate (`index.ts` lines 60–61,
  154–166; applied by `/api/cockpit`, `/api/invitations`, `/api/crm`, etc.).
- In this repo, **Steve owns onboarding (Discovery + Success Profile); Michael is the
  runtime training-support agent.** `CLAUDE.md` and some prior charters reference a
  `requireMichaelComplete` symbol that does not exist on disk — a documentation drift
  carried as S2.22 Condition D.

This is a naming/identity decision for Kevin in the route-proposal step — NOT a
wiring change made here. Options to present (Kevin's call):
- (a) **Keep `requireSteveComplete` as the canonical onboarding gate** for the future
  Michael runtime route (recommended for least churn — it is the real, tested gate);
  or
- (b) introduce/rename a gate symbol, accepting the cost of reconciling all existing
  gated routes and the `CLAUDE.md`/charter references.

Either way, the route proposal must bind to the middleware that actually enforces
"onboarding complete," not assume a `requireMichaelComplete` symbol exists.

## 7. Existing `/api/michael` Route Status

`/api/michael` (`michaelRoutes`) is a **pre-gate onboarding/training-support route, not
a runtime activation surface**, and must NOT be reused for the runtime chain.

- It is mounted in the PRE-GATE block (`index.ts` line 104, above the gated banner).
- `server/src/routes/michael.ts` exposes one route,
  `GET /training-support/:downlineBaId`, that reads Steve's profile and projects
  sponsor-facing training suggestions via `michael-training-support`. It applies
  `(requireAuth, requireSteveComplete)` per-handler.
- It does **not** import the runtime chain (no facade, adapter contract,
  selection-request, catalog, or Context Manager import).

Constraint: a future runtime route family must use a **distinct namespace**. Reusing
`/api/michael` would conflate the existing onboarding/training-support surface with
the runtime helper and is disallowed.

## 8. Future Route Namespace Constraints

For any future Michael runtime route family (constraints, plus options for Kevin —
not a decision):

- **NOT `/api/runtime/*`.** That namespace is unmounted and reserved (zero matches in
  `index.ts`). It must stay unmounted.
- **NOT the existing `/api/michael`.** Reserved for the pre-gate onboarding/
  training-support surface (§7).
- **MUST be a gated BA route family** mounted BELOW the "BA-FACING GATED ROUTES"
  banner in `index.ts`, following the append-only mount convention (add only the
  import line and the mount line; touch no existing line), with
  `(requireAuth, <onboarding gate>)` applied per-handler.
- **Candidate namespaces (options for Kevin, not a decision):** e.g.
  `/api/michael-runtime`, `/api/michael/runtime` (as a distinct gated sub-tree
  separate from the pre-gate `/training-support`), `/api/training-support/runtime`,
  or `/api/agents/michael` (alongside the existing `/api/agents` orchestration feed).
  The exact namespace is Kevin's to choose in the route-proposal step.

## 9. Required Kevin Decisions Before Any Route Proposal

None is implied by approving this review; each is a distinct, explicit approval:

1. **Activation boundary** — confirm authenticated, internal `.team`-only, BA-scoped,
   Context-Packet-only.
2. **Whether a route is mounted at all** — and, if so, the exact gated BA route
   family and namespace (NOT `/api/runtime/*`, NOT `/api/michael`).
3. **Gate-name reconciliation** — keep `requireSteveComplete` as the canonical
   onboarding gate for the runtime route, or introduce/rename a gate (§6).
4. **Auth model confirmation** — `requireAuth` + onboarding-complete gate +
   session-derived BA scope + no body-supplied BA id (sponsor immutability).
5. **Context-Packet-only input** — confirm Context Manager as the sole assembler and
   the canonical chain as the only resolution path.

(These five are the boundary/auth subset; the full Sprint 3 decision list — kill
switch, response-generation scope, persistence, observability, rollback owner, ES
scanner, contract strictness, and the Sprint 3 charter as a whole — lives in the
S2.22 closeout gate §19 and is Agent E's to consolidate, not duplicated here.)

## 10. Recommendation

Adopt this boundary/auth model as the planning input for the S3.1 charter, with no
code change and no route mounted:

- **Boundary:** authenticated, internal `.team`-only, BA-scoped, Context-Packet-only,
  no `.com` exposure — consistent with the S2.22 charter §4.
- **Auth:** `requireAuth` + the onboarding-complete gate applied per-route below the
  gated banner; BA scope derived from `req.session.baId`; **no BA id from the request
  body** (sponsor immutability).
- **Gate name:** recommend **keeping `requireSteveComplete`** as the canonical
  onboarding gate for any future Michael runtime route (it is the real, tested,
  project-wide gate; `requireMichaelComplete` does not exist) — final call is Kevin's.
- **Namespace:** a new gated BA route family with a distinct namespace — NOT
  `/api/runtime/*`, NOT the existing pre-gate `/api/michael`. Present candidate
  namespaces as options; do not decide here.

Live activation — any route, mount, persistence, LLM, voice, or live Michael
behavior — remains a separate, separately-approved Sprint 3 undertaking, in the fixed
order **charter → route proposal → implementation**.

---

This is the S3.1 boundary + auth-model review (Agent B). Planning / governance /
documentation only. No production code, test, route, UI, or `.com` was modified;
nothing was mounted; nothing was committed. The final S3.1 report is owned by Agent E.
