# S3.12 — Body-BA / Client Runtime Input Rejection Canary Readiness Review

**Slice:** Sprint 3 S3.12 — targeted body-BA / client runtime input rejection canary  
**Role:** Agent A readiness / scope review  
**Date:** 2026-06-29  
**Verified branch/head:** `main` at `d52a198cd0392690eee16ea21f3960517c91be48`  
**Working tree at review start:** clean

## 1. Previous Slice Status

S3.11 is committed at `d52a198cd0392690eee16ea21f3960517c91be48`.

The authoritative S3.11 verification report is:

`engineering/reports/SPRINT_003_S3_11_SERVER_OWNED_ROUTE_UI_WIRING_VERIFICATION.md`

S3.11 verdict: **PASS WITH CONDITIONS**.

Carried conditions:

- Degraded / safe-fallback-only. Approved-knowledge retrieval remains deferred.
- Runtime flags remain default-off. No production or staging enablement was performed.

## 2. Repo Recommendation Used

The S3.11 recommendation section names the next slice as a **targeted body-BA rejection canary** against the live S3.11 route boundary.

The active S3.12 objective is therefore:

`POST /api/michael-runtime/resolve` must reject client-supplied runtime input and body-supplied BA/prospect/session/correlation authority while still accepting server-owned empty or language-only bodies when the route/session gates are valid.

## 3. Current Route Behavior

Current route source:

`server/src/routes/michael-runtime.ts`

Observed behavior:

- The route is mounted as `POST /api/michael-runtime/resolve`.
- It uses `requireAuth` and `requireSteveComplete`.
- It reads BA identity only from `req.session?.baId`.
- It allowlists exactly one request body key: `language`.
- Any non-`language` key returns `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`.
- Malformed `language` values return `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`.
- Missing session returns `401`.
- Default-off route flag returns `503 michael_runtime_disabled`.
- With route + response flags enabled and a session BA present, `{}` / `{ language: "en" }` resolve to `michael_safe_fallback_degraded_en`.
- `{ language: "es" }` resolves to the current Spanish safe-fallback sibling.
- The route calls `createMichaelRuntimeTurnForAuthenticatedBa` and then `resolveMichaelRuntimeTurnResponse`.
- The route imports no stores, Gateway, GraphRAG, retrieval helpers, OpenAI, Anthropic, Claude, Telnyx, voice, or call-control modules.

## 4. Existing Automated Coverage

Existing S3.11 tests already prove the route shape and a smaller rejection set:

- `server/src/routes/__tests__/michael-runtime.server-owned-turn.test.ts`
- `server/src/routes/__tests__/michael-runtime.turn-source.test.ts`
- `server/src/routes/__tests__/s311MichaelRuntimeServerOwnedTurnGovernanceBoundary.test.ts`
- `server/src/routes/__tests__/s310MichaelRuntimeRouteBoundary.test.ts`

S3.12 should not weaken those tests. It should add a more explicit canary matrix and a matching static governance boundary.

## 5. Exact Canary Scope

This is a verification/canary slice only.

Allowed:

- Add focused S3.12 behavioral tests.
- Add focused S3.12 static governance tests.
- Add readiness, controlled canary checklist, and final verification reports.
- Run gates and document exact results.

Not allowed:

- Production route changes unless the S3.12 tests reveal a real S3.11 boundary bug.
- Flag default changes.
- Production or staging enablement.
- Persistence, request-body logging, traces, transcripts, Context Packet persistence, or canary-payload storage.
- LLM calls or dynamic text generation.
- Voice, Telnyx, PSTN, or call-control activation.
- `.com` changes.
- `/api/runtime/*` creation.
- Approved-knowledge retrieval implementation.

## 6. Files Allowed To Change

- `server/src/routes/__tests__/s312MichaelRuntimeBodyBaRejectionCanary.test.ts`
- `server/src/routes/__tests__/s312MichaelRuntimeBodyBaCanaryGovernanceBoundary.test.ts`
- `engineering/reports/S3_12_BODY_BA_REJECTION_CANARY_READINESS_REVIEW.md`
- `engineering/reports/S3_12_BODY_BA_REJECTION_CONTROLLED_CANARY_CHECKLIST.md`
- `engineering/reports/SPRINT_003_S3_12_BODY_BA_REJECTION_CANARY_VERIFICATION.md`

Production code remains out of scope unless a test exposes a true boundary defect.

## 7. Files Prohibited From Change

- `apps/com/**`
- `.env`, `.env.example`, deployment config, CI secrets, or runtime flag defaults
- `server/src/index.ts` unless a real S3.12 blocker proves a mount issue; no such blocker is expected
- `server/src/routes/michael-runtime.ts` unless tests reveal a true S3.11 boundary bug
- `server/src/runtime/context/**` and `server/src/runtime/orchestration/**` unless tests reveal a true S3.11 boundary bug
- Store, Gateway, GraphRAG, retrieval, LLM, Telnyx, voice, and persistence modules
- Ratified governance documents

## 8. Payload Matrix

### Allowed

| Payload | Expected |
|---|---|
| `{}` | `200`, `ok:true`, degraded safe fallback, EN catalog |
| `{ "language": "en" }` | `200`, `ok:true`, degraded safe fallback, EN catalog |
| `{ "language": "es" }` | `200`, `ok:true`, degraded safe fallback, current ES catalog behavior |

### Forbidden Runtime Input

| Payload | Expected |
|---|---|
| `{ "turn": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "runtimeTurn": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "contextPacket": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "retrieval": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "gateway": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "graph": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "approvedKnowledge": [] }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "candidateKnowledge": [] }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Forbidden BA / Prospect / Session Authority

| Payload | Expected |
|---|---|
| `{ "baId": "TMBA-EVIL-000001" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "sponsorBaId": "TMBA-EVIL-SPONSOR" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "targetBaId": "TMBA-EVIL-TARGET" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "downlineBaId": "TMBA-EVIL-DOWNLINE" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "prospectId": "PROSPECT-EVIL" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "prospectToken": "TOKEN-EVIL" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "token": "TOKEN-EVIL" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "sessionId": "SESSION-EVIL" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "turnId": "TURN-EVIL" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "correlationId": "CORR-EVIL" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "requestId": "REQ-EVIL" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Mixed Payloads

| Payload | Expected |
|---|---|
| `{ "language": "en", "baId": "TMBA-EVIL-000001" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "language": "es", "contextPacket": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "language": "en", "turn": {} }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Malformed Language

| Payload | Expected |
|---|---|
| `{ "language": "fr" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "language": "" }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "language": 123 }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| `{ "language": null }` | `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Gate / Protection Cases

| Case | Expected |
|---|---|
| `{}` with no session BA | `401`, no success/facade counters |
| `{}` with flags absent/default-off | `503 michael_runtime_disabled`, no success/facade counters |

## 9. Automated Versus Manual

Automated:

- Direct exported handler tests using the existing mock request/response pattern.
- Static source-scanning governance boundary tests.
- Full build/typecheck/server test gates.

Manual/local controlled canary:

- Optional operator-local curl or browser-session canary with controlled auth cookie.
- Status code and response code only.
- No request body logs, no real BA/prospect/session IDs, no screenshots containing real PII.

## 10. Stop Conditions

Stop and report if any step requires:

- Default flag flips.
- Production or staging enablement.
- Persistence or logging of request bodies/canary evidence.
- LLM calls or dynamic generation.
- Voice/Telnyx/PSTN/call-control activation.
- `.com` edits.
- `/api/runtime/*`.
- Approved-knowledge retrieval.
- Weakening S2.1/S2.4 Context Manager boundary tests.
- Accepting client `turn`, `runtimeTurn`, `contextPacket`, or body BA/prospect/session authority.
- Logging real BA/prospect/session identifiers.
- A full gate failure that cannot be corrected inside canary scope.

## 11. Readiness Verdict

**PROCEED.**

The route already appears to enforce the S3.12 boundary. S3.12 should add explicit matrix coverage, a local controlled canary checklist, and a final verification report without production code changes.
