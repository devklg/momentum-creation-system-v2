# ACR-0026 — Context Retrieval Cache and Readiness Batching

## Momentum Creation System V2

Status: Verified

Priority: P2-132 — Context Manager / GraphRAG scale hardening

Type: Runtime retrieval policy + additive diagnostics contract

Risk: Medium

Approval: Kevin L. Gardner — 2026-07-14

Target Version: v1.2

---

## Purpose

Reduce repeated Context Manager and GraphRAG canary reads without making a
cache authoritative, weakening approved-only retrieval, or serving one BA's
context to another.

The current Steve and Michael live foundations create a stored approved-
knowledge provider for each turn. Each semantic lookup reaches the embedder and
Chroma even when an identical request is already running or was completed
moments earlier. GraphRAG readiness verifies one record at a time: Mongo first,
then separate outbox, Neo4j, and Chroma reads for every eligible id.

Focused baseline verification on 2026-07-13 passed 51 Context Manager,
retrieval-canary, approved-knowledge, GraphRAG, and readiness tests.

## Trigger

This change requires an ACR because it changes runtime retrieval semantics and
adds cache/batch observability to an approved-knowledge boundary. No persistent
cache, schema migration, new collection, or activation flag is proposed.

## Recommended bundle

1. **Cache only approved retrieval references.** Never cache assembled Context
   Packets, packet ids, timestamps, BA/session context, degraded results, empty
   results, provider errors, or authorization failures.
2. **Use a bounded five-second in-process cache.** Maximum 128 successful,
   non-empty entries. The exact key includes normalized query, requested `k`,
   language-relevant inputs, and the complete tenant/team/BA scope. LRU eviction
   is deterministic. Returned values are copied so callers cannot mutate cache
   state.
3. **Single-flight identical concurrent reads.** Concurrent requests with the
   same exact key share one in-flight store promise. Different queries, limits,
   or scopes never batch together. A rejected or empty promise is removed
   immediately and is never cached.
4. **Invalidate on governed knowledge mutation.** Successful approved source or
   chunk writes clear the local retrieval cache and advance its generation.
   Tests expose a reset seam; runtime agents receive no cache-control authority.
   The short TTL remains the cross-process safety bound.
5. **Add bounded GraphRAG readiness batching.** A batch accepts at most 50 unique
   ids, preserves caller order, reads Mongo/outbox/Neo4j in set-oriented calls,
   groups Chroma `get` calls by exact domain/language collection, and returns an
   independent `ready | blocked | degraded` result for every id. Missing,
   ambiguous, mismatched, unresolved, or unavailable projections fail closed.
   The existing single-id verifier delegates to the batch path.
6. **Expose content-free performance diagnostics.** Report cache hits, misses,
   coalesced requests, evictions, current size, in-flight count, invalidations,
   and GraphRAG batch/store-call counts. Do not record query text, knowledge
   summaries, BA content, or packet content.

## Boundaries

- Mongo remains canonical; cache entries are temporary acceleration only.
- Candidate, review-only, inactive, stale, superseded, or scope-mismatched
  knowledge remains structurally excluded.
- Context Manager remains the sole Context Packet assembler.
- Steve, Michael, and Ivory receive no direct store or cache access.
- No `.com`, Telnyx, email, prompt mission, or agent-permission change.
- No `GRAPHRAG_PERSISTENCE_ENABLED` or Context Manager flag is changed.
- No persistent cache, new collection, index creation, or production mutation.
- A cache hit never substitutes for GraphRAG cross-store readiness verification.

## Acceptance criteria

- Identical concurrent approved searches perform one Chroma/embedder call.
- A successful non-empty result hits within five seconds and refreshes after
  expiry; empty/degraded/error results always retry.
- Query, `k`, language, tenant, team, or BA differences cannot collide.
- A governed approved-knowledge write invalidates cached retrievals.
- Every Context Packet still gets a unique id, timestamp, scope, and trace.
- A 50-id readiness batch uses set-oriented reads and returns exact per-id
  reasons in stable input order.
- Batch failure is isolated and fail-closed; it cannot turn a blocked record
  into a ready reference.
- Existing retrieval canaries, full server tests, repo typecheck, build, and
  generated gates pass.

## Rollback

Remove the cache/single-flight wrapper and make the single-id GraphRAG verifier
use its prior direct reads. Because no persistent state or index is introduced,
rollback requires no data migration or cleanup.

## Structured record

```json
{
  "acr_id": "ACR-0026",
  "title": "Context Retrieval Cache and Readiness Batching",
  "status": "verified",
  "risk_level": "medium",
  "change_type": "contract",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "approved-only retrieval",
      "BA scope isolation",
      "Mongo canonical authority",
      "Context Manager sole assembly",
      "GraphRAG readiness fail-closed",
      "no persistent cache",
      "no activation flag change"
    ]
  },
  "affected": {
    "documents": [
      "PLATFORM_AUDIT_PRIORITY_TASKLIST.md"
    ],
    "schemas": [
      "additive content-free admin diagnostics"
    ],
    "surfaces": [
      "server runtime",
      "admin knowledge status"
    ],
    "agents": [
      "steve_success",
      "michael_magnificent"
    ]
  },
  "reconciliation_ref": "organization/ACR-0013-knowledge-evolution-retrieval-canary.md",
  "review": {
    "reviewers": [
      "Kevin L. Gardner",
      "Runtime/QA"
    ],
    "decision": "approved",
    "conditions": []
  },
  "approval": {
    "approved_by": "Kevin L. Gardner",
    "approved_at": "2026-07-14"
  },
  "implementation": {
    "branch": "codex/p2-132-context-caching",
    "commits": [
      "c67d8cc7",
      "c396a85b"
    ],
    "append_only_respected": true
  },
  "verification": {
    "typecheck": true,
    "flows": [
      "approved-reference cache hit, expiry, LRU, copy, scope, language, and limit isolation",
      "identical-request single-flight and governed-write generation invalidation",
      "ordered GraphRAG batch reads, grouped Chroma reads, and per-id fail-closed results",
      "content-free admin retrieval diagnostics",
      "admin suite: 45 passed",
      "full server suite: 2152 passed, 19 skipped"
    ],
    "persistence_readback": true
  },
  "release": {
    "gates_passed": [
      "focused_vitest",
      "server_full_vitest",
      "repo_typecheck",
      "repo_build",
      "schema_drift_catalogs",
      "api_route_map",
      "route_access_matrix",
      "documentation_maps",
      "com_prospect_compliance",
      "documentation_freshness"
    ],
    "gates_overridden": [
      {
        "gate": "trusted_visual_qa",
        "decision_ledger_ref": "dec_acr_0026_visual_gate_override_2026_07_14",
        "note": "Kevin accepted the unavailable trusted browser gate; it is not represented as passed."
      }
    ],
    "gates_pending": [],
    "released_at": "2026-07-14"
  },
  "version": {
    "from": "direct per-request retrieval",
    "to": "bounded cache plus readiness batch v1",
    "supersedes": null,
    "rollback_to": "direct per-request retrieval"
  },
  "decision_ledger_ref": "dec_acr_0026_context_retrieval_cache_batching_approval_2026_07_14",
  "created_at": "2026-07-13",
  "updated_at": "2026-07-14"
}
```

## Approval record

Kevin L. Gardner approved the recommended ACR-0026 bundle on 2026-07-14.
The durable decision record is
`dec_acr_0026_context_retrieval_cache_batching_approval_2026_07_14`, verified
in the dedicated MCS MongoDB, Neo4j, and ChromaDB stores before implementation.

## Implementation record

The approved bundle is implemented on `codex/p2-132-context-caching` in
`c67d8cc7` and `c396a85b`. The runtime caches only copied, successful, non-empty approved
references for five seconds; exact normalized query, limit, language, and
tenant/team/BA scope determine identity. Governed knowledge writes advance the
cache generation. GraphRAG readiness now supports stable, set-oriented batches
of at most 50 unique ids, isolates collection failures, and fails closed when a
bounded outbox result is incomplete. Admin diagnostics contain counters only.

## Verification-gate override

The trusted in-app browser bridge was unavailable, so trusted visual QA was not
performed and is not represented as passed. Kevin L. Gardner explicitly
accepted that unavailable gate and authorized PR #334 to merge on 2026-07-14.
The audited override is
`dec_acr_0026_visual_gate_override_2026_07_14`, verified in the dedicated MCS
MongoDB, Neo4j, and ChromaDB stores. Automated admin component rendering and all
repository and GitHub CI gates passed.
