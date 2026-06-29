# Sprint 3 — S3.7 Canary Boundary / Compliance / Safety Review

**Slice:** S3.7 — Michael Runtime Route CANARY (execution-record)
**Agent:** Agent D (boundary / compliance / safety reviewer)
**Document type:** REVIEW ONLY — no code changes, no flag flips, no commit. One report file.
**Date:** 2026-06-28
**Reviewed git state:** branch `main`; working tree clean except the untracked S3.7 review files in `engineering/reports/` (no source, env, or flag mutation present).

---

## 0. Scope, method, and a load-bearing caveat

This review grounds every claim in `file:line` or test-name evidence against the production code that the canary exercised, and against the two static governance boundary suites named in the brief:

- `server/src/routes/__tests__/s34MichaelRuntimeRouteGovernanceBoundary.test.ts` (31 cases)
- `server/src/routes/__tests__/s36MichaelRuntimeObservabilityGovernanceBoundary.test.ts` (35 cases)

**Reconciliation note (this revision):** my first pass ran while Agent C's `engineering/reports/S3_7_CANARY_EXECUTION_RESULT_RECORD.md` was still being written, so it read as absent — a parallel-batch timing artifact, not a missing deliverable. The record has since landed (REAL-OBSERVED, local in-process, captured `2026-06-29T01:30:11.379Z`, commit `cfef7a63…`) and **every previously record-dependent item (#13-#16 recorded values, #17, #20, #21, #29, #30, #31) is now reconciled and CONFIRMED against it.** §2, §4, §5, and the verdict are updated below; §1 retains the methodology audit trail.

- Items provable from **production source + the governance suites** were CONFIRMED in the first pass and remain so.
- Items that depended on the **content of the execution record** are now CONFIRMED against the landed record — its observed values match the source-predicted behavior exactly, and its redaction is clean (see §4).

The canary's classification is **LOCAL / DRY-RUN, no production flag flipped** — corroborated by Agent A's `engineering/reports/S3_7_CANARY_ENVIRONMENT_READINESS_REVIEW.md` §1, §13, by `.env.example` containing zero `MICHAEL_RUNTIME_*` keys, and now by the execution record §1, §5, §23. That is the correct and safe posture (see §3).

---

## 1. The canary's methodology (reconstructed from the harness source I captured)

The temporary harness drove `handleMichaelRuntimeResolve` (`server/src/routes/michael-runtime.ts:52`) directly with a mock req/res, four stages **in order**, capturing status, body, and observability-counter deltas at each stage:

- `stage0_all_unset` — all three flags deleted (`_s37_canary_harness.canary.test.ts:100-101`)
- `stage1_route_only` — sets `MICHAEL_RUNTIME_ROUTE_ENABLED='true'` (`:104-105`)
- `stage2_route_response` — adds `MICHAEL_RUNTIME_RESPONSE_ENABLED='true'` (`:107-109`)
- `stage3_route_response_trace` — adds `MICHAEL_RUNTIME_TRACE_ENABLED='true'` (`:111-113`)
- mock session is `{ baId: 'TMBA-LOCAL-CANARY' }` (synthetic), body is `{ turn }` only — no body BA-authority field supplied (`:38-43`)
- end of run restores prior env and calls `resetMichaelRuntimeObservabilityForTests()` (`:120-126`)

The harness imported `runRuntimeTurnFixtureScenario` from `../../runtime/orchestration/fixtures/runtimeTurnHarness.js` — the runtime-turn fixture harness — **not** the S2.13 Michael response harness (`michaelRuntimeResponseHarness` / `michaelRuntimeResponseScenarios`). See §2 item 27.

This methodology matches the staged-enablement order in `SPRINT_003_S3_5_MICHAEL_RUNTIME_STAGED_ENABLEMENT_PLAN.md`. The execution record §6-§13 confirms the four stages ran in this exact order with the source-predicted outcomes (§2 below cites the record line ranges).

---

## 2. The 31 compliance items

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Canary remained `.team` only | CONFIRMED | Route is `.team`-only, BA-facing (`michael-runtime.ts:4-5`); readiness review §11 (synthetic Kevin-owned BA session, no `.com`/prospect). |
| 2 | No `.com` | CONFIRMED | s34 #31 `keeps .com untouched — no apps/com import`; readiness review §13. |
| 3 | No prospect-facing route | CONFIRMED | Handler gated `requireAuth, requireSteveComplete` (`michael-runtime.ts:156-161`); Michael BA-facing only per `CLAUDE.md` compliance rule 3. |
| 4 | No `/api/runtime/*` | CONFIRMED | No such mount in `index.ts` (grep clean); s34 #26 (`:292-295`), s36 #33 (`:418-421`) both assert `app.use('/api/runtime'…)` absent. |
| 5 | `/api/michael` untouched | CONFIRMED | Pre-gate mount intact `index.ts:106`; s34 #27, s36 #34 assert it present and pre-gate. |
| 6 | Route remained `POST /api/michael-runtime/resolve` | CONFIRMED | `michaelRuntimeRoutes.post('/resolve', …)` `michael-runtime.ts:156-161`; mounted `index.ts:246`. |
| 7 | Auth required (`requireAuth`) | CONFIRMED | `michael-runtime.ts:158`; s34 #2, #20. |
| 8 | `requireSteveComplete` required | CONFIRMED | `michael-runtime.ts:159`; s34 #3, #20 (`post(/resolve, requireAuth, requireSteveComplete, …)`). |
| 9 | No `requireMichaelComplete` | CONFIRMED | Not present; s34 #4 (`:124-127`), s36 #27 assert the token absent. |
| 10 | BA scope from session | CONFIRMED | `req.session?.baId` `michael-runtime.ts:71`, forced into adapter input `:104-113`; s34 #21. Harness supplied it via `session.baId` only. |
| 11 | No body BA authority accepted | CONFIRMED (code) | `FORBIDDEN_BODY_BA_FIELDS=['baId','sponsorBaId','targetBaId']` `:43`; rejected 400 `BODY_BA_SCOPE_NOT_ALLOWED` `:79-88`; s34 #21. NOTE: the canary harness did not exercise the rejection path (it sent only `turn`) — enforcement is proven by source, not by an observed canary rejection. |
| 12 | Flags staged in order 0→1→2→3 | CONFIRMED | Record §6 flag table shows accumulation unset → ROUTE → +RESPONSE → +TRACE; §13 deltas = one counter +1 per stage in order. |
| 13 | Route-disabled stage fails closed `503 michael_runtime_disabled` | CONFIRMED (code + observed) | Code `michael-runtime.ts:55-60` returns 503 before any work; record §9/§10 Stage 0 = `503 {ok:false,disabled:true,reason:"michael_runtime_disabled"}`, §13 `routeDisabledSkips +1`. |
| 14 | Response-disabled stage fails closed `503 michael_runtime_response_disabled` | CONFIRMED (code + observed) | Code `:64-69`; record §9/§10 Stage 1 = `503 …reason:"michael_runtime_response_disabled"`, §13 `responseDisabledSkips +1`. |
| 15 | Trace-disabled stage omits trace | CONFIRMED (code + observed) | Code guard `:148-150`; record §9-§10 Stage 2 = 200, `trace` ABSENT (record line 162 explicitly notes no `trace` key), `successfulFacadeResolutions +1`. |
| 16 | Trace-enabled stage returns redacted trace only | CONFIRMED (code + observed) | Code `:149` (`payload.trace = result.trace`), s34 #23 (only trace assignment is `result.trace`, no response spread); record §10 Stage 3 trace carries only classification/selection/`persistence`/`agentResponseGenerated` aggregate keys — record lines 193-194 confirm no token/sessionId/turnId/correlationId/packet/retrieval/PII keys. |
| 17 | No raw Context Packet recorded | CONFIRMED | Route never assembles a Context Packet (`michael-runtime.ts:13`); record carries only `contextPacketStatus:"complete"` and a redacted `contextPacketId` (`<redacted: ctx_s2_12_*>`, record line 150) — a status flag + redacted ID label, never raw packet contents. The trace has no packet key. |
| 18 | No response body persisted | CONFIRMED | s34 #16; observability in-memory only — s36 #2-#9, #13, #20; record §16 (`persistence:"disabled"`, no `tripleStackWrite` reached) and every response body carries `"persistence":"disabled"`. |
| 19 | No trace body persisted | CONFIRMED | Same as #18; trace is response-only, never written; record §16. |
| 20 | No PII in the record | CONFIRMED | Record §7 (fixture-only, "No real PII"), §8/§10; the only literal identifier is synthetic `TMBA-LOCAL-CANARY` (record line 64, labeled "simulated authenticated Kevin BA session"); response text is a generic training instruction (record line 141). No name/email/phone/address appears. |
| 21 | No tokens/IDs in the record | CONFIRMED | Record §10 redacts `sessionId`/`turnId`/`correlationId`/`contextPacketId` behind `<redacted: session_s2_12_* / turn_s2_12_* / corr_s2_12_* / ctx_s2_12_*>` placeholders, labeled S2.12 fixture constants (record lines 103-105, 136-138, 150); §8 redacts the request `identity`/`turnId`. No production token, real session ID, or JWT appears; the lone literal ID (`TMBA-LOCAL-CANARY`) is explicitly labeled synthetic — satisfying former concern C2. |
| 22 | No persistence | CONFIRMED | s34 #16 (no `.insert/.update/.save/.create`/`tripleStackWrite`); s36 #8, #20, #30; no Mongo/Neo4j/Chroma/GraphRAG/Gateway imports (s34 #7-#11, s36 #2-#7). |
| 23 | No LLM | CONFIRMED | s34 #13 (no completion call), #14 (no OpenAI/Anthropic/Claude import); s36 #10, #11, #24. |
| 24 | No dynamic generation | CONFIRMED | s34 #30 (no `agentResponseGenerated: true`, no `text:` assignment, no template literal `text`); s34 #29 facade-direct invariant `agentResponseGenerated=false`; facade returns fixture by reference. |
| 25 | No voice/Telnyx/PSTN/call-control | CONFIRMED | s34 #15; s36 #12. |
| 26 | No Steve/Ivory behavior activated | CONFIRMED | Route's only resolution call is `resolveMichaelRuntimeTurnResponse` (Michael facade) `:24,119`; no Steve/Ivory imports or calls. `requireSteveComplete` is an onboarding *gate*, not Steve behavior. |
| 27 | No S2.13 harness | CONFIRMED | Production route does not import it — s34 #6, s36 #28. The (now-deleted) canary harness imported the *runtime-turn* fixture harness (`runtimeTurnHarness.js`), not `michaelRuntimeResponseHarness`/`Scenarios`/`createMichaelRuntimeResponseFixtureHarness`. |
| 28 | Observability remained aggregate + in-memory | CONFIRMED | Module-level integer counters only `michaelRuntimeObservability.ts:38-45`; snapshot returns evaluated flags + counter copy `:52-59`; s36 #13 (no body/response/trace/PII/token/session/turn/correlation fields), #14 (exactly six counters); admin route is a pure read `admin/michael-runtime-observability.ts:23-25`, no audit/persist (s36 #17, #19, #20). |
| 29 | Rollback state documented (flags unset; temp harness deleted) | CONFIRMED | Record §22 documents it (env vars unset/restored, observability reset, harness file DELETED, `git status --short` lists no harness); corroborated independently — no `_s37_canary_harness*` on disk (glob clean), git status shows only the untracked review reports. |
| 30 | Final flag state documented (all off, committed default unchanged) | CONFIRMED | Record §23 (all three axes OFF, committed default unchanged, production flags never flipped); corroborated: `.env.example` has 0 `MICHAEL_RUNTIME_*` keys, index.ts flips no flag — s36 #35, git working tree shows no env mutation. |
| 31 | Canary result supports moving to a `.team` UI proposal | CONFIRMED | Record §24 recommends PROCEED on observed data (clean 503/503/200/200 ladder, one-counter-per-stage deltas, zero error-path movement, no persistence/LLM/voice/`.com`/`/api/runtime`/S2.13 coupling). Observed results match source-predicted behavior; foundation supports a `.team`-only UI proposal. See §5 for the one non-blocking caveat (C3). |

---

## 3. Is LOCAL / DRY-RUN the correct safe posture? — YES

No staging tier exists for this repo and Kevin has not authorized any production flag flip (readiness review §1, §16). Running the canary as an ephemeral in-process exercise with all `MICHAEL_RUNTIME_*` flags read from `process.env` at call time (`michaelRuntimeFlags.ts:12-14`) and reverted on process exit — with `.env`/`.env.example` untouched — is the correct, minimal-blast-radius choice. Production was not in scope and was not touched. **This posture is confirmed safe and appropriate.**

---

## 4. Adversarial concerns (boundary / redaction leak hunt)

- **C1 — RESOLVED.** First-pass concern was that the execution record was absent. It has since landed and all record-dependent items (#13-#17, #20, #21, #29-#31) reconcile cleanly against it; the observed values match source-predicted behavior exactly. No longer a concern.
- **C2 — RESOLVED.** The redaction surface I flagged is clean in the landed record: the only literal identifier is the synthetic `TMBA-LOCAL-CANARY`, explicitly labeled "simulated authenticated Kevin BA session" (record line 64); all fixture `sessionId`/`turnId`/`correlationId`/`contextPacketId` values are `<redacted: *_s2_12_*>` placeholders labeled S2.12 fixture constants (record lines 103-105, 136-138, 150); the Stage-3 trace exposes only aggregate classification/selection metadata with no token/session/turn/correlation/packet/retrieval/PII keys (record lines 193-194). No raw production identifier, token, or PII appears.
- **C3 — Body-BA rejection was not empirically exercised (NON-BLOCKING, honestly disclosed).** Item 11 holds at the source level (`michael-runtime.ts:79-88`, s34 #21). The canary sent only `{ turn }`, so `bodyBaOverrideRejections` stayed 0 across all stages (record §13) and no observed 400 `BODY_BA_SCOPE_NOT_ALLOWED` was produced. The record discloses this honestly in §21 (Stage-1 kill-switch masks all request-validation branches by design; well-formed turn never triggers a rejection). The correct framing — "enforced in source, not exercised in this canary" — is exactly what the record states, so this is a transparency caveat, not a defect. A future canary that sends a body-BA field with both ROUTE and RESPONSE axes on would close this empirically.
- **Boundary leaks: none found** — in production code *or* in the execution record. Both governance suites and a direct read of the four production files show no `.com` import, no `/api/runtime` mount, no persistence/LLM/voice/Telnyx/store/GraphRAG/Gateway wiring, no S2.13 harness, no `requireMichaelComplete`, and an admin endpoint that is `requireAdmin`-only with no audit/persist. The record's redaction adds no leak.

---

## 5. On advancing to a `.team` UI proposal

The runtime route is statically clean, fail-closed on three independent default-off axes, BA-scoped, fixtures-only, non-persistent, LLM/voice-free, and backed by aggregate in-memory observability. The landed execution record now provides REAL-OBSERVED corroboration: the 503/503/200/200 stage ladder, one-counter-per-stage deltas with zero error-path movement, trace present only at Stage 3, and clean redaction all match the source-predicted contract. The two gating conditions from my first pass are met — (a) the record landed with stage outcomes matching §2 items 13-16, and (b) the C2 redaction check passes. **Recommendation: advancing to a `.team`-only UI proposal is supported.** The single non-blocking caveat (C3) is that the body-BA rejection path was not empirically exercised in this canary (it is proven in source); a future canary sending a body-BA field under ROUTE+RESPONSE axes would close it empirically. UI work remains `.team`/BA-facing only — never `.com`, never prospect-facing — per the compliance boundary, and the kill switch must remain the sole, default-closed gate.

---

## Verdict

**PASS** — with Agent C's `S3_7_CANARY_EXECUTION_RESULT_RECORD.md` now landed and reconciled, **all 31 compliance items are CONFIRMED.** The production-code boundary/compliance/safety posture is clean (no leaks in code or record), the four-stage flag ladder behaved exactly per the S3.4/S3.6 contract (503 `michael_runtime_disabled` → 503 `michael_runtime_response_disabled` → 200 no-trace → 200 redacted-trace), observability counters moved one-per-stage on the expected branch with zero error-path movement, and the record's redaction is clean (only synthetic/labeled identifiers, fixture IDs redacted, no PII/tokens/raw Context Packet). Rollback and final flag state (all axes off, committed default unchanged, production never touched) are both documented and independently corroborated. The canary supports advancing to a `.team`-only UI proposal.

**UNCONFIRMED items: 0.** **Blocking concerns: 0.** Former concerns C1 and C2 are RESOLVED by the landed record. **One non-blocking caveat remains: C3** — the body-BA rejection path (item 11) is proven in source but was not empirically exercised by this canary (the record discloses this honestly in §21; `bodyBaOverrideRejections` stayed 0). This is a transparency note, not a defect, and does not gate the PASS. Production-code and record boundary leaks: **none found**.
