# ACR-0033 — Resource Catalog Content-Version Bindings

## Momentum Creation System V2

Status: Approved — implementation verification in progress

Ratified: Kevin L. Gardner, 2026-07-16

Priority: P2-142 — content versioning

Change type: Contract

Risk: Medium

Target Version: v1.3

Decision owner: Kevin L. Gardner

Proposer: Codex

---

## 1. Decision

The existing `resource_catalog.v1` contract remains the single content and
knowledge-base authority for training, orientation, resources, and event
materials. Training and event surfaces may compose or link catalog content,
but they must not create a second content authority.

Fast Start is the immediate first training pathway for a new BA. It establishes
the actions and behavior that support initial success and provides the
foundation for later training. P2-142 adds the version-binding contract for
that pathway, but it does not ratify, rewrite, migrate, or freeze the current
Fast Start content. Kevin will address that content after reviewing the audit's
effects on the app.

The current ten-step orientation curriculum may be projected as an immutable,
code-owned resource-catalog version. Every newly created orientation session
must snapshot the exact curriculum and supporting `resourceVersionId` values
that the session will use. Later catalog changes do not rewrite old sessions.

Kevin's ratifying direction:

> Reuse the resource catalog, which should have all of the knowledge base
> within it. Fast Start is just the immediate first training and what to do
> starting out of the gate. It informs initial success behavior and acts as a
> foundation to train on moving forward.

## 2. Version and binding contract

- A content version is a `resource_catalog.v1` entry identified by immutable
  `resourceVersionId`, positive `version`, and SHA-256 content digest.
- Training, orientation, resource, and event-material links use exact
  `resourceVersionId` values. Semantic similarity may not create a binding.
- A binding snapshot contains its exact resource-version identities and a
  deterministic SHA-256 digest of those identities and content digests.
- The current orientation source file is cataloged as
  `training:orientation:ten_step:v1`; changing its content requires a new
  version and explicit supersession rather than mutation of v1.
- New orientation sessions persist the binding in MongoDB and a content-free
  representation in Neo4j and ChromaDB, followed by read-back verification.
- Existing resource-center and event-material projections continue using
  `tmag_resource_catalog`, `TmagResource`/`TmagResourceVersion`, and
  `mcs_resource_catalog`.

## 3. Fast Start boundary

- The resource catalog is the content authority.
- Fast Start is a curated pathway through approved catalog versions.
- P2-142 records the pathway purpose and exact-version binding rule.
- Current Fast Start source files are not declared approved catalog content by
  this ACR.
- Populating or replacing Fast Start content requires Kevin's post-audit app
  review and a separately versioned catalog update.
- Training completion and progress semantics are unchanged.

## 4. Security and compliance boundaries

- No prospect-facing `.com` content changes.
- No person scoring, ranking, prediction, classification, or qualification.
- No AI-generated training content and no provider data transfer.
- No new content editor, approval authority, attendance inference, or
  completion inference.
- No production backfill, historical mutation, provider activation, external
  communication, or implementation-PR merge is authorized by this ACR.

## 5. Acceptance criteria

- The code-owned orientation curriculum has an immutable catalog identity,
  version, source locator, and SHA-256 digest.
- Source drift without a version/digest update fails a repository test.
- New orientation sessions bind exact catalog versions and preserve those
  bindings in MongoDB, Neo4j, and ChromaDB with read-back verification.
- Fast Start declares the catalog authority and binding rule without ratifying
  or modifying its content.
- Resource and event-material contracts continue to require exact catalog
  versions and explicit context tags.
- Focused tests, typecheck, build, generated catalogs, route-access checks, and
  `.com` compliance pass before merge authority is requested.

## 6. Authority boundary

This approval authorizes repository implementation and verification of P2-142.
It does not authorize production or historical data mutation, Fast Start
content changes, external provider calls, external communication, or merge of
the implementation PR.
