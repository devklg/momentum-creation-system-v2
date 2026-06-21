# Task 9 QA Report

Date: 2026-06-11
Branch: task-9-qa-compliance
Base: origin/main after Task 8 merge
Scope: QA and release-readiness review only. No feature redesign work was performed.

## Verification Modes

- Source-contract review across prospect token routes, token lifecycle domain, placement domain, cockpit/PMV routes, CRM routes, Ivory routes, Launch Center, welcome, and questionnaire.
- Live HTTP smoke against the running local stack:
  - `GET http://localhost:7700/api/health` -> 200 `ok:true`
  - `GET http://localhost:7701/p/invalid` -> 200 shell render from Vite app
  - `GET http://localhost:7702/welcome` -> 200 shell render from Vite app
  - `GET http://localhost:7700/api/p/invalid` -> 404 `{ "error": "invalid_token" }`
  - `POST http://localhost:7700/api/p/invalid/video-event` with `{ "kind": "started" }` -> 404 `{ "error": "invalid_token" }`
- Browser automation was attempted with the Codex in-app/browser Playwright path. It failed twice before page evaluation with `windows sandbox failed: spawn setup refresh`; no screenshots were captured.
- Fresh server start was attempted for Task 9 logs, but the local shell did not provide `JWT_SECRET`, so that fresh process exited during `server/src/env.ts` validation. Existing local API on port 7700 was already healthy and used for HTTP smoke.

## Token Journey

| State | Result | Evidence |
| --- | --- | --- |
| Invalid token | Live-tested. `GET /api/p/invalid` and `POST /api/p/invalid/video-event` both return 404 `invalid_token`. | `server/src/routes/p.ts` validates token existence before resolving or accepting video events. |
| Valid minted/clicked token | Source-verified. Runtime fixture unavailable in this task without creating local DB records. `GET /api/p/:token` calls `markTokenOpened()` only after invalid, enrolled, expired, and time-expired branches are cleared. | `server/src/routes/p.ts`; `server/src/domain/tokens.ts` |
| Expired token | Source-verified. Stored `expired` returns 410; time-expired nonterminal tokens are lazily advanced through `transitionTokenState(token, 'expired')` and return 410. | `server/src/routes/p.ts`; `server/src/domain/tokens.ts` |
| Enrolled token | Source-verified. `enrolled` is terminal and returns 409 with sponsor contact context instead of reopening the prospect journey. | `server/src/routes/p.ts` |
| Unplaced token/dashboard gating | Source-verified. The dashboard branch is gated on a placement object; `?view=dashboard` is stripped/falls back to presentation until placement exists. | `apps/com/src/routes/tm-video-presentation/tm-video-presentation.tsx` |

Runtime valid/expired/enrolled fixture testing was not performed because Task 9 was kept read-only against application data and no seeded test tokens were provided in the merged branch or checkpoint.

## Video Milestones

Milestones are defined as `started`, `quarter`, `half`, `three_quarter`, and `complete` in `server/src/routes/p.ts`. The route maps them forward to `video_started`, `video_quarter`, `video_half`, `video_three_quarter`, and `video_complete` through `transitionTokenState()`.

- Start/25/50/75/complete were source-verified in the route mapping and token state order.
- `transitionTokenState()` is forward-only and idempotent; regressions and repeated milestone posts do not move state backward.
- `complete` calls `placeProspect()` using `tokenRecord.sponsorBaId`, then writes video activity and alerts only when placement is new.
- Live milestone posts against a valid token were not performed because no valid fixture token was available without creating DB state.

## Placement Idempotency

Placement idempotency is source-verified in `server/src/domain/holdingTank.ts`:

- `findPlacementByProspectId()` runs before minting a position.
- Existing placement returns `alreadyPlaced: true` and performs no new writes.
- Duplicate insert races re-read the winner and return `alreadyPlaced: true`.
- Position numbers remain monotonic; vacated slots are not reclaimed.

The public video completion route calls `placeProspect()` even if a repeated completion event reaches the server, so the domain idempotency guard is the final protection.

## PMV And CRM Ownership

PMV ownership is source-verified:

- `GET /api/cockpit/pmv` is gated with `requireAuth` and `requireMichaelComplete`.
- The route reads `req.session.baId`; no body or query parameter can widen scope.
- `getProspectMomentumViewer(baId)` filters prospects, callbacks, activities, follow-ups, dispositions, and notes by `sponsorBaId: baId`.

CRM ownership is source-verified:

- CRM routes use `requireAuth` and `requireMichaelComplete`.
- Mutations call `assertOwnership(prospectId, sponsorBaId)` before writing notes, follow-ups, dispositions, re-invites, edits, or deletes.
- BA create forces `sponsorBaId` from the session.

No cross-BA runtime mutation test was performed because no authenticated fixture sessions were provided.

## Ivory Flow

Ivory create/draft/mint/send was source-verified:

- All `/api/ivory` routes are gated by `requireAuth` and `requireMichaelComplete`.
- Roster reads filter by authenticated `baId`; individual name reads enforce ownership.
- The invitation agent draft is copy-only; it does not choose a prospect, send, call, rank, or qualify.
- Mint calls `createInvitation()` with `source: 'ivory'`, the BA-edited `message`, and `relationshipReason`.
- Send remains manual: the UI and Launch Center language tell the BA they own every relationship and every send.

No authenticated browser click-through was performed because browser automation was unavailable and no fixture login/session was provided.

## Launch Center And Questionnaire

Launch Center is source-verified:

- `/api/cockpit/launch` is auth-only so new BAs can see onboarding status before the Michael gate.
- Operational PMV routes remain post-Michael gated.
- Step truth reads existing durable sources: commitments, Michael schedule, Fast Start progress, Ivory count, invitation spine, questionnaire existence, and immutable sponsor.
- Launch copy preserves manual relationship ownership: Ivory helps organize and shape messages, but does not prospect, rank, call, or send.

Questionnaire is source-verified:

- Task 8 wizard preserved the existing backend payload fields.
- Step navigation gates only the current step; final submit sends the same payload shape to `/api/onboarding/questionnaire/submit`.
- Completion returns to `/cockpit` / Launch Center.

Welcome is source-verified:

- `POST /api/welcome/load` marks screen seen.
- `POST /api/welcome/accept` records the commitment.
- Accepted users are routed to `/cockpit`, not directly into a later feature surface.

## Responsive And Reduced Motion

Browser screenshots were unavailable because Playwright failed with `windows sandbox failed: spawn setup refresh`.

Source review found responsive layout controls on the Task 7/8 surfaces and the preserved `.com` surfaces:

- Launch Center uses `grid-cols-1`, `md:grid-cols-2`, `xl:grid-cols-4`, and stacked flex behavior for mobile.
- Welcome uses single-column grids that expand at `md` and `lg` breakpoints.
- Questionnaire uses a single-column mobile flow with a sticky rail only at `lg`.
- PMV/cockpit retains responsive grid/table layouts and mobile breakpoints.
- Prospect dashboard and video presentation include mobile `@media` blocks.

Reduced-motion source review:

- Shared brand CSS includes `@media (prefers-reduced-motion: reduce)`.
- `.com` entry CSS includes `prefers-reduced-motion` handling.
- Prospect ticker, video, market, invitation, prospect dashboard, and live place sections include reduced-motion handling.

## Risks / Follow-Up

- No live seeded valid, expired, enrolled, or placed token fixture was available in this task, so those states are source-verified rather than runtime-verified.
- Browser screenshots were not captured because the browser automation runtime crashed before evaluation.
- Authenticated BA flows were source-verified only; no test BA session fixture was provided.
- Fresh server start from this shell needs the expected environment variables, notably `JWT_SECRET`; the already-running local API was healthy.

## Build Verification

- `pnpm typecheck` passed.
- `pnpm build` passed.
- Non-blocking warnings: `.com` dynamic/static import chunk warning for `apps/com/src/lib/api.ts`; `.team` chunk-size warning for `assets/index-Ckkzu98a.js` at 521.70 kB after minification.

## Result

Task 9 QA found no required code fixes. The intentional `.com` market/cost figures remain as researched informational context and are handled in the compliance audit as non-income, non-placement, non-compensation content.

