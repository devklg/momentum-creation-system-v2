# MOMENTUM MASTER INDEX

## The Living Master Index of the Momentum Creation System V2 Documentation System

**Version:** 1.0.0
**Authority:** Subordinate to `constitution/MOMENTUM_CONSTITUTION.md`. This is a **navigational and classification instrument**, not a source of truth. When it disagrees with the Constitution or any governing document, the higher instrument wins.
**Constitutional Authority:** Kevin L. Gardner — sole and final
**Prepared by:** Agency 5 — Documentation Systems Agency (advisory)
**Date:** 2026-06-26
**Status:** Advisory. Describes **verified actual state read from `D:/momentum-creation-system-v2` on 2026-06-26**, not assumed state. No files were moved, renamed, archived, or deleted.

> Agency 5 indexes and classifies. It does not author law, rewrite the Constitution, or create platform architecture. It cross-references; it does not restate. Generated manuals are catalogued as artifacts, never as authority. Kevin decides.

---

## 1. Executive Summary

The Momentum constitutional library is **ratified and coherent.** Audited on disk: the living Constitution (`MOMENTUM_CONSTITUTION.md` v2.1.0, ratified 2026-06-26) sits at the root, descending from the preserved Founding Charter (`MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md` v2.0). Three governance instruments — Governance, Decision Framework, ACR System — are ratified beneath it (each v1.0.0, in force). The first Architectural Change Request (ACR-001) is RELEASED, and the document generators it governs have been reclassified as Documentation Compilers writing non-authoritative build artifacts to `docs/reference-manuals/`.

The system's true governing spine is small: **one Constitution, three governance instruments, four architecture pillars, one operational-law twin (`AGENTS.md`/`CLAUDE.md`), and ~16 domain architecture specs that the Constitution references rather than restates.** Everything else is implementation state, advisory review, generated artifact, or historical record.

This index catalogues every document found, classifies it into the ten required categories, and surfaces the staleness, duplication, and gap findings the Documentation Health Report details. **The documentation system is ready for Architect Review with a small set of mechanical fixes** (Section 25), the most material of which is that the four architecture pillars and most domain specs still name the *Founding Charter* as their "Constitutional Authority" rather than the living Constitution that now supersedes it.

---

## 2. Source-of-Truth Hierarchy

Verified against `reviews/SOURCE_OF_TRUTH_HIERARCHY.md` and the Constitution's own Authority Hierarchy. This is the spine; all classification below hangs from it.

```
Kevin L. Gardner            — Constitutional Authority, above every layer
        v
FOUNDATION.md               — Founding Charter (HISTORICAL; origin & intent; amended by nothing)
        v descends into
MOMENTUM_CONSTITUTION.md     — LIVING principle (whether / why) — supreme root
        v
GOVERNANCE · DECISION_FRAMEWORK · ACR_SYSTEM   — LIVING governance (who / how decided / how changed)
        v
Architecture pillars + domain specs            — system shape, contracts, schemas, prompts, surfaces
        v
Implementation state (locked-spec > build-registry > project-wireframe > code)
        v
Testing / QA evidence  — feeds back up to ACR + Decision gates
```

Two precedence orders operate, reconciled by the **dual-authority model** (Constitution Article VI; Decision Framework §2):
- **Constitutional layer** — *whether / why.* Authority: the Constitution. Vetoes on principle. Changes rarely.
- **Operational-currency chain** — *what is currently true.* `decision ledger > docs/locked-spec.md > design docs > docs/build-registry.md > git log > Gateway chat registry > handoffs`, backed by Mongo `momentum.decisions`, `momentum.work_queue_leaves`, `momentum.agent_status`. Changes constantly.

The operational layer decides what is current; the constitutional layer decides whether what is current is allowed. Kevin sits above both.

---

## 3. Constitutional Library — *Living constitutional authority + Historical charter*

| Document | Path | Version | Status | Class |
|---|---|---|---|---|
| The Momentum Constitution | `constitution/MOMENTUM_CONSTITUTION.md` | 2.1.0 | Ratified, in force | **Living constitutional authority (supreme root)** |
| Founding Charter | `MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md` | 2.0 | Preserved, historical | **Historical Founding Charter** (origin & intent; do not amend) |
| Constitutional Reconciliation Report | `constitution/MOMENTUM_CONSTITUTIONAL_RECONCILIATION_REPORT.md` | — | Advisory, of record | Constitutional basis (audit/inventory/reconciliation) |
| Constitution Dependency Map | `constitution/CONSTITUTION_DEPENDENCY_MAP.md` | — | Navigational aid | Constitutional navigation |

The Constitution carries: Preamble; Articles I–XII; six core principles; the Five Prohibitions on `.com`; the dignity/no-scoring boundary; sponsor immutability; THREE-as-upstream-authority; AI-never-the-center; integrity-of-memory; the Kevin Override Model; the dual-authority model; the Future-Development Test; constitutional risk analysis; and amendment/versioning. **Do not duplicate its content anywhere; cross-reference it.**

---

## 4. Governance Library — *Governance instruments (Tier 1–2, living)*

| Document | Path | Version | Status | Class |
|---|---|---|---|---|
| Momentum Governance | `constitution/MOMENTUM_GOVERNANCE.md` | 1.0.0 | Ratified, in force | Governance instrument (org operating system) |
| Momentum Decision Framework | `constitution/MOMENTUM_DECISION_FRAMEWORK.md` | 1.0.0 | Ratified, in force | Governance instrument (how decisions are made/recorded) |
| Momentum ACR System | `constitution/MOMENTUM_ACR_SYSTEM.md` | 1.0.0 | Ratified, in force | Governance instrument (how the platform's shape changes) |

Governance holds: the 12 governed areas + reporting lines; the **Universal Agent Contract** (9 clauses); the **Universal Testing Standard** (8 tests); the agent roster (mission + boundaries only); the permission/escalation model; the agent message envelope + state machine; delivery governance (worktree, append-only, *Kevin merges*); the Mission Control Rule. Decision Framework holds the dual-authority model applied, the currency chain, the decision ledger, the Future-Development Test as a veto, and the authority matrix. ACR System holds the ACR record, state machine, five gates, versioning/rollback, and risk classification.

---

## 5. Architecture Library — *Architecture source documents*

### 5.1 Governance pillars (authoritative, cross-referenced by the Constitution)

| Document | Path | Cites authority as | Class |
|---|---|---|---|
| Agent Architecture | `AGENT_ARCHITECTURE.md` | FOUNDATION (warn) | Pillar — agent lifecycle, permissions, Steve/Michael roles |
| Schema Governance | `SCHEMA_GOVERNANCE.md` | FOUNDATION (warn) | Pillar — one concept = one canonical schema |
| Multi-DB Agent Learning Governance | `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` | FOUNDATION (warn) | Pillar — triple-stack data law |
| Agent Prompt Governance | `AGENT_PROMPT_GOVERNANCE.md` | FOUNDATION (warn) | Pillar — prompts as versioned contracts |

(warn) = still names the Founding Charter as "Constitutional Authority"; should descend from the living Constitution (see §15/§16 and Health Report).

### 5.2 Operational law (authoritative twins)

| Document | Path | Class |
|---|---|---|
| Codex operating law | `AGENTS.md` | Operational law — currency chain, compliance, triple-stack, merge discipline |
| Claude operating law | `CLAUDE.md` | Operational law — **byte-identical twin of `AGENTS.md`** (sync-drift hazard; see §16) |

### 5.3 Domain / surface architecture (referenced, not restated)

| Document | Path | Notes |
|---|---|---|
| PMV (Prospect Momentum Viewer) | `PMV_ARCHITECTURE.md` | Awareness without surveillance; no prospect-facing scoring |
| CRM | `CRM_ARCHITECTURE.md` | Relationship/Momentum/Success CRM; Prospect CRM boundary |
| Community | `COMMUNITY_ARCHITECTURE.md` | Community ecosystem |
| Training | `TRAINING_ARCHITECTURE.md` | `.team` training path |
| Holding Tank / Position & Momentum Center | `HOLDING_TANK_ARCHITECTURE.md` | Reconciled 2026-06-24; authenticity / monotonic position |
| Orientation | `ORIENTATION_ARCHITECTURE.md` | Education surface |
| Launch Center | `LAUNCH_CENTER_ARCHITECTURE.md` | Education surface |
| Resource Center | `RESOURCE_CENTER_ARCHITECTURE.md` | Education surface |
| Event Center | `EVENT_CENTER_ARCHITECTURE.md` | Education surface |
| Recommendation Engine | `RECOMMENDATION_ENGINE_ARCHITECTURE.md` | Recommendation logic |
| New BA Discovery / Success Interview Spec | `NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md` | Reconciled 2026-06-24; Steve = sole interviewer, non-scored profile |
| Master UX Implementation Spec | `MASTER_UX_IMPLEMENTATION_SPEC.md` | Synthesizes `docs/v2-redesign/*`; implementation plan, not a rebuild authorization |
| VM Lead Campaign — Module Architecture | `docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md` | Prospect-before-enrollment boundary |
| BA Support Agents Architecture | `docs/BA_SUPPORT_AGENTS_ARCHITECTURE.md` | `.team`/`.admin`/server agents |

---

## 6. Agent Library — *Agent specifications*

| Document | Path | Class |
|---|---|---|
| Agent Architecture (master) | `AGENT_ARCHITECTURE.md` | Authoritative agent law (lifecycle, permissions, boundaries) |
| Agent Prompt Governance | `AGENT_PROMPT_GOVERNANCE.md` | Prompt-contract governance |
| Momentum Architect Agent Spec | `docs/MOMENTUM_ARCHITECT_AGENT.md` | Agent charter — architecture guardrail. **NOW PRESENT** (was listed MISSING in the reconciliation report; that report is stale on this point) |
| Constitution Agent Spec | `docs/CONSTITUTION_AGENT.md` | Agent charter — constitutional/boundary review. **NOW PRESENT** (same correction) |
| BA Support Agents Architecture | `docs/BA_SUPPORT_AGENTS_ARCHITECTURE.md` | Multi-agent implementation spec |

**Constitutional purpose of each agent** lives in Constitution Article VIII; **mission + boundaries** in Governance §4; **operative behavior** in `AGENT_ARCHITECTURE.md`. Steve (sole New BA Discovery interviewer, non-scored Success Profile) and Michael (Training Agent / Daily Success Coach, post-Steve, non-scoring — legacy interviewer model **retired**) are reconciled consistently across Constitution §8.2–8.3, Governance §4, `AGENT_ARCHITECTURE.md`, and `NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md`.

---

## 7. VM / CRM / PMV / Holding Tank Documents

| Concern | Authoritative document(s) | Boundary preserved |
|---|---|---|
| Prospect Momentum Viewer | `PMV_ARCHITECTURE.md` | Guidance not surveillance; no prospect-facing scoring (Const. §4.6, §7.5) |
| Prospect CRM | `CRM_ARCHITECTURE.md`, `docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md` | **Prospect CRM boundary** — Momentum manages prospects *before* enrollment; THREE manages records *after* (Const. §7.4) |
| Holding Tank / Position & Momentum Center | `HOLDING_TANK_ARCHITECTURE.md` + `docs/locked-spec.md` | **Holding Tank authenticity** — compass not scoreboard; position monotonic, never renumbered (Const. §4.3–4.4) |
| Success Profile | `NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC.md` | **Success Profile boundary** — non-scored; no Builder/Part-Time/Casual labels (Const. §7.1, §8.2) |
| VM lead campaign | `docs/VM_LEAD_CAMPAIGN_MODULE_ARCHITECTURE.md`, `docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md` | No AI prospect-calling/qualification (Const. §7.5) |
| THREE International | all prospect-facing specs | **THREE boundary** — THREE is upstream authority; no THREE branding on `.com`; no programmatic enrollment (Const. §7.2, §7.4) |
| TM ID ownership | `docs/locked-spec.md`, `CRM_ARCHITECTURE.md` | **TM ID ownership** — sponsor immutability; sponsor captured at token/code, never recomputed (Const. §7.3) |

---

## 8. Knowledge Core Documents

| Document | Path | Class |
|---|---|---|
| Multi-DB Agent Learning Governance | `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` | Authoritative — Mongo canonical / Chroma semantic / Neo4j relationships / GraphRAG grounded |
| GraphRAG schema contract | `docs/graphrag-schema-contract.md` | Operational contract |
| App data-model contract | `docs/app-data-model-contract.md` | Operational data-model contract |
| App data-model findings | `docs/app-data-model-FINDINGS.md` | Advisory findings |
| App data-model graph vocabulary | `docs/app-data-model-graph-vocabulary.md` | Reference vocabulary |
| Chat registry authority | `docs/chat-registry-authority.md` | Operational — registry identity authority |
| Handoff contract | `docs/handoff-contract.md` | Operational — handoff artifact shape |
| Universal Gateway V2 standard | `docs/UNIVERSAL_GATEWAY_V2_STANDARD.md` | Infrastructure standard |
| Momentum Knowledge Core (compiled) | `docs/reference-manuals/MOMENTUM_KNOWLEDGE_CORE.md` | **Generated artifact — NON-AUTHORITATIVE** (160 pages) |

---

## 9. Mission Control / Admin Documents

| Document | Path | Class |
|---|---|---|
| Mission Control Rule | `constitution/MOMENTUM_GOVERNANCE.md` §12 | **Authoritative rule** — Mission Control *is* the existing `/dashboard`; no second dashboard |
| Administrator Guide | `docs/ADMINISTRATOR_GUIDE.md` | Operational |
| Admin CDE integration follow-ups | `docs/admin-cde-integration-followups.md` | Operational follow-up list |
| Team Magnificent ADMIN Design | `docs/Team-Magnificent-ADMIN-Design.docx` | Surface design reference (`.docx`) |
| Mission Control Architecture (compiled) | `docs/reference-manuals/MISSION_CONTROL_ARCHITECTURE.md` | **Generated artifact — NON-AUTHORITATIVE** (127 pages) |
| Momentum Executive System (compiled) | `docs/reference-manuals/MOMENTUM_EXECUTIVE_SYSTEM.md` | **Generated artifact — NON-AUTHORITATIVE** (123 pages) |

---

## 10. Implementation Plans

| Document | Path | Class |
|---|---|---|
| Locked Spec | `docs/locked-spec.md` | **Authoritative operational state** (#2 on currency chain) |
| Build Registry | `docs/build-registry.md` | Authoritative artifact index (warn) *header still says "v1"* (see §16) |
| Project Wireframe | `docs/project-wireframe.md` | Authoritative build map (leaf status) |
| Complete-App Implementation Plan | `docs/IMPLEMENTATION_PLAN_COMPLETE_APP_2026-06-23.md` | Implementation plan |
| VM Lead Campaign Implementation Plan | `docs/VM_LEAD_CAMPAIGN_IMPLEMENTATION_PLAN.md` | Implementation plan |
| Master UX Implementation Spec | `MASTER_UX_IMPLEMENTATION_SPEC.md` | Implementation plan (v2 redesign) |
| Implementation Tasks | `IMPLEMENTATION_TASKS.md` | Task list |
| Server Route Tasklist | `docs/SERVER_ROUTE_TASKLIST.md` (+ `.html`) | Implementation tasklist |
| Agent Work Orchestration Prompt | `docs/AGENT_WORK_ORCHESTRATION_PROMPT.md` | Agent build prompt |
| AI Organization Program Setup | `docs/AI_ORGANIZATION_PROGRAM_SETUP.md` | Program setup ("Momentum Genesis") |
| Agent briefs (worktree) | `docs/agent-briefs/brief-{g-broadcast,h-server,h-ui,i-export}.md` | Scoped worktree task briefs |
| Build plan / checklist | `docs/build-plan.md`, `docs/build-checklist.html` | (warn) Older planning artifacts; superseded by `project-wireframe.md` |

---

## 11. Testing / QA Documents

| Document | Path | Class |
|---|---|---|
| Universal Testing Standard | `constitution/MOMENTUM_GOVERNANCE.md` §8 | **Authoritative** — 8 mandatory agent tests |
| Testing & Release Gates | `constitution/MOMENTUM_GOVERNANCE.md` §10, `MOMENTUM_ACR_SYSTEM.md` §5 | **Authoritative** gates |
| Deployment & Realtime Test Guide | `docs/DEPLOYMENT_AND_REALTIME_TEST_GUIDE_2026-06-24.md` (+ `.html`) | Test guide |
| App State Audit / Print Checklist | `docs/APP_STATE_AUDIT_PRINT_CHECKLIST_2026-06-23.md` | QA checklist |
| App Completion Audit | `docs/APP_COMPLETION_AUDIT_2026-06-24.md` | QA audit |
| App Schema Relationship Map | `docs/APP_SCHEMA_RELATIONSHIP_MAP_2026-06-24.html` | QA reference |
| Testing links | `docs/testing-links.md` | Test reference |
| Route inventory (print + numbered) | `docs/MCS-v2-route-inventory-2026-06-26*.docx`, `docs/route-inventory-print.md` | QA route inventory |
| Platform Audit | `PLATFORM_AUDIT.md` | **Repository-grade audit** — correctly cites the living Constitution |

> **Note:** No automated test runner is wired. Verification is repo-wide `pnpm typecheck` + end-to-end manual flow + persistence read-back (Governance §10). "Done" requires evidence, never assertion.

---

## 12. ACR System and Change Records

| Document | Path | Class |
|---|---|---|
| ACR System (process) | `constitution/MOMENTUM_ACR_SYSTEM.md` | Governance instrument |
| ACR Register | `constitution/acr/REGISTER.md` | Change-request index |
| ACR-001 — Documentation Compilers | `constitution/acr/ACR-001-documentation-compilers.md` | **RELEASED** change record (first completed governance pass) |
| Decision ledger | Mongo `momentum.decisions` (e.g. `dec_documentation_compilers`) | Operational currency (top of chain) |

---

## 13. Generated Reference Manuals — *Build artifacts, NON-AUTHORITATIVE*

All produced by the Documentation Compilers (`.build-tools/generate-momentum-*.mjs`) per ACR-001. Each carries the banner *"Generated Reference Manual — Not Constitutional Authority."* Output is **gitignored** (Kevin's open decision to track or not).

| Artifact | Path | Compiled from |
|---|---|---|
| Momentum AI Organization | `docs/reference-manuals/MOMENTUM_AI_ORGANIZATION.md` | Constitution + Governance |
| Momentum Agent Directory | `docs/reference-manuals/MOMENTUM_AGENT_DIRECTORY.md` | Governance + agent contracts |
| Momentum Agent Communication Protocol | `docs/reference-manuals/MOMENTUM_AGENT_COMMUNICATION_PROTOCOL.md` | Governance §6 |
| Mission Control Architecture | `docs/reference-manuals/MISSION_CONTROL_ARCHITECTURE.md` | Governance + admin |
| Momentum Executive System | `docs/reference-manuals/MOMENTUM_EXECUTIVE_SYSTEM.md` | Constitution + Decision + Governance |
| Momentum Knowledge Core | `docs/reference-manuals/MOMENTUM_KNOWLEDGE_CORE.md` | Constitution + Governance + contracts |
| Reference-manuals README | `docs/reference-manuals/README.md` | Non-authoritative banner of record |

**Rule (ACR-001):** compilers read living docs; output never lands in `constitution/`; a guard trips if it would. These may not be cited as governance.

---

## 14. Historical / Archived Documents

| Document | Path | Class |
|---|---|---|
| Founding Charter | `MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md` | Historical charter (preserved, do not amend) |
| Retired generated handbooks (6) | `constitution/_generated_archive/{MOMENTUM_AI_ORGANIZATION, MOMENTUM_EXECUTIVE_SYSTEM, MOMENTUM_AGENT_DIRECTORY, MISSION_CONTROL_ARCHITECTURE, MOMENTUM_AGENT_COMMUNICATION_PROTOCOL, MOMENTUM_KNOWLEDGE_CORE}.md` + `README.md` | Archived, non-authoritative (reversible) |
| Chat-decision records | `docs/chat-85-decisions.md`, `chat-105-decisions.md`, `chat-109-decisions.md`, `chat84-vs-docs.md`, `chat-94-locked-spec-rewrite.txt` | Historical decision record |
| Production Version blueprint | `MOMENTUM_CREATION_SYSTEM_V2_PRODUCTION_VERSION.md` | Historical/reference blueprint |
| v2-redesign reviews | `docs/v2-redesign/*` (BRAND_VISUAL, DASHBOARD_UX, IVORY_INVITATION_AGENT, PROSPECT_MOMENTUM_VIEWER, TEAM_ONBOARDING reviews) | Source reviews synthesized into `MASTER_UX_IMPLEMENTATION_SPEC.md` |
| Dashboard prototype | `docs/dashboard-prototype.md` | Early prototype notes (intent reference) |

---

## 15. Missing Documents

Confirmed by audit. Two previously-"missing" items now exist.

| Item | Status |
|---|---|
| `docs/MOMENTUM_ARCHITECT_AGENT.md` | **NO LONGER MISSING** — present on disk (reconciliation report stale on this) |
| `docs/CONSTITUTION_AGENT.md` | **NO LONGER MISSING** — present on disk (same) |
| **This Master Index** | Created by this agency (`constitution/MOMENTUM_MASTER_INDEX.md`) |
| **Documentation Health Report** | Created by this agency (`reviews/DOCUMENTATION_HEALTH_REPORT.md`) |
| Recommended future: ACR-002+ re-pointing pillar/domain authority headers | Not yet created (see §25) |
| Recommended future: `docs/v2-redesign/README.md` indexing that review set | Not present |

No document named in the Agency 5 brief is missing; all were located and read or classified.

---

## 16. Duplicate or Stale Documents

| Finding | Location | Severity |
|---|---|---|
| **Pillars cite the wrong authority** — `AGENT_ARCHITECTURE`, `SCHEMA_GOVERNANCE`, `MULTI_DB_AGENT_LEARNING_GOVERNANCE`, `AGENT_PROMPT_GOVERNANCE` still name `FOUNDATION.md` as "Constitutional Authority" | repo root | **High** (authority dilution; Const. Art. XI) |
| **Domain specs cite FOUNDATION** — PMV/CRM/COMMUNITY/TRAINING and peers carry the same header | repo root | Medium |
| **`build-registry.md` header says "v1"** and points at v1 repo/collections | `docs/build-registry.md` | Medium (operational-state confusion) |
| **`AGENTS.md` / `CLAUDE.md` byte-identical** with nothing enforcing sync | repo root | Medium (silent-drift hazard) |
| **Reconciliation report lists two agent specs as MISSING** that now exist | `constitution/MOMENTUM_CONSTITUTIONAL_RECONCILIATION_REPORT.md` §2, §5.3 | Low (historical; report is of-record) |
| **Generated handbooks exist in two places** — archive (`_generated_archive/`) + recompiled artifacts (`reference-manuals/`) | both | Low (expected by ACR-001; both clearly non-authoritative) |
| **Superseded planning artifacts** — `build-plan.md`, `build-checklist.html` | `docs/` | Low (label as superseded by `project-wireframe.md`) |
| **Stray Office lock files** — `~$S-v2-route-inventory-*.docx` | `docs/` | Trivial (delete) |

No two *authoritative* documents conflict on substance. The Steve/Michael reconciliation and the two precedence orders are consistent across the spine.

---

## 17. Cross-Reference Map

```
MOMENTUM_CONSTITUTION --+--> MOMENTUM_GOVERNANCE --> AGENT_ARCHITECTURE, AGENT_PROMPT_GOVERNANCE,
                        |                            SCHEMA_GOVERNANCE, MULTI_DB_*
                        +--> MOMENTUM_DECISION_FRAMEWORK --> AGENTS.md/CLAUDE.md (currency chain, ledger)
                        +--> MOMENTUM_ACR_SYSTEM --> acr/REGISTER.md --> acr/ACR-001
                        +--> domain specs (PMV/CRM/COMMUNITY/TRAINING/HOLDING_TANK/EVENT/
                                          RESOURCE/ORIENTATION/LAUNCH_CENTER/RECOMMENDATION)
FOUNDATION.md ..descends into.. MOMENTUM_CONSTITUTION
AGENT_ARCHITECTURE --> NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC (Steve/Michael)
locked-spec --> Team-Magnificent-*.docx (5 surface designs)
MASTER_UX_IMPLEMENTATION_SPEC --> docs/v2-redesign/* (5 reviews)
Documentation Compilers --read--> living docs --emit--> docs/reference-manuals/* (artifacts)
PLATFORM_AUDIT --compares against--> Constitution + Governance + Decision + ACR + 4 pillars
```

Authoritative cross-reference indices already exist inside the Constitution ("Cross-Reference Index"), Governance §13, Decision Framework §11, ACR §11, and the Dependency Map. **This index points to those; it does not replace them.**

---

## 18. Dependency Map

Three layers, lower never contradicts higher (per `CONSTITUTION_DEPENDENCY_MAP.md`):

- **Principle layer (why):** Constitution <- Founding Charter. Changes rarely.
- **Governance layer (who/how decided/how changed):** Governance, Decision Framework, ACR. Changes occasionally, by the constitutional lifecycle.
- **Execution layer (what is built/proven):** architecture -> implementation (`locked-spec` -> `build-registry` -> `project-wireframe` -> code) -> testing. Changes constantly, governed by the operational-currency chain; testing evidence feeds back to ACR/Decision gates.

Conflict resolution: principle beats anything; two governance instruments -> escalate to Kevin; architecture vs implementation -> currency chain decides *current*, Constitution decides *allowed*; testing contradicting "done" -> testing wins.

---

## 19. Document Ownership

Per Governance §2 (12 governed areas). Ownership is advisory mapping; all terminates at Kevin.

| Document set | Owning area |
|---|---|
| Constitution, reconciliation, dependency map | Constitution & Governance |
| Governance, Decision Framework, ACR System, ACR records | Constitution & Governance / Executive |
| Agent Architecture, Prompt Governance, agent specs | Architecture & Platform / Agent Operations |
| Schema, Multi-DB, data-model contracts, graph vocabulary | Architecture & Platform / Memory & Intelligence |
| Domain/surface specs (PMV/CRM/etc.) | Product Surfaces / Architecture |
| locked-spec, build-registry, project-wireframe, implementation plans | Program Direction |
| Testing/QA docs, audits, route inventory | QA & Verification |
| Reference manuals (compiled) | Documentation & Training |
| Deployment/run guides, admin guide, gateway standard | Operations & Live Systems |
| **This Master Index + Health Report** | Documentation & Training (Agency 5) |

---

## 20. Update Rules

1. **Source of truth lives in `constitution/` and the governing architecture documents.** Edit those; never edit a generated manual to change meaning — edit the living doc and recompile.
2. **Cross-reference, never restate.** A document that copies constitutional text creates a drift surface. Point to the article/section instead.
3. **Reclassify, don't duplicate.** When a doc changes role (e.g. planning -> superseded), stamp a status line; don't fork it.
4. **This index is regenerated, not hand-patched, when the library changes shape.** Treat it as a living catalogue: re-audit on disk, reclassify, re-emit.
5. **Any change to a contract, schema, agent mission, persistence pattern, surface contract, compliance boundary, or source-of-truth precedence requires an ACR** (`MOMENTUM_ACR_SYSTEM.md` §1). Re-pointing a pillar's authority header is a source-of-truth touch -> ACR.
6. **Kevin merges.** Agents commit to a feature branch and stop (Governance §9).

---

## 21. Staleness Detection Rules

A document is **stale** when any of the following is true; the Health Report applies these.

1. Its "Constitutional Authority" header names `FOUNDATION.md` rather than `constitution/MOMENTUM_CONSTITUTION.md` (FOUNDATION is historical; living authority is the Constitution).
2. Its version/status line names "v1" or a superseded repo/collection while describing v2 state.
3. It asserts a fact ("X is MISSING", "Y is pending") that on-disk reality contradicts.
4. It is a planning artifact whose live successor exists (e.g. `build-plan.md` vs `project-wireframe.md`).
5. A generated artifact lacks the non-authoritative banner.
6. `AGENTS.md` and `CLAUDE.md` diverge (they must stay byte-identical).
7. A cross-reference points at a path that no longer exists or has moved.

Detection is mechanical: header scan + currency-chain check + on-disk existence check. None of these auto-fixes; each surfaces a finding for Kevin.

---

## 22. Documentation QA Checklist

Run before any documentation change is marked ready:

- [ ] Authority header names the **living Constitution** (or correctly marks the doc historical).
- [ ] No constitutional text is duplicated; references point to article/section.
- [ ] Status/version line matches on-disk reality (no "v1" on v2 state; no "MISSING" for present files).
- [ ] Cross-references resolve to real paths.
- [ ] Generated artifacts carry the non-authoritative banner and live only in `docs/reference-manuals/`.
- [ ] `AGENTS.md` == `CLAUDE.md` (byte-identical).
- [ ] Superseded planning docs carry a "superseded by ..." stamp.
- [ ] Constitutional boundaries intact in any prospect-facing doc (Five Prohibitions, no-scoring, sponsor immutability, THREE boundary).
- [ ] Any contract/schema/source-of-truth change has an ACR and a decision-ledger entry.
- [ ] Change verified on disk after writing (read back, never assumed).

---

## 23. Codex Prompt

> **Role:** Documentation maintenance for `D:/momentum-creation-system-v2`. You operate on **actual on-disk state**, never assumed state. You index and classify; you do not author constitutional law or create platform architecture.
>
> **Read first (in order):** `docs/READ-ME-FIRST.md`, `docs/AGENT-BRIEFING.md`, `constitution/MOMENTUM_CONSTITUTION.md`, `constitution/MOMENTUM_MASTER_INDEX.md` (this index), the worktree task brief if present.
>
> **Task:** Apply the Staleness Detection Rules (§21) across the repo. For each finding: quote the offending line, name the file, and propose the minimal fix. Do **not** edit `constitution/` or any pillar authority header without an ACR — re-pointing an authority header is a source-of-truth change (`MOMENTUM_ACR_SYSTEM.md` §1); draft the ACR instead of editing.
>
> **Constraints:** Cross-reference, never restate. Generated manuals in `docs/reference-manuals/` are artifacts — never cite them as governance and never edit them to change meaning. Keep `AGENTS.md` == `CLAUDE.md`. Commit to a feature branch and stop; Kevin merges. Verify every write by reading it back.
>
> **Output:** a findings list + draft ACR(s) for source-of-truth touches. Nothing self-executing.

---

## 24. Claude Code Prompt

> **You are the Documentation agent for Momentum Creation System V2.** Source of truth lives in `constitution/` and the governing architecture documents; this Master Index (`constitution/MOMENTUM_MASTER_INDEX.md`) is your map. You classify and synchronize documentation. You never rewrite constitutional law, never duplicate constitutional content, and never create new platform architecture.
>
> **Before acting:** read the Constitution, this index, and the Documentation Health Report (`reviews/DOCUMENTATION_HEALTH_REPORT.md`). Confirm actual state on disk before claiming any document's status.
>
> **When asked to update docs:**
> 1. Identify the document's class from this index (Sections 3–14).
> 2. If it's a generated artifact, change the **living source** and recompile — never the artifact.
> 3. If the change touches a contract/schema/agent mission/source-of-truth, raise an **ACR** (`MOMENTUM_ACR_SYSTEM.md`) and write a decision-ledger entry on approval.
> 4. Run the Documentation QA Checklist (§22).
> 5. Triple-stack any persistent write and read it back; flag any leg that errors loudly.
> 6. Commit to a feature branch; stop; let Kevin merge.
>
> **Preserve, always:** FOUNDATION as historical charter; Kevin as final authority; the PMV spine, Holding Tank authenticity, TM ID ownership, Prospect CRM boundary, Success Profile boundary, and THREE International boundary.

---

## 25. Final Recommendations

**1. Is the documentation system ready for Architect Review?**
**Yes — with mechanical fixes outstanding, not structural ones.** The constitutional spine is ratified, internally consistent, and correctly layered. The library is small, coherent, and free of substantive conflict between authoritative documents. What remains is header/status hygiene, not architecture. Architect Review can proceed in parallel with the fixes in (2).

**2. What must be fixed before implementation?**
- **Re-point the four architecture pillars' authority headers** from `FOUNDATION.md` to `constitution/MOMENTUM_CONSTITUTION.md` (with FOUNDATION named as the charter they descend from). This is a source-of-truth touch -> **draft an ACR** (proposed ACR-002). *High.*
- **Update domain-spec authority headers** the same way (can ride the same ACR or a follow-up). *Medium.*
- **Correct `docs/build-registry.md`** header from "v1" to v2 and re-point its repo/collection references. *Medium.*
- **Add a sync guard or note** binding `AGENTS.md` == `CLAUDE.md`. *Medium.*
- **Stamp** `build-plan.md` / `build-checklist.html` as superseded by `project-wireframe.md`; delete the `~$...docx` lock files. *Low.*
- **Footnote the reconciliation report** (or accept it as of-record) that the two agent specs it lists as MISSING now exist. *Low.*

**3. What documents should be created next?**
- **ACR-002** — "Re-point pillar and domain authority headers to the living Constitution" (the cleanest first use of the ACR system after ACR-001).
- **`docs/v2-redesign/README.md`** — a one-page index of the five redesign reviews that `MASTER_UX_IMPLEMENTATION_SPEC` synthesizes.
- **A short ownership ledger** materializing §19 into `momentum.decisions` so ownership is queryable, not just documented.
- (Optional) regenerate the reference manuals from the *current* living source once the pillar headers are fixed, so binders reflect reconciled authority.

**4. What can now be frozen?**
- **`constitution/MOMENTUM_CONSTITUTION.md` (v2.1.0)** — ratified; frozen until amended under Article XII.
- **`MOMENTUM_GOVERNANCE.md`, `MOMENTUM_DECISION_FRAMEWORK.md`, `MOMENTUM_ACR_SYSTEM.md` (v1.0.0)** — ratified; frozen until amended by the lifecycle.
- **`MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md`** — frozen permanently as the historical charter (amended by nothing).
- **`ACR-001`** — RELEASED; frozen as the change record of record.
- **The `constitution/_generated_archive/` set** — frozen as archive (do not edit; reversible if ever needed).

*Agency 5 indexed and classified. It did not author law, rewrite the Constitution, or create architecture. The Constitution Agent warns; Kevin decides.*
