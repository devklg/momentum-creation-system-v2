# S3.2 Feature Flag, Kill Switch & Observability Proposal

- Sprint: Sprint 3 - Activation Planning
- Slice: S3.2 Michael Route Proposal — feature-flag / kill-switch / observability contract (proposal component)
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, no env, no flags, no routes, no UI, no `.com`, no tests, no LLM/DB access, no commit)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent C (feature-flag / kill-switch / observability proposal author)
- Branch: `planning/s3.2-michael-route-proposal`
- Inputs (read, not edited):
  - `engineering/reports/SPRINT_003_S3_1_ACTIVATION_PLANNING_CHARTER.md` (§11 kill-switch, §14 observability, §15 rollback requirements)
  - `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts` (S2.20 `buildTrace` redacted-trace baseline)
  - `CLAUDE.md` — ".env / wired-dormant surfaces" + "Environment" sections (EMAIL_API_KEY / ANTHROPIC_API_KEY degrade-when-unset precedent)

> This is one of several S3.2 input proposals. It defines, in advance and as a
> proposal only, the default-off feature flag, the fail-closed three-axis kill switch,
> and the returned-only observability contract that a future Michael runtime route
> would have to satisfy. **It is NON-AUTHORIZING and implements NONE of this.** It
> proposes candidate env var names and behaviors for Kevin to separately approve; it
> sets no value, mounts no route, emits no trace, and changes no code. Agent E owns the
> final S3.2 report; this is not that report.

## 0. Scope and Non-Implementation Statement

**S3.2 implements NONE of this.** This document is a written contract proposal. It:

- Creates no feature flag and reads no environment variable.
- Adds no `.env` / `.env.example` entry.
- Mounts, modifies, or disables no route (`server/src/index.ts` is untouched).
- Produces no response and emits no trace.
- Adds no test (it *specifies* the tests a future implementation must carry).
- Persists nothing and calls no LLM, DB, or Gateway.

Every "MUST", "behavior", and "test" below is a requirement *on a future,
separately-approved implementation slice (S3.4 or later)*, not an action taken here.
All Sprint 2 stop conditions and the S3.1 charter's non-approval statement remain in
force unchanged.

## 1. Feature Flag

The future Michael runtime surface must ship behind a **default-off, env-driven**
feature-flag set modeled on the repo's existing wired-dormant precedent.

### 1.1 Precedent: degrade-when-unset (EMAIL_API_KEY / ANTHROPIC_API_KEY)

Per `CLAUDE.md`, `EMAIL_API_KEY` (Resend) and `ANTHROPIC_API_KEY` (ScriptMaker /
Ivory) are intentionally empty in dev. When unset, the surfaces **degrade** rather than
crash boot — Resend records `emailDeliveryStatus='skipped'`, ScriptMaker falls back to
manual compose. The behavior begins the moment the key lands in `.env`; no code change
is required to flip the surface from dormant to live. The Michael runtime flag must
follow the same shape: **absence of configuration = inert, never error**. The flag is
the on-switch; the *default* (unset / unreadable / partial) is always off.

This proposal extends the precedent in one direction only: where the LLM/email
surfaces are single-key, the Michael runtime flag is **multi-axis** (§2) so route,
response, and trace can be disabled independently.

### 1.2 Required flag properties

1. **Default OFF.** The surface is inert unless explicitly enabled. The absence of any
   flag means disabled — there is no "on" default anywhere.
2. **Env-driven.** Flags are read from environment via the repo env-loader convention
   (walk up to the `pnpm-workspace.yaml` marker; never `import.meta.url` path math).
   No flag value is sourced from request bodies, query params, headers, or DB rows.
3. **No hardcoded enable.** No literal `true`, no `enabled = 1`, no compile-time
   constant, and no test fixture may set the surface to enabled in committed code. The
   only path to "enabled" is an explicit operator-set environment value.
4. **Failure to read config => disabled.** If reading the environment throws, is
   undefined, or the loader errors, the surface MUST treat itself as disabled (fail
   closed) and MUST NOT crash boot.
5. **Missing config => disabled.** An unset variable is disabled — identical to the
   EMAIL/ANTHROPIC `=== ''` / `undefined` degrade path.
6. **Partial config => disabled.** If the flag set is partially present (e.g. route
   enabled but the value is malformed, or only some axes parse), the surface MUST treat
   the unresolved/ambiguous axes as disabled. Ambiguity never resolves to enabled.

### 1.3 Candidate env var names (PROPOSALS, not decisions)

These names are options for Kevin to choose or rename in the ratified S3.2 spec. They
are not decided here and no value is set.

| Candidate env var | Governs (proposed) | Unset / unreadable / malformed |
|---|---|---|
| `MICHAEL_RUNTIME_ROUTE_ENABLED` | Route-disable axis (§2.1) | disabled |
| `MICHAEL_RUNTIME_RESPONSE_ENABLED` | Response-disable axis (§2.2) | disabled |
| `MICHAEL_RUNTIME_TRACE_ENABLED` | Trace-disable axis (§2.3) | disabled |

Proposed parsing rule (for Kevin's approval): only the exact string `"true"` (after
trim, case-insensitive optional) enables an axis; **every other value — `""`,
`"false"`, `"0"`, `"on"`, whitespace, undefined, or a parse error — disables it.** This
keeps "enabled" a single narrow target and makes every failure mode fall to off.

Dependency ordering (proposed): the axes nest — response requires route, trace requires
response. Enabling `RESPONSE` while `ROUTE` is off is incoherent and MUST resolve to
disabled for the dependent axis (partial config => disabled, §1.2.6). This is a
proposal; Kevin may instead choose fully-independent axes, in which case the
disabled-shape contracts in §2 still hold per axis.

## 2. Kill Switch Axes — three INDEPENDENT disable axes

The kill switch is three separately-trippable axes. Tripping any one is a valid
rollback action (§4) and never depends on tripping the others (subject only to the
nesting rule in §1.3, which only ever makes the *dependent* axis safer, never less
safe).

### 2.1 Axis 1 — Route-disable

- **ENABLED behavior:** the route is mounted and accepts authenticated, BA-scoped
  `.team` requests, passing them into the response/trace axes downstream.
- **DISABLED behavior:** the route handles no request work. The route either is not
  reachable at all or returns the safe disabled shape immediately, before any
  derivation, selection, persistence consideration, or trace construction. No call into
  the S2.17–S2.20 chain occurs.
- **Safe disabled shape:** a deterministic, side-effect-free response with no chain
  output. Proposed shape: HTTP `503` (or `404`) with body
  `{ "enabled": false, "agentResponseGenerated": false, "persistence": "disabled" }`.
  No response body content, no trace, no PII, no IDs.
- **Required future tests:**
  - off-by-default: with `MICHAEL_RUNTIME_ROUTE_ENABLED` unset, the route returns the
    safe disabled shape and the chain is never invoked;
  - unreadable / malformed value => disabled shape;
  - disabled axis performs no persistence and emits no trace;
  - enabling route alone (response/trace off) still yields no response body and no
    trace (axis independence).

### 2.2 Axis 2 — Response-disable

- **ENABLED behavior:** the route, having admitted the request, resolves the runtime
  turn through the canonical chain (catalog → selector → derivation → facade) and
  returns the validated fixture **by reference** with `agentResponseGenerated: false`
  (fixtures-only; dynamic generation remains a separately-approved decision per S3.1
  §12).
- **DISABLED behavior:** even if the route answers, no response payload is produced.
  The chain is not driven for output; the handler returns the safe disabled shape with
  no `response` field.
- **Safe disabled shape:** `{ "enabled": false, "agentResponseGenerated": false,
  "persistence": "disabled" }` with **no `response` key present** (absent, not null
  with content). No fixture body, no catalog entry, no selection request leaked.
- **Required future tests:**
  - response-disabled => no `response` field in the body;
  - `agentResponseGenerated` is the literal `false` in every disabled-response path;
  - response-disabled performs no persistence;
  - response-disabled while trace-enabled still emits no response body (axis
    independence), and the trace, if any, carries no response content.

### 2.3 Axis 3 — Trace-disable

- **ENABLED behavior:** when a response is produced, the route may return the
  returned-only redacted trace from S2.20 `buildTrace` (the §3 contract), and nothing
  beyond it.
- **DISABLED behavior:** no trace is emitted even if a response is produced. The
  response is returned with no `trace` field; `buildTrace` output is not attached,
  logged, or persisted.
- **Safe disabled shape:** the response (if response-enabled) with **no `trace` key
  present**. If response is also disabled, the §2.2 disabled shape with no `trace`.
- **Required future tests:**
  - trace-disabled => no `trace` field in the body;
  - trace-disabled emits nothing to any sink (there is no sink — §3.11/§3.12);
  - trace-disabled with response-enabled returns the response unchanged minus the trace
    (axis independence);
  - the redacted-trace contract (§3) holds whenever trace IS enabled.

### 2.4 Fail-closed cross-cutting rule

On ANY flag-read failure, unknown/ambiguous state, malformed value, or partial config
on ANY axis, that axis behaves as **disabled** — safe disabled shape, no external side
effect, no persistence, no generation, no trace. Fail-closed is the default for every
axis and is itself a required test (off-on-error for each axis).

## 3. Observability (returned-only first)

For the first activation, observability begins and ends with the existing **returned-
only redacted trace** — the S2.20 `buildTrace` in
`server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts`. That function is
the baseline; the route MUST NOT weaken it. `buildTrace` constructs the trace
explicitly from controlled classification metadata and **never spreads the response**,
so by construction it already cannot leak generated text, raw upstream output, or
session/turn/correlation IDs. The route's job is to **return that trace unchanged (when
trace-enabled) and add nothing to it** — not to build a richer one.

The trace MUST contain only: redacted classification metadata
(`scenarioFamily`, `responseType`, `language`, optional `intent`), the derived
`selectionRequest`, the `catalogKey`, `contextPacketStatus`, and the standing literals
`persistence: 'disabled'` and `agentResponseGenerated: false` — exactly the S2.20
shape, no additions.

The observability contract (each item a hard prohibition on the route):

1. **Redacted trace only.** The only observability output is the S2.20 redacted trace,
   returned in the response body when trace-enabled. Nothing richer.
2. **No raw Context Packet.** The `context_packet.v1` is never spread, embedded,
   echoed, or summarized into the trace (baseline: `buildTrace` never references it).
3. **No response body spread into trace.** The validated fixture `response` is never
   merged into the trace (baseline: `buildTrace` takes only `selectionRequest` +
   `catalogKey`, never the response).
4. **No PII.** No prospect PII, BA private journal/relationship text, or names.
5. **No tokens.** No invite/access tokens, cookies, JWTs, secrets, or API keys.
6. **No session IDs.**
7. **No turn IDs.**
8. **No correlation IDs.**
9. **No prospect information** of any kind (the surface is BA-facing and internal;
   prospect data never enters the trace).
10. **No raw retrieval / store / GraphRAG / Gateway output.** No raw query results,
    vector hits, Neo4j rows, Mongo documents, or Gateway responses.
11. **No log persistence.** The trace is returned in-memory only; it is not written to
    any log file, store, or the triple-stack. (S3.1 §13/§14: persistence disabled; no
    log sink without separate approval.)
12. **No external telemetry.** No metrics export, APM, tracing backend, webhook, or
    third-party analytics call.

Any future broadening of observability beyond the returned-only redacted trace (a log
sink, a store, external telemetry) is a separate, separately-approved decision and is
**not** proposed here.

## 4. Rollback

The rollback procedure for a future activation regression. Each step is operator-
executable and does not depend on a code change. (Rollback owner is named in the route-
proposal/implementation step per S3.1 §15; this proposal names none.)

1. **Flag off route.** Unset / set-non-`true` `MICHAEL_RUNTIME_ROUTE_ENABLED` so the
   route handles no request work (safe disabled shape, §2.1).
2. **Flag off response.** Unset / set-non-`true` `MICHAEL_RUNTIME_RESPONSE_ENABLED` so
   no response payload is produced (§2.2).
3. **Flag off trace.** Unset / set-non-`true` `MICHAEL_RUNTIME_TRACE_ENABLED` so no
   trace is emitted (§2.3). After steps 1–3 all three axes are off — full default-off
   inert state.
4. **Redeploy.** Redeploy the server with all three flags off so the inert state is the
   running state (degrade-when-unset means the flags need not exist in `.env` at all).
5. **Re-run gates.** Re-run the four merge gates read-only — `pnpm build:shared`,
   `pnpm typecheck`, `pnpm build`, `pnpm --filter @momentum/server test` — and confirm
   they match the established baseline (the S3.1 charter records **653/653** across 63
   files; focused Michael-chain **272/20**).
6. **Confirm `.com` untouched.** Verify no Michael surface renders on `apps/com` (port
   7701); the five `.com` compliance prohibitions hold absolutely.
7. **Confirm `/api/runtime/*` still unmounted.** Verify zero matches for
   `/api/runtime/*` in `server/src/index.ts` — the namespace stays reserved and
   unmounted.
8. **Confirm persistence disabled.** Verify every persistence discriminant is the
   literal `'disabled'`; no events, outcomes, Guided Actions, envelopes, responses,
   sessions, transcripts, or logs were written.
9. **Confirm `agentResponseGenerated: false`.** Verify the literal `false` at every
   result/trace boundary — no dynamic generation occurred.

## 5. Explicit Non-Approval Statement

This proposal approves nothing and implements nothing:

- **No flag created or set** — no env var added, no value assigned, no `.env` /
  `.env.example` edit; the candidate names in §1.3 are proposals.
- **No route mounted, modified, or disabled** — `server/src/index.ts` untouched.
- **No response produced, no trace emitted, no persistence, no LLM/DB/Gateway call.**
- **No test added** — §2 specifies the tests a future slice must carry; it writes none.
- **No `/api/runtime/*` revival**; it stays reserved and unmounted.

S3.2 is a planning-only, non-authorizing proposal over the verified inert Michael
runtime foundation. The feature flag, kill switch, observability contract, and rollback
procedure described here become real only inside a separate, separately-approved
implementation slice (S3.4 or later), in the fixed order charter → route proposal →
implementation. **S3.2 implements NONE of this.** Agent E owns the consolidated final
S3.2 report; this document is an input to it.
