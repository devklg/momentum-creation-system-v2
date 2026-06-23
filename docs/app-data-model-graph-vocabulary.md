# MCS Graph Vocabulary — Canonical & Reconciled

> Single source for **§13 item 2 (vocabulary unification)**. Reconciles the
> constitution (`MULTI_DB_AGENT_LEARNING_GOVERNANCE.md`, Article VII) with the
> **LOCKED** `app-data-model-contract.md` §6. Where the two disagree, the locked
> contract wins for launch; the constitution's extra ideas are marked DEFERRED,
> not silently adopted. Every canonical name below is quoted from contract §6
> (read-verified this session). Build item 2 from THIS file.

## 0. The reconciliation rule

Article VII files 15 things under “relationships,” but they are two different
kinds:

- **Structural facts** — durable, low-cardinality, identity-level (who sponsors
  whom, who sits in the tank). These are Neo4j **EDGES**.
- **Events** — high-cardinality, time-stamped, one row per occurrence (viewed
  25%, attended, completed a module). These are **NOT edges** — one edge per
  video-watch bloats the graph fast. They are **OBSERVATIONS** in the Mongo
  activity layer — which is the constitution’s own Article XI definition
  (“observations are facts, never conclusions”).

So: keep the constitution’s structural edges (renamed to the locked canonical),
demote its event “relationships” to observations, and defer the learning-layer
edges until `Observation` / `Recommendation` / `Outcome` exist (today: zero in
the codebase, verified).

## 1. Canonical nodes (Neo4j)

Label split `:BA` vs `:BrandAmbassador` is resolved on **`:BrandAmbassador`**
(§6.1 — the label `training.ts`, `auditLog.ts`, `broadcast.ts` already use).

| Node | Key prop | Constitution name it covers |
| --- | --- | --- |
| `:BrandAmbassador` | `baId` | BrandAmbassador (replaces `:BA`) |
| `:Prospect` | `prospectId` | Prospect |
| `:Pool {poolId:'team'}` | `poolId` | (the single shared holding tank) |
| `:InviteToken` | `token` | Token |
| `:IvoryName` | `ivoryId` | (roster entry) |
| `:MichaelInterview` | `interviewId` | Discovery Interview |
| `:MichaelFounderHandoff` | handoff id | **Success Profile** |
| `:FastStartProgress` | `progressId` | Launch / Training progress |
| `:AccessCode` | `code` | (re-entry credential) |
| `:OrientationSession` | `sessionId` | (event session) |
| `:Broadcast` | `broadcastId` | (community message) |
| `:AuditEntry` | `entryId` | (governance record) |

Node `id` always equals the Mongo canonical id. Unique constraints:
`BrandAmbassador.baId`, `Prospect.prospectId`, `IvoryName.ivoryId`,
`MichaelInterview.interviewId`. The graph carries relationships, not full docs.

**DEFERRED nodes** (constitution proposes; not built — decide before adopting):
`Agent`, `Observation`, `Recommendation`, `Outcome` (the learning layer).
`Event` / `Resource` / `TrainingModule` stay Mongo/Chroma content until an agent
actually needs to graph-walk them.

## 2. Canonical edges (Neo4j) — structural only

All names below are **LOCKED** in §6.2.

| # | Canonical edge | Direction | Constitution term it replaces | Rule |
| --- | --- | --- | --- | --- |
| 1 | `:UPLINE_IS` | `(:BrandAmbassador)→(:BrandAmbassador)` | SPONSORED (BA sense) | sponsor chain; `MATCH` both; Tier-1 atomic. `ba.ts` SPONSORED_BY→UPLINE_IS |
| 2 | `:SPONSORED_BY` | `(:Prospect)→(:BrandAmbassador)` | REFERRED / INVITED-reversed | prospect→sponsoring BA; `MATCH` BA; Tier-1. One edge owns this fact |
| 3 | `:IN_HOLDING_TANK {positionNumber, placedAt}` | `(:Prospect)→(:Pool)` | PLACED | `MATCH` Pool; `PLACED_IN` retired |
| 4 | `:FOR_PROSPECT` | `(:InviteToken)→(:Prospect)` | — | |
| 5 | `:HAS_FOLLOWUP` / `:DISPOSED` | `(:BrandAmbassador)→(:Prospect)` | FOLLOWED_UP (the *state*) | CRM edges; the follow-up *act* is an observation (§3) |
| 6 | `:USES` | `(:BrandAmbassador)→(:AccessCode)` | — | |
| 7 | `:RESERVED_ORIENTATION {reservationId}` | `(:BrandAmbassador)→(:OrientationSession)` | (reservation link) | ATTENDED is an observation, not this edge |
| 8 | `:HAD_MICHAEL_INTERVIEW` | `(:BrandAmbassador)→(:MichaelInterview)` | — | |
| 8b | `:VISIBLE_TO_SPONSOR` | `(:MichaelInterview)→(:BrandAmbassador)` | — | **enforced at READ** (access gate), not decorative |
| 9 | `:HAS_PROGRESS` | `(:BrandAmbassador)→(:FastStartProgress)` | (link) | COMPLETED is an observation, not this edge |
| 10 | `:READY_FOR_HANDOFF` | `(:BrandAmbassador)→(:MichaelFounderHandoff)` | (SuccessProfile link) | |
| 11 | `:SENT_BY` / `:ACTED_BY` | `(:Broadcast)→(:BA)` / `(:AuditEntry)→(:BA)` | — | |

**DEFERRED edges** (build when the learning layer exists): `COACHED_BY`,
`MENTORED`, `RECOMMENDED`, `LEARNED_FROM`, `GENERATED`, `CONNECTED_TO`,
`PARTICIPATED_IN`. Each ties to `Agent` / `Recommendation` / `Outcome`, none of
which are modeled yet.

## 3. Events → observations (Mongo activity layer — NOT edges)

These are the Article VII terms that must **not** become Neo4j edges. They live
as append-only facts and feed the agents (and, later, the Outcome/learning
layer per Articles XI–XII).

| Constitution “relationship” | Lives as | Home |
| --- | --- | --- |
| INVITED | `kind:'sent'` | `invitation_activity` |
| VIEWED | `video_started / video_25 / 50 / 75 / watched` (PMV lifecycle) | `invitation_activity` |
| ATTENDED / PARTICIPATED_IN | attendance fact | orientation / webinar activity |
| COMPLETED | module/launch completion | `fast_start_progress` + training records |
| FOLLOWED_UP (the act) | follow-up logged | `crm_followups` / CRM activity |

## 4. The migration (this **is** §13 item 2)

Per §6.4 — one pass:

1. `:BA` → `:BrandAmbassador` in: `ba.ts`, `invitations.ts`, `callbackRequest.ts`,
   `crm.ts` (multiple), `codeGen.ts`, `orientationSession.ts`,
   `michael-founder-handoff.ts`, `michaelScoring.ts`. (Already correct in
   `training.ts`, `auditLog.ts`, `broadcast.ts`.)
2. `SPONSORED_BY` → `UPLINE_IS` for the **BA sponsor chain** in `ba.ts`.
3. Keep `SPONSORED_BY` for **Prospect→BA**; drop `invitations.ts`’s `INVITED`
   edge (keep the invite as activity only) so the sponsorship fact lives on one
   edge.
4. `PLACED_IN` → `IN_HOLDING_TANK`.
5. `MERGE` → `MATCH` for any node that must pre-exist (sponsor/BA). Use the
   `OPTIONAL MATCH` + guard pattern `auditLog.ts` / `broadcast.ts` already use,
   so a bad sponsor fails loudly instead of inventing a phantom node (§6.3).

The three Tier-1 edges (`UPLINE_IS`, `SPONSORED_BY`, `IN_HOLDING_TANK`) write
through the tiered writer in `graph_critical` mode, so a missing `MATCH` anchor
rolls the Mongo write back rather than leaving a half-write.
