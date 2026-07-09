# Knowledge — Folder Orientation

## Momentum Creation System V2

Status: Non-authoritative orientation (navigational only)

Architecture: Frozen at Version 1.0

This README documents what already exists. It does not define, restate, or alter architecture. It is a pointer, not a source of truth.

---

## Purpose of this folder

The `knowledge/` folder is a placeholder/orientation location. The canonical authority for Momentum's knowledge architecture does **not** live in this folder — it is distributed across ratified runtime specifications, a governance pillar, and the Constitution. This README points to those existing documents so the "Knowledge Layer" and "Knowledge Sessions" concepts can be located.

There is currently **no** standalone `KNOWLEDGE_LAYER.md` and **no** standalone `KNOWLEDGE_SESSIONS.md` document in the repository. Both are referenced concepts whose authority lives in the documents below.

For current session handoff state, see `CONTINUATION_CONTEXT.md`. It is living operational context, not ratified architecture.

---

## Where knowledge authority actually lives

### Ratified runtime knowledge specifications (`runtime/`)

| Document | Role |
| -------- | ---- |
| `runtime/KNOWLEDGE_CORE_RUNTIME.md` | The organizational memory system — canonical/personal/organizational knowledge, lifecycle, MongoDB/Neo4j/Chroma/GraphRAG boundaries, retrieval interfaces. |
| `runtime/KNOWLEDGE_INGESTION_PROTOCOL.md` | How raw experience becomes structured Knowledge Candidates (capture → normalize → classify → segment → risk-check → dedupe → candidate → review-only indexing → graph lineage). |
| `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` | How approved learning becomes active, versioned, indexed, graph-linked, retrievable knowledge. |

### Knowledge governance (repository root)

| Document | Role |
| -------- | ---- |
| `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` | Triple-stack data law — MongoDB canonical / Chroma semantic / Neo4j relationships / GraphRAG grounded. (Authoritative pillar per `constitution/MOMENTUM_MASTER_INDEX.md` §8.) |

### Constitutional principle

| Document | Role |
| -------- | ---- |
| `constitution/MOMENTUM_CONSTITUTION.md` | Integrity-of-memory principle and the boundaries that govern what Momentum may know and preserve. |

### Operational knowledge contracts (`docs/`)

| Document | Role |
| -------- | ---- |
| `docs/graphrag-schema-contract.md` | GraphRAG schema contract. |
| `docs/app-data-model-contract.md` | Application data-model contract. |
| `docs/app-data-model-graph-vocabulary.md` | Reference graph vocabulary. |

### Non-authoritative artifacts (do not cite as governance)

| Document | Role |
| -------- | ---- |
| `docs/reference-manuals/MOMENTUM_KNOWLEDGE_CORE.md` | Generated reference manual — **non-authoritative** compiled artifact. |
| `constitution/_generated_archive/MOMENTUM_KNOWLEDGE_CORE.md` | Archived generated handbook — **non-authoritative**. |

---

## "Knowledge Layer" and "Knowledge Sessions" — what they refer to

- **Knowledge Layer** — the conceptual layer that defines what organizational knowledge is, how it is acquired, categorized, owned, and preserved. Its authority is distributed across the runtime knowledge specifications, `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md`, and the Constitution. It is referenced by the runtime specs as a ratified upstream concept; it has no single standalone file.
- **Knowledge Sessions** — a referenced knowledge **source** (one of the inputs that can produce Knowledge Candidates). It is defined operationally within `runtime/KNOWLEDGE_CORE_RUNTIME.md` and `runtime/KNOWLEDGE_INGESTION_PROTOCOL.md` (as a `knowledge_session` source type) rather than as a standalone document.

---

## Open documentation item

This README records the present state. Whether dedicated standalone `KNOWLEDGE_LAYER.md` / `KNOWLEDGE_SESSIONS.md` documents should be authored is a documentation decision for Kevin Gardner. Per the Architecture Freeze, creating such documents would describe — not change — the frozen v1.0 architecture, and any change to architectural intent would require an approved ACR.

Reference: finding F-4 in `REPOSITORY_READINESS_AUDIT.md`.
