# ACR-0029 — Governed Knowledge Correction and Supersession

## Momentum Creation System V2

Status: Proposed

Priority: P2-135 — Stale knowledge correction and supersession workflow

Type: Kevin-only append-only knowledge lifecycle workflow

Risk: High

Approval: Required — Kevin L. Gardner

Target Version: v1.2

---

## Purpose

Let Kevin replace a specific stale or incorrect approved knowledge source with a
new immutable version while preserving the old version, approval lineage,
source lineage, and audit history. The old version must leave normal retrieval,
the replacement must not enter retrieval until its projections pass, and every
cutover must be human-authorized and recoverable.

This workflow corrects known knowledge. It does not let an agent decide that a
fact is stale, choose the truth between conflicting sources, approve knowledge,
or apply a correction automatically.

## Existing authority and implementation gap

- ACR-0012 and `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` already authorize and
  specify version, supersession, graph, reindex, rollout, and rollback
  primitives. P2-135 must extend that authority instead of creating a second
  evolution engine.
- ACR-0028/P2-134 is deliberately read-only and reserves correction and
  supersession for P2-135.
- The live approved-knowledge path used by Context Manager is
  `mcs_knowledge_sources` + `mcs_knowledge_chunks` through
  `approvedKnowledgeStore.ts`. The existing Knowledge Evolution supersession
  record does not change those live source/chunk lifecycle rows.
- The current approval policy validates the shape of a caller-supplied approval
  reference. It does not prove that the reference exists in a canonical
  Kevin-owned correction decision.
- The current admin Knowledge page can create sources but cannot select an
  active version, preview a replacement, or perform a governed cutover.
- A read-only dedicated-stack observation on 2026-07-14 found 209 active source
  rows and 1,673 active retrieval-eligible chunk rows. No non-active source or
  chunk lifecycle row was present. Each collection currently has only its
  `_id_` index.

## Recommended decision bundle

### 1. Human-only correction authority

Only the Kevin-only admin surface may request or apply a correction. Actor
identity is derived from the authenticated session; the request cannot supply
or override `approvedBy`, `supersededBy`, tenant, team, or authority identity.

No agent, monitor, conflict detector, scheduled task, LLM, or embedding match
may initiate or apply a correction.

### 2. Immutable logical-source versioning

`sourceId` remains the stable logical source identity. Every correction creates
a new source-version row with a monotonic `version` and a unique
`sourceVersionId`. Existing version-1 rows remain valid legacy rows where the
Mongo `_id` equals `sourceId`; later rows use the version identity as `_id`.

The replacement preserves the old `originalContent` unchanged and records:

- `supersedesSourceVersionId` on the new version;
- `replacementSourceVersionId` on the old version;
- the canonical correction-decision id;
- the old and new SHA-256 content digests;
- reason, actor, and timestamps.

The old version is never deleted or rewritten as if the replacement had always
been true.

### 3. Staged, exclusive retrieval cutover

The replacement begins approved but not retrieval-eligible. It is parsed,
versioned, and projected before cutover. The cutover must ensure that the old
and new versions are never both eligible for normal retrieval.

At cutover:

- the old source authority becomes `superseded`;
- the old source and chunks become `superseded` and non-retrieval-eligible;
- the replacement source and chunks become active and retrieval-eligible only
  after required Mongo, Neo4j, Chroma, resource-catalog, and GraphRAG checks;
- approved-reference caches are invalidated by the governed write generation;
- normal retrieval fails closed if exclusive-active-version evidence is
  incomplete.

`approved` and `superseded` are additive lifecycle values for source/chunk
contracts. Existing active, deprecated, archived, rejected, and parse-failed
behavior remains unchanged.

### 4. Canonical per-correction decision

ACR-0029 approval authorizes implementation and verification of the workflow;
it does not authorize changing any of the 209 observed live sources.

Each live correction requires its own immutable Kevin decision bound to:

- current `sourceVersionId` and expected version;
- current source SHA-256;
- replacement SHA-256;
- reason;
- dry-run preview SHA-256;
- authenticated Kevin actor;
- exact apply idempotency key.

The admin confirmation creates that canonical decision before execution. The
Knowledge Evolution approval authority must read it back; a body-shaped
approval reference alone is insufficient.

### 5. Resumable, idempotent workflow

Add one canonical correction record per idempotency key with an explicit state
machine:

`requested → staged → projections_ready → cutover_pending → verified | failed | rolled_back`

Retries resume the recorded stage and cannot create a second replacement
version. Optimistic concurrency rejects a request if the selected version,
digest, lifecycle, or replacement pointer changed after preview.

The workflow is not `verified` until exact post-write readback confirms:

- one active version for the logical source in canonical Mongo;
- old/new source and chunk lifecycle state;
- the Neo4j `SUPERSEDES` lineage and version nodes;
- removal or exclusion of old active Chroma/GraphRAG projections;
- replacement projection identity and digest;
- resource-catalog supersession/replacement lineage;
- no unresolved correction projection job.

### 6. Failure and rollback boundary

Partial projection failure must remain visible and retryable. It must never be
reported as a successful correction. During an incomplete cutover, retrieval
must prefer a safe gap over serving both versions.

Rollback appends a rollback record, restores the last verified active version,
reconciles Mongo/Neo4j/Chroma/resource/GraphRAG projections, and preserves the
failed replacement and correction evidence. No rollback erases a decision,
version, or failure.

### 7. Kevin-only admin workflow

Extend the existing Knowledge page with:

- bounded cursor pagination over source-version metadata;
- active/superseded/approved filters;
- title, domain, language, version, age, authority, and shortened content
  digest;
- a correction form for replacement content and reason;
- a dry-run preview showing old/new identities, digests, projection scope, and
  rollback target;
- an explicit confirmation bound to the preview SHA-256;
- progress, failed-stage, retry, verified, and rollback evidence.

The list response must not dump source content. Content is returned only for the
single Kevin-selected version inside the correction form.

### 8. Boundaries retained

- No automatic calendar TTL, stale classification, or auto-supersession.
- No semantic LLM or embedding-similarity truth decision.
- No hard delete of sources, chunks, versions, decisions, or audit evidence.
- No candidate/review-only or unreviewed translation activation.
- No `.com`, BA-facing, Telnyx, email, SMS, or external communication change.
- No broad GraphRAG/Context Manager activation or canary widening.
- P2-171 separately owns graph-aware stale-knowledge alerts.

## Proposed additive contracts

- Source/chunk lifecycle values: `approved`, `superseded`.
- Source-version lineage fields: `sourceVersionId`,
  `supersedesSourceVersionId`, `replacementSourceVersionId`,
  `correctionDecisionId`, `contentDigestSha256`, `supersededAt`,
  `supersededBy`, `supersessionReason`.
- Correction record: identity, expected/current digests, replacement digest,
  preview digest, idempotency key, state, stage evidence, approval reference,
  rollback target, failures, and timestamps.
- Admin request/response contracts for source-version list, single-version
  detail, correction preview, apply/status, retry, and rollback.

## Proposed API boundary

- `GET /api/admin/knowledge/source-versions`
- `GET /api/admin/knowledge/source-versions/:sourceVersionId`
- `POST /api/admin/knowledge/source-versions/:sourceVersionId/corrections/preview`
- `POST /api/admin/knowledge/source-versions/:sourceVersionId/corrections`
- `GET /api/admin/knowledge/corrections/:correctionId`
- `POST /api/admin/knowledge/corrections/:correctionId/retry`
- `POST /api/admin/knowledge/corrections/:correctionId/rollback`

Every route is `requireAdmin`; no runtime-secret or public mutation route is
added. Preview is read-only. Apply/retry/rollback require a matching immutable
decision and idempotency evidence.

## Implementation shape after approval

1. Add the source-version/correction contracts and schema validation.
2. Add a canonical approval-authority read port to Knowledge Evolution.
3. Extend approved intake to stage a version without retrieval eligibility.
4. Implement the idempotent correction coordinator over the existing Knowledge
   Evolution, tiered-write/outbox, resource-catalog, GraphRAG, and cache seams.
5. Add Kevin-only routes and the admin correction panel.
6. Add unit, route, persistence, failure-resume, rollback, privacy, and UI tests.
7. Run dry-run/read-only verification against the dedicated stack. Do not apply
   a live correction without its separate per-correction Kevin decision.

## Acceptance criteria

- A correction cannot start without a canonical Kevin decision readback.
- Preview/apply reject stale version, digest, lifecycle, or preview evidence.
- Replacement content creates a new immutable monotonic version.
- Old content and history remain stored and auditable.
- Exactly one source version is normal-retrieval eligible after a verified
  cutover.
- Old source/chunks/resource/GraphRAG projections are excluded from normal
  retrieval and link to the replacement.
- Neo4j records version and `SUPERSEDES` lineage.
- Retries are idempotent and resume rather than duplicate.
- Failure is visible, fail-closed, and rollbackable.
- Rollback restores a prior verified active version without erasing history.
- No agent approval, semantic truth judgment, automatic staleness decision,
  external communication, or prospect/BA surface is added.
- Focused/full tests, typecheck, build, generated catalogs, route access, and a
  dedicated-stack dry-run/readback pass before completion.

## Rollback

Disable the admin correction action, stop new correction jobs, and execute the
recorded rollback plan for any in-flight cutover. Restore the last verified
active source version and its projections while retaining every correction,
replacement, failure, and rollback record.

## Approval requested

Approve the recommended ACR-0029 bundle to authorize implementation and
local/read-only verification on
`codex/p2-135-stale-knowledge-supersession`.

Approval does not authorize applying a correction to existing live knowledge.

## Structured record

```json
{
  "acr_id": "ACR-0029",
  "title": "Governed Knowledge Correction and Supersession",
  "status": "proposed",
  "risk_level": "high",
  "change_type": "kevin_only_append_only_knowledge_lifecycle_workflow",
  "proposed_by": "Codex",
  "constitutional_check": {
    "future_dev_test": "pass",
    "boundaries_reviewed": [
      "human authority",
      "memory integrity",
      "append-only correction history",
      "Mongo canonical state",
      "Neo4j supersession lineage",
      "Chroma derived retrieval",
      "fail-closed retrieval",
      "no automatic remediation"
    ]
  },
  "affected": {
    "documents": [
      "PLATFORM_AUDIT_PRIORITY_TASKLIST.md",
      "organization/ACR-REGISTER.md"
    ],
    "schemas": [
      "knowledge source versions",
      "knowledge chunk lifecycle",
      "knowledge correction records",
      "admin correction contracts"
    ],
    "surfaces": [
      "Kevin-only admin Knowledge"
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
      "ACR approval authorizes implementation and read-only verification only.",
      "Every live correction requires a separate Kevin decision bound to exact preview evidence.",
      "No agent, LLM, monitor, or schedule may approve or apply a correction."
    ]
  },
  "implementation": {
    "branch": "codex/p2-135-stale-knowledge-supersession",
    "append_only_required": true,
    "live_mutation_authorized": false
  },
  "version": {
    "from": "read-only conflict observation plus disconnected supersession primitives",
    "to": "governed live-source correction and exclusive supersession workflow v1",
    "supersedes": null,
    "rollback_to": "read-only conflict observation and source creation only"
  },
  "created_at": "2026-07-14",
  "updated_at": "2026-07-14"
}
```
