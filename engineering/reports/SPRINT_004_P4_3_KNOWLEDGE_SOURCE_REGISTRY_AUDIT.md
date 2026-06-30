# Sprint 4 P4.3 Knowledge Source Registry Audit

- Sprint: Sprint 4 — Knowledge Retrieval and Context Enrichment
- Slice: P4.3 Knowledge Source Registry Audit — inventory the approved-knowledge access surface, the approved vs. candidate/review-only split, and verify no route/agent reaches a store directly
- Status: AUDIT / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no LLM/DB/Gateway access; gate run read-only)
- Architecture version: v1.0 frozen
- Date: 2026-06-29
- Owner: Phase 4 worktree — Claude Code (Instance 1)
- Base ref: `origin/main` @ Base SHA `dec82101b73c579714cf7f885e3459137f295afd`
- Branch: `feature/phase-04-p4.3-knowledge-source-registry-audit` (stacked on P4.2 → P4.1)
- Inputs: P4.1 Charter (`SPRINT_004_P4_1_CONTEXT_MANAGER_RETRIEVAL_CHARTER.md`), P4.2 Approved Knowledge Query Contract (`approved_knowledge_query.v1`)

> This is an audit. It changes no code and approves nothing. It establishes the evidence
> base that the P4.4 Context Manager Retrieval Adapter has exactly ONE sanctioned input —
> the Knowledge Core boundary — and that wiring it introduces no new store edge.

## 1. Executive Result

**PASS — single sanctioned approved-knowledge surface confirmed; no direct-store leak found.**

At Base SHA `dec8210`:

- The **only** approved-knowledge access surface is the Knowledge Core boundary
  (`server/src/runtime/knowledge/knowledgeCore.ts`, `KnowledgeCoreBoundaryPort`). It is a
  `skeleton_only` / `service_boundary_only` port with no implementation, no store import,
  no Gateway import.
- The approved vs. candidate/review-only split is enforced **at the type level** in
  `@momentum/shared/runtime` (`KnowledgeReference` vs. `KnowledgeCandidateReference`) and
  **at the runtime level** by the Context Manager (`excludedReferencesFor`,
  `candidateKnowledgeExcluded: true`) and the P4.2 query-contract validators.
- **No route, domain module, or agent reads approved knowledge directly.** No file under
  `server/src/routes/**` imports `runtime/knowledge` or `runtime/context`. The runtime
  layer (`server/src/runtime/**` source) imports no store/Gateway client — a property
  already enforced by an existing family of governance-boundary tests.
- Direct store access (Mongo/Neo4j/Chroma/Gateway/triple-stack) exists only in the
  sanctioned service tier (`server/src/services/**`), the `domain/**` modules that call it,
  and `workers/**` — never in the runtime knowledge/context layer.

The P4.4 adapter therefore has a single, store-free input and adds no new persistence edge.

## 2. Scope and Method

This audit answers three questions for Phase 4:

1. **What is the approved-knowledge access surface?** (The contract the adapter will call.)
2. **How is approved vs. candidate/review-only represented and enforced?**
3. **Does any route or agent reach a store directly today** (which the adapter must not
   reintroduce)?

Method: static inspection at Base SHA `dec8210` via repo search — imports of the Knowledge
Core boundary and knowledge types, store/Gateway import patterns within `server/src/runtime/`,
and route → runtime coupling. No code was run beyond the read-only gate.

## 3. The Approved-Knowledge Access Surface (the registry)

### 3.1 Knowledge Core boundary — the sole access point

`server/src/runtime/knowledge/knowledgeCore.ts`:

```ts
export interface KnowledgeCoreBoundaryPort {
  listApprovedKnowledge(scope: RuntimeRequestScope): Promise<readonly KnowledgeReference[]>;
  listCandidateKnowledgeForReview(scope: RuntimeRequestScope): Promise<readonly KnowledgeCandidateReference[]>;
}
```

- `status: 'skeleton_only'`, `activated: false`, `apiMounted: false`,
  `behaviorEnabled: false`, `persistenceAccess: 'service_boundary_only'`.
- Boundary notes (verbatim): *"Approved knowledge access boundary only; no database,
  adapter, or Gateway import is allowed here."* / *"Future implementations must return
  scoped shared runtime knowledge contracts through service-owned persistence."*
- **`listApprovedKnowledge`** is the only method the P4.4 adapter is authorized to call.
  **`listCandidateKnowledgeForReview`** exists for a future human review workflow — it is
  **out of scope for retrieval** and must never feed packet assembly.

### 3.2 Reference inventory — who touches the Knowledge Core boundary

`listApprovedKnowledge` / `KnowledgeCoreBoundaryPort` / `knowledgeCoreBoundary` are
referenced in exactly three places:

| File | Role |
|---|---|
| `server/src/runtime/knowledge/knowledgeCore.ts` | the boundary definition itself |
| `server/src/runtime/index.ts` | append-only barrel re-export |
| `engineering/reports/SPRINT_004_P4_1_*` | the P4.1 charter (documentation) |

**Zero route, domain, agent, or service consumers.** The boundary is currently unwired —
exactly the clean seam Phase 4 builds the adapter onto.

## 4. The Approved vs. Candidate/Review-Only Split

### 4.1 Type-level separation (`@momentum/shared/runtime/knowledge.ts`)

- `KnowledgeReference` — `status: 'approved' | 'active'` only; carries `domain`, `language`,
  `translationStatus`, `sourceId`. This is the **only** shape that may enter a packet.
- `KnowledgeCandidateReference` — `status: 'candidate' | 'queued_for_review'`, carries
  `riskFlags`. **Structurally distinct** — a candidate cannot be passed where an approved
  reference is required without a type error.
- `KnowledgeLifecycleStatus` (full): `candidate | queued_for_review | approved | active |
  rejected | superseded | archived`. Only `approved`/`active` are admissible downstream.

### 4.2 In-packet shape (`context-packets.ts`)

- `ApprovedKnowledgeContextItem.status: ApprovedKnowledgeStatus` = `'active'` (literal).
- `ApprovedKnowledgeContextItem.governanceStatus: KnowledgeGovernanceStatus` =
  `'approved' | 'approval_not_required'`.
- `SourceTraceability` (`sourceId`, `sourceType`, optional `title`/`capturedAt`/`reviewedAt`)
  ties every approved item back to its source — the registry's provenance record.

### 4.3 Runtime-level enforcement (already on disk)

- **Context Manager** (`contextManager.ts`):
  - `approvedKnowledgeFromReferences()` admits only `kind === 'approved_knowledge'` **and**
    `status === 'approved'`;
  - `excludedReferencesFor()` converts every `candidate` / `review_only` reference into a
    `ContextExclusion` (`candidate_not_approved` / `not_review_workflow`);
  - the retrieval audit hard-asserts `candidateKnowledgeIncluded: false` and
    `candidateKnowledgeExcluded: true` (both in `contextManager.ts` and `validation.ts`);
  - `authorizeCandidateKnowledge` is rejected as `candidate_authorization_not_active`.
- **P4.2 query contract** (`approvedKnowledgeQueryContract.ts`): a result carrying any
  non-approved/active status in `references` fails with `candidate_in_result`; candidates
  are counted in `metadata.candidateExcludedCount` and summarized in `excluded[]`, never
  returned.

The split is therefore defended twice — by types and by runtime validators — before P4.4
adds the adapter.

## 5. No-Direct-Store-Leak Verification

### 5.1 Routes do not reach the runtime knowledge/context layer

A search of `server/src/routes/**` for imports of `runtime/knowledge` or `runtime/context`
returns **zero matches**. Routes consume `domain/**` modules; the runtime knowledge/context
layer is not on the route import graph.

### 5.2 The runtime layer source is store-free

Within `server/src/runtime/**`, every match for store/Gateway import patterns
(`mongodb` / `neo4j-driver` / `chromadb` / `services/gateway` / `services/persistence` /
`tripleStackWrite` / `gatewayCall`) occurs **only inside `__tests__` files** — and those are
**governance-boundary tests that assert the absence** of such access (they hold the patterns
as scan regexes, not as imports). The non-test runtime source —
`contextManager.ts`, `knowledgeCore.ts`, `agentRuntime.ts`,
`michaelRuntimeContextFoundation.ts`, and the orchestration modules — contains **no**
store or Gateway import.

This is not a new assertion: an existing test family already enforces it, including
`runtime/__tests__/runtimeBoundarySkeleton.test.ts`, the orchestration
`s24…s333…GovernanceBoundary` suites, and `context/__tests__/contextManager.test.ts:262`
(which asserts the agent-runtime source matches no store pattern). P4.4 inherits and must
not weaken these guards.

### 5.3 Where store access legitimately lives

Direct persistence/Gateway access is confined to the sanctioned tiers:

- `server/src/services/**` — `gateway.ts`, `tripleStack.ts`, `tieredWrite.ts`,
  `persistence/neo4j/**`, `chromaCollections.ts`, `projectionOutbox.ts`.
- `server/src/domain/**` — domain modules that call the service tier.
- `server/src/workers/**` — e.g. `vmDeliveryWorker.ts`.

None of these is in the Phase 4 allowed-files set, and the P4.4 adapter calls none of them —
it calls only the injected `KnowledgeCoreBoundaryPort`.

## 6. Findings

1. **Single sanctioned input.** `KnowledgeCoreBoundaryPort.listApprovedKnowledge(scope)` is
   the one and only approved-knowledge surface the P4.4 adapter may consume.
2. **Candidate path is out of scope.** `listCandidateKnowledgeForReview` is for a future
   human-review workflow; it must never feed packet assembly.
3. **Split is doubly enforced** — type-level (distinct `KnowledgeReference` vs.
   `KnowledgeCandidateReference`) and runtime-level (Context Manager + P4.2 validators).
4. **No direct-store leak exists today** — routes don't import the runtime knowledge/context
   layer; the runtime source is store-free; store access is confined to services/domain/
   workers; existing governance tests enforce this.
5. **Provenance is contracted** — `SourceTraceability` + `KnowledgeId`/`SourceId` brands
   give every approved item a registry-traceable origin the adapter can carry into the
   packet's `retrievalAudit`.

## 7. Implications for P4.4 (Context Manager Retrieval Adapter)

- Depend on the **injected** `KnowledgeCoreBoundaryPort`; never construct it with a store.
- Call **only** `listApprovedKnowledge`; never `listCandidateKnowledgeForReview`.
- Map approved references into the `ContextReference` shape
  (`kind: 'approved_knowledge'`, `status: 'approved'`) that `buildContextPacket()` accepts,
  validating against the P4.2 contract.
- Preserve the no-store-import property so the existing governance-boundary tests stay green;
  add an adapter-specific boundary test asserting the same.
- Fail closed: empty/unavailable/timeout ⇒ degraded, empty-approved-knowledge packet.

## 8. Open Notes (not blockers)

- **No live knowledge corpus is wired yet.** The registry today is the *contract*, not a
  populated store — `listApprovedKnowledge` has no implementation. P4.4 builds the adapter
  against the boundary; the service-owned implementation that actually reads approved
  knowledge from persistence is a separate, separately-approved slice and is **not**
  authorized here.
- **Language-aware selection and freshness/deprecation** (P4.6, P4.7) are downstream; this
  audit only confirms the contract carries `language`/`translationStatus` and
  `SourceTraceability` timestamps to support them later.

## 9. Non-Approval Statement

This audit approves nothing. No retrieval, route, persistence, LLM, voice, or `.com`
exposure is authorized. The Knowledge Core boundary remains unwired; the Context Manager
remains the sole packet assembler.

## Gates Run and Results

Audit/documentation-only slice. `pnpm typecheck` to be run read-only before commit; result
recorded in the commit and PR. No production code, test, route, UI, `.com`, persistence
adapter, or Gateway fallback modified.
