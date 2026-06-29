# S3.12 — Controlled Body-BA / Client Runtime Input Rejection Canary Checklist

**Slice:** Sprint 3 S3.12  
**Route:** `POST /api/michael-runtime/resolve`  
**Environment:** local / controlled canary only

## 1. Purpose

Verify that the live S3.11 server-owned route rejects client-supplied runtime input and body-supplied BA/prospect/session/correlation authority while still accepting the server-owned empty body and allowed `language` body.

## 2. Scope

This checklist is a controlled local verification artifact. It does not enable a production feature and does not expand Michael runtime capability.

The canary verifies only:

- Allowed `{}` and `{ language }` request bodies.
- Rejection of forbidden runtime-input fields.
- Rejection of forbidden BA/prospect/session/correlation authority fields.
- Rejection of malformed `language`.
- Missing-session protection.
- Default-off flag protection.

## 3. Local / Controlled Only

Run this only in a local or controlled canary environment.

Do **not** enable production or staging.

Do **not** commit local environment changes.

Do **not** log request bodies.

Do **not** use real BA IDs, prospect IDs, session IDs, tokens, cookies, or PII in evidence.

## 4. Required Environment

- Authenticated `.team` session in a controlled local browser or test client.
- `MICHAEL_RUNTIME_ROUTE_ENABLED=true` only in the controlled local/canary environment.
- `MICHAEL_RUNTIME_RESPONSE_ENABLED=true` only in the controlled local/canary environment.
- `MICHAEL_RUNTIME_TRACE_ENABLED` optional; default should remain off.
- No production/staging flag changes.
- No `.env` edits committed.

## 5. Payload Matrix

### Allowed

| ID | Payload | Expected status | Expected code/result |
|---|---|---:|---|
| A1 | `{}` | 200 | `ok:true`, degraded safe fallback |
| A2 | `{ "language": "en" }` | 200 | `ok:true`, EN degraded safe fallback |
| A3 | `{ "language": "es" }` | 200 | `ok:true`, current ES degraded safe fallback |

### Forbidden Runtime Input

| ID | Payload | Expected status | Expected code |
|---|---|---:|---|
| R1 | `{ "turn": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| R2 | `{ "runtimeTurn": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| R3 | `{ "contextPacket": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| R4 | `{ "retrieval": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| R5 | `{ "gateway": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| R6 | `{ "graph": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| R7 | `{ "approvedKnowledge": [] }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| R8 | `{ "candidateKnowledge": [] }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Forbidden BA / Prospect / Session Authority

| ID | Payload | Expected status | Expected code |
|---|---|---:|---|
| B1 | `{ "baId": "TMBA-EVIL-000001" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B2 | `{ "sponsorBaId": "TMBA-EVIL-SPONSOR" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B3 | `{ "targetBaId": "TMBA-EVIL-TARGET" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B4 | `{ "downlineBaId": "TMBA-EVIL-DOWNLINE" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B5 | `{ "prospectId": "PROSPECT-EVIL" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B6 | `{ "prospectToken": "TOKEN-EVIL" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B7 | `{ "token": "TOKEN-EVIL" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B8 | `{ "sessionId": "SESSION-EVIL" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B9 | `{ "turnId": "TURN-EVIL" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B10 | `{ "correlationId": "CORR-EVIL" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| B11 | `{ "requestId": "REQ-EVIL" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Mixed Payloads

| ID | Payload | Expected status | Expected code |
|---|---|---:|---|
| M1 | `{ "language": "en", "baId": "TMBA-EVIL-000001" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| M2 | `{ "language": "es", "contextPacket": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| M3 | `{ "language": "en", "turn": {} }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Malformed Language

| ID | Payload | Expected status | Expected code |
|---|---|---:|---|
| L1 | `{ "language": "fr" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| L2 | `{ "language": "" }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| L3 | `{ "language": 123 }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |
| L4 | `{ "language": null }` | 400 | `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` |

### Protection Cases

| ID | Case | Expected status | Expected result |
|---|---|---:|---|
| P1 | `{}` with no authenticated session | 401 | unauthenticated |
| P2 | `{}` with route flag default-off | 503 | `michael_runtime_disabled` |

## 6. Pass / Fail Recording Table

| ID | Status observed | Code/result observed | Pass? | Notes |
|---|---:|---|---|---|
| A1 | | | | |
| A2 | | | | |
| A3 | | | | |
| R1 | | | | |
| R2 | | | | |
| R3 | | | | |
| R4 | | | | |
| R5 | | | | |
| R6 | | | | |
| R7 | | | | |
| R8 | | | | |
| B1 | | | | |
| B2 | | | | |
| B3 | | | | |
| B4 | | | | |
| B5 | | | | |
| B6 | | | | |
| B7 | | | | |
| B8 | | | | |
| B9 | | | | |
| B10 | | | | |
| B11 | | | | |
| M1 | | | | |
| M2 | | | | |
| M3 | | | | |
| L1 | | | | |
| L2 | | | | |
| L3 | | | | |
| L4 | | | | |
| P1 | | | | |
| P2 | | | | |

## 7. Optional Local Curl Shape

Use only generic placeholders. Do not paste real cookies into committed files or reports.

Allowed empty body:

```bash
curl -i \
  -X POST http://localhost:<PORT>/api/michael-runtime/resolve \
  -H "Content-Type: application/json" \
  -b "<AUTH_COOKIE_FROM_CONTROLLED_LOCAL_SESSION>" \
  --data '{}'
```

Forbidden payload:

```bash
curl -i \
  -X POST http://localhost:<PORT>/api/michael-runtime/resolve \
  -H "Content-Type: application/json" \
  -b "<AUTH_COOKIE_FROM_CONTROLLED_LOCAL_SESSION>" \
  --data '{"baId":"TMBA-EVIL-000001"}'
```

## 8. Evidence To Collect

Collect only:

- Status code.
- Response `code` or response `reason`.
- For allowed requests, `ok:true`, `catalogKey`, `response.responseType`, and `response.persistence`.

Do not collect:

- Request bodies containing real values.
- Real cookies.
- Real BA/prospect/session identifiers.
- Screenshots containing real BA/prospect data.
- PII.
- Server logs containing request bodies.

## 9. Stop Conditions

Stop immediately if the canary requires:

- Production or staging enablement.
- Committing `.env` or deployment changes.
- Logging real request bodies.
- Persisting request/response evidence.
- LLM calls or dynamic generation.
- Voice/Telnyx/PSTN/call-control.
- `.com` changes.
- `/api/runtime/*`.
- Accepting client `turn`, `runtimeTurn`, `contextPacket`, or body BA/prospect/session authority.

## 10. Rollback Instructions

1. Unset local canary flags:

```bash
unset MICHAEL_RUNTIME_ROUTE_ENABLED
unset MICHAEL_RUNTIME_RESPONSE_ENABLED
unset MICHAEL_RUNTIME_TRACE_ENABLED
```

PowerShell equivalent:

```powershell
Remove-Item Env:\MICHAEL_RUNTIME_ROUTE_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:\MICHAEL_RUNTIME_RESPONSE_ENABLED -ErrorAction SilentlyContinue
Remove-Item Env:\MICHAEL_RUNTIME_TRACE_ENABLED -ErrorAction SilentlyContinue
```

2. Stop the local server.
3. Do not commit local environment changes.
4. Keep only status/code evidence in the verification notes.
