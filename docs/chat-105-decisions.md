# Chat #105 — spec amendments and locked decisions

Date: 2026-05-19
Context: Holding-tank domain build + `POST /api/p/:token/video-event` route.

## Locked decisions

### 1. Position counter: Mongo `$inc`, single source of truth (option A)

- `pool_counters.tm_team_pool.current` is the authoritative monotonic
  counter. Mongo `$inc` returns the new value atomically; no race
  between concurrent placements.
- Neo4j stores the relationship `(:Prospect)-[:IN_HOLDING_TANK {position}]->(:Pool)`
  but does NOT mint position numbers. Cypher reads, not writes.
- ChromaDB `mcs_pool_events` records each placement as a searchable
  event document; never authoritative for counts.

### 2. Vacant slots are preserved

If any triple-stack write fails after the counter has been incremented,
the minted position becomes a vacant slot. We do NOT attempt to reclaim
it. This matches the monotonicity contract in locked-spec Part 3.2:
position numbers never reshuffle.

### 3. Token lifecycle is the pure funnel rail

`TokenState` enumerates only the funnel progression:
`minted → clicked → video_started → video_quarter → video_half →
video_three_quarter → video_complete → enrolled → expired`.

Forward-only transitions are enforced by `transitionTokenState` so a
stale earlier milestone arriving after a later one is a no-op (the
YouTube IFrame can re-fire prior milestones; we do not regress).

### 4. Callback requests and webinar reservations are independent intent records (Chat #105 spec amendment)

**They are NOT token lifecycle states.** A single prospect can:

- Request a callback AND reserve a webinar seat (both records exist).
- Request multiple callbacks over time (each is its own record).
- Reserve a webinar seat for one Tuesday, then reserve a different seat
  for a later Tuesday (each is its own record).

Each lives in its own Mongo collection, keyed by `(prospectId, createdAt)`:

- `callback_requests` — fields: prospectId, sponsorBaId, intent radio
  (`interested_understand_more` | `ready_to_join` | `specific_questions`),
  phone, bestTimeToCall, createdAt, resolvedAt, resolvedNote.
- `webinar_reservations` — fields: prospectId, sponsorBaId, eventDateTime,
  attendeeName, attendeeEmail, createdAt, attendedAt, attendanceNote.

Both domains will be built in Chat #109 once the email provider decision
lands; Telnyx SMS is already wired (Chat #102).

### 5. BA notification urgency: callback is high-urgency, webinar is in-app only (Chat #105 spec amendment)

The two intents demand different notification surfaces, reflecting that
one requires an action and the other does not:

| Intent | Cockpit notification | Telnyx SMS to BA | Rationale |
| --- | --- | --- | --- |
| Callback request | yes | **yes** | Prospect explicitly said "call me." BA must act in hours, not whenever they next open the cockpit. |
| Webinar reservation | yes | no | Prospect is attending a live event hosted by Kevin and Paul. BA needs awareness for follow-up, not interruption. |

Both events appear on the BA's cockpit activity timeline (TEAM Design H.6,
reverse-chronological). SMS is reserved for the explicit raised-hand
case. This matches the broader compliance posture: out-of-band signals
are expensive (carrier costs, BA attention) and should be used only when
the prospect has explicitly invited synchronous follow-up.

The implementation in Chat #109 will:

- Fire `notifications/cockpit.send` for both events.
- Fire `notifications/sms.send` (Telnyx) only on callback request.
- Record both events in the prospect's activity timeline regardless.

## Idempotency contracts (Chat #105 lock)

- `placeProspect(prospectId)` is idempotent. The second call returns the
  existing placement with `alreadyPlaced=true`; no new position is minted.
- `transitionTokenState(token, next)` is idempotent and forward-only.
  Replaying the same state is a no-op; replaying an earlier state is a
  no-op.
- `POST /api/p/:token/video-event` is the public surface for both. Safe
  to retry on the client; safe to re-deliver via YouTube IFrame replays.

## What this chunk did NOT build (deferred to the locked 7-session sequence)

- SSE / live broadcast for the dashboard ticker → Chat #107.
- The actual `tm-video-presentation` page that fires these events → Chat #106.
- The `tm-prospect-dashboard` six-section renderer that shows the position → Chat #107.
- `POST /api/p/:token/callback-request` → Chat #109.
- `POST /api/p/:token/webinar-reservation` → Chat #109.
- BA cockpit notification surfaces + Telnyx SMS hookup for callback → Chat #109.
