# ACR-0007 — Runtime Persistence Is Direct; Universal Gateway Is Developer Tooling, Not a Runtime Dependency

## Momentum Creation System V2

Status: Approved

Priority: Pre-Sprint-1 — governs Sprint 1 item S1.3 (persistence implementation)

Type: Persistence Pattern + Source-of-Truth Reconciliation (includes a behavioral implementation migration)

Risk: Critical (source-of-truth change; irreversible persistence migration) — approval authority is Kevin

Approval: APPROVED by Kevin L. Gardner — 2026-06-27

Register note: Recorded in the active register (`organization/ACR-REGISTER.md`) per Kevin's direction 2026-06-27. The canonical-register-location question (active `organization/ACR-REGISTER.md` vs. `constitution/acr/REGISTER.md` named in `MOMENTUM_ACR_SYSTEM.md` §11) is deferred to ACR-0006.

---

## Purpose

Establish as governed law that the MCS V2 production runtime persists to **MongoDB + Neo4j + ChromaDB directly**, through dedicated adapters and service layers, and that the **MCP Universal Gateway V2 is developer tooling only and never a production runtime dependency**. Reconcile the non-ratified source-of-truth and active documents that had encoded gateway-mediated persistence, and govern the implementation migration of the runtime's current gateway-coupled persistence path.

---

## Trigger (MOMENTUM_ACR_SYSTEM §1)

This change touches three of the mandatory ACR triggers simultaneously:

- a **persistence pattern / triple-stack write path** change;
- an **integration with an external system (Gateway)** — the Gateway's role is redefined;
- a **source-of-truth / precedence change** — `docs/locked-spec.md` §3.14 is edited.

Under §7, a source-of-truth change and an irreversible migration are each **Critical** risk, requiring Kevin's approval.

---

## Motivation

The ratified Runtime layer already specifies direct-store persistence (`KNOWLEDGE_CORE_RUNTIME.md`: "MongoDB / Neo4j / Chroma is the primary … persistence layer"; `AGENT_EVENT_MODEL.md`: "All runtime events must be stored in MongoDB"; Package 001 env is `MONGODB_URI` / `NEO4J_URI` / `CHROMA_URL` with `chroma.adapter.ts` / `neo4j.adapter.ts`). The Universal Gateway is named zero times as a runtime persistence path in any ratified document.

Two non-ratified locations had encoded the opposite — gateway-mediated persistence — a misreading of the Gateway's role (it is an MCP developer tool for Claude/Codex, not runtime infrastructure):

1. `docs/locked-spec.md` §3.14 (and reinforcing lines 131, 199) plus active docs.
2. The live server: `server/src/services/gateway.ts` ("All persistence happens through this") routing every write to `${GATEWAY_URL}/execute` (`localhost:2526`) — **405 `gatewayCall()` sites across 63 files**, plus 101 `tripleStackWrite` / `tieredWrite` wrappers.

---

## Scope

### Part A — Documentation reconciliation (EXECUTED 2026-06-27 under Kevin's direct instruction; this ACR formalizes it)

Corrected to direct-store, with the Gateway reframed as developer tooling only:

- `docs/locked-spec.md` §3.14 + reinforcing phrases at lines 131 and 199
- `docs/UNIVERSAL_GATEWAY_V2_STANDARD.md` (scope banner + corrected Persistence Rule)
- `docs/AGENT-BRIEFING.md` (line 37)
- `docs/project-wireframe.md` (line 29)

Commits: `0a776d1` → rebased/pushed as `0c969c0` on `main`. These doc edits landed ahead of this ACR envelope on Kevin's explicit "reconcile now" instruction; this record brings them under formal governance retroactively and links the decision-ledger entry.

### Part B — Implementation migration (PENDING — governed by this ACR's gates; this is Sprint 1 item S1.3)

- Introduce direct `mongo` / `neo4j` / `chroma` adapters behind the existing service boundary.
- Repoint the internals of `gatewayCall` / `tripleStackWrite` / `tieredWrite` at the direct adapters; the 405 callers remain unchanged (incremental, no big-bang rip-out).
- Preserve triple-stack semantics: every write still lands in all three stores in the same logical operation, with read-back verification (testing gate, §5).

### Out of scope (intentionally unchanged)

- Ratified documents (already correct; frozen).
- Dated snapshots (`*_2026-06-24.md`, `*_2026-06-23.md`) and current-state runbooks (`DEPLOYMENT_GUIDE.md`, `ADMINISTRATOR_GUIDE.md`, `DEPLOYMENT_AND_REALTIME_TEST_GUIDE_2026-06-24.md`) — they truthfully describe today's code and update when the migration lands.
- Generated `docs/reference-manuals/` (regenerates from corrected sources).

---

## Impact

- **Source-of-truth doc:** `docs/locked-spec.md` §3.14 reconciled (non-ratified but source-of-truth in the precedence chain).
- **Persistence pattern:** target moves from gateway-mediated to direct (behavioral change, delivered via Part B).
- **Gateway integration:** redefined as developer tooling only; not a runtime dependency.
- **Runtime behavior:** unchanged until Part B is approved, implemented, verified, and merged. Part A is documentation only.

---

## Gates (MOMENTUM_ACR_SYSTEM §5)

- **Review:** Future-Development Test passed; affected docs/boundaries enumerated (this record); no hidden persistence introduced (direct stores preserve the triple-stack).
- **Approval:** Kevin (Critical risk).
- **Testing (Part B):** `pnpm typecheck` repo-wide; end-to-end flow against the running dev server; **persistence read-back** on every triple-stack write.
- **Merge:** Kevin merges; agents do not.
- **Release:** no compliance leakage to `.com`; degraded state shown honestly; no regression against a prior correction.

---

## Versioning and Rollback (§6)

- Target Version: v1.1 (alignment of implementation to the already-ratified v1.0 architecture). Unlike ACR-0001…0006, this ACR includes a behavioral implementation migration, not documentation-only alignment. Final target assigned by Kevin at Proposed → Scheduled.
- `rollback_to`: the current gateway-mediated implementation at commit `0c969c0` (pin the pre-migration server state before Part B begins). The persistence migration is reversible by restoring the gateway-routed adapter internals.

---

## Structured Record (MOMENTUM_ACR_SYSTEM §3)

```json
{
  "acr_id": "ACR-0007",
  "title": "Runtime persistence is direct; Universal Gateway is developer tooling, not a runtime dependency",
  "status": "approved",
  "risk_level": "critical",
  "change_type": "persistence",
  "proposed_by": "Claude (Chief Governance Architect)",
  "constitutional_check": { "future_dev_test": "pass", "boundaries_reviewed": ["persistence-pattern", "external-integration:gateway", "source-of-truth"] },
  "affected": {
    "documents": ["docs/locked-spec.md", "docs/UNIVERSAL_GATEWAY_V2_STANDARD.md", "docs/AGENT-BRIEFING.md", "docs/project-wireframe.md"],
    "schemas": [],
    "surfaces": [],
    "agents": []
  },
  "reconciliation_ref": "engineering/reports/PERSISTENCE_AND_GATEWAY_CLARIFICATION.md",
  "review": { "reviewers": ["Constitution & Governance", "Architect", "QA"], "decision": "", "conditions": [] },
  "approval": { "approved_by": "Kevin L. Gardner", "approved_at": "2026-06-27" },
  "implementation": { "branch": "", "commits": ["0a776d1", "0c969c0"], "append_only_respected": true },
  "verification": { "typecheck": false, "flows": [], "persistence_readback": false },
  "release": { "gates_passed": [], "released_at": null },
  "version": { "from": "gateway-mediated", "to": "direct-store", "supersedes": null, "rollback_to": "0c969c0" },
  "decision_ledger_ref": "dec_runtime_persistence_direct_not_gateway",
  "created_at": "2026-06-27",
  "updated_at": "2026-06-27"
}
```

---

## Approval

APPROVED — Kevin L. Gardner, 2026-06-27 (sole and final Constitutional Authority).

Approval terms (verbatim intent): Runtime persistence for MCS V2 shall be implemented directly through MongoDB, Neo4j, and ChromaDB adapters and service layers. The Universal Gateway is approved as developer tooling only (Claude Desktop, Claude Code, Codex, Codex CLI, MCP orchestration) and must not be introduced as a production runtime dependency. Sprint 1 is approved for implementation planning and S1.3 persistence-migration planning under the frozen v1.0 architecture. No ratified documents may be modified; no proposed ACRs may be applied beyond this approval without separate approval; no redesign is authorized.

Scope note: Part A (documentation reconciliation) is complete. Part B (the 405-site code migration) is approved in principle and is to be PLANNED in Sprint 1 (S1.3); its code execution still passes the ACR Implementing → Verified (persistence read-back) → Merged gates, with Kevin merging.
