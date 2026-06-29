# Sprint 3 S3.8 — `.team` UI Boundary & Implementation Readiness Review (PLANNING-ONLY)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.8 multi-agent PLANNING-ONLY readiness review for a future `.team` BA-facing UI over the
  S3.4 minimal Michael runtime route (`POST /api/michael-runtime/resolve`), under the S3.6 in-memory
  observability layer and on the strength of the S3.7 LOCAL controlled-canary record.
- Status: **READINESS REVIEW — documentation only.** No code change, no flag flip, no commit, no env
  mutation. This document authorizes **no** UI implementation and **no** enablement.
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent D (boundary / readiness reviewer — owns this verdict)
- Repo state inspected: `main` (per `docs/READ-ME-FIRST.md` precedence; CLAUDE.md boundaries).
- Method: read-only inspection of the route, flags, observability service, admin endpoint, server
  boot mounts, `apps/team`, `apps/com`, and the S3.6 / S3.7 prior records. Every confirmation below
  is grounded in `file:line` or report-section evidence, or marked **UNCONFIRMED**.

> This review does not propose, scaffold, or authorize any UI. It records whether the route is in a
> state where a future, separately-approved `.team` UI proposal could begin, and surfaces the real
> blockers that proposal must resolve first. The kill switch remains the sole default-closed gate;
> all three `MICHAEL_RUNTIME_*` axes remain off.

---

## 0. Verdict (summary)

**READY-WITH-CONDITIONS** to proceed to a *UI implementation proposal* — NOT to UI implementation
itself, and NOT to enablement.

- The route and its observability are present, inert, and boundary-clean (items 1–20 CONFIRMED).
- No `.team` Michael-runtime UI exists yet, so there is a clean slate (item 13 CONFIRMED).
- **One material blocker** gates actual UI implementation: there is **no client-safe production
  source for the `runtimeTurn` the route requires** (item 27). A browser cannot honestly assemble a
  valid `ResolvedRuntimeTurn`; in S3.7 that input came only from a test-only fixture harness.
- **One empirical gap** (item 21): the body-BA rejection path was proven in source but never
  exercised by the S3.7 canary.

**Blocker count: 1** (item 27 — turn-source).
**UNCONFIRMED count: 0.**
Plus 1 carried non-blocking empirical caveat (item 21 → motivates a targeted canary, item 28).

---

## 1. S3.7 canary passed locally — CONFIRMED

`SPRINT_003_S3_7_CONTROLLED_CANARY_EXECUTION_RECORD.md` §1, §16: **PASS (LOCAL canary,
REAL-OBSERVED)** — the `503 → 503 → 200 → 200` flag ladder with one-counter-per-stage deltas,
trace absent at Stage 2 and present-and-redacted at Stage 3; full gate suite green (74 files / 851
tests, 0 failures). Explicitly scoped to a LOCAL in-process exercise; no production/staging
enablement (§1, §3, §18). CONFIRMED, with the caveat in item 21.

## 2. S3.6 observability exists — CONFIRMED

`server/src/services/michaelRuntimeObservability.ts:38-93` (in-memory counter module),
`server/src/routes/admin/michael-runtime-observability.ts:23-25` (admin read endpoint), mounted at
`server/src/index.ts:135`. Verified inert by `SPRINT_003_S3_6_MINIMAL_IN_MEMORY_OBSERVABILITY_VERIFICATION.md`
§1, §5, §6 (74/851 suite). CONFIRMED.

## 3. Route implemented — CONFIRMED

`server/src/routes/michael-runtime.ts` — `handleMichaelRuntimeResolve` at line 52, registered
`POST /resolve` at lines 156-161 with `requireAuth, requireSteveComplete`. Mounted at
`server/src/index.ts:246` (`/api/michael-runtime`). CONFIRMED.

## 4. Route default-off — CONFIRMED

`server/src/config/michaelRuntimeFlags.ts:12-14` — `flagEnabled(name) => process.env[name] ===
'true'`; only the literal `"true"` enables. Axis-1 short-circuit at `michael-runtime.ts:55-60`
returns `503 michael_runtime_disabled` before any work. No `MICHAEL_RUNTIME_*` default assigned in
`index.ts` (S3.7 §15; S3.6 §24). All three axes off. CONFIRMED.

## 5. Route gated — CONFIRMED

`michael-runtime.ts:156-161` applies `requireAuth` + `requireSteveComplete` (the canonical
onboarding gate; not the nonexistent `requireMichaelComplete`). Mounted below the BA-FACING GATED
banner (`index.ts:159-246`). Session BA presence re-checked in-handler (`michael-runtime.ts:71-74`,
401 if absent). CONFIRMED.

## 6. Non-persistent — CONFIRMED

No Mongo/Neo4j/Chroma/Gateway/GraphRAG/`tripleStackWrite`/`fs` call anywhere in
`michael-runtime.ts`; it imports only the inert facade, flags, and the in-memory `record*` helpers
(lines 20-38). Every facade response carries `"persistence": "disabled"` (S3.7 §9, §10, §13).
Observability is process-lifetime integers that reset on restart
(`michaelRuntimeObservability.ts:38-45`; S3.6 §14). CONFIRMED.

## 7. LLM-free — CONFIRMED

No Anthropic/Claude/ScriptMaker/Ivory import or completion call in `michael-runtime.ts`; the
facade returns a pre-authored fixture by reference (header comment lines 8-14; S3.7 §13). Every
response carries `"agentResponseGenerated": false`. CONFIRMED.

## 8. Dynamic-generation-free — CONFIRMED

The handler never constructs response text — it forwards `result.response`/`result.selectionRequest`
/`result.catalogKey` by reference (`michael-runtime.ts:133-144`). The verbatim catalog entry
`michael_next_training_step_en` is returned by reference (S3.7 §9, §13). No `text:` assignment, no
template literal. CONFIRMED.

## 9. Voice-free — CONFIRMED

No Telnyx/PSTN/TTS/STT/call-control import or shape in `michael-runtime.ts`. Fixture fields
`nextStep.automaticCalling` and `externalSideEffect` are `false` (S3.7 §13). CONFIRMED.

## 10. `.team` only — CONFIRMED

Mounted in `server/src/index.ts:246` below the BA-FACING GATED banner, gated `requireAuth` +
`requireSteveComplete` — BA-facing, authenticated, onboarding-gated (S3.7 §5). BA scope is derived
solely from `req.session.baId` (`michael-runtime.ts:71`, 98-113). CONFIRMED.

## 11. Not `.com` — CONFIRMED

No `apps/com` import in `michael-runtime.ts`; the route is auth-gated (prospect surfaces are
unauthenticated `/api/p`). Grep of `apps/com` for `michael-runtime|michaelRuntime|michael_runtime|
/api/runtime` returned **no matches** — the route is not consumed by the prospect client. CONFIRMED.

## 12. Admin observability is admin-only — CONFIRMED

`server/src/routes/admin/michael-runtime-observability.ts:23` registers `GET /observability` with
`requireAdmin` as the first handler (Kevin-only via `ADMIN_BA_IDS`). Pure in-memory read; never
`appendAuditEntry`, never triple-stack (header lines 6-12; S3.6 §6, §22). Mounted at
`/api/admin/michael-runtime` (`index.ts:135`). CONFIRMED.

## 13. No `.team` UI exists yet — CONFIRMED (proven via search)

Grep of `apps/team` for `michael-runtime|michaelRuntime|michael_runtime|/api/runtime` and for
`runtime/resolve|/resolve` returned **no matches**. A broad case-insensitive `michael` sweep of
`apps/team` returns only PRE-EXISTING, UNRELATED surfaces:

- `apps/team/src/components/cockpit/MichaelTrainingSupportCard.tsx` and `steve-success-interview.tsx`
  call `GET /api/michael/training-support/:downlineBaId` — the **pre-gate `/api/michael` onboarding
  family**, a DISTINCT route from `/api/michael-runtime/resolve` (see `index.ts:243-245` note).
- `cockpit.tsx`, `profile.tsx`, `register.tsx`, `preview.tsx`, `OrientationCard.tsx` mention
  "Michael" only as agent/copy references (slot windows, digest timing, onboarding labels).

None reference the S3.4 runtime route. There is **no** `.team` render, fetch, hook, or component
pointed at `/api/michael-runtime/resolve`. Clean slate. CONFIRMED. (Corroborated by S3.6 §21: no
`apps/team` file was added or edited by the observability slice.)

## 14. UI impl must not flip flags — CONSTRAINT (recorded)

The three axes are read from `process.env` at call time only (`michaelRuntimeFlags.ts:12-14`); a
client cannot source them. A future UI must **never** ship a default env, a build-time flag, a
`.env` entry, or any client toggle that enables an axis. The kill switch stays the sole
default-closed gate; only Kevin's recorded environment authorization flips it (S3.7 §3, §4, §18).

## 15. UI impl must not send BA scope in body — CONSTRAINT (recorded)

Sponsor immutability (locked-spec 3.5). The route rejects body-supplied `baId`/`sponsorBaId`/
`targetBaId` with `400 BODY_BA_SCOPE_NOT_ALLOWED` (`michael-runtime.ts:43`, 79-88) and forces
`identity.scope.baId = sessionBaId` (lines 98-113). A future UI must send **no** BA-authority field
in the request body — scope is always session-derived server-side.

## 16. UI impl must not hand-assemble Context Packets — CONSTRAINT (recorded)

The route is a one-call consumer of the inert S2.20 facade and never assembles a Context Packet
(`michael-runtime.ts:8-14`). The trace exposes only `contextPacketStatus` (status, never content;
S3.7 §10). A future UI must not construct, send, or render a raw Context Packet — it consumes only
the redacted facade output. **Note:** the current `body.turn` contract (item 27) edges close to
this constraint, since `runtimeTurn` is itself a resolved-orchestration artifact — another reason
the turn-source must be server-owned, not client-assembled.

## 17. UI impl must not persist response — CONSTRAINT (recorded)

The response is returned-only; nothing is written (item 6). A future UI must not persist the
resolved fixture/trace to any store, localStorage-as-record-of-truth, or server write-back. Render
ephemerally; the route remains non-persistent.

## 18. UI impl must not show trace by default — CONSTRAINT (recorded)

Trace is included only when axis-3 `MICHAEL_RUNTIME_TRACE_ENABLED` is on (`michael-runtime.ts:148-150`);
default-off it is absent (S3.7 §9). A future UI must treat `trace` as a dev/diagnostic field that is
**hidden by default** and never surfaced to a BA as routine content.

## 19. UI impl must not show admin counters — CONSTRAINT (recorded)

The observability snapshot is `requireAdmin`/Kevin-only (item 12). A future `.team` BA-facing UI
must **not** read or render `/api/admin/michael-runtime/observability` or any aggregate counter — it
has no authorization to that surface.

## 20. UI impl must not expose route to `.com` — CONSTRAINT (recorded)

Michael is BA-facing only and never prospect-facing (CLAUDE.md compliance; S3.7 §13). The route is
authenticated and `.team`-mounted. A future UI must live only in `apps/team`, never in `apps/com`,
and must add no prospect-facing entry point to `/api/michael-runtime/*`.

## 21. Body-BA rejection NOT empirically exercised in S3.7 — CONFIRMED (caveat cited)

S3.7 §17 Caveat C3 (carried from Agent D §4/§5): the `400 BODY_BA_SCOPE_NOT_ALLOWED` path is proven
in source (`michael-runtime.ts:79-88`) but **was not empirically exercised** — the canary sent only
`{ turn }`, so `bodyBaOverrideRejections` stayed 0 across all stages (and is masked at Stage 1 by the
axis-2 short-circuit; S3.7 §8, §11). This is a transparency gap, not a defect. CONFIRMED as an open
empirical caveat.

## 22. Future UI must include a test that body BA scope is never sent — REQUIREMENT (recorded)

A future UI proposal must carry a test asserting the request body sent to
`POST /api/michael-runtime/resolve` contains **none** of `baId`/`sponsorBaId`/`targetBaId` (the
`FORBIDDEN_BODY_BA_FIELDS` set, `michael-runtime.ts:43`). This complements item 21 — the client must
never even attempt body-BA scope.

## 23. Future UI must include disabled-state tests — REQUIREMENT (recorded)

A future UI must test that when the route returns `503 michael_runtime_disabled` /
`michael_runtime_response_disabled` (`michael-runtime.ts:55-69`), the UI degrades gracefully
(disabled/empty state, no error spew, no retry storm). Default-off must be the rendered baseline.

## 24. Future UI must include response-disabled tests — REQUIREMENT (recorded)

Specifically the axis-2 path (`503 michael_runtime_response_disabled`, `michael-runtime.ts:64-69`):
the UI must render an explicit "response disabled" state distinct from "route disabled", and must not
fabricate or cache a prior response.

## 25. Future UI must include trace-hidden-by-default tests — REQUIREMENT (recorded)

A future UI must test that a successful response with **no** `trace` key (default, axis-3 off) renders
correctly, and that when `trace` is present it stays hidden from BA-facing view by default (item 18).

## 26. Future UI must include no-`.com` tests — REQUIREMENT (recorded)

A future UI must carry a boundary test (mirroring the existing governance-scan pattern, S3.6 §20,
§27) asserting no `apps/com` import/route reaches `/api/michael-runtime/*` and the component lives
only under `apps/team`.

## 27. Implementation blocker — NO client-safe `turn` source — **BLOCKER**

The route requires a `turn` object in the request body (`michael-runtime.ts:90-96`; missing/invalid →
`400 MISSING_RUNTIME_TURN`) which it casts to `MichaelRuntimeAdapterContractInput`
(`michael-runtime.ts:101-113`) and forwards to the facade. The adapter contract consumes
`input.runtimeTurn.result as ResolvedRuntimeTurn`
(`server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts:60`) — a fully **resolved**
orchestration turn carrying classification, consumption, and persistence-disabled invariants.

In S3.7 that valid `turn` was produced **only** by the test-only fixture harness
`runRuntimeTurnFixtureScenario({ scenario: 'accepted_complete', … })`
(`server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts:73`; S3.7 §9, §13). There is **no
production, client-safe producer of a `ResolvedRuntimeTurn`** exposed to `apps/team`: a browser
cannot honestly assemble one, and the route's CLAUDE-documented contract forbids it from importing
the harness (`michael-runtime.ts:13-14`; S3.7 §18). A naive UI that POSTs a hand-built `turn` would
either be rejected (`MISSING_RUNTIME_TURN`/facade `422`) or, worse, smuggle client-assembled
orchestration state across the boundary (conflicts with item 16).

**This is the load-bearing blocker for actual UI implementation.** Before a `.team` UI can call this
route for real, the proposal must answer: *what server-owned endpoint produces the `runtimeTurn` the
client passes back, or does the route need a server-side turn-derivation step so the client sends
only an intent + session?* Until that turn-source is defined, the UI has nothing safe to POST.
**BLOCKER.**

## 28. Recommendation — proceed to UI *proposal*, run targeted body-BA canary first

**READY-WITH-CONDITIONS.** Recommended sequence (each separately gated on Kevin's recorded approval;
nothing begins without it):

1. **Run the targeted body-BA rejection canary first (closes item 21).** A short LOCAL canary with
   ROUTE+RESPONSE axes on that POSTs a body containing `baId` and observes `400
   BODY_BA_SCOPE_NOT_ALLOWED` with `bodyBaOverrideRejections +1`. Cheap, closes S3.7 Caveat C3, and
   de-risks the item-15/item-22 constraint empirically before any UI depends on it.
2. **Then a `.team` UI *implementation proposal* (design doc, not code)** that must, as its first
   deliverable, **resolve the turn-source blocker (item 27)** — define the server-owned production
   path that yields a valid `runtimeTurn` (or refactor the route to take intent-only and derive the
   turn server-side). The proposal must bake in constraints 14–20 and ship the tests in 22–26.
3. **Do NOT begin UI implementation** until item 27 is resolved on paper and the targeted canary
   (step 1) is on record. **Do NOT** flip any flag or touch `.com`.

This is not a BLOCK on the overall track — the route is inert, boundary-clean, and well-positioned —
but the turn-source question is a genuine prerequisite that a "render the fixture" framing would
skip past. Resolve it in the proposal before writing client code.

---

## Item ledger

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | S3.7 canary passed locally | CONFIRMED | S3.7 §1, §16 |
| 2 | S3.6 observability exists | CONFIRMED | observability.ts:38-93; admin route:23; S3.6 §1 |
| 3 | Route implemented | CONFIRMED | michael-runtime.ts:52, 156-161; index.ts:246 |
| 4 | Route default-off | CONFIRMED | flags.ts:12-14; michael-runtime.ts:55-60 |
| 5 | Route gated | CONFIRMED | michael-runtime.ts:156-161, 71-74 |
| 6 | Non-persistent | CONFIRMED | michael-runtime.ts:20-38; S3.7 §13 |
| 7 | LLM-free | CONFIRMED | michael-runtime.ts:8-14; S3.7 §13 |
| 8 | Dynamic-generation-free | CONFIRMED | michael-runtime.ts:133-144; S3.7 §13 |
| 9 | Voice-free | CONFIRMED | S3.7 §13 |
| 10 | `.team` only | CONFIRMED | index.ts:246; michael-runtime.ts:71, 98-113 |
| 11 | Not `.com` | CONFIRMED | apps/com grep: no matches |
| 12 | Admin observability admin-only | CONFIRMED | admin route:23; S3.6 §22 |
| 13 | No `.team` UI yet | CONFIRMED | apps/team grep: no runtime-route matches |
| 14 | UI must not flip flags | CONSTRAINT | flags.ts:12-14; S3.7 §3, §18 |
| 15 | UI must not send body BA scope | CONSTRAINT | michael-runtime.ts:43, 79-88 |
| 16 | UI must not hand-assemble Context Packets | CONSTRAINT | michael-runtime.ts:8-14; S3.7 §10 |
| 17 | UI must not persist response | CONSTRAINT | item 6 |
| 18 | UI must not show trace by default | CONSTRAINT | michael-runtime.ts:148-150 |
| 19 | UI must not show admin counters | CONSTRAINT | admin route:23 (item 12) |
| 20 | UI must not expose route to `.com` | CONSTRAINT | items 10, 11 |
| 21 | Body-BA rejection NOT exercised in S3.7 | CONFIRMED (caveat) | S3.7 §17 C3 |
| 22 | Future UI: body-BA-never-sent test | REQUIREMENT | michael-runtime.ts:43 |
| 23 | Future UI: disabled-state tests | REQUIREMENT | michael-runtime.ts:55-69 |
| 24 | Future UI: response-disabled tests | REQUIREMENT | michael-runtime.ts:64-69 |
| 25 | Future UI: trace-hidden-by-default tests | REQUIREMENT | michael-runtime.ts:148-150 |
| 26 | Future UI: no-`.com` tests | REQUIREMENT | items 10, 11; S3.6 §20 |
| 27 | No client-safe `turn` source | **BLOCKER** | michael-runtime.ts:90-113; adapterContract.ts:60; runtimeTurnHarness.ts:73 |
| 28 | Recommendation | READY-WITH-CONDITIONS | this §28 |

---

## Explicit non-approval statement

This readiness review authorizes **no** activation and **no** UI implementation. No flag may be set
to `"true"` in any environment, no env changed, no deployment performed, and no client code written
on the strength of this document. The route remains a one-call consumer of the inert S2.20 facade —
fixtures-only, authenticated, BA-scoped, non-persistent, LLM-free, voice-free, returned-only with a
default-off redacted trace, behind the three-axis kill switch (all axes off). A `.team` UI proposal
and the targeted body-BA canary proceed only on Kevin Gardner's separate, explicit, recorded
approval, and the proposal must resolve the item-27 turn-source blocker before any implementation
begins.

---

This is the Sprint 3 S3.8 `.team` UI boundary & implementation readiness review (Agent D). It is
documentation-only, grounds each of the 28 items in `file:line` or report evidence, surfaces one
material blocker (turn-source, item 27) and one carried empirical caveat (body-BA, item 21), and
grants no enablement.
