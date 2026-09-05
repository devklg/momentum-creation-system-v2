# Konga Dashboard - The Card (number + vertical ticker + countdown) - Implementation Brief

You are implementing inside the Momentum Creation System V2 repository:

`D:/momentum-creation-system-v2`

This is the LIVE production app for teammagnificent.com (founder ruling 2026-08-16: the design of record is the actual app in production; V3 holds rulings and design only and has no prospect surface). One lane. It creates a PR; the orchestrator merges after `gates` passes. Do not self-merge.

## Authoritative Sources

Read these before writing code. Where they disagree, the later founder ruling wins.

1. `AGENTS.md`
2. `docs/DESIGN_TOKEN_AUTHORITY.md`
3. `docs/locked-spec.md`
4. `packages/shared/src/brand.css` (primitives: `.tm-animated-counter`, `.tm-rolling-ticker`, `.tm-countdown`)
5. `D:/momentum-creation-system-v3/.logs/ORCH_COM_RULINGS_20260831.md` - read the whole file; the sections dated 2026-09-04 are the rulings this brief implements (switches A-E closed, copy approved, layout ruled)
6. `D:/momentum-creation-system-v3/design/com-design-candidates/holding-tank-schematic-20260901.html` - the machine drawing; page 3 (placement + tank surface) and page 7 (switches, now all closed)

If a sandbox cannot read outside the worktree, the orchestrator copies items 5-6 into the worktree root before launch.

## Verified Current State (not assumed - read 2026-09-04)

- Route: `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx` (421 lines) served at `/p/:token`. Sections in order: arrival (position pinned) -> product -> opportunity -> mechanic (3 cards) -> live-place -> system -> tm-advantage -> real-conversation -> footer.
- The live line renders via `./components/KongaLine.tsx` (adapter) -> `packages/konga-ui/src/KongaLineView.tsx` (12 KB) + `konga-line.css`.
- Per-prospect count ALREADY EXISTS: `addedSincePlacement = max(0, stream.globalMaxPosition - positionNumber)` in the route (line ~62), rendered as a small `<Metric>` in a three-metric `konga-telemetry` row (line ~235) beside `placementsThisWeek` and `geoSpreadCount`. `sinceLastVisit` renders a return note in the arrival section.
- Stream: `apps/com/src/lib/usePlacementStream.ts` - `ticker: McsKongaPlacementTickerEntry[]`, `globalMaxPosition`, `placementsThisWeek`, `geoSpreadCount`, `sinceLastVisit`, `nextWebinar`, `latestArrival`, `latestJoin`. New arrivals are prepended client-side.
- TICKER DEPTH IS 6: `KongaLineView.tsx` line ~63 `stream.ticker.filter(...).slice(0, 6)`. Server seeds via `server/src/domain/holdingTank.ts` `readTankSnapshot(recentLimit)` -> `listRecentPlacements(limit)`; find the caller that sets `recentLimit` and the socket/SSE payload that carries `recent` (`packages/shared/src/konga-line.ts` lines ~88 and ~286).
- Webinar countdown ALREADY EXISTS: `WebinarCountdown` inside `KongaLineView.tsx` (line ~214), driven by `nextWebinar.scheduledFor`.
- Styling: the dashboard and `KongaLineView` apply `MCS_KONGA_D23_CSS_VARIABLES` from `packages/shared/src/konga-line-tokens.ts` (D-23 palette). `docs/DESIGN_TOKEN_AUTHORITY.md` declares D-23 palette/typography SUPERSEDED (layout value only). See Out of Scope.
- Repo uses pnpm (`packageManager: pnpm@10.33.2`), Node >=22, merge commits.

## Objective

Build THE CARD: one element on the prospect dashboard that holds, together, (1) the prospect's pinned position, (2) the prospect's own arrived-after-you number, large and counting up live, (3) the approved count line, (4) the VERTICAL ticker of real arrivals - a rolling window of the most recent 50-100 placements, each attributed to the member who added them, and (5) the webinar countdown riding on the card. Directly beneath the card: the approved position beat and the approved first-mover story, verbatim. This card replaces the current arrangement where the count is a small metric in a row and the line is a separate stage.

## Founder Rulings This Brief Implements (2026-09-04, all closed)

- SWITCH A: the surface tracks PLACEMENTS. There is NO "joined" / "said yes" count anywhere. The number that matters is per-prospect and dynamic: prospects placed after this prospect.
- SWITCH B: the growth message is DAILY and DYNAMIC and lives ON THE DASHBOARD - the number + the ticker + the countdown. No email/SMS work in this brief.
- SWITCH C: "beneath" is allowed in its plain sense. No copy-audit ban. Placement shows how it works in real life; timing of joining dictates how many are placed beneath you.
- SWITCH D: "your sponsor places you" is the only join explanation on the surface. No leg diagrams, no comp-plan mechanics. The two-teams mechanic is taught once, in the position beat, and points at the count as "your team" - never "one of your two teams".
- SWITCH E: re-entry is NEVER mentioned to prospects. No "welcome back to your old spot", no expiry copy, no deletion copy. (The since-last-visit note is fine: it says the line kept moving, nothing about the prospect's own status.)
- LAYOUT: the number is NOT a standalone hero. Number + vertical ticker share ONE card. The ticker IS the living line (arrivals in at the back, flowing upward), not a horizontal strip.
- TICKER DEPTH: 50-100 names as it rolls. Window = most recent 100 placements. The line fills with what it has until overflow.
- HONESTY RULE (locked, governs everything): every moving element is driven by a real event. Never pad, never loop to look fuller, never fabricate an arrival. If the pool is quiet, the line is calm.

## Approved Copy (verbatim - do not edit, do not paraphrase, do not add caveats)

Count line (in the card, next to the number; `[N]` is the live per-prospect count):

> [N] people like you have been exposed to this opportunity since you arrived.

Position beat (beneath the card):

> When you join - and when they join - decides your placement, in real time, and whether you're in front of them or behind them.
>
> We make no promises about who is placed where. What we know is this: every prospect has to be placed, and once a position is filled, the next one takes the next available spot. That's it.
>
> So the question is simple. Do you want to be in front of these people as they say yes, with more of them on your team - or wait, and be placed underneath, as part of their team and ours?

First-mover story (beneath the position beat; heading text is "The first-mover story"):

> Paul Barrios earned millions over seventeen years in his last company. He wasn't the first to hear about it. The opportunity went first to a big networker, who said no. About ninety days later that man changed his mind and joined - and was placed onto Paul's team. Paul went on to build 300,000 people. The man who waited was one of them. He did well. And he still said, years later, that those ninety days were very costly and that he should have said yes sooner.
>
> That's not hype. That's how it went. So investigate this opportunity thoroughly - and do it quickly. Your position in the line is yours to keep the moment you say yes.
>
> We're at the beginning of building this team, and we've committed to a goal of ten thousand-plus members in the coming months. Timing isn't a sales line here. It's the structure.

Typographic dashes in the copy above may be rendered as em dashes; the words do not change.

## Tasks

### T1 - Ticker window to 100 (server + shared + client)
- Server: the `recentLimit` passed into `readTankSnapshot` / `listRecentPlacements` becomes 100 (a named constant in `packages/shared`, e.g. `MCS_KONGA_TICKER_WINDOW = 100`; do not hardcode in two places).
- Client: `usePlacementStream.ts` keeps the prepend behavior and trims the ticker to the same constant on every arrival so memory is bounded.
- View: remove the `slice(0, 6)` in `KongaLineView.tsx`; the card renders the full window.
- Contract: if the snapshot/event payload shape is versioned (`contractVersion`), keep the version stable - this is a size change, not a shape change. Confirm by reading `packages/shared/src/konga-line.ts` before touching it.

### T2 - The Card component
- New component in `packages/konga-ui/src/` (e.g. `KongaCard.tsx`) or a restructure of `KongaLineView.tsx` - your call, but the com route keeps the existing `KongaLine` adapter call surface so `/p/:token` wiring does not change.
- Contents, in this visual order inside one bordered card:
  1. Pinned position: "YOU - #<positionNumber>" (existing arrival-position markup may move here).
  2. The number: `addedSincePlacement`, large, using `.tm-animated-counter` (or the equivalent already in konga-line.css) - it must visibly tick up when a new arrival event lands. Reduced-motion: value updates without animation.
  3. The count line (verbatim above) with `[N]` bound to the same value. Singular/plural: "1 person like you has been exposed..." is the only permitted variation.
  4. The vertical ticker: the living line. Newest arrival enters at the back (bottom) and the column flows upward; each row = first name + last initial, city/state, "added by <BA first name L.>", relative time. Continuous roll when the window is full; when it is not full, render the rows that exist and STOP - no looping, no placeholder rows, no ghost rows.
  5. The webinar countdown on the card's edge (top-right or footer strip), reusing `WebinarCountdown`. When `nextWebinar` is null, the countdown slot collapses; nothing fake.
- Move `addedSincePlacement` OUT of the `konga-telemetry` metric row. `placementsThisWeek` and `geoSpreadCount` stay in the row as the team-wide velocity band, beneath the card.

### T3 - Position beat + first-mover story
- Render the two approved blocks directly beneath the card, before the velocity band, as the new `#position-beat` section. Heading for the story: "The first-mover story".
- Remove or rewrite any existing surface copy that says "joined", "teammates", "one of your two teams", leg/binary language, or any re-entry/expiry language. Grep `apps/com/src/routes/tm-prospect-dashboard/**` and `packages/konga-ui/src/**` for: `join`, `joined`, `teammate`, `leg`, `binary`, `restore`, `expire`, `expir`, `old position`, `re-enter`. Report each hit and what you did with it in the PR body. "Your sponsor places you" is the only join explanation permitted.
- `latestJoin` events: keep whatever motion the line already has for a join (the schematic's upward celebration exit). Do NOT render a join count, a join list, or join copy.

### T4 - Low-count state
- While `addedSincePlacement` < 10 OR the ticker window has < 10 rows: the number is rendered at the same size but the card's visual weight shifts to the ticker rows that exist and the velocity band; do not hide the number, do not substitute a different number, do not render "be the first" filler.
- Thresholds are constants in one place; name them.

### T5 - Tests
- `KongaLineView.test.tsx` (extend or add `KongaCard.test.tsx`): render with 0, 3, 60, and 150 ticker entries -> row count is min(entries, 100); no looping/placeholder rows at 0 and 3; count line singular at 1; number equals `globalMaxPosition - positionNumber`; countdown absent when `nextWebinar` is null; approved copy present verbatim (string-equality assertions on the three blocks).
- Server unit test for the window constant flowing through `readTankSnapshot`.
- `pnpm -r test` and the repo `gates` must pass.

## Hard Constraints

- HONESTY RULE above. This is a recruitment surface; a fabricated arrival is a misrepresentation. No demo/seed data reaches production rendering.
- Copy is verbatim. No disclaimers, no compliance footers added by the lane, no softening.
- No "joined"/"said yes" counts anywhere on the prospect surface.
- No re-entry, expiry, or deletion language anywhere on the prospect surface.
- Keep `/p/:token` and `/rvm/:token` wiring, `postCallbackRequest`, and the `real-conversation` section untouched.
- Accessibility: card has an accessible name; number has `aria-live="polite"`; ticker rows are a list; respect `prefers-reduced-motion` (existing tm-rise/tm-live-pulse fallbacks).
- Use existing tokens/primitives from `brand.css` and `konga-line.css`. Do not introduce new colors or fonts.
- pnpm only (`pnpm install`, `pnpm -r test`). Do not run npm; do not create package-lock.json.
- No time estimates in any output.

## Out of Scope (flagged, not for this lane)

- PALETTE: the dashboard and `KongaLineView` still apply the superseded D-23 token set (`konga-line-tokens.ts`). `DESIGN_TOKEN_AUTHORITY.md` voids that palette. Founder rulings (Aug 31) hold Deep Royal for now and route the real design through Higgsfield; colors are open. This lane changes structure and copy only and leaves the token application exactly as found. Report in the PR body that D-23 is still applied so the restyle can be scheduled.
- Email/SMS delivery of the daily growth message (switch B rail beyond the dashboard - not ruled).
- The join-to-team moment ("what happens the instant she says yes") - reserved by the founder Jul 16, unanswered.
- Before/after photos, Visage hook, logo.

## Branch / Worktree

- Worktree: `git worktree add D:/mcs-v2-konga-card/laneA -b feat/konga-card-laneA origin/main`
- Copy this brief into the worktree root as `LANE_BRIEF.md` (untracked). Copy the two V3 files (sources 5-6) alongside it.
- Rebase onto `origin/main` at start.

## Verification Before Close

1. `pnpm install` clean (pnpm-lock.yaml unchanged or updated intentionally; no package-lock.json).
2. `pnpm -r test` green; `gates` green on the PR.
3. Manual: run `apps/com` dev, open a real `/p/:token` against the dev server, confirm: card renders; number matches `globalMaxPosition - positionNumber`; a new placement event ticks the number up and adds a row at the back of the line; ticker shows up to 100 rows and no more; with a fresh tank of N<10 rows there are exactly N rows and no filler; countdown reflects `nextWebinar`; the three copy blocks are present verbatim; the grep list from T3 is clean.
4. PR body includes: the T3 grep report, the D-23 palette flag, screenshots at 0 / 3 / 60 rows.

## Close

Final line of the lane's output must be exactly one of:

`LANEA COMPLETE PR:<n>`
`LANEA FAILED: <reason>`
