# Team Magnificent Prospect Dashboard UX Review

Scope: UX review only. No implementation code changed.

Reviewed files:

- `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/00-Ribbon.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/02-Opportunity.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/06-YourNextMove.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx`
- `apps/com/src/lib/usePlacementStream.ts`
- `apps/com/src/lib/api.ts`
- `packages/shared/src/brand.css`
- `packages/shared/src/brand.ts`

Related integration point observed:

- `apps/com/src/routes/tm-video-presentation/tm-video-presentation.tsx`

## 1. Current Structure

The current dashboard is a cinematic long page, not yet a true dashboard center.

Render order:

1. Sticky ribbon
   - Team Magnificent brand
   - Optional "Back to the video"
   - "Live - holding tank" status

2. Arrival
   - Invited-by line
   - "You saw it. You're in."
   - Position card with position number, sponsor hold copy, placement timestamp

3. Opportunity
   - Market framing
   - Four public-market stat tiles

4. Mechanic
   - Power of 2 explanation
   - Animated cascade
   - 100,000 destination
   - Three principle cards

5. Live Place
   - Own anchored position
   - Beneath-you live counter
   - Rolling live placement stack from SSE

6. Team Magnificent Advantage
   - Kevin quote
   - 100,000 mission board
   - Live team stats fetched once from `/team-stats`
   - Compounding explanation
   - Compliance signature

7. Your Next Move
   - Callback request card
   - Webinar countdown and reservation card

8. Footer
   - Brand close
   - Compliance disclaimer

The route-level structure is one section after another, with each section owning its own inline CSS. Global shell styles apply full-width cinematic section padding and repeated section borders.

## 2. Problems

### The page answers too late

The prospect lands after completing the video. At that moment the highest-value questions are:

- Where am I?
- Is this live?
- What is happening now?
- What happens next?
- How do I act?

The current page delays most of those answers. Position appears in Section 1, but the real dashboard signals are split across Section 4, Section 5, and Section 6. The countdown is buried at the bottom. The ticker is buried in the middle. Team stats are below the ticker. The CTA is last.

### It feels like a long landing page

The layout uses a chapter sequence:

- large headline
- large lead paragraph
- large visual block
- large vertical spacing
- next chapter

That works for the pre-video presentation. It is weaker after the video, because the post-video surface should feel like a control center. The user should not need to scroll through market and philosophy content to understand their position and momentum.

### Excessive whitespace reduces urgency

Specific whitespace drivers:

- `ArrivalSection` uses `min-height: 78vh`.
- Global section padding is `clamp(40px, 6vw, 88px)` plus section-specific top/bottom overrides.
- Several leads have `margin-bottom: 48px` or `56px`.
- Large display headings repeat in every section.
- The position card, mission card, live stack, and CTA cards are all full-width blocks stacked vertically.

The result is premium and cinematic, but not operational. The dashboard should become denser without becoming cramped.

### The core dashboard widgets are separated

The current "center" is split:

- Position: Section 1
- Beneath-you counter: Section 4
- Rolling ticker: Section 4
- Team activity counters: Section 5
- Countdown: Section 6
- Primary action: Section 6

These are all part of one mental model. They should be grouped together.

### The countdown has the wrong priority

The countdown currently lives inside the webinar card in the final CTA section. That makes it feel optional. It should function as a live momentum signal and urgency anchor near the top.

### The ticker has the wrong placement

The ticker is technically correct and valuable, but it is not visible early enough. It should be a persistent signal in the Position & Momentum Center, either as a right rail on desktop or a compact rolling band below the top metric row.

### Animated counters are underused

The live counter and static stat numbers use large numeric typography, but the dashboard does not yet create a clear animated "momentum board" effect. The strongest numeric signals should animate or visibly update:

- Your position number
- Placed beneath you
- New placements in 24h
- Invitations sent today
- BAs active in 24h
- Recruitment velocity
- Countdown units

The 100,000 goal should remain static and clearly labeled as a goal, not a live current count.

### Some explanations are present but in the wrong form

The page has valuable explanatory content, but it is delivered as long-form scroll copy. The center needs short explanations beside the widgets, with deeper context available below.

Areas needing clearer short explanation:

- What "holding tank" means.
- What "beneath you" means, including that it is team momentum, not a placement or earnings guarantee.
- Why the position number matters.
- What the live ticker represents.
- What happens after "Yes - let's talk."
- What the live event is and why the countdown matters.
- What "2 in 72" means without making it feel like pressure or a guarantee.

## 3. Recommended New Structure

Convert the page into a true Position & Momentum Center with one primary dashboard viewport and supporting content below it.

### New render order

1. Sticky command ribbon
   - Team Magnificent brand
   - Back to video
   - Live status
   - Optional compact next event time/countdown on desktop

2. Position & Momentum Center
   - Above-the-fold dashboard grid
   - The first screen should contain:
     - Prospect identity and sponsor context
     - Position card
     - Beneath-you live counter
     - Next live event countdown
     - Primary callback action
     - Rolling ticker
     - Team activity counters

3. How Your Position Works
   - Short explanation of holding tank, live team activity, and no-guarantee compliance
   - Reuse the current Live Place explanation and compliance framing

4. Why This Market Matters
   - Current Opportunity section, compressed into a supporting market panel
   - Keep citations visible

5. How Momentum Builds
   - Current Mechanic section, but shorter and more scannable
   - Cascade becomes an explainer module, not a full page chapter

6. Team Magnificent Advantage
   - Kevin quote
   - Mission board
   - Compounding explanation
   - Could be a two-column story panel instead of another full-width chapter

7. Next Move Expanded
   - Keep full callback form and webinar reservation form
   - Top center should already expose the primary actions; this section gives more room for the detailed forms

8. Footer
   - Keep compliance disclaimer

### Desktop layout concept

Use a 12-column dashboard grid:

- Top row:
  - Left 7 columns: "Position & Momentum Center" header, invited-by line, short lead
  - Right 5 columns: countdown card

- Main row:
  - Left 4 columns: Your Position card
  - Middle 4 columns: Placed Beneath You live counter
  - Right 4 columns: Primary action card

- Activity row:
  - Left 8 columns: animated team counters
  - Right 4 columns: rolling ticker rail

Alternative: make the rolling ticker a full-width band under the main row if the right rail feels too narrow.

### Mobile layout concept

Mobile should still feel like a dashboard, not a long article:

1. Compact ribbon
2. Position card
3. Beneath-you counter
4. Countdown
5. Primary CTA
6. Horizontal ticker band
7. Team counters in 2-column grid
8. Explanation accordions

Avoid sending mobile users through the full market and mechanic narrative before they see the countdown and CTA.

## 4. Sections To Keep

Do not remove valuable content. Keep the full content set, but change hierarchy.

Keep:

- Invited-by personalization.
- Position number and placement timestamp.
- Holding tank explanation.
- Beneath-you live counter.
- Rolling ticker powered by `usePlacementStream`.
- Public market stat grid.
- Power of 2 cascade.
- 100,000 team goal.
- Power of 2 / 2 in 72 / One bite at a time principles.
- Kevin quote.
- Team activity stats from `fetchTeamStats`.
- Compounding explanation.
- Callback intent flow.
- Webinar countdown and reservation flow.
- Footer compliance disclaimer.

## 5. Sections To Reorganize

### Arrival

Current role: cinematic confirmation.

New role: part of the dashboard header and position card.

Keep the emotional confirmation, but shorten it. The page no longer needs a 78vh hero after the prospect has already watched the presentation. Use the top center to say, in effect:

- You are in.
- You were invited by [BA].
- Your position is #[number].
- Momentum is live now.

### Opportunity

Current role: full chapter before the mechanic and live dashboard.

New role: supporting proof panel below the center.

The market facts are valuable, but the prospect already saw the video. They should not block the live dashboard. Keep the four stats, make them denser, and add a short "Why this matters" heading.

### Mechanic

Current role: major full-scroll explanation.

New role: "How momentum builds" explainer.

The cascade is useful, but it should move below the center. It explains the logic after the prospect has seen their live position and the current momentum.

### Live Place

Current role: Section 4.

New role: core of the center.

This is the heart of the dashboard. Split it into reusable components:

- OwnPositionCard
- BeneathYouCounter
- PlacementTicker
- MomentumExplanation

The top center should use the first three. The deeper explanation can remain below.

### Team Magnificent Advantage

Current role: long proof and philosophy section.

New role: supporting confidence layer.

Keep the quote, mission, counters, and compounding explanation. Move the counters into the top center, then keep the quote and deeper compounding story below.

### Your Next Move

Current role: final section.

New role: both top-level action and full detailed action section.

The prospect should see a primary action above the fold. The full callback and webinar forms can remain lower on the page, but the top dashboard should offer:

- "Talk with [BA]"
- "Reserve live event"

The countdown should not be trapped inside the lower webinar card.

## 6. Component-by-Component Recommendations

### `TmProspectDashboard`

This file should stop rendering the sections as a strict long-page sequence. It should orchestrate a dashboard layout first, then render supporting content below.

Recommended component split:

- `PositionMomentumCenter`
- `PositionCard`
- `BeneathYouCounter`
- `PlacementTicker`
- `CountdownCard`
- `MomentumStats`
- `PrimaryActions`
- `DashboardExplainers`

The existing sections can be refactored into these components without deleting their content.

### `DashboardRibbon`

Keep it sticky. Add more utility:

- Keep brand and Back to video.
- Keep live status.
- Consider adding a compact "Next live: [time]" or mini countdown on desktop.
- On mobile, keep it lean: brand, back, live dot.

The ribbon should reinforce that this is a live center, not just a branded page.

### `ArrivalSection`

Reduce from hero to dashboard intro.

Recommended changes:

- Remove `min-height: 78vh`.
- Reduce display headline scale.
- Move position number into the center's primary card.
- Keep invited-by and placement timestamp.
- Replace long welcome copy with a short line.

### `OpportunitySection`

Keep all four market stats.

Recommended changes:

- Move below the center.
- Use a compact 4-card grid.
- Consider a collapsible "Market context" panel on mobile.
- Strengthen source labels where currently vague, especially "Industry projection" and "Average retail - 2025."

### `MechanicSection`

Keep the cascade and principles.

Recommended changes:

- Move below the center.
- Reduce vertical padding and margins.
- Make the cascade a contained explainer module.
- Keep "2 in 72" but add clearer language that it is rhythm, not pressure or guarantee.

### `LivePlaceSection`

Promote this into the main center.

Recommended changes:

- Extract the anchored position, beneath-you counter, and ticker into separate components.
- Put the beneath-you counter beside the position card above the fold.
- Put the ticker in a persistent dashboard area:
  - desktop: right rail or lower band
  - mobile: compact band after countdown/CTA
- Keep the current SSE behavior and compliance caveats.
- Surface the reconnecting state subtly if `stream.errored` stays true for more than a moment.

### `TickerEntry`

Keep the current privacy-safe format.

Recommended changes:

- Improve scan hierarchy:
  - position number
  - first name/last initial/location
  - absolute time
- Consider a "latest" marker on the freshest row.
- Do not add sponsor names unless the SSE payload and compliance rules explicitly support it.

### `TmAdvantageSection`

Split into two purposes:

- `MomentumStats` moves into the center.
- Quote, mission, and compounding story stay below as supporting confidence content.

Recommended changes:

- Animate the four pool stats when fetched.
- Avoid making recruitment velocity feel like a promise. Keep operational language.
- Keep the compliance signature.

### `PoolStat`

Recommended changes:

- Use animated number transitions when real values arrive.
- Keep em dash placeholders while loading.
- Add short helper text only where a metric may confuse prospects.

### `YourNextMoveSection`

Split top-level action from full form.

Recommended changes:

- Move a compact primary action card into the center.
- Keep the full callback card below for detailed intent selection.
- Move countdown up into the center.
- Keep webinar reservation form below or in a dashboard card if space allows.
- Make the next action copy more direct after the dashboard proof:
  - "Talk with [BA]"
  - "Reserve the next live event"

### `Countdown`

Promote this to a first-class dashboard widget.

Recommended changes:

- Place it in the top-right of the center on desktop.
- Place it immediately under position/counter on mobile.
- Keep the detailed event date below the unit grid.
- If no event is seeded, show a clear fallback and let the CTA route to callback instead.

### `DashboardFooter`

Keep it.

Recommended changes:

- No major change.
- If the page becomes shorter above the fold, the footer can remain as the compliance close.

### `usePlacementStream`

The hook already supports the new dashboard concept well:

- `globalMaxPosition`
- `ticker`
- `connecting`
- `connected`
- `errored`

Possible UX-driven additions only if needed:

- Expose `lastEventAt` for "Updated just now" UI.
- Expose a derived `hasLiveData` boolean.
- Consider a smaller visible ticker cap at the component layer while keeping the 80-entry memory cap.

No API behavior change is required for the first restructure.

### `api.ts`

The required data already exists:

- token resolution includes `nextEvent`
- `fetchTeamStats` returns dashboard counters
- callback and webinar endpoints exist

Possible UX-driven changes:

- If the center needs fresher team stats, add polling or SSE later. Current fetch-on-mount is acceptable for v1, but it is less "live" than the placement stream.
- Avoid showing any team-stat failure to prospects.

### `brand.css` and `brand.ts`

The tokens are sufficient for color and typography.

Recommended additions if implementation proceeds:

- Shared spacing tokens for dashboard density.
- Shared radius/border tokens for center cards.
- Optional semantic aliases:
  - `--surface`
  - `--surface-raised`
  - `--border-muted`
  - `--accent-live`
  - `--accent-goal`

This would reduce inline CSS repetition across section files.

## 7. Exact Files That Need Changes

Primary dashboard files:

- `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx`
  - Reorder hierarchy.
  - Add the Position & Momentum Center composition.
  - Move supporting sections below the center.

- `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx`
  - Convert from hero section to compact intro/position content or retire into new center components.

- `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx`
  - Extract position, beneath-you counter, ticker, and explanation into reusable pieces.
  - Promote ticker/counter into the center.

- `apps/com/src/routes/tm-prospect-dashboard/sections/06-YourNextMove.tsx`
  - Extract countdown as a reusable first-class widget.
  - Split compact action from full detailed CTA/forms.

- `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx`
  - Extract pool stats into a center metrics row.
  - Keep quote/mission/compounding as supporting content.

Secondary dashboard files:

- `apps/com/src/routes/tm-prospect-dashboard/sections/02-Opportunity.tsx`
  - Compress into a supporting market context module.

- `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx`
  - Compress into a supporting momentum explainer module.

- `apps/com/src/routes/tm-prospect-dashboard/sections/00-Ribbon.tsx`
  - Optionally add compact event/live context.

- `apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx`
  - Keep mostly unchanged.

Data and support files:

- `apps/com/src/lib/usePlacementStream.ts`
  - No required change for the restructure.
  - Optional additions for `lastEventAt` or stronger reconnect UI.

- `apps/com/src/lib/api.ts`
  - No required change for the restructure.
  - Optional future change if team stats need polling or live updates.

- `packages/shared/src/brand.css`
  - Optional density/surface/radius tokens if the dashboard cards are standardized.

- `packages/shared/src/brand.ts`
  - Mirror any new CSS brand tokens.

Integration file:

- `apps/com/src/routes/tm-video-presentation/tm-video-presentation.tsx`
  - Only needed if the transition from presentation to dashboard changes.
  - Current dashboard branch already passes the right inputs: token, prospect name, BA name, position, placedAt, nextEvent, copy, and back handler.

## Recommended Implementation Direction

The strongest path is not to delete content. It is to change the information architecture:

1. Build a new `PositionMomentumCenter` at the top.
2. Feed it the current position, stream, next event, team stats, and CTA actions.
3. Move the current narrative sections below as proof/explanation.
4. Reduce vertical padding across the dashboard route.
5. Extract shared cards/widgets so the dashboard stops feeling like seven independent landing-page sections.

The result should feel like the prospect is standing inside a live position and momentum center immediately after the video, with the long-form proof still available underneath.
