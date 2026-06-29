# Sprint 3 S3.7 — Canary Execution Checklist and Request Plan (Agent B)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.7 multi-agent CANARY EXECUTION-RECORD slice. This document (Agent B) is the
  staged execution checklist + request plan for a **LOCAL, in-process canary** of the S3.4
  minimal Michael runtime route (`POST /api/michael-runtime/resolve`).
- Status: **DOCUMENTATION ONLY** — no code changed, no production/staging flag flipped, no
  commit. The only file created by Agent B is this report.
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner (this doc): Agent B
- Grounded against (read in full on disk this slice):
  - `server/src/routes/michael-runtime.ts`
  - `server/src/config/michaelRuntimeFlags.ts`
  - `server/src/services/michaelRuntimeObservability.ts`
  - `server/src/routes/admin/michael-runtime-observability.ts`
  - `engineering/reports/SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md`
  - Facade/adapter chain for the request body shape:
    `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts`,
    `michaelRuntimeAdapterContract.ts`, `michaelResponseSelectionRequest.ts`,
    `fixtures/runtimeTurnHarness.ts`, and `types.ts` (`MichaelRuntimeAdapterContractInput`).

> **Scope statement (read first).** This is the plan for a **local in-process canary** only —
> a developer-machine exercise of the exported handler `handleMichaelRuntimeResolve(req, res)`
> (or the mounted route on a local dev server at `:7700`) under mocked/local session + locally
> set process env, with the observability counters read in-process or via the admin route on the
> same local process. **Production/staging flag flips are NOT authorized by this document.** No
> environment outside the operator's local machine may be touched. Each real-environment stage
> transition proceeds only on Kevin Gardner's separate, explicit, recorded approval (S3.5 §13,
> §19). Agent B writes the plan; Agent C executes the local canary; neither flips a deployed flag.

---

## 1. What is under test, and the three-axis kill switch

`handleMichaelRuntimeResolve(req, res)` is **synchronous**, **exported**, and reads exactly three
inputs: `req.session.baId`, `req.body.turn`, and the three env-driven flag functions. It is a
one-call consumer of the inert S2.20 facade `resolveMichaelRuntimeTurnResponse(...)` —
fixtures-only, non-persistent, LLM-free, voice-free, `.team`-only, BA-scoped, fail-closed.

The three axes (`server/src/config/michaelRuntimeFlags.ts`), each `process.env[name] === 'true'`
evaluated **at call time** — only the exact 4-char lowercase string `true` enables; anything else
(`""`, `"TRUE"`, `" true "`, `"1"`, `"yes"`, `"0"`, `"false"`, unset) leaves the axis disabled:

| Axis | Env var | Gate in handler |
|---|---|---|
| 1 — route | `MICHAEL_RUNTIME_ROUTE_ENABLED` | `michael-runtime.ts:55` — fail-closed `503 michael_runtime_disabled` |
| 2 — response | `MICHAEL_RUNTIME_RESPONSE_ENABLED` | `michael-runtime.ts:64` — fail-closed `503 michael_runtime_response_disabled` |
| 3 — trace | `MICHAEL_RUNTIME_TRACE_ENABLED` | `michael-runtime.ts:148` — includes `trace` in 200 only when `true` |

### 1.1 Load-bearing precision — axis-2 check precedes body/turn validation

Carried verbatim from S3.5 §10 and re-confirmed against source. In the handler the order is:

1. axis-1 route check (`:55-60`)
2. **axis-2 response check (`:64-69`)**
3. session `baId` check (`:71-74`, `401`)
4. forbidden-BA-body-field check (`:79-88`, `400 BODY_BA_SCOPE_NOT_ALLOWED`)
5. `turn` presence/type check (`:90-96`, `400 MISSING_RUNTIME_TURN`)
6. facade call + axis-3 trace gate (`:117-153`)

Therefore at **Stage 1 (route on, response off) EVERY authenticated request returns
`503 michael_runtime_response_disabled` regardless of body** — a missing/invalid `turn` or a
forbidden BA body field is **never inspected** at Stage 1. The body-validation counters
(`bodyBaOverrideRejections` / `missingTurnRejections`) and their `400` responses
(`BODY_BA_SCOPE_NOT_ALLOWED` / `MISSING_RUNTIME_TURN`) only become observable at **Stage 2+**.
Do not attempt to smoke-test body rejection at Stage 1; it is masked by the fail-closed axis-2
short-circuit.

### 1.2 Observability snapshot shape

`getMichaelRuntimeObservabilitySnapshot()` (`michaelRuntimeObservability.ts:52`) returns
evaluated booleans + a defensive copy of monotonic, in-memory, process-lifetime counters
(reset only on process restart or the test-only reset). Shape:

```jsonc
{
  "routeEnabled": false,
  "responseEnabled": false,
  "traceEnabled": false,
  "counters": {
    "routeDisabledSkips": 0,
    "responseDisabledSkips": 0,
    "successfulFacadeResolutions": 0,
    "facadeFailures": 0,
    "bodyBaOverrideRejections": 0,
    "missingTurnRejections": 0
  }
}
```

Admin read route: `GET /api/admin/michael-runtime/observability` → `{ ok: true, michaelRuntime: <snapshot> }`,
behind `requireAdmin` (`ADMIN_BA_IDS`), pure in-memory, no persistence/audit-log
(`server/src/routes/admin/michael-runtime-observability.ts`). The booleans are evaluated via the
canonical flag functions at call time, never the raw env string.

> **Counter caveat for the canary.** Counters are **monotonic** and **reset only on process
> restart**. Record the snapshot **before** and **after** each call and assert on the **delta**
> (`+1` on the expected counter, `+0` on all others), not on absolute values — a previous call in
> the same process leaves residue. Where a clean baseline is required, restart the local process
> between stages (preferred) and re-confirm the snapshot reads all-zero counters.

---

## 2. Sample fixture-compatible request body

The request body is `{ turn: <MichaelRuntimeAdapterContractInput> }`. The handler reads
`req.body.turn`, rejects forbidden top-level BA fields, requires `turn` to be a non-null object,
forces `turn.identity.scope.baId = req.session.baId` (server-authoritative — sponsor
immutability, `michael-runtime.ts:98-113`), then calls the facade with that scoped input.

### 2.1 The realistic minimal `turn` is NOT flat JSON — it embeds a harness result

`MichaelRuntimeAdapterContractInput` (`types.ts:470-478`) is:

```ts
{
  identity: AgentRuntimeAdapterDispatchIdentity;   // { agentKey:'michael_magnificent', language?:'en'|'es', scope?:{...} }
  turnId: RuntimeTurnId;                            // opaque id string
  taskType: RuntimeTaskType;                        // 'training_support'
  runtimeTurn: RuntimeTurnFixtureHarnessResult;     // <-- the heavy part
  turnClarity?: 'clear' | 'ambiguous';
  language?: unknown;                               // 'en' | 'es' (else falls back to safe English)
  intent?: MichaelRuntimeAdapterContractIntent;
}
```

The adapter immediately reads `input.runtimeTurn.result` (`michaelRuntimeAdapterContract.ts:60`)
and inspects nested `consumption` / `contextRequestResult` / `metadata` to classify. A
`RuntimeTurnFixtureHarnessResult` is the **output of the S2 runtime-turn harness**
(`runRuntimeTurnFixtureScenario(...)` in `fixtures/runtimeTurnHarness.ts`), not a hand-authored
literal. The facade is documented as never-throwing, but the **route** wraps it in try/catch and
maps a malformed turn to `422 { issues:[{code:'resolution_error'}] }` (`michael-runtime.ts:118-126`)
— **so a flat/garbage `turn` yields 422, never a 200.** To get a Stage 2/3 `200 ok:true` the
canary MUST supply a real harness-produced `runtimeTurn`.

### 2.2 How Agent C should build the body (in-process canary)

Build the adapter input exactly as the facade test does
(`__tests__/michaelRuntimeResolutionFacade.test.ts:33-62`, `buildAdapterInput`), then place it
under `turn`:

```ts
import { runRuntimeTurnFixtureScenario } from
  '../../runtime/orchestration/fixtures/runtimeTurnHarness.js';

const runtimeTurn = await runRuntimeTurnFixtureScenario({
  scenario: 'accepted_complete',          // → complete context → next_training_step fixture
  agentKey: 'michael_magnificent',
  taskType: 'training_support',
});

const turn = {
  identity: runtimeTurn.input.identity,   // agentKey: 'michael_magnificent'
  turnId:   runtimeTurn.input.turnId,
  taskType: 'training_support',
  runtimeTurn,                            // the harness result, by reference
  language: 'en',                         // 'en' | 'es' supported; else safe English fallback
  // NO baId/sponsorBaId/targetBaId at body top level — those are rejected (400)
};

const reqBody = { turn };                 // POST /api/michael-runtime/resolve body
```

`scenario: 'accepted_complete'` resolves through the inert chain to the
`nextTrainingStepEn` fixture (catalog key for `complete` / `next_training_step`), with
`agentResponseGenerated:false` and `persistence:'disabled'` coming straight from the fixture —
no LLM, no text generation, no persistence.

### 2.3 If a flat HTTP body is required instead

If Agent C cannot construct the harness object in-process (e.g. driving the mounted route over
HTTP from an external client), then a minimal hand-authored `turn` will **not** reach a 200 —
the adapter will throw on the missing `runtimeTurn.result` shape and the route returns `422`.
**State this as expected:** for a 200 the harness-built body of §2.2 is mandatory; the minimal
shape is otherwise `{ turn: { identity:{agentKey:'michael_magnificent'}, turnId:'…',
taskType:'training_support', runtimeTurn:{…harness…} } }`, and absent a valid harness
`runtimeTurn` the facade yields a deterministic failure (`422`), not the default fixture. The
in-process build of §2.2 is the supported canary path.

---

## 3. Redaction rules for captured request/response

Apply to every artifact recorded during the canary (the route itself stores nothing; capture is
manual and operator-owned, so redaction is the operator's responsibility):

1. **No tokens** — no prospect invite tokens, no access codes (`TM-XXXX`), no JWT/session cookie
   values, no bearer/auth headers.
2. **No session IDs** — do not record the session object, cookie, or any session correlation
   value.
3. **No turn/correlation IDs** — redact `turnId`, any `correlationId`, request IDs, and any
   harness-internal scenario/run identifiers. Replace with a stable placeholder
   (`turnId: "<redacted-turn-id>"`).
4. **No PII** — no email, phone, prospect name, BA real name, or any free text that could carry
   prospect/BA identity.
5. **`baId` is shown as a simulated local value only** — e.g. `TMBA-SIM-000001` (a fabricated
   local placeholder, NOT a real TM BA ID). Never record a production BA ID. The session `baId`
   used for the canary must itself be a local simulated value.
6. **No raw Context Packet / retrieval content** — never record `packet`, `contextPacket`,
   `retrievalAudit`, `retrieval`, or any nested upstream material, even if it appears in a debug
   object.
7. **Response capture is metadata-only** — record `ok`, `catalogKey`, `selectionRequest`
   (already metadata: agentKey/taskType/language/responseType/scenarioFamily), and the response
   fixture's structural flags (`agentResponseGenerated`, `persistence`). Redact any free-text
   fields inside the fixture body before storing if present.
8. **Trace (Stage 3 only) is metadata-only and must be re-verified** — the facade returns an
   already-redacted, returned-only trace built from controlled metadata
   (`michaelRuntimeResolutionFacade.ts:53-73`, never spreads the response). Before recording,
   confirm it carries **none** of the forbidden keys: `packet`, `contextPacket`, `retrievalAudit`,
   `retrieval`, `token`, `sessionId`, `turnId`, `correlationId`, `email`, `phone`, `prospect`,
   `text`. If any appears → **stop condition** (§7).

---

## 4. Staged execution checklist

Pre-flight (before Stage 0): on a clean local process confirm the snapshot reads all flags
`false` and all counters `0` (restart the local process to guarantee a zero baseline). Use a
**simulated local session** (`req.session.baId = "TMBA-SIM-000001"`) and a locally set process
env only. Record before/after snapshots per stage and assert on **deltas**.

Enable strictly in axis order; never enable a later axis before the prior axis is confirmed.
Flags are read at call time, so in-process you may `process.env.X = 'true'` immediately before
the call; for the mounted-route path on a local dev server, set env and restart the local process.

### Stage 0 — all off (baseline / shipped state)

| Flag | Value |
|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | (unset) |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | (unset) |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | (unset) |

- **Request:** authenticated (simulated `baId`), any body (the body is never inspected — axis 1
  short-circuits first).
- **Expected response:** `503` `{ ok:false, disabled:true, reason:'michael_runtime_disabled' }`.
- **Expected counter delta:** `routeDisabledSkips +1`; all others `+0`.
- **Pass criteria:** status is `503` AND `reason === 'michael_runtime_disabled'` AND only
  `routeDisabledSkips` advanced. Any `200`, any `response` body, or any other counter moving →
  stop (§7).

### Stage 1 — route only

| Flag | Value |
|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | `true` |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | (unset) |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | (unset) |

- **Request:** authenticated; body irrelevant (see §1.1 masking). Run **two** calls — one with
  the valid §2.2 body, one with a deliberately invalid body — and confirm **both** return the
  same `response_disabled` 503 and that **no body-validation counter moves**.
- **Expected response:** `503` `{ ok:false, disabled:true, reason:'michael_runtime_response_disabled' }`.
- **Expected counter delta:** `responseDisabledSkips +1` per call; `bodyBaOverrideRejections +0`
  and `missingTurnRejections +0` **even for the invalid body** (masking confirmed).
- **Snapshot booleans:** `routeEnabled:true`, `responseEnabled:false`, `traceEnabled:false`.
- **Pass criteria:** both calls `503 michael_runtime_response_disabled`; only `responseDisabledSkips`
  advanced. Any body-validation 400, any 200, or any body counter moving at this stage → stop.

### Stage 2 — route + response

| Flag | Value |
|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | `true` |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | `true` |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | (unset) |

- **Request:** authenticated; **valid §2.2 harness body**.
- **Expected response:** `200` `{ ok:true, selectionRequest, catalogKey, response }` with
  **`trace` ABSENT**, `response.agentResponseGenerated === false`,
  `response.persistence === 'disabled'` (values originate from the fixture, not the route).
- **Expected counter delta:** `successfulFacadeResolutions +1`; all others `+0`.
- **No persistence, no LLM:** confirm zero writes to Mongo/Neo4j/Chroma/GraphRAG/Gateway and zero
  Anthropic/Claude/ScriptMaker/Ivory calls (the route imports none).
- **Optional negative checks (now observable):** forbidden BA body field →
  `400 BODY_BA_SCOPE_NOT_ALLOWED` (`bodyBaOverrideRejections +1`); missing/non-object `turn` →
  `400 MISSING_RUNTIME_TURN` (`missingTurnRejections +1`); facade `!ok`/throw → `422` (never 500,
  `facadeFailures +1`). Run these only if a body-validation record is wanted; each is a separate
  call with its own delta.
- **Pass criteria:** `200 ok:true`, `response` present, **no `trace` key**,
  `agentResponseGenerated:false`, `persistence:'disabled'`, `successfulFacadeResolutions +1`, no
  persistence/LLM side effect. A `trace` field present at Stage 2 → stop (§7).

### Stage 3 — route + response + trace

| Flag | Value |
|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | `true` |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | `true` |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | `true` |

- **Request:** authenticated; **valid §2.2 harness body**.
- **Expected response:** `200` `{ ok:true, selectionRequest, catalogKey, response, trace }` with
  **`trace` PRESENT and redacted** (returned-only, never persisted),
  `response.agentResponseGenerated === false`, `response.persistence === 'disabled'`, and
  `trace.persistence === 'disabled'`, `trace.agentResponseGenerated === false`.
- **Expected counter delta:** `successfulFacadeResolutions +1`; all others `+0` (there is no
  trace-specific counter — trace inclusion is a response-shape change, not a counted event).
- **Trace redaction check (mandatory):** the returned `trace` must contain **none** of:
  `packet`, `contextPacket`, `retrievalAudit`, `retrieval`, `token`, `sessionId`, `turnId`,
  `correlationId`, `email`, `phone`, `prospect`, `text`, nor any raw upstream/generated text. It
  should carry only `classification`, `selectionRequest`, `catalogKey`, `responseType`,
  `contextPacketStatus`, `language`, `persistence`, `agentResponseGenerated`
  (`michaelRuntimeResolutionFacade.ts:53-73`, `types.ts:823-832`).
- **Pass criteria:** `200 ok:true`, `response` present, `trace` present AND passes the redaction
  check, `agentResponseGenerated:false`, `persistence:'disabled'`, `successfulFacadeResolutions
  +1`, no trace persistence anywhere. Any forbidden trace key or raw text → stop (§7).

---

## 5. Expected admin observability response after each stage

`GET /api/admin/michael-runtime/observability` → `{ ok:true, michaelRuntime:<snapshot> }`.
Counters shown below assume a **clean process restarted before Stage 0** and **one canary call
per stage** (Stage 1 shown with a single call for clarity; running the extra invalid-body call
adds another `responseDisabledSkips`). Counters are cumulative across stages within the same
process — restart between stages if you want each stage to read in isolation.

**After Stage 0 (one call):**
```jsonc
{ "ok": true, "michaelRuntime": {
  "routeEnabled": false, "responseEnabled": false, "traceEnabled": false,
  "counters": { "routeDisabledSkips": 1, "responseDisabledSkips": 0,
    "successfulFacadeResolutions": 0, "facadeFailures": 0,
    "bodyBaOverrideRejections": 0, "missingTurnRejections": 0 } } }
```

**After Stage 1 (one call, fresh process):**
```jsonc
{ "ok": true, "michaelRuntime": {
  "routeEnabled": true, "responseEnabled": false, "traceEnabled": false,
  "counters": { "routeDisabledSkips": 0, "responseDisabledSkips": 1,
    "successfulFacadeResolutions": 0, "facadeFailures": 0,
    "bodyBaOverrideRejections": 0, "missingTurnRejections": 0 } } }
```
(Body-validation counters stay `0` even if an invalid body was sent — §1.1 masking.)

**After Stage 2 (one valid call, fresh process):**
```jsonc
{ "ok": true, "michaelRuntime": {
  "routeEnabled": true, "responseEnabled": true, "traceEnabled": false,
  "counters": { "routeDisabledSkips": 0, "responseDisabledSkips": 0,
    "successfulFacadeResolutions": 1, "facadeFailures": 0,
    "bodyBaOverrideRejections": 0, "missingTurnRejections": 0 } } }
```

**After Stage 3 (one valid call, fresh process):**
```jsonc
{ "ok": true, "michaelRuntime": {
  "routeEnabled": true, "responseEnabled": true, "traceEnabled": true,
  "counters": { "routeDisabledSkips": 0, "responseDisabledSkips": 0,
    "successfulFacadeResolutions": 1, "facadeFailures": 0,
    "bodyBaOverrideRejections": 0, "missingTurnRejections": 0 } } }
```

If stages run in one continuous process without restart, expect the booleans to track the current
stage and the counters to be the running sum of every call made so far — assert on deltas.

---

## 6. Stage rollback command (unset the env vars)

Rollback is a pure env reversal — no code change (S3.5 §14). For the **local** canary:

```bash
# Bash (Git Bash) — local process / shell
unset MICHAEL_RUNTIME_ROUTE_ENABLED
unset MICHAEL_RUNTIME_RESPONSE_ENABLED
unset MICHAEL_RUNTIME_TRACE_ENABLED
```

```powershell
# PowerShell — local process / shell
Remove-Item Env:MICHAEL_RUNTIME_ROUTE_ENABLED   -ErrorAction SilentlyContinue
Remove-Item Env:MICHAEL_RUNTIME_RESPONSE_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:MICHAEL_RUNTIME_TRACE_ENABLED    -ErrorAction SilentlyContinue
```

In-process (between canary calls): `delete process.env.MICHAEL_RUNTIME_ROUTE_ENABLED` (and the
other two). Unsetting is preferred; any non-`"true"` value also disables. Clearing axis 1 alone
fails the route closed, but clear **all three** to restore the documented baseline. Then restart
the local process if running the mounted route, and re-run the Stage 0 smoke test to confirm
`503 michael_runtime_disabled` and an all-`false`/baseline snapshot. **No deployed/staging env is
unset by this document** — rollback here is local-only.

---

## 7. Stop conditions

Halt the canary immediately and execute the §6 rollback if ANY of the following is observed at
any stage (S3.5 §15, extended for this slice):

1. **Any persistence** — any sign of a write to Mongo / Neo4j / Chroma / GraphRAG / Gateway /
   audit-log, or any `persistence` value (response or trace) other than `'disabled'`.
2. **Any LLM call** — any Anthropic / OpenAI / Claude / ScriptMaker / Ivory invocation or
   completion attempt originating from this route, or `agentResponseGenerated` ever `true`.
3. **Any dynamic text** — any response/trace field carrying generated or non-fixture free text
   (the route returns the fixture BY REFERENCE; novel text means a leak or a wiring change).
4. **Trace leak of raw Context Packet / IDs** — a returned trace (Stage 3) containing any of
   `packet`, `contextPacket`, `retrievalAudit`, `retrieval`, `token`, `sessionId`, `turnId`,
   `correlationId`, `email`, `phone`, `prospect`, `text`, or any raw upstream text.
5. **Any `.com` / prospect-facing exposure** — the path or its behavior surfacing on `apps/com`
   or any prospect-facing surface (Michael is BA-facing only).
6. **Any `/api/runtime/*` exposure** — the bare runtime namespace becoming mounted or reachable
   (only `/api/michael-runtime/resolve` is in scope).
7. **Unexpected status** — any status/body not matching the §4 expected behavior for the current
   stage: a `200` at Stage 0/1, a `response` body when response is disabled, a `trace` at Stage
   2, a `500` at any stage, or a body-validation counter moving at Stage 1.

Any stop condition also triggers a written reconciliation note before re-attempting.

---

## 8. Who records results

- **Operator / authority:** Kevin Gardner (or an explicitly delegated operator for a specific,
  recorded window) owns the decision to begin, the flag values, and any go/no-go between stages.
  Agents never flip a deployed/staging flag (S3.5 §13).
- **Local canary executor (this slice):** **Agent C** runs the LOCAL in-process canary — builds
  the §2.2 body, sets local env per stage, invokes `handleMichaelRuntimeResolve` (or the local
  mounted route), reads the before/after observability snapshots, applies the §3 redaction rules,
  and records the verbatim (redacted) request/response/snapshot deltas into the dedicated S3.7
  execution-record report (Agent C's artifact — not this file).
- **This document (Agent B):** the plan only. It produces no execution results, flips no flag,
  and records no live capture.

---

## 9. Non-approval statement

This plan authorizes **no** production or staging activation. No deployed flag may be set to
`"true"`, no deployed environment changed, and no deployment performed on the strength of this
document. The only authorized exercise is a **local, in-process canary** on the operator's own
machine, executed by Agent C, with local env and a simulated session, fully reversible via §6.
Out of scope and NOT approved here (S3.5 §19): any persistence, any LLM, any dynamic text, any
voice/Telnyx, any `.com`/prospect-facing exposure, any `/api/runtime/*` revival, any UI, and any
import of the S2.13 harness. The route remains the inert, default-off, fixtures-only,
returned-only one-call consumer of the S2.20 facade until Kevin Gardner's separate, explicit,
recorded approval lands for any real-environment enablement.
