# P7.16 — Canonical Person-Journey Enumeration (prospect → member)

- Phase: Phase 7 — schema review (pre-apply)
- Status: **DESIGN / PROPOSAL — nothing applied.** Defines the ONE canonical enumeration of "what a person did" so the scattered journey enums (audit F5) converge instead of drifting into the new stores.
- Base: `feature/phase-07-outcomes-learning-graphrag`.
- Grounded in: `TokenState`, `ProspectTimelineEventKind`, `VmLeadLifecycleStatus`, `McsOutcomeKind`, onboarding flags — reconciled per `FINDING_naming_concept_drift_audit` F5 + the one-concept-one-name rule.

---

## 0. The idea

A person in the system has a **journey** with two phases that cross at one point:

```
PROSPECT  ──(signed up = enrolled = became a new Brand Ambassador = new Team Mag member)──▶  MEMBER
```

Everything the app tracks about "what they did" should derive from **one** canonical milestone list — not the 3–4 overlapping enums we have today. Those enums become **views/subsets** of the one vocabulary:

| Existing enum | What it really is | Relationship to canon |
|---|---|---|
| `TokenState` (9) | the prospect funnel **lifecycle rail** (current position) | a *subset* of Phase A milestones |
| `ProspectTimelineEventKind` (~26) | the append-only **event log** | *records* canonical milestones as they happen |
| `VmLeadLifecycleStatus` (~18) | VM lead's copy of the funnel | should **derive from**, not duplicate, the canon |
| `McsOutcomeKind` (7) | BA-**confirmed** milestones (R1) | the confirmable subset |
| `ProspectStatus` (F6, 4) | current **standing** (pending/enrolled/no_show/withdrew) | a *rollup* of the canon |

**One vocabulary; many views.** That is the F5 fix.

---

## 1. Phase A — Prospect journey (funnel)

Ordered milestones (a person is a **prospect** here — a non-BA going through the Dr. Dam video + holding-tank/`.com` process):

| # | Canonical milestone | Plain English | Today's source |
|---|---|---|---|
| A1 | `invited` | got an invitation link | token `minted` |
| A2 | `link_clicked` | opened the link | `clicked` / `link_clicked` |
| A3 | `video_started` | started the video | `video_started` |
| A4 | `video_25` / `video_50` / `video_75` | watched ¼ / ½ / ¾ | `video_quarter/half/three_quarter` |
| A5 | `video_completed` | finished the video (**pool position anchors here**) | `video_complete` |
| A6 | `info_requested` | "tell me more" | `info_requested` |
| A7 | `callback_requested` | raised a hand for a callback | `callback_requested` |
| A8 | `webinar_reserved` | **went to sign up for** a webinar | `webinar_reserved` |
| A9 | `webinar_attended` | **attended** the webinar | outcome `webinar_attended` |
| A10 | `dashboard_entered` | entered the six-section dashboard | `dashboard_entered` |
| A11 | `became_customer` | bought product (a **customer**, not a member) | `becameCustomer` |
| **A12** | **`enrolled`** | **signed up — became a new Brand Ambassador (= new Team Mag member)** | token `enrolled` / outcome `enrolled_three` / disposition `new_brand_ambassador` |
| A13 | `declined` | said no | outcome `declined` |
| A14 | `no_show` | reserved but didn't attend | outcome `no_show` |
| A15 | `expired` | token aged out (terminal) | token `expired` |

**A12 is the crossover.** Note the drift it exposes: *the same event* is called `enrolled` (TokenState), `enrolled_three` (outcome), and `new_brand_ambassador` (disposition). Canon: **one milestone, `enrolled` → the person becomes a member.** (`became_customer` is a *separate* milestone — a customer is not a member.)

### 1a. Terminal OUTCOME — the small closed set (Kevin, 2026-07-01)

**Milestones ≠ outcome.** The many milestones above are the *events along the road*; the **outcome** is how the prospect ultimately **resolved**, and that is only **two or three choices** (+ "pending" while still in motion):

| Outcome | Meaning | = milestone |
|---|---|---|
| `pending` | still in the journey, not resolved | — |
| `enrolled_iii` | **enrolled into III International** (became a Brand Ambassador = Team Mag member) | A12 |
| `became_customer` | became a **product customer** (uses product; may or may not also enroll) | A11 |
| `declined` | said no / did not convert | A13 |

This is the **resolution** dimension (§3.3). It is **not** the same as "attended a webinar" — that's a milestone (A9). This corrects the R1 `McsOutcomeKind`, which wrongly mixed **milestones** (`webinar_attended`, `callback_completed`, `orientation_attended`, `no_show`) in with **outcomes** (`enrolled_three`, `became_customer`, `declined`): the milestones move to the event log (§1), the **outcome enum collapses to the closed set above.**

Note: `enrolled_iii` and `became_customer` are **not strictly exclusive** — a customer may later enroll. Order is allowed (`became_customer → enrolled_iii`); the *current* terminal outcome is whichever is furthest along.

**Terminology precision (Kevin, 2026-07-01):** `enrolled_iii` = **enrolled into III International = became a Brand Ambassador (BA)**. A **"member"** specifically means a **member of Team Magnificent (TMag)** — the app-level identity (`tmagId`) that results from being a BA in Kevin's downline. BA is the III-level event; member is the TMag-level identity.

**This outcome set unifies with F6 `ProspectStatus`.** "How did the prospect resolve" is one concept — `pending · enrolled_iii · became_customer · declined` — not two enums. The F6 rename (`AdminProspectRegistrationHandoffState → ProspectStatus`) and this outcome enum reconcile to the **same** set in the migration (one-concept-one-name). **Applied now:** R1 `McsOutcomeKind` was reshaped to this closed set while un-applied (`mcs_outcomes` born canonical).

---

## 2. Phase B — Member onboarding journey (starts at `enrolled`)

Once `enrolled`, the person is a **member (Brand Ambassador)** and walks the onboarding road (gated by `requireSteveComplete`):

| # | Canonical milestone | Plain English | Today's source |
|---|---|---|---|
| B1 | `welcomed` | saw the welcome | `welcome_seen` |
| B2 | `commitment_accepted` | accepted the commitment | `ba_commitments` |
| B3 | `questionnaire_complete` | did the 21-answer questionnaire | `questionnaire_complete` |
| B4 | `discovery_complete` | completed Steve's Discovery & Success Interview | `steve_discoveries.successProfile` |
| B5 | `workbook_complete` | finished the sponsor-led workbook | `workbook_complete` |
| B6 | `orientation_attended` | attended BA orientation | outcome `orientation_attended` |
| B7 | `fast_start_1..5_complete` | completed Fast Start modules 1–5 | `fast_start_progress` |
| B8 | `onboarding_complete` | gate opens — full app access | derived (all above) |

The **interviewing template** (Steve) drives B3–B4; the **learning template** (Michael) drives B5–B7.

---

## 3. The three dimensions (keep distinct — one-concept-one-name)

The canon separates cleanly into three *different* questions, so they never collapse into one ambiguous "status" (the F6 caveat):

1. **Where are they? (lifecycle/state)** — the current position on the funnel rail (`TokenState`) or onboarding step. *Point-in-time.*
2. **What happened? (events)** — the append-only timeline of milestones above (`ProspectTimelineEventKind`). *History.*
3. **How did it resolve? (outcome)** — the **small closed set** (§1a): `pending · enrolled_iii · became_customer · declined`. *Result.* (Not the milestone log; a milestone like `webinar_attended` is *not* an outcome.)

Same milestone vocabulary for (1)+(2); a separate, tiny **outcome** enum for (3) — not three sprawling vocabularies.

---

## 4. Reconciliation actions (into the migration)

1. **Adopt the canonical milestone names** (A1–A15, B1–B8) as the single vocabulary.
2. **`enrolled` unification** — collapse `enrolled` / `enrolled_three` / `new_brand_ambassador` to the one crossover milestone (the person becomes a member). Keep `became_customer` separate.
3. **`VmLeadLifecycleStatus` derives from** the canon (or is dropped in favor of it) rather than maintaining a parallel ~18-value list (F4/F5).
4. **`ProspectTimelineEventKind`** stays as the *event log*, but its values are drawn from the canon (no synonyms).
5. **Split `McsOutcomeKind` (R1)** — move the *milestones* (`webinar_attended`, `callback_completed`, `orientation_attended`, `no_show`) into the event log (§1); the **outcome** enum collapses to the closed set `pending · enrolled_iii · became_customer · declined` (§1a). This changes the Phase 7 R1 `mcs_outcomes` record shape — **do it now, while un-applied.**
6. Executes in the reconciliation migration; the **new stores use canonical milestone + outcome names from birth.**

---

## 5. Open decisions for Kevin

1. **Video milestones granularity** — keep 25/50/75/complete (recommended — the pool + engagement logic already uses them), or collapse to started/completed?
2. **`enrolled` wording — RESOLVED:** the crossover outcome is **`enrolled_iii`** (enrolled into III International = became a Brand Ambassador). "Member" = TMag member (the resulting identity). Milestone A12 may stay `enrolled` on the funnel rail; the *outcome* is `enrolled_iii`.
3. **Customer track** — is `became_customer` a milestone on the *same* journey, or a separate customer journey? (Recommend same journey, distinct terminal-ish milestone, since a customer may still enroll later.)

---

## Bottom line

"Enumerate what they did" — done once. A person travels the **prospect journey** (invited → … → **enrolled**), crosses into the **member journey** (welcomed → … → onboarding_complete), and every enum we keep (lifecycle, event log, status, outcomes) is a **view of the same canonical milestone list** — not a competing copy. That's the F5 fix and the thing that keeps the journey from fracturing into four slightly-different vocabularies once the stores go live.
