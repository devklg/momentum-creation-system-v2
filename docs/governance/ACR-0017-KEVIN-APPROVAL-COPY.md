# ACR-0017 — Kevin Approval Copy

**Decision status:** APPROVED AS IS  
**Decision owner:** Kevin L. Gardner  
**Presented for consideration:** 2026-07-13  
**Approved:** 2026-07-13, by Kevin L. Gardner in the Codex task  
**Approval statement:** “approved, as is”  
**Implementation status:** Code was merged before this approval copy was presented. The defined hook scope is now approved; Codex may still require its one-time project-hook trust confirmation through `/hooks`.

## The decision being requested

Do you approve this repository automatically loading its existing context and memory for Codex and Claude Code at defined agent lifecycle events?

Approval would authorize the repository hook to execute:

`server/scripts/agent-context-hook.mjs`

It would run at these events:

1. **SessionStart** — when an agent session starts, resumes, clears, or compacts.
2. **UserPromptSubmit** — on the first substantive user prompt in a session.
3. **SubagentStart** — when a subagent starts.

## What the hook reads

- `knowledge/CONTINUATION_CONTEXT.md`
- Current Git branch and latest commit
- Up to five unread Intervector messages addressed to the current agent or `all`
- Existing memory records returned by the approved context guard for the prompt topic

## What the hook does

- Injects the continuation foundation into the agent's working context.
- Alerts the agent when unread Intervector messages exist.
- Runs the existing topic-specific memory guard on the first substantive prompt.
- Reminds the agent that Kevin is the authority and agent-authored material is not Kevin approval.
- Stores a temporary local session marker indicating whether the first-prompt guard has run.

## What this approval would NOT authorize

- It does not approve, classify, categorize, or vet any knowledge for Kevin.
- It does not add retrieved material to the production application.
- It does not publish or distribute content.
- It does not modify knowledge records.
- It does not mark Intervector messages as read or actioned.
- It does not send messages to another agent.
- It does not authorize unrelated repository commands.
- It does not replace Kevin's approval of application content or implementation priorities.

## External and local access

- Reads the local repository and Git metadata.
- Calls the local Universal Gateway endpoint to query the MongoDB Intervector inbox.
- Runs the existing repository context guard, which queries the configured memory stack.
- Writes only a temporary first-prompt session marker under the operating system's temporary directory.

## Failure behavior

If the inbox or memory guard is unavailable, the hook reports that context is unavailable. It instructs the agent not to claim that no context exists and to perform the required manual check.

## Codex trust prompt

Codex requires Kevin to review and trust the project hook through `/hooks`. Trusting the hook permits the three lifecycle executions described above. Kevin approved this scope as is on 2026-07-13; the `/hooks` confirmation completes Codex's separate executable-trust step if it is still presented.

## How to withdraw approval

Kevin can revoke Codex project-hook trust or remove/disable the entries in `.codex/hooks.json`. Claude Code execution is controlled separately through `.claude/settings.json`.

## Kevin's decision

- [x] Approved as written
- [ ] Approved with changes listed below
- [ ] Not approved

Changes or conditions:

______________________________________________________________________________

Decision date: 2026-07-13

Kevin L. Gardner: Approved in Codex task — “approved, as is”
