# Sprint 3 S3.4 Minimal Michael Runtime Route Verification

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.4 Minimal Michael runtime route — the FIRST runtime-facing Michael route (`POST /api/michael-runtime/resolve`): `.team`-only, authenticated, BA-scoped, fixtures-only via the inert S2.20 facade, non-persistent, LLM-free, voice-free, fail-closed behind a default-off three-axis kill switch (route / response / trace), plus final integration verification
- Status: IMPLEMENTATION + VERIFICATION (gate commands run read-only; production change limited to one route file, one flag helper, and an append-only `server/src/index.ts` import + mount; no persistence, no LLM, no dynamic generation, no `.com`, no `.team` UI, no commit)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent E (final integration + verification agent — owns this verdict)
- Branch: `feature/s3.4-michael-runtime-route` (working tree verified; nothing committed — this slice is uncommitted on the feature branch, not on `main`)
- Inputs reviewed (not blindly trusted — each diff/test read in full on disk):
  - Core route — `server/src/routes/michael-runtime.ts`
  - Flag helper — `server/src/config/michaelRuntimeFlags.ts`
  - Append-only mount — `server/src/index.ts` (import line + mount line + comment)
  - Test-only correction — `server/src/runtime/__tests__/runtimeBoundarySkeleton.test.ts`
  - Agent B — `server/src/routes/__tests__/michael-runtime.test.ts`
  - Agent C — `server/src/routes/__tests__/michael-runtime.env.test.ts` + `michael-runtime.kill-switch.test.ts`
  - Agent D — `server/src/routes/__tests__/s34MichaelRuntimeRouteGovernanceBoundary.test.ts`

> This is the final integration + verification record for the governance-approved S3.4
> minimal Michael runtime route slice. It verifies one route, one flag helper, and an
> append-only mount; runs the four merge gates read-only; and confirms the route stays a
> one-call consumer of the inert S2.20 facade — fixtures-only, non-persistent, LLM-free,
> voice-free, and fail-closed. It approves no further activation. S3.5 (UI / persistence /
> voice / dynamic generation) remains a separately-approved undertaking.

## 1. Executive Result

**PASS.**

S3.4 lands exactly the approved minimal route and nothing more. `POST /api/michael-runtime/resolve`
is registered behind `requireAuth + requireSteveComplete`, forces BA scope from
`req.session.baId`, rejects body-supplied BA authority (`BODY_BA_SCOPE_NOT_ALLOWED`), requires
`body.turn` (`MISSING_RUNTIME_TURN`), and is the sole caller of the S2.20 facade
`resolveMichaelRuntimeTurnResponse`. The three-axis kill switch (route / response / trace) is
default-off, exact-`"true"`-only, env-only, read at call time, and fail-closed. Success returns
`200 {ok, selectionRequest, catalogKey, response, trace?}` with the redacted trace included only
when `MICHAEL_RUNTIME_TRACE_ENABLED === 'true'`. The mount is append-only and sits below the
gated banner; `/api/michael` stays pre-gate; the bare `/api/runtime/*` family stays unmounted.

All four merge gates are green. The full server suite is **70 files / 779 tests, 0 failures** —
exactly the **699** baseline plus the **80** new tests (16 + 22 + 11 + 31). One tiny,
strictly-required test-only correction was applied during verification: an unused
`flagsFilePath` declaration in `s34MichaelRuntimeRouteGovernanceBoundary.test.ts` broke the
`pnpm typecheck` gate (TS6133 under `noUnusedLocals`); the dead line was removed (see
"Documented test-only correction" below). With it removed, typecheck, build, and the full suite
are clean.

The verdict is unconditional **PASS**: the route is within the approved boundary, every
inert-foundation invariant (`persistence: 'disabled'`, `agentResponseGenerated: false`,
returned-only, redacted trace, no wiring) is preserved and statically asserted, and the slice
introduces no persistence, LLM, dynamic generation, voice, `.com`, or `.team` UI. S3.5 remains
separately gated (see §25).

## 2. Files Added

- `server/src/routes/michael-runtime.ts` — the route (`POST /resolve`), exporting `handleMichaelRuntimeResolve` and the `michaelRuntimeRoutes` Router.
- `server/src/config/michaelRuntimeFlags.ts` — the default-off three-axis flag helper.
- `server/src/routes/__tests__/michael-runtime.test.ts` — 16 tests (Agent B).
- `server/src/routes/__tests__/michael-runtime.env.test.ts` — 22 tests (Agent C).
- `server/src/routes/__tests__/michael-runtime.kill-switch.test.ts` — 11 tests (Agent C).
- `server/src/routes/__tests__/s34MichaelRuntimeRouteGovernanceBoundary.test.ts` — 31 tests (Agent D).
- `engineering/reports/SPRINT_003_S3_4_MINIMAL_MICHAEL_RUNTIME_ROUTE_VERIFICATION.md` — this report.

## 3. Files Modified

- `server/src/index.ts` — **append-only**: one import line (`import { michaelRuntimeRoutes } from './routes/michael-runtime.js';`) and one mount line (`app.use('/api/michael-runtime', michaelRuntimeRoutes);`) plus an explanatory comment, added below the gated banner after `/api/orientation`. `git diff` confirms no existing line was edited, reordered, or removed.
- `server/src/runtime/__tests__/runtimeBoundarySkeleton.test.ts` — **test-only correction**: the S2.1 guard regex was made precise so it targets the forbidden bare `/api/runtime` route family without false-positiving on the approved `michaelRuntimeRoutes` / `michael-runtime.js` (see below).
- `server/src/routes/__tests__/s34MichaelRuntimeRouteGovernanceBoundary.test.ts` — **test-only correction (this verification)**: removed an unused `flagsFilePath` const that broke `pnpm typecheck` (TS6133).

## 4. Route Implemented

`POST /api/michael-runtime/resolve`. The handler `handleMichaelRuntimeResolve(req, res)` is
exported for direct unit testing and is registered as
`michaelRuntimeRoutes.post('/resolve', requireAuth, requireSteveComplete, handleMichaelRuntimeResolve)`.
It reads `req.session`/`req.body` and the env flags, calls only the S2.20 facade, and writes the
response — no persistence, LLM, or side effects.

## 5. Route Mounted Below the Gated Banner (Append-Only)

Confirmed. `server/src/index.ts` line 56 adds the import; line 242 adds
`app.use('/api/michael-runtime', michaelRuntimeRoutes)` after the `/api/orientation` mount,
below the `BA-FACING GATED ROUTES` banner. Governance test #25 asserts the mount index is
greater than the gated anchor (`/api/cockpit` or `/api/orientation`); #27 asserts `/api/michael`
precedes both the gated banner and the runtime mount. The diff is strictly additive.

## 6. `/api/runtime/*` Remains Unmounted

Confirmed. No `app.use('/api/runtime', ...)` exists. Governance test #26 asserts
`/app\.use\(\s*['"`]\/api\/runtime\b/` is absent from `index.ts`. The pre-existing strict
`orchestrationBoundary` guard `not.toMatch(/\/api\/runtime/)` still holds because the new mount
path `/api/michael-runtime` does not contain the literal substring `/api/runtime`, and the added
comment was worded ("the reserved bare runtime namespace stays unmounted") to avoid that literal.

## 7. Existing Pre-Gate `/api/michael` Untouched

Confirmed. `app.use('/api/michael', michaelRoutes)` remains at its original line 105 in the
pre-gate block — no line was changed. The new route is a distinct namespace
(`/api/michael-runtime`); the onboarding gate route is unaffected. Governance test #27 asserts
the pre-gate ordering.

## 8. Auth Confirmation

Confirmed. The route applies `requireAuth` then `requireSteveComplete` and imports neither
`requireMichaelComplete` nor any global gate. Governance test #20 asserts the exact
`.post('/resolve', requireAuth, requireSteveComplete, ...)` registration; #4 asserts the source
never imports or references `requireMichaelComplete`. (`requireMichaelComplete` is the BA
onboarding gate; this runtime route correctly gates on Steve completion instead.)

## 9. BA Scope Confirmation

Confirmed. BA identity is taken from `req.session?.baId`; a missing session yields `401`. The
handler rejects any body-supplied `baId`, `sponsorBaId`, or `targetBaId` with
`400 { code: 'BODY_BA_SCOPE_NOT_ALLOWED' }` and then force-injects the session BA into
`identity.scope.baId` before calling the facade — sponsor immutability (locked-spec 3.5).
Governance test #21 asserts both `req.session?.baId` and `BODY_BA_SCOPE_NOT_ALLOWED` are
present; handler tests 2–4 assert each forbidden body field is rejected; test 5 asserts the
missing-session 401.

## 10. Feature Flag Confirmation

Confirmed. `michaelRuntimeFlags.ts` exposes three independent helpers
(`michaelRuntimeRouteEnabled` / `michaelRuntimeResponseEnabled` / `michaelRuntimeTraceEnabled`),
each returning `process.env[NAME] === 'true'`. They are default-off (unset → false), accept only
the exact string `"true"` (rejecting `""`, `"false"`, `"TRUE"`, `" true "`, `"1"`, `"yes"`,
`"0"`), are read at call time (never memoized at import), and are sourced only from `process.env`
— never a body, query, header, or DB. The env-flag suite (22 tests) covers all axes × all cases;
governance test #28 re-asserts default-off + exact-`"true"` + axis independence.

## 11. Kill-Switch Behavior Confirmation (Three Axes)

Confirmed, fail-closed at each axis, checked in order:

1. **Route axis** — if `michaelRuntimeRouteEnabled()` is false the handler returns
   `503 {reason: 'michael_runtime_disabled'}` BEFORE any facade call, body read, or trace work.
   Tests assert no `response`/`trace`/`catalogKey`/`selectionRequest` leaks (handler test 6,
   kill-switch tests 1–2, 9).
2. **Response axis** — route on, response off returns
   `503 {reason: 'michael_runtime_response_disabled'}` with no response/trace (handler test 7,
   kill-switch tests 3, 7).
3. **Trace axis** — route+response on, trace off returns `200 ok:true` with `trace` omitted;
   trace on returns `200` with a trace object (handler tests 8–9, kill-switch tests 4–6, 8).
   A non-exact `"TRUE"` trace value yields success without trace (kill-switch test 6).

## 12. Response Behavior Confirmation

Confirmed. Responses are fixtures-only, resolved exclusively through the S2.20 facade
`resolveMichaelRuntimeTurnResponse` (S2.17–S2.20 chain: catalog → selector → derivation →
facade), returned BY REFERENCE. The route does NOT import the S2.13 harness
(`michaelRuntimeResponseHarness` / `michaelRuntimeResponseScenarios` /
`createMichaelRuntimeResponseFixtureHarness`) — governance test #6 asserts this. Every success
response carries `agentResponseGenerated === false` and `persistence === 'disabled'` (handler
tests 11–13, kill-switch test 11). A clear EN turn resolves to
`michael_next_training_step_en`; a degraded turn to `michael_safe_fallback_degraded_en`; an ES
turn to an `_es` entry (handler tests 10, 15, 16).

## 13. Trace Behavior Confirmation

Confirmed. The trace is returned-only (never persisted) and included solely when the trace axis
is enabled; the trace assignment `payload.trace = result.trace` is guarded by
`michaelRuntimeTraceEnabled()` and is the only trace write (governance tests #22–#23). It is the
facade's already-redacted trace — handler test 9 recursively walks the returned trace and asserts
it carries none of the forbidden keys (`packet`, `contextPacket`, `retrievalAudit`, `retrieval`,
`token`, `sessionId`, `turnId`, `correlationId`, `email`, `phone`, `prospect`, `text`). With
trace disabled the field is absent.

## 14. Failure Shapes

Confirmed, all deterministic (never a 500):

| Condition | Status | Shape |
|---|---|---|
| Route axis disabled | 503 | `{ok:false, disabled:true, reason:'michael_runtime_disabled'}` |
| Response axis disabled | 503 | `{ok:false, disabled:true, reason:'michael_runtime_response_disabled'}` |
| Missing session BA | 401 | `{ok:false, error:'Not authenticated.'}` |
| Body-supplied BA authority | 400 | `{ok:false, code:'BODY_BA_SCOPE_NOT_ALLOWED'}` |
| Missing/non-object turn | 400 | `{ok:false, code:'MISSING_RUNTIME_TURN'}` |
| Facade `!ok` or throw | 422 | `{ok:false, issues:[...]}` |

The facade call is wrapped in try/catch; a malformed turn maps to `422` with an `issues` array
and never throws (handler test 14).

## 15. No Persistence

Confirmed. The route performs no persistent write: no Mongo/Neo4j/Chroma/GraphRAG/Gateway
import, no `tripleStackWrite`, no `.insert/.update/.save/.create` call shape. Governance tests
#7–#12 (import scans) and #16 (call-shape scan) assert empty match sets. The facade itself is the
inert, `persistence: 'disabled'` chain verified through S2.20–S3.3.

## 16. No LLM

Confirmed. No Anthropic/OpenAI/Claude/ScriptMaker/Ivory import and no completion call
(`messages.create`, `chatCompletion`, `createChatCompletion`, etc.). Governance tests #13–#14
assert empty match sets.

## 17. No Dynamic Generation

Confirmed. The route returns the verbatim catalog fixture by reference; it never constructs
response text. Governance test #30 asserts the source contains no `agentResponseGenerated: true`,
no `text:` field assignment (string-stripped so message literals can't trip it), and no
template-literal `text:`. `agentResponseGenerated` stays `false` on every success (handler tests
11, 13).

## 18. No Voice / Telnyx / PSTN / Call-Control

Confirmed. No `telnyx`/`pstn`/`call-control` import and no call-control wiring
(`createCallControl`, `startCall`, `placeCall`, `dialProspect`, `callControlId`). Governance test
#15 asserts empty match sets.

## 19. No `.com`

Confirmed. No `apps/com` import in the route (governance test #31); no file under `apps/com/` is
in `git status`. The route is BA-facing only; the five `.com` compliance prohibitions stand
absolutely.

## 20. No `.team` UI Changes

Confirmed. `git status` lists no file under `apps/team/`. The slice is server-route + flag helper
+ tests only; no client component, page, or wire type was added or edited.

## 21. No Steve / Ivory / Live Michael Behavior Activation

Confirmed. The route gates on `requireSteveComplete` (reading existing Steve onboarding state)
but activates no Steve, Ivory, or live Michael generation. With the default-off kill switch the
route is fully inert in production; even fully enabled it only returns pre-authored fixtures from
the S2.20 facade. No agent runtime is wired to live generation, no LLM path becomes active.

## 22. All Route Tests Pass (Counts)

Confirmed. The four S3.4 route test files run green:

| File | Tests |
|---|---|
| `michael-runtime.test.ts` (Agent B) | 16 |
| `michael-runtime.env.test.ts` (Agent C) | 22 |
| `michael-runtime.kill-switch.test.ts` (Agent C) | 11 |
| `s34MichaelRuntimeRouteGovernanceBoundary.test.ts` (Agent D) | 31 |
| **Total** | **80** |

Focused run `... test -- michael-runtime s34MichaelRuntimeRouteGovernanceBoundary` →
**4 files / 80 tests, 0 failures**.

## 23. All Static Governance Tests Pass

Confirmed. The 31-test `s34MichaelRuntimeRouteGovernanceBoundary` static source-scan suite
passes: route existence (#1), auth model (#2–#4, #20), facade-only resolution (#5), no-S2.13-harness
(#6), no persistence/LLM/voice/retrieval imports or call shapes (#7–#19), BA scope (#21), trace
guarding (#22–#23), mount facts (#24–#27), flag default-off (#28), facade inert invariant (#29),
no dynamic generation (#30), no `.com` (#31). The broader inert-chain governance sweep (S2.x
boundary suites) also stays green — focused facade-chain run = **22 files / 306 tests**.

## 24. Gates Pass (Table)

All four merge gates were run read-only with pnpm 9 / Node ≥ 22. The full server suite passed
clean.

| Gate | Command | Exit | Duration | Result |
|---|---|---|---|---|
| Shared build | `pnpm build:shared` | 0 | ~1s | PASS |
| Typecheck | `pnpm typecheck` | 0 | ~5s | PASS (all workspace projects done) — after the test-only TS6133 fix below |
| Build | `pnpm build` | 0 | ~7s | PASS (standing Vite chunk-size notes only) |
| Full server suite | `pnpm --filter @momentum/server test` | 0 | ~2.3s | PASS — **70 files / 779 tests**, 0 failures |

Baseline was **66 files / 699 tests**; this slice adds **4 files / 80 tests** (16 + 22 + 11 + 31)
→ **70 / 779**, exactly as expected.

### Focused command results

| Focused command | Exit | Files / Tests |
|---|---|---|
| `... test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary` | 0 | **22 files / 306 tests** all pass (inert S2.17–S2.20 facade chain + governance) |
| `... test -- michael-runtime s34MichaelRuntimeRouteGovernanceBoundary` | 0 | **4 files / 80 tests** all pass (the new route + static governance) |
| `... test -- michaelResponseContractEsGuardrails michaelResponseContractFailedStrictness` | 0 | **2 files / 34 tests** all pass (S3.3 ES guardrails 24 + failed-strictness 10) |
| `... test -- mongoAdapter` | 0 | **1 file / 2 tests** all pass (no flake) |

(Vitest treats each argument as a filename-substring filter; the broad facade-chain command
sweeps the named modules plus adjacent guardrail/boundary specs — the intended broad sweep.)

## 25. Recommendation for Next Slice

S3.4 satisfies its approved boundary: the first runtime-facing Michael route exists, is fully
test-covered, and ships inert behind a default-off three-axis kill switch. Recommended next
steps, each separately gated on Kevin's explicit approval:

1. **S3.5 staged enablement plan** — define the rollback owner and the env-flip runbook
   (`MICHAEL_RUNTIME_ROUTE_ENABLED` → `_RESPONSE_ENABLED` → `_TRACE_ENABLED`) for a controlled
   `.team` canary, with `/admin` observability for the enforcement/skip counters. No code change
   to enable; the flags are deploy-time only.
2. **`.team` BA-facing UI** consuming `POST /api/michael-runtime/resolve` (read-only render of
   the resolved fixture), kept compliance-clean (Michael never prospect-facing) — separate slice.
3. **Persistence of resolved turns** (audit trail via `tripleStackWrite` / GraphRAG schema
   contract) — explicitly OUT of S3.4 and gated separately; the route must remain non-persistent
   until that slice is approved.

Until those are recorded, S3.5+ stays unproposed. Any future enablement must keep the route a
one-call consumer of the S2.20 facade — fixtures-only, authenticated, BA-scoped, returned-only
with a redacted trace — and must NOT import the S2.13 harness or revive `/api/runtime/*`.

## Documented Test-Only Corrections

Two test-only corrections were made on this slice; neither touches production logic.

1. **`runtimeBoundarySkeleton.test.ts` (orchestrator, pre-verification).** The S2.1 guard
   previously matched `/from\s+['"].*runtime.*routes|runtimeRoutes/i`, whose
   case-insensitive bare `runtimeRoutes` alternative would now false-positive on the approved
   `michaelRuntimeRoutes` import. It was tightened to
   `/from\s+['"][^'"]*\/runtime\.js['"]|\bruntimeRoutes\b/i` — which still rejects an import from
   a bare `/runtime.js` route module or a standalone `runtimeRoutes` binding, but does NOT match
   `michaelRuntimeRoutes` (no word boundary before `Runtime` in `michaelRuntimeRoutes`) or the
   `./routes/michael-runtime.js` specifier (no `/runtime.js` slash boundary). **Verified:** the
   strict `orchestrationBoundary` `not.toMatch(/\/api\/runtime/)` guard was left intact and still
   passes (the new mount path and reworded comment contain no `/api/runtime` literal), and the
   full suite is green. Rationale: precise targeting of the forbidden bare runtime namespace
   without blocking the approved gated `/api/michael-runtime` route.

2. **`s34MichaelRuntimeRouteGovernanceBoundary.test.ts` (this verification).** The file declared
   `const flagsFilePath = 'server/src/config/michaelRuntimeFlags.ts';` but never referenced it,
   which failed `pnpm typecheck` under the repo-wide `noUnusedLocals` (TS6133) — a hard merge-gate
   blocker. The single dead declaration line was removed; no assertion, scan, or import changed.
   Rationale: strictly required to make the typecheck gate pass; minimal and test-only.

---

This is the final S3.4 Minimal Michael Runtime Route verification (Agent E). Production change is
limited to one route file, one flag helper, and an append-only `server/src/index.ts` import +
mount; gate commands were run read-only. No persistence, LLM call, dynamic generation, voice
wiring, `.com` change, or `.team` UI change was introduced; nothing was committed. The slice is
uncommitted on `feature/s3.4-michael-runtime-route`. S3.5+ remains separately approved.
