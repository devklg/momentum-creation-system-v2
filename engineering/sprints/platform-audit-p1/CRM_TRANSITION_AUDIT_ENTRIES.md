# CRM Transition Audit Entries - P1-56

The canonical append-only writer is `server/src/domain/auditLog.ts`.
CRM timeline events remain the human-readable relationship history; audit
entries are the immutable operational evidence for state mutations.

## Audited transitions

| Mutation | Audit action | Before/after evidence |
| --- | --- | --- |
| CRM lifecycle status changes | `system.crm.status_changed` | prior and resulting CRM status plus timeline event context |
| New follow-up | `ba.crm.follow_up.scheduled` | `none` to `scheduled`, including due time |
| Follow-up reschedule | `ba.crm.follow_up.rescheduled` | prior derived state/due time to new scheduled due time |
| Follow-up clear | `ba.crm.follow_up.cleared` | prior derived state/due time to cleared timestamp |
| Initial disposition | `ba.crm.disposition.set` | null to selected disposition |
| Changed disposition | `ba.crm.disposition.changed` | prior to selected disposition |
| Cleared disposition | `ba.crm.disposition.cleared` | prior disposition to null |

## Invariants

- Audit append happens only after the underlying mutation succeeds.
- Validation failures and ownership failures produce no audit entry.
- Idempotent clears and unchanged disposition/status values produce no entry.
- A follow-up becoming due is time-derived, not a mutation; reads never append
  audit rows. P1-57 owns persisted stuck/due cleanup behavior.
- Passive PMV milestones that keep the CRM in its current status remain in the
  timeline without flooding the operational audit log.
- No new persistence schema is introduced. Entries use `mcs_audit_log`,
  `:TmagAuditEntry`, and the registered `mcs_audit_log` Chroma collection.

## Verification

`server/src/domain/__tests__/crmTransitionAudit.test.ts` covers scheduling,
rescheduling, clearing, disposition changes, CRM status changes, no-op
suppression, and mutation-failure ordering.
