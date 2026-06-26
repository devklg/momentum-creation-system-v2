# MOMENTUM CONSTITUTIONAL RECONCILIATION REPORT

**Prepared by:** Constitution Agent (advisory)
**Constitutional Authority:** Kevin L. Gardner — sole and final
**Date:** 2026-06-26
**Status:** Advisory findings. No files moved, renamed, archived, or deleted. Awaiting Kevin's ratification of the recommended structure before any constitutional document is written.

> The Constitution Agent warns. Kevin decides. This report is the warning. Nothing in it is self-executing.

---

## 1. Executive Summary

The reconciliation found one decisive fact: **a constitution already exists, and it is good.** `MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md` is — by its own H1 — titled *"MOMENTUM CREATION SYSTEM V2 CONSTITUTION."* It is a tight, human-written, 725-line, 23-article charter. Every substantive governance document in the repository already names it as their "Constitutional Authority." It is the real root.

It is also **misnamed and mis-placed.** The file the whole system treats as its constitution is called `FOUNDATION`, lives at repo root, and is surrounded by a `constitution/` directory that contains something else entirely.

That directory holds five machine-generated handbooks totaling **30,714 lines**. They were produced by the `.build-tools/generate-momentum-*.mjs` generators. Their genuine, non-duplicated signal is roughly **5–8%**; the remaining ~28,000 lines are a single page-template find-replaced across dozens of "pages," plus heavy cross-file duplication (the same escalation-sequence diagram appears verbatim in at least three of them). These files are exactly the failure mode a constitution must avoid: volume that dilutes authority and breeds contradiction.

**The task is therefore reconciliation, not authorship.** The four target documents Kevin requested are the right four. They should be written as *tight canonical law that absorbs the real signal, points to the existing governance documents, and supersedes the generated bloat* — not as four new 100-page handbooks layered on top of the eight governance documents already present.

The single structural decision Kevin must ratify before the root law is written is in **Section 8**.

---

## 2. Method and Scope

**Read in full this pass (the constitutional and governance core):**

| Document | Lines | Nature |
|---|---|---|
| `MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md` | 725 | Human-written constitution (23 articles) |
| `AGENTS.md` | 194 | Operational law for Codex |
| `CLAUDE.md` | 194 | Operational law for Claude (byte-identical to AGENTS.md) |
| `SCHEMA_GOVERNANCE.md` | 629 | Data-schema governance |
| `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` | 2,529 | Triple-stack data law |
| `AGENT_ARCHITECTURE.md` | 2,621 | Agent ecosystem law (reconciled 2026-06-24) |
| `AGENT_PROMPT_GOVERNANCE.md` | 3,265 | Prompt-as-contract governance |
| `constitution/MOMENTUM_AI_ORGANIZATION.md` | 6,017 | Generated org handbook |
| `constitution/MOMENTUM_EXECUTIVE_SYSTEM.md` | 5,236 | Generated executive handbook |
| `constitution/MOMENTUM_AGENT_DIRECTORY.md` | 8,813 | Generated agent directory |
| `constitution/MISSION_CONTROL_ARCHITECTURE.md` | 5,121 | Generated mission-control handbook |
| `constitution/MOMENTUM_AGENT_COMMUNICATION_PROTOCOL.md` | 5,527 | Generated comms-protocol handbook |

**Classified by role, not deep-audited this pass** (domain/operational specs the constitution *references* rather than reconciles): `PMV_ARCHITECTURE`, `CRM_ARCHITECTURE`, `COMMUNITY_ARCHITECTURE`, `PLATFORM_AUDIT`, `RECOMMENDATION_ENGINE_ARCHITECTURE`, `ORIENTATION_ARCHITECTURE`, `LAUNCH_CENTER_ARCHITECTURE`, `RESOURCE_CENTER_ARCHITECTURE`, `EVENT_CENTER_ARCHITECTURE`, `TRAINING_ARCHITECTURE`, `HOLDING_TANK_ARCHITECTURE`, `NEW_BA_DISCOVERY_SUCCESS_INTERVIEW_SPEC`, `MASTER_UX_IMPLEMENTATION_SPEC`, `MOMENTUM_CREATION_SYSTEM_V2_PRODUCTION_VERSION`, `docs/VM_LEAD_CAMPAIGN_*`, `docs/BA_SUPPORT_AGENTS_ARCHITECTURE`, and the `docs/` operational set (`locked-spec`, `build-registry`, `project-wireframe`, `READ-ME-FIRST`, `AGENT-BRIEFING`, `graphrag-schema-contract`, `chat-registry-authority`, `handoff-contract`).

**Confirmed missing** (named in the task brief, do not exist anywhere in the repo): `docs/MOMENTUM_ARCHITECT_AGENT.md`, `docs/CONSTITUTION_AGENT.md`.

---

## 3. Document Inventory and Classification

Legend: **AUTHORITATIVE** = a real source of truth · **DERIVED-BLOAT** = generated, mostly padding, non-authoritative · **DUPLICATE** = substantively restates another doc · **DOMAIN** = referenced by the constitution, not part of it · **MISSING** = expected but absent.

| # | Document | Class | Disposition |
|---|---|---|---|
| 1 | `FOUNDATION.md` (titled "…CONSTITUTION") | **AUTHORITATIVE** (root) | Becomes the heart of the new `MOMENTUM_CONSTITUTION.md`; original demoted to historical source |
| 2 | `AGENTS.md` / `CLAUDE.md` | **AUTHORITATIVE** (operational) | Keep; name one canonical, document the sync requirement |
| 3 | `SCHEMA_GOVERNANCE.md` | **AUTHORITATIVE** | Keep; cross-referenced by the constitution |
| 4 | `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` | **AUTHORITATIVE** | Keep; cross-referenced |
| 5 | `AGENT_ARCHITECTURE.md` | **AUTHORITATIVE** | Keep; cross-referenced; carries the current Steve/Michael reconciliation |
| 6 | `AGENT_PROMPT_GOVERNANCE.md` | **AUTHORITATIVE** | Keep; cross-referenced |
| 7 | `constitution/MOMENTUM_AI_ORGANIZATION.md` | **DERIVED-BLOAT** | Extract pp.1–22 signal into `MOMENTUM_GOVERNANCE.md`; archive original |
| 8 | `constitution/MOMENTUM_AGENT_DIRECTORY.md` | **DERIVED-BLOAT** | Extract the Universal Agent Contract + per-agent missions; archive original |
| 9 | `constitution/MOMENTUM_EXECUTIVE_SYSTEM.md` | **DERIVED-BLOAT** | Signal already lives in admin code; archive original |
| 10 | `constitution/MISSION_CONTROL_ARCHITECTURE.md` | **DERIVED-BLOAT / DUPLICATE** of #9 | Archive; the two overlap almost entirely |
| 11 | `constitution/MOMENTUM_AGENT_COMMUNICATION_PROTOCOL.md` | **DERIVED-BLOAT** | Extract the message envelope + state machine; archive original |
| 12 | `.build-tools/generate-momentum-*.mjs` | **TOOL (hazard)** | Retire or fix so they stop padding to a page count |
| 13 | `PMV / CRM / COMMUNITY / TRAINING / …` architecture | **DOMAIN** | Referenced by the constitution; not rewritten |
| 14 | `docs/locked-spec.md`, `build-registry`, `project-wireframe` | **AUTHORITATIVE (operational state)** | Referenced as the operational-currency chain |
| 15 | `docs/MOMENTUM_ARCHITECT_AGENT.md` | **MISSING** | Write as a derived agent charter (low priority) |
| 16 | `docs/CONSTITUTION_AGENT.md` | **MISSING** | The charter for the very role this task fills — write it |

---

## 4. The Authoritative Set (the real spine)

Stripped of the generated layer, the true governing spine is small and coherent:

1. **`FOUNDATION.md` — the constitution.** Preamble, 23 articles, the Momentum Manifesto. Establishes: people first; transformation is the product; AI assists and never centers; community is infrastructure; *"when conflicts arise between convenience and philosophy, philosophy shall prevail; when between technology and people, people shall prevail."* Article XXI's 10-point "Future Development Rules" is already a usable decision test.

2. **`AGENTS.md` / `CLAUDE.md` — the operational law.** Carries the rules agents actually run on: the source-of-truth precedence chain, the triple-stack write rule, the five compliance prohibitions for `.com`, sponsor immutability, THREE-as-upstream-authority, server boot order, and the append-only merge discipline. Enforced in code at `packages/shared/src/compliance.ts` and `rules.ts`.

3. **Four governance pillars**, each citing FOUNDATION as authority and each genuinely distinct:
   - `SCHEMA_GOVERNANCE.md` — one concept = one canonical schema; versioning; naming.
   - `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` — Mongo = canonical, Chroma = semantic-not-truth, Neo4j = relationships, GraphRAG must be grounded; 7 source-of-truth rules.
   - `AGENT_ARCHITECTURE.md` — agent lifecycle, permissions (deny-by-default), boundaries, escalation; carries the current Steve/Michael role split.
   - `AGENT_PROMPT_GOVERNANCE.md` — prompts as versioned behavioral contracts; lifecycle, review, rollback.

4. **The operational-currency chain** (from `AGENTS.md` / `READ-ME-FIRST.md`): `decision ledger > locked-spec > design docs > build-registry > git log > chat registry > handoffs`, backed by Mongo collections `momentum.decisions`, `momentum.work_queue_leaves`, `momentum.agent_status`.

The valuable, non-duplicated content inside the five generated handbooks amounts to roughly: the 12-department org model and reporting lines; the agent-lifecycle and escalation state machines; the **Universal Agent Contract** and **Universal Testing Standard** (genuinely excellent — these belong in the constitution verbatim); the per-agent mission/boundary rows; the agent message envelope and message state machine; and the "do not create a second dashboard — Mission Control *is* the existing /dashboard" rule. All of it fits comfortably inside one `MOMENTUM_GOVERNANCE.md`.

---

## 5. Findings — Duplicate, Conflicting, Obsolete, Missing

### 5.1 Duplicate / Obsolete-Bloat
- The `constitution/` directory is **~28,000 lines of padding.** Each generated handbook repeats one page-template (e.g. *"The executive purpose of '[TITLE]' is to reduce Kevin's cognitive load…"*) across every topic with only the title swapped.
- **Cross-file duplication:** the escalation-sequence diagram is verbatim in `AI_ORGANIZATION`, `AGENT_COMMUNICATION_PROTOCOL`, (and referenced in others). The knowledge-flow diagram appears in at least two. The Mission Control admin-surface tables are near-identical in `EXECUTIVE_SYSTEM` and `MISSION_CONTROL_ARCHITECTURE` — two whole files covering the same material.
- `CLAUDE.md` and `AGENTS.md` are **byte-for-byte identical.** This is intentional (two tool entrypoints) but is a silent-drift hazard: nothing enforces that they stay in sync.

### 5.2 Conflicting (one real, already half-resolved)
- **Michael's role.** `FOUNDATION` Article XI frames Michael as "the ideal mentor / philosophical representation of mentorship." `AGENT_ARCHITECTURE` (reconciled 2026-06-24) and the locked decisions define the operative roles precisely: **Steve is the sole New BA Discovery interviewer producing a *non-scored* Success Profile; Michael is the Training Agent / Daily Success Coach;** agents must not predict success or classify BAs. The legacy "Michael = interviewer/scorer" model (MCS v1) is **retired** and must not resurface. These are not contradictory — FOUNDATION states the *principle* (Michael embodies mentorship), AGENT_ARCHITECTURE states the *operative role* — but the constitution must carry both and add a one-line note so the principle is never misread as the old interviewer model.
- **Two precedence orders that read like rivals but are not** — see Section 6. The constitution must explicitly reconcile them or future agents will treat it as a conflict.

### 5.3 Missing
- **`CONSTITUTION_AGENT.md`** — the charter for the role defining all of this — exists only as boilerplate inside the generated directory. There is no standalone authoritative version. (This is the role the present task occupies.)
- **`MOMENTUM_ARCHITECT_AGENT.md`** — named in the brief; absent.
- **No `MOMENTUM_GOVERNANCE.md`, `MOMENTUM_DECISION_FRAMEWORK.md`, or `MOMENTUM_ACR_SYSTEM.md`** — the three companion documents Kevin wants. The Decision Framework can be *assembled* from existing pieces (precedence chain + decision ledger + Article XXI test + agent lifecycle). The **ACR (Architectural Change Request) system genuinely does not exist** as a named process — its closest relatives are the schema change-approval flow, the agent lifecycle, and the prompt lifecycle. It is the most net-new of the four.

---

## 6. The Dual-Authority Model (how the two precedence orders reconcile)

The system carries two precedence orders. They are not rivals — they govern different questions, at different layers. The new constitution must state this explicitly:

- **Constitutional layer — governs *whether* and *why*.** Authority: `MOMENTUM_CONSTITUTION` (absorbing FOUNDATION). Asks: does this serve people, momentum, clarity, trust, community; does it preserve human authority; does it stay inside compliance. Philosophy outranks convenience; people outrank technology. This layer changes rarely and only by amendment.
- **Operational layer — governs *what is currently true*.** Authority: the currency chain `decision ledger > locked-spec > design docs > build-registry > git log > chat registry > handoffs`. Asks: which version is current, what is built, what supersedes what. This layer changes constantly.

**Rule:** the operational layer decides *what is current*; the constitutional layer decides *whether what is current is allowed*. The constitutional layer can veto on principle; it never adjudicates "which build is newer." A change can be operationally current and still constitutionally void (e.g., a feature that ships income claims to `.com`). Kevin sits above both layers.

---

## 7. Recommended Final Constitutional Structure

A single coherent library: FOUNDATION's philosophy as the heart, the existing governance pillars cross-referenced (never restated), the generated bloat retired.

**Tier 0 — Constitutional Root**
- **`constitution/MOMENTUM_CONSTITUTION.md`** *(new canonical root, ~20–40 real pages)* — absorbs FOUNDATION's 23 articles; adds the dual-authority model (§6), the Human Authority / Kevin Override model, the supremacy clause, the amendment procedure, and an authoritative cross-reference index to every governing document. FOUNDATION.md is demoted to "historical source, superseded by MOMENTUM_CONSTITUTION.md."

**Tier 1 — Governance Operating System**
- **`constitution/MOMENTUM_GOVERNANCE.md`** *(new)* — the org operating model: 12 departments + reporting lines, the **Universal Agent Contract** and **Universal Testing Standard**, the agent roster (mission + boundaries only), the permission/escalation model, the agent message envelope + state machine. Cross-references `AGENT_ARCHITECTURE`, `AGENT_PROMPT_GOVERNANCE`, `SCHEMA_GOVERNANCE`, `MULTI_DB_AGENT_LEARNING_GOVERNANCE` rather than restating them. Supersedes the five generated handbooks.

**Tier 2 — Decision and Change Control**
- **`constitution/MOMENTUM_DECISION_FRAMEWORK.md`** *(new)* — unifies the dual-authority model, the currency chain, the decision ledger (`momentum.decisions`), Article XXI's 10-point feature test, the "who decides what" authority matrix, the Kevin Override model, and escalation. The single answer to "how is any decision made and recorded."
- **`constitution/MOMENTUM_ACR_SYSTEM.md`** *(new)* — the Architectural Change Request workflow, assembled from the existing schema/agent/prompt change-control patterns into one process: ACR state machine, review → approval → merge → testing → release gates, versioning, rollback. The most genuinely new document.

**Supporting layer (kept, cross-referenced, NOT rewritten):** `AGENTS.md`/`CLAUDE.md`, the four governance pillars, `locked-spec`, `build-registry`, the decision ledger, and all DOMAIN architecture docs.

**Retire / archive (pending Kevin's decision — see §8):** the five `constitution/` generated handbooks → move to `constitution/_generated-archive/` (reversible; not deleted). Retire or fix the `generate-momentum-*.mjs` generators.

---

## 8. The Decision Kevin Must Ratify

Two of these are significant enough that the Constitution Agent will not execute them unilaterally — they change which file is the supreme authority and demote existing files. Per the model: the agent warns, Kevin decides.

**Decision A — Constitutional root.** Confirm that the new `constitution/MOMENTUM_CONSTITUTION.md` becomes the single supreme charter, absorbing FOUNDATION's articles, and that `FOUNDATION.md` is demoted to a historical source that points to the new root.
- *Recommended: yes.* Alternative: keep FOUNDATION as the root and make `MOMENTUM_CONSTITUTION.md` a thin index that ratifies it. (Cleaner long-term to consolidate; the index option avoids touching FOUNDATION at all.)

**Decision B — The generated handbooks.** Confirm disposition of the five `constitution/` handbooks.
- *Recommended: archive* (move to `constitution/_generated-archive/`, reversible) after their signal is extracted into `MOMENTUM_GOVERNANCE.md`. Alternatives: delete outright (Kevin's call — deletion is his to make, not the agent's), or leave in place with a header stamping them non-authoritative.

**Decision C — Michael note.** Confirm the constitution states Michael's *principle* (mentorship archetype) and points to `AGENT_ARCHITECTURE` for the *operative* role (Training Agent / Daily Success Coach, post-Steve, non-scoring), with the v1 interviewer model explicitly retired.
- *Recommended: yes.*

**On Kevin's nod to A (and a direction on B/C), the next action is to write `constitution/MOMENTUM_CONSTITUTION.md`** as tight canonical law, followed by GOVERNANCE, DECISION_FRAMEWORK, and ACR_SYSTEM in that order. Each will be written to be as long as it needs to be and no longer, verified on disk after writing, and committed for Kevin to merge.

---

*End of report. No constitutional document has been written yet; this is the gate before the root law.*
