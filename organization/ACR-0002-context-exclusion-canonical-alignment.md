# ACR-0002 — Context Exclusion Type Alignment

## Momentum Creation System V2

Status: Proposed

Priority: Post-Runtime Ratification

Type: Architecture Consistency

Approval: Pending

---

## Purpose

Align `CONTEXT_MANAGER.md` with the canonical `ContextExclusion` and `ContextExclusionReason` types exported by `CONTEXT_PACKET_SCHEMA.md`.

`CONTEXT_PACKET_SCHEMA.md` §36 is the canonical type-export authority for the Context Packet contract, including `ContextExclusion` and `ContextExclusionReason`.

`CONTEXT_MANAGER.md` currently defines its own divergent copies of these two types.

This ACR makes the Context Manager adopt the canonical definitions so a single shared type exists.

This ACR introduces architectural consistency only.

It does not change runtime behavior.

---

## Motivation

Both documents are ratified and both define a type named `ContextExclusion` and a type named `ContextExclusionReason`, with different members.

`CONTEXT_MANAGER.md` §21 defines:

- `ContextExclusion` with a required `explanation` field and no `severity`.
- `ContextExclusionReason` using values such as `candidate_excluded_by_default`, `knowledge_not_active`, `knowledge_not_approved`, `knowledge_superseded`, `knowledge_archived`, `language_not_available`, `private_journal_not_owned_by_ba`.

`CONTEXT_PACKET_SCHEMA.md` §26 / §36 defines the canonical:

- `ContextExclusion` with `exclusionId?`, `reason`, `sourceId?`, `itemId?`, `itemType?` (including `private_context`), `note?`, and `severity`.
- `ContextExclusionReason` using values such as `candidate_not_approved`, `wrong_tenant`, `wrong_ba`, `superseded_knowledge`, `archived_knowledge`, `rejected_knowledge`, `risk_flag_unresolved`, `language_mismatch`.

A shared field named `exclusions: ContextExclusion[]` therefore resolves to two incompatible shapes at the producer/packet boundary.

---

## Proposed Changes

### 1. Adopt the canonical `ContextExclusion`

Replace the `ContextExclusion` interface in `CONTEXT_MANAGER.md` §21.2 with the canonical interface exported by `CONTEXT_PACKET_SCHEMA.md` §26.2 / §36 (`exclusionId?`, `reason`, `sourceId?`, `itemId?`, `itemType?`, `note?`, `severity`).

### 2. Adopt the canonical `ContextExclusionReason`

Replace the `ContextExclusionReason` union in `CONTEXT_MANAGER.md` §21.1 with the canonical union exported by `CONTEXT_PACKET_SCHEMA.md` §26 / §36.

### 3. Align the candidate-exclusion reason string

The canonical reason string for candidate exclusion is `candidate_not_approved` (matching `CONTEXT_PACKET_SCHEMA.md` §26.2 and `AGENT_EVENT_MODEL.md` §16.3). Update any `CONTEXT_MANAGER.md` reference that uses `candidate_excluded_by_default` to `candidate_not_approved`.

---

## Impact

Documents affected:

- CONTEXT_MANAGER.md

Referenced documents:

- CONTEXT_PACKET_SCHEMA.md
- AGENT_EVENT_MODEL.md

No application behavior changes.

No implementation changes required until Version 1.1.

---

## Rationale

`CONTEXT_PACKET_SCHEMA.md` is the canonical type-export authority for the Context Packet contract.

The Context Manager produces that contract and must use its canonical types rather than divergent local copies.

This ACR removes a same-name type collision without changing the constitutional architecture.

---

## Approval

Pending
