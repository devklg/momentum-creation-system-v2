# Agent Brief — G-broadcast (ADMIN Section G Kevin-Only Broadcast)

**Round:** Chat #144 fan-out.
**Branch:** `feat/admin-g-broadcast`
**Worktree:** `D:/mcs-g-broadcast`
**Sibling agents:** H-server, H-UI, I-export.

---

## What you're building

ADMIN Section G — Kevin-only broadcast composer for sending email and/or SMS
to a selected audience of Brand Ambassadors (never prospects, never .com).
Build order says G ships LAST in /admin per ADMIN J.6; this is that round.

Leaves you ship (build-checklist #122–127):

- **G.1** Composer with per-recipient interpolation (first name, etc.) + preview
- **G.2** Audience selector (all / first-72h / leaders / at-risk / custom),
  with live count
- **G.3** Channel selector (email / text / both)
- **G.4** Send-test-to-Kevin button — sends ONE message to Kevin's own BA
  contact, identical to what the audience will receive (full interpolation)
- **G.5** Queue master broadcast — triple-stack write of the broadcast record,
  per-recipient queue rows, async delivery via Telnyx + Resend
- **G.6** Audit / consent guardrail — STOP keyword opt-out, permanent
  exclusion list, every send audited

---

## Critical constraints (read carefully — these are non-negotiable)

- **BA-facing only.** Broadcasts go to Brand Ambassadors on Team Magnificent.
  Never to prospects. Never on .com. Locked-spec 3.10 / 3.12.
- **Email is DORMANT.** Resend transport is wired (`server/src/services/resend.ts`)
  but the from-domain isn't verified yet. Build the email leg fully; the
  transport already returns `emailDeliveryStatus='skipped'` when the key is
  unset or the domain is unverified. Kevin flips that switch when ready;
  you don't.
- **SMS via Telnyx is LIVE.** Real sends will go out. Verify carefully
  before triggering anything to the full audience — the send-test-to-Kevin
  flow exists exactly to catch a bad draft before it goes wide.
- **STOP keyword is global.** A BA who has texted STOP to any Team
  Magnificent number is on the permanent exclusion list and is never
  included in any audience selector, regardless of how the audience is
  constructed. This is enforced server-side at audience resolution, NOT
  client-side.
- **Per-recipient interpolation is server-side.** The composer shows the
  template with `{{firstName}}` markers; the server resolves them when
  enqueueing each recipient row. The client never sees rendered text for
  a third-party recipient.

---

## Files you own (write here)

- `server/src/domain/broadcast.ts` (NEW — the domain: audience resolution,
  template interpolation, enqueue, status reporting)
- `server/src/routes/admin/broadcast.ts` (NEW — the Express router)
- `server/src/services/broadcastQueue.ts` (NEW — the in-memory job queue
  with retry/backoff; pattern after the webinar cadence cron if there is
  one, otherwise simple `setInterval` worker)
- `server/src/server.ts` (EXTEND — mount the new router and start the
  queue worker; additive only)
- `apps/admin/src/routes/broadcast.tsx` (NEW — the composer page)
- `apps/admin/src/components/admin/broadcast/Composer.tsx` (NEW — G.1)
- `apps/admin/src/components/admin/broadcast/AudienceSelector.tsx` (NEW — G.2)
- `apps/admin/src/components/admin/broadcast/ChannelSelector.tsx` (NEW — G.3)
- `apps/admin/src/components/admin/broadcast/SendTestButton.tsx` (NEW — G.4)
- `apps/admin/src/components/admin/broadcast/BroadcastStatus.tsx` (NEW — G.5,
  live status view: queued / sending / sent / failed counts)
- `apps/admin/src/App.tsx` (EXTEND — register the new route; additive)
- `packages/shared/src/broadcast.ts` (NEW — the broadcast contract types,
  same pattern as `admin-live-ops.ts` and `reporting.ts`)
- `packages/shared/src/index.ts` (EXTEND — add `export * from './broadcast.js'`)

## Files you EXTEND (extend, do NOT rewrite)

- `server/src/services/telnyx.ts` — ADD a `sendBroadcastSms()` helper if
  the existing send fn doesn't fit. The existing SMS send must keep
  working; additive only.
- `server/src/services/resend.ts` — same pattern, add
  `sendBroadcastEmail()` if needed.

## Files you read but never write

- `packages/shared/src/compliance.ts` — STOP keyword rules and the
  permanent exclusion list interface
- `packages/shared/src/types.ts` — BA type, AdminDashboardFilter
- `server/src/domain/auditLog.ts` — `appendAuditEntry`
- `server/src/middleware/requireAuth.ts` — `requireAdmin`

## Files you MUST NOT touch

- `CLAUDE.md`, `docs/locked-spec.md`, `docs/project-wireframe.md`,
  `docs/build-checklist.html`
- `packages/shared/src/admin-live-ops.ts` (H's contract; locked)
- `apps/admin/src/routes/live-ops.tsx` or `components/admin/live-ops/*` (H-UI)
- `server/src/routes/admin/liveOps.ts` (H-server)
- `server/src/services/piiRedact.ts` or `server/src/domain/reports/export.ts`
  (I-export)
- `server/src/routes/admin/reporting.ts` (I-export's append target)

---

## Acceptance criteria (verify before you claim done)

1. `pnpm -r typecheck` exits 0 across all 5 workspaces
2. Audience selectors return live counts: each preset (all / first-72h /
   leaders / at-risk) returns a count, and the count excludes
   STOP-exclusion-list members. Verify by adding a test BA to the
   exclusion list and confirming they drop from `all`.
3. Send-test-to-Kevin (G.4) sends ONE message to Kevin's BA contact only.
   Verify it actually arrives — you may do this once with a real send,
   coordinated with Kevin.
4. Queue master broadcast (G.5) writes the broadcast record to
   `broadcasts` collection (triple-stack), one row per recipient to
   `broadcast_recipients`, and the queue worker advances them through
   `queued → sending → sent` or `→ failed` states.
5. Audit entry per broadcast send: `actor` Kevin, `action`
   `'admin.broadcast_send'`, `entity` the broadcast id, `metadata` with
   audience preset, recipient count, channel, severity `critical` for
   full sends, `info` for send-test.
6. STOP keyword global exclusion verified: a BA on the exclusion list
   receives ZERO sends regardless of audience selection.

---

## Reference reading order

1. `docs/Team-Magnificent-ADMIN-Design.docx` Section G — the visual intent
2. `docs/locked-spec.md` §3.10, §3.12, §3.13 — compliance, Michael (Michael
   is BA-facing, broadcast is also BA-facing but they're independent),
   communication transport
3. `server/src/services/telnyx.ts` and `server/src/services/resend.ts` —
   the existing transport wrappers
4. `server/src/routes/admin/reporting.ts` — admin route + audit pattern

When anything is ambiguous, **STOP and tell Kevin**. This is the surface
where sending the wrong thing wide costs the most.
