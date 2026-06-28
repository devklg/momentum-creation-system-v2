# Sprint 2 S2.10 Runtime Activation Decision Gate

- Sprint: Sprint 2 - Agent Runtime Activation
- Slice: S2.10 Runtime Activation Approval Charter / Decision Gate
- Status: REVIEW / GOVERNANCE ONLY
- Architecture version: v1.0 frozen

## 1. Executive Verdict

PASS WITH CONDITIONS.

S2.10 is complete as a governance decision gate. It confirms the Sprint 2 runtime foundation is ready for Kevin to approve a narrowly scoped first activation slice, but not ready for broad runtime activation.

Conditions before activation:

- Kevin must approve the first activation target.
- Kevin must approve whether a route is mounted or kept unmounted.
- Kevin must approve response-generation scope.
- Kevin must approve persistence policy.
- Required gates and tests must pass on the implementation branch.
- Rollback and monitoring plans must exist before live exposure.

## 2. S2.1 Through S2.9 Status

Confirmed:

- S2.1 Agent Runtime Orchestration skeleton + Context Packet consumption validation - IMPLEMENTED / VERIFIED.
- S2.2 Context Packet Request Wiring - IMPLEMENTED / VERIFIED.
- S2.3 Outcome / Guided Action Envelope Wiring - IMPLEMENTED / VERIFIED.
- S2.4 Orchestration Composition - IMPLEMENTED / VERIFIED.
- S2.5 Agent-Specific Runtime Adapters - IMPLEMENTED / VERIFIED.
- S2.6 Adapter Dispatch Boundary - IMPLEMENTED / VERIFIED.
- S2.7 Runtime Turn Coordinator - IMPLEMENTED / VERIFIED.
- S2.8 Runtime Turn Fixture Harness - IMPLEMENTED / VERIFIED.
- S2.9 Runtime Activation Readiness Review - PASS WITH CONDITIONS.

## 3. Route Mount Decision Summary

Route recommendation: defer route mounting and keep runtime unmounted until Kevin separately approves a route-specific activation charter.

Confirmed: `/api/runtime/*` is not mounted. No route was mounted in S2.10.

If a runtime route is later approved, it should be internal `.team` only, authenticated, BA-scoped, Context Packet-only, non-persistent unless separately approved, and guarded by static tests proving `.com` remains untouched.

## 4. First Agent Activation Target Recommendation

Recommended first activation target: Michael Magnificent internal `.team` training support.

Michael has the cleanest first activation boundary because it can remain internal, training-focused, Context Packet-only, and free of prospect outreach. The first Michael slice must not schedule calls, interview BAs, perform Steve's discovery role, become prospect-facing, or use Telnyx/PSTN/call-control.

Steve should be deferred until the Success Interview response/profile contract is approved. Ivory should be deferred until editable draft ownership, relationship context scope, and anti-prospecting guardrails are approved.

## 5. Response-Generation Scope Recommendation

Do not approve broad response generation.

Recommended next policy: either approve a fixture/evaluation-only response contract, or approve one narrow Michael internal `.team` training-support response contract. Any first response generation must be Context Packet-only, returned-only, non-persistent, text-first, no route unless separately approved, no scheduling, no interviewing, no prospect-facing content, and no external actions.

## 6. Persistence / Event / Outcome / Guided Action Recommendation

Keep persistence disabled for the first activation decision.

Runtime events, Outcome drafts, and Guided Action drafts should remain returned only. Defer event persistence, outcome persistence, Guided Action persistence, outbox, replay, subscribers, and event API activation to separate Kevin approvals.

## 7. Required Kevin Approval Decisions

Kevin must approve:

- first activation target;
- whether the first activation is route-free, fixture/harness-only, or internally mounted on `.team`;
- exact route family if any route is approved;
- exact response-generation scope;
- whether response generation is text-only, voice/text, or harness-only;
- whether events remain returned only or any persistence is approved;
- whether Outcome and Guided Action drafts remain returned only or any persistence is approved;
- rollback owner and kill-switch behavior;
- monitoring and observability requirements;
- `.team` surface placement, if any.

## 8. Required Gates Before Any Activation Slice

Before any activation slice merges, run and pass:

- `pnpm build:shared`
- `pnpm typecheck`
- `pnpm build`
- `pnpm --filter @momentum/server test`

The activation branch must also preserve the existing `gates` status check path.

S2.10 integrated branch gate results:

- `pnpm build:shared` - PASS.
- `pnpm typecheck` - PASS.
- `pnpm build` - PASS. Existing Vite warnings only: `.com` dynamic/static import chunk note and `.team` chunk-size warning.
- `pnpm --filter @momentum/server test` - PASS, 31 test files / 203 tests.

The passing gates above were run with pnpm 9.15.0 from the project environment.

## 9. Required Tests Before Any Activation Slice

Required tests:

- valid Context Packet request/response path;
- missing, degraded, failed, invalid, and candidate/review-only Context Packet paths;
- invalid agent and invalid objective;
- Context Manager remains the only Context Packet assembler;
- agents consume Context Packets only;
- no direct store, GraphRAG, adapter, Gateway fallback, or retrieval helper access;
- no `/api/runtime/*` mount unless explicitly approved;
- `.com` untouched;
- Gateway fallback preserved;
- no event, outcome, or Guided Action persistence unless explicitly approved;
- no outbox, replay, subscribers, or event API activation;
- no Steve/Michael/Ivory behavior outside the approved first agent;
- no automatic sending, calling, scheduling, prospecting, or knowledge approval;
- EN/ES response validation if response generation is approved.

## 10. Required Rollback Plan Before Any Activation Slice

Any activation slice must define:

- feature flag or config kill switch;
- route disable path if any route is mounted;
- response-generation disable path;
- fallback behavior for missing/degraded/failed Context Packets;
- safe return shape when disabled;
- verification command sequence after rollback;
- cleanup procedure for any non-production test artifacts;
- owner and execution steps.

## 11. Required Monitoring / Observability Plan Before Any Activation Slice

Any activation slice must define:

- what runtime lifecycle facts are visible without persistence;
- what request/response failures are logged;
- what guardrail blocks are counted;
- what degraded-context rate is monitored;
- what response-validation failures are monitored if generation is approved;
- how PII and generated content are redacted from logs;
- how Kevin can verify the activation remains `.team` only;
- how route calls are observed if a route is approved.

## 12. Required `.team` Surface Decision

Kevin must decide whether the first activation appears in an existing `.team` surface, a new `.team` internal surface, or a route-free fixture/harness slice first.

No `.team` UI changes are approved by S2.10.

## 13. `.com` Out Of Scope

Confirmed: `.com` remains out of scope.

No prospect-facing runtime activation, runtime copy, AI agent behavior, or `/api/runtime/*` call is approved for `apps/com`.

## 14. Gateway Fallback Preserved

Confirmed: Gateway fallback remains preserved. S2.10 did not remove or modify Gateway fallback.

## 15. Context Manager Only Assembler

Confirmed: Context Manager remains the only Context Packet assembler.

Agent Runtime may request, receive, validate, and consume Context Packets through the approved boundary, but it must not assemble them.

## 16. Agents Consume Context Packets Only

Confirmed: agents consume Context Packets only.

Future activation must preserve this rule and must not give agents direct store, GraphRAG, direct adapter, Gateway fallback, or raw retrieval access.

## 17. Candidate / Review-Only Knowledge Excluded By Default

Confirmed: candidate/review-only knowledge remains excluded by default.

Agents and learning processes must not approve knowledge.

## 18. Browser Voice/Text `.team` Only

Confirmed: Browser Voice/Text remains `.team` only.

No browser voice/text runtime exposure is approved for `.com`.

## 19. Telnyx / PSTN / Call-Control Excluded

Confirmed: Telnyx/PSTN/call-control remain excluded from internal browser voice/text runtime.

No internal runtime activation should import or call Telnyx, PSTN, or call-control systems.

## 20. Final Recommendation To Kevin

Recommendation: approve more planning in the form of a tightly scoped first activation charter for Michael Magnificent internal `.team` training support.

Do not approve broad runtime activation yet. Do not mount routes, persist runtime events/outcomes/Guided Actions, or enable response generation until Kevin approves those decisions explicitly in the next slice.
