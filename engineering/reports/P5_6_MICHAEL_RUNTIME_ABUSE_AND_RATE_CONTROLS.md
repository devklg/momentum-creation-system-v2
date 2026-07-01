# P5.6 — Michael Runtime Abuse and Rate Controls (Design)

- Phase: Phase 5 — Michael Production Enablement and Operations
- Slice: P5.6 — abuse / rate-control **design** (documentation only)
- Status: **DESIGN / DOCUMENTATION ONLY.** No middleware implemented, no source code changed,
  no `.env` edited, no flag flipped, no route enabled, no dependency added, no persistence written.
  This document is a **plan** for abuse/rate controls, not an implementation.
- Date: 2026-07-01
- Owner: Agent B (abuse / rate-control design)
- Depends on / consistent with:
  - `engineering/reports/SPRINT_005_P5_READINESS_AND_DEPENDENCY_GATE_ASSESSMENT.md` (phase anchor; doc mode)
  - `engineering/reports/P5_1_PRODUCTION_STAGING_ENVIRONMENT_INVENTORY.md` (env posture)
  - `engineering/reports/SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md` (staged enablement)
- Source facts re-confirmed on disk this slice against `server/src/routes/michael-runtime.ts`,
  `server/src/config/michaelRuntimeFlags.ts`, `server/src/services/michaelRuntimeObservability.ts`,
  `server/src/middleware/requireAuth.ts`, `server/src/middleware/requireSteveComplete.ts`,
  `server/src/routes/admin/michael-runtime-observability.ts`, and `server/src/routes/p-login.ts`.

> This design authorizes **no** implementation. It proposes controls to add **before** and **after**
> a controlled production enablement of `POST /api/michael-runtime/resolve`, with recommended
> defaults and design constraints. Nothing here may be built, wired, or deployed on the strength of
> this document. Implementation and enablement proceed only on Kevin Gardner's separate, explicit,
> recorded, execution-time approval.

---

## 1. Scope and non-approval banner

**In scope (design only):** rate/abuse controls specific to the authenticated, `.team`-only,
BA-scoped Michael runtime route `POST /api/michael-runtime/resolve`
(`server/src/routes/michael-runtime.ts`). This covers per-BA request-rate limiting, a global
request ceiling, malformed-request handling posture, and abuse observability — as a **plan** with
recommended defaults and design constraints.

**Out of scope / explicitly not touched:** no middleware is written; no route is enabled; no
`.env` variable is set; no dependency (e.g. `express-rate-limit`) is added; no persistence store is
written; no scoring, ranking, or qualifying of BAs; no `.com` exposure; no `/api/runtime/*` revival;
no LLM; no voice/Telnyx. Any control proposed below is constrained so it cannot violate a standing
prohibition (§4 design constraints).

**Non-approval:** see §7. Lifting the Phase-4 dependency gate advanced this slice's **documentation**
scope only; it authorized no build and no activation.

## 2. Current-state assessment — what already protects this route today

Re-verified against source. The route is currently **inert and default-off**: with no
`MICHAEL_RUNTIME_*` flag set, every authenticated request short-circuits at axis 1 with
`503 michael_runtime_disabled` before any work (`michael-runtime.ts:76-81`). The protections that
already exist, independent of any rate limiting, are:

| # | Existing protection | Evidence (on disk) |
|---|---|---|
| 1 | **Authentication gate** — no valid JWT cookie → `401`; the route never runs unauthenticated. | `requireAuth` mounted on `/resolve` (`michael-runtime.ts:189-196`); `requireAuth` verifies the session cookie and 401s on missing/invalid (`middleware/requireAuth.ts:27-45`). |
| 2 | **Onboarding gate** — an authenticated BA who has not completed Steve discovery is blocked `403 STEVE_GATE_CLOSED`. | `requireSteveComplete` mounted on `/resolve` (`michael-runtime.ts:189-196`); gate logic (`middleware/requireSteveComplete.ts:35-66`). |
| 3 | **Three-axis fail-closed kill switch** — route/response/trace each default-OFF, read at call time, enabled only by the exact string `"true"`. | `michaelRuntimeFlags.ts:12-29`; fail-closed ordering `michael-runtime.ts:76-90` and `181-183`. |
| 4 | **Server-owned request body** — the only accepted field is optional `language` (`'en'`/`'es'`). Any other key, or a malformed `language`, is rejected `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`. BA scope is derived from `req.session.baId`, never the body. | `ALLOWED_BODY_FIELDS`/`SUPPORTED_BODY_LANGUAGES` (`michael-runtime.ts:60-61`); rejection loop and language check (`michael-runtime.ts:97-119`); session-derived scope (`michael-runtime.ts:121-124`, `131-134`). |
| 5 | **No LLM, no dynamic generation, no token cost** — the route resolves a pre-authored fixture by reference through the inert S2.20 facade; it never calls a model or generates text. | Route docstring `michael-runtime.ts:16-24`; facade call `michael-runtime.ts:150-159`. |
| 6 | **No persistence** — the route performs no write to Mongo/Neo4j/Chroma/Gateway/audit-log; the only side effect is in-memory aggregate counters. | Observability is in-memory only, no persistence (`services/michaelRuntimeObservability.ts:1-12`, `38-83`); route has no store/gateway import. |
| 7 | **Deterministic error mapping — never a 500 from the facade path** — facade throw / `!ok` maps to `422 {issues}`. | `michael-runtime.ts:130-164`. |
| 8 | **Admin-only observability** — the aggregate snapshot is exposed only behind `requireAdmin` (`ADMIN_BA_IDS`), never on `.com`, never BA-facing. | `routes/admin/michael-runtime-observability.ts:23-25`; `requireAdmin` gate (`middleware/requireAuth.ts:47-82`). |

**Honest current-state summary:** the route today is **inert** (default-off) and, when enabled,
already **authenticated + onboarding-gated + BA-scoped + fixtures-only + non-persistent + LLM-free**.
The single most important consequence for abuse analysis: because the route is fixtures-only with no
LLM and no persistence, **there is no per-request token cost and no per-request storage growth** — a
flood consumes CPU/memory/socket capacity, not money or database space.

**Rate limiting on this route today: none.** There is **no** rate limiter, throttle, or request
ceiling on `/api/michael-runtime/resolve`. It has no per-BA counter, no global cap, and no `429`
path. (The in-memory observability counters in `michaelRuntimeObservability.ts` are aggregate
metrics only — they neither cap nor slow any request.)

**Rate limiting elsewhere in the repo (precedent, not applied here):** a hand-rolled in-memory
sliding-window limiter exists at `server/src/routes/p-login.ts:62-93` (`rateLimitHit()` + a
`Map<string, number[]>` of hit timestamps), keyed by client IP and phone-hash, returning
`429 {ok:false, error:'rate_limited'}` on the prospect-login endpoints
(`p-login.ts:135-139, 156-157, 204-205, 266-267, 277-278`). Its configs are
`START_PER_IP {15 min, 10}`, `START_PER_PHONE {60 min, 5}`, `REDEEM_PER_IP {15 min, 30}`
(`p-login.ts:91-93`). Its own comment notes it is single-instance in-memory and "moves to Redis via
the gateway" if the server scales horizontally (`p-login.ts:64-65`). **No `express-rate-limit` (or
any rate-limit package) is a dependency** — verified: no match in any `package.json`. This precedent
is the recommended shape for §4, adapted to a per-BA (not per-IP/per-phone) key.

## 3. Threat model — when the route is enabled

Assumes a future state where `MICHAEL_RUNTIME_ROUTE_ENABLED` (and possibly response/trace) are
`"true"`. The caller is always an **authenticated, Steve-complete, `.team` BA** (unauthenticated and
un-onboarded callers are already stopped upstream — §2 #1, #2). Vectors are therefore
**authenticated-BA abuse**, not anonymous internet abuse.

### 3.1 Real vectors (mitigated by the proposed controls in §4)

- **Per-BA request flooding.** A single authenticated BA scripts a tight loop against `/resolve`.
  Today nothing caps this. Impact is **resource exhaustion** (CPU on facade resolution, event-loop
  saturation, socket/connection pressure, and unbounded growth of the in-memory observability
  counters) — **not** token cost and **not** database growth (§2 #5, #6). A shared-process flood by
  one BA degrades the route for all BAs.
- **Global concurrent flooding.** Several BAs (or one BA across sessions/tabs) drive aggregate
  request volume past what the single server process can serve, degrading the whole `/api` surface,
  not just this route. A per-BA limit alone does not bound this; a **global ceiling** does.
- **Malformed-body probing.** A BA sends bodies with unexpected keys or bad `language` values to
  probe the boundary. The route already rejects these `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`
  (§2 #4), so each probe is cheap — but a **high-rate** stream of rejects is still a flood and must
  count against the same rate budget as valid requests (see §4.3).
- **Enumeration / scope-probing.** A BA attempts to influence which BA the runtime resolves for by
  supplying `baId`/`sponsorBaId`/`targetBaId` in the body. This is **already neutralized**: those
  keys are rejected `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` and scope is session-derived
  (§2 #4). No rate control is needed to close it; it is closed by design. Rate limiting only bounds
  the **volume** of such probes.
- **Trace scraping.** If the trace axis is enabled, a BA repeatedly calls to harvest the returned
  `trace`. The trace is **already redacted by the facade** (returned-only; the forbidden-key set is
  documented in the S3.5 plan §10/§15) and is never persisted, so the content risk is bounded — but
  a high-rate scrape is a flood, bounded by the same per-BA/global limits, and the trace axis should
  stay OFF until later stages (§5).

### 3.2 Explicitly NOT threats (by existing design — do not build controls for these)

- **No LLM cost-abuse.** Fixtures-only, no model call — a flood cannot run up an Anthropic bill
  (§2 #5). Cost-based rate limiting is **not** warranted; capacity-based limiting is.
- **No storage/persistence abuse.** No write path — a flood cannot bloat Mongo/Neo4j/Chroma or the
  audit log (§2 #6).
- **No PII/identity leakage via observability.** Counters are aggregate integers with no PII, IDs,
  tokens, bodies, or traces (`michaelRuntimeObservability.ts:1-12`), so the observability surface
  itself is not an exfiltration vector.
- **No cross-BA data exposure.** BA scope is session-derived and body scope is rejected (§2 #4), so
  flooding cannot pivot a BA into another BA's scope.
- **No `.com`/prospect exposure.** The route is `.team`-only and BA-gated; prospects cannot reach it
  at all, so no anonymous/public abuse surface exists.

## 4. Proposed controls (PLAN — none implemented)

All four are **proposals**. **None is implemented**; no middleware, dependency, or store exists for
any of them today. Recommended defaults are starting points to be confirmed at implementation time
under Kevin's approval.

### 4.1 Per-BA request-rate limit

- **Intent:** bound how fast a single authenticated BA can call `/resolve`, keyed by
  `req.session.baId` (never by body, never by IP — the BA identity is the session-derived one).
- **Recommended default:** a sliding window of **≤ 30 requests / 60 s per BA**, returning
  `429 {ok:false, error:'rate_limited'}` when exceeded (matching the repo's existing 429 shape in
  `p-login.ts:139`). Tune against expected human/UI cadence during the canary; a real BA-facing UI
  issues far fewer than 30/min.
- **Shape:** mirror the proven in-memory sliding-window pattern already in the repo
  (`p-login.ts:62-93`), re-keyed on `baId` instead of IP/phone-hash. Prefer this over adding an
  `express-rate-limit` dependency for consistency with the existing precedent.
- **Placement:** as a route-local check inside `handleMichaelRuntimeResolve` (or a small dedicated
  middleware applied only to `/resolve`), evaluated **after** `requireAuth`/`requireSteveComplete`
  (so a `baId` exists) and **after** the axis-1 route kill switch (so a disabled route still
  short-circuits `503` first and a flood against a disabled route stays cheap).

### 4.2 Global request ceiling

- **Intent:** bound total `/resolve` throughput across all BAs so no combination of callers can
  saturate the process, independent of any single BA staying under the per-BA limit.
- **Recommended default:** a global sliding-window ceiling (e.g. **≤ 300 requests / 60 s** across
  all BAs) returning the same `429`, tuned to a safe fraction of the single-process capacity
  observed during the canary. This is a **capacity** guard, not a cost guard (there is no cost).
- **Shape:** a single additional in-memory window counter alongside the per-BA map.

### 4.3 Malformed-request handling

- **Current behavior (keep):** unexpected body keys and bad `language` values already return
  `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` cheaply and increment the `bodyBaOverrideRejections`
  counter (`michael-runtime.ts:97-119`; `michaelRuntimeObservability.ts:77-79`). No change to the
  rejection semantics is proposed.
- **Proposed addition:** malformed/rejected requests must **count against the same per-BA and global
  rate budgets** as valid ones (§4.1/§4.2), so a BA cannot evade the limit by sending only rejects.
  Optionally, a **tighter sub-limit on sustained 400s per BA** (e.g. a lower per-minute cap on
  rejected requests) to damp boundary-probing without penalizing an occasional client bug. This is a
  follow-up refinement, not a launch blocker.

### 4.4 Abuse observability

- **Intent:** make rate-limit activity visible to Kevin **only**, without adding PII or persistence.
- **Proposed additions (aggregate integers only):** extend the existing in-memory snapshot
  (`services/michaelRuntimeObservability.ts`) with new counters such as `perBaRateLimited` and
  `globalRateLimited`, surfaced through the existing admin-only endpoint
  `/api/admin/michael-runtime/observability` (`routes/admin/michael-runtime-observability.ts`).
  These must remain **aggregate counts with no BA identity, no IP, no body, no trace** — i.e. they
  report *that* limiting occurred and *how often*, never *who* in a way that ranks/scores a BA.

### Design constraints binding every control above

- **In-memory, not persisted.** Rate state and abuse counters live in process memory (a `Map` +
  counters), reset on restart — never written to Mongo/Neo4j/Chroma/Gateway/audit-log. This honors
  the standing no-unapproved-persistence rule and the MCS-V2 write-freeze. (If the server later
  scales horizontally, the store moves to a shared backend such as Redis — flagged, not built here —
  exactly as `p-login.ts:64-65` already anticipates.)
- **Fail-closed / fail-safe ordering.** The route kill switch (axis 1) must always evaluate
  **before** any rate check, so a disabled route stays cheap under flood. A rate check that itself
  errors must deny (or safely allow without crashing) rather than 500 — never a `500` from this
  path (§2 #7).
- **No scoring / ranking / qualifying of BAs.** Rate limiting bounds request **volume** only. It
  must not compute, store, or expose any per-BA quality/behavior score, ranking, or qualification —
  that would violate the standing "no score/rank/qualify" prohibition. Counters stay aggregate.
- **Admin-only visibility, never `.com`, never BA-facing.** Any new metric is exposed only behind
  `requireAdmin`; it never appears on `apps/com` or in a BA-facing `apps/team` surface.
- **No new dependency required.** The proposed shape reuses the in-repo sliding-window pattern; it
  does **not** require `express-rate-limit` or any package (none is currently a dependency).

## 5. Sequencing — before production enablement vs. follow-ups

**Must exist BEFORE the response axis is enabled in production (`MICHAEL_RUNTIME_RESPONSE_ENABLED="true"`):**

1. **Per-BA request-rate limit (§4.1)** — the primary guard against single-BA flooding; the route
   must not serve real fixture responses at unbounded per-BA rate.
2. **Global request ceiling (§4.2)** — the capacity guard against aggregate saturation.
3. **Abuse observability counters (§4.4)** — you cannot safely run a canary blind; the admin
   snapshot must show rate-limit activity before/during enablement (consistent with the S3.5 §12
   "observe before UI" sequencing).

Note the fail-closed ordering already gives a strong pre-condition: at **Stage 1 (route on, response
off)** every authenticated request returns `503 michael_runtime_response_disabled` regardless of
body (S3.5 §10), so a flood at Stage 1 is inexpensive even without a rate limit. The controls above
are the pre-condition for advancing to **Stage 2 (response on)**, where real fixture work runs.

**Follow-ups (after a stable canary, separately approved):**

- Tighter per-BA sub-limit on sustained 400s (§4.3).
- Any move of the in-memory store to a shared backend (Redis) if/when the server scales
  horizontally — flagged, not built here.
- Any SSE/dashboard polish on the admin observability surface (beyond the aggregate JSON).
- Trace-axis-specific throttling — deferred; the trace axis should remain OFF until later stages
  regardless (§3.1 trace scraping).

## 6. What could NOT be verified / open items for implementation time

- **Single-process assumption.** The proposed in-memory design is correct only while the server runs
  as a single process. The production/staging process/replica topology is **not verified on disk**
  (P5.1 lists hosted stores but not the app's replica count). If production runs multiple replicas,
  a per-replica in-memory limiter under-counts — the shared-store (Redis) follow-up becomes a
  pre-condition, not a follow-up. Confirm the deploy topology before implementing.
- **Capacity numbers are placeholders.** The `30/min` per-BA and `300/min` global defaults are
  starting points, not measured limits; the safe global ceiling depends on the single-process
  capacity, which must be observed during the canary before being fixed.

## 7. Explicit non-approval statement

This design authorizes **no** implementation and **no** activation. No middleware is written, no
route enabled, no `MICHAEL_RUNTIME_*` flag set to `"true"`, no `.env` edited, no dependency added,
no persistence written (including to the write-frozen MCS-V2 `*2` stores), no LLM invoked, no
voice/Telnyx path touched, no `.com`/prospect exposure, and no `/api/runtime/*` revived. Building any
control described here — and any production enablement of the Michael runtime route — requires the
P5.2 runbook and Kevin Gardner's separate, explicit, recorded, execution-time approval (P5.3). Until
then the route remains inert and default-off behind its three-axis kill switch, with no rate limiting.
