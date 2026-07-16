# ACR-0030 — Neo4j Orphan and Duplicate Traversals

## Momentum Creation System V2

Status: Approved

Priority: P2-136 — Neo4j graph traversals for orphan and duplicate detection

Type: Read-only graph integrity observation + Kevin-only consistency evidence

Risk: Medium

Approval: Approved by Kevin L. Gardner on 2026-07-16

Target Version: v1.2

---

## Purpose

Add a governed, bounded, read-only Neo4j topology observer that detects
mechanically provable orphan and duplicate graph evidence without repairing,
deleting, merging, or reinterpreting graph state.

This item extends the existing Kevin-only consistency report. It does not add
a second consistency surface, infer business truth from graph shape, or make
Neo4j canonical over Mongo. Mongo remains canonical application state; Neo4j
remains the relationship projection and must be inspected as such.

## Existing authority and implementation gap

- P1-36 already exposes four bounded orphan queries on the Kevin-only
  Consistency page: prospects without inviters, invite tokens without targets,
  Steve discoveries without BA owners, and CRM records without BA owners.
- P1-40 catalogs Neo4j labels, relationships, and planned constraints, but the
  catalog does not execute topology integrity traversals.
- Cross-store reconciliation detects sampled Mongo-to-Neo4j projection gaps;
  it does not detect duplicate graph identities, parallel duplicate edges,
  missing required graph anchors outside its sampled specs, or ambiguous
  required cardinality.
- P2-137 separately owns sponsor-immutability graph semantics. P2-138
  separately owns pool-positioning graph semantics. P2-136 must not absorb or
  pre-decide either task.

A content-free read-only observation of the dedicated MCS Neo4j stack on
2026-07-14 found:

- 2,527 nodes and 18,057 relationships;
- zero duplicate identity groups and zero missing identity properties across
  12 canonical labels;
- zero duplicate parallel-edge groups;
- zero findings across eight structural orphan traversals; and
- zero graph mutations.

The observed graph is clean for the sampled structural contracts. That clean
snapshot does not replace an ongoing, fail-closed observer.

## Recommended decision bundle

### 1. One catalog-driven read-only observer

Create one static traversal catalog in the server domain layer. Every spec has
a stable key, category, severity, node/relationship boundary, exact Cypher,
identity field, limit, and human-readable explanation. Query text is defined
in code; no label, relationship type, property name, or Cypher fragment comes
from an HTTP request.

### 2. Mechanically provable finding classes

Version 1 reports only:

- `missing_identity`: a cataloged node lacks its required canonical identity;
- `duplicate_identity`: multiple nodes carry the same non-null canonical
  identity for one cataloged label;
- `missing_required_anchor`: a node lacks the exact required relationship and
  endpoint label named by a structural traversal spec;
- `ambiguous_required_anchor`: a node has more than the allowed number of the
  exact required relationship/endpoint pair; and
- `duplicate_parallel_edge`: multiple same-type relationships connect the
  same two node identities.

Neo4j cannot retain a relationship whose endpoint node does not exist, so the
observer does not invent a "dangling endpoint" class.

### 3. Bounded, content-free evidence

Each traversal returns an exact aggregate count plus no more than 25 sampled
identity hashes. Results expose stable spec keys, finding class, severity,
counts, scan status, and SHA-256 fingerprints. They never return node
properties beyond the cataloged identity, source content, prompts, contact
details, invite tokens, phone/email values, or arbitrary graph payloads.

### 4. Fail closed and distinguish observation quality

The aggregate status is `clear | findings | degraded | truncated`.

- `clear` requires every cataloged traversal to execute and reconcile its
  aggregate count with its bounded sample contract.
- A query error, malformed result, duplicate spec key, missing identity
  contract, or incomplete traversal produces `degraded`, never `clear`.
- A result whose sample bound is exceeded is explicitly `truncated` while its
  exact aggregate count remains visible.
- One failed traversal does not erase successful evidence from other specs.

### 5. Extend the existing Kevin-only consistency report

Add an additive `graphIntegrity` block to
`GET /api/admin/consistency/report` and the existing `/consistency` page. Show
overall graph status, nodes/relationships observed, per-class totals, traversal
coverage, bounded content-free fingerprints, degraded reasons, and the
explicit `report_only` repair policy.

No new public, prospect, BA, agent, or mutation route is added.

### 6. Preserve authority boundaries

- Mongo stays canonical; graph findings are projection/integrity evidence.
- No automatic repair, merge, delete, relationship creation, constraint apply,
  outbox enqueue, alert message, email, SMS, or external communication occurs.
- No LLM, embedding, fuzzy match, or semantic judgment declares an orphan or
  duplicate.
- P2-137 retains sponsor immutability verification.
- P2-138 retains pool positioning verification.
- Creating Neo4j constraints or indexes remains a separate explicit apply
  decision; this ACR authorizes definitions and read-only observation only.

## Proposed traversal scope

Identity checks cover the already cataloged canonical identities for:

- `TeamMagnificentMember`, `TmagProspect`, `TmagInviteToken`,
  `TmagSteveDiscovery`, `TmagProspectCrmRecord`, `TmagContentVideo`,
  `TmagVmBulkLead`, `TmagVmCampaign`, `TmagVmLeadOwner`, `TmagKnowledge`,
  `TmagLearningCandidate`, and `TmagOutcome`.

Structural orphan checks begin with the four existing P1-36 traversals and add
resource-version ownership, knowledge-chunk source/version ownership, VM queue
job target ownership, and VM delivery-event target ownership. Additional specs
may be added only when existing writers prove the relationship mandatory and
the spec remains outside P2-137/P2-138.

## Acceptance criteria

- Static catalog validation rejects duplicate keys, unsafe dynamic Cypher, and
  missing identity/relationship contracts.
- Pure projection code classifies clean, missing identity, duplicate identity,
  missing anchor, ambiguous anchor, duplicate edge, degraded, and truncated
  evidence deterministically.
- Every traversal is bounded and returns content-free evidence.
- A clean aggregate is impossible when any traversal fails or is incomplete.
- The existing admin consistency endpoint remains Kevin-only and report-only.
- Repeated scans perform zero Mongo, Neo4j, or Chroma writes and zero external
  communication.
- Sponsor and pool semantics remain absent from P2-136 tests and findings.
- Focused/full tests, typecheck, build, generated catalogs, route access,
  automated UI evidence, and a dedicated-stack read-only observation pass.

## Rollback

Remove the additive traversal catalog, graph-integrity observer, response block,
and admin panel. Because the workflow is read-only, rollback requires no graph
repair, migration, constraint removal, or projection rebuild.

## Approval requested

Kevin L. Gardner approved the recommended ACR-0030 bundle on 2026-07-16,
authorizing implementation and local/read-only verification on
`codex/p2-136-neo4j-orphan-duplicate`.

Approval does not authorize a live graph mutation, constraint/index apply,
automatic repair, sponsor/pool semantic expansion, or external communication.

## Fallback visual verification

On 2026-07-16 the production `ConsistencyPage` component passed fallback visual
QA at desktop, tablet, mobile, small-mobile, and 200% reflow using deterministic,
read-only API fixtures matching the dedicated-stack observation. The report-only
policy, 2,527-node and 18,057-relationship topology counts, 41/41 coverage, zero
findings, zero degraded traversals, absence of repair/apply/delete/merge controls,
and zero browser console errors were verified. Evidence is stored in
`engineering/audits/p2-136-visual-qa/`.

The trusted in-app route browser remained unavailable, so trusted route QA is not
represented as passed. This fallback evidence does not itself authorize merge,
graph mutation, repair, constraint/index apply, or any expansion of approved
scope.

## Fallback visual acceptance and merge authority

On 2026-07-16 Kevin L. Gardner explicitly accepted the P2-136 fallback visual
evidence and authorized PR #342 to merge.

This acceptance resolves only the unavailable trusted-route visual gate and the
merge gate for the reviewed implementation. It does not authorize graph
mutation, repair, constraint/index apply, sponsor/pool semantic expansion, or
external communication.

## Structured record

```json
{
  "acr_id": "ACR-0030",
  "title": "Neo4j Orphan and Duplicate Traversals",
  "status": "approved",
  "risk_level": "medium",
  "change_type": "read_only_graph_integrity_observer",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "Mongo canonical state",
      "Neo4j relationship projection",
      "human repair authority",
      "content-free evidence",
      "sponsor immutability reserved for P2-137",
      "pool positioning reserved for P2-138",
      "no automatic remediation"
    ]
  },
  "affected": {
    "documents": [
      "PLATFORM_AUDIT_PRIORITY_TASKLIST.md",
      "organization/ACR-REGISTER.md"
    ],
    "schemas": [
      "additive admin graph integrity response contract"
    ],
    "surfaces": [
      "Kevin-only admin Consistency Report"
    ],
    "agents": []
  },
  "review": {
    "reviewers": [
      "Kevin L. Gardner",
      "Persistence/Graph/QA"
    ],
    "decision": "approved_by_kevin_2026_07_16"
  },
  "implementation": {
    "branch": "codex/p2-136-neo4j-orphan-duplicate",
    "append_only_required": true,
    "live_mutation_authorized": false
  },
  "verification_baseline": {
    "nodes": 2527,
    "relationships": 18057,
    "duplicate_identity_groups": 0,
    "missing_identity_nodes": 0,
    "duplicate_parallel_edge_groups": 0,
    "structural_orphan_findings": 0,
    "persistent_mutations": 0
  },
  "version": {
    "from": "four ad hoc bounded graph-orphan queries",
    "to": "catalog-driven orphan and duplicate topology observer v1",
    "supersedes": null,
    "rollback_to": "four ad hoc bounded graph-orphan queries"
  },
  "decision_ledger_ref": null,
  "created_at": "2026-07-14",
  "updated_at": "2026-07-16"
}
```
