# ACR-0010 — Memory Context Compiler Contract

## Momentum Creation System V2

Status: Proposed

Priority: v1.2 — Memory Context Compiler / Steve Context Bridge

Type: Shared Runtime Contract + Agent Context Diagnostics

Risk: Medium (additive shared contract; no persistence authorized in this slice)

Approval: Pending Kevin review

---

## Purpose

Create the first governed contract for the Memory Context Compiler: the shape that combines the three memory functions of the app's separate stores into context an agent can operate from.

Kevin's July 6 discovery established the need to compare:

- MongoDB canonical memory/state/container data;
- Neo4j relationship/edge/graph data;
- ChromaDB semantic meaning/vector recall;
- the Context Packet that compiles relevant knowledge for the agent.

This ACR names the compiled memory context shape without turning it into a persistent record yet. Steve's saved interview is the first proof source for the shape.

---

## Trigger

This change triggers `MOMENTUM_ACR_SYSTEM.md` §1 because it introduces an additive shared runtime contract:

- new shared type contract;
- new compiler boundary between Mongo, Neo4j, Chroma, Knowledge Base, and Context Manager;
- future persistence implications if compiled shapes or comparison reports become stored audit records.

No persistence pattern is changed by this ACR proposal.

---

## Proposed Contract

Shared runtime file:

- `packages/shared/src/runtime/memory-context-compiler-schema.ts`

Schema version:

- `memory_context_compiler.schema.v1`

The contract includes:

- compiler identity;
- subject identity;
- compiled shape status;
- persistence status, defaulting to `not_persisted`;
- store contributions for Mongo, Neo4j, and Chroma;
- context ingredients;
- graph questions;
- graph edge verbs;
- warnings;
- optional comparison report fields for Steve/profile coverage.

The three store functions are:

- MongoDB → canonical memory;
- Neo4j → relationship graph;
- ChromaDB → semantic meaning.

The graph layer is verb-centered. It asks traversal questions such as:

- what created this memory?
- what does this memory mean?
- what does this memory support?
- what context does this memory require?
- what agent action does this memory guide?
- what should this memory retrieve?
- what does this memory protect or exclude?
- what does this memory hand off to?

The initial graph verbs are:

- captures;
- expresses;
- supports;
- requires_context;
- guides;
- retrieves;
- grounds;
- protects;
- excludes;
- hands_off_to;
- relates_to;
- supersedes;
- contradicts.

The comparison signals are:

- primary why;
- success vision;
- learning style;
- communication preferences;
- support needs;
- launch recommendations;
- training recommendations;
- Michael handoff;
- discovery answers.

---

## Boundaries

This contract does not:

- score, rank, classify, predict, or qualify a BA;
- authorize persistence of comparison reports;
- authorize prospect-facing output;
- allow Steve to query MongoDB, Neo4j, ChromaDB, GraphRAG, or gateway tools directly;
- replace the Context Packet contract;
- replace the Knowledge Base schema.

The contract describes the compiled memory context shape an agent can live in. The Steve comparison report is one diagnostic use of that shape.

---

## Implementation Notes

Initial implementation is pure and non-persistent:

- `server/src/domain/steveContextComparison.ts`
- `server/src/domain/__tests__/steveContextComparison.test.ts`

Current comparison method:

- lexical overlap only.

Future approved methods may add:

- semantic similarity;
- graph relationship;
- manual review.

Persistence requires a later approval/update that names:

- Mongo collection;
- Neo4j nodes/relationships;
- Chroma collection, if any;
- retention policy;
- privacy/sponsor visibility;
- read-back verification.

---

## Structured Record

```json
{
  "acr_id": "ACR-0010",
  "title": "Memory Context Compiler Contract",
  "status": "proposed",
  "risk_level": "medium",
  "change_type": "contract",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "Steve non-scoring boundary",
      "Context Manager packet boundary",
      "Knowledge Base approved-only retrieval",
      "Mongo canonical memory",
      "Neo4j relationship graph",
      "Chroma semantic meaning",
      "no persistence authorized"
    ]
  },
  "affected": {
    "documents": [
      "docs/agent-briefs/steve-context-knowledge-base-next-agent-brief.md"
    ],
    "schemas": [
      "packages/shared/src/runtime/memory-context-compiler-schema.ts"
    ],
    "surfaces": [],
    "agents": ["steve_success"]
  },
  "reconciliation_ref": "docs/agent-briefs/steve-context-knowledge-base-next-agent-brief.md",
  "review": { "reviewers": ["Kevin L. Gardner", "Schema/Governance"], "decision": "", "conditions": [] },
  "approval": { "approved_by": "", "approved_at": null },
  "implementation": { "branch": "", "commits": [], "append_only_respected": true },
  "verification": { "typecheck": false, "flows": [], "persistence_readback": false },
  "release": { "gates_passed": [], "released_at": null },
  "version": { "from": "none", "to": "memory_context_compiler.schema.v1", "supersedes": null, "rollback_to": "remove additive contract before persistence" },
  "decision_ledger_ref": "",
  "created_at": "2026-07-06",
  "updated_at": "2026-07-06"
}
```
