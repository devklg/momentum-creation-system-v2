# S1.4 Timestamp Decision

Date: 2026-06-28

Agent: Runtime Event Timestamp Decision Agent

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

Status: DECISION REPORT ONLY

## Decision

Runtime event implementation must use these canonical event envelope timestamp fields:

```ts
occurredAt: string;
recordedAt: string;
```

`createdAt` must not be used in the `agent_event.v1` event envelope.

`createdAt` remains acceptable for non-event database documents, such as replay jobs, projections, test artifacts, ordinary records, or lifecycle records whose primary meaning is document creation time rather than event fact time.

## Field Meanings

### `occurredAt`

`occurredAt` means when the runtime fact happened.

Examples:

- when the BA submitted a browser text turn;
- when Browser Voice finalized a transcript;
- when the Context Manager created a packet;
- when Agent Runtime produced a response;
- when a guided action was completed.

`occurredAt` is the event-time axis.

### `recordedAt`

`recordedAt` means when Momentum persisted the event record.

It may be later than `occurredAt` because of batching, retries, offline recovery, worker delay, service latency, or idempotent replay.

`recordedAt` is the storage/audit axis.

### `createdAt`

`createdAt` means when a database document or operational record was created.

It is useful for non-event records, including:

- replay jobs;
- subscriber offset records;
- outbox documents;
- metrics projection documents;
- ordinary runtime support documents;
- test artifacts.

`createdAt` is not precise enough for event sourcing because it blurs the difference between "the fact happened" and "the system stored the fact."

## Alignment With Ratified Event Model

The ratified `runtime/AGENT_EVENT_MODEL.md` envelope includes:

```ts
occurredAt: string;
recordedAt: string;
```

It also defines:

- `occurredAt` as when the runtime fact happened;
- `recordedAt` as when the event was persisted;
- required indexes using `occurredAt`;
- storage requirements that preserve event order by `occurredAt` and recording order by `recordedAt`;
- required invariants that every event has both fields.

Therefore S1.4 implementation must align to `occurredAt` and `recordedAt`.

## Event Sourcing Alignment

Event sourcing needs two separate clocks:

- event time: when the domain/runtime fact happened;
- record time: when the system accepted the event into durable storage.

`occurredAt` supports reconstruction of the runtime timeline.

`recordedAt` supports operational audit, ingestion lag analysis, retry behavior, and storage ordering.

Using only `createdAt` would erase that distinction and make delayed recording, replay, or backfilled events ambiguous.

## Replay Alignment

Replay must reconstruct what happened without repeating unsafe side effects.

Replay should order domain timelines primarily by:

```text
occurredAt, eventId
```

Replay and audit may also inspect:

```text
recordedAt
```

to determine when Momentum stored the event and whether the event was delayed, backfilled, recovered, or re-emitted idempotently.

Replay jobs themselves may use `createdAt` because a replay job is an operational document, not a runtime fact event.

## Audit Alignment

Audit needs both answers:

1. When did the thing happen?
2. When did Momentum record that it happened?

`occurredAt` answers the first.

`recordedAt` answers the second.

The gap between them is meaningful audit evidence for latency, retries, outages, delayed workers, and recovery flows.

## Outbox Alignment

Runtime events are immutable facts.

Outbox items are operational delivery records derived from those facts.

The event record should use:

```ts
occurredAt
recordedAt
```

Outbox documents may use:

```ts
createdAt
updatedAt
nextAttemptAt
completedAt
```

This keeps event time separate from delivery workflow time.

## Implementation Guidance

S1.4 implementation should update the planned event envelope from:

```ts
createdAt: string;
```

to:

```ts
occurredAt: string;
recordedAt: string;
```

Implementation should also replace timeline and subscriber cursor language that currently references `createdAt` for events with `occurredAt`, while preserving `createdAt` where the record is not an event.

Recommended event ordering:

```text
tenantId, teamId, correlationId, occurredAt, eventId
```

Recommended subscriber cursor:

```text
lastProcessedOccurredAt, lastProcessedEventId
```

Recommended storage audit ordering:

```text
recordedAt, eventId
```

## Final Recommendation

S1.4 should use `occurredAt` and `recordedAt` for runtime event implementation.

`createdAt` should be avoided in the `agent_event.v1` event envelope and reserved for non-event database documents.

## Governance Confirmation

- No production code was modified.
- No ratified documents were modified.
- Gateway fallback behavior was not modified.
- Gateway fallback removal was not started.
- `.com` prospect-facing surfaces were not modified.
- Sprint 2 implementation was not started.
