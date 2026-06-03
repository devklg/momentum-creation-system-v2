# Travel Checkpoint

Date: 2026-06-03

## Repository State

- v1 is stable: `momentum-creation-system-v1` remains the completed stable
  version.
- v2 is redesign workspace: `momentum-creation-system-v2` is separated for
  UX/styling redesign work only.
- Current repo: `momentum-creation-system-v2`
- Current branch: `ux-redesign-v2`
- GitHub repo: `https://github.com/devklg/momentum-creation-system-v2`

## Completed Review Docs

Review packet copied into `docs/v2-redesign/`:

- `BRAND_VISUAL_REVIEW.md`
- `DASHBOARD_UX_REVIEW.md`
- `IVORY_INVITATION_AGENT_REVIEW.md`
- `PROSPECT_MOMENTUM_VIEWER_REVIEW.md`
- `TEAM_ONBOARDING_REVIEW.md`
- `MASTER_UX_IMPLEMENTATION_SPEC.md`

Root planning docs created:

- `MASTER_UX_IMPLEMENTATION_SPEC.md`
- `TRAVEL_CHECKPOINT.md`

## Working Boundaries

- Do not implement redesign changes until explicitly requested.
- Do not modify v1.
- Do not rebuild backend logic unless required by a verified UX gap.
- Preserve token placement.
- Preserve CRM ownership.
- Preserve invitation spine.
- Preserve compliance boundaries.

## Next Implementation Phases

1. Phase 0: Audit and Safety Map
   - Token resolution.
   - Click/video progress events.
   - Placement idempotency.
   - Cockpit/PMV projection.
   - Invitation source fields.
   - Ivory source flow.
   - CRM BA ownership.

2. Phase 1: Shared Brand and Motion Foundation
   - Team Magnificent shell/header.
   - Logo primitives.
   - Gold/teal roles.
   - Countdown, ticker, counter, progress, and status primitives.
   - Reduced-motion support.

3. Phase 2: Prospect Position & Momentum Center
   - First viewport dashboard.
   - Position card.
   - Beneath-you counter.
   - Rolling ticker.
   - Countdown.
   - Primary CTA.
   - Preserve existing content below.

4. Phase 3: PMV Backend Projection
   - Granular lifecycle states.
   - Video progress visibility.
   - Focus Queue data.
   - Deterministic next action.
   - Today’s Actions alignment.

5. Phase 4: PMV Frontend Redesign
   - Focus Queue.
   - Prospect Momentum Table.
   - Row drawer.
   - Next-action display.
   - CRM controls preserved.

6. Phase 5: Ivory Invitation Agent
   - Relationship-first flow.
   - Person/CRM merge.
   - Relationship reason.
   - Editable draft.
   - Minted link.
   - Copy/send screen.
   - PMV visibility.

7. Phase 6: Team Launch Center
   - New-BA launch checklist.
   - Michael status card.
   - First Invitation mission.
   - Welcome handoff.
   - Questionnaire wizard.

8. Phase 7: QA and Compliance
   - Responsive QA.
   - Reduced-motion QA.
   - Token journey QA.
   - PMV ownership QA.
   - Ivory flow QA.
   - Compliance copy audit.

## Exact Codex Agent Order

1. Audit Agent
   - Map current token, video, placement, source, CRM, and brand contracts.
   - No UI edits.

2. Brand Foundation Agent
   - Build shared Team Magnificent shell, logo, motion, countdown, ticker,
     counter, progress, and badge primitives.

3. Prospect Dashboard Agent
   - Build the Position & Momentum Center and preserve existing dashboard
     content below it.

4. PMV Backend Agent
   - Build PMV projection, lifecycle visibility, Focus Queue data, and next
     action rules.

5. PMV Frontend Agent
   - Redesign cockpit into the Prospect Momentum Viewer.

6. Ivory Agent
   - Convert Ivory into the relationship-first Invitation Agent using the
     existing invitation spine.

7. Launch Center Agent
   - Build the Team Launch Center and questionnaire wizard.

8. QA/Compliance Agent
   - Run functional, visual, mobile, reduced-motion, CRM scoping, and compliance
     checks before release.

## Current Stop Point

Documentation checkpoint only. No redesign implementation has begun.
