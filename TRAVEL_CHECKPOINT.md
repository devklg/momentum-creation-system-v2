# Travel Checkpoint

Date: 2026-06-11

## Repository State

- v1 is stable: `momentum-creation-system-v1` remains the completed stable version.
- v2 is redesign workspace: `momentum-creation-system-v2` is separated for UX/styling redesign work only.
- Current repo: `momentum-creation-system-v2`
- Local repo path: `D:\momentum-creation-system-v2`
- Current branch: `task-8-questionnaire-welcome`
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

- Status: completed, reviewed, and merged.
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

Task 5: PMV Cockpit Frontend

- Status: completed, reviewed, and merged.
- Branch: `task-5-pmv-frontend`
- Base used: `origin/main` after Task 4 merged.
- Allowed files touched: `.team` cockpit route and this checkpoint.
- Backend/server changed: no
- `.com` prospect-facing pages changed: no
- Shared contracts changed: no
- First viewport now centers: Team Magnificent PMV header, counts strip, Focus Queue, status filters, and Prospect Momentum Table.
- PMV table collapsed rows show: source, lifecycle/stage, video progress, last signal, next action, follow-up state, and priority.
- CRM controls preserved in the row drawer: link copy, saved message/source, activity timeline, "I sent this", disposition, follow-up reminders, notes, re-invite, re-invite script, edit, and remove.
- Secondary surfaces preserved below PMV: Track Record, My Sponsor, Orientation, CRM helper copy, and Leadership.
- Status filters added: All, Needs action, Sent, Watching, Watched, and Closed.
- Compliance scan: no AI lead qualification, prospect ranking, automated prospecting, automated calling, auto-send, income, spillover, CV, cycle, rank, or placement-promise language added.
- Browser QA: attempted with the in-app browser against existing local `7702`/`7700` dev servers, but the browser runtime failed during setup with a Windows sandbox refresh error. Typecheck/build remain the verification source for this task.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`; `.team` chunk-size warning for a 521.89 kB minified JS bundle.

Task 6: Ivory Invitation Agent

- Status: completed, reviewed, and merged.
- Branch: `task-6-ivory-invitation-agent`
- Base used: `origin/main` after Task 5 merged.
- Allowed files touched: `.team` Ivory route, invitation route seam, Ivory/generator/invitation backend domains and routes, shared type contracts, and this checkpoint.
- `.com` prospect-facing pages changed: no
- Token/placement backend changed: no
- Ivory first viewport no longer presents `Roster + Coach + Generator`; it starts with one relationship-selected person.
- Ivory state machine: select/create one person -> capture relationship reason -> draft one editable message -> capture real CRM fields -> mint through the invitation spine -> copy message/link -> "I sent this".
- Stored fields added to the invitation spine: `relationshipReason` alongside existing `message` and `source`.
- Invitation spine integration: Ivory mint calls `createInvitation()` with `source: "ivory"`, requires real city/state/phone, stores the BA-edited message, stamps the Ivory name as invited, and preserves BA-owned manual sending.
- PMV visibility: minted prospects enter the existing PMV projection through the normal prospects/invite_tokens records with `source: "ivory"` and stored relationship context.
- Placeholder CRM gap closed for the legacy Generator mint path: Ivory-origin mints now require real city/state/phone before creating prospect records.
- Compliance scan: no AI lead qualification, prospect ranking, automated prospecting, automated calling, auto-send, income, spillover, CV, cycle, rank, placement-promise, or dollar claims added.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`; `.team` chunk-size warning for a 512.33 kB minified JS bundle.

Task 7: Team Launch Center

- Status: completed, reviewed, and merged.
- Branch: `task-7-team-launch-center`
- Base used: `origin/main` after Task 6 merged and the prior branch was deleted.
- Allowed files touched: `.team` cockpit route, new `.team` launch component directory, Michael schedule handoff, cockpit backend route/domain, shared type contracts, and this checkpoint.
- `.com` prospect-facing pages changed: no
- Token/placement backend changed: no
- Invitation spine, CRM ownership, source tracking, and compliance boundaries changed: no
- New endpoint: `GET /api/cockpit/launch`, auth-only so new BAs can see Launch Center state before the Michael gate.
- Launch steps: welcome accepted, Michael scheduled, Michael complete, Day 1 started, Day 1 complete, Who Do You Know list started, first invitation drafted, first invitation minted, first invitation sent, questionnaire submitted, and optional sponsor connection.
- Source of step truth: `ba_commitments`, `michael_schedules`, `fast_start_progress`, `ivory_names`, existing `prospects` / `invite_tokens` spine via `listInvitesForBA`, `ba_questionnaires`, and immutable sponsor on `brand_ambassadors`.
- New-BA path: `/cockpit` loads Launch Center first, avoids gated PMV calls until Michael is complete, and shows one dominant next action.
- First Invitation mission appears before operational PMV metrics when the BA has not minted an invitation link.
- Operational PMV remains available below Launch Center once Michael is complete; CRM row controls remain unchanged.
- Michael completion handoff now returns BAs to `/cockpit` / Launch Center.
- Compliance scan: no AI lead qualification, prospect ranking, automated prospecting, automated calling, auto-send, income, spillover, CV, cycle, rank, placement-promise, or dollar claims added.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`; `.team` chunk-size warning for a 523.04 kB minified JS bundle.

Task 8: Questionnaire Wizard / Welcome Shortening

- Status: implemented on `task-8-questionnaire-welcome`; ready for PR review after final branch push.
- Branch: `task-8-questionnaire-welcome`
- Base used: `origin/main` after Task 7 merged and the prior branch was deleted.
- Allowed files touched: `.team` welcome route, `.team` onboarding questionnaire route, and this checkpoint.
- Backend/server changed: no
- Shared contracts changed: no
- `.com` prospect-facing pages changed: no
- Token/placement/Ivory/PMV backend files changed: no
- Welcome is shortened into a Team Magnificent ceremony with Kevin/Paul credibility, clear commitment CTA, and Launch Center handoff to `/cockpit`.
- Welcome still records the same click commitment through `/api/welcome/accept`; only the post-accept route changed from Michael scheduler to Launch Center.
- Questionnaire preserves the existing submitted field names and backend payload while converting the long form into a six-step wizard.
- Wizard sections: contact snapshot, why you are here, product and goals, execution pattern, coachability, and readiness/commitment.
- Wizard behavior: progress rail, answered-field count, step progress meter, back/next navigation, step-level completion guard, final submit, and completion path back to Launch Center.
- Save/resume persistence was not added; no new backend draft contract was introduced.
- Compliance scan: no AI lead qualification, prospect ranking, automated prospecting, automated calling, auto-send, or prospect-facing income/placement claims added. Existing BA-facing questionnaire fields about income/product readiness were preserved as required by the current backend contract.
- Verification: `pnpm typecheck` passed and `pnpm build` passed. Build warnings were non-blocking Vite warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`; `.team` chunk-size warning for a 521.70 kB minified JS bundle.

## Next Implementation Phases

1. Task 9: QA and compliance pass
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
   - Build the Team Launch Center.

8. Questionnaire/Welcome Agent
   - Shorten welcome and convert questionnaire into a guided wizard.

9. QA/Compliance Agent
   - Run functional, visual, mobile, reduced-motion, CRM scoping, and compliance checks before release.

## Current Stop Point

Task 8 Questionnaire Wizard / Welcome Shortening has been implemented and verified. Next step is PR review/merge before beginning Task 9 QA/Compliance.


