# Agent Task Template — Cockpit UI

- Role: **Cockpit UI**
- Model: `<model-name>`
- Status: `<todo | in_progress | blocked | done>`
- Assigned workspace: `D:/momentum-creation-system-v2`

## Mission
- Why this task exists:
- User outcome sought:
- UI boundary (Do / Don’t):
  - Do:
  - Don’t:

## Inputs
- Task brief / parent request:
- Relevant specs/docs:
- Existing behavior to preserve:
- Hard constraints:
  - Preserve existing auth/route guards.
  - No change to domain business rules beyond display behavior unless explicitly requested.
  - Keep components read-only unless user asks for persistence changes.

## Required Files
- Must-read:
  - `apps/team/src/routes/cockpit.tsx`
  - Relevant component files under `apps/team/src/components/cockpit/`
- Must-change:
  - (set exact paths from handoff)
- Must-not-touch:
  - `server/src/routes` domain routes unless coordinated as backend dependency.

## Execution Plan
- Step 1: Implement requested UI state/flow only.
- Step 2: Keep state transitions explicit and hook dependency-safe.
- Step 3: Report backend expectations if any data contract changes are needed.

## Acceptance Criteria
- [ ] UI renders requested states for loading/error/success.
- [ ] Input behavior and ask/submission states are intentional and scoped.
- [ ] No unrelated surfaces changed.

## Handoff
- Files changed:
- Key decisions:
- Risks / assumptions:
- Blockers:
- Recommended next step:
