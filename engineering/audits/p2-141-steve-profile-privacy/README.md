# P2-141 Steve Success Profile privacy review

P2-141 traced Steve private data from browser conversation capture through the
canonical Success Profile, sponsor/admin reads, Context Manager retrieval,
MongoDB, Neo4j, and ChromaDB.

## Result

Safe technical exposure reductions are implemented on this branch. The item
remains partial because retention, deletion/correction rights, audio lifecycle,
direct-sponsor field visibility, and semantic-memory scope require Kevin's
decision in proposed ACR-0031.

No production record was read, changed, deleted, re-indexed, or backfilled.
No external communication or provider call occurred.

## Exposure matrix

| Consumer/store | Required data | Current authorized visibility | P2-141 hardening |
| --- | --- | --- | --- |
| BA self | Own completed answers and Success Profile | Authenticated self | Private/no-store response; content-free errors |
| Direct sponsor | Raw answers/profile/audio per existing wireframe | Authenticated direct sponsor only | Authorization preserved; private/no-store response |
| Michael sponsor support | Derived training-support card | Authenticated direct sponsor only | Minimal Mongo projection; private/no-store response |
| Kevin admin | Oversight summary | Kevin-only | Minimal Mongo projection; bridge cannot be materialized |
| Steve worker | Completion acknowledgement | Worker secret | Minimal receipt; no artifact echo; bounded arrays |
| Context Manager | Governed interview-support knowledge query | Internal Steve runtime | Fixed governed query; no BA turn text |
| Retrieval cache | Query identity | Process-local | SHA-256 query digest instead of plaintext |
| MongoDB | Canonical artifact | Server persistence | Canonical record preserved pending ACR-0031 |
| Neo4j | Discovery relationship/lineage | Internal relationship projection | New writes omit call identifier and audio URL |
| ChromaDB | Triple-stack completion marker | No active consumer found | New documents are content-free; metadata omits call/sponsor and is retrieval-ineligible |
| `.com` | None | Prohibited | Static boundary remains: no Steve profile route or content |

## Preserved boundaries

- Sponsor identity remains server-derived and immutable.
- The BA self-read and direct-sponsor read remain authenticated.
- No scoring, ranking, prediction, classification, or qualification is added.
- ACR-0011 recruiting-cycle why replay is not changed.
- Existing production records are not scrubbed by this implementation.

## ACR-0031 blockers

- Retention duration by artifact and store.
- Post-completion treatment of duplicated in-flight turns.
- BA export, correction, withdrawal, and deletion rights.
- Raw sponsor card versus derived/consented projection.
- Audio access and lifecycle.
- Approved semantic-memory fields and principals.
- Consent/provider terms.
- Separate preview/apply authority for any production reconciliation.

## Verification

The focused suite covers private response headers, minimal worker receipts,
governed Context Manager queries, minimized Neo4j/Chroma projections, minimal
admin Mongo projections, and blocked semantic bridge materialization. Full
server/repository gates and generated-catalog freshness must be green before
the PR is offered for review.
