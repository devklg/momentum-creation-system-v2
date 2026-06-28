# S2.10 Response Generation And Behavior Scope Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.10 Runtime Activation Approval Charter / Decision Gate
- Status: REVIEW / GOVERNANCE ONLY
- Architecture version: v1.0 frozen

## 1. Current State

Current state: no agent response generation.

The Sprint 2 runtime foundation returns Context Packet request results, runtime event envelopes, Outcome draft envelopes, and Guided Action draft envelopes. The orchestration code and verification reports keep `behavior: "not_implemented"` and `agentResponseGenerated: false`.

## 2. What Response Generation Would Mean For Steve

For Steve, response generation would mean internal `.team` Success Interview behavior:

- structured interview prompts;
- clarifying questions;
- non-scored Success Profile draft summaries;
- BA-owned Guided Action suggestions.

Steve response generation must not score, rank, predict, qualify, classify readiness, make income claims, make placement promises, or replace THREE authority.

## 3. What Response Generation Would Mean For Michael

For Michael, response generation would mean internal `.team` training support:

- explaining approved training concepts;
- answering BA questions from Context Packets;
- guiding a BA through training support states;
- offering clarifying questions;
- suggesting BA-owned next actions.

Michael must remain training support only. Michael must not schedule calls, interview BAs, perform Steve's discovery role, become prospect-facing, use Telnyx/PSTN/call-control, make income/placement claims, or automate outreach.

## 4. What Response Generation Would Mean For Ivory

For Ivory, response generation would mean internal `.team` relationship/context support:

- helping a BA think through known relationships included in an approved Context Packet;
- composing editable BA-owned drafts;
- suggesting BA-owned next steps;
- reminding the BA of compliant sharing boundaries.

Ivory must not qualify leads, score prospects, automate prospecting, auto-send, auto-call, bulk-message, approve knowledge, or reach `.com`.

## 5. Guardrails Required Before Response Generation

- Kevin approval naming the first agent and the exact response scope.
- Context Packet-only input contract.
- Context Manager-only packet assembly.
- Explicit allowed output categories per agent.
- Explicit forbidden output categories per agent.
- Runtime language constraints for EN/ES.
- BA ownership markers for any suggested action.
- No automatic external side effects.
- No persistence unless separately approved.
- No route mount unless separately approved.
- Static boundary tests for stores, GraphRAG, adapters, Gateway fallback clients, retrieval helpers, `.com`, and `/api/runtime/*`.

## 6. Output Validation Requirements

- Validate generated text before returning it.
- Block or degrade on income claims, compensation figures, cycle math, placement promises, medical claims, urgency manipulation, automated prospecting, scoring, ranking, qualification, knowledge approval, and automatic sending/calling.
- Validate that the response matches the approved agent and objective.
- Validate that candidate/review-only knowledge was excluded by default.
- Validate language metadata and EN/ES support.
- Validate that degraded or failed Context Packets produce limited safe responses or no substantive response.
- Preserve audit-friendly notes without persisting events or content unless separately approved.

## 7. Human / BA Ownership Requirements

- The BA remains the actor.
- Generated content must be reviewable before use.
- Guided Actions remain suggestions, not executions.
- Drafts remain editable.
- No automatic sending, automatic calling, automatic scheduling, enrollment action, prospecting automation, or knowledge approval.
- Any future route must derive BA identity from the authenticated session, not the request body.

## 8. EN / ES Requirements

- Response generation must support English and Spanish when approved.
- The response language should follow the Context Packet language metadata.
- Safe fallback behavior must exist when language is missing, unsupported, or ambiguous.
- Tests must cover EN and ES for allowed response shape and prohibited-output blocking.

## 9. Prohibited Outputs

Response generation must prohibit:

- scoring;
- income claims;
- placement promises;
- automatic sending;
- automatic calling;
- automated prospecting;
- knowledge approval;
- BA ranking or qualification;
- prospect qualification;
- medical claims;
- THREE authority decisions.

## 10. Recommended Response-Generation Policy For The Next Slice

Do not approve broad response generation.

Recommended policy: if Kevin wants the next implementation slice to start response generation, approve only one narrow Michael Magnificent internal `.team` training-support response contract. The first contract should be Context Packet-only, returned-only, non-persistent, text-first, no route unless separately approved, no scheduling, no interviewing, no prospect-facing content, and no external actions.

An even safer intermediate step is a response-generation contract/evaluation harness with fixtures only, still no live behavior.

## 11. Recommendation To Kevin

Approve response generation only as a separately scoped first-agent implementation slice. The recommended first response scope is Michael Magnificent internal `.team` training support, with strict output validation and no persistence or route mount unless separately approved.
