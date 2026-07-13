# Event Center Product Boundary

Decision: **Event Center is a named, authenticated event discovery and coordination surface at `/events`.** It composes source-owned Team Magnificent events; it is not a new event authority and does not duplicate orientation, webinar, reservation, attendance, resource, or CRM records.

The executable boundary is `packages/shared/src/event-center-catalog.ts`.

The additive normalized response contract is `event_center.v1.1`, governed by `organization/ACR-0015-event-center-model-fields.md`. Its `events` projection carries explicit event type, visibility, capacity, registration, reminder, attendance, and follow-up fields while retaining the source-specific orientation and webinar arrays for compatibility.

## Audience and routes

- Brand Ambassadors and leaders use the live `.team` route `/events`.
- Kevin uses the live `/admin/events` route, represented as `/events` inside the admin application.
- Prospects never receive a public Event Center. They may reserve a specific webinar only through the existing valid `/p/:token` flow.
- P2-104 delivered the team/admin UI and the unified read APIs at `/api/events` and `/api/admin/events`. A source-health field keeps a temporary source failure distinct from an honestly empty schedule.

## Source ownership

New Member Orientation owns orientation sessions, capacity, hosts, BA reservations, and rosters. Prospect Webinar owns prospect event occurrences and token-derived reservations. Resource Center exposes only verified Kevin-approved materials carrying an explicit `context:event:*` tag; semantic inference cannot attach materials to an event. CRM owns follow-up work.

Event Center owns discovery, calendar composition, filtering by event type, and deep links to those source owners. The BA page delegates orientation seat changes to the existing orientation reservation API. The admin page links to the existing Group Orientation operation surface. Event Center cannot authoritatively rewrite source records.

## Factual lifecycle rules

A reservation proves only that a seat was reserved. It does not prove attendance, completion, engagement quality, or readiness. Elapsed time never converts a reservation into attendance. Event Center does not change prospect token lifecycle, sponsor identity, or CRM disposition. Sponsor identity remains token-derived and immutable.

Until their separately governed implementation items land, reminder status is `not_configured`, attendance is `not_recorded` with `inferred:false`, and follow-up is `not_connected` with `automated:false`. These values describe missing behavior honestly; they do not simulate it.

## Exclusions

Event Center is not a public event directory, training tracker, Resource Center approval surface, three-way-call scheduler, Broadcast composer, or automatic follow-up agent. It cannot infer attendance, contact prospects, score people, or create a second copy of orientation or webinar truth.
