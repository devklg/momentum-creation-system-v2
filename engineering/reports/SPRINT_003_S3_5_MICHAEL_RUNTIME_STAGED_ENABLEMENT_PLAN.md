# Sprint 3 S3.5 — Michael Runtime Staged Enablement Plan (Final Integration)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.5 multi-agent planning slice — the authoritative staged-enablement plan for the
  S3.4 minimal Michael runtime route (`POST /api/michael-runtime/resolve`), plus read-only
  verification gates.
- Status: **PLANNING / DOCUMENTATION ONLY** — plus read-only gate execution. No production code
  changed, no env flag flipped, no route enabled, no UI built, no persistence, no commit.
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent E (final integrator + gates owner — owns this verdict)
- Integrates (each read in full on disk; summarized and cross-referenced, not re-pasted):
  - Agent A — `engineering/reports/S3_5_MICHAEL_RUNTIME_ENABLEMENT_RUNBOOK_DRAFT.md`
  - Agent B — `engineering/reports/S3_5_CANARY_VERIFICATION_CHECKLIST.md`
  - Agent C — `engineering/reports/S3_5_ADMIN_OBSERVABILITY_PLANNING_REVIEW.md`
  - Agent D — `engineering/reports/S3_5_BOUNDARY_REGRESSION_REVIEW.md`
  - S3.4 record — `engineering/reports/SPRINT_003_S3_4_MINIMAL_MICHAEL_RUNTIME_ROUTE_VERIFICATION.md`
- Source facts re-confirmed against `server/src/routes/michael-runtime.ts` and
  `server/src/config/michaelRuntimeFlags.ts`.

> This is the authoritative S3.5 deliverable. It synthesizes the four sub-reports above into a
> single staged-enablement plan and records the actual results of the read-only verification
> gates. It authorizes **no** enablement: no flag may be flipped, no env changed, and no
> deployment performed on the strength of this document. Enablement and each stage transition
> proceed only on Kevin Gardner's separate, explicit, recorded approval.

---

## 1. Executive Result

**PASS.**

The four read-only merge gates are green on the current tree (full server suite **70 files /
779 tests, 0 failures**) and every focused route/facade/guardrail/mongoAdapter run passes (see
§17 for exact observed results). Agent D's adversarial boundary regression review returns an
unconditional **PASS** — 26/26 items CONFIRMED with on-disk file:line evidence, 0 UNCONFIRMED,
no boundary defects. The route remains inert, default-off, fixtures-only, non-persistent,
LLM-free, voice-free, BA-scoped, and `.team`-only.

This PASS is a verdict on the **plan and the inert slice**, not an authorization to enable. The
five readiness gaps in §16 are enablement-time process/observability prerequisites, not code
defects, and they do not lower the verdict — they scope what must exist before a flag is ever
flipped.

## 2. Confirmation — Planning Only

This slice is planning/documentation plus read-only verification. The only file created is this
report (`engineering/reports/SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md`). No
production source file, client component, type, schema, or migration was added or edited. The
four sub-reports are likewise documentation-only artifacts.

## 3. Confirmation — No Flags Flipped

No environment variable was set, unset, or changed. `MICHAEL_RUNTIME_ROUTE_ENABLED`,
`MICHAEL_RUNTIME_RESPONSE_ENABLED`, and `MICHAEL_RUNTIME_TRACE_ENABLED` remain at their default
(unset) state. The gates were run against the tree as-is; no gate run sets any of these flags.

## 4. Confirmation — No Runtime Behavior Changed

No handler, middleware, mount, or flag helper was modified. `server/src/routes/michael-runtime.ts`
and `server/src/config/michaelRuntimeFlags.ts` are byte-for-byte the S3.4 implementations
(re-read and confirmed this slice). The route's behavior is identical to the verified S3.4 state.

## 5. Confirmation — No UI Added

No file under `apps/com/`, `apps/team/`, or `apps/admin/` was added or edited. No BA-facing
render and no admin observability surface exists; both remain future, separately-gated slices
(see §12, §18).

## 6. Confirmation — Route Remains `POST /api/michael-runtime/resolve`

Confirmed against source: `michaelRuntimeRoutes.post('/resolve', ...)`
(`server/src/routes/michael-runtime.ts:141-146`), mounted as
`app.use('/api/michael-runtime', michaelRuntimeRoutes)` below the BA-FACING GATED banner. The
bare `/api/runtime/*` family stays unmounted; the pre-gate `/api/michael` namespace is untouched
and distinct (Agent D items 1–4).

## 7. Confirmation — Route Remains Gated: `requireAuth` + `requireSteveComplete`

Confirmed: registration is `.post('/resolve', requireAuth, requireSteveComplete,
handleMichaelRuntimeResolve)` (`michael-runtime.ts:143-144`). The source imports neither
`requireMichaelComplete` (which does not exist) nor any global gate (Agent D items 5–7;
governance tests #2–#4, #20).

## 8. Confirmation — Route Remains Default-Off

Confirmed: `flagEnabled()` returns `process.env[name] === 'true'`
(`michaelRuntimeFlags.ts:12-14`); unset → false on all three axes. Only the exact lowercase
string `"true"` enables an axis; `""`, `"TRUE"`, `" true "`, `"1"`, `"yes"`, `"0"`, `"false"`
all leave it disabled (Agent D items 10–11). With no flag set, every authenticated request
short-circuits at axis 1 with `503 michael_runtime_disabled`.

## 9. Enablement Runbook (Staged Env-Flip Order)

Synthesized from Agent A (`S3_5_MICHAEL_RUNTIME_ENABLEMENT_RUNBOOK_DRAFT.md` §8). Enable strictly
in axis order; hold at each stage long enough to run its smoke test (§10) and confirm expected
behavior before advancing. Never enable a later axis before the prior axis is confirmed. Each
transition is a deploy-time env change (flags are read at call time; confirm the deploy model
re-reads `process.env`).

| Stage | `MICHAEL_RUNTIME_ROUTE_ENABLED` | `MICHAEL_RUNTIME_RESPONSE_ENABLED` | `MICHAEL_RUNTIME_TRACE_ENABLED` |
|---|---|---|---|
| Stage 0 — all off (baseline / shipped state) | (off) | (off) | (off) |
| Stage 1 — route only | `true` | (off) | (off) |
| Stage 2 — route + response | `true` | `true` | (off) |
| Stage 3 — route + response + trace | `true` | `true` | `true` |

Each axis is enabled **only** by the exact four-character string `true`. Pre-enable, confirm
every item on Agent A §7 / Agent B "Before Canary" (§11 here) is green.

## 10. Expected Behavior by Stage

Synthesized from Agent A §9 and the route source. Authenticated `.team` BA only; never `.com`.

- **Stage 0 — all off.** Axis 1 fails closed. Every authenticated request returns
  `503 {ok:false, disabled:true, reason:'michael_runtime_disabled'}` before any facade call,
  body read, or trace work. (Unauthenticated requests are stopped earlier by `requireAuth`.)
  This is the shipped production state.

- **Stage 1 — route only.** Axis 1 passes; axis 2 fails closed. Every authenticated request
  returns `503 {ok:false, disabled:true, reason:'michael_runtime_response_disabled'}`. No
  response body and — in this first implementation — no trace.
  **Agent A precision note (load-bearing):** the axis-2 (response) kill-switch check runs in
  `handleMichaelRuntimeResolve` **before** session/body-BA/turn validation
  (`michael-runtime.ts:55-59` precede line 61 onward). Therefore at Stage 1 **every**
  authenticated request returns the `response_disabled` 503 regardless of body — a missing/invalid
  `turn` or a forbidden BA body field is **never inspected** at this stage. Body validation
  (`BODY_BA_SCOPE_NOT_ALLOWED` / `MISSING_RUNTIME_TURN`) only becomes observable at Stage 2+.
  Do not expect to smoke-test body rejection at Stage 1; it is masked by the fail-closed axis-2
  short-circuit.

- **Stage 2 — route + response.** Axes 1 and 2 pass; axis 3 off. A well-formed authenticated
  request returns `200 {ok:true, selectionRequest, catalogKey, response}` **without** a `trace`
  field; `response.agentResponseGenerated === false` and `response.persistence === 'disabled'`.
  Body validation is now active and observable: forbidden BA body field →
  `400 BODY_BA_SCOPE_NOT_ALLOWED`; missing/non-object turn → `400 MISSING_RUNTIME_TURN`; missing
  session → `401`; facade `!ok`/throw → `422 {issues}` (never a 500).

- **Stage 3 — route + response + trace.** All three axes pass. A well-formed authenticated
  request returns `200 {ok:true, selectionRequest, catalogKey, response, trace}` with the
  facade's already-redacted, returned-only `trace`. The trace carries none of the forbidden keys
  (`packet`, `contextPacket`, `retrievalAudit`, `retrieval`, `token`, `sessionId`, `turnId`,
  `correlationId`, `email`, `phone`, `prospect`, `text`) and is never persisted.

## 11. Canary Checklist (reference Agent B)

The executable controlled-`.team`-canary checklist is Agent B's
`S3_5_CANARY_VERIFICATION_CHECKLIST.md`. Its three phases:

- **Before Canary (14 pre-conditions, all hard stops):** all four merge gates green (expect
  70 files / 779 tests — confirmed in §17); route exists and is mounted; default-off `503`
  baseline; `requireAuth` + `requireSteveComplete`; body-BA-override rejected; missing-turn
  rejected; `/api/runtime/*` unmounted; `.com` untouched; no UI consumer; persistence disabled;
  LLM-free; voice-free; S2.13 harness not imported. Each item names its verifying governance/
  handler test.
- **During Canary (13 constraints/observations):** one authenticated BA only, Kevin-owned BA
  first, no prospect/`.com` traffic, no persistence/LLM/dynamic generation, capture the
  returned-only response manually (the route stores nothing), confirm fixture-by-reference
  `catalogKey`, `agentResponseGenerated:false`, `persistence:'disabled'`, trace omitted when the
  trace flag is off / redacted when on.
- **After Canary (5 teardown/decision steps):** Kevin turns all flags off, confirm the disabled
  `503` state, rerun gates, document the result in a dedicated S3.5 result report, and record an
  explicit go/no-go for the next slice.

This plan adopts Agent B's checklist verbatim as the canary procedure; it is not re-pasted here.

## 12. Admin Observability Plan (reference Agent C)

The observability plan is Agent C's `S3_5_ADMIN_OBSERVABILITY_PLANNING_REVIEW.md` (planning
only — nothing implemented). Summary of what a future, separately-approved slice would expose:

- **Three flag-state booleans (1–3):** live evaluated value of each axis helper (never the raw
  env string) — the canary dashboard.
- **Core event counters (4–9):** route-disabled skips, response-disabled skips, successful
  facade resolutions, facade failures (422), body-BA-override rejections, missing-turn
  rejections — all derivable from the handler's own return paths.
- **Conditional counters (10–11):** in-handler auth-failure (401) and onboarding-gate failures
  — surfaced **only if** obtainable without reaching into auth internals or logging identities;
  dropped/omitted rather than approximated (both are enforced upstream in middleware).
- **Hard constraints (12–18):** no PII, no Context Packet, no response body, no trace body, no
  tokens/IDs, returned-only-or-in-memory first, no persistence unless separately approved.
- **Admin-only surface (19):** behind `requireAdmin` / `ADMIN_BA_IDS`; never `.com`; not
  BA-facing on `apps/team`; aggregate JSON (+ optional SSE) mirroring the `liveOps` pattern.

**Before/after-UI recommendation (Agent C §20):** build a **minimal, in-memory** observability
layer (flags 1–3 + counters 4–9) **BEFORE** the `.team` BA-facing UI slice, ideally
co-sequenced with the **start** of staged enablement — you cannot run a safe canary blind, and
the UI should only be pointed at a route already proven healthy under observation. Defer the
conditional middleware counters (10–11), any persistence (18), and any SSE/dashboard polish
until after the canary proves stable. This sequencing recommendation is adopted by this plan.

## 13. Rollback Owner

Rollback is owned by **Kevin Gardner** unless he explicitly delegates it for a specific
enablement window. The owner decides when to trigger rollback (on any §15 stop condition or at
discretion) and confirms the disabled-state smoke test afterward. Agents do not flip flags.

## 14. Rollback Steps

From Agent A §11. Rollback is a pure env/flag reversal plus redeploy — no code change:

1. **Set all three flags off.** Unset `MICHAEL_RUNTIME_ROUTE_ENABLED`,
   `MICHAEL_RUNTIME_RESPONSE_ENABLED`, and `MICHAEL_RUNTIME_TRACE_ENABLED` (unsetting preferred;
   any non-`"true"` value also disables). Clearing axis 1 alone fails the route closed, but clear
   all three to restore the documented baseline.
2. **Redeploy / restart** the server process so the env change is in effect (required if the
   deploy model does not re-read `process.env` live).
3. **Rerun gates** (`pnpm build:shared`, `pnpm typecheck`, `pnpm build`, full server suite) and
   confirm green on the rolled-back deployment.
4. **Confirm disabled response.** Re-run the Stage 0 smoke test and confirm HTTP 503
   `{ok:false, disabled:true, reason:'michael_runtime_disabled'}`. The route is inert again.

## 15. Stop Conditions

Halt enablement immediately and execute rollback (§14) if ANY of the following is observed at
any stage (Agent A §13):

- **Unexpected response** — any status/body not matching the §10 expected behavior for the
  current stage (e.g. a `200` success at Stage 0/1, a `500`, or a `response` body when response
  is disabled).
- **Trace redaction violation** — a returned trace containing any forbidden key
  (`packet`, `contextPacket`, `retrievalAudit`, `retrieval`, `token`, `sessionId`, `turnId`,
  `correlationId`, `email`, `phone`, `prospect`, `text`) or any raw upstream/generated text.
- **Any persistence** — any sign of a write to Mongo/Neo4j/Chroma/GraphRAG/Gateway, or any
  `persistence` value other than `'disabled'`.
- **Any LLM call** — any Anthropic/OpenAI/Claude/ScriptMaker/Ivory invocation or completion
  attempt from this route.
- **Any `.com` exposure** — the path or its behavior surfacing on `apps/com` / any
  prospect-facing surface.
- **Any `/api/runtime/*` exposure** — the bare runtime namespace becoming mounted or reachable.

Any stop condition also triggers a write-up for reconciliation before re-attempting enablement.

## 16. Boundary Regression Results (Agent D)

Agent D's `S3_5_BOUNDARY_REGRESSION_REVIEW.md` returns an unconditional **PASS** — 26/26 items
CONFIRMED with on-disk file:line / test-name evidence, 0 UNCONFIRMED, no boundary defects. The
review re-derived every boundary claim from source rather than trusting the S3.4 report: correct
namespace, no `/api/runtime/*`, distinct pre-gate `/api/michael`, mount below the gated banner,
`requireAuth` + `requireSteveComplete`, no `requireMichaelComplete`, session-derived BA scope,
body-BA-override rejection, default-off / exact-`"true"` flags, fail-closed axis ordering, trace
omitted/redacted under the flag, and no persistence/LLM/voice/`.com`/dynamic-generation/S2.13-
harness wiring.

The **five process-level readiness gaps** before controlled enablement (Agent D §26 — none are
code-boundary defects):

1. **Gates not re-run by Agent D.** The review cited tests by name/line but did not run them;
   Agent E must re-run the four merge gates on the current tree and confirm the 779-test count
   and the focused runs. **Closed by §17 below** — gates re-run and green this slice.
2. **No `.team` UI consumer exists yet.** Enabling the response axis exposes a working endpoint
   with no client surface; confirm no unintended caller before/after enablement and gate the UI
   slice separately.
3. **Observability/rollback runbook not in code.** The route emits no enforcement/skip counters
   and no `/admin` metric; the staged env-flip order and rollback owner live only in docs (now
   this plan). Define an executable observability/rollback runbook before a `.team` canary —
   addressed at plan level by §9, §12, §14 here; not yet implemented in code.
4. **Trace redaction depends entirely on the facade.** The route trusts `result.trace` to be
   pre-redacted; the route-level guarantee is only the forbidden-key handler test on the fixture
   path. Keep that forbidden-key list in lockstep with any future trace-shape change.
5. **Flags are deploy-time/env-only by design.** Confirm the target environment's secret/flag
   management can set exactly `"true"` (not `"TRUE"`/`" true "`, which the helper correctly
   rejects) — a near-miss value silently keeps the axis disabled (fail-closed but operationally
   surprising).

No gap blocks the slice from remaining safely inert; all five are enablement-time prerequisites.

## 17. Gates Run and Results (Actual Observed, This Slice)

All commands run read-only from the repo root `D:\momentum-creation-system-v2` (pnpm 9, Node ≥ 22,
Windows; Bash tool = Git Bash). Exact observed results:

| Gate / command | Exit | Observed result |
|---|---|---|
| `pnpm build:shared` | 0 | PASS — `@momentum/shared` tsc build clean |
| `pnpm typecheck` | 0 | PASS — all 5 workspace projects (shared, admin, com, team, server) Done, no errors |
| `pnpm build` | 0 | PASS — all 5 projects built; only standing Vite chunk-size/dynamic-import advisories (apps/team 551 kB chunk, apps/com api.ts dynamic+static import note) — non-failing |
| `pnpm --filter @momentum/server test` | 0 | PASS — **70 files / 779 tests, 0 failures** (matches S3.4 baseline) |

Focused commands:

| Focused command | Exit | Observed result |
|---|---|---|
| `pnpm --filter @momentum/server test -- michael-runtime s34MichaelRuntimeRouteGovernanceBoundary` | 0 | PASS — **4 files / 80 tests** |
| `pnpm --filter @momentum/server test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary` | 0 | PASS — **22 files / 306 tests** |
| `pnpm --filter @momentum/server test -- michaelResponseContractEsGuardrails michaelResponseContractFailedStrictness` | 0 | PASS — **2 files / 34 tests** |
| `pnpm --filter @momentum/server test -- mongoAdapter` | 0 | PASS — **1 file / 2 tests** (no flake) |

Every gate and focused run was observed PASS on the current tree; nothing is marked PASS that
was not observed. This closes Agent D readiness gap #1.

## 18. Recommendation for Next Slice

Two candidate next slices, each separately gated on Kevin's explicit approval — pick per Kevin's
decision:

- **Option A — Controlled manual `.team` canary execution record.** Execute Agent B's canary
  checklist (§11) under Kevin's owned, reversible env flips, ideally co-sequenced with the
  minimal in-memory observability layer Agent C recommends landing first (§12). Produces a
  dedicated S3.5 result report capturing the verbatim request/response bodies, which flags were
  flipped and by whom, and any anomaly. This is the lower-risk, higher-leverage next step: it
  proves the route healthy under observation before any UI points at it.
- **Option B — `.team` BA-facing UI proposal.** A read-only `.team` render of the resolved
  fixture, compliance-clean (Michael never prospect-facing), pointed at the route. Per Agent C
  §20, this should follow the minimal observability layer and a stable canary — not precede them.

Recommended sequence: minimal in-memory observability → controlled canary execution record
(Option A) → `.team` UI (Option B). No work on either option begins without Kevin's recorded
approval.

## 19. Explicit Non-Approval Statement

This plan authorizes **no** activation. No flag may be set to `"true"`, no environment changed,
and no deployment performed on the strength of this document. Specifically out of scope and NOT
approved here: no persistence (Mongo/Neo4j/Chroma/GraphRAG/Gateway/audit-log), no LLM
(Anthropic/Claude/ScriptMaker/Ivory), no dynamic text generation, no voice/Telnyx/PSTN/
call-control, no `.com`/prospect-facing exposure, no broader route scope or revival of
`/api/runtime/*`, no import of the S2.13 harness, and no UI (BA-facing `.team` render or `/admin`
observability surface). The route remains a one-call consumer of the inert S2.20 facade —
fixtures-only, authenticated, BA-scoped, non-persistent, returned-only with a redacted trace,
default-off behind the three-axis kill switch — until Kevin Gardner's separate, explicit,
recorded approval lands. All three flags remain off and the route remains inert.

---

This is the authoritative Sprint 3 S3.5 staged-enablement deliverable (Agent E, final
integrator + gates owner). It integrates the four sub-reports by reference, records the actual
read-only gate results, and grants no enablement. S3.6+ remains unproposed and separately gated.
