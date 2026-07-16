# P2-141 Steve Success Profile privacy review

P2-141 traced Steve private data from browser conversation capture through the
canonical Success Profile, sponsor/admin reads, Context Manager retrieval,
MongoDB, Neo4j, and ChromaDB.

## Result

Kevin approved ACR-0031 and separately authorized PR #353, which merged on
2026-07-16. That baseline hardened the private read and storage boundaries.

Draft PR #355 implements the approved current-record controls that do not
require historical mutation:

- authenticated BA self-export of the current transcript, answers, Success
  Profile, and privacy state;
- one-way personalization withdrawal that revokes all sponsor sharing while
  preserving the BA self-visible copy and stopping tailored Launch guidance
  and recruiting-cycle why replay;
- four independent sponsor-consent grants, off by default and bound to the
  current direct sponsor, exact field, policy version, and timestamps;
- exact conditional Michael reads for only the fields currently consented;
- content-free consent, withdrawal, and export audit facts;
- rollback when a privacy projection or its required audit append fails; and
- create-only ordinary ingest so a repeated worker completion cannot replace
  private content;
- post-completion compaction of new-record in-flight Steve event bodies only
  after the canonical Success Profile writes and reads back, preserving
  content-free event facts and an idempotent retry path; and
- BA-confirmed correction of one exact current transcript, answer, profile, or
  recommendation value with optimistic revision control, content-free audit
  evidence, projection read-back, and rollback on failure.

The item remains partial. BA-requested private-content deletion, the
deletion/onboarding-gate and tombstone behavior, provider activation evidence,
and historical reconciliation remain separate visible work.

No production record was read, changed, deleted, re-indexed, or backfilled.
No external communication or provider call occurred.

## Exposure matrix

| Consumer/store | Required data | Current authorized visibility | P2-141 hardening |
| --- | --- | --- | --- |
| BA self | Own completed answers and Success Profile | Authenticated self | Private/no-store response; content-free errors |
| Direct sponsor | No raw profile by default | Authenticated direct sponsor only | Legacy raw route permanently fails closed; unrelated/not-found states are opaque |
| Michael sponsor support | Bounded derived training-support card plus optional exact consented fields | Authenticated current direct sponsor only | Base Mongo projection excludes why, vision, obstacles, and handoff summary; a second exact projection reads only currently consented fields |
| Kevin admin | Oversight summary | Kevin-only | Minimal Mongo projections, including content-free agent-event reads; bridge cannot be materialized |
| Steve worker | Completion acknowledgement | Worker secret | Minimal receipt; no artifact echo; bounded arrays |
| Context Manager | Governed interview-support knowledge query | Internal Steve runtime | Fixed governed query; no BA turn text |
| Retrieval cache | Query identity | Process-local | SHA-256 query digest instead of plaintext |
| MongoDB | Canonical artifact and embedded privacy state | Server persistence | BA-owned canonical record; create-only ordinary ingest; new records store null provider/audio fields; historical values are not exposed or silently purged |
| Neo4j | Discovery relationship/lineage and content-free privacy state | Internal relationship projection | New writes omit call identifier, audio URL, and unconditional sponsor-visibility edges |
| ChromaDB | Triple-stack completion marker and content-free privacy state | No active content consumer found | Documents remain content-free and retrieval-ineligible; privacy projection preserves completion metadata |
| `.com` | None | Prohibited | Static boundary remains: no Steve profile route or content |

## Preserved boundaries

- Sponsor identity remains server-derived and immutable.
- The BA self-read and direct-sponsor read remain authenticated.
- Stored consent is invalidated at read time when the current direct sponsor
  differs from the sponsor bound to the grant.
- Sponsor-only routes do not disclose BA existence or profile-completion state
  to unrelated authenticated BAs.
- No scoring, ranking, prediction, classification, or qualification is added.
- ACR-0011 recruiting-cycle why replay scope is not expanded. A BA-confirmed
  correction to the primary why replaces that already-authorized active
  projection and reads it back.
- Existing production records are not scrubbed by this implementation.

## ACR-0031 implementation boundary

- The exact retention/store and principal/field matrices are ratified in
  `organization/ACR-0031-steve-profile-retention-and-visibility.md`.
- Self-export, one-way withdrawal, and field-specific sponsor consent are
  implemented for current records.
- BA-confirmed correction is implemented for current records. One exact value
  is replaced only after explicit confirmation and a current revision match;
  identity, timestamps, signatures, provider fields, and internal resource
  links remain immutable. Ordinary re-ingest remains create-only and returns a
  conflict rather than silently replacing private content.
- Private-content deletion remains open because the approved ACR does not yet
  resolve whether deletion preserves onboarding completion or reopens the Steve
  gate; the minimal tombstone/read-back flow must be designed with that answer.
- New-record post-completion event-body compaction is implemented. It removes
  the entire private payload from only that BA's Steve conversation events
  after canonical artifact read-back, retains content-free compaction facts,
  fails closed on residual payloads, and does not sweep historical rows.
- The source-backed provider inventory and current official-terms review is
  complete in
  `engineering/audits/p2-141-steve-provider-inventory/README.md`. It found that
  the ACR-0031 provider gate is not satisfied. Draft PR #355 now fails browser
  voice closed to on-device recognition and local playback with a typed
  fallback and privacy notice. Anthropic organization-level ZDR remains
  unverified, and managed-store/VPS backup settings still need account
  evidence.
- Any historical cleanup still requires report-only preview plus separate
  Kevin apply authority.

## Verification

The focused suite additionally covers legacy consent defaults, sponsor-change
invalidation, exact consented-field projection, content-free audit payloads,
withdrawal, export minimization, projection/audit rollback, create-only ingest,
route opacity, exact confirmed correction, stale-revision rejection, private
audit minimization, correction rollback, and the `.team` privacy controls.

Current verification: 2,285 server tests passed / 19 skipped; 73 team tests
passed; repo typecheck passed; production build passed; 255 routes produced
zero access findings; the `.com` scan covered 34 files with zero violations;
generated catalogs and freshness are current. Responsive fallback component
visual QA passed at desktop, tablet, 390px, 360px, and 200% reflow with zero
horizontal overflow and zero browser exceptions. The trusted in-app browser
runtime was unavailable, so trusted-route QA is not represented as passed. The
ACR decision and PR #353 merge state were verified. The provider inventory and
official-terms review was source-only and made no live provider or production
call.

Additional fallback actual-component voice-privacy QA passed at desktop,
tablet, 390px, 360px, and 200% reflow with the typed fallback and privacy notice
visible, zero horizontal overflow, and zero browser exceptions. It did not
request microphone permission or invoke speech.
