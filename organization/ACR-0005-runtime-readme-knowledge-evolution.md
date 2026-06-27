# ACR-0005 — Runtime README Completion for Knowledge Evolution

## Momentum Creation System V2

Status: Proposed

Priority: Post-Runtime Ratification

Type: Documentation Consistency

Approval: Pending

---

## Purpose

Bring `runtime/README.md` into agreement with the ratified Runtime Layer, which contains nine specifications.

`runtime/README.md` currently documents only eight runtime specifications and references a deleted implementation-package filename.

`runtime/README.md` is a ratified document. It may be modified only through an approved ACR. This ACR proposes the correction; it does not apply it.

---

## Motivation

The Runtime Layer contains nine ratified specifications, but `runtime/README.md` omits `KNOWLEDGE_EVOLUTION_RUNTIME.md` from:

- §5 Runtime Documents list
- §6 Runtime Dependency Order
- §15 Runtime Document Responsibilities (§15.1–§15.8 stop at Learning Pipeline)

Separately, §5 references `/implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP.md`, which was removed; the live file is `IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP_UPDATED.md`.

These correspond to findings F-1 and F-2 in `REPOSITORY_READINESS_AUDIT.md`.

---

## Proposed Changes

### 1. Add Knowledge Evolution Runtime to the document list (§5)

Add `/runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` to the Runtime Documents list.

### 2. Add Knowledge Evolution Runtime to the dependency order (§6)

Place Knowledge Evolution Runtime in the runtime dependency order after Learning Pipeline (it activates approved learning produced by the Learning Pipeline).

### 3. Add a responsibilities subsection (§15)

Add a `§15.9 KNOWLEDGE_EVOLUTION_RUNTIME.md` subsection summarizing its responsibilities (approved-knowledge activation, versioning, supersession, archival, reindex, graph sync, retrieval rollout, rollback).

### 4. Correct the implementation-package reference (§5)

Update `/implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP.md` to `/implementation/IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP_UPDATED.md`.

---

## Impact

Documents affected:

- runtime/README.md (ratified — change permitted only on approval of this ACR)

Referenced documents:

- KNOWLEDGE_EVOLUTION_RUNTIME.md
- IMPLEMENTATION_PACKAGE_001_KNOWLEDGE_AGENT_MVP_UPDATED.md

No runtime behavior changes. Documentation alignment only.

---

## Rationale

The Runtime Layer README must accurately enumerate the ratified runtime specifications and resolve to live paths so Codex reads a complete and correct map.

This ACR aligns the README with the ratified runtime set without changing any specification.

---

## Approval

Pending
