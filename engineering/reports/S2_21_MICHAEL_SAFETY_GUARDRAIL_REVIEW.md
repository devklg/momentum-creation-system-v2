# S2.21 Michael Safety Guardrail Review

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: REVIEW / VERIFICATION ONLY
- Owner: Agent B
- Branch: review/s2.21-michael-readiness-decision-gate
- Scope: review the completed Michael inert runtime chain (response contract, adapter contract, catalog, catalog selector, selection-request derivation, resolution facade) for safety, guardrails, and response constraints

## Executive Verdict

SAFE as an inert, returned-only chain. Every confirmation item (1-23) is enforced in code, and the great majority are pinned by guardrail or governance-boundary tests. The chain generates no text dynamically, returns pre-authored fixtures by reference, keeps persistence disabled and `agentResponseGenerated` false everywhere, and emits a trace that is explicitly constructed from redacted metadata only.

Residual gaps (item 24) are real but bounded and consistent with an inert slice: the prohibited-text regex scanner is English-lexicon-only, the safe-close substantive-text guard is English-only, and Spanish substantive/safe-path copy relies on fixture authoring rather than regex enforcement. These are content-safety observations, not wiring defects. They do not block the readiness gate but should be named in the decision-gate record and addressed before any live (non-fixture) Spanish generation is ever enabled.

This is a governance/verification finding only. Nothing here approves routes, persistence, LLM calls, voice, Telnyx/PSTN, `.com`, UI, or generated-response activation.

## Evidence Reviewed

- `server/src/runtime/orchestration/michaelResponseContract.ts`
- `server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts`
- `server/src/runtime/orchestration/michaelResponseCatalog.ts`
- `server/src/runtime/orchestration/michaelResponseCatalogSelector.ts`
- `server/src/runtime/orchestration/michaelResponseSelectionRequest.ts`
- `server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts`
- `server/src/runtime/orchestration/fixtures/michaelResponseFixtures.ts`
- `server/src/runtime/orchestration/__tests__/michaelResponseGuardrails.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContractGuardrails.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelRuntimeAdapterContractEsSafePaths.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelRuntimeResolutionFacadeTrace.test.ts`
- `server/src/runtime/orchestration/__tests__/s220MichaelRuntimeResolutionFacadeGovernanceBoundary.test.ts`

No builds, LLMs, or databases were run; static read-only review only.

## 1. Only four response types approved

Confirmed. `RESPONSE_TYPES = ['next_training_step','clarification_question','safe_fallback','safe_close']` at `michaelResponseContract.ts:9-14`, enforced via `expectEnum(candidate,'responseType',RESPONSE_TYPES,...)` at `michaelResponseContract.ts:171`. The selector independently declares the identical `KNOWN_RESPONSE_TYPES` at `michaelResponseCatalogSelector.ts:16-21` and rejects unknown types (`invalid_response_type`) at `:79-81`. The catalog partitions these into substantive (`michaelResponseCatalog.ts:29-32`) and safe-path (`:34-37`) sets only.

## 2. Only michael_magnificent accepted

Confirmed. Contract literal `MICHAEL_RESPONSE_AGENT_KEY='michael_magnificent'` (`michaelResponseContract.ts:27`), enforced `expectLiteral(candidate,'agentKey','michael_magnificent',...)` at `:172`. Adapter rejects any other agent to `safe_close/rejected` at `michaelRuntimeAdapterContract.ts:70-72` and again on packet-derived agent at `:99-101`. Selector rejects with `wrong_agent` at `michaelResponseCatalogSelector.ts:67-69`. Catalog validation re-checks at `michaelResponseCatalog.ts:162-168`. Tested: ES safe-path #8 (`michaelRuntimeAdapterContractEsSafePaths.test.ts:230-239`) asserts `steve_success` -> Spanish `safe_close` + `wrong_agent`.

## 3. Only training_support accepted

Confirmed. `MICHAEL_RESPONSE_TASK_TYPE='training_support'` (`michaelResponseContract.ts:29`), enforced at `:173`. Adapter rejects wrong task to `safe_close/rejected` at `michaelRuntimeAdapterContract.ts:74-76` and on packet-derived task at `:103-105`. Selector `wrong_task` at `michaelResponseCatalogSelector.ts:71-73`. Catalog validation at `michaelResponseCatalog.ts:170-176`. Tested: ES #6/#7 (`...EsSafePaths.test.ts:208-228`) covers `success_interview`, `relationship_coaching`, `invitation_drafting`, `journal_teaching` -> `safe_close` + `wrong_task`.

## 4. Only EN/ES accepted for substantive supported-language flow

Confirmed. Contract `expectEnum(candidate,'language',['en','es'],...)` at `michaelResponseContract.ts:178`. Adapter `SUPPORTED_LANGUAGES=['en','es']` (`michaelRuntimeAdapterContract.ts:31`) with `resolveLanguage()` returning a supported value or `undefined` at `:156-163`. Selector enforces EN/ES at `michaelResponseCatalogSelector.ts:15,75-77`.

## 5. Unsupported language cannot produce substantive guidance

Confirmed. `resolveLanguage()` returns `undefined` for non-EN/ES (`michaelRuntimeAdapterContract.ts:156-163`); when `!language` the adapter returns `safe_close/rejected` with the language-neutral English safe fixture (`safeLanguage = language ?? 'en'`, `:68`; branch `:78-80`). Substantive types are only reachable on the `complete` paths at `:134-153`, which are only entered after the language guard passes. Tested: `...EsSafePaths.test.ts:251-261` (#10) drives `fr` -> `safe_close`, `nextStep` undefined, no substantive-training text, `unsupported_language` issue.

## 6. Candidate/review-only cannot produce substantive guidance

Confirmed. `hasCandidateReviewOnlyContext()` (`michaelRuntimeAdapterContract.ts:272-281`) treats context as candidate/review-only unless `candidateKnowledgeIncluded===false` AND `candidateKnowledgeExcluded===true` (fail-closed default), routing to `safe_close/rejected` at `:114-116`. Issue-code mapping for `candidate_*` codes at `:238-249`. Tested: contract guardrail (`michaelResponseGuardrails.test.ts:78-91`), adapter guardrail (`michaelRuntimeAdapterContractGuardrails.test.ts:245-255` asserts `safe_close`, status `rejected`, no `nextStep`, no substantive text), ES #4/#5 (`...EsSafePaths.test.ts:189-206`).

## 7. Rejected context maps to safe close

Confirmed. Contract `validateContextPacketStatusBehavior()` forces `rejected -> safe_close` (`michaelResponseContract.ts:350-358`, code `rejected_context_requires_safe_close`), and bars substantive on failed/missing/rejected at `:336-348`. Adapter maps `decision==='reject'` to `safe_close/rejected` at `michaelRuntimeAdapterContract.ts:126-128`. Selector only maps `rejected|safe_close` (`michaelResponseCatalogSelector.ts:41`).

## 8. Failed context maps to safe close

Confirmed (adapter). Adapter maps `decision==='block_substantive'` or `packetStatus==='failed'` to `safe_close` with context kind `failed` at `michaelRuntimeAdapterContract.ts:122-124`. Selector only maps `failed|safe_close` (`michaelResponseCatalogSelector.ts:40`). Tested: ES #3 (`...EsSafePaths.test.ts:178-187`). Note: the *contract* validator permits failed -> `safe_fallback` OR `safe_close` (`michaelResponseContract.ts:336-348`); the adapter is stricter and always closes on failed, so the chain behavior is safe-close.

## 9. Missing/degraded maps to safe fallback or safe close

Confirmed. Adapter: `missing_context` -> `safe_fallback/missing` at `michaelRuntimeAdapterContract.ts:88-92`; `degraded` (`decision==='degraded'` or `packetStatus==='degraded'`) -> `safe_fallback/degraded` at `:118-120`. Other missing-context-manager collapse paths land on `safe_close` via `:82-85`. Selector maps `degraded|safe_fallback` and `missing|safe_fallback` (`michaelResponseCatalogSelector.ts:38-39`). Tested: ES #1/#2 (`...EsSafePaths.test.ts:156-176`).

## 10. Complete context required for substantive responses

Confirmed. Substantive types (`next_training_step`, `clarification_question`) are returned only after `packetStatus==='complete'` passes the guard at `michaelRuntimeAdapterContract.ts:130-132` (any non-complete falls to `safe_close`), then branched at `:134-153`. Contract independently blocks substantive on non-complete failed/missing/rejected (`michaelResponseContract.ts:336-348`). Selector only maps `complete|next_training_step` and `complete|clarification_question` (`michaelResponseCatalogSelector.ts:36-37`). Tested: `michaelResponseGuardrails.test.ts:93-104` (`substantive_response_not_allowed` on failed/rejected).

## 11. nextStep is BA-owned only

Confirmed. `validateNextStep()` (`michaelResponseContract.ts:274-327`): `nextStep` allowed only when `responseType==='next_training_step'` (rejected otherwise, `:281-292`), required there (`:294-303`), and must satisfy `baOwned===true` (`:323`), `automaticSending===false` (`:324`), `automaticCalling===false` (`:325`), `externalSideEffect===false` (`:326`). Fixtures comply (`fixtures/michaelResponseFixtures.ts:71-80,89-98`). Catalog bars `nextStep` on safe-path entries (`michaelResponseCatalog.ts:194-200`). Tested: `michaelRuntimeAdapterContractGuardrails.test.ts:184-189` (safe-close + nextStep -> `next_step_not_allowed`), and `:213-230` (no `nextStep` on any safe-close scenario).

## 12. No automatic sending/calling/scheduling/prospecting (text + field guards)

Confirmed. Field guards: forbidden fields `sendMessage,callProspect,scheduleCall,autoSend,autoCall,automaticProspecting` (`michaelResponseContract.ts:49-54`) plus alias `callControl` (`:71`), rejected at any depth via `collectForbiddenFieldIssues()` (`:361-391`). Text guard: `automatic_action` regex (`:99-102`) applied to `text`, `nextStep.title/instruction/label` (`:183,320-322,393-410`). nextStep literal guards (item 11). Tested: `michaelResponseGuardrails.test.ts:53-64`; `michaelRuntimeAdapterContractGuardrails.test.ts:148-158,160-182,191-199`; facade static scan #23 (`s220...GovernanceBoundary.test.ts:384-389`).

## 13. No scoring/ranking/classification/qualification

Confirmed. Forbidden fields `score,rank,classification,readinessClassification,qualification,prediction` (`michaelResponseContract.ts:33-38`) plus alias `prospectQualification` (`:70`); `leadQualification` (`:51`). Tested: `michaelResponseGuardrails.test.ts:30-34`; `michaelRuntimeAdapterContractGuardrails.test.ts:79-126` (table-driven over the full forbidden-field constant + explicit `readinessClassification`); facade static scan #24 (`s220...GovernanceBoundary.test.ts:391-398`).

## 14. No income/compensation/cycle math/placement promises

Confirmed. Forbidden fields `incomeProjection,commissionEstimate,cycleMath,placementPromise` (`michaelResponseContract.ts:41-44`) plus aliases `earningsProjection,compensationProjection,cvCalculation,placementGuarantee` (`:66-69`). Text guards: `income_claim` (`:75-78`, incl. `$\d`), `placement_promise` (`:79-82`), `cycle_math` (`:83-86`). Tested: `michaelResponseGuardrails.test.ts:36-45`; prohibited-text cases in `michaelRuntimeAdapterContractGuardrails.test.ts:24-53,148-158`; facade scan #25 (`s220...GovernanceBoundary.test.ts:400-405`).

## 15. No medical advice

Confirmed. Forbidden field `medicalAdvice` (`michaelResponseContract.ts:47`); text guard `medical_advice` regex (`:87-90`). Tested explicitly: `michaelRuntimeAdapterContractGuardrails.test.ts:105-126` (field) and `:37-40,148-158` (text "Stop taking your medication...").

## 16. No THREE authority claims

Confirmed. Forbidden field `threeAuthorityDecision` (`michaelResponseContract.ts:48`); text guard `three_authority` regex (`:91-94`). Tested: `michaelRuntimeAdapterContractGuardrails.test.ts:105-126` (field) and `:41-44,148-158` (text "THREE has approved...").

## 17. No knowledge approval

Confirmed. Forbidden field `knowledgeApproval` (`michaelResponseContract.ts:55`). Tested: `michaelResponseGuardrails.test.ts:66-76`. Facade static scan #26 bars knowledge-approval call shapes (`s220...GovernanceBoundary.test.ts:407-411`).

## 18. No raw Context Packet leakage (facade returns fixture + redacted trace only)

Confirmed. `buildTrace()` is constructed explicitly from `selectionRequest` metadata and the catalog key only — it never spreads the response or packet (`michaelRuntimeResolutionFacade.ts:53-73`), and the response is returned BY REFERENCE as the pre-authored fixture (`:118-119`). Tested: trace spec forbids `packet/contextPacket/retrievalAudit` keys anywhere in the serialized trace (`michaelRuntimeResolutionFacadeTrace.test.ts:84,202-207`) and the facade governance spec #31 re-checks (`s220...GovernanceBoundary.test.ts:478-518`).

## 19. No raw retrieval/store/GraphRAG/Gateway leakage

Confirmed. Forbidden response fields `rawStoreResults,rawGraphRagResults,rawGatewayFallbackResponse` (`michaelResponseContract.ts:57-59`). Trace allowlist (`buildTrace`, `michaelRuntimeResolutionFacade.ts:53-73`) excludes all store keys. Tested: trace spec forbids `retrieval/rawRetrieval/candidateKnowledge` and `mongo/neo4j/chroma/graphRag/gateway/raw*` keys (`michaelRuntimeResolutionFacadeTrace.test.ts:85-96,209-223`); facade static import scans #1-#9 bar store/GraphRAG/Gateway/retrieval imports and Context-Packet assembly (`s220...GovernanceBoundary.test.ts:185-266`).

## 20. No token/request/session/correlation/prospect PII leakage in trace

Confirmed. The trace exposes only `classification, selectionRequest, catalogKey, responseType, contextPacketStatus, language, persistence, agentResponseGenerated` (`michaelRuntimeResolutionFacade.ts:56-72`); `selectionRequest` itself carries only agentKey/taskType/language/responseType/scenarioFamily/contextPacketStatus/intent (`michaelResponseSelectionRequest.ts:48-58`). No sessionId/turnId/correlationId/contextPacketId is copied into the trace. Tested: trace spec forbids `token/requestId/sessionId/correlationId/turnId/email/phone/prospect` (`michaelRuntimeResolutionFacadeTrace.test.ts:98-107,233-239`) and asserts the trace key allowlist (`:53-62,167-179`); facade #31 repeats (`s220...GovernanceBoundary.test.ts:489-517`).

## 21. All responses validate with validateMichaelResponseContract(...)

Confirmed. Adapter validates the selected fixture before returning and throws if invalid (`michaelRuntimeAdapterContract.ts:294-295,448-455`). Catalog validates every entry (`michaelResponseCatalog.ts:146-208`). Selector re-validates the resolved entry defensively (`michaelResponseCatalogSelector.ts:141-147`). Facade re-validates after selection (`michaelRuntimeResolutionFacade.ts:105-111`). Tested: ES #11 (`...EsSafePaths.test.ts:263-270`) validates every Spanish safe-path response; trace cases all resolve `ok`.

## 22. All persistence remains disabled

Confirmed. Contract `expectLiteral(candidate,'persistence','disabled',...)` (`michaelResponseContract.ts:180`). Adapter sets every persistence channel to `'disabled'` (`michaelRuntimeAdapterContract.ts:318-324`) and `findInertRuntimeIssue()` rejects any runtime turn whose event/outcome/guided-action/envelope persistence is not disabled (`:165-198`). Catalog checks `persistence!=='disabled'` (`michaelResponseCatalog.ts:178-184`). Facade trace `persistence:'disabled'` (`michaelRuntimeResolutionFacade.ts:70`). Tested: ES #13 (`...EsSafePaths.test.ts:284-297`); facade #28 source + runtime (`s220...GovernanceBoundary.test.ts:433-444`).

## 23. agentResponseGenerated remains false

Confirmed. Contract `expectLiteral(candidate,'agentResponseGenerated',false,...)` (`michaelResponseContract.ts:182`). Adapter sets `agentResponseGenerated:false` (`michaelRuntimeAdapterContract.ts:326`) and rejects turns where it is not false (`:170-187`). Catalog checks it (`michaelResponseCatalog.ts:186-192`). Facade trace `agentResponseGenerated:false` (`michaelRuntimeResolutionFacade.ts:71`). Tested: ES #12 (`...EsSafePaths.test.ts:272-282`); facade #27 source + runtime + trace (`s220...GovernanceBoundary.test.ts:413-431`).

## 24. Remaining guardrail gaps (honest)

These are content-safety observations on an otherwise-inert chain; none is a wiring breach.

- **Prohibited-text scanner is English-lexicon-only.** `PROHIBITED_TEXT_PATTERNS` (`michaelResponseContract.ts:74-103`) match English keywords (income, commission, placement, cycle, medical advice, THREE approved, prospect, auto-send, etc.). Numeric/currency triggers (`$\d`, `make \$?\d`) are language-agnostic, but Spanish lexical equivalents (e.g. *ingresos, ganancias, comisión, colocación garantizada, consejo médico, envía al prospecto*) are not in the regex set. Spanish text safety therefore rests on the regex catching only a subset.
- **Safe-close substantive-text guard is English-only.** `SAFE_CLOSE_SUBSTANTIVE_TRAINING_PATTERN` (`michaelResponseContract.ts:105-106`) matches English verbs+nouns (open/review/practice/complete/start/continue + module/lesson/training/script/next step). A Spanish safe-close that embedded substantive guidance (e.g. *abre el módulo*) would not be caught by regex; the ES safe-close fixtures are correctly authored to avoid this (`fixtures/michaelResponseFixtures.ts:176-193`) and ES test #16 (`...EsSafePaths.test.ts:321-335`) only asserts the English pattern is absent — so the guarantee for ES is fixture-authoring, not regex enforcement.
- **Spanish substantive copy relies on fixture authoring.** The `es` `next_training_step` / `clarification_question` fixtures (`fixtures/michaelResponseFixtures.ts:82-98,109-116`) pass validation because the English regexes do not flag compliant Spanish prose; their compliance is guaranteed by hand-authoring + governance review, not by an ES content scanner. This is acceptable for an inert, fixed catalog but must be revisited before any live Spanish generation.
- **Catalog text IS regex-scanned** (no gap): every catalog entry runs through `validateMichaelResponseContract` (`michaelResponseCatalog.ts:151`), which calls `validateTextContent` on `text` and each `nextStep` text field — so the catalog cannot ship text that trips the (English) scanner. The limitation is purely the scanner's lexical coverage, per the points above.
- **Failed-context strictness is adapter-enforced, not contract-enforced.** The contract permits failed -> `safe_fallback` or `safe_close` (`michaelResponseContract.ts:336-348`); only the adapter guarantees failed -> `safe_close` (`michaelRuntimeAdapterContract.ts:122-124`). Any future direct contract consumer that bypasses the adapter could legitimately emit a failed-context `safe_fallback`. Not a defect today (the chain always routes through the adapter), but worth recording.
- **candidate/review-only detection is heuristic on packet audit flags.** `hasCandidateReviewOnlyContext` (`michaelRuntimeAdapterContract.ts:272-281`) fails closed (treats missing/ambiguous audit as review-only), which is the safe direction, but it depends on upstream `retrievalAudit` flags being populated truthfully; there is no independent content inspection of the packet itself (consistent with the no-raw-packet-access design).

## Confirmation Summary

| # | Item | Status |
|---|------|--------|
| 1 | Four response types only | Confirmed |
| 2 | michael_magnificent only | Confirmed |
| 3 | training_support only | Confirmed |
| 4 | EN/ES only (substantive) | Confirmed |
| 5 | Unsupported language -> no substantive | Confirmed |
| 6 | Candidate/review-only -> no substantive | Confirmed |
| 7 | Rejected -> safe close | Confirmed |
| 8 | Failed -> safe close (adapter) | Confirmed |
| 9 | Missing/degraded -> safe fallback/close | Confirmed |
| 10 | Complete required for substantive | Confirmed |
| 11 | nextStep BA-owned, next_training_step only | Confirmed |
| 12 | No automatic send/call/schedule/prospect | Confirmed |
| 13 | No scoring/ranking/classification/qualification | Confirmed |
| 14 | No income/comp/cycle/placement | Confirmed |
| 15 | No medical advice | Confirmed |
| 16 | No THREE authority claims | Confirmed |
| 17 | No knowledge approval | Confirmed |
| 18 | No raw Context Packet leakage | Confirmed |
| 19 | No raw retrieval/store/GraphRAG/Gateway leakage | Confirmed |
| 20 | No token/session/correlation/PII in trace | Confirmed |
| 21 | All responses validate | Confirmed |
| 22 | Persistence disabled everywhere | Confirmed |
| 23 | agentResponseGenerated false everywhere | Confirmed |
| 24 | Residual gaps | Documented (EN-only text scanner; ES relies on fixture authoring; failed-strictness adapter-only) |

This report is verification-only. The final S2.21 decision-gate report is owned by Agent E.
