# P2-141 Steve Success Profile privacy review

P2-141 traced Steve private data from browser conversation capture through the
canonical Success Profile, sponsor/admin reads, Context Manager retrieval,
MongoDB, Neo4j, and ChromaDB.

## Result

Safe technical exposure reductions are implemented on this branch. Kevin
approved ACR-0031 on 2026-07-16: the BA owns review/export/correction,
withdrawal, deletion, and field-specific sponsor consent; sponsors default to
bounded derived training support; new internal Steve records store no provider
call identifier or audio URL; and semantic content remains limited to the
ACR-0011 `why_statement`.

The item remains partial until the approved fail-closed defaults are verified
and Kevin separately authorizes merge. Historical reconciliation remains a
separate preview/apply operation.

No production record was read, changed, deleted, re-indexed, or backfilled.
No external communication or provider call occurred.

## Exposure matrix

| Consumer/store | Required data | Current authorized visibility | P2-141 hardening |
| --- | --- | --- | --- |
| BA self | Own completed answers and Success Profile | Authenticated self | Private/no-store response; content-free errors |
| Direct sponsor | No raw profile by default | Authenticated direct sponsor only | Raw route fails closed unless approved field consent is implemented; private/no-store response; unrelated/not-found states are opaque |
| Michael sponsor support | Bounded derived training-support card | Authenticated direct sponsor only | Minimal Mongo projection; default projection excludes why, vision, obstacles, and handoff summary; unrelated/not-found states are opaque |
| Kevin admin | Oversight summary | Kevin-only | Minimal Mongo projections, including content-free agent-event reads; bridge cannot be materialized |
| Steve worker | Completion acknowledgement | Worker secret | Minimal receipt; no artifact echo; bounded arrays |
| Context Manager | Governed interview-support knowledge query | Internal Steve runtime | Fixed governed query; no BA turn text |
| Retrieval cache | Query identity | Process-local | SHA-256 query digest instead of plaintext |
| MongoDB | Canonical artifact | Server persistence | BA-owned canonical record; new records store null provider/audio fields; historical values are not exposed or silently purged |
| Neo4j | Discovery relationship/lineage | Internal relationship projection | New writes omit call identifier and audio URL |
| ChromaDB | Triple-stack completion marker | No active consumer found | New documents are content-free; metadata omits call/sponsor and is retrieval-ineligible |
| `.com` | None | Prohibited | Static boundary remains: no Steve profile route or content |

## Preserved boundaries

- Sponsor identity remains server-derived and immutable.
- The BA self-read and direct-sponsor read remain authenticated.
- Sponsor-only routes do not disclose BA existence or profile-completion state
  to unrelated authenticated BAs.
- No scoring, ranking, prediction, classification, or qualification is added.
- ACR-0011 recruiting-cycle why replay is not changed.
- Existing production records are not scrubbed by this implementation.

## ACR-0031 implementation boundary

- The exact retention/store and principal/field matrices are ratified in
  `organization/ACR-0031-steve-profile-retention-and-visibility.md`.
- BA rights and field-consent surfaces are governed follow-on implementation;
  the current branch fails closed rather than exposing unconsented fields.
- Post-completion in-flight event-body compaction must be implemented for new
  records before it can be represented as runtime-complete.
- Provider inventory/terms review remains required before production
  activation.
- Any historical cleanup still requires report-only preview plus separate
  Kevin apply authority.

## Verification

The focused suite covers private response headers, minimal worker receipts,
governed Context Manager queries, minimized Neo4j/Chroma projections, minimal
admin Mongo projections, fail-closed raw sponsor access, bounded default
sponsor support, null provider/audio fields on new records, and blocked
semantic bridge materialization.

Current verification: 2,251 server tests passed / 19 skipped; repo typecheck
passed; production build passed; 250 routes produced zero access findings;
the `.com` scan covered 34 files with zero violations; generated catalogs and
freshness are current. The ACR decision record was read back from MongoDB,
Neo4j, and ChromaDB.
