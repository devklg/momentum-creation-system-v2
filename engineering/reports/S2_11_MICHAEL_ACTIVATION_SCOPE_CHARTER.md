# S2.11 Michael Activation Scope Charter

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.11 Agent A - Michael Activation Scope Charter
- Status: PLANNING / GOVERNANCE ONLY
- Architecture version: v1.0 frozen
- Scope: Michael Magnificent first activation objective and response boundary

## 1. Executive Verdict

Recommendation: approve Michael Magnificent as the first narrowly scoped activation target, but only for an internal `.team` training-support slice.

Do not approve broad runtime activation. Do not approve final S2.11 package creation from this charter alone. Do not activate Steve interview behavior, Ivory relationship/outreach behavior, prospect-facing behavior, persistence, automatic actions, or runtime routes unless Kevin separately approves those items.

## 2. Approved First Activation Objective

Michael's approved first activation objective should be:

> Help an authenticated Brand Ambassador on `.team` choose or continue one safe, BA-owned training-support next step from an approved Context Packet.

This first objective is intentionally narrow. Michael may use the Context Packet to support BA learning, orientation, follow-through, and daily-success rhythm. Michael may not conduct discovery, interview BAs, score readiness, create prospect content, send or call anyone, approve knowledge, or make income or placement claims.

## 3. Why Michael Is The First Target

Michael is the cleanest first activation target because:

- Michael's domain is internal BA training support, not prospect interaction.
- The existing runtime registry already defines Michael as `michael_magnificent` with primary domain `training`.
- Michael can be activated with Context Packet-only inputs and returned-only text without giving agents direct store, GraphRAG, adapter, Gateway fallback, or retrieval access.
- Michael can remain separate from Steve's Discovery / Success Profile role.
- Michael can remain separate from Ivory's relationship-context and invitation-drafting role.
- Michael can be route-free in the first slice, reducing blast radius while response validation and guardrails are proven.

## 4. Exact Allowed Task Type

Allowed first-slice task type:

- `training_support`

The registry currently also lists `journal_teaching`, `session_resume`, and `guided_action_review` for Michael. Those should remain registry-known but not first-slice-approved. The first activation should use only `training_support` until Kevin approves an expanded Michael charter.

## 5. Exact Prohibited Task Types

Prohibited for Michael's first slice:

- `success_interview`
- `relationship_coaching`
- `invitation_drafting`
- `journal_teaching`
- `session_resume`
- `guided_action_review`

Also prohibited: any task type not defined in `RuntimeTaskType`.

## 6. Required Context Packet Fields

The first Michael slice must consume `context_packet.v1` only. Required fields:

- `schemaVersion`
- `packetId`
- `requestId`
- `createdAt`
- `packetStatus`
- `tenant`
- `team`
- `ba`
- `session.sessionId`
- `session.mode`
- `session.status`
- `session.taskType`
- `agent.agentKey`
- `agent.displayName`
- `agent.primaryDomain`
- `agent.allowedOutputs`
- `agent.prohibitedOutputs`
- `language.primary`
- `runtimeRules`
- `guardrails`
- `approvedKnowledge`
- `privateContext`
- `relationshipContext`
- `journalContext`
- `sessionHistory`
- `guidedActions`
- `exclusions`
- `retrievalAudit`
- `metadata.generatedBy`

Required value constraints:

- `metadata.generatedBy` must be `context_manager`.
- `agent.agentKey` must be `michael_magnificent`.
- `session.taskType` must be `training_support`.
- `packetStatus` may be `complete`, `degraded`, or `failed`, but `failed` must block substantive guidance.
- `retrievalAudit.candidateKnowledgeIncluded` must be `false`.
- `retrievalAudit.candidateKnowledgeExcluded` must be `true`.

If the Context Packet is missing, rejected, failed, or outside scope, Michael may only ask a clarifying question, return a safe fallback, or safely close.

## 7. Allowed Response Intent

Allowed response intent is limited to:

- training-support next step;
- clarifying question;
- safe fallback;
- safe close.

The response should be returned only. It should not persist events, outcomes, Guided Actions, generated text, or session state unless Kevin separately approves persistence.

## 8. Prohibited Outputs

Michael must not output:

- prospect-facing content;
- Steve interview behavior;
- Ivory relationship or outreach behavior;
- scoring;
- ranking;
- qualification/readiness classification;
- income claims;
- earnings projections;
- cycle math promises;
- placement promises;
- queue-position-to-binary-position guarantees;
- automatic sending;
- automatic calling;
- automated prospecting;
- AI lead qualification;
- bulk outreach;
- medical advice or disease claims;
- THREE authority decisions;
- knowledge approval;
- candidate/review-only knowledge promotion;
- Telnyx, PSTN, or call-control behavior.

## 9. Route Decision

First slice should remain route-free.

Prepare the implementation shape so a later authenticated `.team` route can be approved cleanly, but do not mount it in the first slice. The first implementation should run through fixture/harness or internal server tests only, with no `/api/runtime/*` mount and no `.com` touch.

If Kevin later approves a route, it should be internal `.team` only, authenticated, BA-scoped, Context Packet-only, text-first, feature-flagged, and non-persistent unless separately approved.

## 10. Recommendation To Kevin

Approve Michael as the first runtime activation target only under this scope:

- Agent: `michael_magnificent`
- Task type: `training_support`
- Surface: route-free first slice
- Input: validated Context Packet only
- Output: returned-only training-support next step, clarifying question, safe fallback, or safe close
- Persistence: disabled
- External actions: disabled
- `.com`: untouched

Do not approve Steve, Ivory, runtime route mounting, prospect-facing behavior, persistence, automatic actions, or final S2.11 packaging from this charter.

