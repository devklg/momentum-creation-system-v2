# Momentum Creation System V2 — Continuation Context

Status: living operational handoff, not ratified architecture

Updated: 2026-07-13

Workspace: `D:/momentum-creation-system-v2`

Current verified `main`: `12dfcfb7` (feature PR #267 plus catalog-refresh PR #268)

## Paste This Into the New Agent

You are continuing implementation of Team Magnificent Momentum Creation System
V2 in `D:/momentum-creation-system-v2`. Do not begin from general assumptions
and do not redesign the platform.

First, read and obey the repository `AGENTS.md`. Process the Intervector inbox
before substantive work, including unread high-priority messages in
`universal_gateway.agent_message_board`. Then run:

```powershell
git status --short --branch
git log --oneline --max-count=12
pnpm memory:guard "P2-107 unified follow-up queue"
```

Read these operational sources before deciding or editing:

1. `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`
2. `docs/READ-ME-FIRST.md`
3. `docs/AGENT-BRIEFING.md`
4. the relevant section of `docs/locked-spec.md`
5. `docs/governance/ACR-0014-context-agent.md`
6. `docs/handoff-contract.md`
7. this file

### Governing priority

Kevin explicitly corrected the work-selection rule: the
`PLATFORM_AUDIT_PRIORITY_TASKLIST.md` implementation-priority audit determines
what is done next. Do not use the leaf generator or regenerate the leaf queue
to choose work. Do not drift back to an older wireframe leaf merely because it
is available.

The single front-of-line item is:

> P2-107 — Build a unified follow-up queue.

Items P2-104, P2-105, and P2-106 are complete. Start P2-107 by retrieving
existing context and reading the current CRM, callback, webinar, event,
orientation, notification, and admin/team follow-up surfaces. Reuse existing
contracts and persistence helpers. Do not create a parallel follow-up system.

### Current shipped state

- P2-104 Event Center BA/admin UI merged in PR #261.
- P2-105 normalized Event Center model merged in PR #263.
- `docs/VISUAL_TEST_AUDIT.md`, the complete production visual test audit,
  merged in PR #265.
- P2-106 explicit webinar attendance to human CRM follow-up merged in PR #267.
- Generated catalogs were regenerated separately after merge in PR #268.
- `main` was clean and synchronized after PR #268 at `12dfcfb7`.

P2-106 behavior is intentionally human-centered:

- Kevin/admin explicitly records `attended`, `missed`, or `rescheduled` for an
  existing webinar reservation.
- A reservation or elapsed time never infers attendance.
- Existing active BA CRM reminders are preserved.
- If none exists, the system schedules a human CRM reminder for 24 hours later.
- It sends no message, makes no call, assigns no disposition, and performs no
  agent classification.
- Attendance is append-only through the operational persistence tier to MongoDB,
  Neo4j, and ChromaDB.

Relevant P2-106 sources include:

- `organization/ACR-0016-event-attendance-crm-follow-up.md`
- `docs/event-center-product-boundary.md`
- `packages/shared/src/event-center.ts`
- `server/src/domain/eventAttendance.ts`
- `server/src/domain/eventCenter.ts`
- `server/src/domain/crm.ts`
- `server/src/routes/admin/events.ts`
- `apps/admin/src/routes/events.tsx`

### Kevin's authority and knowledge boundary

- Kevin decides implementation priority.
- When Kevin attaches a knowledge source, the attachment itself is his approval
  to place it into the app knowledge intake. Agents do not vet or approve it.
- Knowledge already ingested may still require Kevin's categorization. Agents
  may expose classification controls or preserve an uncategorized state, but
  must not classify on Kevin's behalf.
- Do not describe Kevin's action as “explicitly attaching an approved source.”
  His attachment is the approval.
- The app is currently in production on the web. Avoid destructive production
  writes during testing. Prefer read-only production inspection and local/test
  mutations unless Kevin directly authorizes a production mutation.

### Coordination boundaries

- Claude Code is building the deployment-monitoring agent. Check the
  Intervector message board for its current handoff before touching deployment
  monitoring, health monitoring, the VM dialer, or agent memory. Do not duplicate
  that lane.
- Treat generated route/schema/catalog artifacts as structural conflict magnets.
  Change generator source when required, validate generated output ephemerally,
  and let the protected post-merge catalog-refresh workflow commit artifacts.
- Feature work uses a `codex/` branch, focused tests, repo-wide typecheck/build,
  GitHub Actions merge gates, then merge. Do not merge when gates fail.

### Persistence and continuity foundation

This prompt is a readable entry point, not a replacement for durable memory.
The existing continuity system is:

- canonical thread identity: `agent_operations.chat_registry`
- canonical handoff content: `universal_gateway.session_handoffs`, linked to a
  registry row under `docs/handoff-contract.md`
- semantic and graph mirrors: ChromaDB and Neo4j
- cross-agent coordination: `universal_gateway.agent_message_board`
- retrieval-before-invention: `pnpm memory:guard "<topic>"`
- Context Agent lifecycle: guard → parse → propose → Kevin confirms → write and
  verify → close with one `front_of_line`

Do not invent a chat number. If the Codex/Claude thread has not been assigned a
verified integer by the registry, retain `chat_number: null` and
`registration_status: needs_reconciliation`. The registry is the identity
authority; Perry, ARCHIE, Chroma, GraphRAG, and a prompt are not.

### Required working method for P2-107

1. Run the context guard for the unified follow-up queue.
2. Inspect existing follow-up producers and consumers before designing.
3. Define one shared queue contract and ownership boundary; avoid parallel
   records that drift from CRM truth.
4. Preserve human ownership. No AI qualification, automated prospecting,
   automated calling, or inferred urgency/classification.
5. Use the app's direct MongoDB + Neo4j + ChromaDB persistence adapters for
   runtime writes, never the Universal Gateway as a production dependency.
6. Add focused domain/API/UI tests and run `pnpm typecheck`, `pnpm build`, and
   the relevant server/UI suites.
7. Update audit item 107 only when implementation and verification are real.
8. Commit and publish only the intended source changes. Let post-merge
   automation own generated catalogs.

When P2-107 is complete, close the next handoff through the Context Agent
contract with an evidence-backed summary, ordered priorities, and exactly one
new `front_of_line` from the implementation-priority audit.

## Authority of This File

This file is living operational context. It may summarize verified state and
provide a continuation prompt, but it cannot override the Constitution, active
decision ledger, locked specification, approved ACRs, or Kevin's direct
instruction. Update it after major work so the next agent starts from current
truth rather than reconstructing the session.
