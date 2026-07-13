# Event Center Product Boundary

Decision: **Event Center is a named, authenticated event discovery and coordination surface at `/events`.** It composes source-owned Team Magnificent events; it is not a new event authority and does not duplicate orientation, webinar, reservation, attendance, resource, or CRM records.

The executable boundary is `packages/shared/src/event-center-catalog.ts`.

The additive normalized response contract is `event_center.v1.2`, governed by `organization/ACR-0015-event-center-model-fields.md` and `organization/ACR-0016-event-attendance-crm-follow-up.md`. Its `events` projection carries explicit event type, visibility, capacity, registration, reminder, attendance, and follow-up fields while retaining the source-specific orientation and webinar arrays for compatibility.

## Audience and routes

- Brand Ambassadors and leaders use the live `.team` route `/events`.
- Kevin uses the live `/admin/events` route, represented as `/events` inside the admin application.
- Prospects never receive a public Event Center. They may reserve a specific webinar only through the existing valid `/p/:token` flow.
- P2-104 delivered the team/admin UI and the unified read APIs at `/api/events` and `/api/admin/events`. A source-health field keeps a temporary source failure distinct from an honestly empty schedule.

## Source ownership

New Member Orientation owns orientation sessions, capacity, hosts, BA reservations, and rosters. Prospect Webinar owns prospect event occurrences and token-derived reservations. Resource Center exposes only verified Kevin-approved materials carrying an explicit `context:event:*` tag; semantic inference cannot attach materials to an event. CRM owns follow-up work.

Event Center owns discovery, calendar composition, filtering by event type, deep links to those source owners, and Kevin's explicit webinar-attendance capture. The BA page delegates orientation seat changes to the existing orientation reservation API. The admin page links to the existing Group Orientation operation surface. Event Center cannot authoritatively rewrite event or reservation source records.

## Factual lifecycle rules

A reservation proves only that a seat was reserved. It does not prove attendance, completion, engagement quality, or readiness. Elapsed time never converts a reservation into attendance. Event Center does not change prospect token lifecycle, sponsor identity, or CRM disposition. Sponsor identity remains token-derived and immutable.

Reminder status remains `not_configured` until P2-109. Webinar attendance stays `not_recorded` with `inferred:false` until Kevin explicitly records `attended`, `missed`, or `rescheduled` for a real reservation. That append-only attendance fact makes a human CRM reminder available to the sponsoring BA for 24 hours later. An existing active reminder is preserved. No message, call, disposition, or contact is automated. Event-level attendance is an aggregate over the latest explicit record for each reservation, never a conclusion drawn from elapsed time.

Orientation attendance is not forced into the prospect CRM. It remains separately owned BA training evidence and is outside P2-106.

## Exclusions

Event Center is not a public event directory, training tracker, Resource Center approval surface, three-way-call scheduler, Broadcast composer, or automatic follow-up agent. It cannot infer attendance, contact prospects, score people, overwrite a BA's active reminder, or create a second copy of orientation or webinar truth.
