# Sprint 3 · S3.10 — Michael Runtime Turn-Source Architecture Readiness Review

- **Sprint / Slice:** Sprint 3 · S3.10 — architecture readiness review (DOCUMENTATION ONLY)
- **Agent:** Agent A (architecture readiness)
- **Date:** 2026-06-28
- **Scope discipline:** No code changed, no flags flipped, no tests run, no commit/git. This report is the sole artifact.
- **Core question:** Can a server-owned, session-scoped Michael runtime turn source produce a facade-compatible turn input for `POST /api/michael-runtime/resolve` **without** any of: client-fabricated turn/Context Packet, body-supplied BA authority, direct Mongo/Neo4j/Chroma/GraphRAG/Gateway access, raw retrieval helpers, or the S2.13 test-only fixture harness in the production path?

---

## VERDICT: **PROCEED (degraded / fail-closed only)**

A server-owned turn source **can be implemented today** from session BA identity alone, with **zero** store / retrieval / Gateway / harness access, using two functions that already exist in production code: `buildContextPacket` ([contextManager.ts:163](../../server/src/runtime/context/contextManager.ts)) and `coordinateRuntimeTurn` ([turnCoordinator.ts:17](../../server/src/runtime/orchestration/turnCoordinator.ts)). Both are pure with respect to I/O; the only data source on the path is an **injected** `ContextManagerRequestPort`, and that port can be backed by `buildContextPacket` with empty knowledge.

The honest qualifier — and why this is **degraded**, not **full** — is that without store/retrieval access there is **no approved-knowledge enrichment**. The only knowledge-honest packet a store-free turn source can assemble is an **empty-knowledge** packet. The compliant, fail-closed posture is to stamp that packet `packetStatus: 'degraded'`, which the inert S2.20 facade deterministically resolves to the pre-authored `safe_fallback` fixture. A meaningful `next_training_step` backed by real retrieved knowledge remains **deferred/blocked** until an approved Context-Manager retrieval path (with sanctioned store access) is built — and that work must **not** be shortcut via client fabrication, direct stores, Gateway, or the harness.

**Three-sentence justification:** `buildContextPacket` ([contextManager.ts:163-275](../../server/src/runtime/context/contextManager.ts)) is a pure synchronous assembler whose knowledge/reference inputs are all optional ([lines 100-104](../../server/src/runtime/context/contextManager.ts)), defaults `approvedKnowledge` to `[]` ([line 183](../../server/src/runtime/context/contextManager.ts)) and `candidateKnowledgeExcluded:true` ([line 245](../../server/src/runtime/context/contextManager.ts)), performs no store/retrieval/Gateway I/O, and produces a valid `context_packet.v1` from BA identity alone. The production coordinator `coordinateRuntimeTurn` ([turnCoordinator.ts:17-39](../../server/src/runtime/orchestration/turnCoordinator.ts)) reaches a validated `consumption` result purely through an **injected** `ContextManagerRequestPort` ([composition.ts:18-24](../../server/src/runtime/orchestration/composition.ts) → [contextRequest.ts:122](../../server/src/runtime/orchestration/contextRequest.ts) → [consumption.ts:23-29](../../server/src/runtime/orchestration/consumption.ts)), so a turn source that injects a port calling `buildContextPacket` touches no store. The S2.13 harness ([runtimeTurnHarness.ts](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts)) is only a convenience that injects a *fixture* port fabricating a packet inline ([lines 203-237](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts)) — it never calls `buildContextPacket` — so a production turn source replicates its non-test parts (call `coordinateRuntimeTurn`, wrap the result) without importing it.

---

## Evidence trace (cited)

### The facade input contract

`resolveMichaelRuntimeTurnResponse(input)` ([michaelRuntimeResolutionFacade.ts:160-164](../../server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts)) requires `input: MichaelRuntimeAdapterContractInput` ([types.ts:470-478](../../server/src/runtime/orchestration/types.ts)):

```
{
  identity: AgentRuntimeAdapterDispatchIdentity,   // {scope:{...,baId}, sessionId, agentKey, mode, language, correlationId, requestId?}
  turnId: RuntimeTurnId,
  taskType: RuntimeTaskType,                        // must be 'training_support'
  runtimeTurn: RuntimeTurnFixtureHarnessResult,     // THE load-bearing field
  turnClarity?: 'clear' | 'ambiguous',
  language?: unknown,
  intent?: 'clear_training_support' | 'ambiguous_training_support'
}
```

The facade calls `deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput` ([michaelResponseSelectionRequest.ts:38-79](../../server/src/runtime/orchestration/michaelResponseSelectionRequest.ts)), which runs the inert classifier `runMichaelRuntimeAdapterContract` ([michaelRuntimeAdapterContract.ts:57](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts)). The classifier reads `input.runtimeTurn.result as ResolvedRuntimeTurn` ([line 60](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts)) where `ResolvedRuntimeTurn = RuntimeTurnCoordinatorResult & { consumption? }` ([lines 39-41](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts)), and classifies entirely off:

- the inert flags on `runtimeTurn.result` and on `input.runtimeTurn` top-level (`agentResponseGenerated===false`, `*Persistence==='disabled'`) — `findInertRuntimeIssue` [lines 165-198](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts);
- `runtimeTurn.result.consumption` (a `ContextPacketConsumptionResult`): `packetAgentKey`, `taskType`, `decision`, `packetStatus`, and `packet.metadata.generatedBy==='context_manager'` (`hasContextManagerAssemblyMarker` [line 266-270](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts)) and `packet.retrievalAudit.candidateKnowledge*` (`hasCandidateReviewOnlyContext` [line 272-281](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts)).

Critically, the facade/classifier **never executes** the runtime turn; it inspects an already-resolved `consumption`. So a turn source only has to *produce* a structurally valid resolved turn — it does not need any live behavior.

### The exact `runtimeTurn` wrapper the adapter expects (`RuntimeTurnFixtureHarnessResult`, [types.ts:368-383](../../server/src/runtime/orchestration/types.ts))

```
{
  scenario: RuntimeTurnFixtureScenarioType,
  metadata: RuntimeTurnFixtureScenarioMetadata,     // adapter reads ONLY metadata.contextManagerInjected (line 362)
  input: RuntimeTurnCoordinatorInput,               // {identity, turnId, taskType, contextManager?, requireSubstantive?, createdAt?}
  result: RuntimeTurnCoordinatorResult,             // the OrchestrationTurnCompositionResult carrying .consumption (types.ts:261)
  contextCalls: [],
  eventPersistence: 'disabled', outcomePersistence: 'disabled',
  guidedActionPersistence: 'disabled', envelopePersistence: 'disabled',
  behavior: 'not_implemented', agentResponseGenerated: false
}
```

Note: this type is declared in `types.ts`, **not** in `fixtures/`. Importing the *type* and constructing the object literal does **not** import the harness. The `metadata.fixtureOnly: true` literal is required by the type but is inert — the classifier reads only `metadata.contextManagerInjected` ([michaelRuntimeAdapterContract.ts:362](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts)). (Agent B may optionally APPEND a production-named twin type to `types.ts` to avoid the "Fixture" label; append-only rule applies.)

### `buildContextPacket` is a pure, store-free assembler

[contextManager.ts:163](../../server/src/runtime/context/contextManager.ts) `buildContextPacket(input: ContextPacketBuildInput): ContextPacketV1`. `ContextPacketBuildInput` ([lines 89-112](../../server/src/runtime/context/contextManager.ts)) **requires** only identity/scope envelope fields: `packetId`, `requestId`, `tenant`, `team`, `ba`, `session`, `agentKey`, `objective`, `language`, `provenance`. Every knowledge/reference input is **optional** (`approvedKnowledge?`, `knowledgeReferences?`, `graphContextReferences?`, `vectorContextReferences?`, `eventContextReferences?` — [lines 100-104](../../server/src/runtime/context/contextManager.ts)). With none supplied: `approvedKnowledge` resolves to `[]` ([line 183](../../server/src/runtime/context/contextManager.ts)), `candidateKnowledgeIncluded:false` / `candidateKnowledgeExcluded:true` ([lines 244-245](../../server/src/runtime/context/contextManager.ts)), `metadata.generatedBy:'context_manager'` ([line 262](../../server/src/runtime/context/contextManager.ts)), and `assertValidContextPacket` passes ([line 273](../../server/src/runtime/context/contextManager.ts)). **It fetches nothing** — it consumes caller-supplied inputs only (its own guardrail says so: `no_active_retrieval_s1_5`, [lines 404-409](../../server/src/runtime/context/contextManager.ts)). `packetStatus` is caller-chosen, default `'complete'` ([line 200](../../server/src/runtime/context/contextManager.ts)); passing `'degraded'` sets `retrievalAudit.degraded:true` ([line 247](../../server/src/runtime/context/contextManager.ts)).

### `coordinateRuntimeTurn` is the production runtime-turn builder, and it is store-free

[turnCoordinator.ts:17-39](../../server/src/runtime/orchestration/turnCoordinator.ts) — production (exported [index.ts:102](../../server/src/runtime/orchestration/index.ts)), validates preconditions, then delegates to `dispatchAgentRuntimeAdapter` → `composeOrchestrationTurn`. It does **not** call `buildContextPacket` itself and does **not** require a pre-built packet; it requires an **injected** `contextManager: ContextManagerRequestPort` ([types.ts:304-311](../../server/src/runtime/orchestration/types.ts), [146-152](../../server/src/runtime/orchestration/types.ts)). Down the chain:

- `composeOrchestrationTurn` ([composition.ts:15-55](../../server/src/runtime/orchestration/composition.ts)) only calls `requestContextPacketForTurn` + `draftOutcomeGuidedActionEnvelopes`.
- `requestContextPacketForTurn` ([contextRequest.ts:59-244](../../server/src/runtime/orchestration/contextRequest.ts)) obtains the packet **solely** via `input.contextManager.requestContextPacket(scope, request)` ([line 122](../../server/src/runtime/orchestration/contextRequest.ts)) — the injected port is the only data source — then validates with `consumeContextPacket`.
- `consumeContextPacket` ([consumption.ts:23-162](../../server/src/runtime/orchestration/consumption.ts)) is structural validation only ("performs NO retrieval, NO assembly, and NO persistence" — [lines 20-22](../../server/src/runtime/orchestration/consumption.ts)); it imports the validator, never the builder ([lines 2-4](../../server/src/runtime/orchestration/consumption.ts)).

A `complete` packet → `decision:'proceed'` ([consumption.ts:153-161](../../server/src/runtime/orchestration/consumption.ts)); a `degraded` packet → `decision:'degraded'` with packet retained ([lines 139-149](../../server/src/runtime/orchestration/consumption.ts)). Either path satisfies the adapter's Context-Manager-marker and candidate-exclusion checks.

**Caveat Agent B must honor:** `consumeContextPacket` also gates on `descriptor.supportedModes.includes(session.mode)` ([line 82](../../server/src/runtime/orchestration/consumption.ts)) and `descriptor.supportedLanguages.includes(language.primary)` ([line 93](../../server/src/runtime/orchestration/consumption.ts)). The packet's `session.mode` (e.g. `'browser_text'`) and `language.primary` (`'en'`/`'es'`) must be in Michael's registry descriptor, or the packet is rejected → `safe_close`. The turn source must set these from session identity, not guess.

### The S2.13 harness is replaceable

`runRuntimeTurnFixtureScenario` ([runtimeTurnHarness.ts:73-95](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts)) calls the **production** `coordinateRuntimeTurn` ([line 80](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts)) but injects a **fixture** port `createFixtureContextManager` ([lines 203-237](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts)) that **fabricates** a packet inline (`createFixtureContextPacket`, [lines 239-430](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts)) and **never calls `buildContextPacket`**. The only test-only parts are (a) the hardcoded fixture identity/IDs and (b) the inline fabricated packet. A production turn source replicates the non-test parts — call `coordinateRuntimeTurn` with a production port + session-derived identity, then assemble the `RuntimeTurnFixtureHarnessResult` wrapper as a plain object — and imports nothing from `fixtures/`.

### Where the route stands today

`POST /api/michael-runtime/resolve` ([michael-runtime.ts:52-154](../../server/src/routes/michael-runtime.ts)) reads `body.turn` ([line 90](../../server/src/routes/michael-runtime.ts)), casts it to `Partial<MichaelRuntimeAdapterContractInput>`, **forces** `identity.scope.baId = req.session.baId` ([lines 101-113](../../server/src/routes/michael-runtime.ts)), rejects body BA-authority fields `baId/sponsorBaId/targetBaId` ([lines 43, 79-88](../../server/src/routes/michael-runtime.ts)), and passes the result to the facade ([line 119](../../server/src/routes/michael-runtime.ts)). So today the **client** supplies the whole `runtimeTurn`; the server overrides only `baId`. That is exactly the turn-source blocker: a hand-authored flat turn fails the adapter's `consumption`/inert checks → `422`; a `200` only ever came from the harness.

### Where the UI stands today

`MichaelRuntimeSupportCard` ([MichaelRuntimeSupportCard.tsx:217-241](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx)) hardcodes `result = { kind: 'disabled' }` ([line 220](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx)) and never invokes the implemented, leak-free helper `resolveMichaelRuntimeTurn` ([lines 101-192](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx)) — deliberately, per the header turn-source blocker note ([lines 20-30](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx)). Prior reports: S3.8 §1 BLOCKER and §27 ([SPRINT_003_S3_8...](SPRINT_003_S3_8_TEAM_MICHAEL_RUNTIME_UI_PROPOSAL.md)) and S3.9 Condition A / Recommendation 1 ([SPRINT_003_S3_9...](SPRINT_003_S3_9_TEAM_MICHAEL_RUNTIME_UI_VERIFICATION.md)) both name the server-owned turn source as the single prerequisite to wiring the live call.

---

## The 12 questions

1. **Exact input `resolveMichaelRuntimeTurnResponse` requires.** `MichaelRuntimeAdapterContractInput` ([types.ts:470-478](../../server/src/runtime/orchestration/types.ts)): `{ identity, turnId, taskType:'training_support', runtimeTurn, turnClarity?, language?, intent? }`. Load-bearing field: `runtimeTurn: RuntimeTurnFixtureHarnessResult` whose `.result.consumption` must be a validated `ContextPacketConsumptionResult` and whose inert flags must all be `'disabled'`/`false`.

2. **Exact shape `POST /resolve` passes today.** It forwards the **client-supplied** `body.turn` (cast to `MichaelRuntimeAdapterContractInput`) with `identity.scope.baId` overwritten from `req.session.baId` ([michael-runtime.ts:90, 101-119](../../server/src/routes/michael-runtime.ts)). The server authors nothing else of the turn.

3. **What the UI currently lacks.** A client-safe producer of a valid `runtimeTurn`. The card stays disabled and never calls the (otherwise ready) helper ([MichaelRuntimeSupportCard.tsx:20-30, 101-192, 220](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx)).

4. **Does a production Context Manager API to assemble `context_packet.v1` for an authenticated BA exist?** **YES** — `buildContextPacket` ([contextManager.ts:163](../../server/src/runtime/context/contextManager.ts)). It takes already-assembled inputs (does **not** fetch from stores/retrieval), all knowledge inputs are optional, and it yields a valid packet from BA identity alone with empty knowledge. No store/retrieval/Gateway access exists in the function.

5. **Does a production runtime-turn builder exist?** **YES** — `coordinateRuntimeTurn` ([turnCoordinator.ts:17](../../server/src/runtime/orchestration/turnCoordinator.ts)), exported from the orchestration index. It needs `{identity, turnId, taskType, contextManager(port), requireSubstantive?, createdAt?}`; it does not build the packet itself and touches no store — the injected port is the sole data source.

6. **Server-owned turn source WITHOUT direct store access?** **YES.** `buildContextPacket` and `coordinateRuntimeTurn` are both store-free; the injected port calls `buildContextPacket` with empty knowledge.

7. **WITHOUT raw retrieval helpers?** **YES** — `buildContextPacket` performs no retrieval; an empty-knowledge packet is valid. Cost: no real approved knowledge → the honest packet is degraded/empty.

8. **WITHOUT Gateway fallback access?** **YES** — nothing on the `coordinateRuntimeTurn`/`buildContextPacket`/`consumeContextPacket` path calls the Gateway (`tripleStackWrite` is not on this path); persistence is `'disabled'` throughout.

9. **WITHOUT S2.13 harness imports?** **YES** — the harness only injects a fixture port that fabricates a packet inline ([runtimeTurnHarness.ts:203-430](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts)) and never calls `buildContextPacket`. The production turn source calls `coordinateRuntimeTurn` directly and builds the wrapper literal; the wrapper TYPE lives in `types.ts`, so the type import is not a harness import.

10. **WITHOUT exposing raw turn/packet to the client?** **YES** — the route builds the turn server-side from `req.session`; the client sends intent-only (or nothing). The response already returns only the fixture (+ optional redacted trace), and the UI maps only the safe display subset ([MichaelRuntimeSupportCard.tsx:147-206](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx)).

11. **Files Agent B should modify/add.**
    - **ADD** `server/src/runtime/orchestration/michaelRuntimeTurnSource.ts` (or a `services/` peer) exporting `createMichaelRuntimeTurnForAuthenticatedBa(session)` and a small production `ContextManagerRequestPort` backed by `buildContextPacket`.
    - **MODIFY** `server/src/routes/michael-runtime.ts` — derive the turn from `req.session` via the new turn source instead of trusting `body.turn`; keep the body-BA rejection and the three-axis kill switch; the request body becomes intent-only.
    - **(Optional, append-only) MODIFY** `server/src/runtime/orchestration/types.ts` — append a production-named twin of `RuntimeTurnFixtureHarnessResult`/`...ScenarioMetadata` if the "Fixture" naming is undesirable in production. Never edit existing exports.
    - **ADD** tests: a turn-source unit test (asserts store-free, `agentResponseGenerated:false`, `persistence:'disabled'`, `agentKey:'michael_magnificent'`, `taskType:'training_support'`, degraded → `safe_fallback`) plus a targeted body-BA-rejection canary (per S3.8 §26 / S3.9 Rec 2).
    - **MODIFY (separate gated UI slice)** `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` — invoke `resolveMichaelRuntimeTurn` (now with no/intent-only body) behind the existing route/response flags instead of the hardcoded disabled state.
    - **REUSE unchanged:** `contextManager.ts`, `turnCoordinator.ts`, `composition.ts`, `contextRequest.ts`, `consumption.ts`, the facade, and the catalog.

12. **What must be blocked if the correct primitives do not exist.** They **do** exist, so no compliant implementation is blocked for the degraded/fail-closed turn source. What **remains blocked/deferred:** real approved-knowledge enrichment (a `next_training_step` backed by *actually retrieved* knowledge) — it requires an approved Context-Manager retrieval path with sanctioned store access and must **not** be obtained via client fabrication, direct Mongo/Neo4j/Chroma/GraphRAG/Gateway calls, raw retrieval helpers, or the S2.13 harness. Separately, **emitting `packetStatus:'complete'` from an empty packet** (which would surface the substantive `next_training_step` fixture without any retrieval having occurred) is a **governance decision for Kevin**, not an engineering default — it contradicts the `no_active_retrieval_s1_5` guardrail and should not be shipped silently.

---

## Implementation outline for Agent B (compliant, minimal, fail-closed)

**Function:** `createMichaelRuntimeTurnForAuthenticatedBa(session)` — input is **the authenticated session BA identity only**.

1. **Derive identity** (server-authoritative; no body input): build `AgentRuntimeAdapterDispatchIdentity` = `{ scope: { tenantId, teamId, teamKey:'team_magnificent', teamName:'Team Magnificent', baId: session.baId }, sessionId, agentKey: 'michael_magnificent', mode: 'browser_text', language: session.language ?? 'en', correlationId, requestId }`. `baId` comes from `req.session.baId` only (sponsor immutability, locked-spec 3.5).
2. **Build a production `ContextManagerRequestPort`** `{ assembledBy: 'context_manager', async requestContextPacket(scope, request) { return buildContextPacket(mapToBuildInput(scope, request)) } }`. `mapToBuildInput` sets `tenant/team/ba/session/agentKey/language/objective/provenance` from `scope`+`request`, supplies **no** `approvedKnowledge`/references, sets `provenance.assembledBy:'context_manager'`, `provenance.componentVersion:'s1.5'`, and **`packetStatus:'degraded'`** (fail-closed: no active retrieval). Ensure `session.mode`/`language.primary` are in Michael's descriptor (see consumption caveat). No store/retrieval/Gateway call.
3. **Call the production coordinator:** `const result = await coordinateRuntimeTurn({ identity, turnId, taskType: 'training_support', contextManager: port, requireSubstantive: false, createdAt })`.
4. **Assemble the wrapper** (`RuntimeTurnFixtureHarnessResult` shape): `{ scenario, metadata: { ..., contextManagerInjected: true, persistence:'disabled', behavior:'not_implemented', agentResponseGenerated:false }, input, result, contextCalls: [], eventPersistence:'disabled', outcomePersistence:'disabled', guidedActionPersistence:'disabled', envelopePersistence:'disabled', behavior:'not_implemented', agentResponseGenerated:false }`.
5. **Return** `MichaelRuntimeAdapterContractInput = { identity, turnId, taskType:'training_support', runtimeTurn: wrapper, language: identity.language }`. The route passes this to `resolveMichaelRuntimeTurnResponse`.

**Expected resolution:** degraded packet → `consumption.decision:'degraded'` → adapter `safe_fallback` / degraded → facade resolves `michaelResponseFixtureSafeFallbackDegradedContextPacket` (EN) or its ES sibling. The UI renders the safe-fallback copy. Deterministic, leak-free, persistence-disabled.

**Invariants Agent B must preserve:** `agentKey:'michael_magnificent'`, `taskType:'training_support'`, `agentResponseGenerated:false`, all `*Persistence:'disabled'`, candidate/review-only knowledge excluded (`candidateKnowledgeExcluded:true`), no LLM, no voice, no `.com` exposure, BA scope session-derived only, and the three-axis kill switch unchanged. The substantive (`complete`) path stays behind a future, separately-gated, Kevin-approved retrieval slice.

---

### Cross-references
- [server/src/runtime/context/contextManager.ts](../../server/src/runtime/context/contextManager.ts) — `buildContextPacket` (pure assembler)
- [server/src/runtime/orchestration/turnCoordinator.ts](../../server/src/runtime/orchestration/turnCoordinator.ts) — `coordinateRuntimeTurn` (production builder)
- [server/src/runtime/orchestration/composition.ts](../../server/src/runtime/orchestration/composition.ts) · [contextRequest.ts](../../server/src/runtime/orchestration/contextRequest.ts) · [consumption.ts](../../server/src/runtime/orchestration/consumption.ts) — store-free composition path
- [server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts](../../server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts) · [michaelRuntimeResolutionFacade.ts](../../server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts) · [types.ts](../../server/src/runtime/orchestration/types.ts) — adapter/facade input contract
- [server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts](../../server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts) — S2.13 harness (replaceable; never calls `buildContextPacket`)
- [server/src/routes/michael-runtime.ts](../../server/src/routes/michael-runtime.ts) — current route (client-supplied turn)
- [apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx](../../apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx) — disabled card + ready helper
- [SPRINT_003_S3_8_TEAM_MICHAEL_RUNTIME_UI_PROPOSAL.md](SPRINT_003_S3_8_TEAM_MICHAEL_RUNTIME_UI_PROPOSAL.md) · [SPRINT_003_S3_9_TEAM_MICHAEL_RUNTIME_UI_VERIFICATION.md](SPRINT_003_S3_9_TEAM_MICHAEL_RUNTIME_UI_VERIFICATION.md) — turn-source blocker statements
