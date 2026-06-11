# Travel Checkpoint

Date: 2026-06-11

## Repository State

- v1 is stable: `momentum-creation-system-v1` remains the completed stable version.
- v2 is redesign workspace: `momentum-creation-system-v2` is separated for UX/styling redesign work only.
- Current repo: `momentum-creation-system-v2`
- Local repo path: `D:\momentum-creation-system-v2`
- Current branch: `task-4-pmv-backend`
- v2 integration branch: `main` after GitHub removed the remote `ux-redesign-v2` branch during the Task 2 merge flow.
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

- Status: completed, reviewed, and merged. GitHub then merged `ux-redesign-v2` into `main` and removed the remote `ux-redesign-v2` branch; `main` at `1cecad7` is the current merged v2 base.
- Branch: `task-2-brand-motion`
- Allowed files touched: shared brand tokens/CSS, `.com` and `.team` CSS entry points, `.com` and `.team` Tailwind configs, and this checkpoint.
- Application route pages changed: no
- Backend/server changed: no
- Primitives added: logo asset classes, Team Magnificent shell, command ribbon, progress meter, animated counter, rolling ticker, countdown, status badges, lifecycle badges, rise motion, and live pulse motion.
- Brand roles established: gold for identity/ceremony; teal for live state, action, motion, and progress.
- Reduced-motion behavior: shared motion primitives stop animation and progress transitions under `prefers-reduced-motion: reduce`.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`, plus `.team` chunk-size warning for a 516.40 kB minified JS bundle.

Task 3: Prospect Position & Momentum Center

- Status: completed, reviewed, and merged.
- Branch: `task-3-prospect-dashboard`
- Base used: `origin/main` at `1cecad7` because remote `ux-redesign-v2` no longer exists after PR #8; this base contains merged Task 2.
- Allowed files touched: `.com` prospect dashboard composer, LivePlace anchor id, YourNextMove anchor id, and this checkpoint.
- Backend/server changed: no
- Token, placement, invitation, CRM, and source tracking logic changed: no
- First viewport now includes: Team Magnificent logo ribbon signal, prospect identity/inviter context, position card, beneath-you live counter, next-event countdown, primary talk-to-BA action, live placement ticker, and compact live stats when team stats load.
- Preserved below center: Arrival, Opportunity, Mechanic, Live Place, Team Magnificent Advantage, full callback/webinar flows, and footer.
- Compliance scan: no new income, spillover, CV, cycle, rank, placement-promise, automated outreach, AI qualification, or auto-send language added. Existing market-stat dollar figures remain in the preserved Opportunity section from the prior approved dashboard content.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts` now also lists the dashboard composer because the new center fetches compact team stats; `.team` chunk-size warning for a 516.51 kB minified JS bundle.

Task 4: PMV Backend Projection

- Status: implemented on `task-4-pmv-backend`; ready for PR review after final branch push.
- Branch: `task-4-pmv-backend`
- Base used: `origin/main` after PR #9 merged Task 3.
- Allowed files touched: server cockpit/token/prospect routes, shared type contracts, and this checkpoint.
- Apps changed: no
- Prospect-facing page design changed: no
- Invitation spine, CRM ownership, token placement, and source tracking changed: no
- New endpoint: `GET /api/cockpit/pmv`
- PMV response shape: `{ ok, generatedAt, focusQueue, rows, lifecycleGaps }`
- PMV row fields include: granular lifecycle, token state, video progress percent, click/open timestamp, source, last signal, CRM summary, follow-up due state, latest callback intent, and deterministic next action.
- Lifecycle mapping includes: `draft`, `sent_unopened`, `clicked`, `video_started`, `video_25`, `video_50`, `video_75`, `watched`, `callback_requested`, `customer`, `enrolled`, `expired`, and `archived`.
- Click/open stamping: `GET /api/p/:token` now idempotently stamps `invite_tokens.clickedAt` and advances `minted -> clicked` after terminal/expired checks.
- Today’s Actions alignment: `/api/cockpit/todays-actions` now derives from the same PMV projection rules used by the Focus Queue.
- Next actions are deterministic, explainable, BA-sent/manual only, and include no AI qualification, prospect ranking, auto-prospecting, automated calling, or auto-sending.
- Verified backend gaps: per-milestone historical timestamps are not stored; PMV uses `invite_tokens.updatedAt` for the current partial video milestone. Archived rows appear only when a BA-owned prospect carries `deleted=true`; existing BA CRM still has no self-restore path.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`; `.team` chunk-size warning for a 516.51 kB minified JS bundle.

## Next Implementation Phases

1. Task 5: PMV cockpit frontend
   - Focus Queue.
   - Prospect Momentum Table.
   - Row drawer.
   - Next-action display.
   - CRM controls preserved.

2. Task 6: Ivory Invitation Agent
   - Relationship-first BA-controlled invitation flow.
   - Person/CRM merge.
   - Relationship reason.
   - Editable draft.
   - Minted link through the existing spine.
   - Copy/send screen.
   - PMV visibility.

3. Task 7: Team Launch Center
   - New-BA launch checklist.
   - Michael status card.
   - First Invitation mission.
   - Welcome handoff.

4. Task 8: Questionnaire wizard / welcome shortening
   - Guided questionnaire wizard.
   - Shorter welcome ceremony.
   - Launch Center handoff.

5. Task 9: QA and compliance pass
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

Task 4 PMV backend projection has been implemented and verified. Next step is PR review/merge before beginning Task 5.


