# MCS V2 — Reidentification Migration Plan (canonical names, pre-launch)

- Status: **PLAN — DESIGN ONLY. Nothing executed.** The ordered, reversible pass that brings the *whole app* onto the canonical names decided during the pre-apply schema review.
- Base: `feature/phase-07-outcomes-learning-graphrag`.
- Governs the execution of: `FINDING_naming_concept_drift_audit` (F1–F6), `DECISION_team_magnificent_membership_canonical_identity` (+ §2a `tmag`), `DECISION_governed_dedicated_stack_founding_principle` (one-name), `P7_16` (journey/outcome), `P10 §5` reconciliations, `P7_12` (store provisioning).

---

## 0. The strategy — and why it is simple

**The app has not launched.** The dedicated app stores (Mongo `momentum`@30000 / Neo4j@7710 / Chroma `mcs_*`@8200) are **not provisioned yet** (`P7_12`), and there is **no production data**. Therefore this is **not** a live dual-write data migration — it is a **code-first canonical rename + fresh provisioning**, done *before* real data exists so the stores are **born canonical**. That is the whole reason to do it now.

- **Big-bang is safe here** (no live data to keep consistent mid-flight). Reversibility is **git revert + drop-and-reprovision**, not a data rollback.
- **Existing data is dev/seed only** (founders, seeded codes, test prospects) → **regenerated** from canonical seeders, not migrated.
- **Phase 7 is already canonical** (`tmagId`, `enrolled_iii`, one-name types, etc.). This plan brings the **rest of the app** in line and provisions the stores.
- **Contingency (if launch happens first):** if real data accrues before this runs, the member-id and enum renames escalate to a **dual-read/dual-write** live migration (§8). Doing it pre-launch avoids all of that.

---

## 1. Scope — everything this carries (decided in review)

| # | Change | Source |
|---|---|---|
| A | **Member id** `*BaId → *TmagId` (all ~25 variants); `tmBaId → tmagId`; id **values** `TMBA- → TMAG-`; access code `TM-XXXX → TMAG-XXXX`; founders `TM-01/02 → TMAG-01/02`. `threeBaId` stays. | F1, tmag decision |
| B | **CRM disposition** → ONE canonical snake_case enum; `new_ba/new-ba → new_brand_ambassador`; `enrolled_as_ba → enrolled_as_brand_ambassador`; `closed_new_ba → closed_new_brand_ambassador`. | F2/F3 |
| C | **`AdminProspectRegistrationHandoffState → ProspectStatus`**; remove all `registrationHandoff*` naming; unify with the outcome set. | F6 |
| D | **Outcome = terminal resolution** `pending · enrolled_iii · became_customer · declined`; **milestones → event log**; webinar attendance `yes/no/missed/rescheduled` + `scheduledFor`/`rescheduledTo`. | F5, P7.16 |
| E | **Aliased duplicate types** collapsed (`BulkLeadStatus`, `ProspectTimelineKind`); overlapping funnel enums unified. | F4/F5 |
| F | **One-name convention** — `Mcs`/`mcs` prefix always applied; one root; collections plural / types singular; casing per layer — applied app-wide. | governed-stack §3.2 |
| G | **Neo4j** `BA` vs `BrandAmbassador` → one canonical **member** label; `ProspectCRMRecord` casing → one; apply constraints/indexes. | P10 §5.1/§6, P7.12 §3 |
| H | **Auth cutover** — `ADMIN_BA_IDS` values `TMBA- → TMAG-`; login/session identifier. | tmag decision |

---

## 2. Principles

1. **Code-first, big-bang, pre-launch** — one branch, one reviewable diff, one merge.
2. **Reversible** — every phase reverts by `git revert` + (for stores) drop-and-reprovision; no destructive data step (there's no production data).
3. **Compile-time safety net** — `pnpm typecheck` + the full vitest suite are the guardrail after each phase; a rename that breaks a consumer fails the gate, not production.
4. **Append-only shared-file discipline stays** — but this is a coordinated whole-app rename, so the append-only rule is suspended *for this migration branch only*, under explicit approval (it exists to prevent parallel-worktree collisions; this is a single serialized pass).
5. **No `.com` regression** — the prospect surface must render identically; compliance unchanged.
6. **Governed door from birth** — the freshly provisioned stores get the `$jsonSchema`/constraints with canonical names (`P7_12`).

---

## 3. Ordered phases

### M0 — Prep (no code change)
- Tag the pre-migration commit (`git tag pre-reident`).
- Export any dev/seed data worth keeping (for reference only — it will be regenerated).
- Confirm the canonical **rename map** (§1 + the audit/catalog docs) is complete and approved.

### M1 — Shared types (`@momentum/shared`) — the source of truth
- Apply A/B/C/D/E/F to `packages/shared/src/*` : member-id fields, disposition enum, `ProspectStatus`, outcome/milestone/webinar enums, aliased-type collapse, `Mcs`-prefix normalization.
- This is the compile anchor — every consumer error surfaces here.

### M2 — Server domain + routes
- Update `server/src/domain/*`, `services/*`, `middleware/*`, seeders to the renamed types/fields.
- Includes `adminProspectOversight.ts` (`deriveRegistrationHandoffState → deriveProspectStatus`), CRM disposition writers, VM schemas (`vmSchemas.ts`), audit.

### M3 — Client apps (`apps/com`, `apps/team`, `apps/admin`)
- Update UI references: the admin "Handoff State" column → "Prospect status", disposition labels, member-id displays. `.com` verified unchanged in behavior.

### M4 — Seeders + canonical values
- Re-point seeders to canonical **values**: founders `TMAG-01`/`TMAG-02`, access codes `TMAG-XXXX`, disposition `new_brand_ambassador`, id format `TMAG-YYYYMMDD-XXXXXX`.
- `.env.example` + `ADMIN_BA_IDS` guidance → `TMAG-` ids.

### M5 — Neo4j reconciliation (G)
- Collapse `BA`/`BrandAmbassador` → one canonical **member** label; fix `ProspectCRMRecord` casing; then the constraints/indexes (`P7_12` §3, `P10` §6) apply cleanly on one label set.

### M6 — Provision dedicated stores with canonical schema (`P7_12`)
- Stand up `momentum`@30000 / Neo4j@7710 / Chroma@8200; apply the Mongoose+`$jsonSchema` governed doors (canonical fields), Neo4j constraints, Chroma registry — all born on canonical names. Direct-mode read-back.

### M7 — Verify + tighten
- `pnpm typecheck` (5/5) + full vitest green; per-store read-back on the first write of each family; then tighten validators (`additionalProperties:false`) per `P10 §8` after a soak.

---

## 4. Reversibility

| Phase | Revert |
|---|---|
| M1–M4 (code) | `git revert` the migration commit(s); `git checkout pre-reident`. |
| M5 (Neo4j) | `DROP CONSTRAINT/INDEX … IF EXISTS`; labels re-derive from data (no destructive relabel of production data — none exists). |
| M6 (stores) | `collMod` validators back to permissive; drop and reprovision (no data loss — pre-launch). |
| Flags | every R0–R3 canary flag stays **off**; provisioning does not enable persistence. |

---

## 5. Verification gates

- `git rev-parse HEAD` pinned; single migration branch off current `main`.
- `pnpm typecheck` repo-wide green after M1–M3.
- Full `server` vitest suite green after M2.
- `.com` manual smoke: `/p/{token}` renders identically; no compliance leakage.
- Store read-back per family (M6/M7).
- Grep gate: **zero** remaining `TMBA-`, `TM-XXXX`, `sponsorBaId`/`*TmBaId`, `new_ba`/`new-ba`, `registrationHandoff`, `AdminProspectRegistrationHandoffState` in code (allowing the documented `threeBaId` exception).

---

## 6. Rename map (canonical targets — the executable checklist)

- **Member id:** `baId → tmagId`; `sponsorBaId → sponsorTmagId`; `ownerTmBaId → ownerTmagId`; `sponsorTmBaId → sponsorTmagId`; `confirmedByBaId → confirmedByTmagId`; `reviewedByBaId → reviewedByTmagId`; `requestingBaId → requestingTmagId`; `performedByBaId → performedByTmagId`; `authorBaId → authorTmagId`; `recipientBaId → recipientTmagId`; `createdByBaId → createdByTmagId`; `previousSponsorBaId → previousSponsorTmagId`; `newSponsorBaId → newSponsorTmagId`; `downlineBaId → downlineTmagId`; `founderBaId → founderTmagId`; `markedByBaId → markedByTmagId`; `deletedByBaId → deletedByTmagId`; `restoredByBaId → restoredByTmagId`; `actorBaId → actorTmagId`; `setByBaId → setByTmagId`; `toBaId → toTmagId`; `conductedByBaId → conductedByTmagId`; `forBaId → forTmagId`; `tmBaId → tmagId`; `old/newOwnerTmBaId → old/newOwnerTmagId`; `old/newSponsorTmBaId → old/newSponsorTmagId`. **Keep:** `threeBaId`, `threeUsername`.
- **Values:** `TMBA-… → TMAG-…`; `TM-XXXX → TMAG-XXXX`; `TM-01/02 → TMAG-01/02`.
- **Disposition:** one enum `new_brand_ambassador · new_customer · interested · not_interested · later · no_response · wrong_number · do_not_contact`; closed-reason `enrolled_as_brand_ambassador`, `closed_new_brand_ambassador`.
- **Prospect status:** `AdminProspectRegistrationHandoffState → ProspectStatus`; `registrationHandoffState → prospectStatus`; `deriveRegistrationHandoffState → deriveProspectStatus`; `HandoffPill → ProspectStatusPill`.
- **Outcome:** `McsOutcomeKind = pending · enrolled_iii · became_customer · declined` (already applied in Phase 7); milestones live in `ProspectTimelineEventKind` (canonical), not the outcome enum.
- **Neo4j label:** `BA` + `BrandAmbassador` → one canonical member label (decision pending name — recommend `BrandAmbassador`, since it is the more descriptive; edges repoint).

---

## 7. Open decisions to close before executing

1. **The one canonical Neo4j member label name** — `BrandAmbassador` (recommended) vs `BA` vs `TeamMagnificentMember`.
2. **`ProspectStatus` value set** — reuse the outcome set (`pending · enrolled_iii · became_customer · declined`) vs keep the F6 set (`pending · enrolled · no_show · withdrew`). Recommend unifying to the outcome set.
3. **Append-only suspension** — confirm the append-only shared-file rule is suspended for this single serialized migration branch (yes/no).

---

## 8. Contingency — if the app launches before this runs

Then real member ids (`TMBA-…`) and enum values are persisted, and the plan escalates:
- **Dual-read/dual-write** the renamed fields (accept old + new) during a transition window.
- **Backfill** existing docs (`TMBA-→TMAG-`, `baId→tmagId` copies, disposition values) with read-back.
- **Cutover** reads to the new fields, then drop the old.
- Auth (`ADMIN_BA_IDS`, sessions) migrated with a dual-accept window so no one is locked out.
This is exactly the cost this pre-launch plan avoids — which is why doing it **now** is the right call.

---

## 9. Bottom line

Because we are **pre-launch**, the whole reidentification is a **code-first rename + fresh canonical provisioning** — one reviewable branch, reversible by git + reprovision, gated by typecheck and the test suite. Every target is already decided and listed (§6). Execute it before the stores are provisioned and the app opens, and MCS V2 launches with **one name for everything, from birth** — no drift, no live-data migration ever needed.
