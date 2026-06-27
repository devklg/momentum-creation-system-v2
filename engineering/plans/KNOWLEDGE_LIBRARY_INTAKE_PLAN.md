# Knowledge Library Intake Plan

Report date: 2026-06-27
Author: Claude (Chief Governance Architect)
Status: **Planning document only. No production code.** Governed by **ACR-0008 (Proposed 2026-06-27)**. Feeds the ratified `runtime/KNOWLEDGE_INGESTION_PROTOCOL.md`, `KNOWLEDGE_CORE_RUNTIME.md`, and `KNOWLEDGE_EVOLUTION_RUNTIME.md`. Implementation is a later sprint (master-plan Phase 8), under the frozen v1.0 architecture.
Frames: Kevin's vision of a continuously curated knowledge library that agents (esp. Michael, Training Agent / Daily Success Coach) draw on to coach and train BAs.

---

## 1. What this is

A **living knowledge library** Kevin adds to continuously — training pages, ideas, recordings, and curated references — that agents retrieve (via the Context Manager) to support the team. This note defines the **intake path**: how a source becomes retrievable, approved knowledge.

---

## 2. First data source (already exists)

GitHub `devklg/team-magnificent-training` (`main`). Two kinds of content already present:

- **Kevin's own training pages** (owned text): `10-steps.html`, `72hour-mission.html`, `onboarding.html`, `product-warm-market.html`, `invitation-art-masterclass.html`, `tm-vision-statement.html`, `prospect.html`, etc.
- **THREE product video catalog** (`video-library.html`): a curated list of THREE International's **public YouTube videos** — GLP THREE launch (Dr. Dan Gubler), product deep-dives (VISAGE, Vitalité, Revíve), shorts, the full-product-line playlist. Each entry already carries title, product, category, type (Deep Dive / Short), duration, description, and the YouTube URL.

This repo is the library's first seed.

---

## 3. Two intake modes (classify at the front door)

Every source is classified on intake so the pipeline knows whether to store bytes or a pointer:

- **Reference intake** — content hosted elsewhere (THREE's public YouTube videos). The knowledge object stores the **URL + metadata**; no bytes hosted, no transcription required for v1 (title + description are enough for retrieval; captions are an optional later enrichment).
- **Owned-media intake** — Kevin's own recordings/videos. The bytes are **hosted** (Mongo GridFS to start — `gridfs_*` already exists in the gateway; object storage if/when volume grows) and a **transcript** is generated (necessary step: agents reason over text, not audio). Transcription: local Whisper on the RTX 4070 Ti (no per-minute cost, private, GPU-first).
- **Owned-text intake** — Kevin's training pages, notes, ideas: parsed/normalized directly into knowledge objects (no hosting, no transcription).

This classification also keeps the library clean of third-party payloads by design: third-party material is referenced, owned material is ingested.

---

## 4. Curation policy — the author's fast lane

Decided 2026-06-27 (Kevin):

- **Kevin-authored / Kevin-curated content goes straight to ACTIVE knowledge** — no review-candidate queue. Kevin's authorship *is* the approval reference the Knowledge Evolution runtime requires. The training pages and the curated THREE video catalog enter active and are immediately available to agents.
- **Agent-generated, transcribed, learned, or auto-ingested content goes to REVIEW-ONLY candidates** (the ratified ingestion default) and is promoted to active by Kevin / designated review.

Fast lane ≠ no record: fast-lane items are still stamped with provenance (source, author, date) and are versioned, so they can be superseded/archived later through the Knowledge Evolution runtime. Curation is the approval, not the absence of a trail.

---

## 5. How a source flows into the library

1. **Classify** (reference / owned-media / owned-text) and capture provenance.
2. **Normalize to text** — parse training HTML; transcribe owned recordings (Whisper); for reference videos, take the catalog metadata (and optionally captions later).
3. **Knowledge object (Mongo)** — one canonical document per item. `source_type` variants: `tm_training_page`, `three_product_video`, `owned_recording`, `note`, `agent_interview`, … carrying content/transcript, product/topic, language, governance/lifecycle status, provenance, and (reference) the URL or (owned) the GridFS/object pointer.
4. **Embed (Chroma)** — title + content/transcript embedded (GPU, 384-dim) for semantic retrieval.
5. **Relate (Neo4j)** — link item ↔ product ↔ topic ↔ BA ↔ source. This graph is what makes it a *library* (connected) rather than a pile (searchable).
6. **Activate** — fast-lane (Kevin-curated) → active immediately; everything else → review-only candidate until promoted.

---

## 6. How agents use it (freeze-correct)

Agents never query the stores directly. Michael's coaching/training session requests a **Context Packet** from the Context Manager, which retrieves the relevant **approved** knowledge (the right training step, the right product video) and assembles it for the session. So "Michael trains with this knowledge" = Context-Manager-mediated retrieval of approved library content — the sanctioned path in `AGENT_RUNTIME.md` / `CONTEXT_MANAGER.md`. Candidate/review-only items are excluded from normal retrieval until activated.

---

## 7. Constraints & governance

- Planning only; no production code here. Implementation runs under the ratified ingestion/evolution protocols in a later sprint.
- Reference-only for third-party content (THREE videos = public YouTube references); owned content is ingested in full. No third-party payloads stored.
- The intake-source classification and the author-fast-lane (curation = approval authority) are knowledge-model rules. **Formalized as ACR-0008 (Proposed 2026-06-27)** — awaiting Kevin's approval before implementation; on approval it produces a decision-ledger entry (ACR §9).
- Persistence: knowledge-object documents follow the system persistence standard (Mongoose models throughout, direct per ACR-0007); Chroma embeddings via the local GPU embedder (no CPU fallback); media bytes in GridFS, never in the triple-stack.
- Compliance backstop is unchanged: the existing `.com` no-claims boundary and master-content checks still apply; Kevin authors within compliance by design (`dec_compliance_severity_mapping`).

---

## 8. Decisions (resolved 2026-06-27, Kevin) & deferred

Resolved — folded into **ACR-0008**:
1. **Owned-media storage: Mongo GridFS to start** (`gridfs_*` already in the gateway); migrate to object storage when video volume grows.
2. **Transcription: local Whisper on the RTX 4070 Ti** (GPU, no per-minute cost, private). Auto-transcripts enter as review-only candidates.
3. **THREE video enrichment: pull public YouTube captions** for the longer videos to deepen retrieval beyond title/description.

Deferred (not blocking):
4. A low-friction capture surface (so Kevin adds knowledge casually and often) — a design item for the ingestion sprint.
