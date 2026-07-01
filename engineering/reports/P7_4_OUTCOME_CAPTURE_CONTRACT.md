# P7.4 — Outcome Capture Contract

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.4 (contract proposal — design only)
- Status: **PROPOSAL — NON-RATIFIED. Contract only.** No persistence implementation is authorized by this document.
- Base SHA: `cce9a951e3ca1b04307f68245201c389375b0a7a` (verified HEAD == Base SHA)
- Rung: **R1** in the P7.1 persistence ladder (enabled only after R0 runtime audit is proven).
- Depends on: P7.1 (governance), P7.2 (audit schema), P7.3 (write contract — Path B killed). Implementation is a later, separately-approved slice.
- Aligns to: **ACR-0007** (app-direct persistence; Universal Gateway is dev tooling), canonical schema `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (commit `f976dd3`), P7.3 §4 (app-memory envelope + `$jsonSchema` governed door).

---

## 1. Purpose

Define how a **BA-confirmed outcome** — a real-world result a Brand Ambassador reports (e.g. "prospect attended the webinar," "prospect enrolled off-app in THREE," "callback happened") — is captured and persisted **through the single app-direct seam** into the app's own dedicated stores. Prior phases kept outcomes **returned-only** (S2.10). This contract is the R1 rung that, once approved and after R0 audit is proven, turns that boundary on for outcomes only.

An outcome record answers: *which BA confirmed which outcome, for which prospect/token, at what time, of what kind* — a durable, BA-scoped fact the team's learning layer can later derive from. It never fabricates a result, never scores or ranks, and never touches `.com`.

---

## 2. What an outcome is — and is not

**Is (in scope):**
- A **BA-confirmed** fact. The BA is the source of truth; the app records the confirmation, it does not infer the outcome.
- **BA-scoped and team-scoped** — belongs to the confirming BA and their team slice, mirroring the downline model.
- A **discrete, enumerated** outcome kind (§4.1), not free text describing a result.

**Is not (excluded, never persisted):**
- **Not** an automatically-derived, scored, ranked, or qualified judgement. No agent decides an outcome happened (standing prohibition: no scoring/ranking/qualification).
- **Not** a THREE enrollment handoff. THREE is the upstream authority; the app **mirrors** the slice that is Kevin's downline and never overrides. An "enrolled" outcome is a BA-reported mirror fact, not a programmatic enrollment (locked-spec Part 2).
- **Not** income/compensation/cycle/placement values (standing prohibition).
- **Not** `.com`-surfaced. Outcomes are BA-facing only.
- **Not** raw transcript/LLM content.

---

## 3. Write path (single, app-direct)

Every outcome record travels the **one** path from P7.3 §3: `tripleStackWrite()` into the app's own dedicated stores (Mongo `momentum` @30000, Neo4j @7710, Chroma `mcs_*` @8200). **No `quadstack.write`. No Universal Gateway.** Because an outcome is a durable fact a future query will recall/trace, it is a **memory-class** record and carries the **app-memory envelope** (P7.3 §4.2), guarded by the collection's Mongoose + `$jsonSchema` governed door (P7.3 §4.3).

### 3.1 Store mapping

| Store | Target | Content |
|---|---|---|
| MongoDB | `mcs_outcomes` (momentum) | full outcome doc: app-memory envelope + outcome fields (§4.2) |
| Neo4j | `(:Outcome {id})` | envelope core + `kind`, `outcomeAt`; edges `(:Outcome)-[:CONFIRMED_BY]->(:BA)`, `(:Outcome)-[:ABOUT_PROSPECT]->(:Prospect)`, `(:Outcome)-[:VIA_TOKEN]->(:InviteToken)` |
| ChromaDB | `mcs_outcomes` | short summary `outcome kind=… ba=… prospect=… at=…` (no PII beyond opaque ids); flat metadata with required `kind` + scope ids + ISO timestamps |

`id` is shared across all three (P7.3 §3.2). Chroma collection is `mcs_`-prefixed and ensured at boot.

---

## 4. Schema

### 4.1 Outcome kinds — the terminal RESOLUTION (P7.16 §1a)

An outcome is **how a prospect resolved**, not a journey milestone. Milestones (watched video, attended webinar, completed callback, no-show) live in the **event log**, not here. The outcome is a small closed set:

```ts
export type McsOutcomeKind =
  | 'pending'          // not yet resolved (default; usually not recorded)
  | 'enrolled_iii'     // enrolled into III International = became a Brand Ambassador (→ a Team Magnificent member)
  | 'became_customer'  // became a product customer (NOT a member; non-exclusive with enrolled_iii)
  | 'declined';        // said no / did not convert
```

The set is **closed and enumerated** — a new kind is a schema change through a decision, never free text. No kind carries a numeric result, a score, or a rank. `enrolled_iii` and `became_customer` are **non-exclusive** (a customer may later enroll); the current resolution is whichever is furthest along. This is the **same resolution concept** as the F6 `ProspectStatus` (they unify to one enum).

### 4.2 Outcome record (app-memory envelope + fields)

```ts
export interface McsOutcomeRecord extends McsMemoryEnvelope {
  // envelope (P7.3 §4.2): id, type:'outcome', schemaVersion, namespace:'momentum',
  //   source, createdAt, title, originKind:'system', serviceName, tenantId, baId, derivedFrom?
  kind: McsOutcomeKind;
  confirmedByBaId: string;   // the BA who confirmed (== envelope baId)
  prospectId?: string;       // scope; opaque id, no PII
  token?: string;            // originating invite token where applicable
  outcomeAt: string;         // ISO-8601 UTC '…Z' — when the real-world outcome occurred (BA-stated)
  note?: string;             // optional short BA note, capped; never a transcript/LLM body
  supersedesOutcomeId?: string; // correction chain (append-only; see §5.3)
}
```

`type` is always `'outcome'`; `originKind` is always `'system'` (server-derived record of a BA confirmation) → `serviceName: 'mcs_outcome_capture'`. No `chat_number`, no `universal_gateway` (P7.3 §4.4).

### 4.3 Determinism & idempotency

- `id` is deterministic from `(token | prospectId, kind, confirmedByBaId)` for the natural "one outcome of this kind per prospect per BA" cases — a retried confirmation is a no-op, not a duplicate.
- Where multiple outcomes of the same kind are legitimately possible (e.g. two callbacks), the deterministic key includes `outcomeAt` (or an event id from the source record).

---

## 5. Invariants (acceptance bar for the impl slice)

1. **BA-confirmed only.** The write is triggered by an explicit BA action in the `.team` surface. No agent, timer, or heuristic creates an outcome. No scoring/ranking/qualification.
2. **Single app-direct path** via `tripleStackWrite` (P7.3 §3). All-three-or-fail; fail-before-Mongo; read-back on first-of-family during canary. **No gateway.**
3. **App-memory envelope** (P7.3 §4.2) stamped; passes the `mcs_outcomes` `$jsonSchema` governed door.
4. **Scope stamped** — `tenantId` + `confirmedByBaId` on every record; `prospectId`/`token` where applicable.
5. **THREE is authority.** `enrolled_iii` (enrolled into III International = became a Brand Ambassador) is a mirror of a BA report, never a programmatic enrollment or handoff. No registration-handoff route.
6. **No excluded data** — no income/compensation/cycle/placement, no `.com` exposure, no transcript/LLM bodies, no PII beyond opaque ids.
7. **Append-only with correction chain.** Outcomes are not edited in place; a correction writes a new record with `supersedesOutcomeId` pointing at the prior (Neo4j `(:Outcome)-[:SUPERSEDES]->(:Outcome)`), so history is preserved.
8. **No agent writes.** Server domain layer owns the write boundary; routes stay thin. Context Manager remains the sole Context Packet assembler.

---

## 6. Read surface & downstream

- Outcomes are read by BA-facing team views and by `/admin` **aggregate** metrics — never a `.com` surface, never a manual review queue.
- Outcomes are the **input corpus** for P7.5 (learning candidates): a learning candidate may be *derived from* one or more outcome records (`derivedFrom: [outcomeId, …]`). The derivation is a later pipeline; this contract only guarantees outcomes are captured cleanly enough to derive from.
- No new `/api/runtime/*` route family (standing prohibition). Outcome capture reuses the existing BA-facing route conventions under the domain boundary.

---

## 7. Failure & rollback

- Partial write → fail loud (P7.3 §6); caller surfaces a retryable error; no leg is best-effort.
- Schema rejection at the governed door → fix payload, never loosen the validator.
- Canary cleanup → delete-by-id across all three app stores using the deterministic `id`.
- Kill switch → the R1 outcome family is flag-gated (P7.1 §6); disabling it stops new outcome writes without redeploy and without touching R0 audit.

---

## 8. What this document does NOT do

- Adds no export to `types.ts`, no route, no domain code (that is the impl slice, post-approval).
- Writes to no store; enables no persistence.
- Does not authorize any THREE enrollment handoff (there is none).
- Does not introduce scoring, ranking, or qualification of outcomes.

---

## 9. Open decisions for Kevin

1. **Milestones vs outcome (RESOLVED, P7.16 §1a)** — journey milestones (`webinar_attended`, `callback_completed`, `orientation_attended`, `no_show`) are **not** outcomes; they live in the event log. The outcome enum is the terminal resolution only (`pending · enrolled_iii · became_customer · declined`), which unifies with the F6 `ProspectStatus`.
2. **Correction window** — is there a time limit after which an outcome can no longer be superseded, or is the correction chain open indefinitely (recommended, append-only, matching audit/decision discipline)?
3. **Retention** — keep outcomes indefinitely (recommended; small, metadata-only, feeds learning) or apply a rolling window?
