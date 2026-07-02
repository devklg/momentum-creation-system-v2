# S1.4 Runtime Event Foundation Plan

Date: 2026-06-27

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

Status: PLANNING ONLY

> **Supersession note (2026-07-02, ACR-0009):** this plan predates Kevin's
> approved retirement of the Gateway HTTP persistence fallback. Treat any
> fallback-preservation language below as historical planning context, not
> current architecture. Gateway is MCP/developer tooling; app runtime persistence
> is direct to the MCS stack.

## 1. Purpose

This plan defines the foundation for Momentum runtime events before production event code is implemented.

The runtime event foundation exists to record what happened inside Momentum in a traceable, immutable, privacy-safe form. It must let the platform reconstruct sessions, context decisions, agent turns, guided actions, outcomes, review decisions, learning signals, errors, and audit trails without allowing replay or subscribers to repeat unsafe side effects.

This plan aligns with the ratified runtime event model in `runtime/AGENT_EVENT_MODEL.md`, including schema version `agent_event.v1`.

## 2. Governance Facts

- S1.3 Runtime Persistence Direct Adapter Migration is CLOSED / VERIFIED.
- Direct persistence is verified for MongoDB, Neo4j, and ChromaDB.
- Gateway HTTP persistence fallback was later retired by ACR-0009.
- Universal Gateway remains MCP/developer tooling, not app runtime persistence.
- Remaining Sprint 1 work is planning/governance only.
- This S1.4 document does not approve Sprint 2 or production runtime implementation.

## 3. Scope

In scope:

- Define the implementation plan for `agent_event.v1` envelope handling.
- Define required event fields and validation rules.
- Define event categories, idempotency, correlation, causation, outbox, replay, subscriber offsets, auditability, and store relationships.
- Define Team Magnificent scoping and agent-store access boundaries.
- Define future validation and test expectations.

Out of scope:

- No production code changes.
- No ratified document edits.
- No organization governance record edits.
- No `.com` prospect-facing changes.
- No new Universal Gateway runtime dependency.
- No Sprint 2 implementation.
- No redesign of Momentum runtime architecture.
- No new agent behavior implementation.
- No external communication execution.

## 4. Proposed Event Envelope

All runtime events use:

```text
agent_event.v1
```

Required planning envelope:

```ts
interface AgentEventV1<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: string;
  tenantId: string;
  teamId: string;
  baId?: string;
  agentId?: string;
  requestId: string;
  correlationId: string;
  causationId?: string;
  idempotencyKey: string;
  actor: {
    actorType: "ba" | "agent" | "system" | "admin" | "subscriber";
    actorId: string;
  };
  source: string;
  payload: TPayload;
  metadata: Record<string, unknown>;
  createdAt: string;
  schemaVersion: "agent_event.v1";
}
```

Compatibility note: the ratified event model also names `occurredAt` and `recordedAt`. This plan does not amend the ratified model. Before implementation, engineering must reconcile whether `createdAt` is an API-facing alias for `recordedAt`, whether `occurredAt` remains an internal field, or whether both names are carried in the service model. That reconciliation is implementation detail only and must not modify ratified documents in S1.

## 5. Required Event Fields

- `eventId`: globally unique immutable event id, recommended `evt_<ulid>`.
- `eventType`: dot-namespaced completed fact, never a command.
- `tenantId`: required tenant boundary.
- `teamId`: required Team Magnificent team boundary.
- `baId`: required when the event relates to a Brand Ambassador.
- `agentId`: required when the event relates to Steve, Michael, Ivory, Browser Voice/Text, or a runtime subscriber.
- `requestId`: links an event to the inbound HTTP, worker, or runtime request that emitted it.
- `correlationId`: links events across one workflow or session timeline.
- `causationId`: references the prior event that caused this event when applicable.
- `idempotencyKey`: unique deterministic key used to prevent duplicate event persistence.
- `actor`: identifies who or what caused the fact to be recorded.
- `source`: identifies the runtime component that emitted the event.
- `payload`: minimal event-specific data, privacy-safe by default.
- `metadata`: operational details only, no secrets or unnecessary private text.
- `createdAt`: ISO timestamp for event creation/persistence.
- `schemaVersion`: must equal `agent_event.v1`.

## 6. Event Categories

The foundation must support these categories:

- Knowledge events: capture, candidate creation, indexing, graph sync, lifecycle, retrieval, and evolution signals.
- Context events: context request, retrieval, packet creation, packet delivery, degraded packet, failed packet, exclusions, and audit records.
- Agent events: session creation, turn received, turn responded, state advanced, draft created, guardrail blocked, session completed, failed, or cancelled.
- Guided action events: action suggested, accepted, declined, completed, expired, or failed.
- Outcome events: BA-owned result, learning outcome, measurable action result, and outcome-linked signal.
- Review/approval events: candidate queued, review requested, approved, rejected, superseded, archived, and approval bridge events.
- Error events: validation failure, privacy block, storage failure, outbox failure, subscriber failure, replay failure, and runtime exception.

Event names must remain completed facts. Commands such as "send SMS", "approve knowledge", or "call prospect" are not events.

## 7. Idempotency Strategy

- Every event requires `idempotencyKey`.
- MongoDB must enforce a unique index on `idempotencyKey`.
- The event service checks for an existing key before insert.
- Same key with identical semantic event input returns the existing event as an idempotent replay.
- Same key with conflicting payload, scope, source, or event type is rejected as an idempotency conflict.
- Deterministic keys are preferred, for example:
  - `agent-session:{sessionId}:created`
  - `agent-turn:{sessionId}:{turnId}:received`
  - `context-packet:{requestId}:{packetId}:created`
  - `guided-action:{actionId}:completed`
- Subscriber-side writes also require subscriber-specific idempotency keys so retries do not duplicate projections.

## 8. Correlation and Causation Strategy

- `requestId` traces the local request or worker execution that emitted the event.
- `correlationId` traces the full workflow, such as a Steve session, Michael support session, Ivory drafting flow, context packet lifecycle, or knowledge ingestion pipeline.
- `causationId` links a child event to the parent event that caused it.
- Root events may omit `causationId`; downstream events must include it when a prior event is known.
- Timelines are reconstructed by `tenantId`, `teamId`, `correlationId`, then ordered by `createdAt` and `eventId`.
- Cause chains are reconstructed by following `causationId -> eventId`.

## 9. Outbox Strategy

- Event persistence and outbox item creation must be part of the same logical write.
- MongoDB is the canonical event store and should hold:
  - `runtime_events`
  - `runtime_event_outbox`
  - `runtime_event_subscriber_offsets`
  - `runtime_event_replay_jobs`
  - `runtime_event_errors`
  - `runtime_event_metrics_projection`
- Each outbox record identifies `eventId`, `subscriberId`, `tenantId`, `teamId`, status, attempts, next attempt time, and last error.
- Subscribers process outbox items asynchronously and idempotently.
- Failed subscribers do not mutate the original event.
- Retries must be bounded and observable; exhausted items move to an inspectable failed/dead-letter state.
- Gateway HTTP persistence fallback status is superseded by ACR-0009; the approved runtime target is direct persistence.

## 10. Replay Boundaries

Replay is allowed only for:

- audit timelines,
- session timelines,
- metrics projection rebuilds,
- lineage projection rebuilds,
- context audit reconstruction.

Replay must not:

- send SMS,
- send ringless voicemail,
- initiate callbacks,
- rerun Browser Voice actions,
- approve knowledge,
- activate knowledge,
- create duplicate candidates,
- change review decisions,
- mutate original event payloads,
- trigger prospect-facing `.com` behavior.

Replay jobs must carry `allowSideEffects: false`.

## 11. Subscriber Offset Strategy

- Offsets are tracked per `subscriberId`, `tenantId`, and when useful `teamId`.
- A subscriber checkpoint stores last processed event cursor fields, including `lastProcessedEventId`, `lastProcessedCreatedAt`, and `updatedAt`.
- Subscribers advance offsets only after their side effect or projection succeeds.
- Subscribers must tolerate duplicate delivery by checking their own idempotency key.
- Ordered processing should use `createdAt` plus `eventId` as a stable cursor.
- Backfills and replays should use replay jobs rather than directly editing offsets.

## 12. Auditability and Provenance

Every event must preserve enough provenance to answer:

- what happened,
- when it was recorded,
- who or what caused it,
- which request emitted it,
- which workflow it belongs to,
- which prior event caused it,
- which runtime component emitted it,
- which tenant/team/BA scope it belongs to,
- which subscriber projections ran against it.

Event correction must be append-only. If a fact needs correction, emit a correcting event rather than mutating the original event.

Payloads must reference private text, transcripts, journal entries, prospect-sensitive records, and large artifacts by id or hash whenever possible.

## 13. Storage Relationship

MongoDB:

- Canonical immutable event store.
- Owns event envelope records, outbox, offsets, replay jobs, error records, and metrics projections.
- Enforces unique `eventId` and `idempotencyKey`.

Neo4j:

- Stores event-derived lineage and relationship projections.
- Represents links among sessions, agents, context packets, knowledge candidates, guided actions, outcomes, approvals, and learning signals.
- Receives projections through event subscribers, not direct agent writes.

ChromaDB:

- Stores semantic indexes for approved knowledge, review candidates, summaries, templates, and searchable event-derived artifacts where appropriate.
- Should not index every raw event blindly.
- Receives privacy-screened projections through subscribers using the direct Chroma path verified in S1.3.

Direct persistence is verified for all three stores under S1.3. ACR-0009 later retired the Gateway HTTP persistence fallback.

## 14. Agent Store Access Rule

Agents do not write directly to MongoDB, Neo4j, or ChromaDB.

Agents emit runtime facts through the Runtime Event Service and access context through the Context Manager. Store writes are owned by runtime services and subscribers. Agent modules must not import Mongoose models, Neo4j drivers, Chroma adapters, direct persistence clients, or Gateway clients.

## 15. Team Magnificent Scoping Rules

- Every BA-scoped runtime event must include Team Magnificent scope.
- `teamId` is required in the S1.4 envelope.
- BA-scoped events require `baId`.
- Agent-scoped BA interactions require both `baId` and `agentId`.
- Team Magnificent identity must be preserved in payload or metadata when downstream stores need projection context.
- No event may treat a BA as a floating user outside Team Magnificent.
- `.com` prospect-facing events must not introduce income claims, placement promises, AI prospecting language, current team headcount, or THREE branding.

## 16. Validation Strategy

The future Runtime Event Service must validate before persistence:

- `schemaVersion === "agent_event.v1"`.
- Required envelope fields are present.
- `eventType` is known and category-valid.
- `source` is known and allowed to emit the event type.
- `tenantId` and `teamId` exist.
- `baId` exists for BA-scoped events.
- `agentId` exists for agent-scoped events.
- `requestId`, `correlationId`, and `idempotencyKey` exist.
- `causationId`, when present, references a known or accepted prior event id.
- `payload` matches the event type's schema.
- `metadata` is safe.
- No secrets, raw tokens, unnecessary transcript text, private journal text, or broad prospect-sensitive content is stored.

Validation failures emit or record typed error events without claiming the original event was persisted.

## 17. Test Strategy

Future implementation tests must include:

- envelope schema tests for all required fields;
- `agent_event.v1` version enforcement;
- taxonomy/category tests;
- source-to-event authorization tests;
- Team Magnificent scope tests;
- idempotency replay and conflict tests;
- correlation and causation timeline tests;
- privacy validation tests;
- outbox creation, retry, completion, and failure tests;
- subscriber offset advancement and duplicate-delivery tests;
- replay tests proving `allowSideEffects: false`;
- agent-store boundary tests proving agents do not import direct store clients;
- Gateway fallback preservation tests;
- direct MongoDB, Neo4j, and ChromaDB health/read-back tests under the verified S1.3 mode.

Mandatory implementation gates remain:

```powershell
pnpm typecheck
pnpm build
pnpm --filter @momentum/server test
```

## 18. Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Field drift between this plan and ratified `AGENT_EVENT_MODEL.md` timing names | Resolve `createdAt` versus `occurredAt` / `recordedAt` at implementation design time without editing ratified docs in S1. |
| Events become commands | Validation and taxonomy require completed-fact naming only. |
| Replay repeats external side effects | Replay jobs require `allowSideEffects: false`; replay subscribers are projection-only. |
| Agents bypass services and write stores directly | Static boundary tests and import bans for agent modules. |
| Outbox duplicates projections | Subscriber-specific idempotency keys and offset checkpoints. |
| Privacy leakage through payloads | Payload minimization, id/hash references, privacy validation, and typed errors. |
| Chroma becomes a raw event dump | Chroma receives only privacy-screened semantic projections, not all raw events. |
| Gateway fallback is accidentally removed | Explicit preservation gate and fallback tests until Kevin separately approves removal. |
| `.com` compliance leakage | `.com` remains out of scope; prospect-surface guard tests stay mandatory when relevant. |

## 19. Acceptance Criteria

This S1.4 plan is accepted when:

- It defines the purpose and boundaries for the runtime event foundation.
- It proposes the `agent_event.v1` envelope.
- It includes all required event fields listed in the S1.4 assignment.
- It covers knowledge, context, agent, guided action, outcome, review/approval, and error events.
- It defines idempotency, correlation, causation, outbox, replay, subscriber offsets, auditability, and provenance.
- It defines the storage relationship to MongoDB, Neo4j, and ChromaDB.
- It states that agents do not write directly to stores.
- It includes Team Magnificent scoping rules.
- It defines validation and test strategy.
- It lists risks and mitigations.
- It acknowledges S1.3 is CLOSED / VERIFIED and direct persistence is verified for MongoDB, Neo4j, and ChromaDB.
- It confirms direct app persistence and is superseded by ACR-0009 for Gateway HTTP fallback retirement.
- It confirms no production code was changed.
- It confirms no ratified documents were modified.

## 20. Explicit Non-Actions

- No production code was changed.
- No ratified documents were modified.
- No organization governance records were modified.
- No `.com` prospect-facing surfaces were modified.
- Gateway HTTP fallback was not removed.
- Sprint 2 was not started.
- Momentum runtime architecture was not redesigned.
