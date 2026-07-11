# PMV Analytics Event Taxonomy - P1-53

Source of truth: `packages/shared/src/pmv-analytics-taxonomy.ts`

Purpose: PMV analytics measure invitation, viewing, callback, webinar, CRM, and
outcome movement without earnings, cycle math, or organization-position claims.

## Forbidden Analytics Language

PMV analytics must not create metrics, labels, or descriptions about:

- income, earnings, commissions, paycheck forecasts, or checks earned;
- CV, cycles, binary math, ranks, bonuses, or compensation math;
- placement, spillover, leg position, guaranteed spots, or organization-position
  promises.

## Events And Allowed Metrics

| Event | Concept | Trigger | Allowed metrics |
| --- | --- | --- | --- |
| `invitation_created` | People | A BA mints an invitation token for a personally known prospect. | People invited; Invitation source mix |
| `invitation_sent` | Momentum | The BA confirms they manually sent the invite link from their own phone. | Manual sends; Time to manual send |
| `token_clicked` | Momentum | A prospect opens the invite link. | Link opens; Created-to-open rate |
| `video_started` | Momentum | A prospect starts the presentation video. | Video starts |
| `video_quarter` | Momentum | A prospect reaches the first video milestone. | Video 25 percent |
| `video_half` | Momentum | A prospect reaches the halfway video milestone. | Video 50 percent |
| `video_three_quarter` | Momentum | A prospect reaches the third video milestone. | Video 75 percent |
| `video_complete` | Volume | A prospect completes the presentation video and enters the shared pool display. | Presentations completed; Open-to-complete rate |
| `callback_requested` | Next Action | A prospect asks for a BA follow-up conversation. | Callback requests; Complete-to-callback rate |
| `webinar_reserved` | Momentum | A prospect reserves a webinar seat from the prospect surface. | Webinar reservations |
| `follow_up_due` | Next Action | A BA-created CRM follow-up reminder reaches its due time. | Follow-ups due; Follow-up age |
| `crm_note_added` | People | A BA adds a CRM note for a prospect. | CRM notes |
| `crm_disposition_set` | People | A BA updates the prospect CRM disposition. | Disposition mix |
| `customer_marked` | People | A prospect is marked as a customer outcome. | Customer outcomes |
| `enrolled_marked` | People | A prospect is marked as enrolled after off-app human handoff. | Enrollment outcomes |
| `expired` | Momentum | A prospect consideration window expires. | Expired windows |
| `archived` | People | A prospect is archived or soft-deleted. | Archived prospects |

## Implementation Anchors

- PMV contract: `packages/shared/src/pmv-contract.ts`
- PMV analytics taxonomy: `packages/shared/src/pmv-analytics-taxonomy.ts`
- PMV projection: `server/src/domain/cockpit.ts`
- Prospect invite/token events: `server/src/domain/invitations.ts`,
  `server/src/routes/p.ts`, `server/src/domain/tokens.ts`
- CRM events: `server/src/domain/crm.ts`, `server/src/domain/prospectCrm.ts`
