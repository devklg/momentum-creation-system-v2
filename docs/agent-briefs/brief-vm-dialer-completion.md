# Lane Brief — VM Dialer Completion (Codex)

**Date:** 2026-07-09 · **Authority:** Kevin (sole ratification) · **Status:** Proposed — implement on a lane branch, PR for Kevin's review, never self-merge.

## Mission
Take the VM (ringless voicemail) dialer module from "backend substrate complete, UI mock" to fully functional end-to-end: BA imports leads → queue pipeline validates/suppresses/tokens/CRMs → delivery worker drops voicemail (dry-run by default, Telnyx live only when admin-approved) → BA sees real campaigns, leads, and metrics in the Team app.

## Ground truth (audited 2026-07-09 — all verified in code)

**Complete and wired:**
- `server/src/routes/vm.ts` — `/api/vm` lead-owners + campaigns + import (auth: `requireAuth` → `requireSteveComplete` → `requireVmDialerAccess`). Ownership from `req.session.tmagId` only.
- `server/src/domain/vmProviderQueue.ts` — full queue substrate: `import_validate → suppression_check → token_generate → crm_create → delivery` job chain, dedupe (sha256 owner+phone+email), phone/email normalization, retries w/ backoff, dead-letter, audit events, Telnyx AMD webhook processing (greeting-ended → playback → hangup, DTMF opt-out path).
- Workers auto-start in `server/src/index.ts` (~L290): `vmImportWorker`, `vmDeliveryWorker` (1s tick, batch 10, rate-limited via `VM_DELIVERY_RATE_PER_MINUTE`), `vmWebhookWorker`.
- Providers: `manual_csv` (never live), `acquisition_provider_placeholder`, `telnyx_call_control` (live-capable) in `server/src/services/vmProviders/`.
- `/api/vm/provider/*` webhooks + admin manual-csv import/export (`vmProviderWebhooks.ts`).
- `/api/rvm/:token` prospect routes + `apps/com/src/routes/rvm-token.tsx` (activation, forward-only video milestones, Holding Tank only after `video_complete`).
- Admin overview: `/api/admin/vm/overview` + `/ownership-correction`, wired in `apps/admin/src/routes/vm.tsx`.
- Entitlement domain: `entitlements.ts` (`vm_dialer`), granted via `adminBaOversight.ts` → `setMemberEntitlement`.
- Env gates: `VM_PROVIDER_MODE`, `VM_LIVE_DELIVERY_ENABLED` (default false), `VM_DELIVERY_RATE_PER_MINUTE`, `VM_WEBHOOK_SHARED_SECRET`, `TELNYX_*` in `env.ts`.

## Gaps — blocking (this lane's work)

### 1. Team app UI is a pure mock
`apps/team/src/routes/vm-campaigns.tsx` uses `EXAMPLE_BATCH`/`EXAMPLE_CAMPAIGN` in `useState`; **zero fetch calls**. Nothing a BA does touches the server.
**Do:** Rewrite the page against the real API (pattern: `fetch('/api/...', { credentials: 'include' })` as in `apps/admin/src/routes/vm.tsx` and the wired team pages, e.g. `crm.tsx`):
- List/create lead owners (`GET/POST /api/vm/lead-owners`).
- List/create campaigns (`GET/POST /api/vm/campaigns`), campaign detail (`GET /api/vm/campaigns/:campaignId`).
- CSV/paste lead import UI → import endpoint (see gap 2 for which one).
- Real per-campaign metrics + lead table (see gap 5 for the endpoints you must add).
- Handle `403 VM_DIALER_NOT_ENABLED` with a clear "ask Kevin to enable the dialer" state.
- Surface provider list + whether campaign is dry-run vs live-approved.

### 2. BA import path never reaches the dialer (divergent writers — schema-catalog reconciliation #1)
`POST /api/vm/lead-owners/:leadOwnerId/import` calls `bulkLeads.importBulkLeads` — a **synchronous** path that mints prospect + token + CRM immediately, with **no dedupe, no suppression check, no phone normalization, and it never enqueues a `delivery` job**. The proper queued pipeline (`vmProviderQueue.createManualImportJobs`) is only reachable through the **admin-only** `POST /api/vm/provider/manual-csv/import`.
Both write `tmag_vm_bulk_leads` with divergent field sets / status vocabularies (`McsBulkLeadRecord` vs `VmBulkLeadRecord`+`VmLeadStatus`). Catalog also claims an id-prefix divergence (`lead_` vs `vmlead_`) — verify; the queue writer currently uses `lead_` too.
**Do:** Make the queue pipeline the single canonical import path. Point the BA route at `createManualImportJobs` (keep the response contract useful: return `importJobId`, `chunksQueued`, `rowsAccepted`; add a status endpoint `GET /api/vm/imports/:importJobId` summarizing per-status lead counts). Retire or clearly quarantine the `bulkLeads.ts` synchronous writer (do NOT leave two writers). Preserve the invariant: imported leads are acquisition records — no `placeProspect`, no Holding Tank rows.

### 3. `adminApprovedForLiveDelivery` has no writer
`vmDeliveryWorker` gates live sends on `campaign.adminApprovedForLiveDelivery === true`, but **no endpoint, domain function, or UI ever sets it** → live delivery is structurally impossible.
**Do:** Add `POST /api/admin/vm/campaigns/:vmCampaignId/live-approval` (grant/revoke, `requireAdmin`), write via `tripleStackWrite`/persistence door, append an `auditLog` entry (same pattern as entitlements), and add the approve/revoke control to `apps/admin/src/routes/vm.tsx` campaign rows.

### 4. No campaign lifecycle
Status is set once at creation (`draft`|`scheduled`) and never transitions. `scheduledAt` is stored but **nothing consumes it** — delivery jobs are enqueued the moment `crm_create` completes, regardless of campaign status or schedule. No pause/cancel/complete.
**Do:**
- `PATCH /api/vm/campaigns/:id/status` (owner-scoped): legal transitions `draft→ready→scheduled/running`, `running↔paused`, `→cancelled`, worker-driven `→completed`. Enforce the transition table server-side; audit each transition.
- Gate the delivery worker: before dispatch, check the campaign is `running` (or `scheduled` with `scheduledAt <= now`, which flips it to `running`); requeue (`availableAt = scheduledAt`) or skip otherwise. Mark `completed` when no queued/processing delivery jobs remain for the campaign.
- Update the create flow so imports can happen in `draft` without immediately dropping voicemails.

### 5. No BA-scoped metrics/lead read endpoints
Admin overview aggregates exist, but the BA UI has nothing to render.
**Do:** `GET /api/vm/campaigns/:id/metrics` (counts by `VmLeadStatus`: imported/validated/invalid/duplicate/suppressed/token_created/crm_created/delivery_dry_run/manual_exported/voicemail_drop_delivered/failed/opted_out) and `GET /api/vm/campaigns/:id/leads?status=&page=` (paginated, owner-scoped). Mongo reads via the persistence dispatch layer, filtered by `ownerTmagId` from session.

### 6. Manual CSV export is admin-only
`GET /api/vm/provider/manual-csv/export/:campaignId` requires admin, but `manual_csv` is the default BA provider — a BA can't retrieve their own export.
**Do:** Add an owner-scoped export under `/api/vm/campaigns/:id/manual-export` (requireVmDialerAccess, campaign ownership enforced), reusing the existing export builder.

## Secondary (do if time, flag if deferred)
- **`vm_delivery_events` contract mismatch** (catalog reconciliation #2): runtime writer emits `{eventId, details, dryRun, attempt}`; the shared `VMDeliveryEventRecord` type declares `{deliveryEventId, channel, occurredAt, metadata}`. Align the **shared type to the runtime writer** (no persisted-data rename in this lane) and note it in the PR.
- **Entitlement UI:** verify the `vm_dialer` grant/revoke is actually exposed in the admin BAs page; if not, add the toggle (domain + audit already exist).
- **Follow-up templates:** campaigns store `smsTemplateId`/`emailTemplateId` but there is no template CRUD or follow-up send flow. Confirm scope with Kevin before building — likely a separate ACR. The DTMF=1 → SMS path in the Telnyx webhook already exists; don't duplicate it.

## Explicitly OUT OF SCOPE — do not touch
- **CRM disposition rename** (`new_ba → new_tmag_member`, enum unification — Kevin decided 2026-07-01): executes in the **governed §9 reconciliation migration**, not piecemeal here.
- **Neo4j `BA` label collapse** — also §9.
- Any Holding Tank / `placeProspect` changes; RVM placement stays gated on `video_complete`.
- Universal Gateway anywhere in runtime persistence (it is dev tooling only).

## Guardrails (constitutional — violations fail review)
1. Every write goes through `persist()`/`tripleStackWrite` or the persistence dispatch layer — the only door. All three legs (Mongo 30000 / Chroma 8200 / Neo4j 7710 locally; Atlas/Chroma Cloud/Aura in prod) in the same operation; error loudly, never silently skip a leg.
2. Ownership/sponsor identity from `req.session.tmagId` only; client payloads never set it.
3. Telnyx is external runtime only (VM drops, SMS, callbacks). Never wire it into Steve/Michael/Ivory/browser voice.
4. Dry-run is the default posture: live requires `VM_LIVE_DELIVERY_ENABLED=true` **and** campaign `adminApprovedForLiveDelivery` **and** a live-capable provider.
5. Respect suppression/consent: `do_not_contact` and suppression-list hits never receive delivery jobs.

## Gates before PR
`pnpm typecheck` · `pnpm build` · server tests (`pnpm --filter server test`) all green. Add/extend tests: campaign transition table, delivery worker campaign-status gating, BA import → queue pipeline (dedupe + suppression respected), live-approval endpoint auth. Update `docs/PRODUCTION_RUNBOOK.md` only if env or service behavior changes.

## Suggested lane split (if run as multi-agent)
- **Lane A (server):** gaps 2, 3, 4, 5, 6 + tests.
- **Lane B (UI):** gap 1 (team app) + admin approve-live control — can start against the API contracts defined above; freeze contracts in `@momentum/shared` first.
