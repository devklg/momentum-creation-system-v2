# FINDING — Naming & Concept Drift Audit (all collections/types)

## Momentum Creation System V2

Status: **Recorded findings — governance-relevant.** A code + persisted-data audit of naming/concept drift across `@momentum/shared` types and the app collections, done **before** the dedicated stores are schema-applied so the drift is not baked into the new stores (governed-from-birth; Kevin's directive 2026-07-01).

Type: Naming / Concept-Model / Schema-Governance audit.

Recorded: 2026-07-01 — schema review pass. Grounded in `packages/shared/src/types.ts` + `server/src/domain/vmSchemas.ts` (file:line below).

Governs: the reconciliation migration and the **canonical names every new store adopts from birth** (Phase 7 `mcs_*` + the dedicated triple-stack). Aligns to `DECISION_team_magnificent_membership_canonical_identity`, `DECISION_governed_dedicated_stack_founding_principle` §3.2 (one-concept-one-name), `P10 §5`.

---

## 0. Canonical entity model (settled with Kevin, 2026-07-01)

Three distinct entities — never conflate them:

- **Prospect** — someone **sent an invitation** to watch the Dr. Dam video and go through the **holding-tank / `.com`** process. **Not** a Brand Ambassador, **not** a member. The funnel entity.
- **Brand Ambassador = Team Magnificent member** — the app user; an enrolled III International BA **in Kevin's downline**. In this app a BA *is* a member (has a `tmagId`). Same entity.
- **Customer** — someone who bought product (`becameCustomer`). A **third, separate** concept — a customer is *not* a member.

**Conversion:** a prospect becomes a **new brand ambassador** (enrolls in III, in the downline), which *is* a new Team Magnificent member. A prospect can never skip to "member."

---

## F1 — Member identity: ONE concept, ~25 names (CRITICAL)

The member id is written **~25 different ways**. Evidence (`types.ts` occurrence counts): `sponsorBaId` ×48 · `tmBaId` ×7 · `ownerTmBaId` ×4 · `requestingBaId` ×5 · `reviewedByBaId` ×3 · `newSponsorBaId` ×3 · `downlineBaId` ×3 · `sponsorTmBaId` ×2 · `confirmedByBaId` ×2 · plus `toBaId · restoredByBaId · previousSponsorBaId · performedByBaId · originalSponsorBaId · markedByBaId · founderBaId · deletedByBaId · createdByBaId · authorBaId · actorBaId · setByBaId · recipientBaId · conductedByBaId · forBaId · oldOwnerTmBaId · newOwnerTmBaId · oldSponsorTmBaId · newSponsorTmBaId`.

**Two defects:** (a) the same id is spelled `*BaId` in some collections and `*TmBaId` in others; (b) none use the canonical `tmag` token.

**Canonical (per identity + tmag decisions):** base member id = **`tmagId`**; role-prefixed = **`<role>TmagId`** — `sponsorTmagId`, `ownerTmagId`, `confirmedByTmagId`, `reviewedByTmagId`, `requestingTmagId`, `performedByTmagId`, `authorTmagId`, `recipientTmagId`, `newSponsorTmagId`, `downlineTmagId`, `founderTmagId`, … `threeBaId`/`threeUsername` **stay** — they are the distinct III mirror, not the member id. **New stores use `tmagId`/`<role>TmagId` from birth.**

---

## F2 — CRM disposition: duplicate enum + spelling + `ba`-value (CONFIRMED · DECIDED)

Two enums for one concept: `CrmDisposition` (`types.ts:1546`, **hyphen** `new-ba`, coll `crm_dispositions`) vs `ProspectCrmDisposition` (`types.ts:4479`, **underscore** `new_ba`, coll `prospect_crm_records`). One-concept-two-names + two spellings + two value-sets.

**Decision (Kevin):** collapse to **ONE** canonical **snake_case** disposition enum; `new_ba` → **`new_brand_ambassador`** (= new tmag member); matching `enrolled_as_ba` → **`enrolled_as_brand_ambassador`**, `closed_new_ba` → **`closed_new_brand_ambassador`**. Canonical set: `new_brand_ambassador · new_customer · interested · not_interested · later · no_response · wrong_number · do_not_contact`. `new_customer` stays (customer ≠ member).

---

## F3 — `ba` enum values that mean the member conversion

`new-ba` (`:1547`), `new_ba` (`:4480`), `enrolled_as_ba` (`:4490`), `closed_new_ba` (`:4520`, `:4549`) — all denote "became a Brand Ambassador (= member)." Spell out **`brand_ambassador`** (never the ambiguous `ba`). Distinguish from **customer** values (`new_customer`, `became_customer`, `closed_new_customer`) — a different concept, kept as-is.

---

## F4 — Aliased duplicate types (two names, one concept)

`types.ts:4736` `export type BulkLeadStatus = VmLeadLifecycleStatus;` and `:4738` `export type ProspectTimelineKind = ProspectTimelineEventKind;` — one concept exported under two names via alias. **Pick one canonical name each; drop the alias.**

---

## F5 — Overlapping funnel-event vocabularies

`ProspectTimelineEventKind` (`:4499`, ~26 values) and `VmLeadLifecycleStatus` (`:4528`, ~18 values) model the **same funnel events twice**: both carry `voicemail_sent · sms_sent · email_sent · link_clicked · activated · info_requested · callback_requested · presentation_started/25/50/75/completed`. Same events, two enums → define **one canonical funnel-event vocabulary** and subset/derive per use, rather than parallel lists that will drift.

---

## F6 — Registration-handoff type contradicts a MANDATORY rule (GOVERNANCE)

`types.ts:2719` `export type AdminProspectRegistrationHandoffState = 'pending' | 'enrolled' | 'no_show' | 'withdrew';` — a registration-handoff **state machine**.

This contradicts a **mandatory** locked-spec rule (`docs/locked-spec.md:323`): *"The system has no programmatic registration handoff to THREE. No registration routes. No registration handoff state machine."* — and `docs/AGENT-BRIEFING.md:64`: *"There is no registration/handoff/* route family — that was Codex drift, dropped."*

**Action:** this type must not propagate to any new store. If it is really an **admin-side mirror** of a prospect's III enrollment status (which THREE owns), rename it to say so — e.g., `AdminProspectEnrollmentMirrorState` — and never a "handoff." If it is dead drift, remove it. Flag for Kevin.

---

## F7 — Prospect / BA / Customer boundary (keep separate)

The three entities (§0) must never share a field or collapse. The conversion `prospect → new brand ambassador (= member)` is a state transition captured by a disposition value, not by putting a member id on a prospect-as-member. `becameCustomer` is a distinct flag (product buyer), orthogonal to membership.

---

## Canonical naming rules (what new stores adopt from birth)

1. **Member id:** `tmagId` (camelCase) / `tmag_id` (snake_case per layer, P10 §3.6); role-prefixed `<role>TmagId`. `TMAG-…` id values. Never `baId`/`tmBaId`/`TMBA-`.
2. **III mirror:** `threeBaId` / `threeUsername` — distinct, retained.
3. **Enum spelling:** snake_case; one canonical enum per concept; no aliases.
4. **Entity words:** `prospect` (funnel), `brand_ambassador` (= member), `customer` (buyer) — spelled out, never `ba`.
5. **One concept, one name** across all stores, cased per layer (`DECISION_governed_dedicated_stack_founding_principle` §3.2).

---

## Application

These are **findings + canonical targets**, not applied changes. Two tracks:

- **New stores (now):** Phase 7 `mcs_*` records and the dedicated stack adopt the canonical names **from birth** — including renaming the Phase 7 fields `confirmedByBaId`/`reviewedByBaId`/`baId` → `confirmedByTmagId`/`reviewedByTmagId`/`tmagId` while they are still un-applied (recommended next step, pending Kevin's go).
- **Existing stores (migration):** the `*BaId`→`*TmagId` rename, `TMBA-`→`TMAG-` id values, disposition unification, alias removal, and the F6 registration-handoff resolution execute in the **one governed reconciliation migration** — code + persisted data together, reversibly, not piecemeal.

Nothing here is applied. It is the review surface that keeps the drift out of the new stores.
