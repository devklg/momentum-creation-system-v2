# vm: inbound callback capture (the raised hand) + do_not_drop + live-delivery boot validation

The VM dialer was outbound-first, but the Apache Leads flow is callback-driven: the prospect hears the voicemail and **calls back**. Before this branch, `processTelnyxCallControlWebhook` returned early when `client_state` had no `leadId` — and inbound calls never carry `client_state` — so **every callback was silently dropped**. This branch captures it, writes it into the canonical CRM model, protects the interviewed leads from ever being voicemailed, and turns two known live-delivery config landmines into loud boot failures.

## 1. Inbound callback capture

- `server/src/domain/vmInboundCallback.ts` (new): inbound Telnyx Call Control events (`direction: 'incoming'`) are handled **before** the `client_state` early-return in `processTelnyxCallControlWebhook` (`domain/vmProviderQueue.ts`). Signature verification, raw-body handling, and the fast-2xx + durable-queue path are untouched — inbound events ride the existing `webhook_event` queue.
- Caller ID is normalized with the **same** `normalizeVmPhone` the importer uses and matched against `tmag_vm_bulk_leads.normalizedPhone`. Multiple matches prefer the most recently delivered-to lead (delivery-event evidence), then most recent `updatedAt`.
- **Ownership flows from the lead** (`ownerTmagId` / `sponsorTmagId`) — never from the payload.
- Idempotent per `call_session_id` (Telnyx retries and queue retries cannot double-create). Inbound `call.answered` / `call.hangup` legs are acknowledged without creating state.
- **Unmatched callers** are recorded as unattributed rows in a new `tmag_vm_inbound_calls` collection — visible, never silently dropped, and no callback_request is created without a lead.

## 2. Canonical CRM states wired into (nothing invented)

All from `packages/shared/src/crm-lifecycle.ts` (`p1-54.2026-07-11`) — **not edited**:

| Write | Canonical value used |
|---|---|
| `tmag_prospect_callback_requests` record | intent **`interested_tell_me_more`** (`CRM_CALLBACK_INTENTS`) |
| `tmag_prospect_timeline_events` event | kind **`callback_requested`** (`CRM_TIMELINE_EVENT_KINDS`) |
| `tmag_prospect_crm_records` status | **`needs_follow_up`** (canonical `crmStatuses` for the `callback_requested` state) |
| `tmag_vm_bulk_leads` status | **`callback_requested`** (existing `CRM_VM_LEAD_STATUSES` value; added to the server-local `VmLeadStatus` union in `vmProviderQueue.ts` to mirror the already-canonical shared status) |
| `tmag_vm_delivery_events` | `inbound_callback_received` interest event carrying `vmCampaignId` + `ownerTmagId` so callback **rate per campaign** is computable |

All writes go through the app persistence door (`writeOperational` / `writeKnowledge` → persistence dispatch), are audited (`tmag_vm_audit_events`), and are **read back** (inbound record, callback request, CRM record, lead status).

**Needed but did NOT exist in the CRM model (and was NOT added):** nothing blocking. Two observations for the CRM owner (Codex): (a) `McsCallbackRequestRecord` assumes a non-null `prospectId` + token-origin callback; inbound VM callbacks are lead-origin, so the stored doc carries `prospectId: null`, `leadId`, and `source: 'vm_inbound_call'` — a lead-origin callback-request shape may deserve a canonical home later. (b) there is no canonical "unattributed inbound contact" concept; recorded locally in `tmag_vm_inbound_calls` rather than inventing a lifecycle state.

## 3. `do_not_drop` — the interviewed leads

- `doNotDrop` flag + `leadType` on `VmImportLeadRow` / `VmBulkLeadRecord` (server-local types) and the import route schema; `leadType: 'interviewed'` implies `doNotDrop`.
- **Fail-closed enforcement in the delivery worker** (`vmDeliveryWorker.ts` dispatch), before any campaign gate: flagged lead → provider never called, job terminally `skipped`, a `skipped`/`do_not_drop` delivery event + audit recorded.
- Also blocked at enqueue time (`processCrmCreation`) and excluded from manual-export rows (manual export is a delivery path too).

## 4. The two config landmines (docs + validation only — `.env` untouched)

- `.env.example`: `TELNYX_CONNECTION_ID` now documents the VM dialer app **`mcs-vm-v2` = `2995619818075325536`** (owns `+13236931362`, webhooks to `https://teammagnificent.com/api/telnyx/webhook`) and warns that Michael's app id (`2986799797630928517`) makes every live drop fail. `PROSPECT_BASE_URL` notes the boot validation.
- `server/src/env.ts`: `vmLiveDeliveryConfigProblems()` — when `VM_LIVE_DELIVERY_ENABLED=true` and provider is `telnyx_call_control`, boot **throws** naming every missing/bad value among `TELNYX_CONNECTION_ID`, `TELNYX_DIAL_FROM_NUMBER`, `VM_WEBHOOK_SHARED_SECRET`, and a localhost `PROSPECT_BASE_URL`.

## Deliberately left alone

- `packages/shared/src/crm-lifecycle.ts` and the P1 cross-state QA tests (Codex owns them) — zero edits, zero `packages/shared` edits at all.
- Michael's Telnyx wiring, Steve/Ivory, Holding Tank, placement, §9 migration, memory system, `.env`.
- Existing outbound `call.*` behavior — regression-tested unchanged (AMD state machine, press-1 SMS, retry scheduling).

## Tests

- `domain/__tests__/vmInboundCallback.test.ts` — matched inbound → full canonical write set with owner from the lead; unknown caller → unattributed, no callback_request; idempotency on retry; answered/hangup no-op; outbound regression through the same queue path.
- `workers/__tests__/vmDeliveryWorkerDoNotDrop.test.ts` — `doNotDrop` and `leadType:'interviewed'` refuse dispatch fail-closed (provider never called, job skipped, refusal visible); unflagged lead still dispatches.
- `src/__tests__/envVmLiveValidation.test.ts` — problem-cases for each missing var and localhost/unparseable `PROSPECT_BASE_URL`; silent when live delivery is off or provider is not telnyx.

## Gates

All eight catalog freshness gates regenerated and `--check` green (persistence, schema, mongo-ownership, mongo-indexes, neo4j, chroma, api-routes, route-access) + COM compliance scan · `pnpm typecheck` green · `pnpm build` green · `pnpm --filter @momentum/server test` green (193 files, 1834 passed).
