# Sprint 3 · S3.10 — Server-Owned Michael Runtime Turn-Source Integration Verification

- **Sprint / Slice:** Sprint 3 · S3.10 — server-owned Michael runtime turn source (final integration + full gate suite)
- **Agent:** Agent E (final integrator / verification)
- **Date:** 2026-06-28
- **Scope discipline:** No production code modified by the integrator, no flags flipped, no route/UI wiring, no `.com` touched, no commit/git. This report is the sole integrator-authored artifact. During integration a gate revealed a real defect (§ Remediation); the integrator STOPPED and reported it rather than fixing it. The defect was subsequently remediated by the implementing chain with an architecturally-correct context-layer split (governance tests **preserved, not weakened**); the integrator independently re-ran the full gate suite — now green — and updated this report accordingly.
- **Sub-reports cross-referenced:** `S3_10_TURN_SOURCE_ARCHITECTURE_READINESS_REVIEW.md` (Agent A), `SPRINT_003_S3_9_TEAM_MICHAEL_RUNTIME_UI_VERIFICATION.md`, `SPRINT_003_S3_8_TEAM_MICHAEL_RUNTIME_UI_PROPOSAL.md`, `SPRINT_003_S3_7_CONTROLLED_CANARY_EXECUTION_RECORD.md`.

---

## 1. Executive result: **PASS WITH CONDITIONS**

The server-owned turn source is implemented on the degraded / fail-closed path, the architectural placement defect found during integration has been correctly remediated by splitting Context Packet assembly into the context layer, and the **full server gate suite is green (938 passed / 0 failed, 79 files)** — independently re-run by the integrator. The two governance boundaries that were briefly RED (S2.1 / S2.4 "Context Manager remains the only assembler") are GREEN again **without being weakened** — they still forbid orchestration-resident assembly; the code was moved to honor them, the test was not relaxed.

The result is **PASS WITH CONDITIONS** (not unqualified PASS) because two deliberate scope limits are carried forward:

**Prominent carried conditions:**
- **(a) Degraded / safe-fallback-only.** The turn source emits an empty-approved-knowledge, `packetStatus: 'degraded'` packet that resolves to `michael_safe_fallback_degraded_en` (`safe_fallback`). Real approved-knowledge enrichment (a substantive `next_training_step`) is **DEFERRED** to a future, separately-gated, Kevin-approved Context-Manager retrieval slice.
- **(b) Live UI/route wiring deferred.** The module is additive and exported but NOT invoked: the route still consumes `body.turn`, and the `.team` Michael card stays disabled by default. Live wiring is a future slice (S3.11).

---

## Remediation (original blocker → fix → governance preserved)

**Original BLOCKED root cause (caught during integration).** Agent B initially placed `michaelRuntimeTurnSource.ts` *inside* `server/src/runtime/orchestration/`, where it imported `ContextPacketBuildInput` and called `buildContextPacket(...)`. Two pre-existing, tracked governance tests forbid **any** Context Packet assembly inside orchestration production source:
- `orchestrationBoundary.test.ts` — **S2.1** › *"never assembles Context Packets (Context Manager remains the only assembler)"* (scans `runtime/orchestration/**` for `buildContextPacket`/`prepareContextPacketFoundation`).
- `s24GovernanceBoundary.test.ts` — **S2.4** › *"does not assemble Context Packets inside orchestration production source"* (also scans for `ContextPacketBuildInput`, `assembledBy: 'agent_runtime'`).

Both last touched in Sprint 2 (`294cbe8`), committed on `main` — not authored by this slice. The full suite went RED (`2 failed | 934 passed`). The integrator STOPPED and reported it. (Agent A's readiness review had flagged the fork: question #11 specified the module path "(or a `services/` peer)".)

**The fix (context-layer split).** Packet assembly was moved OUT of orchestration into a new context-layer factory:
- `server/src/runtime/context/michaelRuntimeContextFoundation.ts` exports `createMichaelRuntimeContextManagerPort(...)`, which owns `buildContextPacket` + `assembledBy: 'context_manager'` and assembles the empty-approved-knowledge, candidate-excluded, `packetStatus: 'degraded'` packet from session identity alone — store-free, fail-closed. It depends on the context layer and shared types, and only **`import type`**s the `ContextManagerRequestPort` shape from orchestration (erased at runtime — no reverse runtime layering).
- `server/src/runtime/orchestration/michaelRuntimeTurnSource.ts` now imports `createMichaelRuntimeContextManagerPort` from `../context/index.js` and **injects** the port into `coordinateRuntimeTurn`. It contains **zero** `buildContextPacket` / `ContextPacketBuildInput` tokens (verified by source grep — `NONE FOUND`).

**Governance preserved, not weakened.** The S2.1 and S2.4 tests are unchanged in intent — they still reject orchestration-resident assembly. They pass now because the orchestration source no longer assembles; assembly lives in the Context Manager layer, which is exactly the invariant ("Context Manager remains the only assembler"). Agent D's `s310MichaelRuntimeTurnSourceGovernanceBoundary.test.ts` was updated (25 → 27 tests) to positively assert that assembly lives in the context layer and is absent from the turn source. The integrator independently re-ran both formerly-red files: **PASS**.

---

## 2. Files added

| File | Author | Role |
|---|---|---|
| `server/src/runtime/orchestration/michaelRuntimeTurnSource.ts` | Agent B | Turn source — derives session identity, **injects** the context-layer port, drives `coordinateRuntimeTurn`. No assembly tokens. |
| `server/src/runtime/context/michaelRuntimeContextFoundation.ts` | remediation | **NEW context-layer factory** `createMichaelRuntimeContextManagerPort` — sole assembly site; owns `buildContextPacket` + `assembledBy: 'context_manager'`; degraded/empty-knowledge, fail-closed. |
| `server/src/runtime/orchestration/__tests__/michaelRuntimeTurnSource.test.ts` | Agent C | Unit suite (12) — PASS |
| `server/src/routes/__tests__/michael-runtime.turn-source.test.ts` | Agent C | Route-unchanged behavioral suite (7) — PASS |
| `server/src/runtime/orchestration/__tests__/s310MichaelRuntimeTurnSourceGovernanceBoundary.test.ts` | Agent D | Static governance boundary (27, updated to assert assembly lives in context) — PASS |
| `server/src/routes/__tests__/s310MichaelRuntimeRouteBoundary.test.ts` | Agent D | Static route/boot/UI regression boundary (20) — PASS |
| `engineering/reports/S3_10_TURN_SOURCE_ARCHITECTURE_READINESS_REVIEW.md` | Agent A | Architecture readiness review (verdict: PROCEED degraded/fail-closed) |
| `engineering/reports/SPRINT_003_S3_10_SERVER_OWNED_TURN_SOURCE_VERIFICATION.md` | Agent E | This report |

## 3. Files modified (append-only export edits only)

| File | Change |
|---|---|
| `server/src/runtime/context/index.ts` | Appended export of `createMichaelRuntimeContextManagerPort` (+ its input type). Existing exports untouched. |
| `server/src/runtime/orchestration/index.ts` | Appended `export { createMichaelRuntimeTurnForAuthenticatedBa }` + its three types. Existing exports untouched. |
| `server/src/runtime/index.ts` | Appended the re-export from `./orchestration/index.js`. Existing exports untouched. |

`git status --short` shows exactly these three modified files plus the added files in §2 — **no** route change, **no** `apps/team` change, **no** `.com` change, **no** flag/env change.

## 4. Was the server-owned turn source implemented? **YES (degraded), gate-clean.**

`createMichaelRuntimeTurnForAuthenticatedBa(input)` accepts session-derived BA identity only (`{ baId, language?, mode?, sessionId?, correlationId? }`), injects the context-layer `ContextManagerRequestPort` (empty approved knowledge, `packetStatus: 'degraded'`), drives `coordinateRuntimeTurn`, asserts the coordinator decision is `degraded` before emitting, and returns `{ ok: true, input: MichaelRuntimeAdapterContractInput }` or `{ ok: false, issues }`. It fails closed (never throws). The full suite is green.

## 5. Blocker status: **CLEARED.** Remaining item is a carried condition, not a blocker.

The original orchestration-resident-assembly blocker is fully remediated (see § Remediation) and the gate is green. What remains is **condition §1(a)** — a DEFERRED capability, not a defect: real approved-knowledge enrichment requires a future, Kevin-approved Context-Manager retrieval path (with audited store access) so a `complete` packet and a substantive `next_training_step` can be produced **without** client fabrication, direct Mongo/Neo4j/Chroma/GraphRAG/Gateway calls, raw retrieval helpers, or the S2.13 harness. Until it exists, the degraded/safe-fallback posture is the only compliant one. **Required future interface:** the context-layer factory `createMichaelRuntimeContextManagerPort` is the natural seam to extend — it can later supply real `approvedKnowledge`/`knowledgeReferences` and promote `packetStatus` from `degraded` to `complete`, with the orchestration turn source unchanged.

## 6. No UI live call wired

`MichaelRuntimeSupportCard.tsx` is unchanged. The static boundary (s310 route boundary #15) confirms `resolveMichaelRuntimeTurn(` has no call site — only its declaration. No fetch-on-mount, no `useEffect`, no auto-resolve.

## 7. Card remains disabled by default

`kind: 'disabled'` remains the default state (s310 route boundary #14, PASS). The header blocker note still documents why the live call is intentionally un-invoked.

## 8. No flags flipped

No `MICHAEL_RUNTIME_*` default changed; `index.ts` assigns no `process.env.MICHAEL_RUNTIME_*` (s310 route boundary #5, PASS). `git status` shows no `.env`/flag change.

## 9. No route enabled

`server/src/routes/michael-runtime.ts` is unchanged: still imports the S2.20 facade, still applies `requireAuth + requireSteveComplete`, still reads `body.turn`, and does NOT reference the turn source (s310 route boundary #6–#11; `michael-runtime.turn-source` GROUP A, all PASS).

## 10. No `.com`

No `apps/com` file touched or imported (s310 route boundary #17, PASS; S2.1 "`.com` has no S2 agent runtime wiring" PASS).

## 11. No `/api/runtime/*`

`index.ts` mounts no bare `/api/runtime` family; existing `/api/michael-runtime` and `/api/michael` mounts intact (s310 route boundary #1–#3; S2.1 "/api/runtime remains unmounted", all PASS).

## 12. No persistence

Every persistence axis on the produced turn is `'disabled'`; neither the turn source nor the context factory has `.insert/.update/.save/.create`, `fs` write, or `tripleStackWrite` (turn-source governance #8–#9, PASS; context factory is store-free by inspection).

## 13. No LLM

No OpenAI/Anthropic/Claude import or call in the turn source or the context factory; no `messages.create`/`chatCompletion` (turn-source governance #10–#11, PASS).

## 14. No dynamic generation

`agentResponseGenerated: false` is pinned and `true` is statically absent (turn-source governance #20, PASS). The resolved response is a pre-authored fixture by reference.

## 15. No voice

No Telnyx/PSTN/voice/call-control import or call (turn-source governance #12, PASS).

## 16. No direct store / Gateway / GraphRAG access

No Mongo/Neo4j/Chroma/GraphRAG/Gateway/tripleStack/retrieval-client import in either module (turn-source governance #1–#6, PASS; context factory store-free by inspection — it imports only `../events/index.js`, shared types, `./contextManager.js`, and `import type` from orchestration). The sole data source is `buildContextPacket`, now invoked from the context layer (its sanctioned home).

## 17. No raw Context Packet accepted from client

The turn-source input type carries only session BA identity; there is no field for a client-supplied packet or raw retrieval output (turn-source governance #13, PASS; unit test #5 proves injected body-authority props are ignored).

## 18. No raw Context Packet exposed to client

The success result returns only `MichaelRuntimeAdapterContractInput` (consumed server-side by the facade); the raw packet / runtime turn is never returned to a client. The route (unchanged) returns only the fixture + optional redacted trace.

## 19. BA scope session-derived

`identity.scope.baId === input.baId` and nothing else (unit test #4, PASS). Tenant/team/teamKey/teamName are server-side constants in both modules; `baId` is the only caller-supplied identity, mandated from `req.session.baId`.

## 20. No body BA authority accepted

`sponsorBaId/targetBaId/downlineBaId/prospectId/prospectToken` have no code-token presence in the turn source (turn-source governance #13, PASS); polluting the input with them is ignored and they never serialize into the output (unit test #5, PASS). The route's existing 400 `BODY_BA_SCOPE_NOT_ALLOWED` rejection is intact (route turn-source test #4, PASS).

## 21. Context Manager sole packet assembler

Now structurally guaranteed: assembly lives only in `runtime/context/michaelRuntimeContextFoundation.ts` (`assembledBy: 'context_manager'`, candidate/review-only excluded), and the orchestration turn source contains no assembly tokens. The S2.1 and S2.4 boundaries — unchanged and unweakened — pass.

## 22. Facade compatibility (degraded → `michael_safe_fallback_degraded_en`)

The `ok:true` input resolves through `resolveMichaelRuntimeTurnResponse` to `catalogKey === 'michael_safe_fallback_degraded_en'`, `responseType === 'safe_fallback'`; the ES session resolves to the `_es` sibling (unit tests #8, #9, #12, PASS).

## 23. `agentResponseGenerated: false`

Confirmed on both `runtimeTurn` top-level and `runtimeTurn.metadata`, and on the resolved response (unit tests #7, #8, PASS).

## 24. `persistence: "disabled"`

`metadata.persistence`, `eventPersistence`, `outcomePersistence`, `guidedActionPersistence`, `envelopePersistence`, and the resolved `response.persistence` / `trace.persistence` are all `'disabled'` (unit tests #7, #8, PASS).

## 25. No S2.13 harness in the production path

Neither `michaelRuntimeTurnSource.ts` nor `michaelRuntimeContextFoundation.ts` imports from `fixtures/` or references a harness symbol (turn-source governance #7, PASS). The wrapper is built from the *type* (declared in `types.ts`, not `fixtures/`). **Note:** the test files legitimately import `runRuntimeTurnFixtureScenario`/`buildContextPacket` as fixtures — sanctioned in `__tests__`, excluded from every production boundary scan.

## 26. Test results (new suites — all green)

| Suite | File | Tests | Result |
|---|---|---|---|
| Agent C unit | `michaelRuntimeTurnSource.test.ts` | 12 | PASS |
| Agent C route-unchanged | `michael-runtime.turn-source.test.ts` | 7 | PASS |
| Agent D turn-source governance (updated) | `s310MichaelRuntimeTurnSourceGovernanceBoundary.test.ts` | 27 | PASS |
| Agent D route/boot/UI boundary | `s310MichaelRuntimeRouteBoundary.test.ts` | 20 | PASS |
| **Total new** | (4 files) | **66** | **PASS** (Agent C 19 + Agent D 47) |

## 27. Static governance results

All S3.10 static boundary assertions pass: store-free imports, no harness, persistence-free, no LLM/voice, no body-authority tokens, required Context-Manager wiring, pinned invariants, compliance copy; route/boot/UI regression. The previously-failing **orchestration-wide** S2.1/S2.4 assembly-locus scans are now GREEN (assembly relocated to the context layer; tests unchanged). Independently re-run by the integrator: `orchestrationBoundary.test.ts` + `s24GovernanceBoundary.test.ts` → PASS (2 files / 22 tests).

## 28. Gates run and results (ACTUAL — independently re-run by the integrator post-remediation)

| Command | Result | Counts |
|---|---|---|
| `pnpm build:shared` | PASS | tsc clean |
| `pnpm typecheck` | PASS | 5/5 projects (shared, com, team, admin, server) — all Done, 0 errors |
| `pnpm build` | PASS | all 5 workspaces built; warnings only (chunk-size / pre-existing dynamic-import notice) |
| `pnpm --filter @momentum/team typecheck` | PASS | `tsc -b` clean |
| `pnpm --filter @momentum/server test` (FULL) | **PASS** | **938 passed / 0 failed (79 files)** — was `2 failed / 934` pre-remediation |
| `orchestrationBoundary` + `s24GovernanceBoundary` (the two formerly RED) | PASS | 2 files / 22 tests |
| `michaelRuntimeTurnSource` + `s310…TurnSourceGovernanceBoundary` + `s310…RouteBoundary` + `michael-runtime.turn-source` | PASS | 4 files / 66 tests |
| Michael chain · observability · S3.3 ES guardrails · `mongoAdapter` | PASS | green (batches 161 + 64 + 306 + 36, unchanged from pre-remediation) |

No test was weakened to achieve green; the full suite passes on the relocated-assembly architecture.

## 29. Recommendation for next slice (S3.11)

1. **Wire the route + UI live call** to `createMichaelRuntimeTurnForAuthenticatedBa(req.session)` behind the existing default-off flags (`MICHAEL_RUNTIME_ROUTE_ENABLED`, `MICHAEL_RUNTIME_RESPONSE_ENABLED`, `MICHAEL_RUNTIME_TRACE_ENABLED`) — swap the route's `body.turn` for the server-owned turn source (request body becomes intent-only); flip the `.team` card off its hardcoded disabled state. (S3.8 §1 BLOCKER / S3.9 Condition A.)
2. **Land the still-open targeted body-BA-rejection canary** (S3.8 §26 / S3.9 Rec 2) against the live route once wired.
3. **Approved-knowledge enrichment path** (the §1(a) deferred condition) — a Kevin-approved Context-Manager retrieval slice that extends `createMichaelRuntimeContextManagerPort` to supply real approved knowledge and promote the packet from `degraded` to `complete` with audited store access (no client fabrication / direct stores / Gateway / harness).
4. **apps/team behavioral test runner** so the card's live behavior is covered by something beyond static source scans.

---

### Verdict
**PASS WITH CONDITIONS.** The server-owned turn source is implemented and behaviorally correct on the degraded/fail-closed path; the integration-surfaced placement defect was remediated by an architecturally-correct context-layer split that preserves (does not weaken) the S2.1/S2.4 "Context Manager is the sole assembler" governance; and the full server gate suite is green (938/0) as independently re-run by the integrator. Two scope conditions carry forward: (a) degraded/safe-fallback-only — real approved-knowledge enrichment deferred (resolves `michael_safe_fallback_degraded_en`); (b) live UI/route wiring deferred to S3.11 (route still consumes `body.turn`; card still disabled; module created + exported but NOT invoked).
