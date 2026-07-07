# ACR-0011 — 5 Point Recruiting Cycle (Launch Center + CRM Integration)

## Momentum Creation System V2

Status: Approved

Ratified: Kevin Gardner, 2026-07-07 — approved as written (milestone targets in Michael's supportive framing; stall thresholds 24h/72h stand)

Canonical Authority: LAUNCH_CENTER_ARCHITECTURE.md / CRM_ARCHITECTURE.md

Target Version: v1.2

Decision Owner: Kevin Gardner

Proposer: Claude — analysis of upline onboarding funnel (rlegacymakers.com), 2026-07-07

Affects: LAUNCH_CENTER_ARCHITECTURE.md (milestones, Stage 5–7 actions), CRM_ARCHITECTURE.md (Prospect CRM usage pattern, follow-up categories), packages/shared (schema additions), server (milestone evaluator, stall sweep), team app (launch checklist dashboard), Steve (initialization handoff), Michael (stage coaching)

---

## 1. Context

The upline's onboarding site documents a proven launch curriculum — the 5 Point Recruiting System (List → Connect/Invite → Present → Follow Up → Onboard) with time-boxed goals (five steps in 48h; QBA in 72h — one enrollment left leg + one right leg; CORE 3 on the third). It is delivered as static PDFs with the human sponsor as the only runtime.

MCS v2 already owns the runtime pieces: Launch Center Stages 0–10, Prospect CRM lifecycle, `crm_activities` / `follow_ups` / `crm_timeline_entries`, Steve (Discovery → Success Profile), and Michael (Daily Success Coach). This ACR wires the 5 Point cycle INTO those ratified structures. It creates no parallel pipeline and no duplicate canonical records (per CRM_ARCHITECTURE.md entity boundary).

## 2. Decision (proposed)

### 2.1 Stage mapping — no new stages

The 5 Point cycle maps onto existing Launch Center stages:

The prospect-facing steps (1–4) live in the **PMV** (PMV_ARCHITECTURE.md prospect journey, stages Identified → Enrolled). The ownership split is per PMV Page 8: BA owns the relationship, PMV owns awareness, Ivory owns invitation support, CRM owns notes and follow-up tasks.

| 5 Point step | Launch Center home | Canonical data surface |
| --- | --- | --- |
| 1. Make Your List | Stage 5–6 (First Meaningful Action / Invitation Readiness) | PMV prospect record at journey stage `Identified` (+ CRM notes) |
| 2. Connecting & Inviting | Stage 6 (Invitation Readiness) | PMV journey `Invited` / `Invitation opened`; PMV invitation tracking; Ivory wording support |
| 3. Presenting | Stage 7 (PMV and CRM Readiness) | PMV journey `Presentation started/engaged/completed`, `Dashboard explored`, `Webinar reserved` |
| 4. Follow Up | Stage 7 + PMV follow-up architecture | PMV state-matched follow-up posture; CRM `follow_ups` holds the tasks |
| 5. Onboarding New BA | Stage 10 → duplication | PMV journey `Enrolled`; new BA enters Launch Stage 0 |

### 2.2 Names list = PMV prospect records (LOCKED by Kevin, 2026-07-07; surface corrected to PMV per Kevin)

- Target: **100 prospect records** per launching BA, built in **tranches of 20** (5 tranches).
- A "name" is a PMV prospect record at journey stage `Identified`, assigned to the BA. No new collection; the count is a query against PMV prospect records. Prospect CRM remains the notes/follow-up-task interface over the same canonical records — no duplication.
- List-building exit criterion for coaching purposes: first tranche (20) complete. Michael continues prompting subsequent tranches through the launch window until 100.
- The lead qualification system (`magnificent-lead-qualification-system-v1`) is **explicitly out of scope** — no integration, no imports. Warm-market names entered by the BA only.

### 2.3 New launch milestones (extends LAUNCH_CENTER_ARCHITECTURE.md milestone list)

- `first_prospect_tranche_completed` (20 names)
- `names_list_completed` (100 names)
- `five_point_cycle_completed` — target: enrolled_at + 48h
- `qba_achieved` — target: enrolled_at + 72h; one enrollment left leg + one right leg, intro pack or better
- `core3_achieved` — third enrollment

Milestone deadlines are coaching targets surfaced by Michael, recorded as `launch_milestone_reached` events when hit. Note for ratification: Launch Center philosophy (Pages 4–5) prohibits urgency pressure and shaming slower starters. This ACR implements the 48h/72h marks as momentum targets in Michael's supportive voice — countdowns visible, never framed as failure when missed. If Kevin wants hard-deadline framing instead, that is a philosophy amendment and should be noted at approval.

### 2.4 Schema additions (packages/shared, Mongoose-authored, snake_case at the store)

Extend the existing launch lifecycle record (Mongo, launch state owner per LAUNCH_CENTER_ARCHITECTURE.md Page 7) with a `recruiting_cycle` subdocument:

```
recruiting_cycle: {
  five_point_target_at: Date,        // enrolled_at + 48h
  five_point_completed_at: Date | null,
  qba_target_at: Date,               // enrolled_at + 72h
  qba_achieved_at: Date | null,
  qba_left_leg_ba_id: ObjectId | null,
  qba_right_leg_ba_id: ObjectId | null,
  qba_attested_by: ObjectId | null,  // sponsor — see 2.6
  core3_achieved_at: Date | null,
  core3_ba_id: ObjectId | null,
  names_target: Number,              // 100
  tranche_size: Number,              // 20
  last_activity_at: Date,            // drives stall detection
  stall_flagged_at: Date | null
}
```

All writes via persist()/tripleStackWrite. Neo4j: enrollment edges `(BA)-[:ENROLLED {leg, at}]->(BA)` remain the genealogy source; Mongo milestone fields are the cached answer. Chroma: the BA's why_statement (from Steve's Success Profile) and Michael's coaching touches embed to the existing launch/coaching collections for retrieval.

### 2.5 Stall detection (LOCKED definition)

A launching BA is **stalled** when no qualifying launch activity (PMV prospect created, PMV invitation sent, PMV presentation engagement recorded, `follow_up_completed`, `launch_action_completed`) has been recorded for:

- **24 hours** while inside the 72h QBA window;
- **72 hours** thereafter until `launch_completed`.

Sweep job flags only (`stall_flagged_at`, activity `support_need_flagged`). Michael owns the response: retrieve the BA's own why_statement from Chroma and open with it (why-replay), then coach the earliest incomplete step. Consistent with CRM Page 5: momentum slowdown triggers support, never shame.

### 2.6 QBA verification — manual sponsor attestation (LOCKED by Kevin, 2026-07-07)

No THREE back-office integration. The sponsor manually attests left-leg and right-leg enrollments in the team/admin UI; attestation records `qba_attested_by`, writes the `qba_achieved` milestone, logs a `crm_activities` entry, and creates the Neo4j enrollment edges. Same pattern for CORE 3.

### 2.7 Agent behaviors

- **Steve** (unchanged role boundary — interviews, does not coach): on Discovery completion, the launch record's `recruiting_cycle` is initialized (targets computed from enrolled_at), why_statement extracted verbatim to the Success Profile and embedded. Handoff event to Michael via agent runtime (S2.1).
- **Michael**: daily coaching keyed to earliest incomplete 5 Point step; tranche prompts (next 20 names); milestone countdowns in supportive framing; stall response per 2.5; QBA/CORE 3 celebration; duplication prompt at launch completion (walk your new enrollee through the same cycle).
- **System jobs (server)**: stall sweep; milestone evaluator (reads Neo4j enrollment edges, writes cached milestone fields); tranche-count reconciliation from PMV prospect-record queries.

### 2.8 Team app — launch checklist dashboard

New BA home screen renders the 5 Point cycle with live state: names-list progress (x/100, tranche y/5), current step's daily actions, 48h/72h countdown chips, pinned why_statement, Michael's latest touch, and stage-attached resources (scripts, presentation tools, calendar). Sponsor view: recruiting-cycle status of their enrollees plus pending QBA attestations.

## 3. Consequences

Positive: proven upline curriculum becomes a tracked, coached runtime inside ratified structures; zero duplicate canonical records; QBA/duplication velocity become graph queries; sponsor gets an attestation workflow instead of memory.

Costs: one subdocument schema addition, two server jobs, milestone-list amendment to LAUNCH_CENTER_ARCHITECTURE.md, dashboard surface in team app. Coordinates with S2.2 context packets (Michael's touches reference packet ids).

Out of scope: lead qualification system, THREE back-office API, event/showcase invite automation (candidate follow-on ACR), any prospect-record PII beyond what Prospect CRM already defines.

## 4. Decisions locked at proposal (Kevin, 2026-07-07)

1. Names list: 100 names, tranches of 20. ✔
2. Prospect integration: CRM only; lead qualification system excluded. ✔
3. Stall threshold: 24h inside QBA window / 72h after (definition in 2.5). Kevin may adjust values at approval.
4. QBA verification: manual sponsor attestation. ✔
5. ACR number: 0011 (register verified, next after ACR-0010).
