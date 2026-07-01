# P7.12 — Store Provisioning + Governed-Door Plan (Phase 7 activation prerequisites)

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.12 (activation-prerequisite plan — DESIGN/DOCS ONLY)
- Status: **PLAN — nothing provisioned, no validator applied, no store written.** Governs the steps that must happen before any R0–R3 rung is turned on. Application is Kevin's, per the write-freeze + Non-Destructive Rule.
- Base: `feature/phase-07-outcomes-learning-graphrag`.
- Aligns to: `engineering/reports/P10_MCS_V2_SCHEMA_DESIGN.md` (`f976dd3`), `ACR-0007`, `DECISION_governed_dedicated_stack_founding_principle.md`, `FINDING_chroma_boot_naming_drift.md`, and the P7.7–P7.10 rung implementations.

---

## 0. Why this exists

The R0–R3 rungs (P7.7–P7.10) are built and green but **dormant**. Turning any rung on requires three things that do not exist yet: (1) the app's dedicated stores stood up, (2) the P7 collections schema-governed from birth, and (3) the per-store direct-mode cutover. This plan sequences them. It is the bridge between "substrate built" and "canary on."

The **companion** activation seam for R0 is already in code: `server/src/runtime/runtimeAuditEmitter.ts` (unmounted, flag-gated). This plan covers the store/schema side; the emitter covers the call side.

---

## 1. The dedicated triple-stack to provision

Per ACR-0007 + the dedicated-stack decision, the app persists **direct** to its **own** stores (separate from the Universal Gateway's):

| Store | Target | Notes |
|---|---|---|
| MongoDB | database `momentum` @ `:30000` | 49 app collections (P10 §4) + the 3 new P7 memory collections (§2). |
| Neo4j | `:7710` | per-label uniqueness constraints (P10 §6) + the new P7 labels (§3). |
| ChromaDB | `:8200`, `mcs_`-prefixed | `CHROMA_COLLECTIONS` registry (already includes the P7 additions, §4). GPU embedder on `:8300` (384-dim). |

**Direct-mode cutover** is the existing S1.3 mechanism: `PERSISTENCE_DIRECT_ENABLED` + per-store `PERSISTENCE_<STORE>_MODE` (`server/src/services/persistence/flags.ts`). Provisioning means standing up the three services, applying schema (§2–§4), then flipping the master switch — a flag flip, not a rewrite (the whole persistence seam is already mode-agnostic).

---

## 2. MongoDB governed doors — the 3 new P7 memory collections

Per the governed-from-birth principle, each new collection ships a real Mongoose model whose `$jsonSchema` validator is applied via the existing pipeline (`server/src/services/persistence/mongo/jsonSchema/generate.ts` → `apply.ts`, `validationLevel:'moderate'`, `validationAction:'error'`). First-pass posture: `required` = the proven-always-present core; `additionalProperties: true` (tighten later per P10 §5). All timestamps are ISO-8601 **strings** (`bsonType:'string'`), never BSON `Date` (P10 §3.3).

### 2.1 `mcs_outcomes` (R1 — P7.8)
- **Key:** `_id` = `id` (`mcsoutcome_<hash>`), deterministic.
- **Required-core (bsonType):** `id`·`type`(const `'outcome'`)·`schemaVersion`(int)·`namespace`(const `'momentum'`)·`source`·`createdAt`·`title`·`originKind`(const `'system'`)·`serviceName`·`tenantId`·`kind`·`confirmedByBaId`·`outcomeAt` (string); `prospectId`·`token`·`note`·`supersedesOutcomeId` (string/null); `baId` (string).
- **`kind` enum:** the 7 `McsOutcomeKind` values.
- **Indexes:** `{id}` (unique), `{confirmedByBaId, kind}`, `{prospectId}`, `{token}`, `{tenantId, createdAt}`.
- **Banned (validator rejects):** `chat_number`, `chat_registry_id`, `namespace:'universal_gateway'`, and `date`/`timestamp`/`chat`/`synced_chat`/`start_time`.

### 2.2 `mcs_learning_candidates` (R2 — P7.9)
- **Key:** `_id` = `id` (`mcslearn_<hash>`).
- **Required-core:** envelope core + `status`(enum: detected/in_review/approved/rejected/superseded)·`domain`(enum)·`language`(en/es)·`proposedSummary`·`sourceOutcomeIds`(arr)·`sourceSignalIds`(arr)·`teamKey`(const `'team_magnificent'`).
- **Optional:** `review`(obj/null), `supersedesCandidateId`(string/null), `baId`.
- **Indexes:** `{id}` (unique), `{tenantId, status}`, `{status, domain}`, `{teamKey, status}`.
- **Governed guarantee:** the validator does **not** enforce "no agent approval" (that is application logic in `learningCandidates.ts`), but it does pin `status` to the enum and `review.decision` to approved/rejected — a malformed review shape is rejected at the door.

### 2.3 `mcs_graphrag_records` (R3 — P7.10)
- **Key:** `_id` = `id` (`mcsgraph_<kobj>_v<version>_<lang>`).
- **Required-core:** envelope core + `knowledgeObjectId`·`version`(int)·`domain`(enum)·`language`(en/es)·`summary`·`model`(const `'all-MiniLM-L6-v2'`)·`modelVersion`·`retrievalReady`(bool).
- **`type` enum:** `graphrag_record` | `graphrag_chunk`.
- **Indexes:** `{id}` (unique), `{knowledgeObjectId, version}`, `{domain, language, retrievalReady}`, `{tenantId}`.

### 2.4 `mcs_audit_log` (R0)
Already the canonical 4.J substrate. R0 adds runtime rows to it (no new collection — the naming-drift guard, `FINDING_chroma_boot_naming_drift.md`). Its governed door already exists on the direct path; extend the required-core to tolerate the additive `runtime` block (optional object) so runtime rows validate.

---

## 3. Neo4j constraints + indexes (new P7 labels)

Apply idempotently (`CREATE CONSTRAINT … IF NOT EXISTS`), per P10 §6 conventions. New labels introduced by P7:

```cypher
CREATE CONSTRAINT outcome_id IF NOT EXISTS            FOR (o:Outcome)            REQUIRE o.id IS UNIQUE;
CREATE CONSTRAINT learning_candidate_id IF NOT EXISTS FOR (c:LearningCandidate) REQUIRE c.id IS UNIQUE;
CREATE CONSTRAINT knowledge_id IF NOT EXISTS          FOR (k:Knowledge)         REQUIRE k.id IS UNIQUE;
CREATE CONSTRAINT team_magnificent_key IF NOT EXISTS  FOR (t:TeamMagnificent)   REQUIRE t.teamKey IS UNIQUE;
// AuditEntry.entryId constraint already covered by the 4.J / P10 §6 set.
// Lookup indexes:
CREATE INDEX outcome_ba IF NOT EXISTS   FOR (o:Outcome)          ON (o.baId);
CREATE INDEX candidate_status IF NOT EXISTS FOR (c:LearningCandidate) ON (c.status);
CREATE INDEX knowledge_ready IF NOT EXISTS FOR (k:Knowledge)     ON (k.retrievalReady);
```

Relationships used by P7 (specific verbs only — no `RELATED`/`CONNECTED_TO`): `(:Outcome)-[:CONFIRMED_BY]->(:BrandAmbassador)`, `(:Outcome)-[:ABOUT_PROSPECT]->(:Prospect)`, `(:Outcome)-[:SUPERSEDES]->(:Outcome)`, `(:LearningCandidate)-[:DERIVED_FROM]->(:Outcome)`, `(:LearningCandidate)-[:SCOPED_TO]->(:TeamMagnificent)`, `(:Knowledge)-[:SCOPED_TO]->(:TeamMagnificent)`. **Prereq (P10 §5.1):** reconcile the `BA` vs `BrandAmbassador` label split before declaring the `:CONFIRMED_BY` edge target, or knowingly target one.

---

## 4. ChromaDB collections

Already registered in `server/src/services/chromaCollections.ts` and ensured at boot (`ensureChromaCollections`) + guarded on write (`assertChromaCollectionExists`):
- R1: `mcs_outcomes`
- R2: `mcs_learning_candidates_review` (review-only, disjoint from active)
- R3: the 10 active-knowledge collections `mcs_<domain>_knowledge_<lang>`

Record contract per P10 §7.2: `id` == Mongo `_id`; `document` = short summary; flat `metadata` with a required `kind` + scope ids + ISO timestamps; embedding provenance `model`/`modelVersion`, fixed 384-dim. Chroma metadata is convention-enforced by the writers (Chroma does not validate schemas).

---

## 5. Rollout order (reversible, per-store, per-collection)

1. **Provision services** — bring up Mongo `momentum`@30000, Neo4j@7710, Chroma@8200 + GPU embedder@8300 (dev topology; prod is Atlas/Aura/Chroma-Cloud + hosted embeddings per the standing prod-topology decision).
2. **Apply governed doors** — author the 3 Mongoose models (§2), apply `$jsonSchema` at `moderate`; apply Neo4j constraints (§3); confirm the Chroma registry (§4). Start with the stable P7 collections; they have no divergent-writer problem (unlike the VM collections in P10 §5).
3. **Direct-mode cutover** — flip `PERSISTENCE_DIRECT_ENABLED` + per-store modes; the seam routes direct. Read-back verification on the first write of each family (P7.1 §4.3).
4. **Per-rung canary** — enable **R0 only** (`RUNTIME_AUDIT_PERSISTENCE_ENABLED=true`), wire `coordinateRuntimeTurnAudited` + the gate emitters into a live turn/auth path, prove read-back on `mcs_audit_log`, watch observability. Then R1 → R2 → R3, each proven before the next.
5. **Tighten** — move validators to `additionalProperties:false` per-collection only after a soak in `moderate` (P10 §5/§8).

**Reversibility at every step:** validators drop with `collMod` back to permissive; constraints drop with `DROP CONSTRAINT`; each rung flag flips off without redeploy; canary rows delete-by-id across all three stores using the deterministic `id`.

---

## 6. Governance guardrails (in force)

- Nothing here is applied by this document (write-freeze / Non-Destructive Rule). Application is Kevin's, per-store, per-collection, separately approved.
- No `quadstack.write`, no Universal Gateway in any runtime path (ACR-0007).
- No rung enabled by default; each is canary/flag-gated (P7.1 §6).
- No `/api/runtime/*` route family; live wiring is a separate route decision.

---

## 7. Prerequisites to close before tightening (from P10 §5)

- `BA` vs `BrandAmbassador` Neo4j label reconciliation (affects `:CONFIRMED_BY`).
- Confirm `_id`=natural-key standardization for the new P7 collections (they already follow it).
- The open contract decisions (P7 closeout §5): app-memory casing (camelCase adopted), CLAUDE.md #135 scoping, `KNOWLEDGE_EVOLUTION_RUNTIME` route/`Date` conflicts, reviewer authority.

## 8. Definition of "ready to activate R0"

R0 can be turned on when: (1) Mongo `momentum`@30000 is up with `mcs_audit_log` validated for the `runtime` block; (2) Neo4j@7710 has the `AuditEntry` constraint; (3) Chroma@8200 has `mcs_audit_log` ensured; (4) direct-mode read-back verified; (5) a live turn/auth path calls the `runtimeAuditEmitter` seam; (6) Kevin flips `RUNTIME_AUDIT_PERSISTENCE_ENABLED`. R1–R3 follow the same shape against their own collections/flags.
