# ACR-0031 — Steve Profile Retention and Visibility

## Momentum Creation System V2

Status: Approved — implementation verification in progress

Ratified: Kevin L. Gardner, 2026-07-16

Priority: P2-141 — Steve profile privacy and minimal exposure

Change type: Contract

Risk: High

Target Version: v1.2

Decision owner: Kevin L. Gardner

Proposer: Codex

---

## 1. Decision

The Steve discovery record is private BA-owned support context.

The BA controls review, export, correction, withdrawal, and deletion of the
private content. A minimal content-free audit fact remains after correction or
deletion. The direct sponsor receives a bounded derived training-support
projection by default, not the raw transcript, raw answers, full Success
Profile, provider identifier, or audio. Optional sponsor sharing is off by
default, field-specific, revocable, and limited to the approved profile fields
in this ACR.

Internal browser voice stores transcript text, not raw audio. New Steve records
must not retain a provider call identifier or audio URL. Semantic memory is
limited to the ACR-0011 `why_statement` projection unless Kevin separately
approves another field and retrieval principal.

No historical purge, redaction, event compaction, graph-property removal,
Chroma re-index, backup rewrite, or provider-side deletion is authorized by
this approval. Each historical operation requires a report-only preview and
separate Kevin apply authority.

## 2. Retention and store matrix

Retention is event-based so the platform does not invent a legal retention
term that does not exist. A future legal or operational maximum may shorten
these rules through a new approved ACR; it may not silently extend them.

| Artifact | Canonical location | Active retention rule | Correction/deletion rule |
| --- | --- | --- | --- |
| In-flight conversation turns | Mongo `tmag_agent_steve_events` | Retain only until the completed canonical artifact is written and read back successfully. | After verified completion, remove private turn bodies and retain only a content-free event fact. Existing historical rows require separate preview/apply authority. |
| Final transcript | Mongo `tmag_steve_success_interview` | Retain while the BA keeps the Steve record active. BA self only. | Correct in place after BA confirmation without retaining superseded private text. Delete on BA request. |
| Structured answers | Mongo `tmag_steve_success_interview` | Retain while the BA keeps the Steve record active. BA self only. | Same as final transcript. |
| Success Profile | Mongo `tmag_steve_success_interview` | Retain while the BA keeps the Steve record active. BA self; bounded derived fields may feed approved support projections. | Same as final transcript. |
| Provider call identifier | Mongo legacy field | New internal-browser records store `null`. Existing values are never returned to BA, sponsor, admin summary, Neo4j, or Chroma. | Historical removal requires separate preview/apply authority. |
| Audio URL / raw audio | Provider/storage legacy field | Raw audio recording is off by default and is not stored for internal Steve browser sessions. New records store `null`; no sponsor access exists. | Any legacy provider or stored pointer deletion requires inventory, preview, and separate apply authority. |
| Steve relationship | Neo4j | Relationship/lineage only: BA had a Steve discovery and its completion time. No transcript, answers, profile text, call identifier, or audio URL. | BA private-content deletion removes private-content projections; a content-free deletion/audit relationship may remain. Historical repair requires separate preview/apply authority. |
| Steve completion marker | Chroma `mcs_steve_success_interview` | Content-free and `retrievalEligible:false`; it is not a source of profile content. | Remove with read-back when the BA deletes the private record. Historical reconciliation requires separate preview/apply authority. |
| Recruiting-cycle `why_statement` | Chroma/launch coaching projection under ACR-0011 | Retain only while the BA keeps that approved coaching memory active. Retrieval is limited to the BA's support flow and Michael's governed why-replay. | Correction replaces the active statement. BA deletion removes the vector with read-back. Changing scope requires an ACR-0011 amendment. |
| Backup copies | Governed platform backup rotation | No Steve-specific archive or extended copy. Private content inherits the ordinary encrypted backup rotation only. | Deletion tombstones must be replayed before any restored backup can become active; expired backup copies are not resurrected or re-exported. |
| Audit evidence | Mongo audit/decision ledger and governed mirrors | Retain indefinitely as content-free governance evidence. | Never retain transcript text, answer text, profile text, audio, provider identifiers, or deleted values. |

## 3. Principal and field visibility matrix

`Allowed` means the field may be returned only after authentication,
authorization, and private/no-store response headers. `Consent` means the BA
must deliberately enable that exact field group. `Never` means consent cannot
make the field visible through the sponsor surface.

| Field or projection | BA self | Direct sponsor default | Direct sponsor with BA consent | Kevin admin oversight | Chroma/GraphRAG |
| --- | --- | --- | --- | --- | --- |
| Downline identity and completion time | Allowed | Allowed | Allowed | Bounded operational identity | Metadata only where required |
| Final transcript | Allowed | Never | Never | Never in summary/bridge | Never |
| Raw answers | Allowed | Never | Never | Never in summary/bridge | Never |
| Full Success Profile | Allowed | Never | Never | Never in summary/bridge | Never |
| Derived learning-style guidance | Allowed | Allowed | Allowed | Aggregate/status only | Never |
| Derived communication guidance | Allowed | Allowed | Allowed | Aggregate/status only | Never |
| Derived support-area/help-style guidance | Allowed | Allowed | Allowed | Aggregate/status only | Never |
| Safe training recommendations | Allowed | Allowed | Allowed | Aggregate/status only | Never |
| Primary why statement | Allowed | Hidden | Consent: `why_statement` | Never in summary/bridge | ACR-0011 owner/Michael scope only |
| Success vision statement | Allowed | Hidden | Consent: `success_vision` | Never in summary/bridge | Never |
| Named potential obstacles | Allowed | Hidden | Consent: `support_obstacles` | Never in summary/bridge | Never |
| Michael handoff summary | Allowed | Hidden | Consent: `michael_handoff_summary` | Never in summary/bridge | Never |
| Free-text notes | Allowed | Never | Never | Never in summary/bridge | Never |
| Provider call identifier | Hidden | Never | Never | Count/status only if operationally required | Never |
| Audio URL or raw audio | Hidden/not stored | Never | Never | Never | Never |

The sponsor is not a Chroma retrieval principal for Steve private content.

## 4. BA rights

### 4.1 Review

The authenticated BA may review the current transcript, answers, and Success
Profile. Responses are private/no-store and must not expose provider internals.

### 4.2 Export

The authenticated BA may export one structured copy of the current private
record. The export includes current transcript, answers, and Success Profile;
it excludes provider identifiers, internal event rows, retrieval audit,
embeddings, hashes, and other people's records.

### 4.3 Correction

The BA may correct their current transcript, answers, profile fields, and
sharing choices. A correction replaces the active private value after explicit
confirmation. The audit fact records artifact id, changed field paths, actor,
policy version, and time, but not the former or replacement private text.

### 4.4 Withdrawal

The BA may withdraw the Steve record from further personalization and sponsor
sharing without immediately deleting their self-visible copy. Withdrawal turns
all sponsor consent off and prevents new semantic projections.

### 4.5 Private-content deletion

The BA may delete the transcript, answers, Success Profile, consent state, and
approved semantic projections. The platform retains only a minimal tombstone:
artifact id, BA id, request/confirmation time, actor, policy version, affected
store names, and read-back result. The tombstone contains no private content.

An administrator cannot initiate private-content deletion as a convenience
action. Kevin/admin may execute or troubleshoot a BA-requested deletion and the
audit must identify that it was performed on the BA's request.

## 5. Sponsor consent contract

Consent is:

- off by default;
- separate for `why_statement`, `success_vision`, `support_obstacles`, and
  `michael_handoff_summary`;
- never bundled with onboarding, training access, or account use;
- revocable by the BA at any time;
- scoped only to the current direct sponsor;
- invalidated when sponsor identity changes;
- versioned with policy version, granted/revoked time, and field key;
- unable to expose transcript, raw answers, full profile, notes, provider
  identifiers, audio URL, or raw audio.

Approved user-facing grant copy:

> Share this field with my current direct sponsor so they can support my
> training. I can turn sharing off later. This does not share my transcript,
> raw answers, audio, or the rest of my Success Profile.

Approved revocation copy:

> Stop sharing this field with my direct sponsor. The sponsor view will remove
> it; a content-free audit fact will remain.

## 6. Audio and provider boundary

- Microphone access occurs only after BA action and visible browser permission.
- Internal Steve browser sessions do not start provider recording.
- New canonical Steve records store `callSid:null` and `audioUrl:null`.
- Audio is not a sponsor-consent option.
- The LLM may receive the minimum transcript needed for the active conversation
  and extraction request; prompts and operational logs must not retain private
  content beyond their governed purpose.
- Production activation requires a named inventory of the LLM, browser speech
  recognition path, storage systems, subprocessors, applicable data-use terms,
  and deletion capabilities. A provider with incompatible retention or
  training-on-customer-data terms remains disabled.

## 7. Semantic-memory boundary

The only content-bearing Steve semantic projection authorized by this ACR is
the ACR-0011 `why_statement` used for the BA's own support flow and Michael's
governed why-replay.

Transcript text, raw answers, full profiles, success vision, obstacles,
communication preferences, notes, recommendations, handoff summaries, call
identifiers, and audio data do not enter Chroma or GraphRAG under ACR-0031.
Content-free completion markers remain retrieval-ineligible. Admin bridge
drafts remain non-materializable.

## 8. Production reconciliation

Before any historical change:

1. produce a report-only inventory by store and artifact class;
2. show exact match criteria, counts, and proposed action;
3. prove the operation is BA-scoped and does not touch unrelated data;
4. define rollback or explain why deletion is intentionally irreversible;
5. obtain Kevin's separate apply authority;
6. apply through the governed store-specific path;
7. read back every affected store and record a content-free result.

ACR-0031 approval alone is not apply authority for historical data.

## 9. Constitutional and governance review

- Future-Development Test: pass. The policy preserves human ownership,
  least privilege, support without judgment, and reversible consent.
- No scoring, ranking, classification, qualification, prediction, or truth
  judgment is introduced.
- No duplicate canonical private record is introduced.
- Mongo remains canonical; Neo4j remains relationship-only; Chroma remains
  non-authoritative semantic support.
- Sponsor immutability is preserved.
- `.com` remains prohibited from receiving Steve data.
- Kevin retains merge and historical-apply authority.

## 10. Acceptance criteria

- Every artifact/store has an explicit retention event and deletion behavior.
- Direct-sponsor visibility is explicit field by field.
- BA review, export, correction, withdrawal, and deletion behavior is explicit.
- Audio is off by default, not stored for new internal-browser records, and
  never sponsor-visible.
- Semantic-memory fields and retrieval principals are explicit.
- New sponsor defaults expose only bounded derived training support.
- Historical reconciliation requires preview plus separate apply authority.
- Focused privacy tests, server tests, typecheck, build, catalogs, route-access,
  freshness, and `.com` compliance are green before merge authority is sought.

## 11. Structured record

```json
{
  "acr_id": "ACR-0031",
  "title": "Steve Profile Retention and Visibility",
  "status": "approved",
  "risk_level": "high",
  "change_type": "contract",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "human ownership and consent",
      "least privilege and default deny",
      "no scoring, ranking, classification, qualification, or prediction",
      "Mongo canonical / Neo4j relationship / Chroma semantic roles",
      "sponsor immutability",
      "prospect-facing prohibition",
      "Kevin-only merge and historical apply authority"
    ]
  },
  "affected": {
    "documents": [
      "organization/ACR-0031-steve-profile-retention-and-visibility.md",
      "organization/ACR-REGISTER.md",
      "engineering/audits/p2-141-steve-profile-privacy/README.md",
      "PLATFORM_AUDIT_PRIORITY_TASKLIST.md"
    ],
    "schemas": [
      "tmag_steve_success_interview",
      "tmag_agent_steve_events",
      "mcs_steve_success_interview",
      "McsSteveDiscoveryArtifact",
      "McsSteveProfileCard",
      "McsMichaelTrainingSupportCard"
    ],
    "surfaces": [
      "BA self Steve profile",
      "direct sponsor Success Profile route",
      "Michael training-support projection",
      "Kevin-only agent oversight"
    ],
    "agents": [
      "steve_success",
      "michael_magnificent"
    ]
  },
  "reconciliation_ref": "engineering/audits/p2-141-steve-profile-privacy/README.md",
  "review": {
    "reviewers": [
      "Codex privacy review",
      "independent privacy reviewer",
      "Constitution and Governance reviewer"
    ],
    "decision": "approve with fail-closed implementation conditions",
    "conditions": [
      "raw sponsor route remains unavailable without implemented field consent",
      "new records store no provider call identifier or audio URL",
      "historical reconciliation requires separate preview and apply authority",
      "provider inventory and terms review precedes production activation"
    ]
  },
  "approval": {
    "approved_by": "Kevin L. Gardner",
    "approved_at": "2026-07-16"
  },
  "implementation": {
    "branch": "codex/p2-141-steve-privacy",
    "follow_on_branch": "codex/p2-141-privacy-rights",
    "follow_on_pr": 355,
    "commits": [
      "7b748ad3",
      "a251fbfc"
    ],
    "append_only_respected": true,
    "live_mutation_authorized": false,
    "historical_apply_authorized": false,
    "external_communication_authorized": false
  },
  "verification": {
    "typecheck": true,
    "server_tests": "2274 passed / 19 skipped",
    "team_tests": "71 passed",
    "production_build": true,
    "route_access": "254 routes / 0 findings",
    "com_compliance": "34 files / 0 violations",
    "catalogs_current": true,
    "flows": [
      "private/no-store self and sponsor responses",
      "opaque sponsor authorization failures",
      "minimal Mongo projections",
      "raw sponsor route fails closed without field consent",
      "default sponsor projection excludes unconsented private fields",
      "field-specific current-sponsor consent controls",
      "BA self-export and one-way withdrawal",
      "withdrawal blocks tailored Launch guidance and why replay",
      "create-only ordinary ingest",
      "new records store null provider/audio fields",
      "content-free Neo4j and Chroma projections",
      "blocked admin bridge materialization",
      "no Steve content on .com"
    ],
    "persistence_readback": true
  },
  "release": {
    "gates_passed": [
      "review",
      "approval",
      "baseline_merge"
    ],
    "released_at": null
  },
  "version": {
    "from": "raw sponsor profile/audio contract with unset private-data lifecycle",
    "to": "BA-owned private record with derived sponsor support, field consent, no new audio/provider identifier storage, and governed deletion",
    "supersedes": null,
    "rollback_to": "a251fbfc"
  },
  "decision_ledger_ref": "dec_acr_0031_steve_profile_privacy",
  "created_at": "2026-07-16",
  "updated_at": "2026-07-16"
}
```

## 12. Approval and merge boundary

Kevin approved ACR-0031 and separately authorized PR #353, which merged on
2026-07-16 as the fail-closed privacy baseline. That authority did not mutate
production data, authorize a historical purge, or activate an external
provider. Follow-on privacy-rights work remains subject to its own verification
and merge authority, while every historical apply remains separately gated.
