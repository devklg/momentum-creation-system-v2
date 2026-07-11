# PMV Contract - P1-52

Source of truth: `packages/shared/src/pmv-contract.ts`

Purpose: Prospect Momentum Viewer is awareness without surveillance. PMV helps
a BA follow up with respectful timing and never scores, ranks, qualifies, or
pressures a person.

## Route

- `GET /api/cockpit/pmv`

## Concepts

| Concept | Allowed language | Forbidden language | Fields | Events |
| --- | --- | --- | --- | --- |
| People | prospects invited; people you are following up with; relationship context; invited by you | leads; hot prospects; qualified prospects; ranked people; low-value contacts | `prospectId`, `firstName`, `lastInitial`, `city`, `stateOrRegion`, `source`, `relationshipReason`, `crm.disposition` | `invitation_created`, `crm_note_added`, `crm_disposition_set` |
| Momentum | opened the link; started the video; watched the video; asked for a callback; follow-up due; consideration window | ready to buy; guaranteed to enroll; qualified by engagement; high-intent score; pressure them now | `lifecycle`, `tokenState`, `videoProgressPct`, `clickedAt`, `sentAt`, `lastSignal`, `nextAction`, `latestCallbackIntent`, `crm.followUpDueAt`, `crm.followUpIsDue` | `invitation_sent`, `token_clicked`, `video_started`, `video_quarter`, `video_half`, `video_three_quarter`, `video_complete`, `callback_requested`, `follow_up_due` |
| Volume | invitations sent; presentations watched; callbacks requested; webinar reservations; team activity | commissionable volume; CV; cycle volume; binary volume; pay-leg volume | `source`, `createdAt`, `expiresAt`, `positionNumber`, `placedAt`, `lifecycle` | `invitation_created`, `invitation_sent`, `video_complete`, `callback_requested`, `webinar_reserved` |
| Checks | internal PMV+C planning label; never prospect-facing; no earnings projection; no compensation claim | checks earned; paycheck forecast; income projection; commission estimate; cycle payout | none | none |
| Next Action | manual next step; call now; reply to callback; send soft nudge; wait; consider re-invite | automatic send; AI will follow up; close them; pressure play; conversion score | `nextAction.kind`, `nextAction.label`, `nextAction.reason`, `nextAction.priority`, `nextAction.dueAt`, `nextAction.scriptKind` | `invitation_sent`, `token_clicked`, `video_complete`, `callback_requested`, `follow_up_due`, `expired` |

## Canonical Lifecycle Stages

`draft`, `sent_unopened`, `clicked`, `video_started`, `video_25`,
`video_50`, `video_75`, `watched`, `callback_requested`, `customer`,
`enrolled`, `expired`, `archived`.

## Canonical Next Actions

`send_invite`, `call_now`, `reply_to_callback`, `follow_up_due`,
`send_soft_nudge`, `ask_if_video_played`, `reinvite`,
`schedule_followup`, `wait`, `none`.

## Forbidden Categories

- Income or checks claims
- Compensation plan or cycle math
- Placement or spillover promises
- Scoring or qualification
- Surveillance or pressure
- Current team headcount or programmatic THREE handoff

## Current Implementation Anchors

- Shared PMV row/types: `packages/shared/src/types.ts`
- Shared contract: `packages/shared/src/pmv-contract.ts`
- PMV projection: `server/src/domain/cockpit.ts`
- PMV route: `server/src/routes/cockpit.ts`
- BA PMV UI: `apps/team/src/routes/cockpit.tsx`
