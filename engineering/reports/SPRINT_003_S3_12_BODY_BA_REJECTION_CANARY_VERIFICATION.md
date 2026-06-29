# Sprint 3 · S3.12 — Body-BA / Client Runtime Input Rejection Canary Verification

**Slice:** S3.12 — targeted body-BA / client runtime input rejection canary  
**Date:** 2026-06-29  
**Verified latest main commit before work:** `d52a198cd0392690eee16ea21f3960517c91be48`  
**Previous slice:** S3.11 — Server-Owned Turn Source Route/UI Wiring  
**Previous slice status:** `PASS WITH CONDITIONS`  
**Verdict:** `PASS WITH CONDITIONS`

## 1. Executive Result

S3.12 is complete as a canary/verification slice.

The route boundary for `POST /api/michael-runtime/resolve` is now pinned by a targeted behavioral canary matrix and a static governance boundary. The tests prove:

- Allowed server-owned bodies `{}`, `{ language: "en" }`, and `{ language: "es" }` still resolve through the server-owned turn path.
- Forbidden runtime input fields reject with `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`.
- Forbidden BA/prospect/session/correlation authority fields reject with `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`.
- Mixed allowed+forbidden payloads reject.
- Malformed `language` values reject.
- Missing session remains `401`.
- Default-off route remains `503 michael_runtime_disabled`.
- No `.com`, `/api/runtime/*`, persistence, LLM, dynamic generation, voice, Telnyx, store/Gateway/GraphRAG/retrieval access, or flag default change was introduced.

`PASS WITH CONDITIONS` rather than unqualified `PASS` because:

- The optional live/local curl canary was documented as a checklist, not executed against a real authenticated local browser session in this slice.
- The root `pnpm build:shared` script hit the Codex runtime pnpm wrapper preflight (`ERR_PNPM_IGNORED_BUILDS`) before the build ran; the equivalent direct workspace command through Kevin's fnm pnpm completed successfully.

## 2. Repo Recommendation Followed

The S3.11 recommendation named the next slice as a targeted body-BA/client-runtime-input rejection canary. S3.12 follows that recommendation exactly and does not move into approved-knowledge retrieval, production/staging enablement, persistence, LLM, voice, or `.com`.

## 3. Files Changed

Added reports:

- `engineering/reports/S3_12_BODY_BA_REJECTION_CANARY_READINESS_REVIEW.md`
- `engineering/reports/S3_12_BODY_BA_REJECTION_CONTROLLED_CANARY_CHECKLIST.md`
- `engineering/reports/SPRINT_003_S3_12_BODY_BA_REJECTION_CANARY_VERIFICATION.md`

Added tests:

- `server/src/routes/__tests__/s312MichaelRuntimeBodyBaRejectionCanary.test.ts`
- `server/src/routes/__tests__/s312MichaelRuntimeBodyBaCanaryGovernanceBoundary.test.ts`

Production code modified: **none**.

## 4. Files Not Touched

Confirmed not changed:

- `server/src/routes/michael-runtime.ts`
- `server/src/index.ts`
- `server/src/config/michaelRuntimeFlags.ts`
- `server/src/runtime/context/**`
- `server/src/runtime/orchestration/**`
- `server/src/services/michaelRuntimeObservability.ts`
- `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx`
- `apps/com/**`
- `.env`, deployment config, flag defaults

## 5. Automated Test Matrix

Behavioral canary:

- Allowed: `{}`, `{ language: "en" }`, `{ language: "es" }` -> `200`, `ok:true`, degraded safe fallback, `agentResponseGenerated:false`, `persistence:"disabled"`.
- Runtime input rejected: `turn`, `runtimeTurn`, `contextPacket`, `retrieval`, `gateway`, `graph`, `approvedKnowledge`, `candidateKnowledge`.
- Body authority rejected: `baId`, `sponsorBaId`, `targetBaId`, `downlineBaId`, `prospectId`, `prospectToken`, `token`, `sessionId`, `turnId`, `correlationId`, `requestId`.
- Mixed payloads rejected: language plus `baId`, `contextPacket`, or `turn`.
- Malformed language rejected: `"fr"`, `""`, `123`, `null`.
- Gate protections: missing session `401`; default-off route `503 michael_runtime_disabled`.

Static governance:

- Route allowlists only `language`.
- Route rejects unknown body keys.
- Route does not read body `turn`, `runtimeTurn`, `contextPacket`, `baId`, `sponsorBaId`, `targetBaId`, `downlineBaId`, `prospectId`, or `prospectToken`.
- Route still derives BA from `req.session.baId`.
- Route still calls `createMichaelRuntimeTurnForAuthenticatedBa` and `resolveMichaelRuntimeTurnResponse`.
- Route still uses `requireAuth` and `requireSteveComplete`.
- Route imports no stores, Gateway, GraphRAG, retrieval helpers, OpenAI, Anthropic, Claude, Telnyx, voice, or call-control.
- Route performs no persistence writes.
- No `/api/runtime/*` route was added.
- `.team` card request body remains only `{}` or `{ language }`, with no runtime/body-authority fields.

## 6. Manual Canary Checklist

Created:

`engineering/reports/S3_12_BODY_BA_REJECTION_CONTROLLED_CANARY_CHECKLIST.md`

The checklist is explicitly local/controlled only, prohibits production/staging enablement, prohibits request-body logging and PII evidence, includes the exact payload matrix, status/code expectations, pass/fail table, rollback steps, and generic safe curl shapes.

## 7. Gate Results

Focused S3.12:

| Command | Result | Count |
|---|---|---|
| `pnpm --filter @momentum/server test -- s312MichaelRuntimeBodyBaRejectionCanary` | PASS | 1 file / 31 tests |
| `pnpm --filter @momentum/server test -- s312MichaelRuntimeBodyBaCanaryGovernanceBoundary` | PASS | 1 file / 22 tests |

Requested regression batches:

| Command | Result | Count |
|---|---|---|
| `pnpm --filter @momentum/server test -- michael-runtime` | PASS | 7 files / 100 tests |
| `pnpm --filter @momentum/server test -- michael-runtime.server-owned-turn` | PASS | 1 file / 19 tests |
| `pnpm --filter @momentum/server test -- s311MichaelRuntimeServerOwnedTurnGovernanceBoundary` | PASS | 1 file / 19 tests |
| `pnpm --filter @momentum/server test -- s39MichaelRuntimeUiServerBoundary` | PASS | 1 file / 21 tests |
| `pnpm --filter @momentum/server test -- orchestrationBoundary s24GovernanceBoundary` | PASS | 2 files / 22 tests |

Full gates:

| Gate | Result | Notes |
|---|---|---|
| `pnpm build:shared` | ENV WRAPPER PRECHECK FAILED | Codex runtime pnpm wrapper stopped on `ERR_PNPM_IGNORED_BUILDS` before repo build ran |
| `pnpm --filter @momentum/shared build` via fnm pnpm | PASS | `tsc -p tsconfig.json` clean |
| `pnpm typecheck` equivalent: `pnpm -r typecheck` via fnm pnpm | PASS | shared, com, admin, team, server clean |
| `pnpm build` equivalent: `pnpm -r build` via fnm pnpm | PASS | all workspaces built; existing Vite chunk warnings only |
| `pnpm --filter @momentum/team typecheck` via fnm pnpm | PASS | `tsc -b` clean |
| `pnpm --filter @momentum/server test` via fnm pnpm | PASS | 84 files / 1049 tests |

Pnpm note:

- The initial root-script run used the Codex runtime pnpm at `C:\Users\email\.cache\codex-runtimes\...`, which attempted an install/dependency approval preflight and stopped on ignored native build scripts.
- The repo-local verification was therefore run with Kevin's fnm pnpm at `C:\Users\email\AppData\Local\fnm_multishells\82860_1782627114493\pnpm.CMD`.
- That command path ran the existing workspace successfully.

## 8. Required Scope Confirmations

- S3.12 is canary-only: **confirmed**.
- S3.11 route behavior remains intact: **confirmed**.
- Allowed payloads work: **confirmed**.
- Forbidden payloads reject with `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`: **confirmed**.
- Missing session remains `401`: **confirmed**.
- Default-off route remains `503 michael_runtime_disabled`: **confirmed**.
- No production/staging enablement: **confirmed**.
- No flag defaults flipped: **confirmed**.
- No `.env` or deployment config changed: **confirmed**.
- No `.com` touched: **confirmed**.
- No `/api/runtime/*`: **confirmed**.
- No persistence: **confirmed**.
- No LLM: **confirmed**.
- No dynamic text generation: **confirmed**.
- No voice/Telnyx/PSTN/call-control: **confirmed**.
- No store/Gateway/GraphRAG/retrieval access added: **confirmed**.
- Context Manager remains sole Context Packet assembler: **confirmed by S2.1/S2.4 regression batch**.
- Michael remains `.team` BA-facing training support only: **confirmed**.
- Steve and Ivory remain inactive: **confirmed**.
- Approved-knowledge retrieval remains deferred: **confirmed**.

## 9. Remaining Conditions

- Optional operator-local controlled canary can be run from the checklist with a controlled authenticated `.team` session.
- The Michael runtime remains degraded / safe-fallback-only until a separate approved Context Manager retrieval slice.
- Runtime flags remain default-off; no production/staging enablement happened here.
- Root `pnpm build:shared` through the Codex pnpm wrapper is blocked by dependency approval preflight, but direct fnm pnpm workspace gates are green.

## 10. Next Recommendation

Proceed to the next approved Sprint 3 recommendation after Kevin/operator review:

1. Run the optional controlled local canary checklist if desired.
2. Keep flags default-off unless Kevin explicitly approves a controlled enablement.
3. Plan approved Context Manager retrieval separately if the next slice is to move beyond degraded `safe_fallback`.

Do not use the next slice to flip defaults, enable prod/staging, persist runtime data, call LLMs, activate voice, touch `.com`, create `/api/runtime/*`, or accept client runtime/body-authority input.
