# P7.14 — Learning Measurement & Attribution (design)

- Phase: Phase 7 — Outcomes, Persistence, Learning, GraphRAG
- Slice: P7.14 (measurement design — DOCS ONLY)
- Status: **DESIGN — nothing built.** Defines how we *prove* the organization is learning, and the provenance the stores must record **from birth** so learning is measurable rather than hoped-for.
- Base: `feature/phase-07-outcomes-learning-graphrag`.
- Aligns to: `runtime/KNOWLEDGE_EVOLUTION_RUNTIME.md` §23 (monitoring) / §28 (metrics), P7.4 (outcomes), P7.5 (candidates), P7.6 (GraphRAG), P7.11 (observability). Standing prohibitions: **no scoring/ranking/qualification of BAs or prospects.**

---

## 0. What "learning" means here (the reframe)

**Agents do not learn autonomously.** No agent self-modifies; no agent approves knowledge (`KNOWLEDGE_EVOLUTION_RUNTIME`, ACRs). "Are the agents learning?" means: **is Team Magnificent's knowledge improving, and do agents guide better because they retrieve better *approved* knowledge?** The loop is human-gated:

```
outcomes (R1) → learning signals → candidates (R2) → HUMAN review/approval
   → knowledge evolution → active knowledge → GraphRAG retrieval (R3)
   → better Context Packets → better agent guidance → better outcomes → (loop)
```

Measuring learning = measuring whether this loop **closes and improves outcomes over time** — attributable to specific knowledge, not just correlated with it.

---

## 1. Two classes of metric (don't confuse them)

| Class | Answers | Built? |
|---|---|---|
| **Process metrics** | "Is the loop *running*?" — candidate volume, approval rate, time-in-review, gate allow/deny, outcome distribution | ✅ P7.11 (`computeLearningObservabilitySnapshot`) |
| **Outcome-attribution metrics** | "Is the loop *working*?" — does approved knowledge X actually **lift** outcomes? | ❌ this design |

A high approval rate with flat outcomes is **motion, not learning.** Only attribution proves learning.

---

## 2. The measurement substrate — provenance the stores must record

Attribution is only possible if we record **which knowledge informed which guidance that preceded which outcome** — at write time. You cannot retro-attribute. The chain:

```
(:LearningSignal)                          derived from outcomes/audit
   ↑ :DERIVED_FROM
(:LearningCandidate)  ──:APPROVED_AS──▶  (:Knowledge {id, version})
                                            │ :INFORMED           (NEW — to add)
                                            ▼
                                      (:ContextPacket {packetId})
                                            │ :GUIDED             (NEW — to add)
                                            ▼
                                      (:Outcome {id})   ◀─:SUPPORTED_BY─ (:Knowledge)
(:Outcome)-[:CONFIRMED_BY]->(:BrandAmbassador)   (:Outcome)-[:ABOUT_PROSPECT]->(:Prospect)
```

**Edges/records to add (from birth):**
1. `(:Knowledge)-[:INFORMED]->(:ContextPacket)` — record, per Context Packet, **which knowledge records were retrieved into it** (GraphRAG already knows the hit ids at retrieval time — persist them).
2. `(:ContextPacket)-[:GUIDED]->(:Outcome)` — link the guidance a BA acted on to the outcome that followed (via `turnId` / `correlationId` already on the runtime audit envelope).
3. On the `mcs_outcomes` record: an optional `informedByKnowledgeIds: string[]` (the knowledge that reached the guidance behind this outcome) — the app-direct, queryable form of the graph path.

These are **additive** to the already-built R1/R3 records and cost nothing to add now; they are expensive-to-impossible to backfill later.

---

## 3. Attribution / lift methodology

Given the chain, "did knowledge X cause better outcomes?" is answered by **comparison, not by counting**:

- **Before/after activation** — outcome rate for the relevant domain/cohort in the window *before* knowledge X went `retrievalReady` vs *after*.
- **Exposed vs unexposed** — outcomes where the guidance was `INFORMED` by X vs comparable outcomes where it was not (same domain, same outcome kind, same period).
- **Lift** = (exposed positive-outcome rate) − (unexposed positive-outcome rate), with the count of supporting outcomes so a "+40% lift" on n=3 is not mistaken for signal.

Guardrail: this is **correlational unless the comparison is controlled.** The honest report states lift *with* its denominator and never claims causation from a single cohort. (A future controlled rollout — activate for a subset first — upgrades this to causal.)

---

## 4. The metrics that answer "are we learning?"

| Metric | Definition | Signal |
|---|---|---|
| **Outcome trend** | confirmed positive outcomes over time (per domain, aggregate) | is the real-world result improving at all? |
| **Knowledge-attributed lift** | §3 exposed − unexposed, per knowledge item | the causal-ish core: did *this* knowledge help? |
| **Candidate→validated conversion** | approved candidates that later reach `validated` (vs `weakened`) | is approved learning *proving out*, not just passing review? |
| **Retrieval usefulness** | share of retrieved knowledge actually `INFORMED` a guidance that preceded a positive outcome | is GraphRAG serving *useful* knowledge or noise? |
| **Knowledge health index** | active knowledge in `validated` vs `weakened`/`supersession_recommended` states | rising validation = org learning; rising weakening = decay |
| **Coverage** | domains/topics with ≥1 active, retrieval-ready knowledge item | where the org has learned vs blind spots |

All are **aggregate** (per domain/tenant/time), never per-BA or per-prospect scores (§7).

---

## 5. Knowledge health lifecycle (the monitoring feedback)

Per `KNOWLEDGE_EVOLUTION_RUNTIME` §23.2, each active knowledge item carries a monitoring state driven by post-activation outcomes:

```
monitoring → validated                (outcomes improved after use)
          → needs_refinement          (mixed)
          → weakened                  (outcomes did not improve / worsened)
          → supersession_recommended  (a better candidate exists)
```

This state is the *closing* of the loop: a `weakened` item feeds a new learning signal → new candidate → review. Measuring the **flow rate** through these states is the truest single indicator that the organization (not the agent) is learning.

---

## 6. Wire-from-birth requirements (why this is in the pre-apply review)

Attribution must be recorded **at the moment guidance is produced and the outcome is confirmed** — it cannot be reconstructed later. So before the stores go live:

1. GraphRAG retrieval (R3) persists the **retrieved knowledge ids per Context Packet** (`:INFORMED`).
2. The runtime turn (R0 audit) carries the `turnId`/`correlationId` that ties a Context Packet to the BA action to the eventual outcome (R1) — already present; extend the outcome write to capture `informedByKnowledgeIds`.
3. Knowledge records (R3) carry their `version` (already do) so lift is measured per version, not blurred across edits.

None of this is autonomous behavior or LLM calls — it is **provenance bookkeeping** on the existing app-direct writes.

---

## 7. Compliance guardrails (measuring knowledge, not people)

- **Never a person score.** These metrics measure **knowledge effectiveness**, aggregated by domain/tenant/time. They must **not** score, rank, qualify, or predict BAs or prospects (standing prohibition) — no "BA learning score," no prospect propensity.
- **No `.com` exposure.** Learning metrics are admin-only (P7.2 §5 read surface); never prospect-facing.
- **No income/comp/cycle/placement** in any metric.
- **Aggregation floor.** Suppress any cohort metric below a small-n threshold so an aggregate can't re-identify an individual.

---

## 8. Built vs to-build

- **Built:** R0 audit, R1 outcomes, R2 candidates, R3 GraphRAG retrieval, P7.11 process metrics, the provenance edges already emitted (`SUPPORTED_BY`, `DERIVED_FROM`, `SCOPED_TO`).
- **To build (this design):** the `:INFORMED` / `:GUIDED` edges + `informedByKnowledgeIds`, the knowledge monitoring-state machine (§5), and the attribution/lift computation (§3–§4) as an aggregate admin metric — all app-direct, all additive, all gated behind the existing R3 flag.

## 9. Open decisions for Kevin

1. **Controlled rollout for causal lift?** Activate new knowledge for a subset first (true A/B) vs before/after only (cheaper, correlational). Recommend before/after now, controlled later.
2. **Small-n floor** — suppress cohort metrics below n = ? (recommend 5).
3. **Attribution window** — how long after guidance an outcome still counts as "informed by" it (recommend a bounded window, e.g. 30 days, configurable).

---

## Bottom line

Today we can prove the loop is **running and human-approved**. This design adds the provenance + lift layer that lets us prove the loop is **working** — that approved knowledge measurably improved outcomes — turning "are the agents learning?" into a number, without ever scoring a person. The critical action is to record the `:INFORMED`/`:GUIDED` provenance **from the first write**, because it cannot be backfilled.
