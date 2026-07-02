# S1.2 - Backend Runtime Boundary Plan

Report date: 2026-06-27

Sprint: Sprint 1 - Platform Alignment

Architecture version: v1.0 frozen

Status: Planning only. No production code is changed by this document.

Related status: S1.3 Runtime Persistence Direct Adapter Migration is CLOSED / VERIFIED. MongoDB, Neo4j, and ChromaDB are verified direct. ACR-0009 later retired the Gateway HTTP persistence fallback. Remaining Sprint 1 work is planning/governance only.

> **Supersession note (2026-07-02, ACR-0009):** this plan predates Kevin's
> approved retirement of the Gateway HTTP persistence fallback. Treat any
> fallback-preservation language below as historical planning context, not
> current architecture. Gateway is MCP/developer tooling; app runtime persistence
> is direct to the MCS stack.

## 1. Purpose

The backend runtime boundary defines where future Momentum runtime modules may live, how they may communicate with existing application services, and which dependencies they are allowed to touch.

The boundary exists to keep Package 001 runtime work additive. Future Knowledge Core, Context Manager, Agent Runtime, Event Runtime, Browser Voice/Text Runtime, and QA Harness work should be able to land without rewriting existing Momentum domain flows, weakening compliance, bypassing Team Magnificent scope, or turning agents into direct database clients.

The practical rule is simple: runtime modules coordinate behavior; approved services own persistence, communication, and domain state.

## 2. Scope

This plan covers future backend runtime code under a proposed additive namespace:

```text
server/src/runtime/
```

It also covers a possible future API route family:

```text
/api/runtime/*
```

The plan defines:

- allowed runtime module layout
- allowed service boundaries
- persistence boundaries
- agent memory consumption boundaries
- internal runtime vs external integration separation
- Telnyx separation
- Team Magnificent and `baId` scope rules
- environment flag strategy
- test and acceptance criteria

## 3. Out Of Scope

This plan does not implement runtime modules.

This plan does not:

- modify production code
- modify ratified architecture documents
- modify organization governance records
- modify `.com` prospect-facing surfaces
- remove Gateway fallback
- begin Sprint 2
- redesign Momentum
- change persistence behavior
- add new database collections
- add new API routes
- change Steve, Michael, Ivory, cockpit, invitation, or admin behavior

## 4. Proposed Additive Module Layout

Future implementation should create `server/src/runtime/` only when an approved implementation sprint begins. Recommended layout:

```text
server/src/runtime/
  index.ts
  identity/
    runtimeIdentity.ts
    scope.ts
  context/
    contextPacket.ts
    contextManager.ts
    retrievalAudit.ts
  knowledge/
    knowledgeCore.ts
    knowledgeReader.ts
    candidateBoundary.ts
  agents/
    agentRuntime.ts
    agentSession.ts
    guardrails.ts
  events/
    eventEnvelope.ts
    runtimeOutbox.ts
    replay.ts
  browser/
    voiceTextRuntime.ts
    transcriptFinalizer.ts
  qa/
    runtimeHarness.ts
    fixtures.ts
```

This is a namespace proposal, not a file creation instruction for Sprint 1. Modules should be added only when their implementation package is approved.

## 5. Proposed Future Route Boundary

If backend runtime routes are needed, mount them under:

```text
/api/runtime/*
```

Rules for this route family:

- It is internal to `.team` and `/admin` runtime experiences.
- It must not be mounted on `.com`.
- It must use the existing auth and onboarding gates appropriate to the caller.
- It must derive `baId` from the authenticated session, never from request body input.
- It must not expose raw memory, raw graph records, raw Chroma results, or database handles.
- It must return runtime-safe envelopes such as Context Packets, agent session state, transcript finalization records, or QA harness results.

Existing domain route families remain authoritative for current behavior:

- `/api/p/*` for prospect token resolution and `.com`
- `/api/invitations`, `/api/cockpit`, `/api/crm`, `/api/ivory`, `/api/scriptmaker`
- `/api/steve`, `/api/michael`
- `/api/admin/*`

Runtime routes may compose these services. They must not replace them without a separate approved migration.

## 6. Runtime Boundary Rules

Agents must not access MongoDB, Neo4j, or ChromaDB directly.

Agents consume memory through the Context Manager and a validated Context Packet only. A Context Packet is the boundary object passed into agent execution. It should contain approved, scoped, privacy-filtered, and audited context. It should not contain raw database query capability.

Runtime modules use approved service boundaries:

- persistence through existing persistence services and adapters
- domain state through existing domain services
- communication through existing communication services
- audit through existing audit/event services
- master content through existing master content services

Persistence access remains behind approved adapters/services. The runtime layer may call service functions, but it must not import driver clients, Mongoose models, Neo4j drivers, Chroma direct clients, or Gateway clients as a shortcut.

ACR-0009 later retired the Gateway HTTP persistence fallback. Runtime modules still must not call `gatewayCall()` or persistence drivers directly; they must use approved services and adapters.

## 7. Relationship To Existing Services

### `gatewayCall()`

`gatewayCall(tool, action, params)` is the compatibility seam used by current persistence callers. After ACR-0009, it dispatches to verified direct adapters only; it does not call the Universal Gateway HTTP path.

Runtime modules should not call `gatewayCall()` directly. They should call higher-level services that express intent, such as knowledge retrieval, context building, event recording, or domain operations.

### `tripleStackWrite()`

`tripleStackWrite()` remains a supported write helper for existing logical writes that must land in MongoDB, Neo4j, and ChromaDB.

Runtime modules should not create ad hoc triple-stack writes. They should use approved runtime/event/knowledge services that choose the correct write helper and schema.

### `tieredWrite()`

`tieredWrite()` is the preferred boundary for future records that need explicit consistency policy:

- `graph_critical` for membership and agent-reasoned edges where Mongo and Neo4j must be protected together
- `knowledge` for records agents learn from, where projections must eventually land
- `operational` for workflow/audit records where Mongo commit is the user-visible success boundary

Runtime implementation should prefer this helper when adding new runtime persistence, subject to the approved implementation package.

### `projectionOutbox`

`projectionOutbox` is the durable retry boundary for Neo4j and Chroma projections on knowledge and operational writes. Runtime modules must not implement their own retry queue unless a later architecture decision replaces this one.

Runtime QA should inspect outbox behavior for lagging projections, dead letters, and replay safety.

### Direct Persistence Adapters

Direct adapters are verified for MongoDB, Neo4j, and ChromaDB under S1.3. They remain infrastructure behind the service boundary.

Runtime modules must not import direct adapter files such as:

- `server/src/services/persistence/mongo/*`
- `server/src/services/persistence/neo4j/*`
- `server/src/services/persistence/chroma/*`

Those adapters are owned by platform persistence, not by agents.

## 8. Relationship To Future Modules

### Knowledge Core

Knowledge Core owns approved knowledge access and candidate separation. It should expose read methods that return scoped knowledge objects for Context Manager. It must not let agents promote private or candidate content directly into approved knowledge.

### Context Manager

Context Manager builds Context Packets. It is the only allowed path from memory stores into agents. It applies Team Magnificent scope, `baId` scope, privacy rules, compliance rules, retrieval audit, degradation behavior, and exclusions.

### Agent Runtime

Agent Runtime executes or coordinates Steve, Michael, Ivory, and future system agents. It receives a Context Packet, a session identity, and allowed tools. It does not query persistence directly and does not initiate outreach outside approved user actions.

### Event Runtime

Event Runtime owns runtime event envelopes, idempotency, correlation IDs, causation IDs, replay boundaries, and outbox handoff. It must produce append-only records and must not mutate domain records casually.

### Browser Voice/Text Runtime

Browser Voice/Text Runtime owns `.team` browser microphone/text interaction, transcript finalization, language handling, and browser-side fallback behavior. It is internal runtime UX, not telephony.

### QA Harness

QA Harness verifies runtime boundaries. It should test Context Packet shape, persistence boundary violations, Telnyx separation, `baId` scope, Gateway fallback preservation, and no `.com` changes.

## 9. Internal Runtime Vs External Integrations

Internal runtime means code that coordinates Momentum behavior inside the app:

- Context Manager
- Knowledge Core
- Agent Runtime
- Event Runtime
- Browser Voice/Text Runtime
- QA Harness

External integrations are adapters to outside systems:

- Telnyx
- Resend
- Anthropic
- Zoom
- Universal Gateway MCP tooling
- future provider APIs

Internal runtime modules may call approved service wrappers for external integrations. They must not absorb external integrations into their own core logic.

## 10. Telnyx Boundary

Telnyx is external telephony and messaging.

Telnyx must not become part of the internal browser voice/text runtime.

Allowed Telnyx roles:

- BA SMS alerts
- prospect magic-link SMS where already approved
- Michael outbound voice where existing architecture requires PSTN telephony
- Telnyx webhook handling under existing raw-body route constraints

Not allowed:

- importing Telnyx service code into browser voice/text runtime modules
- using Telnyx as the implementation of in-browser voice
- routing internal browser transcripts through Telnyx
- treating Telnyx webhooks as internal runtime event envelopes without normalization

Browser Voice/Text Runtime should use browser speech/audio/text capabilities and server runtime endpoints. Telnyx remains a separate external integration boundary.

## 11. Team Magnificent Scope And `baId` Boundary

Every runtime record and runtime read must be scoped to Team Magnificent.

Every BA-scoped runtime operation must derive `baId` from the authenticated session or an already-authenticated server-side worker identity. Runtime routes must reject or ignore client-supplied `baId` for authorization decisions.

Runtime data must carry enough scope metadata to prevent cross-team or cross-BA leakage:

- team or tenant scope
- `baId` where BA-scoped
- agent identity where agent-scoped
- source surface
- correlation ID
- created-at timestamp

Prospect-facing `.com` remains outside the runtime route family. Prospect identity continues to resolve through token and approved prospect re-entry flows, not through Agent Runtime.

## 12. Environment Flag Strategy

Runtime implementation should use additive flags with safe defaults:

```env
RUNTIME_ENABLED=false
RUNTIME_API_ENABLED=false
RUNTIME_CONTEXT_MANAGER_ENABLED=false
RUNTIME_AGENT_RUNTIME_ENABLED=false
RUNTIME_BROWSER_VOICE_ENABLED=false
RUNTIME_QA_HARNESS_ENABLED=false
```

Flag rules:

- Defaults must preserve current behavior.
- Flags must not bypass auth, `baId` scope, or compliance.
- Flags must not remove Gateway fallback.
- Persistence flags from S1.3 remain separate:

```env
PERSISTENCE_DIRECT_ENABLED=true|false
PERSISTENCE_MONGO_MODE=gateway|direct
PERSISTENCE_NEO4J_MODE=gateway|direct
PERSISTENCE_CHROMA_MODE=gateway|direct
GPU_EMBEDDER_REQUIRED=true
```

Runtime flags control runtime feature exposure. Persistence flags control store dispatch mode. The two concerns must stay separate.

## 13. Test Strategy

Future implementation should include tests for:

- no runtime module imports direct Mongo, Neo4j, or Chroma adapter internals
- no agent code calls `gatewayCall()` or database drivers directly
- Context Manager is the only path from memory stores to Agent Runtime
- Context Packet includes Team Magnificent scope and correct `baId`
- client-supplied `baId` is rejected or ignored
- `/api/runtime/*` is auth-gated and never mounted for `.com`
- Telnyx imports are absent from Browser Voice/Text Runtime
- Universal Gateway HTTP fallback is absent from app runtime dispatch after ACR-0009
- direct persistence remains available for verified stores
- projection outbox handles deferred Neo4j/Chroma projections
- runtime events are append-only and idempotent
- QA Harness can prove no `.com` prospect-facing surfaces changed

Verification commands for a future implementation sprint should include:

```text
pnpm typecheck
pnpm build
focused runtime boundary tests
static import-boundary checks
manual route smoke tests against local dev server
```

No tests were run for this S1.2 document because it is a planning artifact only.

## 14. Risks And Mitigations

Risk: agents bypass Context Manager and query memory directly.

Mitigation: static import-boundary tests, runtime code review, and a hard rule that agents receive only Context Packets.

Risk: runtime modules duplicate existing domain services.

Mitigation: runtime modules compose existing services first. New services require explicit justification in the implementation plan.

Risk: Telnyx becomes tangled with browser voice/text runtime.

Mitigation: keep Telnyx in external integration services and test that browser runtime has no Telnyx imports.

Risk: persistence fallback is accidentally removed.

Mitigation: acceptance criteria require Gateway fallback preservation. Any removal requires separate approval.

Risk: `baId` leakage between BAs.

Mitigation: derive `baId` from session, include scope in runtime records, and test cross-BA access denial.

Risk: `.com` compliance drift.

Mitigation: runtime routes stay internal to `.team` and `/admin`; `.com` surfaces remain untouched.

Risk: runtime flags create a hidden partial rollout.

Mitigation: default all runtime flags off and require explicit implementation-sprint verification before enablement.

## 15. Required Acceptance Criteria

This S1.2 planning work is accepted when:

- `engineering/plans/BACKEND_RUNTIME_BOUNDARY_PLAN.md` exists.
- The plan defines the purpose of the backend runtime boundary.
- The plan defines scope and out-of-scope boundaries.
- The plan proposes additive `server/src/runtime/` layout.
- The plan proposes `/api/runtime/*` only as a future route boundary if needed.
- The plan states agents must not access MongoDB, Neo4j, or ChromaDB directly.
- The plan states agents consume memory only through Context Manager and Context Packet.
- The plan keeps persistence behind approved adapters/services.
- The plan preserves the direct app persistence boundary and is superseded by ACR-0009 for Gateway HTTP fallback retirement.
- The plan relates the boundary to `gatewayCall()`, `tripleStackWrite()`, `tieredWrite()`, `projectionOutbox`, and direct persistence adapters.
- The plan relates the boundary to Knowledge Core, Context Manager, Agent Runtime, Event Runtime, Browser Voice/Text Runtime, and QA Harness.
- The plan separates internal runtime from external integrations.
- The plan states Telnyx is external telephony and not part of internal browser voice/text runtime.
- The plan defines Team Magnificent scope and `baId` boundary.
- The plan defines environment flag strategy.
- The plan defines test strategy.
- The plan lists risks and mitigations.
- The plan confirms no production code was changed.
- The plan confirms no ratified documents were modified.

## 16. Governance Confirmations

Confirmed in this planning artifact:

- S1.3 Runtime Persistence Direct Adapter Migration is CLOSED / VERIFIED.
- MongoDB, Neo4j, and ChromaDB are verified direct.
- Gateway HTTP persistence fallback was later retired by ACR-0009.
- Universal Gateway remains MCP/developer tooling, not app runtime persistence.
- Remaining Sprint 1 work is planning/governance only.
- No production code was changed by this S1.2 plan.
- No ratified documents were modified by this S1.2 plan.
- No organization governance records were modified.
- No `.com` prospect-facing surfaces were modified.
- Sprint 2 was not started.
- Momentum was not redesigned.
