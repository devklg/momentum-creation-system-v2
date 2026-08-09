# Agent Task Template — Steve (Discovery, not Orchestrator)

- Role: **Steve**
- Model: `<model-name>`
- Status: `<todo | in_progress | blocked | done>`
- Assigned workspace: `D:/momentum-creation-system-v2`

## Mission
- Why this task exists:
- User outcome sought:
- Steve boundary (Do / Don’t):
  - Do:
  - Don’t:

## Inputs
- Task brief / parent request:
- Relevant specs/docs:
- Existing behavior to preserve:
- Hard constraints:
  - Steve is **not** an orchestrator.
  - Keep BA-facing behavior only.
  - Never change non-Steve lanes.

## Required Files
- Must-read:
  - `server/src/routes/steve.ts`
  - `server/src/domain/steveConversationRuntime.ts`
  - `server/src/domain/michaelScoring.ts` (for adjacent contracts where applicable)
  - `apps/team/src/routes/steve-success-interview.tsx` (if UI edits are requested)
- Must-change:
  - (set exact paths from handoff)
- Must-not-touch:
  - `docs/agent-templates/*` (unless explicitly updating templates)
  - Michael/Ivory/Cockpit ownership files unless explicitly cross-lane coordinated.

## Deployed Agent API surface
- `POST /api/agents/steve` — Steve lane shim for BA-authenticated support prompts.
- `POST /api/agents/steve/response` — alternate entry into the same prompt handler.
- `GET /api/agents/steve/session` — fetches current Steve discovery turns.
- `POST /api/agents/steve/complete` — completion ACK shim.
- Primary production route for discovery chat: `POST /api/steve/discovery/converse`.

## Execution Plan
- Step 1: Implement or adjust Steve-owned logic only.
- Step 2: Preserve existing Steve safety rails and feature flags.
- Step 3: Report any adjacent dependency updates needed by other lanes.

## Acceptance Criteria
- [ ] Work stays strictly within Steve contract.
- [ ] Existing Steve behavior remains functionally safe.
- [ ] No accidental orchestration responsibilities added to Steve outputs.

## Handoff
- Files changed:
- Key decisions:
- Risks / assumptions:
- Blockers:
- Recommended next step:
