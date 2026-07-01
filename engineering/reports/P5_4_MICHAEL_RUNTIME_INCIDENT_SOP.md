# P5.4 — Michael Runtime Incident SOP

- Phase: Phase 5 — Michael Production Enablement and Operations
- Slice: P5.4 — incident standard operating procedure (documentation only)
- Status: **DOCUMENTATION ONLY.** No production code changed, no `.env` edited, no flag flipped,
  no route enabled, no deployment performed, no persistence written, no app run.
- Date: 2026-07-01
- Depends on: `SPRINT_005_P5_READINESS_AND_DEPENDENCY_GATE_ASSESSMENT.md` (phase anchor; gate lifted,
  documentation mode) and `P5_1_PRODUCTION_STAGING_ENVIRONMENT_INVENTORY.md` (env inventory).
- Extends: `SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md` (staged env-flip plan, stop
  conditions §15, rollback §14) from the local/`.team` canary to the production/staging incident case.
- Owner: Agent C (documentation)
- Source facts confirmed on disk against: `server/src/routes/michael-runtime.ts`,
  `server/src/config/michaelRuntimeFlags.ts`,
  `server/src/services/michaelRuntimeObservability.ts`,
  `server/src/routes/admin/michael-runtime-observability.ts`, and `server/src/index.ts`.

> **Non-approval banner.** This SOP documents how to **respond to** a Michael-runtime incident. It
> **authorizes no enablement.** It does not flip a flag, edit `.env`, deploy, or write to any store.
> Rollback here means an **environment / feature-flag reversal**, and it is owned by Kevin Gardner
> (§6). Any re-enablement after an incident is a separate, explicit, recorded Kevin approval
> (P5.3) — never triggered by this document, an agent, or an on-call reflex to "turn it back on."

---

## 1. Scope and posture

This SOP covers the single server-owned Michael runtime surface that exists in this base:

- **Route:** `POST /api/michael-runtime/resolve` (`server/src/routes/michael-runtime.ts`), mounted
  below the BA-FACING GATED banner at `server/src/index.ts:246` and gated
  `requireAuth` + `requireSteveComplete` (`michael-runtime.ts:189-196`). `.team`/BA-scoped only.
- **Three-axis kill switch** (`server/src/config/michaelRuntimeFlags.ts`):
  `MICHAEL_RUNTIME_ROUTE_ENABLED`, `MICHAEL_RUNTIME_RESPONSE_ENABLED`,
  `MICHAEL_RUNTIME_TRACE_ENABLED` — each default-OFF, fail-closed, read at call time, enabled only
  by the exact string `"true"` (`flagEnabled` returns `process.env[name] === 'true'`,
  `michaelRuntimeFlags.ts:12-14`).
- **Admin observability read:** `GET /api/admin/michael-runtime/observability`, `requireAdmin`
  (`ADMIN_BA_IDS`), mounted at `server/src/index.ts:135`
  (`server/src/routes/admin/michael-runtime-observability.ts`).

In scope: detection, severity classification, and the env/flag rollback for anomalies observed on
this route and its admin read. Out of scope: enabling anything, changing code, building UI, or any
of the standing-prohibited surfaces (§9). This SOP assumes the route may be under a Kevin-approved
controlled enablement (P5.3) at the time of an incident; if all three flags are off, the route is
inert and the correct posture is almost always "stay off and investigate," not respond-and-re-enable.

**Note on a stale reference.** `SPRINT_003_S3_5_...PLAN.md` §10/§15 describes an earlier body model
(`BODY_BA_SCOPE_NOT_ALLOWED` / `MISSING_RUNTIME_TURN`). The route on disk has since moved to the
S3.11 server-owned-turn contract: the client body is server-owned, the only accepted field is
optional `language` (`'en' | 'es'`), and **any** other key — or a malformed `language` — is rejected
with `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` (`michael-runtime.ts:92-119`). This SOP classifies
against the **current** source, not the stale plan text.

## 2. Severity classification (SEV levels)

Severity is assigned from **observable symptoms of this route** — HTTP status, response body shape,
trace contents, and the admin observability snapshot — not from speculation. When two levels could
apply, take the higher one.

### SEV-1 — Boundary breach (immediate rollback)

Any evidence that a standing prohibition has been crossed. Roll back first (§4), investigate after.

- **Forbidden-content trace.** A `200` response carries a `trace` (only possible when axis 3 is on,
  `michael-runtime.ts:181-183`) that contains raw upstream/generated text or an identifier/PII key.
  The route trusts `result.trace` to be pre-redacted by the facade (see §3 limitation) — a leak here
  is a SEV-1.
- **Any persistence signal.** Any write to Mongo/Neo4j/Chroma/GraphRAG/Gateway attributable to this
  route, or any `response.persistence` value other than `'disabled'`. The route and the observability
  module are both documented in-memory-only (`michaelRuntimeObservability.ts:1-12`); a persistence
  signal is a contract breach.
- **Any LLM call.** Any Anthropic/Claude/ScriptMaker/Ivory invocation attributable to this route
  (route is fixtures-only; `response.agentResponseGenerated` should be `false`).
- **`.com` / prospect-facing exposure.** The path or its behavior surfacing on `apps/com` or any
  prospect surface.
- **`/api/runtime/*` exposure.** The bare runtime namespace becoming mounted or reachable (only
  `/api/michael-runtime` is mounted, `index.ts:246`).
- **Voice/Telnyx/PSTN** activity attributable to this route.

### SEV-2 — Kill-switch / gate integrity failure (urgent, rollback expected)

The route is not honoring its fail-closed axes or its auth gate.

- **Unexpected `200` when an axis is off.** A success body while `MICHAEL_RUNTIME_ROUTE_ENABLED` or
  `MICHAEL_RUNTIME_RESPONSE_ENABLED` is not `"true"`. With axis 1 off, every authenticated request
  must return `503 michael_runtime_disabled` (`michael-runtime.ts:76-81`); with axis 1 on and axis 2
  off, `503 michael_runtime_response_disabled` (`michael-runtime.ts:85-90`).
- **`trace` present while axis 3 off.** A `200` containing `trace` when
  `MICHAEL_RUNTIME_TRACE_ENABLED` is not `"true"` (`michael-runtime.ts:181-183`).
- **Auth/gate bypass.** A `200` (or any work past axis checks) for an unauthenticated caller or one
  who has not passed `requireSteveComplete`; or a request lacking a session `baId` that is not met
  with `401 {ok:false, error:'Not authenticated.'}` (`michael-runtime.ts:121-124`).
- **`500` from the route.** Any `500`. By design every failure path is mapped to `422`
  (`michael-runtime.ts:135-163`); a `500` means an unhandled path and must be treated as an
  integrity failure, not a routine error.
- **Admin observability snapshot disagreeing with reality** — e.g. `routeEnabled:false` in the
  snapshot while the route is serving `200`s, or vice versa.

### SEV-3 — Behavioral anomaly within contract (investigate; rollback at discretion)

The route stays inside its contract but behaves unexpectedly for the current stage.

- Elevated `422` facade failures (`counters.facadeFailures` climbing) with no boundary breach.
- Elevated `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` (`counters.bodyBaOverrideRejections` climbing),
  indicating a client sending non-server-owned body fields.
- Unexpected `503` distribution (e.g. `routeDisabledSkips` rising during a stage that should be
  serving) suggesting a flag drifted off, or a deploy that did not re-read `process.env`.

### SEV-4 — Observational only

Cosmetic or non-behavioral: admin read latency, counter presentation, doc drift. No rollback; log
and fold into the post-incident write-up.

## 3. Detection sources (only those that exist on disk)

**A. Admin observability snapshot** —
`GET /api/admin/michael-runtime/observability`, admin-only via `requireAdmin` / `ADMIN_BA_IDS`
(`admin/michael-runtime-observability.ts:23-25`). Returns `{ ok: true, michaelRuntime: <snapshot> }`.
The snapshot (`michaelRuntimeObservability.ts:30-59`) is:

- **Evaluated flag booleans:** `routeEnabled`, `responseEnabled`, `traceEnabled` — computed via the
  canonical flag helpers at call time, **not** raw env strings. This is the authoritative live
  kill-switch state for triage.
- **Monotonic in-memory counters** (reset to zero on every process restart, aggregate-only, no PII /
  tokens / IDs): `routeDisabledSkips`, `responseDisabledSkips`, `successfulFacadeResolutions`,
  `facadeFailures`, `bodyBaOverrideRejections`, `missingTurnRejections`.

Wiring caveats (verified in source):
- The route increments `routeDisabledSkips` (axis-1 503), `responseDisabledSkips` (axis-2 503),
  `successfulFacadeResolutions` (200), `facadeFailures` (each 422 path), and
  `bodyBaOverrideRejections` (each `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`, both the unknown-key and
  bad-`language` branches, `michael-runtime.ts:101,111`).
- **`missingTurnRejections` is never incremented by the current route.** The counter and its
  setter `recordMichaelRuntimeMissingTurnRejection` exist in the service, but the route does **not**
  import or call it (confirmed: only the service and its own test reference the setter). Under the
  current server-owned-body model it will read `0` permanently — do not treat a flat `0` there as a
  positive health signal.
- The snapshot is process-local and **volatile**: a restart zeroes every counter, so counter deltas
  are only meaningful within a single process lifetime. Capture the snapshot before any restart.

**B. HTTP status / body patterns** — the route's own deterministic responses are the second
detection source (all verified in `michael-runtime.ts`):

| Condition | Status | Body (verbatim from source) |
|---|---|---|
| Axis 1 off | `503` | `{ ok: false, disabled: true, reason: 'michael_runtime_disabled' }` |
| Axis 1 on, axis 2 off | `503` | `{ ok: false, disabled: true, reason: 'michael_runtime_response_disabled' }` |
| Non-server-owned body field / bad `language` | `400` | `{ ok: false, error: 'Michael runtime input must be server-owned.', code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED' }` |
| No session `baId` | `401` | `{ ok: false, error: 'Not authenticated.' }` |
| Turn-source throw / `!created.ok` / facade throw / `!result.ok` | `422` | `{ ok: false, issues: [...] }` (never a `500`) |
| Axes 1+2 on, well-formed | `200` | `{ ok: true, selectionRequest, catalogKey, response }` (+ `trace` **only** if axis 3 on) |

**Detection limitation (honest):** there is no persistent metrics store, no alerting, and no
structured audit log for this route in this base — detection is a **manual admin GET plus reading
HTTP responses**. The admin route is a pure in-memory read that must never persist or audit-log
(`admin/michael-runtime-observability.ts:5-8`). Any "alerting" is out of scope here; P5.7 (monitoring
review) is the slice that would design prod signals on top of these counters.

## 4. Immediate response / rollback procedure

Rollback is a pure environment/flag reversal plus redeploy — **no code change** (extends
`S3.5 §14`). Executed by Kevin (§6).

1. **Capture evidence first (non-destructive).** Record the offending HTTP status + body and the
   admin snapshot (`GET /api/admin/michael-runtime/observability`) **before** restarting — the
   counters are in-memory and a restart zeroes them (`michaelRuntimeObservability.ts:5-8`).
2. **Set all three flags off.** Unset (preferred) or set to any non-`"true"` value:
   `MICHAEL_RUNTIME_ROUTE_ENABLED`, `MICHAEL_RUNTIME_RESPONSE_ENABLED`,
   `MICHAEL_RUNTIME_TRACE_ENABLED`. Clearing axis 1 alone fails the route closed at the first check;
   clear all three to restore the documented baseline. Only the exact string `"true"` enables an
   axis, so any other value is safe-off (`michaelRuntimeFlags.ts:12-14`).
3. **Redeploy / restart** the server process so the env change is in effect. Flags are read at call
   time, but a running process only observes new `process.env` if the deploy model re-reads it on
   restart (P5.1 §8 pre-flight item 7).
4. **Disabled-state smoke test.** Re-issue an authenticated `.team` `POST /api/michael-runtime/resolve`
   and confirm the axis-1 fail-closed response verbatim:
   `503 { ok: false, disabled: true, reason: 'michael_runtime_disabled' }`
   (`michael-runtime.ts:78-80`). Then `GET /api/admin/michael-runtime/observability` and confirm
   `routeEnabled:false`, `responseEnabled:false`, `traceEnabled:false`. The route is inert again.
5. **Rerun gates** on the rolled-back deployment (`pnpm build:shared`, `pnpm typecheck`, `pnpm build`,
   `pnpm --filter @momentum/server test`) and confirm green before considering the incident contained.

## 5. Stop conditions that trigger rollback

Halt and execute §4 immediately if ANY of the following is observed at any stage (aligned with
`S3.5 §15`, re-expressed against the current route):

- **Unexpected response** — any status/body not matching the §3 table for the current flag state:
  a `200` while an axis is off, a `500`, or a `response`/`trace` field appearing when its axis is off.
- **Trace redaction violation** — a returned `trace` carrying raw upstream/generated text or any
  identifier/PII (see §3 facade limitation below).
- **Any persistence** — any write to Mongo/Neo4j/Chroma/GraphRAG/Gateway, or any `persistence`
  value other than `'disabled'`.
- **Any LLM call** — any Anthropic/Claude/ScriptMaker/Ivory invocation from this route.
- **Any `.com` exposure** — the path or behavior surfacing on `apps/com` / any prospect surface.
- **Any `/api/runtime/*` exposure** — the bare runtime namespace becoming mounted or reachable.

Each of these is a SEV-1 or SEV-2 in §2. Any stop condition also mandates the §7 write-up before any
re-enablement is even discussed.

**Facade-trust limitation (honest).** The route trusts `result.trace` to be pre-redacted by the
upstream facade and only omits/includes it by the axis-3 flag (`michael-runtime.ts:179-183`); this
SOP did **not** read the facade to verify the exact redaction key list, so the trace stop condition
above is stated generically (raw text or any identifier/PII) rather than against a verified forbidden-
key set. Keep any future forbidden-key list in lockstep with the facade (`S3.5 §16` gap 4).

## 6. Roles and authority

- **Kevin Gardner owns the flag state and every rollback.** He decides when to trigger rollback (on
  any §5 stop condition or at discretion), executes the env reversal + redeploy, and confirms the
  §4 disabled-state smoke test. This mirrors `S3.5 §13`.
- **Agents never flip flags, never edit `.env`, never deploy.** An agent's role in an incident is
  read-only: capture the HTTP evidence and the admin snapshot, classify severity per §2, and hand the
  verified findings to Kevin. Agents do not "turn it back on" and do not self-execute rollback.
- **Admin observability read** is Kevin-only (`requireAdmin` / `ADMIN_BA_IDS`,
  `admin/michael-runtime-observability.ts:23`); it is never BA-facing and never on `.com`.

## 7. Post-incident: write-up and reconciliation before re-enablement

After containment (route confirmed inert per §4), and **before** any re-enablement:

1. **Write a dedicated incident record** (a report under `engineering/reports/`, documentation-only):
   the SEV level and why; the verbatim offending status/body and the captured admin snapshot; the
   flag state at time of incident and after rollback; the §4 steps taken and by whom; and the gate
   rerun result.
2. **Reconcile the boundary** for SEV-1/SEV-2: confirm on disk that the breached invariant (kill
   switch, gate, persistence-off, LLM-free, trace redaction, namespace) is restored, and file the
   root cause. A boundary breach is not "resolved" by rollback alone — it requires a source-level
   explanation of how the invariant was crossed.
3. **Re-enablement is a fresh P5.3 controlled-enablement decision.** It proceeds only on Kevin's
   separate, explicit, recorded, execution-time approval, following the staged axis-order plan
   (`S3.5 §9`) — never as an automatic sequel to incident closure. If root cause is unresolved, the
   route stays off.

## 8. Quick reference — flag state to expected route behavior

| `ROUTE` | `RESPONSE` | `TRACE` | Authenticated `.team` request outcome |
|---|---|---|---|
| off | (any) | (any) | `503 michael_runtime_disabled` |
| `true` | off | (any) | `503 michael_runtime_response_disabled` |
| `true` | `true` | off | `200 { ok:true, selectionRequest, catalogKey, response }` (no `trace`) |
| `true` | `true` | `true` | `200 { ..., trace }` (redacted trace included) |

"off" = unset or any value other than the exact string `"true"`. Any deviation from this table for
the live flag state is a §5 stop condition.

## 9. Explicit non-approval statement

This SOP authorizes **no** activation. No flag may be set to `"true"`, no `.env` edited, no
deployment performed, and no persistence written on the strength of this document. Specifically out
of scope and NOT approved here: no `.com`/prospect-facing exposure, no `/api/runtime/*` family, no
unapproved persistence (including the write-frozen MCS-V2 `*2` stores), no LLM calls
(Anthropic/Claude/ScriptMaker/Ivory), no dynamic text generation, no voice/Telnyx/PSTN/call-control,
no auto send/call/schedule/prospect/score/rank/qualify, and no income/comp/cycle/placement
guarantees. Rollback is an env/flag reversal owned by Kevin Gardner; re-enablement is a separate,
explicit, recorded Kevin approval (P5.3). The route remains default-off and inert until then.
