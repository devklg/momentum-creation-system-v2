# Sprint 3 — S3.7 Canary Environment Readiness Review

**Slice:** S3.7 — Michael Runtime Route CANARY (execution-record)
**Agent:** Agent A (environment readiness reviewer)
**Document type:** Documentation / verification ONLY — no code changes, no production flag flips, no git mutation.
**Date:** 2026-06-28
**Status:** READY for LOCAL / DRY-RUN canary · production & staging enablement BLOCKED pending Kevin's explicit authorization.

---

## 1. Target environment — LOCAL / DRY-RUN only

The canary target is classified **LOCAL / DRY-RUN**. This is a deliberate classification, not a default:

- **No staging environment exists.** There is no deployed staging tier for this repo against which a canary could be run. The only runnable instance is the local developer process (`pnpm dev` / `pnpm dev:server`, server on port 7700).
- **No production flag flip is authorized.** Kevin has NOT authorized flipping any `MICHAEL_RUNTIME_*` flag in any production or shared environment. No production enablement is in scope for S3.7.
- **Execution vehicle:** a local, in-process canary — ephemeral, started and stopped within the developer process, with production untouched. The authoritative execution and observed-data capture for that local canary is owned by **Agent C**; this document is the pre-flight environment readiness gate for it.

Because the only available environment is the local repo and no production flag will be flipped, every "live"/production dimension of this review is recorded as **DRY RUN** (see §13).

## 2. Current git commit

`cfef7a63c20a1e4f8225e14f64ded06ea0bda4fb`

Corroborated via `git rev-parse HEAD` → `cfef7a63c20a1e4f8225e14f64ded06ea0bda4fb`.

## 3. Current branch

`main`

Corroborated via `git rev-parse --abbrev-ref HEAD` → `main`.

## 4. S3.6 in-memory observability is present

The S3.6 minimal in-memory observability slice is on disk and verified:

- `server/src/services/michaelRuntimeObservability.ts` — in-memory aggregate counter module (module-level integer counters; NO persistence, NO triple-stack, NO LLM; counters reset on process restart).
- `server/src/routes/admin/michael-runtime-observability.ts` — `requireAdmin`-gated read endpoint exposing the snapshot.
- `engineering/reports/SPRINT_003_S3_6_MINIMAL_IN_MEMORY_OBSERVABILITY_VERIFICATION.md` — Agent E's S3.6 verification report (records the full server suite at **74 files / 851 tests, 0 failures**, i.e. +4 files / +72 tests over the S3.5 baseline of 70 files / 779 tests).

## 5. Runtime resolve route exists

`POST /api/michael-runtime/resolve`

- Handler: `handleMichaelRuntimeResolve` — `server/src/routes/michael-runtime.ts:52`.
- Route registration: `server/src/routes/michael-runtime.ts:156-161` (`michaelRuntimeRoutes.post('/resolve', requireAuth, requireSteveComplete, handleMichaelRuntimeResolve)`).
- Properties (corroborated in source): `.team`-only, authenticated (`requireAuth`), onboarding-gated (`requireSteveComplete`), BA-scoped from `req.session.baId` (`server/src/routes/michael-runtime.ts:71`), fixtures-only via the inert S2.20 facade `resolveMichaelRuntimeTurnResponse`, non-persistent, LLM-free.
- Sponsor immutability: body-supplied BA-authority fields (`baId`, `sponsorBaId`, `targetBaId`) are rejected with 400 `BODY_BA_SCOPE_NOT_ALLOWED` — `server/src/routes/michael-runtime.ts:43,79-88`.

## 6. Admin observability endpoint exists

`GET /api/admin/michael-runtime/observability`

- Registration: `server/src/routes/admin/michael-runtime-observability.ts:23` (`adminMichaelRuntimeObservabilityRoutes.get('/observability', requireAdmin, …)`).
- Returns `{ ok: true, michaelRuntime: <snapshot> }` from `getMichaelRuntimeObservabilitySnapshot()` — pure in-memory read; does NOT persist, does NOT audit-log, does NOT touch the triple-stack.

## 7. Current flag state — all UNSET / OFF

All three kill-switch axes are currently **OFF** because no environment variable sets them:

- No `MICHAEL_RUNTIME_*` key exists in `.env` (MICHAEL_RUNTIME count: 0) or `.env.example` (count: 0). The keys appear ONLY in test fixtures (`server/src/routes/__tests__/michael-runtime.env.test.ts` and its compiled `dist` twin), never in any real env file.
- With the keys unset, the three flag functions return `false` (see §8), so:
  - **Route axis OFF** → `POST /api/michael-runtime/resolve` fail-closes with `503 { ok:false, disabled:true, reason:'michael_runtime_disabled' }` BEFORE any facade call, response, or trace (`server/src/routes/michael-runtime.ts:55-60`).
  - **Response axis OFF** → no resolved body returned (`:64-69`).
  - **Trace axis OFF** → redacted trace omitted from any success payload (`:148-150`).
- The admin observability snapshot will therefore report `routeEnabled:false, responseEnabled:false, traceEnabled:false` until an env value is set.

## 8. Flags evaluate the exact string `"true"` only

`server/src/config/michaelRuntimeFlags.ts:12-14`:

```ts
function flagEnabled(name: string): boolean {
  return process.env[name] === 'true';
}
```

Any other value — missing, empty, `"TRUE"`, `"false"`, `"1"`, or any malformed string — leaves the axis disabled. Flags are read at call time (not memoized at import), so the value can never be sourced from a request body, query param, header, or database, and a deploy-time env change takes effect without a code change.

The three axes:
- `michaelRuntimeRouteEnabled()` ← `MICHAEL_RUNTIME_ROUTE_ENABLED` (`michaelRuntimeFlags.ts:17-19`)
- `michaelRuntimeResponseEnabled()` ← `MICHAEL_RUNTIME_RESPONSE_ENABLED` (`:22-24`)
- `michaelRuntimeTraceEnabled()` ← `MICHAEL_RUNTIME_TRACE_ENABLED` (`:27-29`)

## 9. Route is default-off

Because the route axis flag is unset and `flagEnabled` requires the exact string `"true"`, the route is **default-OFF** with no override path. The first executed line of the handler is the route kill-switch check (`michael-runtime.ts:55`), which fail-closes with 503 before authentication-adjacent work, facade calls, response assembly, or trace emission. There is no hardcoded-enabled branch anywhere in the flag module or the route.

## 10. Admin observability is admin-only

`GET /api/admin/michael-runtime/observability` is gated by `requireAdmin` (imported from `server/src/middleware/requireAuth.js`) at `server/src/routes/admin/michael-runtime-observability.ts:18,23`. `requireAdmin` enforces the `ADMIN_BA_IDS` allowlist (Kevin-only). The endpoint is `.team`/admin-facing, never BA-facing, and never on `.com`.

## 11. Target user — simulated Kevin-owned BA session

The local in-process canary will exercise the route with a **simulated Kevin-owned BA session id** (e.g. `TMBA-LOCAL-CANARY`), supplied as `req.session.baId` exactly as a real authenticated `.team` session would.

- **No prospect account** is involved.
- **No `.com` user** is involved (the route is `.team`-only; Michael is BA-facing only, never prospect-facing).
- The BA scope is session-derived only — the route forces `req.session.baId` into the adapter input and rejects any body-supplied BA authority (sponsor immutability, locked-spec 3.5).

## 12. Pre-canary gate results

The authoritative pre-canary gate suite run is owned by **Agent E** (final integrator + gates owner). This document does NOT execute or fabricate a fresh gate run.

- **Prior evidence (not a fresh run):** the S3.6 verification report records the full server suite green at **74 files / 851 tests, 0 failures** at the S3.6 integration point (`engineering/reports/SPRINT_003_S3_6_MINIMAL_IN_MEMORY_OBSERVABILITY_VERIFICATION.md`). That figure is cited here as the standing baseline, not as a fresh S3.7 result.
- Agent E's S3.7 gate run is the binding pre-canary result; this readiness review defers to it.

## 13. DRY RUN marker

**DRY RUN — no flags flipped.**

For the production / live dimension: no `MICHAEL_RUNTIME_*` flag is set, written, or flipped in any `.env`, `.env.example`, or shared/production environment by this slice. Production remains untouched. The only flag values that may be set are scoped to the ephemeral local in-process canary owned by Agent C, and revert on process exit (flags are read from `process.env` at call time and nothing is persisted).

## 14. Recommendation

**Proceed with the LOCAL in-process canary** (Agent C) to capture real observed data through the existing route and admin observability endpoint, against a simulated Kevin-owned BA session (`TMBA-LOCAL-CANARY`), with production untouched.

**Production and staging enablement remain BLOCKED** pending Kevin's explicit environment authorization. No staging tier exists and no production flag flip has been authorized; any non-local enablement is out of scope for S3.7 and must wait for an explicit Kevin go-ahead on a named environment.

---

### Corroboration appendix (commands run for this review)

- `git rev-parse HEAD` → `cfef7a63c20a1e4f8225e14f64ded06ea0bda4fb`
- `git rev-parse --abbrev-ref HEAD` → `main`
- `.env` MICHAEL_RUNTIME key count → 0; `.env.example` → 0; keys present only in `server/src/routes/__tests__/michael-runtime.env.test.ts` (test fixture) and its `dist` twin.
- Source files read: `server/src/routes/michael-runtime.ts`, `server/src/config/michaelRuntimeFlags.ts`, `server/src/services/michaelRuntimeObservability.ts`, `server/src/routes/admin/michael-runtime-observability.ts`.
- Reports read: `SPRINT_003_S3_6_MINIMAL_IN_MEMORY_OBSERVABILITY_VERIFICATION.md`, `SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md`.
