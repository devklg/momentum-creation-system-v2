# FINDING — ChromaDB Boot / Collection Naming Drift (`audit_log` vs `mcs_audit_log`; Unprefixed Names)

## Momentum Creation System V2

Status: **Recorded finding — governance-relevant.** Documents an existing naming inconsistency in the app's dedicated ChromaDB registry. This finding records the drift and the canonical rule; it authorizes **no** code change or destructive cleanup on its own (write-freeze + Non-Destructive Rule remain in force).

Type: Persistence / Schema-Governance Finding (naming consistency)

Risk: Medium — retrieval-correctness and governance risk (the exact failure class Chat #135 named: the same concept written under divergent names defeats exact cross-store retrieval).

Recorded: 2026-07-01 — Phase 7 design run (Claude Code Instance 5).

Canonical alignment: `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` §4.D and §7.1; `ACR-0007` (app-direct persistence); `DECISION_governed_dedicated_stack_founding_principle.md` (one-concept-one-name).

---

## 1. Summary

The app's dedicated ChromaDB collection registry and the audit substrate carry a **naming drift**: the canonical audit concept is written under **two different collection names**, and the registry contains **unprefixed** collection names that violate the `mcs_` prefix convention for the app's dedicated stack. Left unrecorded, this drift reproduces the Chat #135 failure mode — the same concept under different names — which silently degrades exact cross-store retrieval.

This finding **names the canonical form** so future writes converge on it and any future cleanup (separately approved) has a single target.

---

## 2. Evidence (file:line, current at Base SHA `cce9a951…`)

1. **Two audit collection names coexist in the Chroma registry.**
   `server/src/services/chromaCollections.ts`:
   - line 42: `'mcs_audit_log', // domain/auditLog.ts` — the canonical, `mcs_`-prefixed audit collection.
   - line 43: `'audit_log', // domain/adminBaOversight.ts (sponsor-override audit line)` — a **second, unprefixed** collection for the sponsor-override audit line.

2. **A second unprefixed collection is registered.**
   `server/src/services/chromaCollections.ts` line 44: `'admin_prospect_notes'` — also lacks the `mcs_` prefix, unlike its 20+ `mcs_`-prefixed siblings.

3. **Stale canonical-name comment in the audit substrate.**
   `server/src/domain/auditLog.ts`:
   - lines 11 / 14 describe the canonical store/collection as **`audit_log`** (MongoDB `audit_log` … Chroma `audit_log`), while
   - lines 42–43 set the actual constants to **`mcs_audit_log`** (`COLLECTION = 'mcs_audit_log'`, `CHROMA_COLLECTION = 'mcs_audit_log'`).
   The prose and the code disagree on the canonical name.

4. **The unprefixed `audit_log` has a live writer.**
   `server/src/domain/adminBaOversight.ts` line 651 writes to Chroma `collection: 'audit_log'` for the sponsor-override audit line.

5. **Boot-time collection-ensure history confirms this is a recurring class.**
   `server/src/services/chromaCollections.ts` lines 4–5 and `server/src/index.ts` line 252 reference prior incidents ("#140 `audit_log` fix", "#145 `mcs_ivory` orphan") — ChromaDB `add()` does not auto-create collections, so a name mismatch orphans a Mongo row after commit unless the boot ensure + write-time guard catch it.

---

## 3. Canonical rule (the intended state)

Per `P10_MCS_V2_SCHEMA_DESIGN.md` §4.D:

- **`mcs_audit_log` is THE single canonical append-only audit collection** — Mongo `mcs_audit_log`, mirrored to Chroma `mcs_audit_log` and Neo4j `(:AuditEntry)`.
- **Do not create a Mongo `audit_log`.** The only legitimate unprefixed `audit_log` is the **Chroma-only sponsor-override mirror** written by `adminBaOversight.ts` — it is a *known, scoped* exception, not a second canonical audit store.
- **All app-owned Chroma collections are `mcs_`-prefixed** (one-concept-one-name; `DECISION_governed_dedicated_stack_founding_principle.md`). Unprefixed names in the registry (`audit_log`, `admin_prospect_notes`) are drift to be reconciled, not new canon.

---

## 4. Impact

- **Retrieval correctness:** two audit collection names split the same concept across stores; a semantic query against the wrong name silently returns nothing — the Chat #135 failure class.
- **Governance/onboarding:** the stale `auditLog.ts` comment misleads any agent/engineer into treating `audit_log` as canonical, propagating the drift.
- **Triple-stack integrity:** an unregistered/misnamed Chroma collection orphans a Mongo row after commit (mitigated today by the boot ensure + write-time guard, but the guard treats the drifted names as legitimate because they are registered).

---

## 5. Recommended reconciliation (separately approved — NOT authorized by this finding)

These are the reconciliation options; **none is executed here** (write-freeze / Non-Destructive Rule):

1. **Fix the stale comment** in `server/src/domain/auditLog.ts` (lines 11/14) to state the canonical name is `mcs_audit_log`. *(Lowest-risk; comment-only; still requires the normal review gate.)*
2. **Decide the sponsor-override mirror name.** Either (a) formally accept `audit_log` as the *named, documented, Chroma-only* sponsor-override exception (annotate the registry line to say so), or (b) rename it `mcs_audit_log_sponsor_override` to restore the prefix invariant. Renaming a Chroma collection is a migration — deferred until Kevin reopens cleanup (Non-Destructive Rule).
3. **Reconcile `admin_prospect_notes`** to `mcs_admin_prospect_notes` (or document it as a named exception), same migration constraint.
4. Whichever path: update `P10_MCS_V2_SCHEMA_DESIGN.md` §4.D / §7.1 and the registry comment so the canonical name and any named exceptions are stated in exactly one place.

---

## 6. Non-Destructive Rule (in force)

This finding records drift and canon. It does **not** authorize renaming a live collection, merging duplicates, deleting data, or editing runtime code. Any reconciliation in §5 passes the normal review → approval → verified gates, with Kevin approving and merging, and honors the MCS V2 write-freeze until lifted per-store.

---

## 7. Structured record

```json
{
  "finding_id": "FINDING-chroma-boot-naming-drift",
  "title": "ChromaDB boot/collection naming drift — audit_log vs mcs_audit_log; unprefixed names",
  "status": "recorded",
  "risk_level": "medium",
  "change_type": "schema-governance-finding",
  "recorded_by": "Claude Code (Instance 5), Phase 7 design run",
  "recorded_at": "2026-07-01",
  "base_sha": "cce9a951e3ca1b04307f68245201c389375b0a7a",
  "evidence": [
    "server/src/services/chromaCollections.ts:42",
    "server/src/services/chromaCollections.ts:43",
    "server/src/services/chromaCollections.ts:44",
    "server/src/domain/auditLog.ts:11",
    "server/src/domain/auditLog.ts:14",
    "server/src/domain/auditLog.ts:42",
    "server/src/domain/auditLog.ts:43",
    "server/src/domain/adminBaOversight.ts:651",
    "server/src/index.ts:252"
  ],
  "canonical_authority": [
    "engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md#4.D",
    "engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md#7.1",
    "organization/ACR-0007-runtime-persistence-direct-not-gateway.md",
    "organization/DECISION_governed_dedicated_stack_founding_principle.md"
  ],
  "authorizes_code_change": false,
  "non_destructive_rule": true
}
```

---

## 8. Related

- `ACR-0007` — runtime persistence is direct; the Universal Gateway is dev tooling. This finding concerns the app's **own** dedicated Chroma stack, not the gateway's.
- `DECISION_governed_dedicated_stack_founding_principle.md` — the one-concept-one-name principle this drift violates.
- `engineering/reports/P7_2_RUNTIME_AUDIT_SCHEMA.md` — restates the single-canonical-`mcs_audit_log` rule and the naming-drift guard for Phase 7 runtime audit.
- `engineering/reports/P7_3_TRIPLE_STACK_WRITE_CONTRACT.md` §2 — `mcs_`-prefixed Chroma collections on the app's dedicated stack.
