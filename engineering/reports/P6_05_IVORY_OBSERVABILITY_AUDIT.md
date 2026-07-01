# P6.5 — Ivory Observability Audit & Decision

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.5 — Ivory Observability
- **Status:** AUDIT + DECISION — evaluates whether Ivory needs surface-specific observability
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** P6.4; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)
- **Requested by:** Kevin — dedicated Ivory-surface observability write-up.

---

## 1. What observability Ivory has today

Ivory's observability is currently **thin and non-structured**:

1. **Console audit breadcrumbs.** Degradation is logged inline, e.g.
   `[ivory.coach] LLM unavailable, using neutral fallback: …` and
   `[ivory.invitation-agent.draft] LLM unavailable, using neutral fallback: …`.
   These are `console.warn`/`console.log` lines, not structured events.
2. **`degraded: true` response flag.** Every LLM path (`ivoryCoach`,
   `draftIvoryInvitation`, `suggestIvoryMomentumFollowUp`) returns `degraded` so the
   UI can render the fallback state. This is client-visible but not centrally counted.
3. **Shared non-persistent event substrate.** The runtime observability layer
   (`server/src/runtime/orchestration/events.ts` + `server/src/runtime/events/`)
   exists and can build `agent_event.v1` envelopes for any agent (including Ivory's
   inert adapter, `eventFamily`-tagged). It is **build-and-return only** — no
   persistence, no counters, no dashboards (by design; see P6.12).

## 2. What Ivory does **not** have

- No structured per-surface metrics (e.g. draft-degraded rate, mint success rate,
  ownership-rejection count) emitted through the event substrate.
- No admin observability panel specific to Ivory (Michael has an admin
  observability UI per S3.16; Ivory does not).
- No correlation of Ivory LLM-degradation events into the shared substrate — the
  degradation signal lives only in `console` + the per-response `degraded` flag.

## 3. Assessment

For the **current dormant posture** (LLM key unset in dev; Ivory drafting degrades to
deterministic fallback), the existing breadcrumbs + `degraded` flag are **sufficient
for correctness and safety**: nothing silently fails, and the compliance guardrails
are enforced at draft time regardless of observability. So P6.5 is **not blocking**.

However, once `ANTHROPIC_API_KEY` lands and Ivory drafting activates in production,
**console breadcrumbs are inadequate** for operating the surface. At that point Kevin
will want, at minimum:

- a **structured `degraded`-rate signal** (how often Ivory falls back), routed
  through the shared `agent_event.v1` substrate rather than `console`;
- **ownership-rejection** and **mint-failure** counts as events;
- optional surfacing in `/admin` alongside Michael's aggregated enforcement metrics
  (aggregate only — never a manual review queue, per the compliance rule).

## 4. Decision (for Kevin's ratification)

- **P6.5 status: PARTIAL → accepted as sufficient for the dormant phase.** The shared
  non-persistent substrate (P6.12) is the sanctioned observability seam; Ivory does
  not need a bespoke persistence-backed observability system now.
- **Deferred, gated follow-up (NOT built here):** when Ivory LLM drafting is
  activated, add a small **structured emission** step that routes Ivory
  degradation/mint/ownership events through the existing `captureOrchestrationEvent`
  path (still non-persistent unless a separate persistence decision is approved), and
  optionally an aggregate `/admin` tile. This is an activation-adjacent change and is
  **out of scope** for this documentation worktree (activating/expanding agent
  behavior requires explicit Kevin approval).

## 5. Standing prohibitions preserved

No new persistence, no new LLM calls, no `.com` exposure, no manual review queue.
Any future Ivory observability must emit **aggregate** signals only and must not
introduce a per-prospect scoring/ranking surface.

## 6. Recommendation

Ratify §4: treat P6.5 as satisfied for the dormant phase by the shared event
substrate + breadcrumbs + `degraded` flag, and schedule the structured-emission
follow-up to ride with Ivory LLM activation (separate approved slice).
