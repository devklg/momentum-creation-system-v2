# Agent Runtime Alignment Audit

Report date: 2026-06-27

Agent: Agent Runtime Alignment Agent

Architecture version: v1.0 frozen

## Scope

This audit reviews agent runtime readiness: agent registry, sessions, turns, templates, event taxonomy, browser/voice runtime, context-manager boundary, and learning-pipeline integration. It is audit-only.

## Sources Read

- `FOUNDATION_v1.0_FREEZE.md`
- `runtime/AGENT_RUNTIME.md`
- `runtime/AGENT_EVENT_MODEL.md`
- `runtime/BROWSER_VOICE_RUNTIME.md`
- `runtime/CONTEXT_MANAGER.md`
- `runtime/LEARNING_PIPELINE.md`
- `server/src/domain/agents/orchestrator.ts`
- `server/src/domain/michael-training-support.ts`
- `server/src/domain/steve-success-interview.ts`
- `server/src/routes/agents.ts`
- `server/src/routes/admin/agents.ts`
- `AGENT_ARCHITECTURE.md`
- `AGENT_PROMPT_GOVERNANCE.md`

## Runtime Model Findings

1. Existing agent code is domain-specific.
   Steve, Michael-support, Ivory, ScriptMaker, and agent recommendations exist in application domain modules. They are useful source material but are not the complete Package 001 Agent Runtime.

2. Agent recommendation events exist but are not full runtime events.
   `AgentEvent` in shared types and `recordAgentEvent()` in `server/src/domain/agents/orchestrator.ts` capture recommendation actions, but the frozen event model requires `schemaVersion: "agent_event.v1"`, idempotency, correlation/causation IDs, outbox, subscribers, replay, and privacy handling.

3. Agent sessions and turns are not centralized.
   Package 001 expects `server/src/runtime/agents/*` services for sessions, turns, state machines, templates, guardrails, and routes.

4. Browser Voice runtime is not implemented as a reusable client runtime.
   There is no `apps/team/src/runtime/browserVoice/` tree with support detection, permission flow, transcript finalization, TTS, bilingual language handling, and text fallback.

5. Context Manager integration is absent.
   Existing agents assemble prompts directly or through domain-specific helpers. Frozen architecture says agents request Context Packets and do not query stores directly.

## Boundary Findings

- Telnyx exists in the codebase for external SMS/VM/webhook workflows. This is allowed.
- Internal runtime agents must use browser voice/text only. Sprint 1 should include a hard acceptance test or static check that internal runtime components do not import Telnyx.
- Ivory must produce editable drafts only and never auto-send. Existing guidance aligns with that boundary, but the runtime guardrail should be centralized.

## Learning Pipeline Gaps

- No dedicated `server/src/runtime/learning/` implementation tree was found.
- Existing success/profile/training artifacts are not yet normalized as learning outcomes/signals/patterns/proposals.
- Learning must propose candidates only; it cannot approve knowledge.

## Blockers

- No dedicated runtime event service/outbox exists.
- No Browser Voice client runtime exists.
- No central Context Manager exists.
- No bilingual agent template set exists under a runtime registry.

## Recommended Agent Runtime Sequencing

1. Shared runtime types and Team Magnificent scope.
2. Agent Event Model and outbox.
3. Context Packet schema implementation.
4. Context Manager service.
5. Browser Voice/Text runtime components.
6. Agent Runtime backend with Steve/Michael/Ivory templates.
7. Learning Pipeline after events, sessions, and outcomes exist.
