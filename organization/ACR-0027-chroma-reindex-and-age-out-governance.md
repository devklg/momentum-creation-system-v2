# ACR-0027 — Chroma Re-index and Age-out Governance

## Momentum Creation System V2

Status: Proposed

Priority: P2-133 — Chroma re-index tooling and age-out policy

Type: Operator tooling + derived-projection lifecycle policy

Risk: High

Approval: Pending Kevin L. Gardner

Target Version: v1.2

---

## Purpose

Make Chroma projections reproducible from canonical Mongo state and define when
a derived embedding may leave active semantic retrieval without treating Chroma
as truth or inventing destructive time-to-live rules.

The repository already has governed, retryable single-object Knowledge
Evolution reindexing for active approved knowledge. It routes by exact domain
and language, excludes candidates, removes superseded or archived knowledge,
and preserves scope and lineage metadata. P2-133 must extend that foundation
into operator-grade audit/rebuild tooling; it must not replace or fork it.

Focused baseline verification on 2026-07-14 passed 42 Chroma adapter, metadata,
approved-knowledge, GraphRAG readiness, and Knowledge Evolution reindex tests.

## Grounded inventory

The generated repository catalog describes 53 app-managed Chroma collections.
A read-only inventory of the dedicated MCS Chroma stack on 2026-07-14 returned
60 collections. These seven live collections are outside the current app
catalog and therefore remain excluded from automated rebuild or age-out until
their ownership is registered:

- `mcs_three_way_notifications`
- `mcs_three_way_reminders`
- `mcs_memory_context_index`
- `claude_learning_notes`
- `mcs_vm_control_actions`
- `mcs_michael_runtime_turns`
- `mcs_runtime_context_traces`

This difference is an ownership finding, not permission to delete or absorb
the collections into the app-runtime registry.

## Trigger

An ACR is required because this work introduces operator tooling capable of
rewriting or removing semantic projections and establishes a retention policy.
The Administrator Guide currently leaves owner-approved retention duration as
`[SET BY KEVIN]`. No production mutation is authorized by proposing this ACR.

## Recommended bundle

1. **Add one explicit maintenance manifest.** Every supported app-managed
   collection declares its canonical Mongo owner, deterministic projection id,
   rebuild adapter, lifecycle/retention class, scope fields, required metadata,
   embedding model/version, and whether apply mode is supported. A collection
   without a complete manifest entry is audit-only and cannot be mutated.
2. **Provide an operator CLI with three modes.** `audit`, `reindex`, and
   `age-out` accept an exact collection allowlist, bounded batch size, and
   resume cursor. Dry-run is mandatory by default. Apply mode requires an
   explicit confirmation token and refuses wildcards, unknown collections,
   unowned live collections, or a missing canonical projector.
3. **Rebuild only from canonical records.** Mongo remains the source of truth.
   Reindex reads canonical records in deterministic bounded batches, builds the
   same ids/documents/metadata as the governed runtime writer, upserts through
   the direct Chroma adapter, and reads back each batch. It never rebuilds from
   Chroma documents and never writes canonical Mongo or Neo4j state.
4. **Reuse the existing Knowledge Evolution reindex path.** Active approved
   domain/language knowledge continues through the existing router and service.
   Candidate/review-only, unapproved, personal-domain, superseded, archived, or
   not-retrieval-ready knowledge cannot be promoted by a maintenance run.
5. **Make age-out canonical-lifecycle driven.** A Chroma record is eligible for
   removal only when its manifest policy and canonical Mongo state prove it is
   inactive—for example explicitly archived, superseded, soft-deleted, expired,
   or replaced. Chroma age alone, `indexedAt` alone, collection absence, or a
   failed Mongo read is never sufficient.
6. **Adopt four retention classes.** `indefinite` covers audit/governance and
   durable authority projections; `canonical_lifecycle` covers current-state,
   PII-bearing, content, and active-knowledge projections;
   `event_history_report_only` reports age distribution but performs no
   calendar deletion until Kevin approves a duration; `unowned_excluded`
   covers live collections outside the manifest. Version 1 introduces no
   automatic clock-based deletion.
7. **Fail closed on partial evidence.** Store unavailability, malformed
   canonical rows, duplicate projection ids, missing scope/lineage, embedding
   failure, readback mismatch, or an incomplete batch stops apply mode for that
   collection. Age-out never runs after a failed or incomplete reindex batch.
8. **Emit content-free evidence.** Reports contain collection name, policy
   class, canonical counts, projection counts, candidate/upsert/remove counts,
   model/dimension drift, bounded failure reasons, cursors, and timestamps—no
   source text, embeddings, prompts, prospect details, or BA-private content.
   Project-scoped reports live under `.logs/chroma-maintenance/`.
9. **Keep live mutation separately gated.** Approval authorizes implementation
   and local/disposable verification only. It does not authorize an apply run
   against the live dedicated stack. Kevin reviews the dry-run report and
   separately authorizes the exact collection set before any live reindex or
   age-out mutation.

## Boundaries

- Mongo stays canonical; Chroma is a disposable derived projection.
- No collection drop/recreate, database reset, or broad delete operation.
- No production runtime route, UI mutation control, scheduled job, or agent
  permission is added in v1.
- No Universal Gateway dependency is introduced into app runtime.
- No GraphRAG or Context Manager activation flag changes.
- No candidate/review-only collection is merged with active knowledge.
- No audit/decision authority is time-expired.
- No PII or source text appears in reports or command output.
- No live apply occurs from CI, server boot, or merge hooks.

## Acceptance criteria

- The manifest covers every collection that apply mode supports and rejects all
  unregistered/unowned targets.
- Dry-run performs zero Chroma writes or deletes and produces deterministic
  content-free evidence.
- Reindex uses bounded deterministic batches, resumable cursors, the direct
  adapter, canonical projectors, model/version metadata, and batch readback.
- Repeat reindex runs are idempotent and cannot create duplicate ids.
- A failed embed/upsert/readback prevents age-out for that collection.
- Lifecycle-driven age-out removes only canonically proven inactive projections.
- No calendar-based event deletion is possible without a later approved
  duration decision.
- Existing Knowledge Evolution, approved retrieval, GraphRAG readiness, Chroma
  adapter, metadata-contract, full server, typecheck, build, and generated
  catalog gates pass.

## Rollback

Disable/remove the maintenance CLI and manifest. Any projection removed during
an explicitly authorized apply run is rebuilt from canonical Mongo through the
same manifest/projector and verified by readback. Canonical Mongo and Neo4j
records are never deleted or rewritten by this tool.

## Structured record

```json
{
  "acr_id": "ACR-0027",
  "title": "Chroma Re-index and Age-out Governance",
  "status": "proposed",
  "risk_level": "high",
  "change_type": "runtime_operator_tooling_and_policy",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "Mongo canonical authority",
      "derived projection integrity",
      "approved-only retrieval",
      "candidate separation",
      "privacy and least exposure",
      "Kevin retention authority",
      "no live mutation on approval"
    ]
  },
  "affected": {
    "documents": [
      "PLATFORM_AUDIT_PRIORITY_TASKLIST.md",
      "engineering/sprints/platform-audit-p1/chroma-collection-catalog.json"
    ],
    "schemas": [
      "additive code-owned Chroma maintenance manifest and report contract"
    ],
    "surfaces": [
      "operator CLI only"
    ],
    "agents": []
  },
  "review": {
    "reviewers": [
      "Kevin L. Gardner",
      "Persistence/QA"
    ],
    "decision": "pending",
    "conditions": [
      "Implementation approval does not authorize a live apply run.",
      "Calendar-based deletion remains disabled pending a separate duration decision."
    ]
  },
  "implementation": {
    "branch": "codex/p2-133-chroma-lifecycle",
    "commits": [],
    "append_only_respected": null
  },
  "verification": {
    "baseline_focused_tests": 42,
    "typecheck": null,
    "flows": [],
    "persistence_readback": null
  },
  "release": {
    "gates_passed": [],
    "gates_pending": [
      "kevin_architecture_approval",
      "implementation",
      "automated_verification",
      "dry_run_evidence_review"
    ],
    "released_at": null
  },
  "version": {
    "from": "single-object reindex coordination without operator rebuild policy",
    "to": "manifest-governed Chroma maintenance v1",
    "supersedes": null,
    "rollback_to": "single-object reindex coordination"
  },
  "decision_ledger_ref": null,
  "created_at": "2026-07-14",
  "updated_at": "2026-07-14"
}
```

## Approval gate

Implementation remains blocked until Kevin approves the recommended ACR-0027
bundle. Even after approval and implementation, live apply remains separately
blocked until Kevin reviews dry-run evidence and authorizes exact collections.
