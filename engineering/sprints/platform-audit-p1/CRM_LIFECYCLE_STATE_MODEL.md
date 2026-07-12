# CRM Lifecycle State Model - P1-54

Source of truth: `packages/shared/src/crm-lifecycle.ts`

Purpose: provide one canonical CRM lifecycle model for BA-owned prospect
records, manual follow-up, engagement signals, and off-app outcomes. This
model is additive: it documents and aligns the existing token rail, PMV
projection, CRM record status, timeline events, VM/RVM lead states, disposition
tags, closed reasons, and follow-up reminder states.

## Rails Kept Separate

| Rail | Source | Why it stays separate |
| --- | --- | --- |
| Token state | `McsTokenState` | Prospect-controlled funnel progress through `/p/{token}`. |
| PMV lifecycle | `McsProspectLifecycleStage` | BA-facing projection for respectful follow-up timing. |
| CRM record status | `McsProspectCrmStatus` | Durable CRM row state for hub filtering and ownership-scoped reads. |
| Timeline event | `McsProspectTimelineEventKind` | Append-only evidence of what changed and when. |
| Follow-up state | `CRM_FOLLOW_UP_STATES` | Derived from active reminder rows and due/cleared timestamps. |
| Outcome state | `McsProspectCrmClosedReason` + disposition | Manual off-app outcomes and terminal closures. |
| VM/RVM lead status | `McsVmLeadLifecycleStatus` | Acquisition/import and delivery lifecycle feeding CRM. |

Canonical dispositions include `new_brand_ambassador`, `new_customer`,
`interested`, `not_interested`, `later`, `no_response`, `wrong_number`, and
`do_not_contact`. UI surfaces may still choose the smaller
`MCS_CRM_DISPOSITIONS` priority set for common BA actions.

## Canonical States

| State | Phase | Token states | PMV stages | CRM statuses | Timeline events | Follow-up | Terminal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `draft` | pre_engagement | `minted` | `draft` | `inactive_pre_engagement` | `crm_created`, `token_created` | `none` | no |
| `sent_unopened` | delivery | `minted` | `sent_unopened` | `inactive_pre_engagement` | `voicemail_sent`, `sms_sent`, `email_sent` | `none`, `scheduled`, `due` | no |
| `opened` | engagement | `clicked` | `clicked` | `active` | `link_clicked`, `activated`, `info_requested` | `none`, `scheduled`, `due` | no |
| `watching` | presentation | `video_started`, `video_quarter`, `video_half`, `video_three_quarter` | `video_started`, `video_25`, `video_50`, `video_75` | `watching` | `presentation_started`, `presentation_25`, `presentation_50`, `presentation_75` | `none`, `scheduled`, `due` | no |
| `watched` | presentation | `video_complete` | `watched` | `presentation_completed`, `holding_tank` | `presentation_completed`, `dashboard_entered`, `holding_tank` | `none`, `scheduled`, `due` | no |
| `callback_requested` | manual_follow_up | none | `callback_requested` | `needs_follow_up` | `callback_requested`, `info_requested` | `none`, `scheduled`, `due` | no |
| `follow_up_scheduled` | manual_follow_up | none | `draft`, `sent_unopened`, `clicked`, `video_started`, `video_25`, `video_50`, `video_75`, `watched` | `active`, `needs_follow_up`, `watching`, `presentation_completed`, `holding_tank` | `follow_up_set` | `scheduled` | no |
| `follow_up_due` | manual_follow_up | none | `draft`, `sent_unopened`, `clicked`, `video_started`, `video_25`, `video_50`, `video_75`, `watched` | `needs_follow_up`, `active`, `watching`, `presentation_completed`, `holding_tank` | `follow_up_set` | `due` | no |
| `webinar_reserved` | manual_follow_up | none | `watched`, `callback_requested` | `needs_follow_up`, `presentation_completed`, `holding_tank` | `info_requested` | `none`, `scheduled`, `due` | no |
| `customer` | outcome | none | `customer` | `closed` | `closed_new_customer` | `none`, `cleared` | yes |
| `enrolled` | outcome | `enrolled` | `enrolled` | `closed` | `closed_new_brand_ambassador` | `none`, `cleared` | yes |
| `closed_no_join` | terminal | none | none | `closed` | `closed_not_interested`, `closed_later` | `none`, `cleared` | yes |
| `expired` | terminal | `expired` | `expired` | `closed` | `expired` | `none`, `cleared` | yes |
| `archived` | terminal | none | `archived` | `closed` | `archived` | `none`, `cleared` | yes |

## Implementation Anchors

- Shared CRM lifecycle model: `packages/shared/src/crm-lifecycle.ts`
- Shared CRM/token/PMV types: `packages/shared/src/types.ts`
- PMV contract: `packages/shared/src/pmv-contract.ts`
- CRM write domain: `server/src/domain/crm.ts`
- Prospect CRM record domain: `server/src/domain/prospectCrm.ts`
- PMV projection lifecycle derivation: `server/src/domain/cockpit.ts`

## Notes For P1-55+

- Callback requests, webinar reservations, and follow-up reminders are signals,
  not token states.
- `sent_unopened` is a BA-side delivery fact (`sentAt` plus activity), not a
  token state.
- `watched` may expose holding-tank visibility, but it must never imply binary
  placement, spillover, income, or cycle math.
- Terminal outcomes remain manual/off-app except for expiry and archive
  maintenance.
