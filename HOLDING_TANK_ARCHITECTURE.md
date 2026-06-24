# HOLDING_TANK_ARCHITECTURE.md

# Momentum Creation System V2
## Holding Tank / Position & Momentum Center Architecture

Version: 1.0  
Reconciled: 2026-06-24

---

## Purpose

The Holding Tank is the core prospect momentum subsystem behind the .COM
experience. It is not a widget, gimmick, fake urgency device, or compensation
promise.

It exists to turn a completed presentation into a respectful observation space:

```text
Invitation
  -> Presentation
  -> Position assignment
  -> Position & Momentum Center
  -> Webinar / conversation
  -> Decision
```

The prospect should understand what happened, why they have a position, what is
happening now, and what the next educational step is.

---

## Philosophy

The system demonstrates real activity without manufacturing urgency.

Allowed:
- Real position assignment
- Presentation completion
- Webinar reservation
- Callback request
- Team activity count
- Recent anonymized activity

Not allowed:
- Fake placements
- Fake scarcity
- Income claims
- Rank claims
- CV or cycle math
- Guaranteed placement benefit
- Pressure language

The posture is education, timing, and conversation.

---

## Current Implementation

The current repo already implements the core Holding Tank mechanics:

- MongoDB `pool_counters` stores the monotonic team-wide counter.
- MongoDB `pool_placements` stores the live placement record.
- Neo4j writes `(:Prospect)-[:IN_HOLDING_TANK]->(:Pool)`.
- ChromaDB `mcs_pool_events` stores a searchable placement event.
- Placement happens only at video completion.
- Placement is idempotent by `prospectId`.
- Positions never reshuffle after flush.
- SSE emits live placement updates through `poolEvents.ts`.
- Webinar reservation and callback request feed the same prospect journey.
- Admin queue/live-ops/reporting read from the same placement truth.

Primary code:
- `server/src/domain/holdingTank.ts`
- `server/src/services/poolEvents.ts`
- `server/src/routes/p.ts`
- `apps/com/src/routes/tm-prospect-dashboard/`

---

## Position & Momentum Center

The prospect-facing dashboard should be understood as the Position & Momentum
Center, not just a Holding Tank dashboard.

It answers:
- What happened?
- Why do I have a position?
- Why does it matter?
- What is happening now?
- What should I do next?

Language should center:
- Position
- Momentum
- Activity
- Team growth
- Live explanation
- Conversation
- Timing
- Education

---

## Momentum Ticker

Current code emits live placement events. The target Momentum Demonstration
System can expand the visible ticker to include other real, privacy-safe events:

```text
Position #143 assigned
Susan M. completed the presentation
Michael T. reserved a webinar seat
Amanda R. requested a callback
```

This is visible activity, not artificial urgency. Every ticker item must come
from a real event.

---

## Webinar Role

The webinar is the education bridge:

```text
Presentation
  -> Holding Tank
  -> Webinar
  -> Conversation
  -> Decision
```

It is not another pressure presentation. It gives the prospect a live place to
understand the system, meet the team, and ask questions.

---

## PMV Integration

The PMV should read Holding Tank state as relationship context:

```text
Invited
Opened
Started
Engaged
Completed
Dashboard exploring
Conversation ready
Webinar ready
Holding Tank
Enrolled
```

It should not reduce people to hot / warm / cold labels. PMV awareness exists to
help the BA follow up respectfully.

---

## Governance

The Holding Tank affects position assignment, PMV, webinars, the prospect
journey, graph relationships, live operations, and agent learning. Treat it as a
core system.

History remains auditable. Exits do not delete truth. Flushes vacate slots but
preserve position numbers.

The system succeeds when prospects see real momentum and have a clear next
educational step without feeling pressured.
