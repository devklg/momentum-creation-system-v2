# DOCUMENTATION COMPILER PROPOSAL

**Prepared by:** Chief Integration Officer (advisory)
**Date:** 2026-06-26
**Status:** Advisory. **The core of this proposal already exists and is RELEASED** as `constitution/acr/ACR-001-documentation-compilers.md` (approved by Kevin, 2026-06-26). This document verifies the existing architecture and proposes only the forward roadmap ACR-001 left open.

> The commissioning brief asks to "create the proposal for converting the existing generators into Documentation Compilers." That conversion is done. Re-proposing it would be re-planning finished work. What follows confirms what exists and scopes what remains.

---

## Part A — Already Built (verified via ACR-001 + disk)

**Purpose.** The `.build-tools/generate-momentum-*.mjs` generators are reclassified from ungoverned document *producers* (which were writing 30k+ lines of padding into `constitution/`) into **Documentation Compilers** that read the living docs and emit non-authoritative reference manuals.

**Architecture.**
```
Living Documents  →  Documentation Compiler  →  Generated Reference Manuals
  (source of truth)        (.build-tools)            (docs/reference-manuals/, build artifacts)
```

**Inputs (source-of-truth mapping, from ACR-001 §3):**

| Manual (output) | Compiled from (living source) |
|---|---|
| Executive manual | Constitution + Decision Framework + Governance |
| Printable handbook | Constitution + Governance |
| Training binder | `TRAINING_ARCHITECTURE` + Governance + orientation/launch docs |
| Developer reference guide | `AGENT_ARCHITECTURE` + `SCHEMA_GOVERNANCE` + `MULTI_DB_AGENT_LEARNING_GOVERNANCE` + `AGENTS.md` |
| AI reference manual | Constitution + Governance + agent contracts + `AGENT_PROMPT_GOVERNANCE` |

**Outputs.** Six manuals compiled to `docs/reference-manuals/` (Mission Control 127pp, Executive System 123pp, Knowledge Core 160pp, plus AI Organization / Agent Directory / Communication Protocol).

**Invariants enforced (verified).**
1. Compilers read living docs; never become the source.
2. Output never lands in `constitution/` — a guard throws if the resolved path contains `constitution`.
3. Every manual carries the non-authoritative banner naming source + compile date.
4. Artifacts are gitignored (not tracked), so recompiling never re-bloats git.

**Status on the ACR state machine:** Released. Rollback is a simple generator revert.

**CIO verification:** confirmed on disk — `docs/reference-manuals/` contains the six manuals + a non-authoritative README + `.gitignore` (`*` except README/gitignore); `constitution/_generated_archive/` holds the retired originals; `constitution/` root holds only living docs. The architecture is real and matches its record.

---

## Part B — Forward Roadmap (the open targets)

The commissioning brief lists generated targets ACR-001 did **not** yet implement: **PDF**, **HTML**, and **future automation**. These are the genuine remaining scope. They should enter as **ACR-002**, not as ad-hoc edits (per the ratified ACR intake).

### B-1 — Render targets (PDF + HTML)
The compilers currently emit Markdown manuals. Add a render stage:
```
living docs → compiler → manual.md → renderer → { manual.pdf, manual.html }
```
- HTML: a styled, navigable single-file binder (the repo already produces print HTML elsewhere, e.g. `docs/RUN_GUIDE.html`, `build-checklist.html` — reuse that toolchain rather than introducing a new one).
- PDF: from the HTML (the repo already ships `RUN_GUIDE.pdf`, `training-sources.pdf` — a working PDF path exists; point the compiler at it).
- All rendered outputs inherit the non-authoritative banner and stay gitignored unless Kevin chooses to track them for distribution.

### B-2 — Compilation pipeline (single entry)
Wrap the three compilers behind one command (e.g. `pnpm docs:compile`) that: reads living docs → compiles all manuals → renders HTML+PDF → writes to `docs/reference-manuals/` → prints a manifest (which living source produced which artifact, with compile timestamp). One command, repeatable, no manual steps.

### B-3 — Generated targets matrix

| Target | Source | Status |
|---|---|---|
| Executive Manual | Constitution + Decision + Governance | **built (md)** → add PDF/HTML |
| Printable Handbook | Constitution + Governance | **built (md)** → add PDF/HTML |
| Training Binder | Training + Governance + orientation | **built (md)** → add PDF/HTML |
| Developer Manual | Agent/Schema/MultiDB/Agents | **built (md)** → add PDF/HTML |
| AI Reference Manual | Constitution + contracts + Prompt gov | **built (md)** → add PDF/HTML |
| PDF render | any manual.md | **proposed (ACR-002)** |
| HTML render | any manual.md | **proposed (ACR-002)** |

### B-4 — Future automation
- A pre-release hook (or CI step) that recompiles binders when any living source changes, so distribution copies never drift from source.
- A provenance check that fails if a binder lacks its source header (ties to Revision Assignment R-7).
- Optional: publish rendered binders to `app.teammagnificent.com` docs space on release.

---

## Recommendation

Do **not** re-propose the compiler architecture — it is Released and correct. **Open ACR-002** for the render targets (PDF/HTML) and the single-command pipeline + automation, reusing the repo's existing HTML/PDF toolchain. Priority: Low–Medium; the binders are already usable as Markdown today.

*End of proposal.*
