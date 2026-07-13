# ACR-0017 — Automatic Context Agent Lifecycle Hooks

**Status:** APPROVED / VERIFIED — Kevin L. Gardner, 2026-07-13
**Depends on:** ACR-0012, ACR-0013, ACR-0014
**Type:** Agent lifecycle and prompt-context delivery
**Target:** Codex and Claude Code project sessions

## Approval

Kevin's instruction after verifying that the Context Agent worked only on
demand was: **“then quick detour and fill the gap, wire it.”**

This authorizes the missing lifecycle integration. It does not authorize new
memory authority, agent self-confirmation, automatic learning promotion, or a
change to application-runtime agents.

## Problem

ACR-0014 implemented retrieval, parsing, proposal, confirmation, and close
functions, but invocation depended on an agent following documentation. A new
chat could therefore begin without consulting the context library. The code
worked; the lifecycle enforcement did not.

## Approved Design

Use the supported project hook systems in both Codex and Claude Code:

1. `SessionStart` injects the current Git state, unread Intervector inbox
   summary, and `knowledge/CONTINUATION_CONTEXT.md` before the first prompt.
2. The first `UserPromptSubmit` per session runs the existing
   `pnpm memory:guard` path against the real prompt and injects its provenance-
   carrying report. Trivial prompts such as `continue` resolve to the current
   `front_of_line` from the continuation context.
3. `SubagentStart` injects the same continuation foundation into spawned
   agents and requires a guard on their assigned topic.
4. Startup, resume, clear, and compact all re-inject the foundation.
5. Hook state is temporary machine state. It is not authoritative memory.
6. Any gateway/inbox/guard failure is surfaced as **unavailable**, never as
   verified absence.

## Authority Boundaries

- The hook reads and injects context; it does not approve, classify, weight,
  or persist knowledge.
- Kevin remains the only confirmer and handle-naming authority.
- The Context Agent still proposes rather than asserts.
- `agent_operations.chat_registry` remains thread identity authority.
- The hook never invents `chat_number`.
- Application runtime remains direct-store and does not depend on these hooks
  or the Universal Gateway.

## Implementation

- `.codex/hooks.json`
- `.claude/settings.json`
- `server/scripts/agent-context-hook.mjs`
- `server/src/lib/__tests__/agentContextHook.test.ts`
- `knowledge/CONTINUATION_CONTEXT.md`
- ACR-0014 and agent briefing references updated to describe the automatic
  lifecycle and manual fallback.

## Verification

- Deterministic subprocess tests cover SessionStart, first prompt, greeting /
  `continue` handling, one-time guard behavior, context bounds, and
  SubagentStart.
- Direct live invocation retrieved the Intervector inbox and a 46-hit memory
  guard report from the memory stack.
- Claude Code 2.1.202 emitted successful `SessionStart` and
  `UserPromptSubmit` hook responses containing the ACR-0017 context, then
  completed its smoke prompt.
- Codex CLI accepted the project configuration and completed a new-session
  smoke prompt. Codex intentionally does not execute project hooks until the
  user approves them once in `/hooks`; that product trust boundary is retained
  and documented rather than bypassed.
- Focused tests and repo-wide typecheck passed locally. Build, full server
  tests, and GitHub Actions merge gates remain publication gates for this PR.

## Rollback

Remove `.codex/hooks.json` and `.claude/settings.json`. The underlying
ACR-0014 on-demand commands remain available, so rollback removes automatic
delivery without losing the memory system.
