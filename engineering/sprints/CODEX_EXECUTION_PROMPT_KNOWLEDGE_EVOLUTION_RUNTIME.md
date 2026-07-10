# Knowledge Evolution Runtime - Multi-Agent Implementation Prompt

You are orchestrating implementation work inside the Momentum Creation System V2 repository:

`D:/momentum-creation-system-v2`

This prompt is for a multi-agent implementation run. It does not delegate work by itself. It is the prompt to give to an orchestrator agent that will create worktrees, launch lane agents, monitor PRs, merge only after gates pass, and keep the implementation aligned with the ratified Knowledge Evolution Runtime.

## Authoritative Sources

Read these before planning or launching any lane:

1. `AGENTS.md`
2. `docs/READ-ME-FIRST.md`
3. `FOUNDATION_v1.0_FREEZE.md`
4. `constitution/MOMENTUM_CONSTITUTION.md`
5. `constitution/MOMENTUM_DECISION_FRAMEWORK.md`
6. `constitution/MOMENTUM_ACR_SYSTEM.md`
7. `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md`
8. `runtime/KNOWLEDGE_CORE_RUNTIME.md`
9. `runtime/KNOWLEDGE_INGESTION_PROTOCOL.md`
10. `runtime/LEARNING_PIPELINE.md`
11. `runtime/CONTEXT_MANAGER.md`
12. `runtime/CONTEXT_PACKET_SCHEMA.md`
13. `runtime/AGENT_EVENT_MODEL.md`
14. `runtime/AGENT_RUNTIME.md`
15. `PLATFORM_AUDIT.md`
16. `PLATFORM_AUDIT_PRIORITY_TASKLIST.md`

Use the repo copy of `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` as authority. Do not use pasted or external variants to overwrite it. The repo version includes the current ratification, constitutional boundary, domain section, and related ACR note.

## Objective

Implement the Knowledge Evolution Runtime v1.0 so approved learning can safely become active, versioned, indexed, graph-linked, retrievable organizational knowledge for Team Magnificent.

The implementation must support:

- Knowledge Evolution records
- Evolution plans
- Approval validation
- Team Magnificent scope validation
- Approved candidate activation
- Versioning
- Supersession
- Archival
- Chroma reindex coordination
- Neo4j graph sync coordination
- Retrieval rollout
- Bilingual English/Spanish variants
- Rollback plans and rollback execution
- Runtime event emission
- Metrics and health
- Privacy guardrails
- Runtime boundary tests
- Acceptance criteria from `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md`

## Governance And Gate Rule

Before launching implementation lanes, the orchestrator must verify whether a current approved ACR or decision-ledger entry authorizes implementation of the Knowledge Evolution Runtime. If there is no active approval record, stop and create an implementation-readiness packet instead of launching code lanes.

Do not modify ratified architecture documents unless an approved ACR explicitly authorizes document changes.

Do not self-approve. Agents create PRs. The orchestrator merges after gates pass. Kevin remains final authority.

## Non-Negotiable Runtime Boundaries

The Knowledge Evolution Runtime must never:

- Approve knowledge.
- Create raw candidates.
- Detect learning signals.
- Assemble Context Packets.
- Generate agent responses.
- Mine private journals.
- Bypass Knowledge Core.
- Bypass Knowledge Ingestion.
- Bypass governance.
- Let agents self-modify.
- Activate unapproved knowledge.
- Activate unreviewed machine translation.
- Use Telnyx.
- Send external communications.
- Modify `.com` prospect surfaces.
- Reintroduce Universal Gateway as a production runtime dependency.

The runtime may coordinate only approved knowledge activation and related versioning, indexing, graph sync, rollout, monitoring handoff, and rollback.

## Persistence Law

Production runtime persistence uses the dedicated MCS direct stack:

- MongoDB as canonical truth
- Neo4j for graph relationships and lineage
- ChromaDB for semantic retrieval only

Use existing direct service layers and adapters. Do not use external MCP tools or Universal Gateway for app runtime persistence.

New Knowledge Evolution persistence should prefer the tiered write model and projection outbox where applicable:

- graph-critical records use graph-critical semantics with rollback/readback expectations
- knowledge records use knowledge-tier writes with durable Chroma/Neo4j projection
- operational records use operational-tier writes with durable projection

If an existing adapter is not sufficient, extend the app-native adapter/service layer. Do not create a parallel hidden persistence path.

## Environment Safety For Lane Agents

Every lane launcher must clear inherited stale environment variables before running commands:

```powershell
foreach ($v in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','MONGODB_URI','MONGO_URI','NEO4J_URI','NEO4J_URL','CHROMA_URL','CHROMADB_URL') {
  Remove-Item ("Env:" + $v) -ErrorAction SilentlyContinue
}
```

Do not put `$env:` references inside inline PowerShell `-Command` strings launched through external tooling. Use `.ps1` launcher files.

The project `.env` must own the direct app stack:

- Mongo 30000
- Neo4j 7710
- Chroma 8200
- GPU embedding service 8300

## Required Multi-Agent Sequencing

Do not run all lanes at once.

Lane 0 must run alone and merge first. It owns shared contracts and collision surfaces. Consumer lanes must rebase on merged Lane 0 before starting.

After Lane 0 merges, Lanes A, B, and C may run in parallel. Lane D starts only after A/B/C merge. Lane E starts after D merges.

```text
Lane 0 - Shared Foundation
  ↓
Lane A - Persistence Models and Repositories
Lane B - Policies and Core Services
Lane C - Indexing and Graph Sync
  ↓
Lane D - Routes, Workers, Events, Metrics
  ↓
Lane E - Acceptance Tests, Docs, Final Verification
```

Each lane creates a branch, commits, pushes, opens a PR, and prints a final machine-readable line:

`LANE0 COMPLETE PR:<n>`

or

`LANE0 FAILED: <reason>`

Use the matching lane number/letter.

## Branch Naming

Use these branches unless the orchestrator has a reason to adjust:

- `feat/knowledge-evolution-lane0-foundation`
- `feat/knowledge-evolution-laneA-persistence`
- `feat/knowledge-evolution-laneB-core-services`
- `feat/knowledge-evolution-laneC-index-graph`
- `feat/knowledge-evolution-laneD-runtime-api`
- `feat/knowledge-evolution-laneE-qa-docs`

## Lane 0 - Shared Foundation

Run alone. Merge before all other lanes.

### Goal

Pin the shared runtime contracts, constants, enums, and module skeleton so downstream lanes build against the same source of truth.

### Scope

- Add shared TypeScript contracts under `packages/shared/src/runtime/knowledge-evolution/` or the nearest existing runtime contract pattern.
- Append exports only. Respect append-only rules in shared files.
- Add server module skeleton under `server/src/runtime/knowledge-evolution/`.
- Add constants for Team Magnificent scope, supported languages, status enums, action enums, event names, and collection names.
- Define request/response contract types for:
  - start evolution
  - get evolution record
  - mark retrieval ready
  - rollback
  - metrics
- Define event names from `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md`:
  - `knowledge.evolution.received`
  - `knowledge.evolution.plan_created`
  - `knowledge.evolution.version_created`
  - `knowledge.evolution.knowledge_written`
  - `knowledge.evolution.supersession_applied`
  - `knowledge.evolution.archive_applied`
  - `knowledge.evolution.reindex_requested`
  - `knowledge.evolution.reindex_completed`
  - `knowledge.evolution.graph_sync_requested`
  - `knowledge.evolution.graph_sync_completed`
  - `knowledge.evolution.retrieval_ready`
  - `knowledge.evolution.rollback_applied`
  - `knowledge.evolution.failed`
  - `knowledge.evolution.completed`
- Add no-op index exports so lanes can import stable paths.

### Hard Constraints

- No production behavior yet.
- No route mount in `server/src/index.ts` unless necessary for type-only placeholder work.
- No database writes.
- No Chroma writes.
- No Neo4j writes.
- No GraphRAG activation.
- No Context Manager live flag changes.

### Verification

- `pnpm --config.verify-deps-before-run=false typecheck`
- targeted shared/server typecheck if faster
- PR description lists every exported contract.

## Lane A - Persistence Models And Repositories

Start only after Lane 0 merges and this lane rebases onto `origin/main`.

### Goal

Implement Mongo canonical models/repositories and indexes for Knowledge Evolution records, plans, versions, supersession, rollout, rollback, language variants, errors, and metrics.

### Scope

Implement files matching the runtime spec shape:

```text
server/src/runtime/knowledge-evolution/models/
server/src/runtime/knowledge-evolution/repositories/
server/src/runtime/knowledge-evolution/persistence/
```

Required canonical collections:

- `knowledge_evolution_records`
- `knowledge_evolution_plans`
- `knowledge_evolution_versions`
- `knowledge_supersession_records`
- `knowledge_retrieval_rollouts`
- `knowledge_language_evolution_records`
- `knowledge_rollback_plans`
- `knowledge_evolution_errors`
- `knowledge_evolution_metrics`

Add indexes for:

- `evolutionId`
- `tenantId`
- `teamId`
- `teamKey`
- `baId`
- `inputType`
- `inputId`
- `status`
- `domain`
- `language`
- `targetKnowledgeObjectId`
- `createdAt`
- approval reference ids
- retrieval/indexing/graph statuses

Repositories must be idempotent where needed and must preserve audit history. Updates that change material knowledge state must not erase prior versions.

### Hard Constraints

- Mongo is canonical.
- Do not write directly from route handlers.
- Do not use Universal Gateway.
- Do not activate retrieval.
- Do not bypass future service validation by exposing unsafe repository helpers.

### Verification

- Unit tests for model validation and repository persistence behavior.
- Index tests or schema assertions where practical.
- `pnpm --config.verify-deps-before-run=false --filter @momentum/server test -- <targeted tests>`
- `pnpm --config.verify-deps-before-run=false typecheck`

## Lane B - Policies And Core Services

Start only after Lane 0 merges and this lane rebases onto `origin/main`.

### Goal

Implement the core Knowledge Evolution business logic without direct route or worker coupling.

### Scope

Implement services and policies:

```text
server/src/runtime/knowledge-evolution/services/
server/src/runtime/knowledge-evolution/policies/
```

Required services:

- `KnowledgeEvolution.service.ts`
- `EvolutionPlan.service.ts`
- `EvolutionApproval.service.ts`
- `EvolutionVersion.service.ts`
- `Supersession.service.ts`
- `Archive.service.ts`
- `RetrievalRollout.service.ts`
- `EvolutionRollback.service.ts`
- `EvolutionMetrics.service.ts`

Required policies:

- `EvolutionApprovalPolicy.ts`
- `EvolutionPrivacyPolicy.ts`
- `EvolutionBilingualPolicy.ts`
- `EvolutionTeamScopePolicy.ts`
- `EvolutionRetrievalReadinessPolicy.ts`
- `EvolutionRollbackPolicy.ts`

Service rules:

- Reject evolution without approval reference.
- Reject non-Team Magnificent BA-derived knowledge.
- Reject missing language metadata.
- Reject unapproved candidates.
- Reject unreviewed machine translation.
- Create an evolution plan before modifying Knowledge Core state.
- Create version records for material changes.
- Preserve source/candidate/outcome/signal/event lineage.
- Require rollback plan for retrieval-affecting evolution.
- Keep retrieval status blocked until approval, source, lifecycle, language, Chroma, Neo4j, governance, and scope checks pass.

### Hard Constraints

- Knowledge Evolution does not approve knowledge.
- Knowledge Evolution does not create raw candidates.
- Knowledge Evolution does not assemble Context Packets.
- Knowledge Evolution does not generate agent responses.
- Knowledge Evolution does not use Telnyx.
- Knowledge Evolution does not send communications.

### Verification

- Unit tests for every policy.
- Unit tests for plan creation, version creation, supersession, archival, rollback, retrieval readiness, and failure behavior.
- `pnpm --config.verify-deps-before-run=false --filter @momentum/server test -- <targeted tests>`
- `pnpm --config.verify-deps-before-run=false typecheck`

## Lane C - Chroma Indexing And Neo4j Graph Sync

Start only after Lane 0 merges and this lane rebases onto `origin/main`.

### Goal

Implement Chroma reindex coordination and Neo4j graph sync coordination through approved service layers.

### Scope

Implement:

```text
server/src/runtime/knowledge-evolution/indexing/
server/src/runtime/knowledge-evolution/graph/
```

Required files:

- `knowledgeEvolutionReindex.service.ts`
- `activeKnowledgeCollectionRouter.ts`
- `knowledgeEvolutionGraphMapper.ts`
- `knowledgeEvolutionGraphSync.service.ts`

Chroma responsibilities:

- Route active knowledge to domain/language active collections.
- Keep candidate/review-only collections separate.
- Exclude superseded and archived knowledge from active retrieval.
- Preserve tenant/team/language/source metadata.
- Mark indexing status pending/completed/failed.
- Make reindex jobs retryable.

Neo4j responsibilities:

- Create candidate-to-knowledge links.
- Create version links.
- Create supersession links.
- Create language variant links.
- Create Team Magnificent scope links.
- Preserve outcome and learning signal links.
- Mark graph status pending/completed/failed.
- Make graph sync jobs retryable.

### Hard Constraints

- Chroma is not canonical truth.
- Neo4j does not override Mongo canonical state.
- Candidate knowledge must never become active retrieval because of indexing mistakes.
- No GraphRAG broad activation.
- No Context Manager live flag changes.

### Verification

- Unit tests for active collection routing.
- Unit tests proving candidate/review-only records are excluded.
- Unit tests for graph mapper output.
- Integration-style tests with mocked adapters for Chroma and Neo4j success/failure.
- `pnpm --config.verify-deps-before-run=false --filter @momentum/server test -- <targeted tests>`
- `pnpm --config.verify-deps-before-run=false typecheck`

## Lane D - Routes, Workers, Events, Metrics

Start only after Lanes A, B, and C are merged and this lane rebases onto `origin/main`.

### Goal

Wire the runtime into internal APIs, workers, event publication/consumption, health, and metrics without prematurely activating live agent retrieval.

### Scope

Implement:

```text
server/src/runtime/knowledge-evolution/routes.ts
server/src/runtime/knowledge-evolution/workers/
server/src/runtime/knowledge-evolution/events/
```

Required API shape from the spec:

- `POST /api/runtime/knowledge-evolution`
- `GET /api/runtime/knowledge-evolution/:evolutionId`
- `POST /api/runtime/knowledge-evolution/:evolutionId/retrieval-ready`
- `POST /api/runtime/knowledge-evolution/:evolutionId/rollback`
- `GET /api/runtime/knowledge-evolution/metrics`

Mount routes additively in `server/src/index.ts`. Touch only import and mount lines if possible.

Workers:

- `approvedCandidateEvolution.worker.ts`
- `approvedTranslationEvolution.worker.ts`
- `supersessionEvolution.worker.ts`
- `archiveEvolution.worker.ts`
- `reindexEvolution.worker.ts`
- `graphSyncEvolution.worker.ts`

Events:

- consume approved candidate/translation/refinement/supersession/archive/admin import/session events
- emit `knowledge.evolution.*` events
- include correlation id, causation id, actor, approval reference, source candidate, knowledge object, version, team scope, language, timestamp
- replay must be idempotent and must not duplicate side effects

Metrics and health:

- backlog
- failed evolution jobs
- failed reindex jobs
- failed graph sync jobs
- retrieval-ready counts
- blocked rollout reasons

### Hard Constraints

- Internal API only.
- No prospect-facing changes.
- No Telnyx.
- No external sends.
- No direct store access from routes.
- Do not make Context Manager retrieve evolved knowledge until retrieval rollout is marked ready.

### Verification

- Route tests for auth/authorization and boundary behavior.
- Worker tests for idempotency and failure behavior.
- Event tests for envelope and causation/correlation.
- Metrics tests.
- `pnpm --config.verify-deps-before-run=false --filter @momentum/server test -- <targeted tests>`
- `pnpm --config.verify-deps-before-run=false typecheck`

## Lane E - Acceptance Tests, Documentation, Final Verification

Start only after Lane D merges and this lane rebases onto `origin/main`.

### Goal

Prove the runtime satisfies acceptance criteria and document the implementation status without modifying ratified specs.

### Scope

Add or update non-ratified implementation documentation only:

- `engineering/reports/KNOWLEDGE_EVOLUTION_RUNTIME_IMPLEMENTATION_REPORT.md`
- optional implementation notes under `engineering/plans/` or `engineering/reports/`

Test coverage must include:

- Approval validation
- Team Magnificent scope validation
- Evolution plan creation
- Version creation
- Supersession logic
- Archival logic
- Chroma reindex coordination
- Neo4j graph sync coordination
- Retrieval rollout
- Rollback
- Event emission
- Metrics
- Bilingual variants
- Privacy guardrails
- Runtime boundary tests

Acceptance tests must prove:

- Approved candidates can become active Knowledge Objects.
- Approval reference is required.
- Source traceability is preserved.
- Version record is created.
- Team Magnificent scope is preserved.
- Retrieval readiness is not granted before required checks pass.
- Superseded knowledge remains stored and excluded from normal retrieval.
- Archived knowledge remains auditable and excluded from normal retrieval.
- Candidate collections remain separate from active collections.
- English and Spanish indexes are supported.
- Unreviewed machine translation is blocked.
- Context Manager can retrieve only retrieval-ready evolved knowledge.
- Rollback preserves audit history.
- Knowledge Evolution does not approve knowledge.
- Knowledge Evolution does not create candidates directly.
- Knowledge Evolution does not use Telnyx.
- Knowledge Evolution does not send external communications.

### Hard Constraints

- Do not edit `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md`.
- Do not edit `constitution/**` or `organization/**` unless an approved ACR explicitly says to.
- Do not hide failing gates.
- If inherited unrelated Michael runtime failures remain, call them out separately rather than claiming full server suite green.

### Verification

Run:

```powershell
pnpm --config.verify-deps-before-run=false typecheck
pnpm --config.verify-deps-before-run=false build
pnpm --config.verify-deps-before-run=false --filter @momentum/server test
```

If normal `pnpm` commands are still blocked by approved-builds state, record that separately.

## Orchestrator Responsibilities

1. Confirm approval to implement.
2. Create one worktree per lane.
3. Copy this master prompt and the lane-specific brief into each worktree as `LANE_BRIEF.md`.
4. Launch Lane 0 only.
5. Wait for Lane 0 PR.
6. Check `gh pr checks <n>`.
7. Merge Lane 0 only after gates pass.
8. Launch Lanes A, B, and C in parallel after rebasing each onto `origin/main`.
9. Merge A/B/C after gates pass.
10. Launch Lane D.
11. Merge Lane D after gates pass.
12. Launch Lane E.
13. Merge Lane E after gates pass.
14. Run final verification on `main`.
15. Produce a final implementation report with PRs, commits, tests, known residual risks, and any blocked acceptance criteria.

## Worktree Launch Template

Use script files, not inline PowerShell command strings.

```powershell
$jobRoot = "D:/mcs-v2-knowledge-evolution"
$lane = "lane0-foundation"
$branch = "feat/knowledge-evolution-lane0-foundation"
$worktree = Join-Path $jobRoot $lane

foreach ($v in 'ANTHROPIC_API_KEY','ANTHROPIC_AUTH_TOKEN','MONGODB_URI','MONGO_URI','NEO4J_URI','NEO4J_URL','CHROMA_URL','CHROMADB_URL') {
  Remove-Item ("Env:" + $v) -ErrorAction SilentlyContinue
}

git worktree add $worktree -b $branch origin/main
Copy-Item "D:/momentum-creation-system-v2/engineering/sprints/CODEX_EXECUTION_PROMPT_KNOWLEDGE_EVOLUTION_RUNTIME.md" (Join-Path $worktree "LANE_BRIEF.md")
```

For dependent lanes, rebase before launching:

```powershell
git fetch origin --quiet
git rebase origin/main
```

## Lane Agent Close Requirements

Every lane agent must:

- state the files changed
- state the contract it implemented
- state all commands run
- state test results honestly
- push its branch
- create a PR
- stop without merging
- end with exactly one machine-readable completion line:

`LANEX COMPLETE PR:<n>`

or

`LANEX FAILED: <reason>`

## Final Done Definition

This implementation is not done until:

- all lanes are merged
- final main branch passes typecheck
- final main branch passes build
- server test status is recorded honestly
- Knowledge Evolution acceptance criteria are either passing or explicitly listed as blocked
- implementation report exists
- no GraphRAG or Context Manager live flag has been flipped without approved canary criteria
- no prospect-facing `.com` surface has changed
- no Telnyx/external communication path has been added
- no ratified document was modified without approved ACR authority

