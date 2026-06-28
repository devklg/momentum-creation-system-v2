# S2.10 First Agent Activation Target Review

- Date: 2026-06-28
- Sprint: Sprint 2 - Agent Runtime Activation
- Status: PLANNING / REVIEW / GOVERNANCE ONLY
- Owner: Agent B
- Scope: compare Steve Success, Michael Magnificent, and Ivory as the first runtime activation target

## Executive Recommendation

Recommend Steve Success as the first agent activation target.

Recommended first slice: a narrow authenticated `.team` Steve Success browser-text runtime pilot for the non-scored Success Interview. Keep it text-first, Context Packet only, response-generation only for the next interview prompt / clarifying question / safe close, and continue to defer browser voice, profile persistence, event persistence, outbox, replay, subscribers, and `/api/runtime/*` mounting until Kevin separately approves each boundary.

Do not choose Michael first. Michael is important, but he depends on training context and Steve-derived Success Profile context to do his best work. Activating Michael before Steve would either make him generic training Q&A or pull him toward the retired interview/scoring history that Sprint 2 explicitly fenced off.

Do not choose Ivory first. Ivory has the most mature application-domain surface, but it is prospect-adjacent and carries the highest compliance risk: no AI lead qualification, no automated prospecting, no auto-send, no calling, no scoring, and no pressure language. Ivory is a better second or third runtime activation after Steve proves the Context Packet / response-generation / guardrail pattern on a lower-risk BA-internal workflow.

## Evidence Reviewed

- `engineering/reports/SPRINT_002_RUNTIME_ACTIVATION_READINESS_REVIEW.md`
- `engineering/plans/S2_STEVE_SUCCESS_RUNTIME_ACTIVATION_PLAN.md`
- `engineering/plans/S2_MICHAEL_MAGNIFICENT_RUNTIME_ACTIVATION_PLAN.md`
- `engineering/plans/S2_IVORY_ROLE_AND_RUNTIME_BOUNDARY_PLAN.md`
- `server/src/runtime/orchestration/`
- `server/src/runtime/orchestration/adapters/`
- Supporting read-only context from existing Steve, Michael, and Ivory domain/routes

## Runtime Foundation Status

Sprint 2 S2.1 through S2.8 are ready as inert foundations, not live activation:

- Orchestration, Context Packet request/consumption, returned-only events, returned-only Outcome / Guided Action drafts, adapter dispatch, coordinator, and fixture harness are implemented.
- Steve, Michael, and Ivory adapters all delegate into the same inert composition path.
- `behavior: "not_implemented"` and `agentResponseGenerated: false` remain explicit.
- Runtime routes are not mounted.
- Event persistence, outbox, replay, subscribers, event APIs, Outcome persistence, and Guided Action persistence are not active.
- Context Manager integration is fixture/injected-boundary ready, but live retrieval/assembly still needs approval.

That means S2.10 should choose the first behavior target, not activate it yet.

## Comparative Readiness Matrix

| Dimension | Steve Success | Michael Magnificent | Ivory |
|---|---|---|---|
| Runtime role clarity | High | Medium-high | High |
| Existing app-domain maturity | Medium-high | Medium | High |
| Compliance risk | Low-medium | Medium | High |
| Prospect-adjacent risk | Low | Low-medium | High |
| QA readiness | High for structural guardrails; medium for live behavior | Medium | Medium-high, but needs stricter prospecting/draft tests |
| Data/context readiness | High for self-contained interview backbone; lower for live packet assembly | Medium; best after Steve profiles exist | High for roster/invitation context, but sensitive |
| Response-generation complexity | Medium | Medium-high | Medium |
| Blast radius of first mistake | Lowest | Medium | Highest |
| Recommended order | First | Second after Steve | Third, or second only for a non-drafting coach-only slice |

## Steve Readiness

Steve is the cleanest first activation target because his job is bounded: ask structured interview questions and help create a descriptive Success Profile without scoring, ranking, predicting, qualifying, income claims, placement promises, or THREE authority decisions.

Strengths:

- The role is explicit in the activation plan and locked-spec: Steve is the sole Success Interview agent and does not score or classify.
- Existing app-domain code already contains a discovery script, prompt backbone, artifact assembly, server-stamped sponsor context, and sponsor-only readback pattern.
- Steve can operate with minimal external context. The first live response slice can rely on the approved interview objective and packeted BA/session scope without needing prospect or relationship data.
- Compliance surface is mostly internal support context, not prospect-facing copy.
- A bad first response is easier to contain: it can be blocked, retried, or converted to a fixed next question without touching prospects, invites, sends, calls, or enrollment.

Risks:

- Steve's real workflow is multi-turn and eventually artifact-producing. The first slice must avoid jumping straight to full profile generation.
- Voice should not be first. Browser text gives the same runtime proof with fewer moving parts.
- Success Profile persistence must remain a separate approval because Sprint 2 currently returns envelopes only.

Best first-slice shape:

- Authenticated `.team` only.
- Browser text only.
- One active Steve session objective: `success_interview`.
- Generate only the next interview prompt, a clarifying question, or a safe close.
- No score/rank/classification fields in response shape.
- No profile write in the first activation slice unless Kevin separately approves persistence.
- Tests must assert no response field contains score, rank, readiness tier, qualification, income projection, placement promise, or prospecting list.

## Michael Readiness

Michael should be deferred until Steve is proven and Steve context is available through the approved runtime path.

Strengths:

- Michael's new role is clear: Training Agent and Daily Success Coach, not interviewer and not scorer.
- The activation plan has good boundaries: `.team` only, Context Packet only, no prospect-facing interaction, no internal Telnyx/PSTN/call-control, no direct stores, no automated outreach.
- Existing app-domain code already includes sponsor-facing training-support projection from Steve's Success Profile.

Risks:

- Michael's best context depends on Steve. Activating Michael first either weakens him into generic training help or pressures the runtime to invent support context.
- Training support can touch compensation concepts, daily action, Fast Start, orientation, and BA confidence. That increases response-generation and compliance complexity.
- The repository still carries retired Michael interview/scoring legacy types as historical compatibility. The runtime tests must keep proving new Michael cannot regress into interview/scoring/classification behavior.

Recommended deferral rationale:

- Choose Michael after Steve validates the runtime path.
- Make Michael's first slice use Steve-derived Success Profile context from a Context Packet, not direct reads.
- Start with training-support explanation and next-step guidance, not broad open Q&A.

## Ivory Readiness

Ivory should not be the first official Agent Runtime activation target, despite strong existing app-domain maturity.

Strengths:

- Ivory's role and boundary plan are well-defined: BA-facing relationship/context support, editable drafts only, no auto-send, no calling, no qualification, no scoring.
- Existing Ivory routes and domain code already support roster CRUD, coaching prompts, invitation drafts, minting through the invitation spine, generator runs, and momentum follow-up suggestions.
- The existing LLM patterns include degraded fallback behavior and compliance-oriented prompt scaffolding.

Risks:

- Ivory is closest to prospect action. Even when framed as BA-owned, it can influence who gets contacted and what message is sent.
- The prohibited behaviors are exactly the areas that can creep: lead qualification, automated prospecting, pressure language, auto-send, scoring, and medical/income/placement claims.
- Existing Ivory app-domain code uses direct gateway/triple-stack patterns. The Agent Runtime version must not inherit direct store or retrieval access; it must consume Context Packets only.
- Draft generation needs stricter output scanning than Steve's next-question generation because draft text can leave the app through the BA.

Recommended deferral rationale:

- Defer full Ivory runtime activation until Steve proves response-generation guardrails.
- If Kevin wants Ivory early, choose a coach-only WDYK reflection slice, not invitation drafting or minting.
- Keep invitation draft generation and minting outside Agent Runtime until guardrail tests prove no auto-send, no qualification, no scoring, no prospecting automation, and no prohibited claims.

## QA Requirements Before Any First Activation

Minimum S2.10 approval conditions before implementation:

- Kevin approves the first agent target and exact runtime objective.
- Kevin approves whether any route is mounted, and where.
- Kevin approves whether response generation is allowed and what response shape is allowed.
- Context Packet production integration is approved and tested with complete, degraded, failed, candidate-included, wrong-agent, and wrong-objective packets.
- Static boundary tests continue to block MongoDB, Neo4j, ChromaDB, GraphRAG, direct adapters, Gateway fallback clients, Telnyx/PSTN/call-control, `.com`, route mounting without approval, persistence without approval, and response fields outside the approved shape.
- Behavioral guardrail tests are added for the selected agent before the route is exposed.
- Rollback is simple: disable the route/feature flag and fall back to fixed UI copy or existing non-runtime app-domain flow.

## Recommendation To Kevin

Approve Steve Success as the first activation target, but approve only the smallest runtime behavior slice:

Steve Success, `.team`, browser text, Context Packet only, next-question / clarifying-question response generation, no profile persistence, no event persistence, no voice, no `/api/runtime/*` mount unless separately approved.

After Steve passes live QA, the next target should be Michael training support using Steve-derived Context Packet context. Ivory should follow after the runtime has proven stricter prospect-adjacent guardrails, or start with coach-only reflection if Kevin wants Ivory earlier.

## Explicit Non-Actions In This Review

- No runtime activation.
- No agent behavior implementation.
- No route mounting.
- No `/api/runtime/*` changes.
- No persistence, outbox, replay, subscribers, or event API activation.
- No `.com` changes.
- No ratified-document edits.
- No direct store, GraphRAG, adapter, Gateway fallback, or retrieval changes.
- No Steve, Michael, or Ivory prompt/runtime code changes.
