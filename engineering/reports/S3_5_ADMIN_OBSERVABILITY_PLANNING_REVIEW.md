# Sprint 3 S3.5 — Admin Observability Planning Review (Michael Runtime Route)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.5 (planning slice) — observability needs for `POST /api/michael-runtime/resolve`
- Status: **PLANNING / DOCUMENTATION ONLY — NOTHING IN THIS DOCUMENT IS IMPLEMENTED**
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent C (Sprint 3 S3.5 planning slice)
- Branch context: planning artifact only; no code, no flags, no gates, no commit

> **Scope guard (read first).** This is a written plan for a *future, separately-approved*
> observability slice. It defines **what** to observe and the **constraints** any future
> implementation must honor. It changes no code, adds no counters, persists no logs, touches no
> admin UI, flips no env flag, runs no gate, and commits nothing. Every "MUST / will / should"
> below is a *proposed requirement for a not-yet-built slice*, contingent on Kevin's explicit
> approval. Until that approval lands, none of the metrics, fields, surfaces, or behaviors
> described here exist.

---

## 0. Grounding — the route as it exists today

The single observable subject is `POST /api/michael-runtime/resolve`, implemented in
[server/src/routes/michael-runtime.ts](../../server/src/routes/michael-runtime.ts) and gated by the
three-axis kill switch in
[server/src/config/michaelRuntimeFlags.ts](../../server/src/config/michaelRuntimeFlags.ts). It is
`.team`-only, authenticated (`requireAuth` → `requireSteveComplete`), BA-scoped, fixtures-only via
the inert S2.20 facade, non-persistent, LLM-free, and voice-free. Verified inert and within
boundary by the S3.4 record
([SPRINT_003_S3_4_MINIMAL_MICHAEL_RUNTIME_ROUTE_VERIFICATION.md](./SPRINT_003_S3_4_MINIMAL_MICHAEL_RUNTIME_ROUTE_VERIFICATION.md)).

### 0.1 The distinct outcome paths to observe

Read directly from the handler, in evaluation order. A future observability slice must be able to
distinguish each of these (and only these) outcomes:

| # | Outcome | Status | Discriminator in handler |
|---|---|---|---|
| A | Route axis disabled | 503 | `michaelRuntimeRouteEnabled()` is false → `reason:'michael_runtime_disabled'` |
| B | Response axis disabled | 503 | `michaelRuntimeResponseEnabled()` is false → `reason:'michael_runtime_response_disabled'` |
| C | Not authenticated (no session BA) | 401 | `req.session?.baId` absent → `error:'Not authenticated.'` |
| D | Body-supplied BA authority | 400 | forbidden body field present → `code:'BODY_BA_SCOPE_NOT_ALLOWED'` |
| E | Missing / non-object turn | 400 | `body.turn` absent → `code:'MISSING_RUNTIME_TURN'` |
| F | Facade failure (`!ok` or throw) | 422 | `result.ok === false` or catch → `issues:[...]` |
| G | Success | 200 | `result.ok === true` → `{ok, selectionRequest, catalogKey, response, trace?}` (trace only when axis 3 on) |

Note: outcomes A and B are evaluated *before* the auth read, so C/D/E/F/G are reachable only when
both the route and response axes are enabled. Auth (C) and the onboarding gate are partly enforced
*upstream* of the handler by `requireAuth` / `requireSteveComplete` middleware — see §10–§11 for why
those two counters are conditional ("if safely available").

### 0.2 Existing repo observability conventions (for fit, not for reuse-by-default)

The admin surface already has precedent the future slice should mirror rather than reinvent:
- `requireAdmin` on every `/api/admin/*` handler ([server/src/routes/admin/liveOps.ts](../../server/src/routes/admin/liveOps.ts), [reporting.ts](../../server/src/routes/admin/reporting.ts)).
- The 4.J audit-log substrate (`appendAuditEntry`) — one entry per admin request.
- `domain/liveOps.ts` JSON snapshot + SSE stream pattern, surfaced via `apps/admin` `MetricsRow` / `GrowthCards`.
- Aggregated metrics only — never a per-record review queue (CLAUDE.md compliance note).

A future observability slice should follow this shape (admin-only route, aggregate JSON, optional
SSE), but **building it is out of scope here**.

---

## 1–11. Proposed metrics (the observability surface)

The following are the metrics a future slice *would* expose. Each is a non-negative integer counter
unless noted. All are **aggregate, BA-anonymous tallies** — counts of events, never identities,
never payloads. Numbers 1–3 are *current flag state* (boolean), 4–11 are *event counters*.

### Flag-state observability (point-in-time, not counters)

1. **Route flag state** — current value of `michaelRuntimeRouteEnabled()` (`MICHAEL_RUNTIME_ROUTE_ENABLED === 'true'`). Boolean. Tells the admin whether the route does any work at all. Read at call time; the surface reports the live evaluated value, never the raw env string.
2. **Response flag state** — current value of `michaelRuntimeResponseEnabled()` (`MICHAEL_RUNTIME_RESPONSE_ENABLED === 'true'`). Boolean. Whether a resolved response body may be returned.
3. **Trace flag state** — current value of `michaelRuntimeTraceEnabled()` (`MICHAEL_RUNTIME_TRACE_ENABLED === 'true'`). Boolean. Whether the redacted trace may be attached to a success.

> These three are the canary dashboard: during a staged `.team` enablement the admin must see, at a
> glance, which axes are live. The surface reports the *boolean evaluation*, never echoes the env
> variable contents.

### Event counters (monotonic tallies over a window)

4. **Route-disabled skips** — count of outcome **A** (503 `michael_runtime_disabled`). How often the route short-circuited because axis 1 is off. During a canary this should drop to ~0 once the route flag is flipped on.
5. **Response-disabled skips** — count of outcome **B** (503 `michael_runtime_response_disabled`). Route on but response axis off. The intermediate canary stage.
6. **Successful facade resolutions** — count of outcome **G** (200, `result.ok === true`). The primary health signal: fixtures resolved and returned by reference.
7. **Facade failures** — count of outcome **F** (422). Facade returned `!ok` *or* threw and was mapped to 422. A rising value here means malformed turns or a facade-chain regression — the key error signal.
8. **Body-BA-override rejections** — count of outcome **D** (400 `BODY_BA_SCOPE_NOT_ALLOWED`). Sponsor-immutability enforcement events; a spike may indicate a misbehaving / probing client.
9. **Missing-turn rejections** — count of outcome **E** (400 `MISSING_RUNTIME_TURN`). Malformed request body without a `turn`. Useful to distinguish client-shape errors from facade errors (7).
10. **Auth failures — *if safely available*** — count of outcome **C** (401 `Not authenticated.`) reached *inside* the handler. **Caveat:** `requireAuth` runs *before* the handler and rejects unauthenticated requests upstream, so the in-handler 401 fires only when middleware passed something through without a `baId` (an edge/defense-in-depth case). A future slice MAY surface a 401 counter **only if** it can be obtained without adding instrumentation that reaches into auth internals or logs identities. If clean capture is not safely available, this counter is **dropped, not approximated**. No PII, no session contents.
11. **Onboarding-gate failures — *if safely available*** — count of `requireSteveComplete` rejections (BA authenticated but onboarding incomplete). **Caveat:** like 10, this is enforced in middleware *upstream* of the handler, so the handler never sees these. A future slice MAY surface this **only if** the gate already exposes a safe, aggregate, identity-free signal (or one can be added in the gate's own separately-approved slice). Absent that, it is **omitted**. Never name the BA, never log the gate reason payload.

> Counters 4–9 are cleanly derivable from the handler's own return paths and are the *core*
> recommended set. Counters 10–11 are explicitly *conditional* and may ship empty or omitted; they
> must never be faked from a proxy signal.

---

## 12–18. Hard constraints any future implementation MUST honor

These are non-negotiable boundaries for the future slice. They exist to keep observability inert,
compliant, and inside the same boundary the S3.4 route itself respects.

12. **No PII.** No prospect or BA personal data in any metric, label, or surface — no names, emails, phone numbers, addresses, THREE IDs, or any field that identifies a person. Counters are population-level tallies only.
13. **No raw Context Packet.** The route never assembles a Context Packet, and observability MUST NOT reconstruct, capture, or expose one. No packet fragments, no retrieval audit, no retrieval inputs.
14. **No response body.** The resolved fixture `response` (and `selectionRequest`) MUST NOT be captured or surfaced. Observe *that* a success happened (counter 6), never *what* was returned.
15. **No trace body.** The redacted trace MUST NOT be persisted or surfaced by the observability layer. Even though it is already redacted, it stays returned-only to the calling client per S3.4; observability records at most that a traced success occurred, never the trace contents.
16. **No tokens / IDs.** No invite tokens, session IDs, turn IDs, correlation IDs, catalog keys-as-identity, or BA IDs in any metric or label. (Catalog *outcome distribution* is explicitly **not** proposed here to avoid leaking turn content via fixture identity; if ever wanted it is a separate, separately-justified decision.)
17. **Returned-only or in-memory first.** The first incarnation MUST be either (a) returned-only — computed on demand from an in-process counter and handed back through an admin endpoint — or (b) a plain in-memory process counter. No durable store on first pass. This mirrors the route's own returned-only / non-persistent posture.
18. **No persistence unless separately approved.** Writing any counter to MongoDB / Neo4j / ChromaDB / GraphRAG / the audit-log substrate / any file is **out of scope** and requires its own approved slice (and, if to the triple stack, conformance to the GraphRAG schema contract). The default is *no persistence*. In-memory counters reset on restart — that is acceptable and intended for the first pass.

---

## 19. Future admin-only surface

Any surfacing of these metrics MUST be **admin-only**, consistent with the existing
`/api/admin/*` + `requireAdmin` convention:

- **Admin only.** Behind `requireAdmin` (the `ADMIN_BA_IDS` allowlist / hard 403). Founders/Kevin only.
- **Never `.com`.** Absolutely no exposure on `apps/com` / `teammagnificent.com`. Michael is never prospect-facing; these metrics describe a BA-facing runtime route and have no place on the prospect surface.
- **Not BA-facing.** Not surfaced on `apps/team` to ordinary BAs either — this is operational/enforcement telemetry for Kevin's `/admin`, not BA-visible. (The future *BA-facing* `.team` UI that *consumes* the route — S3.4 §25 item 2 — is a different, separate slice and carries none of this observability.)
- **Shape, when built.** An aggregate JSON endpoint (e.g. `GET /api/admin/.../michael-runtime/observability`) returning the three flag booleans + the counters, optionally an SSE snapshot mirroring the `liveOps` pattern, rendered through an admin `MetricsRow`-style card. Aggregates only — never a per-request review queue. **None of this is built; the path above is illustrative, not a commitment.**

---

## 20. Recommendation — observability BEFORE or AFTER the `.team` UI slice?

**Recommendation: build a minimal observability layer BEFORE the `.team` BA-facing UI slice — but
sequence it correctly relative to enablement.**

Reasoning:

1. **Enablement is the real first risk, and observability is its safety instrument.** S3.4 §25
   stages enablement as `MICHAEL_RUNTIME_ROUTE_ENABLED` → `_RESPONSE_ENABLED` → `_TRACE_ENABLED` on a
   `.team` canary. You cannot run a safe canary blind. Counters 4–7 (route-disabled skips,
   response-disabled skips, successful resolutions, facade failures) plus the three flag-state
   readouts (1–3) are exactly the signals that tell Kevin whether flipping an axis did what was
   intended and whether failures are climbing. That argues for observability landing *with or just
   before* enablement — and therefore before the UI, which should only be pointed at a route already
   proven healthy under observation.

2. **The UI multiplies traffic; debugging it without telemetry is guesswork.** Once a `.team` UI
   calls the route at real volume, the body-override (8) and missing-turn (9) counters distinguish
   "client is malformed" from "facade regressed" (7) at a glance. Shipping the UI first means its
   first bug reports arrive with no aggregate signal to triage them.

3. **Cost asymmetry favors observability-first.** The recommended core (counters 4–9 + flags 1–3) is
   cheap and fully inert: it can be in-memory, returned-only, derived entirely from the handler's
   own return paths, with zero persistence and zero new PII surface (constraints 12–18). The `.team`
   UI is a larger, compliance-sensitive surface (Michael must stay non-prospect-facing). Doing the
   small, safe, high-leverage instrument first de-risks the larger one.

4. **Caveat on ordering granularity.** "Before the UI" does **not** mean "a big observability slice
   now." The right cut is: a *minimal* in-memory observability slice (flags 1–3 + counters 4–9),
   approved and landed alongside the start of staged enablement; defer the conditional middleware
   counters (10–11), any persistence (18), and any SSE/dashboard polish until after the canary
   proves stable. Then build the `.team` UI against a route that is both enabled-with-confidence and
   observed.

**Net:** observability (minimal, in-memory, counters 4–9 + flags 1–3) should come **before** the
`.team` UI slice, ideally co-sequenced with the start of staged enablement, with persistence and the
conditional auth/gate counters deferred to later separately-approved increments.

---

## Reminder

Nothing in this document is implemented. No code was written, no counter added, no log persisted, no
admin UI touched, no env flag changed, no gate run, no commit made. This is a plan for a future
slice that remains gated on Kevin's explicit approval.

— Agent C, Sprint 3 S3.5 planning slice
