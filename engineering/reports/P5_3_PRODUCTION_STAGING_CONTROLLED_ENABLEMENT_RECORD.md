# P5.3 — Production / Staging Controlled Enablement Record

- Phase: Phase 5 — Michael Production Enablement and Operations
- Slice: P5.3 — the record of an actual controlled enablement window.
- Status: **TEMPLATE — NOT YET EXECUTED.** No enablement has occurred. This is the empty record form
  to be filled **only** during an approved enablement window run per the P5.2 runbook, after the P5.8
  gate is GREEN and Kevin has authorized the window in writing.
- Date created: 2026-07-01
- Depends on: P5.2 (runbook), P5.8 (readiness gate), P5.4 (incident SOP).
- Owner: filled by the operator Kevin designates for the window; countersigned by Kevin.

> **HARD GATE.** This slice cannot be "completed" as documentation. It is completed only by executing
> a real, approved enablement and recording what happened. Until then it stays a template. Producing
> this template flips no flag, edits no `.env`, and performs no deploy.

---

## 0. Authorization block (must be filled BEFORE any flag is flipped)

| Field | Value |
|---|---|
| Kevin's explicit written approval (ref/quote + date) | _pending_ |
| Environment (staging / production) | _pending_ |
| P5.8 gate result (GREEN attestation + link) | _pending_ |
| Enablement window (start / end, timezone) | _pending_ |
| Operator (TM BA ID) | _pending_ |
| Rollback owner (default: Kevin) | _pending_ |
| First-exercise BA (TM BA ID) | _pending_ |

If the authorization block is not fully filled, **do not proceed** — there is no approved window.

## 1. Pre-flight attestation (P5.2 §3)

Record GREEN/RED + evidence for each hard-stop pre-flight item (environment 1–6, gates 7–11,
governance 12–14). Attach the P5.9 gate run output.

| Item | Result | Evidence / note |
|---|---|---|
| Flags unset at baseline | ☐ | |
| `ADMIN_BA_IDS` correct; admin 403s others | ☐ | |
| `JWT_SECRET` strong per-env; cookie domain | ☐ | |
| `PROSPECT_BASE_URL` / `CORS_ORIGINS` correct | ☐ | |
| `ANTHROPIC_API_KEY` + `TELNYX_*` unset | ☐ | |
| Deploy re-reads `process.env` | ☐ | |
| `build:shared` / `typecheck` / `build` / server test / team typecheck | ☐ | |
| No `/api/runtime/*`; `.com` untouched; persistence on approved path | ☐ | |

## 2. Stage 0 baseline (P5.2 §4)

| Check | Expected | Observed | Result |
|---|---|---|---|
| Authenticated BA → resolve | `503 michael_runtime_disabled` | _pending_ | ☐ |
| Unauthenticated → resolve | stopped by `requireAuth` | _pending_ | ☐ |
| `.com` Michael surface | none | _pending_ | ☐ |

## 3. Stage transitions (fill one row per flip; verbatim bodies)

For each stage: who flipped which flag, timestamp, the smoke-test request, the **verbatim** response
body, and pass/fail vs the P5.2 §6 expected behavior. Capture responses manually — the route persists
nothing.

| Stage | Flag set → value | By whom | Timestamp | Smoke request | Verbatim response | Match expected? |
|---|---|---|---|---|---|---|
| 1 route | `MICHAEL_RUNTIME_ROUTE_ENABLED=true` | | | | | ☐ |
| 2 response | `MICHAEL_RUNTIME_RESPONSE_ENABLED=true` | | | | | ☐ |
| 3 trace | `MICHAEL_RUNTIME_TRACE_ENABLED=true` | | | | | ☐ |

Stage 2/3 additional checks: `agentResponseGenerated:false`, `persistence:'disabled'`, `catalogKey`
by reference, any client body field other than `language` (or `language` ∉ {`en`,`es`}) →
`400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` (S3.11 server-owned-turn contract; no client turn accepted),
missing session → `401`, turn-build/resolution failure → `422 {issues}`, trace carries no forbidden key.

## 4. Observations during the window

- Admin observability (`/api/admin/michael-runtime`) readings at each stage: _pending_
- Production monitoring signals / alerts (P5.7): _pending_
- Abuse/rate observations (P5.6): _pending_
- Any anomaly: _pending_

## 5. Stop conditions encountered (P5.2 §9 / P5.4)

| Stop condition | Occurred? | Action taken | Reconciliation ref |
|---|---|---|---|
| Unexpected status/body | ☐ | | |
| Trace forbidden-key / raw text | ☐ | | |
| Any persistence | ☐ | | |
| Any LLM call | ☐ | | |
| `.com` exposure | ☐ | | |
| `/api/runtime/*` reachable | ☐ | | |
| Abuse/rate breach | ☐ | | |

## 6. Teardown (P5.2 §8)

| Step | Done | Note |
|---|---|---|
| All three flags set off | ☐ | |
| Redeploy/restart | ☐ | |
| Gates rerun green | ☐ | |
| Stage 0 `503` reconfirmed | ☐ | |

## 7. Outcome + go/no-go for next stage/environment

- Result of this window: _pending_
- Go/no-go to production (if this was staging) OR to steady-state (if production): _pending_
- Sign-off (operator): _pending_
- Countersign (Kevin): _pending_

## 8. Non-execution statement (current)

As of the creation date above, **no enablement has been performed**. All three flags remain off, the
route remains inert, and no environment has been changed. This template becomes the P5.3 record only
when an approved window is actually executed and this form is filled and signed.
