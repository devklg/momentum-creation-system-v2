# ACR-0003 — Candidate Owner Naming Alignment

## Momentum Creation System V2

Status: Proposed

Priority: Post-Runtime Ratification

Type: Architecture Consistency

Approval: Pending

---

## Purpose

Align the `CandidateOwner` type in `KNOWLEDGE_INGESTION_PROTOCOL.md` with the canonical `KnowledgeOwner` type in `KNOWLEDGE_CORE_RUNTIME.md`.

`KNOWLEDGE_CORE_RUNTIME.md` is the canonical authority for knowledge ownership.

The two ownership types use different field names for the same concepts.

This ACR aligns the ingestion ownership type to the canonical ownership field names.

This ACR introduces architectural consistency only.

It does not change runtime behavior.

---

## Motivation

A candidate owner and a knowledge-object owner describe the same ownership concepts and should use the same field names so ownership carries cleanly from candidate to approved Knowledge Object.

`KNOWLEDGE_INGESTION_PROTOCOL.md` §17.3 `CandidateOwner` uses:

- `brand_ambassador` → `baId`
- `agent` → `agentKey`

`KNOWLEDGE_CORE_RUNTIME.md` §11.5 `KnowledgeOwner` uses:

- `brand_ambassador` → `brandAmbassadorId` (plus `teamMagnificentId`)
- `agent` → `agentId`

The `teamMagnificentId` field is already present on the ingestion `brand_ambassador` owner variant (per the ratified ingestion spec). The remaining divergence is the identifier field names.

---

## Proposed Changes

### 1. Align the Brand Ambassador owner identifier

In `KNOWLEDGE_INGESTION_PROTOCOL.md` §17.3, rename `CandidateOwner.brand_ambassador.baId` to `brandAmbassadorId` to match `KnowledgeOwner`.

### 2. Align the agent owner identifier

In `KNOWLEDGE_INGESTION_PROTOCOL.md` §17.3, rename `CandidateOwner.agent.agentKey` to `agentId` to match `KnowledgeOwner`.

### 3. Preserve all other fields

`teamMagnificentId`, `momentum_organization`, `governance`, and `system` owner variants remain unchanged.

---

## Impact

Documents affected:

- KNOWLEDGE_INGESTION_PROTOCOL.md

Referenced documents:

- KNOWLEDGE_CORE_RUNTIME.md

No application behavior changes.

No implementation changes required until Version 1.1.

---

## Rationale

`KNOWLEDGE_CORE_RUNTIME.md` owns the canonical ownership model.

Candidate ownership should map one-to-one to knowledge ownership so lineage and ownership transfer cleanly across the ingestion-to-core boundary.

This ACR removes a field-naming mismatch without changing the constitutional architecture.

---

## Approval

Pending
