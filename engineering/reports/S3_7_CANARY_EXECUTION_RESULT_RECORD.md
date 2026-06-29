# S3.7 — Michael Runtime Route Canary Execution Result Record

**Data classification: REAL-OBSERVED** (local in-process ephemeral harness; production flags NOT flipped).

This record holds the actual observed output of a four-stage canary against the
S3.4 Michael runtime route handler (`handleMichaelRuntimeResolve`), captured by
an ephemeral local Vitest harness that was deleted after capture. Every status,
body, snapshot, and counter delta below is copied verbatim from the harness
stdout/JSON capture — none are invented.

---

## 1. Execution mode

Local canary — in-process ephemeral Vitest harness invoking the exported
`handleMichaelRuntimeResolve(req, res)` directly with mock req/res. Production
feature flags were NOT flipped. No server process, no network, no `app.listen()`.
The harness file (`server/src/routes/__tests__/_s37_canary_harness.canary.test.ts`)
was created solely to capture observed values and DELETED before completion; the
committed tree contains only this report.

## 2. Operator

Kevin Gardner (executed locally by automation on his behalf).

## 3. Timestamp

System clock via the harness run. The harness stamped its capture with
`new Date().toISOString()` at run time: **2026-06-29T01:30:11.379Z** (observed,
not invented). Treat as a deterministic local-run marker; no production wall-clock
event occurred.

## 4. Commit SHA

`cfef7a63c20a1e4f8225e14f64ded06ea0bda4fb`

## 5. Target environment

local (developer workstation, in-process; no deployed environment touched).

## 6. Flag state by stage (0–3)

Flags are read from `process.env` at call time by `config/michaelRuntimeFlags.ts`
(only the exact string `"true"` enables an axis). Flag settings accumulate across
stages as the canary progressively enables axes:

| Stage | `MICHAEL_RUNTIME_ROUTE_ENABLED` | `MICHAEL_RUNTIME_RESPONSE_ENABLED` | `MICHAEL_RUNTIME_TRACE_ENABLED` | Evaluated `{routeEnabled, responseEnabled, traceEnabled}` |
|---|---|---|---|---|
| 0 | (unset) | (unset) | (unset) | `false / false / false` |
| 1 | `"true"` | (unset) | (unset) | `true / false / false` |
| 2 | `"true"` | `"true"` | (unset) | `true / true / false` |
| 3 | `"true"` | `"true"` | `"true"` | `true / true / true` |

Evaluated flag booleans above are taken from each stage's observed
`snapshotBefore` (which reports the evaluated flag functions, not raw env strings).

## 7. Request shape used

`POST /api/michael-runtime/resolve`-equivalent in-process call. The handler is
the mounted handler (behind `requireAuth` + `requireSteveComplete` in the real
router; bypassed here by calling the exported handler directly, with an injected
authenticated session). Mock request:

- `req.session = { baId: 'TMBA-LOCAL-CANARY' }` (simulated authenticated Kevin BA session)
- `req.body = { turn: <fixture turn> }`

The `turn` was built from the inert S2.8 runtime-turn fixture harness
(`runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete', agentKey: 'michael_magnificent', taskType: 'training_support' })`)
with `taskType: 'training_support'` and `intent: 'clear_training_support'` — the
same fixture shape the S3.4 / S3.6 handler tests use. No real PII; fixture-only.

## 8. Redacted request body (all stages identical)

```json
{
  "session": { "baId": "TMBA-LOCAL-CANARY" },
  "body": {
    "turn": {
      "identity": "<fixture identity, redacted>",
      "turnId": "<fixture turnId, redacted>",
      "taskType": "training_support",
      "runtimeTurn": "<inert accepted_complete fixture, redacted>",
      "intent": "clear_training_support"
    }
  }
}
```

No body-supplied BA-authority fields (`baId` / `sponsorBaId` / `targetBaId`)
were sent. BA scope is session-derived only.

## 9. Response status by stage (ACTUAL)

| Stage | Status | Reason / outcome |
|---|---|---|
| 0 | **503** | `michael_runtime_disabled` (route axis off — fail-closed before any work) |
| 1 | **503** | `michael_runtime_response_disabled` (response axis off) |
| 2 | **200** | success; `response` present, `trace` ABSENT |
| 3 | **200** | success; `response` present, `trace` PRESENT |

## 10. Redacted response body by stage (ACTUAL)

The fixtures carry no real PII; the IDs below are S2.12 fixture constants
(`session_s2_12_*`, `turn_s2_12_*`, `corr_s2_12_*`) and are shown redacted as a
precaution.

**Stage 0:**
```json
{ "ok": false, "disabled": true, "reason": "michael_runtime_disabled" }
```

**Stage 1:**
```json
{ "ok": false, "disabled": true, "reason": "michael_runtime_response_disabled" }
```

**Stage 2 (200, trace ABSENT):**
```json
{
  "ok": true,
  "selectionRequest": {
    "agentKey": "michael_magnificent",
    "taskType": "training_support",
    "language": "en",
    "responseType": "next_training_step",
    "scenarioFamily": "complete",
    "contextPacketStatus": "complete",
    "intent": "clear_training_support"
  },
  "catalogKey": "michael_next_training_step_en",
  "response": {
    "schemaVersion": "michael_response_contract.v1",
    "responseType": "next_training_step",
    "agentKey": "michael_magnificent",
    "taskType": "training_support",
    "sessionId": "<redacted: session_s2_12_*>",
    "turnId": "<redacted: turn_s2_12_*>",
    "correlationId": "<redacted: corr_s2_12_*>",
    "contextPacketStatus": "complete",
    "language": "en",
    "text": "Review the next training step, then write down one question you want your sponsor to help you practice.",
    "safety": {
      "validationStatus": "passed",
      "guardrailIds": ["no_prospect_facing_language", "no_income_or_placement_claims", "no_automatic_actions"],
      "blockedReasonCodes": []
    },
    "persistence": "disabled",
    "generatedAt": "2026-06-28T12:00:12.000Z",
    "agentResponseGenerated": false,
    "contextPacketId": "<redacted: ctx_s2_12_michael_complete>",
    "nextStep": {
      "title": "Review the next training step",
      "instruction": "Open the next training step and make one private note about what you want to practice.",
      "baOwned": true,
      "automaticSending": false,
      "automaticCalling": false,
      "externalSideEffect": false
    }
  }
}
```
(No `trace` key present — confirmed by the absence of `trace` in the Stage-2 body.)

**Stage 3 (200, trace PRESENT):** identical `selectionRequest`, `catalogKey`,
and `response` to Stage 2, plus the redacted `trace`:
```json
{
  "trace": {
    "classification": {
      "scenarioFamily": "complete",
      "responseType": "next_training_step",
      "language": "en",
      "intent": "clear_training_support"
    },
    "selectionRequest": {
      "agentKey": "michael_magnificent",
      "taskType": "training_support",
      "language": "en",
      "responseType": "next_training_step",
      "scenarioFamily": "complete",
      "contextPacketStatus": "complete",
      "intent": "clear_training_support"
    },
    "catalogKey": "michael_next_training_step_en",
    "responseType": "next_training_step",
    "contextPacketStatus": "complete",
    "language": "en",
    "persistence": "disabled",
    "agentResponseGenerated": false
  }
}
```
The trace carries only aggregate classification/selection metadata — no token,
sessionId, turnId, correlationId, packet, retrieval, or PII keys.

## 11. Observability snapshot BEFORE each stage (ACTUAL)

Counters are NOT reset between stages, so `before` reflects accumulated state.

| Stage | routeEnabled / responseEnabled / traceEnabled | routeDisabledSkips | responseDisabledSkips | successfulFacadeResolutions | facadeFailures | bodyBaOverrideRejections | missingTurnRejections |
|---|---|---|---|---|---|---|---|
| 0 | false / false / false | 0 | 0 | 0 | 0 | 0 | 0 |
| 1 | true / false / false | 1 | 0 | 0 | 0 | 0 | 0 |
| 2 | true / true / false | 1 | 1 | 0 | 0 | 0 | 0 |
| 3 | true / true / true | 1 | 1 | 1 | 0 | 0 | 0 |

## 12. Observability snapshot AFTER each stage (ACTUAL)

| Stage | routeEnabled / responseEnabled / traceEnabled | routeDisabledSkips | responseDisabledSkips | successfulFacadeResolutions | facadeFailures | bodyBaOverrideRejections | missingTurnRejections |
|---|---|---|---|---|---|---|---|
| 0 | false / false / false | 1 | 0 | 0 | 0 | 0 | 0 |
| 1 | true / false / false | 1 | 1 | 0 | 0 | 0 | 0 |
| 2 | true / true / false | 1 | 1 | 1 | 0 | 0 | 0 |
| 3 | true / true / true | 1 | 1 | 2 | 0 | 0 | 0 |

## 13. Counter deltas (ACTUAL, per stage = after − before)

| Stage | routeDisabledSkips | responseDisabledSkips | successfulFacadeResolutions | facadeFailures | bodyBaOverrideRejections | missingTurnRejections |
|---|---|---|---|---|---|---|
| 0 | **+1** | 0 | 0 | 0 | 0 | 0 |
| 1 | 0 | **+1** | 0 | 0 | 0 | 0 |
| 2 | 0 | 0 | **+1** | 0 | 0 | 0 |
| 3 | 0 | 0 | **+1** | 0 | 0 | 0 |

Each stage incremented exactly one counter on exactly the expected branch:
route-disabled skip (0), response-disabled skip (1), successful facade
resolution (2 and 3). `facadeFailures`, `bodyBaOverrideRejections`, and
`missingTurnRejections` stayed at 0 throughout — no error/rejection branch was
exercised, consistent with a well-formed turn and session-only BA scope.

## 14. Confirmation: no `.com` surface touched

CONFIRMED. The route is `.team`-only and BA-facing. No `apps/com` code, route,
or prospect-facing surface was imported or invoked. No income/placement/AI/
headcount/THREE-branding content appears in any response body.

## 15. Confirmation: no `/api/runtime/*` route

CONFIRMED. Only the exported `handleMichaelRuntimeResolve` (the
`/api/michael-runtime/resolve` handler) was called. No `/api/runtime/*` route
family was referenced or created.

## 16. Confirmation: no persistence

CONFIRMED. No MongoDB / Neo4j / ChromaDB / Gateway / GraphRAG write occurred.
The observability module is in-memory integer counters only. Every response
carries `"persistence": "disabled"`. No `tripleStackWrite` path was reached.

## 17. Confirmation: no LLM

CONFIRMED. No Anthropic / ScriptMaker / Ivory call. Responses are pre-authored
catalog fixtures returned by reference; every response carries
`"agentResponseGenerated": false`.

## 18. Confirmation: no voice

CONFIRMED. No Telnyx / TTS / STT / call path was touched.
`nextStep.automaticCalling` is `false`; `externalSideEffect` is `false`.

## 19. Confirmation: no dynamic generation

CONFIRMED. The verbatim catalog entry `michael_next_training_step_en` was
returned by reference. No text was synthesized; `agentResponseGenerated: false`.

## 20. Confirmation: no S2.13 harness

CONFIRMED. The canary used the inert S2.8 runtime-turn fixture harness
(`runtime/orchestration/fixtures/runtimeTurnHarness.js`) to BUILD a turn input —
the same fixture the S3.4/S3.6 handler tests use. The S2.13 test-only
orchestration harness was NOT imported by the route or the canary harness.

## 21. Anomalies

- **Stage-1 body/turn-validation masking (EXPECTED, observed).** With the route
  axis on but the response axis off, the handler returns `503
  michael_runtime_response_disabled` at the Axis-2 kill switch — BEFORE the
  session check, the forbidden-body-field check, and the missing-turn check (see
  `michael-runtime.ts` lines 64–96). Consequently, in Stage 1 none of the
  request-validation branches (401 / `BODY_BA_SCOPE_NOT_ALLOWED` /
  `MISSING_RUNTIME_TURN`) can be exercised regardless of body content; the kill
  switch masks them. This is the intended fail-closed ordering (kill switch
  precedes work), not a defect — but it means validation counters cannot move
  while the response axis is off. Noted honestly per brief.
- **Counters are cumulative across stages.** The canary intentionally did NOT
  reset observability between stages, so `successfulFacadeResolutions` reads 1
  after Stage 2 and 2 after Stage 3. The per-stage DELTA is the meaningful signal
  (each = exactly +1 on one counter); both raw snapshots and deltas are recorded
  above for transparency.
- No unexpected status codes, thrown errors, 500s, or counter movement on
  unrelated branches were observed.

## 22. Rollback executed

YES. The harness unset all three `MICHAEL_RUNTIME_*` env vars at the end of the
run (restoring each to its pre-run value) and reset the in-memory observability
counters. The temporary harness file was DELETED. `git status --short` does NOT
list the harness; only report file(s) are untracked.

## 23. Final flag state

All three axes OFF — the committed default
(`config/michaelRuntimeFlags.ts` returns `false` for each axis when env is
unset). No committed code or env default was changed. Production flags were never
flipped.

## 24. Recommendation

**PROCEED.** The route behaves exactly per the S3.4/S3.6 contract under all four
flag stages: fail-closed 503s while disabled (Stages 0–1), a clean 200 with the
verbatim inert fixture and no trace under route+response (Stage 2), and a 200
with the redacted aggregate trace under all three axes (Stage 3). Observability
counters incremented on precisely the expected branches with zero error-path
movement. No persistence, LLM, voice, dynamic generation, `.com` exposure,
`/api/runtime/*`, or S2.13-harness coupling was observed. The three-axis kill
switch is the sole gate and defaults closed. Recommend advancing the S3.7 canary
sequence; no repeat, block, or rollback of route code is warranted.

---

*Capture provenance: ephemeral local Vitest harness (now deleted), Vitest 4.1.9,
single passing test, stdout JSON capture. Data above is transcribed verbatim from
that capture. This is a REAL-OBSERVED record, not a dry run.*
