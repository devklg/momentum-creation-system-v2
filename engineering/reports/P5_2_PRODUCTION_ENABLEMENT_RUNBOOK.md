# P5.2 — Michael Runtime Production / Staging Enablement Runbook

- Phase: Phase 5 — Michael Production Enablement and Operations
- Slice: P5.2 — production/staging enablement runbook (documentation only)
- Status: **DOCUMENTATION ONLY.** This runbook is a **procedure**. It sets no flag, edits no `.env`,
  performs no deploy. Executing it against a real environment requires Kevin Gardner's separate,
  explicit, recorded approval and produces the P5.3 record.
- Date: 2026-07-01
- Extends: `SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md` (local/`.team` staged plan) —
  this document lifts that procedure to the **staging** and **production** environments.
- Depends on: `SPRINT_005_P5_READINESS_AND_DEPENDENCY_GATE_ASSESSMENT.md`, `P5_1_PRODUCTION_STAGING_ENVIRONMENT_INVENTORY.md`.
- Owner: Agent C (documentation), synthesized against verified source.

> Enablement authorizes nothing on the strength of this document. Every stage transition is a
> deploy-time env change performed by Kevin (or his explicitly delegated operator) after the stage's
> pre-conditions are green. Agents never flip flags.

---

## 1. What this runbook enables (and what it does not)

**Enables (only when executed under approval):** the Michael runtime route
`POST /api/michael-runtime/resolve`, staged through its three-axis kill switch, in a staging then
production environment. The route is fixtures-only, authenticated, BA-scoped, `.team`-only,
non-persistent, LLM-free, returned-only with a redacted trace.

**Does not enable / out of scope:** any persistence (including any write to the write-frozen MCS-V2
`*2` stores), any LLM (Anthropic/ScriptMaker/Ivory — `ANTHROPIC_API_KEY` stays unset), any
voice/Telnyx path, any `.com`/prospect exposure, any revival of `/api/runtime/*`, any BA-facing UI
that is not already shipped and separately approved.

## 2. The three flags (from `server/src/config/michaelRuntimeFlags.ts`)

| Flag | Axis | Default | Enable value |
|---|---|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | 1 — route runs at all | OFF (unset) | exact `"true"` |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | 2 — response body returned | OFF (unset) | exact `"true"` |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | 3 — redacted trace included | OFF (unset) | exact `"true"` |

Flags are read at **call time**, so a deploy-time env change takes effect on process restart with no
code change. Only the exact 4-char `"true"` enables an axis; a near-miss (`"TRUE"`, `" true "`, `"1"`)
silently leaves it OFF. **Confirm the environment's secret manager can set exactly `true`.**

## 3. Pre-flight (all hard stops — do not begin if any is red)

Environment (from P5.1 §8):
1. All three `MICHAEL_RUNTIME_*` flags **unset/off** at baseline.
2. `ADMIN_BA_IDS` = real admin TM BA ID(s); `apps/admin` 403s everyone else.
3. `JWT_SECRET` strong + per-environment; cookie domain correct.
4. `PROSPECT_BASE_URL` and `CORS_ORIGINS` correct for the environment.
5. `ANTHROPIC_API_KEY` and all `TELNYX_*` **unset** (Phase-5 scope).
6. Deploy model re-reads `process.env` on restart.

Code/gates (run in a clean checkout of the deployed SHA):
7. `pnpm build:shared` → clean.
8. `pnpm typecheck` → clean (all workspaces).
9. `pnpm build` → clean (standing Vite chunk advisories are non-failing).
10. `pnpm --filter @momentum/server test` → green (record the file/test count).
11. `pnpm --filter @momentum/team typecheck` → clean.

Governance (from the standing prohibitions):
12. No `/api/runtime/*` mounted (only `/api/michael-runtime`); boundary tests green.
13. `.com` untouched; no prospect-facing consumer of the route.
14. Persistence stays on the approved path; no write to MCS-V2 `*2` stores.

## 4. Baseline verification (Stage 0 — all flags off)

Before flipping anything, confirm the shipped inert state in the target environment:

- Authenticated `.team` BA request to `POST /api/michael-runtime/resolve` →
  `503 {ok:false, disabled:true, reason:'michael_runtime_disabled'}`.
- Unauthenticated request → stopped by `requireAuth` (never reaches the flag check).
- `apps/com` shows no Michael surface.

This is the production baseline. If Stage 0 does not return the disabled 503, **stop** — the
environment is misconfigured; do not proceed.

## 5. Staged enablement (staging first, then production)

Run the **entire ladder in staging** and confirm each stage before touching production. Then repeat
in production. Enable strictly in axis order; hold at each stage long enough to run its smoke test
(§6) and confirm expected behavior before advancing. Never enable a later axis before the prior axis
is confirmed.

| Stage | ROUTE | RESPONSE | TRACE | Meaning |
|---|---|---|---|---|
| 0 | off | off | off | Baseline / shipped state |
| 1 | `true` | off | off | Route on; every request 503 `response_disabled` |
| 2 | `true` | `true` | off | Well-formed request → 200 without `trace` |
| 3 | `true` | `true` | `true` | Well-formed request → 200 with redacted `trace` |

Each transition: set the flag → redeploy/restart so `process.env` is re-read → run the stage smoke
test → confirm → only then advance. Record who flipped what and when (feeds P5.3).

## 6. Expected behavior + smoke test by stage

- **Stage 1 (route only).** Every authenticated request → `503 {reason:'michael_runtime_response_disabled'}`.
  **Load-bearing note (from S3.5 §10):** the response kill-switch check runs *before* body/turn
  validation, so at Stage 1 a malformed body or forbidden BA field is **never inspected** — do not
  try to smoke-test body rejection here; it is masked until Stage 2.
- **Stage 2 (route + response).** Well-formed authenticated request → `200 {ok:true, selectionRequest,
  catalogKey, response}` **without** `trace`; `response.agentResponseGenerated === false`;
  `response.persistence === 'disabled'`. **Server-owned body validation** now observable (S3.11
  contract, `michael-runtime.ts:92-119`): any body field other than exactly `language` — or a
  `language` value that is not `'en'`/`'es'` — → `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` (this single
  rule subsumes the old body-BA-scope and missing-turn rejections; a client-supplied `turn`,
  `baId`, `sponsorBaId`, `contextPacket`, `token`, etc. all yield this 400). The turn is
  **server-built from session identity** — no client turn is accepted. Missing session → `401`;
  turn-build failure or resolution `!ok`/throw → `422 {issues}` (never a 500).
- **Stage 3 (route + response + trace).** Well-formed request → `200 {…, trace}` with the facade's
  already-redacted, returned-only trace. Trace must carry **none** of the forbidden keys (`packet`,
  `contextPacket`, `retrievalAudit`, `retrieval`, `token`, `sessionId`, `turnId`, `correlationId`,
  `email`, `phone`, `prospect`, `text`) and must never be persisted.

Smoke tests are the minimal per-stage checks; the fuller controlled procedure is the S3.5 canary
checklist (`S3_5_CANARY_VERIFICATION_CHECKLIST.md`), adopted here by reference.

## 7. Rollout guardrails specific to production

- **One BA first.** First production exercise is a single Kevin-owned/approved BA; no prospect and
  no `.com` traffic ever reaches this route.
- **Observe before advancing.** Watch the admin observability surface (`/api/admin/michael-runtime`)
  and the production monitoring signals (P5.7) at each stage; do not advance blind.
- **Rate/abuse controls.** Confirm the P5.6 pre-enablement controls are in place before Stage 2 in
  production (the stage that first returns real response bodies).
- **Hold windows.** Hold each production stage for an agreed observation window before advancing.

## 8. Rollback (pure env reversal — no code change)

Rollback is owned by **Kevin** unless explicitly delegated for a specific window. Steps (S3.5 §14):

1. Set all three flags off (unset preferred; any non-`"true"` value also disables). Clearing axis 1
   alone fails the route closed; clear all three to restore the documented baseline.
2. Redeploy/restart so the env change is in effect.
3. Rerun gates (§3 items 7–11) and confirm green on the rolled-back deployment.
4. Re-run the Stage 0 smoke test; confirm `503 michael_runtime_disabled`. Route is inert again.

## 9. Stop conditions (halt + rollback immediately)

Any of (S3.5 §15): unexpected status/body for the current stage (e.g. a 200 at Stage 0/1, a 500, a
response body when response is disabled); a trace containing any forbidden key or raw text; any sign
of persistence (any `persistence` value ≠ `'disabled'`); any LLM call; any `.com` exposure; any
`/api/runtime/*` becoming reachable; or an abuse/rate signal beyond the P5.6 thresholds. Any stop
condition also triggers a write-up for reconciliation (P5.4 SOP) before re-attempting.

## 10. Record + non-approval

Executing this runbook produces the **P5.3 Controlled Enablement Record** — verbatim request/response
bodies, which flags were flipped and by whom, timestamps, observations, and any anomaly. Until Kevin's
separate, explicit, recorded approval authorizes an enablement window, this runbook remains a
procedure only: no flag is set to `"true"`, no `.env` is edited, and no deployment is performed on the
strength of this document.
