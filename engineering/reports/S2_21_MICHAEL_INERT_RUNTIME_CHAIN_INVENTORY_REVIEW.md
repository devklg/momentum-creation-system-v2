# S2.21 Michael Inert Runtime Chain Inventory Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.21 Michael Readiness Decision Gate — readiness review (Agent A: inert runtime chain inventory)
- Status: REVIEW / VERIFICATION ONLY (no production code, tests, routes, UI, or `.com` modified; no builds, LLMs, or database access by this report)
- Architecture version: v1.0 frozen
- Date: 2026-06-28
- Reviewer: Agent A (S2.21 readiness review — inventory of the completed S2.11–S2.20 Michael inert runtime chain)
- Branch: `review/s2.21-michael-readiness-decision-gate`
- Source of truth: working tree under `server/src/runtime/orchestration/`, cross-checked against `engineering/reports/SPRINT_002_S2_11..S2_20`

## 1. Executive Result

**CHAIN COMPLETE — PASS.**

Every link in the governance-approved inert Michael runtime chain is present, exported, and contract-validated end to end:

> Context Packet → Runtime Turn → Michael Adapter Contract → Selection-Request Derivation → Catalog Selector → Catalog Entry → Validated Michael Response Fixture → Inert Resolution Facade → Redacted Trace.

The chain is pure, returned-only, route-free, non-persistent, and LLM-free. Every persistence discriminant on every result is the literal `'disabled'`; `agentResponseGenerated` is the literal `false`; fixtures are pre-authored verbatim text (no dynamic generation); the resolution facade returns the fixture **by reference** and builds a trace from controlled metadata only (never spreading the response). EN + ES coverage is symmetric across all four allowed response types and all five Context Packet scenario families.

One honest finding (§15): the S2.13 scenario-driven fixture harness (`michaelRuntimeResponseHarness.ts` / `michaelRuntimeResponseScenarios.ts`) is a **parallel, earlier surface** that maps a scenario name directly to a fixture key, bypassing the S2.17–S2.20 catalog/selector/derivation/facade chain. It is fully tested and inert — not dead code — but it is a duplicate resolution path that the decision gate should consciously keep or retire. No other gaps.

## 2. Chain Inventory (numbered, with evidence)

### 1. Michael first activation charter exists

`engineering/reports/SPRINT_002_S2_11_MICHAEL_FIRST_ACTIVATION_CHARTER.md` — present. Executive Verdict "PASS WITH CONDITIONS" (line 10); "Status: PLANNING / GOVERNANCE ONLY" (line 5); §3 confirms "no runtime activation occurred" / "Michael remains behavior-not-implemented" (lines 31-33); §4 states the activation objective (lines 37-39). Companion S2.11 reviews also present: `S2_11_MICHAEL_ACTIVATION_SCOPE_CHARTER.md`, `S2_11_MICHAEL_RESPONSE_CONTRACT_REVIEW.md`, `S2_11_MICHAEL_ROUTE_SURFACE_FEATURE_FLAG_REVIEW.md`, `S2_11_MICHAEL_QA_MONITORING_ROLLBACK_REVIEW.md`.

### 2. Michael response contract exists

`server/src/runtime/orchestration/michaelResponseContract.ts`:
- `validateMichaelResponseContractV1` (line 147) + public alias `validateMichaelResponseContract` (line 218).
- Schema version constant `MICHAEL_RESPONSE_CONTRACT_SCHEMA_VERSION = 'michael_response_contract.v1'` (lines 24-25), pinned in the validator via `expectLiteral(... 'schemaVersion' ...)` (lines 165-170).
- Scope literals `MICHAEL_RESPONSE_AGENT_KEY = 'michael_magnificent'` (line 27), `MICHAEL_RESPONSE_TASK_TYPE = 'training_support'` (line 29).
- Assertion + guard helpers: `assertMichaelResponseContractV1` (224), `assertValidMichaelResponseContract` (233), `isMichaelResponseContractV1` (239), `MichaelResponseValidationError` (245).
- Defense-in-depth: forbidden-field list incl. `score`/`prospectFacingMessage`/`autoSend` (lines 33-72), prohibited text patterns for income/placement/cycle/medical/THREE-authority/prospect-facing/automatic-action (lines 74-103), `safe_close` substantive-guidance ban (lines 105-106, 412-427), `persistence: 'disabled'` and `agentResponseGenerated: false` pinned (lines 180-182).

### 3. Michael response fixtures exist (EN + ES sets)

`server/src/runtime/orchestration/fixtures/michaelResponseFixtures.ts`. All built from `baseFixture` (line 15) which hardcodes `persistence: 'disabled'` and `agentResponseGenerated: false` (lines 34, 36). `validMichaelResponseFixtures` array enumerates all 12 valid fixtures (lines 225-238); `invalidMichaelResponseFixtures` enumerates the 6 negative fixtures (lines 240-247); `michaelResponseFixtures` keyed map + `michaelResponseFixtureEntries` (lines 249-283). See §10 for the EN/ES pairing.

### 4. Michael runtime adapter contract exists

`server/src/runtime/orchestration/michaelRuntimeAdapterContract.ts` — `runMichaelRuntimeAdapterContract` (line 57). Classifies the runtime turn into a `SelectionReason` (lines 43-55) and routes to a validated fixture via `selectResponse` (line 283) → `fixtureFor` (366) / `fixtureKeyFor` (409) / `validateFixture` (448, throws if a controlled fixture ever fails validation). Output pins every persistence field to `'disabled'`, `behavior: 'not_implemented'`, `agentResponseGenerated: false` (lines 318-326). Inert-runtime guard `findInertRuntimeIssue` rejects any turn where persistence/agentResponseGenerated drifted (lines 165-198).

### 5. Michael response catalog exists (12 entries)

`server/src/runtime/orchestration/michaelResponseCatalog.ts` — `MICHAEL_RESPONSE_CATALOG` (line 78), exactly **12 `entry(...)` rows** (lines 79-109): 2 next_training_step + 2 clarification_question + 2 safe_fallback_degraded + 2 safe_fallback_missing + 2 safe_close_failed + 2 safe_close_rejected (EN/ES each). Accessors `listMichaelResponseCatalogEntries` (116), `listMichaelResponseCatalogKeys` (121), `getMichaelResponseCatalogEntry` (129), `hasMichaelResponseCatalogEntry` (136), validator `validateMichaelResponseCatalog` (146, returns `entryCount` from `MICHAEL_RESPONSE_CATALOG.length`). Each entry is the fixture verbatim (`response` field) with descriptive-only metadata; `allowedForFirstMichaelSlice: true` is documented as "descriptive metadata only — nothing is activated" (lines 66-68).

### 6. Michael catalog selector exists

`server/src/runtime/orchestration/michaelResponseCatalogSelector.ts` — `selectMichaelResponseCatalogEntry` (line 62, pure discriminated result), plus `selectMichaelResponseCatalogKey` (156), `validateMichaelResponseCatalogSelection` (167), `selectionRequestForCatalogKey` (178), and `MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS` (198). Resolution is via the explicit `CATALOG_KEY_BASE_BY_COMBINATION` table of the 6 valid `(scenarioFamily|responseType)` pairs (lines 35-42); any pair outside the table returns `invalid_combination` (lines 117-127). Returns the catalog object verbatim, never copies/edits/regenerates (revalidates defensively at lines 141-147).

### 7. Michael selection-request derivation exists

`server/src/runtime/orchestration/michaelResponseSelectionRequest.ts` — `deriveMichaelResponseCatalogSelectionRequestFromAdapterContractInput` (line 38), `deriveMichaelResponseCatalogSelectionRequestFromRuntimeTurn` (89), primary alias `deriveMichaelResponseCatalogSelectionRequest` (135). Derivation runs the already-inert adapter contract and reads only `responseType` / `contextPacketStatus` / `language` from the resolved response (lines 41-58), guaranteeing request and response can never diverge; defensively re-validates the derived request through the selector (lines 63-76). Runtime-turn entry point returns deterministic `missing_identity` / `missing_turn_id` / `missing_task_type` issues rather than throwing (lines 97-116).

### 8. Michael inert resolution facade exists

`server/src/runtime/orchestration/michaelRuntimeResolutionFacade.ts` — `resolveMichaelRuntimeTurnResponseFromAdapterInput` (line 129), `resolveMichaelRuntimeTurnResponseFromFixture` (145), primary alias `resolveMichaelRuntimeTurnResponse` (160). Shared tail `resolveFromSelectionRequest` (80) composes the S2.18 selector + contract validator and returns the fixture **by reference** ("`selection.entry.response`", lines 118-119). Never throws; maps derivation failures deterministically (`resolutionIssueFromDerivation`, line 29). Only imports are internal already-inert orchestration modules + `types.js` (lines 1-15) — no gateway/adapter/retrieval import.

### 9. Redacted trace contract exists

`server/src/runtime/orchestration/types.ts` — `MichaelRuntimeResolutionTrace` (line 822) with `MichaelRuntimeResolutionClassification` (810). Trace carries only redacted classification metadata (`scenarioFamily`, `responseType`, `language`, optional `intent`), the `selectionRequest`, `catalogKey`, `responseType`, `contextPacketStatus`, `language`, `persistence: 'disabled'`, `agentResponseGenerated: false` — no session/turn/correlation IDs, no generated text, no raw upstream payload (header comment lines 805-806, 817-821). Built explicitly in `buildTrace` (facade lines 53-73), which never spreads the response. `MichaelRuntimeResolutionIssue` (834) and discriminated `MichaelRuntimeResolutionResult` (847) complete the contract.

### 10. EN and ES fixture coverage (pairs)

Twelve valid fixtures, six EN/ES pairs (`michaelResponseFixtures.ts`):

| Pair | EN export (line) | ES export (line) |
|---|---|---|
| next_training_step (complete) | `...NextTrainingStepEn` (64) | `...NextTrainingStepEs` (82) |
| clarification_question (complete) | `...ClarificationQuestionEn` (100) | `...ClarificationQuestionEs` (109) |
| safe_fallback (degraded) | `...SafeFallbackDegradedContextPacket` (118) | `...SafeFallbackDegradedContextPacketEs` (159) |
| safe_fallback (missing) | `...SafeFallbackMissingContextPacket` (127) | `...SafeFallbackMissingContextPacketEs` (168) |
| safe_close (failed) | `...SafeCloseFailedContextPacket` (135) | `...SafeCloseFailedContextPacketEs` (176) |
| safe_close (rejected, candidate/review-only) | `...SafeCloseCandidateReviewOnlyRejection` (143) | `...SafeCloseCandidateReviewOnlyRejectionEs` (184) |

The ES safe-path set was added in S2.16 to mirror EN 1:1 so the adapter returns a validated Spanish safe response on every safe path (comment lines 154-158). The adapter threads resolved language through every safe path, with unsupported languages falling back to the language-neutral English safe fixtures (`safeLanguage`, adapter lines 66-68).

### 11. Complete / degraded / missing / failed / rejected scenario coverage

Adapter `runMichaelRuntimeAdapterContract` covers all five Context Packet statuses:
- **complete** → `next_training_step` (clear) or `clarification_question` (ambiguous) — adapter lines 134-153.
- **degraded** → `safe_fallback` — lines 118-120.
- **missing** → `safe_fallback` (issue-code path, lines 87-92; `reasonFromIssueCodes` 'missing_context' at 219-224).
- **failed** → `safe_close` — lines 122-124.
- **rejected** → `safe_close` — lines 126-128.

Catalog/selector mirror the same five families: `KNOWN_SCENARIO_FAMILIES` (selector lines 22-28) and the six valid combination rows (selector lines 35-42). Contract validator enforces the status→responseType policy: failed/missing/rejected allow only safe_fallback/safe_close, rejected requires safe_close (`validateContextPacketStatusBehavior`, contract lines 329-359).

### 12. Candidate / review-only rejection exists

- Adapter detects candidate/review-only context and routes to `safe_close` + `rejected` (`hasCandidateReviewOnlyContext`, lines 114-116, 272-281); issue-code path adds `candidate_review_only` for `candidate_knowledge_not_excluded` / `candidate_included_forbidden` / `candidate_exclusion_required` / `candidate_review_only_context_rejected` (lines 238-249).
- Dedicated fixtures EN/ES with `blockedReasonCodes: ['candidate_review_only_context_rejected']` (fixtures lines 143-152, 184-193) → catalog keys `michael_safe_close_rejected_en/_es` (catalog lines 101-108).

### 13. Wrong-agent / wrong-task / unsupported-language paths exist

- **Adapter** (`michaelRuntimeAdapterContract.ts`): wrong_agent → safe_close/rejected (lines 70-72, 99-101), wrong_task (74-76, 103-105), unsupported_language (78-80); plus issue-code equivalents (lines 251-261).
- **Selector** (`michaelResponseCatalogSelector.ts`): `wrong_agent` (67-69), `wrong_task` (71-73), `unsupported_language` (75-77).
- **Facade** (`michaelRuntimeResolutionFacade.ts`): surfaces selector `wrong_agent` / `wrong_task` / `unsupported_language` as same-named resolution issues (lines 85-93); these three codes are in the `MichaelRuntimeResolutionIssue` union (types lines 834-844).

### 14. Public runtime/orchestration exports added during S2.11–S2.20

`orchestration/index.ts` Michael-chain surface:
- Contract (line 137 + 191-204): `runMichaelRuntimeAdapterContract`, `MICHAEL_RESPONSE_AGENT_KEY`, `MICHAEL_RESPONSE_CONTRACT_SCHEMA_VERSION`, `MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELD_ALIASES`, `MICHAEL_RESPONSE_FORBIDDEN_FIELDS`, `MICHAEL_RESPONSE_TASK_TYPE`, `MICHAEL_RESPONSE_TYPES`, `MichaelResponseValidationError`, `assertMichaelResponseContractV1`, `assertValidMichaelResponseContract`, `isMichaelResponseContractV1`, `validateMichaelResponseContract`, `validateMichaelResponseContractV1`.
- Catalog (139-152): `MICHAEL_RESPONSE_CATALOG`, `getMichaelResponseCatalogEntry`, `hasMichaelResponseCatalogEntry`, `listMichaelResponseCatalogEntries`, `listMichaelResponseCatalogKeys`, `validateMichaelResponseCatalog`; types `MichaelResponseCatalogEntry`, `MichaelResponseCatalogValidationIssue`, `MichaelResponseCatalogValidationResult`, `MichaelResponseScenarioFamily`.
- Selector (154-166): `MICHAEL_RESPONSE_CATALOG_SELECTABLE_KEYS`, `selectMichaelResponseCatalogEntry`, `selectMichaelResponseCatalogKey`, `selectionRequestForCatalogKey`, `validateMichaelResponseCatalogSelection`; types `MichaelCatalogSelectorIntent`, `MichaelResponseCatalogSelectionIssue`, `MichaelResponseCatalogSelectionRequest`, `MichaelResponseCatalogSelectionResult`.
- Derivation (168-177): `deriveMichaelResponseCatalogSelectionRequest`, `...FromAdapterContractInput`, `...FromRuntimeTurn`; types `DeriveMichaelSelectionRequestFromRuntimeTurnInput`, `MichaelResponseSelectionRequestDerivationIssue`, `MichaelResponseSelectionRequestDerivationResult`.
- Facade (179-189): `resolveMichaelRuntimeTurnResponse`, `...FromAdapterInput`, `...FromFixture`; types `MichaelRuntimeResolutionClassification`, `MichaelRuntimeResolutionIssue`, `MichaelRuntimeResolutionResult`, `MichaelRuntimeResolutionTrace`.
- Fixture/harness re-exports (105-135): all 12 valid + 6 invalid fixtures, `michaelResponseFixtureEntries`, the S2.13 harness (`createMichaelRuntimeResponseFixtureHarness`, `runMichaelRuntimeResponseFixtureScenario`) and scenarios.

`runtime/index.ts` mirrors the same Michael-chain functions/types append-only (lines 101-257), including the facade trio (164-166) and trace types (240-243). Both barrels follow the append-only rule; no existing export was edited.

### 15. Gaps, duplicate surfaces, obsolete helper paths

- **Duplicate resolution surface (flagged, not dead).** The S2.13 fixture harness — `fixtures/michaelRuntimeResponseHarness.ts` (`runMichaelRuntimeResponseFixtureScenario`, line 23) + `fixtures/michaelRuntimeResponseScenarios.ts` (`michaelRuntimeResponseScenarios`, line 39) — resolves a Michael response by mapping a hardcoded `scenarioName` directly to a `responseFixtureKey` (harness lines 33-36, 54-76), independent of the S2.17–S2.20 catalog → selector → derivation → facade chain. It is inert, exported, and fully tested (`michaelRuntimeResponseHarness.test.ts`, `...Scenarios.test.ts`, `...Integration.test.ts`), so it is **not dead code**, but it is a second, older path to the same fixtures. Recommend the decision gate consciously decide to keep it as a test harness or retire it in favor of the facade, to avoid two divergent "how Michael picks a response" surfaces.
- **`runtimeTurnHarness.ts`** (S2.8) is shared infrastructure consumed by both surfaces (the S2.13 harness calls `runRuntimeTurnFixtureScenario`); not a duplicate — leave as is.
- **No orphaned chain link.** Every link from contract → fixtures → adapter → derivation → selector → catalog → facade → trace is imported by its downstream consumer and re-exported. No missing export, no broken import observed.
- **Scope posture intact.** No route mount, UI, `.com` surface, LLM/voice call, or persistence write appears anywhere in the chain. Persistence discriminants are the literal `'disabled'` and `agentResponseGenerated` the literal `false` at every result boundary (adapter 318-326, facade trace 71-72, fixtures 34/36, types 829-830). Note: gates (typecheck/build/full suite) were **not** run by this review per S2.21 read-only rules — the S2.20 closeout records the last green run (653/653 tests, 63 files).

## 16. Recommendation

The S2.11–S2.20 Michael inert runtime chain is **complete, coherent, and consistently inert**. All sixteen inventory items are confirmed with file:line / export evidence. Agent A recommends the decision gate proceed on the basis that the chain is **READY as a returned-only, contract-validated foundation** — with two notes for the gate owner (Agent E):

1. Make a conscious keep-or-retire call on the S2.13 scenario-driven fixture harness vs. the S2.20 facade (the one true duplicate surface, §15), so future activation work has a single canonical resolution path.
2. Re-confirm the four merge gates (`build:shared`, `typecheck`, `build`, full server suite) on the review branch before the gate closes — this read-only review did not run them; the last recorded green is the S2.20 closeout (653/653).

No production code, test, route, UI, or `.com` change is recommended by this inventory. This report does not constitute the S2.21 decision-gate verdict, which Agent E owns.
