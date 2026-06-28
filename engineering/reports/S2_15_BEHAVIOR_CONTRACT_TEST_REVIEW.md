# S2.15 Behavior + Contract Test Review

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.15 Michael Runtime Adapter Contract Bridge (commit `b5ae8e1`, branch `feat/s2.15-michael-runtime-adapter-contract`)
- Status: VERIFICATION / REVIEW ONLY (no code, tests, routes, UI, `.com`, builds, LLMs, or DBs touched)
- Owner: Agent B
- Scope: confirm each required behavior mapping and contract guardrail for S2.15 is actually exercised by a test, with file:line citations.

## Method

Static read-only review of the in-scope test, adapter, contract, and fixture files. Per the closeout scope constraints (verification/reporting only, no builds/LLMs/DBs), I did NOT execute Vitest. Citations are line-anchored to the source as read at commit `b5ae8e1`.

## Evidence Reviewed

- `server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContract.test.ts` (behavior)
- `server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContractBoundary.test.ts` (boundary)
- `server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContractGuardrails.test.ts` (guardrails)
- `server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts` (adapter under test)
- `server/src/runtime/orchestration/michaelResponseContract.ts` (validator)
- `server/src/runtime/orchestration/fixtures/runtimeTurnHarness.ts`, `michaelRuntimeResponseHarness.ts`, `michaelRuntimeResponseScenarios.ts`, `michaelResponseFixtures.ts`, `index.ts` (input scenarios)

## Executive Verdict

PASS with minor, non-blocking carry-over notes.

All seventeen required confirmations except the explicitly-listed coverage gaps in section 17 are exercised by at least one named test. The adapter (`runMichaelRuntimeAdapterContract`) only ever returns a validated `michael_response_contract.v1` selected from controlled fixtures plus an inert summary; it never spreads raw packet/store/GraphRAG/Gateway/retrieval output, and the boundary suite asserts this recursively over the entire returned object. Persistence is `disabled` and `agentResponseGenerated` is `false` on every path. The slice remains inert (no routes, persistence, LLM, UI, `.com`, voice, or automatic actions).

The notes in section 17 are coverage-completeness observations (ES-language safe paths, defense-in-depth packet-level agent/task branches, clarity driven by input intent rather than packet content), not correctness failures.

## Confirmations

### 1. Complete clear training-support maps safely
Confirmed. `michaelRuntimeAdapterContract.test.ts:127` it('maps complete training support only to next_training_step or clarification_question') asserts `clear.michaelResponse.responseType === 'next_training_step'` (`:131`), `contextPacketStatus === 'complete'` (`:135`), validates and asserts inert (`:137-138`). Also `:116` it('accepts only michael_magnificent training_support for complete Context Packets'). Adapter path: `michaelRuntimeAdapterContract.ts:137-143` (`complete_clear_context` → `next_training_step`).

### 2. Complete ambiguous training-support maps safely
Confirmed. Same test `:129`/`:132` asserts `ambiguous.michaelResponse.responseType === 'clarification_question'`, status `complete`, validated and inert. Adapter path: `michaelRuntimeAdapterContract.ts:124-135` (`complete_ambiguous_context` → `clarification_question`).

### 3. Degraded packet maps to safe fallback or safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:186` it('returns only safe_fallback or safe_close for degraded, missing, and failed Context Packets') drives `accepted_degraded` → status `degraded`, asserts `responseType ∈ {safe_fallback, safe_close}` (`:196`), no `nextStep` (`:198`), validated + inert. Reinforced by guardrails `michaelRuntimeAdapterContractGuardrails.test.ts:232` it('returns no automatic action language for every safe-fallback runtime scenario') including `degraded_context_packet` (`:234-241`). Adapter path: `michaelRuntimeAdapterContract.ts:108-110`.

### 4. Missing context maps to safe fallback or safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:186` case `['missing_context_manager','missing']` asserts response ∈ {safe_fallback, safe_close} and status `missing`. Guardrails `:232` includes `missing_context_manager_boundary` (→ safe_fallback). Adapter path: `michaelRuntimeAdapterContract.ts:77-82` (`missing_context` → `safe_fallback`/`missing`).

### 5. Failed packet maps to safe fallback or safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:186` case `['failed_context','failed']`. Guardrails `:213` it('returns no nextStep for every safe-close runtime scenario') includes `failed_context_packet` and asserts `responseType === 'safe_close'`, `nextStep` undefined, validation ok (`:226-228`). Adapter path: `michaelRuntimeAdapterContract.ts:112-114` (`failed_context` → `safe_close`/`failed`).

### 6. Rejected packet maps to safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:204` it('returns only safe_close for rejected Context Packets') → `expectSafeClose` (asserts `responseType==='safe_close'`, `contextPacketStatus==='rejected'`, no `nextStep`, validated, inert; helper `:94-100`). Guardrails `:213` includes `rejected_context_packet`. Validator also enforces this: `michaelResponseContract.ts:350-358` (`rejected_context_requires_safe_close`).

### 7. Candidate / review-only maps to safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:177` it('rejects candidate/review-only packets with safe_close only') → `expectSafeClose` and asserts issue code `candidate_review_only` (`:183`). Guardrails `:245` it('returns no substantive training guidance for candidate/review-only runtime rejection') asserts `safe_close`, status `rejected`, no `nextStep`, and text fails the substantive-training pattern (`:250-254`). Adapter path: `michaelRuntimeAdapterContract.ts:104-106`, `262-271`.

### 8. Wrong agent maps to safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:142` it('rejects Steve, Ivory, and unknown agents with safe_close only') → `expectSafeClose` + issue code `wrong_agent` (`:148`). Guardrails `:213` includes `non_michael_agent` and `unknown_agent`. Adapter path: `michaelRuntimeAdapterContract.ts:60-62`.

### 9. Wrong task maps to safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:152` it('rejects every non-training_support task with safe_close only') iterates the six non-training task types (`:26-33`) → `expectSafeClose` + issue code `wrong_task` (`:157`). Guardrails `:213` includes `wrong_task_type`. Adapter path: `michaelRuntimeAdapterContract.ts:64-66`.

### 10. Unsupported language maps to safe close
Confirmed. `michaelRuntimeAdapterContract.test.ts:161` it('rejects unsupported language with safe_close only') (`language: 'fr'`) → `expectSafeClose` + issue code `unsupported_language` (`:165`). Guardrails `:213` includes `unsupported_language`. Adapter path: `michaelRuntimeAdapterContract.ts:68-70`, `146-153` (only `en`/`es` accepted).

### 11. Every returned response validates with `validateMichaelResponseContract(...)`
Confirmed. `michaelRuntimeAdapterContractBoundary.test.ts:191` it('validates every returned Michael response and keeps persistence disabled') iterates all 16 `adapterContractCases` (`:35-51`) and asserts `validateMichaelResponseContract(result.michaelResponse).ok === true` (`:195`). Additionally every behavior case in `michaelRuntimeAdapterContract.test.ts` runs `expectValidated` (`:77-80`). The adapter itself re-validates each fixture before returning (`michaelRuntimeAdapterContract.ts:285`, `416-423`).

### 12. Forbidden fields are blocked
Confirmed. Validator-direct: `michaelRuntimeAdapterContractGuardrails.test.ts:79` it('rejects every MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS value at the top level') → code `forbidden_field`; `:90` same nested under `nextStep` → path `nextStep.<field>`; `:105` explicitly covers `readinessClassification`, `medicalAdvice`, `threeAuthorityDecision`. Adapter-output: `michaelRuntimeAdapterContractBoundary.test.ts:209` it('never returns forbidden response-contract fields') asserts `collectForbiddenContractFields(result.michaelResponse) === []` across all cases. Validator logic: `michaelResponseContract.ts:361-391`.

### 13. Forbidden aliases are blocked
Confirmed. `michaelRuntimeAdapterContractGuardrails.test.ts:128` it('rejects alias and synonym fields for money, volume, placement, qualification, and call control') iterates `earningsProjection`, `compensationProjection`, `cvCalculation`, `placementGuarantee`, `prospectQualification`, `callControl` (`:15-22`); top-level yields `unexpected_field` and nested yields a path-anchored rejection. Validator logic: `michaelResponseContract.ts:65-72`, `377-380`.

### 14. Text-content guardrails are tested
Confirmed. `michaelRuntimeAdapterContractGuardrails.test.ts:148` it('scans allowed response text for prohibited claims and actions') runs seven prohibited-text cases (income, placement, cycle math, medical, THREE authority, prospect-facing, automatic action; `:24-53`) against `text`; `:160` scans `nextStep.label` and `nextStep.instruction`; `:191` keeps safe-fallback from carrying automatic-action language; `:201` keeps candidate/review-only from returning substantive training guidance. Boundary suite also asserts no raw boundary text in serialized output (`:88-101`, `:200`). Validator logic: `michaelResponseContract.ts:74-103`, `393-427`.

### 15. `nextStep` constraints are tested
Confirmed. `michaelRuntimeAdapterContract.test.ts:210` it('allows nextStep only for next_training_step and keeps the step BA-owned with no external side effects') asserts `nextStep` matches `{baOwned:true, automaticSending:false, automaticCalling:false, externalSideEffect:false}` (`:214-219`) and that all non-next-step paths omit `nextStep` (`:230-235`). `michaelRuntimeAdapterContractBoundary.test.ts:217` it('safe-close and safe-fallback paths never include nextStep') enforces this across all cases. Guardrails `:184` it('keeps safe-close responses from carrying nextStep') → code `next_step_not_allowed`; runtime `:213` asserts `nextStep` undefined for every safe-close scenario. Validator logic: `michaelResponseContract.ts:274-327`.

### 16. No raw Context Packet / store / GraphRAG / Gateway / retrieval output is returned
Confirmed. `michaelRuntimeAdapterContractBoundary.test.ts:200` it('never returns raw Context Packet, store, GraphRAG, Gateway, or retrieval output') recursively collects every key/value of both `result` and `result.michaelResponse` and asserts none match the forbidden-key list (`:53-86`: incl. `rawContextPacket`, `contextPacket`, `packet`, `contextRequestResult`, `consumption`, `approvedKnowledge`, `retrievalAudit`, `rawRetrievalResults`, `rawStoreResults`, `mongoResult`/`neo4jResult`/`chromaResult`, `rawGraphRagResults`, `rawGatewayFallbackResponse`, etc.), and that the JSON-serialized output contains none of the forbidden text markers (`:88-101`: `context_packet.v1`, `MongoDB`, `Neo4j`, `ChromaDB`, `GraphRAG`, `Gateway fallback`, `rawStoreResults`, `rawGraphRagResults`, `rawGatewayFallbackResponse`, `rawRetrieval`). This is asserted over all 16 cases (`:201-206`). Corroborated by source: the adapter returns only `validation.contract` plus an inert, hand-built summary (`michaelRuntimeAdapterContract.ts:294-318`, `339-354`) — it never spreads the raw `runtimeTurn.result`, `consumption`, or `packet`.

### 17. Missing test coverage (gaps and notes)

These are completeness observations, not correctness failures. None block S2.15 as an inert contract bridge; all are candidates for the next slice.

- **ES-language safe paths are not asserted.** `fixtureFor` returns English safe-fallback/safe-close fixtures regardless of language (`michaelRuntimeAdapterContract.ts:377-386`), and no test drives a Spanish (`es`) identity through a degraded/missing/failed/rejected scenario to assert an ES safety response. Only `next_training_step`/`clarification_question` have ES fixtures. This is the same EN-only safe-path gap flagged in the S2.14 review and remains open.
- **Packet-level agent/task mismatch branches are not directly exercised.** The defense-in-depth checks at `michaelRuntimeAdapterContract.ts:89-95` (`consumption.packetAgentKey`/`consumption.taskType` mismatch) are unreachable in the current tests because the identity-level gates at `:60-66` fire first; wrong-agent/wrong-task coverage is via identity, not via a consumption packet whose embedded agent/task disagrees with a valid Michael identity.
- **`reasonFromIssueCodes` branches are not all covered.** Issue-code-driven mappings such as `assembler_not_context_manager`, `context_manager_request_failed`, `invalid_agent`/`agent_mismatch`, `invalid_objective`/`objective_not_allowed`, and `language_not_supported` (`michaelRuntimeAdapterContract.ts:209-254`) are not individually asserted via crafted runtime-turn issue codes; the `missing_*` and `candidate_*` codes are the ones reachable through current fixtures.
- **Clarity is input-driven, not packet-derived.** Clear-vs-ambiguous selection is decided by `input.intent` / `input.turnClarity` (`michaelRuntimeAdapterContract.ts:124-135`), and the behavior tests set `intent` directly. Acceptable for an inert fixture bridge, but no test proves clarity is inferred from packet content (there is no such logic yet) — worth flagging so it is not mistaken for runtime intent detection.
- **`withNonContextManagerAssembly` (non-Context-Manager assembly) and `selectedFixtureKey` mapping** are exercised indirectly (`michaelRuntimeAdapterContract.test.ts:168-175` asserts the `non_context_manager` issue code), but the `non_context_manager` rejection is not in the seventeen required confirmations; noting it here as additional boundary coverage that exists.

## Inertness Cross-Check

Every path asserted inert: `behavior === 'not_implemented'`, `agentResponseGenerated === false`, and all of `eventPersistence`/`outcomePersistence`/`guidedActionPersistence`/`envelopePersistence`/`responsePersistence`/`michaelResponse.persistence === 'disabled'` via `expectReturnedOnly` (`michaelRuntimeAdapterContract.test.ts:82-92`) and `expectSafeDisabled` (`michaelRuntimeAdapterContractBoundary.test.ts:178-188`). Source mirrors this with hardcoded `'disabled'` / `false` literals (`michaelRuntimeAdapterContract.ts:308-316`).

## Bottom Line

PASS. Confirmations 1-16 are each exercised by at least one named test with the citations above; the adapter provably emits only validated contract output and no raw boundary data. The only open items (section 17) are coverage-completeness notes — chiefly ES safe-path coverage and a few unreachable defense-in-depth branches — none of which undermine the inert S2.15 contract bridge.
