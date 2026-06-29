# Sprint 3 S3.5 Boundary Regression Review (Agent D)

- Sprint: Sprint 3 — Activation Planning
- Slice: S3.5 multi-agent planning review — adversarial boundary/regression confirmation of the S3.4 minimal Michael runtime route (`POST /api/michael-runtime/resolve`) and the S3.3 contract hardenings, before any controlled enablement.
- Status: REVIEW — DOCUMENTATION ONLY. No code, flags, env, UI, persistence, or commit changed. Read-only inspection only; build/typecheck/test gates were NOT run by this agent (Agent E owns the gates) — every item is grounded in file:line or test-name evidence read on disk.
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Owner: Agent D (boundary/regression reviewer)
- Verdict: **PASS** — all 26 items CONFIRMED with on-disk evidence. 0 UNCONFIRMED. Readiness gaps before controlled enablement: see §26 (no boundary defects; gaps are process/observability prerequisites, not code drift).

> This review re-derives every boundary claim from source rather than trusting the
> S3.4 verification report. Each item below cites the proving file:line or test name.
> It authorizes no enablement; it confirms the route is inert and within boundary.

## Inputs inspected on disk

- `server/src/routes/michael-runtime.ts` (47–146 read in full)
- `server/src/config/michaelRuntimeFlags.ts` (full)
- `server/src/index.ts` (route mount block 56–62, 236–242; pre-gate 100–152; gated banner 154–234)
- `server/src/routes/__tests__/michael-runtime.test.ts` (full, 16 tests)
- `server/src/routes/__tests__/michael-runtime.kill-switch.test.ts` (full, 11 tests)
- `server/src/routes/__tests__/michael-runtime.env.test.ts` (full, 22 tests)
- `server/src/routes/__tests__/s34MichaelRuntimeRouteGovernanceBoundary.test.ts` (full, 31 tests)
- `server/src/runtime/orchestration/__tests__/michaelResponseContractEsGuardrails.test.ts` (header + import surface)
- `server/src/runtime/orchestration/__tests__/michaelResponseContractFailedStrictness.test.ts` (header + import surface)
- `server/src/services/persistence/__tests__/mongoAdapter.test.ts` (full)
- `engineering/reports/SPRINT_003_S3_4_*` and `SPRINT_003_S3_3_*` verification reports

## Item-by-item confirmation

| # | Claim | Verdict | Evidence |
|---|---|---|---|
| 1 | Namespace `/api/michael-runtime/resolve` correct | CONFIRMED | Router mounted at `app.use('/api/michael-runtime', michaelRuntimeRoutes)` — `server/src/index.ts:242`; handler registered at `michaelRuntimeRoutes.post('/resolve', ...)` — `michael-runtime.ts:141-146`. Static assert: governance test `#24` (mount present), `#1`/`#20`. |
| 2 | No `/api/runtime/*` mounted | CONFIRMED | `grep app\.use\(.*api/runtime` over `index.ts` → 0 matches. Governance test `#26` asserts `/app\.use\(\s*['"`]\/api\/runtime\b/` is absent — `s34...test.ts:292-295`. Comment at `index.ts:240` deliberately says "reserved bare runtime namespace stays unmounted" (no `/api/runtime` literal). |
| 3 | `/api/michael` remains a SEPARATE pre-gate route | CONFIRMED | `app.use('/api/michael', michaelRoutes)` at `index.ts:105`, inside the PRE-GATE block (banner at 94–99), above the gated banner (154). Distinct namespace from `/api/michael-runtime`. Governance test `#27` asserts michael index < gated banner < runtime mount — `s34...test.ts:297-306`. |
| 4 | Mounted BELOW the gated banner | CONFIRMED | `BA-FACING GATED ROUTES` banner at `index.ts:154-172`; runtime mount at `index.ts:242` (after `/api/cockpit` 181, `/api/orientation` 234). Governance test `#25` asserts `runtimeIndex > max(cockpitIndex, orientationIndex)` — `s34...test.ts:281-290`. |
| 5 | `requireAuth` applied | CONFIRMED | Imported `michael-runtime.ts:22`; applied in registration `michael-runtime.ts:143`. Governance test `#2` (import) + `#20` (registration order) — `s34...test.ts:108-114, 244-249`. |
| 6 | `requireSteveComplete` applied | CONFIRMED | Imported `michael-runtime.ts:23`; applied `michael-runtime.ts:144`. Governance test `#3` + `#20`. Handler is NOT globally gated — middleware applied per-route per CLAUDE.md mount rule. |
| 7 | No `requireMichaelComplete` (does not exist / not imported) | CONFIRMED | Repo-wide `grep requireMichaelComplete` over `server/src` → only hits are the governance assertion lines `s34...test.ts:124-125`. No `server/src/middleware/requireMichael*` file exists (glob → none). Governance test `#4` asserts the route never references it — `s34...test.ts:124-127`. |
| 8 | BA scope from session | CONFIRMED | `const sessionBaId = req.session?.baId` — `michael-runtime.ts:61`; force-injected into `identity.scope.baId` at `michael-runtime.ts:92-101`; missing session → 401 (`62-64`). Governance test `#21`; handler test 5 (`michael-runtime.test.ts:173-181`). |
| 9 | Body BA override rejected | CONFIRMED | `FORBIDDEN_BODY_BA_FIELDS = ['baId','sponsorBaId','targetBaId']` (`michael-runtime.ts:35`); rejected with 400 `BODY_BA_SCOPE_NOT_ALLOWED` (`69-77`). Handler tests 2–4 cover each field (`michael-runtime.test.ts:143-171`); governance test `#21`. |
| 10 | Flags default off | CONFIRMED | `flagEnabled()` returns `process.env[name] === 'true'` — `michaelRuntimeFlags.ts:12-14`; unset → false. Env test 1 + 8 (`michael-runtime.env.test.ts:64-67, 106-113`); governance test `#28` (`s34...test.ts:325-340`). |
| 11 | Exact `"true"` only | CONFIRMED | Strict `=== 'true'` — `michaelRuntimeFlags.ts:13`. Env test 4/6 reject `"TRUE"`, `" true "`, `"1"`, `"yes"`, `"0"`, `"false"`, `""` (`michael-runtime.env.test.ts:35, 79-94`); kill-switch test 2 (`"TRUE"` route → still 503) and test 6 (`"TRUE"` trace → success without trace) (`michael-runtime.kill-switch.test.ts:130-140, 188-200`). |
| 12 | Route axis disabled fail-closes | CONFIRMED | Axis 1 returns `503 {ok:false,disabled:true,reason:'michael_runtime_disabled'}` BEFORE any facade call/body read — `michael-runtime.ts:47-51`. Handler test 6 asserts no `response`/`trace`/`catalogKey`/`selectionRequest` leak (`michael-runtime.test.ts:183-198`); kill-switch tests 1,9 (`...kill-switch.test.ts:111-128, 227-235`). |
| 13 | Response axis disabled fail-closes | CONFIRMED | Axis 2 returns `503 ...reason:'michael_runtime_response_disabled'`, no response/trace — `michael-runtime.ts:55-59`. Handler test 7 (`michael-runtime.test.ts:200-211`); kill-switch tests 3,7 (`...kill-switch.test.ts:142-155, 202-211`). |
| 14 | Trace disabled omits trace | CONFIRMED | `payload.trace` assigned ONLY inside `if (michaelRuntimeTraceEnabled())` — `michael-runtime.ts:134-136`; otherwise omitted. Handler test 8 (`trace` undefined at 200) (`michael-runtime.test.ts:213-226`); kill-switch tests 4,8 (`...kill-switch.test.ts:157-170, 213-225`). |
| 15 | Trace enabled returns redacted trace | CONFIRMED | `payload.trace = result.trace` (the facade's already-redacted trace) — `michael-runtime.ts:135`. Handler test 9 recursively collects every key and asserts none of `packet, contextPacket, retrievalAudit, retrieval, token, sessionId, turnId, correlationId, email, phone, prospect, text` appear (`michael-runtime.test.ts:117-130, 228-243`). Governance test `#23` asserts the only trace write is `payload.trace = result.trace` and the response is never spread into trace (`s34...test.ts:269-274`). |
| 16 | No persistence | CONFIRMED | No Mongo/Neo4j/Chroma/GraphRAG/Gateway import, no `tripleStackWrite`, no `.insert/.update/.save/.create` call in `michael-runtime.ts`. Governance tests `#7-#12` (import scans) + `#16` (call-shape scan) assert empty match sets (`s34...test.ts:147-222`). Success responses carry `persistence === 'disabled'` — handler test 12 (`michael-runtime.test.ts:268-276`), kill-switch test 11. |
| 17 | No LLM | CONFIRMED | No Anthropic/OpenAI/Claude import, no `messages.create`/`chatCompletion`/`createChatCompletion`. Governance tests `#13-#14` (`s34...test.ts:191-203`). |
| 18 | No dynamic generation | CONFIRMED | Returns the catalog fixture by reference; `agentResponseGenerated === false` on every success (handler tests 11,13 — `michael-runtime.test.ts:258-288`). Governance test `#30` asserts source has no `agentResponseGenerated: true`, no `text:` field assignment (string-stripped), no template-literal `text:` (`s34...test.ts:352-364`). |
| 19 | No voice | CONFIRMED | No `telnyx`/`pstn`/`call-control` import, no `createCallControl`/`startCall`/`placeCall`/`dialProspect`/`callControlId` wiring. Governance test `#15` (`s34...test.ts:205-215`). |
| 20 | No `.com` | CONFIRMED | No `apps/com` import in route. Governance test `#31` (`s34...test.ts:366-370`). Route is BA-facing only (gated). |
| 21 | No `.team` UI | CONFIRMED | Slice is route + flag helper + tests only. No `apps/team/**` file touched (S3.4 report §20; nothing in scope edits a client component). No import from `apps/team` in `michael-runtime.ts`. |
| 22 | No S2.13 harness import | CONFIRMED | Route imports only `resolveMichaelRuntimeTurnResponse` + its type from `../runtime/orchestration/index.js` (`michael-runtime.ts:24-25`). Governance test `#6` asserts no `michaelRuntimeResponseHarness` / `michaelRuntimeResponseScenarios` / `createMichaelRuntimeResponseFixtureHarness` reference (`s34...test.ts:139-145`). (NOTE: the route's own *test* file imports `runtimeTurnHarness` to BUILD a valid turn — that is test scaffolding in `__tests__`, not production wiring, and is outside the boundary scan.) |
| 23 | S3.3 ES scanner test present/intact | CONFIRMED | `michaelResponseContractEsGuardrails.test.ts` present, 24 tests; header documents diacritic-/case-normalized ES prohibited-term scan + ES safe-close guard, fixtures-only (`...EsGuardrails.test.ts:1-31`). Listed as S3.3 Agent B deliverable in `SPRINT_003_S3_3_*` §2. |
| 24 | S3.3 failed-strictness test present/intact | CONFIRMED | `michaelResponseContractFailedStrictness.test.ts` present, 10 tests; exercises `failed_context_requires_safe_close` (failed + safe_fallback rejected; failed + safe_close accepted) (`...FailedStrictness.test.ts:1-40`). S3.3 §11-§14, Agent C. |
| 25 | mongoAdapter test present/intact | CONFIRMED | `server/src/services/persistence/__tests__/mongoAdapter.test.ts` present, 2 tests, describe-level `15000ms` timeout for the parallel-load dynamic-import flake (`mongoAdapter.test.ts:22-26, 95`). Test-only; no production persistence code touched (S3.3 §15-§17). |
| 26 | Readiness gaps before controlled enablement | See §26 | No boundary defects found. Process/observability prerequisites listed below. |

## Adversarial findings — boundary drift hunt

Actively probed for drift; results:

- **No reserved namespace revived.** `/api/runtime/*` is absent; the new path `/api/michael-runtime` does not contain the literal substring `/api/runtime`, so the pre-existing strict `orchestrationBoundary` guard (`not.toMatch(/\/api\/runtime/)`) and the `runtimeBoundarySkeleton` S2.1 guard both still hold. The S3.4 report (§6, Documented Test-Only Corrections #1) records the `runtimeBoundarySkeleton.test.ts` regex was *tightened* so `michaelRuntimeRoutes` no longer false-positives — that is a test-precision fix, not a loosening of the production boundary, and the strict `/api/runtime` literal guard was explicitly left intact.
- **Mount ordering is load-bearing and correct.** Raw-body Telnyx (`index.ts:77`) still mounts before `express.json()` (`79`); pre-gate block unchanged; the runtime mount is strictly additive below the gated banner. No existing line was edited (append-only rule honored).
- **Fail-closed ordering is correct.** Route axis is checked before body read, session read, and facade call (`michael-runtime.ts:47-59` precede `61` onward), so a disabled route leaks nothing. Malformed turns map to a deterministic 422 via try/catch (`105-117`), never a 500 (handler test 14).
- **BA authority cannot be smuggled via body.** Forbidden-field rejection runs before the facade call, and the session BA is force-injected over any body-supplied `identity.scope.baId` (`92-101`). Sponsor immutability (locked-spec 3.5) holds.
- **Trace cannot leak the response or PII.** Trace is the facade's redacted trace, assigned only under the flag, and never composed from `result.response` (governance test `#23`); handler test 9 enforces the forbidden-key set at runtime.
- **No persistence/LLM/voice/.com call shapes** in the route source (governance scans `#7-#19`).

No out-of-boundary drift found in the route, the flag helper, or the mount.

## §26 Readiness gaps before controlled enablement (none are code-boundary defects)

These are prerequisites for *flipping the flags*, not defects in the inert slice:

1. **Gates not re-run by this review.** Per instructions, Agent D did not run `pnpm typecheck`/`build`/`test`. The S3.4 report claims **70 files / 779 tests, 0 failures** and all four gates green, but that is the prior slice's record. Before enablement, Agent E should re-run the four merge gates on the current tree and confirm the 779-test count and the focused route/contract/mongoAdapter runs — this review cites tests by name/line but does not prove they pass today. (Process gap, not a boundary gap.)
2. **No `.team` UI consumer exists yet.** Enabling `MICHAEL_RUNTIME_RESPONSE_ENABLED` exposes a working endpoint with no client surface; the endpoint is reachable only by an authenticated, Steve-complete BA. Confirm there is no unintended caller before/after enablement, and gate the UI slice (S3.5 item 2) separately.
3. **Observability/rollback runbook not in code.** The route emits no enforcement/skip counters and no `/admin` metric for runtime resolves; the staged env-flip order (`ROUTE → RESPONSE → TRACE`) and rollback owner live only in the S3.4 recommendation (§25), not in an executable runbook. Define these before a `.team` canary.
4. **Trace redaction depends entirely on the facade.** The route trusts `result.trace` to be pre-redacted; the route-level guarantee is only the forbidden-key test (handler test 9) on the *fixture* path. If/when the facade's trace shape ever changes, the redaction invariant must be re-proven — keep handler test 9's forbidden-key list in lockstep with any future trace fields.
5. **Flags are deploy-time/env-only by design.** Enablement requires an env change in the deploy environment (no code change). Confirm the target environment's secret/flag management can set exactly `"true"` (not `"TRUE"`/`" true "`, which the helper correctly rejects) — a near-miss value silently keeps the axis disabled (fail-closed, but operationally surprising).

No gap blocks the slice from remaining safely inert; all five are enablement-time prerequisites.

---

Final: 26/26 items CONFIRMED, 0 UNCONFIRMED. The S3.4 route and S3.3 hardenings are within boundary and inert; the only readiness gaps are enablement-time process/observability prerequisites (§26), not code drift.
