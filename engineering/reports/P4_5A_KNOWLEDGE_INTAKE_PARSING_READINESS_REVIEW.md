# P4.5A — Knowledge Intake, Parsing & Indexing — Readiness Review (Agent A)

## Momentum Creation System V2

Slice: **P4.5A (bridge slice)** — Knowledge Intake, Parsing, and Indexing
Phase: 4 (Knowledge Retrieval)
Branch: `feature/phase-04-p4.5a-knowledge-intake-parsing`
Base commit: `a39b07c` (`feature/phase-04-p4.5-context-packet-enrichment-tests` HEAD, P4.5 merged)
Mode: **Readiness review only — no implementation in Agent A.**

---

## 1. Current P4.1–P4.5 state (complete & merged)

| Slice | Deliverable | On-disk evidence |
|---|---|---|
| P4.1 | Context Manager Retrieval Charter | `engineering/reports/SPRINT_004_P4_1_CONTEXT_MANAGER_RETRIEVAL_CHARTER.md` |
| P4.2 | Approved Knowledge Query Contract | `packages/shared/src/runtime/knowledge-query.ts` (types) + `server/src/runtime/context/approvedKnowledgeQueryContract.ts` (validators) |
| P4.3 | Knowledge Source Registry Audit | `engineering/reports/SPRINT_004_P4_3_KNOWLEDGE_SOURCE_REGISTRY_AUDIT.md` |
| P4.4 | Context Manager Retrieval Adapter | `server/src/runtime/context/contextManagerRetrievalAdapter.ts` |
| P4.5 | Context Packet Enrichment Tests | `server/src/runtime/context/__tests__/contextPacketEnrichment.test.ts` + `engineering/reports/SPRINT_004_P4_5_CONTEXT_PACKET_ENRICHMENT_TESTS.md` |

All five are present and wired through `server/src/runtime/context/index.ts`.

## 2. Current approved-knowledge query path

The store-agnostic contract (`approved_knowledge_query.v1`) is the boundary between "what the Context Manager wants" and "what the Knowledge Core returns":

- **Request** (`ApprovedKnowledgeQueryRequest`): TM `RuntimeRequestScope`, `objective`, `domains`, `language`, optional `allowLanguageFallback` / `maxResults`.
- **Result** (`ApprovedKnowledgeQueryResult`): `references` carry **only** approved/active `KnowledgeReference`s; candidate/review-only items are **counted in `excluded` + metadata, never returned**; `status: 'degraded'` is the fail-closed signal.
- Validators (`validateApprovedKnowledgeQueryRequest` / `validateApprovedKnowledgeQueryResult` / `assertApprovedKnowledgeQueryResult`) enforce these invariants at runtime. They import **no** store/Gateway/adapter client.

## 3. Current Context Manager retrieval adapter path

`createContextManagerRetrievalAdapter(provider)` (P4.4) is the **sole sanctioned runtime edge** that obtains approved knowledge:

- Depends ONLY on an injected `ApprovedKnowledgeProvider = Pick<KnowledgeCoreBoundaryPort, 'listApprovedKnowledge'>` — candidate access is structurally unreachable.
- Filters defensively to approved/active → requested domain → same language (fallback deferred to P4.6), applies `maxResults`, and returns a validated `approved_knowledge_query.v1` result.
- Fail-closed: provider throw / empty / language miss → `degraded`, empty-approved result (never an error leak, never a candidate substitution, never a store fallback).
- `toContextReferences(result)` maps approved references → `ContextReference[]` (`kind: 'approved_knowledge'`, `status: 'approved'`) for `buildContextPacket()`. A degraded result maps to `[]`.

## 4. Current Context Packet enrichment behavior

`buildContextPacket(input)` (in `server/src/runtime/context/contextManager.ts`) is the **sole `context_packet.v1` assembler**:

- Consumes caller-supplied `knowledgeReferences: ContextReference[]` (and graph/vector/event refs) — it does **not** retrieve.
- Derives `approvedKnowledge` from `kind === 'approved_knowledge' && status === 'approved'` references; candidate/review-only refs become `exclusions`.
- Stamps a full `retrievalAudit` (included knowledge ids, included items, excluded source ids, `candidateKnowledgeIncluded: false`, `candidateKnowledgeExcluded: true`).
- Degraded packets carry an explicit `degraded` block with `safeFallbackInstruction` + `missingSections`.
- The P4.5 enrichment test proves source→reference→packet traceability and the degraded fail-closed path end-to-end.

## 5. Knowledge Core boundary (the consume-side seam, still inert)

`server/src/runtime/knowledge/knowledgeCore.ts` defines `KnowledgeCoreBoundaryPort` (`listApprovedKnowledge` / `listCandidateKnowledgeForReview`) as a `skeleton_only`, `behaviorEnabled: false` boundary. **No implementation exists** — there is no producer of `KnowledgeReference`s. Per P4.3 audit §8, the corpus is not wired.

## 6. What is missing for intake / parsing / indexing

The retrieval half exists; the **producer half does not**. Specifically missing:

1. A **raw-source preservation** model — no `RawKnowledgeSource` type/representation of "the original knowledge as Kevin added it."
2. A **deterministic parser** — nothing normalizes text, strips unsafe markup, or detects sections.
3. A **chunker** — nothing splits parsed content into retrieval units.
4. **Chunk metadata + scoping** — no `topicTags` / `agentScopes` / `surfaceScopes` / `language` / `domain` carried onto retrieval units.
5. A **runtime-eligibility predicate** — nothing decides which chunks may be retrieved (active / eligible / scoped / language-safe / not deprecated|archived|rejected|parse-failed).
6. An **index record** model — no `KnowledgeIndexRecord` (`searchableText` + `retrievalKey`).
7. A **mapping** from an eligible chunk → the `KnowledgeReference` shape the P4.4 adapter already returns. This is the join that makes Kevin-added knowledge actually reachable by the existing retrieval path.
8. **Traceability** back to raw source from document → chunk → index record.

## 7. Exact safe scope for this slice

**In scope (additive + inert):**
- Shared **types** for `RawKnowledgeSource`, `ParsedKnowledgeDocument`, `KnowledgeChunk`, `KnowledgeIndexRecord` (new file `packages/shared/src/runtime/knowledge-intake.ts`; one appended export line in `runtime/index.ts`).
- Server **pure utilities**: deterministic parser, chunker, eligibility predicate, index-record builder, and a `chunk → KnowledgeReference` mapper — under `server/src/runtime/knowledge/intake/`.
- Unit tests for each utility + an end-to-end test proving the mapped references flow through the **existing** P4.4 adapter and P4.5 packet assembly.
- A static governance-boundary test mirroring `s24GovernanceBoundary.test.ts`.

**Out of scope (hard stops):** Mongo/Neo4j/Chroma/GridFS writes; Gateway calls; approval-workflow code; `/api/runtime/*`; routes/UI; `.com` changes; LLM/dynamic generation/summarization; voice; Phase 7 learning; outcome-based learning; agent-approved knowledge. Aligns with ACR-0008 (implementation is **Phase 8**; this slice ships the **intake/parsing/indexing contract + minimal inert utilities** only) and the standing MCS V2 DB write-freeze (no writes to MCS V2 stores until approved schemas).

## 8. Stop conditions

Stop and surface to Kevin if any of these become necessary to proceed:
- A persistence write (Mongo/Neo4j/Chroma/GridFS) is required to make a utility useful.
- A new route, mount, or `/api/runtime/*` surface is required.
- An LLM/summarization/translation call is required to detect sections or chunk.
- The mapping cannot produce a valid `KnowledgeReference` without changing P4.2/P4.4/P4.5 behavior (those must stay green).
- An append-only shared file (`packages/shared/src/types.ts`, `server/src/index.ts`) would need a non-append edit.

**Verdict: READY.** The retrieval path is stable and well-typed; the intake/parsing/indexing producer can be added additively and proven against it without touching persistence or the existing slices.
