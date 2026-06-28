# Agent Identity Naming Decision

Date: 2026-06-28

Agent: Agent Identity Naming Decision Agent

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

Status: DECISION REPORT ONLY

## Decision

Momentum runtime implementation must use both `agentKey` and `agentId`, with distinct meanings.

`agentKey` is the canonical semantic identity of an agent role in the runtime registry.

`agentId` is the runtime/database identifier of a configured agent instance.

New shared runtime contracts, runtime events, context packets, logs, runtime configuration, and QA fixtures must not use `agentId` to mean the semantic agent role.

## Definitions

### `agentKey`

`agentKey` identifies which Momentum specialist agent is involved.

Canonical v1.0 values are the ratified runtime registry keys:

```ts
type AgentKey = "steve_success" | "michael_magnificent" | "ivory";
```

`agentKey` is stable across sessions, deployments, database records, and configured instances unless the architecture explicitly adds or renames an agent through a ratified runtime change.

Examples:

- `steve_success`
- `michael_magnificent`
- `ivory`

### `agentId`

`agentId` identifies a configured runtime/database instance of an agent.

It is useful when Momentum can have more than one configured instance using the same `agentKey`, for example separate deployment configurations, tenant-specific instances, experimental instances, localized instances, or future runtime workers.

Recommended shape:

```ts
type AgentId = BrandedString<"AgentId">;
```

Example values:

- `agt_01JZ...`
- `agent_instance_steve_success_default`
- `agent_instance_michael_magnificent_es`

`agentId` must not be a semantic union such as `"steve" | "michael" | "ivory"` in new runtime contracts.

## Why Both Exist

Both fields should exist because they answer different questions.

`agentKey` answers:

> Which Momentum agent role is this?

`agentId` answers:

> Which configured runtime/database instance of that agent handled this?

If there is only one configured instance per agent in the first implementation slice, `agentId` can be generated deterministically or omitted where the contract does not need instance identity. The semantic field remains `agentKey`.

## Evidence From Current Documents

The ratified runtime documents already lean toward `agentKey` for semantic identity:

- `runtime/AGENT_RUNTIME.md` defines the required registry by Agent Key: `steve_success`, `michael_magnificent`, and `ivory`.
- `runtime/CONTEXT_PACKET_SCHEMA.md` defines `AgentContext.agentKey` and requires key/display/domain mapping.
- `runtime/AGENT_EVENT_MODEL.md` uses `agentKey` in the event envelope for Steve, Michael, and Ivory.

Planning drift exists:

- `engineering/plans/SHARED_RUNTIME_CONTRACT_PLAN.md` lists both `AgentId` and `AgentKey`.
- `engineering/plans/RUNTIME_EVENT_FOUNDATION_PLAN.md` uses `agentId` in the proposed event envelope.
- `engineering/plans/CONTEXT_PACKET_FOUNDATION_PLAN.md` uses `agentId` while assigning literal semantic values.
- Existing production orchestration types use `agentId: 'michael' | 'ivory' | 'steve' | 'system'`; that is legacy naming drift and should not define the new runtime contract.

## Placement Standard

### Shared Runtime Contracts

Define both:

```ts
type AgentKey = "steve_success" | "michael_magnificent" | "ivory";
type AgentId = BrandedString<"AgentId">;
```

Use `agentKey` for registry identity, allowed tools, prohibited behavior, templates, display names, domains, and objective authorization.

Use `agentId` only for configured runtime/database instances.

### Event Envelope

Use `agentKey` as the canonical agent field on `agent_event.v1`.

Recommended event fields:

```ts
agentKey?: AgentKey;
agentId?: AgentId;
```

`agentKey` is required when the event relates to Steve, Michael, or Ivory.

`agentId` is required only when the event is tied to a specific configured instance.

### Context Packet

Use `agentKey` in the packet's agent context:

```ts
agent: {
  agentKey: AgentKey;
  displayName: AgentDisplayName;
  primaryDomain: AgentDomain;
}
```

Include `agentId` only when the Context Manager is assembling a packet for a known configured instance.

### Logs

Logs should include `agentKey` for grouping and human/operator readability.

Logs should include `agentId` when available for instance-level tracing.

Recommended log fields:

```ts
agentKey?: AgentKey;
agentId?: AgentId;
```

### Runtime Configuration

The agent registry is keyed by `agentKey`.

Configured instances carry both:

```ts
interface AgentRuntimeInstanceConfig {
  agentId: AgentId;
  agentKey: AgentKey;
  active: boolean;
}
```

### QA Fixtures

Default fixtures should use `agentKey`.

Instance-specific fixtures should include both `agentKey` and `agentId`.

QA should fail if a fixture uses `agentId` with semantic values such as `"steve_success"` or `"ivory"`.

## Implementation Naming Standard

Use lower camel case for fields:

- `agentKey`
- `agentId`

Use PascalCase for TypeScript aliases:

- `AgentKey`
- `AgentId`

Rules:

1. `AgentKey` is a closed semantic registry union for v1.0.
2. `AgentId` is a branded runtime/database instance identifier.
3. Do not use `AgentId` as a synonym for `AgentKey`.
4. Do not use `agentId` in new context packets when the value is actually an agent key.
5. Do not introduce `AgentKey` as a database primary key for runtime instances.
6. Keep existing legacy production code untouched until an approved implementation task migrates it.

## Final Recommendation

Canonical implementation language:

```text
agentKey = semantic agent registry key.
agentId = configured runtime/database agent instance id.
```

S1.1, S1.4, S1.5, S1.6, S1.7, and future Agent Runtime implementation should normalize on that split before production runtime code is added.

## Governance Confirmation

- No production code was modified.
- No ratified documents were modified.
- Gateway fallback behavior was not modified.
- Gateway fallback removal was not started.
- `.com` prospect-facing surfaces were not modified.
- Sprint 2 implementation was not started.
