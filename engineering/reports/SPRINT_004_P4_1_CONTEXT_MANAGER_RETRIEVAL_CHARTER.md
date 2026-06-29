# Sprint 4 P4.1 Context Manager Retrieval Charter

- Sprint: Sprint 4 — Knowledge Retrieval and Context Enrichment
- Slice: P4.1 Context Manager Retrieval Charter — the governing charter for Phase 4 retrieval, founded on the verified inert Context Manager assembler and Knowledge Core boundary
- Status: PLANNING / GOVERNANCE / DOCUMENTATION ONLY (no production code, tests, routes, UI, or `.com` modified; no LLM/DB/Gateway access; gate run read-only)
- Architecture version: v1.0 frozen
- Date: 2026-06-29
- Owner: Phase 4 worktree — Claude Code (Instance 1)
- Base ref: `origin/main` @ Base SHA `dec82101b73c579714cf7f885e3459137f295afd`
- Branch: `feature/phase-04-p4.1-context-manager-retrieval-charter`
- Dependency gate: Phase 3 closeout present — `engineering/reports/SPRINT_003_PHASE_3_RUNTIME_ACTIVATION_CLOSEOUT.md`. Phase 4 is unblocked.

> This is a planning/governance charter. It approves nothing for activation, mounts
> nothing, persists nothing, retrieves nothing, and changes no production code. It
> defines the boundary, contracts, and sequence by which knowledge retrieval and
> context enrichment *may* be added to the Context Manager — entirely inside the
> standing prohibitions. It is explicitly NON-AUTHORIZING beyond the documentation
> spine it founds (P4.1 → P4.4).

## 1. Executive Result

**PASS — charter established.**

Phase 4 adds *knowledge retrieval and context enrichment* on top of a verified inert
foundation: the Context Manager (`server/src/runtime/context/contextManager.ts`,
`buildContextPacket()`) is the **sole** `context_packet.v1` assembler, and the Knowledge
Core boundary (`server/src/runtime/knowledge/knowledgeCore.ts`,
`KnowledgeCoreBoundaryPort`) is the only sanctioned approved-knowledge access surface.
Today both are `skeleton_only` / `service_boundary_only`: the assembler builds packets
from **caller-supplied references only** (no active retrieval), and the Knowledge Core
port has no implementation, no database, no adapter, and no Gateway import.

Phase 4 closes exactly one gap: it lets the Context Manager *request approved knowledge
through the Knowledge Core boundary* and fold it into the packet it already assembles —
without granting any agent or route direct store access, without admitting candidate or
review-only knowledge, and without changing who assembles the packet.

This charter is the first link of the Phase 4 spine. It authorizes the documentation
sequence P4.1 → P4.4 (charter → query contract → registry audit → retrieval adapter) and
frames every downstream slice. It does not authorize live retrieval, persistence, LLM
calls, dynamic generation, routes, or `.com` exposure.

## 2. The Foundation Phase 4 Builds On

Re-confirmed on disk at Base SHA `dec8210`:

- **Context Manager — sole assembler, no active retrieval.**
  `buildContextPacket()` (`contextManager.ts`) is the only `context_packet.v1`
  producer. It already:
  - excludes candidate / review-only references by default
    (`excludedReferencesFor()` → `ContextExclusion` with reason
    `candidate_not_approved` / `not_review_workflow`);
  - hard-rejects `authorizeCandidateKnowledge` as
    `candidate_authorization_not_active`;
  - stamps `retrievalAudit.candidateKnowledgeIncluded: false` and
    `candidateKnowledgeExcluded: true` (validated by both
    `validateRetrievalAudit` in `contextManager.ts` and `validation.ts`);
  - derives `approvedKnowledge` only from references whose `kind === 'approved_knowledge'`
    **and** `status === 'approved'` (`approvedKnowledgeFromReferences()`);
  - carries `metadata.notes` including `s1.5:no_active_retrieval` — i.e. it assembles
    from references the caller already holds; it performs no retrieval of its own.
- **Knowledge Core — approved-knowledge access boundary, unimplemented.**
  `knowledgeCoreBoundary` is `status: 'skeleton_only'`, `persistenceAccess:
  'service_boundary_only'`. `KnowledgeCoreBoundaryPort` declares
  `listApprovedKnowledge(scope): Promise<readonly KnowledgeReference[]>` and
  `listCandidateKnowledgeForReview(scope): Promise<readonly KnowledgeCandidateReference[]>`.
  Its notes forbid any database/adapter/Gateway import here.
- **Shared contracts.** `KnowledgeReference` is typed to `status: 'approved' | 'active'`
  only; `KnowledgeCandidateReference` is a separate type carrying `riskFlags`. The two are
  structurally distinct — candidate knowledge cannot masquerade as approved at the type
  level. `ApprovedKnowledgeContextItem` (the in-packet shape) requires
  `governanceStatus` ∈ {`approved`, `approval_not_required`} and `status: 'active'`.
- **Michael packet port — store-free, degraded.**
  `createMichaelRuntimeContextManagerPort()`
  (`michaelRuntimeContextFoundation.ts`) is the sanctioned Michael packet path: it
  assembles an empty-approved-knowledge, candidate-excluded, `packetStatus: 'degraded'`
  packet from session identity alone, importing no store/Gateway/retrieval client. This is
  the fail-closed reference behavior Phase 4 must preserve when retrieval is unavailable.

Phase 4 changes none of these invariants. It adds a *retrieval path into the Knowledge
Core boundary* and a Context Manager adapter that consumes it — nothing more.

## 3. Phase 4 Purpose

Phase 4 — Knowledge Retrieval and Context Enrichment — exists to let the Context Manager
enrich a `context_packet.v1` with **approved knowledge it requests through the Knowledge
Core boundary**, so that (in a future, separately-approved activation) an agent's packet
can carry relevant approved teaching material instead of always being empty/degraded.

The engineering question Phase 4 answers: *"Can the Context Manager obtain approved
knowledge through a service boundary — scoped, audited, candidate-excluded,
language-aware, freshness-guarded — and fold it into the packet it already assembles,
without any agent or route ever touching a store directly?"*

It does **not** answer (and must not pre-empt) the activation question: whether, when, and
behind what route/flag this enriched packet is ever served live. That remains a separate,
separately-approved decision, exactly as in Sprint 3.

## 4. The Single Sanctioned Retrieval Flow

If retrieval is ever wired, it must drive **only** this chain:

> **Knowledge Core boundary (`listApprovedKnowledge`) → Context Manager Retrieval Adapter
> → `buildContextPacket()` → validated `context_packet.v1`.**

Concretely:

1. A caller (the orchestration turn source, via the Context Manager request port) asks the
   Context Manager for a packet for a given scope + objective + language.
2. The **Context Manager Retrieval Adapter** (P4.4) calls
   `KnowledgeCoreBoundaryPort.listApprovedKnowledge(scope)` — the only approved-knowledge
   access point — and maps the returned `KnowledgeReference[]` into the `ContextReference`
   shape (`kind: 'approved_knowledge'`, `status: 'approved'`) that `buildContextPacket()`
   already accepts.
3. `buildContextPacket()` assembles the packet exactly as today — candidate/review-only
   filtered out, audit stamped, validators run.

No alternate retrieval surface may be introduced. Agents and routes never call the
Knowledge Core port, a store, an adapter, or a Gateway client directly. The adapter is the
only new runtime edge, and it lives in the context layer.

## 5. Hard Boundaries (in force for all of Phase 4)

- **Context Manager remains the sole Context Packet assembler.** No agent, route, adapter,
  or service may assemble a `context_packet.v1`. Retrieval feeds the assembler; it does not
  become one.
- **No agent/route direct store access.** Mongo/Neo4j/Chroma/Gateway/GraphRAG access stays
  behind the Knowledge Core service boundary. The `agent_store_access_forbidden` runtime
  rule and the `prohibitedOutputs` in `buildAgentContext()` stand unchanged.
- **Approved knowledge only.** Only `KnowledgeReference` (approved/active) may enter a
  packet. `KnowledgeCandidateReference` (candidate / queued-for-review) is **excluded by
  default** and recorded as a `ContextExclusion`. No agent may approve knowledge.
- **Candidate/review-only excluded — at type and runtime.** The structural type split plus
  `excludedReferencesFor()` plus the `candidateKnowledgeExcluded: true` audit assertion are
  all preserved. `authorizeCandidateKnowledge` stays rejected.
- **Fail-closed.** If approved knowledge cannot be retrieved (boundary unavailable, scope
  empty, timeout), the packet degrades to the empty-approved-knowledge / `degraded` shape —
  exactly the Michael foundation behavior — never an error leak, never a store fallback,
  never a silent candidate substitution.
- **Team Magnificent + BA scope only.** Every retrieval is scoped to the packet's
  tenant/team/BA; no cross-team or cross-BA knowledge. The
  `team_magnificent_scope_required` guardrail stands.

## 6. Standing Prohibitions (always in force)

Carried verbatim from `REPO_STATE_PACKET.md` and the Phase 4 worktree prompt:

- No `.com` exposure.
- No `/api/runtime/*` route family.
- No unapproved persistence.
- No LLM calls.
- No dynamic generation.
- No voice/Telnyx/PSTN/call-control.
- No automatic sending/calling/scheduling/prospecting/scoring/ranking/qualification.
- No income/compensation/cycle/placement guarantees.
- No agent may approve knowledge.
- Context Manager remains sole Context Packet assembler.

Phase 4 introduces **retrieval of already-approved knowledge through a service boundary**.
That is read-only access to governed content — it is not persistence, generation, scoring,
ranking, or qualification, and it must never become any of those.

## 7. Allowed / Forbidden Files

**Allowed** (per the worktree prompt):

- `engineering/reports/P4_*`, `engineering/reports/SPRINT_004_*`
- `server/src/runtime/context/**`
- Context Manager retrieval tests
- knowledge retrieval contracts (additive shared contracts under
  `packages/shared/src/runtime/**`, append-only)

**Forbidden:**

- Direct agent/route store access (Mongo/Neo4j/Chroma/Gateway).
- Anything outside the allowed list — no routes, no UI, no `.com`, no `server/src/index.ts`
  mount changes, no persistence adapters.

Shared-file discipline: `packages/shared/src/runtime/**` and `packages/shared/src/types.ts`
are append-only — new contracts are added; existing exports are never edited or reordered.

## 8. The Phase 4 Spine (this charter authorizes P4.1 → P4.4 as documentation/contracts)

| Slice | Title | Kind | Output |
|---|---|---|---|
| **P4.1** | Context Manager Retrieval Charter | governance doc | this report |
| **P4.2** | Approved Knowledge Query Contract | additive shared contract + tests | the typed query/response contract the adapter and Knowledge Core share |
| **P4.3** | Knowledge Source Registry Audit | audit doc | inventory of approved-knowledge sources, scopes, and the candidate/approved split, verifying no direct-store leak |
| **P4.4** | Context Manager Retrieval Adapter | context-layer code + tests | the adapter that calls `listApprovedKnowledge` and feeds `buildContextPacket()`, fail-closed |

Downstream backlog (NOT authorized here; each its own separately-approved slice): P4.5
Context Packet Enrichment Tests, P4.6 Language-Aware Retrieval, P4.7 Freshness and
Deprecation Guards, P4.8 Knowledge Retrieval Observability, P4.9 Approved-Knowledge Safe
Fallback Upgrade, P4.10 Next Training Step Resolution, P4.11 Retrieval Canary, P4.12 Phase
4 Closeout.

## 9. P4.2 — Approved Knowledge Query Contract (framing)

P4.2 defines, as an **additive** shared contract, the request/response shape by which the
Context Manager asks the Knowledge Core for approved knowledge. It must:

- carry scope (tenant/team/BA), objective/domain, and language as inputs;
- return only approved/active `KnowledgeReference`s, never candidates;
- be store-agnostic (no Mongo/Neo4j/Chroma/Gateway types leak into it);
- make candidate exclusion and language fallback expressible as first-class result
  metadata so the adapter can stamp the existing `retrievalAudit` honestly.

It changes no behavior — it is a type contract plus its validator/tests. It must align with
the existing `KnowledgeReference` and `ApprovedKnowledgeContextItem` shapes so the P4.4
adapter is a pure mapping.

## 10. P4.3 — Knowledge Source Registry Audit (framing)

P4.3 is an audit, not code. It inventories: what approved-knowledge sources exist (or are
contracted to exist), how each is scoped, how the approved/active vs. candidate/queued
split is represented, and confirms that no current route or agent path reaches a store
directly. Its output is the evidence base that the P4.4 adapter has exactly one sanctioned
input (the Knowledge Core boundary) and that wiring it introduces no new store edge outside
that boundary.

## 11. P4.4 — Context Manager Retrieval Adapter (framing)

P4.4 implements the adapter described in §4, in the context layer only
(`server/src/runtime/context/**`). It:

- calls `KnowledgeCoreBoundaryPort.listApprovedKnowledge(scope)` (injected, never
  constructed with a store);
- maps approved references into `ContextReference[]` and hands them to
  `buildContextPacket()`;
- is fail-closed: on empty/unavailable/timeout it produces the degraded,
  empty-approved-knowledge packet, preserving the Michael foundation behavior;
- imports no store/Gateway/retrieval client and persists nothing;
- is covered by tests asserting: approved-only inclusion, candidate exclusion + audit,
  scope enforcement, and fail-closed degradation.

## 12. Required Gates (run per code-bearing slice)

```bash
pnpm build:shared
pnpm typecheck
pnpm build
pnpm --filter @momentum/team typecheck
pnpm --filter @momentum/server test
```

Documentation-only slices (P4.1, P4.3) run at minimum `pnpm typecheck`. If a gate cannot be
run, the slice report says so honestly.

## 13. Stop Conditions

- `LOCAL_REPO_STATE_MISMATCH` (HEAD ≠ Base SHA `dec8210`) — verified NOT triggered.
- `DIRTY_WORKTREE_BEFORE_START` — NOT triggered (only the three expected untracked
  orchestration `.md` packets were present).
- Upstream Phase 3 closeout missing — NOT triggered (closeout present).
- Any standing prohibition would be violated — STOP.
- Any git command fails — STOP and report the exact command and error.

## 14. Explicit Non-Approval Statement

This charter approves nothing for activation. Restated:

- **No live retrieval approved** — the adapter, when built (P4.4), is a context-layer
  function behind the existing inert assembler; no route serves it.
- **No route approved** — no `/api/runtime/*`, no new endpoint, no mount in
  `server/src/index.ts`.
- **No persistence approved** — retrieval is read-only access to already-approved
  knowledge; nothing is written.
- **No LLM / dynamic generation approved.**
- **No voice/Telnyx/PSTN approved.**
- **No `.com` exposure approved.**
- **No agent knowledge approval** — agents never approve, never retrieve directly.
- **No candidate/review-only inclusion approved.**

P4.1 is a planning/governance charter over a verified inert foundation. The Context Manager
remains the sole Context Packet assembler; retrieval feeds it through one sanctioned
boundary and changes nothing else.

## Gates Run and Results

Documentation-only slice. `pnpm typecheck` to be run read-only before commit; result
recorded in the commit and PR. No production code, test, route, UI, `.com`, persistence
adapter, or Gateway fallback modified.
