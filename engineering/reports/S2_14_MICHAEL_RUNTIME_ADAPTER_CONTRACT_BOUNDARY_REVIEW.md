# S2.14 Michael Runtime Adapter Contract Boundary Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.14 Michael runtime adapter contract boundary review
- Agent: Agent A
- Status: PLANNING / GOVERNANCE / REVIEW ONLY
- Date: 2026-06-28

## 1. Executive Verdict

PASS WITH CONDITIONS.

Michael may safely move from fixture/evaluation-only into a future inert runtime adapter contract only if the next slice remains route-free, returned-only, non-persistent, Context Manager-bound, and contract-validated.

This review does not approve live Michael behavior. It does not approve routes, `/api/runtime/*`, UI exposure, persistence, LLM calls, voice, Telnyx, runtime side effects, Steve behavior, or Ivory behavior.

## 2. Inputs Reviewed

- `engineering/reports/SPRINT_002_S2_13_MICHAEL_RESPONSE_CONTRACT_RUNTIME_FIXTURE_INTEGRATION_VERIFICATION.md`
- `engineering/reports/SPRINT_002_S2_12_MICHAEL_RESPONSE_CONTRACT_FIXTURE_EVALUATION_VERIFICATION.md`
- `engineering/reports/SPRINT_002_S2_11_MICHAEL_FIRST_ACTIVATION_CHARTER.md`
- `server/src/runtime/orchestration/`
- `server/src/runtime/orchestration/adapters/`
- `server/src/runtime/orchestration/fixtures/`

## 3. Current Michael Fixture / Evaluation Status

Current status is fixture/evaluation-only.

S2.11 approved only a governance charter for Michael's first activation target. S2.12 added `michael_response_contract.v1`, validators, EN/ES fixtures, guardrail tests, and static boundary tests. S2.13 connected those validated response fixtures into the inert runtime turn fixture path through `runRuntimeTurnFixtureScenario(...)`, which exercises `coordinateRuntimeTurn(...)`.

The current Michael path:

- uses `agentKey: "michael_magnificent"`;
- validates `taskType: "training_support"` for Michael response fixtures;
- returns only validated `michael_response_contract.v1` fixtures;
- preserves `agentResponseGenerated: false`;
- keeps `persistence: "disabled"`;
- keeps event, outcome, Guided Action, envelope, and response persistence disabled;
- does not mount routes;
- does not touch `.com`;
- does not call LLMs;
- does not generate dynamic response text;
- does not activate Michael, Steve, or Ivory behavior.

The current adapter implementation in `server/src/runtime/orchestration/adapters/michaelMagnificentAdapter.ts` remains inert. It maps identity to `michael_magnificent` and delegates to `composeOrchestrationTurn(...)`; it does not produce a Michael response.

## 4. Meaning Of An Inert Michael Runtime Adapter Contract

An inert Michael runtime adapter contract would be a typed, route-free boundary behind the existing orchestration adapter path that defines how a valid Michael runtime turn may return a validated Michael response envelope without activating live behavior.

It should mean:

- the input shape is explicit and narrow;
- the Context Packet is already assembled by the Context Manager;
- the adapter contract validates agent, task, packet status, language, and safety boundaries;
- the output is a validated `michael_response_contract.v1`;
- the result is returned to the caller in memory only;
- no database, event stream, outbox, route, UI, voice, or LLM surface is activated;
- `agentResponseGenerated` remains `false` unless Kevin separately approves changing that marker.

It should not mean live Michael.

## 5. What It Must Not Do

A future inert adapter contract must not:

- mount any route or route-like handler;
- mount `/api/runtime/*`;
- modify `.team` UI or `.com`;
- persist events, outcomes, Guided Actions, response envelopes, transcripts, or generated text;
- write to MongoDB, Neo4j, ChromaDB, GraphRAG, Gateway fallback, or direct persistence adapters;
- assemble Context Packets directly;
- query raw retrieval helpers or knowledge stores;
- call OpenAI, Anthropic, Claude, or any other LLM;
- generate new response text at runtime;
- call Telnyx, PSTN, call-control, voice, or browser-voice behavior;
- send, call, schedule, prospect, qualify, score, rank, classify, or predict;
- draft prospect-facing content;
- make income, placement, cycle, commission, medical, or THREE authority claims;
- approve candidate or review-only knowledge;
- activate Steve Success behavior;
- activate Ivory behavior.

## 6. Required Input Boundary

Required input boundary for any future inert contract:

- `agentKey` must be exactly `michael_magnificent`;
- `taskType` must be exactly `training_support`;
- packet must be a validated `context_packet.v1`;
- packet must be assembled by the Context Manager only;
- `metadata.generatedBy` must be `context_manager`;
- injected context boundary must identify `assembledBy: "context_manager"`;
- packet agent must match `michael_magnificent`;
- packet task type must match `training_support`;
- language must remain approved for this first boundary, currently EN/ES;
- candidate/review-only knowledge must remain excluded;
- failed, missing, rejected, wrong-agent, wrong-task, unsupported-language, non-Context-Manager, and candidate/review-only packets must block substantive guidance.

Important boundary note: the registry currently lists additional Michael task types beyond `training_support`. A future Michael response adapter contract should not rely on the broader registry alone. It should locally enforce the first-activation boundary: `michael_magnificent` + `training_support` only.

## 7. Required Output Boundary

Required output boundary for any future inert contract:

- schema must be `michael_response_contract.v1`;
- output must validate with `validateMichaelResponseContract(...)`;
- output must be returned only;
- output must be non-persistent;
- `persistence` must be `disabled`;
- `agentResponseGenerated` must remain `false` unless Kevin separately approves a marker change;
- response types must remain limited to:
  - `next_training_step`;
  - `clarification_question`;
  - `safe_fallback`;
  - `safe_close`;
- `nextStep`, when present, must be BA-owned and must preserve:
  - `baOwned: true`;
  - `automaticSending: false`;
  - `automaticCalling: false`;
  - `externalSideEffect: false`;
- blocked or rejected packets must return only `safe_fallback` or `safe_close`;
- rejected packets must return `safe_close`.

No raw Context Packet, raw retrieval result, raw store result, raw GraphRAG result, or raw Gateway fallback response should be exposed through the Michael response contract.

## 8. Route-Free Recommendation

Future implementation should remain route-free.

The next safe slice is a contract-layer implementation and test harness, not an API surface. It should live behind the existing inert orchestration code and be exercised by focused tests only.

No `/api/runtime/*` route should be mounted until Kevin separately approves:

- exact route family;
- auth boundary;
- feature flag / kill switch;
- monitoring behavior;
- rollback procedure;
- UI placement;
- persistence decision;
- live behavior decision.

## 9. Fixture-Backed Vs Controlled Returned-Only Selection

Recommendation: keep the next slice fixture-backed by default.

A narrowly controlled returned-only response selection can be considered only if it selects from a pre-authored, validated response catalog. It must not generate text, call an LLM, mutate response content, or persist the response.

Safe selection criteria:

- deterministic mapping from packet/turn status to an approved response type;
- selected response validates before return;
- invalid selection fails closed to a validated `safe_close`;
- all catalog entries are pre-authored fixtures or approved static templates;
- no runtime text synthesis;
- no live Michael behavior marker;
- `agentResponseGenerated: false` remains unchanged unless separately approved.

Do not allow uncontrolled generation in S2.14 follow-up. The first movement from fixtures should be controlled selection, not composition.

## 10. Risks

Risk rating: LOW for a route-free, fixture-backed inert contract; MEDIUM if controlled returned-only response selection is introduced; HIGH if any route, persistence, LLM, voice, or live behavior is introduced.

Current risks to address before implementation:

- Michael's registry descriptor allows additional task types. The future response adapter contract must enforce `training_support` locally for first activation.
- The S2.13 scenario catalog has at least one confusing scenario mapping where an ambiguous training-support scenario reuses the `invalid_objective` runtime scenario name while overriding task behavior. This is not a live behavior risk, but the naming should be cleaned up before it becomes an adapter contract precedent.
- The current fixture flow validates returned response fixtures after runtime turn execution; a future adapter contract must validate both before return and in tests across accepted, degraded, failed, missing, rejected, wrong-agent, wrong-task, unsupported-language, and candidate/review-only cases.
- Any change from fixture-backed to selected responses increases governance risk unless the catalog and selection rules stay static, explicit, and fully tested.

## 11. Recommendation To Kevin

Approve the next slice only as an inert Michael runtime adapter contract, not as live Michael.

Recommended approval wording:

"Proceed with a route-free, non-persistent Michael runtime adapter contract for `michael_magnificent` + `training_support` only. It may return only validated `michael_response_contract.v1` envelopes from fixtures or a controlled pre-authored catalog. It must keep `agentResponseGenerated: false`, must not mount `/api/runtime/*`, must not call LLMs or voice, must not persist, and must not activate Steve, Ivory, or live Michael behavior."

Do not approve runtime route exposure, persistence, LLM response generation, voice behavior, or `.team` UI until after this inert contract boundary is implemented and reviewed separately.

