# Sprint 3 S3.2 Route Namespace Proposal Review

- Sprint: Sprint 3 - Michael Activation Planning
- Slice: S3.2 Route Proposal — FUTURE Michael runtime route namespace analysis + single recommendation (proposal only)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no commit; no build/LLM/DB run; no route created or mounted)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Reviewer: Agent A (S3.2 route-namespace input — does NOT own the final S3.2 report; that is Agent E)
- Branch: `planning/s3.2-michael-route-proposal`
- Inputs (read, not modified):
  - `SPRINT_003_S3_1_ACTIVATION_PLANNING_CHARTER.md` (ratified-path framing; §9 route constraints, §10 auth model)
  - `S3_1_ROUTE_PROPOSAL_AND_IMPLEMENTATION_SEQUENCE_REVIEW.md` (candidate options N-1..N-4)
  - `server/src/index.ts` (mounted route namespaces; pre-gate vs gated banner)
  - `server/src/routes/` (naming conventions)
  - `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts` (S2.20 facade result shape)

> This is a planning/governance artifact. It analyzes candidate namespaces for a
> FUTURE Michael runtime route and recommends exactly one, so Kevin can choose a
> namespace as a discrete decision. It approves nothing, mounts nothing, persists
> nothing, creates no route file, and changes no production code. The recommendation
> is a PROPOSAL for Kevin's separate approval — it is NON-AUTHORIZING. This report
> does not create the final S3.2 report (Agent E owns that); it is one input to it.

## 1. Proposal-Only Confirmation

This review is **proposal-only.** It recommends a namespace; it does not adopt one.
No namespace analyzed or recommended here becomes a decision by virtue of this
document. The recommendation in §6 is a candidate put forward for Kevin's separate,
recorded approval, consistent with the repo decision-currency rule (decision ledger >
spec > code) and Kevin's fixed sequence: **charter → route proposal → implementation,
each separately approved.** S3.1 (the charter) is the prior link; this S3.2 input
presupposes the charter is ratified and grants nothing beyond a recommendation.

## 2. No Route Implemented

**No route is implemented by this review.** No route file was created in
`server/src/routes/`, no handler was written, no router was constructed, no mount line
was added to `server/src/index.ts`, and no existing line was touched. The append-only
shared-file rules (`server/src/index.ts`: add only an import + mount line between the
marked banners; never edit existing lines) are not exercised here because nothing is
mounted. The future route shape in §9 is described as a contract, not coded.

## 3. `/api/runtime/*` Remains Prohibited

**`/api/runtime/*` stays unmounted, reserved, and prohibited.** A scan of
`server/src/index.ts` confirms zero `/api/runtime` mounts (the mounted namespaces are
`/api/telnyx`, `/api/health`, `/api/auth`, `/api/welcome`, `/api/onboarding/*`,
`/api/sponsor/*`, `/api/michael`, `/api/steve`, `/api/admin/*`, `/api/p`, `/api/p/login`,
`/api/rvm`, `/api/vm/*`, `/api/invitations`, `/api/cockpit`, `/api/crm`, `/api/crm-hub`,
`/api/scriptmaker`, `/api/ivory`, `/api/agents`, `/api/vm`, `/api/training`,
`/api/profile`, `/api/preview`, `/api/orientation`). The recommended namespace below is
explicitly NOT `/api/runtime/*`; the route proposal must not revive that namespace.

## 4. Existing `/api/michael` Must NOT Be Reused

**The existing `/api/michael` is a pre-gate onboarding/training-support route and must
NOT be reused, extended, or overloaded for the runtime chain.** Confirmed on disk:
`michaelRoutes` (`server/src/routes/michael.ts`) is mounted at `server/src/index.ts`
line 104, in the PRE-GATE block (above the "BA-FACING GATED ROUTES" banner at ~line
154), and its file header states it serves "Michael training-support suggestions only"
— it reads Steve's Success Profile and projects sponsor-facing training suggestions
(`GET /api/michael/training-support/:downlineBaId`). It does **not** import the S2.17–
S2.20 runtime chain. (Note: its single handler does apply `requireAuth` +
`requireSteveComplete` internally, but the *mount* sits in the pre-gate block and the
namespace is the onboarding-era Michael surface.) The runtime helper is a different
concern (the inert resolution chain), must live on a visibly distinct namespace, and
must never share the `/api/michael` prefix — including any nested form such as
`/api/michael/runtime`, which would still overload the onboarding namespace.

## 5. Candidate Namespace Analysis

The candidates from S3.1 (Agent D, options N-1..N-4) plus one better candidate
discovered from the repo's own route conventions:

| Option | Candidate | Convention fit | Distinct from `/api/michael`? | Collision risk | `.team`-only / gated fit |
|---|---|---|---|---|---|
| N-1 | `/api/michael-runtime/*` | Agent-named, matching `michael.ts`/`steve.ts`/`ivory.ts` siblings; suffix names the runtime surface | Yes — separate top-level prefix, not a child of `/api/michael` | None — no existing mount shares the `michael-runtime` prefix | Clean gated BA family mounted below the banner |
| N-2 | `/api/training-support/runtime` | Function-named, like `cockpit`/`crm`/`preview` | Yes | **Confusing** — `/api/training` (Fast Start) is ALREADY mounted (line 213) AND `/api/michael/training-support/...` already exists; "training-support" already denotes the existing Michael card | Gated fit OK, but the name is already claimed semantically |
| N-3 | `/api/team/michael` | Mixed; no existing `/api/team` segment in routes | Yes | Low, but introduces a novel `/api/team/*` segment that no other route uses; redundant (the whole API is already `.team`/BA-scoped under the gated banner) | Gated fit OK; segment adds no information |
| N-4 | `/api/agents/michael` | Agent-family nesting | Yes, technically | **High** — `/api/agents` is ALREADY mounted (line 207, `agentRoutes`, the Agent Orchestration recommendation feed); nesting Michael runtime under it overloads an occupied namespace with different semantics | Gated fit OK, but collides with a live, differently-purposed mount |
| Discovered | `/api/michael/runtime` (nested under existing) | Agent-named | **No** — child of the pre-gate `/api/michael` namespace | Directly violates §4 (reuse/extend/overload of onboarding namespace) | Rejected on principle |

Discovery detail grounding the table: the route directory mixes **agent-named** files
(`michael.ts`, `steve.ts`, `ivory.ts`, `agents.ts`) with **function-named** files
(`cockpit.ts`, `crm.ts`, `invitations.ts`, `training.ts`, `preview.ts`,
`orientation.ts`). Two candidate prefixes are already occupied by live mounts with
unrelated semantics — `/api/agents` (orchestration feed) and `/api/training` (Fast
Start) — which is decisive against N-4 and weakens N-2. No examined candidate is
stronger than N-1; no new prefix beats the agent-named, collision-free `michael-runtime`.

## 6. Recommendation

**Recommended namespace: `/api/michael-runtime/*` (option N-1).**

This is a recommendation for Kevin's separate approval, not an adoption.

## 7. Why `/api/michael-runtime/*`

- **Distinct from `/api/michael`.** It is a separate top-level prefix, not a child or
  extension of the pre-gate onboarding namespace. The `-runtime` suffix makes the
  separation legible at a glance: `/api/michael` = onboarding/training-support card;
  `/api/michael-runtime` = the inert resolution chain surface. It cannot be confused
  for, or accidentally routed through, the onboarding route (§4).
- **Not `/api/runtime/*`.** It does not revive the reserved, prohibited namespace (§3);
  `michael-runtime` is its own prefix and shares no path segment with `/api/runtime`.
- **`.team`-only in intended use.** Mounted below the gated banner alongside the other
  BA-facing route families, it is reachable only with the `.team` JWT (scoped to
  `.teammagnificent.team`); the prospect `.com` cookie can never satisfy its gate. It
  is never mounted on `apps/com` and never prospect-facing — Michael (AI
  training/prospecting language) is BA-facing only.
- **A gated BA route family.** Each handler applies, per-route (never globally),
  `requireAuth` + the onboarding-complete gate that exists on disk
  (`requireSteveComplete` — there is no `requireMichaelComplete`; the historical
  reference is a doc/code divergence the proposal reconciles by binding to the real
  middleware) + BA scope derived from `req.session.baId` (never a body-supplied
  `baId`/`sponsorBaId`; sponsor immutability). It follows the append-only mount
  convention (add only the import + mount line).
- **Clear for future maintainers.** It matches the repo's agent-named file convention
  (`michael.ts`/`steve.ts`/`ivory.ts` → `michael-runtime.ts`), collides with no
  existing mount (unlike N-4's `/api/agents` and N-2's `/api/training`), and needs no
  novel structural segment (unlike N-3's `/api/team`). A maintainer reading
  `server/src/index.ts` sees an unambiguous, self-describing surface.

## 8. Rejected Options and Why

- **N-2 `/api/training-support/runtime` — rejected.** "training-support" is already the
  semantic of the existing `GET /api/michael/training-support/:downlineBaId` card, and
  `/api/training` (Fast Start) is already a live mount. The name collides on meaning
  with two existing surfaces and would mislead maintainers about which "training"
  concern the route serves.
- **N-3 `/api/team/michael` — rejected.** Introduces an `/api/team/*` segment no other
  route uses, and the segment is redundant: every gated route below the banner is
  already `.team`/BA-scoped, so encoding `.team` in the path adds no information while
  adding a one-off structural pattern.
- **N-4 `/api/agents/michael` — rejected.** `/api/agents` is ALREADY mounted (line 207,
  `agentRoutes`) as the read-only Agent Orchestration recommendation feed. Nesting the
  Michael runtime chain under it overloads an occupied namespace with different
  semantics and ownership — the exact collision class the append-only and
  distinct-namespace rules exist to prevent. (If an agent-family namespace is ever
  wanted for Steve/Ivory parity, that is a separate, deliberate refactor of the
  existing `/api/agents` mount — not a thing to smuggle in via Michael's first runtime
  route.)
- **Discovered `/api/michael/runtime` — rejected.** A child of the pre-gate
  `/api/michael` namespace; it directly violates §4 (no reuse/extension/overload of the
  onboarding namespace).

## 9. Expected FUTURE Route Shape (described, NOT implemented)

Defined as a contract for the route proposal, aligned to the S2.20 facade result
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
  body, PII, or any session/turn/correlation/pool IDs. (Resolution failures from the
  facade surface as a deterministic `{ ok: false, issues: [...] }` shape, never a throw.)

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
  Three independent disable axes (route-disable, response-disable, trace-disable),
  default OFF, env-driven via the repo env-loader convention. On any flag-read failure,
  unknown state, or partial config the surface behaves as disabled (fail-closed): it
  returns this safe payload, produces no response body, emits no trace, performs no
  external side effect, persists nothing, and generates nothing. Each disable path and
  the off-by-default behavior must be test-covered before any live exposure.

## 10. Namespace Approval Is Kevin's, Separately, Before Implementation

**Kevin must approve the namespace separately before any implementation.** This review
recommends `/api/michael-runtime/*`; the recommendation authorizes nothing. The
namespace is one of the future Kevin-only decisions (S3.1 §18 item 2: "Route family +
namespace"). It must be ratified as its own recorded decision, after the S3.1 charter
and before any S3.4 implementation slice. Approving this review (if Kevin does) approves
only the recommended namespace as the proposal of record — it mounts nothing, creates no
route file, and grants no approval for auth wiring, feature flag, kill switch,
persistence, LLM, voice, dynamic generation, `.com` exposure, or any live Michael
behavior. Each of those remains a distinct, separately-approved step.

---

## Explicit Non-Actions (Stop Conditions for this report)

This S3.2 input review did not, and does not:

- approve, adopt, mount, or create any route, route file, or namespace (the
  recommendation is a PROPOSAL for Kevin's separate approval);
- revive, mount, or route through `/api/runtime/*`;
- reuse, extend, or overload the pre-gate `/api/michael` onboarding namespace;
- modify `server/src/index.ts` or any production code, test, route, UI, `.com`,
  ratified document, persistence adapter, or Gateway fallback;
- run builds, typecheck, tests, LLMs, or any database;
- activate Michael, Steve, or Ivory behavior, or flip `agentResponseGenerated` or any
  persistence discriminant;
- write the final S3.2 report (Agent E owns that);
- commit, or mutate git history or any database.

This report is the only file written by Agent A for S3.2.
