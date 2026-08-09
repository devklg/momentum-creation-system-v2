# Agent Task Template — Coordinator (Cross-lane Orchestrator)

- Role: **Coordinator**
- Model: `<model-name>`
- Status: `<todo | in_progress | blocked | done>`
- Assigned workspace: `D:/momentum-creation-system-v2`

## Mission
- Why this task exists:
- User outcome sought:
- Priority and scope boundary:
  - Do:
  - Don’t:

## Inputs
- Task brief / parent request:
- Relevant specs/docs:
- Existing behavior to preserve:
- Hard constraints:
  - No cross-lane merge conflicts.
  - No change ownership overlap with role lanes.

## Required Files
- Must-read:
  - `docs/README.md` or project brief file
  - `docs/AGENT-BRIEFING.md`
- Must-change:
  - (set exact paths from handoff)
- Must-not-touch:
  - Shared route contracts unless explicitly requested.
  - Decision-ledger or lockfile files unless requested.

## Execution Plan
- Step 1: Split and assign role-specific tasks with exact file targets.
- Step 2: Merge role handoffs into one sequence and remove overlaps.
- Step 3: Publish a single handoff with risks and next decisions needed.

## Coordination Rules (non-negotiable)
- Role boundaries must be explicit before work.
- Conflict resolution order:
  1. Locked spec / decision ledger
  2. Current task brief
  3. Existing code and runtime contracts
- No assumptions about role ownership — use this template’s role field.

## Acceptance Criteria
- [ ] All delegated role outputs include file-level diffs.
- [ ] Delivery includes one consolidated handoff summary.
- [ ] No role exceeds its scope.
- [ ] Unresolved questions are explicitly listed.

## Handoff
- Files changed:
- Key decisions:
- Risks / assumptions:
- Blockers:
- Recommended next action:

