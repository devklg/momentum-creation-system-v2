# Momentum Creation System V2 — Administrator Guide

**Status:** Repository-governing document
**Applies to:** Momentum Creation System V2 (`momentum-creation-system-v2`)
**Authority basis:** `MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md` (philosophical constitution), `MULTI_DB_AGENT_LEARNING_GOVERNANCE.md` (technical governance), `docs/app-data-model-contract.md` (LOCKED, read-verified data model), `docs/app-data-model-graph-vocabulary.md` (canonical graph vocabulary).
**Owner of record:** Kevin La'Mont Gardner — sole owner and decision-maker for MCS and all subsystems herein.

---

## 0. How to read this document

This guide governs the administration of the platform. It is written to remain
authoritative as the platform matures. Because the platform is **pre-launch and
mid-finish-work** (the data-model contract documents a finite build queue, and
several subsystems described here are specified but not yet operational), every
administrable subsystem carries an explicit **build-state tag**. An
administrator must never assume a procedure is live because it is written here;
the tag is authoritative over the prose.

### 0.1 Build-state legend

| Tag | Meaning | Administrator obligation |
| --- | --- | --- |
| `OPERATIONAL` | Built, verified against the repository, safe to administer per this guide. | Follow the procedure as written. |
| `PARTIAL` | Partially built; core exists, administrative tooling or coverage is incomplete. | Follow the procedure, expect gaps, log gaps to the owner. |
| `TARGET` | Specified by the constitutions but not yet built (no code, or stub only). | Do **not** assert it is live. Treat the section as the design contract for when it is built. |

### 0.2 Unset-value convention

Where a real threshold, SLA, owner, recipient, or schedule has not yet been
decided by the owner of record, this document writes **`[SET BY KEVIN]`** rather
than inventing a value. An invented operational value is a governance defect.
No administrator may substitute a guessed value; escalate to the owner to set it.

### 0.3 Audience

Founders, architects, developers, product managers, AI engineers, community
leaders, and future leadership teams. Sections are numbered for citation in
change control and incident records.

---

## 1. Document Governance & Authority

### 1.1 Authority hierarchy

When two documents conflict, the higher authority prevails. Philosophy prevails
over convenience; people prevail over technology (Foundation, Article XXII).

```text
1. MOMENTUM_CREATION_SYSTEM_V2_FOUNDATION.md   (WHY — values, ethics, AI Constitution)
        │  governs intent and boundaries
        ▼
2. MULTI_DB_AGENT_LEARNING_GOVERNANCE.md       (HOW, in principle — store roles, learning model)
        │  governs architecture
        ▼
3. docs/app-data-model-contract.md  [LOCKED]   (WHAT IS — read-verified entities, tiers, vocabulary)
        │  governs built reality + finish-work
        ▼
4. docs/app-data-model-graph-vocabulary.md     (canonical graph names)
        │
        ▼
5. ADMINISTRATOR_GUIDE.md (this document)      (OPERATE — administration of the above)
```

**Rule 1.1.1** — This guide may not contradict the LOCKED data-model contract.
If an administrative need requires a model change, the contract is amended first
(with a recorded decision), then this guide.

**Rule 1.1.2** — Any administrative action that would violate the AI Constitution
(Foundation, Article XIX) — making AI the center, replacing human judgment, or
operating without honesty/transparency — is prohibited regardless of operational
convenience.

### 1.2 Source-of-truth law for administration

**Rule 1.2.1** — MongoDB is the single operational source of truth
(Multi-DB Governance, Principle 1). Neo4j and ChromaDB are derived projections.
An administrator never "fixes" data by editing a projection; the fix is applied
to MongoDB and re-projected.

**Rule 1.2.2** — Operate on actual state, never assumed state. Before asserting a
store, agent, or service is down, the administrator must attempt the operation
and read the real error. The three primary app stores (Mongo/Neo4j/Chroma), the
GPU embedding service, and the external MCP tooling surface are reliable
components; "down" is a hypothesis to test, not a status to announce.

**Rule 1.2.3** — Never report an administrative action complete without reading
the result back. A write is not done until it is verified in the store.

### 1.3 Change control

All changes to this guide are recorded in the app-side decision ledger
(`momentum.decisions`) and in the change log (Appendix C). Each change names the
section, the reason, and the owner approval.

---

## 2. Platform Architecture Overview (for administrators)

### 2.1 The two-domain model

MCS V2 is one platform presented across two public domains plus an
administrative plane. The split is constitutional (Foundation Articles IV and
IX) and is enforced in the data model.

| Plane | Surface | Audience | Purpose |
| --- | --- | --- | --- |
| `.com` | Prospect Momentum System | Prospects (unauthenticated → token / magic-link) | Educational discovery: watch the opportunity video, be held in the tank while readiness develops (Foundation Art. IV–V). **No scoring, no pressure.** |
| `.team` | Brand Ambassador Success System | Brand Ambassadors (BAs) | Empower the BA's development and success: cockpit, CRM, training, the agents. |
| Admin | Administrative plane | Owner / founders / delegated admins | Oversight, configuration, reporting, governance. Modules prefixed `admin*`. |

Domains of record: `teammagnificent.com` (.com) and `teammagnificent.team`
(.team), with admin and operational subdomains (`book.`, `app.`).
`tenant_settings` carries `publicComDomain`, `teamDomain`, and `adminDomain` as
first-class configuration.

### 2.2 The four-store data architecture

```text
                         +------------------------------+
   .com / .team / admin  |   Application (server, 7700) |
        requests  ------>|   pnpm monorepo, TypeScript  |
                         +---------------+--------------+
                                         | app-runtime writes via
                                         v
                         +------------------------------+
                         | Direct persistence adapters  |  writes/projections
                         | server/src/services/*        |  under tiered policy
                         +---+--------+--------+--------+
                             |        |        |
             +---------------+        |        +---------------+
             v                        v                        v
     +---------------+        +---------------+        +---------------+
     |   MongoDB     |        |    Neo4j      |        |   ChromaDB    |
     |  OPERATIONAL  |        | RELATIONSHIP  |        |   SEMANTIC    |
     |   TRUTH       |        | INTELLIGENCE  |        |   MEMORY      |
     |  (momentum)   |        | (projection)  |        | (projection)  |
     +---------------+        +---------------+        +-------+-------+
                                                              | embeddings
                                                              v
                                                     +------------------+
                                                     | GPU embed service|
                                                     | 384-dim MiniLM   |
                                                     +------------------+
     +---------------+
     |  SurrealDB    |  available; NOT a source of truth, NOT in launch write
     | (experiments) |  path (contract section 8). No app fact may live only here.
     +---------------+

     external MCP tool server (2526 / dashboard 3102) sits beside the app as
     MCP/developer tooling for agents and operator scripts. It is not the app
     runtime persistence edge and not the app memory layer.
```

**Store roles (Multi-DB Governance, Article III):**

| Store | Role | Administrator answers |
| --- | --- | --- |
| MongoDB | Operational truth — "what is true now?" | data correctness, retention |
| Neo4j | Relationship intelligence — the genealogy/membership graph the agents walk | graph integrity, vocabulary, no phantom nodes |
| ChromaDB | Semantic memory — only four launch collections (contract section 7) | embedding health, collection hygiene |
| GPU embedding service | 384-dim vectors for every Chroma write; never silent CPU fallback | service health on `/health` |
| SurrealDB | Experimental; out of the launch write path | confirm no app fact is Surreal-only |

**Configuration of record (environment):** external tooling v2, MongoDB database
`momentum` (app) — distinct from the external agent-operations store (not app data),
Neo4j single graph, ChromaDB v2 API, GPU embedding service required healthy
before any embedding work. Exact host/port values are environment configuration
owned in deployment config, not duplicated here as law; an administrator verifies
them live (`/health`, a probe query) rather than trusting a remembered list.

### 2.3 Ownership model

**Rule 2.3.1** — Kevin La'Mont Gardner is the sole owner and decision-maker for
MCS and every subsystem in this guide. Paul Barrios is the network-marketing
sponsor only and holds no application authority unless Kevin explicitly grants
it in a recorded decision.

**Rule 2.3.2** — Each entity has exactly one owning MongoDB collection
(Multi-DB Governance, Article IV). Copies elsewhere are read models. Ownership is
recorded per subsystem in Sections 4–12 and Appendix A.

### 2.4 Write discipline (the tiered writer) — `OPERATIONAL` (helper); `PARTIAL` (adoption)

Every administrator must understand how writes land, because it governs what a
failed write means.

The platform uses a **tiered write helper** (`server/src/services/tieredWrite.ts`)
backed by a **durable projection retry queue** (`projection_outbox`). The tier is
chosen per record by one test: *would Michael, Ivory, or the training agent give
bad advice if this record half-wrote?*

| Tier | Records | Policy | Failure meaning for the admin |
| --- | --- | --- | --- |
| `graph_critical` | membership + agent-reasoned edges (BA + `UPLINE_IS`, prospect + `SPONSORED_BY`, holding-tank placement) | Mongo + Neo4j atomic; on graph failure the Mongo insert is rolled back; anchor must pre-exist (`MATCH`). | A `graph_critical` failure leaves **no** orphan; a `HalfWriteError` is the only exception and means manual repair. |
| `knowledge` | what the agents learn from (interview + transcript, master content, CRM notes) | Mongo commit = success; Neo4j/Chroma projection enqueued to `projection_outbox` and retried until it lands; alert on exhaustion. | A failed projection is **queued, not lost**. Monitor the outbox. |
| `operational` | callbacks, fast-start ticks, reservations, audit | Mongo commit = success; projections retry, non-urgent. | Same as knowledge, lower priority. |

Build state: the helper and outbox are built and compile-verified. Migration of
all call sites onto the helper is finish-work (contract section 13 items 2–5);
until a given call site is migrated, its write still uses the legacy fire-once
path. Section 14.2 defines outbox monitoring.

---

## 3. Administrative Roles & Access Model

### 3.1 Access planes — `PARTIAL`

Three access planes exist today, separated by surface and credential, not yet by
a formal role/permission matrix:

| Plane | Credential mechanism (built) | Module surface |
| --- | --- | --- |
| Prospect (.com) | `invite_tokens`, `prospect_magic_links`, `prospect_accounts`, `prospect_sessions` | `prospects.ts`, `prospectAccount.ts`, `prospectMagicLink.ts`, `tokens.ts`, `previewToken.ts` |
| Brand Ambassador (.team) | `brand_ambassadors` identity, `access_codes` (re-entry / invite-mint) | `ba.ts`, `access-codes.ts`, `codeGen.ts`, `profile.ts`, `cockpit.ts` |
| Admin | Administrative modules (`admin*`) | `adminBaCrud`, `adminBaOversight`, `adminProspectCrud`, `adminProspectOversight`, `adminQueueOversight`, `adminMetrics`, `adminMasterReport`, `adminTenantArchitecture` |

### 3.2 Built access-control mechanisms

- **Per-prospect token scope.** A BA may only see their own prospects; no request
  input may widen the set to another BA's prospects (enforced server-side).
- **`VISIBLE_TO_SPONSOR` access gate.** A Michael interview is visible to the
  sponsoring BA only when the
  `(:MichaelInterview)-[:VISIBLE_TO_SPONSOR]->(:BrandAmbassador)` edge exists,
  **enforced at read**, not decorative (contract section 6.2).
- **Access codes.** 6-character, app-generated, minted at invitation; used for BA
  re-entry and login (`/api/p/login/code`), phone normalized to E.164.

### 3.3 Role & Permission administration — `TARGET`

A formal role-based access-control (RBAC) system — named roles, granular
permissions, delegated admin tiers, an audit of permission grants — is **not yet
built** (no role/permission entity exists in the model). Until it is, admin
access is plane-level and owner-mediated.

**Target model (design contract for when built):**

```text
Role --grants--> Permission --scopes--> Resource (subsystem + action)
  |
  +-------- assigned to --> Principal (BA | Admin | Founder | Agent-operator)
```

- Roles are additive; least privilege is the default.
- Every grant and revocation writes an `AuditEntry` (`ACTED_BY` the granting
  admin) — `operational` tier.
- Agent-operator is a distinct role: it may tune agent voice/content but may not
  alter membership or financial-adjacent records.
- No role may grant the ability to assert income, rank, or prospect scoring
  (compliance, Section 18.4).

### 3.4 Governance rules for access changes — `PARTIAL`

**Rule 3.4.1** — Every access change (BA creation/suspension, code issuance,
admin delegation) must be attributable to a named actor and recorded in
`audit_log`.

**Rule 3.4.2** — Credential material (passwords, tokens, codes, API keys) is
never entered or stored in plaintext by an administrator through tooling that
exposes it. Issuance is system-generated.

**Rule 3.4.3** — Prohibited administrative actions (perform only by the owner,
or not at all): modifying sharing/permission controls on stores, hard-deleting
data, executing financial transfers, bypassing bot-detection, changing security
settings. See Section 19.

---

## 4. User Administration — `OPERATIONAL` (CRUD) / `PARTIAL` (lifecycle automation)

### 4.1 Purpose

User administration governs the two human populations the platform serves: Brand
Ambassadors (members of `.team`) and Prospects (visitors to `.com`). Per the
Foundation, administration of users is stewardship, not control (Art. VI.2):
administrative authority over a record exists to serve the person it represents.

### 4.2 Ownership

| Population | Owning collection | Admin modules |
| --- | --- | --- |
| Brand Ambassador | `brand_ambassadors` | `adminBaCrud.ts`, `adminBaOversight.ts`, `ba.ts`, `profile.ts` |
| Prospect | `prospects` | `adminProspectCrud.ts`, `adminProspectOversight.ts`, `prospects.ts` |
| Re-entry credential | `access_codes` | `access-codes.ts`, `codeGen.ts` |
| Prospect account/session | `prospect_accounts`, `prospect_magic_links`, `prospect_sessions` | `prospectAccount.ts`, `prospectMagicLink.ts` |

### 4.3 Administrative controls

- **Create / read / update.** BA and prospect records are administered through
  the `admin*Crud` modules. Creates of a BA that establish a sponsor edge are
  `graph_critical` (Section 2.4): the sponsor must pre-exist (`MATCH`) or the
  write rolls back.
- **Oversight.** `adminBaOversight` / `adminProspectOversight` provide read and
  override surfaces. An override is a `knowledge`-tier change and must read back
  to confirm before being reported complete (Rule 1.2.3).
- **Suspension over deletion.** Records are suspended/archived, not hard-deleted
  (Section 18.3). Hard deletion is a prohibited administrative action.

### 4.4 Brand Ambassador lifecycle

```text
invited/minted --> active --> (interview) --> launched --> producing --> leader
      |              |                                         |
      |              +--> suspended (reversible, audited) <-----+
      +--> expired (credential window elapsed)
```

Each transition writes an `audit_log` entry and, where it changes membership,
updates the Neo4j graph through the `graph_critical` path.

### 4.5 Prospect lifecycle (mirrors the .com holding-tank model)

```text
draft --> sent --> opened --> [video_started -> 25 -> 50 -> 75 -> watched]
                                                                  |
                                            placed in holding tank (Pool)
                                                                  |
                              callback_requested --> enrolled (off-app at THREE)
                                                                  |
                                                              expired / archived
```

Prospect lifecycle is observation-driven (Section 7); no administrator assigns a
"hot/warm/cold" label — scoring is not part of this platform (Section 18.4).

### 4.6 Monitoring requirements

- New-BA and new-prospect creation rate (`adminMetrics`).
- Failed `graph_critical` BA creates (phantom-sponsor attempts) — must be zero;
  any occurrence is a Section 17 incident.
- Credential expiry backlog (prospects past the 8-week window not archived).

### 4.7 Reporting requirements

- BA activation report (`reports/baActivation.ts`).
- Invite funnel (`reports/inviteFunnel.ts`).
- Enrollment completion (`reports/enrollmentCompletion.ts`).
- Cadence per Section 13; ownership: owner of record / delegated admin.

### 4.8 Escalation procedures

| Condition | Severity | Escalate to |
| --- | --- | --- |
| Phantom-sponsor write detected | SEV-2 | Owner of record (graph integrity) |
| BA cannot authenticate (code path) | SEV-3 | Admin on duty `[SET BY KEVIN]` |
| Prospect PII exposure suspected | SEV-1 | Owner of record + Section 17 incident flow |

---

## 5. Role & Permission Administration — `TARGET`

### 5.1 Purpose

To grant the least authority necessary for each principal to serve, and to make
every grant auditable. Until the RBAC system is built (Section 3.3), this section
is the **design contract**, not an operational procedure.

### 5.2 Ownership

Owner of record holds all role authority today. Delegation is manual and
owner-approved.

### 5.3 Administrative controls (target)

- Role definitions are version-controlled and changes recorded in
  `momentum.decisions`.
- Grants/revocations write `AuditEntry` (`operational` tier) attributable to the
  acting admin.
- Separation of duties: the principal who can alter membership may not also be
  the sole approver of their own grant.

### 5.4 Monitoring / reporting / escalation (target)

- Monitor: count of standing grants, last-review date per role.
- Report: quarterly access review (Section 13.4).
- Escalate: any privilege used outside its role scope → SEV-2.

---

## 6. CRM Administration — `OPERATIONAL` (core) / `PARTIAL` (oversight tooling)

### 6.1 Purpose

The CRM is the BA's working memory of their prospects: notes, follow-ups, and
dispositions. It exists to empower the BA (Foundation Art. IX), never to score or
rank people.

### 6.2 Ownership

| Concern | Owning collection | Modules |
| --- | --- | --- |
| Notes | `crm_notes` (knowledge tier; embedded to `mcs_crm_notes`) | `crm.ts` |
| Follow-ups | `crm_followups` | `crm.ts`, `reports/followUpAging.ts` |
| Disposition (latest tag per BA+prospect) | `crm_dispositions` | `crm.ts` |
| Oversight | (read models) | `adminProspectOversight.ts` |

### 6.3 Administrative controls

- CRM notes are a `knowledge`-tier write: Mongo is authoritative; the Chroma
  projection to `mcs_crm_notes` retries via the outbox until it lands.
- Dispositions are funnel-status tags, not scores. An administrator may not
  introduce a disposition value that implies ranking, qualification, or income.
- Graph edges `HAS_FOLLOWUP` / `DISPOSED` (BA → Prospect) carry CRM state; the
  follow-up *act* is an observation, not an edge (graph-vocabulary doc, Section 3).

### 6.4 Lifecycle

```text
note/created --> follow_up scheduled --> due --> actioned --> dispositioned
                                          |
                                          +--> overdue (aging report flags)
```

### 6.5 Monitoring / reporting / escalation

- Monitor: follow-up aging distribution; `mcs_crm_notes` projection lag (outbox).
- Report: follow-up aging (`reports/followUpAging.ts`), cadence per Section 13.
- Escalate: sustained projection backlog for `mcs_crm_notes` → SEV-3 (agents lose
  recent semantic recall).

---

## 7. PMV Administration (Prospect Momentum Viewer) — `PARTIAL`

### 7.1 Purpose

PMV provides **awareness** of where a prospect is in the discovery journey so
that meaningful, well-timed support can occur — "guidance rather than
surveillance" (Foundation, Art. XV.2). PMV is the .com holding tank made visible
to the sponsoring BA.

### 7.2 Build state and the locked design constraint

The PMV backend projection exists (`ProspectLifecycleStage`, `ProspectNextAction`,
`ProspectLastSignal`, `ProspectMomentumRow`). It is **BA-scoped** and exposes
lifecycle, CRM summary, last signal, and a **deterministic** next action
"without scoring, qualifying, ranking, auto-sending, or widening ownership."

**Rule 7.2.1 (LOCKED)** — PMV must never present a hot/warm/cold score or any
ranking of prospects. "Where they are in the video" is an observation; "this
prospect is hot" is a forbidden conclusion (Foundation Art. XV; Multi-DB
Governance Art. XI; owner decision). Administration may not reintroduce scoring.

### 7.3 Ownership

Projection logic owned in `cockpit.ts` / prospect domain; signals sourced from
`invitation_activity` (the observation log). Display surfaces: `cockpit.ts`,
`cockpitPrint.ts`, `todaysActions.ts`.

### 7.4 Administrative controls

- Configure the video-progress signal definitions (the `video_25/50/75/watched`
  thresholds) — changes recorded as decisions.
- Configure next-action mapping (lifecycle → `ProspectNextActionKind`) — these
  are deterministic rules, owner-approved.
- No control exists — by design — to rank or auto-contact prospects.

### 7.5 Monitoring / reporting / escalation

- Monitor: signal ingestion continuity (are `.com` activity events arriving?),
  next-action computation errors.
- Report: invite funnel (`reports/inviteFunnel.ts`).
- Escalate: activity-signal ingestion stalled → SEV-2 (BAs act on stale state).

---

## 8. Training Administration — `PARTIAL`

### 8.1 Purpose

To move a new BA from preparation to action (Foundation Art. XIII) through
orientation, the launch sequence, and Fast Start, adapting to the person rather
than classifying them (Foundation Art. X.2).

### 8.2 Ownership

| Concern | Owning collection | Modules |
| --- | --- | --- |
| Fast Start progress | `fast_start_progress` | `training.ts` |
| Workbook | `ba_workbooks` | `workbook.ts`, `questionnaire.ts` |
| Orientation | `orientation_sessions` / reservations | `orientationSession.ts` |
| Commitments | `commitments` | `commitments.ts` |

### 8.3 Administrative controls

- Training content/sequence is configured through master content (Section 9);
  progress is forward-only and append-correct (`training.ts` is the reference
  implementation for canonical `:BrandAmbassador` labeling and `HAS_PROGRESS`).
- Completion is an **observation** (`COMPLETED` is not a graph edge), recorded
  against `fast_start_progress`.

### 8.4 Lifecycle

```text
oriented --> launch step 1..n --> fast start module 1..5 --> launched
```

### 8.5 Monitoring / reporting / escalation

- Monitor: module completion rates, stalled launches.
- Report: training completion (`reports/trainingCompletion.ts`).
- Escalate: systemic launch stall (cohort-wide) → SEV-3, review with owner.

---

## 9. Resource Administration — `PARTIAL` (master content) / `TARGET` (Resource Center)

### 9.1 Purpose

The Resource Center is the institutional memory of the ecosystem — self-directed
learning material (Foundation Art. XVI). Distinct from training: training is a
sequence, resources are a library.

### 9.2 Build state

Master content (templates, agent voice, inheritable copy) is `PARTIAL` — the
`master_content` model exists and override-inheritance has been demonstrated, but
wiring all consumers is finish-work. A full Resource Center (catalogued,
searchable resource library with usage signals) is `TARGET`.

### 9.3 Ownership

`master_content` (owner: owner of record / delegated agent-operator). Versioning
and inheritance are governed; an override changes behavior for downstream
consumers and is therefore a `knowledge`-tier, audited change.

### 9.4 Administrative controls

- Edit master content (agent voice, templates) with version + audit.
- Confirm inheritance: after an override, verify the downstream consumer reflects
  it (read-back; do not assume).
- Resource Center (target): each resource defines Mongo metadata, optional Chroma
  knowledge content, view/share observations, effectiveness signal.

### 9.5 Monitoring / reporting / escalation

- Monitor: master-content overrides that did not propagate (inert-override
  defect from the contract).
- Report: content change log.
- Escalate: an agent speaking from default after an override → SEV-3.

---

## 10. Event Administration — `PARTIAL`

### 10.1 Purpose

Events accelerate momentum and reinforce culture (Foundation Art. XVII): webinars
(the prospect-facing presentation cadence), orientation sessions, and team
broadcasts.

### 10.2 Ownership

| Concern | Owning collection | Modules |
| --- | --- | --- |
| Webinar events | `webinar_events` | `webinarEvent.ts`, `webinarCadence.ts` |
| Reservations | `webinar_reservations` | `webinarReservation.ts` |
| Orientation sessions | `orientation_sessions` | `orientationSession.ts` |
| Broadcasts | `broadcasts` | `broadcast.ts` |
| Live operations | (operational) | `liveOps.ts` |

### 10.3 Administrative controls

- Schedule/cadence configuration for webinars and orientation.
- Broadcasts are public/community communications: sending is an explicit,
  audited action (`SENT_BY` a BA); confirm recipient scope before send.
- Reservation and attendance are observations, not graph edges (except the
  structural `RESERVED_ORIENTATION` linkage).

### 10.4 Monitoring / reporting / escalation

- Monitor: reservation/fulfillment ratios, broadcast delivery.
- Report: queue velocity (`reports/queueVelocity.ts`) where event-driven.
- Escalate: broadcast delivery failure to a cohort → SEV-3.

---

## 11. Agent Administration — `PARTIAL` (agents) / `TARGET` (learning loop)

### 11.1 Purpose

The agents serve the human, never the reverse (Foundation Art. XIX). They are:

| Agent | Role (Foundation) | Module surface | Build state |
| --- | --- | --- | --- |
| **Steve** | Discovery / Success Profile, no scoring or ranking | `steve-success-interview.ts`, `michael-training-support.ts` | `PARTIAL` |
| **Michael** | Training Agent + Daily Success Coach: teach, clarify, support, build confidence, prepare action, recommend manageable daily rhythm | `michael-interview-script.ts`, `michaelScoring.ts`, `michael-schedule.ts`, `todaysActions.ts`, `training.ts` | `PARTIAL` |
| **Ivory** | Invitation through service (Art. XIV) | `ivory.ts`, `generator.ts`, `scriptmaker.ts` | `PARTIAL` |

### 11.2 The locked governance for agents

- **Human authority (Art. XIX.1).** Every agent recommendation is advisory; a
  human decides. No agent performs an irreversible action autonomously.
- **No predictive labels.** Steve and Michael must not classify a BA as Builder,
  Part-Time, Casual, high-potential, low-potential, or any equivalent ceiling.
  The system adapts support from context and observed action; it does not
  predict who will succeed.
- **Explainability (Multi-DB Governance, Principle 4).** A recommendation must be
  traceable to source, context, relationship, observation, outcome. Until the
  observation/outcome layer exists (Section 12), explainability is limited to the
  deterministic rule that produced the action.
- **Voice via master content.** Agent tone/behavior is configured through master
  content (Section 9), not hard-coded — administration tunes the agent there.

### 11.3 The keystone dependency — interview as knowledge

Michael's value depends on the Discovery Interview being **retrievable
knowledge** (chunked, embedded to `mcs_michael_interviews`, graph-linked,
access-gated by `VISIBLE_TO_SPONSOR`). Today only a short summary is embedded;
full-transcript embedding is finish-work. Administrators must not represent the
training agent as personalizing from the interview until this lands.

### 11.4 Learning loop — `TARGET`

The observation → outcome → recommendation → feedback → improved-recommendation
loop (Multi-DB Governance, Articles XI–XVII) is **not built** (`Observation`,
`Recommendation`, `Outcome` entities do not exist in code). The platform today
**guides** by deterministic rules; it does not **learn**. Section 12.5 defines
the staged activation path.

### 11.5 Administrative controls

- Configure agent voice/content (master content) — audited.
- Configure Steve Discovery prompts and Michael Training Agent + Daily Success Coach prompts —
  owner-approved decisions. Do not configure scoring rubrics or handoff tiers
  for BA classification.
- Confirm `VISIBLE_TO_SPONSOR` gating behaves at read for any interview-surfacing
  change.

### 11.6 Monitoring / reporting / escalation

- Monitor: `agent_status` heartbeats; handoff completion; generator/ScriptMaker
  error rates.
- Report: leader scorecards (`reports/leaderScorecards.ts`) where agent-assisted.
- Escalate: an agent emitting a ranking/score or an income/rank claim → SEV-1
  (compliance breach, Section 18.4).

---

## 12. Knowledge Administration — `PARTIAL` (Chroma/GraphRAG) / `TARGET` (learning)

### 12.1 Purpose

Knowledge administration governs semantic memory (Chroma), relationship
intelligence (Neo4j), and their assembly into agent context (GraphRAG). "Mongo
stores facts; Chroma stores meaning" (Multi-DB Governance, Art. VI).

### 12.2 Chroma scope (LOCKED to four collections)

Per contract Section 7, only four collections earn embedding:

| Collection | Content |
| --- | --- |
| `mcs_michael_interviews` | interview transcripts + answers |
| `mcs_crm_notes` | BA notes about prospects |
| `mcs_ivory` | who-do-you-know roster |
| `mcs_master_content` | templates (optional) |

**Rule 12.2.1** — The ~20 empty `mcs_*` stub collections must be deleted and the
boot-time "assert every collection" routine stopped. Creating a new Chroma
collection requires a recorded decision and a real semantic-search justification.

### 12.3 Embedding governance

- All embeddings are 384-dim from the GPU embedding service. **Never** a silent
  CPU fallback. The administrator verifies the service `/health` reports GPU
  available before embedding work; if down, embedding is halted and the owner
  alerted, not worked around.
- Each Chroma doc id equals the Mongo canonical id; metadata carries
  `{id, type, baId|prospectId, sponsorBaId, createdAt}` for filtered search.
- A failed Chroma write is logged and retried via the outbox; it never blocks the
  Mongo write.

### 12.4 GraphRAG context assembly — `TARGET`

The retrieval pipeline (intent → relationship expansion → knowledge retrieval →
Mongo validation → context assembly) is the design target (Multi-DB Governance,
Art. X). Graph expansion first, semantics second, validate against Mongo third.
Build state: components exist independently; the assembled pipeline is target.

### 12.5 Learning-layer activation path (staged)

```text
Stage 1 (cheap, do first):  capture Observations + Outcomes as append-only facts
                            (Multi-DB Gov. Art. XI-XII). No judgment. Feeds nothing yet.
Stage 2:                    GraphRAG assembly over existing stores for explainable retrieval.
Stage 3:                    Recommendation records (stored, explainable, accept/reject tracked).
Stage 4:                    Feedback loop -> pattern detection -> recommendation refinement.
```

No stage may proceed without the prior stage's data existing first.

### 12.6 Monitoring / reporting / escalation

- Monitor: GPU `/health` (GPU available true), embedding latency, Chroma
  collection count (must equal the sanctioned set), outbox projection lag.
- Report: knowledge-store hygiene (collection inventory vs sanctioned list).
- Escalate: GPU service down or CPU-fallback detected → SEV-2 (embedding integrity);
  unsanctioned Chroma collection appears → SEV-3.

---

## 13. Operational Procedures

Procedures are written as checklists. Every step that asserts a system is healthy
requires an actual probe (Rule 1.2.2); every step that changes data requires a
read-back (Rule 1.2.3). Schedules/owners marked `[SET BY KEVIN]` are pending.

### 13.1 Daily administration procedures

| # | Procedure | Pass criterion |
| --- | --- | --- |
| D1 | Probe store health: Mongo (`momentum` query), Neo4j (count query), Chroma (heartbeat), external tooling (`/execute` echo). | All four respond. |
| D2 | Probe GPU embedding `/health`. | `gpu_available = true`. If false, halt embedding, alert owner. |
| D3 | Drain/inspect `projection_outbox`: pending count, oldest `nextAttemptAt`, any `status:'failed'` (dead-letter). | No dead-letters; backlog within `[SET BY KEVIN]`. |
| D4 | Review SEV-1/SEV-2 incidents opened in last 24h. | All triaged. |
| D5 | Scan `audit_log` for prohibited-action attempts (hard delete, permission change). | None, or each explained. |
| D6 | Verify no phantom-sponsor / `:BA`-vs-`:BrandAmbassador` write errors in logs. | Zero graph-integrity errors. |

### 13.2 Weekly administration procedures

| # | Procedure | Pass criterion |
| --- | --- | --- |
| W1 | Graph integrity sweep: every `:Prospect` with placement has exactly one `IN_HOLDING_TANK` edge; every BA has at most one `UPLINE_IS`; no orphan membership nodes. | No violations. |
| W2 | Chroma hygiene: live collection set equals the four sanctioned collections. | Exact match. |
| W3 | Outbox trend review: projection lag and retry rates over the week. | Within `[SET BY KEVIN]`. |
| W4 | CRM follow-up aging review (`reports/followUpAging.ts`). | Aging within target. |
| W5 | Invite funnel review (`reports/inviteFunnel.ts`). | Reviewed; anomalies logged. |
| W6 | Backup verification (Section 20): confirm last successful backup per store and a test restore of one collection. | Backups present + restorable. |

### 13.3 Monthly administration procedures

| # | Procedure | Pass criterion |
| --- | --- | --- |
| M1 | Index audit: all day-one unique indexes present (contract Section 9); no missing/duplicate. | Complete. |
| M2 | Cross-store reconciliation: run `pnpm --filter @momentum/server reconcile:stores -- --limit 25`; add `--fail-on-drift` for gate mode. | No missing/error legs, or drift logged for repair. |
| M3 | Master-content propagation audit: every override reflected by downstream consumers. | No inert overrides. |
| M4 | Capacity review: store sizes, embedding volume, growth trend. | Within plan. |
| M5 | Access review (interim, until RBAC): list of admins and standing access. | Confirmed by owner. |
| M6 | Decision-ledger review (`momentum.decisions`): month's recorded decisions complete. | Up to date. |

### 13.4 Quarterly administration procedures

| # | Procedure | Pass criterion |
| --- | --- | --- |
| Q1 | Full disaster-recovery drill (Section 21): restore the platform to a staging target from backups; verify cross-store consistency. | RPO/RTO `[SET BY KEVIN]` met. |
| Q2 | Security review (Section 19): secrets rotation status, credential handling, access boundaries. | No findings, or remediated. |
| Q3 | Data-governance review (Section 18): retention enforced, PII handling, compliance posture (no income/rank/scoring). | Compliant. |
| Q4 | Finish-work / build-state review: re-tag every subsystem in this guide (`OPERATIONAL`/`PARTIAL`/`TARGET`) against the repository. | Tags match reality. |
| Q5 | Foundation-alignment review (Art. XXI): subsystems still serve momentum/people-first. | Affirmed. |
| Q6 | Authority/governance review: this guide vs the LOCKED contract; reconcile drift. | Aligned. |

---

## 14. Monitoring & Observability

### 14.1 Store and service health

| Target | Signal | Healthy | Owner action if not |
| --- | --- | --- | --- |
| External MCP tooling | `/execute` responds | 2xx | Section 16.5 |
| MongoDB | query latency / availability | responsive | Section 16.1 |
| Neo4j | count query, integrity errors | responsive, zero phantom | Section 16.2 |
| ChromaDB | heartbeat, collection count | responsive, == 4 | Section 16.3 |
| GPU embed | `/health` `gpu_available` | true | Section 16.4 |
| SurrealDB | reachable (if used) | n/a to launch | confirm no app-only data |

### 14.2 Write-integrity monitoring (projection outbox)

The `projection_outbox` is the primary write-integrity signal for `knowledge` and
`operational` tiers.

| Metric | Meaning | Threshold |
| --- | --- | --- |
| pending count | projections awaiting retry | `[SET BY KEVIN]` |
| oldest `nextAttemptAt` | projection lag | `[SET BY KEVIN]` |
| `status:'failed'` count | dead-lettered (exhausted retries) | **0** — any is an incident |
| re-enqueue rate | churn / a failing target store | `[SET BY KEVIN]` |

A dead-letter means a knowledge/operational projection never landed after all
retries; it is logged with an `[ALERT]` tag and retained as `status:'failed'` for
inspection. Treat as SEV-2 (an agent's graph/semantic view is missing a fact).

### 14.3 Agent health

- `agent_status` heartbeats per agent; staleness threshold `[SET BY KEVIN]`.
- Handoff completion (Michael → founder), generator/ScriptMaker error rates.
- **Compliance monitor:** any agent output containing a score, rank, or
  income/earnings claim is a SEV-1 signal (Section 18.4).

### 14.4 Observability principles

- Prefer probing the live system over trusting a remembered status.
- Alerts must be actionable and name the cause; external tooling returns real errors —
  read them.
- The owner is not the integrity check: monitoring must surface problems without
  the owner having to ask.

---

## 15. Reporting Governance

### 15.1 Report inventory (`server/src/domain/reports/`)

| Report | Module | Primary audience |
| --- | --- | --- |
| BA activation | `baActivation.ts` | Owner, leaders |
| Enrollment completion | `enrollmentCompletion.ts` | Owner |
| Follow-up aging | `followUpAging.ts` | BAs, leaders |
| Invite funnel | `inviteFunnel.ts` | Owner, leaders |
| Leader scorecards | `leaderScorecards.ts` | Leadership |
| Queue velocity | `queueVelocity.ts` | Operations |
| Training completion | `trainingCompletion.ts` | Owner, leaders |
| Time-range helper | `timeRange.ts` | (shared) |
| Export | `export.ts` | Owner (data export) |

Master/admin reporting: `adminMasterReport.ts`, `adminMetrics.ts`,
`teamStats.ts`.

### 15.2 Reporting rules

**Rule 15.2.1** — Reports present observations and funnel facts, never scores,
ranks, or income projections (compliance, Section 18.4).

**Rule 15.2.2** — Report cadence and recipients are defined per report
`[SET BY KEVIN]`; until set, reports are run on demand by the owner.

**Rule 15.2.3** — Data export (`export.ts`) of PII is an audited action; the
administrator confirms recipient and scope before export and never places PII in
URL parameters.

---

## 16. Troubleshooting Procedures

General rule: reproduce, read the real error, isolate the store, fix at the
source of truth, re-project, verify. Never "fix" a projection directly.

### 16.1 MongoDB

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Write appears lost | wrong database or store family | confirm `momentum`; re-read by `_id` |
| Query returns nothing expected | filter param shape | use `filter`; verify with a known `_id` |
| Duplicate-key error | unique index working as intended | confirm canonical id; do not bypass the index |

### 16.2 Neo4j

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Phantom sponsor node appears | `MERGE` used where `MATCH` required | fix call site to `MATCH`; remove phantom; re-verify tree (contract Section 6.3) |
| Agent query returns half a tree | `:BA` vs `:BrandAmbassador` label split | standardize on `:BrandAmbassador`; re-run vocabulary migration (graph-vocabulary doc Section 4) |
| Duplicate sponsorship fact | `SPONSORED_BY` and `INVITED` both written | keep one edge; invite stays activity only |

### 16.3 ChromaDB

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `dimension: null` / empty collection | stub never written | confirm it is sanctioned; if a stub, delete it |
| Write rejected | collection missing | enqueue via outbox; create only if sanctioned |
| Search quality degraded | wrong/empty embeddings | verify GPU service; re-embed from Mongo source |

### 16.4 GPU embedding service

| Symptom | Likely cause | Action |
| --- | --- | --- |
| `/health` gpu_available false | service down / GPU not bound | restart the service; **do not** accept CPU fallback; alert owner |
| Embeddings present but low quality | silent CPU fallback occurred | halt, restart on GPU, re-embed affected ids |

### 16.5 external MCP tooling

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Action "not found" | wrong action/param name | inspect available actions; correct parameter names |
| Tool "not found" | wrong tool key | confirm tool name; the external tooling service is up almost always — suspect the call first |
| Empty/odd result | param-shape mismatch | re-verify against a known-good call before retrying |

---

## 17. Incident Response

### 17.1 Severity model

| Severity | Definition | Examples |
| --- | --- | --- |
| SEV-1 | Integrity, safety, privacy, or compliance breach; or platform down | PII exposure; agent emits a score/income/rank claim; Mongo authoritative loss |
| SEV-2 | Correctness at risk; agents acting on wrong/missing facts | phantom sponsor; dead-lettered projection; GPU/CPU fallback |
| SEV-3 | Degraded but contained | projection backlog; master-content override inert; report failure |
| SEV-4 | Minor / cosmetic | display defect, no data impact |

### 17.2 Response flow

```text
detect --> classify (SEV) --> contain --> identify source of truth impact
   |                                              |
   |                                              v
   |                                   fix at MongoDB (source) --> re-project
   |                                              |
   v                                              v
record in audit_log + decisions <--- verify (read-back) --> close
   |
   +--> (SEV-1/2) postmortem within [SET BY KEVIN]
```

### 17.3 Roles & escalation

| Role | Responsibility |
| --- | --- |
| Owner of record (Kevin) | Final authority; all SEV-1; any model/contract change |
| Admin on duty `[SET BY KEVIN]` | First responder; triage; contain |
| Agent-operator (target role) | Agent-output incidents (voice/content) |

**Rule 17.3.1** — SEV-1 compliance incidents (score/rank/income surfaced) are
contained immediately: disable the offending surface, then remediate. Compliance
prevails over availability.

### 17.4 Postmortem governance

Every SEV-1/SEV-2 produces a recorded postmortem in `momentum.decisions`:
timeline, source-of-truth impact, root cause, the read-back proof of the fix, and
the prevention change. Blameless; the goal is that the system stays honest
without the owner having to catch it.

---

## 18. Data Governance

### 18.1 Source-of-truth law

**Rule 18.1.1** — MongoDB (`momentum`) is authoritative. Neo4j and Chroma are
derived. Any correction is applied to Mongo and re-projected; a projection is
never the system of record.

**Rule 18.1.2** — One entity, one owning collection (Multi-DB Gov. Art. IV).
Appendix A is the ownership register.

**Rule 18.1.3** — The node/document canonical `id` is identical across stores.

### 18.2 Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| PII | prospect name/phone/email, BA contact | least-exposure; never in URLs; audited export only |
| Membership | sponsor chain, placements | `graph_critical`; integrity-protected |
| Knowledge | interview transcripts, CRM notes | access-gated (`VISIBLE_TO_SPONSOR`); embedded |
| Operational | callbacks, ticks, audit | standard |
| Compliance-sensitive | any status/funnel field | must carry no income/rank/placement claim |

### 18.3 Retention & lifecycle

- Records are archived/soft-deleted, not hard-deleted (hard delete is prohibited
  for administrators).
- Prospect tokens expire on the 8-week window; expired prospects are archived,
  not purged, unless an owner-approved retention policy `[SET BY KEVIN]` directs.
- Audit entries and decisions are retained indefinitely (governance memory).

### 18.4 Compliance governance (network-marketing)

**Rule 18.4.1 (LOCKED)** — No surface — UI, report, agent output, PMV — may
present income claims, rank claims, placement-as-worth claims, or prospect
scoring/qualification/ranking. This derives from the Foundation (Art. VI.1,
XV.2), the locked data-model contract, and the owner's standing decision that the
platform does not score prospects.

**Rule 18.4.2** — Status fields are funnel facts only (e.g., `video_75`,
`callback_requested`), never judgments.

**Rule 18.4.3** — A compliance breach is SEV-1: contain first, remediate second.

---

## 19. Security Governance

### 19.1 Credential & authentication handling

- Credential material (passwords, API keys, tokens, access codes) is
  system-generated and never entered or surfaced in plaintext through admin
  tooling.
- Account authentication and credential entry are performed by the human owner,
  not automated on their behalf.
- Access codes are 6-character, app-generated, minted at invitation; phone is
  normalized to E.164.

### 19.2 Secrets management

- Secrets (DB credentials, email API keys, embedding service) live in deployment
  configuration/environment, never in the repository or this document.
- Rotation cadence `[SET BY KEVIN]`; rotation status is a quarterly review item
  (Q2).

### 19.3 Access boundaries

- Per-prospect ownership is enforced server-side; no request input widens a BA's
  visible set.
- Interview visibility is gated by `VISIBLE_TO_SPONSOR`, enforced at read.
- Cross-store app administration uses the application server and direct
  persistence adapters. external MCP tooling may be used by authorized
  owner/operator tooling for inspection, repair, and agent memory, but it is not
  the app runtime path. Direct store credentials are restricted to the
  owner/deployment.

### 19.4 Prohibited administrative actions (security)

Modifying access controls/permissions on stores or documents; hard-deleting data;
executing financial transfers; entering credentials into forms on a user's
behalf; bypassing bot-detection; changing security settings. These are owner-only
or not-at-all, regardless of convenience.

---

## 20. Backup Governance

### 20.1 Per-store backup model

| Store | What to back up | Notes |
| --- | --- | --- |
| MongoDB (`momentum`) | full authoritative dataset | the only true backup; everything else is reproducible from it |
| Neo4j | graph snapshot | reproducible by re-projection from Mongo; back up to speed recovery |
| ChromaDB | embeddings + metadata | reproducible by re-embedding from Mongo via GPU service |
| Config/secrets | deployment config | backed up separately, securely |

**Rule 20.1.1** — Because Neo4j and Chroma are derivable from Mongo, the Mongo
backup is the non-negotiable backup. Graph/vector backups are recovery
accelerators, not independent sources of truth.

### 20.2 Cadence & verification

- Backup cadence `[SET BY KEVIN]` (recommend at least daily for Mongo).
- **A backup is not a backup until a restore is tested.** Weekly: test-restore
  one collection (W6). Quarterly: full DR drill (Q1).
- Backup success/failure is a daily-monitored signal.

---

## 21. Recovery Governance

### 21.1 Objectives

- RPO (max acceptable data loss) `[SET BY KEVIN]`.
- RTO (max acceptable downtime) `[SET BY KEVIN]`.

### 21.2 Recovery order

```text
1. Restore MongoDB (source of truth)            <-- platform can run read-mostly here
2. Restore/rebuild Neo4j (re-project from Mongo if snapshot stale)
3. Restore/rebuild ChromaDB (re-embed from Mongo via GPU service)
4. Drain projection_outbox to reconcile any in-flight projections
5. Run graph-integrity sweep (W1) + cross-store reconciliation (M2)
6. Verify (read-back) before declaring recovered
```

### 21.3 Cross-store consistency after restore

**Rule 21.3.1** — After any restore, the system is not "recovered" until: the
outbox is drained, the graph-integrity sweep passes (one `IN_HOLDING_TANK` per
placed prospect, no phantom sponsors, canonical labels), and a reconciliation
sample confirms Mongo ↔ Neo4j ↔ Chroma agreement. Declaring recovery without
these is a false-green and is itself an incident.

### 21.4 Partial-failure recovery

| Failure | Recovery |
| --- | --- |
| Neo4j lost, Mongo intact | re-project membership from Mongo; rebuild edges per canonical vocabulary |
| Chroma lost, Mongo intact | re-embed the four collections from Mongo via GPU service |
| GPU service lost | restart on GPU; embedding paused (queued) until healthy; never CPU-fallback |
| Outbox backlog after outage | drain with bounded batches; dead-letters → SEV-2 |

---

## 22. Success Metrics

Metrics measure momentum and integrity, not vanity (Foundation Art. VII.2 —
holistic, never a single metric; Art. I.2 — momentum is movement).

### 22.1 Operational health KPIs

| KPI | Target |
| --- | --- |
| Store/tooling availability | `[SET BY KEVIN]` |
| GPU embedding `/health` uptime | `[SET BY KEVIN]` |
| Projection lag (outbox oldest pending) | `[SET BY KEVIN]` |
| Dead-lettered projections | 0 |

### 22.2 Integrity KPIs

| KPI | Target |
| --- | --- |
| Phantom-sponsor incidents | 0 |
| Label-split (`:BA`) occurrences | 0 (post-migration) |
| Cross-store reconciliation drift | within `[SET BY KEVIN]` |
| Compliance breaches (score/rank/income surfaced) | 0 |

### 22.3 Foundation-aligned outcome metrics

Movement, not outcomes alone: orientation completion, launch completion, Fast
Start progress, consistency of daily action, community participation. Success is
never a single number (Foundation Art. VII.2).

---

## 23. Integration Requirements

### 23.1 Internal integration contracts

| Integration | Contract |
| --- | --- |
| Direct app persistence adapters | App runtime store access uses dedicated MongoDB, Neo4j, and ChromaDB adapters; writes read back and real errors surface |
| external MCP tooling | MCP/developer tooling and authorized operator scripts; not app runtime persistence |
| GPU embedding service | 384-dim MiniLM; `/health` must report GPU available before embedding; no CPU fallback |
| Tiered writer / outbox | All new/migrated writes route through the tier appropriate to the record |

### 23.2 External integrations

| Integration | Purpose | Build state / config |
| --- | --- | --- |
| Transactional email (Resend) | invitations, magic links, notifications | `PARTIAL` — domain verification for `teammagnificent.com` pending; keys in env |
| Video hosting (YouTube) | the opportunity/product videos referenced by `product-catalog` | `OPERATIONAL` (referenced by key) |
| THREE enrollment (off-app) | actual enrollment happens at THREE; BA marks `enrolled` in-app | `OPERATIONAL` boundary — the app records the fact, does not process enrollment |
| Hosting (VPS) | production hosting | config of record; `[SET BY KEVIN]` for environment specifics |

**Rule 23.2.1** — No external integration may receive PII via URL parameters or
be sent data to an endpoint not configured by the owner.

---

## 24. Future Scalability Considerations

### 24.1 Data-store scaling

- Mongo is the scaling pressure point (source of truth); index discipline
  (contract Section 9) and archival policy precede sharding considerations.
- Neo4j/Chroma scale as projections; they can be rebuilt, so they tolerate
  rebuild-based scaling.

### 24.2 Multi-tenant

`tenant_settings` and `adminTenantArchitecture.ts` indicate a multi-tenant-aware
architecture. Future tenants must inherit: domain triplet, master-content
inheritance, and per-tenant data isolation in Mongo. Tenant isolation rules are
`TARGET` until formally specified.

### 24.3 Learning-layer activation

Follow the staged path (Section 12.5). Capture observations/outcomes early
(cheap, append-only) so the recommendation/feedback layers have history when
built. Never activate a later stage without the earlier stage's data.

### 24.4 Agent scaling

The constitution anticipates additional agents (Leadership, Community,
Knowledge). Each new agent must define its Mongo/Chroma/Neo4j representation,
relationships, observations, and learning impact before activation (Multi-DB
Gov. Art. XIX), and must honor the AI Constitution (advisory, explainable,
human-authoritative).

---

## 25. Glossary & Definitions

| Term | Definition |
| --- | --- |
| Brand Ambassador (BA) | A `.team` member building the business. |
| Prospect | A `.com` visitor in the discovery journey. |
| Holding Tank / Pool | The single shared `(:Pool {poolId:'team'})` where prospects are placed; honors timing (Foundation Art. V). |
| PMV | Prospect Momentum Viewer — BA-scoped awareness of prospect video/engagement progress; no scoring. |
| Observation | A fact ("viewed 75%", "completed module 4"), never a conclusion (Multi-DB Gov. Art. XI). |
| Outcome | A measurable result (enrolled, launched); `TARGET` entity. |
| Recommendation | An explainable agent suggestion; `TARGET` entity. |
| Tier (write) | `graph_critical` / `knowledge` / `operational` — the failure policy for a record. |
| Projection | A derived copy in Neo4j or Chroma; never the source of truth. |
| Projection outbox | Durable retry queue for lagging knowledge/operational projections. |
| Canonical id | The Mongo `_id`, identical across all stores. |
| Build-state tag | `OPERATIONAL` / `PARTIAL` / `TARGET` — authoritative over prose. |

---

## 26. Appendices

### Appendix A — Module → subsystem ownership map

| Subsystem | Owning collection(s) | Domain modules |
| --- | --- | --- |
| User (BA) | `brand_ambassadors`, `access_codes` | `adminBaCrud`, `adminBaOversight`, `ba`, `profile`, `access-codes`, `codeGen` |
| User (Prospect) | `prospects`, `prospect_accounts`, `prospect_magic_links`, `prospect_sessions` | `adminProspectCrud`, `adminProspectOversight`, `prospects`, `prospectAccount`, `prospectMagicLink`, `tokens`, `previewToken` |
| CRM | `crm_notes`, `crm_followups`, `crm_dispositions` | `crm`, `adminProspectOversight`, `reports/followUpAging` |
| PMV | (projection over `invitation_activity`) | `cockpit`, `cockpitPrint`, `todaysActions`, `reports/inviteFunnel` |
| Training | `fast_start_progress`, `ba_workbooks`, `orientation_sessions`, `commitments` | `training`, `workbook`, `questionnaire`, `orientationSession`, `commitments` |
| Resource/Content | `master_content` | (content consumers; Resource Center `TARGET`) |
| Event | `webinar_events`, `webinar_reservations`, `orientation_sessions`, `broadcasts` | `webinarEvent`, `webinarCadence`, `webinarReservation`, `orientationSession`, `broadcast`, `liveOps` |
| Agents | `michael_interviews`, `michael_founder_handoffs`, `ivory_names`, `generator_runs` | `michael-*`, `michaelScoring`, `ivory`, `generator`, `scriptmaker` |
| Knowledge | Chroma (4) + Neo4j graph | (embedding + GraphRAG; learning `TARGET`) |
| Governance | `audit_log`, `decisions` | `auditLog`, admin modules |
| Invitations/Holding tank | `invite_tokens`, `invitation_activity`, `pool_placements`, `pool_counters` | `invitations`, `holdingTank`, `callbackRequest` |

### Appendix B — Build-state register (the honest A-vs-B table)

| Subsystem | State | Gap to operational |
| --- | --- | --- |
| User CRUD | `OPERATIONAL` | lifecycle automation partial |
| Access planes | `PARTIAL` | formal RBAC is `TARGET` |
| Tiered writer | `OPERATIONAL` | call-site migration pending (contract Section 13 items 2–5) |
| Graph vocabulary | `PARTIAL` | `:BA`→`:BrandAmbassador` + `MERGE`→`MATCH` migration (item 2) |
| CRM | `OPERATIONAL`/`PARTIAL` | oversight tooling |
| PMV | `PARTIAL` | projection exists; admin tooling partial; scoring intentionally excluded |
| Training | `PARTIAL` | |
| Resource Center | `TARGET` | master content `PARTIAL` |
| Event | `PARTIAL` | |
| Agents | `PARTIAL` | interview-as-knowledge embedding pending (item 5) |
| Learning loop | `TARGET` | `Observation`/`Recommendation`/`Outcome` not in code |
| Mongoose enforcement | `TARGET` | not present in repo |
| RBAC | `TARGET` | |
| GraphRAG assembly | `TARGET` | components exist; pipeline not assembled |

### Appendix C — Change log

| Version | Date | Author | Change |
| --- | --- | --- | --- |
| 1.0 | 2026-06-21 | Owner of record + AI architect | Initial repository-grade administrator guide; build-state tagged against the verified repository. |

---

*End of ADMINISTRATOR_GUIDE.md. This document is governed by the authority
hierarchy in Section 1.1 and must be re-tagged against the repository each
quarter (Q4). Where it says `[SET BY KEVIN]`, the value is pending an owner
decision and must not be invented.*
