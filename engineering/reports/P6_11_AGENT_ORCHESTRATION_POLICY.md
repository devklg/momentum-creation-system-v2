# P6.11 — Agent Orchestration Policy (Policy-as-Code Verification)

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.11 — Agent Orchestration Policy
- **Status:** VERIFICATION — policy is **implemented as code** on `main` (S2.1, `96c2218`)
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

---

## 1. Where the policy lives

The multi-agent orchestration **policy is code**: the inert agent registry
`server/src/runtime/orchestration/registry.ts` plus the inert spine
(`composition.ts`, `consumption.ts`, `contextRequest.ts`, `outcomeGuidedAction.ts`,
`turnCoordinator.ts`, adapters, `orchestrator.ts`). It is not a prose-only policy;
the descriptors are the enforced contract.

## 2. Registry descriptors (per-agent policy)

`AGENT_ORCHESTRATION_REGISTRY` declares one `AgentOrchestrationDescriptor` per agent
— `steve_success`, `michael_magnificent`, `ivory` — each carrying:

- `allowedTaskTypes` (validated packet task types)
- `supportedModes` / `supportedLanguages`
- `guardrailSet` (labels)
- `allowedOutputs` / `forbiddenOutputs` (output-shape allow/deny)
- `eventFamily`
- `guidedActionCategories` / `outcomeCategories`
- `requiresContextPacket: true`
- **`behaviorImplemented: false` — for every entry**

Descriptors carry **no behavior, prompts, or templates**. Helpers
`getAgentDescriptor`, `isKnownAgentKey`, `isTaskTypeAllowed`,
`listOrchestrationDescriptors`, `ORCHESTRATION_AGENT_KEYS` expose read-only policy.

## 3. Prohibitions encoded as forbidden outputs

The standing prohibitions are not merely documented — they are declared as
`forbiddenOutputs` the policy will reject. For `steve_success`:
`score`, `rank`, `readiness_classification`, `qualification_classification`,
`income_projection`, `placement_promise`, `automated_prospecting_list`,
`three_authority_decision`. (Michael and Ivory carry analogous forbidden sets.)
This makes "no scoring / ranking / qualification / income / placement /
prospecting-list / THREE-authority" a machine-checkable policy, not a convention.

## 4. Inert-by-construction spine

- The orchestration spine only **requests and consumes** Context Packets
  (`contextRequest.ts`, `consumption.ts`) — it **never assembles** them, preserving
  "Context Manager remains the sole Context Packet assembler."
- `composeOrchestrationTurn` / `coordinateRuntimeTurn` / the three adapters
  (`ivoryAdapter`, `michaelMagnificentAdapter`, `steveSuccessAdapter`) **return
  envelopes** and delegate to the inert composition path; none produces substantive
  output, calls an LLM, or persists.
- `agentOrchestrationBoundary`, `createAgentSession`, `planAgentTurn` describe turn
  planning without executing agent behavior.

## 5. Governance-boundary test coverage

The policy is guarded by an extensive `__tests__` suite (~50 files), including
dedicated **governance-boundary** tests (e.g. `s24GovernanceBoundary`,
`s25AdapterGovernanceBoundary`, `s26DispatchGovernanceBoundary`,
`orchestrationBoundary.test.ts`, plus the Michael `s21x` governance series). All
pass (part of the 1260-test green run).

## 6. Conformance to standing prohibitions

| Prohibition | How the policy holds it |
|---|---|
| No unapproved persistence | Spine returns envelopes; no store writes. |
| No LLM / no dynamic generation | `behaviorImplemented:false`; no model client imported. |
| No scoring/ranking/qualification/prospecting | Declared in `forbiddenOutputs`. |
| No income/placement | Declared in `forbiddenOutputs` + `guardrailSet`. |
| Context Manager sole assembler | Spine only requests/consumes packets. |
| No agent approves knowledge | No approval path in any descriptor/spine call. |

## 7. Recommendation

Record P6.11 as **DONE-ON-MAIN & VERIFIED**. The agent orchestration policy is
implemented as an inert, test-guarded registry + spine whose descriptors encode the
standing prohibitions. No policy code changes required. Activation (flipping
`behaviorImplemented`) remains a separate, Kevin-approved decision — out of scope here.
