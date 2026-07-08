# Codex Execution Prompt — Complete the VM Dialer Dashboard

You are working inside the Momentum Creation System V2 repository (`D:/momentum-creation-system-v2`).

Architecture Version: 1.0 (FROZEN)
Governance: ACR-0007 APPROVED (direct triple-stack persistence)
Branch base: `main`
Date: 2026-07-07

---

## Why this task exists (verified 2026-07-07, not assumed)

The VM/voicemail lead system is **substantially built** — ~4,000 lines across 20 server files (`vmProviderQueue.ts` 1,009 lines with a real queued→processing→failed→dead_lettered job state machine + attempts/locking; `adminVm.ts`; schemas; tokens; campaigns; lead-owners; ownership; three workers import/delivery/webhook; Telnyx transport + call-control; webhook verification; routes). `TELNYX_API_KEY` and the from-number/connection/webhook/public-key are all SET in `.env`. This is NOT a from-scratch build.

**What is actually incomplete for a working dialer DASHBOARD** (verified by reading the code):

1. **Admin VM UI is oversight-only, not an operations dashboard.** `apps/admin/src/routes/vm.tsx` (400 lines) renders campaign overview + a lead-ownership-correction form, backed by only TWO endpoints: `GET /api/admin/vm/overview` and `POST /api/admin/vm/ownership-correction` (`server/src/routes/admin/vm.ts`). There is no live queue-state panel, no per-campaign drop progress, no delivery-outcome breakdown as a live surface, no retry/dead-letter visibility, and no dialer actions (start/pause/retry/cancel).

2. **`vmNotificationHooks.ts` is entirely stubbed** — 15 hooks all `status: 'stubbed'`. This is the feedback layer (what happened to a drop / notify BA + lead owner). Without it the dashboard cannot show real dispositions end-to-end.

3. **`VM_LIVE_DELIVERY_ENABLED` is absent/false.** Correct until Kevin approves live delivery — the dashboard must work in both guarded (no real Telnyx drops) and live modes.

4. **`acquisition_provider_placeholder` is still a provider mode** — confirm/finish the real provider path so the dashboard reflects real delivery, not placeholder.

**Real data already available to build on** (verified): `adminVm.ts` already computes delivery-event counts and 24h rollups from `tmag_vm_delivery_events` (delivered/sent/complete vs failed/error/bounced), lead-status rollups (validated, queued, voicemail_sent, suppressed, tokenized, activated), suppressions, and campaign/lead/owner joins. The queue (`vmProviderQueue.ts`) exposes real job states. The dashboard surfaces this — it does not invent it.

---

## Persistence law (ACR-0007 — do not deviate)

- Production runtime persists to **MongoDB + Neo4j + ChromaDB directly**, all three in one logical op, **read-back verified**. Any VM data the dashboard writes (dispositions, retries, actions) follows this and flags any leg that errors loudly — never silently skip a leg.
- Universal Gateway (`localhost:2526`) is developer tooling only — never a production persistence path.
- No Redis.

---

## Task — complete the VM dialer dashboard

### A. Backend — operational endpoints (`server/src/routes/admin/vm.ts` + `server/src/domain/adminVm.ts`, additive)

1. **Live queue state** — `GET /api/admin/vm/queue`: depth by job status (queued/processing/failed/dead_lettered), oldest-waiting age, in-flight count, dead-letter list with reasons/attempts. Source from `vmProviderQueue.ts` — do not invent a parallel store.
2. **Per-campaign delivery progress** — `GET /api/admin/vm/campaigns/:id/progress`: total leads, queued, sent, delivered, failed, suppressed, retryable, with the disposition breakdown already modeled in `tmag_vm_delivery_events`.
3. **Dialer actions** (each `requireAdmin`, each an explicit control-plane write, triple-stack + read-back): `POST .../campaigns/:id/pause`, `.../resume`, `.../retry-failed` (requeue dead-lettered/failed within policy), `.../cancel`. Respect `VM_LIVE_DELIVERY_ENABLED`: when false, actions manage the queue but perform NO real Telnyx drop.
4. Reuse the existing status vocabularies and the `safeQuery`/warnings pattern already in `adminVm.ts`. Add shared response types in `packages/shared` (additive; don't break exports).

### B. Notification hooks (`server/src/domain/vmNotificationHooks.ts`)

5. **Replace the 15 `stubbed` hooks with real implementations** so drop outcomes flow to the BA + lead owner and land as dispositions the dashboard reads. Fail-soft: a notification failure must not break delivery or crash a worker; log + surface, don't throw.

### C. Admin dashboard UI (`apps/admin/src/routes/vm.tsx` + components)

6. Keep the existing overview + ownership-correction. **Add operational panels** consuming the new endpoints: live queue-state panel (auto-refresh/poll), per-campaign progress with disposition breakdown, dead-letter/retry panel, and the dialer action controls (pause/resume/retry/cancel) with confirm-before-irreversible. Loading/empty/stale/partial-failure states on every panel. No mocks — real endpoints only.

### D. Provider path

7. Confirm or finish the real provider path so `acquisition_provider_placeholder` is not the only mode; the dashboard must reflect real delivery outcomes when live delivery is enabled.

---

## Hard constraints

- Additive only; do not break `@momentum/shared` exports or existing VM routes/UI.
- Do NOT modify ratified docs (`constitution/**`, `runtime/**`, `organization/**`, `docs/locked-spec.md`).
- Do NOT enable live delivery by default — `VM_LIVE_DELIVERY_ENABLED` stays a Kevin decision; the dashboard works in both modes.
- Do NOT reintroduce the Universal Gateway as a runtime persistence path.
- Every dialer action is an explicit, audited, triple-stack-persisted control-plane write with read-back.
- Do NOT change `.com` surfaces or the agent code.

---

## Close (required verification)

- `pnpm --filter @momentum/shared typecheck && pnpm --filter @momentum/server typecheck && pnpm --filter @momentum/admin typecheck` — expected green.
- `pnpm --filter @momentum/server test` — all green, including new queue/progress/action + notification-hook tests.
- Demonstrate end-to-end against a running server in GUARDED mode (`VM_LIVE_DELIVERY_ENABLED=false`): import a small lead set → queue → dashboard shows real queue depth + per-campaign progress → trigger pause/resume/retry → confirm queue state changes and each control-plane write reads back across all three legs → notification hooks fire (guarded) and dispositions appear in the dashboard.
- `git status` review confirming only intended `server/src/**`, `packages/shared/src/**`, `apps/admin/src/**`, and test files changed.
- Kevin reviews and merges under ACR-0007 gates. Live Telnyx delivery is a separate explicit Kevin approval (`VM_LIVE_DELIVERY_ENABLED=true` + a live-drop smoke), not part of this task.
