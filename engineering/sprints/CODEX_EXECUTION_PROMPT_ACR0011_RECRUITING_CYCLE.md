# Codex Execution Prompt — Implement ACR-0011: 5 Point Recruiting Cycle (Launch + PMV + CRM)

You are working inside the Momentum Creation System V2 repository (`D:/momentum-creation-system-v2`).

Architecture Version: 1.0 (FROZEN)
Governance: **ACR-0011 APPROVED** (ratified by Kevin Gardner 2026-07-07) · ACR-0007 APPROVED (direct triple-stack persistence)
Authoritative spec: `organization/ACR-0011-five-point-recruiting-cycle.md` + `organization/DECISION_upline_onboarding_infusion.md` — read both FIRST.
Branch base: `main` (must include merges `9472ec5` and `dcc26dd`)
Date: 2026-07-07

---

## Why this task exists (verified 2026-07-07, not assumed)

ACR-0011 infuses the upline's proven 5 Point Recruiting System (List → Connect/Invite → Present → Follow Up → Onboard) into MCS v2 as a tracked, coached recruiting cycle with time-boxed milestones: five steps by enrolled+48h, QBA by enrolled+72h (one enrollment left leg + one right leg, intro pack or better), CORE 3 on the third enrollment. The ACR is approved; **nothing is implemented yet**.

**What already exists (verified in code — build ON it, not beside it):**
- `server/src/domain/prospects.ts` + Mongo `tmag_prospects` — the PMV state machine: `minted → clicked → video_started → … → video_complete → enrolled | expired`, with `tmag_prospect_invite_tokens`, `tmag_prospect_invitation_activity`, timeline events, magic links.
- Mongo `tmag_ivory_prospect_names` (`ivoryId`, `tmagId`, `firstName`, `status`) — the BA-entered names list, pre-invite.
- `server/src/domain/prospectCrm.ts` + `tmag_prospect_crm_records` / `tmag_prospect_crm_followups` / `tmag_prospect_crm_dispositions` — CRM notes/follow-ups/dispositions over prospects.
- `server/src/domain/steve-success-interview.ts` + `tmag_steve_success_interview` (`successProfile`) + `tmag_agent_steve_events` + `requireSteveComplete` middleware — Steve's completion is a detectable event with a stored Success Profile.
- `server/src/domain/michael-training-support.ts`, `todaysActions.ts`, `tmag_agent_michael_events`, Chroma `mcs_agent_michael_events` / `mcs_michael_runtime_turns` — Michael's coaching surfaces.
- `team_magnificent_members` (`tmagId`, sponsor chain) — genealogy source; Neo4j is the relationship layer.
- Worker pattern to mirror: `server/src/workers/vmDeliveryWorker.ts` (polling worker over a queue/records with `availableAt`/status).
- Collection provisioning law: `server/scripts/provisioning/rev3-registry.mjs` + `provision-mongo/chroma/neo4j.mjs` — NEW collections must be added to the rev3 registry and provisioned, `$jsonSchema` floor via Mongoose (SCHEMA_GOVERNANCE.md), snake_case at the store.
- KB context: the upline reference corpus is ingested (33 sources / 198 chunks, `authorityRef` prefix `upline-legacy-makers:`), scoped to `michael_magnificent` + `ivory` — Michael's coaching copy can ground on it.

**Terminology reconciliation (verified):** the ACR text says names live as "PMV prospect records at stage Identified." The implemented PMV enum has no `identified` state — the codebase splits this into `tmag_ivory_prospect_names` (name captured, no invite yet) and `tmag_prospects` (invite minted onward). Implement the mapping as: **names-list count = `tmag_ivory_prospect_names` records for the BA; a name "graduates" when an invite token is minted (`tmag_prospects` record exists).** This preserves ACR intent (no new collection for names, count is a query) against real state.

---

## Persistence law (ACR-0007 — do not deviate)

- Every write lands in **Mongo + Neo4j + Chroma** in one logical op, **read-back verified**; flag any failing leg loudly — never silently skip a leg.
- Universal Gateway (`localhost:2526`) is developer tooling only — never a production persistence path. No Redis.
- Chroma embeddings via the GPU embedding service path already used by the server — never a silent CPU fallback.

---

## Task — implement the recruiting cycle end to end

1. **Schema (`packages/shared` + rev3 registry):** new collection `tmag_recruiting_cycles` (Chroma twin `mcs_recruiting_cycles`, Neo4j projection) — one per BA, created at cycle start. Fields per ACR-0011 §2.4 (`recruiting_cycle` shape): `tmag_id`, `enrolled_at`, `five_point_target_at` (+48h), `five_point_completed_at`, `qba_target_at` (+72h), `qba_achieved_at`, `qba_left_leg_tmag_id`, `qba_right_leg_tmag_id`, `qba_attested_by`, `core3_achieved_at`, `core3_tmag_id`, `names_target` (100), `tranche_size` (20), `current_step` (1–5), `last_activity_at`, `stall_flagged_at`, `status`. Mongoose-authored, `$jsonSchema` floor, snake_case at the store, registered in rev3 provisioning.

2. **Steve initialization hook:** on Discovery completion (the existing Steve-complete event path in `steve-success-interview.ts`), create the BA's recruiting-cycle record with targets computed from enrollment, extract the `why_statement` verbatim from the Success Profile motivation section, embed it to Chroma (retrievable for why-replay), and emit a handoff event to Michael via `tmag_agent_michael_events`. Steve does not coach — initialization only (role boundary per the constitutional binder).

3. **Activity wiring (derive, don't duplicate):** `current_step`, per-step completion, and tranche progress are DERIVED from existing surfaces — names count from `tmag_ivory_prospect_names`, invites from `tmag_prospects` minted, presentations from PMV video engagement states, follow-ups from `tmag_prospect_crm_followups` completions, onboarding from prospect `enrolled`. Any qualifying activity updates `last_activity_at` on the cycle. Do NOT create a parallel activity log — `tmag_prospect_invitation_activity` + CRM records + PMV states are the event truth.

4. **Milestone evaluator (server job):** computes five-point completion; QBA and CORE 3 milestone fields are written ONLY via sponsor attestation (task 6) — the evaluator caches/validates against Neo4j enrollment edges, it never self-declares QBA. Milestone hits write `launch_milestone_reached`-style events (triple-stack) and notify Michael's surface for celebration.

5. **Stall sweep (worker, mirror `vmDeliveryWorker.ts`):** flags a cycle stalled when no qualifying activity for **24h while inside the 72h QBA window, 72h thereafter** until cycle completion (LOCKED values — read them from config/constants, not scattered literals). The sweep FLAGS ONLY (`stall_flagged_at`, support event); Michael owns the response voice: his stall touch retrieves the BA's own `why_statement` from Chroma and opens with it (why-replay) before coaching the earliest incomplete step. Michael's daily coaching (via `michael-training-support.ts` / `todaysActions.ts`) becomes step-keyed: earliest incomplete step → that step's daily actions, including tranche prompts ("next 20 names") until 100.

6. **Sponsor QBA/CORE 3 attestation (LOCKED: manual, no THREE back-office API):** team/admin surface where the SPONSOR attests left-leg and right-leg enrollments (and the CORE 3 third). Attestation writes: milestone fields + `qba_attested_by` on the cycle, a `tmag_vm_audit_events`-style audit entry, and Neo4j enrollment edges `(:BA)-[:ENROLLED {leg, at}]->(:BA)` — the graph is the verifiable genealogy source, Mongo milestone fields are the cached answer. Gate behind `requireAuth`; only the sponsor of record (or Kevin/admin) may attest.

7. **Team app — launch checklist dashboard (`apps/team`):** the new-BA home surface renders the 5 Point cycle with live state: names progress (x/100, tranche y/5), current step's daily actions, 48h/72h countdown chips, the BA's why pinned, Michael's latest touch, step-attached resources. **Countdowns are momentum targets in Michael's supportive framing — never failure language** (ratified as written; Launch/Fast Start philosophy pages 4–5 bind copy tone). Sponsor view: cycle status of their enrollees + pending attestations. Follow the existing launch-rail/cockpit component patterns — do not invent a new design system.

8. **Tests (Vitest, match existing server style):** cycle created on Steve completion with correct targets and why_statement embedded; derived step/tranche counts correct against seeded names/prospects/follow-ups; stall sweep flags at 24h inside window and 72h after — and does NOT message; attestation writes milestone + audit + graph edges and rejects non-sponsors; milestone evaluator refuses to self-declare QBA without attestation; every cycle write reads back across all three legs.

---

## Hard constraints

- Do NOT modify ratified docs (`constitution/**`, `runtime/**`, `organization/**`, `docs/locked-spec.md`). ACR-0011 authorizes this build; it does not authorize editing governance.
- Do NOT create a parallel prospect/names/activity store — derive from `tmag_ivory_prospect_names`, `tmag_prospects`, PMV activity, and CRM follow-ups (CRM entity boundary: no duplicate canonical records).
- The lead qualification system (`magnificent-lead-qualification-system-v1`) is EXCLUDED — no integration, no imports (LOCKED).
- QBA/CORE 3 are sponsor-attested ONLY — no THREE back-office calls, no auto-declaration (LOCKED).
- LOCKED numbers: 100 names, tranche 20, stall 24h/72h, targets +48h/+72h — constants in one place.
- Preserve `requireAuth` + `requireSteveComplete` gating patterns; sponsor-only attestation.
- New collections go through the rev3 registry + provisioning scripts — no ad-hoc collection creation.
- Additive only for `@momentum/shared`; don't break exports. Coordinate with the concurrent Michael/Ivory/VM briefs also touching `packages/shared` and Michael's runtime — land shared additions cleanly or sequence.
- No `.com` surface changes. No Universal Gateway runtime persistence. No time estimates in output unless Kevin asks.

---

## Close (required verification)

- `pnpm --filter @momentum/shared typecheck && pnpm --filter @momentum/server typecheck && pnpm --filter @momentum/team typecheck` — green.
- `pnpm --filter @momentum/server test` — all green including the new recruiting-cycle suites.
- Provisioning: run the rev3 provision scripts; show the new collections asserted across Mongo + Chroma + Neo4j.
- Demonstrate end-to-end against a running server: Steve completes Discovery → cycle created with correct targets + why embedded → names added (tranche math correct) → invite minted graduates a name → stall sweep flags after simulated inactivity and Michael's touch opens with the BA's why → sponsor attests left+right legs → QBA milestone + graph edges written and read back → team dashboard renders live state with supportive countdown framing.
- `git status` review confirming only intended `packages/shared/src/**`, `server/src/**`, `server/scripts/provisioning/**`, `apps/team/src/**`, and test files changed.
- Kevin reviews and merges under gates (branch → PR → `gates` → merge).
