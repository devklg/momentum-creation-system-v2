# Sprint 3 · S3.11 — Server-Owned Turn Source: Route + UI Wiring — Verification Report

**Slice:** S3.11 (server-owned turn source route/UI wiring — final integration)
**Role:** Agent E (final integrator / authoritative gate runner / verification author)
**Date:** 2026-06-28
**Surfaces touched:** `server/` (route), `apps/team/` (cockpit card), server tests (behavioral + governance)
**Production code modified by integrator:** none (integration-only; gates run, report written)

Cross-references:
- `engineering/reports/SPRINT_003_S3_10_SERVER_OWNED_TURN_SOURCE_VERIFICATION.md` (S3.10 turn source — upstream)
- `engineering/reports/SPRINT_003_S3_9_TEAM_MICHAEL_RUNTIME_UI_VERIFICATION.md` (S3.9 UI — upstream)
- `engineering/reports/SPRINT_003_S3_4_MINIMAL_MICHAEL_RUNTIME_ROUTE_VERIFICATION.md` (S3.4 minimal route — baseline)
- `engineering/reports/S3_10_TURN_SOURCE_ARCHITECTURE_READINESS_REVIEW.md` (turn-source readiness)
- `engineering/reports/S3_9_UI_MANUAL_VERIFICATION_CHECKLIST.md` (UI manual checklist)

---

## 1. Executive result

**PASS WITH CONDITIONS.**

Live route/UI wiring of the S3.10 server-owned turn source is complete and every authoritative gate is green (repo build/typecheck/build, team typecheck, the full 996-test server suite, and all targeted behavioral + static-governance batches). The route is now an async, server-owned handler that builds the runtime turn entirely from the authenticated session, rejects all client-supplied runtime input with `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`, and resolves through the inert S2.20 facade. The cockpit card calls the real endpoint live on mount and settles into the calm disabled state behind the default-off kill switch.

Two conditions remain and bound the result:
- **(a) Degraded / safe-fallback-only.** The server-owned turn is degraded and fail-closed; the approved-knowledge retrieval path is still deferred, so the route currently resolves only to the `michael_safe_fallback_degraded_en` fixture (`safe_fallback`). No real `next_training_step` is produced yet.
- **(b) Flags remain default-off.** No production or staging enablement was performed. Route, response, and trace kill switches are all default-off. A controlled UI canary with route + response flags enabled is the next step and is Kevin-owned.

## 2. Files added / modified

Modified (production):
- `server/src/routes/michael-runtime.ts` — async handler; server-owned body contract; invokes S3.10 turn source then S2.20 facade.
- `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` — `resolveMichaelRuntimeTrainingStep` helper sends `{}`/`{language}` only; auto-invokes on mount; leak-free disabled/error states.

Modified (tests):
- `server/src/routes/__tests__/michael-runtime.test.ts`
- `server/src/routes/__tests__/michael-runtime.observability.test.ts`
- `server/src/routes/__tests__/michael-runtime.kill-switch.test.ts`
- `server/src/routes/__tests__/michael-runtime.turn-source.test.ts`
- `server/src/routes/__tests__/s310MichaelRuntimeRouteBoundary.test.ts`
- `server/src/routes/__tests__/s34MichaelRuntimeRouteGovernanceBoundary.test.ts`
- `server/src/routes/__tests__/s36MichaelRuntimeObservabilityGovernanceBoundary.test.ts`
- `server/src/routes/__tests__/s39MichaelRuntimeUiServerBoundary.test.ts`

Added (tests):
- `server/src/routes/__tests__/michael-runtime.server-owned-turn.test.ts`
- `server/src/routes/__tests__/s311MichaelRuntimeServerOwnedTurnGovernanceBoundary.test.ts`
- `server/src/runtime/orchestration/__tests__/s311MichaelRuntimeTurnSourceGovernanceBoundary.test.ts`

Added (this report):
- `engineering/reports/SPRINT_003_S3_11_SERVER_OWNED_ROUTE_UI_WIRING_VERIFICATION.md`

Unchanged and confirmed not in the diff: `apps/com/*`, `server/src/index.ts`, any flag/env file, `server/src/services/michaelRuntimeObservability.ts`, `server/src/runtime/orchestration/michaelRuntimeTurnSource.ts`, `server/src/runtime/context/michaelRuntimeContextFoundation.ts`.

## 3. Route now uses the server-owned turn source

`handleMichaelRuntimeResolve` is `async`. After the kill-switch axes and body validation, it calls `await createMichaelRuntimeTurnForAuthenticatedBa({ baId: sessionBaId, language })` (S3.10) to build the turn, then `resolveMichaelRuntimeTurnResponse(created.input)` (S2.20 facade) to resolve it. The route no longer receives or trusts a client turn.

## 4. No client `body.turn`

The body contract allowlists exactly one field — `language` — via `ALLOWED_BODY_FIELDS = new Set(['language'])`. `turn` is never read from the body; supplying it triggers the forbidden-key path.

## 5. Client `turn` / `runtimeTurn` / `contextPacket` rejected

Any key not exactly `language` returns `400` with `code: 'CLIENT_RUNTIME_INPUT_NOT_ALLOWED'`, incrementing `bodyBaOverrideRejections`. This covers `turn`, `runtimeTurn`, `contextPacket`, `retrieval`, `gateway`, `graph`, `approvedKnowledge`, `candidateKnowledge`, `token`, `sessionId`, `turnId`, `correlationId`, `requestId`, `prospectId`, and any other unexpected key. A malformed `language` value (non-string or not `en`/`es`) is rejected the same way.

## 6. Body BA authority rejected

`baId`, `sponsorBaId`, `targetBaId`, `downlineBaId` in the body are non-`language` keys and therefore rejected with `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED`. This merges the old `BODY_BA_SCOPE_NOT_ALLOWED` rule into the single broader server-owned-input rule and removes `MISSING_RUNTIME_TURN` (there is no client turn to be missing).

## 7. BA scope is session-derived

BA scope comes solely from `req.session?.baId`. A missing session id yields `401`. The session BA id is the only identity passed to `createMichaelRuntimeTurnForAuthenticatedBa`. Sponsor immutability (locked-spec 3.5) is preserved — body-supplied BA authority is rejected before any work.

## 8. Context Manager is the sole packet assembler

The route assembles no Context Packet. Packet assembly remains in the sanctioned context layer (`michaelRuntimeContextFoundation.ts`); the S3.10 turn source injects the assembler as a port and the orchestration layer does not assemble itself. The route never imports a context/retrieval helper directly.

## 9. Degraded empty-knowledge behavior

With approved-knowledge retrieval still deferred, the server-owned turn is built in a degraded, fail-closed mode: `agentResponseGenerated: false`, `persistence: "disabled"`, and no promised `next_training_step`. Empty knowledge does not error — it resolves deterministically to the safe fallback.

## 10. `safe_fallback` result

The degraded server-owned turn resolves to fixture `michael_safe_fallback_degraded_en` with `responseType: 'safe_fallback'`, returned BY REFERENCE from the inert facade. The card maps this to `{ kind: 'safe_fallback', text }`.

## 11. No `next_training_step` promise

The slice makes no claim of a real next training step. Because approved-knowledge retrieval is deferred, only `safe_fallback` is produced today; a genuine `next_training_step` awaits the Context Manager retrieval path (see Recommendation).

## 12. UI helper no longer accepts/sends a turn

`resolveMichaelRuntimeTrainingStep(opts?: { language?: 'en' | 'es' })` accepts only an optional language hint. It sends `{}` when no hint is given, `{ language }` otherwise. It never accepts or sends a turn / runtimeTurn / Context Packet.

## 13. UI is read-only

The card is display-only: it renders calm guidance text and a read-only "Try again" affordance that re-runs the resolve (bumps `attempt`). It never sends, calls, schedules, or prospects on the BA's behalf, and writes no application state beyond local React render state.

## 14. UI is leak-free

The helper reads only the safe subset of a `200` response (`text`, `responseType`, `language`, and display-only `nextStep` strings). It never reads `trace` (payload top-level), IDs (`sessionId`/`turnId`/`correlationId`/`contextPacketId`), `safety`, `persistence`, `agentResponseGenerated`, or the `nextStep` boolean flags (`baOwned`/`automaticSending`/`automaticCalling`/`externalSideEffect`). Non-200 statuses collapse to a generic `{ kind: 'error' }` — no codes, reasons, or issues reach the BA. No `localStorage`/`sessionStorage`/`IndexedDB`, no analytics.

## 15. No flags flipped

No flag default was changed. Route, response, and trace flags remain default-off (`michaelRuntimeFlags.ts` untouched and not in the diff).

## 16. Route default-off

With route flag off (default), Axis 1 returns `503 { reason: 'michael_runtime_disabled' }` before any turn-source or facade work. The card renders the calm `disabled` placeholder driven by the real endpoint.

## 17. No production / staging enablement

No `.env`, deployment config, or environment was modified. No production or staging enablement occurred.

## 18. No `.com`

`apps/com` is untouched and absent from the diff. Michael remains BA-facing (`.team`) only.

## 19. No `/api/runtime`

No `/api/runtime` route exists or was added. The only runtime-facing route is `POST /api/michael-runtime/resolve`.

## 20. No persistence

No write to MongoDB/Neo4j/ChromaDB/Gateway/GraphRAG. The degraded turn carries `persistence: "disabled"`; observability is in-memory integer counters only.

## 21. No LLM

`ANTHROPIC_API_KEY` / ScriptMaker / Ivory are not invoked. The route resolves a pre-authored fixture; no model call is made.

## 22. No dynamic text generation

The route never generates text. The response is a contract-validated fixture returned by reference from the inert S2.20 facade.

## 23. No voice

No Telnyx / voice / TTS / STT path is touched or added.

## 24. No direct store / Gateway / GraphRAG / retrieval

The route imports only the orchestration entrypoints (`createMichaelRuntimeTurnForAuthenticatedBa`, `resolveMichaelRuntimeTurnResponse`), the flag functions, and the observability recorders. It calls no store, Gateway client, GraphRAG helper, or retrieval helper directly.

## 25. No S2.13 harness in the production path

The S2.13 test-only harness is not imported by `michael-runtime.ts`, the turn source, or the card. It remains test-scoped.

## 26. Observability is in-memory aggregate

`michaelRuntimeObservability.ts` is unchanged: six module-level integer counters (`routeDisabledSkips`, `responseDisabledSkips`, `successfulFacadeResolutions`, `facadeFailures`, `bodyBaOverrideRejections`, `missingTurnRejections`). No PII, body, response, trace, or IDs stored. Counter reuse is preserved: forbidden-input rejections increment `bodyBaOverrideRejections`; turn-source/facade failures increment `facadeFailures`; `missingTurnRejections` is retained for shape stability and stays `0` (no client turn can be "missing" now).

## 27. Test results (behavioral)

- Full server suite: **82 files / 996 tests passed, 0 failed**.
- Server-owned route batch (`michael-runtime`, `server-owned-turn`, `s311MichaelRuntimeServerOwnedTurnGovernanceBoundary`, `s311MichaelRuntimeRouteUiBoundary`): **8 files / 119 passed**.
- Turn-source batch (`michaelRuntimeTurnSource`, `s310…TurnSourceGovernanceBoundary`, `s311…TurnSourceGovernanceBoundary`): **3 files / 52 passed**.
- Observability batch (`michaelRuntimeObservability`, `michael-runtime-observability`): **3 files / 64 passed**.
- Facade/catalog/contract batch: **22 files / 306 passed**.
- ES guardrails / failed-strictness batch: **2 files / 34 passed**.
- `mongoAdapter`: **1 file / 2 passed**.

## 28. Static governance results

- UI/route/observability governance batch (`s39MichaelRuntimeUiServerBoundary`, `s34MichaelRuntimeRouteGovernanceBoundary`, `s36MichaelRuntimeObservabilityGovernanceBoundary`): **3 files / 87 passed**.
- S3.11 server-owned-turn governance + S3.10/S3.11 turn-source governance: included in batches above — all green.
- Pre-existing assembler-boundary regression (`orchestrationBoundary`, `s24GovernanceBoundary`): **2 files / 22 passed** — no regression.

## 29. Gates run + results table

| # | Gate (command) | Result | Counts |
|---|---|---|---|
| 1 | `pnpm build:shared` | PASS | tsc clean |
| 2 | `pnpm typecheck` | PASS | 5/5 projects Done |
| 3 | `pnpm build` | PASS | all workspaces built |
| 4 | `pnpm --filter @momentum/team typecheck` | PASS | tsc -b clean |
| 5 | `pnpm --filter @momentum/server test` | PASS | 82 files / 996 tests, 0 fail |
| 6 | `…test -- michael-runtime server-owned-turn s311MichaelRuntimeServerOwnedTurnGovernanceBoundary s311MichaelRuntimeRouteUiBoundary` | PASS | 8 files / 119 |
| 7 | `…test -- michaelRuntimeTurnSource s310MichaelRuntimeTurnSourceGovernanceBoundary s311MichaelRuntimeTurnSourceGovernanceBoundary` | PASS | 3 files / 52 |
| 8 | `…test -- s39MichaelRuntimeUiServerBoundary s34MichaelRuntimeRouteGovernanceBoundary s36MichaelRuntimeObservabilityGovernanceBoundary` | PASS | 3 files / 87 |
| 9 | `…test -- michaelRuntimeObservability michael-runtime-observability` | PASS | 3 files / 64 |
| 10 | `…test -- michaelRuntimeResolutionFacade michaelResponseSelectionRequest michaelResponseCatalogSelector michaelResponseCatalog michaelRuntimeAdapterContract michaelResponseContract s220MichaelRuntimeResolutionFacadeGovernanceBoundary` | PASS | 22 files / 306 |
| 11 | `…test -- michaelResponseContractEsGuardrails michaelResponseContractFailedStrictness` | PASS | 2 files / 34 |
| 12 | `…test -- mongoAdapter` | PASS | 1 file / 2 |
| 13 | `…test -- orchestrationBoundary s24GovernanceBoundary` | PASS | 2 files / 22 |

All gates green. `git status --short` shows only: `michael-runtime.ts`, the card, the eight modified test files, the three new test files, and this report — no `.com`, no `server/src/index.ts`, no flag/env, no observability-module change.

## 30. Conditions on the PASS

- **(a)** Degraded / safe-fallback-only — approved-knowledge retrieval path deferred; only `michael_safe_fallback_degraded_en` resolves today.
- **(b)** Flags default-off — no production/staging enablement; a controlled UI canary (route + response flags) is the Kevin-owned next step.

## 31. Recommendation for next slice

1. **Targeted body-BA rejection canary** — exercise the `400 CLIENT_RUNTIME_INPUT_NOT_ALLOWED` boundary against representative client payloads in a controlled environment to confirm the merged rule in the field.
2. **Controlled UI canary with route + response flags enabled** — Kevin-owned, `.team` only, to observe the live degraded `safe_fallback` end-to-end render before broader enablement.
3. **Approved Context Manager retrieval path planning** — design the sanctioned approved-knowledge retrieval to move beyond degraded `safe_fallback` to a real `next_training_step` (still no LLM/persistence until separately approved).
4. **apps/team behavioral test runner** — stand up a `.team` component test runner so the card's leak-free states are verified by automated behavioral tests, not just static governance boundaries.

Do NOT in the next slice: flip flags by default, enable prod/staging, persist, call LLMs, generate text, activate voice, modify `.com`, or implement S3.12 ahead of approval.
