# PROGRAM REVISION ASSIGNMENTS

**Prepared by:** Chief Integration Officer (advisory)
**Date:** 2026-06-26
**Status:** Advisory. Assignments are *proposed, not executed.* Effort is relative (S/M/L); calendar timelines are deliberately omitted — **[TIMELINE — confirm with Kevin]**.

> Each issue traces to a finding in `PROGRAM_CONFLICT_REPORT.md` or `PROGRAM_STATUS_REPORT.md`.

---

| ID | Agency / Owner | Document | Problem | Reason | Recommendation | Priority | Effort | Depends On |
|---|---|---|---|---|---|---|---|---|
| **R-1** | Constitution Agency | `MOMENTUM_CONSTITUTIONAL_RECONCILIATION_REPORT.md` | Closing status line says no constitutional doc written; four now exist (C-1) | Stale state misleads any agent that trusts it | Update closing status to record the docs were written 2026-06-26; keep the body as historical record | **High** | S | none |
| **R-2** | Kevin (ratifier) | `MOMENTUM_CONSTITUTION` + 3 siblings | All read "pending ratification" (C-5) | System runs on authoritative-in-waiting law | Ratify the package as one act per Article XII; stamp date+version | **High** | S | R-1 |
| **R-3** | Constitution Agency | `MOMENTUM_CONSTITUTION.md` | Michael principle/operative note not verified present (C-4) | Principle (mentor) could be misread as retired v1 interviewer model | Confirm explicit Article XI note pointing to AGENT_ARCHITECTURE; add if missing | Medium | S | none |
| **R-4** | Governance Agency | `docs/CONSTITUTION_AGENT.md` *(new)* | Missing charter (C-6) | The role that produced the library has no standalone authority doc | Write as derived charter under Governance; cite Constitution | Medium | M | R-2 |
| **R-5** | Governance Agency | `docs/MOMENTUM_ARCHITECT_AGENT.md` *(new)* | Missing charter (C-6) | Named in prior briefs; absent | Write as derived charter under Governance | Medium | M | R-2 |
| **R-6** | Integration / CIO | `docs/MASTER_INDEX.md` *(new)* | No master index (C-6) | No single navigational root over the library | Compile index from `SOURCE_OF_TRUTH_HIERARCHY.md` + both dependency maps; mark each doc's class | Medium | M | R-2 |
| **R-7** | Build-Tools / Compiler owner | `.build-tools/generate-momentum-*.mjs` + `reference-manuals/*` | Folder-level provenance only; no per-file source line | A binder taken out of context can't be traced to its living source | Add a per-file header naming the living doc each binder was compiled from | Low | S | none |
| **R-8** | Domain / QA Agency | Domain specs + code | Boundary categories not line-audited (Conflict Report §"NOT audited") | PMV / Holding Tank / CRM / Success Profile / THREE boundaries asserted, not re-verified | Run a dedicated domain-boundary audit; file defects as ACRs | Medium | L | R-2 |
| **R-9** | Build-Tools / CI owner | `CLAUDE.md` / `AGENTS.md` | Byte-identical, no sync enforcement (C-3) | Silent drift yields two contradictory operational laws | Add CI guard or generate one from the other | Low | S | none |

---

## Notes

- **R-2 is the keystone.** Most Medium items depend on a ratified root. Ratification is Kevin's act alone.
- **R-8 is the only Large item** and the only substantial body of *unverified* work; it is independent and parallelizable after R-2.
- No assignment includes deletion. All dispositions are write/append/archive, consistent with the Constitution's preserve-don't-delete stance.
- Effort letters: **S** = single focused edit/doc · **M** = a full derived document · **L** = multi-document audit.

*End of assignments.*
