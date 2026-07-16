# ACR-0032 — Steve Interview Versioning and Durable Retention

## Momentum Creation System V2

Status: Approved — implementation verification in progress

Ratified: Kevin L. Gardner, 2026-07-16

Priority: P2-141 — Steve profile privacy and minimal exposure

Change type: Contract

Risk: High

Target Version: v1.3

Decision owner: Kevin L. Gardner

Proposer: Codex

---

## 1. Decision

The completed Steve interview is durable operational input to the BA's plan of
action. The product must not offer ordinary BA or administrator deletion of the
interview. A BA may correct current answers or retake the interview.

Corrections and retakes are versioned. The last completed profile remains the
active plan until a replacement retake completes and reads back successfully.
An abandoned or failed retake therefore cannot leave the BA without the
support context on which the plan depends.

This ACR supersedes only the deletion and destructive-correction portions of
ACR-0031. ACR-0031's privacy, export, withdrawal, sponsor-consent, provider,
audio, minimal-exposure, and historical-apply boundaries remain controlling.

Kevin's ratifying direction:

> The interview should be saved to the three DBs. If a BA wants to do it again
> or edit some of his answers we should allow it. Deletion is not or should not
> be an option because our plan of action depends on this information, and if
> it is deleted what is it replaced by?

## 2. Three-store contract

Every current interview and every superseded revision has a role-appropriate
representation in all three runtime stores:

| Store | Required representation |
| --- | --- |
| MongoDB | Canonical full private current record and immutable full private snapshots of superseded confirmed revisions. |
| Neo4j | Content-free interview/version lineage, owner relationship, version numbers, status, and completion/supersession times. No transcript or profile text. |
| ChromaDB | Content-free, retrieval-ineligible current/version markers plus only separately approved support projections such as the ACR-0011 why statement. No unrestricted transcript, raw answers, or full profile. |

The triple-stack rule requires a representation in each store; it does not
authorize copying unrestricted private interview text into graph or vector
storage.

## 3. Version lifecycle

- The stable current record id remains `SD-{tmagId}`.
- `profileVersion` begins at 1 and increments only when a completed retake
  replaces the active profile.
- `correctionRevision` begins at 0 for each profile version and increments for
  each confirmed edit.
- Before a confirmed current revision is replaced, its full private snapshot
  is preserved in MongoDB under
  `SD-{tmagId}-v{profileVersion}-r{correctionRevision}` and its content-free
  lineage markers are written and read back in Neo4j and ChromaDB.
- Starting a retake creates an in-progress session but does not change the
  active profile version or reopen the onboarding gate.
- Only successful completion plus required projection read-back promotes the
  retake. Failure restores or leaves the prior current profile active.
- In-flight conversation bodies remain session-scoped and are compacted only
  after the completed replacement becomes canonical.

## 4. BA controls

The authenticated BA may:

- review and export the current private record under ACR-0031;
- replace one correctable current value after explicit confirmation and a
  current revision match;
- start a new interview after explicit confirmation; and
- withdraw the record from personalization and sponsor sharing without
  deleting the durable self record.

The application exposes no ordinary interview-delete route or button. A legal
or compliance mandate requiring erasure is outside ordinary product behavior
and requires separate authority, scoped procedure, and verified multi-store
handling.

## 5. Security and privacy boundaries

- Prior versions remain BA-private and are not sponsor-visible.
- Sponsor consent remains field-specific, off by default, current-sponsor
  bound, and revocable under ACR-0031.
- Audit entries contain ids, versions, field paths, actors, policy versions,
  and times, never former or replacement private text.
- No scoring, ranking, prediction, classification, qualification, or truth
  judgment is introduced.
- `.com` receives no Steve interview content.
- Anthropic may remain Steve's model provider only under the separately
  approved no-retention/no-training data-use boundary; this ACR does not expand
  provider data use.

## 6. Acceptance criteria

- A completed interview is represented in MongoDB, Neo4j, and ChromaDB with
  the store roles above.
- A correction preserves the prior confirmed revision before the corrected
  revision becomes current.
- A retake leaves the current plan active while in progress and promotes a new
  major version only after successful completion and read-back.
- No ordinary BA/admin deletion endpoint or interface exists.
- Version, retake, and correction audit facts contain no private interview
  text.
- Focused tests, full tests, typecheck, build, route access, generated catalogs,
  freshness, and `.com` compliance pass before merge authority is requested.

## 7. Authority boundary

This approval authorizes repository implementation and verification. It does
not authorize production or historical record mutation, external provider
activation, historical backfill/re-indexing, legal erasure, merge of the
implementation PR, or external communication. Those actions remain separately
gated.

