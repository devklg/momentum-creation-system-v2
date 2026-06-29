# Sprint 3 S3.5 — Michael Runtime Enablement Runbook (DRAFT)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.5 staged-enablement runbook for the S3.4 minimal Michael runtime route
- Status: PLANNING / DOCUMENTATION ONLY — non-authorizing draft
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Author: Agent A (S3.5 planning slice)
- Grounded in (read in full on disk, not assumed):
  - `server/src/routes/michael-runtime.ts`
  - `server/src/config/michaelRuntimeFlags.ts`
  - `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts`
  - `engineering/reports/SPRINT_003_S3_4_MINIMAL_MICHAEL_RUNTIME_ROUTE_VERIFICATION.md`

---

## 1. Purpose

This runbook documents the controlled, staged procedure for enabling the Sprint 3 S3.4
minimal Michael runtime route — `POST /api/michael-runtime/resolve` — in a `.team`-only
deployment. It describes the three independent kill-switch flags, the pre-enable checklist,
the staged enablement order, the expected behavior and manual smoke test at each stage, the
rollback procedure, the rollback owner, and the stop conditions that halt or reverse
enablement.

The route as shipped in S3.4 is fully inert in production: default-off, fixtures-only via the
inert S2.20 facade, non-persistent, LLM-free, voice-free, BA-scoped, and authenticated behind
`requireAuth + requireSteveComplete`. Enabling it does NOT activate any LLM, persistence,
dynamic text generation, voice path, or `.com` exposure. Even fully enabled, the route only
returns pre-authored catalog fixtures by reference plus a redacted, returned-only trace.

## 2. Non-Authorizing Status

**This document does NOT authorize enablement.** It is a draft procedure only. No flag may be
flipped, no environment changed, and no deployment performed on the basis of this document.
Enablement is gated on Kevin Gardner's separate, explicit approval. Until that approval is
recorded, all three flags remain off and the route remains inert in every environment.

## 3. Current Route: `POST /api/michael-runtime/resolve`

- Method/path: `POST /api/michael-runtime/resolve`.
- Mount: registered as `app.use('/api/michael-runtime', michaelRuntimeRoutes)` in
  `server/src/index.ts`, **below** the BA-FACING GATED ROUTES banner (append-only mount, after
  `/api/orientation`). The pre-gate `/api/michael` namespace is unaffected; the bare
  `/api/runtime/*` family stays unmounted.
- Gating: `michaelRuntimeRoutes.post('/resolve', requireAuth, requireSteveComplete, handleMichaelRuntimeResolve)`.
  Both middlewares run before the handler. (Note: this is `requireSteveComplete`, the on-disk
  onboarding-complete gate — there is no `requireMichaelComplete` middleware.)
- BA scope: taken from `req.session.baId` only. Body-supplied BA authority
  (`baId` / `sponsorBaId` / `targetBaId`) is rejected with
  `400 { code: 'BODY_BA_SCOPE_NOT_ALLOWED' }` (sponsor immutability, locked-spec 3.5). The
  session BA is force-injected into `identity.scope.baId` before the facade call.
- Body contract: requires `body.turn` (an object). Missing/non-object turn →
  `400 { code: 'MISSING_RUNTIME_TURN' }`.
- Resolution: a single call to the S2.20 inert facade `resolveMichaelRuntimeTurnResponse`
  (S2.17–S2.20 chain: catalog → selector → derivation → facade). Returns the pre-authored
  fixture BY REFERENCE. The route never imports the S2.13 harness, never generates text, never
  calls an LLM, never persists, and never touches a store/Gateway/retrieval helper. The facade
  is documented as never-throwing; the handler still wraps it in try/catch and maps a malformed
  turn to `422 { issues: [...] }` (never a 500).
- Surface: `.team`-only / BA-facing. Never `.com`, never prospect-facing, never voice.

## 4. Current Flags (Three-Axis Kill Switch)

Defined in `server/src/config/michaelRuntimeFlags.ts`. Each helper returns
`process.env[NAME] === 'true'`. Three independent axes:

| Axis | Env flag | Helper | Controls |
|---|---|---|---|
| 1 | `MICHAEL_RUNTIME_ROUTE_ENABLED` | `michaelRuntimeRouteEnabled()` | Whether the route does any work at all |
| 2 | `MICHAEL_RUNTIME_RESPONSE_ENABLED` | `michaelRuntimeResponseEnabled()` | Whether a resolved response body may be returned |
| 3 | `MICHAEL_RUNTIME_TRACE_ENABLED` | `michaelRuntimeTraceEnabled()` | Whether the redacted trace is included in a success response |

Properties (verified):

- Independent — no axis implies any other; each is read separately.
- Default-OFF — unset/empty env → disabled.
- Env-driven only — sourced solely from `process.env`; never from request body, query, header,
  or database.
- Read at call time — not memoized at import, so a deploy-time env change takes effect on the
  next request without a code change.
- Fail-closed — the handler checks axis 1, then axis 2, in order, before any session/body
  validation or facade call.

## 5. Default-Off State

With none of the three flags set (or any set to anything other than the exact string `"true"`),
the route is fully disabled:

- Axis 1 short-circuits first: every request returns
  `503 { ok: false, disabled: true, reason: 'michael_runtime_disabled' }` before any facade
  call, body read, or trace work.
- No response body, no trace, no `catalogKey`, no `selectionRequest` is leaked.
- This is the shipped production state after S3.4 and the Stage 0 baseline below.

## 6. Exact String `"true"` Required to Enable

Each axis is enabled **only** by the exact lowercase string `"true"`. Every other value leaves
the axis disabled, including:

- missing / unset
- empty string `""`
- `"TRUE"`, `"True"`, or any other casing
- `" true "` (surrounding whitespace)
- `"false"`, `"0"`, `"1"`, `"yes"`, `"on"`
- any malformed value

There is no truthiness coercion; the check is a strict `=== 'true'` equality. Set the env var to
the literal four-character value `true` and nothing else.

## 7. Pre-Enable Checklist

All items must be confirmed true before any flag is flipped. This is a gate, not a courtesy.

- [ ] **Gates pass.** The four merge gates are green per Agent E (gates owner): `pnpm build:shared`,
      `pnpm typecheck`, `pnpm build`, and the full server suite (`pnpm --filter @momentum/server test`).
      Agent A does not run gates; confirm Agent E's PASS verdict is current for the deployed commit.
- [ ] **`.com` untouched.** No `apps/com` file is changed; the route imports nothing under
      `apps/com/`. The five `.com` compliance prohibitions stand absolutely (Michael is never
      prospect-facing).
- [ ] **`/api/runtime/*` unmounted.** No `app.use('/api/runtime', ...)` exists. Only the distinct
      `/api/michael-runtime` namespace is mounted.
- [ ] **Route requires `requireAuth`.** Registration applies `requireAuth` first.
- [ ] **Route requires `requireSteveComplete`.** Registration applies `requireSteveComplete`
      second. (No `requireMichaelComplete` is imported or assumed.)
- [ ] **No persistence.** The route performs no Mongo/Neo4j/Chroma/GraphRAG/Gateway write and no
      `tripleStackWrite`/insert/update/save/create call shape.
- [ ] **No LLM.** No Anthropic/OpenAI/Claude/ScriptMaker/Ivory import and no completion call.
- [ ] **No dynamic generation.** Responses are verbatim catalog fixtures by reference;
      `agentResponseGenerated` stays `false`; no `text:` assembly.
- [ ] **No voice.** No Telnyx/PSTN/call-control import or wiring.
- [ ] **Route returns fixtures only.** Resolution is a single call to the inert S2.20 facade;
      every success carries `agentResponseGenerated: false` and `persistence: 'disabled'`.

## 8. Staged Enablement Order

Enable strictly in axis order. Hold at each stage long enough to run its smoke test and confirm
expected behavior before advancing. Never enable a later axis before the prior axis is confirmed.

| Stage | `MICHAEL_RUNTIME_ROUTE_ENABLED` | `MICHAEL_RUNTIME_RESPONSE_ENABLED` | `MICHAEL_RUNTIME_TRACE_ENABLED` |
|---|---|---|---|
| Stage 0 | (off) | (off) | (off) |
| Stage 1 | `true` | (off) | (off) |
| Stage 2 | `true` | `true` | (off) |
| Stage 3 | `true` | `true` | `true` |

Each stage transition is a deploy-time env change followed by a process restart/redeploy if the
runtime does not re-read `process.env` live. (The flags are read at call time, so a process that
re-reads `process.env` per request reflects the change immediately; confirm your deploy model.)

## 9. Expected Behavior at Each Stage

- **Stage 0 — all flags off.** Axis 1 fails closed. Every authenticated request returns
  `503 { ok: false, disabled: true, reason: 'michael_runtime_disabled' }`. No facade call, no
  response, no trace. (Unauthenticated requests are stopped earlier by `requireAuth`.)

- **Stage 1 — route on only.** Axis 1 passes; axis 2 fails closed. Every authenticated request
  returns `503 { ok: false, disabled: true, reason: 'michael_runtime_response_disabled' }`. No
  response body and — in this first implementation — **no trace**. Precision note: the axis-2
  check runs BEFORE the session/body-BA/turn validation in the handler, so at Stage 1 even a
  request with a missing/invalid `turn` or a forbidden BA body field still returns the
  `response_disabled` 503 (the body is never inspected at this stage).

- **Stage 2 — route + response on.** Axes 1 and 2 pass; axis 3 off. A well-formed authenticated
  request returns `200` with the success fixture **WITHOUT** a `trace` field:
  `{ ok: true, selectionRequest, catalogKey, response }`, where `response` carries
  `agentResponseGenerated: false` and `persistence: 'disabled'`. Body validation is now active:
  forbidden BA body fields → `400 BODY_BA_SCOPE_NOT_ALLOWED`; missing turn →
  `400 MISSING_RUNTIME_TURN`; missing session → `401`; facade `!ok`/throw → `422 { issues }`.

- **Stage 3 — route + response + trace on.** All three axes pass. A well-formed authenticated
  request returns `200` with the success fixture **WITH** the redacted, returned-only `trace`:
  `{ ok: true, selectionRequest, catalogKey, response, trace }`. The trace is the facade's
  already-redacted object (classification, selectionRequest, catalogKey, responseType,
  contextPacketStatus, language, `persistence: 'disabled'`, `agentResponseGenerated: false`); it
  carries none of the forbidden keys (`packet`, `contextPacket`, `retrievalAudit`, `retrieval`,
  `token`, `sessionId`, `turnId`, `correlationId`, `email`, `phone`, `prospect`, `text`) and is
  never persisted.

## 10. Manual Smoke Tests at Each Stage

Run each smoke test as an authenticated BA on the `.team` surface only. The API is served at
`http://localhost:7700` and proxied by `apps/team` (port 7702); the JWT session cookie is scoped
to `.teammagnificent.team` (shared by `apps/team` and `apps/admin`). Authenticate through the
normal `.team` login first and reuse the session cookie. Never test against `.com`.

Capture the cookie once (illustrative — substitute the real login flow / cookie jar):

```bash
# Authenticate via the normal .team login, persisting the session cookie.
# (Use the app's real auth flow; this is a placeholder for the cookie jar.)
COOKIE='momentum_session=<jwt-from-.team-login>'
BASE='http://localhost:7700'
```

A minimal well-formed body (the route only requires `body.turn` to be an object; the facade
classifies the turn). Do NOT include `baId` / `sponsorBaId` / `targetBaId` — those are rejected.

```bash
BODY='{"turn":{"identity":{"turnId":"smoke-1"},"taskType":"<valid-task>","language":"en"}}'
```

- **Stage 0 smoke.**
  ```bash
  curl -s -X POST "$BASE/api/michael-runtime/resolve" \
    -H "Content-Type: application/json" -H "Cookie: $COOKIE" -d "$BODY"
  ```
  Expect: HTTP 503, body `{"ok":false,"disabled":true,"reason":"michael_runtime_disabled"}`.

- **Stage 1 smoke.** Same curl. Expect: HTTP 503, body
  `{"ok":false,"disabled":true,"reason":"michael_runtime_response_disabled"}`. Confirm NO
  `response` and NO `trace` field. Optionally re-send with a forbidden `baId` in the body and a
  missing `turn`; at Stage 1 both still return the same `response_disabled` 503 (axis 2
  short-circuits before body validation).

- **Stage 2 smoke.** Same curl. Expect: HTTP 200, body
  `{"ok":true,"selectionRequest":{...},"catalogKey":"...","response":{...}}` with NO `trace`
  field; `response.agentResponseGenerated === false` and `response.persistence === 'disabled'`.
  Negative checks (now active): a body with `baId` → `400 BODY_BA_SCOPE_NOT_ALLOWED`; a body with
  no `turn` → `400 MISSING_RUNTIME_TURN`; no/expired session → `401`.

- **Stage 3 smoke.** Same curl. Expect: HTTP 200 with the same success body PLUS a `trace`
  object. Inspect the trace and confirm it contains none of the forbidden keys listed in §9 and
  carries `persistence: 'disabled'` / `agentResponseGenerated: false`.

At every stage, confirm the route stays `.team`-only: the same request without a valid `.team`
session cookie is rejected by `requireAuth`/`requireSteveComplete`, and no `.com` route serves
this path.

## 11. Rollback Steps

Rollback is a reverse of enablement and returns the route to the inert default-off state:

1. **Set all three flags off.** Unset `MICHAEL_RUNTIME_ROUTE_ENABLED`,
   `MICHAEL_RUNTIME_RESPONSE_ENABLED`, and `MICHAEL_RUNTIME_TRACE_ENABLED` (or set each to any
   non-`"true"` value; unsetting is preferred for clarity). Setting axis 1 off alone is
   sufficient to fail the route closed, but clear all three to restore the documented baseline.
2. **Redeploy / restart** the server process so the environment change is in effect (required if
   the deploy model does not re-read `process.env` live).
3. **Rerun gates** (Agent E / gates owner): `pnpm build:shared`, `pnpm typecheck`, `pnpm build`,
   full server suite — confirm green on the rolled-back deployment.
4. **Confirm disabled response.** Re-run the Stage 0 smoke test and confirm HTTP 503
   `{"ok":false,"disabled":true,"reason":"michael_runtime_disabled"}`. The route is inert again.

Rollback requires no code change — it is purely an env/flag reversal plus redeploy.

## 12. Rollback Owner

Rollback is owned by **Kevin Gardner** unless he explicitly delegates it for a specific
enablement window. The owner decides when to trigger rollback (on any stop condition in §13 or
at discretion) and confirms the disabled-state smoke test afterward.

## 13. Stop Conditions

Halt enablement immediately and execute rollback (§11) if ANY of the following is observed at any
stage:

- **Unexpected response** — any status/body that does not match the expected behavior for the
  current stage in §9 (e.g. a `200` success at Stage 0/1, a `500`, or a `response` body when
  response is disabled).
- **Trace redaction violation** — a returned trace containing any forbidden key
  (`packet`, `contextPacket`, `retrievalAudit`, `retrieval`, `token`, `sessionId`, `turnId`,
  `correlationId`, `email`, `phone`, `prospect`, `text`) or any raw upstream/generated text.
- **Any persistence** — any sign of a write to Mongo/Neo4j/Chroma/GraphRAG/Gateway or any
  `persistence` value other than `'disabled'` on a resolved response/trace.
- **Any LLM call** — any Anthropic/OpenAI/Claude/ScriptMaker/Ivory invocation or completion
  attempt originating from this route.
- **Any `.com` exposure** — the path or its behavior surfacing on `apps/com` / any
  prospect-facing surface.
- **Any `/api/runtime/* ` exposure** — the bare runtime namespace becoming mounted or reachable.

Any stop condition also triggers a write-up for reconciliation before re-attempting enablement.

## 14. Explicit Non-Approval Statement

This runbook is a non-authorizing DRAFT. It grants no approval to enable the Michael runtime
route in any environment. No flag may be set to `"true"`, no environment changed, and no
deployment performed on the strength of this document. Enablement — and each stage transition
within it — proceeds only on Kevin Gardner's separate, explicit, recorded approval. Absent that
approval, all three flags remain off and the route remains inert.
