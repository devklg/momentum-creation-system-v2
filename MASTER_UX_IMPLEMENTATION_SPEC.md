# Master UX Implementation Spec

Project: `momentum-creation-system-v2`

Source reviews synthesized:

- `docs/v2-redesign/BRAND_VISUAL_REVIEW.md`
- `docs/v2-redesign/DASHBOARD_UX_REVIEW.md`
- `docs/v2-redesign/IVORY_INVITATION_AGENT_REVIEW.md`
- `docs/v2-redesign/PROSPECT_MOMENTUM_VIEWER_REVIEW.md`
- `docs/v2-redesign/TEAM_ONBOARDING_REVIEW.md`

This is an implementation plan only. It does not authorize a rebuild, source
rewrite, backend replacement, or removal of working business logic.

## 1. North Star

The v2 redesign converts the finished v1 system into a more guided, branded,
operational Team Magnificent experience.

The code already has the important business spine:

- Brand Ambassador onboarding.
- Michael scheduling and interview state.
- Invitation minting.
- Tokenized prospect links.
- Video and placement behavior.
- Prospect dashboard.
- BA cockpit and CRM controls.
- Ivory roster and generator foundations.
- Source tracking for `self`, `ivory`, and `scriptmaker`.

The UX problem is not missing content. The problem is information architecture:
valuable content is spread across long pages, feature tabs, and separate tools.
v2 should make the live operating center obvious first, then preserve deeper
education and detail below.

## 2. Non-Negotiable Boundaries

- v1 remains the stable completed version.
- v2 is the redesign workspace.
- Do not rebuild backend logic unless a verified UX requirement needs it.
- Preserve token placement behavior.
- Preserve the invitation spine.
- Preserve BA-scoped CRM ownership.
- Preserve source tracking for invitation origin.
- Preserve compliance boundaries.
- Do not add AI lead qualification.
- Do not add automated prospecting.
- Do not add automated AI calling.
- Do not auto-send invitations or follow-ups.
- Do not make income, spillover, CV, cycle, rank, placement, or dollar claims on
  prospect-facing pages.
- Prospect-facing language must stay in PMV terms: People, Momentum, Volume,
  Checks.
- Use "[BA name] will reach out" language, never hard-coded Kevin outreach.

## 3. Priority Stack

### Priority 1: Shared Team Magnificent Brand System

Build the visual foundation first so every redesigned surface feels like one
Team Magnificent product instead of disconnected pages.

Primary goals:

- Make Team Magnificent visually dominant on `.com` and `.team` first viewports.
- Use real logo assets instead of text-only labels or hand-drawn marks.
- Make gold the identity/ceremony color.
- Use teal for live state, action, motion, coach intelligence, and progress.
- Add restrained motion for live momentum, not decoration.

Logo roles:

- `logo_navbar.png`: sticky ribbons, app headers, module headers.
- `logo_dark_hero.png`: welcome hero and prospect dashboard first viewport.
- `logo_icon.png`: compass badge, watermark, empty-state seal.
- `logo_dark_square.png`: square cards, modals, loading/empty states.
- `logo_light_print.png`: light-background or print use only.

Files likely touched:

- `packages/shared/src/brand.ts`
- `packages/shared/src/brand.css`
- `.com` and `.team` global CSS files
- `.com` and `.team` Tailwind config files
- Header/ribbon surfaces in dashboard, welcome, cockpit, and Ivory

Shared primitives to create:

- `TeamMagnificentLogo`
- `TeamMagnificentShell`
- `CommandRibbon`
- `ProgressMeter`
- `AnimatedCounter`
- `RollingTicker`
- `Countdown`
- `StatusBadge`
- `LifecycleBadge`

### Priority 2: Prospect Position & Momentum Center

Convert the prospect dashboard from a cinematic long page into a live command
center that answers the prospect's immediate post-video questions:

- Where am I?
- What number am I?
- Is this live?
- What is happening beneath me?
- What is the next event or decision point?
- What should I do next?

First viewport must include:

- Sticky Team Magnificent ribbon with `logo_navbar.png`.
- Prospect identity and inviter context.
- Position card.
- Beneath-you live counter.
- Next event countdown.
- Primary callback/talk-to-BA action.
- Rolling ticker of team momentum.
- Compact live stats where data exists.

Preserve below the center:

- Arrival confirmation.
- Market stats.
- Power of 2 mechanic.
- Live placement explanation.
- Team Magnificent advantage.
- Kevin quote and 100,000 mission context.
- Full callback and webinar reservation flows.
- Compliance footer.

Primary files:

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

Key implementation rules:

- Do not remove valuable content first; reorganize it.
- Do not show team line before placement exists.
- Do not force navigation away from the presentation after video completion.
- Keep placement idempotent.
- Keep the ticker privacy-safe.
- Keep countdown and counters layout-stable on mobile.

### Priority 3: Prospect Momentum Viewer

Make the BA cockpit a true Prospect Momentum Viewer, not only a dashboard with
inline CRM controls.

First viewport should center:

- Team Magnificent branded header.
- Focus Queue.
- Prospect Momentum Table.
- Status filters.
- Next-action projections.
- CRM-safe row drawer.

Required lifecycle visibility:

- `draft`
- `sent_unopened`
- `clicked`
- `video_started`
- `video_25` or existing quarter state
- `video_50` or existing half state
- `video_75` or existing three-quarter state
- `watched` or existing complete state
- `callback_requested`
- `customer`
- `enrolled`
- `expired`
- `archived`

Current gap to verify:

- Token lifecycle has granular states.
- Cockpit currently compresses partial progress into broader display states.
- Click/open events may not be stamped clearly enough for PMV.
- Partial video milestones may not be mirrored into the cockpit projection.

Backend work:

- Audit token click and video progress writes before changing UI.
- Add or extend a PMV projection endpoint.
- Return Focus Queue and table data from one BA-scoped payload.
- Add deterministic `nextAction` per prospect.
- Keep Today’s Actions and PMV deriving from the same model.
- Keep CRM writes BA-owned and private.

Suggested `nextAction` shape:

```ts
type ProspectNextAction = {
  kind:
    | "send_invite"
    | "call_now"
    | "reply_to_callback"
    | "follow_up_due"
    | "send_soft_nudge"
    | "ask_if_video_played"
    | "reinvite"
    | "schedule_followup"
    | "wait"
    | "none";
  label: string;
  reason: string;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: string | null;
  scriptKind:
    | "initial_send"
    | "callback_reply"
    | "clicked_no_watch"
    | "partial_watch"
    | "watched_no_callback"
    | "reinvite"
    | "later_reconnect"
    | null;
};
```

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

### Priority 4: Ivory Invitation Agent

Redesign Ivory from `Roster + Coach + Generator` into one relationship-first
Invitation Agent.

Final flow:

1. Who do you know?
2. Select or create person.
3. Capture why they came to mind.
4. Capture real CRM-ready fields.
5. Generate one personal invitation draft.
6. BA edits and approves.
7. Create or merge BA-owned CRM prospect record.
8. Mint tokenized invitation link through the existing invitation spine.
9. Insert link into final message.
10. Show copy/send screen.
11. BA clicks "I sent this".
12. Prospect appears in PMV with source, relationship reason, message, and trail.

Required behavior:

- Ivory starts with relationship memory, not product selection.
- Product context can support the message but must not lead the flow.
- The message is written for one person at a time.
- BA must review and edit before mint/send.
- BA sends from their own phone, email, or chosen channel.
- Ivory must not auto-send.
- Ivory must not score or qualify leads with AI.
- Placeholder city/state/phone values must not become CRM facts.

Primary files:

- `apps/team/src/routes/ivory.tsx`
- `apps/team/src/routes/invitations.tsx`
- `server/src/domain/ivory.ts`
- `server/src/routes/ivory.ts`
- `server/src/domain/generator.ts`
- `server/src/domain/invitations.ts`
- `server/src/domain/crm.ts`
- `server/src/routes/crm.ts`
- `packages/shared/src/types.ts`

### Priority 5: Team Launch Center

Make `/cockpit` act as the Team Magnificent Launch Center for new BAs, then
mature into the operational PMV once launch milestones are complete.

The Launch Center must answer:

- What is done?
- What is unlocked?
- What is next?
- What is optional?
- What gets me into motion today?

New-BA first viewport:

- Team Magnificent launch header.
- Launch progress meter.
- One dominant next action.
- Mission checklist.
- Michael status card.
- First Invitation mission.
- Day 1 training card.
- Questionnaire mission.
- Operational PMV/cockpit below the launch path.

Recommended launch steps:

1. Welcome accepted.
2. Michael scheduled.
3. Michael completed.
4. Day 1 started/completed if tracked.
5. Who Do You Know list started.
6. First invitation drafted.
7. First invitation minted.
8. First invitation sent.
9. Questionnaire submitted.
10. Sponsor connection confirmed if tracked.

Primary files:

- `apps/team/src/routes/welcome.tsx`
- `apps/team/src/routes/onboarding/questionnaire.tsx`
- `apps/team/src/routes/michael-schedule.tsx`
- `apps/team/src/routes/michael-interview.tsx`
- `apps/team/src/routes/invitations.tsx`
- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`

Likely new files:

- `apps/team/src/components/launch/LaunchCenter.tsx`
- `apps/team/src/components/launch/LaunchChecklist.tsx`
- `apps/team/src/components/launch/LaunchStepCard.tsx`
- `apps/team/src/components/launch/MichaelLaunchCard.tsx`
- `apps/team/src/components/launch/FirstInvitationMission.tsx`
- `apps/team/src/components/launch/WhoDoYouKnowList.tsx`
- `apps/team/src/components/launch/FirstInviteSuccess.tsx`
- `apps/team/src/routes/onboarding/QuestionnaireWizard.tsx`

## 4. Implementation Phases

### Phase 0: Audit and Safety Map

Do first. Do not redesign UI yet.

- Audit token resolution, click stamping, video progress transitions, and
  placement creation.
- Audit cockpit projection and whether partial video milestones are visible.
- Audit invitation source fields and Ivory source flow.
- Audit CRM BA ownership checks.
- Audit logo assets and current global CSS/Tailwind entry points.
- Document confirmed contracts before edits.

Exit criteria:

- Current token, placement, invitation, and CRM behaviors are mapped.
- Any verified backend gaps are listed with exact files and risk.
- No redesign UI has been implemented.

### Phase 1: Shared Brand and Motion Foundation

- Add shared brand/logo primitives.
- Add shared command ribbon/header primitives.
- Add countdown, ticker, counter, progress, and status primitives.
- Establish gold/teal roles in shared brand CSS.
- Respect reduced-motion preferences.
- Verify desktop/mobile layout stability.

Exit criteria:

- Shared primitives are available for `.com` and `.team`.
- Existing pages still typecheck and build.

### Phase 2: Prospect Position & Momentum Center

- Build the dashboard first viewport.
- Promote position, beneath-you counter, ticker, countdown, and action.
- Preserve current sections below.
- Replace hand-drawn marks with real logo assets.
- Keep dashboard gating and placement behavior unchanged.

Exit criteria:

- Prospect sees position/momentum/next action without deep scrolling.
- No compliance-prohibited claims appear.
- Token and placement behavior remains unchanged unless a verified bug was fixed.

### Phase 3: PMV Backend Projection

- Add or extend PMV-ready cockpit endpoint.
- Include granular lifecycle, video progress, source, last signal, CRM summary,
  follow-up due state, and deterministic next action.
- Align Today’s Actions with the same projection.
- Add state-specific script hooks only as copy-only, BA-sent tools.

Exit criteria:

- Focus Queue can be derived from server truth.
- PMV table can show granular progress.
- CRM and prospect reads remain BA-scoped.

### Phase 4: PMV Frontend Redesign

- Rebuild cockpit first viewport around Focus Queue and Prospect Momentum Table.
- Move CRM details into row drawer/detail panels.
- Keep sponsor, orientation, leadership, and track record as secondary surfaces.
- Keep Michael Event scoring separate from prospect momentum.

Exit criteria:

- BA can scan who needs action next from the first viewport.
- Collapsed rows show source, stage, progress, last signal, and next action.

### Phase 5: Ivory Invitation Agent

- Replace tabs/generator mental model with guided flow.
- Add person selection/creation, relationship reason, editable draft, mint,
  copy/send, and "I sent this" completion.
- Reuse the invitation spine.
- Store `source: "ivory"`, relationship reason, draft/final message, and CRM
  activity.

Exit criteria:

- Ivory creates one personal invitation at a time.
- Prospect appears in PMV with Ivory context.
- No placeholder facts are stored.

### Phase 6: Team Launch Center and Questionnaire Wizard

- Convert new-BA cockpit state into Launch Center.
- Add mission checklist, Michael card, First Invitation mission, Day 1 card, and
  questionnaire mission.
- Shorten welcome into a ceremony plus handoff.
- Convert questionnaire into guided steps while preserving fields.

Exit criteria:

- New BA sees one next move.
- First invitation path appears before generic metrics for zero-invite BAs.
- Questionnaire is no longer one uninterrupted long form.

### Phase 7: Visual, Functional, and Compliance QA

- Test valid, invalid, expired, and unplaced prospect tokens.
- Test video start, 25, 50, 75, and completion events.
- Test placement idempotency.
- Test PMV ownership scoping.
- Test Ivory create/draft/mint/send path.
- Test Launch Center progress states.
- Test mobile, desktop, reduced motion, loading, empty, and error states.
- Search prospect-facing copy for prohibited compliance language.

Exit criteria:

- `pnpm typecheck` passes.
- `pnpm build` passes.
- No prospect-facing compliance violations are present.
- v1 remains untouched.

## 5. Exact Codex Agent Order

1. Audit Agent: token, video, placement, invitation source, CRM ownership, and
   current CSS/logo contracts. No UI edits.
2. Brand Foundation Agent: shared Team Magnificent shell, logo, color, motion,
   countdown, ticker, counter, progress, and badge primitives.
3. Prospect Dashboard Agent: Position & Momentum Center first viewport and
   preservation/reorganization of existing `.com` dashboard content.
4. PMV Backend Agent: cockpit projection, granular lifecycle, Focus Queue data,
   next action, and Today’s Actions alignment.
5. PMV Frontend Agent: cockpit first viewport, prospect table, filters, row
   drawer, and next-action display.
6. Ivory Agent: relationship-first invitation flow, CRM merge, draft/final
   message trail, token minting, and PMV visibility.
7. Launch Center Agent: new-BA Launch Center, checklist, Michael card, First
   Invitation mission, welcome handoff, and questionnaire wizard.
8. QA/Compliance Agent: responsive QA, reduced-motion QA, token journey QA,
   CRM scoping QA, and compliance copy audit.

## 6. Acceptance Summary

The redesign is ready when:

- Team Magnificent is visually dominant in the reviewed first viewports.
- Prospect dashboard reads as a live Position & Momentum Center.
- Cockpit reads as a Prospect Momentum Viewer.
- Ivory reads as a relationship-first Invitation Agent.
- New BAs move through a Launch Center instead of guessing from long pages.
- Existing backend spine remains intact unless a verified bug required a scoped
  fix.
- Typecheck and build pass.
- Compliance boundaries are preserved.
