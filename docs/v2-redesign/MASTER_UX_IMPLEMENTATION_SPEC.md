# MASTER UX IMPLEMENTATION SPEC

Project: `momentum-creation-system-v1`
Source reviews combined:

- `BRAND_VISUAL_REVIEW.md`
- `DASHBOARD_UX_REVIEW.md`
- `IVORY_INVITATION_AGENT_REVIEW.md`
- `PROSPECT_MOMENTUM_VIEWER_REVIEW.md`
- `TEAM_ONBOARDING_REVIEW.md`

This document is an implementation specification only. It does not authorize a rebuild, source rewrite, or removal of valuable existing business content.

## 1. Executive Summary

The app already contains the core Team Magnificent recruitment spine: Brand Ambassador onboarding, invitation minting, tokenized prospect presentation links, video milestone tracking, placement/holding tank logic, prospect dashboard content, BA cockpit activity, CRM notes, and early Ivory invitation support.

The UX problem is not that the app lacks content. The problem is that several important experiences are currently presented as long pages or adjacent tools instead of guided command-center workflows. Team Magnificent is present in copy and assets, but not visually dominant enough. The prospect dashboard reads more like a cinematic landing page than a live position and momentum center. Team onboarding reads like a sequence of separate pages rather than one guided launch path. Ivory currently behaves like separate roster, coach, and generator tools instead of one relationship-first CRM-entry plus invitation agent. The BA cockpit has useful CRM and action mechanics, but does not yet feel like a true Prospect Momentum Viewer.

The unified direction is:

- Make Team Magnificent the dominant visual brand across `.com` and `.team` surfaces.
- Convert prospect and BA long pages into command-center experiences.
- Preserve all existing business logic, token placement logic, CRM ownership, security, and compliance language.
- Reorganize valuable content before deleting anything.
- Promote existing countdowns, tickers, counters, placement, and CRM activity into first-viewport dashboard experiences.
- Make Ivory a BA-guided invitation agent that creates CRM records, drafts editable messages, mints tokenized links, and stores the invitation trail.
- Make the cockpit a true PMV: prospect-centered, status-driven, follow-up-oriented, and compliant.

### Conflict Resolution

The reviews agree on the product direction, but they emphasize different things. These are the final resolved decisions:

- Brand dominance vs. dashboard density: use real Team Magnificent logos, header lockups, and subtle compass watermarks, but keep dashboards compact and operational. Do not turn tools into decorative marketing pages.
- Existing ticker/countdown vs. "lack of ticker/countdown": the issue is not total absence. Existing ticker/countdown concepts are too buried or weak. Promote them into the first viewport and make them feel alive.
- Ivory standalone vs. `/invitations` spine: Ivory should not duplicate or bypass the invitation spine. It should prepare the CRM record and message, then use shared invitation mint/review/send mechanics.
- Hot/warm/cold vs. compliance: PMV may show deterministic engagement temperature from explicit behavior and BA-entered facts. It must not perform AI lead qualification, automated prospecting, or make income/spillover claims.
- Launch onboarding vs. operational cockpit: `/cockpit` becomes a Team Magnificent Launch Center for new BAs, then matures into the operational cockpit/PMV once launch milestones are complete.

## 2. Final Prospect Dashboard Redesign Plan

Primary file:

- `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx`

Current section files:

- `apps/com/src/routes/tm-prospect-dashboard/sections/00-Ribbon.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/02-Opportunity.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/06-YourNextMove.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx`

### Final UX Direction

Convert the prospect dashboard from a long-page presentation recap into a live `Position & Momentum Center`.

The first viewport must immediately answer:

- Where am I?
- What number am I?
- What is happening beneath me?
- What is the next Team Magnificent event or decision moment?
- What should I do next?

### New First-Viewport Structure

1. Sticky Team Magnificent command ribbon
   - Use `logo_navbar.png` as the compact wordmark.
   - Show prospect name or token-personalized identity if available.
   - Include primary action: request callback / talk to inviter / next step.
   - Include secondary action: return to presentation.

2. Position & Momentum Center
   - Use `logo_dark_hero.png` or strong Team Magnificent lockup in the first viewport.
   - Display placement position prominently.
   - Display live people-beneath-you counter if implemented by backend.
   - Display next event countdown.
   - Display rolling ticker of recent team momentum if data exists.
   - Display animated counters for People, Momentum, Volume, Checks language only.
   - Avoid CV amounts, cycle math, dollar promises, spillover promises, or income guarantees.

3. Primary action row
   - Request callback.
   - Message inviter / BA will reach out.
   - Continue or return to presentation.
   - View resources or next event details.

4. Supporting sections below the dashboard center
   - Preserve current Arrival, Opportunity, Mechanic, Live Place, TM Advantage, Your Next Move, and Footer content.
   - Reorganize these into compact explainer bands, accordions, or tabs rather than deleting.
   - Keep long educational content available below the command center.

### Specific Redesign Decisions

- `01-Arrival.tsx` should become part of the top command experience, not a long intro before dashboard facts.
- `04-LivePlace.tsx` should move earlier or have its core data extracted into the first viewport.
- `06-YourNextMove.tsx` should supply the primary CTA language for the command center.
- `00-Ribbon.tsx` should become sticky, brand-forward, and more useful.
- `07-Footer.tsx` should include a stronger Team Magnificent closing mark.

### Business Logic Preservation

- Do not change token resolution behavior.
- Do not change when placement is created.
- Do not force navigation away from the presentation after placement.
- Do not show the team line before placement exists.
- Do not promise spillover.
- Do not expose private BA CRM data to the prospect.

## 3. Final Team Launch Center Plan

Primary files:

- `apps/team/src/routes/welcome.tsx`
- `apps/team/src/routes/onboarding/questionnaire.tsx`
- `apps/team/src/routes/michael-schedule.tsx`
- `apps/team/src/routes/michael-interview.tsx`
- `apps/team/src/routes/invitations.tsx`
- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`

### Final UX Direction

Make `/cockpit` the Team Magnificent Launch Center for new Brand Ambassadors. Once launch milestones are complete, it becomes the operational BA cockpit/PMV.

The Launch Center must answer:

- What is done?
- What is unlocked?
- What is next?
- What is optional?
- What gets me into motion today?

### Recommended Launch Center Order for New BAs

1. Team Magnificent launch header
   - Strong wordmark/logo.
   - Progress meter: example `3 of 8 launch steps complete`.
   - One dominant next-action button.

2. Mission checklist
   - Welcome accepted.
   - Michael scheduled.
   - Michael completed.
   - Day 1 started/completed if tracked.
   - Who Do You Know list started.
   - First invitation drafted.
   - First invitation sent.
   - Questionnaire submitted.
   - Sponsor connection confirmed if tracked.

3. Michael status card
   - Shows scheduled, waiting, in progress, completed, or action required.
   - Routes to `/michael/schedule` or `/michael/interview` based on state.

4. First Invitation mission
   - Appears before metrics for BAs with zero sent invites.
   - Starts with `Who do you know who would watch a short video from you?`
   - Supports manual name entry.
   - Routes selected person into `/invitations` or Ivory flow without automated prospecting.

5. Day 1 training card
   - Visible while waiting for Michael if business rules allow.
   - Tracks progress if backend supports it.

6. Questionnaire mission
   - Convert from one long 19-question form into guided steps.
   - Preserve fields unless a product decision later changes them.
   - Add progress and save/resume affordance when backend supports drafts.

7. Operational cockpit below launch path
   - Today's Actions.
   - Track Record.
   - My Invites.
   - Sponsor.
   - Orientation.
   - CRM.
   - Leadership.

### Welcome Page Direction

`apps/team/src/routes/welcome.tsx` should keep the ceremonial welcome, Kevin/Paul credibility, commitment tone, and seven-day arc, but the page should be shorter and more decisive.

Recommended first screen:

- Team Magnificent logo large enough to own the viewport.
- Short welcome promise.
- Primary CTA to enter Launch Center or schedule Michael.
- Secondary link to learn what happens next.

Move the seven-day arc into a reusable launch progress component instead of leaving it as static long-form copy.

### Questionnaire Direction

`apps/team/src/routes/onboarding/questionnaire.tsx` should become a wizard or guided interview.

- Preserve the existing 19 fields.
- Group into short sections.
- Show progress.
- Allow back/next navigation.
- Add save/resume only if backend draft persistence is added.
- Route back to Launch Center on success.

## 4. Final Ivory Invitation Agent Plan

Primary files:

- `apps/team/src/routes/ivory.tsx`
- `apps/team/src/routes/invitations.tsx`
- `server/src/domain/ivory.ts`
- `server/src/routes/ivory.ts`
- `server/src/domain/invitations.ts`
- `server/src/domain/crm.ts`
- `packages/shared/src/types.ts`
- `apps/team/src/routes/cockpit.tsx`

### Final UX Direction

Ivory becomes the Team Magnificent Invitation Agent. It should not feel like three separate tools. It should guide a BA from relationship memory to CRM entry to personalized invitation to minted link to PMV visibility.

Final Ivory state machine:

1. Who do you know?
2. Select or create person.
3. Capture why they came to mind.
4. Capture available CRM fields.
5. Generate one personal invitation draft.
6. BA edits and approves.
7. Create or update BA-owned CRM prospect record.
8. Mint tokenized invitation link.
9. Insert minted link into final message.
10. Copy/send screen.
11. BA clicks `I sent this`.
12. Prospect appears in PMV with source, relationship reason, message, and activity trail.

### Required Ivory Behavior

- Ivory must be relationship-first, not product-first.
- It must not automate prospecting.
- It must not score or qualify leads with AI.
- It must not send messages automatically.
- BA must review and edit every generated message.
- BA sends from their own phone, email, or chosen channel.
- The minted link must come from the existing invitation/token spine.
- Generated scripts and BA edits should be stored as CRM/invitation history.

### Required Inputs

- Name.
- Relationship category or free-form relationship.
- Why they came to mind.
- Optional phone, email, city, state.
- Interest context only if BA provides it.
- Desired tone/channel if implemented.

### Backend Changes

- Expand Ivory person/name model to support CRM-ready fields.
- Add draft generation endpoint if not already complete.
- Add invite creation endpoint or shared service call that uses existing invitation creation.
- Store `source: 'ivory'`.
- Store `ivoryId` or related source record ID.
- Store `relationshipReason`.
- Store generated draft and final edited message.
- Add initial CRM note from Ivory context.
- Prevent placeholder city/state/phone values.

### Frontend Changes

- Replace tabs/generator mental model with a guided linear flow.
- Keep roster and search as support panels, not the main experience.
- Add final review/send screen.
- Add return-to-PMV or Launch Center after `I sent this`.
- Reuse invitation success/copy/send UI from `/invitations` where practical.

## 5. Final Prospect Momentum Viewer Plan

Primary files:

- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`
- `apps/team/src/components/cockpit/MichaelEventCard.tsx`
- `server/src/domain/cockpit.ts`
- `server/src/domain/crm.ts`
- `server/src/domain/tokens.ts`
- `server/src/routes/cockpit.ts`
- `server/src/routes/crm.ts`
- `server/src/routes/p.ts`
- `server/src/domain/invitations.ts`
- `packages/shared/src/types.ts`

### Final UX Direction

The BA cockpit should become a true Prospect Momentum Viewer, not only a dashboard with inline CRM controls.

The PMV first viewport should show:

- Team Magnificent brand header.
- Focus Queue.
- Prospect Momentum Table.
- Status filters.
- Next best action recommendations.
- CRM ownership-safe row drawer.

### Required Prospect Lifecycle States

Use actual token states where already present and mirror them into the cockpit read model where necessary:

- `draft`
- `sent_unopened`
- `clicked`
- `video_started`
- `video_25` or `video_quarter`
- `video_50` or `video_half`
- `video_75` or `video_three_quarter`
- `watched` or `video_complete`
- `callback_requested`
- `customer`
- `enrolled`
- `expired`
- `archived`

The implementation should preserve existing state names where code already depends on them. If display labels need friendlier language, map labels in the UI rather than renaming backend states casually.

### Current Gap to Fix

The reviews identify a likely mismatch:

- Token lifecycle has granular states such as `clicked`, `video_started`, `video_quarter`, `video_half`, `video_three_quarter`, `video_complete`, and `enrolled`.
- Cockpit currently appears to read `prospects.state` and compress partial progress into broad `opened` behavior.
- `transitionTokenState()` appears to update invite tokens, but partial milestones may not be mirrored into the PMV/cockpit projection.
- `GET /api/p/:token` may not stamp `clicked`/`clickedAt` clearly enough for PMV.

This must be verified during implementation and corrected without breaking token logic.

### PMV Data Model Requirements

Each prospect row should have:

- Prospect identity.
- Invite source.
- Current lifecycle state.
- Last activity time.
- Video milestone/progress.
- Placement status where allowed.
- Callback request state.
- CRM note summary.
- Follow-up due state.
- Next action projection.
- BA-owned relationship context.

### Next Action Projection

Server should compute a deterministic `nextAction` object. It should be explainable and based on explicit behavior.

Suggested shape:

- `kind`
- `label`
- `reason`
- `priority`
- `dueAt`
- `scriptKind`

Examples:

- Prospect clicked but did not start video: follow up with light check-in.
- Prospect reached 50 percent: follow up with value-based nudge.
- Prospect completed video: invite callback or next step.
- Follow-up due: surface in Focus Queue.
- Expiring invitation window: remind BA to follow up.

No auto-send. No AI lead qualification.

### PMV UI Structure

1. Focus Queue
   - Highest impact prospects today.
   - Callback requests first.
   - Due follow-ups next.
   - Watched/completed prospects next.
   - Stalled or expiring prospects next.

2. Prospect Momentum Table
   - Compact, scan-friendly rows.
   - Status badges.
   - Video progress indicator.
   - Last activity.
   - Next action.
   - Source.

3. Row Drawer
   - Full CRM record.
   - Activity timeline.
   - Notes.
   - Follow-up schedule.
   - Invitation message history.
   - Copyable follow-up script if implemented.

4. Today's Actions
   - Keep as operating card, but make it feed or align with Focus Queue.

## 6. Final Brand/Motion System Plan

Primary files:

- `packages/shared/src/brand.ts`
- `packages/shared/src/brand.css`
- `packages/shared/src/types.ts`
- Global CSS files used by `.com` and `.team`
- Tailwind config files for `.com` and `.team`
- Logo assets under `assets/logos`

Known logo assets from review:

- `logo_dark_hero.png` - 1600x600 premium full signature.
- `logo_navbar.png` - 520x90 compact wordmark.
- `logo_icon.png` - 400x400 compass mark.
- `logo_dark_square.png` - 800x800 square lockup.
- `logo_light_print.png` - 1200x400 print/light.

### Final Brand Direction

Team Magnificent must be visually dominant on:

- Prospect dashboard first viewport.
- Prospect dashboard sticky ribbon.
- Team welcome page.
- Team Launch Center.
- Ivory Invitation Agent.
- BA cockpit / PMV.
- Dashboard footer and transition moments.

### Logo Usage Rules

- Use `logo_navbar.png` for compact headers and sticky ribbons.
- Use `logo_dark_hero.png` for welcome and prospect dashboard first viewport.
- Use `logo_icon.png` as watermark, small compass badge, loading mark, or empty-state seal.
- Use `logo_dark_square.png` for square cards, app badges, or onboarding ceremony blocks.
- Use `logo_light_print.png` only where the background requires light/print treatment.

### Color and Motion Rules

- Gold owns identity, ceremony, success, and Team Magnificent authority.
- Teal owns live system state, action, motion, and current momentum.
- Avoid one-note palettes.
- Use motion to show live momentum, not decoration.
- Rolling ticker should feel operational, not gimmicky.
- Animated counters should be concise, stable, and not shift layout.
- Respect reduced-motion preferences.

### Shared System Work

Create shared primitives where useful:

- Team Magnificent branded shell/header.
- Logo component with variant props.
- Countdown component.
- Rolling ticker component.
- Animated counter component.
- Status badge component.
- Progress meter component.
- Command-center card/panel primitives.

## 7. Implementation Phases

### Phase 0: Safety, Audit, and Shared Contracts

Launch impact: Critical.

- Verify current token lifecycle and placement behavior before UI changes.
- Verify cockpit read projection and whether video milestones mirror to prospects.
- Verify source fields for invitations and Ivory.
- Identify global CSS/Tailwind entry points for `.com` and `.team`.
- Create or extend shared types for lifecycle state, next action, invite source, and launch status.
- Do not alter placement behavior in this phase unless fixing a confirmed bug.

### Phase 1: Brand and Command-Center Foundation

Launch impact: Critical.

- Add shared Team Magnificent shell/header treatment.
- Use real logo assets across reviewed routes.
- Add shared countdown, ticker, animated counter, progress meter, and status badge primitives.
- Establish gold/teal usage rules in shared brand CSS.
- Ensure mobile and desktop layouts do not overlap or waste excessive whitespace.

### Phase 2: Prospect Dashboard Command Center

Launch impact: Critical.

- Refactor the prospect dashboard first viewport into Position & Momentum Center.
- Promote placement, counter, countdown, ticker, and CTA above the fold.
- Preserve existing section content below.
- Keep dashboard locked until placement exists.
- Do not force redirect on video completion.

### Phase 3: PMV Backend Projection and Cockpit Redesign

Launch impact: Critical.

- Fix or implement milestone mirroring from token/video events into cockpit read model.
- Add server-computed next action projection.
- Redesign cockpit first viewport around Focus Queue and Prospect Momentum Table.
- Keep CRM ownership/security intact.
- Keep Today's Actions but align it with PMV.

### Phase 4: Ivory Invitation Agent

Launch impact: Important.

- Convert Ivory into guided relationship-first flow.
- Store relationship reason and invitation draft trail.
- Reuse invitation minting/link flow.
- Ensure no placeholders are submitted as CRM facts.
- Add PMV visibility for Ivory-created invitations.

### Phase 5: Team Launch Center and Questionnaire Wizard

Launch impact: Important.

- Convert `/cockpit` first-run experience into Launch Center.
- Add launch checklist and Michael status card.
- Add first invitation mission.
- Refactor questionnaire into guided wizard.
- Preserve welcome and onboarding content, but reduce long-page pressure.

### Phase 6: Polish, QA, and Compliance Review

Launch impact: Critical before release.

- Verify responsive behavior.
- Verify reduced-motion behavior.
- Verify no claim language violates compliance.
- Verify prospect pages do not show income, CV, cycle math, or spillover promises.
- Verify CRM data is BA-scoped.
- Verify invalid/expired tokens and unplaced prospects have safe states.

## 8. Exact Files to Modify

### Prospect `.com` Dashboard

- `apps/com/src/routes/tm-prospect-dashboard/tm-prospect-dashboard.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/00-Ribbon.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/01-Arrival.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/02-Opportunity.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/03-Mechanic.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/04-LivePlace.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/05-TmAdvantage.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/06-YourNextMove.tsx`
- `apps/com/src/routes/tm-prospect-dashboard/sections/07-Footer.tsx`

### Team Onboarding and Cockpit

- `apps/team/src/routes/welcome.tsx`
- `apps/team/src/routes/onboarding/questionnaire.tsx`
- `apps/team/src/routes/michael-schedule.tsx`
- `apps/team/src/routes/michael-interview.tsx`
- `apps/team/src/routes/invitations.tsx`
- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`
- `apps/team/src/components/cockpit/MichaelEventCard.tsx`

### Ivory and Invitation Backend

- `apps/team/src/routes/ivory.tsx`
- `server/src/routes/ivory.ts`
- `server/src/domain/ivory.ts`
- `server/src/domain/invitations.ts`
- `server/src/domain/crm.ts`
- `server/src/routes/crm.ts`

### Token, Video, Placement, and PMV Backend

- `server/src/domain/tokens.ts`
- `server/src/routes/p.ts`
- `server/src/domain/cockpit.ts`
- `server/src/routes/cockpit.ts`
- Video event route/controller files if separate in the current codebase.
- Placement domain/service files if separate in the current codebase.

### Shared Brand and Types

- `packages/shared/src/brand.ts`
- `packages/shared/src/brand.css`
- `packages/shared/src/types.ts`
- `.com` global CSS entry files.
- `.team` global CSS entry files.
- `.com` Tailwind config.
- `.team` Tailwind config.

## 9. Backend Changes Required

### Critical Backend Work

- Ensure prospect presentation open/click event is recorded when tokenized link is opened.
- Ensure video events update token lifecycle idempotently.
- Ensure video milestone events are visible in cockpit/PMV projection.
- Ensure placement remains idempotent.
- Ensure placement does not force prospect navigation.
- Ensure dashboard availability is derived from placement state.
- Ensure invalid/expired token behavior is explicit and safe.
- Ensure BA ownership scopes every CRM and prospect read/write.

### PMV Backend Work

- Add or extend cockpit endpoint to return PMV-ready prospect rows.
- Include granular lifecycle state and last meaningful event.
- Include video progress.
- Include invitation source.
- Include next action projection.
- Include CRM note/follow-up summary.
- Keep raw private details scoped to the owning BA.

### Ivory Backend Work

- Add CRM-ready Ivory person fields.
- Add relationship reason storage.
- Store generated and final invitation messages.
- Store `source: 'ivory'` on invite/prospect records.
- Prevent placeholder values from becoming CRM facts.
- Create initial CRM note/activity when Ivory creates an invitation.

### Launch Center Backend Work

- Add or extend launch status endpoint.
- Return welcome accepted state.
- Return Michael schedule/interview state.
- Return questionnaire submission state.
- Return Day 1/training progress if implemented.
- Return invite and sent counts.
- Return first invitation candidate count if persisted.

## 10. Frontend Changes Required

### Critical Frontend Work

- Replace long-page first viewports with command-center first viewports.
- Use real Team Magnificent logo assets prominently.
- Make primary next actions visible without scrolling.
- Promote counters, countdowns, and ticker into dashboard surfaces.
- Keep explanatory content accessible below command centers.
- Add mobile-first compact layouts.
- Add loading, empty, invalid-token, unplaced, and error states.

### Prospect Dashboard Frontend Work

- Create Position & Momentum Center composition.
- Add sticky branded ribbon.
- Add prominent placement card.
- Add beneath-you counter if data exists.
- Add countdown and rolling ticker.
- Add primary action cluster.
- Rehouse current sections below.

### Team Launch Center Frontend Work

- Add launch header and checklist.
- Add Michael card.
- Add First Invitation Mission.
- Move metrics and CRM below launch path for new BAs.
- Refactor questionnaire page into wizard.

### Ivory Frontend Work

- Replace tabs with guided flow.
- Add person creation/edit panel.
- Add relationship reason prompt.
- Add editable draft step.
- Add minted-link review/send screen.
- Add PMV/Launch Center return path.

### PMV Frontend Work

- Add Focus Queue.
- Add Prospect Momentum Table.
- Add status filters.
- Add row drawer.
- Add next action display.
- Align Today's Actions with PMV data.

## 11. Components to Create

### Prospect Dashboard Components

- `PositionMomentumCenter`
- `PositionCard`
- `BeneathYouCounter`
- `PlacementTicker`
- `CountdownCard`
- `MomentumStats`
- `PrimaryActions`
- `DashboardExplainers`

### Team Launch Components

- `LaunchCenter`
- `LaunchChecklist`
- `LaunchStepCard`
- `MichaelLaunchCard`
- `FirstInvitationMission`
- `WhoDoYouKnowList`
- `QuestionnaireWizard`
- `FirstInviteSuccess`

### Ivory Components

- `IvoryInvitationAgent`
- `RelationshipPromptStep`
- `IvoryPersonForm`
- `IvoryDraftReview`
- `IvorySendChecklist`
- `IvoryActivitySummary`

### PMV Components

- `ProspectMomentumViewer`
- `FocusQueue`
- `ProspectMomentumTable`
- `ProspectMomentumRow`
- `ProspectMomentumDrawer`
- `LifecycleBadge`
- `VideoProgressPill`
- `NextActionCard`
- `FollowUpScriptPanel`

### Shared Brand/Motion Components

- `TeamMagnificentLogo`
- `TeamMagnificentShell`
- `CommandRibbon`
- `ProgressMeter`
- `AnimatedCounter`
- `RollingTicker`
- `Countdown`
- `StatusBadge`

## 12. Components to Refactor

- `tm-prospect-dashboard.tsx`: from long section stack to command-center composition.
- `00-Ribbon.tsx`: into sticky branded command ribbon.
- `01-Arrival.tsx`: compress and integrate with first viewport.
- `04-LivePlace.tsx`: extract live placement facts into Position & Momentum Center.
- `06-YourNextMove.tsx`: extract CTA language and action model.
- `welcome.tsx`: shorten ceremonial page and route into Launch Center.
- `questionnaire.tsx`: convert to wizard while preserving fields.
- `invitations.tsx`: support first-invite, Ivory, and shared send-success modes.
- `ivory.tsx`: replace adjacent tools with guided invitation agent.
- `cockpit.tsx`: split Launch Center and operational PMV concerns.
- `TodaysActions.tsx`: keep urgency card but make it work with Focus Queue and new-BA states.
- `MichaelEventCard.tsx`: keep event card but ensure it does not substitute for PMV action design.

## 13. Copy/Narrative Changes

### Prospect Dashboard Copy

- Lead with position, momentum, and next action.
- Move longer explanatory content below the command center.
- Use PMV language on prospect-facing pages: People, Momentum, Volume, Checks.
- Avoid income guarantees, spillover promises, CV amounts, cycle math, or dollar examples.
- Use `your Brand Ambassador will reach out` or `[BA name] will reach out`, never hard-coded Kevin language.

### Team Launch Copy

- Change broad onboarding language into mission language.
- Use action-led labels: Schedule Michael, Start Day 1, Build Your First List, Draft First Invitation, Send First Invitation, Complete Questionnaire.
- Preserve welcome credibility and Team Magnificent story.
- Reduce long explanatory blocks on first screens.

### Ivory Copy

- Replace generator framing with invitation agent framing.
- Start with relationship memory: `Who came to mind?`
- Ask: `Why did they come to mind?`
- Remind BA that they review, edit, and send personally.
- Avoid language implying automated prospecting or AI qualification.

### PMV Copy

- Use operational labels: Focus Queue, Momentum, Last Activity, Next Action, Follow Up Due.
- Explain recommendations with behavioral reasons, not AI certainty.
- Use relationship-safe language from BA notes.

## 14. Compliance Constraints

Non-negotiable constraints:

- No AI lead qualification.
- No automated prospecting.
- No automated AI calling.
- No auto-sending invitations or follow-ups.
- No income guarantees.
- No spillover promises.
- No CV amounts, cycle math, or dollar amounts on prospect pages.
- Prospect-facing language uses PMV only: People, Momentum, Volume, Checks.
- BA owns the relationship and sends messages personally.
- CRM records must remain BA-scoped.
- Prospect dashboard must not expose private CRM notes.
- Invalid or expired tokens must be handled safely.
- Placement must remain idempotent.
- Dashboard access must remain tied to placement availability.
- Follow-up recommendations must be deterministic and explainable from explicit behavior or BA-entered facts.

## 15. Acceptance Criteria

### Prospect Dashboard

- First viewport clearly displays Team Magnificent brand.
- Prospect can see their placement position immediately after placement.
- Dashboard does not render team line before placement.
- Countdown is visible without deep scrolling.
- Rolling ticker or equivalent momentum signal is visible if data exists.
- Animated counters are visible, stable, and responsive.
- Primary next action is visible above the fold.
- Return-to-presentation behavior remains available.
- No compliance-prohibited claims appear.

### Team Launch Center

- New BA sees a clear launch progress meter.
- New BA sees one dominant next action.
- Mission checklist shows complete/current/locked/optional states.
- Michael schedule/interview state is visible from Launch Center.
- First invitation mission appears before generic metrics for zero-invite BAs.
- Questionnaire is no longer one uninterrupted long form.
- Existing welcome content is preserved in shorter/guided form.

### Ivory Invitation Agent

- Ivory starts with relationship/person selection.
- `Why they came to mind` is captured.
- CRM-ready fields are collected without placeholders.
- One editable invitation draft is generated per person.
- Minted link is inserted only after token/link creation.
- BA must review and send manually.
- Invitation appears in PMV with `source: 'ivory'`.
- Draft/final message and activity are stored.

### PMV

- Cockpit first viewport centers prospect momentum.
- Focus Queue prioritizes callback requests, due follow-ups, watched/completed prospects, and stalled/expiring prospects.
- Prospect rows show granular lifecycle/video progress.
- Next action projection is visible and explainable.
- CRM row drawer preserves BA ownership.
- Today's Actions aligns with PMV rather than competing with it.

### Brand/Motion

- Real logo assets are used in headers and first viewports.
- Gold and teal roles are consistent.
- Motion supports live status, countdown, ticker, and counters.
- Reduced-motion preference is respected.
- Mobile layouts remain usable and non-overlapping.

## 16. QA Checklist

### Functional QA

- Open a valid minted prospect link.
- Confirm click/open event is recorded.
- Start video and confirm `video_started` is recorded.
- Cross 25, 50, and 75 percent and confirm milestones are recorded once.
- Complete video and confirm completion is recorded once.
- Confirm placement is created idempotently.
- Confirm prospect is not forced away from presentation.
- Confirm dashboard becomes available only when placement exists.
- Confirm prospect can choose when to view dashboard.
- Confirm invalid/expired token states render safely.

### PMV QA

- Confirm BA only sees owned prospects.
- Confirm partial video progress appears in PMV.
- Confirm watched/completed prospects surface in Focus Queue.
- Confirm follow-up due items surface correctly.
- Confirm CRM notes save and remain scoped.
- Confirm Ivory-created prospects show source and relationship context.
- Confirm no AI scoring or automated qualification appears.

### Ivory QA

- Create a person from Who Do You Know.
- Draft invitation.
- Edit draft.
- Mint link.
- Confirm final message includes minted link.
- Mark sent.
- Confirm PMV shows sent invite and source.
- Confirm no placeholder contact/location values are stored.

### Launch Center QA

- Register or simulate new BA.
- Confirm welcome routes into launch path.
- Schedule Michael.
- Confirm Launch Center updates Michael state.
- Complete questionnaire wizard.
- Confirm progress updates.
- Mint and mark first invitation sent.
- Confirm cockpit transitions toward operational PMV.

### Visual QA

- Check desktop and mobile for prospect dashboard.
- Check desktop and mobile for Launch Center.
- Check desktop and mobile for Ivory.
- Check desktop and mobile for PMV.
- Confirm no excessive whitespace in command surfaces.
- Confirm logo sizes are dominant enough.
- Confirm text does not overlap in cards/buttons/tables.
- Confirm ticker/counters do not shift layout.
- Confirm reduced-motion mode is acceptable.

### Compliance QA

- Search prospect-facing copy for income promises.
- Search prospect-facing copy for spillover promises.
- Search prospect-facing copy for CV, cycle math, or dollar amounts.
- Confirm follow-up language says BA will reach out.
- Confirm Ivory never implies automated sending.
- Confirm PMV recommendations are behavior-based and explainable.

## Serial Implementation Order for Codex Agents

1. Audit and document current token, video, placement, PMV projection, invitation source, and CRM ownership behavior. Do not change UI yet.
2. Add or refine shared brand, logo, motion, status, countdown, ticker, counter, and progress primitives.
3. Implement prospect dashboard Position & Momentum Center while preserving all existing sections below it.
4. Verify dashboard gating, placement idempotency, and return-to-presentation behavior.
5. Implement PMV backend projection: granular lifecycle, video progress, next action, and Focus Queue data.
6. Refactor cockpit first viewport into Prospect Momentum Viewer while preserving CRM controls and Today's Actions.
7. Convert Ivory into guided relationship-first Invitation Agent using shared invitation mint/send flow.
8. Add Ivory source, relationship reason, draft/final message, and initial CRM activity persistence.
9. Convert `/cockpit` new-BA state into Team Magnificent Launch Center with checklist, Michael card, and first invitation mission.
10. Refactor questionnaire into wizard and shorten welcome into a Launch Center handoff.
11. Run full functional, visual, mobile, and compliance QA.
12. Only after all above pass, consider trimming duplicated long-form copy. Reorganize before deleting.
