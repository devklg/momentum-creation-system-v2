# Team Magnificent Onboarding UX Review

Scope: `apps/team` onboarding UX only. Reviewed:

- `apps/team/src/routes/welcome.tsx`
- `apps/team/src/routes/onboarding/questionnaire.tsx`
- `apps/team/src/routes/michael-schedule.tsx`
- `apps/team/src/routes/michael-interview.tsx`
- `apps/team/src/routes/invitations.tsx`
- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`

Goal: convert the current long onboarding surfaces into a guided Team Magnificent Launch Center.

## 1. Current onboarding structure

The current BA onboarding journey is a sequence of separate pages:

1. `/welcome`
   - First authenticated screen after registration.
   - Long ceremonial welcome letter with leader credibility, commitment copy, signatures, "What happens next", and a seven-day arc.
   - Primary action records acceptance and routes to `/michael/schedule`.
   - Day 1 training is linked from a card, but the main required action is Michael scheduling.

2. `/michael/schedule`
   - State-driven scheduler for the Michael interview.
   - States: scheduling, scheduled, in progress, completed.
   - Strongest current example of a focused task surface.
   - Uses "Step 1 of 7" language, but that step language is local to this page and not part of a persistent launch path.

3. `/michael/interview`
   - State-driven interview surface.
   - Reads server truth and switches between awaiting call, call in progress, complete, and failure states.
   - Operationally correct, but it is separate from the launch center experience.

4. `/onboarding/questionnaire`
   - Long 19-question self-serve questionnaire.
   - Multiple sections, all fields required.
   - Success routes to `/cockpit`.
   - This feels like an application form, not a guided onboarding mission.

5. `/invitations`
   - Plain-form front door into the invitation spine.
   - BA enters prospect details, writes or reviews an invitation message, mints a personal link, copies it, and marks "I sent this".
   - Already has the correct seam for `source='ivory'` and `source='scriptmaker'`, but the default experience starts with a blank form.

6. `/cockpit`
   - Current BA home base.
   - Shows counts, Today's Actions, Track Record, My Invites, My Sponsor, orientation, CRM controls, and leadership.
   - Primary CTA is "Invite someone".
   - Empty invite state asks "Who are you sharing with today?" and points to minting the first link.

7. `TodaysActions`
   - Reads `/api/cockpit/todays-actions`.
   - Prioritizes callbacks, due follow-ups, and expiring windows.
   - Empty state still displays the bias prompt.
   - This is useful after activity exists, but it is not enough for a brand-new BA who has not launched yet.

## 2. Problems

### Onboarding feels like long pages

- `/welcome` is emotionally strong but too much of the launch logic is embedded in a long letter. The BA has to read past several blocks before taking the first action.
- `/onboarding/questionnaire` is the biggest long-page problem. It asks for 19 required fields in one uninterrupted form. There is no visible step count, save/resume affordance, or progress meter.
- `/cockpit` is dense and operational. It works as a home base after the BA has invites, but for a new BA it mixes launch, CRM, sponsor, orientation, leadership, and metrics without a single mission path.
- `/invitations` is focused, but it starts from blank data entry. The BA must already know who to invite before the product helps them choose.

### Action is unclear

- The system says Michael is the first gate, Day 1 is available, questionnaire matters, and invitations matter, but no one surface owns "do this next".
- The cockpit header CTA says "Invite someone", Today's Actions may say "Nothing pressing", and My Invites may say "Mint your first link". These are related, but they are not presented as one launch mission.
- The questionnaire success state says the sponsor will review responses and then routes to cockpit. It does not explain what the BA should do next inside the business.
- The Michael completed state routes to Day 1, while the welcome page also says Day 1 opens while waiting. The current path risks feeling like multiple starts instead of one guided launch.

### Progress should be shown earlier and persistently

- `/welcome` has a seven-day arc, but it is static copy, not a progress component.
- `/michael/schedule` uses "Step 1 of 7", but later pages do not preserve that same step system.
- `/cockpit` has counts for invite activity, but it does not show onboarding progress such as Michael scheduled, Michael complete, questionnaire complete, first list started, first invite minted, first invite sent.
- The BA should always see what is done, what is unlocked, what is next, and what is optional.

### New BAs are not guided to the first invitation

- The invitation spine is good once the BA arrives with a name.
- The missing UX is the guided thinking step before the form: "Who do you know?" should generate the first candidate list before the BA sees a blank prospect form.
- The first invitation should feel like a launch milestone, not a generic form submission.
- After the first link is minted, the BA needs a clear checklist: copy message + link, send from personal phone, mark sent, then return to Launch Center.

### "Who Do You Know" appears too late

- The welcome seven-day arc mentions "Your list" on Day 4, but the business needs the BA moving toward a first invitation much earlier.
- The cockpit empty state asks the right question, but it is buried under metrics and actions.
- The current invitation form captures a prospect; it does not help the BA remember prospects.
- Ivory is correctly separate from the invitation page, but the Launch Center should expose a non-automated, BA-authored "Who Do You Know" mission early.

### Mission/checklist experience is missing

- There are multiple task surfaces, but no launch mission model.
- The BA should see a checklist with completion state, gate state, and next action:
  - welcome accepted
  - Michael scheduled
  - Michael completed
  - Day 1 started
  - Who Do You Know list started
  - first invitation drafted
  - first invitation sent
  - questionnaire submitted
  - sponsor connection confirmed
- Today's Actions is an operating card. The Launch Center needs a separate "Start Here" mission card for new BAs.

## 3. Recommended Launch Center structure

Make `/cockpit` the Team Magnificent Launch Center for new BAs, then let it mature into the current cockpit after launch.

Recommended top-level structure:

1. Launch header
   - "Launch Center" instead of only "Cockpit" during onboarding.
   - One primary next action button.
   - Small progress meter: `3 of 8 launch steps complete`.

2. Mission checklist
   - Persistent checklist card above Today's Actions.
   - Shows completed, current, locked, and optional steps.
   - Each step has one verb-led CTA.
   - The current step is visually dominant.

3. First invitation mission
   - Appears before metrics for any BA with zero sent invites.
   - Starts with "Who do you know who would watch a two-minute video from you?"
   - Lets the BA add 3-10 names manually.
   - Routes one selected person into `/invitations` with `source='ivory'` only when Ivory drafts the message; otherwise `source='self'`.
   - No automated prospecting and no AI lead qualification.

4. Michael gate card
   - Shows scheduled status, call time, in-progress state, or complete state.
   - Keeps the unlock logic visible without forcing the BA to rediscover `/michael/schedule`.

5. Training and questionnaire cards
   - Day 1 can remain available early.
   - Questionnaire should appear as a smaller mission step, not a giant independent destination with no progress.
   - Convert the 19-question form into grouped steps or a wizard.

6. Operational cockpit
   - Today's Actions, Track Record, My Invites, Sponsor, Orientation, CRM, and Leadership stay below the launch mission.
   - Once launch is complete, the operational cockpit can move back to the top.

Recommended Launch Center order for a new BA:

1. Start Here mission checklist
2. Michael status and next action
3. First Invitation mission / Who Do You Know
4. Day 1 training
5. Questionnaire
6. Sponsor / Orientation
7. Today's Actions
8. My Invites / CRM

## 4. Step-by-step BA launch path

Recommended first-run path:

1. Accept welcome
   - BA lands on `/welcome`.
   - Keep the ceremonial welcome, but reduce the page to a strong first screen and a shorter "what happens next" block.
   - CTA: "Enter Launch Center" or "Schedule Michael".

2. Schedule Michael
   - BA schedules the 15-minute call.
   - On success, route to Launch Center, not just a waiting page.
   - Launch Center shows the call time and Day 1 available while waiting.

3. Start Day 1
   - Day 1 card should be visible while Michael is pending.
   - Completion should mark launch progress.

4. Start Who Do You Know
   - Before the blank invitation form, ask the BA to name people manually.
   - Suggested prompts:
     - family or close friends
     - people who talk about weight, energy, wellness, or business
     - people who trust the BA enough to watch a short video
   - This is recall support, not automated lead qualification.

5. Pick one name
   - The BA selects one person from the list.
   - The Launch Center routes them into `/invitations` with that person's known fields prefilled where available.

6. Draft the invitation
   - If plain flow: BA writes the message.
   - If ScriptMaker flow: message is drafted from the watched product video.
   - If Ivory flow: message is drafted from the BA-authored roster context.
   - The BA always reviews and edits before minting.

7. Mint first link
   - `/invitations` creates the personal link.
   - Success state should frame this as "First invitation ready", not only "Link ready".

8. Send from personal phone
   - BA copies message + link.
   - BA sends from their own phone.
   - BA clicks "I sent this".

9. Return to Launch Center
   - Progress updates.
   - My Invites shows the prospect.
   - Today's Actions begins taking over once real follow-up activity exists.

10. Complete questionnaire
   - Questionnaire becomes a checklist step after the BA is already in motion.
   - It should be chunked into short sections with progress and save/resume.

## 5. Components to create or refactor

Create:

- `LaunchCenter`
  - New top-level composition component used by `/cockpit`.
  - Owns first-run layout and switches to operational layout after launch completion.

- `LaunchChecklist`
  - Displays launch steps, state, progress, and next action.
  - Inputs should come from server truth where possible: welcome accepted, Michael status, questionnaire status, invitation counts, sent counts, Day 1 progress.

- `LaunchStepCard`
  - Reusable card for one mission step.
  - Supports states: complete, current, locked, available, optional.

- `MichaelLaunchCard`
  - Refactor status summary from `/michael/schedule` into a compact card.
  - CTA routes to schedule, interview, or Day 1 based on state.

- `FirstInvitationMission`
  - New guided first-invite module.
  - Shows before the generic My Invites list when `counts.sent === 0`.
  - Owns "Who Do You Know" entry and candidate selection.

- `WhoDoYouKnowList`
  - BA-authored manual list.
  - Should support quick add, category/tag, and "use this person" action.
  - Avoid automated prospecting and avoid AI scoring/qualification.

- `QuestionnaireWizard`
  - Refactor the current 19-question page into smaller steps.
  - Shows progress, current section, and next/previous controls.
  - Ideally supports save/resume if the backend supports draft persistence later.

- `FirstInviteSuccess`
  - Refactor or specialize the `/invitations` minted state for the first invite.
  - Emphasizes copy, send, mark sent, return to Launch Center.

Refactor:

- `TodaysActions`
  - Keep as the operating card for active pipelines.
  - Do not use it as the only guidance for a brand-new BA.
  - Empty state should include a CTA, not just the bias prompt.

- `EmptyInvites`
  - Replace direct "Mint your first link" with "Start Who Do You Know" for new BAs.
  - Route to the guided first-invite mission, then to `/invitations`.

- `CountsStrip`
  - Keep below the launch checklist for new BAs.
  - Counts matter after motion starts; they should not be the first thing a zero-invite BA sees.

- `WelcomePage`
  - Shorten or split into a ceremony plus a clear Launch Center handoff.
  - Preserve Kevin/Paul credibility and commitment tone, but stop carrying the full onboarding map in long-form copy.

- `QuestionnairePage`
  - Convert from one long all-required form to a guided multi-step interview.
  - Keep the same fields unless the business decision changes.

## 6. Files to modify

Primary files:

- `apps/team/src/routes/cockpit.tsx`
  - Main Launch Center composition.
  - Add Launch Checklist above Today's Actions.
  - Add First Invitation Mission for new BAs.
  - Reorder new-BA experience so mission guidance comes before metrics and CRM.

- `apps/team/src/components/cockpit/TodaysActions.tsx`
  - Keep urgency actions.
  - Add a stronger empty-state CTA or allow parent to provide one.
  - Avoid making this the only first-run guidance.

- `apps/team/src/routes/invitations.tsx`
  - Support first-invite framing in copy when routed from Launch Center.
  - Preserve existing `seed` and `source` seam.
  - Add clearer post-mint path: copy, send from phone, mark sent, return to Launch Center.

- `apps/team/src/routes/welcome.tsx`
  - Reduce long-page pressure.
  - Route into Launch Center after acceptance, or keep direct Michael scheduling but make the Launch Center the persistent next destination.
  - Move the seven-day arc into a reusable progress/checklist component.

- `apps/team/src/routes/onboarding/questionnaire.tsx`
  - Refactor into a wizard or sectioned mission.
  - Add progress display and save/resume affordance if backend support exists.
  - Keep the success route aligned with Launch Center.

- `apps/team/src/routes/michael-schedule.tsx`
  - Keep the focused scheduler.
  - Expose status summary logic to a compact Launch Center card.
  - After booking, route or return the BA to Launch Center with scheduled state visible.

- `apps/team/src/routes/michael-interview.tsx`
  - Keep as the live call surface.
  - Ensure complete/fallback states return to Launch Center with the next mission highlighted.

Likely new files:

- `apps/team/src/components/launch/LaunchCenter.tsx`
- `apps/team/src/components/launch/LaunchChecklist.tsx`
- `apps/team/src/components/launch/LaunchStepCard.tsx`
- `apps/team/src/components/launch/MichaelLaunchCard.tsx`
- `apps/team/src/components/launch/FirstInvitationMission.tsx`
- `apps/team/src/components/launch/WhoDoYouKnowList.tsx`
- `apps/team/src/components/launch/FirstInviteSuccess.tsx`
- `apps/team/src/routes/onboarding/QuestionnaireWizard.tsx`

Likely backend/API needs:

- Add or extend a launch status endpoint, for example `GET /api/cockpit/launch-status`.
- Return at minimum:
  - welcome accepted
  - Michael schedule/interview state
  - Day 1 progress
  - questionnaire submitted
  - invite count
  - sent invite count
  - first invite candidate count
- If Who Do You Know becomes persisted, write it through the required multi-store path and keep it BA-authored. Do not add automated prospecting or AI lead qualification.

## Recommended product direction

The Launch Center should answer one question at all times:

> What is the next move that gets this BA into motion?

For a brand-new BA, the answer is not CRM, metrics, or a blank invitation form. The answer is:

1. schedule/complete Michael,
2. start Day 1,
3. name people they know,
4. send the first personal invitation,
5. mark it sent,
6. then operate from the cockpit.

The existing code already has the invitation spine, Michael state handling, cockpit read side, and Today's Actions. The UX change is to organize those pieces into a mission path so the BA never has to infer the launch sequence from long pages.
