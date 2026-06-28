# S3.2 Michael Runtime Route — Auth + BA-Scope Proposal Review

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.2 Michael Route Proposal — auth + BA-scope model (proposal input)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no middleware, route, `index.ts`, UI, `.com`, or test created/renamed/modified; nothing mounted; no commit; no build/LLM/DB run)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent B (auth + BA-scope reviewer)
- Branch: `planning/s3.2-michael-route-proposal`
- Inputs (read-only, this slice):
  - `server/src/middleware/requireAuth.ts` — `requireAuth` / `requireAdmin` exports
  - `server/src/middleware/requireSteveComplete.ts` — onboarding gate on disk
  - `server/src/services/session.ts` — `SessionClaims` shape, cookie scope
  - `server/src/routes/cockpit.ts` — canonical `(requireAuth, requireSteveComplete)` per-route pattern + `req.session.baId`
  - `server/src/routes/michael.ts` — existing sponsor-facing exception (server-side relationship check)
  - `server/src/middleware/` directory listing — confirms `requireMichaelComplete` absent
  - Predecessor — `engineering/reports/S3_1_ACTIVATION_BOUNDARY_AUTH_REVIEW.md`
  - Project rules — `CLAUDE.md` (sponsor immutability, server boot order, `.team` JWT cookie scope)

> This is a planning/governance proposal. It approves nothing for activation, mounts
> nothing, persists nothing, and changes no middleware or route. It proposes the FUTURE
> auth + BA-scope model for the proposed Michael runtime route and hands the analysis to
> Agent E, who owns the final S3.2 report. This document does not implement, propose-as-
> decided, or create any route or middleware.

## 0. Verification Basis (read-only, this slice)

Every claim below is grounded in files read this slice. No file was edited.

- `server/src/middleware/` contains exactly `og-injection.ts`, `requireAuth.ts`,
  `requireSteveComplete.ts`, `verifyTelnyxWebhook.ts`. There is **no**
  `requireMichaelComplete.ts` (Glob, this slice).
- `requireAuth` (`requireAuth.ts:27-45`) reads the JWT cookie (`env.JWT_COOKIE_NAME`),
  calls `verifySession`, attaches `req.session: SessionClaims`, and returns **401**
  (`{ ok:false, error:'Not authenticated.' }` / `'Session invalid or expired.'`) when the
  cookie is missing or invalid.
- `SessionClaims` (`session.ts:7-11`) = `{ baId, threeBaId, email }`. The cookie is set
  with `domain: env.JWT_COOKIE_DOMAIN` in production (`session.ts:37`,`55`); per `CLAUDE.md`
  it is scoped to `.teammagnificent.team`, shared by `apps/team` + `apps/admin`, never `.com`.
- `requireSteveComplete` (`requireSteveComplete.ts:35-66`) is the on-disk onboarding gate:
  whitelist pass-through, else 401 if `!req.session`, else `403`
  (`code:'STEVE_GATE_CLOSED'`) until `isSteveDiscoveryComplete(session.baId)` is true,
  else 500 on gate-check error.
- `server/src/routes/cockpit.ts` applies `(requireAuth, requireSteveComplete)` **per
  route** (e.g. `:60`, `:77`, `:97`, `:116-120`, `:142-146`) and reads
  `const baId = req.session?.baId` in every handler — never from query or body.
- `server/src/routes/michael.ts` (`GET /training-support/:downlineBaId`, `:23-50`) is the
  one sponsor-facing exception; it derives `requestingBaId: session.baId` and performs the
  ownership check **server-side** in `getTrainingSupportCardForSponsor`, returning 403
  `NOT_SPONSOR` / 404.

## 1. `.team`-Only

The proposed Michael runtime route is confined to the internal Brand-Ambassador surface:
`apps/team` (port 7702) through the shared Express API (`server/`, port 7700) mounted at
`/api`. Identity is the `.team` JWT cookie scoped to `.teammagnificent.team`
(`session.ts:37`). Never `apps/com` (7701); `apps/admin` (7703) shares the cookie but is
not a Michael runtime surface. Rationale: AI training-support language is BA-facing only
(`CLAUDE.md` compliance — "Michael is BA-facing only, never prospect-facing").

## 2. Authenticated Only

Every invocation requires a valid authenticated BA session. There is no
unauthenticated/public variant of the proposed route. `requireAuth` (`requireAuth.ts:27`)
is the first middleware on the proposed handler; absent/invalid cookie -> 401, never a
fall-through to a handler.

## 3. BA-Scoped Only

The proposed route is scoped to the **authenticated BA**, not team-wide and not cross-BA.
Every read/write the handler performs is filtered by `req.session.baId`, mirroring
`cockpit.ts` (which filters every projection on the session BA so "a BA can only ever see
their own prospects", `cockpit.ts:14-22`). The shared team-wide pool mechanic is unrelated
to this scope — the runtime route serves one BA's own training-support context.

## 4. No `.com` Cookie Can Satisfy This Route

The JWT cookie is scoped to `.teammagnificent.team` (`session.ts:37` `domain:
env.JWT_COOKIE_DOMAIN`; `CLAUDE.md` "JWT cookie scoped to `.teammagnificent.team`").
`apps/com` (the prospect surface) has **no session** — the `/api/p/:token` family is
auth-free and token-resolved, issuing no `.team` cookie. Therefore no `.com` visitor can
present a cookie that `verifySession` (`session.ts:21-28`) will accept, and no `.com`
origin can satisfy `requireAuth`. A future Michael runtime route must never mount under
`/api/p/*` and must never be reachable by `apps/com` (S3.1 §2; `CLAUDE.md` compliance #3).

## 5. No Anonymous Access

There is no anonymous, token-only, or whitelist-exempt path to the proposed route. Unlike
`/api/cockpit/launch` (auth-only, pre-onboarding) the runtime route is gated; unlike
`/api/p/*` it is never auth-free. Missing cookie -> 401 at `requireAuth`
(`requireAuth.ts:34-36`). The runtime route must **not** be added to the
`STEVE_GATE_WHITELIST` (`requireSteveComplete.ts:13-24`).

## 6. `requireAuth` Required

`requireAuth` is mandatory as the first middleware on every proposed handler, applied
per-route (not globally), matching `cockpit.ts:60`/`michael.ts:24`. It verifies the `.team`
JWT and attaches `req.session: SessionClaims` (`requireAuth.ts:38-44`) so downstream gate
and handler can read `session.baId`. No proposed handler may read BA identity before
`requireAuth` has run.

## 7. Onboarding-Complete Gate Required

An onboarding-complete gate is mandatory as the second middleware, applied per-route after
`requireAuth`, matching the canonical `(requireAuth, requireSteveComplete)` pair in
`cockpit.ts`/`michael.ts`/`crm`. A BA who has not completed onboarding must not reach the
Michael runtime surface; the gate returns a hard 403 until onboarding is complete
(`requireSteveComplete.ts:53-59`).

## 8. Gate-Name Reality (file-evidenced)

**The onboarding gate that exists on disk is `requireSteveComplete`. There is no
`requireMichaelComplete`.**

- File evidence: `server/src/middleware/` = `og-injection.ts`, `requireAuth.ts`,
  `requireSteveComplete.ts`, `verifyTelnyxWebhook.ts` (Glob, this slice). No
  `requireMichaelComplete.ts`.
- `requireSteveComplete.ts:35` exports `requireSteveComplete`; it is the project-wide
  canonical gate, applied by `/api/cockpit` (`cockpit.ts:26,60,77,97,119,145`) and
  `/api/michael` (`michael.ts:11,26`).

**Recommendation (Kevin's call):** the first Michael runtime route proposal should bind to
**`requireSteveComplete`** — the real, tested, project-wide onboarding gate — for least
churn. `CLAUDE.md` and some prior charters still reference a `requireMichaelComplete`
symbol; that is documentation drift (S2.22 Condition D / S3.1 §6), not a gate that exists.
Introducing or renaming a gate symbol would require reconciling every existing gated route
plus the `CLAUDE.md`/charter references and is out of scope for S3.2. Either way, the route
proposal must bind to the middleware that actually enforces "onboarding complete," never an
assumed `requireMichaelComplete`.

## 9. Why Steve Gates Onboarding and Michael Is the Runtime Agent

`requireSteveComplete.ts:1-8` states it directly: **Steve owns New BA Discovery + Success
Profile** — until Steve's discovery is complete, authenticated BA routes stay locked except
the welcome/launch/first-module whitelist. Steve is the *onboarding* identity (the gate is a
function of `isSteveDiscoveryComplete(baId)`). **Michael is the runtime training-support
agent** — `michael.ts:1-7` notes Michael no longer interviews/schedules; Steve owns
Discovery, and Michael projects training-support suggestions. The proposed runtime route is
therefore a *consumer* of completed onboarding state: it sits **behind** Steve's gate
(onboarding must already be complete) and serves Michael's runtime training-support role.
Michael does not own the onboarding gate; he runs after it.

## 10. BA Identity Comes from `req.session.baId`

The proposed handler must read BA identity exclusively from `req.session.baId` — the claim
`requireAuth` attached from the verified JWT (`session.ts:7-11`; `requireAuth.ts:43`). This
is the established pattern: `cockpit.ts` reads `const baId = req.session?.baId` in every
handler (`:43,61,78,99,121,148`) and 401s if absent; `michael.ts:28` uses `const session =
req.session!` then `session.baId`. The runtime route follows the same source of truth.

## 11. Request Body Must Not Supply Authoritative BA ID

Per sponsor immutability (`CLAUDE.md` — "Any route that accepts a `sponsorBaId` in the body
must reject it and use the token-derived or code-derived value instead"), the proposed
runtime route must **not** accept a BA id (`baId`, `sponsorBaId`, or equivalent) from the
request body/query as the scope authority. It must reject or ignore any such field and use
the session-derived `req.session.baId`. `cockpit.ts:14-22` documents this exact rule ("the
BA id is read from `req.session.baId` … NEVER from a query param or body").

## 12. Cross-BA Reads Prohibited

A BA may invoke the Michael runtime route only for **their own** training-support context.
No BA may read or drive Michael for another BA's context. The default-deny posture is the
`cockpit.ts` model: every projection is filtered server-side on the session BA, so cross-BA
data is structurally unreachable. The runtime route must adopt the same server-authoritative
scoping; there is no client-supplied "act as BA X" parameter.

## 13. Sponsor-Facing Exception Must Validate the Relationship Server-Side

If the proposal ever includes a sponsor-facing read (a sponsor viewing a downline BA's
runtime context), it must validate the sponsor->downline relationship **server-side**,
exactly like the one existing exception: `michael.ts` `GET /training-support/:downlineBaId`
derives `requestingBaId: session.baId` and delegates the authoritative check to
`getTrainingSupportCardForSponsor`, returning **403 `NOT_SPONSOR`** when the requester is
not the direct sponsor and **404** when there is no downline / no Steve discovery
(`michael.ts:34-44`). The path param identifies the *target*; it never confers authority —
authority is always the session BA plus a server-side relationship check.

## 14. Future Authorization Failure Shapes (proposed)

Consistent with repo conventions (`{ ok:false, error, code? }`, statuses already used by
`requireAuth`/`requireSteveComplete`/`michael.ts`). Proposed for the future route — not
implemented here:

| Condition | Status | Proposed JSON body | Basis |
|---|---|---|---|
| Unauthenticated (no/invalid `.team` cookie) | **401** | `{ "ok": false, "error": "Not authenticated." }` (invalid/expired: `"Session invalid or expired."`) | `requireAuth.ts:35,41` (emitted by `requireAuth`, before the handler) |
| Onboarding incomplete | **403** | `{ "ok": false, "error": "Locked. Complete your Steve discovery first.", "code": "STEVE_GATE_CLOSED" }` | `requireSteveComplete.ts:54-58` (emitted by the gate) |
| Wrong BA scope (cross-BA / non-sponsor) | **403** | `{ "ok": false, "error": "Not your downline.", "code": "NOT_SPONSOR" }` (or `FORBIDDEN_BA_SCOPE` for non-sponsor self-scope violations); **404** when revealing existence would leak (per `michael.ts` 404 branch) | `michael.ts:41-43` server-side ownership pattern |
| Disabled route (runtime not activated / flag off) | **503** | `{ "ok": false, "error": "Michael runtime is not available.", "code": "MICHAEL_RUNTIME_DISABLED" }` | Proposed: fail-closed for an unactivated surface; 503 = temporarily unavailable, distinct from 404-not-found and 403-not-permitted |

Notes: (a) the unauthenticated and onboarding-incomplete shapes are emitted by existing
middleware, unchanged — the route inherits them by ordering `(requireAuth, <gate>)`.
(b) The wrong-BA-scope and disabled-route shapes are **proposed handler/flag behavior**, to
be ratified in implementation, not built here. (c) Body-supplied BA id (§11) is not a
distinct status — it is rejected/ignored, and scope falls back to `session.baId`; an
explicit override attempt may be surfaced as a 400 in the route proposal at Kevin's option.

## 15. No Auth Middleware Is Changed in S3.2

S3.2 is planning/governance/documentation only. **No auth middleware is created, renamed,
or modified.** `requireAuth.ts`, `requireSteveComplete.ts`, and `requireAuth`'s
`requireAdmin` are untouched; no `requireMichaelComplete.ts` is created; no route file,
`server/src/index.ts`, UI, `.com`, or test is touched; nothing is mounted, committed, built,
or run. This document proposes the auth + BA-scope model only; binding it to a concrete
route, mount, and any new failure-shape code is a later, separately-approved step in the
fixed order **charter -> route proposal -> implementation**.

---

This is the S3.2 auth + BA-scope proposal review (Agent B). Planning / governance /
documentation only. No middleware, route, `index.ts`, UI, `.com`, or test was created,
renamed, or modified; nothing was mounted or committed. The final S3.2 report is owned by
Agent E.
