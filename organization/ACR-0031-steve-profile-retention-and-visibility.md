# ACR-0031 — Steve Profile Retention and Visibility

## Momentum Creation System V2

Status: Proposed

Priority: P2-141 — Steve profile privacy and minimal exposure

Type: Private-data retention, visibility, correction, and semantic-memory policy

Risk: High

Target Version: v1.2

---

## Purpose

Set the human policy required to finish the Steve Success Profile privacy
review without inventing retention periods, deletion rights, sponsor access, or
semantic-memory authority.

P2-141 safely minimizes new technical exposure, but the canonical artifact
still intentionally contains the BA's interview transcript, answers, Success
Profile, provider call identifier, and optional audio URL. Existing design
authority also gives the direct sponsor access to the raw answer/profile/audio
card. Those product and lifecycle decisions require Kevin's explicit approval.

## Decisions requested

1. **Canonical retention**
   - Set retention for in-flight conversation events, final transcript,
     structured answers, Success Profile, call identifiers, audio URLs,
     backups, and audit evidence.
   - Decide whether in-flight turns are compacted or deleted after a completed
     artifact is verified.

2. **BA rights and corrections**
   - Define the BA's review, export, correction, withdrawal, and deletion
     rights.
   - Define how corrections preserve required audit history without keeping
     unnecessary private content.

3. **Direct-sponsor visibility**
   - Preserve the current raw answers/full profile/audio contract; or
   - reduce the sponsor surface to the derived training-support projection; or
   - require explicit BA consent for selected fields.

4. **Audio lifecycle**
   - Decide whether `audioUrl` remains part of the browser and sponsor
     contracts, its retention duration, and who may retrieve the underlying
     recording.

5. **Semantic-memory scope**
   - Decide whether Steve profile content belongs in Chroma/GraphRAG at all.
   - If approved, define exact agent/owner/sponsor scopes and which fields may
     be embedded. Until then, new Steve Chroma projections remain
     `retrievalEligible: false`, and admin bridge drafts remain
     non-materializable.
   - ACR-0011 separately authorizes the recruiting-cycle why-replay projection;
     changing that projection requires an explicit amendment.

6. **Production reconciliation**
   - Any backfill, purge, redaction, Chroma re-index, Neo4j property removal,
     audio deletion, or historical event compaction requires a separately
     reviewed dry-run and Kevin apply authority.

7. **Consent and providers**
   - Approve the user-facing consent language and the applicable LLM, voice,
     storage, and subprocessors terms before production activation.

## Safe implementation already authorized by P2-141

- Private/no-store headers on sensitive authenticated responses.
- Content-free generic failure responses.
- Minimal Mongo read projections per consumer.
- No raw BA turn text in approved-knowledge semantic queries or cache keys.
- No call identifier or audio URL in new Neo4j projections.
- Content-free, retrieval-ineligible new Steve Chroma completion markers.
- Minimal worker ingest receipts.
- Non-materializable admin GraphRAG bridge drafts.
- Tests and documentation proving self/direct-sponsor/admin boundaries and
  absence from `.com`.

These changes do not narrow the current direct-sponsor product contract, erase
records, re-index live data, or change production state.

## Acceptance criteria

- Kevin approves one retention rule for every listed artifact/store.
- Direct-sponsor visibility is explicit field by field.
- BA correction/export/deletion behavior is explicit.
- Audio access and lifecycle are explicit.
- Semantic-memory fields and retrieval principals are explicit.
- Production reconciliation requires a reviewed report-only preview and
  separate apply authority.
- No automated classification, scoring, truth judgment, production mutation,
  or external communication is introduced.

## Structured record

```json
{
  "acr_id": "ACR-0031",
  "title": "Steve Profile Retention and Visibility",
  "status": "proposed",
  "risk_level": "high",
  "change_type": "private_data_lifecycle_policy",
  "proposed_by": "Codex",
  "affected": {
    "surfaces": [
      "BA self Steve profile",
      "direct sponsor Success Profile card",
      "Michael training-support projection",
      "Kevin-only agent oversight"
    ],
    "stores": [
      "MongoDB",
      "Neo4j",
      "ChromaDB",
      "audio provider/storage",
      "backups"
    ]
  },
  "implementation": {
    "branch": "codex/p2-141-steve-privacy",
    "live_mutation_authorized": false,
    "external_communication_authorized": false
  },
  "created_at": "2026-07-16",
  "updated_at": "2026-07-16"
}
```
