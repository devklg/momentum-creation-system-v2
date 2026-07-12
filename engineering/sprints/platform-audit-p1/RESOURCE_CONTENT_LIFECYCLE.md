# Resource and Content Lifecycle

**Authority:** P1-82 platform normalization contract. The executable source is `packages/shared/src/resource-lifecycle.ts`.

This lifecycle governs editorial publication state. It does not replace authority decisions, compliance outcomes, translation state, ingestion/indexing state, GraphRAG readiness, or knowledge-evolution job state.

## States

| State | Meaning | Ordinary-user/retrieval eligible |
|---|---|---|
| `draft` | An editable version being authored. | No |
| `review` | Submitted for human review; changes may return it to draft. | No |
| `approved` | Human-approved and immutable, but not yet published. | No |
| `active` | Published version eligible for its approved audience and retrieval surfaces. | Yes |
| `archived` | Terminal historical version removed from live use. | No |
| `superseded` | Terminal historical version replaced by a named successor. | No |

## Legal transitions

`draft -> review -> approved -> active`

- `review -> draft` through `request_changes`.
- `approved -> archived` with a reason.
- `active -> archived` with a reason.
- `active -> superseded` with a reason and `replacementResourceVersionId`.
- `archived` and `superseded` are terminal for that version. Revision creates a new draft/version.

Approval requires a human actor, approval evidence, and separation between author and approver. Activation requires readiness evidence; P1-84 will bind that evidence to Chroma and Neo4j readiness. Only `active` is retrieval-eligible.

## Existing-system mappings

- Product Gallery `active: true` maps to `active`. `active: false` is provisionally `archived` but explicitly ambiguous until catalog migration reviews whether it meant draft, hidden, or retired.
- Master-content latest-version selection currently makes the newest saved override immediately live. P1-83 must introduce catalog lifecycle fields before P1-84 enforces activation.
- Knowledge `candidate`/`queued_for_review`, review outcomes, source authority, translation, ingestion, and evolution statuses remain separate axes. Rejected is a review outcome, not silently coerced to archived.
- Resource Center historical vocabulary maps `drafted -> draft`, `reviewed -> review`, `published -> active`, `deprecated/replaced -> archived/superseded`.

P1-82 defines the contract only. It does not mutate existing records or silently reinterpret ambiguous inactive content.

## Unified catalog schema (P1-83)

`packages/shared/src/resource-catalog.ts` defines one immutable catalog row per resource version. Lifecycle, authority, language, audience, retrieval readiness, lineage, content location, digest, and migration ambiguity are separate fields. The declarative persistence contract uses Mongo `tmag_resource_catalog`, Neo4j `TmagResource`/`TmagResourceVersion`, and Chroma `mcs_resource_catalog`. Existing source collections remain authoritative; the catalog is a projection and does not silently migrate them.
