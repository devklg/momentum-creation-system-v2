# PROGRAM CONFLICT REPORT

**Prepared by:** Chief Integration Officer (advisory)
**Date:** 2026-06-26
**Status:** Advisory. Conflicts are *identified, not fixed.* Scope honesty: this pass deep-read the **governance/constitutional spine and the generated-doc layer**. Domain specs were classified, not line-audited. Where a category was not exhaustively checked, that is stated rather than reported clean.

> Identify. Do not fix. Kevin and the assigned agencies fix.

---

## Confirmed Conflicts & Hazards

### C-1 — Stale status line (CONFIRMED) · Priority: High
`constitution/MOMENTUM_CONSTITUTIONAL_RECONCILIATION_REPORT.md` ends: *"No constitutional document has been written yet; this is the gate before the root law."* But `MOMENTUM_CONSTITUTION.md`, `GOVERNANCE.md`, `DECISION_FRAMEWORK.md`, and `ACR_SYSTEM.md` **now exist on disk.** The report's status no longer matches reality. Any agent trusting that line would re-plan finished work. This is the single highest-value correction.

### C-2 — Dual copy of generated handbooks (RESOLVED — logged for completeness) · Priority: None
The six handbooks exist in both `constitution/_generated_archive/` (archived originals) and `docs/reference-manuals/` (recompiled). **Verified benign:** `docs/reference-manuals/.gitignore` ignores `*` except README/gitignore, so the binders are *not tracked*. The only committed copy is the archive. No contradiction; no action.

### C-3 — `CLAUDE.md` / `AGENTS.md` byte-identical, no sync guard (CONFIRMED) · Priority: Medium
Per the reconciliation report §5.1, the two files are byte-for-byte identical by design (two tool entrypoints) but nothing enforces they stay in sync. Silent-drift hazard: an edit to one and not the other yields two contradictory "operational laws."

### C-4 — Michael role: principle vs operative (RECONCILED IN INTENT — verify landed) · Priority: Medium
`FOUNDATION.md` Article XI frames Michael as the mentorship archetype. `AGENT_ARCHITECTURE.md` defines the operative role: Steve is the sole New BA Discovery interviewer (non-scored Success Profile); Michael is the Training Agent / Daily Success Coach; the v1 "Michael = interviewer/scorer" model is retired. The reconciliation report's Decision C recommended the Constitution carry both with an explicit note. **Not verified this pass** that the explicit note physically landed in the Constitution body (Article XI region). Action: confirm the note is present; if absent, it is a gap, not a contradiction.

### C-5 — Supreme law unratified (CONFIRMED) · Priority: High (governance)
The Constitution and all three governance siblings read *"awaiting / pending ratification."* The system is currently governed by instruments that are authoritative-in-waiting. Not a contradiction, but agents may cite not-yet-binding law. Resolved by ratification (see Integration Plan Phase 1).

### C-6 — Missing references (CONFIRMED) · Priority: Medium
- `docs/CONSTITUTION_AGENT.md` — referenced conceptually as the charter for the reconciliation role; no standalone authoritative file.
- `docs/MOMENTUM_ARCHITECT_AGENT.md` — named in prior briefs; absent.
- **Master Index** — referenced by the commissioning brief's dependency list; does not exist.

---

## Categories Checked and Found Clean (this pass)

- **Duplicate constitutional documents:** none remaining in the live `constitution/` set — the duplication was in the generated handbooks, now archived.
- **Broken references within the spine read this pass:** none detected. The reference-manuals README correctly cites ACR-001; the dependency map cites real files; the ACR register cites real files.
- **Generated documentation masquerading as authority:** resolved — reference-manuals carry a non-authoritative header and are gitignored.

---

## Categories NOT Exhaustively Audited (declared, not assumed clean)

The following require a domain-level line audit before they can be reported clean. This pass classified the relevant specs as DOMAIN and relied on the constitution's compliance prohibitions; it did **not** re-verify each at line level:

- **Terminology conflicts** across the ~16 domain specs.
- **Workflow conflicts** (e.g., onboarding/orientation/launch-center flow ordering vs. locked-spec).
- **Database conflicts** (triple-stack write contracts vs. SCHEMA_GOVERNANCE vs. app-data-model-contract).
- **Agent conflicts** beyond Michael (full roster boundary cross-check).
- **THREE International overlap / boundary**, **PMV spine**, **Holding Tank authenticity**, **TM ID ownership**, **Prospect CRM boundary**, **Success Profile boundary** — each is *named as protected* in the Constitution and `docs/locked-spec.md`; a dedicated boundary audit confirming code + spec compliance is **outstanding**, not done here.

These are assigned in `PROGRAM_REVISION_ASSIGNMENTS.md` (R-8) as a domain-boundary audit, separate from the spine work.

*End of conflict report.*
