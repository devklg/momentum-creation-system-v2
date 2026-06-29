# S3.5 — Controlled `.team` Canary Verification Checklist

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.5 (planning only — staged enablement of the S3.4 minimal Michael runtime route for a controlled `.team` canary)
- Status: DOCUMENTATION / PLANNING ONLY — no code change, no flag flip, no UI, no persistence, no commit
- Author: Agent B (S3.5 planning slice)
- Date: 2026-06-28
- Subject route: `POST /api/michael-runtime/resolve`
- Grounded in:
  - `server/src/routes/michael-runtime.ts`
  - `server/src/config/michaelRuntimeFlags.ts`
  - `engineering/reports/SPRINT_003_S3_4_MINIMAL_MICHAEL_RUNTIME_ROUTE_VERIFICATION.md`

> **Scope guard.** This checklist is an *executable verification runbook* for a future,
> separately-approved controlled canary. It DOES NOT authorize enabling the route, flipping any
> flag, building UI, persisting turns, or wiring an LLM/voice path. The route ships inert behind a
> default-off three-axis kill switch (`MICHAEL_RUNTIME_ROUTE_ENABLED` / `_RESPONSE_ENABLED` /
> `_TRACE_ENABLED`), each enabled only by the exact string `"true"`. Until Kevin explicitly
> approves the canary AND owns the env flip + rollback, every box below is a pre-condition or an
> observation step, never a self-granted action.

---

## Reference — verified route contract (from S3.4)

| Fact | Value |
|---|---|
| Method + path | `POST /api/michael-runtime/resolve` |
| Mount | append-only in `server/src/index.ts`, **below** the BA-FACING GATED banner, after `/api/orientation` |
| Middleware | `requireAuth`, then `requireSteveComplete` (NOT `requireMichaelComplete` — that middleware does not exist) |
| BA scope | forced from `req.session.baId`; injected into `identity.scope.baId` |
| Forbidden body fields | `baId`, `sponsorBaId`, `targetBaId` → `400 { code: 'BODY_BA_SCOPE_NOT_ALLOWED' }` |
| Required body field | `turn` (object) → missing/non-object yields `400 { code: 'MISSING_RUNTIME_TURN' }` |
| Resolution source | S2.20 inert facade `resolveMichaelRuntimeTurnResponse` only — fixtures by reference |
| Success shape | `200 { ok:true, selectionRequest, catalogKey, response, trace? }` |
| Inert invariants | `agentResponseGenerated === false`, `persistence === 'disabled'` |
| Trace | returned-only, redacted; present only when `MICHAEL_RUNTIME_TRACE_ENABLED === 'true'` |

Failure shapes (all deterministic — never `500`):

| Condition | Status | Shape |
|---|---|---|
| Route axis off | 503 | `{ ok:false, disabled:true, reason:'michael_runtime_disabled' }` |
| Response axis off | 503 | `{ ok:false, disabled:true, reason:'michael_runtime_response_disabled' }` |
| Missing session BA | 401 | `{ ok:false, error:'Not authenticated.' }` |
| Body BA authority | 400 | `{ ok:false, code:'BODY_BA_SCOPE_NOT_ALLOWED' }` |
| Missing/non-object turn | 400 | `{ ok:false, code:'MISSING_RUNTIME_TURN' }` |
| Facade `!ok` / throw | 422 | `{ ok:false, issues:[...] }` |

---

## Before Canary

Pre-conditions that MUST all be green before any flag is flipped. Treat any unchecked box as a
hard stop.

- [ ] **1. All merge gates pass.** Re-run the four S3.4 gates read-only and confirm clean:
  `pnpm build:shared` (exit 0), `pnpm typecheck` (exit 0), `pnpm build` (exit 0),
  `pnpm --filter @momentum/server test` (exit 0, expect **70 files / 779 tests, 0 failures**).
  Any nonzero exit or new failure blocks the canary.

- [ ] **2. Route exists.** Confirm `server/src/routes/michael-runtime.ts` defines and exports
  `handleMichaelRuntimeResolve` and `michaelRuntimeRoutes`, and that `server/src/index.ts` mounts
  `app.use('/api/michael-runtime', michaelRuntimeRoutes)`. Verifier: governance test #1 / #24 in
  `s34MichaelRuntimeRouteGovernanceBoundary.test.ts`; or `grep michael-runtime server/src/index.ts`.

- [ ] **3. Route disabled by default.** With NO env flags set, a request returns
  `503 { reason:'michael_runtime_disabled' }`. Verifier: kill-switch tests 1–2, 9; or
  `curl -s -X POST http://localhost:7700/api/michael-runtime/resolve -H 'Content-Type: application/json' -d '{}'`
  (with a valid session cookie) → expect `503` and `reason:'michael_runtime_disabled'`. Confirm
  `MICHAEL_RUNTIME_ROUTE_ENABLED` / `_RESPONSE_ENABLED` / `_TRACE_ENABLED` are all unset/`!= "true"`
  in the canary `.env`.

- [ ] **4. Route requires auth.** A request with no session BA short-circuits. Verifier: handler
  test 5 (missing-session → `401`); or unauthenticated curl → `401 { error:'Not authenticated.' }`
  (note: this is reached only after the route + response axes are on; with axes off the `503`
  precedes it — confirm via the test, which calls the handler directly).

- [ ] **5. Route requires onboarding complete (`requireSteveComplete`).** Confirm the registration
  is `.post('/resolve', requireAuth, requireSteveComplete, handleMichaelRuntimeResolve)` and the
  source imports neither `requireMichaelComplete` nor any global gate. Verifier: governance tests
  #20 and #4.

- [ ] **6. Route rejects body BA override.** A body containing `baId`, `sponsorBaId`, or
  `targetBaId` yields `400 BODY_BA_SCOPE_NOT_ALLOWED`. Verifier: handler tests 2–4, governance
  test #21; or (axes on) `curl ... -d '{"baId":"TMBA-x","turn":{}}'` → `400` with that code.

- [ ] **7. Route rejects missing turn.** A body with no `turn` (or a non-object `turn`) yields
  `400 MISSING_RUNTIME_TURN`. Verifier: handler test for missing turn; or (axes on)
  `curl ... -d '{}'` → `400 { code:'MISSING_RUNTIME_TURN' }`.

- [ ] **8. `/api/runtime/*` remains unmounted.** Confirm no `app.use('/api/runtime', ...)` exists
  and the bare runtime namespace is absent. Verifier: governance test #26
  (`/app\.use\(\s*['"`]\/api\/runtime\b/` absent) and the `orchestrationBoundary`
  `not.toMatch(/\/api\/runtime/)` guard; or `grep -n "/api/runtime" server/src/index.ts` returns
  only the `/api/michael-runtime` mount.

- [ ] **9. `.com` untouched.** Confirm no file under `apps/com/` is added or modified for the
  canary and the route imports nothing from `apps/com`. Verifier: governance test #31; or
  `git status --short apps/com` is empty.

- [ ] **10. No UI exposure.** Confirm no file under `apps/team/` (or `apps/admin/`) renders or
  calls `/api/michael-runtime/resolve` — the canary is a server-route exercise only. Verifier:
  `git status --short apps/team apps/admin` is empty; `grep -rn "michael-runtime/resolve" apps/`
  returns nothing.

- [ ] **11. Persistence disabled.** Confirm the route performs no persistent write (no
  Mongo/Neo4j/Chroma/GraphRAG/Gateway import, no `tripleStackWrite`, no
  `.insert/.update/.save/.create`). Verifier: governance tests #7–#12 and #16; success bodies
  carry `persistence:'disabled'` (handler tests 11–13, kill-switch test 11).

- [ ] **12. LLM-free.** Confirm no Anthropic/OpenAI/Claude/ScriptMaker/Ivory import and no
  completion call (`messages.create`, `chatCompletion`, etc.). Verifier: governance tests #13–#14.

- [ ] **13. Voice-free.** Confirm no `telnyx`/`pstn`/`call-control` import and no call-control
  wiring (`createCallControl`, `startCall`, `placeCall`, `dialProspect`, `callControlId`).
  Verifier: governance test #15.

- [ ] **14. S2.13 harness not used.** Confirm the route does NOT import the test-only harness
  (`michaelRuntimeResponseHarness`, `michaelRuntimeResponseScenarios`,
  `createMichaelRuntimeResponseFixtureHarness`); resolution flows only through the S2.20 facade.
  Verifier: governance test #6; or `grep -n "Harness\|Scenarios" server/src/routes/michael-runtime.ts`
  returns nothing.

---

## During Canary

Constraints and observations while the route is enabled for a single controlled session. Capture
everything manually — the route persists nothing, so the canary record is whatever the operator
writes down. Do NOT broaden traffic, surface, or audience.

- [ ] **1. One authenticated BA only.** Restrict the canary to a single authenticated `.team`
  session. Verify by reviewing server access logs for `/api/michael-runtime/resolve` — exactly one
  distinct session BA should appear for the canary window.

- [ ] **2. Kevin-owned BA account first.** The first (and ideally only) caller is a Kevin-owned
  TM BA ID. Verify the calling session resolves to that BA before sending any turn; the route forces
  scope from `req.session.baId`, so confirm the session identity, not a body field.

- [ ] **3. No prospect-facing traffic.** No prospect or `/p/{token}` flow touches this route. Verify
  no prospect token, prospect session, or `.com` origin appears in the canary request set.

- [ ] **4. No `.com`.** Confirm all canary requests originate from the `.team` surface only. Verify
  request `Origin`/`Referer` is the `.team` app, never `teammagnificent.com`.

- [ ] **5. No persistence.** Confirm no datastore mutation results from the canary. Verify each
  success body reports `persistence:'disabled'` and spot-check Mongo/Neo4j/Chroma for the canary
  window show no new michael-runtime records (there is no write path by design — this is a
  confirmation, not an expectation of finding one).

- [ ] **6. No LLM.** Confirm no Anthropic/LLM call is made during the canary. Verify no outbound
  Anthropic request in network logs and `agentResponseGenerated:false` on every response.

- [ ] **7. No dynamic generation.** Confirm responses are verbatim catalog fixtures returned by
  reference, never constructed text. Verify the `response` body matches a known catalog entry
  (e.g. `michael_next_training_step_en`, `michael_safe_fallback_degraded_en`, or an `_es` entry)
  and `agentResponseGenerated:false`.

- [ ] **8. Capture returned-only response manually.** Record the full JSON response for each canary
  turn into the S3.5 result report (the route stores nothing). Verifier: save the curl/response
  body, e.g.
  `curl -s -X POST http://localhost:7700/api/michael-runtime/resolve -H 'Content-Type: application/json' --cookie '<session>' -d '{"turn":{...}}'`
  and paste the `200` body verbatim.

- [ ] **9. Confirm fixture response only.** Confirm `catalogKey` is a known catalog key and
  `response` equals that catalog fixture by reference. Verify `catalogKey` matches the expected
  S2.17 catalog entry for the supplied turn class (clear EN → `michael_next_training_step_en`;
  degraded → `michael_safe_fallback_degraded_en`; ES → an `_es` entry).

- [ ] **10. Confirm `agentResponseGenerated:false`.** Verify every success body carries
  `agentResponseGenerated === false`. Verifier: handler tests 11, 13; observed in each canary
  response.

- [ ] **11. Confirm `persistence:"disabled"`.** Verify every success body carries
  `persistence === 'disabled'`. Verifier: handler tests 11–13, kill-switch test 11; observed in
  each canary response.

- [ ] **12. Confirm trace omitted when trace flag off.** With `MICHAEL_RUNTIME_TRACE_ENABLED` unset
  (or `!= "true"`), confirm the `200` body has NO `trace` key. Verifier: handler test 8,
  kill-switch tests 4, 6; observe response body has no `trace` field.

- [ ] **13. Confirm trace redacted when trace flag on.** If/when `MICHAEL_RUNTIME_TRACE_ENABLED`
  is exactly `"true"`, confirm the `200` body includes a `trace` object carrying NONE of the
  forbidden keys: `packet`, `contextPacket`, `retrievalAudit`, `retrieval`, `token`, `sessionId`,
  `turnId`, `correlationId`, `email`, `phone`, `prospect`, `text`. Verifier: handler test 9
  (recursive redaction walk), kill-switch tests 5, 8; manually scan the returned `trace`.

---

## After Canary

Teardown and decision. The canary is not complete until the route is returned to its default-off
inert state and the gates are re-confirmed.

- [ ] **1. Turn all flags off.** Kevin (rollback owner) unsets/sets-to-non-`"true"` all three:
  `MICHAEL_RUNTIME_ROUTE_ENABLED`, `MICHAEL_RUNTIME_RESPONSE_ENABLED`, `MICHAEL_RUNTIME_TRACE_ENABLED`.
  No code change is required — the flags are deploy-time env only and read at call time. (Agents
  do NOT flip flags; record that Kevin performed this.)

- [ ] **2. Confirm disabled state.** After the flip, a request returns
  `503 { reason:'michael_runtime_disabled' }` again. Verifier:
  `curl -s -X POST http://localhost:7700/api/michael-runtime/resolve --cookie '<session>' -d '{}'`
  → `503` with `reason:'michael_runtime_disabled'`; confirm the three env vars are no longer `"true"`.

- [ ] **3. Rerun gates.** Re-run the four merge gates read-only and confirm still green:
  `pnpm build:shared`, `pnpm typecheck`, `pnpm build`,
  `pnpm --filter @momentum/server test` (expect **70 files / 779 tests, 0 failures**). Any
  regression blocks sign-off.

- [ ] **4. Document result in report.** Write the canary outcome into a dedicated S3.5 result
  report under `engineering/reports/` — including the captured request/response bodies (After §8),
  which flags were flipped and by whom, observed shapes, and any anomaly. This checklist file is
  the plan; the result report is the evidence record.

- [ ] **5. Decide whether to proceed to `.team` UI slice.** Based on the documented result, record
  an explicit go/no-go for the next separately-gated slice (a read-only `.team` BA-facing render of
  the resolved fixture, kept compliance-clean — Michael is never prospect-facing). Persistence of
  resolved turns and any LLM/voice activation remain OUT of scope and separately gated. No UI is
  built as part of this decision step — it only records the recommendation for Kevin's approval.

---

This checklist authorizes no activation. The route must remain a one-call consumer of the S2.20
facade — fixtures-only, authenticated, BA-scoped, non-persistent, LLM-free, voice-free, returned-only
with a redacted trace — and must NOT import the S2.13 harness or revive `/api/runtime/*`. Any
enablement is Kevin's explicit, owned, reversible env decision.
