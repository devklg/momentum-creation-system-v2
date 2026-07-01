# DECISION — Team Magnificent Membership Is the Canonical MCS V2 Identity

## Momentum Creation System V2

Status: **Approved — governing identity decision.** Approved by Kevin L. Gardner, 2026-07-01. Establishes the canonical identity/scope for the app. Reframe is additive (option A); app-wide reidentification is a separate, governed migration.

Type: Identity / Source-of-Truth / Scoping decision.

Risk: Critical (identity + source-of-truth) — approval authority is Kevin.

Aligns to / folds into: `P10_MCS_V2_SCHEMA_DESIGN.md` §5.1 (BA vs BrandAmbassador label reconciliation), `ACR-0007`, locked-spec Part 2 (THREE is upstream authority), `DECISION_governed_dedicated_stack_founding_principle.md`.

---

## 1. Decision

The canonical identity of Momentum Creation System V2 is **Team Magnificent membership**, not "Brand Ambassador in general." The app exists **exclusively** for Team Magnificent members. Everything the app authenticates, scopes, and persists is anchored to the **member**, and every member belongs to the single tenant **Team Magnificent** (Kevin's brand).

"BA" is a **role in THREE International** (the upstream authority). "Team Magnificent member" is the **app identity**. They are related but not the same: the app is for members, not for BAs at large.

---

## 2. Membership preconditions (Kevin, 2026-07-01 — verbatim intent)

Membership is earned through THREE, in this strict order:

1. **You must be an enrolled BA in THREE International first.** III enrollment is a hard precondition — there is no Team Magnificent member who is not already an enrolled III BA.
2. **You must be part of Kevin's downline / team in THREE International.** Only BAs inside Kevin's III genealogy are eligible.
3. **Then** you can be enrolled in Team Magnificent and use the app.

**Corollary (the load-bearing invariant):** *every* Team Magnificent member IS an enrolled III BA in Kevin's downline. There is **no "member without an III BA" state.** THREE remains the upstream authority for enrollment and genealogy; the app **mirrors** the slice that is Kevin's downline and **never overrides** THREE (locked-spec Part 2). There is no programmatic enrollment handoff to THREE — BAs walk prospects into THREE off-app, BA-to-BA.

---

## 2a. Naming — `tmag` is the Team Magnificent token (Kevin, 2026-07-01)

The Team Magnificent brand token in identifiers is **`tmag`** (not `tm`). Canonical names:

- **Member id field: `tmagId`** (camelCase, app convention); value format **`TMAG-YYYYMMDD-XXXXXX`**.
- **Access code:** **`TMAG-XXXX`** (was `TM-XXXX`).
- **Founders:** **`TMAG-01`** (Kevin), **`TMAG-02`** (Paul).
- **Every `tm*`/`Tm*` identifier renames to `tmag*`:** `tmBaId → tmagId`, `ownerTmBaId → ownerTmagId`, `sponsorTmBaId → sponsorTmagId`, etc.
- `teamKey: 'team_magnificent'` and `tenantId` are spelled out — unchanged.

*(Open micro-decision: `tmagId` camelCase [recommended, app-consistent] vs literal `tmag_id` snake_case. Confirm.)*

**This is part of the deferred app-wide reidentification migration (§5):** the `TMBA-…` / `TM-XXXX` **values already persisted** and the `tm*` field names across 49 collections + auth (`ADMIN_BA_IDS`, login) are renamed under one governed migration — not piecemeal. Docs/catalogs adopt `tmag` now; live code/data migrate together.

## 3. The identity model

- **Canonical id:** the **TM member id** = **`tmagId`**, value `TMAG-YYYYMMDD-XXXXXX` (the sole login identifier; supersedes the `TMBA-…` form under the reidentification migration). The member id and the login are one and the same.
- **Required mirrored attribute:** `threeBaId` (+ `threeUsername`, III status) — the member's THREE identity, mirrored from the upstream authority, present on every member because §2.1 makes it a precondition. Never authenticates.
- **Sponsor:** immutable, captured at signup; must itself be a Team Magnificent member (a member in Kevin's downline). Founders (Kevin TM-01, Paul TM-02) are the roots.
- **Membership graph:** the downline sponsor tree within Team Magnificent — `(:TeamMagnificentMember)-[:SPONSORED_BY]->(:TeamMagnificentMember)` and `(:TeamMagnificentMember)-[:MEMBER_OF]->(:TeamMagnificent)`.
- **Tenant:** Team Magnificent is the single tenant; `tenantId` + `teamKey: 'team_magnificent'` express the tenant/team scope; the member id expresses the person.

---

## 4. Naming reconciliation (option A — additive, low-churn)

Approved posture: **reframe to the `tmag` member identity** (§2a); the mechanical rename executes in the one governed reidentification migration, not piecemeal.

- The canonical member id is **`tmagId`** (value `TMAG-…`). The current `baId`/`tmBaId` fields and `TMBA-…` values are the pre-migration form; they rename to `tmagId`/`TMAG-…` under §5.
- The app-context word "BA" means **Team Magnificent member**; the THREE role is called out explicitly as `threeBaId` / "III BA" when the upstream role is meant.
- Resolve the open **`BA` vs `BrandAmbassador` Neo4j label split** (P10 §5.1) by choosing **one canonical member label**. This decision sets the intent (a single membership identity); the mechanical label pick + migration is executed under that reconciliation.
- Every persisted record carries the **membership scope** (`tenantId` + `teamKey: 'team_magnificent'`) plus the member id.

A generic `baId → memberId` rename is not adopted; the chosen rename is **brand-specific** — `baId`/`tmBaId → tmagId` (§2a) — executed as one governed migration (§5), never piecemeal across the app.

---

## 5. Scope of application

- **Now (this Phase 7 slice):** the app-memory envelope and all Phase 7 records (R0–R3) adopt membership-first scoping — `teamKey: 'team_magnificent'` on every memory record (not just candidates), `baId` documented as the member id, outcomes/candidates/knowledge all `:SCOPED_TO (:TeamMagnificent)`. Done while the records are still un-applied.
- **Later (separate, governed):** app-wide reidentification — the `brand_ambassadors` collection framing, the canonical Neo4j member label, and any membership-eligibility enforcement (verify III enrollment + downline before granting membership) — is a separate migration governed by this decision and the P10 §5.1 reconciliation. Not done here.

---

## 6. What this does NOT do

- Does not add a programmatic THREE enrollment handoff (there is none).
- Does not rename `baId` app-wide (option B rejected).
- Does not itself migrate the `brand_ambassadors` collection or Neo4j labels (that is the P10 §5.1 reconciliation, governed by this decision).
- Does not change THREE's authority — the app mirrors the downline slice, never overrides.

---

## 7. Structured record

```json
{
  "decision_id": "DECISION-tm-membership-canonical-identity",
  "title": "Team Magnificent membership is the canonical MCS V2 identity",
  "status": "approved",
  "risk_level": "critical",
  "change_type": "identity-source-of-truth-scoping",
  "approved_by": "Kevin L. Gardner",
  "approved_at": "2026-07-01",
  "preconditions": [
    "enrolled III International BA (required, first)",
    "member of Kevin's III downline",
    "then enrolled in Team Magnificent + app access"
  ],
  "invariant": "every TM member is an enrolled III BA in Kevin's downline; no member-without-III-BA state",
  "canonical_id": "TMBA member id (existing login)",
  "naming_posture": "A: reframe additive (keep baId as member id); not B: mass rename",
  "folds_into": ["P10_MCS_V2_SCHEMA_DESIGN.md#5.1", "ACR-0007"],
  "applied_now": "Phase 7 R0-R3 memory records membership-first scoped (un-applied stores)",
  "deferred": "app-wide reidentification + membership-eligibility enforcement (separate governed migration)"
}
```

---

## 8. Related

- `P10_MCS_V2_SCHEMA_DESIGN.md` §5.1 — the BA/BrandAmbassador label reconciliation this decision directs.
- locked-spec Part 2 — THREE International is the upstream authority; the app mirrors Kevin's downline.
- `engineering/reports/P7_13_SCHEMA_CATALOG.md` — updated to membership-first scoping per §5.
