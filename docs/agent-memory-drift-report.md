# Agent Memory Drift Report — `universal_gateway.claude_learning_notes`

> Generated 2026-07-12T01:11:22.911Z by `node server/scripts/generate-memory-index.mjs` (`pnpm memory:index`).
>
> **READ-ONLY.** This report *describes* non-conformance against the canonical
> schema in [ACR-0012 §3.2](governance/ACR-0012-agent-memory-schema.md). Under
> ACR-0012 §4, mutating the existing corpus — backfill, re-grading, renames —
> is explicitly out of scope and requires a separately ratified migration.
> Nothing was modified to produce this report.

## Corpus snapshot

| Metric | Value |
|---|---:|
| Total notes | 606 |
| Ungraded (no `severity`) | 170 |
| Unassigned project (missing or `unassigned`) | 573 |
| Named anchors | 1 |
| Graded `critical` | 195 |
| Graded `high` | 194 |
| Graded `medium` | 44 |
| Graded `low` | 2 |
| Critical-or-high share | 64.2% (target: critical <10%) |
| Severity casing drift (e.g. `HIGH`) | 3 |
| Non-standard severity values | 1 (downgraded_to_partial_truth) |
| No usable date at all | 208 |
| No canonical `created_at` | 207 |

## What a future migration would touch

### Field renames (dialect → canonical)

| Legacy field | Notes carrying it | Migration action |
|---|---:|---|
| `noteId` | 2 | rename to `note_id` |
| `topic` | 8 | rename to `subject` |
| `category` | 543 | rename to `subject` |
| `learned` | 2 | rename to `note` |
| `lesson` | 20 | rename to `note` |
| `content` | 545 | rename to `note` |
| `createdAt` | 2 | rename to `created_at` |
| `timestamp` | 3 | convert to `created_at` (ISO 8601) |
| `date` | 4 | convert to `created_at` (ISO 8601) |
| `chat` | 152 | rename to `chat_number` (integer-only) |

Counts overlap — one note can carry several dialects. `timestamp`/`date`/`chat`
are counted only where the canonical field is absent.

### Grading and assignment backfill

- **170 notes** need a severity grade. Under §3.3 discipline most
  should land `medium`/`low`; bulk-defaulting them to `high` would repeat the
  severity collapse this ACR exists to reverse.
- **573 notes** need a real `project` value. `unassigned`
  is a defect, not a value.
- **3 notes** need only case normalization (`HIGH` → `high`).
- **1 note(s)** carry a severity outside the canonical
  four (downgraded_to_partial_truth) and need a human re-grade —
  not a mechanical coercion.
- **208 notes** have no recoverable date on any known dialect; a
  migration could fall back to the ObjectId timestamp where `_id` is an ObjectId.
- Every note needs `canonical_collection: "universal_gateway.claude_learning_notes"` and a
  `trigger` keyword string where absent.

### Cross-store legs

The canonical write protocol (§3.5) is Mongo → Chroma → Neo4j with read-back.
A migration must also reconcile the Chroma projection (memory-stack
`claude_learning_notes` — the app-stack copy is legacy and must not be
written) using **delete-then-add** (Chroma `add()` does not overwrite), and
re-verify anchor retrieval for every `priority_anchor` note.

## What this report deliberately does not do

- It does not modify, re-grade, rename, or backfill any of the 606 notes.
- It does not touch the app stack (`mongodb2`/`chromadb2`/`neo4j2`).
- It does not decide the migration — that is a separate ratified step.
