# ACR-0028 — Knowledge Source Conflict Detection

## Momentum Creation System V2

Status: Proposed

Priority: P2-134 — Knowledge source conflict detection

Type: Read-only integrity projection + Kevin-only admin warning

Risk: Medium

Target Version: v1.2

---

## Purpose

Detect deterministic conflicts in approved knowledge-source identity,
authority, and resource projection before inconsistent records silently enter
normal retrieval. The detector reports evidence; it does not decide which
source is true, modify source state, block or activate knowledge, or perform
the correction and supersession workflow reserved for P2-135.

This ACR does not authorize semantic contradiction judgments by an LLM. A
semantic disagreement that cannot be proved from canonical identity,
authority, version, and digest evidence remains a human review concern outside
this detector.

## Authority and current state

The active decision `dec_source_hierarchy_no_key` defines source precedence as:

> decision ledger (currency) > locked spec (state) > design docs > build
> registry > git log > Perry handoffs.

The Knowledge Core runtime requires contradiction review, preserves evidence,
and prevents unresolved contradictions from becoming active organizational
knowledge. The ingestion protocol already distinguishes new, merge, link,
duplicate rejection, and human review outcomes. Current code also rejects an
immutable same-version resource digest conflict while projecting one resource.
What is missing is an ongoing, bounded view across canonical approved sources
and their resource projections.

A content-free read-only baseline on the dedicated MCS stack on 2026-07-14
observed:

- 209 `mcs_knowledge_sources` rows;
- 209 active approved sources, all with `sourceRef`;
- 209 knowledge entries in `tmag_resource_catalog`;
- zero active source-reference digest divergences;
- zero source-id/version digest divergences; and
- zero source-to-resource projection digest mismatches.

The scan was complete. Only counts and locally computed SHA-256 comparisons
were observed; source content and source references were not printed or stored
in the evidence.

## Trigger

P2-134 requires source conflict detection. An ACR is required because the work
adds a knowledge-integrity contract and an admin-visible governance status.
Proposal approval authorizes implementation and verification only; it does not
authorize any source, resource, retrieval, or lifecycle mutation.

## Recommended bundle

1. **Add one deterministic read-only observer.** Scan canonical approved
   knowledge sources and their resource-catalog projections in stable bounded
   pages. The detector never reads from Chroma as authority and never writes to
   Mongo, Neo4j, Chroma, or SurrealDB.
2. **Report exact conflict classes.** Version 1 recognizes only mechanically
   provable conditions:
   - `active_source_ref_divergence`: the same normalized source reference,
     domain, and language has multiple active approved source identities with
     distinct content SHA-256 digests;
   - `active_source_identity_divergence`: the same source id and version has
     distinct content SHA-256 digests;
   - `resource_projection_digest_mismatch`: a matching knowledge resource
     version does not carry the canonical source digest;
   - `active_authority_state_mismatch`: an active source has an authority or
     approval envelope inconsistent with active approved organizational
     knowledge; and
   - `active_exact_duplicate`: separate active identities carry the same
     normalized source reference, domain, language, and digest. This is an
     advisory duplicate, not a semantic contradiction.
3. **Normalize conservatively.** Source-reference comparison trims surrounding
   whitespace and applies only scheme/host case normalization where URL syntax
   proves it safe. It does not strip paths, query parameters, revisions, file
   names, or repository provenance. Domain and language remain part of the
   identity key.
4. **Use content-free evidence.** Results expose counts, severity, stable
   conflict class, and SHA-256 hashes of comparison keys. They never expose
   source text, titles, raw source references, embeddings, prompts, contact
   details, invite tokens, or prospect/BA-private data.
5. **Fail closed on incomplete observation.** Missing stores/collections,
   malformed required fields, query failure, page-limit exhaustion, duplicate
   query boundaries, or incomplete resource reconciliation produce
   `degraded` or `truncated`, never `clear`.
6. **Keep the scan bounded.** Version 1 scans no more than 1,000 source rows and
   1,000 matching resource rows per request, using deterministic keyset pages
   internally. Exceeding either bound returns `truncated` with no partial-clear
   claim.
7. **Expose one additive admin projection.** Extend the existing Kevin-only
   Knowledge Status response and page with an integrity block:
   `status: clear | conflicts | degraded | truncated`, `computedAt`, scan
   counts, total conflict count, per-class counts, highest severity, and a
   bounded content-free sample of conflict fingerprints. Retrieval readiness
   remains a separate status and is not inferred from integrity health.
8. **No automated judgment or resolution.** The observer may warn and identify
   deterministic evidence. It cannot select a winner, change authority,
   approve/reject/activate/archive/supersede a source, rewrite resource
   projections, alter retrieval eligibility, or enqueue correction work.

## Severity contract

- `critical`: `active_source_identity_divergence`.
- `high`: `active_source_ref_divergence` or
  `resource_projection_digest_mismatch`.
- `medium`: `active_authority_state_mismatch`.
- `advisory`: `active_exact_duplicate`.

The aggregate status is `conflicts` when any class is present, including an
advisory duplicate. Severity describes evidence priority only; it does not
rank, score, or classify people.

## Boundaries

- Mongo approved source state remains canonical; resource entries are derived
  projections and Chroma remains a disposable semantic projection.
- The active decision ledger remains the authority for source precedence.
- No LLM, embedding similarity, fuzzy title matching, or semantic scoring is
  used to declare a conflict.
- No source or resource content is returned to the aggregate status surface.
- No new public, prospect, BA, or agent mutation route is added.
- No alert email, SMS, call, task assignment, or external action is triggered.
- No source lifecycle, correction, merge, or supersession mutation is added.
- P2-135 owns stale-knowledge correction and supersession workflow.
- Existing ingestion-time immutable-version rejection remains in force and is
  not weakened by the observer.

## Acceptance criteria

- A pure detector produces deterministic conflict classifications from bounded
  source/resource metadata and digests.
- Exact same-version divergence, source-reference divergence, projection
  mismatch, authority mismatch, exact duplicate, clean, malformed, degraded,
  and truncated paths are covered by tests.
- A clean result is impossible unless both scans complete and reconcile.
- The admin API remains Kevin-only and adds no mutation capability.
- The admin UI distinguishes clear, conflicts, degraded, and truncated without
  exposing source content or implying that a conflict has been resolved.
- Repeated observation performs zero persistent writes and zero external
  communication.
- The existing knowledge-status, approved-knowledge, resource-projection,
  route-access, server/admin, typecheck, build, and visual gates pass.
- Verification includes a read-only dedicated-stack observation and reports
  only counts and hashed fingerprints.

## Rollback

Remove the additive observer, response block, and admin warning component.
Because the implementation is read-only, rollback requires no data migration,
source repair, projection rebuild, or lifecycle reversal.

## Structured record

```json
{
  "acr_id": "ACR-0028",
  "title": "Knowledge Source Conflict Detection",
  "status": "proposed",
  "risk_level": "medium",
  "change_type": "read_only_knowledge_integrity_projection",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "decision-ledger source authority",
      "Mongo canonical approved knowledge",
      "derived resource and Chroma projections",
      "human review authority",
      "privacy and least exposure",
      "no automated remediation"
    ]
  },
  "affected": {
    "documents": [
      "PLATFORM_AUDIT_PRIORITY_TASKLIST.md",
      "organization/ACR-REGISTER.md"
    ],
    "schemas": [
      "additive admin knowledge integrity status contract"
    ],
    "surfaces": [
      "Kevin-only admin Knowledge Status"
    ],
    "agents": []
  },
  "review": {
    "reviewers": [
      "Kevin L. Gardner",
      "Knowledge/Persistence/QA"
    ],
    "decision": "pending",
    "conditions": [
      "Approval authorizes detection and admin warnings only.",
      "Source correction, lifecycle mutation, and supersession remain unauthorized.",
      "Semantic contradiction judgments remain human-governed."
    ]
  },
  "implementation": {
    "branch": "codex/p2-134-source-conflict-detection",
    "commits": [],
    "append_only_respected": true
  },
  "verification": {
    "baseline": {
      "source_rows": 209,
      "active_approved_sources": 209,
      "knowledge_resource_rows": 209,
      "source_ref_divergences": 0,
      "source_identity_divergences": 0,
      "resource_projection_digest_mismatches": 0,
      "scan_complete": true,
      "persistent_mutations": 0
    },
    "gates": [
      "focused deterministic detector tests",
      "knowledge-status route and privacy tests",
      "admin UI tests and trusted visual QA",
      "route-access catalog",
      "repository typecheck and build",
      "read-only dedicated-stack observation"
    ]
  },
  "version": {
    "from": "ingestion-time single-resource conflict rejection",
    "to": "bounded ongoing source and projection conflict observation v1",
    "supersedes": null,
    "rollback_to": "ingestion-time single-resource conflict rejection"
  },
  "decision_ledger_ref": null,
  "created_at": "2026-07-14",
  "updated_at": "2026-07-14"
}
```

## Approval gate

Approve the recommended ACR-0028 bundle to authorize implementation and
local/read-only verification on `codex/p2-134-source-conflict-detection`.
Approval does not authorize source correction, lifecycle changes,
supersession, live content mutation, or external communication.
