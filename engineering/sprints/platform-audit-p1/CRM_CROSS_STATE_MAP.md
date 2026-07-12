# CRM Cross-State Map - P1-55

Source of truth: `packages/shared/src/crm-lifecycle.ts`

Purpose: explicitly map invitation token, prospect account, CRM, callback,
webinar, VM/RVM delivery, VM/RVM lead, follow-up, timeline, and outcome rails
onto the canonical CRM lifecycle model from P1-54.

## Mapping Rules

- Token state remains the prospect-controlled funnel rail.
- `sentAt`, invitation activity, and VM/RVM provider delivery are delivery
  evidence, not engagement evidence.
- Callback requests, webinar reservations, and follow-up reminders are
  signal/overlay rails, not token lifecycle states.
- VM/RVM lead and delivery states never imply qualification, scoring, placement,
  income, cycle math, or readiness.
- Terminal outcomes are manual/off-app except expiry and archive maintenance.

## Rails

| Rail | Source collections | Source fields | Canonical lifecycle target |
| --- | --- | --- | --- |
| Invitation token | `tmag_prospect_invite_tokens`, `tmag_prospects` | `state`, `clickedAt`, `expiresAt`, `sentAt` | `draft`, `sent_unopened`, `opened`, `watching`, `watched`, `enrolled`, `expired` |
| Prospect account | `tmag_prospects`, `tmag_prospect_htank_placements` | `sentAt`, `positionNumber`, `placedAt`, `becameCustomer`, `deleted` | `draft`, `sent_unopened`, `watched`, `customer`, `archived` |
| CRM record | `tmag_prospect_crm_records` | `status`, `disposition`, `closedReason`, `followUpDueAt`, `closedAt` | all active and terminal canonical states |
| Callback | `tmag_prospect_callback_requests` | `intent`, `callbackRequestId`, `createdAt` | `callback_requested` |
| Webinar | `tmag_prospect_webinar_reservations`, `tmag_prospect_webinar_events` | `reservationId`, `eventId`, `status`, `scheduledFor` | `webinar_reserved` |
| VM/RVM delivery | `tmag_vm_delivery_events`, `tmag_vm_suppressions` | `status`, `leadId`, `reason` | `draft`, `sent_unopened`, `closed_no_join` |
| VM/RVM lead | `tmag_vm_bulk_leads` | `status`, `token`, `crmRecordId`, `updatedAt` | all acquisition, delivery, engagement, presentation, and terminal states |
| Follow-up | `tmag_prospect_crm_followups` | `dueAt`, `clearedAt` | `follow_up_scheduled`, `follow_up_due`, or base lifecycle |
| Timeline | `tmag_prospect_timeline_events` | `kind`, `occurredAt`, `payload` | append-only evidence for every active and terminal state |
| Outcome | `tmag_prospect_crm_records`, `tmag_prospects` | `disposition`, `closedReason`, `becameCustomer`, `state` | `customer`, `enrolled`, `closed_no_join`, `expired` |

## Coverage Expectations

The QA test `server/src/qa/__tests__/crmCrossStateMap.test.ts` proves:

- Every `McsTokenState` maps through the invitation-token rail.
- Every `McsProspectCrmStatus` maps through the CRM-record rail.
- Every `McsCallbackIntent` maps through the callback rail.
- Every `McsVmDeliveryStatus` maps through the VM/RVM delivery rail.
- Every `McsVmLeadLifecycleStatus` maps through the VM/RVM lead rail.
- Every `McsCrmDisposition` and `McsProspectCrmClosedReason` maps through the
  outcome rail.
- Every `McsProspectTimelineEventKind` maps through the timeline rail.
- Callback, webinar, and follow-up mappings keep their token-state lists empty
  in the canonical model.

## Implementation Anchors

- Shared model/map: `packages/shared/src/crm-lifecycle.ts`
- PMV projection lifecycle derivation: `server/src/domain/cockpit.ts`
- CRM write domain: `server/src/domain/crm.ts`
- Prospect CRM record domain: `server/src/domain/prospectCrm.ts`
- RVM token lifecycle bridge: `server/src/domain/rvmTokens.ts`
- VM/RVM provider queue and delivery events: `server/src/domain/vmProviderQueue.ts`
