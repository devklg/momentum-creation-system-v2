# PROGRAM INTEGRATION PLAN

**Prepared by:** Chief Integration Officer (advisory)
**Date:** 2026-06-26
**Status:** Advisory executive strategy. Sequencing only — no execution performed.

> Because ~85% of the integration is already executed, this plan is short. It closes the remaining gaps in dependency order and routes the program to ratification.

---

## Guiding Principle

Integrate in dependency order: nothing downstream is ratified before the thing it depends on. The Constitution is the root; everything else waits on it. No new architecture is created — only the named gaps are closed and the spine is ratified.

---

## Phase 0 — Truth Reconciliation (do first, fast)

The goal is to make every document's status line match disk, so no one re-plans finished work.

- Correct C-1: update the reconciliation report's closing status to record that the recommended documents were written (2026-06-26).
- Confirm C-4: verify the Michael principle/operative note physically landed in the Constitution; if not, flag for the Constitution agency.
- **Acceptance:** no document in `constitution/` claims a state contradicted by disk.

## Phase 1 — Ratification of the Governance Package

The package is written and coherent; it only lacks Kevin's ratification.

- Ratify in order, as one act: `MOMENTUM_CONSTITUTION` → `MOMENTUM_GOVERNANCE` → `MOMENTUM_DECISION_FRAMEWORK` → `MOMENTUM_ACR_SYSTEM`.
- Record ratification per Constitution Article XII (date, version, Kevin's authority).
- **Acceptance:** all four status lines read *Ratified*, with date and version. The dual-authority model and supremacy clause become binding, not provisional.

## Phase 2 — Close the Missing Instruments

With the root ratified, write the derived charters it governs.

- `docs/CONSTITUTION_AGENT.md` — derived charter under Governance (the role that produced the library).
- `docs/MOMENTUM_ARCHITECT_AGENT.md` — derived charter under Governance.
- **Master Index** — a navigational root listing every living/compiled/archived document with its class and source-of-truth status (folds in `SOURCE_OF_TRUTH_HIERARCHY.md` + both dependency maps).
- **Acceptance:** each new charter cites the Constitution as authority and passes the same lifecycle (audit → inventory → reconciliation → gap → write).

## Phase 3 — Hygiene Guards

- Add a sync guard for `CLAUDE.md`/`AGENTS.md` (CI check or generate-one-from-the-other).
- Add per-file provenance headers to compiled reference-manuals (which living doc each was compiled from).
- **Acceptance:** an intentional desync of the two operational-law files fails a check; every binder names its source.

## Phase 4 — Domain-Boundary Audit (separable, parallelizable)

The one substantial body of *unverified* work. Independent of Phases 1–3 and can run in parallel after Phase 1.

- Line-audit the protected boundaries named in the Constitution and locked-spec: PMV spine, Holding Tank authenticity, TM ID ownership, Prospect CRM boundary, Success Profile boundary (non-scoring), THREE International boundary, the five `.com` compliance prohibitions.
- Cross-check terminology, workflow ordering, and database/write-contract consistency across the ~16 domain specs.
- **Acceptance:** a boundary-audit report confirming spec + code compliance, or a defect list assigned via ACR.

---

## Sequencing Summary

| Order | Phase | Depends on | Can parallelize? |
|---|---|---|---|
| 1 | Phase 0 — Truth Reconciliation | nothing | — |
| 2 | Phase 1 — Ratification | Phase 0 | no (gating) |
| 3 | Phase 2 — Missing instruments | Phase 1 | charters parallel to each other |
| 4 | Phase 3 — Hygiene guards | Phase 1 | yes (parallel w/ Phase 2) |
| 5 | Phase 4 — Domain-boundary audit | Phase 1 | yes (parallel w/ Phase 2–3) |

---

## Risk Mitigation

- **Re-bloat risk:** the compilers can re-pad. ACR-001 already constrains them and reference-manuals is gitignored. Keep it that way; do not commit binders.
- **Premature authority:** until Phase 1, mark every reliance on the governance package as provisional.
- **Scope creep:** no new architecture. If a Phase reveals a desired new capability, route it through an ACR, do not fold it into integration.

---

## Recommended Architecture Sequence

No architectural sequencing is required to integrate — the architecture exists and is classified. The only "architecture" action is **adopting the ACR System as the single intake** for all future shape-changes once ratified, so the next change (whatever it is) enters as ACR-002 rather than as an ad-hoc edit.

*End of plan.*
