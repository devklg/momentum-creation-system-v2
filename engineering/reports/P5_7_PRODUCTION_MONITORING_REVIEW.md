# P5.7 — Production Monitoring Review (Michael Runtime Route)

- Phase: Phase 5 — Michael Production Enablement and Operations
- Slice: P5.7 — production monitoring review (documentation only)
- Status: **DOCUMENTATION / REVIEW ONLY.** No source code changed, no `.env` edited, no flag
  flipped, no route enabled, no counter added, no metric persisted, no app run. This slice writes
  exactly one file — this report.
- Date: 2026-07-01
- Owner: Agent C (Phase 5 monitoring review)
- Grounded in on-disk source, re-read this slice:
  - `server/src/routes/admin/michael-runtime-observability.ts`
  - `server/src/services/michaelRuntimeObservability.ts`
  - `server/src/routes/michael-runtime.ts`
  - `server/src/config/michaelRuntimeFlags.ts`
- Consistent with: `SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md` §12,
  `S3_5_ADMIN_OBSERVABILITY_PLANNING_REVIEW.md` (the prior observability plan),
  `SPRINT_005_P5_READINESS_AND_DEPENDENCY_GATE_ASSESSMENT.md`, and
  `P5_1_PRODUCTION_STAGING_ENVIRONMENT_INVENTORY.md`.

> **Non-approval banner (read first).** This review authorizes **no** activation and **no** new
> code. It describes the monitoring that exists on disk today, the gaps a production operator would
> face, and a recommended (future, separately-approved) production monitoring design. Nothing here
> flips a flag, adds a counter, persists a metric, wires an alert, or builds a dashboard. Persisting
> any metric is itself gated (see §3) and out of scope. Every "would / should / recommend" below is
> a proposal for a not-yet-built, Kevin-approved slice.

---

## 1. Scope

**In scope (documentation only):** an as-built inventory of the monitoring signals the admin
observability surface emits for `POST /api/michael-runtime/resolve`; a gap analysis of what
production monitoring needs beyond those in-memory counters; a recommended set of production
signals and alert conditions mapped to the route's actual failure modes; the privacy constraints
that bind any metric or log; and a sequencing recommendation.

**Out of scope / not approved here:** implementing any counter, metric exporter, alert, dashboard,
or health endpoint; persisting any metric to MongoDB / Neo4j / ChromaDB / GraphRAG / the audit-log
substrate / any file; any flag flip, `.env` edit, or deployment. This slice is the production
extension of the S3.6 in-memory observability layer and the S3.5 §12 observability plan — a review,
not an implementation.

---

## 2. Current-state inventory — exactly what is emitted today

The only monitoring surface for this route is the S3.6 admin endpoint
`GET /api/admin/michael-runtime/observability`
(`server/src/routes/admin/michael-runtime-observability.ts:23-25`), which is admin-only via
`requireAdmin` (`:23`) and returns `{ ok: true, michaelRuntime: <snapshot> }`. The handler header
states it is a "PURE in-memory read — it does NOT persist, does NOT audit-log, and does NOT touch
the triple-stack" (`:1-15`). It calls `getMichaelRuntimeObservabilitySnapshot()`
(`server/src/services/michaelRuntimeObservability.ts:52-59`).

### 2.1 Flag-state booleans (point-in-time, evaluated at call time)

The snapshot exposes three booleans, each read live from the canonical axis helper, never from a
raw env string (`michaelRuntimeObservability.ts:53-57`, evaluating
`server/src/config/michaelRuntimeFlags.ts:17-28`):

| Field | Source helper | Meaning |
|---|---|---|
| `routeEnabled` | `michaelRuntimeRouteEnabled()` (`MICHAEL_RUNTIME_ROUTE_ENABLED === 'true'`) | Axis 1 — route does any work at all |
| `responseEnabled` | `michaelRuntimeResponseEnabled()` (`MICHAEL_RUNTIME_RESPONSE_ENABLED === 'true'`) | Axis 2 — a resolved response body may be returned |
| `traceEnabled` | `michaelRuntimeTraceEnabled()` (`MICHAEL_RUNTIME_TRACE_ENABLED === 'true'`) | Axis 3 — redacted trace may be attached to a success |

### 2.2 Event counters (in-memory, monotonic per process lifetime)

The `counters` object is six module-level integers
(`michaelRuntimeObservability.ts:21-28`, `:38-45`), returned as a defensive copy
(`{ ...counters }`, `:57`). The module header is explicit that these are "in-memory only … NO
persistence … Counters reset to zero on every process restart" and store "no request body, no
response body, no trace, no Context Packet, no PII, and no tokens or session/turn/correlation IDs"
(`:1-9`).

| Snapshot field | Recorder | Incremented by the route where | Verified |
|---|---|---|---|
| `routeDisabledSkips` | `recordMichaelRuntimeRouteDisabled()` (`:61-63`) | axis-1 fail → 503 `michael_runtime_disabled` (`michael-runtime.ts:76-81`) | Emitted |
| `responseDisabledSkips` | `recordMichaelRuntimeResponseDisabled()` (`:65-67`) | axis-2 fail → 503 `michael_runtime_response_disabled` (`michael-runtime.ts:85-90`) | Emitted |
| `successfulFacadeResolutions` | `recordMichaelRuntimeSuccess()` (`:69-71`) | 200 success (`michael-runtime.ts:185-186`) | Emitted |
| `facadeFailures` | `recordMichaelRuntimeFacadeFailure()` (`:73-75`) | every 422 path — create() throw (`:136`), `!created.ok` (`:144`), resolve() throw (`:154`), `!result.ok` (`:162`) | Emitted (4 return paths collapse into 1 counter) |
| `bodyBaOverrideRejections` | `recordMichaelRuntimeBodyBaOverrideRejection()` (`:77-79`) | 400 `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` — both the unknown-field branch (`:100-107`) and the invalid-`language` branch (`:109-118`) | Emitted (see 2.3) |
| `missingTurnRejections` | `recordMichaelRuntimeMissingTurnRejection()` (`:81-83`) | **no route call site** | **Defined but not currently emitted** (see 2.4) |

### 2.3 Accuracy note — `bodyBaOverrideRejections` now conflates two distinct 400 causes

Under the S3.11 server-owned-turn contract, the route body validator increments
`recordMichaelRuntimeBodyBaOverrideRejection()` in **two** places that both return
`400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`: (a) any body key that is not `language`
(`michael-runtime.ts:99-108`) and (b) a `language` value that is not the string `'en'`/`'es'`
(`:109-119`). So this single counter tallies "client sent any disallowed input," not narrowly
"body-supplied BA authority." The prior S3.5 planning docs describe two separate error codes
(`BODY_BA_SCOPE_NOT_ALLOWED`, `MISSING_RUNTIME_TURN`); the on-disk route emits neither of those
codes — it emits the merged `CLIENT_RUNTIME_INPUT_NOT_ALLOWED` (`:105`, `:115`). Any production
monitoring must be labeled against the current merged rule, not the superseded plan text.

### 2.4 Accuracy note — `missingTurnRejections` is a dead counter on the current route

`recordMichaelRuntimeMissingTurnRejection()` exists in the service (`:81-83`) but has **no call
site in `michael-runtime.ts`** — it is imported and exercised only by the service unit test
(`server/src/services/__tests__/michaelRuntimeObservability.test.ts`). The S3.11 contract removed
the client-supplied `turn` (the route builds the turn server-side, `michael-runtime.ts:9-14`,
`:126-141`), so the old "missing turn" 400 path no longer exists and this counter is always `0` in
production. It is not a signal an operator can rely on; it is present for shape/back-compat only.

### 2.5 What is NOT tracked at all today

- **In-handler 401 (`Not authenticated.`, `michael-runtime.ts:121-124`)** — increments **no**
  counter. (Consistent with S3.5 plan counter #10 being conditional/dropped: `requireAuth` rejects
  upstream, so this is a defense-in-depth edge that is deliberately not instrumented.)
- **Upstream `requireAuth` / `requireSteveComplete` rejections** — enforced in middleware before
  the handler; the observability module never sees them (S3.5 plan counters #10–#11, not built).
- **No timestamps, no rates, no durations, no latency, no per-outcome history** — the snapshot is
  six cumulative integers plus three booleans, with no time dimension.
- **No trace-content / forbidden-key signal** — nothing counts or flags a redaction violation; the
  route trusts the facade's already-redacted trace (`michael-runtime.ts:179-183`) and observability
  records nothing about trace contents (correctly — see §5).
- **Nothing is persisted** — everything resets on process restart (`:1-9`).

---

## 3. Gap analysis for production monitoring

An operator running a real staging/production canary of this route (per P5.1 §2, P5.2 runbook)
gets, from the current surface, a correct but minimal picture: "are the three axes on, and how many
times since this process started did each of six outcomes happen." That is sufficient for a
single-operator, single-process, manually-polled `.team` canary. It is **not** sufficient for
production operations. Gaps:

1. **No retention / no time series.** Counters are per-process and reset on restart or redeploy
   (`michaelRuntimeObservability.ts:1-9`). Every deploy or crash zeroes history, so "how many 422s
   in the last hour" or "did success rate drop after the last flag flip" cannot be answered. A
   flag flip requires a redeploy/restart in the call-time-env model (P5.1 §8 item 7), which is
   exactly the moment the counters reset — the operator loses the before/after comparison.
2. **No rates or ratios.** Only raw cumulative counts exist. Alerting on production health needs
   derived signals (success-per-minute, 422-rate, error ratio) that must be computed by an external
   collector sampling the endpoint over time — none exists today.
3. **No alerting.** There is no threshold, no notifier, no escalation. Monitoring today is
   pull-only: an admin must manually `GET` the endpoint and eyeball six integers. Nothing pages
   Kevin on a spike.
4. **No push / no dashboard / no SSE.** The S3.5 plan mentions an optional SSE snapshot mirroring
   the `liveOps` pattern; it was **not** built. The endpoint is a one-shot JSON read only.
5. **No liveness / readiness health check for this route specifically.** `/api/health` exists at
   the app level (server boot order docs), but there is no Michael-runtime-scoped health signal
   that an external monitor can poll to confirm the route is reachable and in its expected axis
   state.
6. **Multi-instance blindness.** In-memory counters are per-process. If production runs more than
   one server instance behind a load balancer, each has its own counters and the admin read hits
   only one — there is no aggregation across instances.
7. **The two accuracy gaps in §2.3 / §2.4** — a conflated 400 counter and a dead `missingTurn`
   counter — mean an operator cannot, from counters alone, distinguish "disallowed extra field"
   from "bad language value," and must never read `missingTurnRejections` as a live signal.

**Gate on closing the retention gap (load-bearing):** the obvious fix for gaps 1–2 and 6 is to
**persist** metrics to a durable store or ship them to an external time-series system. That is
**itself gated** and cannot be done in Phase 5 documentation scope:

- The S3.5 observability plan constraint #18 requires that writing any counter to
  MongoDB/Neo4j/ChromaDB/GraphRAG/audit-log/file is a separate, separately-approved slice, and if
  to the triple stack must conform to the GraphRAG schema contract.
- Per `P5_1_PRODUCTION_STAGING_ENVIRONMENT_INVENTORY.md` §3 and the readiness assessment §5, the
  MCS-V2 dedicated stores (the gateway's `*2` tool set) are **write-frozen** pending approved
  schemas — metrics cannot be written there.
- The readiness assessment §5 records "No unapproved persistence" as a standing prohibition still
  in force. The route itself returns `persistence:'disabled'`.

So production metric retention is a **future, separately-approved** increment. The in-memory
surface is intentionally the first (and currently only) pass.

---

## 4. Recommended production monitoring signals + alert conditions

All of the following are **proposals for a future approved slice**, built **only** on signals that
exist today or are directly derivable from the route's actual return paths (§2). No new payload
capture is proposed. An external collector (out-of-process) would sample the admin snapshot on an
interval and compute rates/deltas; nothing below requires changing the route.

### 4.1 Signals to derive (from existing snapshot fields)

| Derived signal | Built from | Why |
|---|---|---|
| Axis-state gauge (3 booleans) | `routeEnabled` / `responseEnabled` / `traceEnabled` (§2.1) | The canary dashboard — confirm which axes are live at a glance |
| Success rate (per interval) | delta of `successfulFacadeResolutions` (§2.2) | Primary health signal |
| Facade-failure rate | delta of `facadeFailures` | Key error signal (422s) |
| Disallowed-input rate | delta of `bodyBaOverrideRejections` (label it "disallowed client input," per §2.3) | Client-shape / probing signal |
| Route/response-disabled skips | delta of `routeDisabledSkips` / `responseDisabledSkips` | Confirms a flag flip took effect at redeploy |

### 4.2 Alert conditions mapped to failure modes

| Alert | Condition (derivable) | Rationale / mapped failure mode |
|---|---|---|
| **Success while an axis is off** | `successfulFacadeResolutions` increments while `responseEnabled === false` (or `routeEnabled === false`) in the same/adjacent snapshot | Direct contradiction of fail-closed ordering (`michael-runtime.ts:76-90`); an S3.5 §15 stop condition ("a `200` success at Stage 0/1"). Page immediately. |
| **Facade-failure spike** | `facadeFailures` delta over interval exceeds a baseline threshold | Rising 422s mean malformed server-owned turns or a facade-chain regression (`michael-runtime.ts:136-163`). Investigate; consider rollback. |
| **422s with zero successes** | `facadeFailures` climbing while `successfulFacadeResolutions` flat, response axis on | Route is enabled but effectively broken end-to-end. Rollback candidate. |
| **Disallowed-input spike** | `bodyBaOverrideRejections` delta exceeds baseline | A misbehaving or probing client hitting the server-owned-body boundary (`michael-runtime.ts:99-119`) — sponsor-immutability / input boundary defense. |
| **Unexpected disabled-skips after enable** | `routeDisabledSkips` / `responseDisabledSkips` still climbing after a flag was set to `true` | The near-miss env value problem (`"TRUE"`/`" true "` etc. leave the axis off — `michaelRuntimeFlags.ts:12-14`, P5.1 §2). Signals a silent fail-closed. |
| **Axis drift** | any of the three booleans differs from the approved canary stage (P5.1 §2 / S3.5 §9 stage table) | Flag state is not what the runbook expects — halt and reconcile. |
| **Forbidden-key trace signal** (if ever emitted) | any future counter/flag indicating a trace redaction violation fires | S3.5 §15 stop condition. **Note:** no such signal exists today (§2.5) — this alert can only be wired if a forbidden-key detector is added in a separate approved slice; it must never capture the trace body (§5). |

Every threshold above is a baseline-relative delta on an existing count or a boolean comparison —
no new field, no payload, no identity. Alerts fire on **counts and booleans only**.

---

## 5. Privacy constraints (bind every metric and log)

These are non-negotiable and already honored by the current in-memory module
(`michaelRuntimeObservability.ts:1-9`); any production monitoring MUST preserve them:

1. **No PII** — no BA/prospect names, emails, phones, addresses, THREE IDs, or any person-identifying
   field in any metric, label, or log line. Counts are population-level tallies only.
2. **No IDs** — no invite tokens, session IDs, turn IDs, correlation IDs, catalog-key-as-identity,
   or BA IDs in any metric or label.
3. **No request/response body** — never capture the resolved fixture `response` or `selectionRequest`
   (`michael-runtime.ts:166-177`). Observe *that* a success happened, never *what* was returned.
4. **No trace body** — the redacted trace stays returned-only to the calling client
   (`michael-runtime.ts:179-183`); monitoring records at most *that* a traced success occurred,
   never the trace contents — even though already redacted.
5. **No Context Packet** — the route never assembles one; monitoring must not reconstruct, capture,
   or expose packet fragments or retrieval audit.
6. **Admin-only surface** — the read stays behind `requireAdmin` / `ADMIN_BA_IDS`
   (`michael-runtime-observability.ts:23`). **Never `.com`.** Not BA-facing on `apps/team`. This is
   operational telemetry for Kevin's `/admin` only.
7. **No raw env strings** — the surface reports the evaluated boolean, never echoes the
   `MICHAEL_RUNTIME_*` variable contents (`michaelRuntimeObservability.ts:53-57`).

Any external collector/alerting pipeline inherits all seven: it may store timestamps and integer
counts only. If a metric label would require any of the above to be meaningful, it must be dropped,
not approximated — mirroring how counters #10–#11 and the `missingTurn` signal are handled today.

---

## 6. Sequencing

1. **Minimal in-memory observability — EXISTS (S3.6, landed).** Three flag booleans + six counters,
   admin-only, non-persistent, resets on restart. This is the current pass and is sufficient for a
   supervised, single-process, manually-polled `.team`/staging canary. No further work required to
   use it; only the two accuracy caveats (§2.3, §2.4) must be understood by the operator.
2. **Production metric retention + alerting — REQUIRES APPROVAL.** External time-series collection
   (sampling the existing admin snapshot out-of-process), rate derivation, threshold alerting, and
   any durable metric storage. **Gated:** persistence constraint #18, the write-frozen MCS-V2 `*2`
   stores, and the standing "no unapproved persistence" prohibition (§3). Prefer an out-of-process
   collector that reads the existing endpoint over adding writes inside the app; if any in-app
   persistence is ever wanted, it is its own approved slice conforming to the GraphRAG schema
   contract.
3. **Dashboards / SSE / multi-instance aggregation — LAST.** Push/SSE snapshot (the deferred
   `liveOps`-style stream), an admin `MetricsRow`-style card, and cross-instance aggregation come
   after retention + alerting prove stable. Polish, not safety instrument.

Rule of ordering: do not build (2) or (3) before Kevin approves them; do not let (2)/(3) introduce
any payload, ID, or persistence that (1) correctly avoids.

---

## 7. Explicit non-approval statement

This review authorizes **no** activation and **no** implementation. No `MICHAEL_RUNTIME_*` flag may
be set to `"true"`, no `.env` edited, no deployment performed, no counter added, no metric persisted
(to Mongo/Neo4j/Chroma/GraphRAG/audit-log/file/the write-frozen MCS-V2 `*2` stores), no alert wired,
no dashboard or health endpoint built, and no app run on the strength of this document. The route
remains inert and default-off behind the three-axis kill switch; the only monitoring surface is the
existing S3.6 in-memory admin read. Production metric retention, alerting, and dashboards remain
future, separately-approved increments gated on Kevin Gardner's explicit, recorded approval.

---

— Agent C, Phase 5 P5.7 (production monitoring review — documentation only).
