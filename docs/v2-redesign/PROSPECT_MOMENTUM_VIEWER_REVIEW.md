# Prospect Momentum Viewer Review

Scope reviewed:

- `apps/team/src/routes/cockpit.tsx`
- `apps/team/src/components/cockpit/TodaysActions.tsx`
- `apps/team/src/components/cockpit/MichaelEventCard.tsx`
- `server/src/domain/cockpit.ts`
- `server/src/domain/crm.ts`
- `server/src/domain/tokens.ts`
- `server/src/routes/cockpit.ts`
- `server/src/routes/crm.ts`

This review is limited to BA Cockpit / Prospect Momentum Viewer. No code changes were made.

## 1. Current Cockpit Strengths

The cockpit already has a real invitation read side. `server/src/domain/cockpit.ts` scopes every prospect read by the authenticated BA's `baId`, returns the BA's own invites, groups activity by prospect, and computes a simple display status. That is the correct security boundary for a BA-facing PMV.

The UI has useful CRM mechanics inside each invite row:

- Saved message display
- Source label for `self`, `ivory`, and `scriptmaker`
- Copyable prospect link
- "I sent this" confirmation
- Activity timeline
- Disposition tags
- Follow-up reminders
- Private notes
- Re-invite
- Re-invite script
- Edit/remove prospect controls

`TodaysActions` is also directionally right. It gives the BA an urgency queue instead of only showing passive counts. The `/api/cockpit/todays-actions` route uses callbacks, due follow-ups, and expiring windows, which is closer to a PMV than a plain dashboard.

The CRM write side is sponsor-safe. `server/src/domain/crm.ts` runs ownership checks before notes, reminders, dispositions, re-invites, edits, and deletes. Notes and reminders are durable, BA-private, and tied to the prospect.

Compliance posture is mostly clean. The reviewed code avoids income, cycle, rank, placement promise, and automated prospecting language. The re-invite script is copy-only; the BA still sends through their own channel.

## 2. Current Weaknesses

The current cockpit still feels like a dashboard plus an inline CRM, not a true Prospect Momentum Viewer. The first screen emphasizes a welcome header, counts strip, track-record card, sponsor card, orientation, leadership, and then "My Invites." A PMV should make prospects and their next action the center of the first viewport.

The main list is not dense enough. A BA must expand a row to see the saved message, source, CRM, notes, reminder, script, and activity timeline. That is acceptable for details, but the collapsed row does not show enough momentum signal to decide who needs attention next.

The status model is too compressed. `computeStatus()` collapses `clicked`, `video_started`, `video_quarter`, `video_half`, and `video_three_quarter` into `opened`. For a PMV, "clicked but never started" and "watched 75%" are completely different follow-up situations.

The scoring model does not exist. There is no hot/warm/cold momentum temperature, and no deterministic score based on real prospect behavior. The older MichaelEventCard classification path has been retired; PMV should continue using behavior-state progression rather than predictive scoring.

Disposition is useful but not the same as momentum. `interested`, `later`, `not-interested`, `new-customer`, and `new-ba` are BA-entered CRM tags. They do not answer "who should I contact next because they are moving?"

Next best action is partial. `TodaysActions` produces a top queue, but each prospect row does not carry a computed `nextAction` with label, reason, priority, due time, and script. The BA has tools, but the system does not yet synthesize the next move per prospect.

Follow-up scripts are too narrow. The reviewed code has a re-invite script only. A PMV needs state-specific copy for callback, clicked/no-watch, partial-watch, watched/no-callback, follow-up due, expired, and later/reconnect cases.

Source labeling exists but is underpowered. `source` appears only in the expanded saved-message section, and only when `invite.message` exists. Source should be visible in the row because it changes what the BA needs to remember: handwritten, Ivory relationship memory, or ScriptMaker product anchor.

## 3. Missing Clicked / Video Progress Handling

The biggest PMV gap is that the system has token progress states but does not surface them as actionable prospect momentum.

`server/src/domain/tokens.ts` defines the lifecycle:

`minted -> clicked -> video_started -> video_quarter -> video_half -> video_three_quarter -> video_complete -> enrolled`

But the reviewed cockpit reads `prospects.state`, not `invite_tokens.state`. `transitionTokenState()` updates only the `invite_tokens` collection. The holding-tank path mirrors `video_complete` back onto the prospect record, but partial video milestones do not appear to be mirrored to `prospects.state`.

That means the cockpit can miss real progress until video completion. A prospect may have started the video or watched halfway, but the BA row can still look like `sent` or `opened` depending on what is stored on the prospect document.

The click state is also not clearly captured. The prospect resolver `GET /api/p/:token` does not appear to transition the token to `clicked` or stamp `clickedAt`. Reports reference `clickedAt`, and the token record includes `clickedAt`, but the reviewed path does not show a writer for that field.

The activity timeline is too sparse for PMV. `invitation_activity` supports `invitation_sent`, `video_completed`, and `callback_requested` in the cockpit types. There is no row-level activity for:

- Link clicked
- Video started
- Video 25%
- Video 50%
- Video 75%
- Video abandoned / stalled

Recommended correction: treat click and video progress as first-class prospect engagement signals. They should update a read projection consumed by the cockpit, and optionally write compact activity entries for the timeline. Partial milestones do not need BA SMS alerts, but they do need PMV visibility.

## 4. Recommended PMV Layout

The cockpit should become a prospect workbench, not a general dashboard.

Recommended first viewport:

1. Compact top bar
   - BA name
   - small counts: total, hot, warm, follow-up due, callbacks
   - primary action: Invite someone

2. Focus Queue
   - 5 to 10 highest-priority prospects
   - each row: temperature, name, signal, next action, due/last activity
   - one-click expand or script copy

3. Prospect Momentum Table
   - Temperature: Hot / Warm / Cold
   - Prospect: name, location, source
   - Stage: draft, sent, clicked, 25%, 50%, 75%, watched, callback, enrolled, expired
   - Progress: compact bar or milestone chips
   - Last signal: "clicked 2h ago", "watched 75% yesterday", "callback today"
   - Next best action: "Call now", "Send follow-up", "Wait", "Re-invite"
   - Follow-up due
   - Latest note preview
   - Actions: details, script, copy link

4. Row drawer
   - saved message
   - full activity timeline
   - CRM notes
   - disposition
   - follow-up scheduling
   - scripts
   - edit/remove controls

Move sponsor, orientation, leadership, and track-record into secondary areas or lower sections. They are valuable cockpit content, but they dilute the PMV job when they compete with prospect action.

## 5. Recommended Status Model

Separate lifecycle status from action status. The current `InviteDisplayStatus` is trying to do both.

Recommended prospect lifecycle:

- `draft`: link minted, BA has not confirmed sending
- `sent_unopened`: BA confirmed send, no click yet
- `clicked`: link opened, video not started
- `video_started`: video started, no quarter milestone
- `video_25`
- `video_50`
- `video_75`
- `watched`: video complete / placed
- `callback_requested`: raised hand after callback CTA
- `customer`: became customer
- `enrolled`: became BA / terminal
- `expired`: token expired
- `archived`: BA removed from active list

Recommended action overlay:

- `followup_due`
- `followup_scheduled`
- `stalled`
- `reinvite_available`
- `no_action`

Recommended temperature overlay:

- `hot`: explicit callback, ready-to-join intent, video complete, or high progress with recent activity
- `warm`: clicked, video started/partial, recent sent, follow-up due, or manually marked interested
- `cold`: draft not sent, sent with no click after threshold, expired, later, or not-interested

Important compliance boundary: hot/warm/cold must be deterministic "momentum temperature" from explicit engagement and BA-entered CRM facts. It must not become AI lead qualification, automated prospecting, or a judgment of prospect worth.

## 6. Recommended Next-Action Model

Add a server-computed `nextAction` projection per prospect. It should be deterministic, explainable, and BA-facing.

Recommended shape:

```ts
type ProspectNextAction = {
  kind:
    | 'send_invite'
    | 'call_now'
    | 'reply_to_callback'
    | 'follow_up_due'
    | 'send_soft_nudge'
    | 'ask_if_video_played'
    | 'reinvite'
    | 'schedule_followup'
    | 'wait'
    | 'none';
  label: string;
  reason: string;
  priority: 0 | 1 | 2 | 3 | 4 | 5;
  dueAt: string | null;
  scriptKind:
    | 'initial_send'
    | 'callback_reply'
    | 'clicked_no_watch'
    | 'partial_watch'
    | 'watched_no_callback'
    | 'reinvite'
    | 'later_reconnect'
    | null;
};
```

Recommended rules:

- Draft: `send_invite`, script from saved message/source.
- Sent but unopened after a threshold: `send_soft_nudge`.
- Clicked but no video start: `ask_if_video_played`.
- Partial video with no completion after a threshold: `send_soft_nudge` or `schedule_followup`.
- Video complete: `call_now` unless already handled.
- Callback requested: `reply_to_callback`, highest priority.
- Follow-up due: `follow_up_due`, high priority unless callback already supersedes it.
- Expired: `reinvite` if the BA has not marked later/not-interested.
- Later: `wait` until follow-up due.
- Not interested: `none`, unless the BA manually sets a later follow-up.
- Enrolled/new customer: `none` or post-conversion support action, not prospecting.

Scripts should be generated from a fixed compliance-safe template set or a constrained ScriptMaker path. They should not auto-send. They should include the BA's saved message/source context where relevant.

## 7. Files To Modify

Primary files from this review scope:

- `server/src/domain/cockpit.ts`
  - Return a PMV projection, not just `InviteSummary`.
  - Include token-derived progress, timestamps, temperature, last signal, source, latest note preview, follow-up due, and next action.
  - Stop collapsing partial progress into only `opened`.

- `server/src/domain/crm.ts`
  - Keep notes/follow-ups/dispositions, but feed them into temperature and next-action derivation.
  - Add state-specific script generation beyond re-invite.
  - Resolve drift between `/api/crm/today` and `/api/cockpit/todays-actions`.

- `server/src/domain/tokens.ts`
  - Add or support a click transition path that stamps `clickedAt`.
  - Consider returning transition timestamps for PMV projections.
  - Ensure token progress can be consumed without relying on prospect-state mirroring.

- `server/src/routes/cockpit.ts`
  - Add or replace with `/api/cockpit/prospect-momentum`.
  - Return Focus Queue + full PMV table data in one payload to avoid many row-level fetches.

- `server/src/routes/crm.ts`
  - Add endpoints for state-specific scripts if they do not live under cockpit.
  - Keep all writes BA-scoped from session.

- `apps/team/src/routes/cockpit.tsx`
  - Rebuild the first viewport around Focus Queue and Prospect Momentum Table.
  - Show source, temperature, progress, last signal, and next action in collapsed rows.
  - Move CRM controls into a drawer/detail panel.

- `apps/team/src/components/cockpit/TodaysActions.tsx`
  - Either fold into Focus Queue or update it to consume the same `nextAction` model.
  - Avoid maintaining a separate action derivation contract from the PMV table.

- `apps/team/src/components/cockpit/MichaelEventCard.tsx`
  - No PMV-specific change recommended.
  - Keep BA interview scoring separate from prospect momentum temperature.

Required supporting files outside the requested review list:

- `packages/shared/src/types.ts`
  - Add shared PMV wire types for lifecycle, temperature, next action, progress timestamps, and scripts.

- `server/src/routes/p.ts`
  - Stamp link click on token resolution or add a dedicated open/click endpoint.
  - Ensure video progress events are available to PMV, not only the prospect page response.

- `server/src/domain/invitations.ts`
  - Extend `invitation_activity` kinds or add a separate `prospect_engagement_events` collection for click and partial video milestones.

- `server/src/domain/todaysActions.ts`
  - If retained, derive from the same PMV projection so Today’s Actions and the table cannot disagree.
