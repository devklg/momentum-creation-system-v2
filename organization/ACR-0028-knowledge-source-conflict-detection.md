# ACR-0028 — Knowledge Source Conflict Detection Governance

## Momentum Creation System V2

Status: Proposed

Priority: P2-134 — Knowledge source conflict detection

Type: Knowledge Core contract + additive schema + activation gate

Risk: High

Approval: Pending Kevin L. Gardner

Target Version: v1.2

---

## Purpose

Detect evidence that a new knowledge source may duplicate, violate the immutable
identity of, or contradict existing approved knowledge before the new source can
become active guidance. Detection supports human review; it does not decide truth.

## Reconciliation

Existing ratified authority already requires:

- preservation of every source and its origin evidence;
- a review-only `Knowledge contradiction alert` derived source;
- `contradictory` and `duplicate` Knowledge Quality flags;
- human review when a contradiction is detected; and
- no organizational activation while an unresolved contradiction blocks it.

The repository does not yet define the conflict unit, evidence threshold, source
precedence, persistence contract, API result, or resolution authority. Semantic
similarity is explicitly not approval and cannot prove that one source is true.
The current Kevin/admin intake writes active source and chunk projections before
any cross-source comparison, so a post-write detector would not fail closed.

## Recommended decision bundle

Approve the following as one bounded P2-134 contract:

1. **Evidence classifications.** The detector returns one of:
   - `clear`: no blocking evidence found after a complete comparison;
   - `exact_duplicate`: the normalized content digest matches compatible source
     lineage; this is duplication evidence, not contradiction;
   - `integrity_conflict`: the same governed source identity and version carries
     a different content digest;
   - `potential_source_conflict`: two sources share an explicit governed claim key
     and carry incompatible structured values;
   - `insufficient_evidence`: similarity, missing lineage, cross-language material
     without approved translation lineage, or another condition cannot support a
     deterministic classification;
   - `detector_unavailable`: the comparison was incomplete, truncated, malformed,
     or a dependency failed.
2. **No semantic truth inference.** Vector/graph/lexical similarity may nominate a
   pair for review but may never by itself produce `potential_source_conflict`,
   choose a winner, rank authority, or change lifecycle state.
3. **Comparison scope.** Compare only records in the same tenant, team, domain,
   and language. Cross-language comparison requires approved translation lineage.
   A potential contradiction requires an explicit governed claim key; title, tags,
   recency, or similarity alone are insufficient.
4. **Pre-write fail-closed gate.** Run detection before the first source, chunk,
   GraphRAG, Chroma, Neo4j, or Resource Catalog write. `integrity_conflict`,
   `potential_source_conflict`, `insufficient_evidence`, `detector_unavailable`,
   or an incomplete scan blocks activation and all new-source projection writes.
   `exact_duplicate` returns the existing source reference without creating a
   second active source.
5. **Review-only durable finding.** Persist an append-only, content-minimized
   finding only after the comparison completes. The finding contains opaque source
   ids, versions, SHA-256 digests, governed claim key, scope, reason codes, status,
   timestamps, and decision reference. It never contains raw content, chunks,
   embeddings, prompts, private notes, or Success Profile details.
6. **Human authority.** Findings begin `open`. Only a durable active decision by
   Kevin may resolve or dismiss a finding or authorize a source to proceed. Agent,
   system, similarity, trust, and recency evidence cannot supply that authority.
7. **No remediation in P2-134.** Detection never edits an existing source, changes
   retrieval, archives, supersedes, deletes, merges content, or creates a
   `CONTRADICTS`/`SUPERSEDES` graph edge. P2-135 owns correction and supersession.
8. **Admin contract.** The Kevin-only intake returns bounded reason codes. A blocked
   conflict returns HTTP `409`; detector failure/incomplete evidence returns `503`.
   A content-free admin status projection may show aggregate open counts. No raw
   conflicting text is returned by the API or written to logs.
9. **Activation/readiness integration.** Knowledge Evolution and retrieval readiness
   must require conflict-clear evidence for a new source. They consume a verified
   gate; they do not perform detection or adjudication.
10. **Operational safety.** No production mutation, index creation, backfill, or
    retroactive classification is authorized by approving this ACR. Implementation
    and local/disposable verification come first; any production backfill is a
    separately reviewed action.

## Reserved alternatives

Kevin may change any of these choices before approval:

- retain exact duplicates as candidate records instead of returning the existing id;
- make all potential conflicts warning-only instead of activation-blocking;
- authorize a reviewer role other than Kevin;
- permit unstructured semantic contradiction classification;
- change the HTTP/status visibility contract; or
- include already-active knowledge remediation in this item rather than P2-135.

Each alternative changes human authority, privacy, or active retrieval behavior and
must be explicit; agents must not select one silently.

## Constitutional review

Conflict level: **Kevin approval required**.

The recommendation preserves human authority, operates on sourced evidence, treats
similarity as evidence rather than truth, prevents hidden policy, and keeps existing
knowledge intact. It increases clarity without making an agent the arbiter of what
Momentum knows.

## Acceptance gates after approval

- Pure classification tests distinguish duplicate, integrity conflict, governed
  potential conflict, insufficient evidence, and detector failure deterministically.
- Intake tests prove detection runs before the first write and every blocked outcome
  produces zero source/chunk/graph/vector/catalog writes and zero cache invalidation.
- Scope/language/lineage tests prove no cross-tenant, cross-team, or unapproved
  cross-language comparison leaks data.
- Privacy tests prove findings, API responses, logs, and diagnostics contain no raw
  source/chunk/private content.
- Authority tests require exact active Kevin decision readback for resolution.
- No test or runtime path auto-supersedes, archives, ranks, or chooses a source.
- Focused/full server tests, repo typecheck/build, generated catalogs, compliance,
  freshness, diff hygiene, and GitHub CI pass.
- Any new persistent finding is read back from Mongo, Neo4j, and Chroma in a local or
  disposable environment before verification is claimed.

## Rollback

Disable/remove the pre-write detector and its additive report/read contracts. No
existing source is mutated by detection, so rollback restores the current intake
path without reconstructing knowledge. Append-only findings remain audit history.

## Structured record

```json
{
  "acr_id": "ACR-0028",
  "title": "Knowledge Source Conflict Detection Governance",
  "status": "proposed",
  "risk_level": "high",
  "change_type": "knowledge_contract_schema_and_activation_gate",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "human authority",
      "approved knowledge activation",
      "source provenance",
      "privacy and minimal exposure",
      "Mongo canonical authority",
      "candidate versus active separation",
      "no automatic supersession"
    ]
  },
  "affected": {
    "documents": [
      "PLATFORM_AUDIT_PRIORITY_TASKLIST.md",
      "runtime/KNOWLEDGE_CORE_RUNTIME.md",
      "runtime/KNOWLEDGE_INGESTION_PROTOCOL.md"
    ],
    "schemas": [
      "additive knowledge source conflict finding and conflict-clear evidence contracts"
    ],
    "surfaces": [
      "Kevin-only admin Knowledge intake and content-free status"
    ],
    "agents": []
  },
  "review": {
    "reviewers": [
      "Kevin L. Gardner",
      "Constitution/Governance",
      "Knowledge Core",
      "Privacy/QA"
    ],
    "decision": "pending",
    "conditions": [
      "Detection is evidence, never truth adjudication.",
      "P2-134 never auto-resolves or supersedes knowledge.",
      "Approval authorizes no production backfill or mutation."
    ]
  },
  "implementation": {
    "branch": "codex/p2-134-knowledge-conflict",
    "commits": [],
    "append_only_respected": null
  },
  "verification": {
    "typecheck": null,
    "flows": [],
    "persistence_readback": null
  },
  "release": {
    "gates_passed": [],
    "gates_pending": [
      "kevin_policy_approval",
      "implementation",
      "automated_verification",
      "local_disposable_persistence_readback",
      "kevin_merge"
    ],
    "released_at": null
  },
  "version": {
    "from": "ratified contradiction concepts without an implementation contract",
    "to": "content-minimized potential source conflict detection v1",
    "supersedes": null,
    "rollback_to": "current approved knowledge intake without conflict detection"
  },
  "decision_ledger_ref": null,
  "created_at": "2026-07-14",
  "updated_at": "2026-07-14"
}
```

## Approval gate

Implementation remains blocked until Kevin approves the recommended ACR-0028
bundle or supplies changes. Approval authorizes implementation and local/disposable
verification only; it does not authorize production backfill or conflict resolution.
