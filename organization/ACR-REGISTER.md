# ACR Register

## Momentum Creation System V2

Version: 1.0

Status: Canonical

Purpose:

This register tracks every proposed, approved, rejected, implemented, and superseded Architecture Change Request (ACR).

No ratified architecture document may be modified outside an approved ACR.

---

| ID       | Title                                          | Canonical Authority            | Status   | Target Version |
| -------- | ---------------------------------------------- | ------------------------------ | -------- | -------------- |
| ACR-0001 | Agent Event Model ← Knowledge Evolution Events | KNOWLEDGE_EVOLUTION_RUNTIME.md | Proposed | v1.1           |
| ACR-0002 | Context Exclusion Type Alignment               | CONTEXT_PACKET_SCHEMA.md       | Proposed | v1.1           |
| ACR-0003 | Candidate Owner / Knowledge Owner Alignment    | KNOWLEDGE_CORE_RUNTIME.md      | Proposed | v1.1           |
| ACR-0004 | Learning Outcome Type Alignment                | LEARNING_PIPELINE.md           | Proposed | v1.1           |
| ACR-0005 | Runtime README Completion for Knowledge Evolution | runtime/README.md           | Proposed | v1.1           |
| ACR-0006 | Canonical ACR Register Reconciliation          | MOMENTUM_ACR_SYSTEM.md         | Proposed | v1.1           |
| ACR-0007 | Runtime Persistence Direct — Gateway Is Dev Tooling Only | locked-spec §3.14 / KNOWLEDGE_CORE_RUNTIME.md | Approved | v1.1 |
| ACR-0008 | Knowledge Library Intake Model — Source Classification / Author Fast-Lane / Media Storage | KNOWLEDGE_INGESTION_PROTOCOL.md | Approved | v1.1 |
| ACR-0009 | Retire Gateway HTTP Persistence Fallback — Direct-Only Runtime Dispatch | ACR-0007 / locked-spec §3.14 | Implemented | v1.1 |
| ACR-0010 | Memory Context Compiler Contract | Context Packet / Knowledge Base runtime contracts | Proposed | v1.2 |
| ACR-0011 | 5 Point Recruiting Cycle — Launch Center + CRM Integration | LAUNCH_CENTER_ARCHITECTURE.md / CRM_ARCHITECTURE.md | Approved | v1.2 |
| ACR-0012 | Implement Knowledge Evolution Runtime v1.0 | runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md | Approved | v1.2 |
| ACR-0013 | Knowledge Evolution Retrieval Canary (single-domain activation) | runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md §21/§37 | Approved | v1.2 |
| ACR-0015 | Event Center Normalized Model Fields | packages/shared/src/event-center.ts / Event Center boundary | Approved | v1.2 |
| ACR-0016 | Explicit Webinar Attendance to Human CRM Follow-up | packages/shared/src/event-center.ts / CRM follow-up | Approved | v1.2 |
| ACR-0017 | Automatic Context Agent Lifecycle Hooks | ACR-0014 / Codex + Claude Code session hooks | Verified | v1.2 |
| ACR-0018 | Unified Human Follow-up Queue | P2-107 / Prospect CRM + VM/RVM | Verified | v1.2 |
| ACR-0019 | Event Email and SMS Reminder Governance | P2-109 / Event Center communication boundary | Approved | v1.2 |
| ACR-0020 | Training Effectiveness Feedback Governance | P2-112 / Training + approved knowledge + outcomes | Proposed | v1.2 |
| ACR-0021 | Steve Success Profile Guidance Projection | P2-118 / Steve + Launch Center read projection | Approved | v1.2 |
| ACR-0022 | Steve Success Profile Extraction Prompt Registration | P2-120 / prompt governance registry | Proposed | v1.2 |
| ACR-0025 | Admin Pagination and Index Awareness | P2-131 / admin high-volume read contracts | Proposed | v1.2 |

---

## Status Definitions

**Proposed** — Drafted but not reviewed.

**Approved** — Ratified by Kevin Gardner.

**Scheduled** — Approved and assigned to a release.

**Implemented** — Applied to the repository.

**Verified** — Successfully audited after implementation.

**Rejected** — Declined.

**Superseded** — Replaced by a newer ACR.

---

## Release Plan

The Target Version column maps each ACR to a disciplined release path that preserves the integrity of the ratified architecture while allowing controlled evolution.

**v1.0 — Architecture Freeze** — The ratified runtime set. No canonical document may change except through an approved ACR recorded in this register.

**v1.1 — First post-freeze architectural refinements** — Consistency ACRs (currently ACR-0001 through ACR-0006) that align cross-document contracts and remove naming, taxonomy, register, and documentation divergence without changing runtime behavior.

**v1.2 — Future enhancements** — New capabilities and architectural additions proposed after v1.1.

An ACR is assigned a Target Version when it moves from Proposed to Scheduled.

---

## Governance Rule

No canonical document may be modified after ratification except through an approved ACR recorded in this register.

This register is the authoritative record of architectural evolution for Momentum Creation System V2.
