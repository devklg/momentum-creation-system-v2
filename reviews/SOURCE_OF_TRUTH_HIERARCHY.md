# SOURCE OF TRUTH HIERARCHY

**Prepared by:** Chief Integration Officer (advisory)
**Authority:** Subordinate to `constitution/MOMENTUM_CONSTITUTION.md`.
**Date:** 2026-06-26
**Status:** Advisory. Describes verified actual state on disk.

---

## The Definitive Hierarchy

```
Kevin L. Gardner  (Constitutional Authority — above every layer)
        ↓
FOUNDATION.md  (Founding Charter — HISTORICAL source; origin & intent)
        ↓ descends into
MOMENTUM_CONSTITUTION.md  (LIVING principle — whether / why)
        ↓
MOMENTUM_GOVERNANCE.md · MOMENTUM_DECISION_FRAMEWORK.md · MOMENTUM_ACR_SYSTEM.md
        (LIVING governance — who / how decided / how changed)
        ↓
Architecture (LIVING domain law)
  AGENT_ARCHITECTURE · SCHEMA_GOVERNANCE · MULTI_DB_AGENT_LEARNING_GOVERNANCE ·
  AGENT_PROMPT_GOVERNANCE · PMV / CRM / COMMUNITY / HOLDING_TANK / domain specs
        ↓
Implementation (operational currency — what is currently built)
  docs/locked-spec.md > docs/build-registry.md > project-wireframe > git log > chat registry > handoffs
        ↓
Testing (whether a change is safe to ship)
  typecheck · manual flows · QA gates · release gates
        ↓ evidence back up to → ACR / Decision Framework

[ COMPILED — OUTSIDE THE HIERARCHY, NON-AUTHORITATIVE ]
  docs/reference-manuals/*  (binders compiled FROM the living docs above)
```

**The cross-layer rule:** a lower layer may never contradict a higher one. The operational-currency chain decides *what is current*; the Constitution decides *whether what is current is allowed.* Kevin sits above all layers.

---

## Document Classification

Legend: **LIVING** = current source of truth · **HISTORICAL** = preserved origin, superseded · **COMPILED** = generated output, non-authoritative · **ARCHIVED** = retired, reversible · **OPERATIONAL** = current-state currency, not principle.

| Document | Class | Source of truth for |
|---|---|---|
| `FOUNDATION.md` | **HISTORICAL** | Origin, intent, the 23 founding articles (superseded as *operative* law by the Constitution) |
| `constitution/MOMENTUM_CONSTITUTION.md` | **LIVING** | Principle — supreme authority (whether/why) |
| `constitution/MOMENTUM_GOVERNANCE.md` | **LIVING** | Org structure, Universal Agent Contract, escalation |
| `constitution/MOMENTUM_DECISION_FRAMEWORK.md` | **LIVING** | How any decision is made and recorded |
| `constitution/MOMENTUM_ACR_SYSTEM.md` | **LIVING** | How the platform's shape is changed |
| `constitution/CONSTITUTION_DEPENDENCY_MAP.md` | **LIVING** (navigational) | How the library fits together (subordinate to Constitution) |
| `constitution/acr/ACR-001-*` + `REGISTER.md` | **LIVING** (record) | The change-control ledger |
| `AGENTS.md` / `CLAUDE.md` | **LIVING** (operational law) | Agent run-rules; source-of-truth precedence chain |
| `SCHEMA_GOVERNANCE`, `MULTI_DB_AGENT_LEARNING_GOVERNANCE`, `AGENT_ARCHITECTURE`, `AGENT_PROMPT_GOVERNANCE` | **LIVING** (architecture) | System shape, schemas, agent lifecycle, prompt contracts |
| Domain specs (`PMV`, `CRM`, `COMMUNITY`, `HOLDING_TANK`, `LAUNCH_CENTER`, `ORIENTATION`, `TRAINING`, `RESOURCE_CENTER`, `EVENT_CENTER`, `RECOMMENDATION_ENGINE`, `NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC`, `MASTER_UX_IMPLEMENTATION_SPEC`, `VM_LEAD_CAMPAIGN_*`, `BA_SUPPORT_AGENTS`) | **LIVING** (domain) | Their named domain; referenced by, subordinate to, the constitution |
| `docs/locked-spec.md`, `docs/build-registry.md`, `docs/project-wireframe.md` | **OPERATIONAL** | What is currently built / current decisions |
| `constitution/MOMENTUM_CONSTITUTIONAL_RECONCILIATION_REPORT.md` | **HISTORICAL** (record) | The reconciliation that authorized the Constitution. *Its closing status line is stale — see Conflict Report C-1.* |
| `docs/reference-manuals/*` (AI Organization, Mission Control, Knowledge Core, Agent Directory, Executive System, Communication Protocol) | **COMPILED** | Nothing. Build artifacts. Gitignored. Cite the living source instead. |
| `constitution/_generated_archive/*` | **ARCHIVED** | Nothing. Retired originals, preserved reversibly. |

---

## Rules for Citing Authority

1. **Never cite a COMPILED or ARCHIVED document as governance.** If a binder says something the living document does not, the binder is wrong.
2. **Never cite an OPERATIONAL document to settle a question of principle.** locked-spec says what is *built*, not what is *allowed*.
3. **FOUNDATION is quoted for intent, the Constitution for law.** Where they are read together, FOUNDATION supplies origin; the Constitution supplies operative authority.
4. **A document marked "pending ratification" is authoritative-in-waiting.** Until ratified, flag any reliance on it as provisional (currently applies to the whole governance package).

*End of hierarchy.*
