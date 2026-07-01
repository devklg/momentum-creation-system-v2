# P6.12 — Multi-Agent Observability (Substrate Verification)

- **Sprint:** Sprint 6 — Multi-Agent Runtime Expansion
- **Slice:** P6.12 — Multi-Agent Observability
- **Status:** VERIFICATION — substrate **DONE-ON-MAIN** (S2.1/S2.2, `96c2218`/`6a62304`)
- **Branch:** `feature/phase-06-multi-agent-runtime-expansion`
- **Base SHA:** `cce9a951e3ca1b04307f68245201c389375b0a7a`
- **Date:** 2026-07-01
- **Depends on:** P6.11; `P6_RECONCILIATION_AUDIT.md`
- **Author:** Claude Code (Instance 4)

---

## 1. The substrate

Multi-agent observability is the **non-persistent runtime event-capture layer**:
`server/src/runtime/orchestration/events.ts` built on the S1.4 foundation in
`server/src/runtime/events/`.

Exports: `captureOrchestrationEvent`, `createEventCapture`, `idempotencyKeys`,
`ORCHESTRATION_EVENT_SOURCE` (`'agent_runtime'`), `ORCHESTRATION_EMITTER`
(`'agent_runtime_orchestrator'`), `ORCHESTRATION_COMPONENT_VERSION` (`'s2.1'`), and
the `EventCapture` / `OrchestrationEventInput` types.

## 2. Behavior — build-and-return only (verified)

`captureOrchestrationEvent(input)` **builds and returns** a validated
`agent_event.v1` envelope via `createRuntimeEventEnvelope`. It:

- **never persists** (no store write, no outbox record);
- **never replays**;
- **never publishes** to subscribers or calls an event API.

"The return shape is the contract: orchestration collects envelopes in memory and
returns them." This is observability without any persistence side-effect — which is
precisely why it satisfies the "no unapproved persistence" prohibition.

## 3. Namespacing & agent-family identity (verified)

- Only approved S1.4 event-type namespaces are used: `agent.*`, `context.*`,
  `guided_action.*`, `system.*`.
- Agent-family identity (`steve` / `michael` / `ivory`) is carried on the envelope
  **`agentKey`**, not encoded into the event-type string — keeping the event
  vocabulary agent-agnostic while still attributable per agent
  (`eventFamily` on each registry descriptor).

## 4. Idempotency

`idempotencyKeys` provides deterministic keys so a re-emitted fact yields the same
envelope identity — supporting future at-least-once delivery **without** requiring
persistence today.

## 5. Coverage & tests

The observability substrate is exercised by the orchestration test suite (event
usage across `composition`, `consumption`, `contextRequest`, `turnCoordinator`,
`outcomeGuidedAction`, and the governance-boundary tests). All green (part of the
1260-test run).

## 6. Per-agent observability status

- **Michael** additionally has an admin observability UI (S3.16) and minimal
  in-memory observability (S3.6) from Phase 3.
- **Steve / Ivory** currently rely on the shared substrate plus console audit
  breadcrumbs (`[audit] steve_discovery_ingested …`; `[ivory.*] LLM unavailable …`).
  Ivory's surface-specific follow-up is captured in **P6.5**.

## 7. Standing prohibitions preserved

Non-persistent by construction (no unapproved persistence); no LLM; no `.com`; agent
identity via `agentKey`, not behavior. Any future persistence-backed observability is
a separate, approved decision.

## 8. Recommendation

Record P6.12 as **DONE-ON-MAIN & VERIFIED**. The shared non-persistent
`agent_event.v1` capture layer is the sanctioned multi-agent observability seam. No
substrate changes required.
