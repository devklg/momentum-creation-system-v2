# Safety Audit - Task 1

Project: `momentum-creation-system-v2`
Repo path: `D:\momentum-creation-system-v2`
Branch: `task-1-safety-audit`
Date: 2026-06-10
Scope: documentation-only safety map before redesign implementation.

## Executive Summary

This audit found that the v1 business rails are mostly well isolated from UX/styling work. Token identity, sponsor immutability, BA-scoped cockpit/CRM reads, manual BA outreach, and holding-tank placement are already implemented as backend contracts rather than as visual assumptions.

The main redesign risks are not broad backend rewrites. They are narrower:

- Do not change how `/p/{token}` resolves identity or sponsor BA.
- Do not render the prospect dashboard before placement exists.
- Do not change `video_complete` placement idempotency.
- Do not widen cockpit, CRM, Ivory, or Generator reads beyond the authed BA.
- Do not lose `source` tracking for `self`, `ivory`, and `scriptmaker` invite paths.
- Do not introduce AI lead qualification, prospect ranking, autonomous prospect selection, auto-calling, or auto-sending.
- Ivory may create invitations for BA-selected names. That is intended. The boundary is that the BA chooses the person and sends the invitation manually.

## Token Resolution And Video Progress

Files inspected:

- `server/src/domain/tokens.ts`
- `server/src/routes/p.ts`
- `apps/com/src/lib/api.ts`
- `apps/com/src/routes/tm-video-presentation/tm-video-presentation.tsx`
- `apps/com/src/routes/tm-video-presentation/sections/03-DrDanVideo.tsx` was identified as the YouTube milestone caller through the composer contract.

Current contract:

- Tokens are opaque 12-character identifiers using the shared access-code alphabet.
- `/api/p/:token` is the prospect-facing resolver. The URL carries only the token.
- Sponsor BA comes from the stored token record's `sponsorBaId`; it is never accepted from request body, query, or headers.
- Expired and enrolled tokens return terminal payloads with 410/409 handling.
- Video progress posts to `/api/p/:token/video-event` with `started`, `quarter`, `half`, `three_quarter`, or `complete`.
- `transitionTokenState()` is forward-only and idempotent. Earlier or duplicate milestones cannot regress the token state.
- `callback_requested` and `webinar_reserved` are independent intent records, not token lifecycle states.

Verified gap for later PMV backend task:

- The audited resolver does not visibly stamp `clicked`/`clickedAt` on GET `/api/p/:token`. If no separate click endpoint exists, PMV cannot reliably distinguish "opened link but did not start video" from "minted/sent only." Task 4 should either add a safe click stamp or explicitly document why open state remains inferred.

Implementation guidance:

- UX work may reshape the presentation and dashboard, but must keep `postVideoEvent()` calling the same milestone endpoint.
- Do not add sponsor or BA identity fields to prospect-facing requests.
- Do not turn callback/webinar actions into lifecycle states.

## Placement Creation And Dashboard Gating

Files inspected:

- `server/src/domain/holdingTank.ts`
- `server/src/routes/p.ts`
- `apps/com/src/routes/tm-video-presentation/tm-video-presentation.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx`
- `apps/com/src/lib/usePlacementStream.ts`

Current contract:

- Placement happens only when `/api/p/:token/video-event` receives `kind: complete`.
- `placeProspect()` is idempotent by `prospectId` and returns the existing placement on replay.
- Position numbers are monotonic; positions are never reclaimed or reshuffled.
- Placement writes `pool_placements`, Neo4j pool edge, Chroma pool event, mirrors `positionNumber`, `placedAt`, and `state: video_complete` onto the prospect, then publishes an in-process SSE event.
- The presentation composer decouples placement from navigation. Video completion captures placement but does not force a page switch.
- The dashboard is URL-param driven with `?view=dashboard`, but only renders when `placement` exists. A pre-placement dashboard request falls back to presentation.
- `usePlacementStream()` opens `/api/p/:token/stream`, receives a snapshot, then live placement events.
- `LivePlaceSection` computes beneath-you as `max(0, globalMaxPosition - positionNumber)` and filters the prospect's own row out of the ticker.

Implementation guidance:

- Task 3 may redesign the first viewport into the Prospect Position & Momentum Center, but must preserve dashboard gating on placement.
- Do not make video completion force navigation.
- Keep the beneath-you counter as team momentum, not a downline or earnings promise.
- Do not display phone/email or full names in the prospect ticker.

## Cockpit And PMV Projection Gaps

Files inspected:

- `server/src/domain/cockpit.ts`
- `server/src/routes/cockpit.ts`
- `server/src/domain/crm.ts`
- `server/src/routes/crm.ts`
- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx` identified as an existing cockpit urgency surface.

Current contract:

- Cockpit routes require `requireAuth` and `requireMichaelComplete`.
- Cockpit summary and invites read `req.session.baId`; no body/query BA id is accepted.
- `listInvitesForBA()` reads prospects, callback requests, and invitation activity filtered by `sponsorBaId = baId`.
- Display status collapses token/prospect state into `draft`, `sent`, `opened`, `watched`, `callback`, `enrolled`, or `expired`.
- CRM mutations call `assertOwnership(prospectId, sponsorBaId)` before writes.
- CRM notes/follow-ups/dispositions are BA-scoped and use the session sponsor BA.
- Re-invite preserves manual BA outreach and does not auto-send.

Verified gaps for PMV work:

- PMV needs a stronger read projection than the current invite list if it should show granular progress, last signal, deterministic next action, and focus queue ordering.
- Partial video states exist in token/prospect state, but the current cockpit display collapses them into `opened`.
- Click/open state may be incomplete unless Task 4 adds a click stamp.
- Today's Actions and the future PMV projection must share priority rules so they do not disagree.

Implementation guidance:

- Task 4 should create or extend a BA-scoped PMV projection; do not compute cross-BA state in the client.
- Task 5 should consume the projection and move CRM actions into a detail/drawer surface without losing existing CRM controls.
- Do not introduce AI lead qualification, lead scoring, or prospect ranking. PMV can show deterministic operational next actions based on explicit events.

## Invitation Source Behavior

Files inspected:

- `server/src/domain/invitations.ts`
- `server/src/routes/invitations.ts`
- `apps/team/src/routes/invitations.tsx`
- `server/src/domain/generator.ts`
- `server/src/routes/ivory.ts`

Current contract:

- `InvitationSource` allows `self`, `ivory`, and `scriptmaker`.
- The server normalizes unknown source values to `self`.
- Plain invitation form defaults to `source: self`.
- Ivory/Generator mints through `createInvitation()` with `source: ivory`.
- The invitation route stamps `sponsorBaId` from `req.session.baId`; any request body sponsor is ignored.
- The system stores the invitation message but does not send it to the prospect.
- `markInvitationSent()` is BA-confirmed, idempotent, and sponsor-guarded.

Implementation guidance:

- Task 6 may turn Ivory into a relationship-first Invitation Agent, but it must continue to mint through the existing invitation spine and preserve `source: ivory`.
- If ScriptMaker integration is touched later, preserve `source: scriptmaker`.
- Keep the final action as copy/send by the BA and explicit "I sent this" confirmation.

## Ivory Compliance And Invitation Boundary

Files inspected:

- `server/src/domain/ivory.ts`
- `server/src/routes/ivory.ts`
- `server/src/domain/generator.ts`
- `apps/team/src/routes/ivory.tsx`

Current contract:

- Ivory roster reads and writes are BA-private through `baId`.
- Ivory Coach returns WDYK reflection prompts and has a deterministic fallback when the LLM is unavailable.
- Ivory Coach instructions prohibit naming a specific person, scoring/ranking people, prospecting automation, income claims, medical guarantees, and urgency pressure.
- Generator validates run and Ivory ownership before minting.
- Generator does not mint tokens directly; it calls `createInvitation()`.
- Generator does not send messages to prospects.

Clarified implementation boundary:

- Ivory is intended to help create invitations. That is not a compliance problem.
- The BA selects or enters the person. Ivory can help with relationship memory, draft copy, and minting a tokenized invitation through the spine.
- Ranking is unnecessary for v2 and should remain out of scope.
- Do not add AI scoring, qualification, autonomous selection, auto-calling, or auto-sending.

## CRM BA Ownership Checks

Files inspected:

- `server/src/domain/crm.ts`
- `server/src/routes/crm.ts`
- `server/src/domain/cockpit.ts`
- `server/src/routes/cockpit.ts`

Current contract:

- Every CRM route requires auth and Michael completion.
- The route obtains `sponsorBaId` from the session only.
- `assertOwnership()` verifies the prospect belongs to the calling BA before mutation.
- Cross-BA access maps to 403 without exposing another BA's data.
- BA-created prospects force sponsor from session and do not assign placement.
- BA edit/delete wrappers delegate to shared CRUD while preserving ownership and audit reason rules.

Implementation guidance:

- Task 4/5 must preserve server-side ownership enforcement. Do not rely on hidden client fields to scope data.
- PMV row drawers should call existing CRM endpoints or new BA-scoped projection endpoints; they should not add body-level sponsor selectors.

## Logo Assets And CSS/Tailwind Entry Points

Files inspected:

- `assets/logos/logo_dark_hero.png` - 920445 bytes
- `assets/logos/logo_dark_square.png` - 611413 bytes
- `assets/logos/logo_icon.png` - 155401 bytes
- `assets/logos/logo_light_print.png` - 40811 bytes
- `assets/logos/logo_navbar.png` - 6334 bytes
- `packages/shared/src/brand.ts`
- `packages/shared/src/brand.css`
- `apps/com/src/main.css`
- `apps/team/src/main.css`
- `apps/com/tailwind.config.ts`
- `apps/team/tailwind.config.ts`
- `apps/admin/tailwind.config.ts` exists but is outside the v2 task focus unless admin styling is intentionally included.

Current contract:

- Shared brand tokens define ink, gold, bright gold, teal, cream, muted cream, faint cream, and line.
- Shared font tokens are Bebas Neue, DM Sans, and DM Mono/JetBrains Mono.
- `.com` imports Google fonts and defines global atmospheric ink canvas plus motion utilities.
- `.team` has a lean CSS base and Tailwind token config matching `.com`.
- Tailwind color and font extensions are duplicated in `.com` and `.team` configs.

Implementation guidance:

- Task 2 should centralize or document brand/motion primitives before feature pages are redesigned.
- Use gold for identity/ceremony and teal for live state/action/progress.
- Preserve reduced-motion behavior.
- Use existing real logo assets; do not replace them with decorative placeholders.

## Verified Risks And Next Recommendations

1. Task 2 should create shared brand/motion primitives first so Task 3 and Task 5 do not duplicate CSS and motion behavior.
2. Task 3 should preserve placement gating and no-forced-navigation while building the Prospect Position & Momentum Center.
3. Task 4 should resolve the click/open-state gap and define one PMV projection that also powers Today's Actions priorities.
4. Task 5 should keep all CRM operations server-scoped to the authed BA.
5. Task 6 should frame Ivory as BA-controlled invitation creation, not ranking or qualification.
6. Prospect-facing pages must avoid income, spillover, CV, cycle, rank, placement-promise, or dollar claims.

## Commands

- `pnpm typecheck` - passed after `pnpm install` restored missing `node_modules` from the existing lockfile.
- `pnpm build` - passed. Vite emitted non-blocking warnings: `.com` dynamic import chunk warning for `apps/com/src/lib/api.ts`; `.team` chunk size warning for a 516.40 kB minified JS bundle.
- `git status --short --branch` - branch `task-1-safety-audit`; tracked changes limited to `TRAVEL_CHECKPOINT.md` plus new `docs/v2-redesign/audits/SAFETY_AUDIT.md`.

