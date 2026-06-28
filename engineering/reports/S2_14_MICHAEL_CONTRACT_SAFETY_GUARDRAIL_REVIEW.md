# S2.14 Michael Contract Safety Guardrail Review

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING / GOVERNANCE / REVIEW ONLY
- Owner: Agent B
- Scope: assess whether S2.12/S2.13 guardrails are sufficient to approve a future inert Michael runtime adapter contract slice

## Executive Verdict

Conditional approve for planning the next inert Michael runtime adapter contract slice.

Do not approve implementation of the adapter contract until the required adapter-specific tests in section 12 are added first. S2.12 and S2.13 prove a strong route-free, non-persistent, fixture/evaluation-only contract foundation. They do not yet prove that a future adapter contract can safely accept adapter-shaped inputs, reject every non-Michael/non-training-support path, preserve EN/ES fallback behavior, and scan generated text-shaped fields before any live response generation exists.

The future slice may remain approvable only if it stays inert: no production behavior, no routes, no persistence, no LLM, no UI, no `.com`, no voice, no Telnyx/PSTN/call-control, no automatic actions, and no Steve/Ivory behavior.

## Evidence Reviewed

- `engineering/reports/SPRINT_002_S2_12_MICHAEL_RESPONSE_CONTRACT_FIXTURE_EVALUATION_VERIFICATION.md`
- `engineering/reports/SPRINT_002_S2_13_MICHAEL_RESPONSE_CONTRACT_RUNTIME_FIXTURE_INTEGRATION_VERIFICATION.md`
- `server/src/runtime/orchestration/michaelResponseContract.ts`
- `server/src/runtime/orchestration/__tests__/michaelResponseContract.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelResponseGuardrails.test.ts`
- `server/src/runtime/orchestration/__tests__/michaelRuntimeResponseIntegration.test.ts`
- Supporting static boundary tests for S2.12/S2.13

Focused verification run:

`.\node_modules\.bin\vitest.cmd run michaelResponseContract michaelResponseGuardrails michaelRuntimeResponseIntegration s212MichaelResponseGovernanceBoundary s213MichaelRuntimeResponseGovernanceBoundary`

Result: PASS, 5 test files / 42 tests.

Note: `pnpm --filter @momentum/server test -- ...` did not reach Vitest because the pnpm wrapper stopped on unapproved dependency build scripts. The installed server Vitest binary was used directly for the focused verification.

## 1. Allowed Response Types

Sufficient for an inert adapter contract foundation.

The contract validator declares exactly four allowed response types:

- `next_training_step`
- `clarification_question`
- `safe_fallback`
- `safe_close`

Tests assert this exact list and validate representative fixtures. A future adapter contract should import/use the same constant rather than redefining response types.

## 2. EN / ES Coverage

Partially sufficient.

Current coverage validates EN and ES for:

- `next_training_step`
- `clarification_question`

Gap: safe fallback and safe close fixtures are currently EN-only. Before any adapter contract implementation, add ES coverage for degraded/missing/failed/rejected paths so Spanish runtime turns cannot fall back to English-only safety behavior unless Kevin explicitly approves that product decision.

## 3. Context Packet Status Coverage

Sufficient for fixture-level approval, with adapter-specific expansion required.

Covered statuses:

- `complete` -> substantive training-support fixtures
- `degraded` -> `safe_fallback`
- `missing` -> `safe_fallback`
- `failed` -> `safe_close` or `safe_fallback` only
- `rejected` -> `safe_close` only

The validator rejects substantive responses for failed/missing/rejected packets and requires rejected packets to safe-close. S2.13 maps runtime fixture scenarios across complete, degraded, missing, failed, rejected, candidate/review-only rejected, invalid objective, unknown agent, wrong task type, unsupported language, and non-Michael.

Gap: the future adapter contract needs tests at the adapter boundary, not only the fixture harness, proving these mappings hold when adapter-shaped dispatch inputs are passed through.

## 4. Candidate / Review-Only Rejection

Sufficient for the current inert fixture harness.

Candidate/review-only context maps to `safe_close`, uses blocked safety status, and rejects substantive training guidance. This is the correct posture: candidate or review-only knowledge must not leak into Michael training support and must not become knowledge approval.

Future adapter tests must keep candidate/review-only rejection separate from degraded approved context. Degraded approved context may safely fall back; candidate/review-only context must close.

## 5. Forbidden Field Coverage

Strong foundation, not complete enough for generated-response safety.

The validator forbids scoring/ranking/classification fields, income/commission/cycle/placement fields, prospect-facing/prospecting fields, medical/THREE authority fields, automatic action fields, knowledge approval, persistence instructions, and raw store/GraphRAG/Gateway responses. Guardrail tests cover the major groups.

Remaining gaps before adapter implementation:

- Add a table-driven test that every value in `MICHAEL_RESPONSE_CONTRACT_FORBIDDEN_FIELDS` is rejected, not only sample representatives.
- Add explicit tests for `readinessClassification`, `medicalAdvice`, and `threeAuthorityDecision`.
- Add synonym/alias tests for likely generated-output drift such as `earningsProjection`, `compensationProjection`, `cvCalculation`, `placementGuarantee`, `prospectQualification`, and `callControl`.
- Add content scanning tests for `text`, `nextStep.title`, and `nextStep.instruction`. Current validation blocks fields, but it does not block prohibited claims embedded inside allowed text fields.

## 6. Training-Support-Only Enforcement

Sufficient.

The contract requires `taskType: "training_support"` and rejects all other task types. S2.13 wrong-task and invalid-objective scenarios map to safe-close only.

Future adapter tests should prove that the adapter itself cannot dispatch Michael for `success_interview`, `relationship_support`, knowledge approval, prospecting, scoring, or any Steve/Ivory objective.

## 7. Michael-Only Enforcement

Sufficient as a contract literal; adapter boundary still needs its own proof.

The contract requires `agentKey: "michael_magnificent"` and rejects `steve_success`. S2.13 also keeps non-Michael scenarios safe-close only.

Adapter-specific requirement: a non-Michael adapter dispatch must not receive substantive Michael behavior. If a future adapter returns a Michael safe-close for non-Michael input, that must be documented as an internal rejection envelope, not user-facing Steve/Ivory behavior.

## 8. Safe Fallback / Safe Close Coverage

Mostly sufficient.

Safe fallback is covered for degraded and missing context. Safe close is covered for failed, rejected, candidate/review-only, invalid objective, unknown agent, wrong task, unsupported language, and non-Michael.

Gaps:

- Add ES safe fallback and ES safe close fixtures.
- Add adapter-boundary assertions that safe-close responses never include `nextStep`.
- Add text-content tests proving fallback/close copy contains no prospect-facing, income, placement, medical, THREE authority, or automatic-action language.

## 9. Forbidden Areas Remain Blocked

Current S2.12/S2.13 tests and reports keep these blocked at the fixture/integration layer:

- Prospect-facing content
- Steve behavior
- Ivory behavior
- Scoring, ranking, qualification/readiness classification
- Income claims, compensation projections, cycle math, placement promises
- Medical advice
- THREE authority decisions
- Automatic sending, calling, scheduling, prospecting
- Knowledge approval
- Telnyx/PSTN/call-control

This remains a governance-only finding. It is not approval to implement any of those behaviors.

## 10. Remaining Guardrail Gaps

- No adapter-shaped input/output contract tests yet.
- No generated text content scanner yet.
- No ES safety-path fixtures for fallback/close.
- The `unsupported_language` runtime scenario name is present, but the scenario should be strengthened to prove an actual unsupported language is rejected at the relevant boundary.
- No test proves all forbidden-field constants are covered by guardrail tests.
- No test proves future adapter contract source stays route-free and non-persistent because that file does not exist yet.
- No test proves future adapter contract source cannot import Steve/Ivory runtime behavior.
- No test proves future adapter contract source cannot import Telnyx/PSTN/call-control modules.

## 11. Required Tests Before Any Inert Adapter Contract Implementation

Before implementing any inert Michael runtime adapter contract file, add failing-first tests for:

1. Adapter contract accepts only Michael + `training_support`.
2. Adapter contract rejects Steve, Ivory, unknown agent, wrong task, invalid objective, and unsupported language before any substantive response selection.
3. Complete Context Packet can return only `next_training_step` or `clarification_question`.
4. Degraded/missing Context Packet can return only `safe_fallback` or `safe_close`.
5. Failed Context Packet can return only `safe_fallback` or `safe_close`.
6. Rejected and candidate/review-only Context Packet can return only `safe_close`.
7. EN and ES fixtures exist for all four response types or a documented safe localization fallback is approved.
8. Every forbidden-field constant is rejected at top-level and inside any allowed nested response object.
9. Allowed text fields are scanned for forbidden claims and actions.
10. `nextStep` is present only for `next_training_step`, is BA-owned, and has no automatic sending/calling/external side effect.
11. Persistence remains disabled across event, outcome, Guided Action, envelope, and response outputs.
12. `agentResponseGenerated` remains false.
13. Static boundary tests block routes, `/api/runtime/*`, `.com`, direct stores, GraphRAG, Gateway fallback, retrieval helpers, LLM providers, Steve/Ivory imports, Telnyx/PSTN/call-control, automatic actions, scoring, ranking, qualification, readiness classification, income, compensation, cycle math, placement promises, medical advice, THREE authority decisions, and knowledge approval.

## 12. Recommendation To Kevin

Approve the next slice only as an inert adapter contract preparation step after the required tests are added.

Do not approve live Michael runtime behavior yet. Do not approve routes, persistence, LLM calls, voice, Telnyx/PSTN/call-control, `.com`, UI, automatic actions, Steve behavior, Ivory behavior, or generated-response activation.

The safe next move is: write adapter-boundary tests first, then implement the smallest route-free contract adapter that only maps already-validated Context Packet outcomes to the four approved Michael response types with `agentResponseGenerated: false` and `persistence: "disabled"`.

