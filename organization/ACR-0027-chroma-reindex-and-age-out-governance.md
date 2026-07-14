# ACR-0027 — Chroma Re-index and Age-out Governance

## Momentum Creation System V2

Status: Verified

Priority: P2-133 — Chroma re-index tooling and age-out policy

Type: Operator tooling + derived-projection lifecycle policy

Risk: High

Approval: Kevin L. Gardner — 2026-07-14

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

## Verified implementation

Commit `b1b3ddb9` implements the approved operator boundary without adding a
route, UI control, schedule, boot hook, or live mutation. The code-owned
manifest covers every registered app collection plus all fourteen ratified
Knowledge Evolution active collections. Only those active collections have a
canonical projector and mutation capabilities; all other registered entries
are audit-only, and the seven unowned live collections remain excluded.

The CLI defaults to dry-run and accepts only exact manifest collection names,
bounded batches, and collection-specific resume cursors. Apply additionally
requires all of the following:

- exact `--confirm P2-133`;
- a dedicated `dec_p2_133_chroma_live_apply_*` decision id;
- the SHA-256 of the reviewed dry-run report;
- canonical Mongo readback proving Kevin, ACR-0027, mode, exact collections,
  evidence digest, active status, and `live_chroma_apply` scope all match;
- complete live and canonical scans with no blocked or duplicate canonical
  projection identity;
- exact post-upsert or post-removal readback.

The approved implementation decision is intentionally rejected as a live-apply
decision. No live apply was attempted or authorized during verification.

Read-only dedicated-stack verification on 2026-07-14 produced content-free
audit and reindex dry-run reports under `.logs/chroma-maintenance/`. Both
observed 60 live collections, reported the same seven unowned exclusions,
found zero live and zero canonical rows in the bounded
`mcs_success_knowledge_en` sample, and applied zero upserts/removals. Evidence:

- audit SHA-256: `6f4fd36f4164a67cbf0b6e79e64a0caeef0fad15115dc7edee70db42546c5516`
- reindex SHA-256: `c6824852e6ee3a896602d875d0cdc8e13ad093cccb5d3c8e3e8057213c1e5225`

Automated verification passed 20 focused maintenance/adapter safety tests,
repository-wide typecheck, the production build, generated catalog execution,
`git diff --check`, and the full server suite with 2,169 passing and 19 skipped
tests. This operator-only change has no visual surface, so no visual gate
applies.

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
  "status": "verified",
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
    "decision": "approved",
    "conditions": [
      "Implementation approval does not authorize a live apply run.",
      "Calendar-based deletion remains disabled pending a separate duration decision."
    ],
    "approved_by": "Kevin L. Gardner",
    "approved_at": "2026-07-14"
  },
  "implementation": {
    "branch": "codex/p2-133-chroma-lifecycle",
    "commits": [
      "b1b3ddb9"
    ],
    "append_only_respected": true
  },
  "verification": {
    "baseline_focused_tests": 42,
    "implementation_focused_tests": 20,
    "full_server_tests": {
      "passed": 2169,
      "skipped": 19
    },
    "typecheck": "pass",
    "build": "pass",
    "catalog_generation": "pass",
    "flows": [
      "unknown and unowned collection rejection",
      "dry-run zero-mutation enforcement",
      "bounded batch and resume cursor",
      "canonical approval, retrieval-ready, archive, and supersession classification",
      "dedicated live-apply decision and dry-run digest enforcement",
      "exact upsert and removal readback",
      "content-free report contract"
    ],
    "persistence_readback": {
      "mode": "read_only_dry_run",
      "live_collection_count": 60,
      "unowned_excluded_count": 7,
      "sample_collection": "mcs_success_knowledge_en",
      "sample_live_records": 0,
      "sample_canonical_records": 0,
      "applied_upserts": 0,
      "applied_removals": 0,
      "audit_report_sha256": "6f4fd36f4164a67cbf0b6e79e64a0caeef0fad15115dc7edee70db42546c5516",
      "reindex_report_sha256": "c6824852e6ee3a896602d875d0cdc8e13ad093cccb5d3c8e3e8057213c1e5225"
    }
  },
  "release": {
    "gates_passed": [
      "implementation",
      "focused_automated_verification",
      "repository_typecheck",
      "production_build",
      "full_server_tests",
      "catalog_generation",
      "content_free_live_dry_runs"
    ],
    "gates_pending": [
      "kevin_live_apply_authorization"
    ],
    "released_at": "2026-07-14"
  },
  "version": {
    "from": "single-object reindex coordination without operator rebuild policy",
    "to": "manifest-governed Chroma maintenance v1",
    "supersedes": null,
    "rollback_to": "single-object reindex coordination"
  },
  "decision_ledger_ref": "dec_acr_0027_chroma_reindex_age_out_approval_2026_07_14",
  "created_at": "2026-07-14",
  "updated_at": "2026-07-14"
}
```

## Approval record

Kevin L. Gardner approved the recommended ACR-0027 bundle on 2026-07-14 with
the exact statement `YES approve acr-0027`. The durable decision ledger record
is `dec_acr_0027_chroma_reindex_age_out_approval_2026_07_14`.

This approval authorizes implementation and local/disposable verification only.
Live Chroma re-index or age-out mutation remains separately blocked until Kevin
reviews an exact dry-run evidence digest and authorizes the exact mode and
collections in a dedicated live-apply decision.
