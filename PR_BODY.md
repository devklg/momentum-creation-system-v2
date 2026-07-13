# vm: live transfer (dialMode) + pilot cockpit (raised hands, worked leads, callback rate)

Two-person pilot cockpit for the 1,320-lead LeadPower pilot (Kevin + Paul, four age-cohort campaigns). Adds the second dialer model, the raised-hand list, the missing "work the lead" verbs, and the per-campaign readout whose one number — **callback rate** — is the pilot's entire output.

## 1. The dialMode matrix (Task 1)

Campaigns gain `dialMode` (`vm_only` default; settable via `PATCH /api/vm/campaigns/:campaignId/dial-mode`). One shared Telnyx Call Control flow; AMD already runs on every outbound dial — this branch adds the human side.

| dialMode | AMD `human` | AMD `machine` |
|---|---|---|
| `vm_only` (default) | no bridge — hang up politely, record `human_no_transfer` | play audio → `voicemail_drop_delivered` |
| `live_transfer` | **bridge** to owner's `transferToNumber` via Telnyx transfer | hang up, no message → `machine_no_message` |
| `both` (pilot choice) | **bridge** | play audio → voicemail left |

**Availability gate — fail closed, never dead air:**
- Owner availability is a VM-local record (`tmag_vm_transfer_availability`: `available` + `transferToNumber`, absence = NOT available). `GET/PUT /api/vm/transfer-availability`, owner-scoped from session. Deliberately not `tmag_sponsor_availability` (weekly booking windows ≠ "am I holding my phone right now") and deliberately **not** an extension of the CRM model.
- Owner unavailable: `live_transfer` → **the dial never leaves the worker** (job requeued, `owner_unavailable_live_transfer` skip event + audit — abandoned calls get numbers flagged); `both` → dial proceeds, human branch falls back to the voicemail.
- Transfer fails / not answered in the short timeout: `both` falls back to playing the voicemail on the original leg (`voicemail_left`), `live_transfer_failed` recorded with the hangup cause.

**Every outcome is a countable delivery event:** `live_transfer_connected`, `live_transfer_completed`, `live_transfer_failed`, `voicemail_left`, `human_no_transfer`, `machine_no_message`, `no_answer`, `failed`.

Dry-run default, `VM_LIVE_DELIVERY_ENABLED`, per-campaign admin approval, and the fail-closed `doNotDrop` refusal are all upstream of the dialMode branch — a dry-run campaign can never bridge, a `doNotDrop` lead is never dialed in any mode (regression-tested).

## 2. Raised-hand list (Task 2)

`GET /api/vm/raised-hands` (owner-scoped) + a new "Called back — call them now" section at the **top** of `apps/team/src/routes/vm-campaigns.tsx` (kept in the existing route — the pilot is one screen, not two). Newest first: name · phone · city · how long ago they called · campaign · when the lead was originally interviewed (`interviewedAt` / `createdAt`) so Kevin knows how cold they are before dialing. A callback stays on the list until the lead is dispositioned. Unattributed inbound calls (`tmag_vm_inbound_calls`, unmatched caller ID) are surfaced alongside, with an explicit dismiss (`POST /api/vm/inbound-calls/:inboundCallId/dismiss`) — a raised hand never quietly disappears.

## 3. Work the lead (Task 3)

The lead table gains an openable work panel (`GET /api/vm/leads/:leadId`); all writes owner-scoped from session, through the app persistence door, audited, read back:

- **Disposition** — `POST .../disposition`, canonical `CRM_DISPOSITIONS` values only, validated server-side. Nothing invented.
- **Notes** — `POST .../notes`, timestamped append. The conversation is the asset.
- **Follow-up** — `POST .../follow-up` / `DELETE .../follow-up`, canonical `scheduled`/`due`/`cleared` follow-up states; `followUpDueAt` mirrored to the CRM record for the due-today view.
- **Invite** — `POST .../invite` surfaces the lead's **existing** rvm invite link (no new invite path) so Kevin sends it himself. Human-send only; the system never texts a prospect.
- **Do not call** — `POST .../do-not-call`, permanent: feeds the existing suppression list and sets `doNotDrop`, honored fail-closed in every mode.

## 4. Readout (Task 4)

`GET /api/vm/pilot-readout` + compact per-campaign table: Dropped · Voicemails left · Live transfers · **Callbacks** · **Callback rate** (callbacks ÷ voicemails delivered) · median time-to-callback (last delivery before the callback per lead). Computed from the delivery events + callback requests already written by PR #216 and Task 1 — the four age-cohort campaigns answer "what is lead age worth" directly.

## Canonical CRM values consumed (nothing added)

From `packages/shared/src/crm-lifecycle.ts` — **zero edits**: `CRM_DISPOSITIONS` (disposition writes), follow-up states `scheduled`/`due`/`cleared`, `CRM_CALLBACK_INTENTS`/`CRM_TIMELINE_EVENT_KINDS` (consumed via the PR #216 inbound path, unchanged).

**Needed but did NOT exist (and was NOT added):** a canonical binary "owner is live-transfer-available right now" concept — kept VM-local in `tmag_vm_transfer_availability` per the brief. Live-transfer delivery-event outcomes (`live_transfer_connected` etc.) are VM delivery-event statuses, not CRM lifecycle states — recorded on `tmag_vm_delivery_events` only.

## Rebase note — P1 QA count snapshots (flagging explicitly)

This branch was rebased onto `main` after P1-73…P1-77 merged. P1-73's route-access snapshot tests (`server/src/qa/__tests__/routeAccessMatrix.test.ts`, `baRouteGateProtection.test.ts`) hard-code route counts; this lane's 13 new `/api/vm/*` routes legitimately bump them (214→227 routes, 12→25 VM-entitled, requireAuth 87→100, brand_ambassador 88→101). **Only the numeric literals were updated** — no assertion logic touched, and `baRouteGateProtection` passing confirms every new route carries `requireAuth` + `requireSteveComplete` + `requireVmDialerAccess` with zero findings. These are route-count snapshots, not the P1 cross-state CRM QA tests (untouched). Codex/Kevin: veto if you'd rather own these bumps.

## Deliberately left alone

- `packages/shared/src/crm-lifecycle.ts` and the P1 cross-state QA tests — zero edits. `packages/shared` edits limited to append-only blocks in `types.ts`.
- Telnyx stays external-runtime-only — no Steve/Michael/Ivory wiring.
- Holding Tank, placement, §9 migration, memory system, `.env`.
- Existing `vm_only` machine-drop behavior, press-1 gather, AMD state machine, retry scheduling — regression-tested unchanged.

## Tests

- `domain/__tests__/vmDialMode.test.ts` — full matrix (`vm_only`/`live_transfer`/`both` × `human`/`machine`), transfer-failure → voicemail fallback in `both`, outcomes recorded.
- `workers/__tests__/vmDeliveryWorkerLiveTransfer.test.ts` — owner unavailable: `live_transfer` never dials (fail closed), `both` proceeds; dry-run never bridges; `doNotDrop` never dialed in any mode.
- `domain/__tests__/vmLeadWork.test.ts` — owner-scoped disposition/notes/follow-up writes, canonical values enforced, do-not-call suppression, invite is surface-only.
- `domain/__tests__/vmPilotReadout.test.ts` — callback-rate math against seeded delivery events, median time-to-callback.

## Gates

All eight catalogs + COM compliance scan + docs freshness manifest regenerated post-rebase and `:check` green · `pnpm typecheck` green · `pnpm build` green · `pnpm --filter @momentum/server test` green (204 files, 1886 passed).
