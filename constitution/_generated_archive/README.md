# Generated Archive — NON-AUTHORITATIVE

**These files are archived. They are not sources of truth and must not be cited as governance.**

The five handbooks in this folder were produced by the `.build-tools/generate-momentum-*.mjs` generators. They totaled ~30,714 lines of which roughly 5–8% was genuine signal; the remainder was a page-template repeated across dozens of “pages” with heavy cross-file duplication. They are retained here for history and traceability only, per Kevin's instruction that they be archived rather than deleted.

Their genuine signal has been extracted and reconciled into the living governance library:

- Org model, Universal Agent Contract, Universal Testing Standard, agent message envelope, Mission Control rule → `constitution/MOMENTUM_GOVERNANCE.md`
- Constitutional principles → `constitution/MOMENTUM_CONSTITUTION.md`
- Decision/precedence material → `constitution/MOMENTUM_DECISION_FRAMEWORK.md`

Authoritative library root: `constitution/MOMENTUM_CONSTITUTION.md`.
Reconciliation of record: `constitution/MOMENTUM_CONSTITUTIONAL_RECONCILIATION_REPORT.md`.

Archived files:
- `MOMENTUM_AI_ORGANIZATION.md`
- `MOMENTUM_EXECUTIVE_SYSTEM.md`
- `MOMENTUM_AGENT_DIRECTORY.md`
- `MISSION_CONTROL_ARCHITECTURE.md`
- `MOMENTUM_AGENT_COMMUNICATION_PROTOCOL.md`
- `MOMENTUM_KNOWLEDGE_CORE.md` — 5,934 lines; header reads “Minimum depth target: 150 pages.” **This file was generated mid-session (2026-06-26) while the constitutional library was being written**, demonstrating that the generators actively repopulate `constitution/` with padded handbooks. Archiving alone will not stop recurrence.

**Recommendation (pending Kevin):** retire or fix the `.build-tools/generate-momentum-*.mjs` generators so they do not regenerate padded handbooks into `constitution/`.
