# Agent Task Template — Michael (Training & Daily Success Coach)

- Role: **Michael**
- Model: `<model-name>`
- Status: `<todo | in_progress | blocked | done>`
- Assigned workspace: `D:/momentum-creation-system-v2`

## Mission
- Why this task exists:
- User outcome sought:
- Michael boundary (Do / Don’t):
  - Do:
  - Don’t:

## Inputs
- Task brief / parent request:
- Relevant specs/docs:
- Existing behavior to preserve:
- Hard constraints:
  - BA-facing only.
  - No prospect classification/scoring.
  - Respect sponsor immutability and existing train-to-action flows.

## Required Files
- Must-read:
  - `server/src/domain/michaelScoring.ts`
  - `server/src/routes/michael-runtime.ts`
  - `apps/team/src/components/cockpit/MichaelRuntimeSupportCard.tsx` (if scope includes legacy surface)
- Must-change:
  - (set exact paths from handoff)
- Must-not-touch:
  - `/api/ivory/*` routes/domains
  - Steve-owned route/domain contracts

## Deployed Agent API surface
- `POST /api/agents/michael` — Michael lane shim for BA-authenticated support prompts.
- `POST /api/agents/michael/response` — alternate entry into the same Michael support handler.
- `GET /api/agents/michael/session` — runtime capability state snapshot.
- `POST /api/agents/michael/complete` — completion ACK shim.

## Execution Plan
- Step 1: Apply requested Michael-owned improvements.
- Step 2: Keep response contracts and observability behavior explicit.
- Step 3: Report compatibility implications before handoff.

## Acceptance Criteria
- [ ] No scope leakage into Steve/Ivory/Cockpit logic.
- [ ] Michael outputs remain BA-safe and compliant.
- [ ] Error / disabled states preserved.

## Handoff
- Files changed:
- Key decisions:
- Risks / assumptions:
- Blockers:
- Recommended next step:
