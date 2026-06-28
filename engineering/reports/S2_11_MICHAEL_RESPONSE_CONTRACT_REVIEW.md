# S2.11 Michael Response Contract And Guardrail Review

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.11 Michael First Activation Charter
- Status: PLANNING / GOVERNANCE ONLY
- Architecture version: v1.0 frozen
- Scope: response contract proposal only

## 1. Current State

Current runtime orchestration is inert. It validates Context Packet request and consumption paths, returns non-persistent event envelopes, and drafts returned-only Outcome / Guided Action envelopes.

Current markers remain:

- `behavior: "not_implemented"`
- `agentResponseGenerated: false`
- event persistence disabled
- outcome persistence disabled
- Guided Action persistence disabled
- `/api/runtime/*` unmounted

This review does not approve response generation. It proposes the minimum response contract that must be approved and tested before a future Michael response-generation slice can be implemented.

## 2. Response Schema Proposal

Proposed envelope: `michael_response_contract.v1`.

The response should be returned-only, Context Packet-backed, text-first, non-persistent, and internal `.team` only.

```ts
type MichaelResponseType =
  | "next_training_step"
  | "clarification_question"
  | "safe_fallback"
  | "safe_close";

interface MichaelResponseContractV1 {
  schemaVersion: "michael_response_contract.v1";
  responseType: MichaelResponseType;
  agentKey: "michael_magnificent";
  taskType:
    | "training_support"
    | "journal_teaching"
    | "session_resume"
    | "guided_action_review";
  sessionId: string;
  turnId: string;
  correlationId: string;
  contextPacketId?: string;
  contextPacketStatus: "complete" | "degraded" | "failed" | "missing" | "rejected";
  language: "en" | "es";
  text: string;
  safety: {
    validationStatus: "passed" | "blocked" | "degraded";
    guardrailIds: string[];
    blockedReasonCodes: string[];
  };
  nextStep?: {
    label: string;
    baOwned: true;
    automaticSending: false;
    automaticCalling: false;
    externalSideEffect: false;
  };
  persistence: "disabled";
  generatedAt: string;
}
```

## 3. Allowed Response Types

- `next_training_step` - a short training-support response that points the BA to the next BA-owned learning or practice step allowed by the Context Packet.
- `clarification_question` - one focused question when the BA request is ambiguous, context is incomplete, or language intent is unclear.
- `safe_fallback` - a limited response when the Context Packet is degraded, missing non-critical sections, or cannot support substantive guidance.
- `safe_close` - a non-substantive close when the request is out of scope, the packet failed/rejected, a guardrail blocks the turn, or Michael should stop.

No other response type should be allowed in the first Michael contract.

## 4. Required Fields

Required:

- `schemaVersion`
- `responseType`
- `agentKey`
- `taskType`
- `sessionId`
- `turnId`
- `correlationId`
- `contextPacketStatus`
- `language`
- `text`
- `safety.validationStatus`
- `safety.guardrailIds`
- `safety.blockedReasonCodes`
- `persistence`
- `generatedAt`

Required when a valid Context Packet is consumed:

- `contextPacketId`

Required when `responseType` is `next_training_step`:

- `nextStep`
- `nextStep.baOwned: true`
- `nextStep.automaticSending: false`
- `nextStep.automaticCalling: false`
- `nextStep.externalSideEffect: false`

## 5. Forbidden Fields

The response envelope must not contain:

- `score`
- `rank`
- `classification`
- `readinessClassification`
- `qualification`
- `prediction`
- `incomeProjection`
- `commissionEstimate`
- `cycleMath`
- `placementPromise`
- `prospectFacingMessage`
- `prospectingList`
- `leadQualification`
- `medicalAdvice`
- `threeAuthorityDecision`
- `sendMessage`
- `sendSms`
- `sendEmail`
- `placeCall`
- `scheduleCall`
- `scheduleInterview`
- `approveKnowledge`
- `persistEvent`
- `persistOutcome`
- `persistGuidedAction`
- raw store query results
- raw GraphRAG retrieval results
- raw Gateway fallback responses

The first contract should also reject generic fields such as `actionExecuted: true`, `automaticSending: true`, `automaticCalling: true`, or `externalSideEffect: true`.

## 6. EN / ES Requirements

Michael response generation must support English and Spanish only in this first contract.

Requirements:

- `language` must be `en` or `es`.
- Response language must follow the Context Packet `language.primary`.
- If `language.primary` is missing, unsupported, or inconsistent with the user turn, return `clarification_question` or `safe_fallback`.
- If translation is unavailable or marked unsafe by packet metadata, return `safe_fallback`.
- Machine translation, if later allowed, must be marked and tested; it must not silently pretend to be human-reviewed Spanish.
- EN and ES tests must cover every allowed response type and every major guardrail block.

## 7. Output Validation Requirements

Before returning a response, validation must confirm:

- schema version is exact;
- response type is one of the four allowed values;
- `agentKey` is `michael_magnificent`;
- `taskType` is Michael-approved;
- Context Packet status and decision allow the selected response type;
- candidate/review-only knowledge was excluded by default;
- response language matches the packet language rules;
- response text is present, bounded, and safe;
- no forbidden field is present;
- no prospect-facing message is generated;
- no Steve interview behavior is generated;
- no Ivory outreach or relationship-drafting behavior is generated;
- no scoring, ranking, qualifying, prediction, income claim, placement promise, THREE authority claim, or medical advice appears;
- no automatic send, call, schedule, enrollment, prospecting, persistence, outbox, replay, subscriber, or event API action is represented.

On validation failure, the runtime must not return the generated text. It should return a validated `safe_fallback` or `safe_close` envelope.

## 8. Guardrail Failure Behavior

Guardrail failures should fail closed.

Expected behavior:

- validation block before response return;
- original blocked text not returned;
- no persistence;
- no external action;
- no route activation side effect;
- returned envelope uses `safe_fallback` for recoverable context or language issues;
- returned envelope uses `safe_close` for hard out-of-scope or prohibited requests;
- `safety.validationStatus` is `blocked` or `degraded`;
- `safety.blockedReasonCodes` names the reason without leaking raw private content.

Examples that must close safely:

- BA asks Michael to write a prospect-facing invite;
- BA asks for income projections, comp math, or placement guarantees;
- BA asks for medical advice;
- BA asks Michael to call, text, schedule, or qualify someone;
- response generator tries to classify the BA;
- response generator tries to approve candidate knowledge.

## 9. Missing / Degraded / Failed Context Packet Behavior

Michael must consume Context Packets only.

Behavior by packet state:

- `complete` - may return `next_training_step`, `clarification_question`, `safe_fallback`, or `safe_close`, subject to output validation.
- `degraded` - may return only limited `clarification_question`, `safe_fallback`, or a low-risk `next_training_step` that does not depend on missing sections. Prefer `safe_fallback` when missing sections affect the user request.
- `failed` - must block substantive guidance and return `safe_close` or `safe_fallback`.
- `missing` - must return `safe_fallback` asking for a refresh/retry; no substantive guidance.
- `rejected` - must return `safe_close`; no substantive guidance.

If the Context Manager request throws, returns `null`/`undefined`, produces the wrong agent, includes unsupported language, includes a disallowed objective, or lacks `metadata.generatedBy: "context_manager"`, Michael must not generate substantive content.

## 10. Candidate / Review-Only Knowledge Behavior

Candidate and review-only knowledge remains excluded by default.

Requirements:

- If `retrievalAudit.candidateKnowledgeIncluded !== false`, reject the packet.
- If `retrievalAudit.candidateKnowledgeExcluded !== true`, reject the packet.
- Michael cannot approve knowledge.
- Michael cannot convert candidate content into approved training guidance.
- Michael cannot cite candidate/review-only knowledge as fact.
- If the BA asks about unavailable or review-only information, return `clarification_question`, `safe_fallback`, or `safe_close` depending on context.

Learning signals or outcomes may be candidates only in later approved slices. They must not become approved knowledge through Michael.

## 11. Tests Required Before Response Generation Can Be Implemented

Contract tests:

- validates `next_training_step`;
- validates `clarification_question`;
- validates `safe_fallback`;
- validates `safe_close`;
- rejects unknown response types;
- enforces required fields;
- rejects forbidden fields;
- enforces `persistence: "disabled"`;
- enforces BA-owned next step fields.

Context tests:

- complete Context Packet path;
- degraded Context Packet path;
- failed Context Packet path;
- missing Context Packet path;
- rejected Context Packet path;
- invalid agent;
- invalid Michael objective;
- missing identity;
- missing turn id;
- missing task type;
- missing Context Manager boundary;
- non-Context-Manager assembler rejected;
- candidate/review-only knowledge rejected.

Guardrail tests:

- blocks prospect-facing content;
- blocks Steve interview behavior;
- blocks Ivory outreach/draft behavior;
- blocks scoring, ranking, qualifying, and prediction;
- blocks income claims, compensation figures, cycle math, and placement promises;
- blocks THREE authority claims;
- blocks medical advice;
- blocks automatic sending/calling/scheduling/prospecting;
- blocks knowledge approval;
- blocks Telnyx/PSTN/call-control behavior.

Language tests:

- EN valid response for all four response types;
- ES valid response for all four response types;
- unsupported language returns fallback/close;
- translation unavailable returns fallback;
- response language follows Context Packet metadata.

Static boundary tests:

- no imports from MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, Gateway fallback clients, persistence adapters, raw retrieval helpers, Telnyx, PSTN, or call-control;
- no `/api/runtime/*` mount unless separately approved;
- `.com` untouched;
- no event, outcome, or Guided Action persistence;
- no outbox, replay, subscribers, or event API activation.

Gate commands:

- `pnpm build:shared`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

Until Kevin approves implementation, tests must continue to assert `agentResponseGenerated: false`.

## 12. Recommendation To Kevin

Recommendation: approve this response contract as the next governance artifact, but do not approve live response generation yet.

The safest next implementation slice is route-free fixture/evaluation only: implement schema validation, EN/ES fixtures, guardrail blocks, and degraded-context behavior around Michael's four allowed response types. Keep it returned-only, non-persistent, Context Packet-only, and internal `.team` scoped. After that passes, Kevin can decide whether to approve a narrow internal `.team` route or keep the harness-only path longer.
