# ACR-0016 — Explicit Webinar Attendance to Human CRM Follow-up

## Momentum Creation System V2

Status: Approved

Ratified: Kevin Gardner, 2026-07-13 — authorized by Kevin's instruction to continue the implementation-priority audit, with `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` item 106 naming the exact connection.

Canonical Authority: `packages/shared/src/event-center.ts` / `server/src/domain/eventAttendance.ts` / `server/src/domain/crm.ts`

Target Version: v1.2

Decision Owner: Kevin Gardner

Proposer: Codex, implementing audit item P2-106

Change type: additive event-attendance persistence, admin mutation contract, and human CRM follow-up connection.

Risk: Medium. The change records a human-confirmed fact and creates a human-owned reminder. It does not infer participation, contact a prospect, change disposition, or use AI.

---

## 1. Decision

Kevin's authenticated admin Event Center may explicitly record `attended`, `missed`, or `rescheduled` for an existing prospect webinar reservation. The reservation supplies the event, prospect, and immutable sponsor identities; none is accepted from the request body.

Each new or corrected attendance state is an append-only `tmag_event_attendance` record projected to Neo4j and Chroma through the operational tier. The record carries the connected CRM due date. The Event Center response advances additively from `event_center.v1.1` to `event_center.v1.2` and reports aggregate counts over the latest explicit attendance record per reservation.

After attendance lands, the system ensures a human CRM reminder exists for the sponsoring BA:

- if an active reminder already exists, it is preserved unchanged;
- otherwise a reminder is scheduled for 24 hours after attendance was recorded;
- the reminder appears through the existing BA CRM/Cockpit machinery;
- no SMS, email, call, message, disposition, or prospect contact is sent.

The CRM reminder is ensured before the attendance fact commits. If attendance persistence fails after the reminder lands, retrying finds and preserves that reminder, then writes the missing attendance fact. Retrying after the attendance fact exists is idempotent and does not recreate a reminder that the BA later cleared.

## 2. Ownership and boundaries

- Prospect Webinar remains authoritative for event occurrences and token-derived reservations.
- Kevin's explicit admin action is authoritative for the attendance record.
- Reservation status and elapsed time never infer attendance.
- CRM owns follow-up reminders and the sponsoring BA owns the human action.
- Sponsor identity is read from the reservation and remains immutable.
- Event Center presents attendance and connection state; it does not become a CRM or messaging authority.
- Orientation attendance is BA training evidence and is not forced into the prospect CRM by this item.
- P2-107 remains responsible for a unified cross-source follow-up queue.
- P2-109 remains responsible for reminder-delivery governance.

## 3. Schema and impact review

- Business review: closes the audit's missing event-attendance-to-CRM loop without replacing the BA relationship.
- Architecture review: adds one attendance fact collection and reuses existing webinar reservations and CRM follow-ups.
- AI impact: none. No model, prompt, agent, scoring, or classification participates.
- Compliance impact: no automated prospect contact and no prospect-facing change.
- Reporting impact: attendance counts are explicit facts; reservations remain separate counts.
- Persistence: operational tier with Mongo readback and durable Neo4j/Chroma projection.
- Audit: attendance and admin-created CRM reminders carry the authenticated admin actor.

## 4. Compatibility, migration, and rollback

- Current version: `event_center.v1.1`.
- Target version: `event_center.v1.2`.
- Compatibility: additive response fields and one additive admin mutation route.
- Migration: none. Existing reservations remain `not_recorded` until Kevin records attendance.
- Rollback: disable the attendance mutation, stop projecting the attendance collection, and restore the v1.1 response projection. Existing append-only attendance evidence is retained for audit and is not deleted.

## 5. Verification gates

- Domain tests prove missing reservations fail closed, explicit attendance persists, existing reminders are preserved, new reminders are deterministic, retries are idempotent, and no contact is automated.
- Projection tests prove reservations do not become attendance and explicit records produce factual counts.
- Admin UI tests prove the operator action and human-only follow-up explanation.
- Shared, server, admin, and team typecheck.
- Repository build, server tests, and GitHub action gates.

## 6. Approval

Approved by Kevin Gardner on 2026-07-13 through his explicit instruction to continue the implementation-priority audit. Scope is limited to P2-106 and the boundaries above.
