# ACR-0015 — Event Center Normalized Model Fields

## Momentum Creation System V2

Status: Approved

Ratified: Kevin Gardner, 2026-07-13 — authorized by Kevin's instruction to continue the implementation-priority audit after P2-104, with `PLATFORM_AUDIT_PRIORITY_TASKLIST.md` item 105 naming the exact field scope.

Canonical Authority: `packages/shared/src/event-center.ts` / `docs/event-center-product-boundary.md`

Target Version: v1.2

Decision Owner: Kevin Gardner

Proposer: Codex, implementing audit item P2-105

Change type: additive shared contract and read projection; no source-record migration and no new persistence.

Risk: Low. The fields are backward-compatible and describe current source truth. They do not activate reminders, infer attendance, or automate CRM follow-up.

---

## 1. Decision

Add a normalized `events` projection to the Event Center response. Every projected event carries:

- `eventType` — `new_member_orientation` or `prospect_webinar`;
- `visibility` — explicit team, admin, and prospect access rules;
- `capacity` — limited/unlimited mode with factual limit, reserved, and remaining values;
- `registration` — source owner, registration mode, and current registration state;
- `reminders` — source ownership, configured state, and channels;
- `attendance` — explicit recorded state, recorded timestamp, and `inferred:false`;
- `followUp` — CRM ownership, connection state, and `automated:false`.

The Event Center response schema advances additively from `event_center.v1` to `event_center.v1.1`.

## 2. Ownership and boundaries

- Orientation remains authoritative for orientation sessions, capacity, BA reservations, and rosters.
- Prospect Webinar remains authoritative for webinar occurrences and token-derived prospect reservations.
- Event Center is a read projection only; it does not create duplicate source records.
- Reminder fields report the current truth (`not_configured`) until P2-109 establishes delivery governance.
- Attendance fields report `not_recorded`; elapsed time and reservation status never infer attendance.
- Follow-up fields report `not_connected`; P2-106 owns any future attendance-to-CRM connection.
- CRM follow-up remains human-owned. No automated message, task, disposition, or contact is created.
- Prospect webinar access remains invitation-token-only. Sponsor identity remains token-derived.

## 3. Schema review

- Business review: passes the audit's Event Center visibility and operations need.
- Architecture review: reuses the single existing Event Center concept and source-owned records.
- AI impact: none; no agent consumes or writes the fields and no classification is introduced.
- Reporting impact: fields distinguish unknown/not-configured from zero/false and prevent false attendance reporting.
- Integration impact: none; no external provider or THREE integration changes.
- Naming: camelCase follows the current app-runtime schema convention and existing shared contract.

## 4. Compatibility, migration, and rollback

- Current version: `event_center.v1`.
- Target version: `event_center.v1.1`.
- Compatibility: additive response field; existing orientation and webinar arrays remain intact.
- Migration: none. Source Mongo, Neo4j, and Chroma records are unchanged.
- Rollback: remove the additive `events` projection and restore the schema-version literal to `event_center.v1`. No data rollback is required.

## 5. Verification gates

- Shared and server typecheck.
- Projection tests for every required model field on orientation and webinar events.
- Tests proving reservations do not become attendance and follow-up remains unconnected/non-automated.
- BA/admin rendered tests showing the normalized operational metadata without adding prospect access.
- Repository typecheck, build, server tests, and action gates.

## 6. Approval

Approved by Kevin Gardner on 2026-07-13 through his explicit instruction to continue the implementation-priority audit. Scope is limited to audit item P2-105 and the conditions above.
