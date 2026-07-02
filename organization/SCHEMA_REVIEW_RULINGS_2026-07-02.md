# MCS V2 — Schema Review Rulings (Kevin's review session)

Review started: 2026-07-02 · Authority: Kevin L. Gardner (sole and final)

Status: **IN PROGRESS** — this document captures Kevin's rulings as he walks the
schema (`MCS_V2_MASTER_SCHEMA_CATALOG.md` + `P10_MCS_V2_SCHEMA_DESIGN.md`).
On completion these rulings amend the schema design and are folded into the
approval that lifts the write-freeze. Recorded live by Claude at Kevin's
direction; each ruling is Kevin's verbatim intent, restated precisely.

---

## Ruling 1 — §0 Identity & membership spine: APPROVED

The spine is correct as designed: a member is an enrolled III International BA
in Kevin's downline; `tmagId` is the sole login identifier; `threeBaId` is a
mirrored attribute that never authenticates; sponsor captured at signup is
immutable; THREE is upstream authority — the app mirrors, never overrides.

## Ruling 2 — Member id format: DATE-FREE (amendment)

The canonical member id must NOT embed the enrollment date. `TMAG-YYYYMMDD-XXXXXX`
is rejected. Rationale (Kevin): the date belongs in the database, not in the
login — `createdAt` already stores it; ids must be opaque; an id that encodes
join date leaks seniority through the login identifier.

Amended canon: **`TMAG-XXXXXX`** — six crypto-random characters
(`crypto.randomBytes`, ambiguity-free alphabet excluding `0/O/1/I`),
collision-retry against the uniqueness constraint. CONFIRMED by Kevin
2026-07-02. Founders `TMAG-01` / `TMAG-02` remain named exceptions.

Implementation vehicle: rides INSIDE the already-planned governed
reidentification migration (`tm*` → `tmag*`,
`MCS_V2_REIDENTIFICATION_MIGRATION_PLAN.md`) so member ids are touched exactly
once. Code anchor: `mintTmagId()` in `server/src/domain/adminBaCrud.ts`
(currently `TMAG-${ymd}-${Math.random…}` — both the date segment and the
`Math.random` source are replaced).

## Ruling 3 — Genealogy scope: DOWNLINE MEMBERSHIP ONLY

The only genealogy fact that matters to Team Magnificent in this app is that a
person IS in Kevin's downline (membership eligibility), computed from the
immutable `sponsorTmagId` chain rooted at `TMAG-01`. Direct sponsorship is
additionally kept for CRM ownership and attribution.

Beyond that, genealogy does not matter in this context: the app does NOT model
or mirror THREE genealogy — no binary legs, no placement position, no depth
structure, no volume flow, no rank structure. THREE's back office is the sole
authority for all of it (consistent with the existing never-compute-CV rule).

Boundary clarification recorded with this ruling: the app's own "placement"
concepts — holding-tank position, beneath-you counter, live-place displays —
are app-owned MARKETING MECHANICS, categorically distinct from THREE genealogy,
and make no claim about actual THREE placement. Any future feature seeking
THREE-genealogy detail beyond the downline test requires its own ACR.

---

## Ruling 4 — Member, not Brand Ambassador (reaffirmed + sharpened)

Reaffirms `DECISION_team_magnificent_membership_canonical_identity.md`
(approved 2026-07-01): "Brand Ambassador" is a THREE International role; the
app's canonical entity is the **member** (a BA in Kevin's downline). Today's
sharpening (Kevin, 2026-07-02): membership and team-BA status are
**coextensive** — you must be a BA to be in Team Magnificent, only downline BAs
are on the team, and **if you are a BA in Team Magnificent you ARE a member**.
"Member" is therefore the only correct entity name app-wide; `baId`-style
naming and the `brand_ambassadors` / `BrandAmbassador` names are confirmed
misnomers, corrected under the one reidentification migration. This also
resolves schema-design §5.1 (BA vs BrandAmbassador label split): the answer is
NEITHER — both reconcile to the member label.

Drift flags raised during this ruling (for the prefix-canon decision):
- The decision doc targets `mcs_members`, but `tmag` is the brand token and
  PR #108 moved app collections to `tmag_`. Proposed target: **`tmag_members`**
  — to be settled with the prefix canon.
- The decision doc's id-format line carried the superseded dated format —
  annotated with the Ruling 2 amendment (done 2026-07-02).

---

## Ruling 5 — Access codes: Kevin-minted now, agent-issued at scale

Group A access-code model confirmed with a staged issuance path (Kevin,
2026-07-02):

- **Phase 1 (now):** only Kevin mints access codes. One `TMAG-XXXX` code per
  member, for life, reused for everyone they sponsor — model confirmed as-is.
- **Phase 2 (trigger: ~100 members):** an access-code agent takes over
  issuance. A member accesses the agent to obtain the code for their downline
  growth — concretely, the agent mints a NEW member's own lifetime
  `accessCodeHeld` per mechanical eligibility rule (requester is a member in
  good standing; code binds to them as sponsor; one per member for life).
- **Guardrails:** the agent is deterministic issuance, NOT judgment — no LLM
  discretion over eligibility (consistent with agents-never-approve). Every
  mint is triple-stack audit-logged, rate-limited, and behind Kevin's kill
  switch, per the existing agent activation patterns.
- **Schema impact (fold into P10 design before validators):** add
  `mintedVia: 'kevin' | 'agent'` attribution to `access_codes`; the agent gets
  an identity in the agent-events family when built. The 100-member threshold
  is operational policy, not schema.

---

## Ruling 6 — RESOLVED: Questionnaire folds into Steve's interview

Kevin, 2026-07-02: the self-serve questionnaire predates Steve and is
RETIRED as a separate onboarding stage — folded into Steve's Discovery &
Success Interview. Rationale (Kevin, verbatim intent): "the real point of
this is to interview and ask questions so that we can determine how to best
support the member's success, and asking questions is the only way to
determine what's so." Steve IS that purpose; the questionnaire was its
pre-Steve form.

Consequences:
1. Onboarding spine becomes TWO stages: Steve discovery → sponsor workbook
   call. The sponsor-prep purpose moves to Steve's Success Profile (the
   sponsor-only profile read already exists).
2. The mentorship gate on Steve-complete (`requireSteveComplete`) is now
   canon, not drift.
3. **Gap analysis required before retiring the form:** map the 21
   questionnaire fields (employmentStatus, weeklyHours, coachability,
   nwmExperience, go-getter indicators, biggestWin, whyNow, …) against
   Steve's 36-question/11-section script; absorb any uncovered questions
   into Steve's script so no support-relevant signal is lost.
4. Schema: NO validators authored for the questionnaire collection; it is
   deprecated. Existing submissions are preserved (Non-Destructive Rule) as
   historical records — no deletion.
5. Implementation follow-ups (gated slices, Kevin merges): retire
   `/api/onboarding/questionnaire` route + team UI wizard; reconcile the
   onboarding-spine references (TEAM Design C.5, questionnaire.ts header,
   wireframe) to the two-stage spine.

---

## Ruling 6-directive (executed) — doc clarity + commitment content

Directive executed (Kevin, 2026-07-02): the catalog now states plainly that
`commitments` is the click-acknowledge ACCEPTANCE record of The Team
Magnificent Commitment (audit-grade; not an interview), and that
`questionnaires` is stage 2 of the designed 3-stage onboarding spine
(Steve conversation → written questionnaire → sponsor workbook), distinct
from Steve's Success Profile.

**NEW DELIVERABLE (owner: Kevin):** author the actual Team Magnificent
Commitment text — the substantive agreement the member clicks to accept.
Code versions the acceptance (`COMMITMENT_VERSION`), but the governed
commitment copy itself does not yet exist as an artifact. To be written,
versioned, and referenced by the welcome surface.

**OPEN — Ruling 6:** questionnaire disposition — (a) keep all three stages,
(b) retire questionnaire in favor of Steve (the mentorship gate already runs
on requireSteveComplete in code), or (c) keep as optional. Awaiting Kevin.

---

## Ruling 7 — Group B funnel spine: RATIFIED

Kevin, 2026-07-02: the prospect funnel mechanics were designed and locked in
prior sessions and are RATIFIED as encoded in the schema — the tmag prospect
record, the opaque-token identity surface, the forward-only token lifecycle
(minted → clicked → video milestones → video_complete → enrolled | expired,
plus declined/customer signals), the holding tank / one shared team pool with
monotonic never-renumbered positions, prospect re-entry (account → magic link
→ session), and sponsor immutability with the single audited admin override.

Still open from Group B (technical hygiene, folded into the §5/§9 pass):
- Two CRM layers (warm-market crm_* vs VM-era prospect_crm_records/timeline)
  — intended layering or converge (one-concept-one-name).
- `_id` stragglers (`prospects`, `invitation_activity`) — §9 decision 1.
- `prospect_sessions` Mongo-only — accepted as the named ephemeral exception
  unless Kevin objects.

---

## Ruling 8 — Continuous Discovery doctrine (+ Group C Steve key ratified)

Kevin, 2026-07-02 (verbatim intent): in reality ALL support agents are
interviewing — for training, inviting, helping the member — so the knowledge
base grows. Steve's initial interview is the SETUP for success; discovery is
ONGOING, depending on where the member is and what they need.

Canonized as the Continuous Discovery doctrine:
1. **`steve_discoveries` stays one-per-member (`SD-<memberId>`)** — it is the
   setup BASELINE Success Profile, written once in the member's own words.
   Ratified; no versioning of the baseline.
2. **The living picture = baseline + ongoing discovery**, which accrues
   through the existing runtime pipeline — agent events → BA-confirmed
   outcomes (R1) → learning candidates (R2, review-only) → Kevin's review →
   active knowledge (R3/GraphRAG) → Context Manager packets. Every agent
   (Steve, Michael, Ivory, future agents) is a discovery surface.
3. **Guardrails unchanged and load-bearing:** agents interview and PROPOSE;
   they never approve knowledge (candidates are review-only). Member-specific
   understanding stays scoped to that member; only generalizable lessons
   graduate to team-wide knowledge through review. Journal privacy holds.
4. Framing consequence: the runtime layer's purpose statement should carry
   this doctrine ("all agents interview; Steve sets up; discovery never
   stops") so future agents are designed as discovery surfaces by default.

---

## Ruling 9 — Ingestion coverage: every encounter that creates, ingests

Kevin, 2026-07-02 (verbatim intent): "we just have to have ingestion
mechanisms in place for each encounter that creates something new to ingest."

Canonized as the enforcement arm of Ruling 8 (Continuous Discovery):
1. **Coverage rule:** every agent encounter type that produces something new
   (understanding, outcome, lesson, artifact) MUST have a defined ingestion
   mechanism into the pipeline (capture → candidate → review → knowledge).
   An unmapped encounter type is a defect, not a gap to tolerate.
2. **Deliverable — Encounter-to-Ingestion Coverage Matrix:** agents ×
   encounter types × artifact created × ingestion mechanism × landing store,
   built against the current runtime (Steve ingest endpoint; agent events;
   R0 turn audit; R1 outcomes; R2 candidates; R3 GraphRAG; knowledge-intake
   pipeline). Gap analysis on first build.
3. **Standing gate:** no new agent or new encounter type activates without
   its coverage-matrix row — added to the agent activation charter pattern
   alongside the existing kill-switch/observability requirements.
4. Sequencing unchanged: the R0–R3 persistence rungs stay behind Kevin's
   kill switches and activate per the Phase 7 governance — this ruling
   requires the MAP now, not premature flag-flips.

---

## Ruling 10 — Prefix canon: store-deterministic (Mongo=tmag_, Chroma=mcs_, Neo4j=Tmag*)

Kevin, 2026-07-02: the prefix is determined by the STORE, not the concept
class:
- **MongoDB (Mongoose): `tmag_`** — team operational data.
- **ChromaDB: `mcs_` — EVERY collection** — the system's semantic layer.
- **Neo4j: `Tmag*` labels** — the relationship store; team-branded labels
  because "we really want to have great edges."

Composes with the one-concept-one-name / cased-per-layer law (identity
decision §2b): one canonical concept name, deterministic per-store transform —
e.g. Mongo `tmag_commitments` ⇄ Chroma `mcs_commitments` ⇄ Neo4j
`(:TmagCommitment)`. Prefixing is now mechanical, never a judgment call.

Consequences:
1. PR #108's Chroma renames (→ `tmag_`) reverse to `mcs_` under the
   reidentification migration (stores write-frozen/near-empty — cheap now).
   The `CHROMA_COLLECTIONS` registry updates in the same migration.
2. Resolves the Ruling 4 drift flag: member collection = **`tmag_members`**
   (Mongo) / `mcs_members` (Chroma).
3. Neo4j member label canonical form: **`TmagMember`** (per the Tmag* scheme;
   supersedes the `TeamMagnificentMember` spelling in the identity decision
   doc — pending Kevin's veto). All §6.1 constraint labels adopt Tmag*.
4. Knowledge collections (`mcs_*_knowledge_*`), `mcs_audit_log`,
   `mcs_outcomes`, `mcs_learning_candidates_review` are ALREADY compliant on
   the Chroma side.
5. Executes under the ONE reidentification migration — not piecemeal.

---

## Ruling 11 — Rev 2 canonical schema list ADOPTED as baseline

Kevin's edited `MCS_V2_CANONICAL_SCHEMAS.docx` (Rev 2, folding his 2026-07-01
review) is the canonical provisioning baseline. It establishes: semantic
grouping inside `tmag_` (`tmag_prospect_*`, `tmag_prospect_htank_*`,
`tmag_new_member_*`, `tmag_agent_*`, `tmag_vm_*`, `tmag_admin_*`); the
per-agent event split; **`tmag_agent_templates`** as a NEW first-class
collection (the agent operating system); `master_content_versions` →
`tmag_content_templates`; `tmag_prospect_callback_requests` (raise-hand
signal); the member entity carries the FULL name — Mongo
`team_magnificent_members`, Neo4j **`TeamMagnificentMember`** + a
`TeamMagnificent` team-scope node (supersedes the `TmagMember` proposal in
Ruling 10 c3); BOTH CRM layers kept as named layers (member-private CRM +
VM lead-campaign CRM); VM unify — ONE `tmag_vm_bulk_leads` with one `leadId`;
`tmag_vm_delivery_events` merged canonical shape (eventId · provider · leadId
· vmCampaignId · ownerTmagId · channel · status · dryRun · attempt); memory
layer canonized (mcs_outcomes / mcs_learning_candidates / mcs_graphrag_records
+ TmagOutcome/TmagLearningCandidate/TmagKnowledge provenance, SCOPED_TO
TeamMagnificent, no agent may approve); SYSTEM exceptions `mcs_audit_log` +
`tenant_settings_versions`.

Superseded inside Rev 2 by today's rulings (corrected in Rev 3): §0 id format
→ date-free `TMAG-XXXXXX` (Ruling 2); `tmag_questionnaires` removed — retired
into Steve, two-stage spine (Ruling 6).

## Ruling 12 — Rev 2's three confirms answered (Kevin, 2026-07-02)

(a) **Chroma = `mcs_` on every collection** — reaffirms Ruling 10 over Rev 2
§3's mirror-the-Mongo-names draft. Store-deterministic transform: one base
name, prefix per store (Mongo `tmag_access_codes` ⇄ Chroma
`mcs_access_codes`; member collection ⇄ `mcs_members`).
(b) **`tmag_vm_lead_batches` → `tmag_vm_lead_owners`** — the record tracks
WHOSE leads these are; multiple members will build with the RVM system.
Reference field `leadBatchId` → `leadOwnerId` proposed under the same
reidentification migration (Kevin may veto the field rename at signature).
(c) **`tmag_agent_templates` and `tmag_content_templates` stay SEPARATE.**
Canonical distinction (Kevin, verbatim intent): “the template is the road
that the agent travels on” — agent templates are operating roads;
content templates are versioned served copy. Different concepts, different
collections.

---

## Ruling 13 — Lead-ownership continuity (RVM → funnel handoff)

Kevin, 2026-07-02: `ownerTmagId` is the single ownership thread through the
entire RVM journey — purchased (tmag_vm_lead_owners) → imported
(tmag_vm_bulk_leads.ownerTmagId) → dropped (tmag_vm_campaigns) → clicked →
video presentation. **At `video_complete`, the lead becomes the OWNING
member's prospect: the minted prospect's `sponsorTmagId` = the lead's
`ownerTmagId`** (immutable from that point per the sponsor-immutability law),
and the prospect is placed into the holding tank under that member. The RVM
feeder converges on the identical Ruling 7 funnel spine; no gap exists where
a lead can be orphaned or claimed by another member.

Holding-tank store coverage confirmed: Mongo ×3
(htank_counters/placements/accounts) · Chroma ×1 (mcs_prospect_htank_events
— semantic event log; counters/positions have no semantic content to embed)
· Neo4j IN_HOLDING_TANK(position) → TmagPool.

---

## ✅ REVIEW COMPLETE — SCHEMA APPROVED

**Kevin L. Gardner signed and dated the Canonical Schema List Rev 3 on
2026-07-02** (`engineering/reports/MCS_V2_CANONICAL_SCHEMAS_REV3.md` — all
rulings 1–13 folded). Per Rev 3 §5, this approval **LIFTS THE SCHEMA
WRITE-FREEZE (blocker B4 approval leg)**. Downstream execution unblocked:
provisioning slice (Mongo $jsonSchema moderate mode + first Neo4j uniqueness
constraints + Chroma `mcs_` registry), the ONE reidentification migration
(all renames from these rulings), then H1 live smoke + backup tooling.
Post-merge gates on `main` at approval time: typecheck clean, 114 files /
1,334 tests green (merge `86c390a`, including the Codex
gateway→persistence rename completing ACR-0009).

---

## Open items in this review

- Remaining catalog groups: prospects/invitations · CRM · agents/runtime · VM ·
  knowledge · §5 reconciliations · §9 decisions 1–5 · prefix canon
  (`tmag_*` vs `mcs_*`).
