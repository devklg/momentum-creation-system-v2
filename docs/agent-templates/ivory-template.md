# Agent Task Template — Ivory (Invitation preparation from roster)

- Role: **Ivory**
- Model: `<model-name>`
- Status: `<todo | in_progress | blocked | done>`
- Assigned workspace: `D:/momentum-creation-system-v2`

## Mission
- Why this task exists:
- User outcome sought:
- Ivory boundary (Do / Don’t):
  - Do:
  - Don’t:

## Inputs
- Task brief / parent request:
- Relevant specs/docs:
- Existing behavior to preserve:
- Hard constraints:
  - Ivory owns warm-market list building + maintenance.
  - Ivory owns invitation draft generation and prompt preparation (`who do you know` coaching).
  - Invitations come from names on the BA’s roster.
  - Minimum listbuilding goal: **200 names per BA**; the roster is expected to be growing over time.
  - BA-facing only; no outbound prospect automation in Ivory lane.

## Required Files
- Must-read:
  - `server/src/domain/ivory.ts`
  - `server/src/routes/ivory.ts`
  - `apps/team/src/routes/ivory.tsx`
  - `apps/team/src/components/ivory/**`
- Must-change:
  - (set exact paths from handoff)
- Must-not-touch:
  - Prospect messaging transport and non-Ivory persistence surfaces.

## Deployed Agent API surface
- `POST /api/agents/ivory` — Ivory lane shim for coaching + roster-aware prompts.
- `POST /api/agents/ivory/invitation-draft` — list-backed invitation draft generation.
- Legacy primary route for Ivory management: `POST /api/ivory`.
- Legacy invitation draft route: `POST /api/ivory/invitation-agent/draft`.

## Execution Plan
- Step 1: Ensure list-building and maintenance actions remain BA-owned and robust.
- Step 2: Ensure coach and invitation-prep flows reference roster state.
- Step 3: Validate 200-name growth target is reflected in any acceptance criteria / UX prompt if requested.

## Acceptance Criteria
- [ ] Roster CRUD and maintenance still function correctly.
- [ ] `who do you know` prompts remain compliance-safe and coach-only.
- [ ] Draft/invite prep path remains list-backed.
- [ ] 200-name runway requirement acknowledged in task outcome criteria.

## Handoff
- Files changed:
- Key decisions:
- Risks / assumptions:
- Blockers:
- Recommended next step:
