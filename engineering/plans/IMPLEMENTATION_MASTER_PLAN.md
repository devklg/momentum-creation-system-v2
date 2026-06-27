# Implementation Master Plan

Report date: 2026-06-27

Agent: Integration Planning Agent

Architecture version: v1.0 frozen

## Inputs

This plan integrates:

- `engineering/audits/REPOSITORY_ANALYSIS_AUDIT.md`
- `engineering/audits/BACKEND_ALIGNMENT_AUDIT.md`
- `engineering/audits/FRONTEND_ALIGNMENT_AUDIT.md`
- `engineering/audits/KNOWLEDGE_PLATFORM_ALIGNMENT_AUDIT.md`
- `engineering/audits/AGENT_RUNTIME_ALIGNMENT_AUDIT.md`
- `engineering/audits/QA_TEST_ALIGNMENT_AUDIT.md`
- `engineering/audits/DOCUMENTATION_ALIGNMENT_AUDIT.md`
- `FOUNDATION_v1.0_FREEZE.md`
- `implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP_UPDATED.md`

## Freeze Rules

- Do not redesign architecture.
- Do not modify ratified architecture documents.
- Do not apply proposed ACRs.
- Do not write production code until Kevin approves the sprint.
- Treat `IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP_UPDATED.md` as the active Package 001 implementation package.
- Treat `runtime/README.md` drift as ACR-0005 territory, not as a free edit.

## Overall Strategy

The repository already contains substantial application functionality. Package 001 should be implemented as an additive runtime layer that aligns with the frozen architecture without breaking existing app-domain flows.

The first implementation work must establish platform contracts before behavior:

1. Shared runtime identity and type contracts.
2. Runtime event envelope and outbox.
3. Knowledge Core service boundary.
4. Context Packet schema and Context Manager boundary.
5. Browser Voice/Text runtime shell.
6. Agent Runtime backend and .team UI routes.
7. Momentum Journal.
8. Knowledge Ingestion.
9. Learning Pipeline.
10. Knowledge Evolution.
11. Acceptance tests and QA hardening.

## Master Sequence

### Phase 0 - Governance and Platform Alignment

Purpose: confirm that implementation uses existing Gateway/tiered-write patterns without violating Package 001.

Outputs:

- approved Sprint 1
- Claude governance audit signoff
- Kevin approval
- explicit implementation branch plan

### Phase 1 - Shared Runtime Contracts

Implement shared runtime modules under `packages/shared/src/runtime/`.

Must include:

- Team Magnificent scope
- BA scope
- runtime language
- agent keys
- context packet types
- agent event envelope types
- journal, knowledge, learning, knowledge-evolution, browser-voice types

### Phase 2 - Backend Runtime Event Foundation

Create additive `server/src/runtime/events/` module.

Must include:

- `agent_event.v1` envelope
- idempotency
- correlation/causation IDs
- privacy-safe payload rules
- outbox
- replay boundaries
- tests for Telnyx separation

### Phase 3 - Knowledge Core Foundation

Create additive `server/src/runtime/knowledge/` module.

Must include:

- approved knowledge and candidate separation
- source traceability
- Team Magnificent scope
- Gateway/tiered-write storage adapter boundary
- Chroma/Neo4j/GraphRAG service boundaries

### Phase 4 - Context Packet and Context Manager

Create `context_packet.v1` validation and `buildContextPacket()` service.

Must include:

- tenant/team/BA/session/agent identity
- runtime rules and guardrails
- approved knowledge retrieval
- private journal context boundary
- relationship context boundary
- exclusions
- retrieval audit
- degraded/failed packet behavior

### Phase 5 - Browser Voice and Browser Text Runtime

Create .team browser runtime components.

Must include:

- support detection
- permission-after-action flow
- transcript finalization
- text fallback
- language selector
- optional browser TTS
- no Telnyx/PSTN imports

### Phase 6 - Agent Runtime Backend and UI

Create additive runtime routes and adapt .team internal runtime surfaces.

Must include:

- Steve, Michael, Ivory sessions
- English and Spanish templates
- context packet requests
- output guardrails
- journal prompt support
- Ivory editable draft support
- no auto-send

### Phase 7 - Momentum Journal

Create private BA journal with select-for-review path.

Must include:

- private by default
- BA ownership
- selected journal entry creates Knowledge Candidate only
- agents cannot promote private journal content automatically

### Phase 8 - Knowledge Ingestion

Create ingestion pipeline.

Must include:

- capture
- normalize
- classify
- segment
- risk check
- dedupe
- candidate creation
- review-only indexing
- graph lineage

### Phase 9 - Learning Pipeline

Create learning outcomes/signals/patterns/proposals.

Must include:

- learning can propose candidates
- learning cannot approve knowledge
- private journal exclusion unless selected
- bilingual parity signals

### Phase 10 - Knowledge Evolution

Create evolution runtime after candidate, approval, event, and learning foundations exist.

Must include:

- approval reference required
- active knowledge versioning
- supersession
- archival
- retrieval-ready rollout
- Chroma reindex coordination
- Neo4j graph sync coordination
- rollback
- no agent self-modification

### Phase 11 - QA and Release Hardening

Must include:

- typecheck and build
- focused runtime unit tests
- browser runtime component tests
- Gateway smoke tests where infrastructure is available
- acceptance gate checklist

## Cross-Cutting Constraints

- Every BA-scoped runtime record must include Team Magnificent scope.
- Agents must not query MongoDB, Chroma, Neo4j, or GraphRAG directly.
- Internal runtime voice must use browser voice/text, not Telnyx.
- Telnyx remains external only.
- Ivory drafts remain editable and BA-owned.
- Knowledge Candidates are review-only.
- Knowledge Evolution requires approval and does not approve knowledge.
- Proposed ACRs stay Proposed unless Kevin approves.

## Blockers

1. Universal Gateway V2 MCP connector failed during audit; live store verification is pending.
2. Package 001 references Mongo/Mongoose while existing repo persistence is Gateway-native. Governance should confirm the implementation mapping before backend code begins.
3. No test framework is wired.
4. Browser Voice runtime has no existing reusable shell.
5. `runtime/README.md` drift is ACR-gated.

## Governance Gates

1. Claude governance audit reviews this plan and all audit reports.
2. Kevin approves Sprint 1 explicitly.
3. Implementation branch is created only after approval.
4. Sprint close requires typecheck/build plus planned tests for touched areas.

## Stop Condition

This plan does not authorize Sprint 1 implementation. Stop here until Kevin approves `engineering/sprints/SPRINT_001_PLATFORM_ALIGNMENT.md`.
