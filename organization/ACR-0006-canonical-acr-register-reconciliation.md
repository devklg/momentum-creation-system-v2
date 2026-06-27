# ACR-0006 — Canonical ACR Register Reconciliation

## Momentum Creation System V2

Status: Proposed

Priority: Post-Runtime Ratification

Type: Governance Consistency

Approval: Pending

---

## Purpose

Establish exactly one canonical Architecture Change Request register, under `constitution/acr/`, and remove all parallel ACR tracking elsewhere in the repository.

This ACR proposes the reconciliation. It does not apply it. No files are moved and no register is changed until this ACR is approved.

---

## Motivation

Two ACR registers currently exist:

- `constitution/acr/REGISTER.md` — governed by the ratified `MOMENTUM_ACR_SYSTEM.md`; contains `ACR-001` (3-digit), Released.
- `organization/ACR-REGISTER.md` — created during runtime ratification; contains `ACR-0001`…`ACR-0006` (4-digit), Proposed.

This creates two registers, two folders, and two numbering schemes (`ACR-001` vs `ACR-0001`). It corresponds to findings F-3, F-6, and F-7 in `REPOSITORY_READINESS_AUDIT.md`.

---

## Proposed Changes

### 1. Single canonical register

Designate `constitution/acr/ACR-REGISTER.md` as the only authoritative ACR register, governed by `constitution/MOMENTUM_ACR_SYSTEM.md`.

### 2. Four-digit numbering standard

Adopt the four-digit `ACR-0001` format for all current and future ACRs.

### 3. Resolve the duplicate register

Relocate the four (now six) alignment ACR files into `constitution/acr/`. Convert `organization/ACR-REGISTER.md` to a pointer to the canonical register. Convert the legacy `constitution/acr/REGISTER.md` to a pointer to `ACR-REGISTER.md` so existing references continue to resolve.

### 4. Resolve the `ACR-001` vs `ACR-0001` numbering drift

Per Kevin Gardner's decision (2026-06-27): **grandfather legacy ACR numbering.** Historical ACR documents (for example `ACR-001` Documentation Compilers) are **not** renumbered and remain valid historical records. No migration of historical IDs is required. All future ACRs adopt the four-digit `ACR-0001` format. This avoids dangling references in the Master Index and the decision ledger.

### 5. Resolve version-format consistency (F-6)

Standardize on semantic versioning in document headers so a document's header line matches its ratification block (`1.0` → `1.0.0`). Where this touches a ratified document header, it rides the relevant ratified-document ACR.

---

## Impact

Documents affected:

- organization/ACR-REGISTER.md (governance tracking — becomes a pointer)
- constitution/acr/REGISTER.md (governance tracking — becomes a pointer)
- constitution/acr/ACR-REGISTER.md (new canonical register)
- ACR-0001 … ACR-0006 files (relocated)

Referenced documents:

- constitution/MOMENTUM_ACR_SYSTEM.md
- REPOSITORY_READINESS_AUDIT.md

No runtime behavior changes. Governance-structure consolidation only.

---

## Rationale

A single canonical ACR register with one numbering standard preserves architectural integrity and prevents the exact register drift this audit surfaced.

Routing the reconciliation through the ACR process — rather than an ad-hoc edit — keeps the post-freeze governance discipline intact.

---

## Approval

Pending
