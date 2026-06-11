# Travel Checkpoint

Date: 2026-06-11

## Repository State

- v1 is stable: `momentum-creation-system-v1` remains the completed stable version.
- v2 is redesign workspace: `momentum-creation-system-v2` is separated for UX/styling redesign work only.
- Current repo: `momentum-creation-system-v2`
- Local repo path: `D:\momentum-creation-system-v2`
- Current branch: `task-2-brand-motion`
- v2 integration branch: `ux-redesign-v2`
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
- `IMPLEMENTATION_TASKS.md`
- `TRAVEL_CHECKPOINT.md`

Task 1 audit doc created:

- `docs/v2-redesign/audits/SAFETY_AUDIT.md`

## Working Boundaries

- Do not modify v1.
- Do not rebuild backend logic unless required by a verified UX gap.
- Preserve token placement.
- Preserve CRM ownership.
- Preserve invitation spine.
- Preserve compliance boundaries.
- Ivory may create invitations for BA-selected names through the existing spine.
- Do not introduce AI lead qualification, prospect ranking, automated prospecting, automated calling, or auto-sending.

## Current Task Status

Task 1: Safety Audit

- Status: completed and merged into `ux-redesign-v2`.
- Branch: `task-1-safety-audit`
- Allowed files touched: `docs/v2-redesign/audits/SAFETY_AUDIT.md`, `TRAVEL_CHECKPOINT.md`
- Application code changed: no
- Verification: `pnpm install`, `pnpm typecheck`, and `pnpm build` completed. Build warnings were non-blocking Vite chunk warnings.

Task 2: Shared Brand/Motion Primitives

- Status: implemented on `task-2-brand-motion`; ready for PR review into `ux-redesign-v2`.
- Branch: `task-2-brand-motion`
- Allowed files touched: shared brand tokens/CSS, `.com` and `.team` CSS entry points, `.com` and `.team` Tailwind configs, and this checkpoint.
- Application route pages changed: no
- Backend/server changed: no
- Primitives added: logo asset classes, Team Magnificent shell, command ribbon, progress meter, animated counter, rolling ticker, countdown, status badges, lifecycle badges, rise motion, and live pulse motion.
- Brand roles established: gold for identity/ceremony; teal for live state, action, motion, and progress.
- Reduced-motion behavior: shared motion primitives stop animation and progress transitions under `prefers-reduced-motion: reduce`.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`, plus `.team` chunk-size warning for a 516.40 kB minified JS bundle.

## Next Implementation Phases

1. Task 3: Prospect Position & Momentum Center
   - First viewport dashboard.
   - Position card.
   - Beneath-you counter.
   - Rolling ticker.
   - Countdown.
   - Primary CTA.
   - Preserve existing content below.

2. Task 4: PMV backend projection
   - Granular lifecycle states.
   - Video progress visibility.
   - Focus Queue data.
   - Deterministic next action.
   - Today's Actions alignment.

3. Task 5: PMV cockpit frontend
   - Focus Queue.
   - Prospect Momentum Table.
   - Row drawer.
   - Next-action display.
   - CRM controls preserved.

4. Task 6: Ivory Invitation Agent
   - Relationship-first BA-controlled invitation flow.
   - Person/CRM merge.
   - Relationship reason.
   - Editable draft.
   - Minted link through the existing spine.
   - Copy/send screen.
   - PMV visibility.

5. Task 7: Team Launch Center
   - New-BA launch checklist.
   - Michael status card.
   - First Invitation mission.
   - Welcome handoff.

6. Task 8: Questionnaire wizard / welcome shortening
   - Guided questionnaire wizard.
   - Shorter welcome ceremony.
   - Launch Center handoff.

7. Task 9: QA and compliance pass
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
   - Build shared Team Magnificent shell, logo, motion, countdown, ticker, counter, progress, and badge primitives.

3. Prospect Dashboard Agent
   - Build the Position & Momentum Center and preserve existing dashboard content below it.

4. PMV Backend Agent
   - Build PMV projection, lifecycle visibility, Focus Queue data, and next action rules.

5. PMV Frontend Agent
   - Redesign cockpit into the Prospect Momentum Viewer.

6. Ivory Agent
   - Convert Ivory into the relationship-first Invitation Agent using the existing invitation spine.

7. Launch Center Agent
   - Build the Team Launch Center and questionnaire wizard.

8. QA/Compliance Agent
   - Run functional, visual, mobile, reduced-motion, CRM scoping, and compliance checks before release.

## Current Stop Point

Task 2 brand/motion primitives have been implemented and verified. Next step is PR review/merge into `ux-redesign-v2`; do not begin Task 3 until that PR is reviewed and merged.


