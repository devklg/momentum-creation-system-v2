# MOMENTUM GOVERNANCE

## The Organizational Operating System of Momentum Creation System V2

**Version:** 1.0.0
**Authority:** Subordinate to `constitution/MOMENTUM_CONSTITUTION.md`. Where this document conflicts with the Constitution, the Constitution wins.
**Constitutional Authority:** Kevin L. Gardner — sole and final
**Status:** Canonical (governance layer). Part of the integrated governance package awaiting ratification.

---

## Reconciliation Basis

Lifecycle stages for this document:
1. **Audit** — read the generated `constitution/` handbooks, `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, `AGENTS.md`/`CLAUDE.md`.
2. **Inventory / Reconciliation** — recorded in `MOMENTUM_CONSTITUTIONAL_RECONCILIATION_REPORT.md`. The five generated handbooks (~30,714 lines, ~5–8% signal) are the source of this document's extracted content; their padded forms are archived to `constitution/_generated_archive/`.
3. **Gap Analysis (governance-specific):** the org model, Universal Agent Contract, Universal Testing Standard, agent message envelope, and Mission Control rule existed only inside generated bloat or operational code. No single authoritative governance document held them. This document is that gap closed.
4. **Canonical + Cross-reference:** behavior, prompts, schemas, and data law are **cross-referenced, not restated** — they live in `AGENT_ARCHITECTURE.md`, `AGENT_PROMPT_GOVERNANCE.md`, `SCHEMA_GOVERNANCE.md`, and `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md`.

---

## §1 — Purpose and Scope

This document defines how Momentum operates as a human-centered AI software company: its departments, its agent contract, how agents communicate and escalate, how work is reviewed and merged, and the gates a change passes before release. It governs *who* and *how*; it does not restate principle (the Constitution) or restate agent behavior (the architecture).

One rule frames everything below: **no department, agent, or workflow may create private authority.** Authority is explicit, logged, and reviewable, and it terminates at Kevin.

---

## §2 — The Organization

Twelve governed areas. Each has an owner, a reporting line, and verifiable outputs. Agents staff these areas; they do not outrank the humans they serve.

| Area | Reports To | Primary Outputs |
|---|---|---|
| Executive Command | Kevin L. Gardner | approved priorities, decision records, mission amendments, incident authority |
| Constitution & Governance | Executive Command | governance rulings, boundary reviews, drift findings, amendment proposals |
| Program Direction | Executive Command | release plans, work queues, dependency maps, handoff packets |
| Operations & Live Systems | Executive Command | health reports, incident logs, live-ops snapshots, readiness checks |
| Architecture & Platform | Program Direction | architecture decisions, API contracts, state machines, integration plans |
| Product Surfaces | Program Direction | surface specs, interaction flows, acceptance criteria, release notes |
| QA & Verification | Program Direction | test plans, verification reports, bug findings, release gates |
| Documentation & Training | Program Direction | handbooks, runbooks, training modules, diagrams |
| Agent Operations | Program Direction | agent workflows, runtime events, recommendations, escalations |
| Memory & Intelligence | Architecture & Platform | context packages, memory records, lineage audits, gap reports |
| Compliance & Trust | Constitution & Governance | compliance reviews, blocked-output reports, safe wording, risk escalations |
| Research & Source Intelligence | Memory & Intelligence | research briefs, citation packs, claim status, uncertainty flags |

```mermaid
flowchart TD
  Kevin[Kevin L. Gardner] --> Exec[Executive Command]
  Exec --> Consti[Constitution and Governance]
  Exec --> Prog[Program Direction]
  Exec --> Ops[Operations and Live Systems]
  Prog --> Arch[Architecture and Platform]
  Prog --> Prod[Product Surfaces]
  Prog --> QA[QA and Verification]
  Prog --> Docs[Documentation and Training]
  Prog --> AgentOps[Agent Operations]
  Arch --> Mem[Memory and Intelligence]
  Consti --> Comp[Compliance and Trust]
  Mem --> Research[Research and Source Intelligence]
```

---

## §3 — The Universal Agent Contract

Every agent, present or future, is bound by this contract. It is the operative restatement of Constitution Article V and Article VII at the agent level.

1. **Mission is explicit.** An agent with no documented mission is not production-ready.
2. **Permissions are deny-by-default.** An agent receives only the minimum access its mission requires.
3. **Outputs are recommendations or drafts** unless a human-approved automation already exists.
4. **Memory writes are governed and auditable.** Canonical first, grounded always.
5. **Chroma is semantic, not truth.** A semantic hit must resolve to a canonical record before it is evidence.
6. **Neo4j relationships must be real.** No invented graph paths.
7. **Mongo canonical records win** for operational state.
8. **Compliance and privacy outrank usefulness.** Speed never justifies a boundary breach.
9. **Human correction outranks agent inference.** The human is always right about the human.

An agent that cannot name its mission, its prompt version, its permission policy, and its escalation path is not production-ready.

---

## §4 — The Agent Roster

Mission and boundaries only. Full operating contracts — inputs, outputs, memory policy, prompts, workflows, testing — live in `AGENT_ARCHITECTURE.md`. Constitutional purpose lives in `MOMENTUM_CONSTITUTION.md` Article VIII.

| Agent | Area | Mission (one line) | Hard boundaries |
|---|---|---|---|
| Executive | Executive Command | Translate Kevin's intent into governed direction | May not override Kevin, approve policy alone, invent timelines, bypass compliance |
| Constitution | Constitution & Governance | Guard the foundation; surface drift | May not create policy without ratification, weaken human authority, erase audit history |
| Program Director | Program Direction | Coordinate delivery, dependencies, handoffs | May not merge Kevin-owned branches, skip acceptance gates |
| Architect | Architecture & Platform | Protect the platform's shape | May not ignore the locked spec, duplicate schemas, create hidden persistence |
| Compliance | Compliance & Trust | Protect prospect trust and THREE boundaries | May not loosen prospect-facing rules; fails closed |
| QA | QA & Verification | Evidence-based release verification | May not invent pass status, hide failed checks, revert user changes without approval |
| Steve | Agent Operations | Conduct New BA Discovery; build the non-scored Success Profile | May not rank, predict, or label potential |
| Michael | Agent Operations | Mentor; Training Agent / Daily Success Coach after Steve | May not score, classify, replace the sponsor, promise outcomes, pressure |
| Ivory | Agent Operations | Help BAs draft respectful invitations; human sends | May not auto-send, qualify, cold-prospect, or use pressure/income/medical claims |
| Knowledge | Memory & Intelligence | Maintain canonical/semantic/graph memory and lineage | May not treat similarity as truth or create ungrounded records |
| Research | Research & Source Intelligence | Source-backed knowledge; flag uncertainty | May not fabricate, treat stale as current, or write unsourced claims |
| Documentation | Documentation & Training | Turn governed truth into usable docs | May not rewrite facts without source or bury drift |
| Operations | Operations & Live Systems | Keep live systems healthy and honest | May not hide degraded state (e.g. USE_MOCKS) |

---

## §5 — Permissions Model

Default is **deny**. Each agent's permission policy enumerates allowed reads, allowed writes, allowed actions, denied actions, and actions that require human approval. Every action is checked against agent status, user role, surface, entity scope, workflow type, required approval, and compliance restrictions before it runs. *(Full schema: `AGENT_ARCHITECTURE.md` §13.)*

Actions that **always** require human approval: sending any communication, publishing prospect-facing content, overriding sponsor or placement, exporting PII, and any irreversible mutation.

---

## §6 — Agent Communication

Agent-to-agent messages coordinate support; they never create hidden autonomous behavior. Every durable message is purpose-bound, traceable, scoped, auditable, and tied to a human or workflow need. Persistent messages write through the governed multi-store path.

**Canonical channels:** human directive (highest runtime priority) · decision ledger (currency) · agent message board (coordination) · audit log (accountability) · chat registry (identity authority) · handoff (artifact, not identity) · recommendation record (support, not command) · escalation record (governance flow).

**Message envelope** (minimum):
```json
{
  "message_id": "msg_...", "schema_version": 1,
  "from_agent": "", "to_agent": "", "department": "", "workflow_id": "",
  "entity_type": "", "entity_id": "", "message_type": "",
  "priority": "normal", "status": "unread", "purpose": "",
  "payload": {}, "evidence_refs": [],
  "created_at": "ISO-8601Z", "read_at": null, "resolved_at": null
}
```

**Message state machine:**
```mermaid
stateDiagram-v2
  [*] --> Draft
  Draft --> Posted
  Posted --> Unread
  Unread --> Read
  Read --> Actioned
  Read --> Replied
  Replied --> Actioned
  Unread --> Stale
  Actioned --> Archived
  Stale --> Archived
  Archived --> [*]
```

Processing rules: read highest priority first; replies are new messages referencing the parent; evidence is immutable after posting; mark actioned only after the action or a valid escalation; critical priority blocks dependent workflows until processed.

---

## §7 — Escalation

An agent escalates when: a request is outside its mission; context is insufficient; compliance risk appears; human emotion needs human care; a recommendation could materially affect a relationship; sources conflict; a privacy or safety concern appears; a human disputes an output; or confidence is below threshold.

```mermaid
sequenceDiagram
  participant A as Agent
  participant C as Compliance
  participant G as Governance
  participant H as Kevin / Human Owner
  A->>A: Detect uncertainty or boundary risk
  A->>C: Request review if content or policy risk
  C-->>A: pass / warn / block / escalate
  A->>G: Governance escalation when authority is unclear
  G->>H: Route decision to human owner
  H-->>G: Decision or correction
  G-->>A: Bound action and memory update
```

Escalation never auto-executes the disputed action. When two agents disagree, both rationales are preserved and the case routes to the right human.

---

## §8 — The Universal Testing Standard

Every agent must pass all eight before production: **normal**, **edge**, **missing-context**, **compliance-challenge**, **permission-denied**, **source-conflict**, **escalation**, and **regression** (from a prior correction). An agent that cannot identify its sources, prompt version, permission policy, or escalation path fails by definition.

---

## §9 — Delivery Governance: Review → Approval → Merge

The operative rules from `AGENTS.md` / `CLAUDE.md`, stated as governance.

- **Worktree model.** Feature work happens in parallel git worktrees, each with a scoped task brief stating what to build, what already exists (do not rebuild), and merge order.
- **Append-only at merge points.** `packages/shared/src/types.ts` and `server/src/index.ts` are append-only — add new blocks/mounts, never edit existing lines — to prevent merge collisions.
- **Commit convention.** Commits are tagged with the originating chat number (`Chat #N - <summary>`), mirroring `docs/build-registry.md`.
- **Merge authority.** **Agents commit to the feature branch and stop. Kevin merges to `main`.** No agent merges. This is a constitutional expression of the Kevin Override Model at the delivery layer.
- **Review gate.** Before merge readiness: typecheck green, acceptance criteria met, compliance verified, and (for persistent state) triple-stack writes read back and confirmed.

```mermaid
flowchart LR
  Brief[Scoped task brief] --> Build[Agent builds on feature branch]
  Build --> TC[Typecheck green]
  TC --> Verify[QA verification + compliance]
  Verify --> Ready[Marked ready_to_merge]
  Ready --> Kevin{Kevin reviews}
  Kevin -->|approve| Merge[Kevin merges to main]
  Kevin -->|changes| Build
```

---

## §10 — Testing Gates and Release Gates

**Testing gates (per change):** repo-wide `pnpm typecheck`; end-to-end manual flow against the running dev server (there is no automated test runner wired yet — verification is typecheck + manual flow); visual QA on touched surfaces; persistence read-back for any triple-stack write.

**Release gates (per release):** server-side auth verified (non-admin receives a real 403, not just hidden nav); compliance fail-closed confirmed on anything reaching `.com`; degraded state shown honestly (no hidden `USE_MOCKS`); audit entries written for mutations and material reads; no regression against a prior correction.

A gate that cannot be evidenced is a gate that failed. “Done” requires verification, never assertion.

---

## §11 — Agent Lifecycle

```mermaid
stateDiagram-v2
  [*] --> Proposed
  Proposed --> ConstitutionalReview
  ConstitutionalReview --> ScopeDefined
  ScopeDefined --> PermissionReview
  PermissionReview --> PromptReview
  PromptReview --> Prototype
  Prototype --> LimitedRelease
  LimitedRelease --> FullRelease
  FullRelease --> Monitored
  Monitored --> Revised
  Revised --> PromptReview
  Monitored --> Retired
  Retired --> [*]
```

An agent is retired when it no longer serves the mission, creates confusion, duplicates another agent, generates untrustworthy output, weakens human relationships, or cannot be governed safely. *(Full lifecycle: `AGENT_ARCHITECTURE.md` §6.)*

---

## §12 — Mission Control Rule

The executive command surface is **the existing `/dashboard` route promoted into Mission Control — not a second dashboard.** No parallel command center, no marketing hero, no decorative collage. Every command card must carry evidence, freshness, and an action path, or it is a report footnote. Server-side admin authorization (`requireAdmin`, `ADMIN_BA_IDS`) is the hard gate; the UI may hide or explain but never replaces it. *(Surface detail lives in admin code and the archived executive handbook; this rule is the governing constraint.)*

---

## §13 — Cross-Reference

| For | See |
|---|---|
| Why agents exist (constitutional purpose) | `MOMENTUM_CONSTITUTION.md` Art. VIII |
| Agent behavior, lifecycle, permissions schema | `AGENT_ARCHITECTURE.md` |
| Prompt governance | `AGENT_PROMPT_GOVERNANCE.md` |
| Schema law | `SCHEMA_GOVERNANCE.md` |
| Memory / triple-stack law | `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` |
| How decisions are made | `MOMENTUM_DECISION_FRAMEWORK.md` |
| How the platform's shape changes | `MOMENTUM_ACR_SYSTEM.md` |
| Operational currency, compliance, triple-stack | `AGENTS.md` / `CLAUDE.md` |

*The Constitution Agent warns. Kevin decides.*
