# Event Center Product Boundary

Decision: **Event Center is a named, authenticated event discovery and coordination surface at `/events`.** It composes source-owned Team Magnificent events; it is not a new event authority and does not duplicate orientation, webinar, reservation, attendance, resource, or CRM records.

The executable boundary is `packages/shared/src/event-center-catalog.ts`.

## Audience and routes

- Brand Ambassadors and leaders use the future `.team` route `/events`.
- Kevin uses the future `/admin/events` route, represented as `/events` inside the admin application.
- Prospects never receive a public Event Center. They may reserve a specific webinar only through the existing valid `/p/:token` flow.
- P2-104 owns the team/admin UI and unified read API. P2-103 does not scaffold those surfaces.

## Source ownership

New Member Orientation owns orientation sessions, capacity, hosts, BA reservations, and rosters. Prospect Webinar owns prospect event occurrences and token-derived reservations. Resource Center exposes only verified Kevin-approved materials carrying an explicit `context:event:*` tag; semantic inference cannot attach materials to an event. CRM owns follow-up work.

Event Center owns discovery, calendar composition, filtering by event type, and deep links to those source owners. It cannot authoritatively rewrite their records.

## Factual lifecycle rules

A reservation proves only that a seat was reserved. It does not prove attendance, completion, engagement quality, or readiness. Elapsed time never converts a reservation into attendance. Event Center does not change prospect token lifecycle, sponsor identity, or CRM disposition. Sponsor identity remains token-derived and immutable.

## Exclusions

Event Center is not a public event directory, training tracker, Resource Center approval surface, three-way-call scheduler, Broadcast composer, or automatic follow-up agent. It cannot infer attendance, contact prospects, score people, or create a second copy of orientation or webinar truth.
